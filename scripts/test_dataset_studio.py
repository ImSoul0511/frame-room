"""Local-only service and HTTP boundary checks; all Supabase operations are faked."""
import copy
import json
import threading
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor

import requests

from dataset_studio import DELETE_RPC, SETS_RPC, StudioError, StudioServer, StudioService, validate_action
from portfolio_dataset import DatasetError

OWNER = str(uuid.uuid4())
OTHER = str(uuid.uuid4())
ALBUM = str(uuid.uuid4())
PRIVATE_ALBUM = str(uuid.uuid4())
IMAGE = str(uuid.uuid4())
PRIVATE_IMAGE = str(uuid.uuid4())
TAG = str(uuid.uuid4())
SOURCE_TAG = str(uuid.uuid4())
PHOTO_SET = str(uuid.uuid4())


class FakeDB:
    url = 'https://example.supabase.co'
    def __init__(self, ready=True, delete_ready=True, sets_ready=False):
        self.ready = ready
        self.delete_ready = delete_ready
        self.sets_ready = sets_ready
        self.actions = []
        self.tables = {
            'photographers': [{'id': OWNER, 'dataset_key': 'demo:01', 'display_name': 'Demo'}, {'id': OTHER, 'dataset_key': None, 'display_name': 'Private'}],
            'portfolios': [{'id': ALBUM, 'photographer_id': OWNER}, {'id': PRIVATE_ALBUM, 'photographer_id': OTHER}],
            'portfolio_images': [{'id': IMAGE, 'portfolio_id': ALBUM, 'storage_path': 'album/image.jpg'}, {'id': PRIVATE_IMAGE, 'portfolio_id': PRIVATE_ALBUM, 'storage_path': 'private/image.jpg'}],
            'image_tags': [{'id': '1', 'portfolio_image_id': IMAGE, 'tag_id': TAG}, {'id': '2', 'portfolio_image_id': PRIVATE_IMAGE, 'tag_id': TAG},
                           {'id': '3', 'portfolio_image_id': IMAGE, 'tag_id': SOURCE_TAG}],
            'tags': [{'id': TAG, 'slug': 'test', 'category': 'mood'},
                     {'id': SOURCE_TAG, 'slug': 'bonaparte', 'category': 'source'}],
            'dataset_studio_sets': [],
            'dataset_studio_set_images': [],
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
            elif isinstance(value, str) and value.startswith('eq.'):
                result = [row for row in result if row.get(key) == value[3:]]
            elif isinstance(value, str) and value.startswith('neq.'):
                result = [row for row in result if row.get(key) != value[4:]]
        offset = params.get('offset', 0)
        result = result[offset:offset + params.get('limit', 500)]
        if table == 'portfolio_images' and 'image_tags(' in params.get('select', ''):
            for image in result:
                image['image_tags'] = [{key: value for key, value in row.items() if key not in ('id', 'portfolio_image_id')} for row in self.tables['image_tags'] if row['portfolio_image_id'] == image['id']]
        return result

    def request(self, method, path, payload=None, **kwargs):
        if not self.ready:
            raise DatasetError('Supabase HTTP 404 on RPC.')
        if path == SETS_RPC and not self.sets_ready:
            raise DatasetError('Supabase HTTP 404 on set RPC.')
        if path == DELETE_RPC:
            if not self.delete_ready:
                raise DatasetError('Supabase HTTP 404 on delete RPC.')
            if payload['p_ids']:
                self.actions.append(payload)
            return {'deleted': len(payload['p_ids'])}
        if payload['p_action'] == 'ping':
            return {'version': 1}
        self.actions.append(payload)
        return {'ok': True, 'id': IMAGE}


class ValidationTests(unittest.TestCase):
    def test_group_creation_cannot_choose_a_photographer(self):
        payload = {'request_id': PHOTO_SET, 'title': 'A photo set', 'genre': 'fashion', 'ids': [IMAGE]}
        self.assertEqual(validate_action('set.save', payload), payload)
        with self.assertRaises(StudioError):
            validate_action('set.save', {**payload, 'photographer_id': OWNER})
        with self.assertRaises(StudioError):
            validate_action('set.assign', {'id': PHOTO_SET})

    def test_rejects_unknown_actions_fields_and_non_string_action(self):
        for action, payload in [('drop.database', {}), ({}, {}), ('image.save', {'sql': 'anything'})]:
            with self.assertRaises(StudioError):
                validate_action(action, payload)

    def test_rejects_invalid_and_duplicate_identifiers(self):
        for action in ('images.archive', 'images.delete'):
            for ids in [['not-a-uuid'], [IMAGE, IMAGE], []]:
                with self.assertRaises(StudioError):
                    validate_action(action, {'ids': ids})

    def test_rejects_source_category(self):
        with self.assertRaises(StudioError):
            validate_action('tag.save', {'slug': 'source-test', 'name': 'Source', 'name_vi': 'Nguồn', 'category': 'source'})

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
    def test_slow_snapshot_does_not_hold_up_mutation_or_restore_the_old_cache(self):
        reading, resume_reading = threading.Event(), threading.Event()

        class SlowDB(FakeDB):
            def rows(self, table, **params):
                if table == 'photographers':
                    reading.set()
                    if not resume_reading.wait(timeout=5):
                        raise RuntimeError('Test snapshot stalled.')
                return super().rows(table, **params)

        db = SlowDB()
        service = StudioService(factory=lambda: db)
        with ThreadPoolExecutor(max_workers=2) as worker:
            snapshot = worker.submit(service.snapshot)
            try:
                self.assertTrue(reading.wait(timeout=2))
                mutation = worker.submit(service.apply, 'images.delete', {'ids': [IMAGE]})
                self.assertEqual(mutation.result(timeout=2), {'deleted': 1})
            finally:
                resume_reading.set()
            snapshot.result(timeout=2)
        self.assertIsNone(service.cached)

    def test_projects_unassigned_sets_and_scoped_member_order(self):
        db = FakeDB(sets_ready=True)
        db.tables['dataset_studio_sets'] = [{'id': PHOTO_SET, 'title': 'Unassigned', 'genre': 'fashion'}]
        db.tables['dataset_studio_set_images'] = [
            {'image_id': IMAGE, 'set_id': PHOTO_SET, 'sort_order': 3},
            {'image_id': PRIVATE_IMAGE, 'set_id': PHOTO_SET, 'sort_order': 4},
        ]
        snapshot = StudioService(factory=lambda: db).snapshot()
        self.assertTrue(snapshot['sets_ready'])
        group = next(album for album in snapshot['portfolios'] if album['id'] == PHOTO_SET)
        self.assertIsNone(group['photographer_id'])
        self.assertEqual(snapshot['images'][0]['portfolio_id'], PHOTO_SET)
        self.assertEqual(snapshot['images'][0]['sort_order'], 3)
        self.assertEqual(len(snapshot['images']), 1)
        self.assertEqual(db.tables['portfolio_images'][0]['portfolio_id'], ALBUM)

    def test_group_assignment_requires_the_new_migration(self):
        service = StudioService(factory=lambda: FakeDB())
        self.assertFalse(service.snapshot()['sets_ready'])
        with self.assertRaises(StudioError) as error:
            service.apply('set.assign', {'id': PHOTO_SET, 'photographer_id': OWNER})
        self.assertEqual(error.exception.reason, 'sets_migration_required')

    def test_snapshot_limits_data_to_demo_owners(self):
        db = FakeDB()
        result = StudioService(factory=lambda: db).snapshot()
        self.assertEqual([p['id'] for p in result['photographers']], [OWNER])
        self.assertEqual([p['id'] for p in result['portfolios']], [ALBUM])
        self.assertEqual([p['id'] for p in result['images']], [IMAGE])
        self.assertEqual([tag['id'] for tag in result['tags']], [TAG])
        self.assertEqual([link['tag_id'] for link in result['assignments']], [TAG])
        self.assertIn('/storage/v1/object/public/portfolio-images/', result['images'][0]['url'])
        self.assertTrue(result['ready'])
        self.assertTrue(result['delete_ready'])
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

    def test_permanent_deletion_calls_dedicated_rpc(self):
        db = FakeDB()
        service = StudioService(factory=lambda: db)
        service.snapshot()
        self.assertEqual(service.apply('images.delete', {'ids': [IMAGE]}), {'deleted': 1})
        self.assertEqual(db.actions, [{'p_ids': [IMAGE]}])
        self.assertIsNone(service.cached)

    def test_missing_delete_migration_leaves_other_edits_enabled(self):
        db = FakeDB(delete_ready=False)
        service = StudioService(factory=lambda: db)
        snapshot = service.snapshot()
        self.assertTrue(snapshot['ready'])
        self.assertFalse(snapshot['delete_ready'])
        with self.assertRaises(StudioError) as error:
            service.apply('images.delete', {'ids': [IMAGE]})
        self.assertEqual(error.exception.reason, 'delete_migration_required')
        service.apply('images.review', {'ids': [IMAGE], 'label_status': 'reviewed'})
        self.assertEqual(len(db.actions), 1)

    def test_source_tag_cannot_be_assigned_by_id(self):
        db = FakeDB()
        service = StudioService(factory=lambda: db)
        with self.assertRaises(StudioError):
            service.apply('images.tags', {'ids': [IMAGE], 'tag_ids': [SOURCE_TAG.upper()], 'mode': 'add'})
        self.assertEqual(db.actions, [])


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
