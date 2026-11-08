"""Small-radius cavity shading baked into vertices; no runtime AO pass or texture."""
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
    value=max(.69,1-occlusion*.055)
    # Slightly cool cavities; keeps painted highlights while separating touching parts.
    colours.data[vertex.index].color=(value*.99,value,min(1,value*1.014),1)
