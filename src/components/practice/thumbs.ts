"use client";

// Tray pictures: each part rendered once, with the same PBR materials, in a small offscreen renderer
// (studio environment, three-quarter view). The renderer is thrown away afterwards.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildPart } from "./build";
import { solid } from "./build/materials";
import type { Part } from "./engine";

export async function renderThumbnails(parts: Part[], size = 240): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (typeof document === "undefined") return out;
  const canvas = document.createElement("canvas");
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  } catch {
    return out;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 1.25;
  const key = new THREE.DirectionalLight("#ffffff", 1.7);
  key.position.set(1, 2, 1.5);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#cfe8ff", 1.4); // edge light so black parts still read on the dark tray
  rim.position.set(-1.5, 0.8, -2);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 5000);

  for (const part of parts) {
    const g = buildPart(part.spec, solid);
    scene.add(g);
    const box = new THREE.Box3().setFromObject(g);
    const centre = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const dist = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.92;
    camera.position.copy(centre).add(new THREE.Vector3(0.75, 0.85, 1.1).normalize().multiplyScalar(dist));
    camera.near = dist / 50;
    camera.far = dist * 4;
    camera.updateProjectionMatrix();
    camera.lookAt(centre);
    renderer.render(scene, camera);
    out[part.id] = canvas.toDataURL("image/png");
    scene.remove(g);
    await new Promise((res) => requestAnimationFrame(() => res(null)));
  }
  env.dispose();
  pmrem.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}
