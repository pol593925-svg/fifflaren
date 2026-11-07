"""Painterly art for BOTH tactical layouts; geometry follows the shared gameplay grid.
Run via Blender with Node on PATH: --background --python tools/blender/build_anime_maps.py
The existing map/door/building exporters remain the source of collision footprints.
"""
import bpy, math, sys, json, hashlib, importlib.util, argparse
from pathlib import Path
import numpy as np
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('anime_map_base',HERE/'build_maps.py')
a=importlib.util.module_from_spec(spec);sys.modules[spec.name]=a;spec.loader.exec_module(a)
sys.path.insert(0,str(HERE))
import coast_architecture
original_coast=coast_architecture.build
ROOT=a.ROOT;OUT=ROOT/'models/csgo';ART=ROOT/'assets/cs-anime'

def materials(theme):
    a.MATS.clear();a.TEX_IMAGES.clear()
    palette={'plaster':('#efceac' if theme=='dust2' else '#e6ad9a'),'plaster_light':'#f5dfbb','plaster_blue':'#91b6b5',
      'limestone':'#d9c394','ground':'#ffffff','wood':'#a77d55','shutter':'#478e8f','steel':'#425365','duct':'#93a4b4',
      'tunnel':'#b8b49d','roof':('#438998' if theme=='dust2' else '#627ca4'),'window_glass':'#395d69','dark':'#354959',
      'trim':'#f1d7aa','paint':'#7b4538','lamp_warm':'#ffdf9b','lamp_green':'#91e0b8','flower':'#da8dc0','leaf':'#709852','ceramic':'#b16e54'}
    images={}
    for n in ['plaster-painted','paving-painted']:
        im=bpy.data.images.load(str(ART/(n+'.png')),check_existing=False);im.scale(1024,1024);im.pack();images[n]=im;a.TEX_IMAGES.append(im)
    for name,c in palette.items():
        color=tuple(int(c[i:i+2],16)/255 for i in [1,3,5]);mat=bpy.data.materials.new(name);mat.use_nodes=True
        bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.87;bs.inputs['Metallic'].default_value=0
        im=images['paving-painted'] if name=='ground' else images['plaster-painted'] if name.startswith('plaster') or name in ['limestone','tunnel'] else None
        if im:
            # Bake the palette into the image: glTF cannot reliably export arbitrary
            # MixRGB graphs. This also reduces the old orange blotches on every facade.
            if name.startswith('plaster') or name in ['limestone','tunnel']:
                n=512;sample=im.copy();sample.scale(n,n)
                src=np.array(sample.pixels[:],dtype=np.float32).reshape(n,n,4)
                lum=src[:,:,:3].mean(axis=2);wash=.91+(lum-lum.mean())*.40
                px=np.ones_like(src);px[:,:,:3]=np.clip(np.array(color)[None,None,:]*wash[:,:,None],0,1)
                im=bpy.data.images.new('Painted palette '+name,width=n,height=n,alpha=False)
                im.pixels.foreach_set(px.ravel());im.pack();a.TEX_IMAGES.append(im);bpy.data.images.remove(sample)
            tx=mat.node_tree.nodes.new('ShaderNodeTexImage');tx.image=im;mat.node_tree.links.new(tx.outputs['Color'],bs.inputs['Base Color'])
            bs.inputs['Base Color'].default_value=(1,1,1,1)
        else:
            n=128;yy,xx=np.mgrid[:n,:n];px=np.ones((n,n,4),dtype=np.float32)
            brush=.96+.025*np.sin(xx*.19+np.sin(yy*.10)*3)+.018*np.sin(yy*.36+xx*.03)
            if name in ['wood','shutter']:
                grain=xx*.40+.65*np.sin(yy*.025)+.20*np.sin(yy*.11+xx*.04)
                brush=.94+.035*np.sin(grain)+.018*np.sin(grain*2.8)
                brush-=.035*(np.mod(xx+.6*np.sin(yy*.025),32)<1)
            px[:,:,:3]=np.array(color)[None,None,:]*brush[:,:,None]
            im=bpy.data.images.new('Illustrated '+name,width=n,height=n,alpha=False);im.pixels.foreach_set(px.ravel());im.pack();a.TEX_IMAGES.append(im)
            tx=mat.node_tree.nodes.new('ShaderNodeTexImage');tx.image=im;mat.node_tree.links.new(tx.outputs['Color'],bs.inputs['Base Color'])
        if name.startswith('lamp_'):bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=.4
        a.MATS[name]=mat

