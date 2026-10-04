"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

const R = 2;
const MARKER_COLORS = ["#b6f36a", "#ffb547", "#8b7bff", "#3fd7f2"];

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

function surfacePoint(i: number) {
  const theta = rand(i + 1) * Math.PI * 2;
  const phi = Math.acos(2 * rand(i + 101) - 1);
  return new THREE.Vector3().setFromSphericalCoords(R, phi, theta);
}

/** Shared interaction state, written by the Rig and read by the globe's shader. */
interface Interaction {
  /** Last cursor position in client pixels; null when the cursor is outside the hero. */
  client: { x: number; y: number } | null;
  hover: THREE.Vector3;
  hoverStrength: number;
  hit: boolean;
  ripple: THREE.Vector3;
  rippleStart: number;
}

const DOT_VERTEX = /* glsl */ `
  uniform vec3 uHover;
  uniform float uHoverStrength;
  uniform vec3 uRipple;
  uniform float uRippleAge;
  uniform float uPixelRatio;
  varying float vGlow;
  varying float vFacing;

  void main() {
    vec3 p = position;
    vec3 n = normalize(position);

    // Dots near the cursor swell outward and brighten.
    float d = distance(p, uHover);
    float hover = uHoverStrength * smoothstep(1.1, 0.0, d);

    // A click sends a single soft wave across the surface.
    float rd = distance(p, uRipple);
    float front = uRippleAge * 2.4;
    float ripple = exp(-pow((rd - front) * 5.0, 2.0)) * smoothstep(2.2, 0.0, uRippleAge);

    p += n * (hover * 0.16 + ripple * 0.12);
    vGlow = clamp(hover + ripple * 0.8, 0.0, 1.0);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFacing = normalize(mat3(modelViewMatrix) * n).z;
    gl_PointSize = uPixelRatio * (2.6 + vGlow * 3.6) * (6.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const DOT_FRAGMENT = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uHot;
  varying float vGlow;
  varying float vFacing;

  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float alpha = smoothstep(0.5, 0.15, r);
    // Fade dots toward the limb so the sphere reads as a calm, solid form.
    float limb = smoothstep(-0.1, 0.6, vFacing);
    vec3 col = mix(uBase, uHot, vGlow);
    gl_FragColor = vec4(col, alpha * (0.3 + 0.5 * limb + vGlow * 0.4));
  }
`;

function Globe({ state }: { state: RefObject<Interaction> }) {
  const points = useMemo(() => fibonacciSphere(4200, R), []);
  const dpr = useThree((s) => s.viewport.dpr);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader: DOT_VERTEX,
        fragmentShader: DOT_FRAGMENT,
        uniforms: {
          uHover: { value: new THREE.Vector3(99, 99, 99) },
          uHoverStrength: { value: 0 },
          uRipple: { value: new THREE.Vector3(99, 99, 99) },
          uRippleAge: { value: 10 },
          uPixelRatio: { value: 1 },
          uBase: { value: new THREE.Color("#8f9bf0") },
          uHot: { value: new THREE.Color("#b9f0ff") },
        },
      }),
    [],
  );
  const atmosphere = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color("#5b4bd6") } },
        vertexShader: `varying vec3 vNormal; void main(){ vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uColor; varying vec3 vNormal; void main(){ float i = pow(0.6 - dot(vNormal, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(uColor, 1.0) * i * 0.75; }`,
      }),
    [],
  );

  useFrame(({ clock }) => {
    const s = state.current;
    const u = material.uniforms;
    u.uPixelRatio.value = dpr;
    u.uHover.value.copy(s.hover);
    u.uHoverStrength.value = s.hoverStrength;
    u.uRipple.value.copy(s.ripple);
    u.uRippleAge.value = clock.getElapsedTime() - s.rippleStart;
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[R * 0.99, 64, 64]} />
        <meshBasicMaterial color="#070912" />
      </mesh>
      <points material={material}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[points, 3]} />
        </bufferGeometry>
      </points>
      <mesh scale={1.14} material={atmosphere}>
        <sphereGeometry args={[R, 64, 64]} />
      </mesh>
    </group>
  );
}

