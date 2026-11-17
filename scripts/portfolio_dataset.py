"""Collect loose demo photographs, then optionally import them into Supabase.

No embeddings, automatic aesthetic labels, source-author profiles, or album inference.
Run with --help; see docs/ai/portfolio-dataset.md for the complete workflow.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import csv
import hashlib
import io
import json
import os
import re
import secrets
import sys
import threading
import time
import warnings
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, quote, urlencode, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
GENRES = ("portrait", "fashion", "wedding", "family", "product", "food", "event", "cosplay")
CATEGORIES = {
    "genre", "subject", "setting", "lighting", "color_tone", "mood",
    "composition", "style", "editing", "styling", "source",
}
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36"
MAX_BYTES = 20 * 1024 * 1024


class DatasetError(Exception):
    """An error safe to display without request headers or secret-bearing bodies."""


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_env(path: Path = ROOT / ".env") -> None:
    if not path.exists():
        return
    values = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        match = re.match(r"^\s*(?:export\s+)?([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$", line)
        if match:
            value = match[2]
            if value[:1] in ("'", '"') and value[-1:] == value[:1]:
                value = value[1:-1]
            else:
                value = re.split(r"\s+#", value, maxsplit=1)[0].strip()
            values[match[1]] = value
    for key, value in values.items():
        os.environ.setdefault(key, value)


def read_manifest(directory: Path) -> list[dict]:
    path = directory / "manifest.jsonl"
    if not path.exists():
        return []
    result = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            result.append(json.loads(line))
        except json.JSONDecodeError as error:
            raise DatasetError(f"Invalid manifest line {number}; repair it before resuming.") from error
    return result


def local_image(directory: Path, relative: str) -> Path:
    path = (directory / relative).resolve()
    if not path.is_relative_to(directory.resolve()):
        raise DatasetError("Manifest image path leaves the dataset directory.")
    return path


class PublicHttp:
    def __init__(self, delay: float = 1.0):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "en,vi;q=0.8"})
        self.delay = delay
        self.last_request = 0.0

    def get(self, url: str, *, image: bool = False) -> bytes:
        if urlparse(url).scheme not in ("http", "https"):
            raise DatasetError("Only HTTP(S) source URLs are supported.")
        # This session NEVER receives Supabase keys, browser cookies, or Auth headers.
        for attempt in range(3):
            time.sleep(max(0, self.delay - (time.monotonic() - self.last_request)))
            self.last_request = time.monotonic()
            try:
                with self.session.get(url, timeout=(10, 30), stream=True) as response:
                    if response.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                        retry = response.headers.get("Retry-After", "")
                        time.sleep(min(30, int(retry) if retry.isdigit() else 2 ** attempt))
                        continue
                    if not response.ok:
                        raise DatasetError(f"Source HTTP {response.status_code} ({urlparse(url).hostname}).")
                    if image and not response.headers.get("Content-Type", "").startswith("image/"):
                        raise DatasetError("Source returned a non-image response.")
                    chunks, size = [], 0
                    for chunk in response.iter_content(65536):
                        size += len(chunk)
                        if size > MAX_BYTES:
                            raise DatasetError("Source response exceeds 20 MiB.")
                        chunks.append(chunk)
                    return b"".join(chunks)
            except requests.RequestException as error:
                if attempt == 2:
                    raise DatasetError(f"Source connection failed ({urlparse(url).hostname}).") from error
        raise DatasetError("Source retry limit exceeded.")


def image_urls(image, base: str) -> list[str]:
    values = []
    for attr in ("srcset", "data-srcset"):
        # Largest advertised density/width last in the sources currently inspected.
        values.extend(part.strip().split()[0] for part in image.get(attr, "").split(",") if part.strip())
    values.reverse()
    values.extend(image.get(attr) for attr in ("data-src", "src") if image.get(attr))
    return [urljoin(base, value) for value in values if not value.startswith("data:")]


def parse_page(source: str, html: str, page_url: str) -> tuple[list[dict], list[str]]:
    """Use content-specific containers; never collect avatars, logos or recommendations wholesale."""
    soup = BeautifulSoup(html, "html.parser")
    candidates, links = [], []

    def add(url: str, title: str = "", context_url: str = page_url):
        if urlparse(url).scheme in ("http", "https"):
            candidates.append({"url": url, "title": title[:500], "page_url": context_url})

    if source == "mywed":
        for anchor in soup.select('a[href]'):
            href = urljoin(page_url, anchor["href"])
            if not re.search(r"/photo/\d+/?", urlparse(href).path):
                continue
            for image in anchor.select("img"):
                urls = image_urls(image, page_url)
                if urls:
                    url = urls[0]
                    # Observed MyWed feed uses cropped 340px Google-hosted thumbnails.
                    # Request the same public image with a bounded, uncropped size.
                    if (urlparse(url).hostname or "").endswith(".googleusercontent.com"):
                        url = re.sub(r"=w\d+[^?]*$", "=w1280-h1280-l80-e30", url)
                    add(url, image.get("alt", ""), href)
        for anchor in soup.select('a[rel="next"], a[href*="page="]'):
            links.append(urljoin(page_url, anchor["href"]))
    elif source == "potonow":
        for image in soup.select("img"):
            for url in image_urls(image, page_url):
                original = parse_qs(urlparse(url).query).get("url", [url])[0]
                if "/gallery_" in original:
                    add(original, image.get("alt", ""))
                    break
        for anchor in soup.select('a[href]'):
            href = urljoin(page_url, anchor["href"])
            if re.search(r"/photographers/[a-f0-9]{24}/?$", urlparse(href).path):
                links.append(href)
    elif source == "pinterest":
        def walk(value):
            if isinstance(value, dict):
                images = value.get("images")
                if isinstance(images, dict):
                    variants = [v for v in images.values() if isinstance(v, dict) and isinstance(v.get("url"), str)]
                    if variants:
                        best = max(variants, key=lambda v: (v.get("width") or 0) * (v.get("height") or 0))
                        if urlparse(best["url"]).hostname == "i.pinimg.com":
                            pin_id = str(value.get("id", ""))
                            context = f"https://www.pinterest.com/pin/{pin_id}/" if pin_id.isdigit() else page_url
                            add(best["url"], str(value.get("title") or value.get("grid_title") or ""), context)
                for child in value.values():
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)

        for script in soup.select('script[type="application/json"]'):
            try:
                walk(json.loads(script.string or "{}"))
            except (json.JSONDecodeError, RecursionError):
                continue
        for anchor in soup.select('a[href*="/pin/"]'):
            for image in anchor.select("img"):
                urls = [url for url in image_urls(image, page_url) if urlparse(url).hostname == "i.pinimg.com"]
                if urls:
                    add(urls[0], image.get("alt", ""), urljoin(page_url, anchor["href"]))
    else:
        raise DatasetError(f"Unsupported source: {source}.")
    unique = {item["url"]: item for item in candidates}
    return list(unique.values()), list(dict.fromkeys(links))


def normalize_image(data: bytes, min_short: int = 400) -> tuple[bytes, int, int, str]:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as opened:
                if opened.format not in ("JPEG", "PNG", "WEBP") or getattr(opened, "n_frames", 1) != 1:
                    raise DatasetError("Unsupported or animated image.")
                if min(opened.size) < min_short or max(opened.size) < 600:
                    raise DatasetError("Image is too small; likely a thumbnail.")
                image = ImageOps.exif_transpose(opened)
                image.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
                rgba = image.convert("RGBA")
                rgb = Image.new("RGB", rgba.size, "white")
                rgb.paste(rgba, mask=rgba.getchannel("A"))
                pixel_key = digest(str(rgb.size).encode() + rgb.tobytes())
                output = io.BytesIO()
                rgb.save(output, "JPEG", quality=90, optimize=True)
                return output.getvalue(), rgb.width, rgb.height, pixel_key
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise DatasetError("Invalid or excessively large image.") from error


class BrowserPages:
    """Optional user-owned browser profile for rendered public search results."""
    def __init__(self, profile: Path, headed: bool, scrolls: int):
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as error:
            raise DatasetError("Install requirements-portfolio-browser.txt and run playwright install chromium.") from error
        self.runtime = sync_playwright().start()
        try:
            self.context = self.runtime.chromium.launch_persistent_context(str(profile), headless=not headed)
        except Exception as error:
            self.runtime.stop()
            raise DatasetError("Browser could not start. Install Chromium and close other users of this profile.") from error
        self.page = self.context.new_page()
        self.scrolls = scrolls

    def documents(self, url: str):
        try:
            self.page.goto(url, wait_until="domcontentloaded", timeout=45000)
            self.page.wait_for_timeout(1500)
            for _ in range(self.scrolls + 1):
                yield self.page.content()
                self.page.evaluate("window.scrollBy(0, window.innerHeight * 2)")
                self.page.wait_for_timeout(1200)
        except Exception as error:
            raise DatasetError("Browser page failed; inspect login/access requirements in headed mode.") from error

    def close(self):
        self.context.close()
        self.runtime.stop()


def select_jobs(config: dict, genres: set[str], source: str | None = None) -> list[dict]:
    return [job for job in config["jobs"] if job.get("enabled", True)
        and job["genre"] in genres and (source is None or job["source"] == source)]


def crawl(args) -> int:
    config = json.loads(args.config.read_text(encoding="utf-8"))
    selected = set(args.genres.split(",")) if args.genres else set(GENRES)
    if not selected <= set(GENRES):
        raise DatasetError("Unknown genre in --genres.")
    jobs = select_jobs(config, selected, args.source)
    if not jobs:
        raise DatasetError("No enabled jobs match --source/--genres. Check the job's enabled flag and URLs/queries in --config.")
    args.output.mkdir(parents=True, exist_ok=True)
    records = read_manifest(args.output)
    counts = Counter(record["genre"] for record in records)
    seen_urls = {record["image_url"] for record in records}
    seen_pixels = {record["pixel_sha256"] for record in records}
    http = PublicHttp(args.delay)
    browser = BrowserPages(args.profile, args.headed, args.scrolls) if args.browser else None
    stats = Counter()
    try:
        for job in jobs:
            genre, source = job["genre"], job["source"]
            if genre not in GENRES or source not in ("mywed", "potonow", "pinterest"):
                raise DatasetError("Invalid crawl job genre/source.")
            query = " | ".join(job.get("queries", []))
            queue = list(job.get("urls", []))
            if source == "pinterest":
                queue.extend("https://www.pinterest.com/search/pins/?" + urlencode({"q": q, "rs": "typed"}) for q in job.get("queries", []))
            visited = set()
            while queue and len(visited) < args.max_pages and counts[genre] < args.per_genre:
                url = queue.pop(0)
                if url in visited:
                    continue
                visited.add(url)
                try:
                    documents = browser.documents(url) if browser else [http.get(url).decode("utf-8", errors="replace")]
                    page_candidates = 0
                    for document in documents:
                        candidates, links = parse_page(source, document, url)
                        page_candidates += len(candidates)
                        # Never follow a link to another site with this source adapter.
                        queue.extend(link for link in links if urlparse(link).hostname == urlparse(url).hostname and link not in visited)
                        for candidate in candidates:
                            if counts[genre] >= args.per_genre:
                                break
                            if candidate["url"] in seen_urls:
                                continue
                            seen_urls.add(candidate["url"])
                            try:
                                data, width, height, pixels = normalize_image(http.get(candidate["url"], image=True), args.min_short)
                                if pixels in seen_pixels:
                                    stats["duplicate_pixels"] += 1
                                    continue
                                sha = digest(data)
                                relative = f"images/{sha}.jpg"
                                target = local_image(args.output, relative)
                                target.parent.mkdir(parents=True, exist_ok=True)
                                temporary = target.with_suffix(".tmp")
                                temporary.write_bytes(data)
                                temporary.replace(target)
                                record = {
                                    "genre": genre, "source": source, "query": query,
                                    "image_url": candidate["url"], "page_url": candidate["page_url"],
                                    "source_title": candidate["title"], "file": relative,
                                    "sha256": sha, "pixel_sha256": pixels, "width": width, "height": height,
                                    "label_status": "unlabeled", "collected_at": datetime.now(timezone.utc).isoformat(),
                                }
                                with (args.output / "manifest.jsonl").open("a", encoding="utf-8") as manifest:
                                    manifest.write(json.dumps(record, ensure_ascii=False) + "\n")
                                seen_pixels.add(pixels)
                                counts[genre] += 1
                                stats["downloaded"] += 1
                                print(f"{genre}: {counts[genre]}/{args.per_genre} ({source})", flush=True)
                            except DatasetError as error:
                                stats["image_failures"] += 1
                                print(f"Skipped image: {error}", file=sys.stderr)
                        if counts[genre] >= args.per_genre:
                            break
                    if not page_candidates:
                        print(f"No content images: {source}. For Pinterest try --browser after browser-login; no tags were inferred.", file=sys.stderr)
                except DatasetError as error:
                    stats["page_failures"] += 1
                    print(f"Skipped page: {error}", file=sys.stderr)
    finally:
        if browser:
            browser.close()
    print(json.dumps({"totals": dict(counts), "run": dict(stats)}, indent=2))
    return 0 if selected and all(counts[g] >= args.per_genre for g in selected) else 2


class Supabase:
    def __init__(self):
        load_env()
        self.url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        key = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        parsed = urlparse(self.url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname or not key:
            raise DatasetError("Set SUPABASE_URL and SUPABASE_SECRET_KEY in the root .env.")
        if parsed.scheme != "https" and parsed.hostname not in ("localhost", "127.0.0.1"):
            raise DatasetError("Remote Supabase must use HTTPS.")
        self.headers = {"apikey": key}
        if not key.startswith("sb_secret_"):
            self.headers["Authorization"] = "Bearer " + key
        self.session = requests.Session()

    def request(self, method: str, path: str, *, params=None, payload=None, data=None, headers=None, retry_safe=False):
        # Reuse TLS connections, but never send credentials to image hosts or redirects.
        method = method.upper()
        safe = retry_safe or method in ("GET", "HEAD")
        attempts = 4 if safe else 1
        endpoint = f"{method} {path.split('?')[0]}"
        # Requests uses the connected socket timeout while sending the body too.
        # A short connect timeout can abort larger uploads on slow uplinks.
        timeout = (60 if data is not None else 15, 60)
        for attempt in range(attempts):
            try:
                response = self.session.request(method, self.url + path, params=params, json=payload, data=data,
                    headers={**self.headers, **(headers or {})}, timeout=timeout, allow_redirects=False)
            except requests.RequestException as error:
                # Raw exception messages may contain URLs, proxy credentials or headers.
                detail = f"{endpoint}: {type(error).__name__}"
                if "write operation timed out" in str(error).lower():
                    detail += " (upload write timeout)"
                if attempt + 1 < attempts:
                    delay = 2 ** attempt
                    print(f"Supabase {detail}; retry {attempt + 2}/{attempts} in {delay}s.", file=sys.stderr, flush=True)
                    time.sleep(delay)
                    continue
                suffix = "No automatic write replay; rerun to resume safely." if not safe else "Retry limit reached; rerun to resume."
                raise DatasetError(f"Supabase {detail}. {suffix}") from error
            if safe and response.status_code in (429, 500, 502, 503, 504) and attempt + 1 < attempts:
                retry_after = response.headers.get("Retry-After", "")
                delay = min(30, int(retry_after) if retry_after.isdigit() else 2 ** attempt)
                status = response.status_code
                response.close()
                print(f"Supabase {endpoint}: HTTP {status}; retry {attempt + 2}/{attempts} in {delay}s.", file=sys.stderr, flush=True)
                time.sleep(delay)
                continue
            try:
                if not response.ok:
                    raise DatasetError(f"Supabase HTTP {response.status_code} on {endpoint}.")
                if not response.content:
                    return None
                try:
                    return response.json()
                except ValueError as error:
                    raise DatasetError(f"Supabase returned non-JSON on {endpoint}.") from error
            finally:
                response.close()

    def rows(self, table: str, **params) -> list[dict]:
        return self.request("GET", f"/rest/v1/{table}", params=params)

    def insert(self, table: str, payload: dict) -> dict:
        return self.request("POST", f"/rest/v1/{table}", payload=payload,
            headers={"Prefer": "return=representation"})[0]

    def preflight(self):
        self.rows("photographers", select="id,user_id,dataset_key", limit=1)
        self.rows("portfolios", select="id,dataset_key,status", limit=1)
        self.rows("portfolio_images", select="id,dataset_key,content_sha256,label_status,suggested_genre,import_metadata", limit=1)
        self.rows("tags", select="id,is_active,category,aliases", limit=1)
        bucket = self.request("GET", "/storage/v1/bucket/portfolio-images")
        if not bucket.get("public"):
            raise DatasetError("Expected the existing public portfolio-images bucket.")
        print(f"Preflight passed: {urlparse(self.url).hostname} (read-only schema/bucket checks).", flush=True)

    def auth_users(self) -> dict:
        users = {}
        for page in range(1, 101):
            batch = self.request("GET", "/auth/v1/admin/users", params={"page": page, "per_page": 1000}).get("users", [])
            users.update({user.get("email"): user for user in batch})
            if len(batch) < 1000:
                return users
        raise DatasetError("Auth user pagination limit reached; narrow the importer before continuing.")


def demo_slot(pixel_sha: str, genre: str, count: int, seed: int) -> int:
    # Deterministic randomness makes retries independent of filesystem/manifest order.
    return int(digest(f"{seed}:{genre}:{pixel_sha}".encode()), 16) % count + 1


def existing_image_keys(db: Supabase, records: list[dict]) -> tuple[set, set]:
    """Bounded indexed lookups avoid one or two new requests per cached image."""
    keys, hashes = set(), set()
    for start in range(0, len(records), 50):
        batch = records[start:start + 50]
        for column, values in (
            ("dataset_key", ["crawl:v1:" + record["pixel_sha256"] for record in batch]),
            ("content_sha256", [record["sha256"] for record in batch]),
        ):
            rows = db.rows("portfolio_images", select="dataset_key,content_sha256",
                **{column: "in.(" + ",".join(values) + ")", "limit": len(batch)})
            keys.update(row["dataset_key"] for row in rows if row.get("dataset_key"))
            hashes.update(row["content_sha256"] for row in rows if row.get("content_sha256"))
    return keys, hashes


def ensure_provider(db: Supabase, users: dict, namespace: str, genre: str, slot: int, publish: bool) -> dict:
    key = f"{namespace}:{genre}:{slot:02d}"
    provider = db.rows("photographers", select="*", dataset_key=f"eq.{key}", limit=1)
    if provider:
        provider = provider[0]
    else:
        email = f"frameroom.{namespace}.{genre}.{slot:02d}@example.com"
        user = users.get(email)
        if user and user.get("app_metadata", {}).get("frameroom_dataset") != key:
            raise DatasetError("Demo email already belongs to an account outside this dataset.")
        display = f"Demo {genre.title()} {slot:02d}"
        username = "demo_" + digest(key.encode())[:20]
        if not user:
            user = db.request("POST", "/auth/v1/admin/users", payload={
                "email": email, "password": secrets.token_urlsafe(32), "email_confirm": True,
                "app_metadata": {"frameroom_dataset": key},
                "user_metadata": {"display_name": display, "user_name": username},
            })
            # Auth Admin versions return either the user directly or a user envelope.
            user = user.get("user", user)
            users[email] = user
        profiles = db.rows("profiles", select="id,user_name", id=f"eq.{user['id']}", limit=1)
        if not profiles:
            db.insert("profiles", {"id": user["id"], "user_name": username, "display_name": display})
        provider = db.insert("photographers", {
            "user_id": user["id"], "display_name": display, "dataset_key": key,
            "bio": "Educational demo profile. Images are randomly assigned by suggested genre and await manual curation.",
            "genres": [genre], "styles": [], "city": "Ho Chi Minh City", "is_hidden": False,
        })
    portfolio_key = key + ":inbox"
    portfolios = db.rows("portfolios", select="*", dataset_key=f"eq.{portfolio_key}", limit=1)
    if portfolios and portfolios[0].get("photographer_id") != provider["id"]:
        raise DatasetError("Demo inbox belongs to a different photographer.")
    if portfolios and portfolios[0].get("deleted_at"):
        # Never restore an inbox that the curator deliberately archived.
        revisions = db.rows("portfolios", select="*", dataset_key=f"like.{portfolio_key}:rev:*", order="created_at.desc", limit=1000)
        if len(revisions) == 1000:
            raise DatasetError("Too many archived intake revisions; inspect this demo photographer.")
        portfolios = [row for row in revisions if not row.get("deleted_at")][:1]
        if not portfolios:
            numbers = [int(row["dataset_key"].rsplit(":", 1)[1]) for row in revisions if row["dataset_key"].rsplit(":", 1)[1].isdigit()]
            portfolio_key += f":rev:{max(numbers, default=0) + 1:03d}"
    if portfolios:
        portfolio = portfolios[0]
        if portfolio.get("photographer_id") != provider["id"]:
            raise DatasetError("Demo inbox belongs to a different photographer.")
        # Preserve manual edits, titles, labels and publication choices on reruns.
    else:
        payload = {
            "owner_type": "photographer", "photographer_id": provider["id"],
            "title": f"Unsorted {genre} demo images",
            "description": "Temporary intake container, not a real photo session. Awaiting manual grouping and labels.",
            "genre": genre, "status": "published" if publish else "draft", "dataset_key": portfolio_key,
        }
        if publish:
            payload["published_at"] = datetime.now(timezone.utc).isoformat()
        portfolio = db.insert("portfolios", payload)
    return portfolio


def upload_record(db: Supabase, directory: Path, record: dict, portfolio: dict) -> None:
    storage_path = f"{portfolio['id']}/intake/{record['sha256']}.jpg"
    data = local_image(directory, record["file"]).read_bytes()
    db.request("POST", "/storage/v1/object/portfolio-images/" + quote(storage_path, safe="/"), data=data,
        headers={"Content-Type": "image/jpeg", "x-upsert": "true"}, retry_safe=True)
    db.insert("portfolio_images", {
        "portfolio_id": portfolio["id"], "storage_path": storage_path,
        "width": record["width"], "height": record["height"],
        "dataset_key": "crawl:v1:" + record["pixel_sha256"], "content_sha256": record["sha256"],
        "suggested_genre": record["genre"], "label_status": "unlabeled",
        "caption": "", "provenance": "captured", "sort_order": 0,
        "import_metadata": {"source": record["source"], "query": record["query"],
            "collected_at": record["collected_at"], "demo_assignment": True},
    })


def import_images(args) -> int:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,19}", args.namespace):
        raise DatasetError("Namespace must be 1-20 lowercase letters/digits/hyphens.")
    records = read_manifest(args.output)
    if args.genres:
        selected = set(args.genres.split(","))
        if not selected <= set(GENRES):
            raise DatasetError("Unknown genre in --genres.")
        records = [record for record in records if record["genre"] in selected]
    if args.limit:
        records = records[:args.limit]
    if not records:
        raise DatasetError("No manifest records to import. Run crawl first.")
    assignments = Counter()
    for record in records:
        if record["genre"] not in GENRES:
            raise DatasetError("Invalid genre in manifest.")
        path = local_image(args.output, record["file"])
        if not path.is_file() or digest(path.read_bytes()) != record["sha256"]:
            raise DatasetError("Missing or modified local image; repair the manifest before importing.")
        assignments[(record["genre"], demo_slot(record["pixel_sha256"], record["genre"], args.photographers_per_genre, args.seed))] += 1
    print(json.dumps({f"{g}:{slot:02d}": count for (g, slot), count in sorted(assignments.items())}, indent=2))
    if not args.apply:
        print("Preview only. Add --apply after running both new SQL migrations. No keys were loaded.")
        return 0
    db = Supabase()
    db.preflight()
    print(f"Checking {len(records)} cached images against Supabase...", flush=True)
    existing_keys, existing_hashes = existing_image_keys(db, records)
    pending = sum("crawl:v1:" + record["pixel_sha256"] not in existing_keys and record["sha256"] not in existing_hashes for record in records)
    print(f"Resume: {len(records) - pending} already imported; {pending} pending.", flush=True)
    users, inboxes, tasks = None, {}, []
    stats = Counter()
    for record in records:
        key = "crawl:v1:" + record["pixel_sha256"]
        if key in existing_keys or record["sha256"] in existing_hashes:
            stats["already_imported"] += 1
            continue
        slot = demo_slot(record["pixel_sha256"], record["genre"], args.photographers_per_genre, args.seed)
        pair = (record["genre"], slot)
        if pair not in inboxes:
            if users is None:
                users = db.auth_users()
            inboxes[pair] = ensure_provider(db, users, args.namespace, *pair, args.publish)
            print(f"Ready: {pair[0]} demo {pair[1]:02d}", flush=True)
        tasks.append((record, pair, inboxes[pair]))
        # Prevent repeated manifest entries from being scheduled twice in this run.
        existing_keys.add(key)
        existing_hashes.add(record["sha256"])
    if tasks:
        worker_state = threading.local()

        def upload(task):
            if not hasattr(worker_state, "db"):
                # Requests sessions are per worker, never shared between threads.
                worker_state.db = Supabase()
                if worker_state.db.url != db.url:
                    raise DatasetError("Supabase target changed during import; stopped.")
            record, _, portfolio = task
            upload_record(worker_state.db, args.output, record, portfolio)

        workers = min(getattr(args, "workers", 4), len(tasks))
        print(f"Uploading {len(tasks)} images with {workers} workers...", flush=True)
        pool = concurrent.futures.ThreadPoolExecutor(max_workers=workers)
        futures = {}
        first_error = None
        try:
            futures = {pool.submit(upload, task): task for task in tasks}
            for future in concurrent.futures.as_completed(futures):
                if future.cancelled():
                    continue
                try:
                    future.result()
                    stats["imported"] += 1
                    _, pair, _ = futures[future]
                    print(f"Imported {pair[0]} -> demo {pair[1]:02d} ({stats['imported']}/{len(tasks)})", flush=True)
                except (DatasetError, OSError) as error:
                    if first_error is None:
                        first_error = error
                        for queued in futures:
                            queued.cancel()
        finally:
            # Complete in-flight writes and cancel queued work on error/interruption.
            pool.shutdown(wait=True, cancel_futures=True)
        if first_error is not None:
            print(json.dumps(dict(stats)), flush=True)
            raise first_error
    print(json.dumps(dict(stats), indent=2))
    return 0


def read_tags(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        expected = {"slug", "name", "name_vi", "category", "definition_en", "definition_vi", "aliases"}
        if set(reader.fieldnames or []) != expected:
            raise DatasetError("Tag CSV headers must match the supplied catalog.")
        tags = list(reader)
    seen = set()
    for tag in tags:
        if set(tag) != expected or any(value is None for value in tag.values()):
            raise DatasetError("Malformed CSV row; quote text that contains commas.")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", tag["slug"]) or tag["slug"] in seen:
            raise DatasetError("Tag slugs must be unique lowercase kebab-case.")
        if tag["category"] not in CATEGORIES or not all(tag[field].strip() for field in ("name", "name_vi", "definition_en", "definition_vi")):
            raise DatasetError(f"Invalid or incomplete tag: {tag['slug']}.")
        seen.add(tag["slug"])
    if not tags:
        raise DatasetError("Tag catalog is empty.")
    return tags


def tag_sql(tags: list[dict]) -> str:
    def literal(text: str) -> str:
        return "'" + text.replace("'", "''") + "'"
    rows = []
    for tag in tags:
        category = tag["category"]
        kind = "tone" if category in ("lighting", "color_tone", "editing") else "setting" if category in ("genre", "subject", "setting", "composition") else "mood"
        values = [tag[field] for field in ("slug", "name", "name_vi", "category", "definition_en", "definition_vi", "aliases")]
        rows.append("  (" + ", ".join(literal(value) for value in values + [kind]) + ")")
    return (
        "-- Generated from data/photography-tags.csv by scripts/portfolio_dataset.py tags-sql.\n"
        "-- Run AFTER 202611160001_demo_image_intake.sql. IDs, image_tags and custom tags are preserved.\n"
        "BEGIN;\nWITH catalog(slug, name, name_vi, category, definition_en, definition_vi, aliases, kind) AS (\nVALUES\n"
        + ",\n".join(rows) + "\n)\nINSERT INTO public.tags (slug, name, name_vi, category, definition_en, definition_vi, aliases, kind)\n"
        "SELECT slug, name, name_vi, category, definition_en, definition_vi,\n"
        "  CASE WHEN aliases = '' THEN '{}'::text[] ELSE string_to_array(aliases, '|') END, kind::public.tag_kind FROM catalog\n"
        "ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, name_vi = EXCLUDED.name_vi,\n"
        "  category = EXCLUDED.category, definition_en = EXCLUDED.definition_en,\n"
        "  definition_vi = EXCLUDED.definition_vi, aliases = EXCLUDED.aliases, kind = EXCLUDED.kind;\n"
        "COMMIT;\n"
    )


def positive(value: str) -> int:
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return number


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    collect = sub.add_parser("crawl", help="Download images locally; never writes Supabase.")
    collect.add_argument("--config", type=Path, default=ROOT / "data/crawl-sources.json")
    collect.add_argument("--output", type=Path, default=ROOT / ".artifacts/portfolio-dataset")
    collect.add_argument("--genres", help="Comma-separated suggested genres.")
    collect.add_argument("--source", choices=("mywed", "pinterest", "potonow"), help="Run only enabled jobs from this website; default runs all matching sources.")
    collect.add_argument("--per-genre", type=positive, default=50, help="Target total in the local manifest, including previous runs.")
    collect.add_argument("--max-pages", type=positive, default=8, help="Maximum public pages per configured job.")
    collect.add_argument("--min-short", type=positive, default=400)
    collect.add_argument("--delay", type=float, default=1.0)
    collect.add_argument("--browser", action="store_true")
    collect.add_argument("--headed", action="store_true")
    collect.add_argument("--scrolls", type=positive, default=8)
    collect.add_argument("--profile", type=Path, default=ROOT / ".artifacts/portfolio-browser")
    ingest = sub.add_parser("import", help="Preview or apply deterministic random demo assignments.")
    ingest.add_argument("--output", type=Path, default=ROOT / ".artifacts/portfolio-dataset")
    ingest.add_argument("--genres")
    ingest.add_argument("--namespace", default="demo-v1")
    ingest.add_argument("--photographers-per-genre", type=positive, default=3)
    ingest.add_argument("--seed", type=int, default=42)
    ingest.add_argument("--workers", type=positive, default=4, help="Maximum concurrent image uploads; accounts/inboxes are prepared sequentially.")
    ingest.add_argument("--limit", type=positive)
    ingest.add_argument("--publish", action="store_true", help="Publish newly created inboxes; preserve existing publication choices.")
    ingest.add_argument("--apply", action="store_true", help="Create Auth/profile/provider/inbox records and upload images.")
    sub.add_parser("doctor", help="Read-only Supabase schema, key and bucket preflight.")
    catalog = sub.add_parser("tags-sql", help="Validate the editable CSV and generate the tag migration.")
    catalog.add_argument("--catalog", type=Path, default=ROOT / "data/photography-tags.csv")
    catalog.add_argument("--output", type=Path)
    login = sub.add_parser("browser-login", help="Open a separate local Pinterest browser profile for manual sign-in.")
    login.add_argument("--profile", type=Path, default=ROOT / ".artifacts/portfolio-browser")
    args = parser.parse_args(argv)
    try:
        if args.command == "crawl":
            if args.delay < 0:
                raise DatasetError("Delay cannot be negative.")
            return crawl(args)
        if args.command == "import":
            return import_images(args)
        if args.command == "doctor":
            db = Supabase()
            db.preflight()
            db.request("GET", "/auth/v1/admin/users", params={"page": 1, "per_page": 1})
            print("Auth Admin read access passed.")
        elif args.command == "tags-sql":
            tags = read_tags(args.catalog)
            sql = tag_sql(tags)
            if args.output:
                args.output.write_text(sql, encoding="utf-8", newline="\n")
                print(f"Generated {len(tags)} tags: {args.output}")
            else:
                print(sql)
        elif args.command == "browser-login":
            browser = BrowserPages(args.profile, True, 1)
            try:
                browser.page.goto("https://www.pinterest.com/", wait_until="domcontentloaded")
                input("Sign in manually if needed, then press Enter here to save and close: ")
            finally:
                browser.close()
        return 0
    except (DatasetError, OSError, ValueError, KeyError, csv.Error) as error:
        # Do not print exception reprs, requests, environment values or tracebacks.
        print(f"Error: {error}" if isinstance(error, DatasetError) else f"Error: invalid input or local file ({type(error).__name__}).", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Stopped. Completed manifest records remain available for the next run.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
