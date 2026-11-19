"""Extract and batch licensed ORCA models, keeping source archive outside the app."""
import bpy,json,math,bmesh
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT.parent/'realism-sources/bistro';TEX=ROOT/'assets/cs-realistic/bistro';OUT=ROOT/'models/csgo/bistro-kit.glb'
manifest=json.loads((TEX/'manifest.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'bistro-source.blend'))
chosen=set(n for ns in manifest['models'].values()for n in ns)
transforms={o.name:o.matrix_world.copy() for o in bpy.data.objects if o.name in chosen}
for o in list(bpy.data.objects):
 if o.name not in chosen:bpy.data.objects.remove(o,do_unlink=True)
mats={};images={}
def image(name,kind):
 f=manifest['materials'].get(name,{}).get(kind)
 if not f:return None
 if f not in images:
  im=bpy.data.images.load(str(TEX/f),check_existing=False);im.colorspace_settings.name='sRGB' if kind=='BaseColor' else 'Non-Color';images[f]=im
 return images[f]
def material(old):
 name=old.name.replace('.DoubleSided','')
 if name in mats:return mats[name]
 m=bpy.data.materials.new('Bistro '+name);m.use_nodes=True;m['cs16Realistic']=True;m['source']='Amazon Lumberyard Bistro CC BY 4.0'
 nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.75
 im=image(name,'BaseColor')
 if im:
  tx=nodes.new('ShaderNodeTexImage');tx.image=im;links.new(tx.outputs['Color'],p.inputs['Base Color'])
  if name.startswith('Foliage_') and any(v in name.lower() for v in ['leaves','leaf']):
   cutoff=nodes.new('ShaderNodeMath');cutoff.operation='GREATER_THAN';cutoff.inputs[1].default_value=.48
   links.new(tx.outputs['Alpha'],cutoff.inputs[0]);links.new(cutoff.outputs[0],p.inputs['Alpha']);m.use_backface_culling=False
   m['cs16Foliage']=True
 im=image(name,'Normal')
 if im:
  tx=nodes.new('ShaderNodeTexImage');tx.image=im;nm=nodes.new('ShaderNodeNormalMap');links.new(tx.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],p.inputs['Normal'])
 im=image(name,'Specular')
 if im:
  tx=nodes.new('ShaderNodeTexImage');tx.image=im;sep=nodes.new('ShaderNodeSeparateColor');links.new(tx.outputs['Color'],sep.inputs['Color']);links.new(sep.outputs['Green'],p.inputs['Roughness']);links.new(sep.outputs['Blue'],p.inputs['Metallic'])
 if 'Glass' in name:p.inputs['Base Color'].default_value=(.12,.17,.18,1);p.inputs['Roughness'].default_value=.23
 mats[name]=m;return m
report={}
for kind,names in manifest['models'].items():
 bpy.ops.object.select_all(action='DESELECT')
 # Different kits can use a component from the same original building. Copies
 # leave the full city's transforms, UVs and topology intact.
 objs=[]
 for n in names:
  if n not in bpy.data.objects:continue
  src=bpy.data.objects[n];ob=src.copy();ob.data=src.data.copy();bpy.context.collection.objects.link(ob)
  ob['sourceName']=n;objs.append(ob)
 if not objs:continue
 for ob in objs:
  transform=transforms[ob['sourceName']];ob.parent=None;ob.matrix_world=transform
  ob.data.transform(ob.matrix_world);ob.matrix_world=Matrix.Identity(4)
  if kind=='shutter_panel':
   # Select one connected original shutter; the source contains forty-seven
   # panels distributed over an apartment facade. Do not scale the whole set.
   parent=list(range(len(ob.data.vertices)))
   def find(n):
    while parent[n]!=n:parent[n]=parent[parent[n]];n=parent[n]
    return n
   for edge in ob.data.edges:
    aa,bb=map(find,edge.vertices);parent[aa]=bb
   groups={}
   for v in ob.data.vertices:groups.setdefault(find(v.index),[]).append(v.index)
   groups=[ids for ids in groups.values() if len(ids)>70]
   target=Vector((21.76,73.35,10.73))
   ids=min(groups,key=lambda ids:(sum((ob.data.vertices[i].co for i in ids),Vector())/len(ids)-target).length_squared)
   keep=set(ids);bm=bmesh.new();bm.from_mesh(ob.data);bm.verts.ensure_lookup_table()
   bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.index not in keep],context='VERTS');bm.to_mesh(ob.data);bm.free()
  elif kind=='balcony_fascia':
   # Original limestone balcony moulding only; the ornamental upper windows and
   # open balusters do not match this game's solid cover and are omitted.
   bm=bmesh.new();bm.from_mesh(ob.data)
   bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<7.0 or v.co.z>7.40],context='VERTS');bm.to_mesh(ob.data);bm.free()
  for i,m in enumerate(ob.data.materials):ob.data.materials[i]=material(m)
 # Align compact props to their major horizontal axis. Original FBX placement is diagonal.
 pts=np.array([tuple(v.co)for ob in objs for v in ob.data.vertices]);center=pts.mean(axis=0)
 if kind!='townhouses':
  covariance=np.cov((pts[:,:2]-center[:2]).T);values,vectors=np.linalg.eigh(covariance);axis=vectors[:,np.argmax(values)];angle=-math.atan2(axis[1],axis[0]);rotation=Matrix.Rotation(angle,4,'Z')
  for ob in objs:ob.data.transform(rotation)
  pts=np.array([tuple(v.co)for ob in objs for v in ob.data.vertices])
 lo=pts.min(axis=0);hi=pts.max(axis=0);offset=Vector(((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,lo[2]))
 for ob in objs:
  ob.data.transform(Matrix.Translation(-offset));ob.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();ob=objs[0];ob.name='bistro_'+kind;ob['cs16Realistic']=True
 if kind in ['window_frame','pilaster','shutter_panel','balcony_fascia']:
  # Fit licensed ornamental geometry to the existing opening/corner envelope.
  # This is real source geometry, not a generated imitation of the facade.
  dims=hi-lo
  target_dims={'window_frame':(2.48,.20,1.94),'pilaster':(.48,.32,6.86),'shutter_panel':(.44,.075,1.49),'balcony_fascia':(8,.13,.18)}[kind]
  scale=tuple(target_dims[i]/dims[i] for i in range(3))
  ob.data.transform(Matrix.Diagonal(Vector((*scale,1))))
  if kind=='window_frame':
   # Preserve the entire 2.00 x 1.50 metre playable window. Clip all original
   # frame triangles to the complement of that opening, interpolating UVs.
   src=ob.data;src.calc_loop_triangles();uv=src.uv_layers.active.data;vertices=[];faces=[];tex=[]
   def clip(poly,axis,value,greater):
    out=[]
    for i,current in enumerate(poly):
     previous=poly[i-1];a=current[0][axis]-value;b=previous[0][axis]-value;inside=a>=-1e-7 if greater else a<=1e-7;before=b>=-1e-7 if greater else b<=1e-7
     if inside!=before:
      t=b/(b-a);out.append((previous[0].lerp(current[0],t),previous[1].lerp(current[1],t)))
     if inside:out.append(current)
    return out
   for tri in src.loop_triangles:
    base=[(src.vertices[v].co.copy(),uv[l].uv.copy()) for v,l in zip(tri.vertices,tri.loops)]
    for planes in [[(0,-1,False)],[(0,1,True)],[(0,-1,True),(0,1,False),(2,.22,False)],[(0,-1,True),(0,1,False),(2,1.72,True)]]:
     poly=base
     for axis,value,greater in planes:poly=clip(poly,axis,value,greater) if poly else []
     if len(poly)<3:continue
     for i in range(1,len(poly)-1):
      part=[poly[0],poly[i],poly[i+1]]
      if (part[1][0]-part[0][0]).cross(part[2][0]-part[0][0]).length_squared<1e-14:continue
      n=len(vertices);vertices.extend(p[0]for p in part);tex.extend(p[1]for p in part);faces.append((n,n+1,n+2))
   mesh=bpy.data.meshes.new('Bistro frame fitted to clear gameplay opening');mesh.from_pydata(vertices,[],faces);mesh.materials.append(src.materials[0]);layer=mesh.uv_layers.new(name='UVMap')
   for i,loop in enumerate(mesh.loops):layer.data[i].uv=tex[loop.vertex_index]
   ob.data=mesh
  # UVs remain the original Bistro UVs. The moulded silhouette and stone relief
  # are retained at the authored profile; only the installation dimensions vary.
  hi=np.array([v.co[:]for v in ob.data.vertices]).max(axis=0);lo=np.array([v.co[:]for v in ob.data.vertices]).min(axis=0)
 ratio=.48 if kind=='townhouses' else .26 if kind=='tree' else .22 if kind=='cypress' else .65 if kind in ['awning','lantern'] else 1
 if ratio<1:
  mod=ob.modifiers.new('Distance-ready silhouette simplification','DECIMATE');mod.ratio=ratio;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 ob.data.calc_loop_triangles();report[kind]={'triangles':len(ob.data.loop_triangles),'dimensions':[round(float(x),4)for x in hi-lo]}
 bpy.ops.object.select_all(action='DESELECT')
for name in chosen:
 if name in bpy.data.objects:bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
for ob in bpy.data.objects:ob.select_set(ob.type=='MESH')
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True,export_image_format='AUTO')
report['bytes']=OUT.stat().st_size;(TEX/'geometry.json').write_text(json.dumps(report,indent=2)+'\n');print('BISTRO_KIT',json.dumps(report),flush=True)
