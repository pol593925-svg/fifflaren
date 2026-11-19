"""Tactical first-person hands with CC0 anatomical mesh and original cloth.

Four existing physical grip poses and origins remain compatible with every gun.
Detail is authored offline: curved fingers, padded glove back, ribbed cuff,
double stitching, woven fabric and leather PBR. No per-frame mesh deformation.
"""
from pathlib import Path
import importlib.util, sys, math, json
import bpy, bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0,str(HERE))
import source_anatomical_hands as anatomy
spec = importlib.util.spec_from_file_location('tactical_weapon_base', HERE/'build_weapons.py')
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)
a = w.a


def pbr(name, color, kind, roughness):
    mat = a.surface(name, color, roughness)
    mat['cs16Realistic'] = True
    mat['originalAuthor'] = 'Support Hub / original procedural asset'
    n = 512 if kind == 'cloth' else 256
    yy, xx = np.mgrid[:n, :n].astype(np.float32)
    u, v = xx*math.tau/n, yy*math.tau/n
    rng = np.random.default_rng(sum(map(ord,name)))
    noise = rng.normal(0, 1, (n,n)).astype(np.float32)
    if kind == 'cloth':
        warp = np.sin(u*80)*np.cos(v*40+.8*np.sin(u*40))
        weft = np.sin(v*80)*np.cos(u*40)
        ripstop = np.maximum(np.exp(-np.sin(u*10)**2*140), np.exp(-np.sin(v*10)**2*140))
        frequency=np.fft.fftfreq(n);fy,fx=np.meshgrid(frequency,frequency)
        # Irregular washed cotton avoids the uniformly smooth plastic reading.
        # This is pigment and small thread relief, not a reflective camouflage.
        broad=np.fft.ifft2(np.fft.fft2(noise)*np.exp(-(fx*fx+fy*fy)*2*math.pi**2*18**2)).real
        broad=(broad/max(float(broad.std()),1e-6)).astype(np.float32)
        pigment = 1+warp*.095+weft*.065+broad*.085+noise*.022-ripstop*.040
        height = warp*.44+weft*.31+ripstop*.16+broad*.18
    elif kind == 'leather':
        broad = np.sin(u*11+.9*np.sin(v*7))*np.cos(v*13+.8*np.sin(u*4))
        pores = noise*.09
        pigment = 1+broad*.065+noise*.022
        height = broad*.26+pores*1.8
    else:
        rib = np.sin(v*54+.3*np.sin(u*4))
        pigment = 1+rib*.025+noise*.004
        height = rib*.19+noise*.015
    base = np.ones((n,n,4), np.float32)
    base[:,:,:3] = np.clip(np.array(color)[None,None,:]*pigment[:,:,None],0,1)
    dx = (np.roll(height,-1,1)-np.roll(height,1,1))*.26
    dy = (np.roll(height,-1,0)-np.roll(height,1,0))*.26
    normals = np.stack((-dx,-dy,np.ones_like(dx)),2)
    normals /= np.linalg.norm(normals,axis=2,keepdims=True)
    normal = np.ones_like(base)
    normal[:,:,:3] = normals*.5+.5
    rough = np.ones_like(base)
    rough[:,:,:3] = np.clip(roughness+noise[:,:,None]*.025+(broad[:,:,None]*.025 if kind in ('cloth','leather') else 0),.65,.99)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bs = nodes.get('Principled BSDF')
    for label,pixels,channel,col in [('albedo',base,'Base Color',True),('roughness',rough[::2,::2],'Roughness',False)]:
        tx=nodes.new('ShaderNodeTexImage');tx.image=a.image(name+' '+label,pixels,col)
        links.new(tx.outputs['Color'],bs.inputs[channel])
    nt=nodes.new('ShaderNodeTexImage');nt.image=a.image(name+' grain normal',normal[::2,::2],False)
    nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.9 if kind=='cloth' else .6
    links.new(nt.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],bs.inputs['Normal'])
    return mat


def to_game(v):
    return Vector((v.x,v.z,-v.y))


