"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sparkles } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useRef } from "react";
import * as THREE from "three";

function Orb({ score }: { score: number }) {
  const shell = useRef<THREE.Mesh>(null);
  const c = score >= 70 ? "#b6f36a" : score >= 50 ? "#ffb547" : "#8b93b8";
  useFrame((_, dt) => {
    if (shell.current) {
      shell.current.rotation.y += dt * 0.4;
      shell.current.rotation.x += dt * 0.15;
    }
  });
  return (
    <Float speed={2} rotationIntensity={0.6} floatIntensity={0.8}>
      <mesh>
        <icosahedronGeometry args={[1, 16]} />
        <MeshDistortMaterial color={c} emissive={c} emissiveIntensity={0.35} distort={0.35 + (score / 100) * 0.25} speed={2.2} roughness={0.15} metalness={0.4} />
      </mesh>
      <mesh ref={shell} scale={1.45}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#8b7bff" wireframe transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <Sparkles count={36} scale={3.6} size={2.5} speed={0.5} color={c} />
    </Float>
  );
}

export default function ScoreOrb({ score }: { score: number }) {
  return (
    <Canvas camera={{ position: [0, 0, 4.2], fov: 45 }} dpr={[1, 1.75]} gl={{ alpha: true }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 3, 3]} intensity={30} color="#ffffff" />
      <pointLight position={[-3, -2, 2]} intensity={20} color="#3fd7f2" />
      <Orb score={score} />
      <EffectComposer>
        <Bloom intensity={0.8} luminanceThreshold={0.3} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
