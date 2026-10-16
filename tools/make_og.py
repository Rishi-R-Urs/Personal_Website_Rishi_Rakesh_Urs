#!/usr/bin/env python3
"""Render dot-matrix social preview images + icons, no dependencies.

    python3 tools/make_og.py          # writes img/og/*.png and icons

Everything is drawn as anti-aliased dots on a fixed grid, matching the
site's Nothing-style theme: black field, dim unlit LEDs, white text,
one tiger-orange accent.
"""
import math, os, struct, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BLACK, DIM, WHITE = (0, 0, 0), (28, 28, 28), (255, 255, 255)
GREY, TIGER = (138, 140, 140), (253, 106, 2)

# 5x7 dot font (rows top->bottom, "#" = lit)
FONT = {
 'A':[".###.","#...#","#...#","#####","#...#","#...#","#...#"],
 'B':["####.","#...#","#...#","####.","#...#","#...#","####."],
 'C':[".###.","#...#","#....","#....","#....","#...#",".###."],
 'D':["####.","#...#","#...#","#...#","#...#","#...#","####."],
 'E':["#####","#....","#....","####.","#....","#....","#####"],
 'F':["#####","#....","#....","####.","#....","#....","#...."],
 'G':[".###.","#...#","#....","#.###","#...#","#...#",".####"],
 'H':["#...#","#...#","#...#","#####","#...#","#...#","#...#"],
 'I':[".###.","..#..","..#..","..#..","..#..","..#..",".###."],
 'J':["..###","...#.","...#.","...#.","...#.","#..#.",".##.."],
 'K':["#...#","#..#.","#.#..","##...","#.#..","#..#.","#...#"],
 'L':["#....","#....","#....","#....","#....","#....","#####"],
 'M':["#...#","##.##","#.#.#","#.#.#","#...#","#...#","#...#"],
 'N':["#...#","#...#","##..#","#.#.#","#..##","#...#","#...#"],
 'O':[".###.","#...#","#...#","#...#","#...#","#...#",".###."],
 'P':["####.","#...#","#...#","####.","#....","#....","#...."],
 'Q':[".###.","#...#","#...#","#...#","#.#.#","#..#.",".##.#"],
 'R':["####.","#...#","#...#","####.","#.#..","#..#.","#...#"],
 'S':[".####","#....","#....",".###.","....#","....#","####."],
 'T':["#####","..#..","..#..","..#..","..#..","..#..","..#.."],
 'U':["#...#","#...#","#...#","#...#","#...#","#...#",".###."],
 'V':["#...#","#...#","#...#","#...#","#...#",".#.#.","..#.."],
 'W':["#...#","#...#","#...#","#.#.#","#.#.#","#.#.#",".#.#."],
 'X':["#...#","#...#",".#.#.","..#..",".#.#.","#...#","#...#"],
 'Y':["#...#","#...#",".#.#.","..#..","..#..","..#..","..#.."],
 'Z':["#####","....#","...#.","..#..",".#...","#....","#####"],
 '0':[".###.","#...#","#..##","#.#.#","##..#","#...#",".###."],
 '1':["..#..",".##..","..#..","..#..","..#..","..#..",".###."],
 '2':[".###.","#...#","....#","...#.","..#..",".#...","#####"],
 '3':["####.","....#","....#",".###.","....#","....#","####."],
 '4':["...#.","..##.",".#.#.","#..#.","#####","...#.","...#."],
 '5':["#####","#....","####.","....#","....#","#...#",".###."],
 '6':[".###.","#....","#....","####.","#...#","#...#",".###."],
 '7':["#####","....#","...#.","..#..",".#...",".#...",".#..."],
 '8':[".###.","#...#","#...#",".###.","#...#","#...#",".###."],
 '9':[".###.","#...#","#...#",".####","....#","....#",".###."],
 '+':[".....","..#..","..#..","#####","..#..","..#..","....."],
 '-':[".....",".....",".....","#####",".....",".....","....."],
 '/':["....#","....#","...#.","..#..",".#...","#....","#...."],
 '.':[".....",".....",".....",".....",".....",".##..",".##.."],
 '&':[".##..","#..#.","#.#..",".#...","#.#.#","#..#.",".##.#"],
 '@':[".###.","#...#","#.###","#.#.#","#.###","#....",".###."],
 '—':[".....",".....",".....","#####",".....",".....","....."],
 ' ':["....."]*7,
}

class Canvas:
    def __init__(s, w, h, bg=BLACK):
        s.w, s.h = w, h
        s.px = bytearray(bytes(bg) * (w * h))

    def dot(s, cx, cy, r, color, alpha=1.0):
        """Anti-aliased filled circle (coverage from distance to edge)."""
        x0, x1 = max(0, int(cx - r - 1)), min(s.w, int(cx + r + 2))
        y0, y1 = max(0, int(cy - r - 1)), min(s.h, int(cy + r + 2))
        for y in range(y0, y1):
            for x in range(x0, x1):
                d = math.hypot(x + .5 - cx, y + .5 - cy)
                a = max(0.0, min(1.0, r - d + .5)) * alpha
                if a <= 0: continue
                i = (y * s.w + x) * 3
                for k in range(3):
                    s.px[i + k] = int(s.px[i + k] * (1 - a) + color[k] * a)

    def glow(s, cx, cy, r, color, strength=.35):
        for k in range(6, 0, -1):
            s.dot(cx, cy, r * (1 + k * .45), color, strength / (k * 2.2))

    def png(s, path):
        raw = b''.join(b'\x00' + bytes(s.px[y * s.w * 3:(y + 1) * s.w * 3]) for y in range(s.h))
        chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
        data = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', s.w, s.h, 8, 2, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, 'wb').write(data)

