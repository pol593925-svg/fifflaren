"""Bake compact, original PBR surface detail into existing first-person GLBs.

Only image/material data is changed. Authored grip sockets, mesh positions, UVs,
normals, skinning, animation pivots and distant world LODs remain byte-identical.
The result is a live rendering asset, never a screenshot overlay.
Run with ordinary Python + numpy/Pillow; --source accepts an untouched asset dir.
"""
from __future__ import annotations
import argparse, hashlib, io, json, math, struct
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
FILES = ('anime-m4a1.glb', 'anime-ak47.glb', 'anime-hands.glb')

def read_glb(path):
    b = path.read_bytes()
    assert b[:4] == b'glTF'
    n = struct.unpack_from('<I', b, 12)[0]
    j = json.loads(b[20:20+n])
    count = struct.unpack_from('<I', b, 20+n)[0]
    return j, bytearray(b[28+n:28+n+count])

def write_glb(path, j, binary):
    j['buffers'][0]['byteLength'] = len(binary)
    s = json.dumps(j, separators=(',', ':')).encode()
    s += b' ' * (-len(s) % 4)
    binary += b'\0' * (-len(binary) % 4)
    result = struct.pack('<III', 0x46546c67, 2, 28+len(s)+len(binary))
    result += struct.pack('<II', len(s), 0x4e4f534a)+s
    result += struct.pack('<II', len(binary), 0x004e4942)+binary
    path.write_bytes(result)

def png(array):
    out = io.BytesIO()
    Image.fromarray(np.uint8(np.clip(array, 0, 1)*255+.5)).save(out, 'PNG', optimize=True)
    return out.getvalue()

def source_pixels(j, b, material):
    pbr = material.get('pbrMetallicRoughness', {})
    index = pbr.get('baseColorTexture', {}).get('index')
    if index is None:
        return None
    image = j['images'][j['textures'][index]['source']]
    view = j['bufferViews'][image['bufferView']]
    data = bytes(b[view.get('byteOffset', 0):view.get('byteOffset', 0)+view['byteLength']])
    return np.array(Image.open(io.BytesIO(data)).convert('RGB').resize((256, 256)), dtype=np.float32)/255

