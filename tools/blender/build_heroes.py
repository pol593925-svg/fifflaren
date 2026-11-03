"""Four original fantasy operators, sharing the tactical game's animation pivots."""
import importlib.util, math, json
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('art',Path(__file__).with_name('build_characters.py'))
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
STYLES={
 'ember':((.36,.055,.045),(.055,.035,.045),(.76,.48,.16)),
 'tide':((.045,.25,.36),(.57,.77,.85),(.65,.78,.82)),
 'jade':((.08,.25,.16),(.18,.115,.07),(.72,.59,.28)),
 'aurora':((.50,.49,.67),(.77,.65,.38),(.84,.72,.43)),
}
def build(kind):
    color,haircolor,trimcolor=STYLES[kind]
    root=a.empty('hero_'+kind)
    cloth=a.surface('Woven coat',color,.77,fabric=True)
    dark=a.surface('Soft leather',(.055,.063,.083),.65)
    trim=a.surface('Engraved trim',trimcolor,.32,.65)
    skin=a.surface('Porcelain skin',(.72,.47,.33),.68)
    hair=a.surface('Layered hair',haircolor,.52)
    white=a.surface('Eyes white',(.90,.91,.88),.36)
    iris=a.surface('Gem iris',color,.20,.1)
    black=a.surface('Lashes',(.016,.021,.03),.5)
    p={n:a.empty(n,pos,root) for n,pos in {'torso':(0,1.18,0),'head':(0,1.72,0),'legL':(-.15,.86,0),'legR':(.15,.86,0),'armL':(-.35,1.46,0),'armR':(.35,1.46,0)}.items()}
    t=p['torso']
    a.loft('Tailored tunic',[(-.34,.25,.14,0,0),(-.23,.26,.15,0,0),(-.02,.225,.14,0,0),(.16,.30,.17,0,0),(.28,.34,.14,0,0),(.34,.13,.105,0,0)],cloth,t,32)
    a.loft('High collar',[(.28,.14,.11,0,0),(.39,.12,.095,0,0)],dark,t,28)
    a.loft('Gold belt',[(-.23,.264,.158,0,0),(-.19,.266,.16,0,0)],trim,t,32)
    a.orb('Belt jewel',(0,-.205,-.17),(.038,.045,.025),iris,t)
    for side in (-1,1):
        a.line('Tailored gold piping',[(side*.11,.30,-.105),(side*.21,.18,-.15),(side*.16,-.03,-.145),(side*.22,-.18,-.15)],.008,trim,t)
        a.orb('Shoulder armor',(side*.335,.22,.015),(.12,.10,.17),trim,t)
    for y in (-.1,0,.1):a.orb('Fitted buttons',(0,y,-.16),(.013,.013,.009),trim,t,12,8)
    # Multi-panel coat tails and asymmetrical cape, with curved folds.
    for part in range(5 if kind!='jade' else 3):
        verts=[];faces=[]
        start=part*math.tau/(5 if kind!='jade' else 3)+.15
        for row in range(8):
            f=row/7;y=-.20-f*(.52 if kind=='ember' else .62)
            for col in range(7):
                ang=start+(col/6-.5)*.85
                radius=.26+f*.12+math.sin(col/6*math.pi*4)*.014*f
                verts.append((math.cos(ang)*radius,y+math.cos(ang*3)*.035*f,math.sin(ang)*radius))
        for row in range(7):
            for col in range(6):i=row*7+col;faces.append((i,i+1,i+8,i+7))
        o=a.mesh('Flared coat panel',verts,faces,cloth,t)
        solid=o.modifiers.new('Cloth thickness','SOLIDIFY');solid.thickness=.008
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=solid.name)
        a.line('Coat hem',verts[-7:],.008,trim,t)
    h=p['head']
    a.loft('Sculpted face',[(-.17,.055,.062,0,-.01),(-.12,.11,.09,0,-.01),(-.04,.145,.115,0,0),(.06,.15,.122,0,.008),(.15,.11,.095,0,.01),(.19,.035,.04,0,.01)],skin,h,32)
    a.orb('Nose',(0,-.045,-.111),(.023,.033,.024),skin,h)
    a.line('Mouth',[(-.03,-.102,-.092),(0,-.108,-.099),(.03,-.102,-.092)],.0035,dark,h)
    for side in (-1,1):
        a.orb('Ear',(side*.143,-.02,.01),(.022,.047,.03),skin,h)
        a.orb('Eye',(side*.065,.005,-.107),(.044,.028,.013),white,h)
        a.orb('Iris',(side*.065,.005,-.120),(.019,.023,.005),iris,h)
        a.orb('Pupil',(side*.065,.005,-.125),(.007,.016,.003),black,h,16,10)
        a.orb('Eye catchlight',(side*.065-.006,.014,-.128),(.006,.007,.002),white,h,12,8)
        a.line('Lashes',[(side*.025,.022,-.109),(side*.065,.032,-.119),(side*.107,.024,-.105)],.004,black,h)
        a.line('Eyebrow',[(side*.03,.063,-.107),(side*.065,.069,-.115),(side*.102,.060,-.099)],.007,hair,h)
        a.orb('Earring',(side*.16,-.065,0),(.016,.035,.014),trim,h)
    # Sculpted tapered locks, not a spherical helmet.
    for i in range(15):
        ang=i*math.tau/15;cx=math.cos(ang)*.11;cz=math.sin(ang)*.09+.012
        if math.sin(ang)<-.3:continue
        end=-.03 if kind=='ember' else -.14
        a.loft('Swept hair lock',[(end,.008,.008,cx*1.38,cz*1.7),(.08,.040,.043,cx*1.3,cz*1.4),(.17,.042,.04,cx*.85,cz),(.205,.014,.018,cx*.3,cz*.4)],hair,h,12)
    for i in range(5):
        x=(i-2)*.046
        a.loft('Swept fringe',[(.065+(i%2)*.025,.003,.004,x-.02,-.136),(.14,.033,.023,x,-.118),(.20,.025,.025,x*.7,-.06)],hair,h,12)
    if kind in ('tide','aurora','jade'):
        for side in ((-1,1) if kind=='tide' else (1,)):
            a.loft('Flowing ponytail',[(-.47,.02,.026,side*.18,.12),(-.28,.052,.06,side*.22,.14),(-.05,.06,.06,side*.19,.13),(.10,.032,.04,side*.14,.08)],hair,h,16)
            a.orb('Hair clasp',(side*.16,.07,.11),(.04,.025,.04),trim,h)
    if kind=='aurora':a.line('Gold tiara',[(-.14,.12,-.07),(-.07,.16,-.12),(0,.21,-.12),(.07,.16,-.12),(.14,.12,-.07)],.009,trim,h)
    for name in ('legL','legR'):
        leg=p[name]
        a.loft('Fitted trousers',[(-.46,.09,.09,0,0),(-.29,.10,.10,0,0),(-.08,.115,.12,0,0),(.03,.12,.13,0,0)],dark,leg,24)
        a.loft('Tall sculpted boot',[(-.80,.09,.105,0,0),(-.65,.095,.095,0,0),(-.39,.105,.10,0,0)],cloth,leg,24)
        a.orb('Boot toe',(0,-.79,-.07),(.11,.07,.18),dark,leg)
        a.line('Boot gold seam',[(0,-.72,-.105),(0,-.53,-.11),(0,-.40,-.11)],.009,trim,leg)
        a.orb('Knee plate',(0,-.31,-.095),(.09,.105,.035),trim,leg)
    for name in ('armL','armR'):
        arm=p[name]
        a.orb('Rounded sleeve cap',(0,.015,0),(.105,.09,.11),cloth,arm)
        a.loft('Fitted sleeve',[(-.39,.055,.062,0,0),(-.25,.07,.075,0,0),(-.12,.085,.085,0,0),(.035,.105,.11,0,0)],cloth,arm,24)
        a.loft('Embossed bracer',[(-.46,.067,.069,0,0),(-.28,.078,.08,0,0)],trim,arm,24)
        a.orb('Gloved palm',(0,-.51,0),(.057,.072,.04),dark,arm)
        for i in range(4):a.orb('Finger',((i-1.5)*.022,-.558,-.005),(.012,.032,.023),dark,arm,12,8)
    a.join_parts(root)
    return root

