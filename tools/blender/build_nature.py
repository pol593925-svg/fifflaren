"""Export the same CC0 Quaternius nature used in Evolution, with bounded texture/mesh sizes.
blender --background --python tools/blender/build_nature.py -- --source PATH_TO_NATURE
Source/license: https://quaternius.com/packs/ultimatestylizednature.html
"""
import argparse, sys, math
from pathlib import Path
import bpy
from mathutils import Vector
parser=argparse.ArgumentParser();parser.add_argument('--source',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);src=Path(args.source)
root=Path(__file__).resolve().parents[2];out=root/'models/csgo/nature.glb'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
materials={};species=[('oak','NormalTree_1',5.2),('birch','BirchTree_2',5.8),('pine','PineTree_1',6.1),('bush','Bush_Flowers',1.15),('rock','Rock_1',.85)]
for key,file,height in species:
    before=set(bpy.data.objects);bpy.ops.import_scene.fbx(filepath=str(src/(file+'.fbx')))
    objects=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    points=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
    bottom=min(p.z for p in points);top=max(p.z for p in points);scale=height/max(.01,top-bottom)
    cx=(min(p.x for p in points)+max(p.x for p in points))/2;cy=(min(p.y for p in points)+max(p.y for p in points))/2
    for o in objects:
        # Bake all transforms and normalization into vertices, keeping origins at ground level.
        matrix=o.matrix_world.copy()
        for v in o.data.vertices:
            p=matrix@v.co;v.co=((p.x-cx)*scale,(p.y-cy)*scale,(p.z-bottom)*scale)
        o.matrix_world.identity()
        for slot in o.material_slots:
            name=slot.material.name.split('.')[0] if slot.material else 'Rocks'
            if name not in materials:
                mat=bpy.data.materials.new('nature_'+name);mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
                p.inputs['Roughness'].default_value=.92
                tex=src/(name+'.png')
                if not tex.exists():tex=src/('Flowers.png' if 'Flower' in name else 'Rocks.png')
                image=bpy.data.images.load(str(tex),check_existing=True)
                limit=1024 if 'Bark' in name or name=='Rocks' else 512
                if max(image.size)>limit:
                    ratio=limit/max(image.size);image.scale(max(1,int(image.size[0]*ratio)),max(1,int(image.size[1]*ratio)))
                if 'Bark' in name or name in ('Rocks','Rock'):
                    compact=root/'models/csgo/textures'/('nature_'+name+'.jpg');compact.parent.mkdir(parents=True,exist_ok=True)
                    image.filepath_raw=str(compact);image.file_format='JPEG';image.save()
                    image=bpy.data.images.load(str(compact),check_existing=False)
                image.pack();node=nodes.new('ShaderNodeTexImage');node.image=image;links.new(node.outputs['Color'],p.inputs['Base Color'])
                leaves='Leaves' in name or 'Flower' in name
                if leaves:
                    links.new(node.outputs['Alpha'],p.inputs['Alpha']);mat.surface_render_method='DITHERED';mat.use_nodes=True
                    mat.use_backface_culling=False
                materials[name]=mat
            slot.material=materials[name]
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
        parts=list(bpy.context.selected_objects)
        for idx,part in enumerate(parts):
            part.name=f'{key}_{part.data.materials[0].name if part.data.materials else idx}'
            # Preserve alpha-card leaves; reduce only excessively detailed opaque trunks.
            if len(part.data.polygons)>2500 and 'Bark' in part.name:
                mod=part.modifiers.new('Runtime budget','DECIMATE');mod.ratio=.55;bpy.context.view_layer.objects.active=part;bpy.ops.object.modifier_apply(modifier=mod.name)
            for poly in part.data.polygons:poly.use_smooth=True
    for o in list(bpy.data.objects):
        if o not in before and o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
for o in bpy.data.objects:o.select_set(o.type=='MESH')
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_materials='EXPORT',export_image_format='AUTO')
print('NATURE_EXPORTED',out,out.stat().st_size)
for o in bpy.data.objects:
    if o.type=='MESH':print(o.name,len(o.data.polygons))
