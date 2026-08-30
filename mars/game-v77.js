import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

// cache: game-v77.js  — solid ribbon, no pits, wheels on track, readable ramps
const BUILD = "77";
const GATE_COUNT = 5;
const MIN_GATE_SPEED = 5;
const MIN_LAP_FRAC = 0.62;
const HALF_W = 14;
const START_T = 0.02;
const MAX_DT = 1 / 20;
const BOOST_DRAIN = 0.40;
const BOOST_REGEN = 0.11;
const ARC_LEN = 264;
const DUST = 0xC47858;
const RIBBON_LIFT = 0.14;
const RIBBON_PACK = 0xD08A58;
const EDGE_GOLD = 0xE8B923;
const FOG_PEACH = 0xE3A07A;
const STEEL = 0xC0C0C0;
const BANNER = 0xFFD700;
const TAIL = 0xFF0000;
const PAD_ROCKET_X = -36;
const PAD_ROCKET_Y = 6;
const PAD_ROCKET_Z = 256;
const CLEAR = HALF_W + 16;

const keys = Object.create(null);
addEventListener("keydown", (e) => {
  unlockAudio();
  keys[e.code] = true;
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
  if (e.code === "KeyR" && !e.repeat) onRetry();
  if (e.code === "KeyC" && !e.repeat) cycleLivery();
});
addEventListener("keyup", (e) => { keys[e.code] = false; });

const touchCtl = { st: 0, th: 0, bo: false };
const touchPtrs = new Map();
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
  return Math.max(-1, Math.min(1, (clientX - innerWidth * 0.22) / 96));
}
function setPadHeld(el, on) { if (el) el.classList.toggle("held", on); }
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
  if (finished) { onRetry(); return; }
  const hit = padRoleFromTarget(e.target);
  if (hit === "livery") { cycleLivery(); if (e.cancelable) e.preventDefault(); return; }
  let role = hit;
  if (!role && finger) role = e.clientX < innerWidth * 0.5 ? "steer" : "th";
  if (!role) return;
  if (!finger && !hit) return;
  const rec = { role, st: 0 };
  if (role === "steer") rec.st = steerFromClientX(e.clientX);
  touchPtrs.set(e.pointerId, rec);
  if (e.target && e.target.setPointerCapture) { try { e.target.setPointerCapture(e.pointerId); } catch (err) {} }
  touchRecompute();
  if (e.cancelable) e.preventDefault();
}
function onPtrMove(e) {
  const rec = touchPtrs.get(e.pointerId);
  if (!rec) return;
  if (rec.role === "steer") { rec.st = steerFromClientX(e.clientX); touchRecompute(); }
  if (e.cancelable) e.preventDefault();
}
function onPtrUp(e) {
  touchPtrs.delete(e.pointerId);
  touchRecompute();
}
addEventListener("pointerdown", onPtrDown, { passive: false });
addEventListener("pointermove", onPtrMove, { passive: false });
addEventListener("pointerup", onPtrUp);
addEventListener("pointercancel", onPtrUp);
addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("touchmove", (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
(function () {
  try {
    if (matchMedia("(pointer: coarse)").matches || matchMedia("(hover: none)").matches || ("ontouchstart" in window)) {
      document.documentElement.classList.add("touch-on");
      document.body.classList.add("touch-on");
    }
  } catch (err) {}
})();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
renderer.domElement.style.touchAction = "none";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xF0C4A0);
scene.fog = new THREE.FogExp2(FOG_PEACH, 0.00125);

const PROOF = (new URLSearchParams(location.search).get("shot") || "").toUpperCase();
if (PROOF === "A" || PROOF === "B") {
  const hd = document.getElementById("hud");
  const tw = document.getElementById("touch");
  if (hd) hd.style.display = "none";
  if (tw) tw.style.display = "none";
}
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.3, 2200);
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xF4D0B4, 0xC07048, 1.7));
scene.add(new THREE.AmbientLight(0xE8B080, 0.82));
const sun = new THREE.DirectionalLight(0xFFE0C0, 4.3);
sun.position.set(-40, 28, -20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 2;
sun.shadow.camera.far = 140;
sun.shadow.camera.left = -36;
sun.shadow.camera.right = 36;
sun.shadow.camera.top = 36;
sun.shadow.camera.bottom = -36;
sun.shadow.bias = -0.00025;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);
const fill = new THREE.DirectionalLight(0xFFE8D0, 0.95);
fill.position.set(50, 20, 20);
scene.add(fill);
scene.add(fill.target);

const pmrem = new THREE.PMREMGenerator(renderer);
const envSc = new THREE.Scene();
envSc.add(new THREE.HemisphereLight(0xF0C8A8, 0xA05030, 1.2));
scene.environment = pmrem.fromScene(envSc, 0.08).texture;

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function dirtTexture(rep, hex) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = hex || "#C47858";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18000; i++) {
    const v = (Math.random() * 70) | 0;
    g.fillStyle = "rgba(" + (110 + v) + "," + (55 + (v * 0.4) | 0) + "," + (30 + (v * 0.2) | 0) + "," + (0.15 + Math.random() * 0.35) + ")";
    g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 4, 1 + Math.random() * 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const DIRT_GROUND = dirtTexture(48, "#C47858");
const DIRT_TRACK = dirtTexture(8, "#8A5040");

const steelBody = new THREE.MeshStandardMaterial({
  color: 0x6E7378, metalness: 0.94, roughness: 0.34, envMapIntensity: 1.08,
  vertexColors: true, fog: true
});
const steelStl = new THREE.MeshStandardMaterial({
  color: 0x6E7378, metalness: 0.18, roughness: 0.46, envMapIntensity: 0.35,
  vertexColors: true, fog: false, emissive: 0x6E7378, emissiveIntensity: 0.52
});
const LIVERIES = [
  { name: "RAW STEEL", color: 0x6E7378, metalness: 0.18, roughness: 0.46, env: 0.35 },
  { name: "SPACEX BLACK", color: 0x161618, metalness: 0.58, roughness: 0.48, env: 0.70 },
  { name: "CBM ATHLETICS", color: 0x453A22, metalness: 0.91, roughness: 0.28, env: 1.22 },
  { name: "MARS COLONY WORKS", color: 0x8C7360, metalness: 0.68, roughness: 0.54, env: 0.82 }
];
let liveryIdx = 0;
const steelRocket = new THREE.MeshStandardMaterial({
  color: STEEL, metalness: 0.9, roughness: 0.32, envMapIntensity: 1.35, side: THREE.DoubleSide, fog: false
});
const steelRocketDark = new THREE.MeshStandardMaterial({
  color: 0x3a342e, metalness: 0.72, roughness: 0.55, envMapIntensity: 0.7, side: THREE.DoubleSide, fog: false
});
const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.95, metalness: 0.05, fog: false });
const treadMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9, metalness: 0.08, fog: false });
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x14181c, metalness: 0.88, roughness: 0.06, transparent: true, opacity: 0.86,
  envMapIntensity: 1.2, fog: false, emissive: 0x0a1014, emissiveIntensity: 0.3
});
const blackBar = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.4, roughness: 0.55, fog: false });
const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false });
const tailMat = new THREE.MeshBasicMaterial({ color: TAIL, toneMapped: false });
const bannerMat = new THREE.MeshStandardMaterial({ color: BANNER, roughness: 0.38, metalness: 0.12, emissive: 0x886600, emissiveIntensity: 0.55 });
const trussMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.4 });

const pathPts = [];
for (let i = 0; i <= 22; i++) {
  const u = i / 22;
  const z = u * 1700;
  const x = 8 * Math.sin(u * Math.PI * 1.6);
  pathPts.push(new THREE.Vector3(x, 0, z));
}
pathPts.push(new THREE.Vector3(90, 0, 1785), new THREE.Vector3(220, 0, 1840), new THREE.Vector3(360, 0, 1790), new THREE.Vector3(455, 0, 1660));
for (let i = 21; i >= 0; i--) {
  const u = i / 22;
  const z = u * 1700;
  const x = 460 + 8 * Math.sin(u * Math.PI * 1.6);
  pathPts.push(new THREE.Vector3(x, 0, z));
}
pathPts.push(new THREE.Vector3(320, 0, -50), new THREE.Vector3(150, 0, -55), new THREE.Vector3(40, 0, -22), new THREE.Vector3(3, 0, -2));
const curve = new THREE.CatmullRomCurve3(pathPts, true, "catmullrom", 0.15);
const trackLen = curve.getLength();

