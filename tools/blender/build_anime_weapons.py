"""Complete illustrated weapon set and anatomical four-grip hands for live CS.
Keeps grip locations, model length, moving magazines, bolts and slides unchanged.
"""
import bpy, bmesh, math, json, importlib.util, sys, argparse
import numpy as np
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
spec=importlib.util.spec_from_file_location('anime_weapon_base',HERE/'build_weapons.py')
w=importlib.util.module_from_spec(spec);sys.modules[spec.name]=w;spec.loader.exec_module(w);a=w.a
OUT=w.ROOT/'models/csgo'
join_parts=a.join_parts
# Keep authoring pieces separate until their curved surfaces have been refined.
a.join_parts=lambda root:None
base_box=a.box
finger_records=[]
def soft_box(name,pos,size,mat,parent,bevel=.008):
    if name in ['Textured grip','Pistol grip','Knife grip']:
        # An oval backstrap swells gently into the palm; no rectangular grip block.
        w,h,d=size;verts=[];faces=[];segments=20;rings=11;longitudinal=name=='Knife grip'
        for j in range(rings):
            t=j/(rings-1);bulge=.83+.17*math.sin(t*math.pi)**.65
            for k in range(segments):
                aa=k*math.tau/segments;xx=math.cos(aa)*w*.5*bulge
                cross=math.sin(aa)*(.5*h if longitudinal else .5*d)*bulge
                verts.append((pos[0]+xx,pos[1]+(cross if longitudinal else (t-.5)*h),pos[2]+((t-.5)*d if longitudinal else cross)))
        for j in range(rings-1):
            for k in range(segments):
                i=j*segments+k;n=j*segments+(k+1)%segments;faces.append((i,n,n+segments,i+segments))
        faces.extend([tuple(reversed(range(segments))),tuple(range((rings-1)*segments,rings*segments))])
        return a.mesh(name,verts,faces,mat,parent)
    if name in ['Receiver','Shoulder stock','Fore-end','Slide','Lower frame','P90 rounded frame','Cheek rest','P90 top magazine','Horizontal magazine','Ammunition box','UMP polymer lower']:
        # Rounded, slightly tapered cross-sections replace the large rectangular masses.
        width,height,depth=size;verts=[];faces=[];segments=24;rings=9
        for j in range(rings):
            t=j/(rings-1);cap=.78+.22*math.sin(math.pi*t)**.55
            # Flowing comb and shoulder silhouette; grip/reload sockets stay untouched.
            stock=name in ['Shoulder stock','Cheek rest']
            swell=1-.13*math.sin(math.pi*t) if stock else 1
            lift=height*.085*math.sin(math.pi*t) if stock else 0
            for k in range(segments):
                angle=k*math.tau/segments
                def soft(v):return math.copysign(abs(v)**(.84 if stock else .76),v)
                verts.append((pos[0]+width*.5*soft(math.cos(angle))*cap,
                              pos[1]+lift+height*.5*soft(math.sin(angle))*cap*swell,
                              pos[2]+depth*(t-.5)))
        for j in range(rings-1):
            for k in range(segments):
                n=j*segments+k;q=j*segments+(k+1)%segments
                faces.append((n,q,q+segments,n+segments))
        faces.extend([tuple(reversed(range(segments))),tuple(range((rings-1)*segments,rings*segments))])
        return a.mesh(name,verts,faces,mat,parent)
    if name in ['Picatinny rail','Receiver rail tooth','Handguard rail lug','Magazine base','Scope mount']:
        return base_box(name,pos,size,mat,parent,min(size)*.43)
    return base_box(name,pos,size,mat,parent,min(min(size)*.32,bevel*1.8,.014) if bevel else 0)
a.box=soft_box

