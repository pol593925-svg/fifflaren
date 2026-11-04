"""Original tactical weapon and glove assets, authored in Blender.

blender -b --python tools/blender/build_weapons.py -- --sources /absolute/dir
The local generated assets use glTF coordinates, forward -Z, with PBR finishes.
"""
import argparse, importlib.util, json, math, sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('operators',Path(__file__).with_name('build_characters.py'))
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)

def metal(name,color,rough=.36,metallic=.8):
    m=a.surface(name,color,rough,metallic)
    rng=np.random.default_rng(sum(map(ord,name)))
    n=512;px=np.ones((n,n,4),dtype=np.float32)
    noise=rng.normal(0,.009,(n,n));lines=rng.uniform(0,1,(n,1))*.012
    for k in range(3):px[:,:,k]=np.clip(color[k]+noise+lines,0,1)
    for i in range(100):
        x,y=rng.integers(0,n,2);length=int(rng.integers(2,18));px[y:y+1,x:min(n,x+length),:3]+=.045
    node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=a.image(name+'_finish',px)
    m.node_tree.links.new(node.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    # Fine machining relief and independently varied roughness catch grazing light.
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    rough_px=np.ones_like(px);rough_px[:,:,:3]=np.clip(rough+noise[:,:,None]*3+lines[:,:,None],.18,.95)
    rt=m.node_tree.nodes.new('ShaderNodeTexImage');rt.image=a.image(name+'_roughness',rough_px[::4,::4],False)
    m.node_tree.links.new(rt.outputs['Color'],bsdf.inputs['Roughness'])
    normal=np.ones_like(px);normal[:,:,0]=.5+(np.roll(noise,1,1)-noise)*1.3;normal[:,:,1]=.5+(np.roll(noise,1,0)-noise)*1.3
    nt=m.node_tree.nodes.new('ShaderNodeTexImage');nt.image=a.image(name+'_normal',normal[::4,::4],False)
    nm=m.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.35
    m.node_tree.links.new(nt.outputs['Color'],nm.inputs['Color']);m.node_tree.links.new(nm.outputs['Normal'],bsdf.inputs['Normal'])
    return m

def cyl(name,pos,radius,length,mat,parent,axis='z',vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=length)
    o=bpy.context.object;o.name=name;o.parent=parent;o.location=a.xyz(pos)
    if axis=='z':o.rotation_euler.x=math.pi/2
    elif axis=='x':o.rotation_euler.y=math.pi/2
    o.data.materials.append(mat)
    mod=o.modifiers.new('Machined edge','BEVEL');mod.width=.0015;mod.segments=2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in o.data.polygons:p.use_smooth=True
    return o

def build(kind):
    root=a.empty(kind);p=a.empty('weapon',parent=root)
    steel=metal('Parkerized steel',(.095,.11,.12),.4)
    edge=metal('Machined edges',(.23,.25,.26),.3)
    black=a.surface('Polymer',(.026,.032,.033),.68,fabric=True)
    wood=metal('Walnut laminate',(.27,.105,.04),.5,.0)
    green=a.surface('Olive rifle finish',(.18,.23,.14),.6)
    glass=a.surface('Coated scope glass',(.035,.12,.17),.08,.5)
    brass=a.surface('Brass hardware',(.45,.30,.09),.3,.8)
    def paint(material):
        result=material.copy();result.name='Weapon finish / '+material.name;return result
    painted_steel,painted_black,painted_wood,painted_green,painted_edge=map(paint,(steel,black,wood,green,edge))
    pistol=kind in ('glock','usp','deagle','fiveseven','tec9','elite')
    sniper=kind in ('awp','scout')
    ak=kind in ('ak47','galil')
    smg=kind in ('mp5','ump45','p90')
    bullpup=kind in ('aug','famas','p90')
    bodymat=painted_green if sniper or kind=='aug' else painted_black if kind=='p90' else painted_steel
    # Warm directional laminate grain, visible on the AK's stock and fore-end.
    woodnode=next(n for n in wood.node_tree.nodes if n.type=='TEX_IMAGE')
    grain=np.ones((512,512,4),dtype=np.float32)
    yy,xx=np.mgrid[:512,:512]
    rings=np.sin(xx*.15+np.sin(yy*.019)*5+np.sin(xx*.027)*3)
    tone=.82+.15*rings+.05*np.sin(xx*.73+yy*.008)
    grain[:,:,:3]=np.array([.30,.12,.045])[None,None,:]*tone[:,:,None]
    woodnode.image=a.image('Walnut directional grain',grain)
    next(n for n in painted_wood.node_tree.nodes if n.type=='TEX_IMAGE').image=woodnode.image
    if kind=='knife':
        a.box('Knife grip',(0,0,.055),(.035,.04,.14),black,p,.01)
        a.box('Finger guard',(0,0,-.02),(.09,.018,.023),edge,p,.003)
        verts=[(-.019,-.007,-.03),(.019,-.007,-.03),(.019,.007,-.03),(-.019,.007,-.03),(0,0,-.30),(-.019,0,-.10),(.019,0,-.10)]
        a.mesh('Sharpened bayonet blade',verts,[(0,1,2,3),(0,5,4,6,1),(3,2,6,4,5),(0,3,5),(1,6,2)],edge,p)
        for z in (.015,.04,.065,.09):cyl('Grip rings',(0,0,z),.025,.008,black,p)
    elif pistol:
        long=.26 if kind=='deagle' else .21
        slide= painted_edge if kind=='deagle' else painted_black if kind=='fiveseven' else painted_steel
        a.box('Slide',(0,.025,-.05),(.045,.045,long),slide,p,.004)
        a.box('Lower frame',(0,-.012,-.025),(.043,.035,long*.85),black,p,.004)
        grip=a.box('Textured grip',(0,-.075,.025),(.042,.105,.058),black,p,.008);grip.rotation_euler.x=-.17
        a.box('Magazine base',(0,-.126,.035),(.047,.012,.061),steel,p,.002)
        cyl('Barrel',(0,.025,-.05-long/2-.004),.012,.025,edge,p)
        cyl('Bore',(0,.025,-.05-long/2-.018),.0085,.001,black,p)
        a.box('Ejection port',(.023,.034,-.01),(.001,.021,.041),black,p,.001)
        for z in (.025,.035,.045,.055):a.box('Slide serration',(.023,.022,z),(.001,.027,.003),black,p,.0005)
        for y in (-.045,-.055,-.065,-.075,-.085,-.095):a.box('Grip stipple',(.022,y,.025),(.002,.003,.044),steel,p,.001)
        a.line('Trigger guard',[(-.017,-.022,.01),(-.017,-.06,-.025),(-.017,-.059,-.068),(-.017,-.025,-.077)],.004,steel,p)
        a.box('Front sight',(0,.055,-.13),(.009,.014,.01),black,p,.001)
        a.box('Rear sight',(0,.054,.04),(.035,.016,.012),black,p,.001)
        a.box('Safety',(.026,-.006,.02),(.009,.008,.027),edge,p,.002)
        if kind=='usp':
            cyl('USP suppressor',(0,.025,-.235),.023,.15,steel,p)
            cyl('Suppressor bore',(0,.025,-.312),.009,.002,black,p)
            for z in (-.17,-.20,-.27):cyl('Suppressor seam',(0,.025,z),.024,.004,black,p)
        if kind=='tec9':
            cyl('Tubular receiver',(0,.03,-.04),.036,.27,steel,p)
            a.box('Extended magazine',(0,-.18,.01),(.03,.17,.045),steel,p,.003)
            for z in (-.16,-.13,-.10):a.box('Barrel shroud vent',(.036,.03,z),(.003,.017,.015),black,p,.003)
        if kind=='deagle':
            a.box('Barrel rib',(0,.052,-.09),(.018,.012,.18),edge,p,.002)
        if kind=='elite':
            # Both pistols are present in the model, not one shared silhouette.
            original=list(p.children_recursive)
            for o in original:
                duplicate=o.copy();duplicate.data=o.data.copy() if o.data else None
                bpy.context.collection.objects.link(duplicate);duplicate.parent=p
                duplicate.location.x-=.09;o.location.x+=.09
    else:
        length=.68 if sniper else .40 if smg else .53
        receiver_len=.36 if bullpup else .29 if sniper else .23
        a.box('Receiver',(0,.005,-.04),(.075,.10,receiver_len),bodymat,p,.009)
        cyl('Upper receiver',(0,.052,-.065),.038,receiver_len,bodymat,p)
        a.box('Ejection chamber',(.039,.035,-.065),(.002,.037,.095),black,p,.002)
        cyl('Bolt carrier',(.041,.04,-.075),.008,.07,edge,p)
        # Machined pins and selector visible along the receiver.
        for z in (-.12,-.055,.025):cyl('Receiver pin',(.041,-.012,z),.006,.006,edge,p,'x',16)
        a.box('Fire selector',(.043,.008,.015),(.007,.013,.033),edge,p,.003)
        cyl('Barrel',(0,.035,-length/2-.10),.012 if smg else .016,length*.60,steel,p)
        cyl('Muzzle brake',(0,.035,-length*.80-.10),.021,.047,edge,p)
        cyl('Dark barrel bore',(0,.035,-length*.80-.125),.010,.002,black,p)
        for z in (-length*.80-.09,-length*.80-.11):cyl('Brake ring',(0,.035,z),.022,.005,black,p)
        fore_z=-.235
        a.box('Fore-end',(0,.015,fore_z),(.078,.075,.18),painted_wood if ak else bodymat,p,.008)
        if kind in ('mp5','ump45'):
            cyl('SMG handguard',(0,.025,-.24),.048,.17,black,p)
            if kind=='ump45':a.box('UMP polymer lower',(0,-.035,-.08),(.078,.09,.24),painted_black,p,.01)
        if kind=='p90':
            a.box('P90 rounded frame',(0,-.025,.045),(.10,.15,.34),painted_black,p,.025)
            a.box('P90 top magazine',(0,.12,-.12),(.085,.045,.34),painted_green,p,.012)
            for z in np.linspace(-.27,.02,18):cyl('Visible magazine cartridge',(0,.145,float(z)),.005,.068,brass,p,'x',10)
            a.box('Reflex sight bridge',(0,.17,-.15),(.07,.10,.10),black,p,.01)
            a.box('Reflex sight glass',(0,.19,-.204),(.044,.044,.004),glass,p,.002)
        if kind=='famas':
            for z in (-.23,.075):a.box('Carry handle post',(0,.11,z),(.045,.1,.045),black,p,.006)
            a.box('FAMAS carry handle',(0,.16,-.08),(.05,.04,.35),black,p,.007)
        for z in np.linspace(-.315,-.165,10):
            a.box('Cooling slots',(.040,.014,float(z)),(.001,.017,.008),black,p,.001)
            if not ak:a.box('Picatinny rail',(0,.062,float(z)),(.08,.012,.008),edge,p,.001)
        grip=a.box('Pistol grip',(0,-.103,.035),(.050,.123,.066),wood if ak else black,p,.009);grip.rotation_euler.x=-.20
        for y in np.linspace(-.14,-.07,6):a.box('Grip ribs',(.026,float(y),.04),(.002,.003,.044),steel,p,.001)
        # Trigger loop and the curved trigger itself.
        a.line('Trigger guard',[(-.029,-.045,.025),(-.029,-.094,-.014),(-.029,-.092,-.079),(-.029,-.045,-.087)],.005,steel,p)
        a.line('Trigger',[(0,-.04,-.018),(0,-.065,-.034),(0,-.079,-.025)],.004,edge,p)
        # Magazine silhouette with panel grooves.
        if kind=='m249':a.box('Ammunition box',(0,-.15,-.10),(.16,.19,.19),green,p,.012)
        elif kind=='p90':a.box('Horizontal magazine',(0,.09,-.18),(.065,.055,.27),black,p,.006)
        else:
            for i in range(6):
                yy=-.07-i*.029; zz=(.15 if bullpup else -.105)-(i*i*.002 if ak else i*.0015)
                a.box('Magazine section',(0,yy,zz),(.046,.033,.075),steel,p,.003)
                for x in (-.024,.024):a.box('Magazine pressed channel',(x,yy,zz-.017),(.002,.030,.004),edge,p,.001)
        # Shoulder stock with a rubberized cheek weld and separate butt pad.
        cyl('Stock buffer',(0,.023,.15),.022,.13,steel,p)
        if kind=='m4a1':
            # Open-frame telescoping stock; the tube, braces and rear rubber pad form the actual silhouette.
            cyl('Adjustable buffer tube',(0,.039,.221),.026,.265,painted_steel,p)
            cyl('Cheek saddle',(0,.046,.237),.034,.152,painted_black,p)
            a.box('Rubber rear pad',(0,-.015,.348),(.073,.125,.022),black,p,.009)
            for x in [-.026,.026]:
                a.line('Sloped stock brace',[(x,.016,.186),(x,-.058,.333),(x,.037,.333)],.010,painted_black,p)
                a.line('Release lever',[(x,-.002,.212),(x,-.012,.273)],.006,steel,p)
            for i in range(8):a.box('Pad grooves',(0,-.062+i*.013,.361),(.064,.003,.005),edge,p,.001)
            # Charging latch, forward assist and bolted rails read from the player's right shoulder.
            a.box('Charging handle',(0,.074,.057),(.098,.012,.019),edge,p,.003)
            a.box('Release latch',(-.044,.068,.047),(.014,.018,.039),black,p,.002)
            for x in [-.04,.04]:
                a.box('Side rail',(x,.023,-.233),(.012,.031,.154),steel,p,.002)
                for i in range(8):
                    a.box('Handguard rail lug',(x*1.18,.024,-.295+i*.017),(.008,.040,.007),edge,p,.001)
                for z in [-.121,.036]:cyl('Lower pin',(x,.013,z),.0048,.009,edge,p,'x',10)
            for i in range(10):a.box('Receiver rail tooth',(0,.086,-.12+i*.017),(.052,.009,.008),edge,p,.001)
        else:
            a.box('Shoulder stock',(0,.002,.24),(.085 if bullpup else .058,.15 if bullpup else .115,.14 if bullpup else .20),painted_wood if ak else painted_black,p,.012)
            a.box('Butt pad',(0,-.005,.346),(.066,.13,.018),black,p,.004)
            a.box('Cheek rest',(0,.065,.24),(.064,.025,.17),painted_wood if ak else painted_black,p,.006)
            for z in (.16,.20,.24,.28):a.box('Stock texture',(.03,.015,z),(.001,.048,.012),steel,p,.001)
        # Iron sights, gas block and barrel band.
        a.box('Front sight tower',(0,.071,-.37),(.025,.072,.025),steel,p,.002)
        cyl('Sight hood',(0,.113,-.37),.018,.018,steel,p)
        cyl('Sight aperture',(0,.113,-.381),.011,.001,black,p)
        a.box('Rear sight',(0,.088,.018),(.047,.025,.026),steel,p,.002)
        if kind=='m4a1':
            cyl('M4 suppressor',(0,.035,-.60),.028,.17,steel,p)
            cyl('M4 suppressor bore',(0,.035,-.687),.01,.002,black,p)
        if ak:cyl('Gas tube',(0,.077,-.275),.012,.22,steel,p)
        if sniper or kind in ('aug','sg552'):
            for z in (-.13,.015):a.box('Scope mount',(0,.102,z),(.048,.048,.025),steel,p,.003)
            cyl('Optical tube',(0,.145,-.07),.026,.27,steel,p)
            for z in (-.205,.075):
                cyl('Scope bell',(0,.145,z),.041,.055,steel,p)
                cyl('Optical lens',(0,.145,z+(-.029 if z<0 else .029)),.034,.002,glass,p)
                cyl('Lens retaining ring',(0,.145,z),.044,.006,black,p)
            # Rubber focus ring, stepped ocular housing and finely knurled turret.
            for zz in (.045,.051,.057,.063):cyl('Focus rib',(0,.145,zz),.043,.0025,black,p)
            for zz in (-.165,-.158):cyl('Mount clamp',(0,.145,zz),.029,.004,edge,p)
            for angle in np.linspace(0,math.tau,16,endpoint=False):
                x=math.sin(angle)*.021;z=-.07+math.cos(angle)*.021
                a.box('Turret grip',(float(x),.184,float(z)),(.003,.019,.003),black,p,.0005)
            cyl('Elevation dial',(0,.182,-.07),.022,.028,edge,p,'y')
            cyl('Windage dial',(.032,.145,-.07),.022,.028,edge,p,'x')
    if kind!='knife':
        # Fasteners, machined slots, trigger and a positive selector silhouette.
        for side in (-1,1):
            for z in ((-.025,.045) if pistol else (-.15,-.055,.04)):
                x=side*(.024 if pistol else .034)
                cyl('Recessed receiver pin',(x,.014,z),.006,.004,edge,p,'x',16)
                a.box('Pin screwdriver slot',(x+side*.0025,.014,z),(.001,.002,.008),black,p,.0005)
        a.line('Curved trigger',[(0,-.022,-.035),(0,-.038,-.043),(0,-.050,-.037)],.003,edge,p)
        if not pistol:
            a.box('Selector lever',(.039,.002,.028),(.009,.013,.045),edge,p,.003)
            a.box('Bolt handle stem',(.051,.043,-.055),(.043,.012,.014),steel,p,.003)
            cyl('Knurled charging handle',(.073,.043,-.055),.012,.022,black,p,'x',20)
            for z in (-.25,-.22,-.19):
                a.box('Handguard vent',(.030,.025,z),(.002,.012,.018),black,p,.003)
            a.line('Rear sling loop',[(-.03,-.04,.31),(-.045,-.06,.31),(-.02,-.078,.31),(0,-.06,.31)],.004,edge,p)
    if pistol:
        a.box('Magazine body',(0,-.079,.025),(.029,.085,.043),steel,p,.003)
    # Preserve the moving assemblies as pivots through glTF export.
    families={
        'magazine':('Magazine','Extended magazine','Horizontal magazine','Ammunition box','P90 top magazine','Visible magazine cartridge'),
        'bolt':('Bolt carrier','Bolt handle stem','Knurled charging handle'),
        'slide':('Slide','Front sight','Rear sight','Barrel rib') if pistol else (),
        'trigger':('Trigger','Curved trigger'),
    }
    for name,prefixes in families.items():
        parts=[o for o in list(p.children) if o.type=='MESH' and o.name.startswith(prefixes)
               and not o.name.startswith('Trigger guard')]
        if not parts:continue
        pivot=a.empty(name,parent=root)
        for part in parts:part.parent=pivot
    a.join_parts(root)
    return root

def hands():
    root=a.empty('viewmodel_hands')
    cloth=a.surface('Tactical sleeve',(.16,.20,.19),fabric=True)
    leather=a.surface('Reinforced leather gloves',(.065,.072,.064),.64,fabric=True)
    rubber=a.surface('Knuckle protection',(.033,.037,.031),.8)
    thread=a.surface('Glove stitching',(.34,.32,.25),.8)
    for side,x,y,z in [('right',.012,-.15,.045),('left',-.025,-.075,-.22)]:
        p=a.empty(side+'Hand',(x,y,z),root)
        a.orb('Glove palm',(0,0,0),(.049,.031,.067),leather,p,24,14)
        for k in range(4):
            xx=(k-1.5)*.022
            a.orb('Curled finger',(xx,.018,-.04),(.012,.032,.027),leather,p,16,10)
            a.orb('Knuckle',(xx,-.023,-.028),(.011,.008,.012),rubber,p,12,8)
            a.line('Finger seam',[(xx-.007,-.025,-.018),(xx-.007,-.027,-.04),(xx+.007,-.025,-.055)],.001,thread,p)
        a.orb('Thumb',(-.045,.008,.003),(.022,.018,.033),leather,p,16,10)
        a.box('Velcro wrist',(0,-.006,.055),(.088,.048,.035),rubber,p,.007)
        # A continuous sewn sleeve with asymmetric folds instead of intersecting ellipsoids.
        verts=[];faces=[];rings=15;sides=16
        for ring in range(rings):
            t=ring/(rings-1);cx=(.045 if side=='right' else -.135)*t;cy=-.008-.068*t
            for j in range(sides):
                ang=j*math.tau/sides
                fold=.0045*math.sin(t*28+ang*1.5)*(.2+.8*t)
                verts.append((cx+(.043+.025*t+fold)*math.cos(ang),cy+(.032+.028*t+fold)*math.sin(ang),.065+t*.264))
        for ring in range(rings-1):
            for j in range(sides):
                n=ring*sides+j;k=ring*sides+(j+1)%sides;faces.append((n,k,k+sides,n+sides))
        faces.append(tuple(range((rings-1)*sides,rings*sides)))
        a.mesh('Ripstop sleeve',verts,faces,cloth,p)
        a.line('Cuff binding',[(-.036,-.016,.078),(-.018,-.034,.081),(.018,-.034,.081),(.04,-.010,.078)],.002,thread,p)
    a.join_parts(root)
    return root

def export(root,target):
    bpy.ops.object.select_all(action='DESELECT')
    for o in [root]+list(root.children_recursive):o.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
    count=0
    for o in root.children_recursive:
        if o.type=='MESH':o.data.calc_loop_triangles();count+=len(o.data.loop_triangles)
    return {'file':target.name,'triangles':count,'bytes':target.stat().st_size}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--sources',type=Path,required=True)
    args=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);args.sources=args.sources.resolve();args.sources.mkdir(parents=True,exist_ok=True)
    out=ROOT/'models'/'csgo';out.mkdir(exist_ok=True,parents=True)
    results=[]
    for kind in ('knife','glock','usp','deagle','ak47','m4a1','awp','mp5','p90','ump45','galil','famas','scout','sg552','aug','m249','fiveseven','tec9','elite','hands'):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        root=hands() if kind=='hands' else build(kind)
        results.append(export(root,out/(kind+'.glb')))
        if kind in ('ak47','hands'):bpy.ops.wm.save_as_mainfile(filepath=str(args.sources/(kind+'.blend')),compress=True)
    (out/'weapons-manifest.json').write_text(json.dumps({'generator':'tools/blender/build_weapons.py','assets':results},indent=2))
    print('WEAPONS_BUILT',json.dumps(results))
if __name__=='__main__':main()