const JUMPS = [
  { t: 0.11, kind: "whoops", h: 1.15, len: 56, n: 5 },
  { t: 0.22, kind: "valley", h: 5.2, len: 88 },
  { t: 0.40, kind: "table", h: 3.6, len: 64 },
  { t: 0.56, kind: "valley", h: 6.4, len: 110 },
  { t: 0.74, kind: "whoops", h: 1.1, len: 50, n: 5 },
  { t: 0.86, kind: "valley", h: 5.6, len: 96 }
];

function jumpLen(j) { return j.len; }
function jumpProfile(j, u) {
  const h = j.h;
  if (j.kind === "whoops") {
    const win = Math.sin(u * Math.PI);
    return Math.max(0, h * win * (0.4 + 0.6 * Math.sin(u * j.n * Math.PI)));
  }
  if (j.kind === "table") {
    if (u < 0.24) return h * (u / 0.24);
    if (u < 0.62) return h;
    return h * Math.max(0, 1 - (u - 0.62) / 0.38);
  }
  if (j.kind === "valley") {
    if (u < 0.22) return h * Math.pow(u / 0.22, 1.1);
    if (u < 0.28) return h;
    if (u < 0.48) return h + (0.45 - h) * ((u - 0.28) / 0.20);
    if (u < 0.62) return 0.45 + (h * 0.82 - 0.45) * ((u - 0.48) / 0.14);
    return Math.max(0, h * 0.82 * (1 - (u - 0.62) / 0.38));
  }
  return 0;
}
function jumpAtT(t) {
  const s = t * trackLen;
  for (let i = 0; i < JUMPS.length; i++) {
    const j = JUMPS[i];
    const start = j.t * trackLen;
    const len = jumpLen(j);
    if (s >= start && s <= start + len) return { j, u: (s - start) / len, x: s - start };
  }
  return null;
}
function jumpYAtT(t) {
  const hit = jumpAtT(t);
  return hit ? jumpProfile(hit.j, hit.u) : 0;
}
function inPitT(t) { return false; }

const PATH_N = 900;
const pathSampX = new Float32Array(PATH_N);
const pathSampZ = new Float32Array(PATH_N);
const pathSampJ = new Float32Array(PATH_N);
for (let i = 0; i < PATH_N; i++) {
  const t = i / PATH_N;
  const p = curve.getPointAt(t);
  pathSampX[i] = p.x;
  pathSampZ[i] = p.z;
  pathSampJ[i] = jumpYAtT(t);
}
function nearPathSample(x, z) {
  let best = 0, bestD = 1e15;
  for (let i = 0; i < PATH_N; i += 2) {
    const dx = pathSampX[i] - x, dz = pathSampZ[i] - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  const i0 = Math.max(0, best - 3), i1 = Math.min(PATH_N - 1, best + 3);
  for (let i = i0; i <= i1; i++) {
    const dx = pathSampX[i] - x, dz = pathSampZ[i] - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  return { d: Math.sqrt(bestD), jy: pathSampJ[best], t: best / PATH_N };
}
function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / Math.max(1e-6, b - a)));
  return t * t * (3 - 2 * t);
}
function groundH(x, z) {
  return Math.sin(x * 0.012) * Math.cos(z * 0.01) * 0.28 + Math.sin(x * 0.07 + z * 0.06) * 0.06;
}
function trackH(x, z) {
  const base = groundH(x, z);
  const near = nearPathSample(x, z);
  if (near.d < HALF_W + 4) return base + Math.max(0, near.jy);
  return base;
}
function terrainH(x, z) { return trackH(x, z); }

function minDistToPath(x, z) {
  return nearPathSample(x, z).d;
}
function offRoad(x, z) { return minDistToPath(x, z) > HALF_W + 8; }

function projectTrack(pos) {
  let bestT = 0, bestD = 1e9, bestP = null;
  const n = 160;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const d = (p.x - pos.x) * (p.x - pos.x) + (p.z - pos.z) * (p.z - pos.z);
    if (d < bestD) { bestD = d; bestT = t; bestP = p; }
  }
  const refine = 10, span = 1 / n;
  for (let i = -refine; i <= refine; i++) {
    const t = (bestT + (i / refine) * span + 1) % 1;
    const p = curve.getPointAt(t);
    const d = (p.x - pos.x) * (p.x - pos.x) + (p.z - pos.z) * (p.z - pos.z);
    if (d < bestD) { bestD = d; bestT = t; bestP = p; }
  }
  const bestTan = curve.getTangentAt(bestT);
  const right = new THREE.Vector3(bestTan.z, 0, -bestTan.x).normalize();
  const offset = (pos.x - bestP.x) * right.x + (pos.z - bestP.z) * right.z;
  return { t: bestT, p: bestP, tan: bestTan, right, offset };
}
function placeOnTrack(t) {
  const p = curve.getPointAt(t);
  p.y = terrainH(p.x, p.z);
  return { p, tan: curve.getTangentAt(t) };
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2400, 2400, 80, 80),
  new THREE.MeshStandardMaterial({ map: DIRT_GROUND, color: 0x8A4A32, roughness: 0.97, metalness: 0.02 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
{
  const gpos = ground.geometry.attributes.position;
  for (let i = 0; i < gpos.count; i++) gpos.setZ(i, groundH(gpos.getX(i), gpos.getY(i)));
  ground.geometry.computeVertexNormals();
}
scene.add(ground);

const ribbonN = 900;
const ribbonPos = [], ribbonUv = [], ribbonIdx = [];
for (let i = 0; i <= ribbonN; i++) {
  const t = i / ribbonN;
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t);
  const r = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const h = trackH(p.x, p.z) + RIBBON_LIFT;
  ribbonPos.push(p.x - r.x * (HALF_W - 0.2), h, p.z - r.z * (HALF_W - 0.2));
  ribbonPos.push(p.x + r.x * (HALF_W - 0.2), h, p.z + r.z * (HALF_W - 0.2));
  ribbonUv.push(t * 28, 0, t * 28, 1);
}
for (let i = 0; i < ribbonN; i++) {
  const i0 = i * 2;
  ribbonIdx.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
}
const ribbonGeo = new THREE.BufferGeometry();
ribbonGeo.setAttribute("position", new THREE.Float32BufferAttribute(ribbonPos, 3));
ribbonGeo.setAttribute("uv", new THREE.Float32BufferAttribute(ribbonUv, 2));
ribbonGeo.setIndex(ribbonIdx);
ribbonGeo.computeVertexNormals();
const ribbon = new THREE.Mesh(ribbonGeo, new THREE.MeshStandardMaterial({
  map: DIRT_TRACK, color: RIBBON_PACK, roughness: 0.98, metalness: 0.02,
  polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2
}));
ribbon.receiveShadow = true;
scene.add(ribbon);

function addEdge(offA, offB) {
  const pos = [], idx = [];
  const n = 800;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const r = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const h = trackH(p.x, p.z) + RIBBON_LIFT + 0.08;
    pos.push(p.x + r.x * offA, h, p.z + r.z * offA, p.x + r.x * offB, h, p.z + r.z * offB);
  }
  for (let i = 0; i < n; i++) {
    const i0 = i * 2;
    idx.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: EDGE_GOLD, fog: false }));
  scene.add(m);
}
addEdge(-0.22, 0.22);
addEdge(-(HALF_W - 0.05), -(HALF_W - 0.45));
addEdge((HALF_W - 0.45), (HALF_W - 0.05));

