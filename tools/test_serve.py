import concurrent.futures
import pathlib
import threading
import unittest
from urllib.request import urlopen

from serve import create_server


ROOT = pathlib.Path(__file__).resolve().parents[1]


class DevelopmentServerTests(unittest.TestCase):
    def setUp(self):
        self.server = create_server('127.0.0.1', 0, str(ROOT))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_address[1]}'

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def test_repository_file_has_no_store_cache_header(self):
        with urlopen(f'{self.base}/README.md') as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers.get('Cache-Control'), 'no-store')

    def test_thirty_two_concurrent_module_requests_succeed(self):
        def request(_):
            with urlopen(f'{self.base}/tests/index.js', timeout=5) as response:
                return response.status, response.headers.get('Cache-Control')

        with concurrent.futures.ThreadPoolExecutor(max_workers=32) as pool:
            results = list(pool.map(request, range(32)))
        self.assertEqual(results, [(200, 'no-store')] * 32)

    def test_server_uses_threaded_daemon_handlers_and_backlog_64(self):
        self.assertTrue(self.server.daemon_threads)
        self.assertEqual(self.server.request_queue_size, 64)

    def test_server_thread_terminates_after_shutdown(self):
        self.server.shutdown()
        self.thread.join(timeout=2)
        self.assertFalse(self.thread.is_alive())


if __name__ == '__main__':
    unittest.main(verbosity=2)
