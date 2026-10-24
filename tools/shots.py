# Makes the pictures for the game's itch.io page from the game as it is: the
# cover, drawn by tools/cover.html from the game's own tiles and lettering,
# and five screenshots, each a scene set up by tools/stage.html with moves
# from the game's own winning line. Google Chrome draws them, headless and at
# exact sizes, from this folder served on a spare port; macOS's sips then
# cuts out the phone pictures, as Chrome makes no window as narrow as a
# phone. They go in dist/itch/. Chrome is looked for where macOS keeps it,
# or wherever the CHROME variable says; the cover's lettering comes from
# Google Fonts, so a network is needed too.
#
#   python3 tools/shots.py

import functools
import http.server
import os
import shutil
import subprocess
import tempfile
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'itch')
CHROME = os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')

DESKTOP = (1280, 800, 1)  # a window's width and height, and its scale
PHONE = (390, 844)  # framed in the middle of a wider window, at twice the scale
PHONE_WINDOW = (600, 844, 2)

# Each picture: its file, the page that draws it, the window it is drawn in,
# and for a phone, the middle to cut out.
PICTURES = [
    ('cover.png', 'cover.html', (630, 500, 1), None),
    ('1-midnight-glow.png', 'stage.html#crypt', DESKTOP, None),
    ('2-planchette-hint.png', 'stage.html#bat', DESKTOP, None),
    ('3-phone-magnifier.png', 'stage.html#magnifier/{}x{}'.format(*PHONE), PHONE_WINDOW, PHONE),
    ('4-phone-score.png', 'stage.html#cleared/{}x{}'.format(*PHONE), PHONE_WINDOW, PHONE),
    ('5-classic-turtle.png', 'stage.html#turtle', DESKTOP, None),
]


class Quiet(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.svg': 'image/svg+xml',
    }

    def log_message(self, *args):
        pass


def draw(page, window, out, profile, port):
    width, height, scale = window
    subprocess.run(
        [
            CHROME,
            '--headless',
            '--disable-gpu',
            '--hide-scrollbars',
            '--no-first-run',
            '--no-default-browser-check',
            f'--user-data-dir={profile}',
            f'--window-size={width},{height}',
            f'--force-device-scale-factor={scale}',
            '--virtual-time-budget=14000',  # time for a scene to set itself up
            f'--screenshot={out}',
            f'http://127.0.0.1:{port}/tools/{page}',
        ],
        check=True,
        capture_output=True,
    )
    if not os.path.isfile(out):
        raise SystemExit(f'Chrome drew nothing for {page}')


def main():
    if not os.path.isfile(CHROME):
        raise SystemExit(f'No Chrome at {CHROME}: say where it is with the CHROME variable.')
    if not shutil.which('sips'):
        raise SystemExit('No sips to cut out the phone pictures: it comes with macOS.')
    os.makedirs(OUT, exist_ok=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with tempfile.TemporaryDirectory() as profile:  # a Chrome of its own, apart from yours
            for name, page, window, phone in PICTURES:
                out = os.path.join(OUT, name)
                draw(page, window, out, profile, server.server_address[1])
                if phone:
                    scale = window[2]
                    subprocess.run(['sips', '--cropToHeightWidth', str(phone[1] * scale), str(phone[0] * scale), out], check=True, capture_output=True)
                print(f'{os.path.relpath(out, ROOT)}: {os.path.getsize(out) // 1024} KB')
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
