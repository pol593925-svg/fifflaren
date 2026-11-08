"""Illustrated companions with expressive faces and continuous tapered silhouettes.
Authoring pivots are collapsed into one skinned draw call by CS16Graphics.
"""
import bpy, math, importlib.util, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
# Reuse the original proportions and animation hinge contract, without running its export loop.
source=Path(__file__).with_name('build_pets.py').read_text(encoding='utf8')
scope={'__file__':str(Path(__file__).with_name('build_pets.py'))}
exec(compile(source[:source.rfind('\nfor kind in (')],str(Path(__file__)), 'exec'),scope)
a=scope['a'];join=a.join_parts;a.join_parts=lambda root:None

def sweep(name,points,radii,mat,parent,sides=14,flatten=1):
 verts=[];faces=[]
 for i,(p,r) in enumerate(zip(points,radii)):
  tangent=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized()
  axis=tangent.cross(Vector((0,0,1)))
  if axis.length<.01:axis=tangent.cross(Vector((1,0,0)))
  axis.normalize();up=tangent.cross(axis).normalized()
  for j in range(sides):verts.append(tuple(Vector(p)+r*(axis*math.cos(j*math.tau/sides)+up*math.sin(j*math.tau/sides)*flatten)))
 for i in range(len(points)-1):
  for j in range(sides):k=i*sides+j;q=i*sides+(j+1)%sides;faces.append((k,q,q+sides,k+sides))
 faces.extend([tuple(reversed(range(sides))),tuple(range(len(verts)-sides,len(verts)))])
 return a.mesh(name,verts,faces,mat,parent)

