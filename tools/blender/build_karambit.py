"""Original compact anime karambit, in the existing knife's game coordinates.

Blender 5.2+: blender -b --python tools/blender/build_karambit.py -- --preview graphics-qa/karambit-model.png
Exports only anime-karambit.glb; the established 20-asset manifest is untouched.
Game coordinates: X right, Y up, -Z forward. The ring's axle is +X.
"""
import argparse
import importlib.util
import json
import math
import struct
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
spec = importlib.util.spec_from_file_location('karambit_helpers', HERE / 'build_characters.py')
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)
SPIN_PIVOT = (0, .006, .13)
SPIN_AXIS = (1, 0, 0)


def material(name, rgb, rough=.53, metal=.18):
    values = [int(rgb[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values]
    return a.surface(name, linear, rough, metal)


def clean(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.0000001)
    bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=.0000001)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(ob.data)
    bm.free()
    for face in ob.data.polygons:
        face.use_smooth = True
    return ob


def bezier(points, t):
    u = 1 - t
    return sum((Vector(p) * weight for p, weight in zip(points, (u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3))), Vector((0, 0)))


def blade(parent, steel, edge):
    # Each rail runs from the bolster to the same swept hook point (z, y).
    spine = [(-.008, .016), (-.082, .026), (-.122, -.038), (-.070, -.086)]
    cutting = [(-.008, -.016), (-.042, -.008), (-.069, -.041), (-.070, -.086)]
    steps = 30
    for name, widths, mat in [('Forged hooked blade', [0, .18, .43, .72], steel), ('Continuous honed bevel', [.72, .87, 1], edge)]:
        verts, faces = [], []
        cols = len(widths)
        for sign in (-1, 1):
            for j in range(steps + 1):
                t = j / steps
                outer, inner = bezier(spine, t), bezier(cutting, t)
                for u in widths:
                    p = outer.lerp(inner, u)
                    thickness = (.003 + .0014 * math.sin(u * math.pi / .95)) if u <= .72 else .004 * (1 - (u - .72) / .28) + .00012
                    verts.append((sign * thickness * (1 - t ** 2.4), p.y, p.x))
        side = (steps + 1) * cols
        for offset in (0, side):
            for j in range(steps):
                for k in range(cols - 1):
                    n = offset + j * cols + k
                    faces.append((n, n + 1, n + cols + 1, n + cols))
        # Close the spine, the cutting edge and the seated tang; the two face
        # strips meet at the bevel shoulder rather than layering flat stickers.
        boundary = 0 if widths[0] == 0 else cols - 1
        for j in range(steps):
            n = j * cols + boundary
            faces.append((n, n + cols, n + cols + side, n + side))
        for k in range(cols - 1):
            faces.append((k, k + side, k + side + 1, k + 1))
        clean(a.mesh(name, verts, faces, mat, parent))


def grip_shape(t, theta):
    swell = .81 + .19 * math.sin(math.pi * t) ** .7
    grooves = sum(math.exp(-((t - c) / .055) ** 2) for c in (.23, .48, .73))
    x = .019 * swell * math.cos(theta)
    y = .022 * swell * math.sin(theta) + .002 * math.sin(math.pi * t)
    if math.sin(theta) < 0:
        y += .0035 * grooves * (-math.sin(theta)) ** 3
    return x, y, -.005 + t * .111


def grip(parent, dark, ceramic, brass):
    rings, segments = 25, 24
    verts = [grip_shape(j / (rings - 1), k * math.tau / segments) for j in range(rings) for k in range(segments)]
    faces = [tuple(reversed(range(segments))), tuple(range((rings - 1) * segments, rings * segments))]
    for j in range(rings - 1):
        for k in range(segments):
            n, q = j * segments + k, j * segments + (k + 1) % segments
            faces.append((n, q, q + segments, n + segments))
    a.mesh('Sculpted palm swell and finger scallops', verts, faces, dark, parent)
    for sign in (-1, 1):
        verts, faces = [], []
        for j in range(21):
            t = .07 + j / 20 * .84
            for k in range(13):
                angle = -.94 + k / 12 * 1.88
                x, y, z = grip_shape(t, angle)
                rim = math.sin(j / 20 * math.pi) ** .4
                verts.append((sign * (x + .0006 + .0011 * rim * math.cos(angle)), y, z))
        for j in range(20):
            for k in range(12):
                n = j * 13 + k
                faces.append((n, n + 1, n + 14, n + 13))
        a.mesh('Domed ceramic grip scale', verts, faces, ceramic, parent)
        # A swept gold inlay remains readable when the short handle turns.
        points = []
        for j in range(25):
            t = .15 + j / 24 * .65
            x, y, z = grip_shape(t, .50 + math.sin(t * math.pi) * .13)
            points.append((sign * (x + .0020), y, z))
        a.line('Swept brass grip inlay', points, .0009, brass, parent)
        for t in (.16, .52, .86):
            x, y, z = grip_shape(t, 0)
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1)
            ob = bpy.context.object
            ob.name = 'Flush grip rivet'
            ob.parent = parent
            ob.location = a.xyz((sign * (x + .0018), y, z))
            ob.scale = (.0011, .0028, .0028)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            ob.data.materials.append(brass)
            for face in ob.data.polygons:
                face.use_smooth = True