def text_width(txt, pitch):
    return (len(txt) * 6 - 1) * pitch

def draw_text(c, txt, x, y, pitch, color, r_ratio=.36, glow=False):
    """Draw txt with its top-left LED at (x, y); returns end x."""
    for ch in txt.upper():
        rows = FONT.get(ch, FONT[' '])
        for ry, row in enumerate(rows):
            for rx, v in enumerate(row):
                if v == '#':
                    cx, cy = x + rx * pitch + pitch / 2, y + ry * pitch + pitch / 2
                    if glow: c.glow(cx, cy, pitch * r_ratio, color)
                    c.dot(cx, cy, pitch * r_ratio, color)
        x += 6 * pitch
    return x

def field(c, pitch, color=DIM, r_ratio=.22):
    for y in range(0, c.h // pitch + 1):
        for x in range(0, c.w // pitch + 1):
            c.dot(x * pitch + pitch / 2, y * pitch + pitch / 2, pitch * r_ratio, color)

def og_image(path, eyebrow, title_lines, sub):
    W, H, P = 1200, 630, 7             # 7px LED field; text pitches are multiples of 7
    c = Canvas(W, H)
    field(c, P, r_ratio=.2)
    M = 8 * P                           # margin, grid aligned
    # eyebrow: orange LED + small grey label
    c.glow(M + 5, M + 12, 6, TIGER, .5); c.dot(M + 5, M + 12, 6, TIGER)
    draw_text(c, eyebrow, M + 24, M + 3, 3, GREY, .42)
    # title: fit the largest pitch (multiple of 14 grid) that fits width
    big = 2 * P
    for p in (4 * P, 3 * P, 2 * P):
        h = len(title_lines) * 7 * p + (len(title_lines) - 1) * 2 * p
        if max(text_width(l, p) for l in title_lines) <= W - 2 * M and h <= H - 2 * M - 140: big = p; break
    block = len(title_lines) * 7 * big + (len(title_lines) - 1) * 2 * big
    y = (H // 2 - block // 2) // P * P
    for line in title_lines:
        draw_text(c, line, M, y, big, WHITE, .4)
        y += 9 * big
    # subtitle, bottom-left; site mark bottom-right
    draw_text(c, sub, M, H - M - 21, 3, GREY, .42)
    mark = 'RRU'
    mx = W - M - text_width(mark, 5) - 22
    draw_text(c, mark, mx, H - M - 35, 5, WHITE, .4)
    c.glow(W - M - 6, H - M - 6, 6, TIGER, .5); c.dot(W - M - 6, H - M - 6, 6, TIGER)
    c.png(path)
    print('wrote', os.path.relpath(path, ROOT))

def icon(path, size):
    c = Canvas(size, size)
    pitch = size / 9
    for y in range(9):
        for x in range(9):
            c.dot(x * pitch + pitch / 2, y * pitch + pitch / 2, pitch * .2, DIM)
    # "R" centred on a 9x9 grid (5x7 glyph at col 2,row 1)
    for ry, row in enumerate(FONT['R']):
        for rx, v in enumerate(row):
            if v == '#':
                c.dot((rx + 2) * pitch + pitch / 2, (ry + 1) * pitch + pitch / 2, pitch * .4, WHITE)
    c.dot(7.5 * pitch + pitch * .1, 7.5 * pitch + pitch * .1, pitch * .42, TIGER)
    c.png(path)
    print('wrote', os.path.relpath(path, ROOT))

if __name__ == '__main__':
    SUB = 'DATA SCIENCE + FINTECH — NORTHEASTERN'
    pages = {
        'home':       ('PORTFOLIO',         ['RISHI RAKESH', 'URS']),
        'about':      ('02 — ABOUT',        ['ABOUT ME']),
        'travel':     ('03 — TRAVEL',       ['TRAVEL', 'WITH ME']),
        'projects':   ('04 — PROJECTS',     ['PROJECTS']),
        'experience': ('05 — EXPERIENCE',   ['EXPERIENCE']),
        'hobbies':    ('06 — HOBBIES',      ['HOBBIES']),
        'contact':    ('07 — CONTACT',      ['GET IN', 'TOUCH']),
    }
    for key, (eb, lines) in pages.items():
        og_image(os.path.join(ROOT, 'img', 'og', f'og-{key}.png'), eb, lines, SUB if key == 'home' else 'RISHI RAKESH URS — ' + SUB.split(' — ')[0])
    icon(os.path.join(ROOT, 'apple-touch-icon.png'), 180)
    icon(os.path.join(ROOT, 'favicon-32.png'), 32)
