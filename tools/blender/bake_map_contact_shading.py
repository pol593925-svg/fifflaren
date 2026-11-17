"""Deterministic, short-range architectural AO in the existing vertex colours.

No faces, normals, UVs, materials or runtime passes are added. The bake uses
exported corner normals so identical glTF vertices remain identical. Movable
cover and foliage cannot leave permanent shadows after gameplay removes them.
"""
import math
import json
import struct
import time

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


SAMPLES = 16
REACH = .48
BIAS = .006
MAX_DARKENING = .28
SKIP_MATERIALS = {'flower', 'leaf', 'lamp_warm', 'lamp_green', 'paint'}


def bake(objects):
    started = time.perf_counter()
    bpy.context.view_layer.update()
    # The previous glTF AUTO export supplied white COLOR_0; the old authored
    # tint lived in COLOR_1 and was not displayed by Three.js. Keep that layer
    # intact and replace only the displayed white channel, avoiding a global
    # brightness change when explicitly selecting the exported active colour.
    for ob in objects:
        if ob.type != 'MESH':
            continue
        mesh = ob.data
        old = mesh.color_attributes.get('ContactShade')
        if old is not None:
            mesh.color_attributes.remove(old)
        attr = mesh.color_attributes.new(name='ContactShade', type='BYTE_COLOR', domain='CORNER')
        attr.data.foreach_set('color', np.ones(len(mesh.loops) * 4, dtype=np.float32))
        mesh.color_attributes.active_color = attr
        mesh.color_attributes.render_color_index = len(mesh.color_attributes) - 1
    static = [ob for ob in objects if ob.type == 'MESH'
              and not ob.get('backdrop') and not ob.name.startswith('crate_')
              and ob.data.materials
              and ob.data.materials[0].name not in SKIP_MATERIALS]
    vertices, faces = [], []
    for ob in static:
        start = len(vertices)
        vertices.extend(ob.matrix_world @ vertex.co for vertex in ob.data.vertices)
        faces.extend(tuple(start + index for index in poly.vertices)
                     for poly in ob.data.polygons)
    bvh = BVHTree.FromPolygons(vertices, faces, all_triangles=False, epsilon=.00001)
    # Fixed cosine-weighted hemisphere. Identical scenes bake identically.
    samples = [Vector((math.cos(j * 2.399963229728653) * math.sqrt((j + .5) / SAMPLES),
                       math.sin(j * 2.399963229728653) * math.sqrt((j + .5) / SAMPLES),
                       math.sqrt(1 - (j + .5) / SAMPLES))) for j in range(SAMPLES)]
    cache = {}
    total, changed, shade_sum, darkest = 0, 0, 0., 1.
    material_stats = {}
    print('CONTACT_BAKE_START', len(static), 'static meshes', len(faces), 'polygons', flush=True)
    for ob in static:
        mesh = ob.data
        attr = mesh.color_attributes.get('ContactShade')
        if attr is None or attr.domain != 'CORNER':
            raise ValueError('Expected the contact colour layer on ' + ob.name)
        positions = np.empty((len(mesh.vertices), 3), dtype=np.float32)
        mesh.vertices.foreach_get('co', positions.ravel())
        indices = np.empty(len(mesh.loops), dtype=np.int32)
        mesh.loops.foreach_get('vertex_index', indices)
        normals = np.empty((len(mesh.loops), 3), dtype=np.float32)
        mesh.corner_normals.foreach_get('vector', normals.ravel())
        records, inverse = np.unique(np.concatenate((positions[indices], normals), axis=1),
                                     axis=0, return_inverse=True)
        factors = np.ones(len(records), dtype=np.float32)
        matrix = ob.matrix_world
        normal_matrix = matrix.to_3x3().inverted().transposed()
        material = mesh.materials[0].name
        # Large paving polygons need a lighter wash than small carved recesses.
        strength = .16 if material == 'ground' else MAX_DARKENING
        for index, record in enumerate(records):
            normal = (normal_matrix @ Vector(record[3:])).normalized()
            world_point = matrix @ Vector(record[:3])
            key = tuple(world_point) + tuple(normal)
            occlusion = cache.get(key)
            if occlusion is None:
                point = world_point + normal * BIAS
                axis = normal.cross(Vector((0, 0, 1)))
                if axis.length < .01:
                    axis = normal.cross(Vector((0, 1, 0)))
                axis.normalize()
                up = normal.cross(axis)
                blocked = 0.
                for sample in samples:
                    hit = bvh.ray_cast(point, axis * sample.x + up * sample.y + normal * sample.z, REACH)
                    if hit[0] is not None:
                        # Nearby contacts dominate; distant walls never dim a street.
                        blocked += (1 - hit[3] / REACH) ** 2
                occlusion = blocked / SAMPLES
                cache[key] = occlusion
            # A small dead zone leaves exposed surfaces at their original colour.
            cavity = max(0., (occlusion - .12) / .88) ** 1.5
            factors[index] = max(1 - strength, 1 - strength * cavity)
        colours = np.empty((len(mesh.loops), 4), dtype=np.float32)
        attr.data.foreach_get('color', colours.ravel())
        loop_factors = factors[inverse]
        colours[:, :3] *= loop_factors[:, None]
        attr.data.foreach_set('color', colours.ravel())
        mesh.color_attributes.active_color = attr
        count = len(loop_factors)
        total += count
        changed += int(np.count_nonzero(loop_factors < .995))
        shade_sum += float(loop_factors.sum())
        darkest = min(darkest, float(loop_factors.min()))
        summary = material_stats.setdefault(material, {'corners': 0, 'factorSum': 0., 'minimumFactor': 1.})
        summary['corners'] += count
        summary['factorSum'] += float(loop_factors.sum())
        summary['minimumFactor'] = min(summary['minimumFactor'], float(loop_factors.min()))
        print('CONTACT_BAKE_MESH', ob.name, len(records), 'samples',
              'mean', round(float(loop_factors.mean()), 4), flush=True)
    result = {'method': 'short-range cosine hemisphere BVH vertex AO',
              'samples': SAMPLES, 'radiusMeters': REACH, 'biasMeters': BIAS,
              'maximumDarkening': MAX_DARKENING, 'shadedCorners': changed,
              'sampledCorners': total, 'meanFactor': round(shade_sum / total, 5),
              'minimumFactor': round(darkest, 5), 'materials': {}}
    for material, summary in sorted(material_stats.items()):
        result['materials'][material] = {
            'meanFactor': round(summary['factorSum'] / summary['corners'], 5),
            'minimumFactor': round(summary['minimumFactor'], 5)}
    print('CONTACT_BAKE_FINISH', round(time.perf_counter() - started, 2), 'seconds', flush=True)
    return result


