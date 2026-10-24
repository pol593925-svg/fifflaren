"""Author original, articulated tactical operators in Blender and export glTF.

Run with Blender 4.5+:
  blender --background --python tools/blender/build_characters.py -- \
    --output models/csgo --source ../../outputs/csgo-blender

Coordinates in modeling helpers use the game's x/right, y/up, z/back convention.
The exported six named pivots intentionally match cs16.js's existing animation.
All artwork and texture pixels are generated here; no external assets are used.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
import numpy as np
from mathutils import Vector


def cli():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--output", type=Path, default=Path("models/csgo"))
    p.add_argument("--source", type=Path, default=Path("../../outputs/csgo-blender"))
    p.add_argument("--preview", action="store_true")
    return p.parse_args(args)


def xyz(p):
    return (p[0], -p[2], p[1])


def image(name, pixels, color=True):
    h, w = pixels.shape[:2]
    im = bpy.data.images.new(name, width=w, height=h, alpha=True)
    im.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    im.pixels.foreach_set(pixels.astype(np.float32).reshape(-1))
    im.pack()
    return im


def surface(name, color, rough=.78, metallic=0, fabric=False, skin=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metallic
    if fabric or skin:
        n = 256
        rng = np.random.default_rng(sum(map(ord, name)))
        yy, xx = np.mgrid[:n, :n]
        grain = rng.normal(0, .022 if fabric else .012, (n, n))
        weave = (np.sin(xx * math.pi) + np.sin(yy * math.pi)) * .008
        if fabric:
            weave = ((xx % 4 < 2) * 2 - 1) * .025 + ((yy % 4 < 2) * 2 - 1) * .018
            grain += weave
        px = np.ones((n, n, 4), dtype=np.float32)
        for k in range(3):
            px[:, :, k] = np.clip(color[k] + grain, 0, 1)
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = image(name + '_albedo', px)
        mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        # Tangent-space thread relief survives the GLB export.
        normal = np.ones_like(px)
        normal[:, :, 0] = .5 + np.sin(xx * math.pi / 2) * (.10 if fabric else .025)
        normal[:, :, 1] = .5 + np.sin(yy * math.pi / 2) * (.10 if fabric else .025)
        normal[:, :, 2] = 1.0
        nt = mat.node_tree.nodes.new('ShaderNodeTexImage')
        nt.image = image(name + '_normal', normal, False)
        nm = mat.node_tree.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = .45
        mat.node_tree.links.new(nt.outputs['Color'], nm.inputs['Color'])
        mat.node_tree.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def empty(name, location=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ob)
    ob.location = xyz(location)
    ob.parent = parent
    return ob


def mesh(name, verts, faces, mat, parent):
    me = bpy.data.meshes.new(name)
    me.from_pydata([xyz(p) for p in verts], [], faces)
    me.materials.append(mat)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(me)
    bm.free()
    # Project each face to its dominant plane for consistent woven texture scale.
    uv = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        normal = poly.normal
        ax = max(range(3), key=lambda i: abs(normal[i]))
        axes = ((1, 2), (0, 2), (0, 1))[ax]
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co[axes[0]] * 3, co[axes[1]] * 3)
        poly.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.parent = parent
    return ob


def loft(name, rings, mat, parent, segments=20):
    """rings: (height, radiusX, radiusZ, centerX, centerZ)."""
    verts = []
    for y, rx, rz, cx, cz in rings:
        for i in range(segments):
            a = 2 * math.pi * i / segments
            verts.append((cx + rx * math.cos(a), y, cz + rz * math.sin(a)))
    faces = [tuple(range(segments - 1, -1, -1))]
    for r in range(len(rings) - 1):
        for i in range(segments):
            j = (i + 1) % segments
            faces.append((r * segments + i, r * segments + j, (r + 1) * segments + j, (r + 1) * segments + i))
    faces.append(tuple((len(rings) - 1) * segments + i for i in range(segments)))
    return mesh(name, verts, faces, mat, parent)


def orb(name, pos, size, mat, parent, seg=20, rings=12):
    verts = []
    for r in range(rings + 1):
        a = math.pi * r / rings
        for i in range(seg):
            b = 2 * math.pi * i / seg
            verts.append((pos[0] + size[0] * math.sin(a) * math.cos(b),
                          pos[1] + size[1] * math.cos(a),
                          pos[2] + size[2] * math.sin(a) * math.sin(b)))
    faces = []
    for r in range(rings):
        for i in range(seg):
            j = (i + 1) % seg
            faces.append((r * seg + i, r * seg + j, (r + 1) * seg + j, (r + 1) * seg + i))
    return mesh(name, verts, faces, mat, parent)


def box(name, pos, size, mat, parent, bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1)
    ob = bpy.context.object
    ob.name = name
    ob.parent = parent
    ob.location = xyz(pos)
    ob.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    if bevel:
        mod = ob.modifiers.new('Soft manufactured edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for face in ob.data.polygons:
        face.use_smooth = True
    mod = ob.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob


def line(name, points, radius, mat, parent):
    """Stitching, straps and cable runs with an explicitly tessellated profile."""
    verts, faces = [], []
    sides = 6
    for i, p in enumerate(points):
        tangent = Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(0, i - 1)])
        tangent.normalize()
        a = tangent.cross(Vector((0, 0, 1)))
        if a.length < .01:
            a = tangent.cross(Vector((1, 0, 0)))
        a.normalize()
        b = tangent.cross(a).normalized()
        for k in range(sides):
            ang = 2 * math.pi * k / sides
            q = Vector(p) + radius * (math.cos(ang) * a + math.sin(ang) * b)
            verts.append(tuple(q))
    for i in range(len(points) - 1):
        for k in range(sides):
            j = (k + 1) % sides
            faces.append((i * sides + k, i * sides + j, (i + 1) * sides + j, (i + 1) * sides + k))
    return mesh(name, verts, faces, mat, parent)


def patch(name, text, pos, width, height, base, ink, parent):
    box(name, pos, (width, height, .012), base, parent, .004)
    curve = bpy.data.curves.new(name + '_letters', type='FONT')
    curve.body = text
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.size = height * .64
    curve.extrude = .0008
    ob = bpy.data.objects.new(name + '_letters', curve)
    bpy.context.collection.objects.link(ob)
    ob.parent = parent
    ob.location = xyz((pos[0], pos[1], pos[2] - .008))
    # Blender text lives in XY. Rotate it to face game -Z (Blender +Y).
    ob.rotation_euler = (-math.pi / 2, 0, 0)
    ob.data.materials.append(ink)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    ob.select_set(False)


def join_parts(root):
    """One mesh per pivot/material: shared draw calls without breaking articulation."""
    pivots = list(root.children)
    for pivot in pivots:
        pieces = [o for o in list(pivot.children) if o.type == 'MESH']
        groups = {}
        for ob in pieces:
            key = ob.data.materials[0].name
            groups.setdefault(key, []).append(ob)
        for mat_name, obs in groups.items():
            bpy.ops.object.select_all(action='DESELECT')
            for ob in obs:
                ob.select_set(True)
            bpy.context.view_layer.objects.active = obs[0]
            bpy.ops.object.join()
            ob = bpy.context.object
            ob.name = pivot.name + '_' + mat_name
            # Guarantee all transforms are baked except required animation pivots.
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.select_all(action='DESELECT')


def build(team):
    ct = team == 'ct'
    root = empty('operator_' + team)
    cloth = surface('ct_navy_ripstop' if ct else 't_sand_canvas', (.14, .19, .23) if ct else (.50, .43, .31), fabric=True)
    pants = surface('ct_navy_trousers' if ct else 't_charcoal_denim', (.10, .14, .17) if ct else (.20, .22, .23), fabric=True)
    vest = surface('ct_olive_carrier' if ct else 't_umber_carrier', (.22, .25, .20) if ct else (.26, .22, .17), fabric=True)
    webbing = surface('ct_molle' if ct else 't_molle', (.13, .16, .13) if ct else (.20, .16, .12), fabric=True)
    leather = surface('black_leather_' + team, (.055, .065, .061), .66, fabric=True)
    rubber = surface('rubber_' + team, (.022, .028, .029), .92)
    metal = surface('gunmetal_' + team, (.19, .21, .21), .33, .78)
    stitch = surface('edge_thread_' + team, (.34, .37, .30) if ct else (.48, .43, .32), .85)
    skin = surface('skin_' + team, (.56, .37, .24), .62, skin=True)
    scarf = surface('ct_balaclava' if ct else 't_woven_scarf', (.055, .075, .072) if ct else (.36, .33, .26), fabric=True)
    glass = surface('smoked_optics_' + team, (.09, .17, .18), .12, .45)
    iris = surface('iris_' + team, (.10, .075, .048), .36)

    piv = {name: empty(name, pos, root) for name, pos in {
        'torso': (0, 1.18, 0), 'head': (0, 1.72, 0),
        'legL': (-.18, .86, 0), 'legR': (.18, .86, 0),
        'armL': (-.44, 1.46, 0), 'armR': (.44, 1.46, 0)
    }.items()}
    t = piv['torso']
    loft('Tailored uniform torso', [(-.34,.26,.15,0,.015),(-.28,.27,.16,0,0),(-.1,.285,.17,0,0),(.13,.32,.18,0,0),(.25,.35,.155,0,0),(.30,.30,.14,0,0),(.33,.16,.12,0,0)], cloth,t,28)
    loft('Neck',[(.29,.085,.08,0,0),(.43,.082,.077,0,0)],skin,t)
    # Anatomically shaped chest/back plates, not block torsos.
    loft('Armored plate carrier',[(-.21,.27,.19,0,-.004),(-.13,.29,.205,0,-.006),(.12,.29,.21,0,-.005),(.23,.25,.195,0,-.005),(.27,.19,.17,0,0)],vest,t,28)
    # Shoulder straps follow the chest in three dimensions.
    for x in (-.20,.20):
        line('Shoulder strap',[(x,.12,-.21),(x,.26,-.16),(x,.30,-.03),(x,.27,.15),(x,.12,.20)],.025,webbing,t)
        box('Buckle',(x,.19,-.208),(.07,.05,.024),metal,t,.006)
    for y in (-.12,-.065,-.01,.045):
        for x in (-.20,-.10,0,.10,.20):
            box('MOLLE weave',(x,y,-.217),(.083,.015,.012),webbing,t,.003)
    for x in (-.185,-.06,.065):
        box('Rifle magazine pouch',(x,-.10,-.251),(.105,.20,.085),vest,t,.016)
        box('Pouch flap',(x,-.012,-.292),(.107,.045,.018),webbing,t,.006)
        box('Pouch pull tab',(x,-.045,-.305),(.026,.04,.012),stitch,t,.003)
        line('Pouch stitching',[(x-.043,-.18,-.296),(x-.043,-.02,-.296),(x+.043,-.02,-.296),(x+.043,-.18,-.296)],.0015,stitch,t)
    box('Radio',( .24,.055,-.24),(.09,.18,.065),rubber,t,.011)
    line('Radio aerial',[(.25,.13,-.24),(.25,.32,-.24)],.006,rubber,t)
    line('Comms cord',[(.24,.11,-.24),(.27,.19,-.21),(.22,.28,-.14),(.12,.34,-.12)],.004,rubber,t)
    for x in (-.29,.29):
        box('Side utility pouch',(x,-.12,.01),(.08,.17,.16),vest,t,.012)
    loft('Utility belt',[(-.285,.279,.172,0,0),(-.235,.282,.175,0,0)],webbing,t,28)
    box('Belt buckle',(0,-.26,-.181),(.085,.044,.025),metal,t,.005)
    box('Back hydration pouch',(0,.045,.215),(.29,.36,.085),vest,t,.025)
    line('Back pack seam',[(-.12,-.11,.263),(-.12,.21,.263),(.12,.21,.263),(.12,-.11,.263)],.002,stitch,t)
    patch('Identification','CT' if ct else '01',(0,.172,-.219),.15,.06,webbing,stitch,t)

    for side in ('L','R'):
        a = piv['arm'+side]
        # Elliptical shoulder to forearm with fabric breaks around elbow.
        loft('Uniform sleeve',[(.015,.10,.105,0,0),(-.06,.115,.11,0,0),(-.20,.103,.102,0,-.006),(-.27,.095,.097,0,-.015),(-.31,.10,.10,0,-.01),(-.40,.081,.088,0,-.018),(-.47,.067,.074,0,-.022)],cloth,a,24)
        for y in (-.12,-.22,-.33,-.40):
            loft('Sleeve fabric fold',[(y+.012,.104 if y>-.3 else .085,.105 if y>-.3 else .090,0,-.013),(y,.108 if y>-.3 else .089,.108 if y>-.3 else .094,0,-.013),(y-.01,.100 if y>-.3 else .083,.100 if y>-.3 else .088,0,-.013)],cloth,a,20)
        box('Elbow reinforcement',(0,-.29,.073),(.145,.13,.05),vest,a,.025)
        loft('Cuff',[(-.455,.075,.077,0,-.022),(-.49,.073,.076,0,-.022)],webbing,a,20)
        orb('Gloved palm',(0,-.54,-.029),(.076,.087,.065),leather,a)
        box('Knuckle guard',(0,-.523,-.087),(.125,.038,.024),rubber,a,.01)
        for k in range(4):
            x = (k-1.5)*.029
            orb('Glove fingers',(x,-.588,-.046),(.017,.045,.033),leather,a,12,8)
            orb('Knuckle cap',(x,-.526,-.095),(.014,.015,.009),vest,a,12,6)
        orb('Thumb',(-.063 if side=='L' else .063,-.553,-.07),(.027,.042,.031),leather,a,12,8)
        box('Sleeve pocket',(-.085 if side=='L' else .085,-.13,-.012),(.038,.115,.12),vest,a,.01)

        l=piv['leg'+side]
        loft('Tailored trousers',[(0,.137,.15,0,.01),(-.11,.145,.15,0,.005),(-.25,.133,.14,0,-.005),(-.36,.12,.13,0,-.015),(-.40,.115,.12,0,-.02),(-.47,.112,.115,0,-.015),(-.61,.092,.095,0,.005),(-.70,.084,.085,0,.01)],pants,l,24)
        for y in (-.23,-.33,-.53,-.60):
            rad=.13 if y>-.4 else .10
            loft('Trouser crease',[(y+.01,rad,rad,0,0),(y,rad+.008,rad+.006,0,0),(y-.014,rad-.006,rad-.005,0,0)],pants,l,20)
        box('Cargo pocket',(-.123 if side=='L' else .123,-.20,.005),(.055,.17,.17),pants,l,.018)
        box('Cargo flap',(-.15 if side=='L' else .15,-.14,.005),(.015,.055,.17),webbing,l,.006)
        # Hard shell follows shin front, with seam and two elastic straps.
        orb('Knee pad',(0,-.395,-.123),(.102,.118,.037),rubber,l,20,10)
        box('Knee pad center',(0,-.395,-.154),(.125,.12,.014),vest,l,.022)
        for y in (-.32,-.47):
            loft('Knee strap',[(y-.012,.119,.124,0,-.013),(y+.012,.119,.124,0,-.013)],webbing,l,20)
        loft('Boot shaft',[(-.60,.089,.095,0,.01),(-.68,.092,.10,0,0),(-.78,.105,.15,0,-.03),(-.825,.108,.17,0,-.055)],leather,l,24)
        orb('Boot toe',(0,-.778,-.139),(.108,.065,.108),leather,l,24,10)
        box('Rubber tread sole',(0,-.824,-.052),(.225,.044,.37),rubber,l,.017)
        for z in (-.19,-.13,-.07,-.01,.05):
            box('Sole tread',(0,-.84,z),(.23,.017,.018),rubber,l,.003)
        for y in (-.65,-.68,-.71,-.74):
            line('Boot laces',[(-.045,y,-.097),(0,y-.018,-.116),(.045,y,-.097)],.003,stitch,l)
        line('Trouser outside seam',[(-.12 if side=='L' else .12,-.05,.025),(-.13 if side=='L' else .13,-.24,.02),(-.10 if side=='L' else .10,-.56,.02)],.002,stitch,l)

    h=piv['head']
    # Skull shape, jaw and nose retain a recognizable human profile.
    loft('Human head',[(-.15,.066,.064,0,.009),(-.115,.094,.084,0,-.004),(-.055,.108,.097,0,0),(.015,.112,.107,0,.002),(.085,.106,.095,0,.012),(.13,.074,.07,0,.015),(.145,.025,.03,0,.015)],scarf if ct else skin,h,28)
    for x in (-.111,.111):
        orb('Ear',(x,-.015,.005),(.022,.041,.017),skin,h,16,10)
    orb('Nose bridge',(0,-.015,-.103),(.023,.045,.035),skin,h,16,10)
    orb('Nose tip',(0,-.042,-.127),(.026,.019,.023),skin,h,16,10)
    for x in (-.044,.044):
        orb('Eye socket',(x,.013,-.096),(.032,.017,.016),skin,h,16,8)
        orb('Eye',(x,.013,-.110),(.020,.009,.008),stitch,h,12,6)
        orb('Iris',(x,.013,-.117),(.007,.007,.0025),iris,h,12,6)
        line('Eyebrow',[(x-.025,.033,-.109),(x,.039,-.114),(x+.025,.032,-.109)],.004,scarf,h)
    if ct:
        loft('Ballistic helmet',[(-.005,.124,.118,0,.008),(.045,.137,.128,0,.011),(.10,.12,.114,0,.015),(.15,.075,.076,0,.015),(.164,.012,.018,0,.015)],vest,h,32)
        loft('Helmet rim',[(-.013,.128,.123,0,.008),(.005,.132,.125,0,.008)],rubber,h,32)
        box('Helmet mount',(0,.083,-.111),(.052,.063,.024),metal,h,.006)
        for x in (-.103,.103):
            line('Helmet straps',[(x,.005,-.01),(x*.82,-.09,-.046),(0,-.14,-.06)],.012,webbing,h)
        # Separate goggles, gasket, dual lenses and bridge.
        for x in (-.048,.048):
            box('Goggle gasket',(x,.020,-.115),(.086,.058,.032),rubber,h,.016)
            box('Optical lens',(x,.023,-.134),(.071,.041,.009),glass,h,.012)
        box('Goggle bridge',(0,.02,-.139),(.025,.018,.014),rubber,h,.005)
        line('Goggle strap',[(-.096,.02,-.115),(-.128,.02,.01),(-.09,.02,.102),(0,.02,.124),(.09,.02,.102),(.128,.02,.01),(.096,.02,-.115)],.012,webbing,h)
        orb('Comms earpiece',(-.129,-.025,.015),(.020,.046,.044),rubber,h,16,10)
        line('Microphone boom',[(-.14,-.04,.002),(-.13,-.09,-.07),(-.05,-.095,-.12)],.006,metal,h)
        orb('Mic',(-.049,-.095,-.124),(.022,.013,.013),rubber,h,12,8)
    else:
        # Close-cropped hair cap, ear details and a wrapped neck scarf.
        loft('Cropped hair',[(.07,.107,.100,0,.012),(.12,.085,.082,0,.015),(.148,.028,.038,0,.015)],scarf,h,28)
        line('Mouth',[(-.030,-.089,-.084),(0,-.093,-.093),(.030,-.089,-.084)],.003,iris,h)
        loft('Scarf wrap',[(-.205,.105,.095,0,.025),(-.172,.139,.125,0,.012),(-.14,.13,.115,0,.005),(-.12,.115,.11,0,.008)],scarf,h,28)
        for y in (-.193,-.169,-.147):
            line('Scarf woven fold',[(-.12,y,-.03),(-.09,y-.008,-.10),(0,y+.008,-.12),(.09,y-.006,-.10),(.12,y,-.03)],.004,stitch,h)
        # Small cloth tails remain attached to torso, avoiding unnatural rigid neck length.
        box('Scarf tail',(.08,.27,-.205),(.10,.19,.028),scarf,t,.013)
        for x in (.045,.07,.095,.12):
            line('Scarf fringe',[(x,.18,-.22),(x,.16,-.221)],.002,stitch,t)
    join_parts(root)
    return root


def descendants(root):
    return [root] + list(root.children_recursive)


def export(root, path):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in descendants(root):
        ob.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_yup=True, export_apply=True, export_animations=False,
                              export_cameras=False, export_lights=False, export_extras=True)
    triangles = sum(len(o.data.loop_triangles) for o in descendants(root) if o.type=='MESH')
    for o in descendants(root):
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
    return {'file': path.name, 'triangles': sum(len(o.data.loop_triangles) for o in descendants(root) if o.type=='MESH'),
            'meshes': sum(o.type=='MESH' for o in descendants(root)), 'bytes': path.stat().st_size,
            'pivots': ['torso','head','legL','legR','armL','armR']}


def preview(source):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.world.color = (.15,.15,.15)
    floor_mat = surface('Studio floor',(.105,.12,.13),.9)
    box('Studio platform',(1.0,-.03,0),(5,.06,4),floor_mat,None,.01)
    for name, pos, energy, size, color in [('Key',(0.4,4,-3),600,4,(1,.86,.72)),('Fill',(-3,2,-1),450,3,(.67,.80,1)),('Rim',(2,3,2),700,3,(1,.91,.8))]:
        data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size; data.color=color
        ob=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(ob); ob.location=xyz(pos)
        direction=Vector(xyz((1,1,0)))-ob.location; ob.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Preview camera'); cam=bpy.data.objects.new('Preview camera',data); bpy.context.collection.objects.link(cam)
    cam.location=xyz((3.7,2.3,-4.7)); direction=Vector(xyz((1.0,.95,0)))-cam.location; cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO'; data.ortho_scale=3.65
    scene.camera=cam; scene.render.resolution_x=1400; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(source/'operators-preview.png')
    bpy.ops.render.render(write_still=True)


def main():
    args=cli(); args.output=args.output.resolve(); args.source=args.source.resolve()
    args.output.mkdir(parents=True,exist_ok=True); args.source.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    results=[]; roots=[]
    for team in ('ct','t'):
        # Blender may suffix duplicate node names. Export each actor in an isolated scene,
        # then restore exact names on the next actor before exporting it.
        root=build(team)
        for p in root.children:
            for n in ('torso','head','legL','legR','armL','armR'):
                if p.name==n or p.name.startswith(n+'.'):
                    old=bpy.data.objects.get(n)
                    if old is not None and old!=p: old.name='source_'+team+'_'+n
                    p.name=n
        results.append(export(root,args.output/('operator-'+team+'.glb')))
        roots.append(root)
    roots[1].location.x=1.8
    # Editor source preserves both generated characters and their PBR texture pixels.
    bpy.ops.wm.save_as_mainfile(filepath=str((args.source/'operators.blend').resolve()))
    manifest={'generator':'tools/blender/build_characters.py','blender':bpy.app.version_string,
              'license':'Original project artwork; no third-party assets', 'coordinateSystem':'glTF Y-up, front -Z', 'assets':results}
    (args.output/'operators-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    if args.preview: preview(args.source)
    print('OPERATOR_EXPORT '+json.dumps(manifest))


if __name__=='__main__': main()