/** A handful of quiet business markers, no pulsing. */
function Markers() {
  const data = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const p = surfacePoint(i);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
        return { p, q, h: 0.08 + rand(i + 7) * 0.16, color: MARKER_COLORS[i % MARKER_COLORS.length] };
      }),
    [],
  );
  return (
    <group>
      {data.map((d, i) => (
        <group key={i} position={d.p} quaternion={d.q}>
          <mesh position={[0, d.h / 2, 0]}>
            <cylinderGeometry args={[0.005, 0.005, d.h, 6]} />
            <meshBasicMaterial color={d.color} transparent opacity={0.5} />
          </mesh>
          <mesh position={[0, d.h, 0]}>
            <sphereGeometry args={[0.022, 12, 12]} />
            <meshBasicMaterial color={d.color} transparent opacity={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Thin connection arcs drifting slowly. */
function Arcs() {
  const arcs = useMemo(() => {
    const hub = surfacePoint(4);
    return [10, 13, 19, 25].map((seed, i) => {
      const target = surfacePoint(seed);
      const mid = hub.clone().add(target).multiplyScalar(0.5);
      mid.normalize().multiplyScalar(R * (1 + hub.distanceTo(target) * 0.28));
      return { points: new THREE.QuadraticBezierCurve3(hub, mid, target).getPoints(60), color: MARKER_COLORS[i % 4] };
    });
  }, []);
  const lines = useRef<({ material: { dashOffset: number } } | null)[]>([]);
  useFrame((_, dt) => {
    lines.current.forEach((l) => { if (l) l.material.dashOffset -= dt * 0.12; });
  });
  return (
    <group>
      {arcs.map((a, i) => (
        <Line
          key={i}
          ref={(l) => { lines.current[i] = l as unknown as { material: { dashOffset: number } }; }}
          points={a.points}
          color={a.color}
          lineWidth={1}
          transparent
          opacity={0.32}
          dashed
          dashSize={0.1}
          gapSize={0.1}
        />
      ))}
    </group>
  );
}

const _ray = new THREE.Raycaster();
const _sphere = new THREE.Sphere();
const _hit = new THREE.Vector3();
const _inv = new THREE.Matrix4();

/**
 * Follows the pointer: the globe leans toward the cursor, and the point under the
 * cursor is projected onto the sphere so the shader can light the dots around it.
 */
function Rig({ children, state }: { children: React.ReactNode; state: RefObject<Interaction> }) {
  const outer = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const globe = useRef<THREE.Group>(null);
  const { viewport, camera, gl: renderer } = useThree();
  const ndc = useRef(new THREE.Vector2());
  const wide = viewport.aspect > 1.2;
  const offsetX = wide ? viewport.width * 0.1 : 0;
  const scale = wide ? 0.86 : 0.72;

  useFrame((_, dt) => {
    const o = outer.current;
    const sp = spin.current;
    const gl = globe.current;
    if (!o || !sp || !gl) return;
    const damp = THREE.MathUtils.damp;
    const s = state.current;

    // Pointer in canvas NDC, measured against the canvas's real on-screen box
    // (it sits offset and scroll-transformed inside the hero).
    const pointer = ndc.current;
    if (s.client) {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(((s.client.x - r.left) / r.width) * 2 - 1, -((s.client.y - r.top) / r.height) * 2 + 1);
    } else {
      pointer.set(0, 0);
    }
    const tiltX = THREE.MathUtils.clamp(pointer.x, -1.2, 1.2);
    const tiltY = THREE.MathUtils.clamp(pointer.y, -1.2, 1.2);

    sp.rotation.y += dt * 0.05;
    o.rotation.x = damp(o.rotation.x, -tiltY * 0.35, 3, dt);
    o.rotation.y = damp(o.rotation.y, tiltX * 0.55, 3, dt);
    o.position.x = damp(o.position.x, offsetX + tiltX * 0.15, 3, dt);
    o.position.y = damp(o.position.y, tiltY * 0.1, 3, dt);

    // Pointer -> sphere hit, expressed in the globe's local space.
    _ray.setFromCamera(pointer, camera);
    gl.updateWorldMatrix(true, false);
    _sphere.center.setFromMatrixPosition(gl.matrixWorld);
    _sphere.radius = R * gl.getWorldScale(_hit).x;
    const hit = s.client ? _ray.ray.intersectSphere(_sphere, _hit) : null;
    s.hit = Boolean(hit);
    if (hit) {
      _inv.copy(gl.matrixWorld).invert();
      _hit.applyMatrix4(_inv);
      // Snap on first contact, then glide so the highlight trails the cursor smoothly.
      if (s.hoverStrength < 0.05) s.hover.copy(_hit);
      else s.hover.lerp(_hit, 1 - Math.exp(-14 * dt));
    }
    s.hoverStrength = damp(s.hoverStrength, hit ? 1 : 0, 6, dt);
  });

  return (
    <group ref={outer} scale={scale}>
      <group ref={spin}>
        <group ref={globe} rotation={[0.35, 0, -0.18]}>
          {children}
        </group>
      </group>
    </group>
  );
}

/** Tracks the cursor over the hero container and fires a ripple on click. */
function PointerTracker({ state, container }: { state: RefObject<Interaction>; container?: RefObject<HTMLElement | null> }) {
  const clock = useThree((s) => s.clock);
  useEffect(() => {
    const el = container?.current;
    if (!el) return;
    const move = (e: PointerEvent) => { state.current.client = { x: e.clientX, y: e.clientY }; };
    const leave = () => { state.current.client = null; };
    const down = () => {
      const s = state.current;
      if (!s.hit) return;
      s.ripple.copy(s.hover);
      s.rippleStart = clock.getElapsedTime();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointerdown", down);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointerdown", down);
    };
  }, [clock, container, state]);
  return null;
}

export default function HeroScene({ container }: { container?: RefObject<HTMLElement | null> }) {
  const state = useRef<Interaction>({
    client: null,
    hover: new THREE.Vector3(99, 99, 99),
    hoverStrength: 0,
    hit: false,
    ripple: new THREE.Vector3(99, 99, 99),
    rippleStart: -10,
  });
  return (
    <Canvas
      camera={{ position: [0, 0.3, 6.8], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
    >
      <Stars radius={60} depth={40} count={900} factor={2} saturation={0} fade speed={0} />
      <Rig state={state}>
        <Globe state={state} />
        <Markers />
        <Arcs />
      </Rig>
      <PointerTracker state={state} container={container} />
    </Canvas>
  );
}
