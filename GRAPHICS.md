# Counter-Strike graphics — 3.25.0

Built on client 3.24.3 (`0dd24b9`), preserving its map layouts and multiplayer protocol.
The old generated world and cube characters are replaced by Blender exports.
This is an original CS:GO-inspired art pass, not the Source engine or a 1:1 replica.

- Dust2 and Inferno: authored facade details, skyline, site markings and PBR surfaces.
- Separate articulated T/CT operators, gloves, sleeves and 19 weapon meshes.
- glTF metallic/roughness and normal maps, sunlight, stabilized shadows and sky reflections.
- Local assets; no texture/CDN requests while playing.
- Escape menu: high, balanced and performance graphics settings.
- Map switches free owned GPU resources and cancel stale asynchronous loads.
- Existing radar, smoke, hit feedback, bots, Gun Game, buying and weapon mechanics remain.
- Stair elevation now rises toward its adjacent tower/bridge, matching the new visible slope.

## Rebuild the artwork

Requires Blender 4.5 LTS. Run from the repository folder. Use an absolute source path.

```powershell
./tools/blender/download_textures.ps1
blender -b --python tools/blender/build_maps.py -- --sources C:/path/to/blender-sources
blender -b --python tools/blender/build_characters.py -- --output models/csgo --source C:/path/to/blender-sources --preview
blender -b --python tools/blender/build_weapons.py -- --sources C:/path/to/blender-sources
node tools/validate-graphics.cjs
```

The generators export packaged GLBs plus manifests. `.blend` source files contain
embedded textures; generated copies are supplied separately from the installer.
See [ART_CREDITS.md](ART_CREDITS.md) for texture provenance.

## Verification and packaging

```powershell
npm ci
npm run test:graphics
npm run test:graphics:browser
npm run pack -- --publish never
```

Browser smoke checks use a mocked Socket.IO connection and never contact the live
server or database. They cover both maps, resource cleanup across rapid switches,
shop controls, quality selection and rendered geometry heights.
The browser check uses installed Chrome; set `CHROME_PATH` for a different Chromium
executable and `GRAPHICS_OUTPUT` to select a screenshot/report directory.
The built installer still uses the existing server endpoint. Multiplayer behavior
needs a live multi-client playtest; software-rendered QA does not establish gaming FPS.
