"""Local-only service and HTTP boundary checks; all Supabase operations are faked."""
import copy
import json
import threading
import unittest
import uuid

import requests

from dataset_studio import StudioError, StudioServer, StudioService, validate_action
from portfolio_dataset import DatasetError

OWNER = str(uuid.uuid4())
OTHER = str(uuid.uuid4())
ALBUM = str(uuid.uuid4())
PRIVATE_ALBUM = str(uuid.uuid4())
IMAGE = str(uuid.uuid4())
PRIVATE_IMAGE = str(uuid.uuid4())
TAG = str(uuid.uuid4())


class FakeDB:
    url = 'https://example.supabase.co'
    def __init__(self, ready=True):
        self.ready = ready
        self.actions = []
        self.tables = {
            'photographers': [{'id': OWNER, 'dataset_key': 'demo:01', 'display_name': 'Demo'}, {'id': OTHER, 'dataset_key': None, 'display_name': 'Private'}],
            'portfolios': [{'id': ALBUM, 'photographer_id': OWNER}, {'id': PRIVATE_ALBUM, 'photographer_id': OTHER}],
            'portfolio_images': [{'id': IMAGE, 'portfolio_id': ALBUM, 'storage_path': 'album/image.jpg'}, {'id': PRIVATE_IMAGE, 'portfolio_id': PRIVATE_ALBUM, 'storage_path': 'private/image.jpg'}],
            'image_tags': [{'id': '1', 'portfolio_image_id': IMAGE, 'tag_id': TAG}, {'id': '2', 'portfolio_image_id': PRIVATE_IMAGE, 'tag_id': TAG}],
            'tags': [{'id': TAG, 'slug': 'test'}],
        }

    def rows(self, table, **params):
        if table == 'image_tags' and params.get('order') != 'portfolio_image_id.asc,tag_id.asc':
            raise DatasetError('image_tags has a composite primary key, not an id column.')
        result = copy.deepcopy(self.tables[table])
        for key, value in params.items():
            if value == 'not.is.null':
                result = [row for row in result if row.get(key) is not None]
            elif isinstance(value, str) and value.startswith('in.('):
                accepted = value[4:-1].split(',')
                result = [row for row in result if row.get(key) in accepted]
        offset = params.get('offset', 0)
        result = result[offset:offset + params.get('limit', 500)]
        if table == 'portfolio_images' and 'image_tags(' in params.get('select', ''):
            for image in result:
                image['image_tags'] = [{key: value for key, value in row.items() if key not in ('id', 'portfolio_image_id')} for row in self.tables['image_tags'] if row['portfolio_image_id'] == image['id']]
        return result

    def request(self, method, path, payload=None, **kwargs):
        if not self.ready:
            raise DatasetError('Supabase HTTP 404 on RPC.')
        if payload['p_action'] == 'ping':
            return {'version': 1}
        self.actions.append(payload)
        return {'ok': True, 'id': IMAGE}


class ValidationTests(unittest.TestCase):
    def test_rejects_unknown_actions_fields_and_non_string_action(self):
        for action, payload in [('drop.database', {}), ({}, {}), ('image.save', {'sql': 'anything'})]:
            with self.assertRaises(StudioError):
                validate_action(action, payload)

    def test_rejects_invalid_and_duplicate_identifiers(self):
        for ids in [['not-a-uuid'], [IMAGE, IMAGE], []]:
            with self.assertRaises(StudioError):
                validate_action('images.archive', {'ids': ids, 'archived': True})

    def test_requires_explicit_tags_for_image_save(self):
        with self.assertRaises(StudioError):
            validate_action('image.save', {'id': IMAGE, 'caption': '', 'label_status': 'reviewed'})

    def test_validates_annotation_and_archive_types(self):
        for action, payload in [('images.review', {'ids': [IMAGE], 'label_status': 'fake'}), ('images.archive', {'ids': [IMAGE], 'archived': 'false'})]:
            with self.assertRaises(StudioError):
                validate_action(action, payload)

    def test_limits_batch_size(self):
        with self.assertRaises(StudioError):
            validate_action('images.archive', {'ids': [str(uuid.uuid4()) for _ in range(501)], 'archived': True})


