"""Offline behavior checks. No project keys, real accounts or external requests."""

import argparse
import contextlib
import io
import json
import os
import threading
import unittest
import uuid
from pathlib import Path
from unittest.mock import Mock, patch

from PIL import Image, PngImagePlugin

import portfolio_dataset as dataset


def png(size=(900, 650), metadata=""):
    output = io.BytesIO()
    info = PngImagePlugin.PngInfo()
    info.add_text("description", metadata)
    Image.new("RGB", size, "teal").save(output, "PNG", pnginfo=info)
    return output.getvalue()


class FakeSupabase:
    def __init__(self):
        self.url = "https://test.supabase.co"
        self.tables = {name: [] for name in ("photographers", "profiles", "portfolios", "portfolio_images")}
        self.users = {}
        self.uploads = []
        self.fail_image_insert = False
        self.reads = []

    def preflight(self):
        pass

    def auth_users(self):
        return dict(self.users)

    def rows(self, table, **params):
        self.reads.append((table, params))
        rows = self.tables[table]
        for key, value in params.items():
            if isinstance(value, str) and value.startswith("eq."):
                rows = [row for row in rows if str(row.get(key)) == value[3:]]
            elif isinstance(value, str) and value.startswith("in.("):
                accepted = set(value[4:-1].split(","))
                rows = [row for row in rows if row.get(key) in accepted]
            elif isinstance(value, str) and value.startswith("like."):
                prefix = value[5:].rstrip("*")
                rows = [row for row in rows if str(row.get(key, "")).startswith(prefix)]
        return rows[:params.get("limit", len(rows))]

    def insert(self, table, payload):
        if table == "portfolio_images" and self.fail_image_insert:
            self.fail_image_insert = False
            raise dataset.DatasetError("Simulated interrupted row insertion.")
        row = {"id": f"{table}-{len(self.tables[table]) + 1}", **payload}
        self.tables[table].append(row)
        return row

    def request(self, method, path, **kwargs):
        if path == "/auth/v1/admin/users":
            user = {"id": f"user-{len(self.users) + 1}", **kwargs["payload"]}
            self.users[user["email"]] = user
            return user
        if path.startswith("/storage/v1/object/"):
            self.uploads.append(path)
            return {"Key": path}
        raise AssertionError((method, path))


class ExtractionTests(unittest.TestCase):
    def test_source_selection_does_not_mix_websites_or_genres(self):
        mywed = {"source": "mywed", "genre": "wedding"}
        pinterest = {"source": "pinterest", "genre": "wedding"}
        portrait = {"source": "pinterest", "genre": "portrait"}
        config = {"jobs": [mywed, pinterest, portrait]}
        self.assertEqual(dataset.select_jobs(config, {"wedding"}, "mywed"), [mywed])
        self.assertEqual(dataset.select_jobs(config, {"portrait"}, "pinterest"), [portrait])
        self.assertEqual(dataset.select_jobs(config, {"wedding"}), [mywed, pinterest])

    def test_source_selection_preserves_disabled_job_setting(self):
        config = {"jobs": [{"source": "potonow", "genre": "portrait", "enabled": False}]}
        self.assertEqual(dataset.select_jobs(config, {"portrait"}, "potonow"), [])

    def test_mywed_uses_uncropped_content_and_excludes_avatar(self):
        html = '''<img src="https://cdn.test/avatar.jpg">
        <a href="/vi/photo/123/"><img src="https://lh3.googleusercontent.com/content=w340-h340-l80-c-e30"></a>'''
        images, _ = dataset.parse_page("mywed", html, "https://mywed.com/vi/photo/")
        self.assertEqual(len(images), 1)
        self.assertEqual(images[0]["url"], "https://lh3.googleusercontent.com/content=w1280-h1280-l80-e30")
        self.assertEqual(images[0]["page_url"], "https://mywed.com/vi/photo/123/")

    def test_potonow_unwraps_signed_image_and_keeps_only_gallery(self):
        html = '''<img src="/_next/image?url=https%3A%2F%2Fcdn.test%2Fgallery_one.png%3Fs%3Dabc%26q%3D70&w=750">
        <img src="https://cdn.test/avatar.png"><a href="/photographers/687ecde56ff931269cffaa07">Profile</a>'''
        images, links = dataset.parse_page("potonow", html, "https://potonow.vn/photographers")
        self.assertEqual(images[0]["url"], "https://cdn.test/gallery_one.png?s=abc&q=70")
        self.assertEqual(len(images), 1)
        self.assertEqual(len(links), 1)

    def test_pinterest_reads_embedded_pin_variants(self):
        html = '<script type="application/json">' + json.dumps({"pins": [{
            "id": "123", "title": "Portrait", "images": {
                "small": {"url": "https://i.pinimg.com/s.jpg", "width": 200, "height": 300},
                "large": {"url": "https://i.pinimg.com/l.jpg", "width": 900, "height": 1200},
            },
        }]}) + '</script>'
        images, _ = dataset.parse_page("pinterest", html, "https://www.pinterest.com/search/pins/")
        self.assertEqual(images[0]["url"], "https://i.pinimg.com/l.jpg")
        self.assertEqual(images[0]["page_url"], "https://www.pinterest.com/pin/123/")

    def test_pinterest_logged_out_page_is_not_treated_as_a_dataset(self):
        images, _ = dataset.parse_page("pinterest", '<img src="https://s.pinimg.com/logo.png">', "https://www.pinterest.com/")
        self.assertEqual(images, [])

    def test_pinterest_dom_prefers_largest_srcset(self):
        html = '<a href="/pin/12/"><img src="https://i.pinimg.com/s.jpg" srcset="https://i.pinimg.com/s.jpg 236w, https://i.pinimg.com/l.jpg 736w"></a>'
        images, _ = dataset.parse_page("pinterest", html, "https://www.pinterest.com/")
        self.assertEqual(images[0]["url"], "https://i.pinimg.com/l.jpg")