def wall_details(x,z,dx,dz,variant,theme):
    px,pz=x*4+2+dx*2,z*4+2+dz*2
    def pt(u,h,d=.08):return (px-dz*u+dx*d,h,pz+dx*u+dz*d)
    def panel(mat,u,y,w,h,d=.08):
        pts=[pt(u-w/2,y-h/2,d),pt(u-w/2,y+h/2,d),pt(u+w/2,y+h/2,d),pt(u+w/2,y-h/2,d)]
        a.face(mat,pts)
    panel('limestone',0,.26,4,.52,.035)
    panel('trim',0,.57,4,.09,.10)
    # Swept ceramic eave curves down over the wall, never above its 4m cover contract.
    for k in range(5):
        t=k/5;u=(k+1)/5;y=3.78+.20*math.sin(t*math.pi/2);yy=3.78+.20*math.sin(u*math.pi/2)
        d=.21*(1-t)+.035;dd=.21*(1-u)+.035
        a.face('roof',[pt(-2,y,d),pt(-2,yy,dd),pt(2,yy,dd),pt(2,y,d)])
    for u in [-1.67,1.67]:panel('wood',u,3.58,.12,.30,.13)
    # Alternate garden walls, timber lattice and arched windows along the streets.
    # Details are shallow and never change the route or cover collision silhouette.
    style=variant%7
    if style in [2,5]:
        for u in [-.75,0,.75]:panel('wood',u,2.2,.045,1.7,.075)
        for y in [1.5,2.05,2.6,3.05]:panel('wood',0,y,1.65,.04,.08)
        for j in range(27):
            u=math.sin(j*2.399)*(.35+(j%3)*.18);y=1.15+j*.065
            a.face('leaf',[pt(u-.13,y,.11),pt(u,y+.20,.17),pt(u+.14,y+.04,.13),pt(u,y-.04,.10)])
            if j%3==0:
                for k in range(6):
                    aa=k*math.tau/6;bb=(k+1)*math.tau/6
                    a.face('flower',[pt(u,y+.10,.20),pt(u+math.cos(aa)*.07,y+.10+math.sin(aa)*.07,.21),pt(u+math.cos(bb)*.07,y+.10+math.sin(bb)*.07,.21)])
        return
    # A tall arched recess with carved rim and coloured shutters instead of a rectangular sticker.
    base=1.35;r=.60;center=2.62
    shape=[(-r,base),(-r,center)]+[(math.cos(math.pi-i*math.pi/14)*r,center+math.sin(math.pi-i*math.pi/14)*r) for i in range(15)]+[(r,base)]
    a.face('window_glass',[pt(u,y,.054) for u,y in shape])
    for j in range(14):
        aa=j*math.pi/14;bb=(j+1)*math.pi/14
        a.face('trim',[pt(math.cos(t)*rr,center+math.sin(t)*rr,.13) for t,rr in [(aa,r),(aa,r+.13),(bb,r+.13),(bb,r)]])
    for u in [-.665,.665]:panel('trim',u,(base+center)/2,.13,center-base,.13)
    panel('trim',0,1.30,1.59,.13,.22);panel('wood',0,2.05,.05,1.46,.09);panel('wood',0,2.15,1.16,.05,.09)
    for s in [-1,1]:
        panel('shutter',s*.89,2.02,.32,1.4,.08)
        for k in range(7):panel('shutter',s*.89,1.47+k*.17,.30,.075,.11)
    if variant%3==0:
        panel('wood',0,1.14,1.50,.20,.30)
        for j in range(11):
            u=-.60+j*.12;yy=1.36+.10*math.sin(j*2.4)
            a.face('leaf',[pt(u-.13,yy,.32),pt(u-.08,yy+.23,.36),pt(u+.13,yy+.10,.36)])
            if j%2==0:
                for k in range(5):
                    t=k*math.tau/5;a.face('flower',[pt(u,yy+.17,.38),pt(u+math.cos(t)*.09,yy+.17+math.sin(t)*.09,.39),pt(u+math.cos(t+.9)*.09,yy+.17+math.sin(t+.9)*.09,.39)])
    elif variant%3==1:
        panel('steel',1.35,2.8,.24,.38,.20);panel('lamp_warm',1.35,2.81,.16,.25,.22)

def coast(a,theme):
    import anime_architecture
    return anime_architecture.build(a,theme)

