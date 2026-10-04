"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Line, Sparkles, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const R = 2;
const BEACON_COLORS = ["#b6f36a", "#ffb547", "#8b7bff", "#3fd7f2"];

function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function fibonacciSphere(n: number, radius: number) {
  const pts = new Float32Array(n * 3);
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = phi * i;
    pts[i * 3] = Math.cos(t) * r * radius;
    pts[i * 3 + 1] = y * radius;
    pts[i * 3 + 2] = Math.sin(t) * r * radius;
  }
  return pts;
}

/** Dotted globe with a fresnel atmosphere. */
function Globe() {
  const points = useMemo(() => fibonacciSphere(5200, R), []);
  const atmosphere = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color("#6f5cff") } },
        vertexShader: `varying vec3 vNormal; void main(){ vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uColor; varying vec3 vNormal; void main(){ float i = pow(0.62 - dot(vNormal, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(uColor, 1.0) * i * 1.6; }`,
      }),
    [],
  );
  return (
    <group>
      <mesh>
        <sphereGeometry args={[R * 0.985, 64, 64]} />
        <meshStandardMaterial color="#070912" roughness={0.9} metalness={0.1} />
      </mesh>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[points, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.018} color="#9aa6ff" transparent opacity={0.65} sizeAttenuation depthWrite={false} />
      </points>
      <mesh scale={1.18} material={atmosphere}>
        <sphereGeometry args={[R, 64, 64]} />
      </mesh>
    </group>
  );
}

function surfacePoint(i: number) {
  const u = rand(i + 1);
  const v = rand(i + 101);
  const theta = u * Math.PI * 2;
  const phi = Math.acos(2 * v - 1);
  return new THREE.Vector3().setFromSphericalCoords(R, phi, theta);
}

/** Business "beacons" rising from the surface, each with an expanding pulse ring. */
function Beacons({ count = 34 }: { count?: number }) {
  const data = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const p = surfacePoint(i);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
        return { p, q, h: 0.12 + rand(i + 7) * 0.38, color: BEACON_COLORS[i % BEACON_COLORS.length], phase: rand(i + 3) * Math.PI * 2 };
      }),
    [count],
  );
  const pillars = useRef<(THREE.Mesh | null)[]>([]);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    data.forEach((d, i) => {
      const pillar = pillars.current[i];
      if (pillar) pillar.scale.y = 0.6 + 0.4 * Math.sin(t * 1.4 + d.phase);
      const ring = rings.current[i];
      if (ring) {
        const k = ((t * 0.6 + d.phase) % 1.6) / 1.6;
        ring.scale.setScalar(0.4 + k * 2.2);
        (ring.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.8;
      }
    });
  });
  return (
    <group>
      {data.map((d, i) => (
        <group key={i} position={d.p} quaternion={d.q}>
          <mesh ref={(m) => { pillars.current[i] = m; }} position={[0, d.h / 2, 0]}>
            <cylinderGeometry args={[0.008, 0.016, d.h, 6]} />
            <meshBasicMaterial color={d.color} toneMapped={false} />
          </mesh>
          <mesh position={[0, d.h, 0]}>
            <sphereGeometry args={[0.028, 12, 12]} />
            <meshBasicMaterial color={d.color} toneMapped={false} />
          </mesh>
          <mesh ref={(m) => { rings.current[i] = m; }} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <ringGeometry args={[0.04, 0.05, 32]} />
            <meshBasicMaterial color={d.color} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Animated arcs: "you" connecting to the businesses worth pitching. */
function Arcs() {
  const arcs = useMemo(() => {
    const hub = surfacePoint(4);
    return Array.from({ length: 9 }, (_, i) => {
      const target = surfacePoint(i * 3 + 10);
      const mid = hub.clone().add(target).multiplyScalar(0.5);
      const lift = 1 + hub.distanceTo(target) * 0.32;
      mid.normalize().multiplyScalar(R * lift);
      const curve = new THREE.QuadraticBezierCurve3(hub, mid, target);
      return { points: curve.getPoints(60), color: BEACON_COLORS[i % 4], curve, speed: 0.18 + rand(i) * 0.2, offset: rand(i + 50) };
    });
  }, []);
  const lines = useRef<({ material: { dashOffset: number } } | null)[]>([]);
  const comets = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }, dt) => {
    lines.current.forEach((l) => { if (l) l.material.dashOffset -= dt * 0.35; });
    const t = clock.getElapsedTime();
    arcs.forEach((a, i) => {
      const m = comets.current[i];
      if (m) m.position.copy(a.curve.getPoint((t * a.speed + a.offset) % 1));
    });
  });
  return (
    <group>
      {arcs.map((a, i) => (
        <group key={i}>
          <Line
            ref={(l) => { lines.current[i] = l as unknown as { material: { dashOffset: number } }; }}
            points={a.points}
            color={a.color}
            lineWidth={1.2}
            transparent
            opacity={0.55}
            dashed
            dashSize={0.12}
            gapSize={0.08}
          />
          <mesh ref={(m) => { comets.current[i] = m; }}>
            <sphereGeometry args={[0.022, 10, 10]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function OrbitRing({ radius, tilt, speed, color }: { radius: number; tilt: number; speed: number; color: string }) {
  const ref = useRef<THREE.Group>(null);
  const dots = useMemo(() => {
    const n = 180;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * radius;
      arr[i * 3 + 2] = Math.sin(a) * radius;
    }
    return arr;
  }, [radius]);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * speed; });
  return (
    <group rotation={[tilt, 0, tilt / 2]}>
      <group ref={ref}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[dots, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.02} color={color} transparent opacity={0.5} toneMapped={false} />
        </points>
        <mesh position={[radius, 0, 0]}>
          <octahedronGeometry args={[0.06]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function Rig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const { pointer, viewport } = useThree();
  // On wide screens push the globe right so it frames the headline instead of sitting under it.
  const offsetX = viewport.aspect > 1.2 ? viewport.width * 0.1 : 0;
  const scale = viewport.aspect > 1.2 ? 0.86 : 0.72;
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += dt * 0.08;
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, pointer.y * 0.25, 0.04);
    g.position.x = THREE.MathUtils.lerp(g.position.x, offsetX + pointer.x * 0.25, 0.04);
  });
  return <group ref={group} scale={scale}>{children}</group>;
}

export default function HeroScene() {
  return (
    <Canvas camera={{ position: [0, 0.4, 6.8], fov: 42 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 3, 5]} intensity={1.2} color="#8b7bff" />
      <Stars radius={60} depth={40} count={2500} factor={3} fade speed={0.6} />
      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.5}>
        <Rig>
          <group rotation={[0.35, 0, -0.18]}>
            <Globe />
            <Beacons />
            <Arcs />
          </group>
          <OrbitRing radius={2.9} tilt={0.5} speed={0.25} color="#3fd7f2" />
          <OrbitRing radius={3.3} tilt={-0.35} speed={-0.15} color="#8b7bff" />
        </Rig>
      </Float>
      <Sparkles count={60} scale={[9, 6, 6]} size={2} speed={0.3} color="#c9c2ff" opacity={0.6} />
      <EffectComposer>
        <Bloom intensity={1.1} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.75} />
      </EffectComposer>
    </Canvas>
  );
}
