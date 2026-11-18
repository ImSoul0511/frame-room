"""Serve the separate local dataset curator. Keys stay on this loopback server."""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import secrets
import shutil
import subprocess
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

from portfolio_dataset import CATEGORIES, GENRES, ROOT, DatasetError, Supabase

DIST = ROOT / ".artifacts/dataset-studio/dist"
MIGRATION = "supabase/migrations/202611160003_dataset_studio.sql"
DELETE_MIGRATION = "supabase/migrations/202611180001_dataset_studio_delete_images.sql"
DELETE_RPC = "/rest/v1/rpc/dataset_studio_delete_images"
SETS_MIGRATION = "supabase/migrations/202611180002_dataset_studio_photo_sets.sql"
SETS_RPC = "/rest/v1/rpc/dataset_studio_sets_apply"
SETS_ACTIONS = {"set.save", "set.assign"}
SET_AWARE_ACTIONS = {"album.archive", "images.move", "images.order"}
ACTION_FIELDS = {
    "photographer.save": {"id", "display_name", "bio", "city"},
    "photographer.archive": {"id", "archived"},
    "photographer.order": {"ids"},
    "album.save": {"id", "photographer_id", "request_id", "title", "description", "genre", "status"},
    "album.archive": {"id", "archived"},
    "album.order": {"ids", "photographer_id"},
    "set.save": {"id", "request_id", "title", "description", "genre", "ids"},
    "set.assign": {"id", "photographer_id"},
    "image.save": {"id", "caption", "label_status", "tag_ids"},
    "images.move": {"ids", "portfolio_id"},
    "images.order": {"ids", "portfolio_id"},
    "images.archive": {"ids", "archived"},
    "images.delete": {"ids"},
    "images.review": {"ids", "label_status"},
    "images.tags": {"ids", "tag_ids", "mode"},
    "tag.save": {"id", "slug", "name", "name_vi", "category", "definition_en", "definition_vi", "aliases"},
    "tag.archive": {"id", "archived"},
}


class StudioError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, reason: str = ""):
        super().__init__(message)
        self.code, self.status, self.reason = code, status, reason


def validate_action(action: str, payload: dict) -> dict:
    if not isinstance(action, str) or action not in ACTION_FIELDS or not isinstance(payload, dict):
        raise StudioError("INVALID_INPUT", "Unknown action or invalid payload.")
    if set(payload) - ACTION_FIELDS[action]:
        raise StudioError("INVALID_INPUT", "Unexpected fields.")
    for key in ("id", "photographer_id", "portfolio_id", "request_id"):
        if payload.get(key) is not None:
            try:
                uuid.UUID(payload[key])
            except (ValueError, TypeError, AttributeError) as error:
                raise StudioError("INVALID_INPUT", "Invalid identifier.") from error
    for key in ("ids", "tag_ids"):
        if key in payload:
            values = payload[key]
            if not isinstance(values, list) or len(values) > 500 or len(set(map(str, values))) != len(values):
                raise StudioError("INVALID_INPUT", "Invalid identifier selection.")
            for value in values:
                try:
                    uuid.UUID(value)
                except (ValueError, TypeError, AttributeError) as error:
                    raise StudioError("INVALID_INPUT", "Invalid selection identifier.") from error
    if "archived" in payload and not isinstance(payload["archived"], bool):
        raise StudioError("INVALID_INPUT", "Invalid archive state.")
    if action.endswith(".order") or action.startswith("images."):
        if not payload.get("ids"):
            raise StudioError("INVALID_INPUT", "Select at least one item.")
    if action in ("image.save", "images.review") and payload.get("label_status") not in ("unlabeled", "suggested", "reviewed"):
        raise StudioError("INVALID_INPUT", "Invalid annotation state.")
    if action == "image.save" and "tag_ids" not in payload:
        raise StudioError("INVALID_INPUT", "Explicit tag selection is required.")
    if action == "images.tags" and payload.get("mode") not in ("add", "remove", "replace"):
        raise StudioError("INVALID_INPUT", "Invalid tag operation.")
    if action == "album.save" and (payload.get("genre") not in GENRES or payload.get("status") not in ("draft", "published", "hidden")):
        raise StudioError("INVALID_INPUT", "Invalid album classification.")
    if action == "set.save" and (
        payload.get("genre") not in GENRES or bool(payload.get("id")) == bool(payload.get("request_id"))
        or ("ids" in payload and (payload.get("id") or not payload["ids"]))
    ):
        raise StudioError("INVALID_INPUT", "Invalid photo set.")
    if action == "set.assign" and not (payload.get("id") and payload.get("photographer_id")):
        raise StudioError("INVALID_INPUT", "Select a photo set and a photographer.")
    required = {"album.save": ("title",), "set.save": ("title",), "photographer.save": ("display_name",), "tag.save": ("name", "name_vi", "slug")}
    for key in required.get(action, ()):
        if not isinstance(payload.get(key), str) or not payload[key].strip():
            raise StudioError("INVALID_INPUT", "A required field is empty.")
    limits = {"display_name": 60, "title": 150, "bio": 4000, "city": 120, "caption": 4000,
        "description": 10000, "name": 100, "name_vi": 100, "slug": 100, "definition_en": 4000, "definition_vi": 4000}
    for key, limit in limits.items():
        if key in payload and (not isinstance(payload[key], str) or len(payload[key]) > limit):
            raise StudioError("INVALID_INPUT", "A text field is invalid or too long.")
    if action == "tag.save":
        if payload.get("category") not in CATEGORIES:
            raise StudioError("INVALID_INPUT", "Invalid tag category.")
        aliases = payload.get("aliases", [])
        if not isinstance(aliases, list) or len(aliases) > 30 or any(not isinstance(v, str) or len(v) > 100 for v in aliases):
            raise StudioError("INVALID_INPUT", "Invalid tag aliases.")
    return payload