(function markJumps() {
  function stripeAt(t, hex, deep) {
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const y = trackH(p.x, p.z) + RIBBON_LIFT + 0.12;
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(HALF_W * 2 - 0.8, 0.1, deep || 2.2),
      new THREE.MeshBasicMaterial({ color: hex, fog: false, toneMapped: false })
    );
    stripe.position.set(p.x, y, p.z);
    stripe.rotation.y = Math.atan2(tan.x, tan.z);
    scene.add(stripe);
  }
  JUMPS.forEach((j) => {
    const start = j.t;
    if (j.kind === "valley") {
      stripeAt((start + 0.26 * j.len / trackLen) % 1, 0xFFEE55, 2.6);
      stripeAt((start + 0.50 * j.len / trackLen) % 1, 0xf4f4f2, 2.4);
    } else if (j.kind === "table") {
      stripeAt((start + 0.24 * j.len / trackLen) % 1, 0xE8B923, 2.0);
    }
  });
})();

// Open desert — Road Rash, no canyon walls. Scenery lives off the tarmac.

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1400, 24, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: "varying vec3 w; void main(){ w = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "varying vec3 w; void main(){ float h = normalize(w).y; vec3 hor = vec3(0.95,0.72,0.52); vec3 zen = vec3(0.62,0.48,0.42); gl_FragColor = vec4(mix(hor, zen, max(h,0.0)*0.9),1.0); }"
  })
);
scene.add(sky);
{
  const sunMesh = new THREE.Mesh(
    new THREE.CircleGeometry(90, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe2a8, fog: false, toneMapped: false })
  );
  sunMesh.position.set(-420, 280, -380);
  sunMesh.lookAt(0, 0, 0);
  scene.add(sunMesh);
}

const colliders = [];
function addCollider(x, z, r) { colliders.push({ x, z, r }); }

function clusterAlong(t0, t1, side, dist0, dist1, count, fn) {
  for (let i = 0; i < count; i++) {
    const t = t0 + (t1 - t0) * ((i + 0.35) / count);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const dist = dist0 + (dist1 - dist0) * (i / Math.max(1, count - 1));
    const x = p.x + right.x * side * dist;
    const z = p.z + right.z * side * dist;
    if (minDistToPath(x, z) < HALF_W + 16) continue;
    fn(x, z, i, t);
  }
}

(function marsLand() {
  const dummy = new THREE.Object3D();
  const duneGeo = new THREE.SphereGeometry(1, 7, 5);
  const duneMat = new THREE.MeshStandardMaterial({ color: 0xC47858, roughness: 0.98, metalness: 0.02, flatShading: true });
  const dunes = new THREE.InstancedMesh(duneGeo, duneMat, 56);
  dunes.castShadow = true;
  dunes.receiveShadow = true;
  let n = 0;
  function plantDune(x, z) {
    if (n >= 56) return;
    const s = 6 + Math.random() * 10;
    dummy.position.set(x, terrainH(x, z) - s * 0.35, z);
    dummy.scale.set(s * (0.9 + Math.random() * 0.4), s * 0.34, s * (0.9 + Math.random() * 0.4));
    dummy.rotation.y = Math.random() * 6;
    dummy.updateMatrix();
    dunes.setMatrixAt(n++, dummy.matrix);
  }
  clusterAlong(0.14, 0.40, -1, 55, 110, 28, plantDune);
  clusterAlong(0.60, 0.84, 1, 60, 115, 24, plantDune);
  dunes.count = n;
  dunes.instanceMatrix.needsUpdate = true;
  scene.add(dunes);

  const craterMat = new THREE.MeshStandardMaterial({ color: 0x6A3224, roughness: 0.96, metalness: 0.02 });
  clusterAlong(0.47, 0.53, -1, 42, 70, 5, (x, z, i) => {
    const r = 7 + i * 1.4;
    const crater = new THREE.Mesh(new THREE.TorusGeometry(r, 1.1, 6, 16), craterMat);
    crater.rotation.x = -Math.PI / 2;
    crater.position.set(x, terrainH(x, z) + 0.15, z);
    crater.receiveShadow = true;
    scene.add(crater);
  });

  const crateMat = new THREE.MeshStandardMaterial({ color: 0x6a4a32, roughness: 0.7, metalness: 0.25 });
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1a2430, metalness: 0.72, roughness: 0.28, emissive: 0x102030, emissiveIntensity: 0.35
  });
  const colony = [
    [PAD_ROCKET_X - 10, PAD_ROCKET_Z + 14],
    [PAD_ROCKET_X - 14, PAD_ROCKET_Z + 8],
    [PAD_ROCKET_X - 7, PAD_ROCKET_Z + 20],
    [PAD_ROCKET_X - 18, PAD_ROCKET_Z + 16],
    [PAD_ROCKET_X - 12, PAD_ROCKET_Z + 26]
  ];
  colony.forEach(([x, z], i) => {
    if (minDistToPath(x, z) < HALF_W + 10) return;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.4), crateMat);
    crate.position.set(x, terrainH(x, z) + 0.55, z);
    crate.rotation.y = i * 0.7;
    crate.castShadow = true;
    scene.add(crate);
    addCollider(x, z, 1.3);
    if (i < 3) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 1.5), panelMat);
      panel.position.set(x - 3, terrainH(x - 3, z) + 0.7, z + 2);
      panel.rotation.set(-0.4, 0.4, 0);
      panel.castShadow = true;
      scene.add(panel);
    }
  });
})();

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
const GROUND_SIT = 0.16;

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
const muzzle = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 6, 6),
  new THREE.MeshBasicMaterial({ color: 0xffee88, toneMapped: false, fog: false })
);
muzzle.position.set(0.55, 1.18, 2.72);
muzzle.visible = false;
truck.add(muzzle);
let muzzleT = 0;
let fireCd = 0;
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


const olympus = new THREE.Group();
{
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a4a34, roughness: 0.97, metalness: 0.02, flatShading: true, fog: false });
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(18, 58, 118, 28, 4, true), mat);
  shield.position.y = 118 * 0.5 - 22;
  shield.castShadow = true;
  olympus.add(shield);
  const frost = new THREE.Mesh(new THREE.CylinderGeometry(18, 28, 40, 20, 1, true), new THREE.MeshStandardMaterial({
    color: 0xf3eee4, roughness: 0.7, emissive: 0xd8d0c4, emissiveIntensity: 0.4, fog: false, flatShading: true
  }));
  frost.position.y = 96 - 20;
  olympus.add(frost);
}
olympus.position.set(700, 0, 900);
scene.add(olympus);


const rocket = padRocket();
rocket.position.set(PAD_ROCKET_X, PAD_ROCKET_Y, PAD_ROCKET_Z);
rocket.scale.setScalar(0.45);
scene.add(rocket);

function placeOutside(dist0) {
  const t = Math.random();
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t);
  const r = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const side = Math.random() < 0.5 ? 1 : -1;
  const ddx = p.x - PAD_ROCKET_X, ddz = p.z - PAD_ROCKET_Z;
  if (side < 0 && ddx * ddx + ddz * ddz < 120 * 120) return null;
  let dist = HALF_W + dist0;
  let x = p.x + r.x * side * dist;
  let z = p.z + r.z * side * dist;
  for (let k = 0; k < 8; k++) {
    if (minDistToPath(x, z) > CLEAR) return { x, z, side, t };
    dist += 8;
    x = p.x + r.x * side * dist;
    z = p.z + r.z * side * dist;
  }
  return null;
}

