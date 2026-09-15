'use client';

/**
 * ShellAndTube — the procedural shell-and-tube heat exchanger.
 *
 * Modeled after the real training unit: horizontal shell on two saddles,
 * a bolted channel (bonnet) head up front with a dished cover, a welded
 * dished head at the rear, green shell-side nozzles on top, red tube-side
 * nozzles front-bottom and rear-top, and — in cutaway mode — a longitudinal
 * section between the nozzles that opens the shell to show the tube bundle,
 * the segmental baffles and both tubesheets, exactly like the sectioned twin
 * of the teaching model.
 *
 * Real scale, and the saddles' base plates sit at y = 0, so the component
 * always rests ON the grid, never under it.
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

// ---- design constants (metres) --------------------------------------------
const SHELL_R = 0.3; // shell radius
const SHELL_HALF = 1.3; // shell cylinder half-length (axis = Z)
const AXIS_Y = 0.55; // shell axis height above the ground
const CHANNEL_R = 0.31; // channel barrel radius
const FLANGE_R = 0.4; // main flange radius
const TUBE_R = 0.012; // bundle tube radius
const TUBE_FIELD_R = 0.258; // bundle envelope radius
const TUBE_PITCH = 0.037; // triangular pitch
const BAFFLE_R = 0.285;
const BAFFLE_N = 6;
const SHEET_HALF = SHELL_HALF - 0.075; // tubesheet faces (just inside the shell ends)
const SEG_HALF = 0.42; // intact shell end half-length (cutaway mode)
const CUT_A = 0.38; // how far past horizontal the section opens (radians)

/** overall bounding size [x, y, z] — exported so the registry stays in sync */
export const SHELL_AND_TUBE_DIMS: [number, number, number] = [0.82, 1.08, 3.24];

/** a cylinder along the Z axis (three.js cylinders are Y-aligned) */
function zCylinder(
  rTop: number,
  rBottom: number,
  length: number,
  seg = 48,
  open = false,
  thetaStart?: number,
  thetaLength?: number,
) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, length, seg, 1, open, thetaStart, thetaLength);
  g.rotateX(Math.PI / 2);
  return g;
}

/** dished head as a lathe (barrel + elliptical dish), axis along Z */
function dishGeo(r: number, depth: number, barrel: number, dir: 1 | -1) {
  const pts: THREE.Vector2[] = [new THREE.Vector2(r, 0)];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(
      new THREE.Vector2(
        r * Math.cos((t * Math.PI) / 2),
        dir * (barrel + depth * Math.sin((t * Math.PI) / 2)),
      ),
    );
  }
  const g = new THREE.LatheGeometry(pts, 48);
  g.rotateX(Math.PI / 2);
  return g;
}

// ---- materials -------------------------------------------------------------
function useMaterials() {
  return useMemo(
    () => ({
      steel: new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.88, roughness: 0.32 }),
      steelDark: new THREE.MeshStandardMaterial({ color: '#4b4e53', metalness: 0.72, roughness: 0.48 }),
      head: new THREE.MeshStandardMaterial({ color: '#bfc3c9', metalness: 0.85, roughness: 0.38 }),
      flange: new THREE.MeshStandardMaterial({ color: '#b3b7bd', metalness: 0.85, roughness: 0.4 }),
      sheet: new THREE.MeshStandardMaterial({ color: '#8d9095', metalness: 0.8, roughness: 0.42 }),
      tubes: new THREE.MeshStandardMaterial({ color: '#5a5e64', metalness: 0.82, roughness: 0.45 }),
      baffles: new THREE.MeshStandardMaterial({ color: '#64686f', metalness: 0.75, roughness: 0.5 }),
      saddle: new THREE.MeshStandardMaterial({ color: '#3f4247', metalness: 0.55, roughness: 0.62 }),
      green: new THREE.MeshStandardMaterial({ color: '#2f7d4f', metalness: 0.35, roughness: 0.45 }),
      red: new THREE.MeshStandardMaterial({ color: '#b23a2a', metalness: 0.35, roughness: 0.45 }),
      shellCut: new THREE.MeshStandardMaterial({
        color: '#c9ccd1',
        metalness: 0.88,
        roughness: 0.32,
        side: THREE.DoubleSide,
      }),
    }),
    [],
  );
}

type Mats = ReturnType<typeof useMaterials>;

/** a vertical process nozzle: body + raised-face flange, pointing up or down */
function Nozzle({
  mats,
  z,
  baseY,
  up,
  body = 0.17,
  color,
}: {
  mats: Mats;
  z: number;
  baseY: number;
  up: boolean;
  body?: number;
  color: 'green' | 'red';
}) {
  const mat = color === 'green' ? mats.green : mats.red;
  const dir = up ? 1 : -1;
  const bodyR = 0.054;
  const flangeR = 0.096;
  const cy = baseY + (dir * body) / 2;
  const fy = baseY + dir * body;
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, cy, 0]} material={mat}>
        <cylinderGeometry args={[bodyR, bodyR, body, 28]} />
      </mesh>
      <mesh position={[0, fy + dir * 0.016, 0]} material={mats.flange}>
        <cylinderGeometry args={[flangeR, flangeR, 0.032, 32]} />
      </mesh>
      <mesh position={[0, fy + dir * 0.036, 0]} material={mats.flange}>
        <cylinderGeometry args={[0.072, 0.072, 0.012, 32]} />
      </mesh>
    </group>
  );
}