# Round authored silhouettes in their own plane, retaining grip sockets and moving parts.
base_profile=w.receiver_profile
def curved_profile(name,outline,width,mat,parent):
    points=[]
    for i,(z,y) in enumerate(outline):
        p=Vector(outline[i-1]);q=Vector((z,y));n=Vector(outline[(i+1)%len(outline)])
        radius=min(.018,(p-q).length*.30,(n-q).length*.30)
        start=q+(p-q).normalized()*radius;end=q+(n-q).normalized()*radius
        for j in range(5):
            t=j/4;v=(1-t)**2*start+2*t*(1-t)*q+t*t*end;points.append(tuple(v))
    # Thin enamel inlays have a domed face, with a rolled perimeter instead of
    # a flat extruded sticker. Broad functional bodies keep their exact outline.
    if any(k in name for k in ['swept receiver shell','receiver panel','swept slide shell']):
        n=len(points);centre=sum((Vector(p) for p in points),Vector((0,0)))/n
        verts=[];faces=[]
        for side in [-1,1]:
            for shrink,rise in [(1,0),(.93,.0011),(.72,.0018)]:
                for z,y in points:
                    p=centre+(Vector((z,y))-centre)*shrink
                    verts.append((side*(width*.5+rise),p.y,p.x))
            offset=0 if side<0 else 3*n
            for ring in range(2):
                for j in range(n):
                    k=(j+1)%n;i=offset+ring*n
                    face=(i+j,i+k,i+k+n,i+j+n)
                    faces.append(tuple(reversed(face)) if side<0 else face)
            faces.append(tuple(range(offset+2*n,offset+3*n))[::int(side)])
        for j in range(n):faces.append((j,(j+1)%n,(j+1)%n+3*n,j+3*n))
        ob=a.mesh(name,verts,faces,mat,parent)
        # The exporter uses these smooth shoulder normals directly.
        for face in ob.data.polygons:face.use_smooth=True
        return ob
    return base_profile(name,points,width,mat,parent)
w.receiver_profile=curved_profile

def sculpt(root,kind):
    if kind=='hands':finger_records.clear()
    for ob in list(root.children_recursive):
        if ob.type!='MESH':continue
        if kind=='elite' and ob.name.startswith(('Recessed receiver pin','Pin screwdriver slot','Curved trigger','Magazine body')):
            # Base generator adds these after duplicating the pistols. Fit them to BOTH guns.
            other=ob.copy();other.data=ob.data.copy();bpy.context.collection.objects.link(other);other.parent=ob.parent
            ob.location.x+=.09;other.location.x-=.09
        if kind in ['aug','sg552'] and ob.name.startswith(('Scope mount','Optical tube','Scope bell','Optical lens','Lens retaining ring','Focus rib','Mount clamp','Turret grip','Elevation dial','Windage dial')):
            bpy.data.objects.remove(ob,do_unlink=True);continue
        if kind=='hands' and any(n in ob.name for n in ['Segmented knuckle pad','Finger seam','Finger grip patch','Hook and loop tab']):
            bpy.data.objects.remove(ob,do_unlink=True);continue
        if kind=='hands' and any(n in ob.name for n in ['Curled digit','Fore-end finger','Opposing thumb','Thumb along']):
            # Slim each phalanx around its own centreline; grip contacts remain unchanged.
            vertices=ob.data.vertices
            for start in range(0,len(vertices),12):
                ring=list(vertices[start:start+12]);centre=sum((v.co for v in ring),Vector())/len(ring)
                ring_index=start//12
                contour=[.94,1.04,.96,1.0,.88][min(ring_index,4)]
                for v in ring:v.co=centre+(v.co-centre)*(.91 if 'thumb' in ob.name.lower() else .85)*contour
            centres=[sum((v.co for v in vertices[i:i+12]),Vector())/12 for i in range(0,len(vertices),12)]
            finger_records.append((ob.parent,[Vector((v.x,v.z,-v.y))for v in centres], 'thumb' in ob.name.lower()))
        if 'Curved ventilated' in ob.name:
            bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(ob.data);bm.free()
        if kind=='hands' and any(n in ob.name for n in ['forearm','palm','digit','finger','thumb','Wrist fastening']):
            bpy.context.view_layer.objects.active=ob
            mod=ob.modifiers.new('Smooth anatomical surface','SUBSURF');mod.levels=1;mod.render_levels=1
            bpy.ops.object.modifier_apply(modifier=mod.name)
        for poly in ob.data.polygons:poly.use_smooth=True