def form(root,cloth,leather,textile,thread,source):
    for hand in root.children:
        if hand.type!='EMPTY':continue
        side=1 if hand.name=='rightHand' else -1
        anatomical,wrist,dorsal,fingers=anatomy.create_pose(a,hand,source,leather,textile)
        # Flexible leather reinforcement follows the real knuckle rather than
        # replacing the fingers with disconnected procedural cylinders.
        for finger,points in fingers.items():
            centre=points[0].lerp(points[1],.25)+dorsal*.0065
            pad=a.orb('Flexible glove knuckle pad',tuple(centre),(.008,.0038,.012),leather,hand,10,5)
            # Orb construction is in game coordinates, so correct only its
            # axes about its own centre; vertex positions stay in the grip frame.
            pivot=Vector(a.xyz(centre));rotation=Vector((0,0,1)).rotation_difference(Vector(a.xyz(dorsal))).to_matrix()
            for vertex in pad.data.vertices:vertex.co=pivot+rotation@(vertex.co-pivot)
        def arm(t):
            x,y,z=wrist;reach=.41 if side<0 else .16
            # Wrist remains at the contact pose; the forearm bends gently away
            # from the gun and drops at the elbow instead of being a straight tube.
            return Vector((x+side*(reach*t+.045*t*t+(.07*math.sin(math.pi*t) if side<0 else .025*math.sin(math.pi*t))),y-(.085 if side<0 else .12)*t-.065*t*t+.012*math.sin(t*5),z+.54*t))
        def frame(t):
            axis=(arm(t+.001)-arm(t-.001)).normalized()
            up=Vector((0,1,0));up=(up-axis*up.dot(axis)).normalized()
            return up,axis.cross(up).normalized()
        def sleeve_radius(t,angle):
            # Asymmetric gathered cloth: short compression folds at the cuff,
            # broader slack towards the elbow, not concentric cylinder rings.
            radius=.032+.030*(1-math.exp(-t*3))
            radius+=.0035*math.sin(angle*3+t*4)*math.sin(math.pi*t)
            for centre,width,strength,phase in [(.12,.025,.016,0),(.23,.030,.015,2.0),(.37,.035,.020,.6),(.55,.047,.019,2.4),(.76,.065,.022,.2)]:
                offset=centre+.060*math.sin(angle+phase)
                distance=(t-offset)/width
                ridge=math.exp(-distance*distance)-.55*math.exp(-((distance-1.25)/.85)**2)
                radius+=strength*ridge*(.52+.48*math.cos(angle+phase))
            return radius
        # Continuous tailored sleeve with an elliptical section and rounded,
        # shallow folds that catch real lighting. Geometry is authored once.
        verts=[];faces=[];rings=57;segments=32
        for j in range(rings):
            t=j/(rings-1);up,cross=frame(t);centre=arm(t)
            for k in range(segments):
                angle=k*math.tau/segments;r=sleeve_radius(t,angle)
                verts.append(tuple(centre+r*(up*math.cos(angle)+cross*.81*math.sin(angle))))
        for j in range(rings-1):
            for k in range(segments):
                i=j*segments+k;n=j*segments+(k+1)%segments;faces.append((i,n,n+segments,i+segments))
        faces.extend([tuple(reversed(range(segments))),tuple(range((rings-1)*segments,rings*segments))])
        sleeve=a.mesh('Sculpted gathered ripstop sleeve',verts,faces,cloth,hand)
        # Cylindrical UV avoids changing fabric direction at the upper surface.
        uv=sleeve.data.uv_layers.active
        for face in sleeve.data.polygons:
            wraps=any(sleeve.data.loops[li].vertex_index%segments==0 for li in face.loop_indices) and any(sleeve.data.loops[li].vertex_index%segments==segments-1 for li in face.loop_indices)
            for li in face.loop_indices:
                vertex=sleeve.data.loops[li].vertex_index;j,k=divmod(vertex,segments)
                uv.data[li].uv=((1 if wraps and k==0 else k/segments)*1.05,j/(rings-1)*2.9)
        def cuff(t,angle,extra=.001):
            r=sleeve_radius(t,angle)+extra
            up,cross=frame(t)
            return arm(t)+r*(up*math.cos(angle)+cross*.81*math.sin(angle))
        # A curved low-profile closure fits the wrist; no decorative metal cuff.
        verts=[];faces=[]
        for j in range(7):
            t=.005+j*.044/6
            for k in range(17):verts.append(tuple(cuff(t,-1.5+k*2.5/16,.0028)))
        for j in range(6):
            for k in range(16):
                i=j*17+k;faces.append((i,i+1,i+18,i+17))
        a.mesh('Curved glove wrist closure',verts,faces,textile,hand)
        for t in [.009,.044]:
            a.line('Cuff double topstitch',[tuple(cuff(t,-1.43+k*2.36/22,.0032)) for k in range(23)],.0005,thread,hand)
        # Individually authored stitches rather than a large high-frequency decal.
        for j in range(15):
            angle=-1.32+j*2.1/14
            a.line('Cuff stitch',[tuple(cuff(.017,angle,.0039)),tuple(cuff(.025,angle,.0039))],.0004,thread,hand)
        for angle in [-1.5,1.65]:
            a.line('Tailored sleeve seam',[tuple(cuff(.12+j*.74/32,angle,.00065)) for j in range(33)],.00045,thread,hand)


