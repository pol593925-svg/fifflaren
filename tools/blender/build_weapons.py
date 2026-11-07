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

def polymer(name, color):
    # A moulded stipple is isotropic and matte; only the gloves and sleeves carry a weave.
    m=a.surface(name,color,.67,.04);n=192;rng=np.random.default_rng(sum(map(ord,name)))
    grain=rng.normal(0,.006,(n,n)); px=np.ones((n,n,4),dtype=np.float32)
    px[:,:,:3]=np.clip(np.asarray(color)[None,None,:]+grain[:,:,None],.005,.95)
    nodes=m.node_tree.nodes;links=m.node_tree.links;bsdf=nodes.get('Principled BSDF')
    tex=nodes.new('ShaderNodeTexImage');tex.image=a.image(name+' stipple',px);links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    relief=np.ones_like(px);relief[:,:,0]=.5+np.clip((np.roll(grain,1,1)-grain)*4,-.18,.18)
    relief[:,:,1]=.5+np.clip((np.roll(grain,1,0)-grain)*4,-.18,.18)
    bump=nodes.new('ShaderNodeTexImage');bump.image=a.image(name+' relief',relief,False)
    nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.38
    links.new(bump.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],bsdf.inputs['Normal'])
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

def receiver_profile(name, outline, width, mat, parent):
    verts=[(x,y,z) for x in (-width/2,width/2) for z,y in outline];n=len(outline)
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    ob=a.mesh(name,verts,faces,mat,parent)
    bpy.context.view_layer.objects.active=ob
    bevel=ob.modifiers.new('Forged edge bevel','BEVEL');bevel.width=.003;bevel.segments=3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    weighted=ob.modifiers.new('Machined normals','WEIGHTED_NORMAL');weighted.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=weighted.name)
    return ob

def open_handguard(parent, mat):
    verts=[];faces=[]
    for k in range(18):
        za=-.335+k*.011;zb=za+.011
        for j in range(8):
            if j not in (1,2,5,6) and k%5 in (1,2,3):continue
            aa=j*math.tau/8+math.pi/8;bb=(j+1)*math.tau/8+math.pi/8
            n=len(verts)
            for z,ang in [(za,aa),(zb,aa),(zb,bb),(za,bb)]:verts.append((math.cos(ang)*.043,.021+math.sin(ang)*.043,z))
            faces.append((n,n+1,n+2,n+3))
    ob=a.mesh('Ventilated octagonal fore-end',verts,faces,mat,parent)
    ob.data.materials[0].use_backface_culling=False