def ring(parent, mat, name, center=SPIN_PIVOT, major=.021, radial=.0055, width=.0065, segments=56, tube=10):
    verts, faces = [], []
    for j in range(segments):
        phi = j * math.tau / segments
        for k in range(tube):
            beta = k * math.tau / tube
            radius = major + radial * math.sin(beta)
            verts.append((center[0] + width * math.cos(beta), center[1] + radius * math.cos(phi), center[2] + radius * math.sin(phi)))
    for j in range(segments):
        for k in range(tube):
            faces.append((j * tube + k, j * tube + (k + 1) % tube, ((j + 1) % segments) * tube + (k + 1) % tube, ((j + 1) % segments) * tube + k))
    return a.mesh(name, verts, faces, mat, parent)


def world_lod(root):
    bpy.context.view_layer.update()
    groups = {}
    for ob in list(root.children_recursive):
        if ob.type != 'MESH':
            continue
        mat = ob.data.materials[0]
        paintable = mat.name.startswith('Weapon finish /')
        verts, faces, colors = groups.setdefault(paintable, ([], [], []))
        color = tuple(mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value[:3])
        attr = ob.data.color_attributes.active_color
        matrix = root.matrix_world.inverted() @ ob.matrix_world
        offset = len(verts)
        verts.extend(tuple(matrix @ v.co) for v in ob.data.vertices)
        for face in ob.data.polygons:
            faces.append(tuple(offset + i for i in face.vertices))
            for loop in face.loop_indices:
                idx = ob.data.loops[loop].vertex_index if attr and attr.domain == 'POINT' else loop
                shade = attr.data[idx].color[:3] if attr else (1, 1, 1)
                colors.append(tuple(c * s for c, s in zip(color, shade)) + (1,))
    group = a.empty('worldLOD', parent=root)
    for paintable, (verts, faces, colors) in groups.items():
        mesh = bpy.data.meshes.new('Karambit world surface')
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        attr = mesh.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
        for dst, color in zip(attr.data, colors):
            dst.color = color
        mesh.color_attributes.active_color = attr
        mat = a.surface('Weapon finish / Karambit world' if paintable else 'Karambit world hardware', (1, 1, 1), .56, .16)
        vertex = mat.node_tree.nodes.new('ShaderNodeVertexColor')
        vertex.layer_name = 'Color'
        mat.node_tree.links.new(vertex.outputs['Color'], mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
        mesh.materials.append(mat)
        ob = bpy.data.objects.new('World paint' if paintable else 'World hardware', mesh)
        bpy.context.collection.objects.link(ob)
        ob.parent = group
        bpy.context.view_layer.objects.active = ob
        modifier = ob.modifiers.new('Compact world silhouette', 'DECIMATE')
        modifier.ratio = .30
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        for face in ob.data.polygons:
            face.use_smooth = True
    return group


def preview(root, lod, output):
    lod.hide_render = True
    for child in lod.children_recursive:
        child.hide_render = True
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1024, 768
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new('Karambit studio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.065, .09, .13, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .45
    scene.view_settings.view_transform = 'AgX'
    bpy.ops.object.camera_add(location=a.xyz((.48, .17, .23)))
    camera = bpy.context.object
    camera.rotation_euler = (Vector(a.xyz((0, -.01, .025))) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = .34
    scene.camera = camera
    for name, pos, energy, size in [('Large soft key', (.28, .35, -.15), 6, .42), ('Cool rim', (-.15, .22, .12), 4, .32), ('Front fill', (.35, -.08, .28), 2, .28)]:
        bpy.ops.object.light_add(type='AREA', location=a.xyz(pos))
        lamp = bpy.context.object
        lamp.name = name
        lamp.data.energy = energy
        lamp.data.shape = 'DISK'
        lamp.data.size = size
        lamp.rotation_euler = (Vector(a.xyz((0, 0, .03))) - lamp.location).to_track_quat('-Z', 'Y').to_euler()
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)


def stable_triangle_order(output):
    """Blender may permute equal opaque triangles between processes; keep byte-identical rebuilds."""
    data = bytearray(output.read_bytes())
    json_length = struct.unpack_from('<I', data, 12)[0]
    document = json.loads(data[20:20 + json_length])
    binary = 28 + json_length
    # Applied bevels can vary by one float ULP in unused procedural UVs.
    # Keep skin-compatible UVs while discarding only that subpixel noise.
    for accessor in document['accessors']:
        if accessor['componentType'] != 5126 or accessor['type'] != 'VEC2':
            continue
        view = document['bufferViews'][accessor['bufferView']]
        offset = binary + view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        for pos in range(offset, offset + accessor['count'] * 8, 4):
            struct.pack_into('<f', data, pos, round(struct.unpack_from('<f', data, pos)[0], 6))
    seen = set()
    for mesh in document['meshes']:
        for primitive in mesh['primitives']:
            index = primitive.get('indices')
            if index is None or index in seen or primitive.get('mode', 4) != 4:
                continue
            seen.add(index)
            accessor = document['accessors'][index]
            view = document['bufferViews'][accessor['bufferView']]
            offset = binary + view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
            fmt = '<' + {5123: 'H', 5125: 'I'}[accessor['componentType']] * accessor['count']
            values = struct.unpack_from(fmt, data, offset)
            triangles = []
            for i in range(0, len(values), 3):
                triangle = values[i:i + 3]
                first = triangle.index(min(triangle))
                triangles.append(triangle[first:] + triangle[:first])
            struct.pack_into(fmt, data, offset, *(v for triangle in sorted(triangles) for v in triangle))
    output.write_bytes(data)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'models/csgo/anime-karambit.glb')
    parser.add_argument('--preview', type=Path)
    cfg = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    root = a.empty('karambit')
    weapon = a.empty('weapon', parent=root)
    # Extras are game/glTF coordinates, not Blender's Z-up authoring coordinates.
    for node in (root, weapon):
        node['spinPivot'] = list(SPIN_PIVOT)
        node['spinAxis'] = list(SPIN_AXIS)
    root['artStyle'] = 'Original realistic satin steel / Support Hub'
    root['cs16Realistic'] = True
    root['gripContact'] = [0, 0, .055]
    root['ringInnerRadius'] = .0155
    steel = material('Karambit satin blade', '#85898c', .43, .84)
    edge = material('Karambit honed edge', '#b5b7b9', .32, .90)
    ceramic = material('Weapon finish / Karambit grip scale', '#3d4142', .72, .04)
    dark = material('Karambit graphite grip', '#303335', .77, .02)
    brass = material('Karambit machined fasteners', '#64696c', .47, .78)
    blade(weapon, steel, edge)
    grip(weapon, dark, ceramic, brass)
    a.box('Rounded blade bolster', (0, .001, -.007), (.043, .042, .013), brass, weapon, .004)
    ring(weapon, steel, 'Open finger ring')
    for sign in (-1, 1):
        ring(weapon, brass, 'Ring face inlay', (sign * .0061, SPIN_PIVOT[1], SPIN_PIVOT[2]), .021, .0008, .0008, 40, 6)
    sys.path.insert(0, str(HERE))
    from build_realistic_arsenal import neutralize, lod as realistic_lod
    neutralize(root)
    a.join_parts(root)
    lod = realistic_lod(root, .20)
    bpy.context.view_layer.update()
    points = [root.matrix_world.inverted() @ ob.matrix_world @ vertex.co for ob in weapon.children_recursive if ob.type == 'MESH' for vertex in ob.data.vertices]
    game_points = [(p.x, p.z, -p.y) for p in points]
    bounds = {'min': [min(p[i] for p in game_points) for i in range(3)], 'max': [max(p[i] for p in game_points) for i in range(3)]}
    root['sourceBoundsMin'] = bounds['min']
    root['sourceBoundsMax'] = bounds['max']
    cfg.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in [root] + list(root.children_recursive):
        ob.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=str(cfg.output), export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_extras=True, export_animations=False, export_cameras=False, export_lights=False, export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True)
    stable_triangle_order(cfg.output)
    triangles = {}
    for name, group in [('view', weapon), ('world', lod)]:
        meshes = [ob for ob in group.children_recursive if ob.type == 'MESH']
        for ob in meshes:
            ob.data.calc_loop_triangles()
        triangles[name] = sum(len(ob.data.loop_triangles) for ob in meshes)
    assert cfg.output.stat().st_size < 500_000, 'Karambit exceeds its standalone asset budget'
    print('KARAMBIT_ASSET ' + json.dumps({'file': str(cfg.output), 'bytes': cfg.output.stat().st_size, 'triangles': triangles, 'spinPivot': SPIN_PIVOT, 'spinAxis': SPIN_AXIS, 'sourceBounds': bounds}), flush=True)
    if cfg.preview:
        preview(root, lod, cfg.preview.resolve())


if __name__ == '__main__':
    main()
