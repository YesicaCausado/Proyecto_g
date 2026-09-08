// Inspect a glTF GLB binary: JSON chunk info (extensions, draco, material count,
// mesh count, animation names) without a full render.
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) { console.error('usage: node inspect_glb.js <path.glb>'); process.exit(2); }
const buf = fs.readFileSync(file);

// GLB header: magic(4) version(4) length(4)
const magic = buf.toString('ascii', 0, 4);
const version = buf.readUInt32LE(4);
if (magic !== 'glTF') { console.error('Not a GLB (bad magic):', magic); process.exit(1); }

let offset = 12;
const chunks = [];
while (offset < buf.length) {
  const len = buf.readUInt32LE(offset);
  const type = buf.toString('ascii', offset + 4, offset + 8);
  const data = buf.subarray(offset + 8, offset + 8 + len);
  chunks.push({ type, len, data });
  offset += 8 + len;
}

const jsonChunk = chunks.find(c => c.type === 'JSON');
const binChunk  = chunks.find(c => c.type === 'BIN');
if (!jsonChunk) { console.error('No JSON chunk'); process.exit(1); }

const json = JSON.parse(jsonChunk.data.toString('utf8'));

console.log('=== GLB', file, '=== version', version, '| names:', json.asset?.generator || '', json.asset?.version || '');
console.log('BIN chunk bytes:', binChunk ? binChunk.len : 0);
console.log('extensionsUsed:', JSON.stringify(json.extensionsUsed || []));
console.log('extensionsRequired:', JSON.stringify(json.extensionsRequired || []));
console.log('scenes:', (json.scenes||[]).length, '| nodes:', (json.nodes||[]).length,
            '| meshes:', (json.meshes||[]).length,
            '| materials:', (json.materials||[]).length,
            '| animations:', (json.animations||[]).length);

// Draco?
if (json.meshes) {
  const dracoMeshes = json.meshes.filter(m => m.primitives && m.primitives.some(p => p.extensions && p.extensions.KHR_draco_mesh_compression));
  console.log('meshes with KHR_draco_mesh_compression:', dracoMeshes.length);
  const compressedPrims = [];
  json.meshes.forEach((m,mi)=>{ (m.primitives||[]).forEach(p=>{ if(p.extensions?.KHR_draco_mesh_compression) compressedPrims.push(mi); }); });
  if (compressedPrims.length) console.log('  compressed mesh indices:', compressedPrims);
}

// Animation clip names
console.log('\n=== ANIMATION CLIPS ===');
(json.animations||[]).forEach((a, i) => {
  console.log(`[${i}]`, JSON.stringify(a.name));
});

// Material summary
console.log('\n=== MATERIALS (alpha/deform ===');
(json.materials||[]).forEach((m, i) => {
  const pbr = m.pbrMetallicRoughness || {};
  const metal = pbr.metallicFactor;
  const rough = pbr.roughnessFactor;
  const unlit = !!(m.extensions && m.extensions.KHR_materials_unlit);
  const emissive = m.emissiveFactor ? JSON.stringify(m.emissiveFactor) : 'none';
  console.log(`[${i}] name="${m.name||''}" alpha=${m.alphaMode||'OPAQUE'} metal=${metal} rough=${rough} unlit=${unlit} emissive=${emissive}`);
});

// Node names (to sanity check rig lookup like "head")
console.log('\n=== NODE NAMES ===');
(json.nodes||[]).forEach((n, i) => { if (n.name) console.log(`[${i}]`, n.name); });

// Count textured materials (needs image/accessor resources present in bin)
console.log('\n=== RESOURCES ===');
console.log('buffers:', (json.buffers||[]).length, '| bufferViews:', (json.bufferViews||[]).length,
            '| accessors:', (json.accessors||[]).length,
            '| images:', (json.images||[]).length,
            '| textures:', (json.textures||[]).length);