(function scatterRocks() {
  const urls = ["./mesh/rock-a.stl", "./mesh/rock-b.stl", "./mesh/rock-c.stl", "./mesh/rock-d.stl"];
  const loader = new STLLoader();
  urls.forEach((url, vi) => {
    loader.load(url, (geo) => {
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      geo.translate(-(bb.min.x + bb.max.x) * 0.5, -(bb.min.y + bb.max.y) * 0.5, -bb.min.z);
      geo.rotateX(-Math.PI / 2);
      geo.computeBoundingBox();
      const h = geo.boundingBox.max.y - geo.boundingBox.min.y;
      const span = Math.max(geo.boundingBox.max.x - geo.boundingBox.min.x, geo.boundingBox.max.z - geo.boundingBox.min.z);
      const mat = new THREE.MeshStandardMaterial({
        color: [0xA6583D, 0x8B3A2B, 0x733021, 0x4A251D][vi], roughness: 0.94, metalness: 0.03, side: THREE.DoubleSide
      });
      clusterAlong(0.16, 0.36, 1, 22, 38, 4, (x, z, k) => {
        let s = (2.6 + ((k + vi) % 3) * 0.45) / Math.max(h, 0.2);
        const foot = span * s;
        if (minDistToPath(x, z) - foot * 0.5 < CLEAR) return;
        const m = new THREE.Mesh(geo, mat);
        m.scale.setScalar(s);
        m.position.set(x, terrainH(x, z) - 0.1, z);
        m.rotation.y = k * 1.7 + vi;
        m.castShadow = true;
        m.receiveShadow = true;
        scene.add(m);
        addCollider(x, z, Math.max(1.6, foot * 0.38));
      });
    });
  });
})();

(function scatterHills() {
  const urls = ["./mesh/hill-a.stl", "./mesh/hill-b.stl", "./mesh/hill-c.stl"];
  const loader = new STLLoader();
  urls.forEach((url, vi) => {
    loader.load(url, (geo) => {
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      geo.translate(-(bb.min.x + bb.max.x) * 0.5, -(bb.min.y + bb.max.y) * 0.5, -bb.min.z);
      geo.rotateX(-Math.PI / 2);
      geo.computeBoundingBox();
      const h = Math.max(0.2, geo.boundingBox.max.y - geo.boundingBox.min.y);
      const span = Math.max(geo.boundingBox.max.x - geo.boundingBox.min.x, geo.boundingBox.max.z - geo.boundingBox.min.z);
      const mat = new THREE.MeshStandardMaterial({
        color: [0xC47858, 0xA6583D, 0x8B3A2B][vi], roughness: 0.96, metalness: 0.02, side: THREE.DoubleSide, flatShading: true
      });
      const hillTs = [0.20, 0.32, 0.68];
      hillTs.forEach((ht, ji) => {
        if (vi !== ji % 3) return;
        const p = curve.getPointAt(ht);
        const tan = curve.getTangentAt(ht);
        const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
        const side = ht < 0.5 ? -1 : 1;
        const dist = HALF_W + 72;
        const x = p.x + right.x * side * dist;
        const z = p.z + right.z * side * dist;
        const s = (9 + vi * 2) / h;
        const foot = span * s;
        if (minDistToPath(x, z) - foot * 0.45 < HALF_W + 18) return;
        const m = new THREE.Mesh(geo, mat);
        m.scale.setScalar(s);
        m.position.set(x, terrainH(x, z) - 0.4, z);
        m.rotation.y = ji * 0.9 + vi;
        m.castShadow = true;
        m.receiveShadow = true;
        scene.add(m);
        addCollider(x, z, Math.max(2.2, foot * 0.32));
      });
    });
  });
})();

(function placeMountains() {
  const loader = new STLLoader();
  const spots = [
    { url: "./mesh/mountain-a.stl", x: -220, z: 700 },
    { url: "./mesh/mountain-b.stl", x: -200, z: 1200 },
    { url: "./mesh/mountain-c.stl", x: 860, z: 900 }
  ];
  spots.forEach((sp) => {
    if (minDistToPath(sp.x, sp.z) < HALF_W + 70) return;
    loader.load(sp.url, (geo) => {
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      geo.translate(-(bb.min.x + bb.max.x) * 0.5, -(bb.min.y + bb.max.y) * 0.5, -bb.min.z);
      const hold = new THREE.Group();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: 0x8B3A2B, roughness: 0.95, metalness: 0.03, side: THREE.DoubleSide
      }));
      m.rotation.x = -Math.PI / 2;
      m.castShadow = true;
      hold.add(m);
      hold.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(hold);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 1);
      hold.scale.setScalar(Math.min(0.35, 40 / maxDim));
      hold.position.set(sp.x, terrainH(sp.x, sp.z) - 2, sp.z);
      if (minDistToPath(sp.x, sp.z) < HALF_W + 70) return;
      scene.add(hold);
    });
  });
})();

function sitGeo(geo, targetLen, maxH) {
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.min.x + bb.max.x) * 0.5, -(bb.min.y + bb.max.y) * 0.5, -(bb.min.z + bb.max.z) * 0.5);
  geo.computeBoundingBox();
  const size = new THREE.Vector3();
  geo.boundingBox.getSize(size);
  if (size.y >= size.x && size.y >= size.z) geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  else if (size.x >= size.y && size.x >= size.z) geo.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  geo.computeBoundingBox();
  geo.boundingBox.getSize(size);
  let sc = targetLen / Math.max(size.z, 1e-3);
  if (size.y * sc > maxH) sc = maxH / Math.max(size.y, 1e-3);
  geo.scale(sc, sc, sc);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
}

const rivalKitGeo = { body: null };
{
  const loader = new STLLoader();
  loader.load("./mesh/interceptor-body.stl", (geo) => {
    sitGeo(geo, 5.4, 2.15);
    rivalKitGeo.body = geo;
  });
  loader.load("./mesh/worker.stl", (geo) => {
    sitGeo(geo, 0.7, 1.8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xb8a090, roughness: 0.7, metalness: 0.08 });
    [[PAD_ROCKET_X - 9, PAD_ROCKET_Z + 12], [PAD_ROCKET_X - 16, PAD_ROCKET_Z + 18]].forEach(([x, z], i) => {
      if (minDistToPath(x, z) < HALF_W + 8) return;
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, terrainH(x, z), z);
      m.rotation.y = i * 1.1 + 0.4;
      m.castShadow = true;
      scene.add(m);
    });
  });
}

const _w = new THREE.Vector3();
const _p = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
const _gateNdc = new THREE.Vector3();

function dustSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grd.addColorStop(0, "rgba(232,176,120,1)");
  grd.addColorStop(0.4, "rgba(210,130,80,0.55)");
  grd.addColorStop(1, "rgba(196,120,88,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const DUST_N = 500;
const dustPos = new Float32Array(DUST_N * 3);
const dustVel = new Float32Array(DUST_N * 3);
const dustLife = new Float32Array(DUST_N);
const dummy = new THREE.Object3D();
const dustMesh = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({
    map: dustSprite(), color: 0xF2B888, transparent: true, depthWrite: false,
    fog: false, toneMapped: false, side: THREE.DoubleSide
  }),
  DUST_N
);
dustMesh.frustumCulled = false;
dustMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
for (let i = 0; i < DUST_N; i++) {
  dummy.position.set(0, -80, 0);
  dummy.scale.setScalar(0.001);
  dummy.updateMatrix();
  dustMesh.setMatrixAt(i, dummy.matrix);
}
scene.add(dustMesh);
let dustCursor = 0;
function emitDust(x, y, z, fx, fz, n) {
  const count = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const k = dustCursor++ % DUST_N;
    const i3 = k * 3;
    dustPos[i3] = x + (Math.random() - 0.5) * 0.2;
    dustPos[i3 + 1] = y;
    dustPos[i3 + 2] = z + (Math.random() - 0.5) * 0.2;
    dustVel[i3] = -fx * (1 + Math.random()) + (Math.random() - 0.5);
    dustVel[i3 + 1] = 0.5 + Math.random();
    dustVel[i3 + 2] = -fz * (1 + Math.random()) + (Math.random() - 0.5);
    dustLife[k] = 0.5 + Math.random() * 0.5;
  }
}
function stepDust(dt) {
  for (let i = 0; i < DUST_N; i++) {
    if (dustLife[i] > 0) {
      const i3 = i * 3;
      dustVel[i3] *= Math.exp(-1.2 * dt);
      dustVel[i3 + 1] -= 2.2 * dt;
      dustVel[i3 + 2] *= Math.exp(-1.2 * dt);
      dustPos[i3] += dustVel[i3] * dt;
      dustPos[i3 + 1] += dustVel[i3 + 1] * dt;
      dustPos[i3 + 2] += dustVel[i3 + 2] * dt;
      dustLife[i] -= dt;
    }
    dummy.quaternion.copy(camera.quaternion);
    if (dustLife[i] > 0) {
      dummy.position.set(dustPos[i * 3], dustPos[i * 3 + 1], dustPos[i * 3 + 2]);
      dummy.scale.setScalar(1.4 + dustLife[i]);
    } else {
      dummy.position.set(0, -80, 0);
      dummy.scale.setScalar(0.001);
    }
    dummy.updateMatrix();
    dustMesh.setMatrixAt(i, dummy.matrix);
  }
  dustMesh.instanceMatrix.needsUpdate = true;
}