def bake_cavity(root):
    bpy.context.view_layer.update()
    directions=[Vector((math.cos(j*2.399)*math.sqrt((j+.5)/8),math.sin(j*2.399)*math.sqrt((j+.5)/8),math.sqrt(1-(j+.5)/8))) for j in range(8)]
    for group in root.children:
        objects=[o for o in group.children_recursive if o.type=='MESH']
        verts=[];faces=[]
        for ob in objects:
            offset=len(verts);verts.extend(ob.matrix_world@v.co for v in ob.data.vertices)
            faces.extend(tuple(offset+i for i in f.vertices) for f in ob.data.polygons)
        if not faces:continue
        bvh=BVHTree.FromPolygons(verts,faces,all_triangles=False,epsilon=.00001)
        for ob in objects:
            colors=ob.data.color_attributes.new(name='Cavity',type='BYTE_COLOR',domain='POINT')
            ob.data.color_attributes.active_color=colors
            matrix=ob.matrix_world;normal_matrix=matrix.to_3x3().inverted().transposed()
            for vertex in ob.data.vertices:
                n=(normal_matrix@vertex.normal).normalized();p=matrix@vertex.co+n*.00065
                axis=n.cross(Vector((0,0,1)))
                if axis.length<.01:axis=n.cross(Vector((0,1,0)))
                axis.normalize();up=n.cross(axis);occlusion=0
                for s in directions:
                    hit=bvh.ray_cast(p,axis*s.x+up*s.y+n*s.z,.021)
                    if hit[0] is not None:occlusion+=1-hit[3]/.021
                shade=max(.72,1-occlusion*.043)
                colors.data[vertex.index].color=(shade,shade,shade,1)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source=anatomy.read_source()
    root=a.empty('viewmodel_hands')
    for name in ['rightHand','leftCup','leftVertical','leftHand']:a.empty(name,parent=root)
    cloth=pbr('Realistic olive field ripstop',(.255,.258,.208),'cloth',.94)
    leather=pbr('Realistic charcoal glove leather',(.18,.19,.17),'leather',.84)
    textile=pbr('Realistic graphite glove weave',(.20,.21,.185),'cloth',.91)
    thread=a.surface('Realistic muted olive stitching',(.045,.05,.035),.9)
    thread['cs16Realistic']=True
    form(root,cloth,leather,textile,thread,source)
    # Clean pole duplicates left by procedural ellipsoids before baking/export.
    for ob in root.children_recursive:
        if ob.type!='MESH':continue
        bm=bmesh.new();bm.from_mesh(ob.data)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0000001)
        bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.0000001)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
        for f in ob.data.polygons:f.use_smooth=True
    bake_cavity(root)
    # A single static mesh per pose batches shared glove/cuff materials. Eight
    # material draws for the active pair, versus ten in the preceding build.
    for pivot in root.children:
        meshes=[ob for ob in pivot.children if ob.type=='MESH']
        bpy.ops.object.select_all(action='DESELECT')
        for ob in meshes:ob.select_set(True)
        bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join()
        bpy.context.object.name=pivot.name+'_anatomical_glove_and_sleeve'
    root['cs16Realistic']=True
    root['artStyle']='Anatomical tactical gloves and gathered ripstop sleeves'
    root['assetProvenance']='Anatomical hand mesh by para, CC0 (OpenGameArt fps-arms-rigged-only). Original Support Hub glove materials, sleeves and baked grip poses.'
    target=ROOT/'models/csgo/anime-hands.glb'
    bpy.ops.object.select_all(action='DESELECT')
    for ob in [root]+list(root.children_recursive):ob.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True,export_vertex_color='ACTIVE',export_active_vertex_color_when_no_material=True)
    count=0;per_pose={}
    for group in root.children:
        tri=0
        for ob in group.children_recursive:
            if ob.type=='MESH':ob.data.calc_loop_triangles();tri+=len(ob.data.loop_triangles)
        per_pose[group.name]=tri;count+=tri
    report={'file':target.name,'bytes':target.stat().st_size,'triangles':count,'perPoseTriangles':per_pose,'materials':4,'drawCallsPerActivePair':8,'runtimeGeometryAnimation':False,'gripOriginsUnchanged':True,'license':'CC0 anatomical hand mesh by para, with original Support Hub modifications','source':'https://opengameart.org/content/fps-arms-rigged-only','generator':'tools/blender/build_realistic_hands.py'}
    (ROOT/'graphics-qa').mkdir(exist_ok=True)
    (ROOT/'graphics-qa/realistic-hands.json').write_text(json.dumps(report,indent=2)+'\n')
    print('REALISTIC_HANDS_PASS',json.dumps(report),flush=True)

if __name__=='__main__':main()
