"""Complete illustrated weapon set and anatomical four-grip hands for live CS.
Keeps grip locations, model length, moving magazines, bolts and slides unchanged.
"""
import bpy, math, json, importlib.util, sys
import numpy as np
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('anime_weapon_base',HERE/'build_weapons.py')
w=importlib.util.module_from_spec(spec);sys.modules[spec.name]=w;spec.loader.exec_module(w);a=w.a
OUT=w.ROOT/'models/csgo'
join_parts=a.join_parts
# Keep authoring pieces separate until their curved surfaces have been refined.
a.join_parts=lambda root:None
base_box=a.box
def soft_box(name,pos,size,mat,parent,bevel=.008):
    return base_box(name,pos,size,mat,parent,min(min(size)*.32,bevel*1.8,.014) if bevel else 0)
a.box=soft_box

def sculpt(root,kind):
    for ob in list(root.children_recursive):
        if ob.type!='MESH':continue
        if kind=='hands' and any(n in ob.name for n in ['forearm','palm','digit','finger','thumb','Wrist fastening']):
            bpy.context.view_layer.objects.active=ob
            mod=ob.modifiers.new('Smooth anatomical surface','SUBSURF');mod.levels=1;mod.render_levels=1
            bpy.ops.object.modifier_apply(modifier=mod.name)
        for poly in ob.data.polygons:poly.use_smooth=True

def handguard(parent,mat):
    verts=[];faces=[]
    for k in range(18):
        za=-.335+k*.011;zb=za+.011
        for j in range(16):
            if j not in [0,1,6,7,8,9,14,15] and k%5 in [1,2,3]:continue
            n=len(verts)
            for z,angle in [(za,j*math.tau/16),(zb,j*math.tau/16),(zb,(j+1)*math.tau/16),(za,(j+1)*math.tau/16)]:
                verts.append((math.cos(angle)*.043,.021+math.sin(angle)*.043,z))
            faces.append((n,n+1,n+2,n+3))
    a.mesh('Curved ventilated fore-end',verts,faces,mat,parent)
w.open_handguard=handguard

def paint(mat,hexcolor):
    color=np.array([int(hexcolor[i:i+2],16)/255 for i in [1,3,5]])
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
    textile=any(n in mat.name.lower() for n in ['ripstop','textile','leather','finger protection'])
    for input in ['Base Color','Roughness','Metallic']+([] if textile else ['Normal']):
        for link in list(p.inputs[input].links):links.remove(link)
    p.inputs['Roughness'].default_value=.64;p.inputs['Metallic'].default_value=.12
    n=192;yy,xx=np.mgrid[:n,:n];px=np.ones((n,n,4),dtype=np.float32)
    wash=.96+.026*np.sin(xx*.15+np.sin(yy*.06)*2)+.012*np.sin(yy*.38+xx*.2)
    if textile: wash+=.018*np.sin(xx*math.pi/2)*np.sin(yy*math.pi/2)
    px[:,:,:3]=np.clip(color[None,None,:]*wash[:,:,None],0,1)
    tx=nodes.new('ShaderNodeTexImage');tx.image=a.image('Painted '+mat.name,px);links.new(tx.outputs['Color'],p.inputs['Base Color'])
    return mat

def finish(root,kind):
    seen=set()
    for o in root.children_recursive:
        if o.type!='MESH':continue
        for slot in o.material_slots:
            m=slot.material
            if not m or m.name in seen:continue
            seen.add(m.name);name=m.name
            if 'glass' in name.lower():continue
            if name.startswith('Weapon finish /'):
                c='#d7d1b8' if 'edges' in name else '#658fa3' if 'steel' in name else '#a1b7b2' if 'Olive' in name else '#568e98' if 'Walnut' in name else '#577b91'
                if kind in ['awp','scout'] and 'Olive' in name:c='#b5c5cf'
            elif 'field ripstop' in name:c='#48677c'
            elif 'glove textile' in name:c='#4c6477'
            elif 'leather' in name:c='#2e4259'
            elif 'finger protection' in name:c='#607c88'
            elif 'seam' in name:c='#c79e63'
            elif 'Brass' in name:c='#d4a361'
            elif 'edges' in name:c='#8c9fa9'
            elif 'Walnut' in name:c='#629b9b'
            else:c='#35495e'
            paint(m,c)
    root['artStyle']='Original painterly anime / Support Hub'

