#!/usr/bin/env python3
"""Serve the build-free game and browser tests with reliable local defaults."""

import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoStoreHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class DevelopmentHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 64


def create_server(bind: str, port: int, directory: str) -> ThreadingHTTPServer:
    """Create a threaded static server rooted at a resolved directory."""
    root = Path(directory).expanduser().resolve(strict=True)
    if not root.is_dir():
        raise NotADirectoryError(root)
    handler = functools.partial(NoStoreHandler, directory=str(root))
    return DevelopmentHTTPServer((bind, port), handler)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bind', default='127.0.0.1', help='address to bind (default: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=8000, help='port to serve (default: 8000)')
    parser.add_argument('--directory', default='.', help='directory to serve (default: current directory)')
    args = parser.parse_args(argv)

    server = create_server(args.bind, args.port, args.directory)
    host = args.bind if args.bind not in ('0.0.0.0', '::') else '127.0.0.1'
    base = f'http://{host}:{server.server_address[1]}'
    print(f'Serving {Path(args.directory).expanduser().resolve()}')
    print(f'Game: {base}/')
    print(f'Rule tests: {base}/tests/index.html')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopping server.')
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
