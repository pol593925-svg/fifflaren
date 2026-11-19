"""Prepare 3DModelsCC0's licensed M4/AK for the live viewmodel contract.

Download the source through the author's ordinary free itch.io download page.
blender -b --python tools/blender/import_cc0_rifles.py -- --source <Guns&Explosives>
The runtime filenames stay compatible with saved loadouts; these are real PBR
models, not recoloured copies of the previous illustrated weapons.
"""
import bpy, json, sys, argparse, math
import numpy as np
from pathlib import Path
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'models/csgo'

def packed_image(name, pixels):
    h,w=pixels.shape[:2]
    im=bpy.data.images.new(name,width=w,height=h,alpha=False)
    im.colorspace_settings.name='Non-Color'
    im.pixels.foreach_set(pixels.astype(np.float32).reshape(-1)); im.pack()
    return im

def load_image(path, size, color=False):
    im=bpy.data.images.load(str(path),check_existing=False)
    im.colorspace_settings.name='sRGB' if color else 'Non-Color'
    if max(im.size)>size: im.scale(size,size)
    im.pack(); return im

def material(folder,prefix):
    mat=bpy.data.materials.new('Realistic CC0 / '+prefix+' PBR')
    mat.use_nodes=True; mat['cs16Realistic']=True
    nodes,links=mat.node_tree.nodes,mat.node_tree.links
    bs=nodes.get('Principled BSDF')
    base=nodes.new('ShaderNodeTexImage'); base.image=load_image(folder/(prefix+'_Base_Color.png'),2048,True)
    links.new(base.outputs['Color'],bs.inputs['Base Color'])
    normal_path=next(folder.glob(prefix+'_Normal*.png'))
    normal=load_image(normal_path,1024)
    if 'DirectX' in normal_path.name:
        pix=np.array(normal.pixels[:],dtype=np.float32).reshape(1024,1024,4)
        pix[:,:,1]=1-pix[:,:,1]
        normal=packed_image(prefix+' OpenGL normal',pix)
    tex=nodes.new('ShaderNodeTexImage'); tex.image=normal
    nm=nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value=.75
    links.new(tex.outputs['Color'],nm.inputs['Color']); links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    rough=load_image(folder/(prefix+'_Roughness.png'),1024)
    metal=load_image(folder/(prefix+'_Metallic.png'),1024)
    r=np.array(rough.pixels[:],dtype=np.float32).reshape(1024,1024,4)
    m=np.array(metal.pixels[:],dtype=np.float32).reshape(1024,1024,4)
    pixels=np.ones_like(r); pixels[:,:,1]=np.clip(r[:,:,0],.25,.95); pixels[:,:,2]=m[:,:,0]
    pack=nodes.new('ShaderNodeTexImage'); pack.image=packed_image(prefix+' ORM',pixels)
    channels=nodes.new('ShaderNodeSeparateColor'); links.new(pack.outputs['Color'],channels.inputs['Color'])
    links.new(channels.outputs['Green'],bs.inputs['Roughness']); links.new(channels.outputs['Blue'],bs.inputs['Metallic'])
    return mat

def empty(name,parent=None,position=(0,0,0)):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o)
    o.parent=parent; o.location=position; return o

def join(objects,name,parent):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join(); o=objects[0];o.name=name; o.parent=parent
    return o

def optic_bridge():
    """Original side bracket for the imported AK; the sight has physical support."""
    mat=bpy.data.materials.new('Realistic CC0 / original graphite side mount')
    mat.use_nodes=True;mat['cs16Realistic']=True
    bs=mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(.025,.029,.032,1)
    bs.inputs['Metallic'].default_value=.72;bs.inputs['Roughness'].default_value=.47
    pieces=[]
    def box(name,x,y,z,w,h,d):
        bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y))
        ob=bpy.context.object;ob.name=name;ob.dimensions=(w,d,h)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        bevel=ob.modifiers.new('Machined softened edge','BEVEL');bevel.width=.00065;bevel.segments=2
        bpy.ops.object.modifier_apply(modifier=bevel.name)
        ob.data.materials.append(mat);pieces.append(ob)
    box('AK left dovetail clamp',-.020,.004,-.10,.014,.022,.095)
    box('AK supported optic bridge',-.023,.026,-.10,.009,.044,.095)
    box('AK optic rail bed',-.002,.046,-.10,.052,.008,.110)
    for i in range(9):box('AK optic rail tooth',-.002,.051,-.144+i*.011,.045,.005,.005)
    # All geometry now uses the source's canonical metre convention.
    for ob in pieces:
        transform=ob.matrix_world.copy();ob.matrix_world=Matrix.Identity(4);ob.data.transform(transform)
    return pieces

