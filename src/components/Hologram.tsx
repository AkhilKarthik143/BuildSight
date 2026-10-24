"use client";

// A glowing blue "hologram" of a LEGO brick or plate, built from its stud size.
// Units: 1 = one stud pitch (8 mm). Real proportions: brick 9.6 mm tall, plate 3.2 mm.

import { Canvas, useFrame } from "@react-three/fiber";
import { Edges, Float } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Piece } from "@/lib/steps";

const HOLO = "#4fc3ff";
const BRICK_H = 1.2;
const PLATE_H = 0.4;
const STUD_R = 0.3;
const STUD_H = 0.2125;

function HoloMaterial({ opacity = 0.18 }: { opacity?: number }) {
  return (
    <meshBasicMaterial
      color={HOLO}
      transparent
      opacity={opacity}
      blending={THREE.AdditiveBlending}
      depthWrite={false}
      side={THREE.DoubleSide}
    />
  );
}

function Brick({ piece }: { piece: Piece }) {
  const h = piece.kind === "brick" ? BRICK_H : PLATE_H;
  const studs = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < piece.studsX; i++)
      for (let j = 0; j < piece.studsY; j++)
        out.push([i - (piece.studsX - 1) / 2, j - (piece.studsY - 1) / 2]);
    return out;
  }, [piece.studsX, piece.studsY]);

  return (
    <group>
      <mesh>
        <boxGeometry args={[piece.studsX, h, piece.studsY]} />
        <HoloMaterial />
        <Edges color={HOLO} threshold={15} />
      </mesh>
      {studs.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, h / 2 + STUD_H / 2, z]}>
          <cylinderGeometry args={[STUD_R, STUD_R, STUD_H, 24]} />
          <HoloMaterial opacity={0.25} />
          <Edges color={HOLO} threshold={30} />
        </mesh>
      ))}
    </group>
  );
}

// Slow turntable spin plus a faint projector disc underneath.
function Turntable({ piece }: { piece: Piece }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.6;
  });
  const size = Math.max(piece.studsX, piece.studsY);
  return (
    <>
      <Float speed={2} rotationIntensity={0.15} floatIntensity={0.6}>
        <group ref={spin} rotation={[0.35, 0, 0]}>
          <Brick piece={piece} />
        </group>
      </Float>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]}>
        <ringGeometry args={[size * 0.45, size * 0.6, 48]} />
        <HoloMaterial opacity={0.35} />
      </mesh>
    </>
  );
}

export default function Hologram({ piece }: { piece: Piece }) {
  const size = Math.max(piece.studsX, piece.studsY);
  return (
    <Canvas
      camera={{ position: [0, 2.6, size + 5], fov: 40 }}
      gl={{ alpha: true, antialias: true }}
      style={{ background: "transparent" }}
    >
      <Turntable key={`${piece.studsX}x${piece.studsY}-${piece.kind}`} piece={piece} />
    </Canvas>
  );
}