def add_texture(j, binary, pixels, name):
    raw = png(pixels)
    binary.extend(b'\0' * (-len(binary) % 4))
    offset = len(binary)
    binary.extend(raw)
    view = len(j['bufferViews'])
    j['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(raw)})
    im = len(j.setdefault('images', []))
    j['images'].append({'name': name, 'mimeType': 'image/png', 'bufferView': view})
    samplers = j.setdefault('samplers', [])
    sampler = {'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}
    if sampler not in samplers:
        samplers.append(sampler)
    tex = len(j.setdefault('textures', []))
    j['textures'].append({'name': name, 'sampler': samplers.index(sampler), 'source': im})
    return tex

def texture_set(name, base, file):
    n = 256
    y, x = np.mgrid[:n, :n].astype(np.float32)
    u, v = x*math.tau/n, y*math.tau/n
    rng = np.random.default_rng(int.from_bytes(hashlib.sha256(name.encode()).digest()[:4], 'little'))
    noise = rng.normal(0, 1, (n,n)).astype(np.float32)
    label = name.lower()
    skin = any(k in label for k in ('exposed fingers','fingernail','finger crease'))
    cloth = any(k in label for k in ('ripstop','textile','sleeve','binding','seam'))
    leather = 'leather' in label
    wood = 'walnut' in label
    ceramic = any(k in label for k in ('ceramic','enamel','ivory')) and not skin
    metal = any(k in label for k in ('steel','alloy','edges','brass','fastener','mechanism'))
    # Restore a saturated satin metal foundation under the pale enamel inlays.
    target = None
    if file == 'anime-m4a1.glb':
        if name == 'Weapon finish / Parkerized steel': target = (92,125,129)
        elif name == 'Weapon finish / Polymer': target = (67,86,95)
    if file == 'anime-ak47.glb' and name == 'Weapon finish / Walnut laminate':
        target = (161,105,58)
    if target:
        base = base/base.mean(axis=(0,1),keepdims=True)*np.array(target)[None,None,:]/255
    height = np.zeros((n,n),np.float32)
    detail = np.ones((n,n),np.float32)
    rough = np.full((n,n),.92,np.float32)
    strength = .45
    if cloth:
        # Distinct twill weave with broad yarns, plus a restrained ripstop grid.
        warp = np.sin(u*56)*np.cos(v*28+.85*np.sin(u*28))
        weft = np.sin(v*56)*np.cos(u*28)
        twill = .5+.5*np.sin((u+v)*28)
        height = warp*.35+weft*.25+twill*.10
        detail += warp*.031+weft*.022+noise*.004
        if 'ripstop' in label:
            grid = np.maximum(np.exp(-np.sin(u*12)**2*75),np.exp(-np.sin(v*12)**2*75))
            height += grid*.12
            detail -= grid*.028
        rough = .92+warp*.045+weft*.025
        strength = .62
    elif leather:
        # Padded, matte leather with irregular pores, without the old plastic shine.
        folds = np.sin(u*9+.8*np.sin(v*6))*np.sin(v*12+.8*np.sin(u*4))
        height = folds*.16+noise*.045
        detail += folds*.025+noise*.006
        rough = .89+folds*.07
        strength = .42
    elif skin:
        # Soft broad pigment only; avoiding exaggerated porous skin or noisy faces.
        pigment = np.sin(u*3+.6*np.sin(v*2))*np.cos(v*5)
        detail += pigment*.018+noise*.002
        height = noise*.014
        rough = .94+pigment*.025
        strength = .15
    elif wood:
        flow = u*21+2.3*np.sin(v*2)+.65*np.sin(u*3)
        grain = np.sin(flow)+.35*np.sin(flow*2.4+v)
        detail += grain*.063+np.sin(flow*.16)*.035+noise*.003
        height = grain*.10
        rough = .87+grain*.075
        strength = .32
    elif metal:
        brush = np.sin(v*108+.22*np.sin(u*3))
        wash = np.sin(u*4+.6*np.sin(v*3))*np.cos(v*2)
        height = brush*.095+noise*.013
        detail += wash*.018+brush*.008
        rough = .76+brush*.10+wash*.045
        # Small, infrequent handling marks; not random full-surface white noise.
        for _ in range(14):
            px,py = rng.integers(0,n,2)
            length = int(rng.integers(4,18))
            line = (px+np.arange(length))%n
            detail[py,line] += .055*np.sin(np.arange(length)*math.pi/length)
            height[py,line] -= .12
            rough[py,line] += .10
        strength = .30
    elif ceramic:
        strokes = np.sin(u*5+1.5*np.sin(v*2))*np.cos(v*3)
        detail += strokes*.018
        height = strokes*.035
        rough = .86+strokes*.045
        strength = .20
    else:
        stipple = np.sin(u*61)*np.cos(v*59)
        detail += stipple*.012+noise*.003
        height = stipple*.08+noise*.035
        rough = .93+stipple*.035
        strength = .40
    albedo = np.clip(base*detail[:,:,None],0,1)
    # Derivatives from the authored height, encoded as unit tangent-space normals.
    dx=(np.roll(height,-1,1)-np.roll(height,1,1))*.25
    dy=(np.roll(height,-1,0)-np.roll(height,1,0))*.25
    normal=np.stack((-dx,-dy,np.ones_like(dx)),axis=2)
    normal/=np.linalg.norm(normal,axis=2,keepdims=True)
    normal=normal*.5+.5
    # glTF's packed roughness uses G. Other channels remain one, preserving factors.
    packed=np.ones((n,n,3),np.float32)
    packed[:,:,1]=np.clip(rough,.58,1)
    return albedo,normal[::2,::2],packed[::2,::2],strength

def run(source, dest):
    reports=[]
    for filename in FILES:
        original=source/filename
        j,blob=read_glb(original)
        assert not j.get('extras',{}).get('surfaceDetailPreview'), 'Use untouched --source assets'
        geometry=bytes(blob)
        meshes=json.dumps(j['meshes'],sort_keys=True)
        nodes=json.dumps(j['nodes'],sort_keys=True)
        modified=[]
        for material in j['materials']:
            name=material.get('name','')
            if 'world' in name.lower(): continue
            base=source_pixels(j,geometry,material)
            if base is None:continue
            albedo,normal,roughness,strength=texture_set(name,base,filename)
            pbr=material.setdefault('pbrMetallicRoughness',{})
            pbr['baseColorTexture']={'index':add_texture(j,blob,albedo,name+' • painted detail')}
            pbr['metallicRoughnessTexture']={'index':add_texture(j,blob,roughness,name+' • satin roughness')}
            material['normalTexture']={'index':add_texture(j,blob,normal,name+' • authored relief'),'scale':strength}
            modified.append(name)
        j.setdefault('extras',{})['surfaceDetailPreview']={'version':1,'source':'polish_anime_viewmodels.py','originalGeometryBytes':len(geometry)}
        assert bytes(blob[:len(geometry)])==geometry
        assert json.dumps(j['meshes'],sort_keys=True)==meshes
        assert json.dumps(j['nodes'],sort_keys=True)==nodes
        target=dest/filename
        write_glb(target,j,blob)
        # Inspect round trip, including every geometry accessor backed by original bytes.
        actual,actual_blob=read_glb(target)
        assert bytes(actual_blob[:len(geometry)])==geometry
        tris=sum(actual['accessors'][pr['indices']]['count']//3 for mesh in actual['meshes'] for pr in mesh['primitives'])
        reports.append({'file':filename,'bytes':target.stat().st_size,'triangles':tris,'meshes':len(actual['meshes']),'materials':len(actual['materials']),'detailedMaterials':len(modified),'geometryAndPivotsUnchanged':True})
    return reports

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',type=Path,default=ROOT/'models/csgo')
    parser.add_argument('--dest',type=Path,default=ROOT/'models/csgo')
    parser.add_argument('--report',type=Path)
    cfg=parser.parse_args()
    result=run(cfg.source,cfg.dest)
    if cfg.report:cfg.report.write_text(json.dumps(result,indent=2)+'\n')
    print('VIEWMODEL_SURFACE_PASS',json.dumps(result))
