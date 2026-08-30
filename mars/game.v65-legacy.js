import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";

// cache: game.js?v=65
const GATE_COUNT = 7;
const MIN_GATE_SPEED = 5;
const MIN_LAP_FRAC = 0.72;
const HALF_W = 13;
const START_T = 0.042;
const MAX_DT = 1 / 20;
const MAX_PITCH = 0.08;
const MAX_ROLL = 0.10;
const FLIP_HOLD = 0.25;
const GATE_POST_H = 8.4;
const BOOST_DRAIN = 0.38;
const BOOST_REGEN = 0.12;
const ARC_LEN = 264;
const DUST = 0xA6583D;
const DUST_DARK = 0x8B3A2B;
const ROCK_SHADOW = 0x4A251D;
const ROCK_LIT = 0xA34A2C;
const ROCK_MID = 0x733021;
const STEEL = 0xC0C0C0;
const BANNER = 0xFFD700;
const TAIL = 0xFF0000;
const RIBBON_LIFT = 0.04;
const RIBBON_PACK = 0x7A4530;
const EDGE_LINE = 0xEDE4C0;
const EDGE_GOLD = 0xC9A227;
const EDGE_GOLD_HOT = 0xE8B923;
const FOG_PEACH = 0xD08A62;

const keys = Object.create(null);
addEventListener("keydown", (e) => {
  unlockAudio();
  keys[e.code] = true;
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
  if (e.code === "KeyR" && !e.repeat) onRetry();
  if (e.code === "KeyC" && !e.repeat) cycleLivery();
  if (e.code === "KeyF" && !e.repeat) fireItem();
  if (e.code === "KeyG" && !e.repeat) dropMine();
});
addEventListener("keyup", (e) => { keys[e.code] = false; });

const touchCtl = { st: 0, th: 0, bo: false };
const touchPtrs = new Map();
const STEER_PX = 96;
const elSteerWell = document.getElementById("steer-well");
const elSteerKnob = document.getElementById("steer-knob");
const elPadTh = document.getElementById("pad-throttle");
const elPadBr = document.getElementById("pad-brake");
const elPadBo = document.getElementById("pad-boost");
const elHint = document.getElementById("hint");
let hintGone = false;


function steerFromClientX(clientX) {
  if (elSteerWell) {
    const r = elSteerWell.getBoundingClientRect();
    const cx = r.left + r.width * 0.5;
    return Math.max(-1, Math.min(1, (clientX - cx) / Math.max(24, r.width * 0.42)));
  }
  return Math.max(-1, Math.min(1, (clientX - innerWidth * 0.22) / STEER_PX));
}

function setPadHeld(el, on) {
  if (el) el.classList.toggle("held", on);
}

function touchRecompute() {
  let th = 0, st = 0, bo = false, steerN = 0;
  touchPtrs.forEach((rec) => {
    if (rec.role === "steer") { st += rec.st; steerN++; }
    else if (rec.role === "th") th += 1;
    else if (rec.role === "br") th -= 1;
    else if (rec.role === "bo") bo = true;
  });
  touchCtl.st = steerN ? Math.max(-1, Math.min(1, st)) : 0;
  touchCtl.th = Math.max(-1, Math.min(1, th));
  touchCtl.bo = bo;
  setPadHeld(elPadTh, th > 0);
  setPadHeld(elPadBr, th < 0);
  setPadHeld(elPadBo, bo);
  if (elSteerKnob) elSteerKnob.style.transform = "translate(" + (touchCtl.st * 42) + "px,0)";
  if (elSteerWell) elSteerWell.classList.toggle("held", steerN > 0);
}

function padRoleFromTarget(t) {
  if (!t || !t.closest) return null;
  if (t.closest("#livery-tap")) return "livery";
  if (t.closest("#pad-boost")) return "bo";
  if (t.closest("#pad-throttle")) return "th";
  if (t.closest("#pad-brake")) return "br";
  if (t.closest("#steer-well")) return "steer";
  return null;
}

function onPtrDown(e) {
  unlockAudio();
  const finger = e.pointerType === "touch" || e.pointerType === "pen";
  if (finger) document.body.classList.add("touch-on");
  if (finished) {
    onRetry();
    return;
  }
  const hit = padRoleFromTarget(e.target);
  if (hit === "livery") {
    cycleLivery();
    if (e.cancelable) e.preventDefault();
    return;
  }
  let role = hit;
  if (!role && finger) {
    if (e.clientX < innerWidth * 0.5) role = "steer";
    else role = "th";
  }
  if (!role) return;
  if (!finger && !hit) return;
  const rec = { role, ox: e.clientX, oy: e.clientY, st: 0 };
  if (role === "steer") {
    rec.st = steerFromClientX(e.clientX);
  }
  touchPtrs.set(e.pointerId, rec);
  if (e.target && e.target.setPointerCapture) {
    try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
  }
  touchRecompute();
  if (e.cancelable) e.preventDefault();
}

function onPtrMove(e) {
  const rec = touchPtrs.get(e.pointerId);
  if (!rec) return;
  if (rec.role === "steer") {
    rec.st = steerFromClientX(e.clientX);
    touchRecompute();
  }
  if (e.cancelable) e.preventDefault();
}

function onPtrUp(e) {
  if (!touchPtrs.has(e.pointerId)) return;
  touchPtrs.delete(e.pointerId);
  touchRecompute();
}

addEventListener("pointerdown", onPtrDown, { passive: false });
addEventListener("pointermove", onPtrMove, { passive: false });
addEventListener("pointerup", onPtrUp);
addEventListener("pointercancel", onPtrUp);
addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("gesturestart", (e) => e.preventDefault());
addEventListener("touchmove", (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });

(function enableTouchHud() {
  let coarse = false, noHover = false;
  try {
    coarse = matchMedia("(pointer: coarse)").matches;
    noHover = matchMedia("(hover: none)").matches;
  } catch (err) {}
  const hasTouch = "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0;
  if (coarse || noHover || hasTouch) {
    document.documentElement.classList.add("touch-on");
    document.body.classList.add("touch-on");
  }
})();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;
document.body.prepend(renderer.domElement);
renderer.domElement.style.touchAction = "none";
try {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  THREE.Texture.DEFAULT_ANISOTROPY = Math.min(8, maxAniso || 8);
} catch (err) {}


const scene = new THREE.Scene();
scene.background = new THREE.Color(0xEBB890);
scene.fog = new THREE.FogExp2(0xE3A07A, 0.00145);

const PROOF = (new URLSearchParams(location.search).get("shot") || "").toUpperCase();
if (PROOF === "A" || PROOF === "B") {
  const hd = document.getElementById("hud");
  const tw = document.getElementById("touch");
  if (hd) hd.style.display = "none";
  if (tw) tw.style.display = "none";
}
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.2, 2200);
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xF0C8A8, 0xC07048, 1.62);
scene.add(hemi);
scene.add(new THREE.AmbientLight(0xE0A878, 0.72));

const sun = new THREE.DirectionalLight(0xFFD0A8, 4.15);
sun.position.set(-48, 12, -36);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1.5;
sun.shadow.camera.far = 150;
sun.shadow.camera.left = -34;
sun.shadow.camera.right = 34;
sun.shadow.camera.top = 34;
sun.shadow.camera.bottom = -34;
sun.shadow.bias = -0.00022;
sun.shadow.normalBias = 0.022;
sun.shadow.radius = 2.8;
scene.add(sun);
scene.add(sun.target);

const fill = new THREE.DirectionalLight(0xFFE2C4, 0.95);
fill.position.set(85, 22, 28);
scene.add(fill);
scene.add(fill.target);
const rim = new THREE.DirectionalLight(0xFFE2C4, 0.52);
rim.position.set(30, 14, -40);
scene.add(rim);

const pmrem = new THREE.PMREMGenerator(renderer);
const envSc = new THREE.Scene();
const envSky = new THREE.Mesh(
  new THREE.SphereGeometry(30, 16, 12),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: "varying vec3 w; void main(){ w = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "varying vec3 w; void main(){ float h = normalize(w).y; vec3 zen = vec3(0.50,0.38,0.34); vec3 hor = vec3(0.89,0.63,0.48); vec3 bot = vec3(0.42,0.22,0.14); vec3 col = h > 0.0 ? mix(hor, zen, pow(h, 0.55)) : mix(hor, bot, clamp(-h * 1.3, 0.0, 1.0)); gl_FragColor = vec4(col, 1.0); }"
  })
);
envSc.add(envSky);
envSc.add(new THREE.HemisphereLight(0xE3A07A, 0xA6583D, 1.15));
const sunBall = new THREE.Mesh(new THREE.SphereGeometry(11, 12, 12), new THREE.MeshBasicMaterial({ color: 0xFFB878 }));
sunBall.position.set(-18, 10, -10);
const cool = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 8), new THREE.MeshBasicMaterial({ color: 0xC4A890 }));
cool.position.set(12, 14, 6);
envSc.add(cool);
envSc.add(sunBall);
scene.environment = pmrem.fromScene(envSc, 0.04).texture;

let composer = null;
let smaaPass = null;
function resizeView() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
  if (smaaPass && smaaPass.setSize) smaaPass.setSize(innerWidth, innerHeight);
}
addEventListener("resize", resizeView);
if (PROOF !== "A" && PROOF !== "B") {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  smaaPass = new SMAAPass(innerWidth, innerHeight);
  composer.addPass(smaaPass);
}

function dirtTexture(repU, repV, hex) {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const g = c.getContext("2d");
  g.fillStyle = hex || "#A6583D";
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 42000; i++) {
    const v = (Math.random() * 80) | 0;
    g.fillStyle = "rgba(" + (88 + v) + "," + (38 + (v * 0.42) | 0) + "," + (22 + (v * 0.2) | 0) + "," + (0.14 + Math.random() * 0.42) + ")";
    g.fillRect(Math.random() * 1024, Math.random() * 1024, 1 + Math.random() * 5, 1 + Math.random() * 5);
  }
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = "rgba(80,35,24," + (0.07 + Math.random() * 0.14) + ")";
    g.lineWidth = 1 + Math.random() * 2.4;
    g.beginPath();
    g.moveTo(Math.random() * 1024, Math.random() * 1024);
    g.lineTo(Math.random() * 1024, Math.random() * 1024);
    g.stroke();
  }
  for (let i = 0; i < 180; i++) {
    g.fillStyle = "rgba(40,18,12," + (0.08 + Math.random() * 0.16) + ")";
    g.beginPath();
    g.ellipse(Math.random() * 1024, Math.random() * 1024, 2 + Math.random() * 7, 1 + Math.random() * 3, Math.random() * 6, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repU, repV);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function dirtBump(repU, repV) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18000; i++) {
    const v = (90 + Math.random() * 70) | 0;
    g.fillStyle = "rgb(" + v + "," + v + "," + v + ")";
    g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repU, repV);
  t.anisotropy = 4;
  return t;
}

function strataTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 512;
  const g = c.getContext("2d");
  // LOOK.md: rock-lit #A34A2C/#733021 vs rock-shadow #4A251D — extra seams so walls are not one slab.
  const cycle = [
    ["#A34A2C", 36],
    ["#4A251D", 9],
    ["#733021", 28],
    ["#3A1C16", 7],
    ["#C06A45", 18],
    ["#4A251D", 12],
    ["#8B3A2B", 30],
    ["#5A2A1C", 10],
    ["#A6583D", 22],
    ["#4A251D", 8]
  ];
  let y = 0;
  let k = 0;
  while (y < 512) {
    const spec = cycle[k % cycle.length];
    k++;
    const h = Math.max(6, spec[1] + (Math.random() * 10 - 4));
    g.fillStyle = spec[0];
    g.fillRect(0, y, 128, h);
    g.fillStyle = "rgba(0,0,0," + (0.16 + Math.random() * 0.18) + ")";
    g.fillRect(0, y + h - 3, 128, 3);
    g.fillStyle = "rgba(163,74,44," + (0.08 + Math.random() * 0.12) + ")";
    g.fillRect(0, y, 128, 2);
    y += h;
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const DIRT_GROUND = dirtTexture(42, 42);
const DIRT_TRACK = dirtTexture(1, 1, "#8A5040");
const DIRT_BUMP = dirtBump(36, 36);
const TRACK_BUMP = dirtBump(4, 1);
const STRATA = strataTexture();

function dirtNormal() {
  const s = 256;
  const h = new Float32Array(s * s);
  function n2(x, y) {
    const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return v - Math.floor(v);
  }
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      let amp = 1, freq = 1, tot = 0, w = 0;
      for (let o = 0; o < 5; o++) {
        tot += amp * n2((x / s) * 8 * freq, (y / s) * 8 * freq);
        w += amp;
        amp *= 0.5;
        freq *= 2.05;
      }
      h[y * s + x] = tot / w;
    }
  }
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  const img = g.createImageData(s, s);
  const d = img.data;
  const str = 2.4;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const xm = (x + s - 1) % s, xp = (x + 1) % s;
      const ym = (y + s - 1) % s, yp = (y + 1) % s;
      const dx = (h[y * s + xp] - h[y * s + xm]) * str;
      const dy = (h[yp * s + x] - h[ym * s + x]) * str;
      const i = (y * s + x) * 4;
      d[i] = Math.max(0, Math.min(255, 128 - dx * 255));
      d[i + 1] = Math.max(0, Math.min(255, 128 - dy * 255));
      d[i + 2] = 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
const DIRT_NORMAL = dirtNormal();

function applyTriplanar(mat, scale) {
  if (!mat || !mat.map) return mat;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTripScale = { value: scale };
    shader.vertexShader = "varying vec3 vTripP;\nvarying vec3 vTripN;\n" + shader.vertexShader.replace(
      "#include <fog_vertex>",
      "#include <fog_vertex>\nvTripP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTripN = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);"
    );
    shader.fragmentShader = "varying vec3 vTripP;\nvarying vec3 vTripN;\nuniform float uTripScale;\n" + shader.fragmentShader.replace(
      "#include <map_fragment>",
      [
        "#ifdef USE_MAP",
        "vec3 tN = abs(normalize(vTripN));",
        "tN = pow(tN, vec3(3.4));",
        "tN /= (tN.x + tN.y + tN.z + 1e-5);",
        "vec4 sampledDiffuseColor = texture2D(map, vTripP.yz * uTripScale) * tN.x + texture2D(map, vTripP.xz * uTripScale) * tN.y + texture2D(map, vTripP.xy * uTripScale) * tN.z;",
        "diffuseColor *= sampledDiffuseColor;",
        "#endif"
      ].join("\n")
    );
  };
  mat.customProgramCacheKey = function () { return "trip" + scale; };
  mat.needsUpdate = true;
  return mat;
}

function rockMat(hex, rough, map) {
  const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0.04, map: map || null });
  if (map) m.map = map;
  return m;
}
const steelBody = new THREE.MeshStandardMaterial({
  color: 0x6E7378, metalness: 0.94, roughness: 0.34, envMapIntensity: 1.08,
  vertexColors: true, fog: true, flatShading: false
});
const steelStl = new THREE.MeshStandardMaterial({
  color: 0x6E7378, metalness: 0.18, roughness: 0.46, envMapIntensity: 0.35,
  vertexColors: true, fog: false,
  emissive: 0x6E7378, emissiveIntensity: 0.52
});
// MASTER-PRINT optional skins. Cycle steelStl/steelBody only. Starship stays STEEL.
const LIVERIES = [
  { name: "RAW STEEL", color: 0x6E7378, metalness: 0.18, roughness: 0.46, env: 0.35 },
  { name: "SPACEX BLACK", color: 0x161618, metalness: 0.58, roughness: 0.48, env: 0.70 },
  { name: "CBM ATHLETICS", color: 0x453A22, metalness: 0.91, roughness: 0.28, env: 1.22 },
  { name: "MARS COLONY WORKS", color: 0x8C7360, metalness: 0.68, roughness: 0.54, env: 0.82 }
];
let liveryIdx = 0;
const steelPlain = new THREE.MeshStandardMaterial({
  color: STEEL, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.15, fog: false
});
const steelRocket = new THREE.MeshStandardMaterial({
  color: STEEL, metalness: 0.9, roughness: 0.32, envMapIntensity: 1.35, side: THREE.DoubleSide, fog: false
});
const steelRocketDark = new THREE.MeshStandardMaterial({
  color: 0x3a342e, metalness: 0.72, roughness: 0.55, envMapIntensity: 0.7, side: THREE.DoubleSide, fog: false
});
const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.95, metalness: 0.05, fog: false, emissive: 0x050505, emissiveIntensity: 0.4 });
const treadMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9, metalness: 0.08, fog: false });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x14181c, metalness: 0.88, roughness: 0.06, transparent: true, opacity: 0.86, envMapIntensity: 1.2, fog: false, emissive: 0x0a1014, emissiveIntensity: 0.3 });
const blackBar = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.4, roughness: 0.55, fog: false });
const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false });
const tailMat = new THREE.MeshBasicMaterial({ color: TAIL, toneMapped: false });
const bannerMat = new THREE.MeshStandardMaterial({ color: BANNER, roughness: 0.38, metalness: 0.12, emissive: 0x886600, emissiveIntensity: 0.62 });
const trussMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.4 });
const frostMat = new THREE.MeshStandardMaterial({ color: 0xe6e1d8, roughness: 0.8, metalness: 0.04, emissive: 0x2a2820, emissiveIntensity: 0.22, fog: false });

const PAD_ROCKET_X = -36;
const PAD_ROCKET_Y = 6;
const PAD_ROCKET_Z = 256;

// One road: compact racetrack. Outbound +Z from origin (Starship stays
// world −X / screen-right). Return ~70 m to +X, not a second highway.
const pathPts = [
  [0, 0], [6, 100], [10, 220], [12, 360], [14, 520], [16, 660],
  [32, 730], [58, 755], [84, 735], [96, 660],
  [94, 520], [90, 360], [84, 210], [70, 80], [32, 10], [4, -2]
].map(([x, z]) => new THREE.Vector3(x, 0, z));
const curve = new THREE.CatmullRomCurve3(pathPts, true, "catmullrom", 0.18);
const trackLen = curve.getLength();
const RIBBON_UV = Math.max(40, trackLen / 22);

const pathBox = (function () {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i <= 500; i++) {
    const p = curve.getPointAt(i / 500);
    if (p.x < minX) minX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.z > maxZ) maxZ = p.z;
  }
  const pad = 56;
  return {
    minX, minZ, maxX, maxZ,
    originX: minX - pad,
    originZ: minZ - pad,
    size: Math.max(maxX - minX, maxZ - minZ) + pad * 2
  };
})();

function nearPad(x, z, r) {
  const dx = x - PAD_ROCKET_X, dz = z - PAD_ROCKET_Z;
  return dx * dx + dz * dz < r * r;
}