def build(kind):
    root=a.empty(kind);p=a.empty('weapon',parent=root)
    steel=metal('Parkerized steel',(.095,.11,.12),.4)
    edge=metal('Machined edges',(.23,.25,.26),.3)
    black=polymer('Polymer',(.046,.052,.050))
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
        if kind=='m4a1':
            receiver_profile('Forged M4 lower receiver',[(-.156,.042),(.065,.042),(.068,-.014),(.036,-.033),(.022,-.052),(-.037,-.052),(-.061,-.036),(-.082,-.084),(-.148,-.084)],.068,bodymat,p)
        else:a.box('Receiver',(0,.005,-.04),(.075,.10,receiver_len),bodymat,p,.009)
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
        if kind=='m4a1':open_handguard(p,bodymat)
        elif ak:receiver_profile('Sculpted laminate fore-end',[(-.326,.041),(-.15,.044),(-.14,.005),(-.168,-.026),(-.30,-.023),(-.331,-.008)],.078,painted_wood,p)
        else:a.box('Fore-end',(0,.015,fore_z),(.078,.075,.18),bodymat,p,.008)
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
        elif ak:
            receiver_profile('Pressed curved AK magazine',[(-.145,-.060),(-.071,-.060),(-.081,-.140),(-.105,-.218),(-.141,-.277),(-.217,-.246),(-.188,-.195),(-.159,-.128)],.046,steel,p)
            for side in [-1,1]:
                for offset in [-.008,.012,.030]:
                    a.line('Magazine stamped rib',[(side*.024,-.083,-.130+offset),(side*.024,-.151,-.142+offset),(side*.024,-.211,-.170+offset),(side*.024,-.247,-.195+offset)],.0028,steel,p)
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
        elif ak:
            receiver_profile('Carved walnut shoulder stock',[(.095,.030),(.155,.038),(.221,.035),(.345,.005),(.349,-.117),(.312,-.125),(.197,-.063),(.150,-.018),(.102,-.014)],.060,painted_wood,p)
            a.line('Curved recoil pad',[(0,.004,.350),(0,-.055,.355),(0,-.117,.349)],.030,black,p)
            cyl('Sling attachment',(-.033,-.056,.280),.009,.004,steel,p,'x',12)
        else:
            a.box('Shoulder stock',(0,.002,.24),(.085 if bullpup else .058,.15 if bullpup else .115,.14 if bullpup else .20),painted_black,p,.012)
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
    """Palm roots are the physical centres of the grips, in metres, forward along -Z."""
    root=a.empty('viewmodel_hands')
    cloth=a.surface('Stone grey field ripstop',(.22,.215,.19),.90,fabric=True)
    leather=polymer('Worn charcoal leather',(.088,.080,.066))
    back=a.surface('Charcoal glove textile',(.095,.091,.080),.92,fabric=True)
    rubber=a.surface('Moulded finger protection',(.061,.066,.054),.74)
    stitch=a.surface('Waxed seam',(.20,.185,.15),.91)
    # Bake a low-contrast, seamless field pattern into the sleeve's existing texture slot.
    yy,xx=np.mgrid[:384,:384]*math.tau/384
    noise=np.sin(xx*2+np.cos(yy*3))*np.sin(yy*2+.68*np.sin(xx*4))+.44*np.cos(xx*5+yy*3+np.sin(yy*2))
    colors=np.array([.24,.23,.21])[None,None,:]*(.92+.08*noise[:,:,None])
    px=np.ones((384,384,4),dtype=np.float32)
    px[:,:,:3]=colors*(.96+.045*np.sin(xx*96)*np.cos(yy*96))[:,:,None]
    dye=next(n for n in cloth.node_tree.nodes if n.type=='TEX_IMAGE' and n.image.colorspace_settings.name!='Non-Color')
    dye.image=a.image('Olive field cloth weave',px)

    def tube(name,points,radii,mat,parent,segments=12,flatten=.83):
        # Join articulated finger sections by an unbroken surface with tapered fingertips.
        verts=[];faces=[];guide=None
        for i,(p,r) in enumerate(zip(points,radii)):
            axis=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])).normalized()
            if guide is None:guide=Vector((0,1,0)) if abs(axis.y)<.85 else Vector((1,0,0))
            tangent=(guide-axis*guide.dot(axis)).normalized();guide=tangent;bitangent=axis.cross(tangent).normalized()
            for j in range(segments):
                theta=j*math.tau/segments
                verts.append(tuple(Vector(p)+r*math.cos(theta)*tangent+r*flatten*math.sin(theta)*bitangent))
        for i in range(len(points)-1):
            for j in range(segments):
                k=i*segments+j;n=i*segments+(j+1)%segments
                faces.append((k,n,n+segments,k+segments))
        faces.extend([tuple(reversed(range(segments))),tuple(range(len(verts)-segments,len(verts)))])
        return a.mesh(name,verts,faces,mat,parent)

    def sleeve(parent,side,wrist):
        # Offset forearms outward from the weapon. The sleeve overlaps the glove cuff at every pose.
        x,y,z=wrist;points=[];radii=[]
        for i in range(23):
            t=i/22;r=.043+.027*t+.0042*math.sin(t*28)+.0018*math.cos(t*53)
            reach=.41 if side<0 else .16
            points.append((x+side*(reach*t+.045*t*t+(.094*math.sin(math.pi*t) if side<0 else 0)),y-(.115 if side<0 else .155)*t+.012*math.sin(t*5),z+.54*t))
            radii.append(r)
        tube('Shaped forearm sleeve',points,radii,cloth,parent,28,.81)
        for k in [4,7,11,16]:
            q=points[k];r=radii[k]
            tube('Fold seam',[(q[0]+side*r*.5,q[1]+r*.67,q[2]-.014),(q[0],q[1]+r*.82,q[2]),(q[0]-side*r*.5,q[1]+r*.67,q[2]+.012)],[.0012]*3,back,parent,6)
        tube('Wrist fastening',points[:3],[.043,.046,.044],rubber,parent,16,.82)
        a.box('Hook and loop tab',(x+side*.039,y+.007,z+.025),(.012,.032,.042),back,parent,.004)
        tube('Outer sleeve seam',[(p[0]+side*r*.82,p[1]+r*.18,p[2]) for p,r in zip(points[1::2],radii[1::2])],[.0016]*11,stitch,parent,6)

    def upright(name,side,cup=False):
        p=a.empty(name,parent=root)
        spread=.013 if cup else 0
        def pt(x,y,z):return (side*(x+spread),y,z)
        tube('Glove palm',[pt(.032,-.045,.061),pt(.038,-.020,.044),pt(.038,.002,.017),pt(.033,.017,-.009)],
             [.027,.038,.040,.030],leather,p,16,.69)
        for j in range(4):
            yy=.029-.019*j
            if j==0 and not cup:path=[pt(.034,yy,-.010),pt(.038,yy+.008,-.034),pt(.029,yy+.011,-.052),pt(.013,yy+.012,-.061),pt(.003,yy+.008,-.061)]
            else:path=[pt(.035,yy,-.007),pt(.038,yy,-.026),pt(.023,yy-.003,-.042),pt(.002,yy-.006,-.041),pt(-.015+(j==3)*.006,yy-.004,-.030)]
            mul=1-j*.055
            tube('Curled digit',path,[i*mul for i in [.011,.012,.011,.009,.005]],back,p)
            a.orb('Segmented knuckle pad',pt(.043,yy,-.014),(.005,.008,.013),rubber,p,14,8)
            tube('Finger seam',[pt(.042,yy-.007,-.006),pt(.044,yy-.007,-.024),pt(.026,yy-.008,-.041)],[.0009]*3,stitch,p,6)
        tube('Opposing thumb',[pt(.028,.010,.046),pt(.014,.025,.038),pt(-.010,.032,.026),pt(-.027,.027,.006),pt(-.029,.025,-.009)],[.015,.015,.013,.011,.007],leather,p)
        sleeve(p,side,pt(.037,-.036,.060))

    upright('rightHand',1)
    upright('leftCup',-1,True)
    upright('leftVertical',-1)
    p=a.empty('leftHand',parent=root)
    tube('Support palm heel',[(-.034,-.037,.062),(-.031,-.036,.044),(-.020,-.038,.016),(-.013,-.033,-.012)],[.026,.035,.038,.027],leather,p,16,.69)
    for j in range(4):
        z=-.026+j*.020;mul=1-j*.055
        path=[(-.034,-.027,z),(-.017,-.041,z-.004),(.009,-.042,z-.006),(.030,-.029,z-.006),(.036,-.012+j*.001,z-.004)]
        tube('Fore-end finger',path,[v*mul for v in [.0105,.011,.010,.009,.0055]],back,p)
        a.orb('Finger grip patch',(.019,-.036,z-.005),(.008,.004,.008),rubber,p,10,6)
    tube('Thumb along left rail',[(-.035,-.019,.035),(-.045,-.003,.020),(-.044,.015,-.004),(-.034,.026,-.033),(-.028,.026,-.050)],[.014,.014,.012,.010,.006],leather,p)
    sleeve(p,-1,(-.039,-.037,.060))
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