const gateTs = [0.07, 0.35, 0.50, 0.70, 0.97];
function makeGate(index, t) {
  const { p, tan } = placeOnTrack(t);
  const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const fwd = new THREE.Vector3(tan.x, 0, tan.z).normalize();
  const y = terrainH(p.x, p.z);
  const hw = HALF_W - 0.8;
  const g = new THREE.Group();
  [-1, 1].forEach((s) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 8.4, 0.28), trussMat);
    post.position.set(p.x + right.x * s * hw, y + 4.2, p.z + right.z * s * hw);
    post.castShadow = true;
    g.add(post);
  });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.4, 0.28, 0.28), trussMat);
  beam.position.set(p.x, y + 8.4, p.z);
  g.add(beam);
  scene.add(g);
  return { index, t, pos: p.clone().setY(y), forward: fwd, right, halfW: hw };
}
const gates = gateTs.map((t, i) => makeGate(i, t));

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
const elPlaceVal = document.getElementById("place-val");
const elCount = document.getElementById("count");
const elFinishLabel = document.getElementById("finish-label");
const elLiveryTap = document.getElementById("livery-tap");

function fmtTime(ms) {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const d = Math.floor(t % 1000);
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "." + String(d).padStart(3, "0");
}

const MAX_SPEED = 78;
const BOOST_SPEED = 102;
const TURBO_SPEED = 118;
const GRAVITY = 28;
const car = {
  x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0,
  speed: 0, lat: 0, boost: 1, overheating: false, spinT: 0,
  vy: 0, air: false, turboT: 0
};
const pickups = [];
let startLock = true, countT = 3.5, falseStart = false, holdLaunch = false;
let playerWon = true;
let nextGate = 0, gatesHit = 0, lapDriven = 0, lastT = START_T, prevDriveT = START_T;
let lastClearT = START_T, lastClearYaw = 0, prevGateSide = 0;
let timeMs = 0, finished = false, steerVis = 0, camReady = false, padPrevRec = false;
let flashT = 0, toastT = 0, offHold = 0;

function headingAt(t) {
  const tan = curve.getTangentAt(t);
  return Math.atan2(tan.x, tan.z);
}
function placeCar(t, yaw) {
  const { p } = placeOnTrack(t);
  car.x = p.x; car.z = p.z;
  car.y = terrainH(p.x, p.z) + GROUND_SIT;
  car.yaw = yaw; car.pitch = 0; car.roll = 0;
  car.speed = 0; car.lat = 0; car.vy = 0; car.air = false;
}
function syncTruck() {
  truck.position.set(car.x, car.y, car.z);
  truck.rotation.set(car.pitch, car.yaw, car.roll, "YXZ");
}
function sitWheels() {
  const wr = truck.userData.wheelRadius || 0.74;
  if (car.air) {
    truck.userData.wheels.forEach((w) => { w.hub.position.set(w.x, wr, w.z); });
    return;
  }
  truck.updateMatrixWorld(true);
  truck.userData.wheels.forEach((w) => {
    _p.set(w.x, 0, w.z);
    truck.localToWorld(_p);
    const deck = trackH(_p.x, _p.z) + RIBBON_LIFT;
    _w.set(_p.x, deck + wr, _p.z);
    truck.worldToLocal(_w);
    w.hub.position.set(w.x, THREE.MathUtils.clamp(_w.y, wr - 0.01, wr + 0.28), w.z);
  });
}

function showToast(msg, dur) {
  if (!elFailToast) return;
  elFailToast.textContent = msg;
  elFailToast.classList.add("show");
  toastT = dur == null ? 1.1 : dur;
}
function cycleLivery() {
  liveryIdx = (liveryIdx + 1) % LIVERIES.length;
  const L = LIVERIES[liveryIdx];
  [steelBody, steelStl].forEach((m) => {
    m.color.setHex(L.color); m.metalness = L.metalness; m.roughness = L.roughness;
    m.envMapIntensity = L.env; m.needsUpdate = true;
  });
  if (elLiveryTap) elLiveryTap.style.backgroundColor = "#" + L.color.toString(16).padStart(6, "0");
  showToast(L.name, 0.7);
}
function spinOut(t) {
  if (car.spinT > 0) return;
  car.spinT = t || 1.05;
  car.speed *= 0.35;
  showToast("SPIN OUT", 0.7);
}
function onRetry() { spawnStart(); }

function spawnStart() {
  lastClearT = START_T;
  lastClearYaw = headingAt(START_T);
  placeCar(START_T, lastClearYaw);
  {
    const pr = projectTrack(_p.set(car.x, 0, car.z));
    car.x -= pr.right.x * 3.2;
    car.z -= pr.right.z * 3.2;
  }
  nextGate = 0; gatesHit = 0; lapDriven = 0;
  lastT = START_T; prevDriveT = START_T; timeMs = 0; finished = false;
  car.boost = 1; car.overheating = false; car.spinT = 0;
  car.vy = 0; car.air = false; car.turboT = 0;
  startLock = true; countT = 3.5; falseStart = false; holdLaunch = false;
  playerWon = true;
  pickups.forEach((p) => { p.taken = 0; if (p.mesh) p.mesh.visible = true; });
  rivals.forEach((r) => {
    r.spinT = 0; r.t = START_T; r.lat = 3.2; r.speed = 62; r.laps = 0; r.prevT = START_T;
    if (r.mesh) r.mesh.rotation.set(0, headingAt(START_T), 0, "YXZ");
  });
  steerVis = 0; offHold = 0;
  if (elFinish) elFinish.classList.remove("show");
  if (elFailToast) elFailToast.classList.remove("show");
  toastT = 0;
  prevGateSide = (car.x - gates[0].pos.x) * gates[0].forward.x + (car.z - gates[0].pos.z) * gates[0].forward.z;
  syncTruck(); sitWheels();
  camera.position.set(car.x + 3, car.y + 6.55, car.z - 16.4);
  camera.lookAt(car.x, car.y + 1.7, car.z + 6);
  camReady = false;
}

function readControls() {
  let th = 0, st = 0, hb = false, bo = false;
  if (keys.KeyW || keys.ArrowUp) th += 1;
  if (keys.KeyS || keys.ArrowDown) th -= 1;
  if (keys.KeyA || keys.ArrowLeft) st -= 1;
  if (keys.KeyD || keys.ArrowRight) st += 1;
  if (keys.ShiftLeft || keys.ShiftRight) hb = true;
  if (keys.Space) bo = true;
  th += touchCtl.th; st += touchCtl.st;
  if (touchCtl.bo) bo = true;
  return { th: Math.max(-1, Math.min(1, th)), st: Math.max(-1, Math.min(1, st)), hb, bo };
}

