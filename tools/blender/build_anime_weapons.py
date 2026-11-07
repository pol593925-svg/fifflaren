"""Complete illustrated weapon set and anatomical four-grip hands for live CS.
Keeps grip locations, model length, moving magazines, bolts and slides unchanged.
"""
import bpy, math, json, importlib.util, sys
import numpy as np
from pathlib import Path
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('anime_weapon_base',HERE/'build_weapons.py')
w=importlib.util.module_from_spec(spec);sys.modules[spec.name]=w;spec.loader.exec_module(w);a=w.a
OUT=w.ROOT/'models/csgo'

def paint(mat,hexcolor):
    color=np.array([int(hexcolor[i:i+2],16)/255 for i in [1,3,5]])
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
    for input in ['Base Color','Normal','Roughness','Metallic']:
        for link in list(p.inputs[input].links):links.remove(link)
    p.inputs['Roughness'].default_value=.64;p.inputs['Metallic'].default_value=.12
    n=192;yy,xx=np.mgrid[:n,:n];px=np.ones((n,n,4),dtype=np.float32)
    wash=.96+.026*np.sin(xx*.15+np.sin(yy*.06)*2)+.012*np.sin(yy*.38+xx*.2)
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
                c='#d7d1b8' if any(v in name for v in ['steel','edges','Olive']) else '#568e98' if 'Walnut' in name else '#577b91'
                if kind in ['awp','scout'] and 'Olive' in name:c='#b5c5cf'
            elif 'field ripstop' in name:c='#6b8999'
            elif 'glove textile' in name:c='#476079'
            elif 'leather' in name:c='#2e4259'
            elif 'finger protection' in name:c='#5c7889'
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
            pts=[]
            for i in range(19):
                t=i/22;x,y,z=wrist;r=.043+.027*t+.0042*math.sin(t*28)
                reach=.41 if side<0 else .16
                pts.append((x+side*(reach*t+.045*t*t+(.094*math.sin(math.pi*t) if side<0 else 0)),y-(.115 if side<0 else .155)*t+.012*math.sin(t*5)+r*.83,z+.54*t))
            a.line('Long tailored seam',pts[3:],.004,ivory,hand)
            x,y,z=pts[3];a.box('Leather cuff strap',(x,y-.004,z),(.048,.009,.030),teal,hand,.004)
            a.box('Cuff brass buckle',(x+side*.022,y+.004,z),(.013,.006,.022),gold,hand,.002)
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
    a.join_parts(root)

def main():
    results=[]
    kinds=['knife','glock','usp','deagle','ak47','m4a1','awp','mp5','p90','ump45','galil','famas','scout','sg552','aug','m249','fiveseven','tec9','elite','hands']
    for kind in kinds:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        root=w.hands() if kind=='hands' else w.build(kind)
        finish(root,kind);details(root,kind)
        results.append(w.export(root,OUT/('anime-'+kind+'.glb')))
        print('ANIME_WEAPON',kind,flush=True)
    (OUT/'anime-weapons-manifest.json').write_text(json.dumps({'generator':'tools/blender/build_anime_weapons.py','assets':results},indent=2)+'\n')
if __name__=='__main__':main()