// Screen-right from idle +Z chase is world −X. Keep that landmass down.
function rocketWindowSide(p, side) {
  if (side >= 0) return false;
  if (nearPad(p.x, p.z, 120)) return true;
  if (p.z > 70 && p.x < 42) return true;
  return false;
}

function inDesert(x, z) { return z > 80 && z < 640 && x < 40; }
function inWhoops(x, z) { return false; }
function inPinch(x, z) { return z > 700; }
function inSilt(x, z) { return false; }
function inCamber(x, z) { return false; }

function surfacePack(x, z) {
  if (inSilt(x, z)) return 0.88;
  if (inWhoops(x, z)) return 0.96;
  if (inPinch(x, z)) return 0.94;
  if (inDesert(x, z)) return 1.12;
  if (inCamber(x, z)) return 0.98;
  return 1.05;
}

const RIBBON_NOTCH_W = HALF_W + 2.4;
const ribbonMask = (function makeRibbonMask() {
  const W = 512;
  const originX = pathBox.originX, originZ = pathBox.originZ, size = pathBox.size;
  const c = document.createElement("canvas");
  c.width = c.height = W;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, W);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2, RIBBON_NOTCH_W * 2 / size * W);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i <= 400; i++) {
    const pt = curve.getPointAt(i / 400);
    const u = (pt.x - originX) / size * W;
    const v = (pt.z - originZ) / size * W;
    if (i === 0) ctx.moveTo(u, v);
    else ctx.lineTo(u, v);
  }
  ctx.closePath();
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return { tex, originX, originZ, size };
})();

function ribbonNotch(mat) {
  if (!mat) return mat;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRibbon = { value: ribbonMask.tex };
    shader.uniforms.uRibbonBox = { value: new THREE.Vector3(ribbonMask.originX, ribbonMask.originZ, ribbonMask.size) };
    shader.vertexShader = "varying vec3 vRibbonW;\n" + shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\nvRibbonW = (modelMatrix * vec4(transformed, 1.0)).xyz;"
    );
    shader.fragmentShader = "varying vec3 vRibbonW;\nuniform sampler2D uRibbon;\nuniform vec3 uRibbonBox;\n" + shader.fragmentShader.replace(
      "#include <clipping_planes_fragment>",
      "#include <clipping_planes_fragment>\nvec2 ruv = (vRibbonW.xz - uRibbonBox.xy) / uRibbonBox.z;\nif (ruv.x > 0.0 && ruv.x < 1.0 && ruv.y > 0.0 && ruv.y < 1.0 && texture(uRibbon, ruv).r > 0.42) discard;"
    );
  };
  mat.customProgramCacheKey = function () { return "rdbNotch"; };
  return mat;
}

const ribbonDepthMat = ribbonNotch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));

function minDistToPath(x, z) {
  let best = 1e9;
  const n = 320;
  for (let i = 0; i <= n; i++) {
    const pt = curve.getPointAt(i / n);
    const d = (pt.x - x) * (pt.x - x) + (pt.z - z) * (pt.z - z);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

function terrainH(x, z) {
  const wash = Math.sin(x * 0.028) * Math.cos(z * 0.024) * 0.55;
  const whoop = Math.sin(x * 0.16 + z * 0.12) * 0.16;
  const chatter = Math.sin(x * 0.47 - z * 0.31) * 0.05;
  return wash + whoop + chatter;
}

function trackHalfW(t) {
  const u = ((t % 1) + 1) % 1;
  const p = curve.getPointAt(u);
  if (inPinch(p.x, p.z)) return 7.6;
  if (inWhoops(p.x, p.z)) return 11.2;
  if (inSilt(p.x, p.z)) return 10.4;
  if (inDesert(p.x, p.z)) return 17.2;
  if (u > 0.06 && u < 0.14) {
    const k = Math.sin(((u - 0.06) / 0.08) * Math.PI);
    return 13 - 3.4 * k;
  }
  return 13;
}

function placeOnTrack(t) {
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t);
  p.y = terrainH(p.x, p.z);
  return { p, tan };
}

function projectTrack(pos) {
  let bestT = 0, bestD = 1e9, bestP = null, bestTan = null;
  const n = 220;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const d = (p.x - pos.x) * (p.x - pos.x) + (p.z - pos.z) * (p.z - pos.z);
    if (d < bestD) { bestD = d; bestT = t; bestP = p; }
  }
  const refine = 12, span = 1 / n;
  for (let i = -refine; i <= refine; i++) {
    const t = (bestT + (i / refine) * span + 1) % 1;
    const p = curve.getPointAt(t);
    const d = (p.x - pos.x) * (p.x - pos.x) + (p.z - pos.z) * (p.z - pos.z);
    if (d < bestD) { bestD = d; bestT = t; bestP = p; }
  }
  bestTan = curve.getTangentAt(bestT);
  const right = new THREE.Vector3(bestTan.z, 0, -bestTan.x).normalize();
  const relx = pos.x - bestP.x;
  const relz = pos.z - bestP.z;
  const offset = relx * right.x + relz * right.z;
  return { t: bestT, p: bestP, tan: bestTan, right, offset };
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(Math.max(1800, pathBox.size + 400), Math.max(1800, pathBox.size + 400), 200, 200),
  applyTriplanar(new THREE.MeshStandardMaterial({
    map: DIRT_GROUND, bumpMap: DIRT_BUMP, bumpScale: 0.72,
    normalMap: DIRT_NORMAL, normalScale: new THREE.Vector2(0.72, 0.72),
    color: 0xA6583D, roughness: 0.96, metalness: 0.02, dithering: true
  }), 0.028)
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
const gpos = ground.geometry.attributes.position;
const gcol = new Float32Array(gpos.count * 3);
for (let i = 0; i < gpos.count; i++) {
  const x = gpos.getX(i), y = gpos.getY(i);
  gpos.setZ(i, terrainH(x, y));
  const shade = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(x * 0.021) * Math.cos(y * 0.017));
  gcol[i * 3] = shade;
  gcol[i * 3 + 1] = shade * 0.93;
  gcol[i * 3 + 2] = shade * 0.86;
}
ground.geometry.setAttribute("color", new THREE.Float32BufferAttribute(gcol, 3));
ground.material.vertexColors = true;
ground.geometry.computeVertexNormals();
scene.add(ground);

const ribbonN = 360;
const ribbonPos = [];
const ribbonUv = [];
const ribbonIdx = [];
for (let i = 0; i <= ribbonN; i++) {
  const t = i / ribbonN;
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t);
  const r = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const h = terrainH(p.x, p.z) + RIBBON_LIFT;
  const hwR = trackHalfW(t) - 0.4;
  const a = new THREE.Vector3(p.x - r.x * hwR, h, p.z - r.z * hwR);
  const b = new THREE.Vector3(p.x + r.x * hwR, h, p.z + r.z * hwR);
  ribbonPos.push(a.x, a.y, a.z, b.x, b.y, b.z);
  ribbonUv.push(t * RIBBON_UV, 0, t * RIBBON_UV, 1);
}
for (let i = 0; i < ribbonN; i++) {
  const i0 = i * 2, i1 = i0 + 1, i2 = i0 + 2, i3 = i0 + 3;
  ribbonIdx.push(i0, i2, i1, i1, i2, i3);
}
const ribbonGeo = new THREE.BufferGeometry();
ribbonGeo.setAttribute("position", new THREE.Float32BufferAttribute(ribbonPos, 3));
ribbonGeo.setAttribute("uv", new THREE.Float32BufferAttribute(ribbonUv, 2));
ribbonGeo.setIndex(ribbonIdx);
ribbonGeo.computeVertexNormals();
const ribbon = new THREE.Mesh(ribbonGeo, new THREE.MeshStandardMaterial({
  map: DIRT_TRACK, bumpMap: TRACK_BUMP, bumpScale: 0.48,
  normalMap: DIRT_NORMAL, normalScale: new THREE.Vector2(0.45, 0.45),
  color: RIBBON_PACK, roughness: 0.98, metalness: 0.02,
  polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2
}));
ribbon.renderOrder = -1;
ribbon.receiveShadow = true;
scene.add(ribbon);

const packInnerMat = new THREE.MeshStandardMaterial({
  map: DIRT_TRACK, color: 0x5A301C, roughness: 0.99, metalness: 0.02,
  polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
});
(function makeInnerPack() {
  const n = 360;
  const pos = [];
  const idx = [];
  const uv = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const r = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const h = terrainH(pt.x, pt.z) + RIBBON_LIFT + 0.012;
    const hw = Math.max(4.2, trackHalfW(t) - 3.6);
    pos.push(pt.x - r.x * hw, h, pt.z - r.z * hw, pt.x + r.x * hw, h, pt.z + r.z * hw);
    uv.push(t * RIBBON_UV, 0.18, t * RIBBON_UV, 0.82);
  }
  for (let i = 0; i < n; i++) {
    const i0 = i * 2, i1 = i0 + 1, i2 = i0 + 2, i3 = i0 + 3;
    idx.push(i0, i2, i1, i1, i2, i3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, packInnerMat);
  mesh.renderOrder = 0;
  mesh.receiveShadow = true;
  scene.add(mesh);
})();

function pathStripGeo(n, offA, offB, yA, yB) {
  const pos = [];
  const idx = [];
  const uv = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const r = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const scale = trackHalfW(t) / HALF_W;
    const oa = offA * scale, ob = offB * scale;
    const x0 = p.x + r.x * oa, z0 = p.z + r.z * oa;
    const x1 = p.x + r.x * ob, z1 = p.z + r.z * ob;
    pos.push(x0, terrainH(x0, z0) + yA, z0, x1, terrainH(x1, z1) + yB, z1);
    uv.push(t * (RIBBON_UV * 1.25), 0, t * (RIBBON_UV * 1.25), 1);
  }
  for (let i = 0; i < n; i++) {
    const i0 = i * 2, i1 = i0 + 1, i2 = i0 + 2, i3 = i0 + 3;
    idx.push(i0, i2, i1, i1, i2, i3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function addPathStrip(n, offA, offB, yA, yB, mat, receive) {
  const mesh = new THREE.Mesh(pathStripGeo(n, offA, offB, yA, yB), mat);
  mesh.receiveShadow = !!receive;
  scene.add(mesh);
  return mesh;
}

// Unlit gold both lips. MeshStandard + sun 3.2 / exposure 1.34 bleached the
// cam-left (world +X) strip to cream; MeshBasic + fog:false cannot.
const edgeLineMat = new THREE.MeshBasicMaterial({
  color: EDGE_GOLD,
  fog: false,
  polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6
});
const edgeGoldMat = new THREE.MeshBasicMaterial({
  color: EDGE_GOLD_HOT,
  fog: false,
  polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8
});
// Main #C9A227 / lip #E8B923. Same mats both sides.
addPathStrip(360, -(HALF_W - 0.16), -(HALF_W - 0.64), 0.11, 0.11, edgeLineMat, false);
addPathStrip(360, (HALF_W - 0.64), (HALF_W - 0.16), 0.11, 0.11, edgeLineMat, false);
addPathStrip(360, -(HALF_W - 0.02), -(HALF_W - 0.16), 0.14, 0.11, edgeGoldMat, false);
addPathStrip(360, (HALF_W - 0.16), (HALF_W - 0.02), 0.11, 0.14, edgeGoldMat, false);

(function makeStartLine() {
  const { p, tan } = placeOnTrack(START_T);
  const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const fwd = new THREE.Vector3(tan.x, 0, tan.z).normalize();
  const hw = trackHalfW(START_T) - 0.5;
  const mat = new THREE.MeshStandardMaterial({
    color: EDGE_LINE, roughness: 0.42, metalness: 0.1,
    emissive: 0x4a4020, emissiveIntensity: 0.3,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3
  });
  function barGeo(a0, a1) {
    const n = 14;
    const pos = [], idx = [], uv = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const lat = -hw + 2 * hw * u;
      for (let k = 0; k < 2; k++) {
        const along = k === 0 ? a0 : a1;
        const x = p.x + right.x * lat + fwd.x * along;
        const z = p.z + right.z * lat + fwd.z * along;
        pos.push(x, terrainH(x, z) + RIBBON_LIFT + 0.028, z);
        uv.push(u, k);
      }
    }
    for (let i = 0; i < n; i++) {
      const i0 = i * 2, i1 = i0 + 1, i2 = i0 + 2, i3 = i0 + 3;
      idx.push(i0, i2, i1, i1, i2, i3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }
  const a = new THREE.Mesh(barGeo(-0.18, 0.22), mat);
  a.receiveShadow = true;
  scene.add(a);
  const b = new THREE.Mesh(barGeo(0.64, 1.04), mat);
  b.receiveShadow = true;
  scene.add(b);
})();

function bermMesh(side) {
  const n = 320;
  const pos = [];
  const idx = [];
  const uv = [];
  const rows = 3;
  const ys = [RIBBON_LIFT + 0.02, 0.62, 0.10];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const r = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const hw = trackHalfW(t);
    const offs = [hw - 0.55, hw + 0.12, hw + 1.2];
    for (let k = 0; k < rows; k++) {
      const o = offs[k] * side;
      const x = p.x + r.x * o;
      const z = p.z + r.z * o;
      pos.push(x, terrainH(x, z) + ys[k], z);
      uv.push(t * (RIBBON_UV * 0.85), k / (rows - 1));
    }
  }
  for (let i = 0; i < n; i++) {
    const a = i * rows, b = a + rows;
    for (let k = 0; k < rows - 1; k++) {
      if (side > 0) idx.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1);
      else idx.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, applyTriplanar(new THREE.MeshStandardMaterial({
    color: side > 0 ? 0x6A3224 : 0x7A3A28, roughness: 0.92, metalness: 0.03, map: DIRT_GROUND,
    normalMap: DIRT_NORMAL, normalScale: new THREE.Vector2(0.6, 0.6), dithering: true
  }), 0.04));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}
bermMesh(1);
bermMesh(-1);

const tickGeo = new THREE.BoxGeometry(0.18, 0.035, 1.15);
const tickMat = new THREE.MeshStandardMaterial({
  color: 0xE8D9A8, roughness: 0.5, metalness: 0.08,
  emissive: 0x3a3318, emissiveIntensity: 0.28
});
const nTicks = Math.max(18, Math.floor(trackLen / 26));
for (let i = 0; i < nTicks; i++) {
  const t = (i + 0.5) / nTicks;
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t);
  const m = new THREE.Mesh(tickGeo, tickMat);
  m.position.set(p.x, terrainH(p.x, p.z) + RIBBON_LIFT + 0.03, p.z);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(tan.x, 0, tan.z).normalize());
  m.receiveShadow = true;
  scene.add(m);
}

