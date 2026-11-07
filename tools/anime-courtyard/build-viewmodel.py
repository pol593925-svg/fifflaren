"""Original illustrated FPS hands and Aurora carbine, in physical metres."""
import bpy, math, importlib.util, json
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('wa',HERE.parent/'blender/build_weapons.py')
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w);a=w.a
bpy.ops.wm.read_factory_settings(use_empty=True)
def material(name,c):return a.surface(name,c,.65)
ivory=material('Enamel ivory',(.73,.65,.47));teal=material('Lacquer turquoise',(.035,.23,.25))
dark=material('Blue graphite',(.035,.046,.075));edge=material('Machined slate',(.11,.145,.19))
gold=material('Copper orange',(.68,.25,.075));rubber=material('Soft indigo grip',(.019,.027,.043))
def tube(name,points,radii,mat,parent,sides=12):
 verts=[];faces=[]
 for i,(p,r) in enumerate(zip(points,radii)):
  d=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])).normalized()
  n=d.cross(Vector((0,1,0)) if abs(d.y)<.9 else Vector((1,0,0))).normalized();v=d.cross(n)
  for j in range(sides):verts.append(tuple(Vector(p)+r*(n*math.cos(j*math.tau/sides)+v*math.sin(j*math.tau/sides))))
 for i in range(len(points)-1):
  for j in range(sides):f=i*sides+j;g=i*sides+(j+1)%sides;faces.append((f,g,g+sides,f+sides))
 faces.extend([tuple(reversed(range(sides))),tuple(range(len(verts)-sides,len(verts)))])
 return a.mesh(name,verts,faces,mat,parent)
root=a.empty('aurora');body=a.empty('weapon',parent=root)
# Separate receiver layers, a real trigger aperture and a recognisable silhouette.
w.receiver_profile('Graphite chassis',[(.18,-.015),(.16,.049),(-.15,.049),(-.19,.015),(-.15,-.092),(.08,-.094)],.087,dark,body)
w.receiver_profile('Upper enamel',[(.16,.015),(.16,.065),(-.34,.065),(-.39,.028),(-.35,-.021),(-.15,-.032),(-.10,.016)],.092,ivory,body)
w.receiver_profile('Side turquoise insert',[(.15,.014),(-.135,.014),(-.19,-.027),(-.12,-.045),(.10,-.059)],.095,teal,body)
w.receiver_profile('Lower enamel',[(.16,-.019),(.125,-.065),(.062,-.077),(.04,-.050),(-.048,-.049),(-.086,-.083),(-.144,-.074),(-.16,-.030)],.102,ivory,body)
w.receiver_profile('Fore end bumper',[(-.18,-.05),(-.35,-.043),(-.398,-.005),(-.39,.045),(-.36,.06),(-.34,.005),(-.17,.005)],.079,edge,body)
for side in [-1,1]:
 for z in [-.21,-.254,-.298,-.342]:
  a.box('Recessed vent',(side*.049,.022,z),(.004,.023,.025),rubber,body,.004)
  a.box('Vent rim',(side*.052,.009,z),(.003,.004,.023),edge,body,.001)
 a.box('Magazine release',(side*.055,-.036,-.045),(.009,.019,.026),gold,body,.004)
 a.box('Inset serial plate',(side*.050,.028,.035),(.003,.016,.063),dark,body,.003)
 for j in range(4):a.box('Serial engraving',(side*.052,.028,.018+j*.009),(.001,.007,.003),ivory,body,.0002)
 for z in [-.13,.12]:w.cyl('Flush pin',(side*.054,-.016,z),.0045,.004,edge,body,'x',12)
w.cyl('Barrel',(0,.031,-.442),.015,.12,dark,body)
for z in [-.402,-.457]:w.cyl('Barrel collars',(0,.031,z),.022,.025,edge,body)
w.cyl('Muzzle brake',(0,.031,-.51),.028,.078,teal,body)
for side in [-1,1]:
 for z in [-.49,-.512,-.534]:a.box('Muzzle brake slots',(side*.027,.031,z),(.006,.021,.009),rubber,body,.002)
w.cyl('Muzzle bore',(0,.031,-.550),.017,.003,rubber,body)
w.receiver_profile('Angled grip',[(.071,-.055),(.038,-.073),(.077,-.187),(.122,-.175),(.102,-.067)],.041,rubber,body)
for side in [-1,1]:
 for j in range(6):a.box('Grip moulding',(side*.022,-.092-j*.012,.061+j*.003),(.003,.004,.029),edge,body,.001)
tube('Open trigger guard',[(0,-.071,.061),(0,-.123,.025),(0,-.126,-.029),(0,-.067,-.054)],[.006]*4,dark,body)
tube('Trigger',[(0,-.069,.013),(0,-.096,.008),(0,-.103,-.004)],[.004]*3,gold,body)
mag=a.empty('magazine',parent=root)
w.receiver_profile('Banana magazine',[(-.14,-.054),(-.144,-.151),(-.106,-.235),(-.052,-.221),(-.084,-.143),(-.076,-.055)],.053,dark,mag)
for side in [-1,1]:
 for j in range(3):a.box('Magazine enamel stripe',(side*.027,-.105-j*.028,-.111+j*.004),(.003,.015,.036),teal,mag,.003)
