"""Convert official ORCA Bistro DDS maps for the WebGL asset pipeline (CC BY 4.0)."""
import json,sys,re,shutil
import numpy as np
from pathlib import Path
from PIL import Image,ImageOps
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT.parent/'realism-sources/bistro'
TEX=SOURCE/'source/Bistro_v5_2/Textures'
OUT=ROOT/'assets/cs-realistic/bistro';OUT.mkdir(parents=True,exist_ok=True)
objects=json.loads((SOURCE/'objects.json').read_text())
pick={}
terms={'lantern':'Paris_StreetLight_01B_6281','planter':'Paris_PlantPot_01A1_6137','awning':'Paris_BistroAwning_02B1_4115','sign':'Paris_ShopSign_01D_6165','balcony_fascia':'Paris_MainBalcony_01_6103',
       'shutter_panel':'paris_buildi_878646d','tree':'Linde_Tree_Large_linde_tree_large_4051','cypress':'Italian_Cypress1_3923','ivy':'Ivy_Ivy_4011',
       'table':'Paris_Table_01_6489','chair':'Paris_Chair_01_Mesh_01_5907'}
for key,term in terms.items():pick[key]=[o['name']for o in objects if term in o['name']]
pick['window_frame']=[o['name']for o in objects if any(term in o['name']for term in ['paris_buildi_055cb57','paris_buildi_6746a3f','paris_buildi_5b4ad15','paris_buildi_b80bbf3'])]
pick['pilaster']=[o['name']for o in objects if 'paris_buildi_173aab2' in o['name']]
pick['townhouses']=[o['name']for o in objects if 'Paris_Building_08' in o['name'] and 15<(o['min'][0]+o['max'][0])/2<45 and (o['min'][1]+o['max'][1])/2>50]
surfaces={'plaster':'MASTER_Concrete_Plaster','plaster_light':'MASTER_Concrete_Smooth','plaster_blue':'MASTER_Brick_Large_Beige_BLENDSHADER','limestone':'MASTER_Brick_Large_White','ground':'Pavement_Cobblestone_02','wood':'MASTER_Wood_Brown','shutter':'MASTER_Wood_Painted_Green','steel':'MASTER_Black_Metal','duct':'MASTER_Metal','tunnel':'MASTER_Concrete1','roof':'MASTER_Roofing_Shingle_Grey','trim':'MASTER_Concrete_White','ceramic':'Plantpots'}
names=set(surfaces.values())
selected=set(n for ns in pick.values()for n in ns)
names.update(m.replace('.DoubleSided','')for o in objects if o['name']in selected for m in o['materials'])
manifest={'source':'Amazon Lumberyard Bistro, ORCA','license':'CC BY 4.0','url':'https://developer.nvidia.com/orca/amazon-lumberyard-bistro','surfaces':surfaces,'models':pick,'materials':{}}
for name in sorted(names):
 maps={};limit=1024 if name in surfaces.values() else 512
 for kind in ['BaseColor','Normal','Specular']:
  path=TEX/(name+'_'+kind+'.dds')
  if not path.exists():continue
  im=Image.open(path).convert('RGBA');im.thumbnail((limit,limit),Image.Resampling.LANCZOS)
  if kind=='Normal':
   # Bistro BC5 DDS stores XY only: Pillow exposes an empty blue channel.
   # Reconstruct +Z before converting DirectX tangent Y to glTF/OpenGL.
   px=np.asarray(im).copy();xy=px[:,:,:2].astype(np.float32)/127.5-1
   px[:,:,2]=np.rint((np.sqrt(np.maximum(0,1-np.sum(xy*xy,axis=2)))*.5+.5)*255).astype(np.uint8)
   px[:,:,1]=255-px[:,:,1];im=Image.fromarray(px)
  elif kind=='Specular':
   px=np.asarray(im).copy()
   # Unauthored AO is zero in the original constant ORM textures. Treat it as
   # absent rather than making all indirect light disappear.
   if not px[:,:,0].any():px[:,:,0]=255
   im=Image.fromarray(px)
  fname=name+'_'+kind+'.png';im.save(OUT/fname,optimize=True);maps[kind]=fname
 manifest['materials'][name]=maps
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
shutil.copyfile(SOURCE/'source/Bistro_v5_2/LICENSE.txt',OUT/'LICENSE.txt')
(OUT/'ATTRIBUTION.txt').write_text('Amazon Lumberyard Bistro, Open Research Content Archive (ORCA), 2017.\nhttps://developer.nvidia.com/orca/amazon-lumberyard-bistro\nCreative Commons Attribution 4.0: https://creativecommons.org/licenses/by/4.0/\nModified for Support Hub: DDS conversion, BC5 normal Z reconstruction, DirectX normal green-channel conversion, missing constant AO normalization, resized WebP textures, geometry extraction/decimation/batching, fitted window apertures and gameplay placement.\nOriginal scene and archive are retained separately from packaged assets.\n')
print('BISTRO_TEXTURES',len(names),sum(p.stat().st_size for p in OUT.glob('*.png')),flush=True)
