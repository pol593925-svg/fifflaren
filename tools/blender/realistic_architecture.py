"""Sober masonry shell for the existing shared tactical-building collision plan.

Licensed Bistro frames, shutters and stonework are installed by cs16-realistic-world.
This file generates the exact playable shell, not an approximation of its openings.
"""
import json
import math
import subprocess


def build(a, theme):
    plan = json.loads(subprocess.check_output(
        ['node', str(a.ROOT / 'tools/export-coast-buildings.cjs'), theme],
        cwd=a.ROOT, encoding='utf8'))
    finishes = {'wall': 'plaster_light', 'floor': 'wood', 'roof': 'limestone',
                'step': 'wood', 'rail': 'limestone', 'trim': 'trim',
                'wood': 'wood', 'fabric': 'shutter'}
    for part in plan['boxes']:
        if part.get('animeRoof'):
            continue
        lo, hi = part['min'], part['max']
        kind = part.get('kind', 'wall')
        mat = finishes.get(kind, 'limestone')
        if kind == 'wall':
            mat = ['plaster_light', 'plaster', 'plaster_blue'][part.get('building', 0) % 3]
        a.box(mat, *[(v + w) / 2 for v, w in zip(lo, hi)],
              *[w - v for v, w in zip(lo, hi)])

    for b in plan['buildings']:
        x, z, bid = b['x'], b['z'], b['id']
        facade = ['plaster_light', 'plaster', 'plaster_blue'][bid % 3]

        def box(mat, xx, yy, zz, w, h, d):
            a.box(mat, x + xx, yy, z + zz, w, h, d)

        def height(u):
            q = max(0, min(96, (u - .15) / 8.7 * 96))
            i = min(95, int(q))
            return plan['roofProfile'][i] * (1 - (q - i)) + plan['roofProfile'][i + 1] * (q - i)

        # The original roof is traversable. Keep every shared sample and its
        # silhouette; real shingle material replaces the previous fantasy panels.
        for j in range(96):
            u, v = .15 + j * 8.7 / 96, .15 + (j + 1) * 8.7 / 96
            for k in range(7):
                zz, end = -.25 + k * 5.5 / 7, -.25 + (k + 1) * 5.5 / 7
                a.face('roof', [(x + u, height(u), z + zz), (x + u, height(u), z + end),
                                (x + v, height(v), z + end), (x + v, height(v), z + zz)])
            for zz in [-.25, 5.25]:
                a.face(facade, [(x + u, 7.18, z + zz), (x + v, 7.18, z + zz),
                                (x + v, height(v), z + zz), (x + u, height(u), z + zz)])

        # Horizontal cornice courses follow solid masonry only. In particular,
        # the centre upstairs door remains open from y=3.60 to 6.00 metres.
        for yy, hh, protrusion in [(3.31, .12, .10), (3.51, .06, .14),
                                    (6.86, .12, .13), (7.03, .09, .18)]:
            box('trim', 6, yy, -.02 - protrusion / 2, 12, hh, protrusion)
            box('trim', 6, yy, 12.02 + protrusion / 2, 12, hh, protrusion)
            for xx in [-.02 - protrusion / 2, 12.02 + protrusion / 2]:
                box('trim', xx, yy, 6, protrusion, hh, 12)

        # A worn stone plinth separates plaster from rain splash. No sill spans
        # the front door; no fake windows are painted into closed walls.
        for xx, ww in [(2, 4), (9.5, 5)]:
            box('limestone', xx, .29, -.035, ww, .58, .07)
            box('trim', xx, .60, -.055, ww, .065, .11)
        for xx in [-.035, 12.035]:
            box('limestone', xx, .29, 6, .07, .58, 12)
            box('trim', xx, .60, 6, .11, .065, 12)
        box('limestone', 6, .29, 12.035, 12, .58, .07)
        box('trim', 6, .60, 12.055, 12, .065, .11)

        # Existing solid balcony remains honest cover, now masonry rather than
        # oval carved timber and curled supports. Coping stays within the old
        # horizontal extent; decorative Bistro profile is fitted to its face.
        box('trim', 5.4, 4.285, -1.75, 8, .065, .10)
        box('trim', 5.4, 3.47, -1.79, 8, .10, .04)
        for xx in [1.45, 9.35]:
            box('trim', xx, 4.285, -.9, .10, .065, 1.8)

        # Interior beams sit above the head, book spines dress existing furniture.
        for floor in [0, 3.6]:
            for zz in [1.35, 5.4, 9]:
                box('wood', 4.6, floor + 3.22, zz, 8.55, .14, .18)
            for row in range(4):
                for j in range(10):
                    box(['wood', 'shutter', 'trim'][(j + row + bid) % 3], .886,
                        floor + .39 + row * .5, 9.73 + j * .145, .012,
                        .25 + (j % 3) * .018, .12)
        for j in range(20):
            box('trim', 9.6875, j * .18 + .163, .5 + j * .5 + .025, 1.375, .03, .05)
            box('trim', 11.0625, 3.6 + j * .18 + .163, 10 - j * .5 + .475, 1.375, .03, .05)
    return len(plan['buildings'])


def wall_details(a, x, z, dx, dz, variant, theme):
    """Courtyard masonry; a wall that blocks the player must look like a wall."""
    px, pz = x * 4 + 2 + dx * 2, z * 4 + 2 + dz * 2

    def panel(mat, u, y, w, h, depth):
        def p(uu, yy):
            return px - dz * uu + dx * depth, yy, pz + dx * uu + dz * depth
        a.face(mat, [p(u - w / 2, y - h / 2), p(u - w / 2, y + h / 2),
                    p(u + w / 2, y + h / 2), p(u + w / 2, y - h / 2)])
    panel('limestone', 0, .35, 4, .70, .018)
    panel('trim', 0, .73, 4, .085, .05)
    panel('limestone', 0, 3.84, 4, .20, .025)
    panel('trim', 0, 3.965, 4, .065, .045)
    # Thin pilaster joint breaks long masonry runs without inventing entrances.
    if variant % 3 == 0:
        panel('limestone', -1.86, 2.26, .23, 3.0, .035)
    if variant % 8 == 3:
        panel('steel', 1.1, 2.8, .16, .32, .12)
        panel('lamp_warm', 1.1, 2.8, .10, .23, .13)
