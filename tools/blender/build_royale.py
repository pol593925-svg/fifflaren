"""Original BR art: three distinct SMGs, transport plane, canopy and modular urban props.
Run Blender -b --python-exit-code 1 --python tools/blender/build_royale.py
"""
from pathlib import Path
import importlib.util, math
import bpy
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('weapons',Path(__file__).with_name('build_weapons.py'))
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w);a=w.a
OUT=ROOT/'models'/'royale';OUT.mkdir(exist_ok=True,parents=True)
def fresh():bpy.ops.wm.read_factory_settings(use_empty=True)
def gun(kind):
    fresh();root=a.empty(kind);body=a.empty('weapon',parent=root);mag=a.empty('magazine',parent=root);bolt=a.empty('bolt',parent=root)
    steel=w.metal('Manganese phosphate',(.10,.117,.13),.43);edge=w.metal('Milled fasteners',(.27,.29,.29),.39)
    poly=w.polymer('Reinforced polymer',(.055,.064,.055));olive=a.surface('Ceramic green',(.19,.215,.15),.6)
    def box(name,pos,size,mat=steel,parent=body,bevel=.004):return a.box(name,pos,size,mat,parent,bevel)
    def barrel(name,pos,r,l,mat=steel,parent=body):return w.cyl(name,pos,r,l,mat,parent)
    if kind=='mp7':
        box('Compact receiver',(0,.035,-.03),(.065,.082,.265),poly,bevel=.012)
        box('Top rail carrier',(0,.087,-.045),(.055,.022,.23),steel)
        grip=box('Integral magazine well',(0,-.066,.008),(.049,.13,.072),poly,bevel=.008);grip.rotation_euler.x=-.13
        box('Sliding magazine',(0,-.13,.012),(.036,.14,.053),steel,mag)
        box('Floorplate',(0,-.20,.02),(.049,.012,.066),poly,mag)
        box('Folding foregrip',(0,-.055,-.155),(.039,.105,.052),poly,bevel=.009)
        for x in [-.021,.021]:barrel('Retractable stock rail',(x,.03,.17),.005,.21,edge)
        box('Compact butt pad',(0,.01,.273),(.065,.083,.016),poly)
    elif kind=='vector':
        box('Upper receiver',(0,.055,-.09),(.08,.077,.34),olive,bevel=.010)
        box('Vector lower housing',(0,-.055,-.075),(.073,.165,.145),poly,bevel=.018)
        front=box('Angled recoil housing',(0,-.091,-.139),(.070,.14,.071),olive,bevel=.012);front.rotation_euler.x=-.28
        grip=box('Rear pistol grip',(0,-.060,.060),(.049,.145,.065),poly,bevel=.009);grip.rotation_euler.x=-.25
        box('Straight box magazine',(0,-.168,-.055),(.037,.16,.058),steel,mag)
        box('Magazine heel',(0,-.249,-.055),(.049,.015,.070),poly,mag)
        box('Folding stock beam',(0,.031,.189),(.046,.043,.23),olive,bevel=.009)
        box('Stock shoulder',(0,-.008,.309),(.054,.14,.027),poly)
        for z in [-.17,-.14,-.11,-.08]:box('Receiver clearance',(.038,.044,z),(.003,.023,.014),steel)
    else:
        box('Stamped receiver',(0,.027,-.015),(.068,.086,.25),steel,bevel=.006)
        barrel('Receiver cover',(0,.071,-.012),.036,.23)
        barrel('Helical magazine',(0,-.048,-.205),.052,.285,poly,mag)
        for i in range(15):barrel('Magazine grip rib',(0,-.048,-.335+i*.018),.053,.004,olive,mag)
        barrel('Forward cap',(0,-.048,-.35),.054,.012,steel,mag)
        grip=box('Bakelite grip',(0,-.083,.062),(.045,.121,.061),olive);grip.rotation_euler.x=-.22
        for y in [.02,.065]:barrel('Wire shoulder stock',(0,y,.205),.009,.24,edge)
        box('Folding butt pad',(0,.015,.327),(.051,.125,.017),steel)
        box('Vented fore end',(0,.02,-.213),(.067,.055,.19),olive)
    muzzle=-.31 if kind!='bizon' else -.40
    barrel('Barrel',(0,.039,muzzle+.05),.013,.18);barrel('Flash hider',(0,.039,muzzle-.045),.020,.048)
    barrel('Bore',(0,.039,muzzle-.071),.010,.002,poly)
    box('Charging handle',(.042,.063,-.061),(.032,.014,.027),edge,bolt)
    box('Ejection opening',(.037,.042,-.045),(.002,.025,.070),poly)
    for z in [-.15,-.12,-.09,-.06,-.03,0]:box('Picatinny tooth',(0,.096,z),(.061,.009,.008),steel)
    for z in [-.20,.064]:box('Iron sight',(0,.113,z),(.029,.032,.014),poly)
    for z in [-.10,.025,.07]:w.cyl('Receiver pin',(.036,.019,z),.005,.005,edge,body,'x',12)
    a.line('Trigger guard',[(0,-.015,-.017),(0,-.057,-.04),(0,-.057,-.10),(0,-.025,-.11)],.004,steel,body)
    a.join_parts(root);w.export(root,OUT/(kind+'.glb'))
