// Materials for practice parts. Builders ask for a material by role ("abs", "gold", ...); the ghost and the
// tray thumbnails reuse the same geometry with different materials.

import * as THREE from "three";

export type Role =
  | "abs" // LEGO plastic (uses the part colour)
  | "absDark" // holes and recesses in LEGO parts
  | "pcb"
  | "pcbGreen"
  | "plastic" // black connector / slot plastic
  | "plasticGray"
  | "metal" // brushed aluminium
  | "metalDark" // anodised heatsinks, shroud trim
  | "steel" // bracket, slot shields
  | "gold"
  | "copper"
  | "shroud"
  | "fan"
  | "chip"
  | "light"; // small emissive accent

export type MaterialFor = (role: Role, color?: string) => THREE.Material;

const cache = new Map<string, THREE.Material>();
const once = <T extends THREE.Material>(key: string, make: () => T): T => {
  let m = cache.get(key) as T | undefined;
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
};

// Glossy ABS: low roughness with a thin clearcoat, like real LEGO bricks under studio light.
function abs(color: string) {
  return once(`abs:${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.26, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.2, specularIntensity: 0.6 }));
}

// Fine copper traces, vias and silkscreen on a matte black board, drawn once on a canvas (browser only).
let pcbMap: THREE.Texture | null = null;
function pcbTexture(): THREE.Texture | null {
  if (pcbMap || typeof document === "undefined") return pcbMap;
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#16191d";
  g.fillRect(0, 0, S, S);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // traces: runs of 45° and straight segments, like routed copper under solder mask
  for (let i = 0; i < 520; i++) {
    let x = rnd() * S;
    let y = rnd() * S;
    g.strokeStyle = rnd() < 0.85 ? "rgba(70,78,88,0.55)" : "rgba(120,104,70,0.45)";
    g.lineWidth = rnd() < 0.8 ? 1 : 2.2;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      const len = 20 + rnd() * 120;
      const dir = Math.floor(rnd() * 8) * (Math.PI / 4);
      x += Math.cos(dir) * len;
      y += Math.sin(dir) * len;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // vias
  for (let i = 0; i < 900; i++) {
    g.fillStyle = "rgba(150,140,110,0.5)";
    g.beginPath();
    g.arc(rnd() * S, rnd() * S, 1.4, 0, Math.PI * 2);
    g.fill();
  }
  // silkscreen ticks and tiny component outlines
  g.strokeStyle = "rgba(220,224,230,0.22)";
  g.lineWidth = 1;
  for (let i = 0; i < 140; i++) g.strokeRect(rnd() * S, rnd() * S, 6 + rnd() * 18, 4 + rnd() * 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  pcbMap = t;
  return t;
}

export const solid: MaterialFor = (role, color = "#888888") => {
  switch (role) {
    case "abs":
      return abs(color);
    case "absDark":
      return once(`absDark:${color}`, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.35), roughness: 0.6 }));
    case "pcb":
      return once("pcb", () => {
        const map = pcbTexture();
        if (map) map.repeat.set(1 / 160, 1 / 160);
        return new THREE.MeshStandardMaterial({ color: "#ffffff", map, roughness: 0.72, metalness: 0.05 });
      });
    case "pcbGreen":
      return once("pcbGreen", () => new THREE.MeshStandardMaterial({ color: "#1d4a2c", roughness: 0.6 }));
    case "plastic":
      return once("plastic", () => new THREE.MeshStandardMaterial({ color: "#0d0f12", roughness: 0.55 }));
    case "plasticGray":
      return once("plasticGray", () => new THREE.MeshStandardMaterial({ color: "#3a3e45", roughness: 0.5 }));
    case "metal":
      return once("metal", () => new THREE.MeshStandardMaterial({ color: "#b8bdc4", metalness: 0.92, roughness: 0.32 }));
    case "metalDark":
      return once("metalDark", () => new THREE.MeshStandardMaterial({ color: "#2b2f36", metalness: 0.75, roughness: 0.38 }));
    case "steel":
      return once("steel", () => new THREE.MeshStandardMaterial({ color: "#c9ced4", metalness: 0.88, roughness: 0.28 }));
    case "gold":
      return once("gold", () => new THREE.MeshStandardMaterial({ color: "#e3b04b", metalness: 1, roughness: 0.25 }));
    case "copper":
      return once("copper", () => new THREE.MeshStandardMaterial({ color: "#c47a4a", metalness: 1, roughness: 0.3 }));
    case "shroud":
      return once("shroud", () => new THREE.MeshPhysicalMaterial({ color: "#1b1e23", metalness: 0.35, roughness: 0.42, clearcoat: 0.2 }));
    case "fan":
      return once("fan", () => new THREE.MeshStandardMaterial({ color: "#101114", roughness: 0.62 }));
    case "chip":
      return once("chip", () => new THREE.MeshStandardMaterial({ color: "#0a0b0d", roughness: 0.4 }));
    case "light":
      return once("light", () => new THREE.MeshStandardMaterial({ color: "#0b1c26", emissive: "#5cc8ff", emissiveIntensity: 1.6, roughness: 0.4 }));
  }
};

// ---------- the ghost: a soft holo-blue fresnel glow ----------

export const HOLO = new THREE.Color("#5cc8ff");

export function ghostMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: HOLO.clone() }, uIntensity: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 local = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 mv = modelViewMatrix * local;
        vN = normalize(normalMatrix * n);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uIntensity;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float a = (0.24 + f * 0.7) * uIntensity;
        gl_FragColor = vec4(uColor * (0.7 + f * 1.3), clamp(a, 0.0, 1.0));
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Every role drawn with one material (the ghost). */
export const uniform = (m: THREE.Material): MaterialFor => () => m;
