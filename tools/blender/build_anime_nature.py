"""Original broad painted foliage; same bounded species pools and gameplay positions."""
import bpy, importlib.util, math, random
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('author',Path(__file__).with_name('build_characters.py'))
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
bpy.ops.wm.read_factory_settings(use_empty=True)
rng=random.Random(7031)
def material(name,color,scan=None):
 m=a.surface(name,color,.95)
 if scan:
  p=m.node_tree.nodes.get('Principled BSDF')
  for channel in ['Diffuse','nor_gl','Rough']:
   f=ROOT/'models/csgo/textures'/(scan+'_'+channel+'.jpg')
   im=bpy.data.images.load(str(f),check_existing=True).copy();im.colorspace_settings.name='sRGB' if channel=='Diffuse' else 'Non-Color';im.scale(256,256);im.pack()
   node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=im
   if channel=='Diffuse':m.node_tree.links.new(node.outputs['Color'],p.inputs['Base Color'])
   elif channel=='Rough':m.node_tree.links.new(node.outputs['Color'],p.inputs['Roughness'])
   else:
    norm=m.node_tree.nodes.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=.6;m.node_tree.links.new(node.outputs['Color'],norm.inputs['Color']);m.node_tree.links.new(norm.outputs['Normal'],p.inputs['Normal'])
 return m
bark=material('Painted Bark',(.18,.105,.062))
leaf=material('Painted Leaves',(.19,.34,.075));pineleaf=material('Pine Leaves',(.075,.22,.14));rock=material('Painted Rock',(.40,.40,.31))
def finish(root,prefix):
 groups={}
 for ob in list(root.children_recursive):
  if ob.type=='MESH':groups.setdefault(ob.data.materials[0],[]).append(ob)
 for mat,obs in groups.items():
  bpy.ops.object.select_all(action='DESELECT')
  for ob in obs:ob.select_set(True)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();ob=obs[0];ob.name=prefix+'_'+('Leaves' if 'Leaves' in mat.name else 'Bark' if 'Bark' in mat.name else 'Rock')
def foliage(parent,centres,mat,count=14):
 verts=[];faces=[]
 for cx,cy,cz,r in centres:
  for i in range(count):
   az=rng.random()*math.tau;e=rng.uniform(-1,1);rad=r*rng.random()**.5
   x=cx+math.cos(az)*rad;y=cy+e*r*.45;z=cz+math.sin(az)*rad
   angle=rng.random()*math.tau;length=rng.uniform(.18,.32);width=length*.57
   dx,dz=math.cos(angle),math.sin(angle);tilt=rng.uniform(-.65,.65)
   n=len(verts);verts.append((x,y+.045,z))
   for k in range(8):
    t=k*math.tau/8;u=math.cos(t)*length;v=math.sin(t)*width
    verts.append((x+dx*u-dz*v,y+math.sin(tilt)*u,z+dz*u+dx*v))
   for k in range(8):faces.append((n,n+1+k,n+1+(k+1)%8))
 ob=a.mesh('Leaves',verts,faces,mat,parent)
 for p in ob.data.polygons:p.use_smooth=False
 colors=ob.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
 for poly in ob.data.polygons:
  v=rng.uniform(.65,1.15)
  for li in poly.loop_indices:colors.data[li].color=(v,v*1.015,v*.94,1)
for key in ['oak','birch','pine','bush']:
 root=a.empty(key);centres=[]
 if key=='oak':
  a.line('Old olive trunk',[(0,0,0),(.12,.8,.04),(-.10,1.6,.12),(.02,2.25,0)],.18,bark,root)
  for j in range(7):
   az=j*math.tau/7;dx,dz=math.cos(az),math.sin(az)
   a.line('Olive bough',[(.02,1.6,0),(dx*.45,2.6,dz*.45),(dx*1.05,3.3+(j%2)*.3,dz*1.05),(dx*1.8,3.75+(j%3)*.35,dz*1.8)],.065,bark,root)
   for t in range(4):
    rr=.7+t*.4;cy=3.2+(j%3)*.32+t*.16;centres.append((dx*rr,cy,dz*rr,.6))
    for side in [-1,1]:
     tip=(dx*rr+side*dz*.48,cy+.45,dz*rr-side*dx*.48);a.line('Olive twig',[(dx*rr,cy,dz*rr),tip],.014,bark,root);centres.append((*tip,.42))
  centres.extend([(0,4.3,0,.65),(.3,4.7,.2,.5)])
 elif key=='birch':
  a.line('Poplar trunk',[(0,0,0),(.04,2,0),(-.06,4,.02),(0,5.7,0)],.095,bark,root)
  for j in range(32):
   y=1.8+j*.12;az=j*2.399;r=.35+.5*math.sin((y-1.5)/4.3*math.pi);tip=(math.sin(az)*r,y+.35,math.cos(az)*r)
   a.line('Poplar branch',[(0,y-.35,0),tip],.014,bark,root);centres.append((*tip,.40))
 elif key=='pine':
  a.line('Pine trunk',[(0,0,0),(.04,3,0),(0,6.15,0)],.10,bark,root)
  for j in range(44):
   y=1.5+j*.10;az=j*2.399;r=(6-y)*.35;tip=(math.sin(az)*r,y+.15,math.cos(az)*r)
   a.line('Pine branch',[(0,y,0),tip],.02,bark,root);centres.append((*tip,.4))
 else:
  for j in range(20):
   az=j*2.399;r=.15+(j%5)*.07;tip=(math.sin(az)*r,.5+(j%4)*.1,math.cos(az)*r)
   a.line('Shrub stem',[(0,0,0),tip],.01,bark,root);centres.append((*tip,.26))
 foliage(root,centres,pineleaf if key=='pine' else leaf,10 if key=='oak' else 9);finish(root,key)
root=a.empty('rock');ob=a.orb('Limestone outcrop',(0,.36,0),(.72,.48,.55),rock,root,12,8)
for v in ob.data.vertices:v.co*=1+rng.uniform(-.12,.12)
finish(root,'rock')
for ob in bpy.data.objects:
 if ob.type=='MESH':
  ob.select_set(True)
  for m in ob.data.materials:m.use_backface_culling=False
bpy.ops.export_scene.gltf(filepath=str(ROOT/'models/csgo/anime-nature.glb'),export_format='GLB',export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
print('ANIME_NATURE', (ROOT/'models/csgo/anime-nature.glb').stat().st_size,flush=True)
