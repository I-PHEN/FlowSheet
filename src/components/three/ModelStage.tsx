'use client';

/**
 * ModelStage — the 3D component viewer.
 *
 * A full-bleed react-three-fiber canvas that renders a model from the
 * registry — a procedural component (built in-app, rests on the ground by
 * construction) or a GLB (self-positioned on load: its bounding-box bottom
 * lands exactly at y = 0, so a model can never sink beneath the grid again).
 * The camera frames the model's real bounds; orbit / zoom with damping; a
 * slow turntable runs until the first interaction. Materials are PBR;
 * reflections come from locally-rendered lightformers (no network fetch).
 *
 * Rendered via next/dynamic({ ssr:false }) from the route page — three.js
 * never touches the server bundle.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Bounds, ContactShadows, Grid, Lightformer, Environment, OrbitControls, useGLTF } from '@react-three/drei';
import type { ModelEntry } from '@/lib/three/registry';
import { ShellAndTubeModel } from './models/ShellAndTube';

/** theme-aware palette read from the app's CSS custom properties */
function useStageTheme() {
  const read = () => {
    if (typeof window === 'undefined') {
      // light "drawing office" fallbacks — the canvas itself is ssr:false,
      // so these only matter for type safety (dark is the default theme)
      return { canvas: '#E6EAEE', inkSoft: '#414D59', bandLine: '#D5DCE2', ink: '#1D242C', dark: false };
    }
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    return {
      canvas: v('--fs-canvas', '#E6EAEE'),
      ink: v('--fs-ink', '#1D242C'),
      inkSoft: v('--fs-ink-soft', '#414D59'),
      bandLine: v('--fs-band-line', '#D5DCE2'),
      dark: document.documentElement.classList.contains('dark'),
    };
  };
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    // re-read when the .dark class flips on <html>
    const obs = new MutationObserver(() => setTheme(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

/**
 * A GLB, self-positioned the moment it finishes loading: centered in X/Z
 * with its bounding-box bottom at y = 0, so it rests ON the grid. (Doing
 * this here — rather than a <Center> in the tree — sidesteps the
 * measure-before-suspense-resolves bug that left models half-buried.)
 */
function GltfModel({ src }: { src: string }) {
  // (path, useDraco, useMeshopt) — registry GLBs are meshopt-compressed
  const { scene } = useGLTF(src, true, true);
  const clone = useMemo(() => scene.clone(true), [scene]);
  const group = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    g.position.set(-c.x, -box.min.y, -c.z);
  }, [clone]);

  return (
    <group ref={group}>
      <primitive object={clone} />
    </group>
  );
}

/** turntable that yields the moment the user grabs the model */
function SpinControls({ spinning }: { spinning: boolean }) {
  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      autoRotate={spinning}
      autoRotateSpeed={0.7}
      minDistance={0.4}
      maxDistance={14}
      maxPolarAngle={Math.PI / 2 + 0.25}
    />
  );
}

export default function ModelStage({
  model,
  cutaway = false,
  spin = true,
}: {
  model: ModelEntry;
  cutaway?: boolean;
  /** initial turntable — pass false for reduced-motion contexts */
  spin?: boolean;
}) {
  const theme = useStageTheme();
  const [spinning, setSpinning] = useState(spin);

  return (
    <div
      className="h-full w-full"
      style={
        theme.dark
          ? { background: '#000000' }
          : {
              // the drawing-office backdrop: a soft studio gradient behind a
              // transparent canvas — gray metal gets something to sit IN,
              // instead of drowning in a flat gray void
              background: 'radial-gradient(120% 90% at 50% 30%, #F8FAFC 0%, #EDF1F5 55%, #E0E6EC 100%)',
            }
      }
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 38, position: [3.4, 2.1, 4.2], near: 0.05, far: 60 }}
        gl={{ antialias: true, alpha: true }}
        onPointerDown={() => setSpinning(false)}
        onWheel={() => setSpinning(false)}
      >

        {/* base + key + fill */}
        <hemisphereLight args={[0xffffff, 0x8d8d8d, 0.85]} />
        <directionalLight position={[4.5, 7, 3]} intensity={2.1} />
        <directionalLight position={[-5, 2.5, -3.5]} intensity={0.65} />

        {/* locally-rendered environment for PBR reflections (offline-safe) */}
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.4} position={[0, 5, 2]} scale={[8, 4, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={1.1} position={[-5, 2, -3]} scale={[6, 3, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={0.9} position={[5, 1.5, -2]} scale={[6, 2, 1]} target={[0, 0, 0]} />
        </Environment>

        {/* the model, resting on the grid, camera framed to its real bounds */}
        <Bounds fit clip observe margin={1.2}>
          {model.component === 'shell-and-tube' ? (
            <ShellAndTubeModel cutaway={cutaway} />
          ) : model.src ? (
            <GltfModel src={model.src} />
          ) : null}
        </Bounds>

        {/* engineering ground: soft shadow + light grid */}
        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={theme.dark ? 0.42 : 0.5}
          scale={9}
          blur={2.6}
          far={3}
          resolution={512}
          color={theme.ink}
        />
        <Grid
          position={[0, 0, 0]}
          args={[16, 16]}
          cellSize={0.25}
          cellThickness={0.6}
          cellColor={theme.dark ? theme.bandLine : '#C4CED8'}
          sectionSize={1}
          sectionThickness={1.1}
          sectionColor={theme.dark ? theme.inkSoft : '#8FA0AF'}
          fadeDistance={11}
          fadeStrength={1.4}
          infiniteGrid
        />

        <SpinControls spinning={spinning} />
      </Canvas>
    </div>
  );
}

/** preload a registry GLB as soon as the module is imported (client) */
export function preloadModel(src: string) {
  if (typeof window !== 'undefined') useGLTF.preload(src, true, true);
}