function wallStrip(side) {
  const pos = [];
  const idx = [];
  const uv = [];
  const col = [];
  const n = 320;
  // Vertex tints: rock-shadow / rock-lit / rock-shadow / rock-lit / slope
  const bands = [
    [0.48, 0.26, 0.20],
    [0.95, 0.56, 0.36],
    [0.42, 0.22, 0.16],
    [0.82, 0.46, 0.30],
    [0.58, 0.32, 0.24]
  ];
  function pushCol(bi) {
    const c = bands[bi];
    col.push(c[0], c[1], c[2]);
  }
  function xzAt(p, r, radial) {
    return [p.x + r.x * side * radial, p.z + r.z * side * radial];
  }
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const r = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    let h = 10 + Math.abs(Math.sin(t * 18.0)) * 14 + (side > 0 ? 4 : 0);
    const startWin = p.z > -20 && p.z < 130 && p.x < 80;
    const rocketWin = rocketWindowSide(p, side);
    // Idle chase looks +Z: world +X is screen-left. Notch the SCREEN-right wall
    // (side < 0) so padRocket can silhouette; keep LOOK-DIFF notch on side > 0.
    if (startWin && side > 0) h = 8 + Math.abs(Math.sin(t * 18.0)) * 4;
    if (inDesert(p.x, p.z)) h = Math.min(h, 6);
    if (inSilt(p.x, p.z)) h = Math.min(h, 8);
    if (inWhoops(p.x, p.z) || inPinch(p.x, p.z)) h = Math.max(h, 18);
    // Screen-right wall is side<0 from idle chase. Drop landmass in the rocket window.
    if (rocketWin) h = 0.05;
    let base = trackHalfW(t) + 1.2;
    if (rocketWin) base = HALF_W + 62;
    const [px, pz] = xzAt(p, r, base);
    if (nearPad(px, pz, 90)) {
      h = 0.05;
      base = HALF_W + 62;
    }
    const h1 = h * 0.33;
    const h2 = h * 0.64;
    const [x0, z0] = xzAt(p, r, base);
    const [x1, z1] = xzAt(p, r, base + 0.22);
    const [x2, z2] = xzAt(p, r, base - 0.10);
    const [x3, z3] = xzAt(p, r, base);
    const back = h < 0.35 ? 5 : 34;
    const [xo, zo] = xzAt(p, r, base + back * 0.52);
    const [xb, zb] = xzAt(p, r, base + back);
    const y0 = terrainH(x0, z0);
    const yb = terrainH(xb, zb);
    pos.push(
      x0, y0, z0,
      x1, y0 + h1, z1,
      x2, y0 + h2, z2,
      x3, y0 + h, z3,
      xo, y0 + h * 0.84, zo,
      xb, yb, zb
    );
    const u = t * 10;
    const vScale = 0.085;
    uv.push(
      u, y0 * vScale,
      u, (y0 + h1) * vScale,
      u, (y0 + h2) * vScale,
      u, (y0 + h) * vScale,
      u + 0.18, (y0 + h * 0.84) * vScale,
      u + 0.32, yb * vScale
    );
    pushCol(0); pushCol(1); pushCol(2); pushCol(3); pushCol(4); pushCol(2);
  }
  for (let i = 0; i < n; i++) {
    const o = i * 6;
    const q = o + 6;
    for (let k = 0; k < 5; k++) {
      idx.push(o + k, o + k + 1, q + k + 1, o + k, q + k + 1, q + k);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const tex = STRATA.clone();
  tex.repeat.set(1, 1);
  tex.needsUpdate = true;
  // v13 side<0 0xF0D4BC bleached to a cream cliff in the idle rocket window.
  const tint = side > 0 ? 0xE0B8A0 : 0xC47858;
  const mesh = new THREE.Mesh(geo, applyTriplanar(new THREE.MeshStandardMaterial({
    color: tint, map: tex, roughness: 0.88, metalness: 0.04, vertexColors: true,
    side: THREE.DoubleSide, dithering: true,
    normalMap: DIRT_NORMAL, normalScale: new THREE.Vector2(0.85, 0.85)
  }), 0.045));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}
wallStrip(1);
wallStrip(-1);

(function scatterGrit() {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mats = [
    new THREE.MeshStandardMaterial({ color: 0x6A3224, roughness: 0.96, metalness: 0.02, map: DIRT_GROUND, vertexColors: true }),
    new THREE.MeshStandardMaterial({ color: 0x4A251D, roughness: 0.97, metalness: 0.02, map: DIRT_GROUND }),
    new THREE.MeshStandardMaterial({ color: 0x8B3A2B, roughness: 0.94, metalness: 0.03, map: DIRT_GROUND })
  ];
  const N = 1100;
  const dummyG = new THREE.Object3D();
  const mesh = new THREE.InstancedMesh(geo, mats[0], N);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  let placed = 0;
  for (let k = 0; k < 4800 && placed < N; k++) {
    const t = Math.random();
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const r = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const side = Math.random() < 0.5 ? 1 : -1;
    if (rocketWindowSide(p, side)) continue;
    const dist = HALF_W + 2.2 + Math.random() * 34;
    const x = p.x + r.x * side * dist;
    const z = p.z + r.z * side * dist;
    if (minDistToPath(x, z) < HALF_W + 1.15) continue;
    dummyG.position.set(x, terrainH(x, z) - 0.04, z);
    dummyG.rotation.set(Math.random() * 6.2, Math.random() * 6.2, Math.random() * 6.2);
    const s = 0.16 + Math.random() * 0.62;
    dummyG.scale.set(s * (0.65 + Math.random() * 0.7), s * (0.32 + Math.random() * 0.5), s * (0.65 + Math.random() * 0.7));
    dummyG.updateMatrix();
    mesh.setMatrixAt(placed, dummyG.matrix);
    mesh.setColorAt(placed, new THREE.Color(mats[placed % mats.length].color));
    placed++;
  }
  mesh.count = placed;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
})();

(function dressCourse() {
  const dummyG = new THREE.Object3D();
  const barrelGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.95, 8);
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x6B3A22, metalness: 0.45, roughness: 0.52, envMapIntensity: 0.55
  });
  const barrels = new THREE.InstancedMesh(barrelGeo, barrelMat, 70);
  barrels.castShadow = true;
  barrels.receiveShadow = true;
  let bn = 0;
  for (let k = 0; k < 220 && bn < 70; k++) {
    const t = (k * 0.041 + 0.08) % 1;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const r = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const side = (k & 1) ? 1 : -1;
    if (rocketWindowSide(p, side)) continue;
    const dist = trackHalfW(t) + 2.6 + (k % 3) * 0.7;
    const x = p.x + r.x * side * dist;
    const z = p.z + r.z * side * dist;
    dummyG.position.set(x, terrainH(x, z) + 0.48, z);
    dummyG.rotation.set(0.04 * (k % 3), k * 0.7, 0.05);
    dummyG.scale.setScalar(1);
    dummyG.updateMatrix();
    barrels.setMatrixAt(bn++, dummyG.matrix);
  }
  barrels.count = bn;
  scene.add(barrels);

  const crateGeo = new THREE.BoxGeometry(1.1, 0.85, 1.4);
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x5A4A38, metalness: 0.2, roughness: 0.78
  });
  const crates = new THREE.InstancedMesh(crateGeo, crateMat, 28);
  crates.castShadow = true;
  crates.receiveShadow = true;
  let cn = 0;
  for (let k = 0; k < 40 && cn < 28; k++) {
    const t = (k * 0.077 + 0.19) % 1;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const r = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const side = (k % 3) === 0 ? -1 : 1;
    if (rocketWindowSide(p, side)) continue;
    const dist = trackHalfW(t) + 4.4;
    const x = p.x + r.x * side * dist;
    const z = p.z + r.z * side * dist;
    dummyG.position.set(x, terrainH(x, z) + 0.42, z);
    dummyG.rotation.set(0, k * 0.9, 0);
    dummyG.scale.setScalar(0.85 + (k % 3) * 0.12);
    dummyG.updateMatrix();
    crates.setMatrixAt(cn++, dummyG.matrix);
  }
  crates.count = cn;
  scene.add(crates);
})();

function addMesa(x, z, w, h, d, rotY) {
  const g = new THREE.Group();
  const cols = [ROCK_SHADOW, ROCK_MID, ROCK_LIT, DUST_DARK, ROCK_MID];
  let acc = 0;
  const layers = 4;
  for (let i = 0; i < layers; i++) {
    const lh = h * (i === layers - 1 ? 0.22 : 0.26);
    const shrink = 1 - i * 0.045;
    const mat = applyTriplanar(rockMat(cols[i % cols.length], 0.9, STRATA), 0.06);
    const box = new THREE.Mesh(new THREE.BoxGeometry(w * shrink, lh, d * shrink), mat);
    box.position.y = acc + lh * 0.5;
    box.castShadow = true;
    box.receiveShadow = true;
    g.add(box);
    acc += lh;
  }
  g.position.set(x, terrainH(x, z) - 1.2, z);
  g.rotation.y = rotY;
  scene.add(g);
}

for (let i = 0; i < 64; i++) {
  const t = (i + 0.35) / 64;
  const { p, tan } = placeOnTrack(t);
  const r = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const side = i % 2 === 0 ? 1 : -1;
  const mw = 18 + (i % 5) * 4;
  const md = 14 + (i % 3) * 5;
  const foot = Math.hypot(mw, md) * 0.45;
  let dist = HALF_W + 28 + (i % 4) * 6;
  let x = p.x + r.x * side * dist;
  let z = p.z + r.z * side * dist;
  for (let tries = 0; tries < 10; tries++) {
    if (minDistToPath(x, z) - foot > HALF_W + 8) break;
    dist += 6;
    x = p.x + r.x * side * dist;
    z = p.z + r.z * side * dist;
  }
  let mh = 16 + (i % 4) * 6;
  if (nearPad(p.x, p.z, 140) || (p.z > 70 && p.x < 50)) mh = Math.min(mh, 10);
  if (rocketWindowSide(p, side)) continue;
  addMesa(x, z, mw, mh, md, Math.atan2(tan.x, tan.z) + 0.2 * side);
}
for (let i = 0; i < 18; i++) {
  const t = (i + 0.2) / 18;
  const { p, tan } = placeOnTrack(t);
  const r = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const side = i % 2 === 0 ? 1 : -1;
  if (rocketWindowSide(p, side)) continue;
  const dist = HALF_W + 48 + (i % 5) * 8;
  const x = p.x + r.x * side * dist;
  const z = p.z + r.z * side * dist;
  if (nearPad(x, z, 150)) continue;
  if (minDistToPath(x, z) < HALF_W + 22) continue;
  addMesa(x, z, 22 + (i % 4) * 4, 14 + (i % 3) * 5, 16 + (i % 3) * 4, i * 0.4);
}

const rockStlMats = [
  applyTriplanar(new THREE.MeshStandardMaterial({ color: DUST, roughness: 0.92, metalness: 0.04, side: THREE.DoubleSide, dithering: true, map: STRATA, normalMap: DIRT_NORMAL, normalScale: new THREE.Vector2(0.7, 0.7) }), 0.05),
  applyTriplanar(new THREE.MeshStandardMaterial({ color: DUST_DARK, roughness: 0.9, metalness: 0.04, side: THREE.DoubleSide, dithering: true, map: STRATA, normalMap: DIRT_NORMAL, normalScale: new THREE.Vector2(0.7, 0.7) }), 0.05),
  applyTriplanar(new THREE.MeshStandardMaterial({ color: ROCK_MID, roughness: 0.94, metalness: 0.03, side: THREE.DoubleSide, dithering: true, map: STRATA, normalMap: DIRT_NORMAL, normalScale: new THREE.Vector2(0.7, 0.7) }), 0.05),
  applyTriplanar(new THREE.MeshStandardMaterial({ color: ROCK_SHADOW, roughness: 0.95, metalness: 0.03, side: THREE.DoubleSide, dithering: true, map: STRATA, normalMap: DIRT_NORMAL, normalScale: new THREE.Vector2(0.7, 0.7) }), 0.05)
];
const rockStlUrls = ["./mesh/rock-a.stl", "./mesh/rock-b.stl", "./mesh/rock-c.stl", "./mesh/rock-d.stl"];
const rockLoader = new STLLoader();
const ROCK_PER = 8;
rockStlUrls.forEach((url, vi) => {
  rockLoader.load(url, (geo) => {
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    const bb0 = geo.boundingBox;
    geo.translate(
      -(bb0.min.x + bb0.max.x) * 0.5,
      -(bb0.min.y + bb0.max.y) * 0.5,
      -bb0.min.z
    );
    geo.rotateX(-Math.PI / 2);
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const h = bb.max.y - bb.min.y;
    const span = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
    for (let k = 0; k < ROCK_PER; k++) {
      const i = vi * ROCK_PER + k;
      const t = (i * 0.058 + 0.11) % 1;
      const { p, tan } = placeOnTrack(t);
      const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
      const side = (i & 1) === 0 ? 1 : -1;
      if (rocketWindowSide(p, side)) continue;
      let dist = HALF_W + 6.2 + (k * 1.5) + (vi % 2) * 0.8;
      let x = p.x + right.x * side * dist;
      let z = p.z + right.z * side * dist;
      let s;
      if (h / span > 0.45) s = (4.6 + (k % 3) * 0.85) / h;
      else s = (2.15 + (k % 3) * 0.4) / h;
      let foot = span * s;
      if (foot > 9.2) s *= 9.2 / foot;
      if (foot < 4.4) s *= 4.4 / foot;
      foot = span * s;
      for (let tries = 0; tries < 8; tries++) {
        x = p.x + right.x * side * dist;
        z = p.z + right.z * side * dist;
        if (minDistToPath(x, z) - foot * 0.5 > HALF_W + 2) break;
        dist += 4;
      }
      const m = new THREE.Mesh(geo, rockStlMats[(vi + k) % rockStlMats.length]);
      m.scale.setScalar(s);
      m.position.set(x, terrainH(x, z) - bb.min.y * s - 0.18, z);
      m.rotation.y = i * 1.37 + vi * 0.4;
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }
  });
});

(function placeMountains() {
  const loader = new STLLoader();
  const spots = [
    { url: "./mesh/mountain-a.stl", x: 220, z: 200, s: 0.35, yaw: 0.5, color: 0x8B3A2B },
    { url: "./mesh/mountain-b.stl", x: 240, z: 620, s: 0.4, yaw: 1.1, color: 0x6A3224 },
    { url: "./mesh/mountain-c.stl", x: -140, z: 500, s: 0.32, yaw: -0.4, color: 0x4A251D }
  ];
  spots.forEach((sp) => {
    if (nearPad(sp.x, sp.z, 160)) return;
    loader.load(sp.url, (geo) => {
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      geo.translate(-(bb.min.x + bb.max.x) * 0.5, -(bb.min.y + bb.max.y) * 0.5, -bb.min.z);
      const hold = new THREE.Group();
      const mat = applyTriplanar(new THREE.MeshStandardMaterial({
        color: sp.color, map: STRATA, roughness: 0.95, metalness: 0.03,
        side: THREE.DoubleSide, dithering: true, normalMap: DIRT_NORMAL,
        normalScale: new THREE.Vector2(0.8, 0.8)
      }), 0.012);
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      hold.add(m);
      hold.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(hold);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 8);
      hold.scale.setScalar(THREE.MathUtils.clamp(48 / maxDim, 0.02, 0.4));
      hold.rotation.y = sp.yaw;
      if (minDistToPath(sp.x, sp.z) < HALF_W + 40) return;
      hold.position.set(sp.x, terrainH(sp.x, sp.z) - 3, sp.z);
      scene.add(hold);
    });
  });
})();

const olympus = new THREE.Group();
function olyMesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}
// One truncated shield (cratered) — horizon landmark, not a second needle.
// Parked behind padRocket in Z so the frost cap sits center sky without covering Starship mid-right.
const OLY_R = 58;
const OLY_H = 118;
const OLY_CRATER = 18;
const OLY_BURY = 22;
const olyStrata = STRATA.clone();
olyStrata.wrapS = olyStrata.wrapT = THREE.RepeatWrapping;
olyStrata.repeat.set(3, 2);
olyStrata.needsUpdate = true;
const olyRock = new THREE.MeshStandardMaterial({
  color: 0x8a4a34, map: olyStrata, roughness: 0.97, metalness: 0.02,
  flatShading: true, fog: false, emissive: 0x2a120c, emissiveIntensity: 0.18
});
const shield = olyMesh(
  new THREE.CylinderGeometry(OLY_CRATER, OLY_R, OLY_H, 40, 5, true),
  olyRock
);
shield.position.y = OLY_H * 0.5 - OLY_BURY;
olympus.add(shield);
const frostLit = new THREE.MeshStandardMaterial({
  color: 0xf3eee4, roughness: 0.7, metalness: 0.05,
  emissive: 0xd8d0c4, emissiveIntensity: 0.42, fog: false, flatShading: true
});
const frostH = 40;
const frostR = OLY_CRATER + (OLY_R - OLY_CRATER) * (frostH / OLY_H);
const frost = olyMesh(
  new THREE.CylinderGeometry(OLY_CRATER, frostR, frostH, 32, 1, true),
  frostLit
);
const olyPeakY = OLY_H - OLY_BURY;
frost.position.y = olyPeakY - frostH * 0.5;
olympus.add(frost);
const olyRim = olyMesh(
  new THREE.TorusGeometry(OLY_CRATER + 1.4, 3.6, 8, 24),
  frostLit
);
olyRim.rotation.x = Math.PI / 2;
olyRim.position.y = olyPeakY - 1.4;
olympus.add(olyRim);
const bowl = olyMesh(
  new THREE.CircleGeometry(OLY_CRATER, 20),
  new THREE.MeshStandardMaterial({
    color: 0xe8e0d4, roughness: 0.85, metalness: 0.03,
    emissive: 0xbbb4a8, emissiveIntensity: 0.28, fog: false, side: THREE.DoubleSide
  })
);
bowl.rotation.x = -Math.PI / 2;
bowl.position.y = olyPeakY - 2.6;
olympus.add(bowl);
olympus.position.set(280, 0, 420);
scene.add(olympus);

function padRocket() {
  const g = new THREE.Group();
  g.name = "padRocket";
  const stlRoot = new THREE.Group();
  stlRoot.name = "starshipStl";
  // STL is Z-up (long axis +Z, base at z=0). Map to +Y up via Rx = -π/2 only.
  // v14 Ry+90 at scale 2.2 made a megaphone; v15 dropped yaw; v16 is scale, not yaw.
  stlRoot.rotation.x = -Math.PI / 2;
  g.add(stlRoot);
  const loader = new STLLoader();
  function addStl(url, mat) {
    loader.load(url, (geo) => {
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      geo.translate(
        -(bb.min.x + bb.max.x) * 0.5,
        -(bb.min.y + bb.max.y) * 0.5,
        -bb.min.z
      );
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.renderOrder = 2;
      stlRoot.add(m);
    });
  }
  addStl("./mesh/obj_3_Ship.stl", steelRocket);
  addStl("./mesh/obj_2_Exhaust.stl", steelRocketDark);
  addStl("./mesh/obj_1_Smoke.stl", new THREE.MeshStandardMaterial({
    color: 0xC8B49A, roughness: 1, metalness: 0, transparent: true, opacity: 0.32,
    depthWrite: false, fog: false, side: THREE.DoubleSide, envMapIntensity: 0.2
  }));
  const flameOuter = new THREE.MeshBasicMaterial({
    color: 0xff7a28, transparent: true, opacity: 0.72, fog: false,
    toneMapped: false, side: THREE.DoubleSide, depthWrite: false
  });
  const flameInner = new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0.88, fog: false,
    toneMapped: false, side: THREE.DoubleSide, depthWrite: false
  });
  const exhaust = new THREE.Group();
  exhaust.name = "starshipExhaust";
  const outer = new THREE.Mesh(new THREE.ConeGeometry(5.2, 26, 12, 1, true), flameOuter);
  const inner = new THREE.Mesh(new THREE.ConeGeometry(2.1, 18, 8, 1, true), flameInner);
  outer.rotation.x = -Math.PI / 2;
  inner.rotation.x = -Math.PI / 2;
  outer.position.z = -13;
  inner.position.z = -9;
  exhaust.add(outer);
  exhaust.add(inner);
  exhaust.visible = false;
  exhaust.scale.set(0.001, 0.001, 0.001);
  stlRoot.add(exhaust);
  g.userData.stlRoot = stlRoot;
  g.userData.exhaust = exhaust;
  g.userData.flameOuter = flameOuter;
  g.userData.flameInner = flameInner;
  // Local r 2.0–2.4 × scale 0.45 ≈ world ~1 m. Was 4.4–5.2 × 2.2 (~10–11 m).
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(2.0, 2.4, 0.5, 16),
    new THREE.MeshStandardMaterial({ color: 0x3a332e, metalness: 0.4, roughness: 0.7 })
  );
  pad.position.y = 0.25;
  pad.receiveShadow = true;
  g.add(pad);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.7, 36, 0.7), trussMat);
  tower.position.set(7, 18, 0);
  g.add(tower);
  return g;
}
const rocket = padRocket();
rocket.position.set(PAD_ROCKET_X, PAD_ROCKET_Y, PAD_ROCKET_Z);
rocket.scale.setScalar(0.45);
rocket.userData.stlRotX = -Math.PI / 2;
rocket.userData.stlScale = 0.45;
scene.add(rocket);

function dish() {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(3.6, 16, 10, 0, Math.PI * 2, 0, 1.15),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.25, roughness: 0.35, side: THREE.DoubleSide })
  );
  bowl.rotation.x = 0.9;
  bowl.position.y = 4.6;
  g.add(bowl);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.24, 4.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6, roughness: 0.4 })
  );
  pole.position.y = 2.3;
  g.add(pole);
  return g;
}
[[-6, -2], [10, -4], [-2, 12], [14, 8]].forEach(([dx, dz], i) => {
  const d = dish();
  d.position.set(rocket.position.x + dx, rocket.position.y, rocket.position.z + dz);
  d.rotation.y = i * 0.7;
  scene.add(d);
});