class ImageTests(unittest.TestCase):
    def test_resize_and_discard_exif_after_orientation(self):
        buffer = io.BytesIO()
        image = Image.new("RGB", (2400, 1600), "red")
        exif = image.getexif()
        exif[274] = 6
        image.save(buffer, "JPEG", exif=exif)
        data, width, height, _ = dataset.normalize_image(buffer.getvalue())
        self.assertEqual((width, height), (853, 1280))
        with Image.open(io.BytesIO(data)) as normalized:
            self.assertFalse(normalized.getexif())

    def test_metadata_variants_deduplicate(self):
        first = dataset.normalize_image(png(metadata="one"))
        second = dataset.normalize_image(png(metadata="two"))
        self.assertEqual(first, second)

    def test_thumbnail_and_html_are_rejected(self):
        for data in (png((340, 340)), b"<html>login</html>"):
            with self.assertRaises(dataset.DatasetError):
                dataset.normalize_image(data)

    def test_manifest_cannot_reference_files_outside_dataset(self):
        with self.assertRaises(dataset.DatasetError):
            dataset.local_image(Path(".artifacts/images"), "../../.env")


class ImportTests(unittest.TestCase):
    def setUp(self):
        temporary_root = dataset.ROOT / ".artifacts/dataset-tests"
        temporary_root.mkdir(parents=True, exist_ok=True)
        self.output = temporary_root / uuid.uuid4().hex
        if not self.output.resolve().is_relative_to(temporary_root.resolve()):
            raise AssertionError("Test temporary directory must stay inside the workspace.")
        self.output.mkdir()
        self.addCleanup(self.clean_files)
        data, width, height, pixels = dataset.normalize_image(png())
        sha = dataset.digest(data)
        (self.output / "image.jpg").write_bytes(data)
        self.record = {"genre": "portrait", "source": "pinterest", "query": "portrait",
            "image_url": "https://i.pinimg.com/test.jpg", "file": "image.jpg",
            "sha256": sha, "pixel_sha256": pixels, "width": width, "height": height,
            "collected_at": "2026-11-16T00:00:00+00:00"}
        (self.output / "manifest.jsonl").write_text(json.dumps(self.record) + "\n", encoding="utf-8")
        self.args = argparse.Namespace(output=self.output, genres=None, namespace="demo-test",
            photographers_per_genre=3, seed=42, limit=None, apply=True, publish=True)
        self.db = FakeSupabase()

    def clean_files(self):
        for name in ("image.jpg", "manifest.jsonl"):
            (self.output / name).unlink(missing_ok=True)
        self.output.rmdir()

    def run_import(self):
        with patch.object(dataset, "Supabase", return_value=self.db), contextlib.redirect_stdout(io.StringIO()):
            return dataset.import_images(self.args)

    def test_rerun_preserves_manual_labels_and_regrouping(self):
        self.run_import()
        image = self.db.tables["portfolio_images"][0]
        image.update({"label_status": "reviewed", "portfolio_id": "manually-organized-album", "caption": "Human caption"})
        self.run_import()
        self.assertEqual(len(self.db.tables["portfolio_images"]), 1)
        self.assertEqual(len(self.db.uploads), 1)
        self.assertEqual(image["portfolio_id"], "manually-organized-album")
        self.assertEqual(image["label_status"], "reviewed")
        self.assertEqual(image["caption"], "Human caption")
        self.assertEqual(len(self.db.users), 1)

    def test_failed_row_insert_resumes_without_duplicate_auth_or_inbox(self):
        self.db.fail_image_insert = True
        with self.assertRaises(dataset.DatasetError):
            self.run_import()
        self.assertEqual(len(self.db.tables["portfolio_images"]), 0)
        self.run_import()
        self.assertEqual(len(self.db.users), 1)
        self.assertEqual(len(self.db.tables["photographers"]), 1)
        self.assertEqual(len(self.db.tables["portfolios"]), 1)
        self.assertEqual(len(self.db.tables["portfolio_images"]), 1)
        self.assertEqual(self.db.uploads[0], self.db.uploads[1])

    def test_intake_does_not_assert_aesthetic_tags_or_create_embeddings(self):
        self.run_import()
        image = self.db.tables["portfolio_images"][0]
        self.assertEqual(image["label_status"], "unlabeled")
        self.assertEqual(image["suggested_genre"], "portrait")
        self.assertEqual(image["caption"], "")
        self.assertEqual(image["import_metadata"]["demo_assignment"], True)

    def test_new_intake_preserves_archived_inbox_and_recovers_its_replacement(self):
        self.args.photographers_per_genre = 1
        self.run_import()
        original = self.db.tables["portfolios"][0]
        original['deleted_at'] = '2026-11-16T00:00:00Z'
        self.db.tables['portfolio_images'][0]['portfolio_id'] = 'manually-curated-album'
        second = {**self.record, 'file': 'second.jpg', 'pixel_sha256': 'c' * 64}
        data = (self.output / 'image.jpg').read_bytes() + b'new-image'
        second['sha256'] = dataset.digest(data)
        (self.output / 'second.jpg').write_bytes(data)
        self.addCleanup((self.output / 'second.jpg').unlink)
        (self.output / 'manifest.jsonl').write_text(json.dumps(self.record) + '\n' + json.dumps(second) + '\n', encoding='utf-8')
        self.db.fail_image_insert = True
        with self.assertRaises(dataset.DatasetError):
            self.run_import()
        self.run_import()
        self.assertEqual(len(self.db.tables['portfolios']), 2)
        replacement = self.db.tables['portfolios'][1]
        self.assertTrue(replacement['dataset_key'].endswith(':inbox:rev:001'))
        self.assertEqual(self.db.tables['portfolio_images'][1]['portfolio_id'], replacement['id'])
        self.assertTrue(original['deleted_at'])
        self.assertEqual(self.db.tables['portfolio_images'][0]['portfolio_id'], 'manually-curated-album')

    def test_preview_does_not_load_keys(self):
        self.args.apply = False
        with patch.object(dataset, "Supabase", side_effect=AssertionError("Preview must not connect")), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(dataset.import_images(self.args), 0)

    def test_modified_local_image_stops_before_database_writes(self):
        (self.output / "image.jpg").write_bytes(b"changed")
        with self.assertRaises(dataset.DatasetError):
            self.run_import()
        self.assertEqual(self.db.users, {})

    def test_uploads_use_separate_clients_and_bounded_parallelism(self):
        second = {**self.record, "file": "second.jpg", "pixel_sha256": "b" * 64}
        data = (self.output / "image.jpg").read_bytes() + b"second-file"
        second["sha256"] = dataset.digest(data)
        (self.output / "second.jpg").write_bytes(data)
        self.addCleanup((self.output / "second.jpg").unlink)
        (self.output / "manifest.jsonl").write_text(json.dumps(self.record) + "\n" + json.dumps(second) + "\n", encoding="utf-8")
        self.args.workers = 2
        barrier = threading.Barrier(2, timeout=5)
        clients, seen = [], []

        def factory():
            if threading.current_thread() is threading.main_thread():
                return self.db
            client = FakeSupabase()
            clients.append(client)
            return client

        def upload(client, directory, record, portfolio):
            seen.append((id(client), record["sha256"]))
            barrier.wait()

        with patch.object(dataset, "Supabase", side_effect=factory), patch.object(dataset, "upload_record", side_effect=upload), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(dataset.import_images(self.args), 0)
        self.assertEqual(len(clients), 2)
        self.assertEqual(len({client for client, _ in seen}), 2)