function drive(dt) {
  const ctl = readControls();
  let th = ctl.th, st = -ctl.st, hb = ctl.hb, bo = ctl.bo;
  if (startLock) {
    if (countT > 1.08 && th > 0.25) falseStart = true;
    if (countT <= 1.08 && countT > 0.12 && th > 0.25) holdLaunch = true;
    countT -= dt;
    th = 0; st = 0; bo = false; hb = false;
    if (countT <= 0) {
      startLock = false;
      if (falseStart) { showToast("FALSE START", 0.9); car.speed = 0; }
      else if (holdLaunch) { car.speed = 24; car.boost = 1; showToast("LAUNCH", 0.55); }
      else car.speed = 10;
    }
    const fx0 = Math.sin(car.yaw), fz0 = Math.cos(car.yaw);
    syncTruck(); sitWheels();
    return { boosting: false, fx: fx0, fz: fz0 };
  }
  if (car.spinT > 0) {
    car.spinT -= dt;
    th = 0; st = 0; bo = false; hb = false;
    car.yaw += 7.5 * dt * Math.sign(car.spinT % 0.4 - 0.2 || 1);
    car.speed *= Math.exp(-1.8 * dt);
    if (car.spinT <= 0) showToast("GO", 0.4);
  }
  if (finished) { th = 0; st = 0; bo = false; car.speed *= Math.exp(-2.2 * dt); }
  else {
    if (bo && car.boost > 0) {
      car.boost = Math.max(0, car.boost - BOOST_DRAIN * dt);
      if (car.boost <= 0) { car.boost = 0; car.overheating = true; }
    } else {
      car.overheating = false;
      car.boost = Math.min(1, car.boost + BOOST_REGEN * dt);
    }
  }
  const boosting = !finished && bo && car.boost > 0 && !car.overheating;
  if (car.overheating) th *= 0.55;
  steerVis += (st - steerVis) * Math.min(1, dt * 10);
  const spdAbs = Math.abs(car.speed);
  const mph = spdAbs * 2.236936;
  let steerEff = spdAbs < 0.5 ? 0 : Math.min(1, spdAbs / 4);
  if (mph > 80) steerEff *= Math.max(0.38, 1 - (mph - 80) * 0.0032);
  if (car.air) steerEff *= 0.55;
  car.yaw += steerVis * (hb ? 2.4 : 2.05) * steerEff * (car.speed >= 0 ? 1 : -1) * dt;
  if (car.turboT > 0) car.turboT -= dt;
  const vmax = car.turboT > 0 ? TURBO_SPEED : (boosting ? BOOST_SPEED : MAX_SPEED);
  const accel = car.air ? 14 : 48;
  if (th > 0) car.speed += th * accel * (boosting || car.turboT > 0 ? 2.05 : 1) * (1 - Math.max(0, car.speed) / (vmax + 14)) * dt;
  else if (th < 0) car.speed += th * (car.speed > 0.4 ? 40 : 14) * dt;
  if (!car.air) car.speed -= car.speed * (0.14 + (hb ? 1.35 : 0) + spdAbs * 0.0016) * dt;
  if (car.speed > vmax) car.speed = THREE.MathUtils.lerp(car.speed, vmax, 1 - Math.exp(-1.6 * dt));
  if (car.speed < -12) car.speed = -12;

  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  const rx = Math.cos(car.yaw), rz = -Math.sin(car.yaw);
  car.lat += steerVis * car.speed * 0.08 * dt;
  car.lat *= Math.exp(-8 * dt);
  car.x += (fx * car.speed + rx * car.lat) * dt;
  car.z += (fz * car.speed + rz * car.lat) * dt;

  let proj = projectTrack(_p.set(car.x, 0, car.z));
  let dTrack = proj.t - lastT;
  if (dTrack < -0.5) dTrack += 1;
  if (dTrack > 0.5) dTrack -= 1;
  if (dTrack > 0) lapDriven += dTrack;
  prevDriveT = lastT;
  lastT = proj.t;

  const off = Math.max(0, Math.abs(proj.offset) - HALF_W);
  if (off > 0 && !car.air) {
    car.speed -= car.speed * (0.55 + off * 0.03) * dt;
    if (spdAbs > 4) emitDust(car.x, car.y + 0.3, car.z, fx, fz, 18 * dt);
  }
  if (Math.abs(proj.offset) > 70) {
    const sign = Math.sign(proj.offset);
    car.x -= proj.right.x * sign * 10 * dt;
    car.z -= proj.right.z * sign * 10 * dt;
  }
  if (!car.air) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      const d = Math.hypot(car.x - c.x, car.z - c.z);
      if (d < c.r + 1.4) {
        const nx = (car.x - c.x) / (d || 1), nz = (car.z - c.z) / (d || 1);
        car.x += nx * 0.35; car.z += nz * 0.35;
        car.speed *= 0.72;
        if (spdAbs > 12 && car.spinT <= 0) spinOut(0.9);
      }
    }
  }

  const groundY = terrainH(car.x, car.z) + GROUND_SIT;
  const yA = terrainH(car.x + fx * 3.2, car.z + fz * 3.2);
  const yB = terrainH(car.x - fx * 3.2, car.z - fz * 3.2);
  const hit = jumpAtT(proj.t);
  const onTake = hit && (hit.j.kind === "valley" || hit.j.kind === "table") && hit.u >= 0.18 && hit.u <= 0.30;
  if (!car.air) {
    car.y = groundY;
    car.vy = 0;
    const wantPitch = THREE.MathUtils.clamp(Math.atan2(yA - yB, 6.4), -0.45, 0.45);
    car.pitch += (wantPitch - car.pitch) * Math.min(1, dt * 9);
    if (car.spinT <= 0 && spdAbs > 18 && onTake) {
      const ang = Math.atan2(hit.j.h, Math.max(12, hit.j.len * 0.22));
      car.air = true;
      car.vy = Math.sin(ang) * spdAbs * 1.05 + (boosting || car.turboT > 0 ? 4.2 : 0.8);
      car.speed += boosting || car.turboT > 0 ? 5 : 2;
    }
  } else {
    car.vy -= GRAVITY * dt;
    car.y += car.vy * dt;
    let look = 14 + spdAbs * 0.1;
    let yLand = terrainH(car.x + fx * look, car.z + fz * look);
    if (yLand < car.y - 2.5) {
      look *= 1.7;
      yLand = terrainH(car.x + fx * look, car.z + fz * look);
    }
    const wantPitch = THREE.MathUtils.clamp(Math.atan2(yLand - car.y, look), -0.5, 0.5);
    car.pitch += (wantPitch - car.pitch) * Math.min(1, dt * 6);
    if (car.y <= groundY) {
      car.y = groundY;
      car.vy = 0;
      car.air = false;
      const slope = Math.atan2(yA - yB, 6.4);
      const mismatch = Math.abs(car.pitch - slope);
      if (mismatch > 0.6 && spdAbs > 12) spinOut(0.8);
      else if (mismatch < 0.25) {
        car.speed = Math.min(vmax, car.speed + 8);
        car.boost = Math.min(1, car.boost + 0.12);
      } else car.speed *= 0.88;
      emitDust(car.x, car.y + 0.2, car.z, fx, fz, 10);
    }
  }
  if (car.spinT > 0) car.roll = Math.sin(car.spinT * 16) * 0.42;
  else {
    const wantRoll = THREE.MathUtils.clamp(-steerVis * spdAbs * 0.004, -0.12, 0.12);
    car.roll += (wantRoll - car.roll) * Math.min(1, dt * 5);
  }
  boostGlow.intensity = boosting ? 3.4 : 0;
  brakeGlow.intensity = th < 0 ? 2.4 : 0;

  if (!finished) {
    const g = gates[nextGate];
    const side = (car.x - g.pos.x) * g.forward.x + (car.z - g.pos.z) * g.forward.z;
    const lat = (car.x - g.pos.x) * g.right.x + (car.z - g.pos.z) * g.right.z;
    if (prevGateSide < 0.15 && side >= 0 && Math.abs(lat) < g.halfW + 1.4 && spdAbs > MIN_GATE_SPEED) {
      lastClearT = (g.t + 0.01) % 1;
      lastClearYaw = Math.atan2(g.forward.x, g.forward.z);
      gatesHit++;
      flashT = 0.12;
      showToast("GATE " + (g.index + 1), 0.7);
      if (nextGate === GATE_COUNT - 1) {
        if (gatesHit >= GATE_COUNT && lapDriven >= MIN_LAP_FRAC) {
          finished = true;
          playerWon = true;
          if (elFinishLabel) elFinishLabel.textContent = "YOU WIN";
          elFinishTime.textContent = fmtTime(timeMs);
          elFinish.classList.add("show");
        } else { nextGate = 0; gatesHit = 0; lapDriven = 0; }
      } else nextGate++;
    }
    prevGateSide = side;
  }

  const wr = truck.userData.wheelRadius || 0.74;
  truck.userData.wheels.forEach((w) => {
    w.spin.rotation.x += car.speed * dt / wr;
    w.hub.rotation.y = w.front ? steerVis * 0.45 : 0;
  });
  syncTruck();
  sitWheels();
  if (spdAbs > 1 && !car.air) {
    truck.userData.wheels.forEach((w) => {
      if (w.front) return;
      w.spin.getWorldPosition(_w);
      emitDust(_w.x, _w.y - wr + 0.2, _w.z, fx, fz, 40 * Math.min(1, spdAbs / 30) * dt * (boosting ? 1.5 : 1));
    });
  }
  return { boosting, fx, fz };
}