function padInterceptor() {
  const g = new THREE.Group();
  g.name = "padInterceptor";
  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;
  g.add(root);
  const loader = new STLLoader();
  let loaded = 0;
  function addStl(url, mat) {
    loader.load(url, (geo) => {
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      root.add(m);
      loaded++;
      if (loaded >= 3) {
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const c = box.getCenter(new THREE.Vector3());
        root.position.x -= c.x;
        root.position.y -= box.min.y;
        root.position.z -= c.z;
      }
    });
  }
  addStl("./mesh/interceptor-body.stl", steelRocketDark);
  addStl("./mesh/interceptor-a.stl", steelRocket);
  addStl("./mesh/interceptor-b.stl", trussMat);
  const skid = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.8, 0.35, 14),
    new THREE.MeshStandardMaterial({ color: 0x3a332e, metalness: 0.4, roughness: 0.7 })
  );
  skid.position.y = 0.18;
  skid.receiveShadow = true;
  g.add(skid);
  return g;
}
const interceptor = padInterceptor();
interceptor.position.set(PAD_ROCKET_X + 26, terrainH(PAD_ROCKET_X + 26, PAD_ROCKET_Z - 8), PAD_ROCKET_Z - 8);
interceptor.rotation.z = Math.PI / 2;
interceptor.scale.setScalar(0.09);
scene.add(interceptor);
[[18, -14, 4.2], [21, 6, 3.4], [15, 12, 2.6]].forEach(([dx, dz, r], i) => {
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, r * 2.1, 14),
    new THREE.MeshStandardMaterial({
      color: i === 2 ? 0x8a7a68 : 0x5c5852, metalness: 0.72, roughness: 0.38, envMapIntensity: 0.9
    })
  );
  const x = PAD_ROCKET_X + dx, z = PAD_ROCKET_Z + dz;
  tank.position.set(x, terrainH(x, z) + r * 1.05, z);
  tank.castShadow = true;
  tank.receiveShadow = true;
  scene.add(tank);
});

(function padCrew() {
  const loader = new STLLoader();
  loader.load("./mesh/worker.stl", (geo) => {
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    geo.translate(-(bb.min.x + bb.max.x) * 0.5, -(bb.min.y + bb.max.y) * 0.5, -bb.min.z);
    const h = bb.max.z - bb.min.z;
    const s = 1.78 / Math.max(1, h);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6a645c, roughness: 0.72, metalness: 0.18, envMapIntensity: 0.4
    });
    const spots = [
      [PAD_ROCKET_X + 5.2, PAD_ROCKET_Z + 4.5, 0.4],
      [PAD_ROCKET_X + 8.5, PAD_ROCKET_Z - 3.2, -0.7],
      [PAD_ROCKET_X + 3.0, PAD_ROCKET_Z + 9.0, 1.8]
    ];
    spots.forEach(([x, z, yaw]) => {
      const hold = new THREE.Group();
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      hold.add(m);
      hold.scale.setScalar(s);
      hold.rotation.y = yaw;
      hold.position.set(x, terrainH(x, z), z);
      scene.add(hold);
    });
  });
})();

const skyGeo = new THREE.SphereGeometry(1400, 48, 32);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {},
  vertexShader: "varying vec3 w; void main(){ vec4 p = modelMatrix * vec4(position,1.0); w = p.xyz; gl_Position = projectionMatrix * viewMatrix * p; }",
  fragmentShader: [
    "varying vec3 w;",
    "void main(){",
    "  vec3 n = normalize(w);",
    "  float h = n.y;",
    "  vec3 zen = vec3(0.50,0.38,0.34);",
    "  vec3 hor = vec3(0.890,0.627,0.478);",
    "  vec3 bot = vec3(0.29,0.145,0.114);",
    "  vec3 col = h > 0.0 ? mix(hor, zen, pow(h, 0.62)) : mix(hor, bot, clamp(-h * 1.4, 0.0, 1.0));",
    "  vec3 sunDir = normalize(vec3(-0.58, 0.38, -0.42));",
    "  float sun = pow(max(0.0, dot(n, sunDir)), 72.0);",
    "  float halo = pow(max(0.0, dot(n, sunDir)), 6.0);",
    "  col += vec3(1.0, 0.78, 0.52) * sun * 1.35;",
    "  col += vec3(0.95, 0.52, 0.28) * halo * 0.28;",
    "  float dust = pow(clamp(1.0 - abs(h), 0.0, 1.0), 2.4);",
    "  col = mix(col, vec3(0.82, 0.52, 0.36), dust * 0.22);",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n")
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

const crescent = new THREE.Mesh(
  new THREE.SphereGeometry(10, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xdde6ee, fog: false })
);
crescent.position.set(-220, 160, -40);
scene.add(crescent);

const sunDisk = new THREE.Mesh(
  new THREE.SphereGeometry(22, 20, 16),
  new THREE.MeshBasicMaterial({ color: 0xFFC48A, fog: false, toneMapped: false })
);
sunDisk.position.set(-420, 195, -310);
scene.add(sunDisk);
const sunHalo = new THREE.Mesh(
  new THREE.SphereGeometry(48, 16, 12),
  new THREE.MeshBasicMaterial({
    color: 0xFF8A4A, fog: false, toneMapped: false, transparent: true, opacity: 0.18, depthWrite: false
  })
);
sunHalo.position.copy(sunDisk.position);
scene.add(sunHalo);

function wedgeHullGeo() {
  const rings = [
    { z:  2.90, y0: 0.70, y2: 0.92, hw: 0.16 },
    { z:  2.56, y0: 0.56, y2: 1.06, hw: 1.10 },
    { z:  1.72, y0: 0.56, y2: 1.24, hw: 1.14 },
    { z:  0.82, y0: 0.56, y2: 1.56, hw: 1.14 },
    { z:  0.06, y0: 0.56, y2: 2.10, hw: 1.14 },
    { z: -0.68, y0: 0.56, y2: 2.06, hw: 1.14 },
    { z: -1.76, y0: 0.56, y2: 1.74, hw: 1.14 },
    { z: -2.92, y0: 0.56, y2: 1.46, hw: 1.14 }
  ];
  const pos = [];
  const col = [];
  const idx = [];
  const stride = 7;
  const yLo = 0.56, yHi = 2.10, hBody = yHi - yLo, third = 1 / 3;
  const sr = 192 / 255, sg = 192 / 255, sb = 192 / 255;
  const dr = 139 / 255, dg = 69 / 255, db = 19 / 255;
  function vert(x, y, z) {
    pos.push(x, y, z);
    const ny = (y - yLo) / hBody;
    let film = ny < third ? 0.58 * (1 - ny / third) : 0;
    if (z < -1.2 && ny < third) film = 0.75 + 0.15 * (1 - ny / third);
    col.push(sr + (dr - sr) * film, sg + (dg - sg) * film, sb + (db - sb) * film);
  }
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    const y1 = r.y0 + (r.y2 - r.y0) * 0.34;
    vert(-r.hw, r.y0, r.z);
    vert(-r.hw, y1, r.z);
    vert(-r.hw, r.y2, r.z);
    vert(0, r.y2 + 0.035, r.z);
    vert(r.hw, r.y2, r.z);
    vert(r.hw, y1, r.z);
    vert(r.hw, r.y0, r.z);
  }
  function quad(a, b, c, d) {
    idx.push(a, b, c, a, c, d);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const a = i * stride, b = (i + 1) * stride;
    for (let k = 0; k < stride; k++) {
      const k2 = (k + 1) % stride;
      quad(a + k, a + k2, b + k2, b + k);
    }
  }
  const f = 0, n = (rings.length - 1) * stride;
  for (let k = 0; k < stride; k++) {
    const k2 = (k + 1) % stride;
    idx.push(f + 3, f + k2, f + k);
    idx.push(n + 3, n + k, n + k2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const hull = geo.toNonIndexed();
  hull.computeVertexNormals();
  return hull;
}

const BODY_STL_SCALE = 0.00971;
const BODY_SIT_Y = 1.04;
const GROUND_SIT = 0.10;

// Bake Z-up +X-nose → Y-up +Z-nose: (x,y,z) → (y,z,x).
// Do not use Euler XYZ Rx-90 Ry-90 — gimbal lock maps nose to +Y.
const STL_TO_YUP = new THREE.Matrix4().set(
  0, 1, 0, 0,
  0, 0, 1, 0,
  1, 0, 0, 0,
  0, 0, 0, 1
);

// LOOK-DIFF metal: vertex film multiplies material.color (liveries keep dirt).
// 0x8B4513 rust named; DUST 0xA6583D is the rooster. Roof film=0.
const STL_RUST = 0x8B4513;
function paintStlDustFilm(geo) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const ymin = bb.min.y, ymax = bb.max.y;
  const yspan = Math.max(1e-6, ymax - ymin);
  const zmed = (bb.min.z + bb.max.z) * 0.5;
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const rr = ((STL_RUST >> 16) & 255) / 255;
  const rg = ((STL_RUST >> 8) & 255) / 255;
  const rb = (STL_RUST & 255) / 255;
  const THIRD = 0.22;
  const REAR_H = 0.18;
  for (let i = 0; i < pos.count; i++) {
    const ny = (pos.getY(i) - ymin) / yspan;
    const z = pos.getZ(i);
    let film = 0;
    if (ny < THIRD) film = 0.62 * (1 - ny / THIRD);
    // Rear boost independent of THIRD so chase tailgate rusts, not just a sill.
    // Truck faces +Z after bake (body-front z 0..294, body-rear z -294..0).
    if (z < zmed && ny < REAR_H) film = Math.max(film, 0.58 + 0.32 * (1 - ny / REAR_H));
    col[i * 3] = 1 + (rr - 1) * film;
    col[i * 3 + 1] = 1 + (rg - 1) * film;
    col[i * 3 + 2] = 1 + (rb - 1) * film;
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
}

// Black bumper + wheel-arch cladding. Mesh space after STL_TO_YUP, unscaled.
function paintStlCladding(geo, name) {
  const pos = geo.attributes.position;
  let col = geo.attributes.color;
  if (!col) {
    geo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(pos.count * 3).fill(1), 3));
    col = geo.attributes.color;
  }
  const a = col.array;
  const k = 0.07;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let black = false;
    if (name === "body-front") {
      if (z > 248 && y < 22) black = true;
      if (Math.abs(x) > 100 && y > 5 && y < 65 && z > 100 && z < 240) black = true;
      // v44 Director: do not black the cab roof. Steel 0x6E7378 survives.
    } else if (name === "body-rear") {
      if (Math.abs(x) > 90 && y > 5 && y < 80 && z < -80 && z > -250) black = true;
      if (z < -265 && y < 18) black = true;
    }
    if (black) {
      a[i * 3] = k;
      a[i * 3 + 1] = k;
      a[i * 3 + 2] = k;
    }
  }
  col.needsUpdate = true;
}

function wedgeTruck() {
  const g = new THREE.Group();
  g.name = "wedgeTruck";
  function part(geo, mat, x, y, z, rx) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }
  const hideOnStl = [];
  const hull = part(wedgeHullGeo(), steelBody, 0, 0, 0);
  hull.renderOrder = 2;
  hideOnStl.push(hull);
  hideOnStl.push(part(new THREE.BoxGeometry(2.08, 0.04, 1.36), glassMat, 0, 1.70, 0.82, 0.46));
  hideOnStl.push(part(new THREE.BoxGeometry(0.04, 0.42, 1.05), glassMat, -1.12, 1.42, 0.18));
  hideOnStl.push(part(new THREE.BoxGeometry(0.04, 0.42, 1.05), glassMat, 1.12, 1.42, 0.18));
  hideOnStl.push(part(new THREE.BoxGeometry(2.26, 0.07, 0.055), tailMat, 0, 1.40, -2.945));
  const roofBar = part(new THREE.BoxGeometry(1.78, 0.09, 0.22), blackBar, 0, 2.16, 0.10);
  const lamps = [];
  for (let i = 0; i < 5; i++) {
    lamps.push(part(new THREE.BoxGeometry(0.26, 0.12, 0.16), lampMat, -0.70 + i * 0.35, 2.24, 0.12));
  }
  const stlRoot = new THREE.Group();
  stlRoot.name = "stlBody";
  g.add(stlRoot);
  const loader = new STLLoader();
  let stlLoaded = 0;
  const stlBox = new THREE.Box3();
  const stlTmp = new THREE.Box3();
  function fitStlBody() {
    stlRoot.position.set(0, 0, 0);
    stlRoot.rotation.set(0, 0, 0);
    stlRoot.scale.setScalar(BODY_STL_SCALE);
    stlRoot.updateMatrix();
    stlBox.makeEmpty();
    stlRoot.children.forEach((o) => {
      if (!o.geometry || o.name === "tonneau") return;
      o.geometry.computeBoundingBox();
      stlTmp.copy(o.geometry.boundingBox).applyMatrix4(stlRoot.matrix);
      stlBox.union(stlTmp);
    });
    const cx = (stlBox.min.x + stlBox.max.x) * 0.5;
    const cz = (stlBox.min.z + stlBox.max.z) * 0.5;
    stlRoot.position.set(-cx, BODY_SIT_Y - stlBox.min.y, -cz);
    stlRoot.updateMatrixWorld(true);
    addTonneau();
    addGlassRoof();
    if (stlLoaded >= 2) hideOnStl.forEach((m) => { m.visible = false; });
    g.userData.stlScale = BODY_STL_SCALE;
  }
  function addTonneau() {
    if (g.userData.tonneau) {
      g.remove(g.userData.tonneau);
      g.userData.tonneau = null;
    }
    if (!stlRoot.getObjectByName("body-front")) return;
    // Flat black lid over the bed. Cab stays the cab. No V, no cap.
    // Bed well (truck m): rails drop 2.42→2.10, inner ±0.89→±1.14. Lid sits 4cm below rails.
    const xlCab = -0.86, xrCab = 0.86;
    const xlTail = -1.04, xrTail = 1.04;
    let zCab = -0.28;
    let zTail = -2.78;
    const bar = stlRoot.getObjectByName("tail-bar");
    if (bar && bar.geometry) {
      bar.geometry.computeBoundingBox();
      const bb = bar.geometry.boundingBox.clone().applyMatrix4(stlRoot.matrix);
      zTail = bb.max.z - 0.02;
    }
    const yCab = 2.34, yTail = 2.08;
    // v49 Director: lid is bed only. Cap stays body-front steel. Do not pull lid to peak.
    g.userData.zCab = zCab;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.35,
      roughness: 0.55,
      side: THREE.DoubleSide,
      flatShading: true,
      envMapIntensity: 0.4,
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([
      xlCab, yCab, zCab, xrCab, yCab, zCab, xrTail, yTail, zTail,
      xlCab, yCab, zCab, xrTail, yTail, zTail, xlTail, yTail, zTail
    ], 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "tonneau";
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    g.add(mesh);
    g.userData.tonneau = mesh;
    g.userData.tonneauMat = mat;
  }
  function addGlassRoof() {
    if (g.userData.glassRoof) {
      g.remove(g.userData.glassRoof);
      g.userData.glassRoof = null;
    }
    // v41: color windshield.stl. No overlay. Lamps on upper-glass high-Z crease.
    const ws = stlRoot.getObjectByName("windshield");
    if (!ws) return;
    ws.visible = true;
    const mat = glassMat.clone();
    mat.color.setHex(0x1a2830);
    mat.metalness = 0.58;
    mat.roughness = 0.16;
    mat.opacity = 0.84;
    mat.envMapIntensity = 0.9;
    mat.transparent = true;
    mat.depthWrite = true;
    mat.side = THREE.DoubleSide;
    mat.needsUpdate = true;
    ws.material = mat;
    ws.renderOrder = 4;
    ws.geometry.computeBoundingBox();
    const bb = ws.geometry.boundingBox.clone().applyMatrix4(stlRoot.matrix);
    const pos = ws.geometry.attributes.position;
    const v = new THREE.Vector3();
    const ys = [];
    const ty = [], tz = [];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(stlRoot.matrix);
      ys.push(v.y);
      ty.push(v.y);
      tz.push(v.z);
    }
    ys.sort((a, b) => a - b);
    const y55 = ys[Math.floor(0.55 * (ys.length - 1))];
    let zHi = -Infinity;
    for (let i = 0; i < ty.length; i++) {
      if (ty[i] >= y55 && tz[i] > zHi) zHi = tz[i];
    }
    let ySum = 0, n = 0;
    for (let i = 0; i < ty.length; i++) {
      if (ty[i] >= y55 && tz[i] > zHi - 0.04) { ySum += ty[i]; n++; }
    }
    let zCrease = zHi;
    const yGlass = n ? ySum / n : bb.max.y;
    let yCrease = yGlass + 0.06;
    const onHood = (yGlass - bb.min.y) < 0.15;
    const onPeak = (zCrease - bb.min.z) < 0.12;
    if (onHood || onPeak) {
      // Kit windshield is two panes. Vertex p55 is the cowl; lerp 0.35 is the gap
      // (depth-occluded). Mid-upper glass = high pane (range 55%), its forward brow.
      const yMid = bb.min.y + 0.55 * (bb.max.y - bb.min.y);
      zHi = -Infinity;
      for (let i = 0; i < ty.length; i++) {
        if (ty[i] >= yMid && tz[i] > zHi) zHi = tz[i];
      }
      ySum = 0; n = 0;
      for (let i = 0; i < ty.length; i++) {
        if (ty[i] >= yMid && tz[i] > zHi - 0.04) { ySum += ty[i]; n++; }
      }
      zCrease = zHi;
      yCrease = (n ? ySum / n : bb.max.y) + 0.06;
    }
    roofBar.position.set(0, yCrease - 0.04, zCrease);
    roofBar.renderOrder = 6;
    lamps.forEach((m, i) => {
      m.position.set(-0.70 + i * 0.35, yCrease, zCrease);
      m.renderOrder = 6;
    });
    g.userData.lampYZ = { y: yCrease, z: zCrease, y55, onHood, onPeak };
  }
  function addStl(url, mat, film, name) {
    loader.load(url, (geo) => {
      // Bake Z-up +X-nose STL → Y-up +Z-nose. Euler on the root was the nose-stand.
      // (x,y,z) → (y, z, x)
      geo.applyMatrix4(STL_TO_YUP);
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      if (film) paintStlDustFilm(geo);
      if (film && name) paintStlCladding(geo, name);
      const m = new THREE.Mesh(geo, mat);
      if (name) m.name = name;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      stlRoot.add(m);
      stlLoaded++;
      fitStlBody();
      g.traverse((o) => { o.frustumCulled = false; });
    });
  }
  addStl("./mesh/body-front.stl", steelStl, true, "body-front");
  addStl("./mesh/body-rear.stl", steelStl, true, "body-rear");
  addStl("./mesh/middle-body.stl", steelStl, true, "middle-body");
  addStl("./mesh/windshield.stl", glassMat, false, "windshield");
  addStl("./mesh/tail-bar.stl", tailMat, true, "tail-bar");
  const WR = 0.74;
  const WW = 0.62;
  const wheelGeo = new THREE.CylinderGeometry(WR, WR, WW, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.28, 0.28, WW + 0.04, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.72, roughness: 0.38, fog: false, emissive: 0x111111, emissiveIntensity: 0.3 });
  const hubCapGeo = new THREE.CylinderGeometry(0.12, 0.12, WW + 0.08, 8);
  hubCapGeo.rotateZ(Math.PI / 2);
  const paddleGeo = new THREE.BoxGeometry(WW + 0.04, 0.13, 0.18);
  g.userData.wheels = [];
  g.userData.wheelRadius = WR;
  // Stay under STL arches; do not widen X.
  const wpos = [
    { x: -1.26, z: 1.68, front: true },
    { x: 1.26, z: 1.68, front: true },
    { x: -1.26, z: -1.64, front: false },
    { x: 1.26, z: -1.64, front: false }
  ];
  wpos.forEach((p) => {
    const steerHub = new THREE.Group();
    steerHub.position.set(p.x, WR, p.z);
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, rubberMat);
    tire.castShadow = true;
    spin.add(tire);
    spin.add(new THREE.Mesh(rimGeo, rimMat));
    spin.add(new THREE.Mesh(hubCapGeo, blackBar));
    for (let k = 0; k < 14; k++) {
      const pd = new THREE.Mesh(paddleGeo, treadMat);
      const a = (k / 14) * Math.PI * 2;
      pd.position.set(0, Math.sin(a) * (WR - 0.02), Math.cos(a) * (WR - 0.02));
      pd.rotation.x = a;
      spin.add(pd);
    }
    steerHub.add(spin);
    g.add(steerHub);
    g.userData.wheels.push({
      hub: steerHub, spin, mesh: steerHub,
      x: p.x, z: p.z, front: p.front, radius: WR
    });
  });
  return g;
}