/** the tube bundle as one instanced mesh (triangular pitch inside a circle) */
function TubeBundle({ mats }: { mats: Mats }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const len = SHEET_HALF * 2 - 0.05;

  const geo = useMemo(() => zCylinder(TUBE_R, TUBE_R, len, 10), []);

  const spots = useMemo(() => {
    const out: Array<[number, number]> = [];
    const rows = Math.ceil(TUBE_FIELD_R / (TUBE_PITCH * 0.866));
    for (let r = -rows; r <= rows; r++) {
      const y = r * TUBE_PITCH * 0.866;
      const off = r % 2 === 0 ? 0 : TUBE_PITCH / 2;
      const cols = Math.ceil((TUBE_FIELD_R + 0.02) / TUBE_PITCH);
      for (let c = -cols; c <= cols; c++) {
        const x = c * TUBE_PITCH + off;
        if (x * x + y * y <= TUBE_FIELD_R * TUBE_FIELD_R) out.push([x, y]);
      }
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat4 = new THREE.Matrix4();
    spots.forEach(([x, y], i) => {
      mat4.makeTranslation(x, AXIS_Y + y, 0);
      m.setMatrixAt(i, mat4);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [spots]);

  return <instancedMesh ref={ref} args={[geo, mats.tubes, spots.length]} />;
}

/** one segmental baffle — a disc with a chord cut, alternately flipped */
function Baffle({ mats, z, flip }: { mats: Mats; z: number; flip: boolean }) {
  const geo = useMemo(() => {
    const chord = 0.135; // cut depth from center
    const a = Math.asin(chord / BAFFLE_R);
    const s = new THREE.Shape();
    // arc from the right chord point, clockwise, around the bottom, to the
    // left chord point — then close along the chord
    s.absarc(0, 0, BAFFLE_R, a, -(Math.PI + a), true);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false });
    g.translate(0, 0, -0.006);
    return g;
  }, []);
  return (
    <mesh
      geometry={geo}
      material={mats.baffles}
      position={[0, AXIS_Y, z]}
      rotation={flip ? [0, 0, Math.PI] : [0, 0, 0]}
    />
  );
}

/** saddle support: extruded cradle silhouette + base plate (base at y = 0) */
function Saddle({ mats, z }: { mats: Mats; z: number }) {
  const geo = useMemo(() => {
    const cradleR = SHELL_R + 0.018;
    const halfW = 0.26;
    const yTop = AXIS_Y - Math.sqrt(cradleR * cradleR - halfW * halfW);
    const aStart = Math.atan2(yTop - AXIS_Y, -halfW);
    const aEnd = Math.atan2(yTop - AXIS_Y, halfW);
    const s = new THREE.Shape();
    s.moveTo(-halfW, 0);
    s.lineTo(-halfW, yTop);
    s.absarc(0, AXIS_Y, cradleR, aStart, aEnd, false);
    s.lineTo(halfW, 0);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.105, bevelEnabled: false });
    g.translate(0, 0, -0.0525);
    g.rotateY(Math.PI / 2);
    return g;
  }, []);
  return (
    <group position={[0, 0, z]}>
      <mesh geometry={geo} material={mats.saddle} />
      <mesh position={[0, 0.014, 0]} material={mats.saddle}>
        <boxGeometry args={[0.58, 0.028, 0.19]} />
      </mesh>
    </group>
  );
}

