// inspect the shell-and-tube GLB: scene graph nodes, meshes, materials
import { readFileSync } from 'fs';

const buf = readFileSync('public/models/shell-and-tube-exchanger.glb');
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
let off = 12; // skip header
let json: any = null;
while (off < buf.byteLength) {
  const len = dv.getUint32(off, true);
  const type = dv.getUint32(off + 4, true);
  if (type === 0x4e4f534a) { // JSON
    json = JSON.parse(buf.subarray(off + 8, off + 8 + len).toString('utf8'));
  }
  off += 8 + len;
}
const nodes = json.nodes ?? [];
console.log('nodes:', nodes.length);
for (const n of nodes) {
  console.log('-', n.name, n.mesh !== undefined ? `mesh:${n.mesh}` : '', n.children ? `children:${n.children.length}` : '', n.extras ? JSON.stringify(n.extras).slice(0,80) : '');
}
console.log('meshes:', (json.meshes ?? []).map((m: any) => m.name).join(' | '));
console.log('materials:', (json.materials ?? []).map((m: any) => m.name).join(' | '));
console.log('extensionsUsed:', json.extensionsUsed);
console.log('scenes:', JSON.stringify(json.scenes?.[0]?.nodes), 'root nodes:', (json.scenes?.[0]?.nodes ?? []).length);