def plane():
    fresh();root=a.empty('transport');p=a.empty('airframe',parent=root)
    paint=a.surface('Storm-grey fuselage',(.24,.29,.31),.57,.38);dark=a.surface('Graphite',(.043,.057,.060),.56,.65);glass=a.surface('Flight glass',(.045,.12,.15),.14,.55)
    a.orb('Cargo fuselage',(0,0,0),(2.0,1.9,11.5),paint,p,32,16)
    a.orb('Flight deck',(0,.72,-8.6),(1.40,1.15,2.65),glass,p,24,12)
    for side in [-1,1]:
        for ybase,span,zroot,ztip,chord in [(1.0,14,0,2.8,4.2),(1.5,5.9,8.3,9.8,2.35)]:
            pts=[(side*.8,ybase,zroot-chord/2),(side*span,ybase+.35,ztip-.5),(side*span,ybase+.35,ztip+.62),(side*.8,ybase,zroot+chord/2)]
            a.mesh('Tapered airfoil',pts+[(x,y-.26,z) for x,y,z in pts],[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],paint,p)
        for x in [5,9]:
            a.orb('Engine nacelle',(side*x,.55,.05),(1.0,.85,2.45),paint,p,20,12)
            w.cyl('Propeller hub',(side*x,.55,-2.34),.27,.42,dark,p)
            for angle in [0,math.pi/2,math.pi,3*math.pi/2]:
                blade=a.box('Propeller blade',(side*x+math.cos(angle)*.8,.55+math.sin(angle)*.8,-2.56),(1.48,.18,.10),dark,p,.04);blade.rotation_euler.y=angle
        for i in range(7):a.orb('Cabin porthole',(side*1.95,.28,-4+i*1.3),(.055,.19,.19),glass,p,10,8)
    a.mesh('Tail fin',[(-.12,1.1,7),(.12,1.1,7),(-.12,5.4,9.9),(.12,5.4,9.9),(-.12,1.1,11),(.12,1.1,11)],[(0,2,4),(5,3,1),(0,1,3,2),(2,3,5,4),(4,5,1,0)],paint,p)
    a.join_parts(root);w.export(root,OUT/'transport.glb')
def canopy():
    fresh();root=a.empty('canopy');p=a.empty('fabric',parent=root);m=a.surface('Olive ripstop',(.28,.34,.21),.83,fabric=True);stripe=a.surface('Ochre panels',(.54,.44,.22),.8);cord=a.surface('Suspension cord',(.21,.22,.18),.9)
    for i in range(16):
        verts=[]
        for j in range(5):
            for k in range(2):
                x=-3+(i+k)*.375;z=-1.25+j*.625;y=2.6+.76*(1-(x/3)**2)+.14*math.sin(j*math.pi/4)-.10*(j-2)**2
                verts.append((x,y,z))
        faces=[]
        for j in range(4):faces.extend([(2*j,2*j+1,2*j+3,2*j+2),(2*j+2,2*j+3,2*j+1,2*j)])
        a.mesh('Woven canopy cell',verts,faces,stripe if i in [2,3,12,13] else m,p)
    for x in [-2.8,-1.4,1.4,2.8]:
        for z in [-1,1]:a.line('Riser',[(x,2.28,z),(x*.07,.20,z*.12)],.010,cord,p)
    a.join_parts(root);w.export(root,OUT/'canopy.glb')
if __name__=='__main__':
    for kind in ['mp7','vector','bizon']:gun(kind)
    plane();canopy();print('ROYALE_ASSETS_READY')
