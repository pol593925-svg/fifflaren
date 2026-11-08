"""Painted form, material separation and short-range cavities baked offline."""
import bpy, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def bake(root,hands=False):
 bpy.context.view_layer.update()
 groups=list(root.children) if hands else [root]
 for group in groups:
  objects=[o for o in group.children_recursive if o.type=='MESH']
  if not objects:continue
  vertices=[];faces=[]
  for ob in objects:
   base=len(vertices);vertices.extend(ob.matrix_world@v.co for v in ob.data.vertices)
   faces.extend(tuple(base+i for i in p.vertices)for p in ob.data.polygons)
  bvh=BVHTree.FromPolygons(vertices,faces,all_triangles=False,epsilon=.00001)
  samples=[Vector((math.cos(j*2.399)*math.sqrt((j+.5)/6),math.sin(j*2.399)*math.sqrt((j+.5)/6),math.sqrt(1-(j+.5)/6)))for j in range(6)]
  for ob in objects:
   if 'glass' in ob.data.materials[0].name.lower():continue
   material=ob.data.materials[0].name.lower()
   skin='exposed fingers' in material
   textile=any(n in material for n in ['ripstop','textile','leather','binding'])
   enamel=any(n in material for n in ['enamel','ceramic','ivory'])
   colours=ob.data.color_attributes.new(name='DetailShade',type='BYTE_COLOR',domain='POINT')
   ob.data.color_attributes.active_color=colours
   matrix=ob.matrix_world;normal_matrix=matrix.to_3x3().inverted().transposed()
   for vertex in ob.data.vertices:
    normal=(normal_matrix@vertex.normal).normalized();point=matrix@vertex.co+normal*.00065
    axis=normal.cross(Vector((0,0,1)))
    if axis.length<.01:axis=normal.cross(Vector((0,1,0)))
    axis.normalize();up=normal.cross(axis);occlusion=0;reach=.023 if hands else .032
    for sample in samples:
     hit=bvh.ray_cast(point,axis*sample.x+up*sample.y+normal*sample.z,reach)
     if hit[0] is not None:occlusion+=1-hit[3]/reach
    cavity=max(.66,1-occlusion*.063)
    # Broad hand-painted volumes remain legible under the soft game lighting.
    # These are vertex colours, not another material, light, shadow or render pass.
    top=max(0,normal.z);bottom=max(0,-normal.z)
    form=.82+.18*top-.09*bottom
    if skin:
     warmth=.06*(1-top)+.04*bottom
     rgb=(1.0,1-warmth,1-warmth*1.65)
     form=.90+.10*top-.035*bottom
    elif textile:rgb=(.95+.05*top,.975+.025*top,1.0)
    elif enamel:rgb=(1.0,.985+.015*top,.96+.04*top)
    else:rgb=(.94+.06*top,.975+.025*top,1.0)
    for_light=cavity*form
    colours.data[vertex.index].color=tuple(min(1,c*for_light)for c in rgb)+(1,)
