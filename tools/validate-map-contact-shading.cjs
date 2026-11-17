/* Compare a regenerated map with its pre-bake GLB, including every indexed corner.
   Usage: node tools/validate-map-contact-shading.cjs PATH_TO_ORIGINAL_MAP_DIRECTORY */
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const original = process.argv[2];
assert(original, 'Pass the directory containing the original anime map GLBs');
const components = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4};
const formats = {5121: [1, 'readUInt8', 255], 5123: [2, 'readUInt16LE', 65535],
                 5125: [4, 'readUInt32LE', 4294967295], 5126: [4, 'readFloatLE', 1]};
function read(file) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.readUInt32LE(0), 0x46546c67);
  assert.equal(buffer.readUInt32LE(8), buffer.length);
  const jsonBytes = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonBytes).toString());
  const binary = buffer.subarray(28 + jsonBytes);
  const accessorCache = new Map();
  return {gltf, bytes: buffer.length, accessor(index) {
    if (accessorCache.has(index)) return accessorCache.get(index);
    const accessor = gltf.accessors[index], view = gltf.bufferViews[accessor.bufferView];
    const [size, method, maximum] = formats[accessor.componentType];
    const width = components[accessor.type], stride = view.byteStride || size * width;
    const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
    const data = new Float64Array(accessor.count * width);
    for (let i = 0; i < accessor.count; i++) for (let j = 0; j < width; j++)
      data[i * width + j] = binary[method](offset + i * stride + j * size) / (accessor.normalized ? maximum : 1);
    const result = {data, count: accessor.count, width};
    accessorCache.set(index, result);
    return result;
  }, image(index) {
    const view = gltf.bufferViews[gltf.images[index].bufferView];
    return binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  }};
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'models/csgo/anime-maps-manifest.json')));
for (const name of ['dust2', 'inferno']) {
  const filename = `anime-${name}.glb`;
  const before = read(path.join(original, filename));
  const after = read(path.join(root, 'models/csgo', filename));
  const a = before.gltf, b = after.gltf;
  assert.deepEqual(b.nodes, a.nodes, `${name}: transforms, cover identifiers and scene nodes`);
  assert.deepEqual(b.materials, a.materials, `${name}: palette and materials`);
  assert.deepEqual(b.textures, a.textures, `${name}: textures`);
  assert.equal(b.images.length, a.images.length);
  b.images.forEach((image, index) => assert(after.image(index).equals(before.image(index)), `${name}: embedded image ${index}`));
  assert.equal(b.meshes.length, a.meshes.length, `${name}: draw calls`);
  let triangles = 0, vertices = 0, originalVertices = 0, changed = 0, darkest = 1;
  for (let mesh = 0; mesh < a.meshes.length; mesh++) {
    assert.equal(b.meshes[mesh].name, a.meshes[mesh].name);
    assert.equal(b.meshes[mesh].primitives.length, a.meshes[mesh].primitives.length);
    for (let p = 0; p < a.meshes[mesh].primitives.length; p++) {
      const old = a.meshes[mesh].primitives[p], current = b.meshes[mesh].primitives[p];
      assert.equal(current.material, old.material);
      const oldIndices = before.accessor(old.indices).data, indices = after.accessor(current.indices).data;
      assert.equal(indices.length, oldIndices.length, `${name}: triangle count`);
      triangles += indices.length / 3;
      originalVertices += before.accessor(old.attributes.POSITION).count;
      vertices += after.accessor(current.attributes.POSITION).count;
      for (const key of ['POSITION', 'NORMAL', 'TEXCOORD_0']) {
        const oldValues = before.accessor(old.attributes[key]), values = after.accessor(current.attributes[key]);
        const width = values.width;
        for (let corner = 0; corner < indices.length; corner++) for (let c = 0; c < width; c++) {
          if (values.data[indices[corner] * width + c] !== oldValues.data[oldIndices[corner] * width + c])
            assert.fail(`${name}: ${a.meshes[mesh].name} ${key} differs at corner ${corner}`);
        }
      }
      const colours = after.accessor(current.attributes.COLOR_0);
      assert.equal(b.accessors[current.attributes.COLOR_0].componentType, 5121, `${name}: four-byte GPU colour budget`);
      assert.equal(current.attributes.COLOR_1, undefined, `${name}: no unused extra colour channel`);
      const oldColours = before.accessor(old.attributes.COLOR_0);
      for (let i = 0; i < oldColours.data.length; i++) assert.equal(oldColours.data[i], 1, 'baseline active colour is white');
      const material = b.materials[current.material].name;
      const unchanged = ['flower', 'leaf', 'lamp_warm', 'lamp_green', 'paint'].includes(material) || a.meshes[mesh].name.startsWith('crate_');
      for (let i = 0; i < colours.count; i++) {
        const value = colours.data[i * 4];
        assert(value >= .71 && value <= 1, `${name}: gentle contact contrast`);
        assert.equal(colours.data[i * 4 + 1], value, `${name}: no colour shift`);
        assert.equal(colours.data[i * 4 + 2], value, `${name}: no colour shift`);
        assert.equal(colours.data[i * 4 + 3], 1, `${name}: opacity preserved`);
        if (unchanged) assert.equal(value, 1, `${name}: nonarchitectural asset untouched`);
        darkest = Math.min(darkest, value);
        changed += value < .995;
      }
    }
  }
  assert(vertices <= originalVertices, `${name}: vertex budget cannot grow`);
  assert(after.bytes < before.bytes, `${name}: download budget cannot grow`);
  assert.equal(triangles, manifest.maps[name].triangles);
  assert.equal(after.bytes, manifest.maps[name].bytes);
  assert(changed > 10000, `${name}: bake must affect real geometry`);
  assert(darkest < .85, `${name}: enclosed contacts receive shading`);
  console.log(JSON.stringify({map: name, triangles, meshes: b.meshes.length, vertices,
                             originalVertices, changedColourVertices: changed,
                             minimumColour: darkest, bytes: after.bytes,
                             result: 'Geometry, normals, UVs, textures, palette and draw budget preserved'}));
}
