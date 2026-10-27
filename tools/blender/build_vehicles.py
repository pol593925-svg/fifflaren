"""Original two-seat vehicle fleet. Blender 4.5+, no external assets.
Forward +X; glTF Y up. Named pivots match cs16.js animation contract.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,c,metal=0,rough=.45):
    m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m
steel=mat('Gunmetal machined edges',(.10,.13,.15),.8,.28)
rubber=mat('Track rubber',(.025,.032,.035),.1,.8)
glass=mat('Smoked blue cockpit glass',(.035,.16,.22),.65,.15)
light=mat('Warm headlamps',(.85,.72,.4),.2,.2)
light.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(1,.65,.2,1)
light.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=2
def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=parent;return o
def finish(o,name,m,parent,bevel=.04):
    o.name=name;o.data.materials.append(m);o.parent=parent
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Rounded manufactured edges','BEVEL');b.width=bevel;b.segments=2
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
        o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
    return o
def box(name,pos,size,m,parent,bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.dimensions=size
    return finish(o,name,m,parent,bevel)
def cyl(name,pos,r,depth,m,parent,axis='z',verts=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=pos);o=bpy.context.object
    if axis=='x':o.rotation_euler.y=math.pi/2
    if axis=='y':o.rotation_euler.x=math.pi/2
    return finish(o,name,m,parent,.015)
def build(variant):
    heavy=variant in ('bastion','storm');heli=variant in ('heli','storm');root=empty(variant)
    paint=mat(variant+' ceramic armour',(.20,.27,.18) if variant=='tank' else (.30,.26,.18) if variant=='bastion' else (.16,.24,.29) if variant=='heli' else (.15,.18,.22),.45,.48)
    trim=mat(variant+' camouflage panels',(.10,.14,.10) if not heli else (.07,.11,.14),.4,.55)
    if not heli:
        box('Armoured hull',(0,0,1.05),(4.7,2.8,.85),paint,root,.22)
        plate=box('Sloped glacis',(1.95,0,1.35),(.9,2.7,.3),trim,root);plate.rotation_euler.y=-.25
        for side in [-1,1]:
            box('Continuous track',(0,side*1.48,.56),(4.9,.53,1.06),rubber,root,.20)
            for i in range(7):
                x=-1.95+i*.65
                cyl('Road wheel',(x,side*1.76,.57),.40,.08,steel,root,'y')
                cyl('Wheel hub',(x,side*1.82,.57),.14,.07,paint,root,'y')
            for i in range(22):
                x=-2.3+i*.22
                for z in [.08,1.03]:box('Individual track link',(x,side*1.48,z),(.16,.58,.10),steel,root,.015)
            for i in range(6):box('Side armour module',(-1.9+i*.76,side*1.50,1.25),(.68,.18,.53),paint,root)
            cyl('Headlight',(2.4,side*1.05,1.15),.13,.09,light,root,'x')
        t=empty('Turret',(-.25,0,1.55),root)
        box('Turret armour',(0,0,.35),(2.35,2.05,.85),paint,t,.24)
        box('Turret rear storage',(-1.4,0,.28),(.6,1.8,.6),trim,t)
        barrel=empty('Barrel',(0,0,0),t)
        cyl('Cannon tube',(2.1,0,.43),.12,3.1,steel,barrel,'x')
        cyl('Thermal sleeve',(1.1,0,.43),.19,1.2,paint,barrel,'x')
        box('Muzzle brake',(3.7,0,.43),(.35,.34,.26),steel,barrel)
        cyl('Commander hatch',(-.35,.45,.84),.42,.13,steel,t)
        for side in [-1,1]:
            for i in range(4 if heavy else 2):box('Reactive armour',(.1+i*.36,side*1.04,.5),(.3,.16,.34),trim,t)
            cyl('Rocket tube',(.2,side*1.2,.70),.15,1.35,steel,t,'x')
        g=empty('Gun',(-.5,-.48,2.55),root)
        box('Machine gun receiver',(.15,0,0),(.65,.20,.2),steel,g)
        cyl('Machine gun barrel',(.85,0,0),.055,1.1,steel,g,'x')
        cyl('Radio antenna',(-1.8,.7,2.0),.018,2,steel,root)
        for i in range(9):box('Engine vent',(-1.7+i*.1,0,1.51),(.045,1.1,.04),steel,root,.005)
    else:
        box('Armoured fuselage',(.1,0,1.45),(3.5,1.65,1.65),paint,root,.40)
        nose=box('Tandem canopy',(1.3,0,1.9),(2.0,1.45,1.25),glass,root,.35);nose.rotation_euler.y=.16
        for x in [.65,1.55]:box('Canopy frame',(x,0,2.49),(.09,1.46,.07),steel,root)
        box('Tail boom',(-3,0,1.70),(3.5,.40,.45),paint,root,.12)
        fin=box('Vertical tail',(-4.5,0,2.30),(.75,.14,1.65),trim,root);fin.rotation_euler.y=-.3
        box('Tail stabilizer',(-3.9,0,1.8),(.65,2,.12),paint,root)
        for side in [-1,1]:
            cyl('Engine',(-.5,side*.75,2.4),.30,1.7,paint,root,'x')
            cyl('Exhaust',(-1.45,side*.75,2.4),.24,.35,steel,root,'x')
            box('Weapon wing',(-.2,side*1.1,1.4),(1.0,1.65,.15),paint,root)
            cyl('Rocket pod',(.15,side*1.8,1.1),.32,1.25,steel,root,'x')
            for i in range(6 if heavy else 3):
                a=i*math.tau/6;cyl('Rocket tip',(.8,side*1.8+math.cos(a)*.2,1.1+math.sin(a)*.2),.065,.08,light,root,'x',12)
            box('Landing skid',(-.2,side*1.0,.15),(4,.13,.13),steel,root)
            for x in [-1.0,1.0]:box('Skid strut',(x,side*.8,.53),(.12,.12,.8),steel,root)
        cyl('Rotor mast',(-.4,0,2.9),.10,1.0,steel,root)
        r=empty('Rotor',(-.4,0,3.35),root)
        for i in range(4 if heavy else 3):
            a=i*math.tau/(4 if heavy else 3)
            b=box('Rotor blade',(math.cos(a)*2,math.sin(a)*2,0),(4,.23,.045),rubber,r,.015);b.rotation_euler.z=a
        cyl('Rotor hub',(-.4,0,3.35),.22,.15,steel,root)
        tr=empty('TailRotor',(-4.6,-.20,2.25),root)
        for a in [0,math.pi/2]:
            b=box('Tail blade',(0,0,0),(.06,1.15,.12),rubber,tr,.015);b.rotation_euler.x=a
        g=empty('Gun',(1.7,0,.65),root)
        box('Chin turret',(0,0,0),(.55,.55,.45),paint,g,.15)
        for i in range(3):cyl('Gatling barrel',(.55,math.cos(i*math.tau/3)*.09,math.sin(i*math.tau/3)*.09),.045,.9,steel,g,'x')
        cyl('Search lamp',(1.5,-.5,.8),.14,.15,light,root,'x')
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for o in root.children_recursive:o.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'models'/f'{variant}.glb'),export_format='GLB',use_selection=True,export_apply=True)
    for o in root.children_recursive:o.name=variant+'_'+o.name
    return root
fleet=[build(v) for v in ['tank','bastion','heli','storm']]
for o,pos in zip(fleet,[(-4,-4,0),(4,-4,0),(-4,4,0),(5,4,0)]):o.location=pos
floor=mat('Studio floor',(.035,.045,.055),.1,.65)
box('Display floor',(0,0,-.16),(25,24,.2),floor,None)
bpy.ops.object.camera_add(location=(19,-25,22));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=23;bpy.context.scene.camera=cam
for pos,power,size in [((3,-8,15),2600,10),((-10,4,10),2000,8),((9,9,10),2400,7)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.render.resolution_x=1400;sc.render.resolution_y=1000;sc.render.resolution_percentage=100
sc.world.color=(.16,.16,.16);sc.render.filepath=str(ROOT/'graphics-qa'/'vehicles-3330.png');(ROOT/'graphics-qa').mkdir(exist_ok=True)
bpy.ops.render.render(write_still=True)