def handguard(parent,mat):
    verts=[];faces=[]
    for k in range(18):
        za=-.335+k*.011;zb=za+.011
        for j in range(32):
            if j//2 not in [0,1,6,7,8,9,14,15] and k%5 in [1,2,3]:continue
            n=len(verts)
            for z,angle in [(za,j*math.tau/32),(zb,j*math.tau/32),(zb,(j+1)*math.tau/32),(za,(j+1)*math.tau/32)]:
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
    # Broad brushed pigment instead of uniform plastic. Periodic layers tile cleanly.
    u=xx*math.tau/n;v=yy*math.tau/n
    wash=.94+.041*np.sin(u*3+np.sin(v*2)*1.8)+.021*np.sin(v*7+u*2)
    if textile:
        wash+=.016*np.sin(xx*math.pi/2)*np.sin(yy*math.pi/2)
        wash+=.018*np.cos(u*12+v*6)
    elif any(k in mat.name.lower() for k in ['steel','alloy','brass','edges']):
        wash+=.012*np.sin(v*48+np.sin(u*2))
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
                c='#c5c9c3' if 'edges' in name else '#354e63' if 'steel' in name else '#a1b7b2' if 'Olive' in name else '#568e98' if 'Walnut' in name else '#577b91'
                if kind in ['awp','scout'] and 'Olive' in name:c='#b5c5cf'
                # Related finishes, distinct families: keep mechanisms graphite and paint the housing.
                if 'steel' in name and kind in ['glock','mp5','galil','famas','sg552']:
                    c={'glock':'#7c9a9e','mp5':'#356a78','galil':'#496c68','famas':'#637a97','sg552':'#52746e'}[kind]
                if 'Olive' in name and kind=='scout':c='#6c929d'
                if 'Walnut' in name:c='#ae7d50' if kind=='ak47' else '#687f70'
            elif 'field ripstop' in name:c='#48677c'
            elif 'glove textile' in name:c='#4c6477'
            elif 'leather' in name:c='#2e4259'
            elif 'finger protection' in name:c='#607c88'
            elif 'seam' in name:c='#c79e63'
            elif 'Brass' in name:c='#d4a361'
            elif 'edges' in name:c='#a0b3be'
            elif 'Walnut' in name:c='#629b9b'
            elif 'steel' in name.lower():c='#354e63'
            else:c='#35495e'
            paint(m,c)
    root['artStyle']='Original painterly anime / Support Hub'