const truck = wedgeTruck();
scene.add(truck);
truck.traverse((o) => { o.frustumCulled = false; });
const brakeGlow = new THREE.PointLight(0xff1a00, 0, 9, 2);
brakeGlow.position.set(0, 1.22, -2.92);
truck.add(brakeGlow);
const boostGlow = new THREE.PointLight(0xff6a22, 0, 7, 2);
boostGlow.position.set(0, 0.72, -3.05);
truck.add(boostGlow);
const blobMat = new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, fog: false,
  polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
});
const blobGeo = new THREE.CircleGeometry(0.58, 12);
truck.userData.wheels.forEach((w) => {
  const b = new THREE.Mesh(blobGeo, blobMat);
  b.rotation.x = -Math.PI / 2;
  b.position.set(0, -w.radius + 0.022, 0);
  b.renderOrder = 2;
  w.hub.add(b);
});

function makeLabelTex(text) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 64px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function paintChecker(ctx, w, h, cell) {
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      ctx.fillStyle = ((x / cell + y / cell) & 1) ? "#f3eee0" : "#141414";
      ctx.fillRect(x, y, cell, cell);
    }
  }
}
function makeCheckerBanner(text) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const ctx = c.getContext("2d");
  paintChecker(ctx, 512, 128, 16);
  ctx.fillStyle = "rgba(12,12,12,0.78)";
  ctx.fillRect(96, 20, 320, 88);
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 54px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 54);
  ctx.font = "bold 28px sans-serif";
  ctx.fillStyle = "#EDE4C0";
  ctx.fillText("LAP", 256, 90);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function makeCheckerMap() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  paintChecker(c.getContext("2d"), 64, 64, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 5);
  return tex;
}
const cpTex = makeLabelTex("CHECKPOINT");
const checkerTex = makeCheckerBanner("CHECKER");
function makeCpFlagTex() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 1024;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, 256, 1024);
  ctx.fillStyle = "#111111";
  ctx.font = "bold 70px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const letters = "CHECKPOINT";
  const top = 80, bot = 620, n = letters.length;
  for (let i = 0; i < n; i++) {
    ctx.fillText(letters[i], 128, top + (bot - top) * (i / (n - 1)));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const cpFlagMat = new THREE.MeshBasicMaterial({
  map: makeCpFlagTex(), color: 0xFFD700, fog: false, toneMapped: false, side: THREE.DoubleSide
});
const checkerFlagMat = new THREE.MeshBasicMaterial({
  map: makeCheckerMap(), color: 0xFFD700, fog: false, toneMapped: false, side: THREE.DoubleSide
});
const checkerCurtainMat = new THREE.MeshBasicMaterial({
  map: makeCheckerMap(), transparent: true, opacity: 0.34,
  side: THREE.DoubleSide, depthWrite: false, toneMapped: false
});

function makeGate(index, t) {
  const { p, tan } = placeOnTrack(t);
  const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const fwd = new THREE.Vector3(tan.x, 0, tan.z).normalize();
  const g = new THREE.Group();
  const y = terrainH(p.x, p.z);
  const finish = index === GATE_COUNT - 1;
  const hw = trackHalfW(t) - (index === 0 ? 0.35 : 1.2);
  const postGeo = new THREE.BoxGeometry(0.28, GATE_POST_H, 0.28);
  [-1, 1].forEach((s) => {
    const post = new THREE.Mesh(postGeo, trussMat);
    post.position.set(p.x + right.x * s * hw, y + GATE_POST_H * 0.5, p.z + right.z * s * hw);
    post.castShadow = true;
    g.add(post);
  });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.4, 0.28, 0.28), trussMat);
  beam.position.copy(p);
  beam.position.y = y + GATE_POST_H;
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), right);
  g.add(beam);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(finish ? 5.2 : 4.6, finish ? 1.05 : 0.9, 0.12),
    new THREE.MeshStandardMaterial({
      map: finish ? checkerTex : cpTex,
      roughness: 0.42, metalness: 0.12,
      emissive: finish ? 0x221c10 : 0x664400,
      emissiveIntensity: finish ? 0.28 : 0.55
    })
  );
  board.position.set(p.x, y + GATE_POST_H + 0.5, p.z);
  board.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd.clone().negate());
  g.add(board);
  const flagQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), fwd.clone().negate());
  [-1, 1].forEach((s) => {
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 8.2, 2.2), finish ? checkerFlagMat : cpFlagMat);
    const lat = hw + 1.35;
    flag.position.set(p.x + right.x * s * lat, y + 4.4, p.z + right.z * s * lat);
    flag.quaternion.copy(flagQuat);
    flag.castShadow = true;
    g.add(flag);
    const xGroup = new THREE.Group();
    xGroup.position.set(flag.position.x, y + 1.7, flag.position.z);
    xGroup.quaternion.copy(flagQuat);
    [1, -1].forEach((r) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.85, 0.32), blackBar);
      bar.position.x = 0.08;
      bar.rotation.x = r * Math.PI / 4;
      xGroup.add(bar);
    });
    g.add(xGroup);
    const redTail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 2.15), tailMat);
    redTail.position.set(flag.position.x, y + 0.58, flag.position.z);
    redTail.quaternion.copy(flagQuat);
    g.add(redTail);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.4), finish ? blackBar : tailMat);
    cap.position.set(p.x + right.x * s * hw, y + GATE_POST_H + 0.1, p.z + right.z * s * hw);
    g.add(cap);
  });
  scene.add(g);
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(hw * 2, 1.6, 0.45),
    new THREE.MeshStandardMaterial({
      color: finish ? 0xf0ebe0 : BANNER, transparent: true, opacity: finish ? 0.16 : 0.2,
      depthWrite: false, emissive: finish ? 0xe8e0c8 : BANNER, emissiveIntensity: finish ? 0.22 : 0.35
    })
  );
  glow.position.set(p.x, y + GATE_POST_H - 0.9, p.z);
  glow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd);
  g.add(glow);
  const curtain = new THREE.Mesh(
    new THREE.PlaneGeometry(hw * 2, 3.4),
    finish ? checkerCurtainMat : new THREE.MeshBasicMaterial({ color: TAIL, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
  );
  curtain.position.set(p.x, y + 2.05, p.z);
  curtain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd);
  g.add(curtain);
  return { index, t, pos: p.clone().setY(y), forward: fwd, right, halfW: hw, mesh: g, glow };
}

const gateTs = [0.12, 0.26, 0.40, 0.54, 0.68, 0.82, 0.94];
const gates = gateTs.map((t, i) => makeGate(i, t));

function curvatureAt(t) {
  const d = 0.012;
  const a = curve.getTangentAt((t - d + 1) % 1);
  const b = curve.getTangentAt((t + d) % 1);
  return a.x * b.z - a.z * b.x;
}

function apexMarker(t, side) {
  const { p, tan } = placeOnTrack(t);
  const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const y = terrainH(p.x, p.z);
  const lat = side * (trackHalfW(t) - 1.7);
  const px = p.x + right.x * lat;
  const pz = p.z + right.z * lat;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.4, 6), trussMat);
  pole.position.set(px, y + 2.2, pz);
  pole.castShadow = true;
  scene.add(pole);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 1.0), bannerMat);
  flag.position.set(px + right.x * side * 0.18, y + 3.55, pz + right.z * side * 0.18);
  flag.castShadow = true;
  scene.add(flag);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.74), tailMat);
  red.position.set(flag.position.x, y + 2.55, flag.position.z);
  scene.add(red);
}

for (let s = 0; s < GATE_COUNT; s++) {
  const t0 = gateTs[s];
  const t1 = s === GATE_COUNT - 1 ? gateTs[0] + 1 : gateTs[s + 1];
  const span = t1 - t0;
  let bestT = (t0 + t1) * 0.5, bestC = 0;
  const n = 28;
  for (let k = 1; k < n; k++) {
    const t = t0 + span * (k / n);
    const c = curvatureAt(((t % 1) + 1) % 1);
    if (Math.abs(c) > Math.abs(bestC)) { bestC = c; bestT = t; }
  }
  const inside = bestC < 0 ? 1 : -1;
  apexMarker(((bestT % 1) + 1) % 1, inside);
  if (span > 0.14) {
    const tB = t0 + span * 0.34;
    const cB = curvatureAt(((tB % 1) + 1) % 1);
    const sideB = Math.abs(cB) > 1e-5 ? (cB < 0 ? 1 : -1) : -inside;
    apexMarker(((tB % 1) + 1) % 1, sideB);
  }
}

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _r = new THREE.Vector3();
const _f = new THREE.Vector3();
const _p = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
const _gateNdc = new THREE.Vector3();
const _sunR = new THREE.Vector3();
const _sunU = new THREE.Vector3();
const _sunF = new THREE.Vector3();

function dustSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grd.addColorStop(0.0, "rgba(224,148,92,1)");
  grd.addColorStop(0.28, "rgba(196,112,68,0.72)");
  grd.addColorStop(0.62, "rgba(176,96,58,0.28)");
  grd.addColorStop(1.0, "rgba(166,88,61,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const DUST_N = 1200;
const dustPos = new Float32Array(DUST_N * 3);
const dustVel = new Float32Array(DUST_N * 3);
const dustLife = new Float32Array(DUST_N);
const dustMax = new Float32Array(DUST_N);
const dustSize = new Float32Array(DUST_N);
const dustFade = new Float32Array(DUST_N);
const dummy = new THREE.Object3D();
const dustGeo = new THREE.PlaneGeometry(1, 1);
const dustMat = new THREE.MeshBasicMaterial({
  map: dustSprite(),
  color: 0xF2B888,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  depthTest: true,
  fog: false,
  toneMapped: false,
  side: THREE.DoubleSide
});
const dustMesh = new THREE.InstancedMesh(dustGeo, dustMat, DUST_N);
dustMesh.frustumCulled = false;
dustMesh.renderOrder = 3;
dustMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
dustMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DUST_N * 3), 3);
for (let i = 0; i < DUST_N; i++) {
  dustLife[i] = 0;
  dustMax[i] = 1;
  dustSize[i] = 0.12;
  dustFade[i] = 0;
  dustPos[i * 3 + 1] = -40;
  dummy.position.set(0, -80, 0);
  dummy.scale.setScalar(0.001);
  dummy.updateMatrix();
  dustMesh.setMatrixAt(i, dummy.matrix);
  dustMesh.setColorAt(i, new THREE.Color(DUST));
}
dustMesh.instanceMatrix.needsUpdate = true;
if (dustMesh.instanceColor) dustMesh.instanceColor.needsUpdate = true;
scene.add(dustMesh);
let dustCursor = 0;
const _dustCol = new THREE.Color();

function emitDust(x, y, z, fwdX, fwdZ, n, boostMul, front) {
  const whole = Math.floor(n);
  const count = whole + (Math.random() < (n - whole) ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const k = dustCursor++ % DUST_N;
    const i3 = k * 3;
    dustPos[i3] = x + (Math.random() - 0.5) * 0.14;
    dustPos[i3 + 1] = y + Math.random() * 0.03;
    dustPos[i3 + 2] = z + (Math.random() - 0.5) * 0.14;
    const back = (front ? 0.4 : 1.35) + Math.random() * (front ? 0.45 : 1.55) * boostMul;
    const side = (Math.random() > 0.5 ? 1 : -1) * (0.18 + Math.random() * (front ? 0.4 : 0.7));
    dustVel[i3] = -fwdX * back + side * fwdZ;
    dustVel[i3 + 1] = (front ? 0.06 : 0.9) + Math.random() * (front ? 0.16 : 1.3);
    dustVel[i3 + 2] = -fwdZ * back - side * fwdX;
    const life = front ? (0.16 + Math.random() * 0.14) : (0.85 + Math.random() * 0.55);
    dustLife[k] = life;
    dustMax[k] = life;
    dustSize[k] = front ? (0.22 + Math.random() * 0.16) : (1.6 + Math.random() * 1.8);
    dustFade[k] = 1;
    _dustCol.setHex(front ? 0xF3C49A : (Math.random() < 0.4 ? 0xE8A070 : 0xF0B888));
    dustMesh.setColorAt(k, _dustCol);
  }
  if (dustMesh.instanceColor) dustMesh.instanceColor.needsUpdate = true;
}

function stepDust(dt) {
  for (let i = 0; i < DUST_N; i++) {
    if (dustLife[i] > 0) {
      const i3 = i * 3;
      const drag = Math.exp(-1.15 * dt);
      dustVel[i3] *= drag;
      dustVel[i3 + 1] = dustVel[i3 + 1] * Math.exp(-0.85 * dt) - 2.4 * dt;
      dustVel[i3 + 2] *= drag;
      dustPos[i3] += dustVel[i3] * dt;
      dustPos[i3 + 1] += dustVel[i3 + 1] * dt;
      dustPos[i3 + 2] += dustVel[i3 + 2] * dt;
      if (dustPos[i3 + 1] > 5.2) dustPos[i3 + 1] = 5.2;
      dustLife[i] -= dt;
      if (dustLife[i] <= 0 || dustPos[i3 + 1] < -0.5) {
        dustLife[i] = 0;
        dustFade[i] = 0;
        dustPos[i3 + 1] = -40;
      } else {
        dustFade[i] = dustLife[i] / dustMax[i];
      }
    }
    dummy.quaternion.copy(camera.quaternion);
    if (dustLife[i] > 0) {
      const i3 = i * 3;
      dummy.position.set(dustPos[i3], dustPos[i3 + 1], dustPos[i3 + 2]);
      dummy.scale.setScalar(dustSize[i] * (0.7 + 0.5 * dustFade[i]));
    } else {
      dummy.position.set(0, -80, 0);
      dummy.scale.setScalar(0.001);
    }
    dummy.updateMatrix();
    dustMesh.setMatrixAt(i, dummy.matrix);
  }
  dustMesh.instanceMatrix.needsUpdate = true;
}

const MARK_N = 280;
const markLife = new Float32Array(MARK_N);
const markMax = new Float32Array(MARK_N);
const markMesh = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.48, 1.35),
  new THREE.MeshBasicMaterial({
    color: 0x3a2218, transparent: true, opacity: 0.32, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
  }),
  MARK_N
);
markMesh.frustumCulled = false;
markMesh.renderOrder = 1;
markMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
for (let i = 0; i < MARK_N; i++) {
  markLife[i] = 0;
  markMax[i] = 1;
  dummy.position.set(0, -80, 0);
  dummy.scale.setScalar(0.001);
  dummy.rotation.set(-Math.PI / 2, 0, 0);
  dummy.updateMatrix();
  markMesh.setMatrixAt(i, dummy.matrix);
}
markMesh.instanceMatrix.needsUpdate = true;
scene.add(markMesh);
let markCursor = 0;

function emitMark(x, z, yaw, slip) {
  const k = markCursor++ % MARK_N;
  const life = 3.2 + Math.random() * 1.6;
  markLife[k] = life;
  markMax[k] = life;
  dummy.position.set(x, terrainH(x, z) + RIBBON_LIFT + 0.03, z);
  dummy.rotation.set(-Math.PI / 2, 0, -yaw);
  const s = 0.7 + Math.min(1.4, slip) * 0.55;
  dummy.scale.set(s * 0.85, s * (1.0 + Math.min(1.2, slip) * 0.4), 1);
  dummy.updateMatrix();
  markMesh.setMatrixAt(k, dummy.matrix);
  markMesh.instanceMatrix.needsUpdate = true;
}

