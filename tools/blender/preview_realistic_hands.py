"""Offline verification render of the exported GLB, not a concept image."""
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'graphics-qa/realistic-hands-preview'
OUT.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'models/csgo/anime-hands.glb'))
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24
scene.render.resolution_x=1000;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Inspection world');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.18,.22,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
scene.view_settings.view_transform='AgX'
def xyz(p):return Vector((p[0],-p[2],p[1]))
def point(obj,target):obj.rotation_euler=(xyz(target)-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=xyz((.22,.18,-.26)));camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=.26;scene.camera=camera
for pos,power,size in [((.4,.6,-.2),3,.5),((-.5,.2,.2),2,.4),((0,-.2,-.4),.5,.3)]:
    bpy.ops.object.light_add(type='AREA',location=xyz(pos));light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;point(light,(0,0,0))
for pose in ['rightHand','leftHand']:
    for name in ['rightHand','leftHand','leftCup','leftVertical']:
        for ob in bpy.data.objects[name].children_recursive:ob.hide_render=name!=pose
    camera.location=xyz((.23 if pose=='rightHand' else -.24,.17,-.23));point(camera,((.01 if pose=='rightHand' else -.025),-.005,.025))
    scene.render.filepath=str(OUT/(pose+'-anatomy.png'));bpy.ops.render.render(write_still=True)
    camera.location=xyz((-.23 if pose=='rightHand' else .23,.12,.37));camera.data.ortho_scale=.58;point(camera,((.08 if pose=='rightHand' else -.15),-.07,.20))
    scene.render.filepath=str(OUT/(pose+'-cloth.png'));bpy.ops.render.render(write_still=True)
    camera.data.ortho_scale=.26
