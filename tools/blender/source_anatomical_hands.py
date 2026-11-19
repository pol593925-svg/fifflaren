"""Bake para's CC0 anatomical hand mesh into the existing weapon contact poses.

Source: https://opengameart.org/content/fps-arms-rigged-only (para, CC0).
Only the hand portion of the FBX is used; no runtime armature or animation.
Our cloth, glove materials, poses and stitched details are original additions.
"""
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

SOURCE = Path(__file__).resolve().parent / 'sources/cc0-para-fps-arms.fbx'


def read_source():
    before=set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(SOURCE),use_custom_normals=True)
    imported=set(bpy.data.objects)-before
    rig=next(ob for ob in imported if ob.type=='ARMATURE')
    mesh=next(ob for ob in imported if ob.type=='MESH')
    bones={bone.name:(rig.matrix_world@bone.head_local,rig.matrix_world@bone.tail_local) for bone in rig.data.bones}
    groups={group.index:group.name for group in mesh.vertex_groups}
    vertices=[mesh.matrix_world@v.co for v in mesh.data.vertices]
    weights=[[(groups[g.group],g.weight) for g in v.groups if g.weight>.00001] for v in mesh.data.vertices]
    wrist=bones['hand.R'][0]
    forward=(bones['palm_middle.R'][1]-wrist).normalized()
    # Cut source forearm behind the wrist; sleeve overlaps this open boundary.
    keep={i for i,v in enumerate(vertices) if v.x<0 and (v-wrist).dot(forward)>-.033}
    faces=[tuple(p.vertices) for p in mesh.data.polygons if all(i in keep for i in p.vertices)]
    for ob in imported:bpy.data.objects.remove(ob,do_unlink=True)
    return {'vertices':vertices,'weights':weights,'faces':faces,'bones':bones}


def paths(name):
    side=1 if name=='rightHand' else -1
    spread=.013 if name=='leftCup' else 0
    def p(x,y,z):return Vector((side*(x+spread),y,z))
    if name=='leftHand':
        wrist=Vector((-.078,-.034,.037))
        fingers={}
        for j,finger in enumerate(['index','middle','ring','pinky']):
            z=-.026+j*.020
            fingers[finger]=[Vector(v) for v in [(-.034,-.027,z),(-.017,-.041,z-.004),(.009,-.042,z-.006),(.030,-.029,z-.006),(.036,-.012+j*.001,z-.004)]]
        thumb=[Vector(v) for v in [(-.061,-.021,.023),(-.047,-.008,.017),(-.038,.005,.004),(-.029,.014,-.015),(-.019,.009,-.029)]]
    else:
        wrist=p(.037,-.036,.060)
        fingers={}
        for j,finger in enumerate(['index','middle','ring','pinky']):
            y=.029-.019*j
            if j==0 and name!='leftCup':
                points=[p(.034,y,-.010),p(.038,y+.008,-.034),p(.029,y+.011,-.052),p(.013,y+.012,-.061),p(.003,y+.008,-.061)]
            else:
                points=[p(.035,y,-.007),p(.038,y,-.026),p(.023,y-.003,-.042),p(.002,y-.006,-.041),p(-.015+(j==3)*.006,y-.004,-.030)]
            fingers[finger]=points
        thumb=[p(.028,.010,.046),p(.014,.025,.038),p(-.010,.032,.026),p(-.027,.027,.006),p(-.029,.025,-.009)]
    return wrist,fingers,thumb


def frame(forward,across):
    forward=forward.normalized()
    across=(across-forward*forward.dot(across)).normalized()
    return Matrix((across,forward.cross(across),forward)).transposed()


def arc_sample(points,t):
    lengths=[(b-a).length for a,b in zip(points,points[1:])]
    remaining=sum(lengths)*t
    for i,length in enumerate(lengths):
        if remaining<=length:return points[i].lerp(points[i+1],remaining/max(length,1e-8))
        remaining-=length
    return points[-1].copy()


