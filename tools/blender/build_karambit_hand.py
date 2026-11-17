"""Two authored right-hand poses, rooted at the karambit ring centre.

blender -b --python tools/blender/build_karambit_hand.py -- --preview graphics-qa/karambit-hands
rightHand: index passes through (0,0,0) along X; other digits clear the rotor.
attackHand: closed grip along -Z. Both sleeves extend toward the camera, +Z.
"""
import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_karambit as k
from bake_asset_shading import bake
a = k.a
ROOT = HERE.parents[1]


def smooth_path(points, radii, subdivisions=3):
    positions, sizes = [], []
    points = [Vector(p) for p in points]
    for i in range(len(points) - 1):
        p, q, r, s = points[max(0, i - 1)], points[i], points[i + 1], points[min(len(points) - 1, i + 2)]
        for j in range(subdivisions):
            t = j / subdivisions
            positions.append(tuple(.5 * ((2 * q) + (-p + r) * t + (2 * p - 5 * q + 4 * r - s) * t * t + (-p + 3 * q - 3 * r + s) * t ** 3)))
            sizes.append(radii[i] * (1 - t) + radii[i + 1] * t)
    return positions + [tuple(points[-1])], sizes + [radii[-1]]


def tube(name, points, radii, material, parent, segments=12, flatten=.93, smooth=3):
    if smooth:
        points, radii = smooth_path(points, radii, smooth)
    verts, faces = [], []
    guide = Vector((0, 1, 0))
    for i, (point, radius) in enumerate(zip(points, radii)):
        axis = (Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(i - 1, 0)])).normalized()
        up = guide - axis * guide.dot(axis)
        if up.length < .001:
            up = Vector((1, 0, 0)) - axis * axis.x
        up.normalize()
        guide = up
        across = axis.cross(up).normalized()
        for j in range(segments):
            angle = j * math.tau / segments
            verts.append(tuple(Vector(point) + radius * (math.cos(angle) * up + flatten * math.sin(angle) * across)))
    for i in range(len(points) - 1):
        for j in range(segments):
            n, q = i * segments + j, i * segments + (j + 1) % segments
            faces.append((n, q, q + segments, n + segments))
    faces.extend([tuple(reversed(range(segments))), tuple(range(len(verts) - segments, len(verts)))])
    return a.mesh(name, verts, faces, material, parent)


def nail(parent, path, mat, radius=.006):
    tip = Vector(path[-2])
    axis = (Vector(path[-1]) - Vector(path[-3])).normalized()
    up = Vector((0, 1, 0)) - axis * axis.y
    up.normalize()
    across = axis.cross(up).normalized()
    center = tip + up * radius * .88
    vertices = [tuple(center + up * .0005)]
    for j in range(14):
        angle = j * math.tau / 14
        vertices.append(tuple(center + axis * math.cos(angle) * .0045 + across * math.sin(angle) * .0033))
    a.mesh('Soft rounded nail', vertices, [(0, j + 1, (j + 1) % 14 + 1) for j in range(14)], mat, parent)


def finger(parent, name, path, radii, skin, nails, binding):
    ob = tube(name, path, radii, skin, parent)
    bpy.context.view_layer.objects.active = ob
    modifier = ob.modifiers.new('Rounded continuous phalanges', 'SUBSURF')
    modifier.levels = 1
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier = ob.modifiers.new('Finger surface budget', 'DECIMATE')
    modifier.ratio = .72
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    nail(parent, path, nails, radii[-2])
    # An open glove edge remains close to the knuckle, away from the ring hole.
    axis = (Vector(path[1]) - Vector(path[0])).normalized()
    up = Vector((0, 1, 0)) - axis * axis.y
    up.normalize()
    across = axis.cross(up).normalized()
    root = Vector(path[0])
    points = [tuple(root + (radii[0] + .0005) * (up * math.cos(j * math.tau / 18) + across * math.sin(j * math.tau / 18))) for j in range(19)]
    a.line('Rolled fingerless edge', points, .0008, binding, parent)