def details(root,kind):
    if kind=='hands':
        skin=paint(a.surface('Painted exposed fingers',(.6,.4,.3),.8),'#e4b996')
        # Fingerless tailored gloves: the complete fingers remain continuous curved meshes.
        for ob in root.children_recursive:
            if ob.type=='MESH' and any(n in ob.name for n in ['Curled digit','Fore-end finger','Opposing thumb','Thumb along left rail']):
                ob.data.materials.clear();ob.data.materials.append(skin)
        ivory=paint(a.surface('Tailored sleeve inlay',(.6,.5,.4),.8),'#d9c9a6')
        teal=paint(a.surface('Wrist teal binding',(.1,.3,.3),.8),'#3e7688')
        gold=paint(a.surface('Cuff fastener',(.5,.3,.1),.5),'#cb9e60')
        nails=paint(a.surface('Soft ivory fingernails',(.8,.6,.5),.65),'#efd1b8')
        crease=paint(a.surface('Warm finger creases',(.4,.2,.1),.9),'#b77e60')
        for parent,centres,thumb in finger_records:
            tip=centres[-1];tangent=(tip-centres[-2]).normalized()
            outward=Vector((tip.x, .018, tip.z*.12));outward-=tangent*outward.dot(tangent)
            if outward.length<.001:outward=Vector((0,1,0)).cross(tangent)
            outward.normalize();across=tangent.cross(outward).normalized()
            # A shallow domed nail follows the fingertip surface, including the curled fingers.
            centre=tip-tangent*.005+outward*(.006 if thumb else .0043)
            verts=[tuple(centre+outward*.0006)];faces=[]
            for j in range(16):
                angle=j*math.tau/16
                verts.append(tuple(centre+across*math.cos(angle)*(.005 if thumb else .0037)+tangent*math.sin(angle)*.006))
            for j in range(16):faces.append((0,1+j,1+(j+1)%16))
            a.mesh('Rounded fingertip nail',verts,faces,nails,parent)
            for joint in [1,2]:
                c=centres[joint];r=.010 if thumb else .008
                a.line('Soft knuckle crease',[tuple(c+outward*r*math.cos(u)+across*r*math.sin(u))for u in [-.50,-.25,0,.25,.50]],.0005,crease,parent)
            # Rolled fabric lip around the open glove, curved around each finger root.
            base=centres[0];axis=(centres[1]-base).normalized()
            rim=Vector((base.x, .015, 0));rim-=axis*rim.dot(axis);rim.normalize()
            cross=axis.cross(rim).normalized();radius=.013 if thumb else .009
            a.line('Fingerless glove rolled seam',[tuple(base+(rim*math.cos(u)+cross*math.sin(u))*radius)for u in [-1.05,-.70,-.35,0,.35,.70,1.05]],.0011,teal,parent)
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
            x,y,z=pts[3]
            a.orb('Tailored cuff clasp',(x,y-.002,z),(.024,.005,.013),teal,hand,16,8)
            a.orb('Cuff brass stud',(x+side*.015,y+.003,z),(.006,.003,.008),gold,hand,12,6)
            # Curved leather bracer sits over the sleeve, following the arm instead of a box cuff.
            verts=[];faces=[]
            for j in range(15):
                t=.14+j*.18/14;x,y,z=wrist
                r=.043+.027*t+.0042*math.sin(t*28)+.0018*math.cos(t*53)+.003
                centre=arm(t);up,across=frame(t)
                for k in range(17):
                    ang=-1.05+k*2.1/16
                    # Taper the sleeve plate at both ends instead of cutting a rectangular cuff.
                    shaped=ang*(.82+.18*math.sin(j*math.pi/14))
                    verts.append(tuple(centre+r*(up*math.cos(shaped)+across*.81*math.sin(shaped))))
            for j in range(14):
                for k in range(16):
                    i=j*17+k;faces.append((i,i+1,i+18,i+17))
            a.mesh('Tailored curved wrist bracer',verts,faces,teal,hand)
            for row in [0,14]:a.line('Bracer gold piping',[verts[row*17+k] for k in range(17)],.0015,gold,hand)
            for row in [3,7,11]:
                a.line('Raised bracer seam',[tuple(Vector(verts[row*17+k])+frame(.14+row*.18/14)[0]*.0015)for k in range(3,14)],.0012,ivory,hand)
            # Embroidered leaf crest follows the curved cuff, not a floating flat badge.
            def surface(t,angle,extra=.0045):
                r=.043+.027*t+.0042*math.sin(t*28)+.0018*math.cos(t*53)+extra
                up,across=frame(t)
                return tuple(arm(t)+r*(up*math.cos(angle)+across*.81*math.sin(angle)))
            for sign in [-1,1]:
                a.line('Cuff embroidered leaf',[surface(.18+j*.007,sign*.42*math.sin(j*math.pi/16))for j in range(17)],.00125,gold,hand)
            for t in [.43,.62]:
                a.line('Curved sleeve topstitch',[surface(t+.009*math.sin(j*math.pi/14),-.65+j*1.30/14,.0015)for j in range(15)],.0011,ivory,hand)
            # Low leather knuckle shells keep the fingers individually readable.
            if hand.name in ['rightHand','leftCup','leftVertical']:
                spread=.013 if hand.name=='leftCup' else 0
                for j in range(3):
                    yy=.027-.019*j
                    a.orb('Tailored knuckle shell',(side*(.046+spread),yy,-.012),(.0045,.0065,.011),teal,hand,12,8)
                    a.line('Knuckle gold seam',[(side*(.050+spread),yy-.005,-.020),(side*(.052+spread),yy,-.024),(side*(.050+spread),yy+.005,-.020)],.0008,gold,hand)
        a.join_parts(root);return
    if kind=='knife':
        weapon=next(o for o in root.children if o.name=='weapon')
        cord=paint(a.surface('Braided knife leather',(.2,.3,.3),.85),'#487b83')
        for sign in [-1,1]:
            a.line('Braided grip winding',[(math.cos(j*.32)*.025,math.sin(j*.32)*.027,.001+j*.0012)for j in range(95)] if sign>0 else [(math.cos(-j*.32)*.025,math.sin(-j*.32)*.027,.001+j*.0012)for j in range(95)],.002,cord,weapon)
        return
    if kind=='elite':
        slide=next(o for o in root.children if o.name=='slide')
        ivory=paint(a.surface('Weapon finish / Twin ivory inlay',(.8,.7,.5),.5),'#e5d5b3')
        for centre in [-.09,.09]:
            for side in [-1,1]:
                panel=w.receiver_profile('Twin swept slide shell',[(-.119,.034),(-.105,.047),(.019,.045),(.034,.033),(.018,.029),(-.103,.029)],.0035,ivory,slide)
                panel.location.x=centre+side*.024
        return
    weapon=next(o for o in root.children if o.name=='weapon')
    copper=paint(a.surface('Etched brass detail',(.5,.3,.1),.55),'#d2ac70')
    enamel=paint(a.surface('Inset blue ceramic',(.1,.2,.3),.7),'#518d9d')
    ivory=paint(a.surface('Weapon finish / Ivory enamel',(.8,.7,.5),.5),'#e5d5b3')
    recess=paint(a.surface('Recessed graphite mechanism',(.1,.1,.15),.62),'#213244')
    pistol=kind in ['glock','usp','deagle','fiveseven','tec9']
    if not pistol and kind not in ['ak47','galil','m249','p90']:
        magazine=next(o for o in root.children if o.name=='magazine')
        for ob in list(magazine.children):
            if ob.type=='MESH' and ob.name.startswith(('Magazine section','Magazine pressed channel')):bpy.data.objects.remove(ob,do_unlink=True)
        z=.15 if kind in ['aug','famas'] else -.105
        steel=paint(a.surface('Magazine satin alloy',(.2,.3,.35),.56,.3),'#415f73')
        shell=w.receiver_profile('Continuous curved magazine',[(z-.039,-.055),(z+.039,-.055),(z+.035,-.19),(z+.018,-.235),(z-.058,-.233),(z-.047,-.18)],.047,steel,magazine)
        for side in [-1,1]:
            for dz in [-.018,.012]:
                a.line('Pressed magazine flute',[(side*.024,-.077,z+dz),(side*.024,-.15,z+dz-.003),(side*.024,-.209,z+dz-.015)],.0018,copper,magazine)
        a.box('Rounded magazine shoe',(0,-.235,z-.020),(.053,.012,.081),steel,magazine,.003)
    for side in [-1,1]:
        x=side*(.025 if pistol else .040)
        for j in range(3):
            z=-.035+j*.013
            a.box('Inlaid receiver chevron',(x,.002,z),(.0018,.004+j*.003,.006),copper,weapon,.001)
        if not pistol:
            # A recessed working port and curved rim give the receiver an assembled feel.
            port=w.receiver_profile('Ejection port recess',[(-.032,.024),(-.017,.032),(.024,.029),(.034,.016),(.022,.005),(-.026,.006)],.0018,recess,weapon)
            port.location.x=side*.047
            a.line('Ejection port metal rim',[(side*.048,.025,-.031),(side*.048,.030,-.015),(side*.048,.027,.023),(side*.048,.017,.031)],.0011,copper,weapon)
            plate=w.receiver_profile('Ivory swept receiver shell',[(-.140,.039),(-.110,.063),(-.035,.068),(.034,.044),(.047,.026),(-.029,.038),(-.108,.032)],.006,ivory,weapon)
            plate.location.x=side*.039
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
            if kind=='m4a1':
                a.line('Swept cheekrest inlay',[(side*.030,.055+.012*math.sin(j*math.pi/24),.177+j*.005)for j in range(25)],.0022,enamel,weapon)
                for start in [-.30,-.245,-.19]:
                    a.line('Machined vent lip',[(side*.044,.020+.010*math.sin(j*math.pi/12),start+j*.0026)for j in range(13)],.0012,copper,weapon)
        else:
            slide=next((o for o in root.children if o.name=='slide'),weapon)
            plate=w.receiver_profile('Ivory swept slide shell',[(-.119,.034),(-.105,.047),(.019,.045),(.034,.033),(.018,.029),(-.103,.029)],.0035,ivory,slide)
            plate.location.x=side*.024
            a.line('Slide gold accent',[(side*.024,.043,-.12),(side*.024,.045,-.06),(side*.024,.041,.025)],.0012,copper,slide)
    a.join_parts(root)

