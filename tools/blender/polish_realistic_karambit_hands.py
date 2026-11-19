"""Match the original karambit grip poses to the realistic tactical gloves.

Only material data and new embedded textures change; all geometry bytes, grip
origins and ring/attack pivots remain byte-identical. Run after the original
build_karambit_hand.py. Cached pristine input makes repeated runs idempotent.
"""
import io, json, math, struct, hashlib
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]


def texture(j,blob,pixels,name):
    out=io.BytesIO();Image.fromarray(np.uint8(np.clip(pixels,0,1)*255+.5)).save(out,'PNG',optimize=True)
    raw=out.getvalue();blob.extend(b'\0'*(-len(blob)%4));offset=len(blob);blob.extend(raw)
    vi=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)})
    ii=len(j.setdefault('images',[]));j['images'].append({'name':name,'mimeType':'image/png','bufferView':vi})
    if not j.get('samplers'):j['samplers']=[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]
    ti=len(j.setdefault('textures',[]));j['textures'].append({'name':name,'sampler':0,'source':ii});return ti


def pbr_set(j,blob,kind,color):
    n=192 if kind=='cloth' else 128;y,x=np.mgrid[:n,:n].astype(np.float32);u=x*math.tau/n;v=y*math.tau/n
    rng=np.random.default_rng(719 if kind=='cloth' else 881);noise=rng.normal(0,1,(n,n)).astype(np.float32)
    if kind=='cloth':
        weave=np.sin(u*42)*np.cos(v*21+.6*np.sin(u*21))+.6*np.sin(v*42)*np.cos(u*21)
        wash=np.sin(u*2+.6*np.sin(v*3))*np.cos(v*3)
        detail=1+weave*.065+wash*.085+noise*.018;height=weave*.36
    else:
        grain=np.sin(u*11+.8*np.sin(v*7))*np.cos(v*13+.7*np.sin(u*4))
        detail=1+grain*.065+noise*.022;height=grain*.26+noise*.072
    albedo=np.array(color)[None,None,:]*detail[:,:,None]
    dx=(np.roll(height,-1,1)-np.roll(height,1,1))*.23;dy=(np.roll(height,-1,0)-np.roll(height,1,0))*.23
    normal=np.stack((-dx,-dy,np.ones_like(dx)),axis=2);normal/=np.linalg.norm(normal,axis=2,keepdims=True);normal=normal*.5+.5
    rough=np.ones_like(albedo);rough[:,:,1]=np.clip((.94 if kind=='cloth' else .76)+noise*.014,.65,.98)
    return {'base':texture(j,blob,albedo,'Realistic '+kind+' albedo'),'normal':texture(j,blob,normal,'Realistic '+kind+' relief'),'orm':texture(j,blob,rough[::2,::2],'Realistic '+kind+' roughness')}


def main():
    target=ROOT/'models/csgo/anime-karambit-hand.glb';source=ROOT/'graphics-qa/realistic-hand-originals/anime-karambit-hand.glb'
    source.parent.mkdir(parents=True,exist_ok=True)
    if not source.exists():
        data=target.read_bytes();length=struct.unpack_from('<I',data,12)[0];meta=json.loads(data[20:20+length])
        assert not meta.get('extras',{}).get('realisticKarambitHands'),'Pristine karambit source required'
        source.write_bytes(data)
    data=source.read_bytes();length=struct.unpack_from('<I',data,12)[0];j=json.loads(data[20:20+length]);binary_len=struct.unpack_from('<I',data,20+length)[0]
    binary=bytearray(data[28+length:28+length+binary_len]);original=bytes(binary);meshes=json.dumps(j['meshes'],sort_keys=True)
    nodes=json.loads(json.dumps(j['nodes']))
    cloth=pbr_set(j,binary,'cloth',(.255,.258,.208));leather=pbr_set(j,binary,'leather',(.18,.19,.17))
    for mat in j['materials']:
        old=mat['name'];mat['extras']={'cs16Realistic':True,'originalAuthor':'Support Hub / original procedural asset'}
        pbr=mat['pbrMetallicRoughness'];pbr['metallicFactor']=0
        if old in ('Cuff brass piping','Ivory tailored stitching'):
            mat['name']='Realistic muted olive '+('cuff stitching' if old.startswith('Cuff') else 'sleeve stitching')
            pbr['baseColorFactor']=[.045,.05,.035,1];pbr['roughnessFactor']=.90
        else:
            kind=cloth if old=='Soft ivory field sleeve' else leather
            mat['name']='Realistic '+('olive field ripstop' if old=='Soft ivory field sleeve' else 'charcoal glove '+old.lower())
            pbr['baseColorFactor']=[1,1,1,1];pbr['roughnessFactor']=1
            pbr['baseColorTexture']={'index':kind['base']};pbr['metallicRoughnessTexture']={'index':kind['orm']}
            mat['normalTexture']={'index':kind['normal'],'scale':.45 if kind is cloth else .30}
    for node in j['nodes']:
        if node.get('name')=='karambitHands':node.setdefault('extras',{}).update({'cs16Realistic':True,'artStyle':'Original realistic tactical ring and attack poses'})
    j.setdefault('extras',{})['realisticKarambitHands']={'generator':'tools/blender/polish_realistic_karambit_hands.py','sourceGeometrySHA256':hashlib.sha256(original).hexdigest()}
    assert bytes(binary[:len(original)])==original
    assert json.dumps(j['meshes'],sort_keys=True)==meshes
    for old,new in zip(nodes,j['nodes']):
        assert {k:v for k,v in old.items() if k!='extras'}=={k:v for k,v in new.items() if k!='extras'}
    j['buffers'][0]['byteLength']=len(binary);text=json.dumps(j,separators=(',',':')).encode();text+=b' '*(-len(text)%4);binary+=b'\0'*(-len(binary)%4)
    result=struct.pack('<III',0x46546c67,2,28+len(text)+len(binary))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(binary),0x004e4942)+binary
    target.write_bytes(result)
    triangles=sum(j['accessors'][p['indices']]['count']//3 for mesh in j['meshes'] for p in mesh['primitives'])
    report={'file':target.name,'bytes':len(result),'triangles':triangles,'materials':len(j['materials']),'geometryAndPivotsByteIdentical':True,'sourceGeometrySHA256':hashlib.sha256(original).hexdigest(),'source':'Original Support Hub karambit hands'}
    (ROOT/'graphics-qa/realistic-karambit-hands.json').write_text(json.dumps(report,indent=2)+'\n')
    print('REALISTIC_KARAMBIT_HANDS_PASS',json.dumps(report),flush=True)

if __name__=='__main__':main()