function stepMarks(dt) {
  let dirty = false;
  for (let i = 0; i < MARK_N; i++) {
    if (markLife[i] <= 0) continue;
    markLife[i] -= dt;
    if (markLife[i] <= 0) {
      dummy.position.set(0, -80, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      markMesh.setMatrixAt(i, dummy.matrix);
      dirty = true;
    }
  }
  if (dirty) markMesh.instanceMatrix.needsUpdate = true;
}

const EXH_N = 90;
const exhPos = new Float32Array(EXH_N * 3);
const exhVel = new Float32Array(EXH_N * 3);
const exhLife = new Float32Array(EXH_N);
const exhMax = new Float32Array(EXH_N);
const exhGeo = new THREE.SphereGeometry(0.12, 6, 5);
const exhMat = new THREE.MeshBasicMaterial({
  color: 0xD09068, transparent: true, opacity: 0.16, depthWrite: false, fog: false, toneMapped: false
});
const exhMesh = new THREE.InstancedMesh(exhGeo, exhMat, EXH_N);
exhMesh.frustumCulled = false;
exhMesh.renderOrder = 4;
exhMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
for (let i = 0; i < EXH_N; i++) {
  exhLife[i] = 0;
  dummy.position.set(0, -80, 0);
  dummy.scale.setScalar(0.001);
  dummy.updateMatrix();
  exhMesh.setMatrixAt(i, dummy.matrix);
}
exhMesh.instanceMatrix.needsUpdate = true;
scene.add(exhMesh);
let exhCursor = 0;

function emitExhaust(n, boosting) {
  const count = Math.floor(n) + (Math.random() < (n % 1) ? 1 : 0);
  const sx = Math.sin(car.yaw), cz = Math.cos(car.yaw);
  const tailX = car.x - sx * 2.85;
  const tailZ = car.z - cz * 2.85;
  const tailY = car.y + 0.62;
  for (let i = 0; i < count; i++) {
    const k = exhCursor++ % EXH_N;
    const i3 = k * 3;
    exhPos[i3] = tailX + (Math.random() - 0.5) * 0.35;
    exhPos[i3 + 1] = tailY + Math.random() * 0.08;
    exhPos[i3 + 2] = tailZ + (Math.random() - 0.5) * 0.35;
    exhVel[i3] = -sx * (1.4 + Math.random() * 2.2) + (Math.random() - 0.5) * 0.4;
    exhVel[i3 + 1] = 0.35 + Math.random() * 0.8;
    exhVel[i3 + 2] = -cz * (1.4 + Math.random() * 2.2) + (Math.random() - 0.5) * 0.4;
    const life = (boosting ? 0.28 : 0.42) + Math.random() * 0.22;
    exhLife[k] = life;
    exhMax[k] = life;
  }
}

function stepExhaust(dt) {
  for (let i = 0; i < EXH_N; i++) {
    if (exhLife[i] > 0) {
      const i3 = i * 3;
      const drag = Math.exp(-1.4 * dt);
      exhVel[i3] *= drag;
      exhVel[i3 + 1] = exhVel[i3 + 1] * Math.exp(-0.5 * dt) + 0.4 * dt;
      exhVel[i3 + 2] *= drag;
      exhPos[i3] += exhVel[i3] * dt;
      exhPos[i3 + 1] += exhVel[i3 + 1] * dt;
      exhPos[i3 + 2] += exhVel[i3 + 2] * dt;
      exhLife[i] -= dt;
    }
    if (exhLife[i] > 0) {
      const i3 = i * 3;
      dummy.position.set(exhPos[i3], exhPos[i3 + 1], exhPos[i3 + 2]);
      const u = exhLife[i] / exhMax[i];
      dummy.scale.setScalar((boostingExh ? 1.6 : 1.0) * (0.45 + (1 - u) * 1.8));
    } else {
      dummy.position.set(0, -80, 0);
      dummy.scale.setScalar(0.001);
    }
    dummy.updateMatrix();
    exhMesh.setMatrixAt(i, dummy.matrix);
  }
  exhMesh.instanceMatrix.needsUpdate = true;
}
let boostingExh = false;

function killDust() {
  for (let i = 0; i < DUST_N; i++) {
    dustLife[i] = 0;
    dustFade[i] = 0;
    dustPos[i * 3 + 1] = -40;
    dummy.position.set(0, -80, 0);
    dummy.scale.setScalar(0.001);
    dummy.updateMatrix();
    dustMesh.setMatrixAt(i, dummy.matrix);
  }
  dustMesh.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < MARK_N; i++) {
    markLife[i] = 0;
    dummy.position.set(0, -80, 0);
    dummy.scale.setScalar(0.001);
    dummy.updateMatrix();
    markMesh.setMatrixAt(i, dummy.matrix);
  }
  markMesh.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < EXH_N; i++) {
    exhLife[i] = 0;
    dummy.position.set(0, -80, 0);
    dummy.scale.setScalar(0.001);
    dummy.updateMatrix();
    exhMesh.setMatrixAt(i, dummy.matrix);
  }
  exhMesh.instanceMatrix.needsUpdate = true;
}

const elTimer = document.getElementById("timer-val");
const elGateIdx = document.getElementById("gate-idx");
const elGateDist = document.getElementById("gate-dist");
const elGatePanel = document.getElementById("gate-panel");
const elChevron = document.getElementById("chevron");
const elSpeed = document.getElementById("speed-val");
const elArc = document.getElementById("arc-fg");
const elCluster = document.getElementById("speed-cluster");
const elFinish = document.getElementById("finish");
const elFinishTime = document.getElementById("finish-time");
const elFailToast = document.getElementById("fail-toast");
const elLiveryTap = document.getElementById("livery-tap");

function fmtTime(ms) {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const d = Math.floor(t % 1000);
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "." + String(d).padStart(3, "0");
}

const car = {
  x: 0, y: 0, z: 0,
  yaw: 0, pitch: 0, roll: 0,
  speed: 0,
  lat: 0,
  yawRate: 0,
  ax: 0,
  ay: 0,
  slip: 0,
  rpm: 800,
  braking: false,
  boost: 1,
  overheating: false,
  hp: 100,
  item: "NONE",
  ammo: 0
};
const camVel = new THREE.Vector3();
let lastWallT = 0;
let markAcc = 0;
let camImpact = 0;
let nextGate = 0;
let gatesHit = 0;
let lapDriven = 0;
let lastT = START_T;
let prevDriveT = START_T;
let lastClearT = START_T;
let lastClearYaw = 0;
let prevGateSide = 0;
let timeMs = 0;
let finished = false;
let steerVis = 0;
let camReady = false;
let padPrevRec = false;
let flashT = 0;
let toastT = 0;
let flipHold = 0;
let offHold = 0;
let physicsHitch = false;

function headingAt(t) {
  const tan = curve.getTangentAt(t);
  return Math.atan2(tan.x, tan.z);
}

function placeCar(t, yaw) {
  const { p } = placeOnTrack(t);
  car.x = p.x;
  car.z = p.z;
  car.y = terrainH(p.x, p.z) + GROUND_SIT;
  car.yaw = yaw;
  car.pitch = 0;
  car.roll = 0;
  car.speed = 0;
  car.lat = 0;
  car.yawRate = 0;
  car.ax = 0;
  car.ay = 0;
  car.slip = 0;
  car.rpm = 800;
  car.braking = false;
  markAcc = 0;
  camImpact = 0;
  if (truck && truck.userData.wheels) {
    truck.userData.wheels.forEach((w) => {
      w.susY = null;
      w.yVel = 0;
      w.omega = 0;
      w.compression = 0;
    });
  }
}

function syncTruck() {
  truck.position.set(car.x, car.y, car.z);
  truck.rotation.set(car.pitch, car.yaw, car.roll, "YXZ");
}

function sitWheels(dt) {
  const wr = truck.userData.wheelRadius || 0.74;
  const snap = dt == null || dt <= 0 || dt > 0.08;
  const kSpring = 96;
  const kDamp = 14;
  const maxBump = 0.12;
  truck.updateMatrixWorld(true);
  truck.userData.wheels.forEach((w) => {
    _p.set(w.x, 0, w.z);
    truck.localToWorld(_p);
    const deck = terrainH(_p.x, _p.z) + RIBBON_LIFT;
    _w.set(_p.x, deck + wr, _p.z);
    truck.worldToLocal(_w);
    const restY = THREE.MathUtils.clamp(_w.y, wr - 0.02, wr + 0.28);
    if (snap || w.susY == null) {
      w.susY = restY;
      w.yVel = 0;
    } else {
      const ext = restY - w.susY;
      w.yVel = (w.yVel || 0) + (ext * kSpring - (w.yVel || 0) * kDamp) * dt;
      w.susY += w.yVel * dt;
      w.susY = THREE.MathUtils.clamp(w.susY, restY, restY + maxBump);
    }
    w.compression = THREE.MathUtils.clamp((w.susY - restY) / maxBump, 0, 1);
    w.hub.position.set(w.x, w.susY, w.z);
  });
}

function keepWheelsOnDeck() {
  const wr = truck.userData.wheelRadius || 0.74;
  truck.updateMatrixWorld(true);
  let lift = 0;
  truck.userData.wheels.forEach((w) => {
    w.hub.getWorldPosition(_w);
    const deck = terrainH(_w.x, _w.z) + RIBBON_LIFT;
    lift = Math.max(lift, deck - (_w.y - wr));
  });
  const deckC = terrainH(car.x, car.z);
  lift = Math.max(lift, deckC + 0.12 - car.y);
  if (lift > 0.001) {
    car.y += Math.min(0.12, lift);
    truck.position.y = car.y;
  }
}

function clampCamPos(pos) {
  const proj = projectTrack(pos);
  const maxOff = trackHalfW(proj.t) - 1.8;
  if (Math.abs(proj.offset) > maxOff) {
    const extra = Math.abs(proj.offset) - maxOff;
    const sgn = Math.sign(proj.offset);
    pos.x -= proj.right.x * sgn * extra;
    pos.z -= proj.right.z * sgn * extra;
  }
  const floorY = terrainH(pos.x, pos.z) + 3.2;
  if (pos.y < floorY) pos.y = floorY;
}

function chaseAim(back, h, side, out) {
  const sx = Math.sin(car.yaw), cz = Math.cos(car.yaw);
  out.set(
    car.x - sx * back + cz * side,
    car.y + h,
    car.z - cz * back - sx * side
  );
  clampCamPos(out);
  return out;
}

function snapCam() {
  const back = 16.4, h = 6.55, side = 3.0;
  chaseAim(back, h, side, _cam);
  camera.position.copy(_cam);
  camera.lookAt(car.x + Math.sin(car.yaw) * 6.2, car.y + 1.7, car.z + Math.cos(car.yaw) * 6.2);
  camera.fov = 50;
  camera.updateProjectionMatrix();
  camReady = true;
  boostShake = 0;
  camVel.set(0, 0, 0);
  camImpact = 0;
}

function sideOfGate(g, x, z) {
  return (x - g.pos.x) * g.forward.x + (z - g.pos.z) * g.forward.z;
}

function armGateSide() {
  const g = gates[nextGate];
  prevGateSide = sideOfGate(g, car.x, car.z);
}

function spawnStart() {
  lastClearT = START_T;
  lastClearYaw = headingAt(START_T);
  placeCar(START_T, lastClearYaw);
  nextGate = 0;
  gatesHit = 0;
  lapDriven = 0;
  lastT = START_T;
  prevDriveT = START_T;
  timeMs = 0;
  finished = false;
  car.boost = 1;
  car.overheating = false;
  car.hp = 100;
  car.item = "NONE";
  car.ammo = 0;
  resetArcade();
  steerVis = 0;
  elFinish.classList.remove("show");
  if (elFailToast) elFailToast.classList.remove("show");
  toastT = 0;
  flipHold = 0;
  offHold = 0;
  killDust();
  syncTruck();
  sitWheels();
  armGateSide();
  snapCam();
}

function resetCheckpoint(reason) {
  if (finished) return;
  placeCar(lastClearT, lastClearYaw);
  lastT = lastClearT;
  prevDriveT = lastClearT;
  flipHold = 0;
  offHold = 0;
  killDust();
  syncTruck();
  sitWheels();
  armGateSide();
  snapCam();
  showFailToast(reason || "CHECKPOINT");
}

function showToast(msg, dur) {
  if (!elFailToast) return;
  elFailToast.textContent = msg;
  elFailToast.classList.add("show");
  toastT = dur == null ? 1.2 : dur;
}

function applyLivery(i) {
  liveryIdx = ((i % LIVERIES.length) + LIVERIES.length) % LIVERIES.length;
  const L = LIVERIES[liveryIdx];
  [steelBody, steelStl].filter(Boolean).forEach((m) => {
    m.color.setHex(L.color);
    m.metalness = L.metalness;
    m.roughness = L.roughness;
    m.envMapIntensity = L.env;
    m.needsUpdate = true;
  });
  if (elLiveryTap) {
    elLiveryTap.style.backgroundColor = "#" + L.color.toString(16).padStart(6, "0");
  }
}

function cycleLivery() {
  applyLivery(liveryIdx + 1);
  showToast(LIVERIES[liveryIdx].name, 0.8);
}

function showFailToast(msg) {
  showToast(msg, 1.2);
}

function showGateToast(n) {
  showToast("GATE " + n, 0.9);
}

function onRetry() {
  if (finished) spawnStart();
  else resetCheckpoint();
}

function finishLap() {
  finished = true;
  if (elFailToast) elFailToast.classList.remove("show");
  toastT = 0;
  elFinishTime.textContent = fmtTime(timeMs);
  elFinish.classList.add("show");
}

function flashGate() {
  flashT = 0.12;
  elGateIdx.style.color = "#ffffff";
  elGateIdx.style.textShadow = "0 0 10px #ffffff";
}

const MAX_SPEED = 58;
const BOOST_SPEED = 72;
const ACCEL = 22;
const BRAKE_DECEL = 42;
const REV_ACCEL = 14;
const MAX_REV = 12;
const DRAG = 0.26;
const MASS = 1980;
const IZZ = 5600;
const LF = 1.70;
const LR = 1.62;
const WHEELBASE = LF + LR;
const TRACK_W = 2.52;
const CG_H = 0.72;
const GRAV = 9.81;
const MAX_STEER = 0.38;

function magicF(slip, Fz, mu, B, C) {
  const D = mu * Math.max(120, Fz);
  return D * Math.sin(C * Math.atan(B * slip));
}

function readControls() {
  let th = 0, st = 0, hb = false, bo = false;
  if (keys.KeyW || keys.ArrowUp) th += 1;
  if (keys.KeyS || keys.ArrowDown) th -= 1;
  if (keys.KeyA || keys.ArrowLeft) st -= 1;
  if (keys.KeyD || keys.ArrowRight) st += 1;
  if (keys.ShiftLeft || keys.ShiftRight) hb = true;
  if (keys.Space) bo = true;
  th += touchCtl.th;
  st += touchCtl.st;
  if (touchCtl.bo) bo = true;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let sawPad = false;
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i];
    if (!p) continue;
    sawPad = true;
    const ax = p.axes[0] || 0;
    if (Math.abs(ax) > 0.12) st += ax;
    const ly = p.axes[1] || 0;
    const trigR = p.buttons[7] ? p.buttons[7].value : 0;
    const trigL = p.buttons[6] ? p.buttons[6].value : 0;
    if (trigR > 0.08) th += trigR;
    else if (ly < -0.22) th += -ly;
    if (trigL > 0.08) th -= trigL;
    else if (ly > 0.5) th -= ly;
    if ((p.buttons[0] && p.buttons[0].pressed) || (p.buttons[5] && p.buttons[5].pressed)) bo = true;
    if ((p.buttons[1] && p.buttons[1].pressed) || (p.buttons[4] && p.buttons[4].pressed)) hb = true;
    if (p.buttons[12] && p.buttons[12].pressed) th += 1;
    if (p.buttons[13] && p.buttons[13].pressed) th -= 1;
    if (p.buttons[14] && p.buttons[14].pressed) st -= 1;
    if (p.buttons[15] && p.buttons[15].pressed) st += 1;
    const rec = (p.buttons[3] && p.buttons[3].pressed) || (p.buttons[9] && p.buttons[9].pressed);
    if (rec && !padPrevRec) onRetry();
    padPrevRec = !!rec;
    if (st || th || bo || hb || rec) unlockAudio();
    break;
  }
  if (!sawPad) padPrevRec = false;
  if (!hintGone && (th || st || bo)) dismissHint();
  return {
    th: Math.max(-1, Math.min(1, th)),
    st: Math.max(-1, Math.min(1, st)),
    hb, bo
  };
}

