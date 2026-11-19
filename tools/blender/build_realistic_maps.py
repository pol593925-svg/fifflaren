"""Rebuild only visuals; shared layout, doors, stairs and collision stay authoritative.

Uses the tested sector batching, UV and contact-shading exporter. Run Blender -b
--python tools/blender/build_realistic_maps.py -- --map all.
"""
import sys
import json
import bpy
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_anime_maps as maps
import realistic_architecture as architecture
import bake_map_contact_shading
import time

# Windows antivirus can momentarily hold Blender's exported destination open.
# Retry the atomic replacement; never leave a half-written deliverable behind.
original_pack = bake_map_contact_shading.pack_export
def pack_export(path):
    for attempt in range(8):
        try:
            return original_pack(path)
        except PermissionError:
            if attempt == 7:
                raise
            time.sleep(.35 * (attempt + 1))
bake_map_contact_shading.pack_export = pack_export

def shell_materials(theme):
    # Actual Bistro textures are loaded once by the awaited runtime controller.
    # Do not embed and decode the discarded anime atlases in every map first.
    maps.a.MATS.clear()
    maps.a.TEX_IMAGES.clear()
    palette = {'plaster': '#d2c7b7', 'plaster_light': '#e6ddd0', 'plaster_blue': '#bfb9ab',
               'limestone': '#b6b0a4', 'ground': '#a6a29a', 'wood': '#625448',
               'shutter': '#44534a', 'steel': '#3e4548', 'duct': '#7f8586',
               'tunnel': '#95958d', 'roof': '#686b68', 'window_glass': '#263331',
               'dark': '#2b2d2e', 'trim': '#d4cdbf', 'paint': '#a25637',
               'lamp_warm': '#ffd69b', 'lamp_green': '#9aca9d',
               'flower': '#ab879b', 'leaf': '#5b6d49', 'ceramic': '#9d7862'}
    for name, hexcolor in palette.items():
        color = tuple(int(hexcolor[i:i + 2], 16) / 255 for i in [1, 3, 5])
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (*color, 1)
        bsdf.inputs['Roughness'].default_value = .82
        if name.startswith('lamp_'):
            bsdf.inputs['Emission Color'].default_value = (*color, 1)
            bsdf.inputs['Emission Strength'].default_value = .4
        maps.a.MATS[name] = material

maps.coast = architecture.build
maps.materials = shell_materials
maps.wall_details = lambda *args: architecture.wall_details(maps.a, *args)
# Actual licensed city models supply the skyline. The old empty rectangular
# background boxes are no longer included in the packaged tactical geometry.
maps.a.skyline = lambda theme: None
maps.main()
path = maps.OUT / 'anime-maps-manifest.json'
manifest = json.loads(path.read_text())
manifest.update({'generator': 'tools/blender/build_realistic_maps.py',
                 'style': 'Bistro masonry tactical adaptation',
                 'licensedDetailSource': 'Amazon Lumberyard Bistro / ORCA CC BY 4.0',
                 'architecture': 'Exact CS16Buildings collision shell with original Bistro modular facades'})
path.write_text(json.dumps(manifest, indent=2) + '\n')