def details(root,kind):
    if kind=='hands':
        ivory=paint(a.surface('Tailored sleeve inlay',(.6,.5,.4),.8),'#d9c9a6')
        teal=paint(a.surface('Wrist teal binding',(.1,.3,.3),.8),'#3e7688')
        gold=paint(a.surface('Cuff fastener',(.5,.3,.1),.5),'#cb9e60')
        for hand in root.children:
            if hand.type!='EMPTY':continue
            side=1 if hand.name=='rightHand' else -1
            wrist=(.037,-.036,.060) if side>0 else (-.039,-.037,.060)
            if hand.name=='leftCup':wrist=(-.050,-.036,.060)
            elif hand.name=='leftVertical':wrist=(-.037,-.036,.060)
            def arm(t):
                x,y,z=wrist;reach=.41 if side<0 else .16
                return Vector((x+side*(reach*t+.045*t*t+(.094*math.sin(math.pi*t) if side<0 else 0)),y-(.115 if side<0 else .155)*t+.012*math.sin(t*5),z+.54*t))
            def frame(t):
                axis=(arm(t+.001)-arm(t-.001)).normalized();up=Vector((0,1,0));up=(up-axis*up.dot(axis)).normalized()
                return up,axis.cross(up).normalized()
            pts=[]
            for i in range(19):
                t=i/22;r=.043+.027*t+.0042*math.sin(t*28)+.0018*math.cos(t*53)+.0015
                up,across=frame(t);pts.append(tuple(arm(t)+r*(up*.84+across*.46)))
            a.line('Long tailored seam',pts[3:],.0025,ivory,hand)
            x,y,z=pts[3];a.box('Leather cuff strap',(x,y-.004,z),(.048,.009,.030),teal,hand,.004)
            a.box('Cuff brass buckle',(x+side*.022,y+.004,z),(.013,.006,.022),gold,hand,.002)
            # Curved leather bracer sits over the sleeve, following the arm instead of a box cuff.
            verts=[];faces=[]
            for j in range(11):
                t=.14+j*.018;x,y,z=wrist
                r=.043+.027*t+.0042*math.sin(t*28)+.0018*math.cos(t*53)+.003
                centre=arm(t);up,across=frame(t)
                for k in range(9):
                    ang=-1.05+k*2.1/8
                    verts.append(tuple(centre+r*(up*math.cos(ang)+across*.81*math.sin(ang))))
            for j in range(10):
                for k in range(8):
                    i=j*9+k;faces.append((i,i+1,i+10,i+9))
            a.mesh('Tailored curved wrist bracer',verts,faces,teal,hand)
            for row in [0,10]:a.line('Bracer gold piping',[verts[row*9+k] for k in range(9)],.0015,gold,hand)
            for row in [2,5,8]:
                a.line('Raised bracer seam',[tuple(Vector(verts[row*9+k])+frame(.14+row*.018)[0]*.0015)for k in range(2,7)],.0012,ivory,hand)
        a.join_parts(root);return
    if kind in ['knife','elite']:return
    weapon=next(o for o in root.children if o.name=='weapon')
    copper=paint(a.surface('Etched brass detail',(.5,.3,.1),.55),'#d2ac70')
    enamel=paint(a.surface('Inset blue ceramic',(.1,.2,.3),.7),'#518d9d')
    pistol=kind in ['glock','usp','deagle','fiveseven','tec9']
    for side in [-1,1]:
        x=side*(.025 if pistol else .040)
        for j in range(3):
            z=-.035+j*.013
            a.box('Inlaid receiver chevron',(x,.002,z),(.0018,.004+j*.003,.006),copper,weapon,.001)
        if not pistol:
            a.box('Enamel inlay',(x,-.021,-.075),(.002,.009,.063),enamel,weapon,.002)
            for j in range(3):a.box('Inlay screw',(x+side*.001,-.021,-.097+j*.022),(.003,.003,.003),copper,weapon,.001)
            panel=w.receiver_profile('Sculpted enamel receiver panel',[(-.128,.026),(-.112,.035),(-.035,.029),(.010,.012),(.004,-.008),(-.088,-.014),(-.124,-.004)],.003,enamel,weapon)
            panel.location.x=side*.040
            relief_y=-.032 if side>0 else 0;panel.location.z=relief_y
            # Swept inlay and engraved leaf motif follow the new curved receiver panel.
            a.line('Swept receiver filigree',[(side*.043,relief_y+.020+.007*math.sin(j*math.pi/18),-.116+j*.0065)for j in range(19)],.0014,copper,weapon)
            for j in range(3):
                zz=-.095+j*.022
                a.line('Engraved receiver leaf',[(side*.044,relief_y+.018,zz),(side*.044,relief_y+.007,zz+.008),(side*.044,relief_y+.013,zz+.015)],.0012,copper,weapon)
        else:
            a.line('Slide gold accent',[(side*.024,.043,-.12),(side*.024,.045,-.06),(side*.024,.041,.025)],.0012,copper,weapon)
    a.join_parts(root)

def main():
    results=[]
    kinds=['knife','glock','usp','deagle','ak47','m4a1','awp','mp5','p90','ump45','galil','famas','scout','sg552','aug','m249','fiveseven','tec9','elite','hands']
    for kind in kinds:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        root=w.hands() if kind=='hands' else w.build(kind)
        sculpt(root,kind);finish(root,kind);details(root,kind);join_parts(root)
        results.append(w.export(root,OUT/('anime-'+kind+'.glb')))
        print('ANIME_WEAPON',kind,flush=True)
    (OUT/'anime-weapons-manifest.json').write_text(json.dumps({'generator':'tools/blender/build_anime_weapons.py','assets':results},indent=2)+'\n')
if __name__=='__main__':main()