function drive(dt) {
  const ctl = readControls();
  // 2026-08-28: left/right were inverted vs the chase cam. Flip once here so wheels match yaw.
  let th = ctl.th, st = -ctl.st, hb = ctl.hb, bo = ctl.bo;
  if (finished) {
    th = 0;
    st = 0;
    hb = false;
    bo = false;
    car.speed *= Math.exp(-2.4 * dt);
    car.lat *= Math.exp(-3.2 * dt);
    car.yawRate *= Math.exp(-4.0 * dt);
    if (Math.abs(car.speed) < 0.15) car.speed = 0;
    car.overheating = false;
  } else {
    if (bo) {
      if (car.boost > 0) {
        car.boost = Math.max(0, car.boost - BOOST_DRAIN * dt);
      }
      if (car.boost <= 0.001) {
        car.boost = 0;
        car.overheating = true;
      }
    } else {
      car.overheating = false;
      car.boost = Math.min(1, car.boost + BOOST_REGEN * dt);
    }
  }
  const boosting = !finished && bo && car.boost > 0 && !car.overheating;
  if (car.overheating) th *= 0.58;
  car.braking = th < -0.12 && car.speed > 0.4;

  steerVis += (st - steerVis) * Math.min(1, dt * 11);
  const spd0 = car.speed;
  const steps = dt > 1 / 50 ? 2 : 1;
  const h = dt / steps;
  for (let s = 0; s < steps; s++) {
    driveStep(h, th, hb, boosting);
  }
  if (physicsHitch) {
    const maxDelta = (ACCEL * 2.5 + BRAKE_DECEL) * MAX_DT;
    if (Math.abs(car.speed - spd0) > maxDelta) {
      car.speed = spd0 + Math.sign(car.speed - spd0) * maxDelta;
    }
    car.lat *= 0.35;
    car.yawRate *= 0.45;
  }

  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  const rx = Math.cos(car.yaw);
  const rz = -Math.sin(car.yaw);
  const spdAbs = Math.abs(car.speed);

  let proj = projectTrack(_p.set(car.x, 0, car.z));
  let dTrack = proj.t - lastT;
  if (dTrack < -0.5) dTrack += 1;
  if (dTrack > 0.5) dTrack -= 1;
  if (dTrack > 0) lapDriven += dTrack;
  prevDriveT = lastT;
  lastT = proj.t;

  if (!finished && Math.abs(proj.offset) > trackHalfW(proj.t) - 0.7) {
    const half = trackHalfW(proj.t) - 0.7;
    const sign = Math.sign(proj.offset);
    const nx = proj.right.x * sign;
    const nz = proj.right.z * sign;
    const wx = fx * car.speed + rx * car.lat;
    const wz = fz * car.speed + rz * car.lat;
    const vn = wx * nx + wz * nz;
    const extra = Math.abs(proj.offset) - half;
    car.x -= nx * extra;
    car.z -= nz * extra;
    if (vn > 0.4 && !physicsHitch) {
      const e = 0.28;
      const j = -(1 + e) * vn;
      const wx2 = wx + j * nx;
      const wz2 = wz + j * nz;
      const tx = -nz, tz = nx;
      const vt = wx2 * tx + wz2 * tz;
      const wx3 = wx2 - tx * vt * 0.38;
      const wz3 = wz2 - tz * vt * 0.38;
      car.speed = wx3 * fx + wz3 * fz;
      car.lat = wx3 * rx + wz3 * rz;
      car.yawRate += -sign * THREE.MathUtils.clamp(vn * 0.22, -2.4, 2.4);
      car.roll += sign * 0.16;
      camImpact = Math.min(1, camImpact + Math.min(1, vn * 0.12));
      if (performance.now() - lastWallT > 180) {
        lastWallT = performance.now();
        wallThud(Math.min(1, vn / 18));
      }
    } else {
      car.speed *= physicsHitch ? 0.98 : 0.9;
      car.lat -= sign * 4 * dt;
      if (!physicsHitch) car.roll += sign * 0.35 * dt * Math.min(spdAbs, 20);
    }
    proj = projectTrack(_p.set(car.x, 0, car.z));
  }

  const tlen = Math.hypot(proj.tan.x, proj.tan.z) || 1;
  const tx = proj.tan.x / tlen, tz = proj.tan.z / tlen;
  const yA = terrainH(car.x + fx * LF, car.z + fz * LF);
  const yB = terrainH(car.x - fx * LR, car.z - fz * LR);
  const yL = terrainH(car.x - rx * TRACK_W * 0.5, car.z - rz * TRACK_W * 0.5);
  const yR = terrainH(car.x + rx * TRACK_W * 0.5, car.z + rz * TRACK_W * 0.5);
  car.y = terrainH(car.x, car.z) + GROUND_SIT;

  let wantPitch = THREE.MathUtils.clamp(Math.atan2(yA - yB, WHEELBASE), -MAX_PITCH, MAX_PITCH);
  wantPitch += THREE.MathUtils.clamp(-car.ax * 0.006, -0.04, 0.05);
  let wantRoll = THREE.MathUtils.clamp(Math.atan2(yL - yR, TRACK_W), -MAX_ROLL, MAX_ROLL);
  wantRoll += THREE.MathUtils.clamp(-steerVis * spdAbs * 0.006 - car.lat * 0.014, -MAX_ROLL, MAX_ROLL);
  car.pitch += (wantPitch - car.pitch) * Math.min(1, dt * 4.2);
  car.roll += (wantRoll - car.roll) * Math.min(1, dt * 3.8);
  car.pitch = THREE.MathUtils.clamp(car.pitch, -MAX_PITCH, MAX_PITCH);
  car.roll = THREE.MathUtils.clamp(car.roll, -MAX_ROLL, MAX_ROLL);

  const flipped = Math.cos(car.roll) * Math.cos(car.pitch) < 0.32;
  if (flipped) flipHold += dt; else flipHold = 0;
  if (Math.abs(proj.offset) > trackHalfW(proj.t) + 4) offHold += dt; else offHold = 0;
  if (!finished && (flipHold >= FLIP_HOLD || offHold >= FLIP_HOLD)) {
    resetCheckpoint(flipHold >= FLIP_HOLD ? "FLIP" : "OFF COURSE");
    return { boosting: false, fx, fz };
  }

  if (!finished) checkGates(spdAbs, proj.offset);

  const wr = truck.userData.wheelRadius || 0.74;
  const slipN = car.slip;
  truck.userData.wheels.forEach((w) => {
    if (w.omega == null) w.omega = car.speed / wr;
    const target = car.speed / wr;
    const driveSpin = (!w.front && th > 0) ? th * (boosting ? 22 : 9) : 0;
    const lock = hb && !w.front ? 2.1 : (w.front ? 14 : 9);
    w.omega += ((target + driveSpin) - w.omega) * Math.min(1, dt * lock);
    if (hb && !w.front) w.omega *= Math.exp(-1.8 * dt);
    w.spin.rotation.x += w.omega * dt;
    if (w.front) {
      const ack = w.x > 0 ? 1 : -1;
      w.hub.rotation.y = steerVis * 0.48 * (1 + 0.12 * ack * Math.sign(steerVis || 1));
    } else {
      w.hub.rotation.y = 0;
    }
  });
  syncTruck();
  sitWheels(dt);
  keepWheelsOnDeck();
  sitWheels(dt);

  if (typeof brakeGlow !== "undefined") {
    brakeGlow.intensity = car.braking ? 4.2 : (car.speed < -0.6 ? 1.4 : 0);
  }
  if (typeof boostGlow !== "undefined") {
    boostGlow.intensity = boosting ? 2.8 : 0;
  }

  const boostMul = boosting ? 1.55 : 1;
  if (spdAbs > 0.8) {
    const spdN = Math.min(1, spdAbs / 32);
    truck.userData.wheels.forEach((w) => {
      w.spin.getWorldPosition(_w);
      const contactY = _w.y - wr;
      const perSec = (w.front ? 10 : 82) * spdN * boostMul * (0.55 + slipN * 1.7);
      emitDust(_w.x, contactY + 0.45, _w.z, fx, fz, perSec * dt, boostMul, w.front);
    });
    markAcc += dt * (hb ? 22 : 0) + dt * slipN * spdN * 16;
    while (markAcc > 1) {
      markAcc -= 1;
      const rears = truck.userData.wheels.filter((w) => !w.front);
      const w = rears[(markCursor | 0) % Math.max(1, rears.length)];
      if (w) {
        w.spin.getWorldPosition(_w);
        emitMark(_w.x, _w.z, car.yaw, Math.max(0.2, slipN));
      }
    }
  }
  boostingExh = boosting;
  if (spdAbs > 1.2 || boosting) {
    emitExhaust((boosting ? 10 : 2) * dt * Math.min(1.2, 0.3 + spdAbs / 36), boosting);
  }

  return { boosting, fx, fz };
}

function driveStep(dt, th, hb, boosting) {
  const spdAbs = Math.abs(car.speed);
  const mph = spdAbs * 2.236936;
  let steerEff = 0;
  if (spdAbs >= 0.35) {
    const ramp = THREE.MathUtils.clamp(spdAbs / 3.2, 0, 1);
    let damp = 1;
    if (mph > 80) damp = 0.22;
    else if (mph > 50) damp = 0.62 - (mph - 50) * 0.013;
    else if (mph > 28) damp = 1 - (mph - 28) / 22 * 0.32;
    steerEff = ramp * THREE.MathUtils.clamp(damp, 0.20, 1);
  }
  const delta = steerVis * MAX_STEER * steerEff;
  const vx = car.speed;
  const vy = car.lat;
  const r = car.yawRate;
  const vxSafe = Math.max(3.2, Math.abs(vx));
  const aF = Math.atan2(vy + r * LF, vxSafe * Math.sign(vx || 1)) - delta;
  const aR = Math.atan2(vy - r * LR, vxSafe * Math.sign(vx || 1));

  const Fz0 = MASS * GRAV;
  let FzF = Fz0 * LR / WHEELBASE - MASS * (car.ax || 0) * CG_H / WHEELBASE;
  let FzR = Fz0 * LF / WHEELBASE + MASS * (car.ax || 0) * CG_H / WHEELBASE;
  FzF = Math.max(400, FzF);
  FzR = Math.max(400, FzR);
  const pack = surfacePack(car.x, car.z);
  const muF = (hb ? 1.12 : 1.48) * pack;
  const muR = (hb ? 0.58 : 1.40) * pack;
  const FyF = -magicF(aF, FzF, muF, 6.0, 1.52);
  const FyR = -magicF(aR, FzR, muR, 6.4, 1.55);

  const vmax = boosting ? BOOST_SPEED : MAX_SPEED;
  let Fx = 0;
  if (th > 0) {
    const u = Math.max(0, vx) / (vmax + 6);
    const peak = MASS * ACCEL * (boosting ? 2.35 : 1);
    Fx += th * peak * Math.max(0.10, 1 - u * u);
  } else if (th < 0) {
    if (vx > 0.35) Fx += th * MASS * BRAKE_DECEL;
    else Fx += th * MASS * REV_ACCEL;
  }
  if (hb) Fx -= Math.sign(vx || 1) * MASS * 4.8 * Math.min(1, spdAbs);
  const FxMax = (muF * FzF * 0.52 + muR * FzR) * (boosting ? 1.55 : 1.08);
  Fx = THREE.MathUtils.clamp(Fx, -FxMax * 1.2, FxMax);
  Fx -= vx * MASS * (DRAG + spdAbs * 0.0028);
  Fx -= 0.32 * vx * Math.abs(vx);
  if (th === 0 && spdAbs < 0.55) Fx -= vx * MASS * 3.2;
  const FxF = Fx * 0.22;
  const FxR = Fx * 0.78;
  const cd = Math.cos(delta), sd = Math.sin(delta);
  const FxFw = FxF * cd - FyF * sd;
  const FyFw = FyF * cd + FxF * sd;
  const FxTot = FxFw + FxR;
  const FyTot = FyFw + FyR;
  const Mz = LF * FyFw - LR * FyR;

  const ax = FxTot / MASS + vy * r;
  const ay = FyTot / MASS - vx * r;
  const alpha = Mz / IZZ;
  car.speed += ax * dt;
  car.lat += ay * dt;
  car.yawRate += alpha * dt;
  car.yawRate *= Math.exp(-1.35 * dt);
  car.yawRate = THREE.MathUtils.clamp(car.yawRate, -1.65, 1.65);
  car.lat *= Math.exp(-0.55 * dt);
  car.lat = THREE.MathUtils.clamp(car.lat, -8, 8);
  if (car.speed > vmax) car.speed = THREE.MathUtils.lerp(car.speed, vmax, 1 - Math.exp(-2.2 * dt));
  if (car.speed < -MAX_REV) car.speed = -MAX_REV;
  car.ax = ax;
  car.ay = ay;
  car.slip = Math.min(2.2, Math.abs(aF) + Math.abs(aR) * 0.85 + (hb ? 0.55 : 0) + Math.abs(car.lat) * 0.04);
  car.rpm = 820 + spdAbs * 72 + car.slip * 380 + (boosting ? 520 : 0);

  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  const rx = Math.cos(car.yaw);
  const rz = -Math.sin(car.yaw);
  car.yaw += car.yawRate * dt;
  car.x += (fx * car.speed + rx * car.lat) * dt;
  car.z += (fz * car.speed + rz * car.lat) * dt;
}

function gateTCrossed(prevT, nowT, gateT) {
  const d = nowT - prevT;
  if (d > 0.5) return false;
  if (d >= 0) return prevT < gateT && nowT >= gateT;
  if (d > -0.5) return false;
  return prevT < gateT || nowT >= gateT;
}

function checkGates(spdAbs, trackOffset) {
  const g = gates[nextGate];
  const side = sideOfGate(g, car.x, car.z);
  const lat = (car.x - g.pos.x) * g.right.x + (car.z - g.pos.z) * g.right.z;
  const wide = g.halfW + 1.6;
  const planeHit = prevGateSide < 0.2 && side >= 0 && Math.abs(lat) < wide;
  const pathHit = gateTCrossed(prevDriveT, lastT, g.t) && Math.abs(trackOffset) < wide;
  if ((planeHit || pathHit) && spdAbs > MIN_GATE_SPEED) {
    lastClearT = (g.t + 0.012) % 1;
    lastClearYaw = Math.atan2(g.forward.x, g.forward.z);
    gatesHit++;
    flashGate();
    gateTick();
    const passed = g.index + 1;
    if (nextGate === GATE_COUNT - 1) {
      if (gatesHit >= GATE_COUNT && lapDriven >= MIN_LAP_FRAC) {
        finishLap();
      } else {
        nextGate = 0;
        gatesHit = 0;
        lapDriven = 0;
        showGateToast(passed);
      }
    } else {
      nextGate++;
      showGateToast(passed);
    }
    armGateSide();
    return;
  }
  prevGateSide = side;
}

function chaseCam(dt, boosting) {
  const spd = Math.abs(car.speed);
  const sx = Math.sin(car.yaw), cz = Math.cos(car.yaw);
  if (PROOF === "A") {
    chaseAim(-9.2, 4.4, 7.0, _cam);
    camera.position.copy(_cam);
    _look.set(car.x + sx * 1.4, car.y + 2.4, car.z + cz * 1.4);
    camera.lookAt(_look);
    camera.fov = 36;
    camera.updateProjectionMatrix();
    camReady = true;
  } else if (PROOF === "B") {
    // FRAME chase vs circuit.png: truck rear (cap/lid) + Starship mid-right.
    chaseAim(16.4, 6.55, 3.0, _cam);
    camera.position.copy(_cam);
    _look.set(car.x + sx * 6.2, car.y + 1.7, car.z + cz * 6.2);
    camera.lookAt(_look);
    camera.fov = 50;
    camera.updateProjectionMatrix();
    camReady = true;
  } else {
  const back = 16.2 + Math.min(2.4, spd * 0.038) + Math.min(0.8, car.slip * 0.35);
  const h = 6.55 + Math.max(-0.35, -car.pitch * 0.9);
  const side = 3.0 + car.lat * 0.07 + steerVis * 0.35;
  chaseAim(back, h, side, _cam);
  if (!camReady) {
    camera.position.copy(_cam);
    camVel.set(0, 0, 0);
  } else {
    const omega = 8.4;
    const ax = (_cam.x - camera.position.x) * omega * omega - camVel.x * 2 * omega;
    const ay = (_cam.y - camera.position.y) * omega * omega - camVel.y * 2 * omega;
    const az = (_cam.z - camera.position.z) * omega * omega - camVel.z * 2 * omega;
    camVel.x += ax * dt;
    camVel.y += ay * dt;
    camVel.z += az * dt;
    camera.position.x += camVel.x * dt;
    camera.position.y += camVel.y * dt;
    camera.position.z += camVel.z * dt;
  }
  clampCamPos(camera.position);
  const lookFwd = 6.2 + Math.min(3.6, spd * 0.08);
  _look.set(
    car.x + sx * lookFwd,
    car.y + 1.7 - car.pitch * 0.45,
    car.z + cz * lookFwd
  );
  camera.lookAt(_look);
  camera.rotateZ(car.roll * 0.16);
  const tfov = 52 + Math.min(5.2, spd * 0.055) + (boosting ? 2.4 : 0);
  camera.fov += (tfov - camera.fov) * Math.min(1, dt * 3.2);
  camera.updateProjectionMatrix();
  camReady = true;
  }
  const camFloor = terrainH(camera.position.x, camera.position.z) + 3.2;
  if (camera.position.y < camFloor) camera.position.y = camFloor;
  sun.target.position.set(car.x, car.y, car.z);
  camera.updateMatrixWorld();
  _sunR.setFromMatrixColumn(camera.matrixWorld, 0);
  _sunU.setFromMatrixColumn(camera.matrixWorld, 1);
  _sunF.setFromMatrixColumn(camera.matrixWorld, 2).multiplyScalar(-1);
  // v17 camera-right key vs circuit.png, shadows down-left.
  sun.position.set(
    car.x + _sunR.x * 40 + _sunU.x * 28 - _sunF.x * 12,
    car.y + _sunR.y * 40 + _sunU.y * 28 - _sunF.y * 12,
    car.z + _sunR.z * 40 + _sunU.z * 28 - _sunF.z * 12
  );
  sun.target.updateMatrixWorld();
  fill.target.position.set(car.x, car.y, car.z);
  fill.position.set(
    car.x - _sunR.x * 36 + _sunU.x * 18 - _sunF.x * 8,
    car.y - _sunR.y * 36 + _sunU.y * 18 - _sunF.y * 8,
    car.z - _sunR.z * 36 + _sunU.z * 18 - _sunF.z * 8
  );
  fill.target.updateMatrixWorld();
  rim.position.set(
    car.x - _sunR.x * 18 + _sunU.x * 10 + _sunF.x * 28,
    car.y - _sunR.y * 18 + _sunU.y * 10 + _sunF.y * 28,
    car.z - _sunR.z * 18 + _sunU.z * 10 + _sunF.z * 28
  );
  if (boosting && !physicsHitch) boostShake = Math.min(1, boostShake + dt * 9);
  else boostShake *= Math.exp(-10 * dt);
  if (boostShake > 0.02) {
    const mag = 0.085 * boostShake;
    camera.position.x += (Math.random() - 0.5) * mag;
    camera.position.y += (Math.random() - 0.5) * mag * 0.5;
    camera.position.z += (Math.random() - 0.5) * mag;
  }
  camImpact *= Math.exp(-7 * dt);
  if (camImpact > 0.02 && PROOF !== "A" && PROOF !== "B") {
    const mag = 0.16 * camImpact;
    camera.position.x += (Math.random() - 0.5) * mag;
    camera.position.y += (Math.random() - 0.5) * mag * 0.45;
    camera.position.z += (Math.random() - 0.5) * mag;
  }
}

function hudBind() {
  const g = gates[finished ? GATE_COUNT - 1 : nextGate];
  const speedMph = Math.abs(car.speed) * 2.236936;
  const boost01 = car.boost;
  const overheating = car.overheating;
  const gateIndex = finished ? GATE_COUNT : nextGate + 1;
  const gateCount = GATE_COUNT;
  const gateDistM = Math.hypot(g.pos.x - car.x, g.pos.z - car.z);
  _gateNdc.set(g.pos.x, g.pos.y + 3.2, g.pos.z).project(camera);
  const gateOnScreen = Math.abs(_gateNdc.x) < 0.92 && Math.abs(_gateNdc.y) < 0.88 && _gateNdc.z < 1 && _gateNdc.z > -0.15;
  let ang = Math.atan2(g.pos.x - car.x, g.pos.z - car.z) - car.yaw;
  while (ang > Math.PI) ang -= Math.PI * 2;
  while (ang < -Math.PI) ang += Math.PI * 2;
  const gateHeading01 = ang / Math.PI;

  if (elHpFill) elHpFill.style.width = Math.max(0, Math.min(100, car.hp)) + "%";
  if (elItemVal) elItemVal.textContent = car.item === "NONE" ? "NONE" : (car.item + (car.ammo ? " " + car.ammo : ""));
  elSpeed.textContent = String(Math.round(speedMph));
  elArc.style.strokeDashoffset = String(ARC_LEN * (1 - boost01));
  elCluster.classList.toggle("overheat", overheating);
  elTimer.textContent = fmtTime(timeMs);
  elGateIdx.textContent = gateIndex + "/" + gateCount;
  elGateDist.textContent = Math.round(gateDistM) + " m";
  elGatePanel.classList.toggle("offscreen", !gateOnScreen);
  if (flashT <= 0) {
    elGateIdx.style.color = "";
    elGateIdx.style.textShadow = "";
  }
  if (!gateOnScreen && !finished) {
    elChevron.classList.add("show");
    const dx = Math.sin(ang);
    const dy = -Math.cos(ang);
    const mx = innerWidth * 0.5, my = innerHeight * 0.5;
    const m = 16;
    const hw = mx - m, hh = my - m;
    const tx = Math.abs(dx) < 1e-5 ? 1e9 : hw / Math.abs(dx);
    const ty = Math.abs(dy) < 1e-5 ? 1e9 : hh / Math.abs(dy);
    const t = Math.min(tx, ty);
    const px = mx + dx * t;
    const py = my + dy * t;
    elChevron.style.left = (px - 7) + "px";
    elChevron.style.top = (py - 12) + "px";
    elChevron.style.transformOrigin = "7px 12px";
    elChevron.style.transform = "rotate(" + Math.atan2(dy, dx) + "rad)";
  } else {
    elChevron.classList.remove("show");
  }
  return {
    speedMph, boost01, overheating, timeMs,
    gateIndex, gateCount, gateDistM, gateOnScreen, gateHeading01
  };
}

