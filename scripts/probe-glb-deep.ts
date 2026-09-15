// deep probe: per-MESH world bounds + y extremes, to find why the model sinks through the grid
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
  const overall = new THREE.Box3().setFromObject(scene);
  const s = new THREE.Vector3(); overall.getSize(s);
  const c = new THREE.Vector3(); overall.getCenter(c);
  console.log(`OVERALL size=${s.toArray().map(v=>v.toFixed(3)).join(', ')} center=${c.toArray().map(v=>v.toFixed(3)).join(', ')} min.y=${overall.min.y.toFixed(3)} max.y=${overall.max.y.toFixed(3)}`);
  scene.traverse((o: any) => {
    if (o.isMesh) {
      const b = new THREE.Box3().setFromObject(o);
      const sz = new THREE.Vector3(); b.getSize(sz);
      const ct = new THREE.Vector3(); b.getCenter(ct);
      const verts = o.geometry?.attributes?.position?.count ?? 0;
      const mat = o.material;
      console.log(
        `MESH "${o.name}" verts=${verts} size=${sz.toArray().map(v=>v.toFixed(3)).join(',')} ` +
        `center=${ct.toArray().map(v=>v.toFixed(3)).join(',')} ` +
        `y=[${b.min.y.toFixed(3)},${b.max.y.toFixed(3)}] ` +
        `mat=${mat?.name ?? '?'} type=${mat?.type ?? '?'}`);
    }
  });
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