export function ShellAndTubeModel({ cutaway = false }: { cutaway?: boolean }) {
  const mats = useMaterials();

  const shellGeo = useMemo(() => zCylinder(SHELL_R, SHELL_R, SHELL_HALF * 2, 64, true), []);
  const fullSegGeo = useMemo(() => zCylinder(SHELL_R, SHELL_R, SEG_HALF * 2, 48, true), []);
  const sectionGeo = useMemo(
    () =>
      zCylinder(
        SHELL_R,
        SHELL_R,
        (SHELL_HALF - SEG_HALF) * 2,
        64,
        true,
        -Math.PI / 2 - CUT_A,
        Math.PI + 2 * CUT_A,
      ),
    [],
  );
  const sheetGeo = useMemo(() => zCylinder(SHELL_R + 0.008, SHELL_R + 0.008, 0.055, 48), []);
  const flangeGeo = useMemo(() => zCylinder(FLANGE_R, FLANGE_R, 0.09, 56), []);
  const boltGeo = useMemo(() => zCylinder(0.0125, 0.0125, 0.15, 8), []);
  const frontDish = useMemo(() => dishGeo(CHANNEL_R, 0.24, 0.15, 1), []);
  const rearDish = useMemo(() => dishGeo(SHELL_R, 0.24, 0, -1), []);

  const bolts = useMemo(() => {
    const pos: Array<[number, number, number]> = [];
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pos.push([Math.cos(a) * 0.352, Math.sin(a) * 0.352, -0.045]);
    }
    return pos;
  }, []);

  // section cut rim positions (edges of the opened arc)
  const rimX = SHELL_R * Math.cos(CUT_A);
  const rimY = AXIS_Y + SHELL_R * Math.sin(CUT_A);
  const bandLen = (SHELL_HALF - SEG_HALF) * 2;

  return (
    <group>
      {/* ---------- shell ---------- */}
      {cutaway ? (
        <>
          {/* intact ends (they carry the shell-side nozzles) */}
          <mesh geometry={fullSegGeo} material={mats.steel} position={[0, AXIS_Y, SHELL_HALF - SEG_HALF]} />
          <mesh geometry={fullSegGeo} material={mats.steel} position={[0, AXIS_Y, -(SHELL_HALF - SEG_HALF)]} />
          {/* sectioned middle: bottom + sides kept, top open */}
          <mesh geometry={sectionGeo} material={mats.shellCut} position={[0, AXIS_Y, 0]} />
          {/* wall-thickness rims along the cut edges */}
          {[-1, 1].map((s) => (
            <mesh key={s} material={mats.flange} position={[s * rimX, rimY, 0]}>
              <boxGeometry args={[0.03, 0.075, bandLen]} />
            </mesh>
          ))}
        </>
      ) : (
        <mesh geometry={shellGeo} material={mats.steel} position={[0, AXIS_Y, 0]} />
      )}

      {/* ---------- tubesheets ---------- */}
      <mesh geometry={sheetGeo} material={mats.sheet} position={[0, AXIS_Y, SHEET_HALF]} />
      <mesh geometry={sheetGeo} material={mats.sheet} position={[0, AXIS_Y, -SHEET_HALF]} />

      {/* ---------- internals (always present; the section reveals them) ---------- */}
      <TubeBundle mats={mats} />
      {Array.from({ length: BAFFLE_N }, (_, i) => {
        const z = -SHEET_HALF + 0.32 + (i * ((SHEET_HALF * 2) - 0.64)) / (BAFFLE_N - 1);
        return <Baffle key={i} mats={mats} z={z} flip={i % 2 === 1} />;
      })}

      {/* ---------- front channel (bonnet) ---------- */}
      <group position={[0, AXIS_Y, SHELL_HALF]}>
        <mesh geometry={frontDish} material={mats.head} />
        <mesh geometry={flangeGeo} material={mats.flange} position={[0, 0, -0.045]} />
        {bolts.map((p, i) => (
          <mesh key={i} geometry={boltGeo} material={mats.steelDark} position={p} />
        ))}
      </group>

      {/* ---------- rear head ---------- */}
      <mesh geometry={rearDish} material={mats.head} position={[0, AXIS_Y, -SHELL_HALF]} />

      {/* ---------- nozzles (green = shell side, red = tube side) ---------- */}
      <Nozzle mats={mats} z={SHELL_HALF - 0.55} baseY={AXIS_Y + SHELL_R} up color="green" />
      <Nozzle mats={mats} z={-(SHELL_HALF - 0.55)} baseY={AXIS_Y + SHELL_R} up color="green" />
      {/* tube-side in: bottom of the front channel barrel */}
      <Nozzle
        mats={mats}
        z={SHELL_HALF + 0.1}
        baseY={AXIS_Y - CHANNEL_R}
        up={false}
        body={0.09}
        color="red"
      />
      {/* tube-side out: crown of the rear head */}
      <Nozzle mats={mats} z={-(SHELL_HALF + 0.09)} baseY={AXIS_Y + SHELL_R - 0.06} up color="red" />

      {/* ---------- saddles (base plates at y = 0 — the model rests on the ground) ---------- */}
      <Saddle mats={mats} z={0.78} />
      <Saddle mats={mats} z={-0.78} />

      {/* ---------- lifting lug (assembled only — it sits on the cut band) ---------- */}
      {!cutaway && (
        <group position={[0, AXIS_Y + SHELL_R + 0.055, 0.42]}>
          <mesh material={mats.steelDark}>
            <boxGeometry args={[0.014, 0.13, 0.09]} />
          </mesh>
          <mesh material={mats.steelDark} position={[0, 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.05, 16]} />
          </mesh>
        </group>
      )}

      {/* ---------- nameplate ---------- */}
      <mesh material={mats.steelDark} position={[SHELL_R + 0.004, AXIS_Y - 0.04, -0.15]}>
        <boxGeometry args={[0.006, 0.1, 0.16]} />
      </mesh>
    </group>
  );
}
