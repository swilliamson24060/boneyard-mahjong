# Draws the game's icon, a tile with a jack-o'-lantern on it under the night
# sky, and writes it as icons/icon.svg and as the PNGs that phones and the
# app manifest ask for. The shapes are described once, below; the PNGs are
# rendered here with plain Python, edges smoothed by their distance from
# each pixel, so no image editor or library is needed.
#
#   python3 tools/icons.py

import math
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'icons')

SKY = ('#3d2459', '#110a1b')
FACE = ('#fffaf0', '#ecdfc4')
CARVED = '#ffd54a'
BURNT = '#7a3b0c'

# The drawing, on a 512 square: (shape, geometry, paint), back to front.
# Paint is a fill (a colour, or two for a gradient from top to bottom), and
# perhaps a stroke and its width, or a clip to another shape's inside.
PUMPKIN = {'cx': 256, 'cy': 270, 'rx': 94, 'ry': 84}


def scene(corner):
    return [
        ('rrect', {'x': 0, 'y': 0, 'w': 512, 'h': 512, 'r': corner}, {'fill': SKY}),
        # The tile's side, showing below and to the left, then its face.
        ('rrect', {'x': 118, 'y': 106, 'w': 240, 'h': 320, 'r': 30}, {'fill': '#a8916a'}),
        ('rrect', {'x': 127, 'y': 97, 'w': 240, 'h': 320, 'r': 30}, {'fill': '#cdb991'}),
        ('rrect', {'x': 136, 'y': 88, 'w': 240, 'h': 320, 'r': 30}, {'fill': FACE}),
        # The jack-o'-lantern.
        ('poly', [(244, 192), (250, 160), (274, 152), (270, 192)], {'fill': '#3d8b3d', 'stroke': '#234d23', 'width': 5}),
        ('ellipse', PUMPKIN, {'fill': '#f08a24', 'stroke': BURNT, 'width': 6}),
        ('ring', {**PUMPKIN, 'rx': 40, 'ry': 82, 'w': 5}, {'fill': '#c55f16', 'clip': PUMPKIN}),
        ('ring', {**PUMPKIN, 'rx': 74, 'ry': 83, 'w': 5}, {'fill': '#c55f16', 'clip': PUMPKIN}),
        ('poly', [(196, 262), (222, 222), (240, 266)], {'fill': CARVED, 'stroke': BURNT, 'width': 4}),
        ('poly', [(316, 262), (290, 222), (272, 266)], {'fill': CARVED, 'stroke': BURNT, 'width': 4}),
        ('poly', [(246, 288), (256, 272), (266, 288)], {'fill': CARVED, 'stroke': BURNT, 'width': 4}),
        (
            'poly',
            [(186, 296), (204, 310), (220, 300), (238, 316), (256, 302), (274, 316), (292, 300), (308, 310), (326, 296),
             (318, 316), (298, 332), (274, 340), (256, 342), (238, 340), (214, 332), (194, 316)],
            {'fill': CARVED, 'stroke': BURNT, 'width': 4},
        ),
    ]


# ------------------------------------------------------- distances to shapes
# Negative inside, positive outside, in units of the 512 square.

def sd_rrect(x, y, s):
    qx = abs(x - s['x'] - s['w'] / 2) - (s['w'] / 2 - s['r'])
    qy = abs(y - s['y'] - s['h'] / 2) - (s['h'] / 2 - s['r'])
    return math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - s['r']


def sd_ellipse(x, y, s):
    return (math.hypot((x - s['cx']) / s['rx'], (y - s['cy']) / s['ry']) - 1) * min(s['rx'], s['ry'])


def sd_ring(x, y, s):
    return abs(sd_ellipse(x, y, s)) - s['w'] / 2


def sd_poly(x, y, pts):
    # After Inigo Quilez: the nearest edge, and inside or out by winding.
    d = (x - pts[0][0]) ** 2 + (y - pts[0][1]) ** 2
    sign = 1
    j = len(pts) - 1
    for i in range(len(pts)):
        ex, ey = pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]
        wx, wy = x - pts[i][0], y - pts[i][1]
        t = max(0.0, min(1.0, (wx * ex + wy * ey) / (ex * ex + ey * ey)))
        bx, by = wx - ex * t, wy - ey * t
        d = min(d, bx * bx + by * by)
        a, b, c = y >= pts[i][1], y < pts[j][1], ex * wy > ey * wx
        if (a and b and c) or (not a and not b and not c):
            sign = -sign
        j = i
    return sign * math.sqrt(d)


def distance(kind, geo):
    return {
        'rrect': lambda x, y: sd_rrect(x, y, geo),
        'ellipse': lambda x, y: sd_ellipse(x, y, geo),
        'ring': lambda x, y: sd_ring(x, y, geo),
        'poly': lambda x, y: sd_poly(x, y, geo),
    }[kind]