class CatalogTests(unittest.TestCase):
    def test_catalog_and_generated_migration_agree(self):
        tags = dataset.read_tags(dataset.ROOT / "data/photography-tags.csv")
        self.assertGreaterEqual(len(tags), 100)
        generated = (dataset.ROOT / "supabase/migrations/202611160002_demo_tag_catalog.sql").read_text(encoding="utf-8")
        self.assertEqual(dataset.tag_sql(tags), generated)
        self.assertNotIn("DELETE FROM", generated)

    def test_sql_escapes_apostrophes(self):
        tag = {"slug": "test", "name": "Editor's look", "name_vi": "Test", "category": "style",
            "definition_en": "It's a look.", "definition_vi": "Test.", "aliases": ""}
        self.assertIn("Editor''s look", dataset.tag_sql([tag]))

    def test_random_assignment_is_independent_of_order(self):
        keys = ["a" * 64, "b" * 64, "c" * 64]
        before = {key: dataset.demo_slot(key, "portrait", 3, 42) for key in keys}
        after = {key: dataset.demo_slot(key, "portrait", 3, 42) for key in reversed(keys)}
        self.assertEqual(before, after)


class TransportTests(unittest.TestCase):
    def client(self):
        with patch.object(dataset, "load_env"), patch.dict(os.environ, {
            "SUPABASE_URL": "https://test.supabase.co", "SUPABASE_SECRET_KEY": "sb_secret_test-only"
        }, clear=True):
            db = dataset.Supabase()
        db.session = Mock()
        return db

    def response(self, status=200, payload=None, headers=None):
        response = Mock(status_code=status, ok=200 <= status < 300, content=b"{}", headers=headers or {})
        response.json.return_value = payload if payload is not None else []
        return response

    def test_new_secret_key_is_not_sent_as_a_jwt_or_to_source_transport(self):
        with patch.object(dataset, "load_env"), patch.dict(os.environ, {
            "SUPABASE_URL": "https://test.supabase.co", "SUPABASE_SECRET_KEY": "sb_secret_test-only"
        }, clear=True):
            db = dataset.Supabase()
        self.assertEqual(db.headers, {"apikey": "sb_secret_test-only"})
        public = dataset.PublicHttp(0)
        self.assertNotIn("apikey", public.session.headers)
        self.assertNotIn("Authorization", public.session.headers)

    def test_legacy_key_retains_bearer_header(self):
        with patch.object(dataset, "load_env"), patch.dict(os.environ, {
            "SUPABASE_URL": "https://test.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "legacy-test-only"
        }, clear=True):
            db = dataset.Supabase()
        self.assertEqual(db.headers["Authorization"], "Bearer legacy-test-only")

    def test_read_retries_on_same_session_without_exposing_exception_text(self):
        db = self.client()
        response = self.response(payload=[{"id": "one"}])
        db.session.request.side_effect = [dataset.requests.ReadTimeout("sb_secret_hidden"), response]
        errors = io.StringIO()
        with patch.object(dataset.time, "sleep") as sleep, contextlib.redirect_stderr(errors):
            self.assertEqual(db.rows("portfolio_images", select="id"), [{"id": "one"}])
        self.assertEqual(db.session.request.call_count, 2)
        sleep.assert_called_once_with(1)
        self.assertIn("GET /rest/v1/portfolio_images: ReadTimeout", errors.getvalue())
        self.assertNotIn("sb_secret_hidden", errors.getvalue())
        response.close.assert_called_once()

    def test_auth_creation_is_not_blindly_retried_after_uncertain_write(self):
        db = self.client()
        db.session.request.side_effect = dataset.requests.ConnectionError("secret exception body")
        with self.assertRaises(dataset.DatasetError) as raised:
            db.request("POST", "/auth/v1/admin/users", payload={"password": "private"})
        self.assertEqual(db.session.request.call_count, 1)
        self.assertIn("POST /auth/v1/admin/users: ConnectionError", str(raised.exception))
        self.assertNotIn("secret exception body", str(raised.exception))
        self.assertNotIn("private", str(raised.exception))

    def test_stable_storage_upsert_can_retry_after_timeout(self):
        db = self.client()
        db.session.request.side_effect = [dataset.requests.ReadTimeout(), self.response(payload={"Key": "same-key"})]
        with patch.object(dataset.time, "sleep"), contextlib.redirect_stderr(io.StringIO()):
            result = db.request("POST", "/storage/v1/object/portfolio-images/stable.jpg", data=b"same-data",
                headers={"x-upsert": "true"}, retry_safe=True)
        self.assertEqual(result, {"Key": "same-key"})
        calls = db.session.request.call_args_list
        self.assertEqual(calls[0], calls[1])
        self.assertEqual(calls[0].kwargs["timeout"], (60, 60))

    def test_upload_timeout_is_named_without_exposing_raw_exception(self):
        db = self.client()
        db.session.request.side_effect = dataset.requests.ConnectionError("private-url: The write operation timed out")
        with patch.object(dataset.time, "sleep"), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(dataset.DatasetError) as raised:
                db.request("POST", "/storage/v1/object/portfolio-images/stable.jpg", data=b"large-image", retry_safe=True)
        self.assertIn("upload write timeout", str(raised.exception))
        self.assertNotIn("private-url", str(raised.exception))

    def test_rate_limit_wait_is_bounded(self):
        db = self.client()
        limited = self.response(429, headers={"Retry-After": "900"})
        db.session.request.side_effect = [limited, self.response()]
        with patch.object(dataset.time, "sleep") as sleep, contextlib.redirect_stderr(io.StringIO()):
            db.rows("tags")
        sleep.assert_called_once_with(30)
        limited.close.assert_called_once()

    def test_unauthorized_response_is_not_retried(self):
        db = self.client()
        db.session.request.return_value = self.response(401)
        with self.assertRaises(dataset.DatasetError):
            db.rows("tags")
        self.assertEqual(db.session.request.call_count, 1)

    def test_read_retry_limit_is_finite_and_names_the_endpoint(self):
        db = self.client()
        db.session.request.side_effect = dataset.requests.exceptions.ProxyError("sensitive proxy URL")
        with patch.object(dataset.time, "sleep"), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(dataset.DatasetError) as raised:
                db.rows("portfolio_images")
        self.assertEqual(db.session.request.call_count, 4)
        self.assertIn("GET /rest/v1/portfolio_images: ProxyError", str(raised.exception))
        self.assertNotIn("sensitive proxy URL", str(raised.exception))

    def test_resume_queries_bounded_batches_and_preserves_both_identity_checks(self):
        db = FakeSupabase()
        records = [{"pixel_sha256": dataset.digest(f"pixel-{i}".encode()), "sha256": dataset.digest(f"file-{i}".encode())} for i in range(120)]
        db.tables["portfolio_images"] = [
            {"dataset_key": "crawl:v1:" + records[0]["pixel_sha256"], "content_sha256": "old-encoding"},
            {"dataset_key": None, "content_sha256": records[119]["sha256"]},
        ]
        keys, hashes = dataset.existing_image_keys(db, records)
        self.assertIn("crawl:v1:" + records[0]["pixel_sha256"], keys)
        self.assertIn(records[119]["sha256"], hashes)
        self.assertEqual(len(db.reads), 6)
        self.assertTrue(all(params["limit"] <= 50 for _, params in db.reads))


if __name__ == "__main__":
    unittest.main()