class ServiceTests(unittest.TestCase):
    def test_snapshot_limits_data_to_demo_owners(self):
        db = FakeDB()
        result = StudioService(factory=lambda: db).snapshot()
        self.assertEqual([p['id'] for p in result['photographers']], [OWNER])
        self.assertEqual([p['id'] for p in result['portfolios']], [ALBUM])
        self.assertEqual([p['id'] for p in result['images']], [IMAGE])
        self.assertEqual(len(result['assignments']), 1)
        self.assertIn('/storage/v1/object/public/portfolio-images/', result['images'][0]['url'])
        self.assertTrue(result['ready'])
        self.assertEqual(db.actions, [])

    def test_missing_migration_allows_reading_but_blocks_writes(self):
        service = StudioService(factory=lambda: FakeDB(False))
        self.assertFalse(service.snapshot()['ready'])
        with self.assertRaises(StudioError) as error:
            service.apply('images.review', {'ids': [IMAGE], 'label_status': 'reviewed'})
        self.assertEqual(error.exception.reason, 'migration_required')

    def test_read_only_blocks_writes_before_calling_supabase(self):
        db = FakeDB()
        service = StudioService(read_only=True, factory=lambda: db)
        with self.assertRaises(StudioError):
            service.apply('images.archive', {'ids': [IMAGE], 'archived': True})
        self.assertEqual(db.actions, [])

    def test_mutation_uses_one_rpc_and_invalidates_snapshot(self):
        db = FakeDB()
        service = StudioService(factory=lambda: db)
        service.snapshot()
        service.apply('images.review', {'ids': [IMAGE], 'label_status': 'reviewed'})
        self.assertEqual(len(db.actions), 1)
        self.assertIsNone(service.cached)


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = FakeDB()
        cls.server = StudioServer(0, StudioService(factory=lambda: cls.db))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)

    def test_bootstrap_and_security_headers(self):
        response = requests.get(self.base + '/api/bootstrap', timeout=5)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['token'], self.server.token)
        self.assertNotIn('Access-Control-Allow-Origin', response.headers)
        self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')

    def test_rejects_untrusted_host(self):
        response = requests.get(self.base + '/api/health', headers={'Host': 'attacker.example'}, timeout=5)
        self.assertEqual(response.status_code, 403)

    def test_rejects_missing_token_and_cross_origin(self):
        payload = {'action': 'images.archive', 'payload': {'ids': [IMAGE], 'archived': True}}
        response = requests.post(self.base + '/api/action', json=payload, timeout=5)
        self.assertEqual(response.status_code, 403)
        response = requests.post(self.base + '/api/action', json=payload, headers={'X-Dataset-Token': self.server.token, 'Origin': 'https://attacker.example'}, timeout=5)
        self.assertEqual(response.status_code, 403)

    def test_accepts_same_origin_action_with_local_token(self):
        response = requests.post(self.base + '/api/action', json={'action': 'images.review', 'payload': {'ids': [IMAGE], 'label_status': 'reviewed'}}, headers={'X-Dataset-Token': self.server.token, 'Origin': self.base}, timeout=5)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data']['id'], IMAGE)

    def test_rejects_bad_json_and_unknown_action(self):
        headers = {'X-Dataset-Token': self.server.token, 'Content-Type': 'application/json'}
        response = requests.post(self.base + '/api/action', data='{', headers=headers, timeout=5)
        self.assertEqual(response.status_code, 400)
        response = requests.post(self.base + '/api/action', data=json.dumps({'action': 'unimplemented', 'payload': {}}), headers=headers, timeout=5)
        self.assertEqual(response.status_code, 400)


if __name__ == '__main__':
    unittest.main()