def main():
    results=[]
    kinds=['knife','glock','usp','deagle','ak47','m4a1','awp','mp5','p90','ump45','galil','famas','scout','sg552','aug','m249','fiveseven','tec9','elite','hands']
    ap=argparse.ArgumentParser();ap.add_argument('--only',nargs='+',choices=kinds)
    cfg=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    manifest=OUT/'anime-weapons-manifest.json'
    previous={r['file']:r for r in json.loads(manifest.read_text())['assets']} if cfg.only and manifest.exists() else {}
    for kind in kinds:
        if cfg.only and kind not in cfg.only:
            results.append(previous['anime-'+kind+'.glb']);continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        root=w.hands() if kind=='hands' else w.build(kind)
        sculpt(root,kind);finish(root,kind);details(root,kind)
        if kind=='hands':
            # Retain curved fingers and sleeves, remove redundant subdivisions on broad surfaces.
            for ob in root.children_recursive:
                if ob.type=='MESH' and len(ob.data.polygons)>500:
                    bpy.context.view_layer.objects.active=ob
                    mod=ob.modifiers.new('Hand surface budget','DECIMATE');mod.ratio=.64 if 'forearm' in ob.name.lower() else .82
                    bpy.ops.object.modifier_apply(modifier=mod.name)
        from bake_asset_shading import bake
        bake(root,kind=='hands');join_parts(root)
        if kind!='hands':world_lod(root)
        target=OUT/('anime-'+kind+'.glb')
        bpy.ops.object.select_all(action='DESELECT')
        for ob in [root]+list(root.children_recursive):ob.select_set(True)
        bpy.context.view_layer.objects.active=root
        bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE',export_active_vertex_color_when_no_material=True)
        count=0
        for ob in root.children_recursive:
            if ob.type=='MESH':ob.data.calc_loop_triangles();count+=len(ob.data.loop_triangles)
        results.append({'file':target.name,'triangles':count,'bytes':target.stat().st_size})
        print('ANIME_WEAPON',kind,flush=True)
    (OUT/'anime-weapons-manifest.json').write_text(json.dumps({'generator':'tools/blender/build_anime_weapons.py','assets':results},indent=2)+'\n')