let sfx = null;
let sfxBoosting = false;
let boostShake = 0;

function unlockAudio() {
  if (sfx) {
    if (sfx.ctx.state === "suspended") sfx.ctx.resume().catch(function () {});
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  let ctx;
  try { ctx = new AC(); } catch (err) { return; }
  const master = ctx.createGain();
  master.gain.value = 0.52;
  master.connect(ctx.destination);
  const nLen = Math.floor(ctx.sampleRate * 1);
  const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
  const nd = nBuf.getChannelData(0);
  for (let i = 0; i < nLen; i++) nd[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = nBuf;
  noise.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 90;
  lp.Q.value = 0.7;
  const eg = ctx.createGain();
  eg.gain.value = 0;
  noise.connect(lp);
  lp.connect(eg);
  eg.connect(master);
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 38;
  const og = ctx.createGain();
  og.gain.value = 0;
  osc.connect(og);
  og.connect(master);
  try { noise.start(); osc.start(); } catch (err) {}
  const rumble = ctx.createOscillator();
  rumble.type = "sawtooth";
  rumble.frequency.value = 26;
  const rg = ctx.createGain();
  rg.gain.value = 0;
  const rumbleLp = ctx.createBiquadFilter();
  rumbleLp.type = "lowpass";
  rumbleLp.frequency.value = 70;
  rumble.connect(rumbleLp);
  rumbleLp.connect(rg);
  rg.connect(master);
  try { rumble.start(); } catch (err) {}
  sfx = { ctx, master, lp, eg, osc, og, rumble, rg };
  ctx.resume().catch(function () {});
}

function wallThud(amp) {
  if (!sfx) return;
  const ctx = sfx.ctx;
  const t = ctx.currentTime;
  const nLen = Math.floor(ctx.sampleRate * 0.22);
  const buf = ctx.createBuffer(1, nLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < nLen; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / nLen);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 140 + amp * 80;
  const g = ctx.createGain();
  const peak = 0.04 + amp * 0.10;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
  src.connect(lp);
  lp.connect(g);
  g.connect(sfx.master);
  src.start(t);
  src.stop(t + 0.22);
}

function whoosh() {
  if (!sfx) return;
  const ctx = sfx.ctx;
  const t = ctx.currentTime;
  const nLen = Math.floor(ctx.sampleRate * 0.36);
  const buf = ctx.createBuffer(1, nLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < nLen; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / nLen);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 720;
  bp.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.10, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.30);
  src.connect(bp);
  bp.connect(g);
  g.connect(sfx.master);
  src.start(t);
  src.stop(t + 0.34);
}

function gateTick() {
  if (!sfx) return;
  const ctx = sfx.ctx;
  const t = ctx.currentTime;
  function blip(freq, dur, peak, type) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.72, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.007);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(sfx.master);
    o.start(t);
    o.stop(t + dur + 0.01);
  }
  blip(1240, 0.042, 0.065, "square");
  blip(620, 0.052, 0.04, "triangle");
}

function stepAudio(boosting) {
  if (!sfx) return;
  if (sfx.ctx.state === "suspended") return;
  const n = Math.min(1, Math.abs(car.speed) / 42);
  const slip = Math.min(1, car.slip * 0.55);
  const rpmN = THREE.MathUtils.clamp((car.rpm - 800) / 4200, 0, 1);
  // .value (not setTargetAtTime) so Chrome does not queue automation events every frame.
  sfx.lp.frequency.value = 70 + n * 190 + slip * 120;
  sfx.eg.gain.value = n > 0.03 ? 0.014 + n * 0.044 + slip * 0.02 : 0;
  sfx.osc.frequency.value = 30 + rpmN * 78 + n * 18;
  sfx.og.gain.value = n > 0.03 ? 0.007 + rpmN * 0.028 : 0;
  if (boosting && !sfxBoosting && !physicsHitch) whoosh();
  sfxBoosting = !!boosting;
}

function dismissHint() {
  if (hintGone || !elHint) return;
  hintGone = true;
  elHint.classList.add("gone");
  const done = function () {
    elHint.style.display = "none";
    elHint.removeEventListener("transitionend", done);
  };
  elHint.addEventListener("transitionend", done);
  setTimeout(done, 700);
}

const LAUNCH_PAD_S = 10;
const LAUNCH_IGN_S = 2.4;
const LAUNCH_COAST_S = 4;
const LAUNCH_V0 = 8;
const LAUNCH_A = 22;
const LAUNCH_HIDE_Y = 280;
let launchPhase = "pad";
let launchT = 0;

function setLaunchExhaust(u) {
  const exh = rocket.userData.exhaust;
  const fo = rocket.userData.flameOuter;
  const fi = rocket.userData.flameInner;
  if (!exh) return;
  if (u <= 0.01) {
    exh.visible = false;
    exh.scale.set(0.001, 0.001, 0.001);
    if (fo) fo.opacity = 0;
    if (fi) fi.opacity = 0;
    return;
  }
  exh.visible = true;
  const flicker = 0.88 + Math.random() * 0.24;
  const s = (0.28 + u * 0.92) * flicker;
  exh.scale.set(s, s, 0.55 + u * 0.9);
  if (fo) fo.opacity = 0.28 + u * 0.5;
  if (fi) fi.opacity = 0.45 + u * 0.45;
}

function setLaunchRumble(amp) {
  if (!sfx || !sfx.rg) return;
  sfx.rg.gain.value = amp;
}

function stepLaunch(dt) {
  if (PROOF === "A" || PROOF === "B") return;
  const stl = rocket.userData.stlRoot;
  if (!stl) return;
  launchT += dt;
  if (launchPhase === "pad") {
    stl.visible = true;
    stl.position.y = 0;
    setLaunchExhaust(0);
    setLaunchRumble(0);
    if (launchT >= LAUNCH_PAD_S) { launchPhase = "ign"; launchT = 0; }
  } else if (launchPhase === "ign") {
    const u = Math.min(1, launchT / LAUNCH_IGN_S);
    stl.visible = true;
    stl.position.y = (Math.random() - 0.5) * 0.28;
    setLaunchExhaust(u);
    setLaunchRumble(0.018 + u * 0.045);
    if (launchT >= LAUNCH_IGN_S) {
      stl.position.y = 0;
      launchPhase = "up";
      launchT = 0;
    }
  } else if (launchPhase === "up") {
    const y = LAUNCH_V0 * launchT + 0.5 * LAUNCH_A * launchT * launchT;
    stl.visible = true;
    stl.position.y = y;
    setLaunchExhaust(1);
    setLaunchRumble(0.04);
    if (y > LAUNCH_HIDE_Y) {
      stl.visible = false;
      stl.position.y = 0;
      setLaunchExhaust(0);
      setLaunchRumble(0);
      launchPhase = "coast";
      launchT = 0;
    }
  } else {
    stl.visible = false;
    stl.position.y = 0;
    setLaunchExhaust(0);
    setLaunchRumble(0);
    if (launchT >= LAUNCH_COAST_S) {
      stl.visible = true;
      stl.position.y = 0;
      launchPhase = "pad";
      launchT = 0;
    }
  }
}

const ITEM_COLORS = {
  BOOST: 0xE23B32, HEALTH: 0x3de8ff, GUN: 0xFFB020, LASER: 0x66F0FF, MINE: 0xC0C0C0
};
const pickups = [];
const shots = [];
const mines = [];
const rivals = [];
let arcadeReady = false;
const elHpFill = document.getElementById("hp-fill");
const elItemVal = document.getElementById("item-val");

function resetArcade() {
  shots.forEach((s) => { if (s.mesh) scene.remove(s.mesh); });
  shots.length = 0;
  mines.forEach((m) => { if (m.mesh) scene.remove(m.mesh); });
  mines.length = 0;
  pickups.forEach((p) => { p.taken = 0; if (p.mesh) p.mesh.visible = true; });
  rivals.forEach((r) => { r.hp = 70; r.dead = false; });
}

function makePickupMesh(kind) {
  const g = new THREE.Group();
  const col = ITEM_COLORS[kind] || 0xffffff;
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.62),
    new THREE.MeshBasicMaterial({
      color: col, toneMapped: false, fog: false, transparent: true, opacity: 0.92
    })
  );
  g.add(core);
  g.userData.core = core;
  return g;
}

(function seedPickups() {
  const kinds = ["BOOST", "HEALTH", "GUN", "LASER", "MINE"];
  for (let i = 0; i < 16; i++) {
    const t = (0.08 + i * 0.055) % 1;
    const kind = kinds[i % kinds.length];
    const { p, tan } = placeOnTrack(t);
    const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const lat = ((i % 2) ? 1 : -1) * (trackHalfW(t) - 2.4);
    const x = p.x + right.x * lat;
    const z = p.z + right.z * lat;
    const mesh = makePickupMesh(kind);
    mesh.position.set(x, terrainH(x, z) + 1.15, z);
    scene.add(mesh);
    pickups.push({ kind, x, z, mesh, taken: 0, spin: i });
  }
  [0.14, 0.22, 0.48, 0.58].forEach((t) => {
    const { p, tan } = placeOnTrack(t);
    const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const hw = trackHalfW(t) - 1.2;
    const geo = new THREE.PlaneGeometry(hw * 2, 3.2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xE23B32, transparent: true, opacity: 0.28, toneMapped: false, side: THREE.DoubleSide
    });
    const pad = new THREE.Mesh(geo, mat);
    pad.rotation.x = -Math.PI / 2;
    pad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0));
    pad.lookAt(p.x + tan.x, terrainH(p.x, p.z) + 1, p.z + tan.z);
    pad.position.set(p.x, terrainH(p.x, p.z) + RIBBON_LIFT + 0.06, p.z);
    pad.rotation.x = -Math.PI / 2;
    scene.add(pad);
    pickups.push({ kind: "PAD", x: p.x, z: p.z, mesh: pad, taken: 0, pad: true, t });
  });
})();

function grantItem(kind) {
  if (kind === "BOOST" || kind === "PAD") {
    car.boost = 1;
    car.overheating = false;
    showToast(kind === "PAD" ? "BOOST PAD" : "BOOST", 0.7);
    return;
  }
  if (kind === "HEALTH") {
    car.hp = Math.min(100, car.hp + 36);
    showToast("REPAIR", 0.7);
    return;
  }
  car.item = kind;
  car.ammo = kind === "GUN" ? 14 : kind === "LASER" ? 8 : 3;
  showToast(kind + " x" + car.ammo, 0.8);
}

function fireItem() {
  if (finished || car.hp <= 0) return;
  const kind = car.item;
  if (kind !== "GUN" && kind !== "LASER") return;
  if (car.ammo <= 0) { car.item = "NONE"; return; }
  car.ammo -= 1;
  if (car.ammo <= 0) car.item = "NONE";
  const sx = Math.sin(car.yaw), cz = Math.cos(car.yaw);
  const laser = kind === "LASER";
  const mesh = new THREE.Mesh(
    laser ? new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6) : new THREE.SphereGeometry(0.16, 6, 6),
    new THREE.MeshBasicMaterial({
      color: laser ? 0x66F0FF : 0xFFB020, toneMapped: false, fog: false
    })
  );
  if (laser) mesh.rotation.x = Math.PI / 2;
  const spd = laser ? 92 : 62;
  const s = {
    x: car.x + sx * 3.2, y: car.y + 1.15, z: car.z + cz * 3.2,
    vx: sx * spd, vz: cz * spd, life: laser ? 0.9 : 1.15,
    dmg: laser ? 22 : 12, mesh, from: "player"
  };
  mesh.position.set(s.x, s.y, s.z);
  scene.add(mesh);
  shots.push(s);
}

function dropMine() {
  if (finished || car.hp <= 0) return;
  if (car.item !== "MINE" || car.ammo <= 0) return;
  car.ammo -= 1;
  if (car.ammo <= 0) car.item = "NONE";
  const sx = Math.sin(car.yaw), cz = Math.cos(car.yaw);
  const x = car.x - sx * 3.4, z = car.z - cz * 3.4;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.62, 0.18, 10),
    new THREE.MeshStandardMaterial({
      color: 0x333230, metalness: 0.6, roughness: 0.4, emissive: 0x882200, emissiveIntensity: 0.5
    })
  );
  mesh.position.set(x, terrainH(x, z) + 0.12, z);
  scene.add(mesh);
  mines.push({ x, z, mesh, arm: 0.7, from: "player" });
  showToast("MINE", 0.5);
}

function hurt(n, reason) {
  if (finished) return;
  car.hp = Math.max(0, car.hp - n);
  camImpact = Math.min(1, camImpact + n * 0.03);
  if (car.hp <= 0) {
    car.speed *= 0.55;
    car.hp = 12;
    showFailToast(reason || "HULL CRITICAL");
  }
}

function makeRivalMesh(hex) {
  const g = new THREE.Group();
  const mat = steelBody.clone();
  mat.color.setHex(hex);
  mat.emissive = new THREE.Color(hex);
  mat.emissiveIntensity = 0.12;
  const hull = new THREE.Mesh(wedgeHullGeo(), mat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);
  const WR = 0.74;
  const wheelGeo = new THREE.CylinderGeometry(WR, WR, 0.55, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  [[-1.2, 1.6], [1.2, 1.6], [-1.2, -1.55], [1.2, -1.55]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wheelGeo, rubberMat);
    w.position.set(x, WR, z);
    w.castShadow = true;
    g.add(w);
  });
  return g;
}

function spawnRivals() {
  if (arcadeReady) return;
  arcadeReady = true;
  const skins = [0x222226, 0x453A22, 0x8C7360];
  const names = ["BLACK", "CBM", "COLONY"];
  const lanes = [-6.2, 6.2, -5.4];
  for (let i = 0; i < 3; i++) {
    const mesh = makeRivalMesh(skins[i]);
    scene.add(mesh);
    rivals.push({
      mesh, t: (START_T + 0.12 + i * 0.06) % 1, lat: lanes[i],
      speed: 28 + i * 3, hp: 70, name: names[i], dead: false
    });
  }
}

function stepArcade(dt) {
  spawnRivals();
  pickups.forEach((p) => {
    if (p.mesh && p.mesh.userData.core) {
      p.mesh.userData.core.rotation.y += dt * 2.4;
      p.mesh.position.y = terrainH(p.x, p.z) + 1.15 + Math.sin(performance.now() * 0.004 + p.spin) * 0.12;
    }
    if (p.taken > 0) {
      p.taken -= dt;
      if (p.taken <= 0 && p.mesh && !p.pad) p.mesh.visible = true;
      return;
    }
    const d = Math.hypot(p.x - car.x, p.z - car.z);
    if (d < (p.pad ? 3.4 : 2.2)) {
      grantItem(p.kind);
      if (p.pad) p.taken = 1.6;
      else { p.taken = 8; if (p.mesh) p.mesh.visible = false; }
    }
  });
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.life -= dt;
    s.x += s.vx * dt;
    s.z += s.vz * dt;
    s.mesh.position.set(s.x, s.y, s.z);
    s.mesh.rotation.y += dt * 8;
    let hit = false;
    rivals.forEach((r) => {
      if (r.dead || s.from !== "player") return;
      if (Math.hypot(s.x - r.mesh.position.x, s.z - r.mesh.position.z) < 2.6) {
        r.hp -= s.dmg;
        hit = true;
        if (r.hp <= 0) { r.dead = true; r.speed = 0; showToast(r.name + " OUT", 0.8); }
      }
    });
    if (!hit && s.from !== "player" && Math.hypot(s.x - car.x, s.z - car.z) < 2.4) {
      hurt(s.dmg, "HIT");
      hit = true;
    }
    if (hit || s.life <= 0) {
      scene.remove(s.mesh);
      shots.splice(i, 1);
    }
  }
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i];
    m.arm -= dt;
    if (m.arm > 0) continue;
    let boom = false;
    if (Math.hypot(m.x - car.x, m.z - car.z) < 2.8) { hurt(28, "MINE"); boom = true; }
    rivals.forEach((r) => {
      if (r.dead) return;
      if (Math.hypot(m.x - r.mesh.position.x, m.z - r.mesh.position.z) < 2.8) {
        r.hp -= 30;
        if (r.hp <= 0) { r.dead = true; r.speed = 0; }
        boom = true;
      }
    });
    if (boom) {
      scene.remove(m.mesh);
      mines.splice(i, 1);
    }
  }
  rivals.forEach((r, i) => {
    if (!r.mesh) return;
    if (r.dead) {
      r.mesh.position.y = terrainH(r.mesh.position.x, r.mesh.position.z) + 0.2;
      return;
    }
    const want = 32 + i * 6 + (lastT - r.t > 0.04 ? 10 : 0);
    r.speed += (want - r.speed) * Math.min(1, dt * 1.4);
    r.t = (r.t + (r.speed / Math.max(80, trackLen)) * dt + 1) % 1;
    const { p, tan } = placeOnTrack(r.t);
    const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const x = p.x + right.x * r.lat;
    const z = p.z + right.z * r.lat;
    const y = terrainH(x, z) + GROUND_SIT + 0.18;
    const yaw = Math.atan2(tan.x, tan.z);
    r.mesh.position.set(x, y, z);
    r.mesh.rotation.set(0, yaw, 0, "YXZ");
    const d = Math.hypot(x - car.x, z - car.z);
    if (d < 2.5) {
      const nx = (car.x - x) / (d || 1), nz = (car.z - z) / (d || 1);
      car.x += nx * 0.18;
      car.z += nz * 0.18;
    }
  });
}

spawnStart();
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  let dt = clock.getDelta();
  physicsHitch = dt > MAX_DT;
  if (dt > MAX_DT) dt = MAX_DT;
  const { boosting } = drive(dt);
  stepArcade(dt);
  stepLaunch(dt);
  stepDust(dt);
  stepMarks(dt);
  stepExhaust(dt);
  syncTruck();
  chaseCam(dt, boosting);
  stepAudio(boosting);
  if (!finished && Math.abs(car.speed) > 0.65) timeMs += dt * 1000;
  if (flashT > 0) flashT -= dt;
  if (toastT > 0) {
    toastT -= dt;
    if (toastT <= 0 && elFailToast) elFailToast.classList.remove("show");
  }
  hudBind();
  if (composer) composer.render();
  else renderer.render(scene, camera);
}
requestAnimationFrame(loop);
