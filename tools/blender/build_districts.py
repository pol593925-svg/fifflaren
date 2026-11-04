"""Bake the six Stone Coast landmarks. Run in Blender from the client repo with Node on PATH."""
import bpy, math, json, subprocess, random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
places=json.loads(subprocess.check_output(['node','-e',"console.log(JSON.stringify(require('./royale-core').landmarks))"],cwd=ROOT))
bpy.ops.wm.read_factory_settings(use_empty=True)
palette={'steel':(.115,.15,.15,.55),'zinc':(.42,.46,.44,.55),'ochre':(.52,.28,.068,.4),'oxide':(.36,.13,.064,.34),'concrete':(.46,.45,.39,0),'timber':(.31,.21,.12,0),'glass':(.21,.36,.36,.34),'canvas':(.60,.45,.26,0),'green':(.19,.29,.23,.22)}
mats={}
for name,(r,g,b,metal) in palette.items():
    m=bpy.data.materials.new(name);m.diffuse_color=(r,g,b,1);m.use_nodes=True
    n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(r,g,b,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=.45 if metal else .77;mats[name]=m
def panel(points,mat):
    v,f=parts.setdefault(mat,([],[]));n=len(v);v.extend([(x,-z,y) for x,y,z in points]);f.append(tuple(range(n,n+len(points))))
def box(x,y,z,w,h,d,m):
    vs=[(x+a*w/2,y+b*h,z+c*d/2) for a,b,c in [(-1,0,-1),(1,0,-1),(1,0,1),(-1,0,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]]
    for face in [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]:panel([vs[i] for i in face],m)
def beam(a,b,r,m,sides=6,end=None):
    A,B=Vector(a),Vector(b);d=(B-A).normalized();v=d.cross(Vector((0,1,0)) if abs(d.y)<.95 else Vector((1,0,0))).normalized();u=d.cross(v)
    rings=[[p+(v*math.cos(t*math.tau/sides)+u*math.sin(t*math.tau/sides))*rad for t in range(sides)] for p,rad in [(A,r),(B,r if end is None else end)]]
    panel(rings[0][::-1],m);panel(rings[1],m)
    for t in range(sides):panel([rings[0][t],rings[0][(t+1)%sides],rings[1][(t+1)%sides],rings[1][t]],m)
def truss(a,b,y,h,z,m):
    beam((a,y,z),(b,y,z),.18,m);beam((a,y+h,z),(b,y+h,z),.17,m)
    for i in range(12):
        x=a+(b-a)*i/12;xx=a+(b-a)*(i+1)/12;beam((x,y+(i%2)*h,z),(xx,y+(1-i%2)*h,z),.12,m)
for site in places:
    parts={};key=site['key'];parent=bpy.data.objects.new(key,None);bpy.context.collection.objects.link(parent)
    for i,(x,y,z,w,h,d) in enumerate(site['solids']):
        if key=='foundry':
            rr=w*.59;beam((x,0,z),(x,h,z),rr,'zinc' if i<2 else 'oxide',24);beam((x,h,z),(x,h+1.6,z),rr,'steel',24,.28)
            for j in range(1,int(h/2)):beam((x,j*2,z),(x,j*2+.11,z),rr+.05,'steel',24)
        else:box(x,y,z,w,h,d,'oxide' if key=='port' and i>=4 else 'timber' if key=='market' else 'steel')
        if key=='port' and i>=4:
            for j in range(int(w*2)):box(x-w/2+j*.51+.15,y+.08,z,.07,h-.16,d+.075,'ochre' if i==4 else 'oxide')
            for end in [-1,1]:box(x+end*(w/2-.05),y,z,.09,h,d+.13,'zinc')
    if key=='relay':
        for i in range(7):
            w=5-i*.59;n=w-.59;y=i*4.7
            for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]:
                beam((a*w,y,b*w),(a*n,y+4.7,b*n),.18,'oxide' if i%2==0 else 'zinc')
                beam((a*w,y,b*w),(-a*n,y+4.7,b*n),.078,'steel');beam((a*w,y,b*w),(a*n,y+4.7,-b*n),.075,'steel')
        beam((0,31,0),(0,40,0),.085,'oxide');beam((2,24,0),(5,25,0),.65,'zinc',20,2)
    if key=='port':
        for z in [-9,9]:truss(-21,31,18,3.4,z,'ochre')
        for x in [-18,18]:beam((x,19,-9),(x,19,9),.43,'ochre');beam((x,1,-9),(x,18,9),.26,'steel')
        for z in [-2,2]:beam((23,19,z),(23,7,z),.045,'steel')
        box(23,6.4,0,4,.42,5,'ochre');box(-15,18,0,5,3.5,5,'green')
    if key=='foundry':
        for x in [-11,5]:beam((x,10,0),(x,10,7),.62,'oxide',14);beam((x,10,7),(x,3,7),.62,'oxide',14)
        beam((-11,3,7),(5,3,7),.62,'oxide',14)
        for t in range(14):beam((4,1+t,4.2),(5,1+t,4.2),.04,'ochre')
    if key=='station':
        for z in [-4,4]:truss(-20,20,5.45,.6,z,'green')
        for x in range(-18,19,4):
            for z in [-1,1]:beam((x,6,z*6),(x,8.4,0),.13,'zinc')
        for side in [-1,1]:panel([(-20,6,side*6),(20,6,side*6),(20,8.4,0),(-20,8.4,0)],'green')
        for z in [13,15]:box(0,.035,z,73,.10,.13,'zinc')
        for x in range(-35,36,2):box(x,.005,14,.3,.08,3,'timber')
        for x in range(-7,8):box(x,.28,14,.10,2.9,3.09,'oxide')
    if key=='garden':
        for x in range(-12,13,3):
            for z in [-1,1]:beam((x,8,z*6),(x,11,0),.12,'green');beam((x,0,z*6),(x,8,z*6),.11,'green')
        for z in [-1,1]:panel([(-13,8,z*6),(13,8,z*6),(13,11,0),(-13,11,0)],'glass')
    if key=='market':
        for x in [-9,0,9]:
            for z in [-5,5]:
                for sign in [-1,1]:beam((x+sign*2.5,0,z),(x+sign*2.5,3,z),.095,'timber')
                for j in range(6):
                    xx=x-3+j
                    for side in [-1,1]:panel([(xx,2.3,z+side*2.2),(xx+1,2.3,z+side*2.2),(xx+1,3.2,z),(xx,3.2,z)],'oxide' if j%2 else 'canvas')
                for j in [-1,0,1]:box(x+j*1.2,1,z,1,.45,.74,'timber')
    for name,(vs,fs) in parts.items():
        me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.materials.append(mats[name]);me.update()
        obj=bpy.data.objects.new(key+'_'+name,me);bpy.context.collection.objects.link(obj);obj.parent=parent
        uv=me.uv_layers.new(name='UVMap')
        for face in me.polygons:
            skip=max(range(3),key=lambda i:abs(face.normal[i]));axes=[k for k in range(3) if k!=skip]
            for idx in face.loop_indices:
                v=me.vertices[me.loops[idx].vertex_index].co;uv.data[idx].uv=(v[axes[0]]*.25,v[axes[1]]*.25)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'models/royale/districts.glb'),export_format='GLB',export_yup=True,export_animations=False)
print('DISTRICT KIT READY')
