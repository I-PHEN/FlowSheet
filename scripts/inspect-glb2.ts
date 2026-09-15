import { readFileSync } from 'fs';
const buf = readFileSync('public/models/shell-and-tube-exchanger.glb');
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
let off = 12, json: any = null;
while (off < buf.byteLength) {
  const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
  if (type === 0x4e4f534a) json = JSON.parse(buf.subarray(off + 8, off + 8 + len).toString('utf8'));
  off += 8 + len;
}
(json.meshes ?? []).forEach((m: any, i: number) => {
  let vc = 0, bounds = { min: [1e9,1e9,1e9], max: [-1e9,-1e9,-1e9] };
  for (const prim of m.primitives) {
    const posAcc = json.accessors[prim.attributes.POSITION];
    vc += posAcc.count;
    for (let k = 0; k < 3; k++) {
      bounds.min[k] = Math.min(bounds.min[k], posAcc.min[k]);
      bounds.max[k] = Math.max(bounds.max[k], posAcc.max[k]);
    }
  }
  console.log(`mesh ${i} (node ${json.nodes.findIndex((n:any)=>n.mesh===i)}): verts=${vc}, bounds min=[${bounds.min.map((v:number)=>v.toFixed(2))}] max=[${bounds.max.map((v:number)=>v.toFixed(2))}], size=[${(bounds.max[0]-bounds.min[0]).toFixed(2)}, ${(bounds.max[1]-bounds.min[1]).toFixed(2)}, ${(bounds.max[2]-bounds.min[2]).toFixed(2)}]`);
});