a.box('Magazine heel',(0,-.228,-.082),(.066,.018,.062),gold,mag,.005)
w.receiver_profile('Stock bridge',[(.16,.031),(.31,.031),(.33,-.016),(.18,-.030)],.053,edge,body)
w.receiver_profile('Contoured shoulder stock',[(.24,.028),(.34,.045),(.39,.024),(.39,-.107),(.34,-.116),(.29,-.053),(.24,-.028)],.072,ivory,body)
a.box('Cheek rest',(0,.049,.316),(.071,.025,.12),teal,body,.011)
a.box('Stock pad',(0,-.04,.395),(.083,.149,.025),rubber,body,.009)
for z in [-.135,-.105,-.075,-.045,-.015,.015,.045,.075,.105]:a.box('Rail tooth',(0,.075,z),(.047,.012,.014),edge,body,.002)
for side in [-1,1]:
 # Stylised copper laurel emblem, real raised relief.
 tube('Laurel stem',[(side*.054,-.004,.101),(side*.054,-.015,.079),(side*.054,-.029,.052)],[.0018]*3,gold,body,6)
 for j in range(4):
  z=.058+j*.012;y=-.025+j*.008
  for d in [-1,1]:a.orb('Laurel leaf',(side*.055,y+d*.006,z),(.0018,.004,.009),gold,body,10,5)
# Bevelled hood with four frame rails; no opaque lens blocking the sight picture.
for x in [-.037,.037]:a.box('Reflex side',(x,.145,-.048),(.009,.070,.047),dark,body,.004)
a.box('Reflex hood',(0,.181,-.048),(.074,.009,.047),edge,body,.004)
a.box('Reflex mount',(0,.105,-.048),(.080,.022,.06),dark,body,.005)
a.box('Optic copper accent',(0,.114,-.022),(.065,.009,.002),gold,body,.002)
w.cyl('Windage dial',(.046,.131,-.047),.011,.010,edge,body,'x',18)
a.join_parts(root);results=[w.export(root,HERE/'assets/aurora-rifle.glb')]

bpy.ops.wm.read_factory_settings(use_empty=True)
navy=material('Ink blue glove',(.024,.038,.066));panel=material('Glove raised panels',(.058,.08,.13))
skin=material('Warm fingers',(.59,.29,.17));sleeve=material('Cream tailored sleeve',(.67,.61,.47));seam=material('Sleeve turquoise stripe',(.025,.22,.24))
gold=material('Copper cuff clasp',(.68,.27,.075));root=a.empty('hands')
def forearm(parent,side,wrist):
 x,y,z=wrist;pts=[];rr=[]
 for i in range(20):
  t=i/19;pts.append((x+side*(.17*t+.035*math.sin(t*math.pi)),y-.13*t,z+.47*t));rr.append(.044+.026*t+.003*math.sin(t*24))
 tube('Tailored forearm',pts,rr,sleeve,parent,24)
 tube('Navy wrist cuff',pts[:4],[r+.002 for r in rr[:4]],navy,parent,20)
 # Broad coloured seam and copper wrist hardware.
 tube('Turquoise sleeve piping',[(p[0]+side*r*.55,p[1]+r*.75,p[2]) for p,r in zip(pts[3:],rr[3:])],[.006]*17,seam,parent,8)
 for i in [7,11,15]:
  x1,y1,z1=pts[i];r=rr[i];tube('Fabric crease',[(x1-r*.7,y1+r*.6,z1-.01),(x1,y1+r,z1),(x1+r*.7,y1+r*.6,z1+.01)],[.0016]*3,navy,parent,6)
 a.box('Cuff clasp',(x+side*.035,y+.028,z+.031),(.022,.011,.027),gold,parent,.003)
def hand(name,side,support):
 p=a.empty(name,parent=root)
 if support:
  tube('Support palm',[(-.048,-.025,.063),(-.052,-.023,.023),(-.049,-.018,-.025)],[.027,.038,.030],navy,p,20)
  for j in range(4):
   z=-.026+j*.019
   pts=[(-.050,-.012,z),(-.048,-.035,z-.002),(-.025,-.044,z-.004),(.002,-.043,z-.004),(.022,-.024,z-.003)]
   tube('Fingerless glove',pts[:3],[.011,.012,.011],panel,p,12);tube('Curled finger',pts[2:],[.0105,.009,.0055],skin,p,14)
   a.orb('Knuckle panel',(-.053,-.019,z),(.008,.012,.009),panel,p,12,8)
  tube('Visible support thumb',[(-.057,-.008,.036),(-.060,.014,.020),(-.049,.033,-.011),(-.033,.034,-.035)],[.014,.014,.012,.007],skin,p,16)
  forearm(p,-1,(-.052,-.028,.066))
 else:
  tube('Right palm',[(.032,-.034,.069),(.038,-.009,.040),(.037,.009,.010)],[.030,.040,.032],navy,p,20)
  for j in range(4):
   y=.026-j*.020
   pts=[(.039,y,.010),(.044,y,-.012),(.028,y-.003,-.034),(.005,y-.005,-.039),(-.012,y-.004,-.027)]
   tube('Glove finger base',pts[:3],[.012,.011,.010],panel,p,12);tube('Warm fingertip',pts[2:],[.010,.009,.0055],skin,p,14)
   a.orb('Back knuckle pad',(.049,y,.002),(.006,.009,.013),panel,p,12,8)
  tube('Opposing right thumb',[(.029,.009,.053),(.013,.030,.043),(-.012,.033,.025),(-.025,.023,.002)],[.015,.014,.012,.006],skin,p,16)
  forearm(p,1,(.039,-.029,.071))
 return p
hand('leftHand',-1,True);hand('rightHand',1,False)
a.join_parts(root);results.append(w.export(root,HERE/'assets/anime-hands.glb'))
(HERE/'assets/manifest.json').write_text(json.dumps(results,indent=2))
print('VIEWMODEL_BUILT',json.dumps(results))