def site_markers(theme,rows):
    import subprocess
    plan=json.loads(subprocess.check_output(['node',str(ROOT/'tools/export-coast-buildings.cjs'),theme],cwd=ROOT,encoding='utf8'))
    for letter,site in plan['tactical']['sites'].items():
        x=(site['x1']+site['x2']+1)*2;z=(site['y1']+site['y2']+1)*2
        a.glyph(letter,x,.025,z,5.8)
        for j in range(48):
            t=j*math.tau/48;q=(j+1)*math.tau/48
            a.face('paint',[(x+math.cos(v)*r,.025,z+math.sin(v)*r)for v,r in [(t,4.2),(t,4.38),(q,4.38),(q,4.2)]])
        # Readable vertical objective plaque on the north wall of each court.
        zz=46*4+.06;a.box('wood',x,2.3,zz,2.0,2.35,.14);a.box('shutter',x,2.3,zz+.08,1.82,2.17,.04)
        paths=[[(-.55,-.7),(0,.7),(.55,-.7)],[(-.34,-.12),(.34,-.12)]] if letter=='A' else [[(-.46,-.7),(-.46,.7),(.22,.7),(.48,.48),(.46,.22),(.17,0),(-.46,0)],[(.17,0),(.52,-.23),(.5,-.51),(.21,-.7),(-.46,-.7)]]
        for path in paths:
            for (u,v),(uu,vv) in zip(path,path[1:]):
                length=math.hypot(uu-u,vv-v);du=-(vv-v)/length*.065;dv=(uu-u)/length*.065
                a.face('trim',[(x+u-du,2.3+v-dv,zz+.11),(x+uu-du,2.3+vv-dv,zz+.11),(x+uu+du,2.3+vv+dv,zz+.11),(x+u+du,2.3+v+dv,zz+.11)])


def main():
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    ap=argparse.ArgumentParser();ap.add_argument('--map',choices=['dust2','inferno','all'],default='all');cfg=ap.parse_args(args)
    a.create_materials=materials;a.wall_details=wall_details;a.site_markers=site_markers;coast_architecture.build=coast
    layouts=a.read_layouts();manifest={'generator':'tools/blender/build_anime_maps.py','style':'Painterly anime','collisionSource':'Authored tactical MAP_ROWS, CS16TacticalMap and CS16Buildings','maps':{}}
    raw_face=a.face
    for theme,rows in layouts.items():
        if cfg.map not in ['all',theme]:continue
        bpy.ops.wm.read_factory_settings(use_empty=True);materials(theme)
        # The unused exterior is a solid mass of grid cells. Four continuous skins
        # replace tens of thousands of identical quads; playable surfaces stay exact.
        cells=[(x,z)for z,row in enumerate(rows)for x,ch in enumerate(row)if ch not in ['#','T','B']]
        xmin=(min(x for x,z in cells)-2)*4;xmax=(max(x for x,z in cells)+3)*4
        zmin=(min(z for x,z in cells)-2)*4;zmax=(max(z for x,z in cells)+3)*4
        def compact_face(mat,verts,uv=None,tint=1,backdrop=False):
            if not backdrop and (max(v[0]for v in verts)<=xmin or min(v[0]for v in verts)>=xmax or max(v[2]for v in verts)<=zmin or min(v[2]for v in verts)>=zmax):return
            raw_face(mat,verts,uv,tint,backdrop)
        a.face=compact_face
        lamps,beacons=a.build_map(theme,rows)
        for x0,z0,x1,z1 in [(0,0,504,zmin),(0,zmax,504,504),(0,zmin,xmin,zmax),(xmax,zmin,504,zmax)]:
            for mat,y in [('ground',0),('limestone',4)]:raw_face(mat,[(x0,y,z1),(x1,y,z1),(x1,y,z0),(x0,y,z0)])
        a.face=raw_face;objects=a.bake_batches()
        import bmesh
        for ob in objects:
            if ob.data.materials[0].name not in ['roof','trim','wood','ceramic','shutter']:continue
            bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(ob.data);bm.free()
            for poly in ob.data.polygons:poly.use_smooth=True
            bpy.context.view_layer.objects.active=ob
            normal=ob.modifiers.new('Balanced surface normals','WEIGHTED_NORMAL');normal.keep_sharp=True
            bpy.ops.object.modifier_apply(modifier=normal.name)
        tris=0
        for ob in objects:ob.data.calc_loop_triangles();tris+=len(ob.data.loop_triangles)
        target=OUT/('anime-'+theme+'.glb')
        bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_yup=True,export_apply=False,export_animations=False,export_cameras=False,export_lights=False,export_extras=True,export_image_format='AUTO',export_materials='EXPORT')
        manifest['maps'][theme]={'file':target.name,'bytes':target.stat().st_size,'triangles':tris,'meshBatches':len(objects),'layoutSha256':hashlib.sha256('\n'.join(rows).encode()).hexdigest()}
        print('ANIME_MAP',theme,json.dumps(manifest['maps'][theme]),flush=True)
    (OUT/'anime-maps-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
if __name__=='__main__':main()