def world_lod(root):
    """Two colour batches retain the skin mask; first-person art stays intact."""
    bpy.context.view_layer.update();batches={}
    for ob in list(root.children_recursive):
        if ob.type!='MESH':continue
        material=ob.data.materials[0];bs=material.node_tree.nodes.get('Principled BSDF')
        colour=tuple(bs.inputs['Base Color'].default_value[:3])
        links=bs.inputs['Base Color'].links
        if links and links[0].from_node.type=='TEX_IMAGE':
            image=links[0].from_node.image
            px=np.array(image.pixels[:],dtype=np.float32).reshape(-1,4)
            avg=px[::max(1,len(px)//64),:3].mean(axis=0)
            colour=tuple(avg)
        paintable=material.name.startswith('Weapon finish /')
        verts,faces,colours,uvs=batches.setdefault(paintable,([],[],[],[]))
        base=len(verts);transform=root.matrix_world.inverted()@ob.matrix_world
        verts.extend(tuple(transform@v.co)for v in ob.data.vertices)
        uv=ob.data.uv_layers.active
        shade=ob.data.color_attributes.active_color
        for face in ob.data.polygons:
            faces.append(tuple(base+i for i in face.vertices))
            for loop in face.loop_indices:
                index=ob.data.loops[loop].vertex_index if shade and shade.domain=='POINT' else loop
                value=shade.data[index].color[:3] if shade else (1,1,1)
                colours.append(tuple(c*v for c,v in zip(colour,value))+(1,))
            uvs.extend(tuple(uv.data[i].uv)if uv else(0,0)for i in face.loop_indices)
    group=a.empty('worldLOD',parent=root)
    for paintable,(verts,faces,colours,uvs) in batches.items():
        mesh=bpy.data.meshes.new('World weapon surface');mesh.from_pydata(verts,[],faces);mesh.update()
        attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        uv=mesh.uv_layers.new(name='UVMap');uv.data.foreach_set('uv',np.array(uvs,dtype=np.float32).ravel())
        for i,colour in enumerate(colours):attr.data[i].color=colour
        mat=a.surface('Weapon finish / world' if paintable else 'World weapon hardware',(1,1,1),.68,.10)
        vertex=mat.node_tree.nodes.new('ShaderNodeVertexColor');vertex.layer_name='Color'
        mat.node_tree.links.new(vertex.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
        mesh.materials.append(mat);lod=bpy.data.objects.new('World paint' if paintable else 'World hardware',mesh)
        bpy.context.collection.objects.link(lod);lod.parent=group;bpy.context.view_layer.objects.active=lod
        mod=lod.modifiers.new('Distant silhouette budget','DECIMATE');mod.ratio=.22;mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        for face in lod.data.polygons:face.use_smooth=True

if __name__=='__main__':main()