const rivals = [];
const RIVAL_COLORS = [0xff3300, 0x11aa44, 0x2255ee, 0xffcc00, 0xaa22cc, 0x111111, 0xf4f4f0, 0xff6600, 0x6E7378, 0x8C7360];
function addRivalWheels(g, monster) {
  const wr = monster ? 0.92 : 0.7;
  const wg = new THREE.CylinderGeometry(wr, wr, monster ? 0.72 : 0.5, 8);
  wg.rotateZ(Math.PI / 2);
  const track = monster ? 1.35 : 1.15;
  const wb = monster ? 1.55 : 1.5;
  [[-track, wb], [track, wb], [-track, -wb], [track, -wb]].forEach(([x, z]) => {
    const w = new THREE.Mesh(wg, rubberMat);
    w.position.set(x, wr, z);
    w.castShadow = true;
    g.add(w);
  });
}
function paintRivalKit(kit, hex) {
  const bodyMat = steelStl.clone();
  bodyMat.color.setHex(hex);
  bodyMat.emissive = new THREE.Color(hex);
  bodyMat.emissiveIntensity = 0.07;
  kit.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === "windshield") o.material = glassMat;
    else if (o.name === "tail-bar") o.material = tailMat.clone();
    else o.material = bodyMat;
    o.castShadow = true;
  });
}
function playerKitReady() {
  const src = truck.getObjectByName("stlBody");
  return src && src.children.length >= 3;
}
function makeRival(kind, hex, monster) {
  const g = new THREE.Group();
  const mat = steelBody.clone();
  mat.color.setHex(hex);
  mat.emissive = new THREE.Color(hex);
  mat.emissiveIntensity = 0.08;
  if (kind === "truck" && playerKitReady()) {
    const kit = truck.getObjectByName("stlBody").clone(true);
    paintRivalKit(kit, hex);
    if (monster) kit.scale.multiplyScalar(1.16);
    g.add(kit);
  } else if (kind === "interceptor" && rivalKitGeo.body) {
    const hull = new THREE.Mesh(rivalKitGeo.body, mat);
    hull.castShadow = true;
    if (monster) hull.scale.set(1.12, 1.2, 1.08);
    g.add(hull);
  } else {
    const hull = new THREE.Mesh(wedgeHullGeo(), mat);
    hull.castShadow = true;
    if (monster) hull.scale.set(1.12, 1.35, 1.08);
    g.add(hull);
    kind = "wedge";
  }
  addRivalWheels(g, monster);
  if (monster) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), blackBar);
    bar.position.set(0, 2.35, 0.2);
    g.add(bar);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 0.55), new THREE.MeshBasicMaterial({ color: hex, toneMapped: false }));
    flag.position.set(0.7, 2.7, -1.4);
    g.add(flag);
  }
  scene.add(g);
  g.userData.monster = monster;
  g.userData.hex = hex;
  g.userData.kind = kind;
  return g;
}
function spawnRivals() {
  if (!rivals.length) {
    rivals.push({
      mesh: makeRival("wedge", 0x161618, false),
      t: START_T, lat: 3.2, speed: 62, spinT: 0, laps: 0, prevT: START_T,
      hex: 0x161618, monster: false, kind: "wedge", upgraded: false
    });
  }
  const r = rivals[0];
  if (r && !r.upgraded && playerKitReady()) {
    scene.remove(r.mesh);
    r.mesh = makeRival("truck", 0x161618, false);
    r.kind = "truck";
    r.upgraded = true;
  }
}
function grant(kind) {
  if (kind === "TURBO") {
    car.turboT = 1.7;
    car.overheating = false;
    showToast("TURBO", 0.6);
  }
}
(function seedPickups() {
  const spots = [0.15, 0.33, 0.45, 0.66, 0.80];
  spots.forEach((t, i) => {
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const lat = (i % 2 ? 1 : -1) * 4.2;
    const x = p.x + right.x * lat, z = p.z + right.z * lat;
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.62),
      new THREE.MeshBasicMaterial({ color: 0xE23B32, toneMapped: false, fog: false })
    );
    mesh.position.set(x, terrainH(x, z) + 1.15, z);
    scene.add(mesh);
    pickups.push({ kind: "TURBO", x, z, mesh, taken: 0 });
  });
})();
function stepRivals(dt) {
  spawnRivals();
  pickups.forEach((p) => {
    if (p.mesh) {
      p.mesh.rotation.y += dt * 2.4;
      p.mesh.position.y = terrainH(p.x, p.z) + 1.15 + Math.sin(timeMs * 0.006 + p.x) * 0.18;
    }
    if (p.taken > 0) { p.taken -= dt; if (p.taken <= 0 && p.mesh) p.mesh.visible = true; return; }
    if (!startLock && Math.hypot(p.x - car.x, p.z - car.z) < 2.4) {
      grant(p.kind);
      p.taken = 11;
      if (p.mesh) p.mesh.visible = false;
    }
  });
  const r = rivals[0];
  if (!r) return;
  if (startLock) {
    const p0 = curve.getPointAt(r.t);
    const tan0 = curve.getTangentAt(r.t);
    const right0 = new THREE.Vector3(tan0.z, 0, -tan0.x).normalize();
    const x0 = p0.x + right0.x * r.lat;
    const z0 = p0.z + right0.z * r.lat;
    r.mesh.position.set(x0, terrainH(x0, z0) + GROUND_SIT, z0);
    r.mesh.rotation.set(0, Math.atan2(tan0.x, tan0.z), 0, "YXZ");
    return;
  }
  if (r.spinT > 0) {
    r.spinT -= dt;
    r.mesh.rotation.y += 6 * dt;
    r.speed *= Math.exp(-1.6 * dt);
  } else {
    const lead = r.t - lastT;
    let wrapped = lead;
    if (wrapped > 0.5) wrapped -= 1;
    if (wrapped < -0.5) wrapped += 1;
    r.speed = 62;
    if (wrapped < -0.025) r.speed = 74;
    if (wrapped > 0.035) r.speed = 50;
    r.prevT = r.t;
    r.t = (r.t + (r.speed / trackLen) * dt) % 1;
    if (r.prevT > 0.7 && r.t < 0.2) r.laps += 1;
    if (Math.abs(r.lat) > HALF_W + 1.5) r.lat += -Math.sign(r.lat) * 4 * dt;
    else {
      const want = 3.2;
      r.lat += (want - r.lat) * Math.min(1, dt * 0.6);
      const dClose = Math.hypot(r.mesh.position.x - car.x, r.mesh.position.z - car.z);
      if (dClose < 10 && dClose > 3) r.lat += Math.sign(car.x ? 1 : 1) * 0.4 * dt;
    }
  }
  const p = curve.getPointAt(r.t);
  const tan = curve.getTangentAt(r.t);
  const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const x = p.x + right.x * r.lat;
  const z = p.z + right.z * r.lat;
  const yaw = Math.atan2(tan.x, tan.z);
  r.mesh.position.set(x, terrainH(x, z) + GROUND_SIT, z);
  if (r.spinT <= 0) r.mesh.rotation.set(0, yaw, 0, "YXZ");
  const d = Math.hypot(x - car.x, z - car.z);
  if (d < 3.15 && car.spinT <= 0 && r.spinT <= 0) {
    const nx = (car.x - x) / (d || 1), nz = (car.z - z) / (d || 1);
    const rel = Math.abs(car.speed) - Math.abs(r.speed);
    car.x += nx * 0.22; car.z += nz * 0.22;
    r.lat -= nx * right.x * 0.55 - nz * right.z * 0.15;
    if (rel > 4) {
      r.lat -= Math.sign(r.lat || 1) * 0.35;
      if (Math.abs(r.lat) > HALF_W + 0.8) {
        r.spinT = 1.05; r.speed *= 0.45;
        car.boost = Math.min(1, car.boost + 0.28);
        showToast("RAM", 0.45);
      }
    } else if (rel < -6) {
      car.speed *= 0.82;
      if (Math.abs((car.x - p.x) * right.x + (car.z - p.z) * right.z) > HALF_W + 1.2 && car.spinT <= 0) spinOut(0.85);
    }
  }
  if (!finished && r.laps >= 1 && r.t > START_T + 0.01) {
    finished = true;
    playerWon = false;
    if (elFinishLabel) elFinishLabel.textContent = "RIVAL WINS";
    if (elFinishTime) elFinishTime.textContent = fmtTime(timeMs);
    if (elFinish) elFinish.classList.add("show");
  }
}

