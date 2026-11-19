"""Original authored fallback arsenal, with restrained PBR and offline world LODs.

These are our own weapon forms, not commercial shooter models. Exact externally
authored M4/AK/MP5/Tec9/Glock are imported by the two CC0 import scripts instead.
No hands, finger-ring transforms, gameplay or animation clips are changed here.
"""
import argparse, importlib.util, json, math, sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix, Vector
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
spec=importlib.util.spec_from_file_location('soft_weapon_forms',HERE/'build_anime_weapons.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
w,a=s.w,s.a
ROOT=w.ROOT;OUT=ROOT/'models/csgo'
KINDS=['knife','usp','deagle','p90','ump45','galil','famas','awp','scout','sg552','aug','m249','fiveseven','elite']
base_metal,base_polymer=w.metal,w.polymer

def metal(name,color,rough=.36,metallic=.8):
    if name=='Parkerized steel':color=(.205,.220,.232);rough=.48;metallic=.78
    elif name=='Machined edges':color=(.31,.325,.34);rough=.39;metallic=.83
    elif name=='Brass hardware':color=(.43,.31,.15);rough=.46;metallic=.8
    mat=base_metal(name,color,rough,metallic);mat['cs16Realistic']=True;return mat

def polymer(name,color):
    if name=='Polymer':color=(.115,.122,.126)
    mat=base_polymer(name,color);mat['cs16Realistic']=True;return mat
w.metal=metal;w.polymer=polymer
base_cylinder=w.cyl
def efficient_cylinder(name,pos,radius,length,mat,parent,axis='z',vertices=24):
    return base_cylinder(name,pos,radius,length,mat,parent,axis,min(vertices,24 if any(n in name for n in ['Scope','Optical','Focus'])else 16))
w.cyl=efficient_cylinder

def manufactured_box(name,pos,size,mat,parent,bevel=.008):
    # Grips keep the rounded backstrap; metal faces are planar with small radii.
    if name in ['Textured grip','Pistol grip','Knife grip']:
        return s.soft_box(name,pos,size,mat,parent,bevel)
    radius=min(min(size)*.30,bevel,.006)
    if name in ['Shoulder stock','Fore-end','Lower frame','P90 rounded frame','Cheek rest','P90 top magazine','UMP polymer lower']:
        radius=min(min(size)*.26,bevel*1.4,.012)
    return s.base_box(name,pos,size,mat,parent,radius)
a.box=manufactured_box

def neutralize(root):
    for ob in [root]+list(root.children_recursive):
        ob['cs16Realistic']=True
        if ob.type!='MESH':continue
        for color in list(ob.data.color_attributes):ob.data.color_attributes.remove(color)
        for mat in ob.data.materials:
            if mat:mat['cs16Realistic']=True

def neutral_cavity(root):
    """Only mild achromatic crevice shading: no painted gold/purple highlights."""
    from bake_asset_shading import bake
    bake(root)
    for ob in root.children_recursive:
        if ob.type!='MESH':continue
        color=ob.data.color_attributes.active_color
        if not color:continue
        for d in color.data:
            value=max(.83,min(1,sum(d.color[:3])/3*.16+.84))
            d.color=(value,value,value,1)

def single_surface(mat,color,rough=.6,metallic=.1):
    bs=mat.node_tree.nodes.get('Principled BSDF')
    for link in list(bs.inputs['Base Color'].links):mat.node_tree.links.remove(link)
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metallic

def details(root,kind):
    weapon=next(o for o in root.children if o.name=='weapon')
    mats={m.name:m for ob in root.children_recursive if ob.type=='MESH' for m in ob.data.materials}
    steel=mats.get('Parkerized steel');edge=mats.get('Machined edges');black=mats.get('Polymer')
    if not black:black=polymer('Polymer',(.115,.122,.126))
    if not steel:steel=metal('Parkerized steel',(.205,.22,.232))
    if not edge:edge=metal('Machined edges',(.31,.325,.34))
    # Originals use the same graphite/olive/wood family as the imported assets.
    for name,mat in mats.items():
        if 'Olive rifle finish' in name:single_surface(mat,(.065,.075,.048),.68,.03)
        if kind=='galil' and 'Walnut' in name:
            for ob in root.children_recursive:
                if ob.type=='MESH':
                    for slot in ob.material_slots:
                        if slot.material==mat:slot.material=black
        if 'scope glass' in name.lower():single_surface(mat,(.018,.036,.042),.16,.2)
    pistol=kind in ['usp','deagle','fiveseven','elite']
    if kind=='knife':
        for z in [.015,.04,.065,.09]:
            for side in [-1,1]:a.box('Moulded grip traction',(side*.018,0,z),(.002,.028,.003),black,weapon,.0006)
        return
    # Continuous magazines remove the old stacked-block silhouette.
    if not pistol and kind not in ['galil','m249','p90']:
        magazine=next(o for o in root.children if o.name=='magazine')
        for ob in list(magazine.children):
            if ob.type=='MESH' and ob.name.startswith(('Magazine section','Magazine pressed channel')):bpy.data.objects.remove(ob,do_unlink=True)
        z=.15 if kind in ['aug','famas'] else -.105
        short=kind in ['awp','scout'];bottom=-.145 if short else -.225
        outline=[(z-.038,-.055),(z+.038,-.055),(z+.035,bottom+.022),(z+.019,bottom),(z-.050,bottom),(z-.045,-.115)]
        w.receiver_profile('Continuous stamped magazine',outline,.046,steel,magazine)
        for side in [-1,1]:
            for dz in [-.018,.012]:a.line('Recessed magazine flute',[(side*.024,-.077,z+dz),(side*.024,bottom+.02,z+dz-.008)],.0012,black,magazine)
        a.box('Magazine floor plate',(0,bottom,z-.015),(.049,.009,.077),black,magazine,.002)
    # Open folding stocks for the UMP/SG and a bipod/linked feed on the M249.
    if kind in ['ump45','sg552']:
        for ob in list(weapon.children):
            if ob.type=='MESH' and ob.name.startswith(('Shoulder stock','Cheek rest','Stock texture','Stock buffer')):bpy.data.objects.remove(ob,do_unlink=True)
        for side in [-1,1]:
            a.line('Folding stock upper rail',[(side*.022,.028,.10),(side*.026,.043,.30),(side*.026,.018,.34)],.011,black,weapon)
            a.line('Folding stock lower brace',[(side*.023,-.023,.11),(side*.026,-.055,.31),(side*.026,-.045,.34)],.010,black,weapon)
        w.cyl('Stock hinge pin',(.031,.012,.105),.013,.067,steel,weapon,'x',16)
    if kind=='ump45':
        for ob in list(weapon.children):
            if ob.type=='MESH' and ob.name.startswith('SMG handguard'):bpy.data.objects.remove(ob,do_unlink=True)
    if kind=='m249':
        for side in [-1,1]:
            a.line('Folded bipod',[(side*.027,-.015,-.30),(side*.051,-.035,-.42),(side*.052,-.044,-.49)],.009,steel,weapon)
        brass=metal('Linked ammunition brass',(.43,.31,.15),.43,.8)
        for j in range(5):w.cyl('Feed belt cartridge',(-.045-j*.014,.044,-.105),.005,.066,brass,weapon,'z',10)
    if kind in ['awp','scout']:
        # Slender receiver bedding and an adjustable, contoured cheekpiece.
        for side in [-1,1]:
            a.line('Bedding rail',[(side*.035,-.025,-.26),(side*.038,-.034,-.09),(side*.032,-.038,.08)],.006,black,weapon)
            w.cyl('Cheek rest adjuster',(side*.027,.034,.24),.007,.042,steel,weapon,'y',12)
        for zz in [.17,.30]:w.cyl('Stock bedding screw',(0,.068,zz),.005,.004,steel,weapon,'y',12)
        # Put scope coating on its own dark recessed glass plane, with black rims.
        for ob in root.children_recursive:
            if ob.type=='MESH' and ob.name.startswith('Optical lens'):
                for p in ob.data.polygons:p.use_smooth=False
        if kind=='scout':
            # Scout is a slim sporting chassis, not the AWP body under a new name.
            for ob in root.children_recursive:
                if ob.type!='MESH':continue
                if ob.name.startswith(('Barrel','Upper receiver','Scope bell','Optical lens','Lens retaining ring','Focus rib')):
                    centre=sum((v.co for v in ob.data.vertices),Vector())/len(ob.data.vertices)
                    for v in ob.data.vertices:
                        v.co.x=centre.x+(v.co.x-centre.x)*.78
                        v.co.z=centre.z+(v.co.z-centre.z)*.78
                if ob.name.startswith(('Shoulder stock','Fore-end','Cheek rest')):
                    for v in ob.data.vertices:v.co.x*=.83
                    ob.data.materials.clear();ob.data.materials.append(black)
        else:
            for ob in list(weapon.children):
                if ob.type=='MESH' and ob.name.startswith(('Shoulder stock','Cheek rest','Stock texture','Stock buffer')):bpy.data.objects.remove(ob,do_unlink=True)
            olive=original_olive=a.surface('Weapon finish / AWP olive composite',(.065,.075,.048),.7,.02)
            body=w.receiver_profile('AWP thumbhole shoulder chassis',[(.065,.025),(.13,.056),(.31,.058),(.347,.016),(.344,-.114),(.29,-.119),(.23,-.072),(.15,-.058),(.072,-.066)],.074,olive,weapon)
            bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=a.xyz((0,-.026,.137)))
            cutter=bpy.context.object;cutter.scale=(.09,.041,.027);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
            bpy.context.view_layer.objects.active=body;mod=body.modifiers.new('Open thumb rest','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
            bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
            a.box('AWP adjustable cheekpiece',(0,.068,.24),(.069,.029,.14),black,weapon,.010)
    # Recessed ports, extractor, panel seams, and honest mechanical markings.
    centres=[-.09,.09] if kind=='elite' else [0]
    for cx in centres:
        for side in [-1,1]:
            x=cx+side*(.024 if pistol else .039)
            if pistol:
                slide=next((o for o in root.children if o.name=='slide'),weapon)
                for j in range(7):a.box('Machined slide serration',(x,.024,.015+j*.0055),(.0014,.027,.0015),black,slide,.0003)
                a.box('Extractor claw',(x,.029,-.025),(.002,.007,.023),edge,slide,.0008)
                a.box('Frame takedown latch',(x,-.016,-.01),(.003,.008,.013),steel,weapon,.001)
            else:
                a.box('Receiver service seam',(x,-.016,-.045),(.0012,.0015,.10),black,weapon,.0002)
                a.box('Ejection port recessed face',(x,.032,-.065),(.0018,.023,.064),black,weapon,.0014)
                a.line('Ejection port rim',[(x+side*.001,.044,-.099),(x+side*.001,.046,-.070),(x+side*.001,.044,-.031)],.0012,edge,weapon)
        # Subdued stamped calibre marks are shallow geometry, not extra draw calls.
        for j in range(4):a.box('Stamped receiver witness',(cx+.039,.011,-.111+j*.005),(.0007,.0025,.0012),edge,weapon,.0002)
    if pistol:
        slide=next((o for o in root.children if o.name=='slide'),weapon)
        for cx in centres:a.box('Pistol reflex adapter',(cx,.04975,.009),(.030,.0045,.035),steel,slide,.0006)

def lod(root,ratio=.20):
    """Two static texture batches, no runtime geometry processing or colour shaders."""
    bpy.context.view_layer.update();batches={};palette={}
    for ob in list(root.children_recursive):
        if ob.type!='MESH':continue
        mat=ob.data.materials[0];bs=mat.node_tree.nodes.get('Principled BSDF')
        color=tuple(bs.inputs['Base Color'].default_value[:3])
        linked=bs.inputs['Base Color'].links
        if linked and linked[0].from_node.type=='TEX_IMAGE':
            im=linked[0].from_node.image;pixels=np.array(im.pixels[:],dtype=np.float32).reshape(-1,4)
            color=tuple(pixels[::max(1,len(pixels)//80),:3].mean(axis=0))
        # Palette is sRGB texture data; node constants above are linear.
        else:color=tuple(v*12.92 if v<=.0031308 else 1.055*v**(1/2.4)-.055 for v in color)
        key=tuple(round(c,4)for c in color);slot=palette.setdefault(key,len(palette))
        paint=mat.name.startswith('Weapon finish /');vertices,faces,slots=batches.setdefault(paint,([],[],[]))
        base=len(vertices);transform=root.matrix_world.inverted()@ob.matrix_world
        vertices.extend(tuple(transform@v.co)for v in ob.data.vertices)
        for poly in ob.data.polygons:faces.append(tuple(base+i for i in poly.vertices));slots.append(slot)
    size=128;pixels=np.ones((size,size,4),dtype=np.float32)
    for color,index in palette.items():
        x=(index%8)*16;y=(index//8)*16;pixels[y:y+16,x:x+16,:3]=color
    image=a.image('Original weapon world palette',pixels)
    group=a.empty('worldLOD',parent=root);group['cs16Realistic']=True
    if 'cs16Grip' in root:group['cs16Grip']=root['cs16Grip']
    for paint,(vertices,faces,slots) in batches.items():
        mesh=bpy.data.meshes.new('Realistic world surface');mesh.from_pydata(vertices,[],faces);mesh.update()
        uv=mesh.uv_layers.new(name='UVMap')
        for poly,index in zip(mesh.polygons,slots):
            coord=((index%8+.5)/8,(index//8+.5)/8)
            for loop in poly.loop_indices:uv.data[loop].uv=coord
            poly.use_smooth=True
        mat=a.surface('Weapon finish / world' if paint else 'Realistic world hardware',(1,1,1),.58,.35);mat['cs16Realistic']=True
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
        mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
        mesh.materials.append(mat);ob=bpy.data.objects.new('World paint' if paint else 'World hardware',mesh);bpy.context.collection.objects.link(ob);ob.parent=group
        bpy.context.view_layer.objects.active=ob
        modifier=ob.modifiers.new('Remote silhouette budget','DECIMATE');modifier.ratio=ratio;modifier.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=modifier.name);ob.data.validate(clean_customdata=True);ob.data.update()
    return group

def export(root,kind,source='Original authored Support Hub geometry'):
    neutralize(root)
    target=OUT/('anime-'+kind+'.glb')
    bpy.ops.object.select_all(action='DESELECT')
    for ob in [root]+list(root.children_recursive):ob.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
    counts={'viewmodelTriangles':0,'worldTriangles':0};world=next((o for o in root.children if o.name=='worldLOD'),None)
    world_meshes=set(world.children_recursive)if world else set()
    for ob in root.children_recursive:
        if ob.type=='MESH':ob.data.calc_loop_triangles();counts['worldTriangles'if ob in world_meshes else'viewmodelTriangles']+=len(ob.data.loop_triangles)
    row={'file':target.name,'bytes':target.stat().st_size,'triangles':sum(counts.values()),**counts,'source':source,'cs16Realistic':True}
    print('REALISTIC_ARSENAL',kind,json.dumps(row),flush=True);return row

def optimize_view(root,budget=18000):
    objects=[o for o in root.children_recursive if o.type=='MESH']
    for ob in objects:ob.data.calc_loop_triangles()
    count=sum(len(ob.data.loop_triangles)for ob in objects)
    if count<=budget:return
    ratio=budget/count
    for ob in objects:
        if len(ob.data.loop_triangles)<100:continue
        bpy.context.view_layer.objects.active=ob;mod=ob.modifiers.new('First person surface budget','DECIMATE');mod.ratio=ratio;mod.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=mod.name);ob.data.validate(clean_customdata=True);ob.data.update()

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--only',nargs='+',choices=KINDS);cfg=ap.parse_args(sys.argv[sys.argv.index('--')+1:]if'--'in sys.argv else[])
    report=[]
    for kind in cfg.only or KINDS:
        bpy.ops.wm.read_factory_settings(use_empty=True);root=w.build(kind)
        s.sculpt(root,kind);details(root,kind)
        neutralize(root);s.join_parts(root);optimize_view(root)
        count=0
        for ob in root.children_recursive:
            if ob.type=='MESH':ob.data.calc_loop_triangles();count+=len(ob.data.loop_triangles)
        lod(root,min(.20,2000/max(1,count)))
        report.append(export(root,kind))
    path=OUT/'anime-weapons-manifest.json';manifest=json.loads(path.read_text())
    replacements={row['file']:row for row in report}
    manifest['assets']=[replacements.get(row['file'],row)for row in manifest['assets']]
    path.write_text(json.dumps(manifest,indent=2)+'\n')
    (ROOT/'graphics-qa/realistic-original-arsenal.json').write_text(json.dumps(report,indent=2)+'\n')

if __name__=='__main__':main()