def all_rows(db: Supabase, table: str, select="*", **params) -> list[dict]:
    result = []
    for offset in range(0, 100000, 500):
        order = {"image_tags": "portfolio_image_id.asc,tag_id.asc",
            "dataset_studio_set_images": "image_id.asc"}.get(table, "id.asc")
        batch = db.rows(table, select=select, order=order, limit=500, offset=offset, **params)
        result.extend(batch)
        if len(batch) < 500:
            return result
    raise StudioError("UNAVAILABLE", "Dataset pagination limit reached.", 503)


class StudioService:
    def __init__(self, read_only=False, factory=Supabase):
        self.read_only = read_only
        self.factory = factory
        self.local = threading.local()
        self.lock = threading.Lock()
        self.snapshot_lock = threading.Lock()
        self.generation = 0
        self.cached = None
        self.cached_at = 0.0
        self.rpc_ready = False
        self.sets_ready = False

    @property
    def db(self):
        if not hasattr(self.local, "db"):
            self.local.db = self.factory()
        return self.local.db

    def check_sets(self, db):
        try:
            return db.request("POST", SETS_RPC, payload={"p_action": "ping", "p_payload": {}},
                retry_safe=True).get("version") == 1
        except DatasetError as error:
            if "HTTP 404" not in str(error):
                raise
            return False

    def capabilities(self):
        db = self.db
        ready = False
        try:
            ready = db.request("POST", "/rest/v1/rpc/dataset_studio_apply", payload={"p_action": "ping", "p_payload": {}}, retry_safe=True).get("version") == 1
        except DatasetError as error:
            if "HTTP 404" not in str(error):
                raise
        sets_ready = ready and self.check_sets(db)
        delete_ready = False
        if ready and not self.read_only:
            try:
                delete_ready = db.request("POST", DELETE_RPC, payload={"p_ids": []}, retry_safe=True).get("deleted") == 0
            except DatasetError as error:
                if "HTTP 404" not in str(error):
                    raise
        return ready, sets_ready, delete_ready

    def snapshot(self, force=False):
        with self.snapshot_lock:
            with self.lock:
                if not force and self.cached is not None and time.monotonic() - self.cached_at < 5:
                    return self.cached
                generation = self.generation
            db = self.db
            portfolios, images, assignments = [], [], []
            with ThreadPoolExecutor(max_workers=2) as readers:
                capabilities = readers.submit(self.capabilities)
                catalog = readers.submit(lambda: all_rows(self.db, "tags", category="neq.source"))
                photographers = all_rows(db, "photographers", dataset_key="not.is.null")
                for start in range(0, len(photographers), 50):
                    ids = ",".join(p["id"] for p in photographers[start:start + 50])
                    portfolios.extend(all_rows(db, "portfolios", photographer_id=f"in.({ids})"))
                for start in range(0, len(portfolios), 50):
                    ids = ",".join(p["id"] for p in portfolios[start:start + 50])
                    images.extend(all_rows(db, "portfolio_images",
                        select="*,image_tags(tag_id,source,confidence)", portfolio_id=f"in.({ids})"))
                ready, sets_ready, delete_ready = capabilities.result()
                members = {}
                if sets_ready:
                    links = readers.submit(lambda: all_rows(self.db, "dataset_studio_set_images"))
                    groups = all_rows(db, "dataset_studio_sets", select="id,title,description,genre,created_at,deleted_at")
                    group_ids = {group["id"] for group in groups}
                    members = {link["image_id"]: link for link in links.result() if link["set_id"] in group_ids}
                    portfolios.extend({**group, "photographer_id": None, "status": "draft", "dataset_key": None}
                        for group in groups)
                tags = catalog.result()
            self.rpc_ready = ready
            self.sets_ready = sets_ready
            tag_ids = {tag["id"] for tag in tags}
            for image in images:
                membership = members.get(image["id"])
                if membership:
                    image["portfolio_id"] = membership["set_id"]
                    image["sort_order"] = membership["sort_order"]
                assignments.extend({"portfolio_image_id": image["id"], **link}
                    for link in image.pop("image_tags", []) if link["tag_id"] in tag_ids)
                image["url"] = db.url + "/storage/v1/object/public/portfolio-images/" + quote(image["storage_path"], safe="/")
            snapshot = {"photographers": photographers, "portfolios": portfolios, "images": images,
                "tags": tags, "assignments": assignments,
                "ready": ready, "delete_ready": delete_ready, "read_only": self.read_only,
                "migration": MIGRATION, "delete_migration": DELETE_MIGRATION,
                "sets_ready": sets_ready, "sets_migration": SETS_MIGRATION}
            with self.lock:
                if generation == self.generation:
                    self.cached = snapshot
                    self.cached_at = time.monotonic()
            return snapshot

    def apply(self, action, payload):
        if self.read_only:
            raise StudioError("FORBIDDEN", "This server is running in read-only mode.", 403)
        validate_action(action, payload)
        if not self.rpc_ready:
            try:
                self.rpc_ready = self.db.request("POST", "/rest/v1/rpc/dataset_studio_apply", payload={"p_action": "ping", "p_payload": {}}, retry_safe=True).get("version") == 1
            except DatasetError as error:
                if "HTTP 404" not in str(error):
                    raise
            if not self.rpc_ready:
                raise StudioError("UNAVAILABLE", "Run the dataset studio migration first.", 503, "migration_required")
        if action in SETS_ACTIONS | SET_AWARE_ACTIONS and not self.sets_ready:
            self.sets_ready = self.check_sets(self.db)
        if action in SETS_ACTIONS and not self.sets_ready:
            raise StudioError("UNAVAILABLE", "Run the photo-set migration first.", 503, "sets_migration_required")
        if self.sets_ready and action in SETS_ACTIONS | SET_AWARE_ACTIONS:
            result = self.db.request("POST", SETS_RPC, payload={"p_action": action, "p_payload": payload})
        elif action == "images.delete":
            try:
                result = self.db.request("POST", DELETE_RPC, payload={"p_ids": payload["ids"]})
            except DatasetError as error:
                if "HTTP 404" in str(error):
                    raise StudioError("UNAVAILABLE", "Run the permanent image deletion migration first.",
                        503, "delete_migration_required") from error
                raise
        else:
            if action in ("image.save", "images.tags") and payload.get("tag_ids"):
                # Small chunks keep the PostgREST query URL within typical proxy limits.
                values = [str(uuid.UUID(value)) for value in payload["tag_ids"]]
                for start in range(0, len(values), 50):
                    batch = ",".join(values[start:start + 50])
                    if self.db.rows("tags", select="id", id=f"in.({batch})", category="eq.source", limit=1):
                        raise StudioError("INVALID_INPUT", "Source tags are unavailable in Dataset Studio.")
            result = self.db.request("POST", "/rest/v1/rpc/dataset_studio_apply", payload={"p_action": action, "p_payload": payload})
        with self.lock:
            self.cached = None
            self.generation += 1
        return result