def build(kind):
 root=scope['build'](kind);head=next(o for o in root.children if o.name=='petHead');body=next(o for o in root.children if o.name=='body')
 colours={'fox':(.86,.34,.08),'dragon':(.53,.16,.20),'owl':(.24,.42,.55),'golem':(.37,.49,.32),'deer':(.57,.39,.73)}
 fur=a.surface('Soft fur',colours[kind],.88);cream=a.surface('Ivory fur',(.91,.81,.61),.9)
 pink=a.surface('Ear velvet',(.60,.24,.27),.9);ink=a.surface('Ink',(.025,.035,.052),.6)
 gold=a.surface('Gold',(.81,.56,.22),.55);teal=a.surface('Cloth',(.12,.34,.38),.85)
 iris=a.surface('Jewel eyes',(.20,.55,.61) if kind!='golem' else (.43,.86,.66),.45)
 light=a.surface('Catchlight',(1,.96,.85),.3)
 def orb(n,p,s,m,parent,seg=16,rings=10):return a.orb(n,p,s,m,parent,seg,rings)
 # Continuous tapered tails and wings replace overlapping balls and flat quadrilaterals.
 for ob in list(root.children_recursive):
  if ob.type!='MESH':continue
  if ob.name.startswith(('Fluffy tail','White tail','Wing','Ear')):bpy.data.objects.remove(ob,do_unlink=True)
  elif ob.name.startswith('Rounded body') and kind in ['fox','deer']:
   for v in ob.data.vertices:v.co.x*=.92;v.co.y*=1.08
 # Eyes share a centered pivot so blinking does not move the face itself.
 eyes=a.empty('petEyes',(0,.15,-.20),head)
 bpy.context.view_layer.update()
 for ob in list(head.children):
  if ob.type=='MESH' and ob.name.startswith('Eye'):
   matrix=ob.matrix_world.copy();ob.parent=eyes;ob.matrix_world=matrix
 for side in [-1,1]:
  x=side*.105
  orb('Iris',(x,0,-.025),(.034,.047,.010),iris,eyes)
  orb('Pupil',(x+.002,.002,-.034),(.017,.034,.006),ink,eyes,12,8)
  orb('Large eye light',(x-.012,.022,-.039),(.011,.015,.004),light,eyes,10,6)
  orb('Small eye light',(x+.013,-.015,-.039),(.005,.006,.003),light,eyes,8,6)
  a.line('Soft brow',[(x-side*.041,.225,-.185),(x,.239,-.204),(x+side*.042,.23,-.179)],.009,fur,head)
  if kind in ['fox','deer','dragon','owl']:
   ear=a.empty('earL' if side<0 else 'earR',(side*.17,.24,0),head)
   if kind=='deer':
    sweep('Velvet ear',[(0,0,0),(side*.07,.045,.01),(side*.14,.09,.02)],[.045,.052,.001],fur,ear,14,.5)
    sweep('Ear lining',[(side*.015,.01,-.025),(side*.075,.05,-.018),(side*.12,.08,.005)],[.015,.026,.001],pink,ear,12,.42)
   else:
    sweep('Shaped ear',[(0,0,0),(side*.015,.075,.012),(side*.045,.18,.04)],[.065,.047,.001],fur,ear,16,.56)
    sweep('Inner velvet',[(0,.022,-.034),(side*.018,.075,-.021),(side*.038,.14,.012)],[.027,.025,.001],pink if kind!='owl' else cream,ear,12,.42)
  if kind=='fox':
   for k in range(3):sweep('Cheek lock',[(side*.13,.06-k*.022,-.15),(side*(.22+k*.012),.06-k*.035,-.10),(side*(.24+k*.015),.03-k*.04,-.07)],[.045,.030,.001],cream,head,10)
 if kind in ['fox','deer','dragon']:
  a.line('Muzzle smile',[(0,.045,-.278),(0,.02,-.274),(.033,.015,-.252)],.0035,ink,head)
  # A curved colour patch follows the body surface; intersecting ellipsoids leave holes.
  verts=[];faces=[];rx=.22*(.92 if kind in ['fox','deer'] else 1)+.004;rz=.30*(1.08 if kind in ['fox','deer'] else 1)+.004
  for row in range(17):
   t=row/16;latitude=-.82+t*1.83;width=.82*math.sin(math.pi*(.02+t*.96))**.40
   for col in range(13):
    angle=(col/12*2-1)*width
    verts.append((rx*math.cos(latitude)*math.sin(angle),.30+.244*math.sin(latitude),-rz*math.cos(latitude)*math.cos(angle)))
  for row in range(16):
   for col in range(12):n=row*13+col;faces.append((n,n+1,n+14,n+13))
  a.mesh('Curved ivory breast',verts,faces,cream,body)
  for side in [-1,1]:
   for front in [True,False]:
    leg=next(o for o in root.children if o.name=='leg'+('L' if side<0 else 'R')+('F' if front else 'B'))
    sweep('Tapered leg',[(0,.08,0),(side*.01,-.025,.005),(side*.01,-.13,-.015)],[.052,.038,.028],fur,leg,12)
    for j in [-1,0,1]:orb('Soft toe',(j*.027,-.179,-.066),(.018,.027,.026),cream,leg,10,6)
 if kind=='fox':
  tail=next(o for o in root.children if o.name=='tail')
  pts=[(0,0,0),(.07,.03,.12),(.16,.11,.25),(.23,.22,.35),(.23,.35,.38),(.17,.43,.33)]
  sweep('Swept fluffy tail',pts,[.07,.10,.15,.14,.075,.001],fur,tail,24,.94)
  sweep('Ivory tail tip',pts[3:],[.142,.078,.001],cream,tail,24,.94)
  sweep('Teal neck ribbon',[(math.sin(j*math.tau/24)*.15,.46,-.18+math.cos(j*math.tau/24)*.12)for j in range(25)],[.022]*25,teal,body,8)
  orb('Sun collar charm',(0,.42,-.308),(.035,.04,.012),gold,body)
 if kind=='deer':
  tail=a.empty('tail',(0,.35,.27),root);sweep('Leaf tail',[(0,0,0),(0,.08,.11),(0,.12,.17)],[.045,.06,.001],cream,tail)
  for side in [-1,1]:
   for k in range(6):
    y=.39+(k%2)*.055;z=.02+(k//2)*.075;x=.2024*math.sqrt(max(.01,1-((y-.30)/.24)**2-(z/.324)**2))
    orb('Ivory fur spot',(side*(x+.003),y,z),(.008,.017,.023),cream,body,10,6)
 if kind in ['dragon','owl']:
  for side in [-1,1]:
   wing=next(o for o in root.children if o.name=='limb'+('L' if side<0 else 'R'))
   if kind=='owl':
    orb('Wing shoulder',(side*.07,0,.01),(.14,.12,.13),fur,wing)
    for k in range(6):orb('Layered feather',(side*(.12+k*.045),-.035-k*.022,.05+k*.012),(.064,.063,.20-k*.018),cream if k%3==0 else fur,wing,14,8)
   else:
    outline=[(0,0,0),(.16,.22,.01),(.48,.29,.05),(.39,.13,.12),(.42,-.04,.24),(.26,.03,.19),(.19,-.14,.23),(.10,-.06,.12),(0,-.13,.08)]
    verts=[(side*x,y,z)for x,y,z in outline]+[(side*.15,.04,.10)]
    ob=a.mesh('Scalloped membrane',verts,[(9,k,(k+1)%9)for k in range(9)],pink,wing);pink.use_backface_culling=False
    for k in [2,4,6]:sweep('Wing rib',[(0,0,0),(side*.14,.09,.07),verts[k]],[.022,.013,.001],gold,wing,10)
  if kind=='dragon':
   tail=a.empty('tail',(0,.30,.25),root);sweep('Dragon tail',[(0,0,0),(.06,-.02,.16),(.16,.02,.29),(.23,.14,.32)],[.075,.055,.03,.001],fur,tail)
   for k in range(4):sweep('Back crest',[(0,.49,.01+k*.085),(0,.59,.04+k*.085),(0,.50,.08+k*.085)],[.029,.001,.022],gold,body,8)
  else:
   orb('Ivory feather breast',(0,.32,-.22),(.16,.20,.046),cream,body)
   for row in range(3):
    for j in range(5):orb('Breast feather',((j-2)*.054,.42-row*.073,-.264+abs(j-2)*.016),(.03,.045,.014),fur,body,10,6)
 if kind=='golem':
  orb('Emerald heart',(0,.37,-.295),(.055,.075,.022),iris,body)
  for side in [-1,1]:
   arm=next(o for o in root.children if o.name=='limb'+('L' if side<0 else 'R'))
   for j in [-1,0,1]:orb('Stone fingers',(side*.115+j*.04,-.29,-.10),(.026,.05,.03),cream,arm,10,6)
   for j in range(3):a.line('Carved chest seam',[(side*.05,.39-j*.055,-.285),(side*.15,.42-j*.055,-.26),(side*.21,.40-j*.055,-.21)],.008,cream,body)
 # Bake broad painted gradients into vertex colours, requiring no extra textures or lights.
 combined=a.surface('Painted pet',(1,1,1),.85);combined.use_backface_culling=False
 vc=combined.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color';combined.node_tree.links.new(vc.outputs['Color'],combined.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 for ob in root.children_recursive:
  if ob.type!='MESH':continue
  attr=ob.data.color_attributes.get('Color');prior=attr is not None
  if not prior:attr=ob.data.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER')
  base=tuple(ob.data.materials[0].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value)
  for poly in ob.data.polygons:
   poly.use_smooth=True
   for li in poly.loop_indices:
    v=ob.data.vertices[ob.data.loops[li].vertex_index];shade=.84+.13*max(0,v.normal.z)+.025*math.sin(v.co.x*17+v.co.z*11)
    c=attr.data[li].color[:] if prior else base;attr.data[li].color=tuple(min(1,n*shade)for n in c[:3])+(1,)
  ob.data.materials.clear();ob.data.materials.append(combined)
 join(head);join(root);return root

for kind in ('fox','dragon','owl','golem','deer'):
 bpy.ops.wm.read_factory_settings(use_empty=True);root=build(kind);a.export(root,ROOT/'models/csgo'/('pet-'+kind+'.glb'))
 if '--portraits' in sys.argv:
  root.scale=(2,2,2);scope['h'].portrait(root,ROOT/'assets/cs16'/('pet-'+kind+'.png'))
print('ANIME_PETS_BUILT',flush=True)