def bounds(kind, geo, pad):
    if kind == 'rrect':
        box = (geo['x'], geo['y'], geo['x'] + geo['w'], geo['y'] + geo['h'])
    elif kind in ('ellipse', 'ring'):
        w = geo.get('w', 0)
        box = (geo['cx'] - geo['rx'] - w, geo['cy'] - geo['ry'] - w, geo['cx'] + geo['rx'] + w, geo['cy'] + geo['ry'] + w)
    else:
        box = (min(p[0] for p in geo), min(p[1] for p in geo), max(p[0] for p in geo), max(p[1] for p in geo))
    return (box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad)


def rgb(h):
    return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))


# ---------------------------------------------------------------- the PNGs

def render(size, corner):
    k = 512 / size  # units of the drawing in one pixel
    pix = [[0.0, 0.0, 0.0, 0.0] for _ in range(size * size)]  # premultiplied
    cover = lambda d: max(0.0, min(1.0, 0.5 - d / k))
    for kind, geo, paint in scene(corner):
        sd = distance(kind, geo)
        clip = paint.get('clip')
        x0, y0, x1, y1 = bounds(kind, geo, paint.get('width', 0) + 2 * k)
        fill = paint['fill']
        top, low = (rgb(fill[0]), rgb(fill[1])) if isinstance(fill, tuple) else (rgb(fill), rgb(fill))
        span = max(1.0, y1 - y0)
        for py in range(max(0, int(y0 / k)), min(size, int(y1 / k) + 1)):
            y = (py + 0.5) * k
            t = min(1.0, max(0.0, (y - y0) / span))
            colour = tuple(top[c] + (low[c] - top[c]) * t for c in range(3))
            for qx in range(max(0, int(x0 / k)), min(size, int(x1 / k) + 1)):
                x = (qx + 0.5) * k
                d = sd(x, y)
                layers = [(colour, cover(d))]
                if 'stroke' in paint:
                    layers.append((rgb(paint['stroke']), cover(abs(d) - paint['width'] / 2)))
                p = pix[py * size + qx]
                for c, a in layers:
                    if clip:
                        a *= cover(sd_ellipse(x, y, clip) + 3)
                    if a <= 0:
                        continue
                    for n in range(3):
                        p[n] = c[n] * a + p[n] * (1 - a)
                    p[3] = a + p[3] * (1 - a)
    out = bytearray()
    for r, g, b, a in pix:
        out += bytes([round(255 * r / a) if a else 0, round(255 * g / a) if a else 0, round(255 * b / a) if a else 0, round(255 * a)])
    return bytes(out)


def write_png(path, size, rgba):
    rows = b''.join(b'\x00' + rgba[y * size * 4:(y + 1) * size * 4] for y in range(size))

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)))
        f.write(chunk(b'IDAT', zlib.compress(rows, 9)))
        f.write(chunk(b'IEND', b''))


# ----------------------------------------------------------------- the SVG

def svg(corner):
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
        '<defs>',
        f'<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{SKY[0]}"/><stop offset="1" stop-color="{SKY[1]}"/></linearGradient>',
        f'<linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{FACE[0]}"/><stop offset="1" stop-color="{FACE[1]}"/></linearGradient>',
        f'<clipPath id="pumpkin"><ellipse cx="{PUMPKIN["cx"]}" cy="{PUMPKIN["cy"]}" rx="{PUMPKIN["rx"] - 3}" ry="{PUMPKIN["ry"] - 3}"/></clipPath>',
        '</defs>',
    ]
    for kind, geo, paint in scene(corner):
        fill = paint['fill']
        fill = 'url(#sky)' if fill == SKY else 'url(#face)' if fill == FACE else fill
        stroke = f' stroke="{paint["stroke"]}" stroke-width="{paint["width"]}" stroke-linejoin="round"' if 'stroke' in paint else ''
        if kind == 'rrect':
            parts.append(f'<rect x="{geo["x"]}" y="{geo["y"]}" width="{geo["w"]}" height="{geo["h"]}" rx="{geo["r"]}" fill="{fill}"/>')
        elif kind == 'ellipse':
            parts.append(f'<ellipse cx="{geo["cx"]}" cy="{geo["cy"]}" rx="{geo["rx"]}" ry="{geo["ry"]}" fill="{fill}"{stroke}/>')
        elif kind == 'ring':
            parts.append(f'<ellipse cx="{geo["cx"]}" cy="{geo["cy"]}" rx="{geo["rx"]}" ry="{geo["ry"]}" fill="none" stroke="{fill}" stroke-width="{geo["w"]}" clip-path="url(#pumpkin)"/>')
        else:
            points = ' '.join(f'{x},{y}' for x, y in geo)
            parts.append(f'<polygon points="{points}" fill="{fill}"{stroke}/>')
    parts.append('</svg>')
    return '\n'.join(parts) + '\n'


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'icon.svg'), 'w') as f:
        f.write(svg(112))
    # Rounded for browsers and the manifest; square where the phone rounds or masks it.
    for name, size, corner in [
        ('icon-192.png', 192, 112),
        ('icon-512.png', 512, 112),
        ('icon-maskable-512.png', 512, 0),
        ('icon-180.png', 180, 0),
    ]:
        write_png(os.path.join(OUT, name), size, render(size, corner))
        print('wrote', os.path.join('icons', name))


if __name__ == '__main__':
    main()
