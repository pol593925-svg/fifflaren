"""Five original compact companions; one static draw call per pet."""
import importlib.util, math, json, sys
from mathutils import Vector
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('heroes',Path(__file__).with_name('build_heroes.py'));h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h);a=h.a
def build(kind):
 root=a.empty('pet_'+kind);body=a.empty('body',(0,0,0),root)
 color={'fox':(.92,.39,.12),'dragon':(.60,.16,.14),'owl':(.40,.57,.69),'golem':(.43,.55,.40),'deer':(.66,.52,.82)}[kind]
 fur=a.surface('Body',color,.85);cream=a.surface('Cream',(.94,.85,.66),.8);dark=a.surface('Eyes',(.035,.045,.065),.45);shine=a.surface('Catchlight',(1,1,1),.3);gold=a.surface('Details',(.90,.68,.28),.6)
 a.orb('Rounded body',(0,.3,0),(.22,.24,.30),fur,body,16,10);a.orb('Head',(0,.59,-.20),(.23,.22,.20),fur,body,20,12)
 for x in (-.105,.105):
  a.orb('Eye',(x,.63,-.37),(.05,.065,.025),dark,body,16,10);a.orb('Eye glint',(x-.014,.652,-.394),(.014,.019,.008),shine,body,10,6)
 if kind in ('fox','deer','dragon'):
  a.orb('Muzzle',(0,.51,-.36),(.13,.085,.11),cream,body);a.orb('Nose',(0,.54,-.455),(.035,.024,.025),dark,body)
  for x in (-.17,.17):
   a.loft('Ear',[(.72,.08,.05,x,-.17),(.9,.005,.008,x*1.25,-.15)],fur,body,10)
  for x in (-.15,.15):
   for z in (-.14,.19):a.orb('Foot',(x,.09,z),(.07,.10,.09),cream,body,12,8)
 if kind=='fox':
  a.orb('Fluffy tail',(.18,.28,.38),(.16,.19,.32),fur,body);a.orb('White tail tip',(.20,.31,.62),(.12,.14,.14),cream,body)
 if kind in ('owl','dragon'):
  for side in (-1,1):
   verts=[(side*.18,.52,.03),(side*.62,.68,.17),(side*.50,.35,.22),(side*.32,.18,.05)]
   a.mesh('Wing',verts,[(0,1,2),(0,2,3),(2,1,0),(3,2,0)],cream if kind=='owl' else gold,body)
  if kind=='owl':a.loft('Beak',[(.44,.005,.01,0,-.42),(.54,.055,.045,0,-.38)],gold,body,8)
 if kind=='golem':
  for x in (-.3,.3):a.orb('Stone arm',(x,.3,0),(.11,.21,.14),fur,body,8,6)
  for x in (-.12,.12):a.orb('Stone foot',(x,.07,-.05),(.11,.1,.15),fur,body,8,6)
  a.loft('Crystal crown',[(.76,.10,.07,0,-.15),(1.0,.001,.002,0,-.13)],gold,body,6)
 if kind=='deer':
  for side in (-1,1):
   a.line('Antler',[(side*.13,.74,-.1),(side*.17,.91,-.06),(side*.22,1.02,0)],.018,gold,body)
   a.line('Antler branch',[(side*.17,.91,-.06),(side*.29,.94,-.08)],.014,gold,body)
  for x in (-.12,0,.12):a.orb('Spirit spots',(x,.45,.17),(.025,.015,.025),shine,body,8,6)
 combined=a.surface('Painted pet',(1,1,1),.85);vc=combined.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color';combined.node_tree.links.new(vc.outputs['Color'],combined.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 for ob in list(root.children_recursive):
  if ob.type!='MESH':continue
  color=tuple(ob.data.materials[0].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value);attr=ob.data.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER')
  for d in attr.data:d.color=color
  ob.data.materials.clear();ob.data.materials.append(combined)
 # One shared material and a handful of real pivots per companion.
 bpy.context.view_layer.update()
 rigs={}
 for ob in list(body.children):
  if ob.type!='MESH':continue
  center=ob.matrix_world @ (sum((Vector(v) for v in ob.bound_box),Vector())/8)
  x,y,z=center.x,center.z,-center.y
  if ob.name.startswith(('Head','Eye','Ear','Muzzle','Nose','Beak','Antler','Crystal crown')):
   key,hinge='petHead',(0,.48,-.17)
  elif ob.name.startswith(('Foot','Stone foot')):
   key='leg'+('L' if x<0 else 'R')+('F' if z<0 else 'B');hinge=(x,.25,z)
  elif ob.name.startswith(('Wing','Stone arm')):
   key='limb'+('L' if x<0 else 'R');hinge=(math.copysign(.18,x),.45,0)
  elif ob.name.startswith(('Fluffy tail','White tail')):
   key,hinge='tail',(0,.28,.25)
  else:continue
  if key not in rigs:rigs[key]=a.empty(key,hinge,root)
  ob.parent=rigs[key];ob.location-=rigs[key].location
 a.join_parts(root);return root
for kind in ('fox','dragon','owl','golem','deer'):
 bpy.ops.wm.read_factory_settings(use_empty=True);root=build(kind);a.export(root,ROOT/'models/csgo'/('pet-'+kind+'.glb'))
 # Portrait helper expects a human-height subject; enlarge only after export.
 if '--portraits' in sys.argv:
  root.scale=(2,2,2);h.portrait(root,ROOT/'assets/cs16'/('pet-'+kind+'.png'))
print('PETS_BUILT')