def portrait(root,target):
    sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.cycles.use_denoising=True
    sc.world=bpy.data.worlds.new('Studio');sc.world.color=(.22,.22,.22)
    for name,pos,power,color in [('Key',(-2,3,-4),400,(1,.87,.75)),('Fill',(2,2,-2),250,(.65,.80,1)),('Rim',(0,3,2),500,(.8,.85,1))]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.size=3;data.color=color
        ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.location=a.xyz(pos);ob.rotation_euler=(Vector(a.xyz((0,1,0)))-ob.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Portrait');cam=bpy.data.objects.new('Portrait',data);bpy.context.collection.objects.link(cam)
    cam.location=a.xyz((2,1.8,-5));cam.rotation_euler=(Vector(a.xyz((0,1,0)))-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=2.25;sc.camera=cam
    sc.render.resolution_x=420;sc.render.resolution_y=560;sc.render.resolution_percentage=100;sc.render.film_transparent=True;sc.view_settings.view_transform='AgX';sc.render.image_settings.color_mode='RGBA';sc.render.filepath=str(target);bpy.ops.render.render(write_still=True)

def main():
    assets=ROOT/'assets'/'cs16';assets.mkdir(parents=True,exist_ok=True);out=ROOT/'models'/'csgo';results=[]
    for kind in STYLES:
        bpy.ops.wm.read_factory_settings(use_empty=True);root=build(kind);results.append(a.export(root,out/('hero-'+kind+'.glb')));portrait(root,assets/(kind+'.png'))
    (out/'heroes-manifest.json').write_text(json.dumps({'generator':'tools/blender/build_heroes.py','artwork':'Original Support Hub fantasy characters','assets':results},indent=2))
    print('HEROES_BUILT',json.dumps(results))
if __name__=='__main__':main()
