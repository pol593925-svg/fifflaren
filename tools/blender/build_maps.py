"""Build the original Support Hub tactical map artwork with Blender 4.5 LTS.

Run: blender --background --python tools/blender/build_maps.py -- --sources DIR
Original geometry with CC0 Poly Haven surface scans. Layouts are read from cs16.js; game coordinates are
(x, height, z), represented in Blender as (x, -z, height). Static meshes are
batched by material and quadrant, with embedded PBR textures in the GLB files.
"""
import argparse
import hashlib
import json
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
CELL, SIZE = 4.0, 126
FLOORS = {'4': -3.2, '7': -2.4, '5': -1.6, '6': -.8}
TUN_CEIL, VENT_CEIL, BRIDGE_H, TOWER_H = -1.3, 1.35, 2.3, 4.2
OUT = ROOT / 'models' / 'csgo'
MATS, BATCHES, TEX_IMAGES = {}, {}, []
RNG = np.random.default_rng(254901)
PALETTE = {}


def read_layouts():
    source = (ROOT / 'cs16.js').read_text(encoding='utf-8')
    block = source.split('const MAP_ROWS = {', 1)[1].split('const MAP_META', 1)[0]
    result = {}
    for name in ('dust2', 'inferno'):
        match = re.search(r'\b' + name + r':\s*\[(.*?)\]', block, re.S)
        rows = re.findall(r'"([#.DC4567VBST]+)"', match.group(1))
        assert len(rows) == SIZE and all(len(r) >= SIZE for r in rows), name
        # The live game explicitly reads only the first 42 columns.
        result[name] = [r[:SIZE] for r in rows]
    return result


def smooth_noise(size, cells, rng):
    data = rng.random((cells, cells), dtype=np.float32)
    q = np.arange(size, dtype=np.float32) * cells / size
    lo = q.astype(np.int32)
    t = q - lo
    t = t * t * (3 - 2 * t)
    a = data[lo[:, None] % cells, lo[None, :] % cells]
    b = data[lo[:, None] % cells, (lo[None, :] + 1) % cells]
    c = data[(lo[:, None] + 1) % cells, lo[None, :] % cells]
    d = data[(lo[:, None] + 1) % cells, (lo[None, :] + 1) % cells]
    return (a * (1-t[None, :]) + b * t[None, :]) * (1-t[:, None]) + (c * (1-t[None, :]) + d * t[None, :]) * t[:, None]


def image_from_array(name, rgb, noncolor=False):
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, width=w, height=h, alpha=False)
    img.colorspace_settings.name = 'Non-Color' if noncolor else 'sRGB'
    if rgb.ndim == 2:
        rgb = np.repeat(rgb[:, :, None], 3, axis=2)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(rgb, 0, 1)
    img.pixels.foreach_set(rgba.ravel())
    img.update()
    img.pack()
    TEX_IMAGES.append(img)
    return img


