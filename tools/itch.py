# Bundles the game for itch.io: a zip with index.html at its root, holding
# every file the game loads and nothing else. sw.js lists those files already,
# for offline play, and test.html checks that the list is whole, so the zip
# takes its list from there, with sw.js itself. Upload the zip to itch.io as
# an HTML game.
#
#   python3 tools/itch.py

import os
import re
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist', 'boneyard-mahjong.zip')


def files():
    with open(os.path.join(ROOT, 'sw.js'), encoding='utf-8') as f:
        listed = re.findall(r"^ {2}'([^']+)',$", f.read(), re.M)
    return sorted(name for name in listed + ['sw.js'] if name != './')


def main():
    names = files()
    missing = [name for name in names if not os.path.isfile(os.path.join(ROOT, name))]
    if missing:
        raise SystemExit('Not there: ' + ', '.join(missing))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
        for name in names:
            z.write(os.path.join(ROOT, name), name)
    print(f'{os.path.relpath(OUT, ROOT)}: {len(names)} files, {os.path.getsize(OUT) // 1024} KB')


if __name__ == '__main__':
    main()
