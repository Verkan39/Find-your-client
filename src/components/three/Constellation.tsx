"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

export interface StarPoint {
  id: string;
  name: string;
  category: string;
  opportunity: number;
  maturity: number;
  visibility: number;
  revenue: number;
  budgetFit: number;
}

const color = (s: number) => (s >= 70 ? "#b6f36a" : s >= 50 ? "#ffb547" : "#8b93b8");

/** Box is 8 x 5 x 5: x = digital maturity, y = opportunity, z = revenue (log scale). */
function layout(points: StarPoint[]) {
  const revs = points.map((p) => Math.log10(Math.max(1, p.revenue)));
  const lo = Math.min(...revs);
  const hi = Math.max(...revs);
  return points.map((p, i) => ({
    ...p,
    pos: new THREE.Vector3(
      (p.maturity / 100) * 8 - 4,
      (p.opportunity / 100) * 5 - 2.5,
      hi > lo ? ((revs[i] - lo) / (hi - lo)) * 5 - 2.5 : 0,
    ),
    size: 0.07 + (p.budgetFit / 100) * 0.13,
  }));
}

function Node({ p, active, onHover, onClick }: {
  p: ReturnType<typeof layout>[number]; active: boolean;
  onHover: (id: string | null) => void; onClick: (id: string) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const k = active ? 1.6 : 1 + Math.sin(t * 2 + phase) * 0.08;
    ref.current?.scale.lerp(new THREE.Vector3(k, k, k), 0.2);
    if (halo.current) {
      const h = 1.8 + Math.sin(t * 1.5 + phase) * 0.3;
      halo.current.scale.setScalar(active ? 3 : h);
    }
  });
  const c = color(p.opportunity);
  return (
    <group position={p.pos}>
      <mesh
        ref={ref}
        onPointerOver={(e) => { e.stopPropagation(); onHover(p.id); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = ""; }}
        onClick={(e) => { e.stopPropagation(); onClick(p.id); }}
      >
        <icosahedronGeometry args={[p.size, 2]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={active ? 3 : 1.6} toneMapped={false} roughness={0.3} />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[p.size, 16, 16]} />
        <meshBasicMaterial color={c} transparent opacity={0.08} depthWrite={false} />
      </mesh>
      {/* drop line to the floor for depth perception */}
      <Line points={[[0, 0, 0], [0, -2.5 - p.pos.y, 0]]} color={c} lineWidth={0.6} transparent opacity={active ? 0.6 : 0.15} />
      {active && (
        <Html distanceFactor={9} position={[0, p.size + 0.25, 0]} center zIndexRange={[20, 0]}>
          <div className="pointer-events-none w-52 -translate-y-1/2 rounded-xl glass-strong p-3 text-left shadow-2xl">
            <div className="truncate font-display text-sm font-semibold text-fg">{p.name}</div>
            <div className="mb-2 text-[11px] text-fg-muted">{p.category}</div>
            <dl className="grid grid-cols-3 gap-1 text-[10px] text-fg-muted">
              <div><dt>Opportunity</dt><dd className="text-sm font-semibold text-fg">{p.opportunity}</dd></div>
              <div><dt>Digital</dt><dd className="text-sm font-semibold text-fg">{p.maturity}</dd></div>
              <div><dt>Visibility</dt><dd className="text-sm font-semibold text-fg">{p.visibility}</dd></div>
            </dl>
          </div>
        </Html>
      )}
    </group>
  );
}

function Frame() {
  const floor = useMemo(() => {
    const g = new THREE.GridHelper(8, 16, "#3a4060", "#1d2235");
    g.position.y = -2.5;
    g.scale.z = 5 / 8;
    return g;
  }, []);
  const axis = (from: [number, number, number], to: [number, number, number]) => (
    <Line points={[from, to]} color="#4a5275" lineWidth={1} transparent opacity={0.6} />
  );
  const label = (text: string, pos: [number, number, number]) => (
    <Html position={pos} center distanceFactor={11} zIndexRange={[10, 0]}>
      <div className="pointer-events-none whitespace-nowrap rounded-full bg-ink-900/70 px-2 py-0.5 text-[11px] text-fg-muted ring-1 ring-white/10">{text}</div>
    </Html>
  );
  return (
    <group>
      <primitive object={floor} />
      {axis([-4, -2.5, 2.5], [4.3, -2.5, 2.5])}
      {axis([-4, -2.5, 2.5], [-4, 2.8, 2.5])}
      {axis([-4, -2.5, 2.5], [-4, -2.5, -2.8])}
      {label("Digital maturity →", [2.6, -2.85, 2.9])}
      {label("Opportunity ↑", [-4.4, 2.6, 2.5])}
      {label("Revenue →", [-4.5, -2.8, -2.4])}
    </group>
  );
}

export default function Constellation({ points, onSelect }: { points: StarPoint[]; onSelect: (id: string) => void }) {
  const laid = useMemo(() => layout(points), [points]);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <Canvas camera={{ position: [7.5, 3.5, 8.5], fov: 45 }} dpr={[1, 1.75]} gl={{ alpha: true }}>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 6, 5]} intensity={40} color="#8b7bff" />
      <Stars radius={50} depth={30} count={1200} factor={2.5} fade speed={0.4} />
      <group position={[0, 0.2, 0]}>
        <Frame />
        {laid.map((p) => (
          <Node key={p.id} p={p} active={hover === p.id} onHover={setHover} onClick={onSelect} />
        ))}
      </group>
      <OrbitControls enablePan={false} minDistance={6} maxDistance={18} autoRotate={!hover} autoRotateSpeed={0.5} enableDamping />
      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.2} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