function chaseCam(dt, boosting) {
  const sx = Math.sin(car.yaw), cz = Math.cos(car.yaw);
  const spd = Math.abs(car.speed);
  if (PROOF === "A") {
    camera.position.set(car.x + 7, car.y + 4.4, car.z + 9.2);
    camera.lookAt(car.x, car.y + 2.2, car.z);
    camera.fov = 36;
  } else if (PROOF === "B") {
    camera.position.set(car.x + 3.0, car.y + 6.55, car.z - 16.4);
    camera.lookAt(car.x + sx * 6.2, car.y + 1.7, car.z + cz * 6.2);
    camera.fov = 50;
  } else {
    const back = 17 + Math.min(6, spd * 0.04);
    const h = 7.0 + Math.min(2.5, spd * 0.015) + (car.air ? 1.6 : 0);
    const side = 1.6;
    _cam.set(car.x - sx * back + cz * side, car.y + h, car.z - cz * back - sx * side);
    const k = camReady ? 1 - Math.exp(-8 * dt) : 1;
    camera.position.lerp(_cam, k);
    _look.set(car.x + sx * 18, car.y + 1.2, car.z + cz * 18);
    camera.lookAt(_look);
    camera.fov += ((48 + Math.min(6, spd * 0.03) + (boosting ? 2 : 0)) - camera.fov) * Math.min(1, dt * 3);
  }
  const floor = trackH(camera.position.x, camera.position.z) + 4.2;
  if (camera.position.y < floor) camera.position.y = floor;
  camera.updateProjectionMatrix();
  camReady = true;
  sun.target.position.set(car.x, car.y, car.z);
  sun.position.set(car.x - 36, car.y + 32, car.z - 24);
  fill.target.position.set(car.x, car.y, car.z);
}

function hudBind() {
  const elBuild = document.getElementById("build-chip");
  if (elBuild && elBuild.textContent !== "BUILD " + BUILD) elBuild.textContent = "BUILD " + BUILD;
  const g = gates[finished ? GATE_COUNT - 1 : nextGate];
  const speedMph = Math.abs(car.speed) * 2.236936;
  elSpeed.textContent = String(Math.round(speedMph));
  elArc.style.strokeDashoffset = String(ARC_LEN * (1 - car.boost));
  elCluster.classList.toggle("overheat", car.overheating);
  elTimer.textContent = fmtTime(timeMs);
  elGateIdx.textContent = (finished ? GATE_COUNT : nextGate + 1) + "/" + GATE_COUNT;
  elGateDist.textContent = Math.round(Math.hypot(g.pos.x - car.x, g.pos.z - car.z)) + " m";
  if (elPlaceVal) {
    const r = rivals[0];
    let ahead = true;
    if (r) {
      let lead = lastT - r.t;
      if (lead > 0.5) lead -= 1;
      if (lead < -0.5) lead += 1;
      ahead = lead >= 0;
    }
    elPlaceVal.textContent = ahead ? "1st" : "2nd";
    elPlaceVal.style.color = ahead ? "#ffee55" : "#f4f4f2";
  }
  if (elCount) {
    if (startLock) {
      elCount.classList.add("show");
      if (countT > 2.2) elCount.textContent = "3";
      else if (countT > 1.2) elCount.textContent = "2";
      else if (countT > 0.15) elCount.textContent = "1";
      else elCount.textContent = "GO";
    } else elCount.classList.remove("show");
  }
  _gateNdc.set(g.pos.x, g.pos.y + 3, g.pos.z).project(camera);
  const on = Math.abs(_gateNdc.x) < 0.92 && Math.abs(_gateNdc.y) < 0.88 && _gateNdc.z < 1;
  elGatePanel.classList.toggle("offscreen", !on);
  if (!on && !finished) {
    elChevron.classList.add("show");
    let ang = Math.atan2(g.pos.x - car.x, g.pos.z - car.z) - car.yaw;
    while (ang > Math.PI) ang -= Math.PI * 2;
    while (ang < -Math.PI) ang += Math.PI * 2;
    elChevron.style.left = (innerWidth * 0.5 + Math.sin(ang) * (innerWidth * 0.42) - 7) + "px";
    elChevron.style.top = (innerHeight * 0.5 - Math.cos(ang) * (innerHeight * 0.38) - 12) + "px";
  } else elChevron.classList.remove("show");
}

let sfx = null;
function unlockAudio() {
  if (sfx) { if (sfx.ctx.state === "suspended") sfx.ctx.resume().catch(function () {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { sfx = { ctx: new AC() }; sfx.ctx.resume(); } catch (err) {}
}

let launchT = 0, launchPhase = "pad";
function stepLaunch(dt) {
  if (PROOF === "A" || PROOF === "B") return;
  const stl = rocket.userData.stlRoot;
  if (!stl) return;
  launchT += dt;
  if (launchPhase === "pad") {
    stl.position.y = 0; rocket.userData.exhaust.visible = false;
    if (launchT > 10) { launchPhase = "ign"; launchT = 0; }
  } else if (launchPhase === "ign") {
    stl.position.y = (Math.random() - 0.5) * 0.2;
    rocket.userData.exhaust.visible = true;
    rocket.userData.exhaust.scale.setScalar(0.4 + launchT);
    if (launchT > 2.4) { launchPhase = "up"; launchT = 0; }
  } else if (launchPhase === "up") {
    stl.position.y = 8 * launchT + 11 * launchT * launchT;
    if (stl.position.y > 280) { stl.visible = false; launchPhase = "coast"; launchT = 0; rocket.userData.exhaust.visible = false; }
  } else {
    if (launchT > 4) { stl.visible = true; stl.position.y = 0; launchPhase = "pad"; launchT = 0; }
  }
}

spawnStart();
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  let dt = clock.getDelta();
  if (dt > MAX_DT) dt = MAX_DT;
  const { boosting } = drive(dt);
  stepRivals(dt);
  stepLaunch(dt);
  stepDust(dt);
  chaseCam(dt, boosting);
  if (!finished && !startLock) timeMs += dt * 1000;
  if (toastT > 0) { toastT -= dt; if (toastT <= 0 && elFailToast) elFailToast.classList.remove("show"); }
  hudBind();
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
