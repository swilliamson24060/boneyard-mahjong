# A static server for working on the game. It serves this folder with caching
# turned off, so a reload always picks up edited modules.
#
#   python3 tools/serve.py [port]

import functools
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.svg': 'image/svg+xml',
        '.webmanifest': 'application/manifest+json',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
    handler = functools.partial(NoCache, directory=ROOT)
    with http.server.ThreadingHTTPServer(('127.0.0.1', port), handler) as server:
        print(f'Serving {ROOT} at http://localhost:{port}', flush=True)
        server.serve_forever()


if __name__ == '__main__':
    main()