def run(source,kind):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    folder=source/('M4A1' if kind=='m4a1' else 'AK-47')
    prefix='M4A1' if kind=='m4a1' else 'AK47'
    bpy.ops.import_scene.fbx(filepath=str(folder/(prefix+'.fbx')))
    original=list(bpy.context.scene.objects)
    meshes=[o for o in original if o.type=='MESH']
    # Bake FBX's centimetre parents and peculiar local pivots before assembly.
    shift=Vector((.0007586,.048,0)) if kind=='m4a1' else Vector((.0025469,.25,0))
    for o in meshes:
        transform=Matrix.Translation(shift)@o.matrix_world.copy()
        o.parent=None; o.matrix_world=Matrix.Identity(4);o.data.transform(transform)
    for o in original:
        if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
    root=empty('Realistic '+prefix+' / 3DModelsCC0')
    root['cs16Realistic']=True
    # Coordinates stored in the game/glTF convention: X right, Y up, forward -Z.
    grip={'right':[0,-.092,.035], 'left':[0,.005,-.273], 'mag':[0,-.105,-.105], 'rail':[0,.0475,-.023], 'bore':[0,.017,0], 'style':'tube'} if kind=='m4a1' else {
        'right':[0,-.089,.035], 'left':[0,-.006,-.25], 'mag':[0,-.13,-.13], 'rail':[0,.0535,-.10], 'bore':[0,.005,0], 'style':'tube'}
    root['cs16Grip']=grip
    mat=material(folder,prefix)
    moving={'Magazine':'magazine','Trigger':'trigger','Charging_Handle':'bolt','Ejection_Port':'bolt'}
    static=[]
    for o in meshes:
        o.data.materials.clear();o.data.materials.append(mat)
        o['cs16Realistic']=True
        # Retain the author's split vertex normals, UV seams and hard edges.
        if o.name in moving:
            node=moving[o.name]
            center=sum((v.co for v in o.data.vertices),Vector())/len(o.data.vertices)
            if node=='trigger':center.z=max(v.co.z for v in o.data.vertices)
            pivot=empty(node,root,center)
            o.data.transform(Matrix.Translation(-center));o.parent=pivot;o.name='Realistic '+node+' mesh'
        else:static.append(o)
    if kind=='ak47':static.extend(optic_bridge())
    join(static,'Realistic receiver and furniture',root)
    # A single low-detail textured batch for remote actors and pickups.
    copies=[]
    bpy.context.view_layer.update()
    for ob in list(root.children_recursive):
        if ob.type!='MESH':continue
        copy=ob.copy();copy.data=ob.data.copy();bpy.context.collection.objects.link(copy)
        transform=ob.matrix_world.copy();copy.parent=None;copy.matrix_world=Matrix.Identity(4);copy.data.transform(transform)
        copies.append(copy)
    lod_root=empty('worldLOD',root);lod_root['cs16Realistic']=True;lod_root['cs16Grip']=grip
    lod=join(copies,'Realistic rifle world silhouette',lod_root)
    bpy.context.view_layer.objects.active=lod
    modifier=lod.modifiers.new('Remote weapon triangle budget','DECIMATE')
    modifier.ratio=.24;modifier.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    lod['cs16Realistic']=True
    # FBX split normals can leave stale custom-data ranges after decimation.
    # Validate before glTF export, retaining UVs and source hard-edge normals.
    for ob in root.children_recursive:
        if ob.type=='MESH':ob.data.validate(clean_customdata=True);ob.data.update()
    # Export only the replacement, with metadata used by the existing runtime.
    bpy.ops.object.select_all(action='DESELECT')
    for o in [root]+list(root.children_recursive):o.select_set(True)
    bpy.context.view_layer.objects.active=root
    target=OUT/('anime-'+kind+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,
        export_yup=True,export_apply=True,export_animations=False,export_cameras=False,
        export_lights=False,export_extras=True,export_image_format='AUTO')
    counts={}
    for o in root.children_recursive:
        if o.type=='MESH':o.data.calc_loop_triangles();counts[o.name]=len(o.data.loop_triangles)
    return {'file':target.name,'bytes':target.stat().st_size,'triangles':sum(counts.values()),
        'viewmodelTriangles':sum(v for n,v in counts.items() if n!='Realistic rifle world silhouette'),
        'worldTriangles':counts['Realistic rifle world silhouette'],'batches':counts,
        'source':'3DModelsCC0 Guns & Explosives','license':'CC0-1.0','cs16Realistic':True,'grip':grip}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True)
    cfg=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    report=[run(cfg.source,kind)for kind in ['m4a1','ak47']]
    path=OUT/'anime-weapons-manifest.json'
    manifest=json.loads(path.read_text())
    for replacement in report:
        for i,row in enumerate(manifest['assets']):
            if row['file']==replacement['file']:manifest['assets'][i]=replacement
    path.write_text(json.dumps(manifest,indent=2)+'\n')
    (ROOT/'graphics-qa'/'realistic-rifles.json').write_text(json.dumps(report,indent=2)+'\n')
    print('REALISTIC_RIFLES_PASS',json.dumps(report),flush=True)