def material(name, base, kind='plaster', rough=.9, metallic=0, tex=True, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    p = nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*base, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metallic
    if emission:
        p.inputs['Emission Color'].default_value = (*emission, 1)
        p.inputs['Emission Strength'].default_value = 2.5
    if not tex:
        MATS[name] = mat
        return name
    size = 512
    seed = int(hashlib.sha256(name.encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    coarse = smooth_noise(size, 5, rng)
    medium = smooth_noise(size, 31, rng)
    fine = rng.random((size, size), dtype=np.float32)
    yy, xx = np.mgrid[:size, :size].astype(np.float32) / size
    tone = .83 + coarse * .22 + (medium-.5)*.13 + (fine-.5)*.065
    height = medium*.15 + fine*.035
    color = np.array(base)[None, None, :] * tone[:, :, None]
    if kind in ('stone', 'cobble'):
        rows, cols = (6, 4) if kind == 'stone' else (10, 9)
        sy = yy*rows
        sx = xx*cols + (np.floor(sy) % 2)*.5
        fx, fy = sx % 1, sy % 1
        dx, dy = np.minimum(fx, 1-fx), np.minimum(fy, 1-fy)
        edge = np.minimum(dx*1.3, dy)
        grout = np.clip(edge/.045, 0, 1)
        grout = grout*grout*(3-2*grout)
        tile = rng.uniform(.86, 1.12, (rows, cols+1))
        tint = tile[np.floor(sy).astype(int)%rows, np.floor(sx).astype(int)%(cols+1)]
        color *= tint[:, :, None]
        color *= (.55+.45*grout)[:, :, None]
        height = .65*grout + medium*.035 + fine*.025
        # Soft edge erosion and sparse porosity.
        color *= (1 - (fine>.985)*.12)[:, :, None]
    elif kind == 'wood':
        boards = (xx*7) % 1
        seam = np.clip(np.minimum(boards, 1-boards)/.024, 0, 1)
        grain = np.sin(xx*550 + medium*13 + np.sin(yy*9)*2)*.035
        color *= (.72 + coarse*.28 + grain)[:, :, None]
        color *= (.45 + seam*.55)[:, :, None]
        height = seam*.3 + grain*.5 + medium*.04
    elif kind == 'metal':
        scratches = rng.random(size)[None, :] > .976
        color *= (1 - scratches*.14)[:, :, None]
        height = fine*.018 + scratches*.015
    elif kind == 'sand':
        ripple = np.sin(yy*220 + coarse*6 + xx*8)*.018
        height = medium*.12+fine*.055+ripple
        color *= (1 + ripple)[:, :, None]
    else:
        # Streaked, aged lime plaster, not checkerboard blocks.
        stain = np.clip((coarse-.55)*2, 0, .45)
        color *= (1-stain*.18)[:, :, None]
        exposed = np.clip((medium-.67)*5, 0, 1)
        color *= (1-exposed*.08)[:, :, None]
        height = medium*.06 + fine*.035 + exposed*.08
    normal = np.empty((size, size, 3), dtype=np.float32)
    strength = 5 if kind in ('stone', 'cobble') else 2.8
    normal[:, :, 0] = (np.roll(height, 1, 1)-np.roll(height, -1, 1))*strength
    normal[:, :, 1] = (np.roll(height, 1, 0)-np.roll(height, -1, 0))*strength
    normal[:, :, 2] = 1
    normal /= np.linalg.norm(normal, axis=2)[:, :, None]
    color_img = image_from_array(name+'_albedo', color)
    normal_img = image_from_array(name+'_normal', normal*.5+.5, True)
    rough_img = image_from_array(name+'_roughness', np.clip(rough+(coarse-.5)*.12, .2, 1), True)
    for idx, (image, dest) in enumerate(((color_img,'Base Color'), (rough_img,'Roughness'))):
        tx = nodes.new('ShaderNodeTexImage'); tx.image=image
        tx.location=(-600, idx*-230)
        links.new(tx.outputs['Color'], p.inputs[dest])
    nt = nodes.new('ShaderNodeTexImage'); nt.image=normal_img; nt.location=(-600,-470)
    nm = nodes.new('ShaderNodeNormalMap'); nm.location=(-300,-470)
    links.new(nt.outputs['Color'], nm.inputs['Color']); links.new(nm.outputs['Normal'], p.inputs['Normal'])
    MATS[name] = mat
    return name


def create_materials(theme):
    MATS.clear(); TEX_IMAGES.clear()
    if theme == 'dust2':
        plaster = (.69,.60,.46); ground=(.55,.48,.35); stone=(.59,.52,.41)
        tint=(.58,.50,.38); shutter=(.12,.26,.29)
    else:
        plaster = (.68,.43,.26); ground=(.43,.43,.39); stone=(.59,.54,.44)
        tint=(.76,.65,.46); shutter=(.19,.27,.20)
    material('plaster', plaster)
    material('plaster_light', tint)
    material('plaster_blue', (.26,.39,.46))
    material('limestone', stone, 'stone')
    material('ground', ground, 'sand' if theme=='dust2' else 'cobble')
    material('wood', (.36,.22,.105), 'wood', .87)
    material('shutter', shutter, 'wood', .74)
    material('steel', (.19,.21,.205), 'metal', .52, .65)
    material('duct', (.34,.38,.40), 'metal', .57, .45)
    material('tunnel', (.34,.31,.25), 'stone', .96)
    material('roof', (.40,.19,.105), 'stone', .92)
    material('window_glass', (.075,.14,.16), tex=False, rough=.22, metallic=.35)
    material('dark', (.035,.045,.046), tex=False, rough=.75)
    material('trim', (.64,.61,.51), tex=False, rough=.82)
    material('paint', (.58,.22,.095), tex=False, rough=.9)
    material('lamp_warm', (.8,.46,.12), tex=False, emission=(1,.57,.19))
    material('lamp_green', (.12,.38,.22), tex=False, emission=(.15,.85,.40))

    # Photographic albedo, tangent-space normal and roughness maps, embedded
    # into the Blender/GLB deliverables. No network access occurs in the game.
    scans={'plaster':'plastered_stone_wall','plaster_light':'plastered_wall_02',
           'limestone':'sandstone_blocks_04','ground':'cobblestone_floor_02',
           'wood':'weathered_brown_planks','tunnel':'sandstone_blocks_04'}
    for name,asset in scans.items():
        mat=MATS[name];nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
        for channel in ('Diffuse','nor_gl','Rough'):
            source=OUT/'textures'/(asset+'_'+channel+'.jpg')
            if not source.exists():raise FileNotFoundError('Run tools/blender/download_textures.ps1 first: '+str(source))
            img=bpy.data.images.load(str(source),check_existing=True)
            img.colorspace_settings.name='sRGB' if channel=='Diffuse' else 'Non-Color'
            img.pack();TEX_IMAGES.append(img)
            node=nodes.new('ShaderNodeTexImage');node.image=img
            if channel=='Diffuse':
                if name=='plaster':
                    # Calibrate the dark scan to sun-bleached paint / dusty earth,
                    # retaining the scan's real surface variation in linear space.
                    pixels=np.empty(len(img.pixels),dtype=np.float32);img.pixels.foreach_get(pixels)
                    pixels=pixels.reshape((-1,4))
                    luma=pixels[:,:3].mean(axis=1)
                    variation=np.clip(.58+.42*luma/max(float(luma.mean()),.001),.78,1.20)
                    color=([.78,.70,.56] if theme=='dust2' else [.74,.54,.39]) if name=='plaster' else [.62,.55,.40]
                    pixels[:,:3]=np.clip(variation[:,None]*np.array(color),0,1)
                    painted=bpy.data.images.new(theme+'_'+name+'_scan',width=img.size[0],height=img.size[1],alpha=False)
                    painted.pixels.foreach_set(pixels.ravel());painted.pack();node.image=painted;TEX_IMAGES.append(painted)
                links.new(node.outputs['Color'],p.inputs['Base Color'])
            elif channel=='Rough':links.new(node.outputs['Color'],p.inputs['Roughness'])
            else:
                nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.7
                links.new(node.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],p.inputs['Normal'])


class Batch:
    def __init__(self):
        self.vertices=[]; self.faces=[]; self.uvs=[]; self.colors=[]

    def face(self, vertices, uv=None, tint=1):
        start=len(self.vertices)
        self.vertices.extend((x,-z,h) for x,h,z in vertices)
        self.faces.append(tuple(range(start,start+len(vertices))))
        if uv is None:
            v0,v1,v2=map(Vector,vertices[:3]); n=(v1-v0).cross(v2-v0)
            axis=max(range(3),key=lambda i:abs(n[i]))
            uv=[((v[2] if axis==0 else v[0])/4, (v[2] if axis==1 else v[1])/4) for v in vertices]
        self.uvs.extend(uv)
        self.colors.extend([(tint,tint,tint,1)]*len(vertices))


def bucket(mat,x,z,backdrop=False):
    qx=0 if x<252 else 1; qz=0 if z<252 else 1
    key=(mat, 'backdrop' if backdrop else f'{qx}_{qz}')
    if key not in BATCHES: BATCHES[key]=Batch()
    return BATCHES[key]


def face(mat, verts, uv=None, tint=1, backdrop=False):
    cx=sum(v[0] for v in verts)/len(verts); cz=sum(v[2] for v in verts)/len(verts)
    bucket(mat,cx,cz,backdrop).face(verts,uv,tint)


def box(mat,x,h,z,w,hh,d,tint=1,backdrop=False):
    x0,x1=x-w/2,x+w/2; h0,h1=h-hh/2,h+hh/2; z0,z1=z-d/2,z+d/2
    for vs in (
        [(x0,h0,z1),(x1,h0,z1),(x1,h1,z1),(x0,h1,z1)],
        [(x1,h0,z0),(x0,h0,z0),(x0,h1,z0),(x1,h1,z0)],
        [(x1,h0,z1),(x1,h0,z0),(x1,h1,z0),(x1,h1,z1)],
        [(x0,h0,z0),(x0,h0,z1),(x0,h1,z1),(x0,h1,z0)],
        [(x0,h1,z1),(x1,h1,z1),(x1,h1,z0),(x0,h1,z0)],
        [(x0,h0,z0),(x1,h0,z0),(x1,h0,z1),(x0,h0,z1)],
    ): face(mat,vs,tint=tint,backdrop=backdrop)


def cylinder(mat,x,h,z,r,length,segments=10,backdrop=False):
    for i in range(segments):
        a,b=i*math.tau/segments,(i+1)*math.tau/segments
        xa,za=x+math.cos(a)*r,z+math.sin(a)*r
        xb,zb=x+math.cos(b)*r,z+math.sin(b)*r
        face(mat,[(xa,h-length/2,za),(xb,h-length/2,zb),(xb,h+length/2,zb),(xa,h+length/2,za)],backdrop=backdrop)
        face(mat,[(x,h+length/2,z),(xa,h+length/2,za),(xb,h+length/2,zb)],backdrop=backdrop)


def wall_details(x,z,dx,dz,variant,theme):
    # Every detail lies at or behind the existing wall plane; silhouettes of
    # playable cover and all walking/ballistic collision remain unchanged.
    px,pz=x*CELL+2+dx*2,z*CELL+2+dz*2
    layer=0
    def panel(mat,along,y,w,hh,depth=.022,solid=True):
        # Ordered facade layers sit just in front of the structural surface.
        # Putting them inside the opaque wall hides every shutter and trim.
        nonlocal layer
        layer+=1
        front=.045+layer*.004
        def point(a,b,d):return (px-dz*a+dx*d,b,pz+dx*a+dz*d)
        # Back faces sit inside the structural wall. Thin plates/louvers need
        # only the visible face; keep real edges on sills, frames and cornices.
        rim=[(along-w/2,y-hh/2),(along+w/2,y-hh/2),(along+w/2,y+hh/2),(along-w/2,y+hh/2)]
        rim.reverse()  # tangent x up points inward; glTF uses outward CCW faces
        face(mat,[point(a,b,front) for a,b in rim])
        if solid and depth>=.065:
            for i in range(4):
                a,b=rim[i];c,d=rim[(i+1)%4]
                face(mat,[point(c,d,front),point(a,b,front),point(a,b,front-depth),point(c,d,front-depth)])
    panel('limestone',0,.46,4,.92,.07)
    # The grid's solid cover ends at 4m. No disconnected decorative upper floor.
    # Continuous cornice/coping closes every exposed side at the same height.
    panel('trim',0,3.73,4,.11,.13)
    panel('limestone',0,3.88,4,.16,.19)
    panel('roof' if theme=='inferno' else 'trim',0,3.975,4,.05,.22)
    # Corbels break up the long facade and cast shallow, readable shadows.
    for along in (-1.50,1.50):
        panel('trim',along,3.58,.19,.25,.15)
    # Low weathered dado, with a thin stone string course instead of raw cubes.
    panel('trim',0,.90,4,.065,.09)
    panel('limestone',0,.045,3.95,.09,.30)
    panel('trim',0,3.86,4,.16,.06)
    panel('limestone',-1.85,2.15,.22,3.3,.07)
    if variant%4 in (0,1):
        # Shuttered openings: separate sill, inset panes, timber boards, hinges.
        panel('trim',0,2.25,1.64,1.85,.10)
        panel('dark',0,2.25,1.40,1.62,.06)
        panel('window_glass',0,2.26,1.24,1.46,.015)
        panel('wood',0,2.26,.055,1.49,.035)
        panel('wood',0,2.18,1.28,.055,.035)
        # Pair of inset wooden shutters, with directional grain and real louvers.
        for side in (-1,1):
            panel('shutter',side*.87,2.25,.32,1.65,.09)
            for k in range(10):panel('shutter',side*.87,1.53+k*.15,.31,.055,.11,False)
            for y in (1.60,2.88):panel('steel',side*.87,y,.24,.045,.018)
        panel('trim',0,1.30,1.88,.13,.24)
        panel('trim',0,3.17,1.92,.12,.18)
    elif variant%4==2:
        # Flush service door with recessed panels, lintel and metal handle.
        panel('trim',-.15,1.40,1.60,2.80,.11)
        panel('dark',-.15,1.36,1.37,2.67,.04)
        panel('wood',-.15,1.32,1.24,2.56,.07)
        for yy in (.50,1.26,2.06):
            panel('shutter',-.15,yy,.97,.56,.018)
            panel('wood',-.15,yy,.82,.43,.025)
        panel('steel',.29,1.28,.055,.22,.035)
        panel('steel',.34,1.34,.17,.035,.055)
        panel('trim',-.15,.045,1.66,.09,.20)
    else:
        # Exposed masonry patches and a junction box.
        panel('limestone',.25,1.00,2.9,.9,.02)
        panel('steel',-.9,2.1,.42,.64,.018)
        for yy in (1.89,2.04,2.19): panel('dark',-.9,yy,.28,.018,.001)
    # Pipes and wall-mounted lanterns, within the wall's existing solid volume.
    panel('steel',1.55,1.95,.065,3.65,.025)
    if variant%3==0:
        panel('steel',1.1,2.85,.34,.44,.035)
        panel('lamp_warm',1.1,2.85,.20,.23,.001)

    # Sculpted stone arch over closed shutters. The opening is decorative;
    # the existing wall and all gameplay collision planes stay in place.
    if variant%4 in (0,1):
        for i in range(18):
            a,b=i*math.pi/18,(i+1)*math.pi/18
            points=[]
            for angle,radius in ((a,.69),(a,.86),(b,.86),(b,.69)):
                along=math.cos(angle)*radius
                points.append((px-dz*along+dx*.115,2.85+math.sin(angle)*radius,pz+dx*along+dz*.115))
            face('limestone',points,tint=.91+(i%3)*.025)
        for along in (-.78,.78):
            panel('limestone',along,2.18,.17,1.34,.08)


def distant_landscape(theme):
    """Smooth rocky ridges outside the playable 504m square; one draw call."""
    count=192;vertices=[];faces=[]
    for row in range(7):
        radius=390+row*43
        for i in range(count):
            a=i*math.tau/count
            peaks=math.sin(a*5+.7)*.20+math.sin(a*9-1)*.13+math.cos(a*17)*.07
            profile=math.sin(row/6*math.pi)**1.5
            height=-4+profile*(78+peaks*100)
            r=radius+math.sin(a*7)*9+math.cos(a*13+row*.4)*5
            vertices.append((252+math.cos(a)*r,-252-math.sin(a)*r,height))
    for row in range(6):
        for i in range(count):
            j=(i+1)%count
            a=row*count+i;b=row*count+j;c=(row+1)*count+j;d=(row+1)*count+i
            faces.extend(((a,b,c),(a,c,d)))
    mesh=bpy.data.meshes.new('Sculpted distant ridges');mesh.from_pydata(vertices,[],faces);mesh.update()
    for poly in mesh.polygons:poly.use_smooth=True
    uv=mesh.uv_layers.new(name='UVMap')
    for loop in mesh.loops:
        v=mesh.vertices[loop.vertex_index].co
        uv.data[loop.index].uv=(v.x/18,v.y/18)
    ob=bpy.data.objects.new('Distant landscape',mesh);bpy.context.collection.objects.link(ob)
    ob.data.materials.append(MATS['limestone'] if theme=='dust2' else MATS['tunnel'])
    ob['backdrop']=True
    return ob


def cover(x,z,char):
    px,pz=x*CELL+2,z*CELL+2
    h=2.6 if char=='D' else 1.15
    box('wood',px,h/2,pz,4,h,4)
    # Reinforced corners, inset plank strips and strong metallic edge treatment.
    for side in (-1,1):
        box('steel',px+side*1.96,h/2,pz,.075,h,3.99)
        box('steel',px,h/2,pz+side*1.96,3.99,h,.075)
    for y in (.08,h-.08):
        for dz in (-1,1): box('steel',px,y,pz+dz*1.991,3.98,.12,.018)
        for dx in (-1,1): box('steel',px+dx*1.991,y,pz,.018,.12,3.98)
    # Bevelled slat profiles model small ridges rather than texture-only boxes.
    for k in range(7):
        c=-1.70+k*.56
        box('wood',px+c,h-.012,pz,.50,.024,3.82,tint=.86+(k%3)*.06)
    if char=='D':
        for dx,dz in ((1,0),(-1,0),(0,1),(0,-1)):
            px2,pz2=px+dx*1.995,pz+dz*1.995
            box('steel',px2,1.35,pz2,.04 if dx else .18,.45,.18 if dx else .04)


def box_into(b,x,h,z,w,hh,d,tint=1):
    x0,x1=x-w/2,x+w/2; h0,h1=h-hh/2,h+hh/2; z0,z1=z-d/2,z+d/2
    for vs in (
        [(x0,h0,z1),(x1,h0,z1),(x1,h1,z1),(x0,h1,z1)],
        [(x1,h0,z0),(x0,h0,z0),(x0,h1,z0),(x1,h1,z0)],
        [(x1,h0,z1),(x1,h0,z0),(x1,h1,z0),(x1,h1,z1)],
        [(x0,h0,z0),(x0,h0,z1),(x0,h1,z1),(x0,h1,z0)],
        [(x0,h1,z1),(x1,h1,z1),(x1,h1,z0),(x0,h1,z0)],
        [(x0,h0,z0),(x1,h0,z0),(x1,h0,z1),(x0,h0,z1)],
    ): b.face(vs,tint=tint)


def cover_object(x,z,char):
    # 3.32.0: разрушаемый ящик — ОТДЕЛЬНЫЙ именованный объект (клиент убирает по имени crate_x_z)
    px,pz=x*CELL+2,z*CELL+2
    h=2.6 if char=='D' else 1.15
    b=Batch()
    box_into(b,px,h/2,pz,4,h,4)
    for k in range(7):
        c=-1.70+k*.56
        box_into(b,px+c,h-.012,pz,.50,.024,3.82,tint=.86+(k%3)*.06)
    mesh=bpy.data.meshes.new(f'crate_{x}_{z}')
    mesh.from_pydata(b.vertices,[],b.faces);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap')
    uv.data.foreach_set('uv',np.array(b.uvs,dtype=np.float32).ravel())
    attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    attr.data.foreach_set('color',np.array(b.colors,dtype=np.float32).ravel())
    ob=bpy.data.objects.new(f'crate_{x}_{z}',mesh)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(MATS['wood'])
    ob['crate']=f'{x}_{z}'


def stair(x,z,rows):
    # 3.32.0: мост/вышка может быть в 2-3 клетках от лестницы — ищем по прямой, как в floorAt
    d=(0,-1);tower=False;found=False
    for dx,dz in ((1,0),(-1,0),(0,1),(0,-1)):
        for k in range(1,4):
            c=cell(rows,x+dx*k,z+dz*k)
            if c=='T': d=(dx,dz);tower=True;found=True;break
            if c=='B': d=(dx,dz);found=True;break
            if c not in ('.','S'): break
        if found: break
    h=TOWER_H if tower else BRIDGE_H
    def height(lx,lz):
        # Mirrors the current floorAt contract exactly; see manifest.
        return (lx/CELL if d[0]>0 else (CELL-lx)/CELL if d[0]<0 else lz/CELL if d[1]>0 else (CELL-lz)/CELL)*h
    verts=[(x*4+lx,height(lx,lz),z*4+lz) for lx,lz in ((0,4),(4,4),(4,0),(0,0))]
    face('limestone',verts)
    for i in range(4):
        v1,v2=verts[i],verts[(i+1)%4]
        if v1[1]+v2[1]>.001:face('limestone',[v2,v1,(v1[0],-.02,v1[2]),(v2[0],-.02,v2[2])])
    # Stone tread lines painted/inset on the collision-matching slope.
    for k in range(1,16):
        t=k/16*4
        if d[0]: vs=[(x*4+t,height(t,0)+.002,z*4),(x*4+t+.028,height(t+.028,0)+.002,z*4),(x*4+t+.028,height(t+.028,4)+.002,z*4+4),(x*4+t,height(t,4)+.002,z*4+4)]
        else: vs=[(x*4,height(0,t)+.002,z*4+t),(x*4+4,height(4,t)+.002,z*4+t),(x*4+4,height(4,t+.028)+.002,z*4+t+.028),(x*4,height(0,t+.028)+.002,z*4+t+.028)]
        face('steel',vs)


def cell(rows,x,z):
    return rows[z][x] if 0<=x<SIZE and 0<=z<SIZE else '#'


def glyph(text,x,y,z,size=2,mat='paint'):
    curve=bpy.data.curves.new('marking','FONT');curve.body=text
    curve.align_x='CENTER';curve.align_y='CENTER';curve.size=size
    ob=bpy.data.objects.new('marking',curve);bpy.context.collection.objects.link(ob)
    ob.location=(x,-z,y)
    bpy.context.view_layer.objects.active=ob;ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    ob=bpy.context.view_layer.objects.active
    ob.data.calc_loop_triangles()
    for tri in ob.data.loop_triangles:
        verts=[]
        for i in tri.vertices:
            v=ob.matrix_world@ob.data.vertices[i].co
            verts.append((v.x,v.z,-v.y))
        face(mat,verts)
    bpy.data.objects.remove(ob,do_unlink=True)


def site_markers(theme,rows):
    sites={'A':(396,66 if theme=='dust2' else 60),'B':(102,60)}
    for letter,(x,z) in sites.items():
        c=cell(rows,int(x/4),int(z/4));h=FLOORS.get(c,0)+.009
        glyph(letter,x,h,z,3.1)
        for i in range(32):
            if i%9==0: continue
            a,b=i*math.tau/32,(i+1)*math.tau/32
            vs=[(x+math.cos(a)*r,h,z+math.sin(a)*r) for r in (2.15,2.25)]
            vs+=[(x+math.cos(b)*r,h,z+math.sin(b)*r) for r in (2.25,2.15)]
            face('paint',vs)


def skyline(theme):
    rng=np.random.default_rng(610 if theme=='dust2' else 753)
    for side in range(4):
        for n in range(7):
            along=21+n*75
            x,z=(along,-33) if side==0 else (507,along) if side==1 else (along,507) if side==2 else (-33,along)
            h=float(rng.uniform(8,18));w=float(rng.uniform(12,19));d=float(rng.uniform(9,16))
            mat='plaster' if (n+side)%3 else 'plaster_light'
            box(mat,x,h/2,z,w,h,d,backdrop=True)
            box('trim',x,h-.16,z,w+.12,.32,d+.12,backdrop=True)
            if theme=='inferno':
                # Modelled pitched tile roofs with eaves and ridge lines.
                hh=h+3
                face('roof',[(x-w/2-.25,h,z-d/2-.25),(x+w/2+.25,h,z-d/2-.25),(x+w/2+.25,hh,z),(x-w/2-.25,hh,z)],backdrop=True)
                face('roof',[(x-w/2-.25,hh,z),(x+w/2+.25,hh,z),(x+w/2+.25,h,z+d/2+.25),(x-w/2-.25,h,z+d/2+.25)],backdrop=True)
                box('limestone',x+2,h+1.7,z+2,1.2,3.4,1.2,backdrop=True)
            else:
                box('limestone',x+w*.25,h+.6,z,1.8,1.2,1.5,backdrop=True)
                cylinder('steel',x-w*.2,h+1,z,1.05,2,12,True)
            for row in range(1,int(h/2.8)):
                for col in (-1,0,1):
                    # Closed wooden shutters on the two broad skyline faces.
                    for facez in (-1,1):
                        box('shutter',x+col*w*.27,row*2.8,z+facez*(d/2+.012),1.15,1.55,.024,backdrop=True)
                        box('trim',x+col*w*.27,row*2.8-.85,z+facez*(d/2+.025),1.35,.10,.05,backdrop=True)
    # Distinctive regional landmark beyond the playable boundary.
    x,z=(246,-60)
    cylinder('plaster_light',x,14,z,3.3,28,12,True)
    cylinder('trim',x,25.5,z,3.8,.55,12,True)
    if theme=='dust2':
        for level in (5,10,15,20): cylinder('limestone',x,level,z,3.35,.22,12,True)
        cylinder('roof',x,29.5,z,1.9,3,12,True)
    else:
        box('roof',x,29,z,7.3,2,7.3,backdrop=True)


def build_map(theme,rows):
    BATCHES.clear()
    lamps=[];beacons=[]
    for z in range(SIZE):
        for x in range(SIZE):
            ch=rows[z][x];px,pz=x*4+2,z*4+2
            if ch not in ('4','5','6','7','V'):
                face('ground',[(x*4,0,z*4+4),(x*4+4,0,z*4+4),(x*4+4,0,z*4),(x*4,0,z*4)])
            if ch=='#':
                # Only visible wall skins; interior mass does not consume draw calls.
                tint=.96+((x//4+z//3)%4)*.018
                face('limestone',[(x*4,4,z*4+4),(x*4+4,4,z*4+4),(x*4+4,4,z*4),(x*4,4,z*4)],tint=tint)
                for dx,dz in ((1,0),(-1,0),(0,1),(0,-1)):
                    if cell(rows,x+dx,z+dz)=='#':continue
                    a=(px+dx*2-dz*2,0,pz+dz*2+dx*2)
                    b=(px+dx*2+dz*2,0,pz+dz*2-dx*2)
                    face(('plaster_light','plaster','plaster_blue','plaster_light')[(x//6+z//6)%4],[a,b,(b[0],4,b[2]),(a[0],4,a[2])],tint=tint)
                    wall_details(x,z,dx,dz,x*7+z*11+(dx+dz),theme)
            elif ch in ('C','D'): cover_object(x,z,ch)
            elif ch=='T':
                box('limestone',px,TOWER_H/2,pz,4,TOWER_H,4)
                box('trim',px,TOWER_H-.10,pz,3.98,.18,3.98)
            elif ch=='B': box('limestone',px,BRIDGE_H-.15,pz,4,.3,4)
            elif ch=='S': stair(x,z,rows)
            if ch in FLOORS:
                level=FLOORS[ch]
                face('tunnel',[(x*4,level,z*4+4),(x*4+4,level,z*4+4),(x*4+4,level,z*4),(x*4,level,z*4)])
                if ch=='4':
                    box('tunnel',px,TUN_CEIL/2,pz,4,-TUN_CEIL,4)
                    # Ceiling ribs and visible cages with runtime point-light metadata.
                    if (x+z)%3==0:
                        box('steel',px,TUN_CEIL-.035,pz,1.20,.07,.38)
                        box('lamp_warm',px,TUN_CEIL-.08,pz,.94,.035,.22)
                        lamps.append({'position':[px,TUN_CEIL-.20,pz],'color':16760688,'intensity':1.5,'distance':10})
                for dx,dz in ((1,0),(-1,0),(0,1),(0,-1)):
                    nb=cell(rows,x+dx,z+dz)
                    if nb not in FLOORS: top,bot=0,-3.45
                    elif FLOORS[nb]>level: top,bot=FLOORS[nb],level
                    else: continue
                    xx,zz=px+dx*2,pz+dz*2
                    box('tunnel',xx,(top+bot)/2,zz,.035 if dx else 4,top-bot,4 if dx else .035)
                    if ch!='4' and nb=='.':
                        beacons.append({'position':[xx,.3,zz],'kind':'tunnel'})
                        box('steel',xx,.25,zz,.34,.50,.34)
                        box('lamp_warm',xx,.29,zz,.22,.18,.22)
            elif ch=='V':
                box('duct',px,VENT_CEIL+.04,pz,4,.08,4)
                face('duct',[(x*4,0,z*4+4),(x*4+4,0,z*4+4),(x*4+4,0,z*4),(x*4,0,z*4)])
                for dx,dz in ((1,0),(-1,0),(0,1),(0,-1)):
                    nb=cell(rows,x+dx,z+dz)
                    xx,zz=px+dx*2,pz+dz*2
                    if nb=='#':box('duct',xx,VENT_CEIL/2,zz,.04 if dx else 4,VENT_CEIL,4 if dx else .04)
                    elif nb not in ('V',):
                        beacons.append({'position':[xx,1.55,zz],'kind':'vent'})
                        box('steel',xx,1.48,zz,.30,.22,.30)
                        box('lamp_green',xx,1.49,zz,.18,.12,.18)
                if (x+z)%3==0:
                    box('lamp_green',px,VENT_CEIL-.025,pz,.45,.03,.16)
                    lamps.append({'position':[px,1.1,pz],'color':10477802,'intensity':.7,'distance':6})
    site_markers(theme,rows)
    skyline(theme)
    return lamps,beacons


def bake_batches():
    objects=[]
    for (name,sector),batch in sorted(BATCHES.items()):
        if not batch.faces:continue
        mesh=bpy.data.meshes.new(f'{name}_{sector}')
        mesh.from_pydata(batch.vertices,[],batch.faces);mesh.update()
        uv=mesh.uv_layers.new(name='UVMap')
        # Each face has its own vertices, making loop order identical to vertex order.
        uv.data.foreach_set('uv',np.array(batch.uvs,dtype=np.float32).ravel())
        attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        attr.data.foreach_set('color',np.array(batch.colors,dtype=np.float32).ravel())
        ob=bpy.data.objects.new(f'{sector}_{name}',mesh)
        bpy.context.collection.objects.link(ob);ob.data.materials.append(MATS[name])
        ob['artwork']='Original Support Hub / Blender'
        ob['backdrop']=sector=='backdrop'
        ob['sector']=sector
        objects.append(ob)
    return objects


def main():
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    ap=argparse.ArgumentParser();ap.add_argument('--sources',type=Path)
    ap.add_argument('--map',choices=('dust2','inferno','all'),default='all')
    cfg=ap.parse_args(args)
    if cfg.sources:cfg.sources=cfg.sources.resolve()
    OUT.mkdir(parents=True,exist_ok=True)
    if cfg.sources:cfg.sources.mkdir(parents=True,exist_ok=True)
    layouts=read_layouts()
    manifest_path=OUT/'maps-manifest.json'
    manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {'format':1,'maps':{}}
    manifest.update({'authoring':'Blender '+bpy.app.version_string,'generator':'tools/blender/build_maps.py','artwork':'Original geometry and procedural detail with CC0 Poly Haven surface textures; see ART_CREDITS.md. No Valve assets.','coordinateSystem':'glTF Y-up, game x/y/z unchanged','cellSize':4,'gridSize':126,'layoutSource':'cs16.js MAP_ROWS','facadeHeight':4,'stairsContract':'Matches floorAt(): elevation increases toward the adjacent bridge or tower.'})
    for theme,rows in layouts.items():
        if cfg.map not in ('all',theme):continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        create_materials(theme)
        lamps,beacons=build_map(theme,rows)
        objects=bake_batches()
        objects.append(distant_landscape(theme))
        tris=0
        for ob in objects:ob.data.calc_loop_triangles();tris+=len(ob.data.loop_triangles)
        bpy.context.scene.world=bpy.data.worlds.new('World')
        bpy.context.scene.world.color=(.4,.45,.55)
        if cfg.sources:
            bpy.ops.wm.save_as_mainfile(filepath=str(cfg.sources/(theme+'.blend')),compress=True)
        target=OUT/(theme+'.glb')
        bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_yup=True,export_apply=False,export_animations=False,export_cameras=False,export_lights=False,export_extras=True,export_image_format='AUTO',export_materials='EXPORT',export_texcoords=True,export_normals=True,export_tangents=False)
        layout_hash=hashlib.sha256('\n'.join(rows).encode()).hexdigest()
        manifest['maps'][theme]={'file':target.name,'bytes':target.stat().st_size,'triangles':tris,'meshBatches':len(objects),'materials':len(MATS),'textureImages':len(TEX_IMAGES),'layoutSha256':layout_hash,'cellCounts':dict(Counter(''.join(rows))),'lights':lamps,'beacons':beacons,'sourceBlend':theme+'.blend'}
        manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print('MAP_BUILT',theme,json.dumps({k:manifest['maps'][theme][k] for k in ('bytes','triangles','meshBatches','layoutSha256')}),flush=True)


if __name__=='__main__':main()