def build_frontend():
    web = ROOT / "apps/web"
    vite = web / "node_modules/vite/bin/vite.js"
    node = shutil.which("node")
    if not node or not vite.exists():
        raise DatasetError("Node.js and workspace dependencies are required. Install them with pnpm first.")
    if not DIST.resolve().is_relative_to((ROOT / ".artifacts").resolve()):
        raise DatasetError("Build output must remain inside the workspace artifacts directory.")
    sources = [web / "dataset-studio.html", web / "vite.dataset-studio.config.ts", *sorted((web / "src/dataset-studio").glob("*"))]
    fingerprint = hashlib.sha256(b"".join(p.read_bytes() for p in sources if p.is_file())).hexdigest()
    marker = DIST.parent / "build.sha256"
    if (DIST / "dataset-studio.html").exists() and marker.exists() and marker.read_text() == fingerprint:
        return
    result = subprocess.run([node, str(vite), "build", "--config", "vite.dataset-studio.config.ts"], cwd=web, check=False)
    if result.returncode:
        raise DatasetError("Dataset Studio frontend build failed.")
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text(fingerprint)


class StudioServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, port, service):
        self.service = service
        self.token = secrets.token_urlsafe(32)
        super().__init__(("127.0.0.1", port), StudioHandler)


class StudioHandler(BaseHTTPRequestHandler):
    server: StudioServer

    def allowed_host(self):
        port = self.server.server_address[1]
        return self.headers.get("Host") in (f"127.0.0.1:{port}", f"localhost:{port}")

    def reply(self, status, data, content_type="application/json; charset=utf-8"):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8") if not isinstance(data, bytes) else data
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)

    def fail(self, error):
        if isinstance(error, StudioError):
            self.reply(error.status, {"error": {"code": error.code, "message": str(error), "details": [{"reason": error.reason}] if error.reason else []}})
        else:
            # Supabase errors contain no raw headers/bodies; keep server details out of UI.
            status = 409 if "HTTP 409" in str(error) else 400 if isinstance(error, ValueError) or "HTTP 400" in str(error) else 403 if "HTTP 403" in str(error) else 503
            code = "CONFLICT" if status == 409 else "INVALID_INPUT" if status == 400 else "FORBIDDEN" if status == 403 else "UNAVAILABLE"
            self.reply(status, {"error": {"code": code, "message": "The dataset operation could not complete.", "details": []}})
            detail = str(error) if isinstance(error, DatasetError) else type(error).__name__
            print(f"Dataset request failed: {detail}", flush=True)

    def do_GET(self):
        if not self.allowed_host():
            return self.reply(403, {"error": {"code": "FORBIDDEN", "message": "Invalid host.", "details": []}})
        path = urlparse(self.path).path
        try:
            if path == "/api/health":
                return self.reply(200, {"ok": True, "service": "dataset-studio"})
            if path == "/api/bootstrap":
                result = self.server.service.snapshot(force="refresh=1" in self.path)
                return self.reply(200, {"data": result, "token": self.server.token})
            asset = "dataset-studio.html" if path == "/" else unquote(path.lstrip("/"))
            target = (DIST / asset).resolve()
            if not target.is_relative_to(DIST.resolve()) or not target.is_file():
                return self.reply(404, {"error": {"code": "NOT_FOUND", "message": "Not found.", "details": []}})
            content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
            if target.suffix == ".js":
                content_type = "text/javascript"
            return self.reply(200, target.read_bytes(), content_type)
        except (DatasetError, StudioError, ValueError, OSError) as error:
            return self.fail(error)

    def do_POST(self):
        port = self.server.server_address[1]
        origin = self.headers.get("Origin")
        if not self.allowed_host() or origin not in (None, f"http://127.0.0.1:{port}", f"http://localhost:{port}"):
            return self.fail(StudioError("FORBIDDEN", "Invalid origin.", 403))
        if not secrets.compare_digest(self.headers.get("X-Dataset-Token", ""), self.server.token):
            return self.fail(StudioError("FORBIDDEN", "Invalid local session token.", 403))
        try:
            if self.path != "/api/action":
                raise StudioError("NOT_FOUND", "Not found.", 404)
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                raise StudioError("INVALID_INPUT", "JSON is required.")
            size = int(self.headers.get("Content-Length", "0"))
            if size < 1 or size > 1024 * 1024:
                raise StudioError("INVALID_INPUT", "Invalid request size.")
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict) or set(body) != {"action", "payload"}:
                raise StudioError("INVALID_INPUT", "Invalid action envelope.")
            result = self.server.service.apply(body["action"], body["payload"])
            return self.reply(200, {"data": result})
        except (DatasetError, StudioError, ValueError, OSError) as error:
            return self.fail(error)

    def do_OPTIONS(self):
        self.fail(StudioError("FORBIDDEN", "Cross-origin access is disabled.", 403))

    def log_message(self, format, *args):
        if args and str(args[1:2]) != "('200',)":
            super().log_message(format, *args)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--read-only", action="store_true")
    parser.add_argument("--build-only", action="store_true")
    args = parser.parse_args()
    try:
        build_frontend()
        if args.build_only:
            return
        service = StudioService(read_only=args.read_only)
        server = StudioServer(args.port, service)
        print(f"Dataset Studio: http://127.0.0.1:{server.server_port}", flush=True)
        print("Press Ctrl+C to stop. Supabase keys remain on this local server.", flush=True)
        try:
            server.serve_forever()
        finally:
            server.server_close()
    except KeyboardInterrupt:
        print("Dataset Studio stopped.")
    except (DatasetError, OSError) as error:
        print(str(error) if isinstance(error, DatasetError) else "Could not start the local server. Check the port and local permissions.")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