def pack_export(path):
    """Keep the original four-byte GPU colour budget after Blender's U16 export."""
    data = path.read_bytes()
    json_length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + json_length])
    binary = data[28 + json_length:]
    replacements = {}
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            accessor = doc['accessors'][primitive['attributes']['COLOR_0']]
            view = doc['bufferViews'][accessor['bufferView']]
            assert accessor['type'] == 'VEC4' and accessor['normalized']
            assert not accessor.get('byteOffset') and not view.get('byteStride')
            if accessor['componentType'] == 5121:
                continue
            assert accessor['componentType'] == 5123
            values = np.frombuffer(binary, dtype='<u2', count=accessor['count'] * 4,
                                   offset=view.get('byteOffset', 0))
            replacements[accessor['bufferView']] = np.rint(values.astype(np.float32) / 257).astype(np.uint8).tobytes()
            accessor['componentType'] = 5121
    packed = bytearray()
    for index, view in enumerate(doc['bufferViews']):
        offset = view.get('byteOffset', 0)
        raw = replacements.get(index, binary[offset:offset + view['byteLength']])
        packed.extend(b'\0' * (-len(packed) % 4))
        view['byteOffset'], view['byteLength'] = len(packed), len(raw)
        packed.extend(raw)
    packed.extend(b'\0' * (-len(packed) % 4))
    doc['buffers'][0]['byteLength'] = len(packed)
    header = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    header += b' ' * (-len(header) % 4)
    # Do not truncate Blender's just-exported file in place on Windows.
    temporary = path.with_suffix('.contact.glb')
    temporary.write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(header) + len(packed)) +
                          struct.pack('<II', len(header), 0x4e4f534a) + header +
                          struct.pack('<II', len(packed), 0x004e4942) + packed)
    temporary.replace(path)