def sleeve(parent, wrist, cloth, teal, ivory, gold):
    points, radii = [], []
    for j in range(24):
        t = j / 23
        points.append((wrist[0] + .12 * t + .025 * t * t, wrist[1] - .12 * t, wrist[2] + .45 * t))
        radii.append(.030 + .021 * t + .0017 * math.sin(t * 29) + .0008 * math.cos(t * 49))
    tube('Rounded tailored forearm', points, radii, cloth, parent, 20, .9, 0)
    tube('Soft wrist binding', points[:4], [r + .0012 for r in radii[:4]], teal, parent, 20, .91, 0)
    for j in (1, 3):
        pos = Vector(points[j])
        ring = [tuple(pos + Vector((math.sin(i * math.tau / 32) * radii[j] * .92, math.cos(i * math.tau / 32) * radii[j], 0))) for i in range(33)]
        a.line('Fine cuff piping', ring, .0009, gold, parent)
    seam = [(p[0] + r * .55, p[1] + r * .82, p[2]) for p, r in zip(points[2::2], radii[2::2])]
    a.line('Tailored sleeve seam', seam, .0014, ivory, parent)
    for t in (.27, .53, .77):
        j = int(t * 23)
        p, r = points[j], radii[j]
        a.line('Curved sleeve fold', [(p[0] + math.sin(angle) * r * .93, p[1] + math.cos(angle) * r, p[2] + math.sin(angle * 2) * .005) for angle in (-.75, -.5, -.25, 0, .25, .5, .75)], .0008, ivory, parent)


def pose(root, name, mats):
    skin, nails, leather, cloth, teal, ivory, gold = mats
    hand = a.empty(name, parent=root)
    hand['ringContact'] = [0, 0, 0]
    hand['fingerAxis'] = [1, 0, 0]
    idle = name == 'rightHand'
    if idle:
        wrist = (.080, -.033, .100)
        tube('Curved fingerless glove palm', [wrist, (.074, -.026, .070), (.069, -.020, .043), (.065, -.011, .018)], [.023, .024, .023, .018], leather, hand, 18, 1.40)
        index = [(.060, .001, .010), (.038, .0005, .002), (.016, 0, 0), (-.005, 0, 0), (-.021, 0, .001), (-.030, -.002, .007), (-.032, -.005, .012)]
        finger(hand, 'Index through the ring', index, [.0097, .0093, .0088, .0085, .0078, .0058, .0006], skin, nails, teal)
        for j in range(3):
            z = .030 + j * .019
            path = [(.054, -.014, z), (.045, -.026, z - .001), (.042, -.042, z), (.049, -.051, z + .006), (.061, -.045, z + .011), (.064, -.040, z + .010)]
            mul = 1 - j * .09
            finger(hand, ['Relaxed middle finger', 'Relaxed ring finger', 'Relaxed little finger'][j], path, [r * mul for r in (.0095, .010, .0094, .008, .0058, .0006)], skin, nails, teal)
        thumb = [(.086, -.008, .052), (.083, .004, .040), (.071, .009, .027), (.058, .009, .018), (.050, .005, .019), (.049, 0, .023)]
    else:
        wrist = (.067, -.029, .042)
        tube('Closed power-grip palm', [wrist, (.058, -.013, .010), (.050, -.005, -.035), (.047, -.005, -.079)], [.024, .027, .023, .020], leather, hand, 18, 1.10)
        for j in range(4):
            z = -.030 - j * .022
            path = [(.032, -.002, z), (.032, -.023, z - .001), (.015, -.034, z - .003), (-.007, -.032, z - .003), (-.024, -.017, z - .001), (-.026, -.002, z + .002), (-.024, .002, z + .004)]
            mul = 1 - j * .045
            finger(hand, ['Closed index finger', 'Closed middle finger', 'Closed ring finger', 'Closed little finger'][j], path, [r * mul for r in (.0097, .0102, .0097, .009, .008, .0058, .0006)], skin, nails, teal)
        thumb = [(.060, .002, .008), (.052, .015, -.010), (.038, .024, -.024), (.019, .025, -.033), (.008, .025, -.040), (.006, .025, -.043)]
    finger(hand, 'Naturally opposed thumb', thumb, [.0118, .012, .011, .0095, .0063, .0008], skin, nails, teal)
    sleeve(hand, wrist, cloth, teal, ivory, gold)
    # Broad curved knuckle protection, rather than floating rectangular plates.
    if idle:
        for z in (.026, .046, .066):
            a.orb('Rounded glove knuckle', (.076, -.008, z), (.009, .008, .010), teal, hand, 12, 6)
    else:
        for z in (-.032, -.055, -.078):
            a.orb('Rounded glove knuckle', (.055, .016, z), (.009, .008, .010), teal, hand, 12, 6)
    return hand