def create_pose(a,parent,data,leather,textile):
    name=parent.name;bones=data['bones']
    wrist,fingers,thumb=paths(name)
    original=bones['hand.R'][0]
    old_frame=frame(bones['palm_middle.R'][1]-original,bones['palm_index.R'][1]-bones['palm_pinky.R'][1])
    new_frame=frame(fingers['middle'][0]-wrist,fingers['index'][0]-fingers['pinky'][0])
    # Opposite hands are a true mirror, preserving the thumb side of the grip.
    if name!='rightHand':new_frame.col[1]=-new_frame.col[1]
    forward_scale=(fingers['middle'][0]-wrist).length/(bones['palm_middle.R'][1]-original).length
    width_scale=(fingers['index'][0]-fingers['pinky'][0]).length/(bones['palm_index.R'][1]-bones['palm_pinky.R'][1]).length
    base=new_frame@Matrix.Diagonal((width_scale,.92,forward_scale))@old_frame.transposed()
    rotate=new_frame@old_frame.transposed()
    def base_point(p):return wrist+base@(p-original)
    transforms={}
    def transform(bone,target_head,target_tail):
        head,tail=bones[bone];axis=(tail-head).normalized();target_axis=(target_tail-target_head).normalized()
        across=old_frame.col[0]-axis*old_frame.col[0].dot(axis)
        if across.length<.1:across=old_frame.col[1]-axis*old_frame.col[1].dot(axis)
        across.normalize();other=axis.cross(across)
        target_across=rotate@across
        target_across=(target_across-target_axis*target_across.dot(target_axis)).normalized()
        target_other=target_axis.cross(target_across)
        if name!='rightHand':target_other=-target_other
        src=Matrix((across,other,axis)).transposed()
        dst=Matrix((target_across,target_other,target_axis)).transposed()
        matrix=dst@Matrix.Diagonal((.87,.87,(target_tail-target_head).length/max((tail-head).length,1e-8)))@src.transposed()
        transforms[bone]=(matrix,target_head-matrix@head)
    for finger,points in fingers.items():
        palm='palm_'+finger+'.R'
        transform(palm,base_point(bones[palm][0]),points[0])
        samples=[arc_sample(points,t) for t in [0,.43,.74,1]]
        for j in range(3):transform('f_'+finger+'.'+str(j+1).zfill(2)+'.R',samples[j],samples[j+1])
    samples=[arc_sample(thumb,t) for t in [0,.37,.72,1]]
    for j in range(3):transform('thumb.'+str(j+1).zfill(2)+'.R',samples[j],samples[j+1])
    used=sorted(set(i for face in data['faces'] for i in face));mapping={v:i for i,v in enumerate(used)}
    vertices=[]
    for index in used:
        source=data['vertices'][index];total=0;vertex=Vector()
        for group,weight in data['weights'][index]:
            if group in transforms:
                matrix,translation=transforms[group];point=matrix@source+translation
            else:point=base_point(source)
            vertex+=point*weight;total+=weight
        vertices.append(tuple(vertex/max(total,1e-8)))
    faces=[tuple(mapping[i] for i in face) for face in data['faces']]
    ob=a.mesh('CC0 anatomical continuous glove '+name,vertices,faces,leather,parent)
    bpy.context.view_layer.objects.active=ob
    smoothing=ob.modifiers.new('Relax baked phalange transitions','SMOOTH')
    smoothing.factor=.34;smoothing.iterations=3
    bpy.ops.object.modifier_apply(modifier=smoothing.name)
    ob.data.materials.append(textile)
    # Material split follows anatomy, retaining one continuous watertight palm.
    for polygon in ob.data.polygons:
        normals=[]
        for index in polygon.vertices:
            normal=new_frame.col[1]
            # Dorsal facing surfaces use woven glove fabric; palm uses leather.
            normals.append(Vector(a.xyz(normal)))
        if polygon.normal.dot(normals[0])>.15:polygon.material_index=1
    # UVs are physical scale. Fine glove weave does not become giant checkerboard.
    for uv in ob.data.uv_layers.active.data:uv.uv*=7
    ob['sourceAuthor']='para'
    ob['sourceLicense']='CC0-1.0'
    ob['sourceURL']='https://opengameart.org/content/fps-arms-rigged-only'
    return ob,wrist,new_frame.col[1],fingers
