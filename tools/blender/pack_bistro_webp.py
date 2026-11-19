"""Compress Bistro texture delivery; geometry and tangent normals stay unchanged.
Run after prepare_bistro_textures.py and build_bistro_kit.py. Chrome/Three r160
support EXT_texture_webp; sources are kept outside the packaged app.
"""
import io,json,struct
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];TEX=ROOT/'assets/cs-realistic/bistro';PATH=ROOT/'models/csgo/bistro-kit.glb'
manifest=json.loads((TEX/'manifest.json').read_text())
for maps in manifest['materials'].values():
 for key,name in list(maps.items()):
  src=TEX/name
  if src.suffix!='.png':continue
  dest=src.with_suffix('.webp');im=Image.open(src)
  im.save(dest,'WEBP',quality=94 if key=='Normal' else 90,method=6,lossless=key=='Specular')
  maps[key]=dest.name
(TEX/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
data=PATH.read_bytes();length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length]);binary=data[28+length:];replacements={}
normal_images=set()
for mat in doc['materials']:
 if 'normalTexture'in mat:
  tx=doc['textures'][mat['normalTexture']['index']];normal_images.add(tx.get('source'))
for i,im in enumerate(doc['images']):
 view=doc['bufferViews'][im['bufferView']];raw=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
 image=Image.open(io.BytesIO(raw));out=io.BytesIO();image.save(out,'WEBP',quality=94 if i in normal_images else 90,method=6,lossless=max(image.size)<=16)
 replacements[im['bufferView']]=out.getvalue();im['mimeType']='image/webp'
for tx in doc['textures']:
 if 'source'in tx:tx.setdefault('extensions',{})['EXT_texture_webp']={'source':tx.pop('source')}
for key in ['extensionsUsed','extensionsRequired']:
 doc.setdefault(key,[])
 if 'EXT_texture_webp' not in doc[key]:doc[key].append('EXT_texture_webp')
packed=bytearray()
for i,view in enumerate(doc['bufferViews']):
 offset=view.get('byteOffset',0);raw=replacements.get(i,binary[offset:offset+view['byteLength']]);packed.extend(b'\0'*(-len(packed)%4));view['byteOffset']=len(packed);view['byteLength']=len(raw);packed.extend(raw)
packed.extend(b'\0'*(-len(packed)%4));doc['buffers'][0]['byteLength']=len(packed);header=json.dumps(doc,separators=(',',':')).encode();header+=b' '*(-len(header)%4)
temporary=PATH.with_suffix('.packed.glb');temporary.write_bytes(struct.pack('<III',0x46546c67,2,28+len(header)+len(packed))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(packed),0x004e4942)+packed);temporary.replace(PATH)
# Delete only generated PNG intermediates inside this verified asset directory.
for file in TEX.glob('*.png'):
 assert file.resolve().parent==TEX.resolve();file.unlink()
report=json.loads((TEX/'geometry.json').read_text());report['bytes']=PATH.stat().st_size;report['delivery']='EXT_texture_webp';(TEX/'geometry.json').write_text(json.dumps(report,indent=2)+'\n')
print('PACKED_BISTRO',PATH.stat().st_size,'TEXTURES',sum(p.stat().st_size for p in TEX.glob('*.webp')),flush=True)
