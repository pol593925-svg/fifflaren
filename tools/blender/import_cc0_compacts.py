"""Import authorized CC0 MP5/Tec9 (Stein Games) and Glock18 (locarem).
Sources and hashes are in REALISTIC-ARSENAL-LICENSE.txt. Rigid bone partitions
become existing animation pivots; original mesh/UVs remain authored by source.
"""
import bpy,bmesh,json,sys,argparse,math
import numpy as np
from pathlib import Path
from mathutils import Matrix,Vector
HERE=Path(__file__).resolve().parent;sys.path.insert(0,str(HERE))
import import_cc0_rifles as io
import build_realistic_arsenal as original
ROOT=io.ROOT;OUT=io.OUT

def source_material(source,kind):
    folder=source/'WeaponsPack'/('MP5'if kind=='mp5'else'Tec9');prefix='MP5'if kind=='mp5'else'Tec9'
    mat=bpy.data.materials.new('Realistic CC0 / '+prefix+' Stein PBR');mat.use_nodes=True;mat['cs16Realistic']=True
    nodes,links=mat.node_tree.nodes,mat.node_tree.links;bs=nodes.get('Principled BSDF')
    base=nodes.new('ShaderNodeTexImage');base.image=io.load_image(folder/('T_'+prefix+'_C.png'),1024,True);links.new(base.outputs['Color'],bs.inputs['Base Color'])
    bs.inputs['Roughness'].default_value=.57;bs.inputs['Metallic'].default_value=.62
    normal=folder/('T_'+prefix+'_N.png');packed=folder/('T_'+prefix+'_RMAO.png')
    if normal.exists():
        im=io.load_image(normal,512);px=np.array(im.pixels[:],dtype=np.float32).reshape(im.size[1],im.size[0],4);px[:,:,1]=1-px[:,:,1]
        tex=nodes.new('ShaderNodeTexImage');tex.image=io.packed_image(prefix+' OpenGL normal',px);nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.72
        links.new(tex.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    if packed.exists():
        im=io.load_image(packed,512);raw=np.array(im.pixels[:],dtype=np.float32).reshape(im.size[1],im.size[0],4);px=np.ones_like(raw)
        px[:,:,0]=raw[:,:,2];px[:,:,1]=np.clip(raw[:,:,0],.33,.9);px[:,:,2]=raw[:,:,1]
        tex=nodes.new('ShaderNodeTexImage');tex.image=io.packed_image(prefix+' ORM',px);ch=nodes.new('ShaderNodeSeparateColor');links.new(tex.outputs['Color'],ch.inputs['Color'])
        links.new(ch.outputs['Green'],bs.inputs['Roughness']);links.new(ch.outputs['Blue'],bs.inputs['Metallic'])
    return mat

def world_copy(root,ratio=.20):
    copies=[];bpy.context.view_layer.update()
    for ob in list(root.children_recursive):
        if ob.type!='MESH':continue
        copy=ob.copy();copy.data=ob.data.copy();bpy.context.collection.objects.link(copy)
        transform=ob.matrix_world.copy();copy.parent=None;copy.matrix_world=Matrix.Identity(4);copy.data.transform(transform);copies.append(copy)
    group=io.empty('worldLOD',root);group['cs16Realistic']=True;group['cs16Grip']=root['cs16Grip']
    lod=io.join(copies,'Realistic compact world silhouette',group);bpy.context.view_layer.objects.active=lod
    mod=lod.modifiers.new('Remote weapon budget','DECIMATE');mod.ratio=ratio;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
    lod.data.validate(clean_customdata=True);lod.data.update()
    return group

def split_rigid(ob,transform,mat):
    groups={g.index:g.name for g in ob.vertex_groups}
    moving={'MAGASINE':'magazine','MAGAZINE':'magazine','BOLT':'bolt','BOLT_02':'bolt','SLIDE':'bolt','TRIGGER':'trigger'}
    assigned={v.index:moving.get(groups.get(max(v.groups,key=lambda g:g.weight).group),'weapon')if v.groups else'weapon'for v in ob.data.vertices}
    result=[]
    for part in set(assigned.values()):
        mesh=ob.data.copy();bm=bmesh.new();bm.from_mesh(mesh)
        bmesh.ops.delete(bm,geom=[v for v in bm.verts if assigned[v.index]!=part],context='VERTS')
        bm.to_mesh(mesh);bm.free()
        if not mesh.polygons:bpy.data.meshes.remove(mesh);continue
        mesh.transform(transform);mesh.materials.clear();mesh.materials.append(mat)
        for face in mesh.polygons:face.material_index=0
        mesh.validate(clean_customdata=True);mesh.update()
        out=bpy.data.objects.new('CC0 '+part,mesh);bpy.context.collection.objects.link(out);result.append((part,out))
    return result

def import_stein(source,kind):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    name='MP5'if kind=='mp5'else'Tec9';folder=source/'WeaponsPack'/name
    bpy.ops.import_scene.fbx(filepath=str(folder/('SKM_'+name+'.fbx')))
    originals=list(bpy.context.scene.objects);mat=source_material(source,kind)
    # Author assets face Blender -Y. Rotate to +Y / game -Z and retain metres.
    shift=Vector((0,-.060,-.135))if kind=='mp5'else Vector((0,-.025,-.088))
    transform=Matrix.Translation(shift)@Matrix.Rotation(math.pi,4,'Z')
    parts=[]
    for ob in originals:
        if ob.type=='MESH':parts.extend(split_rigid(ob,transform@ob.matrix_world,mat))
    for ob in originals:bpy.data.objects.remove(ob,do_unlink=True)
    root=io.empty('Realistic '+name+' / Stein Games');root['cs16Realistic']=True
    grip={'right':[0,-.100,.035],'left':[0,-.025,-.225],'mag':[0,-.145,-.121],
          'rail':[0,.047385,-.0715],'bore':[0,-.01569,0],'style':'tube'}if kind=='mp5'else{
          'right':[0,-.074,.025],'left':[0,-.088,.04],'mag':[0,-.145,-.098],
          'rail':[0,.031763,-.087],'bore':[0,-.00019,0],'style':'cup'}
    root['cs16Grip']=grip
    for name in ['weapon','magazine','bolt','trigger']:
        objects=[ob for part,ob in parts if part==name]
        if not objects:continue
        pivot=io.empty(name,root);io.join(objects,'Realistic '+name,pivot)
    world_copy(root)
    row=original.export(root,kind,'Stein Games / Free Classic Weapons Pack v1.1');row['license']='CC0-1.0';row['sourceUrl']='https://stein-indie.itch.io/classic-weapons-pack';row['grip']=grip
    return row

def import_glock(source):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.obj_import(filepath=str(source/'Glock_HighPoly.obj'));ob=bpy.context.object
    bpy.context.view_layer.objects.active=ob;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];root=io.empty('Realistic Glock18 / locarem')
    root['cs16Realistic']=True
    # Source X is length, Y is up, Z is thickness. Preserve all source forms.
    scale=.225/8.84477
    # game x=source Z centred, game y=source Y-1.52, game z=source X-2.8.
    transform=Matrix(((0,0,scale,.2281826*scale),(-scale,0,0,2.8*scale),(0,scale,0,-1.52*scale),(0,0,0,1)))
    steel=original.metal('Parkerized steel',(.205,.22,.232));poly=original.polymer('Polymer',(.115,.122,.126));edge=original.metal('Machined edges',(.31,.325,.34))
    parts={name:[]for name in ['weapon','slide','magazine','trigger']}
    for ob in objects:
        points=[ob.matrix_world@v.co for v in ob.data.vertices];lo=[min(v[k]for v in points)for k in range(3)];hi=[max(v[k]for v in points)for k in range(3)]
        part='magazine'if lo[1]<-2.5 else'slide'if lo[1]>1.6 else'trigger'if .16<lo[1]<.18 and hi[1]<1.4 else'weapon'
        material=steel if part=='slide'else edge if part=='trigger'else poly
        ob.parent=None;world=ob.matrix_world.copy();ob.matrix_world=Matrix.Identity(4);ob.data.transform(transform@world)
        ob.data.materials.clear();ob.data.materials.append(material)
        for face in ob.data.polygons:face.material_index=0
        for color in list(ob.data.color_attributes):ob.data.color_attributes.remove(color)
        bpy.context.view_layer.objects.active=ob
        if len(ob.data.polygons)>100:
            mod=ob.modifiers.new('Preserve authored contours budget','DECIMATE');mod.ratio=.32;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
        ob.data.validate(clean_customdata=True);ob.data.update()
        # Original OBJ has no textures; assign a consistent physical micrograin UV.
        uv=ob.data.uv_layers.active or ob.data.uv_layers.new(name='UVMap')
        for face in ob.data.polygons:
            axis=max(range(3),key=lambda i:abs(face.normal[i]));axes=((1,2),(0,2),(0,1))[axis]
            for loop in face.loop_indices:
                p=ob.data.vertices[ob.data.loops[loop].vertex_index].co;uv.data[loop].uv=(p[axes[0]]*3,p[axes[1]]*3)
        parts[part].append(ob)
    for name,objects in parts.items():
        if objects:io.join(objects,'Realistic Glock '+name,io.empty(name,root))
    # A thin machined adapter seats the common pistol reflex above the solid slide.
    pivot=next(o for o in root.children if o.name=='slide')
    original.a.box('Glock optic adapter',(0,.0263,.008),(.024,.003,.034),steel,pivot,.0005)
    grip={'right':[0,-.062,.022],'left':[0,-.076,.038],'mag':[0,-.100,.024],
          'rail':[0,.0278,.008],'bore':[0,.0129,0],'style':'cup'}
    root['cs16Grip']=grip
    # Two palette batches keep remote weapons cheap and reuse no giant textures.
    original.lod(root,.17)
    row=original.export(root,'glock','locarem / High Poly Glock-18 (No Textures), adapted PBR');row['license']='CC0-1.0';row['sourceUrl']='https://opengameart.org/content/high-poly-glock-18-no-textures';row['grip']=grip
    return row

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,required=True);ap.add_argument('--only',nargs='+',choices=['mp5','tec9','glock']);cfg=ap.parse_args(sys.argv[sys.argv.index('--')+1:])
    report=[]
    for kind in cfg.only or ['mp5','tec9','glock']:report.append(import_glock(cfg.source)if kind=='glock'else import_stein(cfg.source,kind))
    path=OUT/'anime-weapons-manifest.json';manifest=json.loads(path.read_text());replacement={row['file']:row for row in report}
    manifest['assets']=[replacement.get(row['file'],row)for row in manifest['assets']];path.write_text(json.dumps(manifest,indent=2)+'\n')
    (ROOT/'graphics-qa/realistic-compacts.json').write_text(json.dumps(report,indent=2)+'\n')