def render_preview(root, directory):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1024, 768
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('Hand studio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.065, .09, .13, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .6
    scene.view_settings.view_transform = 'AgX'
    bpy.ops.object.camera_add(location=a.xyz((.36, .23, .32)))
    camera = bpy.context.object
    camera.rotation_euler = (Vector(a.xyz((.01, -.01, -.025))) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type, camera.data.ortho_scale = 'ORTHO', .39
    scene.camera = camera
    for pos, energy, size in [((.23, .35, -.12), 7, .40), ((-.22, .16, .17), 4, .32)]:
        bpy.ops.object.light_add(type='AREA', location=a.xyz(pos))
        lamp = bpy.context.object
        lamp.data.energy, lamp.data.shape, lamp.data.size = energy, 'DISK', size
        lamp.rotation_euler = (Vector(a.xyz((0, 0, .01))) - lamp.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'models/csgo/anime-karambit.glb'))
    knife = bpy.data.objects.get('karambit')
    lod = bpy.data.objects.get('worldLOD')
    for node in [lod] + list(lod.children_recursive):
        node.hide_render = True
    rotor = a.empty('Preview rotor')
    knife.parent = rotor
    knife.location = a.xyz(tuple(-v for v in k.SPIN_PIVOT))
    directory.mkdir(parents=True, exist_ok=True)
    for name in ('rightHand', 'attackHand'):
        for hand in root.children:
            for node in [hand] + list(hand.children_recursive):
                node.hide_render = hand.name != name
        rotor.rotation_euler.x = .9 if name == 'rightHand' else 0
        scene.render.filepath = str(directory / (name + '.png'))
        bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'models/csgo/anime-karambit-hand.glb')
    parser.add_argument('--preview', type=Path)
    cfg = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    root = a.empty('karambitHands')
    root['artStyle'] = 'Original rounded anime ring and attack poses'
    mats = [k.material('Warm exposed fingers', '#d7ac90', .79, 0), k.material('Natural ivory nails', '#edcbb5', .62, 0), k.material('Tailored graphite glove', '#344c61', .85, 0), k.material('Soft ivory field sleeve', '#c7bba4', .88, 0), k.material('Teal glove binding', '#427c89', .72, .03), k.material('Ivory tailored stitching', '#e4d7b9', .84, 0), k.material('Cuff brass piping', '#bb965e', .58, .16)]
    for name in ('rightHand', 'attackHand'):
        pose(root, name, mats)
    bake(root, True)
    a.join_parts(root)
    bpy.context.view_layer.update()
    bounds = {}
    for hand in root.children:
        points = [hand.matrix_world.inverted() @ ob.matrix_world @ v.co for ob in hand.children_recursive if ob.type == 'MESH' for v in ob.data.vertices]
        points = [(p.x, p.z, -p.y) for p in points]
        bounds[hand.name] = {'min': [min(p[i] for p in points) for i in range(3)], 'max': [max(p[i] for p in points) for i in range(3)]}
        hand['sourceBoundsMin'], hand['sourceBoundsMax'] = bounds[hand.name]['min'], bounds[hand.name]['max']
    cfg.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in [root] + list(root.children_recursive):
        ob.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=str(cfg.output), export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_extras=True, export_animations=False, export_cameras=False, export_lights=False, export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True)
    k.stable_triangle_order(cfg.output)
    print('KARAMBIT_HANDS ' + json.dumps({'file': str(cfg.output), 'bytes': cfg.output.stat().st_size, 'bounds': bounds}), flush=True)
    if cfg.preview:
        render_preview(root, cfg.preview.resolve())


if __name__ == '__main__':
    main()
