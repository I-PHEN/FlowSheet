// load the GLB with three.js GLTFLoader in Node — world bounds per node
import { readFileSync } from 'fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

async function main() {
  const buf = readFileSync('public/models/shell-and-tube-exchanger.glb');
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  scene.traverseVisible(() => {});
  const kids = [...scene.children];
  console.log('scene children:', kids.length);
  const overall = new THREE.Box3();
  kids.forEach((kid, i) => {
    const b = new THREE.Box3().setFromObject(kid);
    overall.union(b);
    const size = new THREE.Vector3(); const ctr = new THREE.Vector3();
    b.getSize(size); b.getCenter(ctr);
    console.log(`child ${i} [${(kid as any).name}]: size=${size.toArray().map(v=>v.toFixed(3)).join(', ')} center=${ctr.toArray().map(v=>v.toFixed(3)).join(', ')}`);
  });
  const s = new THREE.Vector3(); overall.getSize(s);
  console.log('overall size:', s.toArray().map(v=>v.toFixed(3)).join(', '));
  console.log('materials:', (scene as any).children.flatMap((c:any)=>c.children??[]).length);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
