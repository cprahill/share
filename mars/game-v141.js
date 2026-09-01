import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

// cache: game-v141.js  — cab fill, fewer drones, no door handles
const BUILD = "141";
const GAME_TITLE = "CyberBaja: Planetary Tour";
const LOOK_TRUCK = 1.16;
const LOOK_CROWD = 1.55;
const LOOK_ROVER = 1.6;
const GATE_COUNT = 5;
const LAP_COUNT = 3;
const MIN_GATE_SPEED = 5;
const MIN_LAP_FRAC = 0.62;
const HALF_W = 14;
const START_T = 0.02;
const MAX_DT = 1 / 20;
const BOOST_DRAIN = 0;
const BOOST_REGEN = 0.14;
const ARC_LEN = 264;
const DUST = 0xC47858;
const RIBBON_LIFT = 0.45;
const RIBBON_PACK = 0xC8B090;
const BERM_RUST = 0xA06040;
const FOG_PEACH = 0xE8A070;
const PLANETS = {
  mars: {
    key: "mars", tag: "MARS", course: "course-mars-raid-v95.json",
    skyHor: [0.96, 0.68, 0.48], skyZen: [0.78, 0.50, 0.40],
    fog: 0xE8A070, bg: 0xE8A878, ground: 0xC05632, hemi: 0xF8C8A0, hemiG: 0xA04828,
    amb: 0xE09060, sun: 0xFFD0A0, gravMul: 1.0
  },
  moon: {
    key: "moon", tag: "MOON", course: "course-moon-v1.json",
    skyHor: [0.18, 0.20, 0.28], skyZen: [0.02, 0.02, 0.06],
    fog: 0x2A2E38, bg: 0x0A0C12, ground: 0x8A8E96, hemi: 0xC8D0E0, hemiG: 0x303440,
    amb: 0x687088, sun: 0xEEF2FF, gravMul: 0.90
  },
  earth: {
    key: "earth", tag: "EARTH", course: "course-earth-v1.json",
    skyHor: [0.78, 0.84, 0.90], skyZen: [0.28, 0.52, 0.82],
    fog: 0xC0D0C8, bg: 0x8BB4D0, ground: 0xC4A068, hemi: 0xE8F0FF, hemiG: 0x8A7048,
    amb: 0xC8B090, sun: 0xFFF0C8, gravMul: 1.0
  }
};
function parsePlanet(raw) {
  const s = (raw || "").toLowerCase();
  if (s === "moon" || s === "luna") return PLANETS.moon;
  if (s === "earth" || s === "terra" || s === "green") return PLANETS.earth;
  return PLANETS.mars;
}
let PLANET = PLANETS.mars;
const STEEL = 0xC0C0C0;
const BANNER = 0xFFD700;
const TAIL = 0xFF0000;
const PAD_ROCKET_X = 42;
const PAD_ROCKET_Z = 240;
const CLEAR = HALF_W + 16;
const ROCKET_KEEP_R = 110;
const shipFires = [{ x: PAD_ROCKET_X, z: PAD_ROCKET_Z, r: ROCKET_KEEP_R }];
function registerShipFire(x, z, r) {
  shipFires.push({ x, z, r: r == null ? 50 : r });
}
function nearShipFire(x, z) {
  for (let i = 0; i < shipFires.length; i++) {
    const s = shipFires[i];
    const dx = x - s.x, dz = z - s.z;
    if (dx * dx + dz * dz < s.r * s.r) return true;
  }
  return false;
}
function nearRocket(x, z) { return nearShipFire(x, z); }

const DIFFS = {
  easy: { key: "easy", tag: "EASY", nFly: 0, airHz: 0, slow: 0.70, spin: false, rival: [50, 54, 44], scoreMul: 0 },
  medium: { key: "medium", tag: "MED", nFly: 2, airHz: 0.18, slow: 0.62, spin: false, rival: [56, 60, 48], scoreMul: 2 },
  hard: { key: "hard", tag: "HARD", nFly: 3, airHz: 0.28, slow: 0.48, spin: true, rival: [66, 74, 50], scoreMul: 5 },
  extra: { key: "extra", tag: "XHARD", nFly: 5, airHz: 0.42, slow: 0.36, spin: true, rival: [76, 88, 48], scoreMul: 8 }
};
const CUP_GOLD = { easy: 70000, medium: 80000, hard: 90000, extra: 100000 };
const CUP_SILVER = { easy: 50000, medium: 58000, hard: 65000, extra: 72000 };
const SWEEP_BONUS = 40000;
const COIN_N = 72;
const FREE_MS = 90000;
const ceremony = {
  g: null, active: false, t: 0, won: true, hudShown: false, label: "",
  trophy: null, girl: null, bottle: null, spray: null, playerFig: null, hero: null, podium: null,
  yaw: 0, x: 0, y: 0, z: 0
};
function parseDiff(raw) {
  const s = (raw || "").toLowerCase();
  if (s === "e" || s === "easy") return DIFFS.easy;
  if (s === "h" || s === "hard") return DIFFS.hard;
  if (s === "x" || s === "xh" || s === "xhard" || s === "extra" || s === "extra-hard") return DIFFS.extra;
  return DIFFS.medium;
}
let DIFF = DIFFS.medium;
const MODES = {
  raid: { key: "raid", tag: "RAID" },
  trial: { key: "trial", tag: "TRIAL" },
  tour: { key: "tour", tag: "TOUR" },
  hunt: { key: "hunt", tag: "EXPLORER" },
  free: { key: "free", tag: "FREE" }
};
function parseMode(raw) {
  const s = (raw || "").toLowerCase();
  if (s === "trial" || s === "tt" || s === "time") return MODES.trial;
  if (s === "tour" || s === "touring") return MODES.tour;
  if (s === "hunt" || s === "scavenger" || s === "explorer" || s === "explore") return MODES.hunt;
  if (s === "free" || s === "freestyle" || s === "play" || s === "open" || s === "roam") return MODES.free;
  if (s === "raid" || s === "race") return MODES.raid;
  return MODES.trial;
}
let MODE = MODES.trial;
let freeKind = "track";
function isOpenWorld() { return MODE.key === "hunt"; }
function isPlayground() { return MODE.key === "free"; }
let waitingDiff = true;
let menuPage = "home";
let ghostIn = null;
let ghostRec = [];
let lastGhostMs = 0;
const hazards = [];
const coins = [];
let coinsGot = 0;
let rivalCoins = 0;
const huntItems = [];
let huntFound = 0;
let hsSubmitted = false;
let hsSavedName = "";
const NAME_KEY = "rdb-name-v1";
const PAINT_KEY = "rdb-paint-v1";
const PAINT_UNLOCK_KEY = "rdb-paint-unlock-v1";
function sanitizeName(raw) {
  return (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}
let playerName = "ACE";
try {
  const saved = sanitizeName(localStorage.getItem(NAME_KEY));
  if (saved) playerName = saved;
} catch (err) {}

const keys = Object.create(null);
addEventListener("keydown", (e) => {
  if (e.target && (e.target.id === "hs-name" || e.target.id === "boot-name")) {
    if (e.code === "Enter" || e.code === "NumpadEnter") {
      e.preventDefault();
      if (e.target.id === "hs-name") submitHs();
      else { commitName(e.target.value); e.target.blur(); }
    }
    return;
  }
  unlockAudio();
  keys[e.code] = true;
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
  if (e.code === "KeyR" && !e.repeat) {
    if (waitingDiff) return;
    if (finished && ceremony.active && !ceremony.hudShown) {
      if (ceremony.t > 1.2) skipCeremony();
    } else onRetry();
    return;
  }
  if (e.code === "KeyC" && !e.repeat) cycleLivery();
  if (e.code === "KeyF" && !e.repeat) trySnap();
  if (waitingDiff && menuPage === "boot") {
    if (e.code === "Digit1" || e.code === "Numpad1") pickDifficulty("easy");
    if (e.code === "Digit2" || e.code === "Numpad2") pickDifficulty("medium");
    if (e.code === "Digit3" || e.code === "Numpad3") pickDifficulty("hard");
    if (e.code === "Digit4" || e.code === "Numpad4") pickDifficulty("extra");
  }
});
addEventListener("keyup", (e) => { keys[e.code] = false; });

const touchCtl = { st: 0, th: 0, bo: false, snap: false };
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
  if (t.closest("#pad-snap")) return "snap";
  if (t.closest("#pad-throttle")) return "th";
  if (t.closest("#pad-brake")) return "br";
  if (t.closest("#steer-well")) return "steer";
  return null;
}
function onPtrDown(e) {
  unlockAudio();
  const finger = e.pointerType === "touch" || e.pointerType === "pen";
  if (finger) document.body.classList.add("touch-on");
  if (e.target && e.target.closest && e.target.closest("#home, #how, #scores, #boot, #share-chal, .boot-btn, .home-btn, #hs-name, #hs-save, #hs-board, #finish, #boot-name, #paint-row, #hs-home")) return;
  if (finished) {
    if (ceremony.active && !ceremony.hudShown) {
      if (ceremony.t > 1.2) skipCeremony();
      return;
    }
    onRetry();
    return;
  }
  const hit = padRoleFromTarget(e.target);
  if (hit === "livery") { cycleLivery(); if (e.cancelable) e.preventDefault(); return; }
  if (hit === "snap") { trySnap(); if (e.cancelable) e.preventDefault(); return; }
  let role = hit;
  if (!role && finger) role = e.clientX < innerWidth * 0.5 ? "steer" : "bo";
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

let IS_MOBILE = false;
try {
  IS_MOBILE = matchMedia("(pointer: coarse)").matches || matchMedia("(hover: none)").matches || ("ontouchstart" in window);
} catch (err) {}
const renderer = new THREE.WebGLRenderer({ antialias: !IS_MOBILE, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, IS_MOBILE ? 1.15 : 1.75));
renderer.shadowMap.enabled = !IS_MOBILE;
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.2;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
renderer.domElement.style.touchAction = "none";
renderer.domElement.style.display = "block";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xE8A878);
scene.fog = new THREE.Fog(FOG_PEACH, IS_MOBILE ? 420 : 650, IS_MOBILE ? 2200 : 3200);

const urlParams = new URLSearchParams(location.search);
PLANET = parsePlanet(urlParams.get("p") || urlParams.get("planet"));
scene.background = new THREE.Color(PLANET.bg);
if (scene.fog) scene.fog.color.setHex(PLANET.fog);
const PROOF = (urlParams.get("shot") || "").toUpperCase();
if (PROOF === "A" || PROOF === "B") {
  const hd = document.getElementById("hud");
  const tw = document.getElementById("touch");
  if (hd) hd.style.display = "none";
  if (tw) tw.style.display = "none";
  waitingDiff = false;
}
if (urlParams.get("d")) {
  DIFF = parseDiff(urlParams.get("d"));
  waitingDiff = false;
}
if (urlParams.get("m")) {
  const rawM = (urlParams.get("m") || "").toLowerCase();
  MODE = parseMode(rawM);
  if (rawM === "open" || rawM === "roam") freeKind = "open";
  if (rawM === "play" || rawM === "track") freeKind = "track";
}
if ((urlParams.get("f") || "").toLowerCase() === "open") freeKind = "open";
if ((urlParams.get("f") || "").toLowerCase() === "track") freeKind = "track";
if (urlParams.get("g")) ghostIn = urlParams.get("g");
PLANET = parsePlanet(urlParams.get("p") || urlParams.get("planet"));
const PODIUM_PREVIEW = (urlParams.get("podium") || "").toLowerCase();
if (PODIUM_PREVIEW === "win" || PODIUM_PREVIEW === "lose") waitingDiff = false;
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 2, IS_MOBILE ? 2600 : 4200);
scene.add(camera);

scene.add(new THREE.HemisphereLight(PLANET.hemi, PLANET.hemiG, 1.55));
scene.add(new THREE.AmbientLight(PLANET.amb, 0.7));
const sun = new THREE.DirectionalLight(PLANET.sun, 4.6);
sun.position.set(-40, 28, -20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 2;
sun.shadow.camera.far = 220;
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
sun.shadow.bias = -0.00025;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);
const fill = new THREE.DirectionalLight(0xFFE8D0, 0.95);
fill.position.set(50, 20, 20);
scene.add(fill);
scene.add(fill.target);

if (!IS_MOBILE) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envSc = new THREE.Scene();
  envSc.add(new THREE.HemisphereLight(0xF0C8A8, 0xA05030, 1.2));
  scene.environment = pmrem.fromScene(envSc, 0.08).texture;
}

function viewBox() {
  const vv = window.visualViewport;
  if (vv && vv.width > 2 && vv.height > 2) {
    return {
      w: Math.max(1, Math.round(vv.width)),
      h: Math.max(1, Math.round(vv.height)),
      x: Math.round(vv.offsetLeft || 0),
      y: Math.round(vv.offsetTop || 0)
    };
  }
  return { w: innerWidth, h: innerHeight, x: 0, y: 0 };
}
function isStandalone() {
  try {
    if (navigator.standalone) return true;
    if (matchMedia("(display-mode: standalone)").matches) return true;
    if (matchMedia("(display-mode: fullscreen)").matches) return true;
  } catch (err) {}
  return false;
}
function isPortrait() {
  const v = viewBox();
  return v.h > v.w + 24;
}
function syncLandscape() {
  const root = document.documentElement;
  const port = IS_MOBILE && isPortrait();
  root.classList.toggle("need-landscape", port);
  const lock = document.getElementById("rotate-lock");
  if (lock) lock.setAttribute("aria-hidden", port ? "false" : "true");
}
function lockLandscape() {
  try {
    const o = screen.orientation;
    if (o && o.lock) o.lock("landscape").catch(() => {});
  } catch (err) {}
}
function pinBox(el, v) {
  if (!el) return;
  el.style.position = "fixed";
  el.style.inset = "auto";
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.left = v.x + "px";
  el.style.top = v.y + "px";
  el.style.width = v.w + "px";
  el.style.height = v.h + "px";
}
function isFs() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}
function fitView() {
  try { window.scrollTo(0, 0); } catch (err) {}
  const v = viewBox();
  camera.aspect = v.w / v.h;
  camera.updateProjectionMatrix();
  renderer.setSize(v.w, v.h, false);
  pinBox(renderer.domElement, v);
  ["hud", "touch", "home"].forEach((id) => pinBox(document.getElementById(id), v));
  const fs = document.getElementById("fs-btn");
  const on = isFs() || document.documentElement.classList.contains("fs-fit") || isStandalone();
  if (fs) {
    fs.textContent = on ? "EXIT" : "FULL";
    fs.setAttribute("aria-pressed", on ? "true" : "false");
    fs.style.position = "fixed";
    fs.style.inset = "auto";
    fs.style.top = (v.y + 8) + "px";
    fs.style.right = "auto";
    const inset = (IS_MOBILE && v.w > v.h) ? 152 : 8;
    fs.style.left = (v.x + v.w - inset - 60) + "px";
    if (isStandalone()) fs.style.display = "none";
  }
  const hf = document.getElementById("home-fs");
  if (hf) hf.textContent = isStandalone() ? "ON PHONE" : (on ? "EXIT FULL" : "FULL SCREEN");
  syncLandscape();
}
async function toggleFullscreen(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  lockLandscape();
  const root = document.documentElement;
  if (isFs()) {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (err) {}
    root.classList.remove("fs-fit");
    fitView();
    return;
  }
  const req = root.requestFullscreen || root.webkitRequestFullscreen;
  if (req) {
    try {
      await req.call(root, { navigationUI: "hide" });
      root.classList.add("fs-fit");
      fitView();
      return;
    } catch (err) {}
  }
  root.classList.add("fs-fit");
  try { window.scrollTo(0, 1); } catch (err2) {}
  fitView();
}
{
  const root = document.documentElement;
  if (IS_MOBILE) root.classList.add("fs-fit");
  if (isStandalone()) root.classList.add("standalone");
  const fs = document.getElementById("fs-btn");
  const hf = document.getElementById("home-fs");
  if (fs) fs.addEventListener("click", toggleFullscreen);
  if (hf) hf.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", fitView);
  document.addEventListener("webkitfullscreenchange", fitView);
  addEventListener("resize", fitView);
  addEventListener("orientationchange", () => {
    lockLandscape();
    setTimeout(fitView, 80);
    setTimeout(fitView, 320);
  });
  if (window.visualViewport) {
    visualViewport.addEventListener("resize", fitView);
    visualViewport.addEventListener("scroll", fitView);
  }
  addEventListener("pointerdown", lockLandscape, { passive: true });
  fitView();
}

function hexRgb(hex) {
  const n = parseInt(String(hex || "C05632").replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function dirtTexture(rep, hex) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  const [br, bg, bb] = hexRgb(hex);
  g.fillStyle = hex || "#C47858";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 22000; i++) {
    const v = (Math.random() * 50) | 0;
    g.fillStyle = "rgba(" + Math.min(255, br - 20 + v) + "," + Math.min(255, bg - 16 + (v * 0.6) | 0) + "," + Math.min(255, bb - 12 + (v * 0.4) | 0) + "," + (0.15 + Math.random() * 0.35) + ")";
    g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 4, 1 + Math.random() * 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function packedTrackTexture(hex) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d");
  const [br, bg, bb] = hexRgb(hex || "B07A52");
  g.fillStyle = hex || "#B07A52";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18000; i++) {
    const v = (Math.random() * 50) | 0;
    g.fillStyle = "rgba(" + Math.min(255, br + v * 0.4) + "," + Math.min(255, bg + v * 0.3) + "," + Math.min(255, bb + v * 0.2) + "," + (0.14 + Math.random() * 0.32) + ")";
    g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  function rut(v0, w, alpha) {
    g.fillStyle = "rgba(" + Math.max(0, br - 40) + "," + Math.max(0, bg - 30) + "," + Math.max(0, bb - 20) + "," + alpha + ")";
    g.fillRect(0, (v0 - w * 0.5) * 512, 512, w * 512);
  }
  rut(0.38, 0.07, 0.16);
  rut(0.62, 0.07, 0.16);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  t.anisotropy = IS_MOBILE ? 2 : 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const DIRT_MARS = dirtTexture(IS_MOBILE ? 24 : 48, "#C05632");
const DIRT_MOON = dirtTexture(IS_MOBILE ? 24 : 48, "#8E939C");
const DIRT_EARTH = dirtTexture(IS_MOBILE ? 24 : 48, "#5E7044");
const TRACK_MARS = packedTrackTexture("#B07A52");
const TRACK_MOON = packedTrackTexture("#A8AEB6");
const TRACK_EARTH = packedTrackTexture("#8B7348");
const DIRT_GROUND = DIRT_MARS;
const DIRT_TRACK = TRACK_MARS;
const DIRT_SHOULDER = dirtTexture(IS_MOBILE ? 6 : 10, "#A05632");

const steelBody = new THREE.MeshStandardMaterial({
  color: STEEL, metalness: 0.9, roughness: 0.32, envMapIntensity: 1.35,
  vertexColors: false, fog: true
});
const steelStl = new THREE.MeshStandardMaterial({
  color: STEEL, metalness: 0.9, roughness: 0.32, envMapIntensity: 1.35,
  vertexColors: false, fog: false, emissive: STEEL, emissiveIntensity: 0.05
});
const LIVERIES = [
  { name: "STEEL", color: STEEL, metalness: 0.9, roughness: 0.32, env: 1.35, emi: 0.05, need: 0 },
  { name: "BLACK", color: 0x161618, metalness: 0.58, roughness: 0.48, env: 0.70, need: 0 },
  { name: "WHITE", color: 0xD8D4CC, metalness: 0.82, roughness: 0.22, env: 1.05, need: 30000 },
  { name: "RED", color: 0xB42018, metalness: 0.52, roughness: 0.42, env: 0.80, need: 45000 },
  { name: "TEAL", color: 0x1A7A7A, metalness: 0.55, roughness: 0.40, env: 0.85, need: 55000 },
  { name: "BLUE", color: 0x2A4A8C, metalness: 0.60, roughness: 0.38, env: 0.90, need: 65000 },
  { name: "TAN", color: 0x8C7360, metalness: 0.68, roughness: 0.54, env: 0.82, need: 80000 },
  { name: "GOLD", color: 0xD4AF37, metalness: 0.96, roughness: 0.16, env: 1.45, emi: 0.12, need: 110000 }
];
let paintUnlocks = { STEEL: true, BLACK: true };
try {
  const raw = JSON.parse(localStorage.getItem(PAINT_UNLOCK_KEY) || "{}");
  if (raw && typeof raw === "object") Object.assign(paintUnlocks, raw);
} catch (err) {}
function paintUnlocked(i) {
  const L = LIVERIES[i];
  if (!L) return false;
  if ((L.need || 0) <= 0) return true;
  return !!paintUnlocks[L.name];
}
function savePaintUnlocks() {
  try { localStorage.setItem(PAINT_UNLOCK_KEY, JSON.stringify(paintUnlocks)); } catch (err) {}
}
let liveryIdx = 0;
try {
  const n = parseInt(localStorage.getItem(PAINT_KEY), 10);
  if (Number.isFinite(n)) liveryIdx = ((n % LIVERIES.length) + LIVERIES.length) % LIVERIES.length;
} catch (err) {}
if (!paintUnlocked(liveryIdx)) liveryIdx = 0;
const steelRocket = new THREE.MeshStandardMaterial({
  color: STEEL, metalness: 0.9, roughness: 0.32, envMapIntensity: 1.35, side: THREE.DoubleSide, fog: true
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
let curve = new THREE.CatmullRomCurve3(pathPts, true, "catmullrom", 0.15);
let trackLen = curve.getLength();

const MARS_JUMPS = [
  { t: 0.11, kind: "whoops", h: 1.15, len: 56, n: 5 },
  { t: 0.22, kind: "valley", h: 5.2, len: 88 },
  { t: 0.40, kind: "table", h: 3.6, len: 64 },
  { t: 0.56, kind: "valley", h: 6.4, len: 110 },
  { t: 0.74, kind: "whoops", h: 1.1, len: 50, n: 5 },
  { t: 0.86, kind: "valley", h: 5.6, len: 96 }
];
const MOON_JUMPS = [
  { t: 0.10, kind: "whoops", h: 1.4, len: 64, n: 6 },
  { t: 0.24, kind: "valley", h: 7.2, len: 120 },
  { t: 0.42, kind: "table", h: 4.2, len: 72 },
  { t: 0.58, kind: "valley", h: 8.0, len: 130 },
  { t: 0.76, kind: "whoops", h: 1.3, len: 56, n: 5 },
  { t: 0.90, kind: "table", h: 5.0, len: 70 }
];
const EARTH_JUMPS = [
  { t: 0.14, kind: "whoops", h: 1.1, len: 48, n: 4 },
  { t: 0.30, kind: "table", h: 4.0, len: 70 },
  { t: 0.48, kind: "valley", h: 5.8, len: 96 },
  { t: 0.64, kind: "whoops", h: 1.2, len: 52, n: 5 },
  { t: 0.80, kind: "valley", h: 6.6, len: 108 }
];
const JUMPS = MARS_JUMPS.map((j) => Object.assign({}, j));
function makeMoonPath() {
  const pts = [];
  const n = 32, cx = 2000, cz = 2400, rx = 540, rz = 700;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const w = 1 + 0.045 * Math.sin(i * 1.7);
    pts.push(new THREE.Vector3(cx + Math.cos(a) * rx * w, 0, cz + Math.sin(a) * rz * w));
  }
  return pts;
}
function makeEarthPath() {
  const cx = -1600, cz = 2200;
  const raw = [
    [0, 0], [40, 280], [20, 560], [90, 820], [220, 1000],
    [400, 1080], [560, 960], [640, 740], [620, 480],
    [500, 240], [320, 60], [140, -20], [40, -10]
  ];
  return raw.map(([x, z]) => new THREE.Vector3(cx + x, 0, cz + z));
}
function makeMarsPath() {
  const pts = [];
  for (let i = 0; i <= 22; i++) {
    const u = i / 22;
    pts.push(new THREE.Vector3(8 * Math.sin(u * Math.PI * 1.6), 0, u * 1700));
  }
  pts.push(new THREE.Vector3(90, 0, 1785), new THREE.Vector3(220, 0, 1840), new THREE.Vector3(360, 0, 1790), new THREE.Vector3(455, 0, 1660));
  for (let i = 21; i >= 0; i--) {
    const u = i / 22;
    pts.push(new THREE.Vector3(460 + 8 * Math.sin(u * Math.PI * 1.6), 0, u * 1700));
  }
  pts.push(new THREE.Vector3(320, 0, -50), new THREE.Vector3(150, 0, -55), new THREE.Vector3(40, 0, -22), new THREE.Vector3(3, 0, -2));
  return pts;
}
const PLAY_JUMPS = [
  { t: 0.17, kind: "table", h: 5.4, len: 58 },
  { t: 0.33, kind: "table", h: 6.2, len: 54 },
  { t: 0.48, kind: "valley", h: 7.6, len: 92 },
  { t: 0.67, kind: "table", h: 6.8, len: 60 },
  { t: 0.93, kind: "valley", h: 7.2, len: 78 }
];
const playRamps = [];

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
function jumpAtT(t, set) {
  const s = t * trackLen;
  const list = set || JUMPS;
  for (let i = 0; i < list.length; i++) {
    const j = list[i];
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
function jumpTakeU(j) {
  if (j.kind === "table") return 0.26;
  if (j.kind === "valley") return 0.28;
  return 0.18;
}
function jumpFlyLen(j) {
  return j.len * (j.kind === "whoops" ? 1.08 : 1.58);
}
function flightArc(j, u) {
  const peak = j.h * (PLANET.key === "moon" ? 1.72 : 1.22) + (j.kind === "whoops" ? 1.1 : (PLANET.key === "moon" ? 4.4 : 3.2));
  const uu = Math.max(0, Math.min(1, u));
  return Math.max(0.15, peak * 4 * uu * (1 - uu));
}
function rivalFlightY(t) {
  let y = jumpYAtT(t);
  for (let i = 0; i < JUMPS.length; i++) {
    const j = JUMPS[i];
    if (j.kind !== "valley" && j.kind !== "table") continue;
    const takeT = j.t + jumpTakeU(j) * j.len / trackLen;
    const span = jumpFlyLen(j) / trackLen;
    let u = t - takeT;
    if (u < -0.5) u += 1;
    if (u < 0 || u > span) continue;
    y = Math.max(y, flightArc(j, u / span));
  }
  return y;
}
function onBigAir(t) {
  const hit = jumpAtT(t);
  return !!(hit && (hit.j.kind === "valley" || hit.j.kind === "table"));
}
function onWhoops(t) {
  const hit = jumpAtT(t);
  return !!(hit && hit.j.kind === "whoops");
}
function snapOffBigAir(t) {
  let u = ((t % 1) + 1) % 1;
  for (let k = 0; k < 12; k++) {
    if (!onBigAir(u) && u >= 0.18) return u;
    u = (u + 0.028) % 1;
  }
  return t < 0.18 ? 0.20 : t;
}
const PATH_N = 900;
const pathSampX = new Float32Array(PATH_N);
const pathSampZ = new Float32Array(PATH_N);
const pathSampJ = new Float32Array(PATH_N);
function refreshPathSamples() {
  for (let i = 0; i < PATH_N; i++) {
    const t = i / PATH_N;
    const p = curve.getPointAt(t);
    pathSampX[i] = p.x;
    pathSampZ[i] = p.z;
    pathSampJ[i] = jumpYAtT(t);
  }
}
refreshPathSamples();
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
  let jy = near.jy;
  if (false && isPlayground() && near.d < HALF_W + 6) {
    const extra = jumpAtT(near.t, PLAY_JUMPS);
    if (extra) jy = Math.max(jy, jumpProfile(extra.j, extra.u));
  }
  if (near.d < HALF_W + 4) return base + Math.max(0, jy);
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

const GROUND_OX = 230, GROUND_OZ = 880;
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(5200, 5200, 140, 140),
  new THREE.MeshStandardMaterial({ map: DIRT_GROUND, color: PLANET.ground, roughness: 0.97, metalness: 0.02 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(GROUND_OX, 0, GROUND_OZ);
ground.receiveShadow = true;
ground.frustumCulled = false;
{
  const gpos = ground.geometry.attributes.position;
  for (let i = 0; i < gpos.count; i++) {
    const lx = gpos.getX(i), ly = gpos.getY(i);
    const wx = lx + GROUND_OX, wz = ly + GROUND_OZ;
    let h = groundH(wx, wz);
    if (nearPathSample(wx, wz).d < HALF_W + 8) h -= 0.55;
    gpos.setZ(i, h);
  }
  ground.geometry.computeVertexNormals();
}
scene.add(ground);

const ribbonN = IS_MOBILE ? 520 : 820;
const XSEC = [
  { o: -(HALF_W + 2.6), dh: -0.08, v: 0.00, c: [0.72, 0.40, 0.26] },
  { o: -(HALF_W + 0.40), dh: 0.32, v: 0.18, c: [0.63, 0.34, 0.22] },
  { o: -(HALF_W - 0.15), dh: 0.32, v: 0.26, c: [0.63, 0.34, 0.22] },
  { o: -(HALF_W - 0.45), dh: 0.04, v: 0.30, c: [0.70, 0.48, 0.32] },
  { o: -2.1, dh: 0.05, v: 0.40, c: [0.52, 0.32, 0.20] },
  { o: 0, dh: 0.06, v: 0.50, c: [0.62, 0.38, 0.24] },
  { o: 2.1, dh: 0.05, v: 0.60, c: [0.52, 0.32, 0.20] },
  { o: (HALF_W - 0.45), dh: 0.04, v: 0.70, c: [0.70, 0.48, 0.32] },
  { o: (HALF_W - 0.15), dh: 0.32, v: 0.74, c: [0.63, 0.34, 0.22] },
  { o: (HALF_W + 0.40), dh: 0.32, v: 0.82, c: [0.63, 0.34, 0.22] },
  { o: (HALF_W + 2.6), dh: -0.08, v: 1.00, c: [0.72, 0.40, 0.26] }
];
const XS = XSEC.length;
const ribbonPos = [], ribbonUv = [], ribbonCol = [], ribbonIdx = [];
for (let i = 0; i <= ribbonN; i++) {
  const t = i / ribbonN;
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t);
  const r = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const base = trackH(p.x, p.z) + RIBBON_LIFT;
  const u = t * 14;
  for (let k = 0; k < XS; k++) {
    const s = XSEC[k];
    ribbonPos.push(p.x + r.x * s.o, base + s.dh, p.z + r.z * s.o);
    ribbonUv.push(u, s.v);
    ribbonCol.push(s.c[0], s.c[1], s.c[2]);
  }
}
for (let i = 0; i < ribbonN; i++) {
  const a = i * XS, b = (i + 1) * XS;
  for (let k = 0; k < XS - 1; k++) {
    ribbonIdx.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1);
  }
}
const ribbonGeo = new THREE.BufferGeometry();
ribbonGeo.setAttribute("position", new THREE.Float32BufferAttribute(ribbonPos, 3));
ribbonGeo.setAttribute("uv", new THREE.Float32BufferAttribute(ribbonUv, 2));
ribbonGeo.setAttribute("color", new THREE.Float32BufferAttribute(ribbonCol, 3));
ribbonGeo.setIndex(ribbonIdx);
ribbonGeo.computeVertexNormals();
const ribbon = new THREE.Mesh(ribbonGeo, new THREE.MeshStandardMaterial({
  map: DIRT_TRACK, vertexColors: true, roughness: 0.90, metalness: 0.03,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, fog: false
}));
ribbon.receiveShadow = true;
ribbon.frustumCulled = false;
ribbon.renderOrder = 1;
scene.add(ribbon);
function ribbonColors() {
  if (PLANET.key === "moon") {
    return { berm: [0.42, 0.45, 0.50], pack: [0.78, 0.80, 0.84], dirt: [0.58, 0.60, 0.64] };
  }
  if (PLANET.key === "earth") {
    return { berm: [0.62, 0.50, 0.32], pack: [0.78, 0.68, 0.46], dirt: [0.58, 0.46, 0.30] };
  }
  return { berm: [0.72, 0.40, 0.26], pack: [0.70, 0.48, 0.32], dirt: [0.52, 0.32, 0.20] };
}
function rebuildRibbon() {
  const pal = ribbonColors();
  const cols = [
    pal.berm, pal.berm, pal.berm, pal.pack, pal.dirt,
    pal.pack, pal.dirt, pal.pack, pal.berm, pal.berm, pal.berm
  ];
  const pos = [], uv = [], col = [], idx = [];
  for (let i = 0; i <= ribbonN; i++) {
    const t = i / ribbonN;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const r = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const base = trackH(p.x, p.z) + RIBBON_LIFT;
    const u = t * 14;
    for (let k = 0; k < XS; k++) {
      const s = XSEC[k];
      const c = cols[k] || pal.pack;
      pos.push(p.x + r.x * s.o, base + s.dh, p.z + r.z * s.o);
      uv.push(u, s.v);
      col.push(c[0], c[1], c[2]);
    }
  }
  for (let i = 0; i < ribbonN; i++) {
    const a = i * XS, b = (i + 1) * XS;
    for (let k = 0; k < XS - 1; k++) {
      idx.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const old = ribbon.geometry;
  ribbon.geometry = geo;
  if (old) old.dispose();
}

const jumpMarkRoot = new THREE.Group();
jumpMarkRoot.name = "jumpMarks";
scene.add(jumpMarkRoot);
function rebuildJumpMarks() {
  while (jumpMarkRoot.children.length) jumpMarkRoot.remove(jumpMarkRoot.children[0]);
  function stripeAt(t, hex, deep) {
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const y = trackH(p.x, p.z) + RIBBON_LIFT + 0.12;
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(HALF_W * 2 - 1.6, 0.08, deep || 1.15),
      new THREE.MeshBasicMaterial({ color: hex, fog: false, toneMapped: false })
    );
    stripe.position.set(p.x, y, p.z);
    stripe.rotation.y = Math.atan2(tan.x, tan.z);
    jumpMarkRoot.add(stripe);
  }
  JUMPS.forEach((j) => {
    const start = j.t;
    if (j.kind === "valley") {
      stripeAt((start + 0.26 * j.len / trackLen) % 1, 0xE8D8B8, 2.6);
      stripeAt((start + 0.50 * j.len / trackLen) % 1, 0xf4f4f2, 2.4);
    } else if (j.kind === "table") {
      stripeAt((start + 0.24 * j.len / trackLen) % 1, 0xD8C8A0, 2.0);
    }
  });
}
rebuildJumpMarks();

// Open desert — Road Rash, no canyon walls. Scenery lives off the tarmac.

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1, 24, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
    uniforms: {
      uHor: { value: new THREE.Vector3().fromArray(PLANET.skyHor) },
      uZen: { value: new THREE.Vector3().fromArray(PLANET.skyZen) }
    },
    vertexShader: "varying vec3 w; void main(){ w = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "varying vec3 w; uniform vec3 uHor; uniform vec3 uZen; void main(){ float h = normalize(w).y; gl_FragColor = vec4(mix(uHor, uZen, max(h,0.0)*0.85),1.0); }"
  })
);
sky.scale.setScalar(20);
sky.renderOrder = -1000;
sky.frustumCulled = false;
scene.add(sky);
const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(70, 24, 16),
  new THREE.MeshBasicMaterial({ color: 0xffd090, fog: false, toneMapped: false })
);
sunMesh.name = "sunMesh";
sunMesh.position.set(-620, 420, -380);
scene.add(sunMesh);
const earthSky = new THREE.Mesh(
  new THREE.SphereGeometry(55, 24, 16),
  new THREE.MeshBasicMaterial({ color: 0x4A8AD4, fog: false, toneMapped: false })
);
earthSky.name = "earthSky";
earthSky.visible = false;
earthSky.position.set(880, 360, 1400);
scene.add(earthSky);

const colliders = [];
const duneSpots = [];
function addCollider(x, z, r, planet) { colliders.push({ x, z, r, planet: !!planet }); }

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
  const duneGeo = new THREE.SphereGeometry(1, IS_MOBILE ? 14 : 24, IS_MOBILE ? 10 : 16);
  {
    const pos = duneGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const nse = Math.sin(x * 3.4) * 0.5 + Math.cos(z * 2.8) * 0.4 + Math.sin((x + z) * 1.7) * 0.35;
      const r = 1 + 0.12 * nse;
      pos.setXYZ(i, x * r * 1.35, Math.max(-0.02, y * 0.16 * r), z * r * 0.85);
    }
    duneGeo.computeVertexNormals();
    duneGeo.computeBoundingBox();
  }
  const duneBB = duneGeo.boundingBox;
  const duneGx = Math.max(Math.abs(duneBB.min.x), Math.abs(duneBB.max.x));
  const duneGz = Math.max(Math.abs(duneBB.min.z), Math.abs(duneBB.max.z));
  const duneMat = new THREE.MeshStandardMaterial({
    map: DIRT_GROUND, color: 0xC05632, roughness: 0.96, metalness: 0.0
  });
  const dunes = new THREE.InstancedMesh(duneGeo, duneMat, 56);
  dunes.castShadow = true;
  dunes.receiveShadow = true;
  dunes.frustumCulled = false;
  let n = 0;
  function duneHitsDirt(x, z, rad) {
    if (minDistToPath(x, z) < HALF_W + 10 + rad) return true;
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI * 0.125;
      if (minDistToPath(x + Math.cos(a) * rad, z + Math.sin(a) * rad) < HALF_W + 6) return true;
    }
    return false;
  }
  function plantDune(x, z, i, t) {
    if (n >= 56) return;
    if (t < 0.18 || t > 0.97) return;
    const s = 20 + Math.random() * 18;
    const sy = s * 0.20;
    dummy.scale.set(s * (1.8 + Math.random() * 0.6), sy, s * (1.1 + Math.random() * 0.5));
    dummy.rotation.y = Math.random() * Math.PI;
    const rad = Math.max(dummy.scale.x * duneGx, dummy.scale.z * duneGz);
    const pr = projectTrack(new THREE.Vector3(x, 0, z));
    let sign = pr.offset >= 0 ? 1 : -1;
    let d0 = minDistToPath(x, z);
    for (let k = 0; k < 16; k++) {
      if (!duneHitsDirt(x, z, rad)) break;
      const nx = x + pr.right.x * sign * 16;
      const nz = z + pr.right.z * sign * 16;
      const d1 = minDistToPath(nx, nz);
      if (d1 <= d0 + 0.4) { sign = -sign; continue; }
      x = nx; z = nz; d0 = d1;
    }
    if (duneHitsDirt(x, z, rad)) return;
    dummy.position.set(x, groundH(x, z) + sy * 0.22, z);
    dummy.updateMatrix();
    duneSpots.push({ x, z, r: rad });
    dunes.setMatrixAt(n++, dummy.matrix);
  }
  clusterAlong(0.20, 0.34, -1, 200, 320, IS_MOBILE ? 5 : 10, plantDune);
  clusterAlong(0.30, 0.46, -1, 210, 330, IS_MOBILE ? 5 : 10, plantDune);
  clusterAlong(0.58, 0.70, 1, 200, 320, IS_MOBILE ? 5 : 9, plantDune);
  clusterAlong(0.72, 0.86, 1, 210, 330, IS_MOBILE ? 4 : 9, plantDune);
  clusterAlong(0.88, 0.94, -1, 200, 300, IS_MOBILE ? 3 : 6, plantDune);
  dunes.count = n;
  dunes.instanceMatrix.needsUpdate = true;
  dunes.name = "dunes";
  scene.add(dunes);
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
    color: 0x8A4DFF, transparent: true, opacity: 0.62, fog: false,
    toneMapped: false, side: THREE.DoubleSide, depthWrite: false
  });
  const flameMid = new THREE.MeshBasicMaterial({
    color: 0xFF7AD9, transparent: true, opacity: 0.55, fog: false,
    toneMapped: false, side: THREE.DoubleSide, depthWrite: false
  });
  const flameInner = new THREE.MeshBasicMaterial({
    color: 0xC4F2FF, transparent: true, opacity: 0.9, fog: false,
    toneMapped: false, side: THREE.DoubleSide, depthWrite: false
  });
  const exhaust = new THREE.Group();
  exhaust.name = "starshipExhaust";
  const outer = new THREE.Mesh(new THREE.ConeGeometry(5.2, 26, 12, 1, true), flameOuter);
  const mid = new THREE.Mesh(new THREE.ConeGeometry(3.4, 22, 10, 1, true), flameMid);
  const inner = new THREE.Mesh(new THREE.ConeGeometry(2.1, 18, 8, 1, true), flameInner);
  outer.rotation.x = -Math.PI / 2;
  mid.rotation.x = -Math.PI / 2;
  inner.rotation.x = -Math.PI / 2;
  outer.position.z = -13;
  mid.position.z = -11;
  inner.position.z = -9;
  exhaust.add(outer);
  exhaust.add(mid);
  exhaust.add(inner);
  exhaust.visible = false;
  exhaust.scale.set(0.001, 0.001, 0.001);
  stlRoot.add(exhaust);
  g.userData.stlRoot = stlRoot;
  g.userData.exhaust = exhaust;
  g.userData.flameOuter = flameOuter;
  g.userData.flameMid = flameMid;
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
const GROUND_SIT = RIBBON_LIFT;

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
    addCabFill();
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
  function addCabFill() {
    if (g.userData.cabFill) {
      g.userData.cabFill.forEach((m) => g.remove(m));
      g.userData.cabFill = null;
    }
    const fills = [];
    const sideGlass = glassMat.clone();
    sideGlass.color.setHex(0x1a2830);
    sideGlass.opacity = 0.92;
    sideGlass.transparent = true;
    sideGlass.depthWrite = true;
    sideGlass.side = THREE.DoubleSide;
    sideGlass.needsUpdate = true;
    function box(geo, mat, x, y, z) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      g.add(m);
      fills.push(m);
      return m;
    }
    box(new THREE.BoxGeometry(0.07, 0.72, 1.28), sideGlass, -1.18, 1.68, 0.62);
    box(new THREE.BoxGeometry(0.07, 0.72, 1.28), sideGlass, 1.18, 1.68, 0.62);
    const rearGlass = sideGlass.clone();
    box(new THREE.BoxGeometry(2.05, 0.62, 0.08), rearGlass, 0, 1.78, -0.18);
    box(new THREE.BoxGeometry(2.05, 0.62, 0.16), steelBody, 0, 0.96, 2.58);
    box(new THREE.BoxGeometry(1.92, 0.11, 0.10), lampMat, 0, 0.98, 2.68);
    box(new THREE.BoxGeometry(0.28, 0.14, 0.12), lampMat, -0.72, 0.97, 2.72);
    box(new THREE.BoxGeometry(0.28, 0.14, 0.12), lampMat, 0.72, 0.97, 2.72);
    g.userData.cabFill = fills;
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
      x: p.x, z: p.z, front: p.front, radius: WR, fold: 0, blob: null
    });
  });
  return g;
}

const truck = wedgeTruck();
truck.scale.setScalar(LOOK_TRUCK);
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
  w.blob = b;
});


const olympus = new THREE.Group();
{
  const mat = new THREE.MeshStandardMaterial({
    map: DIRT_GROUND, color: 0xA05030, roughness: 0.97, metalness: 0.02, fog: true
  });
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(48, 160, 210, 48, 8, false), mat);
  shield.position.y = 80;
  shield.castShadow = true;
  shield.receiveShadow = true;
  olympus.add(shield);
  const terraceMat = new THREE.MeshStandardMaterial({
    map: DIRT_GROUND, color: 0x8A4030, roughness: 0.95, metalness: 0.02, fog: true
  });
  [[132, 38, 11], [98, 86, 13], [70, 132, 12]].forEach(([r, y, h]) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, h, 40, 1, true), terraceMat);
    ring.position.y = y;
    ring.receiveShadow = true;
    olympus.add(ring);
  });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(48, 58, 18, 32), new THREE.MeshStandardMaterial({
    color: 0xC47858, roughness: 0.88, fog: true
  }));
  cap.position.y = 178;
  olympus.add(cap);
  const frost = new THREE.Mesh(new THREE.CylinderGeometry(22, 40, 8, 24), new THREE.MeshStandardMaterial({
    color: 0xE8D4C4, roughness: 0.7, metalness: 0.05, fog: true
  }));
  frost.position.y = 188;
  olympus.add(frost);
}
olympus.position.set(420, groundH(420, 2380) - 14, 2380);
olympus.scale.setScalar(1.65);
olympus.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
scene.add(olympus);


const rocket = padRocket();
rocket.position.set(PAD_ROCKET_X, groundH(PAD_ROCKET_X, PAD_ROCKET_Z), PAD_ROCKET_Z);
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

function prepareZUp(geo) {
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.min.x + bb.max.x) * 0.5, -(bb.min.y + bb.max.y) * 0.5, -bb.min.z);
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}
function aabbOnRibbon(box) {
  const keep = HALF_W + 3;
  const mx = (box.min.x + box.max.x) * 0.5;
  const mz = (box.min.z + box.max.z) * 0.5;
  const pts = [
    [box.min.x, box.min.z], [box.min.x, box.max.z],
    [box.max.x, box.min.z], [box.max.x, box.max.z],
    [mx, mz],
    [box.min.x, mz], [box.max.x, mz], [mx, box.min.z], [mx, box.max.z]
  ];
  for (let i = 0; i < pts.length; i++) {
    if (minDistToPath(pts[i][0], pts[i][1]) < keep) return true;
  }
  return false;
}
function sitMesh(geo, x, z, worldH, mat, rotY, opts) {
  opts = opts || {};
  const mesh = new THREE.Mesh(geo, mat);
  const h = Math.max(0.05, geo.boundingBox.max.y - geo.boundingBox.min.y);
  mesh.scale.setScalar(worldH / h);
  mesh.rotation.y = rotY || 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.position.set(x, 0, z);
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  const foot = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  if (!opts.allowPath && aabbOnRibbon(box)) return null;
  mesh.position.y = groundH(x, z) - box.min.y - (opts.bury != null ? opts.bury : 0.12);
  const parent = opts.parent || scene;
  parent.add(mesh);
  if (opts.collider) {
    addCollider(x, z, opts.collider === true ? Math.max(0.55, foot * 0.22) : opts.collider);
  }
  return mesh;
}
function loadStl(url, cb) {
  new STLLoader().load(url, (geo) => cb(prepareZUp(geo)));
}

const rockMatA = new THREE.MeshStandardMaterial({
  color: 0x8B3A2B, roughness: 0.92, metalness: 0.04, side: THREE.DoubleSide
});
const rockMatC = new THREE.MeshStandardMaterial({
  color: 0x6E3224, roughness: 0.93, metalness: 0.04, side: THREE.DoubleSide
});
(function sceneSections() {
  function along(t, side, dist) {
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    return { x: p.x + right.x * side * dist, z: p.z + right.z * side * dist, p, tan, right };
  }
  loadStl("./mesh/rock-a.stl", (geo) => {
    const spots = [
      [0.09, -1, 46, 2.6, 0.4], [0.13, -1, 48, 3.2, 1.2], [0.16, 1, 46, 2.4, 2.0],
      [0.19, -1, 46, 2.8, 0.7], [0.24, 1, 42, 3.0, 1.5],
      [0.31, -1, 30, 2.7, 0.3], [0.34, -1, 38, 3.4, 1.8], [0.38, 1, 31, 2.5, 2.2],
      [0.42, -1, 33, 3.1, 0.6], [0.46, 1, 36, 2.9, 1.1],
      [0.53, -1, 40, 3.6, 0.2], [0.58, 1, 29, 2.6, 1.4],
      [0.63, 1, 32, 3.0, 0.9], [0.67, -1, 28, 2.5, 2.4], [0.72, 1, 35, 3.3, 0.5],
      [0.78, -1, 30, 2.8, 1.7], [0.83, 1, 33, 3.1, 0.8],
      [0.88, -1, 27, 2.4, 1.3], [0.93, 1, 31, 2.9, 2.0], [0.97, -1, 34, 2.7, 0.4]
    ];
    spots.forEach((s, i) => {
      if (IS_MOBILE && i % 2) return;
      const at = along(s[0], s[1], s[2]);
      sitMesh(geo, at.x, at.z, s[3], rockMatA, s[4] + i * 0.13, { collider: true, bury: 0.35, clear: 6 });
    });
  });
  loadStl("./mesh/rock-c.stl", (geo) => {
    const spots = [
      [0.11, 1, 48, 2.2, 0.2], [0.15, -1, 46, 2.8, 1.1], [0.21, 1, 42, 2.4, 0.7],
      [0.28, -1, 34, 3.0, 1.6], [0.35, 1, 38, 2.6, 0.4], [0.43, -1, 29, 2.5, 2.0],
      [0.51, 1, 42, 3.2, 0.9], [0.59, -1, 31, 2.3, 1.4], [0.65, 1, 37, 2.7, 0.3],
      [0.74, -1, 33, 2.9, 1.8], [0.81, 1, 28, 2.2, 0.6], [0.86, -1, 39, 3.1, 2.2],
      [0.92, 1, 32, 2.6, 0.8], [0.99, -1, 30, 2.4, 1.2]
    ];
    spots.forEach((s, i) => {
      if (IS_MOBILE && i % 2) return;
      const at = along(s[0], s[1], s[2]);
      sitMesh(geo, at.x, at.z, s[3], rockMatC, s[4] + i * 0.17, { collider: true, bury: 0.4, clear: 6 });
    });
  });
})();

(function starshipGarden() {
  // Drive-through start tunnel. Architecture over the ribbon, not landscape on it.
  const tGarden = 0.042;
  const vaultR = 19;
  const leanW = 14;
  const p = curve.getPointAt(tGarden);
  const tan = curve.getTangentAt(tGarden);
  const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const yaw = Math.atan2(tan.x, tan.z);
  const garden = new THREE.Group();
  garden.name = "starshipGarden";
  garden.position.set(p.x, 0, p.z);
  garden.rotation.y = yaw;
  scene.add(garden);

  function wx(lx, lz) {
    return p.x + right.x * lx + tan.x * lz;
  }
  function wz(lx, lz) {
    return p.z + right.z * lx + tan.z * lz;
  }
  function sitLocal(lx, lz) {
    const x = wx(lx, lz), z = wz(lx, lz);
    return groundH(x, z);
  }

  const glassMatDome = new THREE.MeshStandardMaterial({
    color: 0x9ad4c8, metalness: 0.22, roughness: 0.08, transparent: true,
    opacity: 0.18, side: THREE.DoubleSide, envMapIntensity: 1.15, fog: true
  });
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0xC8D0D4, metalness: 0.82, roughness: 0.32, envMapIntensity: 1.1
  });
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x6A4A38, roughness: 0.86, metalness: 0.08, map: DIRT_SHOULDER
  });
  const terraMat = new THREE.MeshStandardMaterial({ color: 0xA05030, roughness: 0.82, metalness: 0.05 });
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x3A2A18, roughness: 0.95, metalness: 0.0 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3F6B38, roughness: 0.78, metalness: 0.04 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x6B4A32, roughness: 0.7, metalness: 0.12 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xD8D2C8, metalness: 0.55, roughness: 0.38 });
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x101820, metalness: 0.7, roughness: 0.22 });
  const growMat = new THREE.MeshBasicMaterial({ color: 0x9FDCFF, toneMapped: false });

  const vaultLen = 96;
  const vaultH = 16;
  const yPath = sitLocal(0, 0);
  const vaultGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(vaultR, vaultR, vaultLen, IS_MOBILE ? 14 : 28, 1, true, Math.PI / 2, Math.PI),
    glassMatDome
  );
  vaultGlass.rotation.x = Math.PI / 2;
  vaultGlass.position.y = yPath + 0.2;
  vaultGlass.castShadow = false;
  vaultGlass.receiveShadow = false;
  vaultGlass.frustumCulled = false;
  garden.add(vaultGlass);

  const ribN = IS_MOBILE ? 5 : 9;
  for (let i = 0; i < ribN; i++) {
    const z = -vaultLen * 0.5 + (i / (ribN - 1)) * vaultLen;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(vaultR, 0.14, 8, 22, Math.PI), ribMat);
    rib.position.set(0, sitLocal(0, z) + 0.2, z);
    rib.castShadow = true;
    garden.add(rib);
  }
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, vaultLen, 8), ribMat);
  spine.rotation.x = Math.PI / 2;
  spine.position.set(0, yPath + vaultR + 0.2, 0);
  garden.add(spine);
  [-vaultR, vaultR].forEach((x) => {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, vaultLen, 8), ribMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(x, sitLocal(x, 0) + 0.18, 0);
    garden.add(rail);
  });
  [-1, 1].forEach((end) => {
    const z = end * vaultLen * 0.5;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(vaultR, 0.22, 8, 24, Math.PI), ribMat);
    ring.position.set(0, sitLocal(0, z) + 0.2, z);
    garden.add(ring);
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.3, vaultH * 0.5, 0.3), ribMat);
    const postR = postL.clone();
    postL.position.set(-vaultR, sitLocal(-vaultR, z) + vaultH * 0.26, z);
    postR.position.set(vaultR, sitLocal(vaultR, z) + vaultH * 0.26, z);
    garden.add(postL);
    garden.add(postR);
  });

  const leanLen = 70, leanH = 8.4;
  [-1, 1].forEach((side) => {
    const yDeck = sitLocal(side * (vaultR + 6), 0);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(leanLen, leanH), glassMatDome);
    wall.position.set(side * (vaultR + leanW), yDeck + leanH * 0.5, 0);
    wall.rotation.y = Math.PI / 2;
    wall.frustumCulled = false;
    garden.add(wall);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(leanW + 1, leanLen), glassMatDome);
    roof.rotation.x = -Math.PI / 2;
    roof.rotation.z = -0.36 * side;
    roof.position.set(side * (vaultR + leanW * 0.5), yDeck + leanH * 0.78, 0);
    roof.frustumCulled = false;
    garden.add(roof);
    for (let i = 0; i < 7; i++) {
      const z = -leanLen * 0.42 + i * (leanLen * 0.84 / 6);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(leanW + 0.4, 0.1, 0.1), ribMat);
      bar.rotation.z = -0.36 * side;
      bar.position.set(side * (vaultR + leanW * 0.5), yDeck + leanH * 0.78, z);
      garden.add(bar);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(leanW * 0.95, 0.16, leanLen * 0.9), deckMat);
    deck.position.set(side * (vaultR + leanW * 0.48), yDeck + 0.08, 0);
    deck.receiveShadow = true;
    garden.add(deck);
  });

  const leafGeo = new THREE.IcosahedronGeometry(0.42, 1);
  function addBush(group, x, y, z) {
    for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(leafGeo, leafMat);
      m.position.set(x + (Math.random() - 0.5) * 0.7, y + 0.28 + Math.random() * 0.35, z + (Math.random() - 0.5) * 0.55);
      m.scale.set(0.7 + Math.random() * 0.5, 0.65 + Math.random() * 0.5, 0.7 + Math.random() * 0.5);
      m.castShadow = true;
      group.add(m);
    }
  }
  const bedZs = [-28, -20, -12, -4, 4, 12, 20, 28];
  bedZs.forEach((z, i) => {
    [-1, 1].forEach((side) => {
      const lx = side * (vaultR + 6 + (i % 2) * 5);
      const y0 = sitLocal(lx, z);
      const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.48, 1.15), terraMat);
      box.position.set(lx, y0 + 0.28, z);
      box.castShadow = true;
      box.receiveShadow = true;
      garden.add(box);
      const soil = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.98), soilMat);
      soil.position.set(lx, y0 + 0.54, z);
      garden.add(soil);
      addBush(garden, lx, y0 + 0.5, z);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.08), growMat);
      bar.position.set(lx, y0 + 1.55, z);
      garden.add(bar);
      addCollider(wx(lx, z), wz(lx, z), 1.1);
    });
  });

  [[vaultR + 4, -22], [vaultR + 11, 22]].forEach((xz, i) => {
    const y0 = sitLocal(xz[0], xz[1]);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 1.9, 14), tankMat);
    tank.position.set(xz[0], y0 + 0.95, xz[1]);
    tank.castShadow = true;
    garden.add(tank);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.28, 8), ribMat);
    cap.position.set(xz[0], y0 + 2.02, xz[1]);
    garden.add(cap);
    addCollider(wx(xz[0], xz[1]), wz(xz[0], xz[1]), 0.9);
  });
  [[vaultR + 3.5, 16], [vaultR + 8, -14], [vaultR + 12, 8]].forEach((xz) => {
    const y0 = sitLocal(xz[0], xz[1]);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.85, 0.9), crateMat);
    crate.position.set(xz[0], y0 + 0.48, xz[1]);
    crate.rotation.y = (xz[0] + xz[1]) * 0.05;
    crate.castShadow = true;
    garden.add(crate);
    addCollider(wx(xz[0], xz[1]), wz(xz[0], xz[1]), 0.7);
  });
  for (let i = 0; i < 4; i++) {
    const z = -16 + i * 10;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 1.3), solarMat);
    panel.rotation.x = -0.55;
    panel.position.set(vaultR + 14.5, sitLocal(vaultR + 14.5, z) + 1.1, z);
    garden.add(panel);
  }

  if (!IS_MOBILE) {
    const lamp = new THREE.PointLight(0xffe2c0, 2.4, 48, 1.6);
    lamp.position.set(vaultR + 6, sitLocal(vaultR + 6, 0) + 5.5, 0);
    garden.add(lamp);
  }

})();

const worldAnim = { flyers: [], crowds: [], landmarks: [] };

function makeAlien() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x3DBF7A, roughness: 0.42, metalness: 0.12 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 8), skin);
  head.scale.set(0.82, 1.2, 0.72);
  head.position.y = 1.48;
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const eL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), eyeM);
  const eR = eL.clone();
  eL.position.set(-0.12, 1.52, 0.24);
  eR.position.set(0.12, 1.52, 0.24);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.48, 3, 6), skin);
  body.position.y = 0.76;
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.34, 3, 5), skin);
  const armR = armL.clone();
  armL.position.set(-0.3, 0.9, 0.04);
  armR.position.set(0.3, 0.9, 0.04);
  g.add(body, head, eL, eR, armL, armR);
  g.userData.armR = armR;
  g.userData.armL = armL;
  g.scale.setScalar(LOOK_CROWD);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}
function makeFan(hex) {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, metalness: 0.08 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xE0B090, roughness: 0.6 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.48, 3, 6), suit);
  torso.position.y = 0.82;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 7), skin);
  head.position.y = 1.28;
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 3, 5), suit);
  const armR = armL.clone();
  armL.position.set(-0.3, 0.92, 0.04);
  armR.position.set(0.3, 0.92, 0.04);
  g.add(torso, head, armL, armR);
  g.userData.armR = armR;
  g.userData.armL = armL;
  g.scale.setScalar(LOOK_CROWD);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}
function makeAstronaut(hex) {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.52, metalness: 0.22 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x15202c, metalness: 0.92, roughness: 0.1, envMapIntensity: 1.2 });
  const packM = new THREE.MeshStandardMaterial({ color: 0x6a6e74, metalness: 0.45, roughness: 0.4 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.52, IS_MOBILE ? 2 : 4, IS_MOBILE ? 6 : 8), suit);
  torso.position.y = 0.82;
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.2, IS_MOBILE ? 6 : 10, IS_MOBILE ? 5 : 8), visor);
  helm.position.y = 1.28;
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.16), packM);
  pack.position.set(0, 0.88, -0.24);
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.32, 3, 6), suit);
  const armR = armL.clone();
  armL.position.set(-0.3, 0.92, 0.04);
  armR.position.set(0.3, 0.92, 0.04);
  armL.rotation.z = 0.35;
  armR.rotation.z = -0.45;
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.34, 3, 6), suit);
  const legR = legL.clone();
  legL.position.set(-0.12, 0.32, 0);
  legR.position.set(0.12, 0.32, 0);
  g.add(torso, helm, pack, armL, armR, legL, legR);
  g.userData.armR = armR;
  g.userData.armL = armL;
  g.scale.setScalar(LOOK_CROWD);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}
function makeRover() {
  const g = new THREE.Group();
  const bodyM = new THREE.MeshStandardMaterial({ color: 0xc4b48a, roughness: 0.55, metalness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.7, metalness: 0.2 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.45, metalness: 0.5 });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 1.7), bodyM);
  chassis.position.y = 0.72;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 1.2), gold);
  deck.position.y = 1.02;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.35, 8), dark);
  mast.position.set(-0.55, 1.55, 0.2);
  const cam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.18), dark);
  cam.position.set(-0.55, 2.18, 0.2);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.04, 0.9), new THREE.MeshStandardMaterial({ color: 0x101820, metalness: 0.7, roughness: 0.22 }));
  panel.position.set(0.15, 1.22, 0);
  panel.rotation.x = -0.35;
  g.add(chassis, deck, mast, cam, panel);
  const wr = 0.28;
  [[-0.85, 0.7], [0, 0.78], [0.85, 0.7], [-0.85, -0.7], [0, -0.78], [0.85, -0.7]].forEach(([z, x]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.22, 10), dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, wr + 0.04, z);
    g.add(w);
  });
  g.scale.setScalar(LOOK_ROVER);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}
function alongTrack(t, side, dist) {
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t);
  const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  return { x: p.x + right.x * side * dist, z: p.z + right.z * side * dist, p, tan, right, yaw: Math.atan2(tan.x, tan.z) };
}

const gltfLoader = new GLTFLoader();
{
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://unpkg.com/three@0.167.1/examples/jsm/libs/draco/gltf/");
  gltfLoader.setDRACOLoader(draco);
}
const glbCache = Object.create(null);
const glbWait = Object.create(null);
const MARS_TINT = new THREE.Color(0xC47858);
function cloneGlb(src) {
  const g = src.clone(true);
  g.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
  });
  return g;
}
function marsPaint(root, amt) {
  const k = amt == null ? 0.42 : amt;
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (m.color) m.color.lerp(MARS_TINT, k);
      if (m.roughness != null) m.roughness = Math.max(m.roughness, 0.7);
      m.needsUpdate = true;
    });
  });
}
function loadGlb(url, cb) {
  if (glbCache[url]) { cb(cloneGlb(glbCache[url])); return; }
  (glbWait[url] || (glbWait[url] = [])).push(cb);
  if (glbWait[url].length > 1) return;
  gltfLoader.load(url, (g) => {
    glbCache[url] = g.scene;
    const q = glbWait[url] || [];
    delete glbWait[url];
    q.forEach((fn) => fn(cloneGlb(g.scene)));
  }, undefined, () => { delete glbWait[url]; });
}
function sitGlb(root, x, z, worldH, rotY, opts) {
  opts = opts || {};
  if (opts.keepOffRocket && nearShipFire(x, z)) return null;
  root.rotation.y = rotY || 0;
  root.position.set(x, 0, z);
  root.scale.setScalar(1);
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root);
  const h = Math.max(0.05, box.max.y - box.min.y);
  if (worldH) root.scale.setScalar(worldH / h);
  root.updateMatrixWorld(true);
  box.setFromObject(root);
  const foot = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  if (!opts.allowPath && aabbOnRibbon(box)) return null;
  root.position.y = groundH(x, z) - box.min.y - (opts.bury != null ? opts.bury : 0.08);
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
  });
  (opts.parent || scene).add(root);
  if (opts.collider) addCollider(x, z, opts.collider === true ? Math.max(1.1, foot * 0.38) : opts.collider, !!opts.parent);
  return root;
}
function makeBiodome(R) {
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({
    color: 0x8ec9b8, metalness: 0.18, roughness: 0.14, transparent: true,
    opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, fog: true
  });
  const rib = new THREE.MeshStandardMaterial({ color: 0x2c3238, metalness: 0.55, roughness: 0.4 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x3a7a48, roughness: 0.78, metalness: 0.05 });
  const fruit = new THREE.MeshStandardMaterial({ color: 0xc43c28, roughness: 0.45, metalness: 0.1 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), glass);
  dome.position.y = 0.05;
  const wire = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.52), new THREE.MeshBasicMaterial({ color: 0x1a1e22, wireframe: true, fog: false }));
  wire.position.y = 0.05;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, 0.18, 6, 24), rib);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;
  g.add(dome, wire, ring);
  const leafGeo = new THREE.IcosahedronGeometry(0.45, 1);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const rr = R * (0.22 + (i % 3) * 0.12);
    const bush = new THREE.Mesh(leafGeo, leaf);
    bush.position.set(Math.cos(a) * rr, 0.55 + (i % 4) * 0.18, Math.sin(a) * rr);
    bush.scale.setScalar(0.9 + (i % 3) * 0.25);
    g.add(bush);
    if (i % 2 === 0) {
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), fruit);
      berry.position.copy(bush.position);
      berry.position.y += 0.45;
      g.add(berry);
    }
  }
  g.userData.foot = R * 2;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  return g;
}
function plantBiodome(t, side, dist, R) {
  const p = alongTrack(t, side, dist);
  if (nearShipFire(p.x, p.z)) return;
  const g = makeBiodome(R);
  g.position.set(p.x, groundH(p.x, p.z), p.z);
  g.rotation.y = p.yaw;
  const keep = HALF_W + 14;
  if (minDistToPath(p.x, p.z) - R < keep) return;
  scene.add(g);
  addCollider(p.x, p.z, R * 0.85);
}
function plantCrowd(t, side, dist, n) {
  const at = alongTrack(t, side, dist);
  if (nearShipFire(at.x, at.z) || (t > 0.47 && t < 0.60)) return;
  const g = new THREE.Group();
  g.position.set(at.x, 0, at.z);
  g.rotation.y = at.yaw + (side > 0 ? Math.PI : 0);
  const colors = [0xf4f6f8, 0x3d5a80, 0xd0d4da, 0xc45c18];
  for (let i = 0; i < n; i++) {
    const a = makeAstronaut(colors[i % colors.length]);
    const lx = (i - (n - 1) * 0.5) * 1.2;
    const lz = (i % 2) * 0.7;
    a.position.set(lx, groundH(at.x + lx, at.z + lz), lz);
    a.userData.baseY = a.position.y;
    a.userData.phase = i * 0.7;
    g.add(a);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.1, 6), trussMat);
  pole.position.set(0, groundH(at.x, at.z) + 1.55, -0.85);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 1.4), bannerMat);
  flag.position.set(0, groundH(at.x, at.z) + 2.65, -0.2);
  g.add(pole, flag);
  scene.add(g);
  worldAnim.crowds.push(g);
  worldAnim.landmarks.push({ kind: "CROWD", x: at.x, z: at.z, r: 16, cool: 0 });
}
function plantRover(t, side, dist) {
  const at = alongTrack(t, side, dist);
  const r = makeRover();
  r.position.set(at.x, groundH(at.x, at.z), at.z);
  r.rotation.y = at.yaw + 0.35 * side;
  scene.add(r);
  addCollider(at.x, at.z, 2.3);
}
const habGlass = new THREE.MeshStandardMaterial({
  color: 0x9ad4c8, metalness: 0.2, roughness: 0.12, transparent: true,
  opacity: 0.2, side: THREE.DoubleSide, fog: true, depthWrite: false
});
const habRib = new THREE.MeshStandardMaterial({ color: 0xC8D0D4, metalness: 0.8, roughness: 0.32 });
const habDeck = new THREE.MeshStandardMaterial({ color: 0x6A4A38, roughness: 0.88, metalness: 0.08 });
function plantHabitat(t, side, dist) {
  const at = alongTrack(t, side, dist);
  const g = new THREE.Group();
  g.position.set(at.x, 0, at.z);
  g.rotation.y = at.yaw;
  const y0 = groundH(at.x, at.z);
  const R = 7.2, L = 20;
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, L, IS_MOBILE ? 10 : 18, 1, true, Math.PI / 2, Math.PI),
    habGlass
  );
  glass.rotation.x = Math.PI / 2;
  glass.position.y = y0 + 0.12;
  glass.frustumCulled = false;
  g.add(glass);
  const segs = IS_MOBILE ? 3 : 5;
  for (let i = 0; i < segs; i++) {
    const z = -L * 0.4 + i * (L * 0.8 / Math.max(1, segs - 1));
    const rib = new THREE.Mesh(new THREE.TorusGeometry(R, 0.1, 6, IS_MOBILE ? 10 : 16, Math.PI), habRib);
    rib.position.set(0, y0 + 0.12, z);
    g.add(rib);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(R * 1.6, 0.12, L * 0.85), habDeck);
  deck.position.set(side * 2.2, y0 + 0.06, 0);
  g.add(deck);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 1.5, 8), habRib);
  tank.position.set(side * 4.5, y0 + 0.75, -4);
  g.add(tank);
  const ast = makeAstronaut(0xf4f6f8);
  ast.position.set(side * 3.4, y0, 2.2);
  ast.userData.baseY = y0;
  ast.userData.phase = t * 8;
  g.add(ast);
  scene.add(g);
  worldAnim.crowds.push(g);
}

(function worldDress() {
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x101820, metalness: 0.72, roughness: 0.22 });
  const dummy = new THREE.Object3D();
  const panelGeo = new THREE.BoxGeometry(3.6, 0.05, 1.7);
  const farmN = IS_MOBILE ? 28 : 72;
  const farm = new THREE.InstancedMesh(panelGeo, solarMat, farmN);
  farm.frustumCulled = false;
  let n = 0;
  const rows = IS_MOBILE ? 5 : 8, cols = IS_MOBILE ? 6 : 9;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (n >= farmN) break;
      const t = 0.33 + row * 0.012;
      const at = alongTrack(t, -1, 48 + col * 4.2);
      dummy.position.set(at.x, groundH(at.x, at.z) + 1.15, at.z);
      dummy.rotation.set(-0.52, at.yaw, 0);
      dummy.updateMatrix();
      farm.setMatrixAt(n++, dummy.matrix);
    }
  }
  farm.count = n;
  farm.instanceMatrix.needsUpdate = true;
  scene.add(farm);
  const solarAt = alongTrack(0.38, -1, 64);
  worldAnim.landmarks.push({ kind: "SOLAR", x: solarAt.x, z: solarAt.z, r: 48, cool: 0 });


  plantCrowd(0.14, -1, 48, IS_MOBILE ? 3 : 5);
  plantCrowd(0.28, -1, 46, IS_MOBILE ? 2 : 4);
  plantCrowd(0.41, 1, 50, IS_MOBILE ? 3 : 5);
  plantCrowd(0.88, 1, 48, IS_MOBILE ? 2 : 4);
  if (!IS_MOBILE) {
    plantCrowd(0.21, 1, 48, 3);
    plantCrowd(0.96, -1, 50, 5);
  }

  plantRover(0.18, 1, 52);
  plantRover(0.68, -1, 50);

  const flameO = new THREE.MeshBasicMaterial({
    color: 0x8A4DFF, transparent: true, opacity: 0.62, fog: false, toneMapped: false, side: THREE.DoubleSide, depthWrite: false
  });
  const flameM = new THREE.MeshBasicMaterial({
    color: 0xFF7AD9, transparent: true, opacity: 0.55, fog: false, toneMapped: false, side: THREE.DoubleSide, depthWrite: false
  });
  const flameI = new THREE.MeshBasicMaterial({
    color: 0xC4F2FF, transparent: true, opacity: 0.9, fog: false, toneMapped: false, side: THREE.DoubleSide, depthWrite: false
  });
  function attachExhaust(root) {
    const exhaust = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(5.2, 26, 10, 1, true), flameO);
    const mid = new THREE.Mesh(new THREE.ConeGeometry(3.4, 22, 10, 1, true), flameM);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(2.1, 18, 8, 1, true), flameI);
    outer.rotation.x = Math.PI;
    mid.rotation.x = Math.PI;
    inner.rotation.x = Math.PI;
    outer.position.y = -13;
    mid.position.y = -11;
    inner.position.y = -9;
    exhaust.add(outer, mid, inner);
    exhaust.visible = false;
    exhaust.scale.setScalar(0.001);
    root.add(exhaust);
    return exhaust;
  }
  loadStl("./mesh/obj_3_Ship.stl", (geo) => {
    const h = Math.max(0.05, geo.boundingBox.max.y - geo.boundingBox.min.y);
    function placeShip(x, z, worldH, rotY, mode) {
      const g = new THREE.Group();
      const m = new THREE.Mesh(geo, steelRocket);
      m.scale.setScalar(worldH / h);
      m.castShadow = true;
      m.frustumCulled = false;
      m.renderOrder = 2;
      g.add(m);
      const ex = attachExhaust(g);
      g.position.set(x, groundH(x, z), z);
      g.rotation.y = rotY || 0;
      g.frustumCulled = false;
      scene.add(g);
      registerShipFire(x, z, 52);
      addCollider(x, z, Math.max(2.2, worldH * 0.12));
      if (mode === "hover") {
        worldAnim.flyers.push({ g, exhaust: ex, phase: "hover", t: Math.random() * 4, baseY: g.position.y, worldH, mars: true });
      } else if (mode === "fly") {
        worldAnim.flyers.push({ g, exhaust: ex, phase: Math.random() < 0.5 ? "pad" : "coast", t: Math.random() * 8, baseY: g.position.y, worldH, mars: true });
      }
      return g;
    }
    placeShip(-240, 560, 52, 0.4, "fly");
    placeShip(640, 1520, 58, -0.6, "fly");
    placeShip(160, -260, 46, 1.2, "fly");
    if (!IS_MOBILE) placeShip(780, 980, 50, -1.1, "fly");
  });

  dressColony();
  plantPeopleOffPad();
})();

function dressColony() {
  const off = { keepOffRocket: true, clear: 12 };
  function at(t, side, dist) { return alongTrack(t, side, dist); }
  function put(url, t, side, dist, worldH, yawAdd, extra, paint) {
    loadGlb(url, (root) => {
      const p = at(t, side, dist);
      if (paint) marsPaint(root, paint);
      sitGlb(root, p.x, p.z, worldH, p.yaw + (yawAdd || 0), Object.assign({ collider: true, bury: 0.1 }, off, extra || {}));
    });
  }
  function pile(t, side, dist, list) {
    const p = at(t, side, dist);
    list.forEach((it) => {
      const x = p.x + p.right.x * (it.x || 0) + p.tan.x * (it.z || 0);
      const z = p.z + p.right.z * (it.x || 0) + p.tan.z * (it.z || 0);
      loadGlb(it.url, (root) => {
        sitGlb(root, x, z, it.h, p.yaw + (it.r || 0), { collider: it.c || 0.7, bury: 0.06, keepOffRocket: true, clear: 12 });
      });
    });
  }

  plantBiodome(0.08, -1, 56, 11);
  plantBiodome(0.11, -1, 72, 9);
  if (!IS_MOBILE) plantBiodome(0.09, 1, 62, 8);
  put("./lib/hangar_roundGlass.glb", 0.10, -1, 88, 16, 0.2, { collider: 7.2 });

  pile(0.03, -1, 56, [
    { url: "./lib/crate-01.glb", x: 2, z: 0, h: 1.15, r: 0.2 },
    { url: "./lib/crate-01.glb", x: 3.1, z: 1.1, h: 1.1, r: 0.8 },
    { url: "./lib/oil-drum.glb", x: 1.2, z: 1.6, h: 1.35, r: 0.4 },
    { url: "./lib/space-barrel.glb", x: 3.4, z: -0.8, h: 1.4, r: 1.1 },
    { url: "./lib/ammo-crate.glb", x: 0.4, z: 0.6, h: 1.0, r: 0.3 }
  ]);

  put("./lib/gate_simple.glb", 0.96, -1, 50, 5.5, 0, { collider: 1.8 });

  put("./lib/hangar_smallA.glb", 0.36, -1, 72, 8.5, 0.1, { collider: 4.5 });
  put("./lib/machine_generator.glb", 0.37, -1, 62, 3.4, 0.3, { collider: 1.8 });
  put("./lib/detail-tank.glb", 0.35, -1, 80, 4.4, 0, { collider: 2.2 });
  put("./lib/detail-tank.glb", 0.39, -1, 82, 3.8, 0.4, { collider: 2.0 });
  put("./lib/chimney-medium.glb", 0.38, -1, 88, 8.0, 0, { collider: 1.6 });
  put("./lib/satelliteDish_large.glb", 0.40, -1, 68, 4.6, 0.2, { collider: 1.5 });
  put("./lib/pipe_straight.glb", 0.37, -1, 76, 2.2, 1.57, { collider: 1.2 });
  put("./lib/building-a.glb", 0.38, -1, 96, 10, 0.12, { collider: 5.5 }, 0.22);
  pile(0.36, -1, 58, [
    { url: "./lib/oil-drum-stack.glb", x: 0, z: 0, h: 2.3, r: 0.1, c: 1.2 },
    { url: "./lib/oil-drum.glb", x: 2.2, z: 1.4, h: 1.35, r: 0.6 },
    { url: "./lib/oil-drum.glb", x: -1.8, z: 1.1, h: 1.35, r: 1.2 },
    { url: "./lib/crate-01.glb", x: 1.4, z: -1.6, h: 1.15, r: 0.3 },
    { url: "./lib/crate-01.glb", x: 2.4, z: -0.6, h: 1.1, r: 0.9 },
    { url: "./lib/space-barrel.glb", x: -2.4, z: -1.2, h: 1.4, r: 0.4 },
    { url: "./lib/box-large.glb", x: 0.2, z: 2.4, h: 1.6, r: 0.2, c: 1.0 }
  ]);
  put("./lib/craft_speederA.glb", 0.39, -1, 54, 2.4, 0.5, { collider: 1.6, bury: 0.02 });

  put("./lib/meteor.glb", 0.51, 1, 62, 3.2, 0.4, { collider: 1.4 }, 0.3);
  put("./lib/debris-pile.glb", 0.54, -1, 58, 2.2, 0.2, { collider: 1.1 }, 0.25);
  put("./lib/space-rock-a.glb", 0.56, 1, 70, 3.0, 0.8, { collider: 1.3 }, 0.35);

  plantBiodome(0.62, 1, 56, 12);
  plantBiodome(0.66, -1, 58, 10);
  put("./lib/hangar_roundGlass.glb", 0.64, 1, 74, 18, 0.15, { collider: 7.5 });
  put("./lib/hangar_roundA.glb", 0.67, -1, 70, 14, 0.2, { collider: 6.2 });
  put("./lib/satelliteDish_large.glb", 0.63, 1, 64, 4.2, 0.4, { collider: 1.4 });
  put("./lib/rover.glb", 0.64, 1, 44, 2.3, 0.6, { collider: 1.6, bury: 0.02 });
  put("./lib/structure_detailed.glb", 0.65, -1, 64, 5.2, 0.1, { collider: 2.8 });
  pile(0.63, 1, 46, [
    { url: "./lib/crate-01.glb", x: 2, z: 0.4, h: 1.15, r: 0.2 },
    { url: "./lib/oil-drum.glb", x: 3.1, z: 1.5, h: 1.35, r: 0.7 },
    { url: "./lib/space-barrel.glb", x: 1.2, z: 2.0, h: 1.4, r: 0.3 }
  ]);
  if (!IS_MOBILE) {
    loadGlb("./lib/hab/chair_A.gltf", (root) => {
      const p = at(0.62, 1, 50);
      sitGlb(root, p.x, p.z, 1.1, p.yaw + 0.4, { collider: 0.4, bury: 0.02, keepOffRocket: true, clear: 12 });
    });
  }

  [
    [0.10, -1, 88, "./lib/nature-rock-a.glb", 5.2, 0.5],
    [0.18, 1, 96, "./lib/nature-rock-b.glb", 6.0, 0.48],
    [0.26, -1, 92, "./lib/rock_tallA.glb", 7.5, 0.45],
    [0.34, 1, 108, "./lib/craterLarge.glb", 3.2, 0.4],
    [0.44, -1, 100, "./lib/sandstone-boulder.glb", 4.2, 0.25],
    [0.58, 1, 94, "./lib/nature-rock-c.glb", 5.0, 0.5],
    [0.72, -1, 102, "./lib/crater.glb", 2.4, 0.4],
    [0.80, 1, 90, "./lib/rock_tallC.glb", 6.8, 0.45],
    [0.90, -1, 98, "./lib/nature-rock-d.glb", 5.4, 0.5],
    [0.97, 1, 86, "./lib/sandstone-boulder.glb", 3.8, 0.25]
  ].forEach((s, i) => {
    if (IS_MOBILE && i % 2) return;
    put(s[3], s[0], s[1], s[2], s[4], i * 0.3, { collider: i < 3, bury: 0.2 }, s[5]);
  });
}
function plantPeopleOffPad() {
  const suits = [0xf4f6f8, 0x3d5a80, 0xc45c18, 0xd0d4da];
  const spots = [
    [0.14, -1, 46], [0.28, -1, 44], [0.41, 1, 48],
    [0.64, 1, 46], [0.88, 1, 46]
  ];
  spots.slice(0, IS_MOBILE ? 3 : spots.length).forEach((s, i) => {
    const p = alongTrack(s[0], s[1], s[2]);
    if (nearShipFire(p.x, p.z) || (s[0] > 0.47 && s[0] < 0.60)) return;
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.yaw + (s[1] > 0 ? Math.PI : 0);
    const a = makeAstronaut(suits[i % suits.length]);
    a.position.set(0, groundH(p.x, p.z), 0);
    a.userData.baseY = a.position.y;
    a.userData.phase = i * 0.9;
    g.add(a);
    scene.add(g);
    worldAnim.crowds.push(g);
  });
}

(function buildCeremony() {
  const g = new THREE.Group();
  g.name = "ceremony";
  g.visible = false;
  loadGlb("./lib/trophy.glb", (root) => {
    const box = new THREE.Box3().setFromObject(root);
    const h = Math.max(0.05, box.max.y - box.min.y);
    root.scale.setScalar(2.8 / h);
    root.position.set(0, 2.35, 0);
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      o.material = new THREE.MeshStandardMaterial({ color: 0xE8C84A, metalness: 0.92, roughness: 0.22, emissive: 0x6a4a10, emissiveIntensity: 0.35 });
      o.castShadow = true;
      o.frustumCulled = false;
    });
    g.add(root);
    ceremony.trophy = root;
  });
  const n = IS_MOBILE ? 40 : 120;
  const sprayGeo = new THREE.BufferGeometry();
  sprayGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const spray = new THREE.Points(
    sprayGeo,
    new THREE.PointsMaterial({
      color: 0xfff6d0, size: 0.11, transparent: true, opacity: 0.92,
      depthWrite: false, fog: false, toneMapped: false, sizeAttenuation: true
    })
  );
  spray.frustumCulled = false;
  spray.visible = false;
  spray.userData.n = n;
  spray.userData.vel = new Float32Array(n * 3);
  spray.userData.life = new Float32Array(n);
  g.add(spray);
  ceremony.spray = spray;
  scene.add(g);
  ceremony.g = g;
})();

const rivalKitGeo = { body: null };

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
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.4, "rgba(255,255,255,0.5)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const DUST_N = IS_MOBILE ? 160 : 500;
const dustPos = new Float32Array(DUST_N * 3);
const dustVel = new Float32Array(DUST_N * 3);
const dustLife = new Float32Array(DUST_N);
const dummy = new THREE.Object3D();
const dustMesh = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({
    map: dustSprite(), color: 0xE87840, transparent: true, depthWrite: false,
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
function gateBannerTex(label, finish) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (finish) {
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 4; j++) {
        if (((i + j) & 1) === 0) {
          ctx.fillStyle = "#f4f4f2";
          ctx.fillRect(i * 32, j * 32, 32, 32);
        }
      }
    }
    ctx.fillStyle = "#111111cc";
    ctx.fillRect(86, 28, 340, 72);
    ctx.fillStyle = "#ffee55";
  } else {
    ctx.fillStyle = "#0c1018";
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = "#3de8ff22";
    ctx.fillRect(0, 0, 512, 8);
    ctx.fillRect(0, 120, 512, 8);
    ctx.fillStyle = "#3de8ff";
  }
  ctx.font = "700 58px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function makeGate(index, t) {
  const { p, tan } = placeOnTrack(t);
  const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const fwd = new THREE.Vector3(tan.x, 0, tan.z).normalize();
  const yaw = Math.atan2(tan.x, tan.z);
  const y = terrainH(p.x, p.z);
  const hw = HALF_W - 0.8;
  const finish = index === GATE_COUNT - 1;
  const g = new THREE.Group();
  g.name = "gate-" + index;
  g.position.set(p.x, 0, p.z);
  g.rotation.y = yaw;
  const postMat = new THREE.MeshStandardMaterial({
    color: STEEL, metalness: 0.9, roughness: 0.28, envMapIntensity: 1.2
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x141418, metalness: 0.72, roughness: 0.32
  });
  const litHex = finish ? 0xffee55 : 0x3de8ff;
  const postH = 10.2;
  const span = hw * 2 + 0.9;
  [-1, 1].forEach((s) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, postH, 0.5), postMat);
    post.position.set(s * hw, y + postH * 0.5, 0);
    post.castShadow = true;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.28, 1.35), dark);
    foot.position.set(s * hw, y + 0.14, 0);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.22, 0.72), dark);
    cap.position.set(s * hw, y + postH + 0.08, 0);
    const brace = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.16), postMat);
    brace.position.set(s * (hw - 0.9), y + 4.6, 0);
    brace.rotation.z = s * -0.38;
    g.add(post, foot, cap, brace);
  });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 0.62, 0.85), dark);
  beam.position.set(0, y + postH - 0.12, 0);
  beam.castShadow = true;
  const beam2 = new THREE.Mesh(new THREE.BoxGeometry(span, 0.22, 0.22), postMat);
  beam2.position.set(0, y + postH - 0.55, -0.42);
  g.add(beam, beam2);
  const lights = [];
  const nLit = 9;
  for (let i = 0; i < nLit; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: litHex, toneMapped: false, fog: false });
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.36), mat);
    pod.position.set(-span * 0.38 + i * (span * 0.76 / (nLit - 1)), y + postH + 0.28, -0.32);
    g.add(pod);
    lights.push({ mesh: pod, mat, lit: litHex });
  }
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(18, span * 0.72), 1.55),
    new THREE.MeshBasicMaterial({
      map: gateBannerTex(finish ? "FINISH" : ("GATE " + (index + 1)), finish),
      toneMapped: false, fog: false, side: THREE.FrontSide
    })
  );
  banner.position.set(0, y + postH - 1.55, -0.18);
  banner.rotation.y = Math.PI;
  g.add(banner);
  scene.add(g);
  return { index, t, pos: p.clone().setY(y), forward: fwd, right, halfW: hw, mesh: g, lights, litHex };
}
const gates = gateTs.map((t, i) => makeGate(i, t));
(function plantFinishFlags() {
  const g = gates[GATE_COUNT - 1];
  const dist = HALF_W + 6.5;
  [-1, 1].forEach((s) => {
    loadGlb("./lib/flagCheckers.glb", (root) => {
      const x = g.pos.x + g.right.x * s * dist;
      const z = g.pos.z + g.right.z * s * dist;
      sitGlb(root, x, z, 4.4, Math.atan2(g.forward.x, g.forward.z) + (s > 0 ? 0.15 : -0.15), { bury: 0.04, collider: false });
    });
  });
})();

const elTimer = document.getElementById("timer-val");
const elGateIdx = document.getElementById("gate-idx");
const elGateDist = document.getElementById("gate-dist");
const elGatePanel = document.getElementById("gate-panel");
const elChevron = document.getElementById("chevron");
const elSpeed = document.getElementById("speed-val");
const elBoostFill = document.getElementById("boost-fill");
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
const BOOST_SPEED = 128;
const TURBO_SPEED = 172;
const GRAVITY = 28;
const car = {
  x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0,
  speed: 0, lat: 0, boost: 1, overheating: false, spinT: 0,
  vy: 0, air: false, turboT: 0, starT: 0
};
const pickups = [];
let startLock = true, countT = 3.5, falseStart = false, holdLaunch = false;
let playerWon = true, raceLap = 0;
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
function hexCss(n) { return "#" + n.toString(16).padStart(6, "0"); }
function paintSwatchSync() {
  document.querySelectorAll(".paint-swatch").forEach((b, i) => {
    const open = paintUnlocked(i);
    b.classList.toggle("on", i === liveryIdx);
    b.classList.toggle("locked", !open);
    const L = LIVERIES[i];
    b.title = open ? L.name : (L.name + "  ·  " + L.need + " PTS");
  });
}
function applyLivery(idx, toast) {
  liveryIdx = ((idx % LIVERIES.length) + LIVERIES.length) % LIVERIES.length;
  if (!paintUnlocked(liveryIdx)) {
    if (toast) showToast("LOCKED  " + LIVERIES[liveryIdx].need + " PTS", 0.8);
    liveryIdx = 0;
  }
  const L = LIVERIES[liveryIdx];
  [steelBody, steelStl].forEach((m) => {
    m.color.setHex(L.color);
    m.emissive.setHex(L.color);
    m.emissiveIntensity = L.emi != null ? L.emi : 0.32;
    m.metalness = L.metalness;
    m.roughness = L.roughness;
    m.envMapIntensity = L.env;
    m.vertexColors = L.name !== "STEEL";
    m.needsUpdate = true;
  });
  if (elLiveryTap) elLiveryTap.style.backgroundColor = hexCss(L.color);
  paintSwatchSync();
  try { localStorage.setItem(PAINT_KEY, String(liveryIdx)); } catch (err) {}
  if (toast) showToast(L.name, 0.55);
}
function cycleLivery() {
  for (let k = 1; k <= LIVERIES.length; k++) {
    const i = (liveryIdx + k) % LIVERIES.length;
    if (paintUnlocked(i)) { applyLivery(i, true); return; }
  }
}
function grantPaintUnlocks() {
  const s = raceScore();
  const fresh = [];
  LIVERIES.forEach((L) => {
    if ((L.need || 0) <= 0) return;
    if (paintUnlocks[L.name]) return;
    if (s >= L.need) {
      paintUnlocks[L.name] = true;
      fresh.push(L.name);
    }
  });
  if (fresh.length) {
    savePaintUnlocks();
    paintSwatchSync();
    showToast("PAINT  " + fresh.join("  "), 1.2);
  }
}
function commitName(raw) {
  let n = sanitizeName(raw);
  if (!n) n = "ACE";
  playerName = n;
  try { localStorage.setItem(NAME_KEY, n); } catch (err) {}
  const boot = document.getElementById("boot-name");
  if (boot && boot.value !== n) boot.value = n;
  const hs = document.getElementById("hs-name");
  if (hs && document.activeElement !== hs) hs.value = n;
  const chip = document.getElementById("pilot-chip");
  if (chip) chip.textContent = n;
  return n;
}
let hurtSafeT = 0;
const HURT_SAFE = 3;
function hurtSafe() { return hurtSafeT > 0 || car.starT > 0; }
function armHurtSafe(silent) {
  hurtSafeT = HURT_SAFE;
  if (!silent) showToast("SAFE  3", 0.45);
}
function stepHurtSafe(dt) {
  if (car.starT > 0) {
    car.starT -= dt;
    if (truck) truck.visible = true;
    if (car.starT <= 0) { car.starT = 0; showToast("STAR END", 0.45); }
  }
  if (hurtSafeT > 0) {
    hurtSafeT -= dt;
    if (car.starT <= 0) truck.visible = Math.floor(hurtSafeT * 14) % 2 === 0;
    if (hurtSafeT <= 0) { hurtSafeT = 0; if (car.starT <= 0) truck.visible = true; }
  } else if (truck && truck.visible === false && car.starT <= 0) truck.visible = true;
}
function spinOut(t) {
  if (hurtSafe()) return;
  if (car.spinT > 0) return;
  car.spinT = t || 1.05;
  car.speed *= 0.35;
  showToast("SPIN OUT", 0.7);
  armHurtSafe(true);
}
function hitOffTrack() {
  return minDistToPath(car.x, car.z) > HALF_W + 1.6;
}
function bumpObject(spdAbs, label) {
  emitDust(car.x, car.y + 0.4, car.z, 0, 0, 10);
  if (hitOffTrack()) {
    if (spdAbs > 8) spinOut(0.72);
    else {
      car.speed *= 0.38;
      showToast("SPIN", 0.4);
      armHurtSafe();
    }
    return;
  }
  dumpCoinsOnHit();
  car.speed *= Math.min(DIFF.slow || 0.55, 0.58);
  if (car.air) car.vy *= 0.4;
  showToast(label || "HIT", 0.4);
  armHurtSafe();
}
function onRetry() {
  spawnStart();
}

const elBoot = document.getElementById("boot");
const elDiffChip = document.getElementById("diff-chip");
const elShare = document.getElementById("share-chal");
const elBootSub = document.getElementById("boot-sub");
const elHome = document.getElementById("home");
const elHow = document.getElementById("how");
const elScores = document.getElementById("scores");
function setMenuOn(on) {
  document.body.classList.toggle("menu-on", !!on);
}
function hideMenuSheets() {
  if (elHome) elHome.classList.remove("show");
  if (elHow) elHow.classList.remove("show");
  if (elScores) elScores.classList.remove("show");
  if (elBoot) elBoot.classList.remove("show");
}
function showHome() {
  menuPage = "home";
  waitingDiff = true;
  hideMenuSheets();
  if (elHome) elHome.classList.add("show");
  if (elFinish) elFinish.classList.remove("show");
  document.body.classList.remove("mode-trial", "mode-open", "mode-hunt", "mode-free");
  setMenuOn(true);
}
function showBoot() {
  menuPage = "boot";
  waitingDiff = true;
  hideMenuSheets();
  const title = document.getElementById("boot-title");
  if (title) {
    title.textContent = MODE.key === "trial" ? "TIME TRIAL"
      : MODE.key === "tour" ? "TOUR"
      : MODE.key === "hunt" ? "EXPLORER"
      : MODE.key === "free" ? "FREESTYLE"
      : "PICK A LINE";
  }
  if (elBootSub) {
    elBootSub.textContent = MODE.key === "trial"
      ? "No coins. CPU plus ghosts of your best and the board's top 3. Send a challenge to share the board."
      : MODE.key === "tour"
      ? "Coins plus time. Race the CPU and a phantom of the fastest shared run."
      : MODE.key === "hunt"
      ? "Open world scavenger. Photograph the list in any order."
      : MODE.key === "free"
      ? "Timed. Hit the ribbon jumps. Grab sky coins."
      : "Set your name and paint, then choose a line.";
  }
  const elDiff = document.getElementById("boot-diff");
  const elFree = document.getElementById("boot-free");
  if (elDiff) elDiff.style.display = MODE.key === "free" ? "none" : "";
  if (elFree) elFree.style.display = MODE.key === "free" ? "" : "none";
  document.querySelectorAll(".boot-btn").forEach((b) => {
    const k = b.getAttribute("data-diff");
    const span = b.querySelector("span");
    if (!span || !k) return;
    if (MODE.key === "hunt") {
      span.textContent = k === "easy" ? "4 photos" : k === "hard" ? "10 photos" : k === "extra" ? "14 photos" : "7 photos";
    } else {
      span.textContent = k === "easy" ? "no drones" : k === "hard" ? "drones · two styles" : k === "extra" ? "dense drones" : "few drones";
    }
  });
  if (elBoot) elBoot.classList.add("show");
  setMenuOn(true);
}
function showHow() {
  menuPage = "how";
  hideMenuSheets();
  if (elHow) elHow.classList.add("show");
  setMenuOn(true);
}
function showScores() {
  menuPage = "scores";
  hideMenuSheets();
  renderHsBoard();
  if (elScores) elScores.classList.add("show");
  setMenuOn(true);
}
function goHome() {
  endCeremony();
  finished = false;
  spawnStart();
  waitingDiff = true;
  showHome();
}

function setDiffChip() {
  if (elDiffChip) elDiffChip.textContent = DIFF.tag + (ghostIn ? "  GHOST" : "");
}
function placeOnLat(t, lat) {
  const tt = ((t % 1) + 1) % 1;
  const p = curve.getPointAt(tt);
  const tan = curve.getTangentAt(tt);
  const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  return { x: p.x + right.x * lat, z: p.z + right.z * lat, tan, yaw: Math.atan2(tan.x, tan.z), right };
}
function makeBird() {
  const g = new THREE.Group();
  const bodyM = new THREE.MeshStandardMaterial({ color: 0x2A2A30, roughness: 0.55, metalness: 0.08 });
  const wingM = new THREE.MeshStandardMaterial({ color: 0x3A3A42, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), bodyM);
  body.scale.set(1.4, 0.7, 0.7);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 6), new THREE.MeshStandardMaterial({ color: 0xE09030, roughness: 0.4 }));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.85, 0.05, 0);
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.7), wingM);
  const wingR = wingL.clone();
  wingL.position.set(0, 0.1, 0.85);
  wingR.position.set(0, 0.1, -0.85);
  g.add(body, beak, wingL, wingR);
  g.userData.wingL = wingL;
  g.userData.wingR = wingR;
  g.frustumCulled = false;
  return g;
}
function makeBarrelHazard() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xC4A070, roughness: 0.62, metalness: 0.08 });
  const hoop = new THREE.MeshStandardMaterial({ color: 0x8A6A38, roughness: 0.45, metalness: 0.35 });
  const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.7, 14), wood);
  keg.position.y = 0.9;
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.07, 6, 16), hoop);
  r1.rotation.x = Math.PI / 2;
  r1.position.y = 0.35;
  const r2 = r1.clone();
  r2.position.y = 1.45;
  const warn = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.1, 6, 20), new THREE.MeshBasicMaterial({ color: 0xFFEE55, toneMapped: false, fog: false }));
  warn.rotation.x = Math.PI / 2;
  warn.position.y = 0.08;
  g.add(keg, r1, r2, warn);
  g.frustumCulled = false;
  return g;
}
function makeFlyer(kind) {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({
    color: 0xC8D0D8, metalness: 0.82, roughness: 0.28,
    emissive: 0x1a3348, emissiveIntensity: 0.4
  });
  const glow = new THREE.MeshBasicMaterial({ color: 0x3de8ff, toneMapped: false, fog: false });
  const lamp = new THREE.MeshBasicMaterial({ color: 0x66ff99, toneMapped: false, fog: false });
  if (kind === 0) {
    const disc = new THREE.Mesh(new THREE.SphereGeometry(1.75, 12, 8), hull);
    disc.scale.set(1, 0.22, 1);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.72, 10, 8), new THREE.MeshStandardMaterial({
      color: 0x7ad0ff, metalness: 0.15, roughness: 0.1, transparent: true, opacity: 0.55,
      emissive: 0x3de8ff, emissiveIntensity: 0.7
    }));
    dome.position.y = 0.4;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.58, 0.1, 6, 18), glow);
    ring.rotation.x = Math.PI / 2;
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 1.7, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x66ffaa, transparent: true, opacity: 0.2, toneMapped: false, fog: false, side: THREE.DoubleSide
      })
    );
    beam.position.y = -0.95;
    g.add(disc, dome, ring, beam);
  } else if (kind === 1) {
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.88), hull);
    const vane = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.06, 0.72), new THREE.MeshStandardMaterial({
      color: 0x102030, metalness: 0.72, roughness: 0.2
    }));
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), glow);
    dish.rotation.x = Math.PI;
    dish.position.y = 0.72;
    g.add(body, vane, dish);
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.42, 1.35), hull);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.12), hull);
      arm.position.set(Math.cos(a) * 0.85, 0.12, Math.sin(a) * 0.85);
      arm.rotation.y = a;
      const rotor = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 6, 12), lamp);
      rotor.rotation.x = Math.PI / 2;
      rotor.position.set(Math.cos(a) * 1.35, 0.22, Math.sin(a) * 1.35);
      g.add(arm, rotor);
    }
    g.add(box);
  }
  g.frustumCulled = false;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}
function makeCrateHazard() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({
    color: 0xC46A18, roughness: 0.55, metalness: 0.12,
    emissive: 0xFF6600, emissiveIntensity: 0.55
  });
  const warnMat = new THREE.MeshBasicMaterial({ color: 0xFFEE55, toneMapped: false, fog: false });
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.1, 2.4), wood);
  box.position.y = 1.05;
  const band = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.18, 2.55), new THREE.MeshBasicMaterial({ color: 0xFF4020, toneMapped: false, fog: false }));
  band.position.y = 1.05;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.16, 8, 28), warnMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  g.add(box, band, ring);
  g.frustumCulled = false;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}
function seedHazards() {
  while (hazards.length) {
    const h = hazards.pop();
    if (h.mesh) scene.remove(h.mesh);
  }
  const flyHz = DIFF.airHz || 0.8;
  const earth = PLANET.key === "earth";
  const nFly = DIFF.nFly || 0;
  const typeA = earth ? "bird" : "saucer";
  const typeB = "quad";
  for (let i = 0; i < nFly; i++) {
    const t = snapOffBigAir(0.18 + (i + 0.5) / Math.max(1, nFly) * 0.74);
    const kindKey = i % 2 ? typeB : typeA;
    const at0 = placeOnLat(t, 0);
    const y = terrainH(at0.x, at0.z) + (kindKey === "bird" ? 7.2 : 3.65);
    const g = kindKey === "bird" ? makeBird() : makeFlyer(kindKey === "saucer" ? 0 : 2);
    scene.add(g);
    hazards.push({
      t, y, r: kindKey === "bird" ? 1.35 : 1.95, air: true, kind: kindKey, moving: true,
      amp: HALF_W * (kindKey === "bird" ? 0.92 : 0.68),
      phase: i * 0.9, speed: flyHz,
      mesh: g, coolUntil: 0, x: 0, z: 0
    });
  }
  stepHazards(0);
}
function stepHazards(dt) {
  for (let i = 0; i < hazards.length; i++) {
    const h = hazards[i];
    if (h.mesh && !h.moving) h.mesh.rotation.y += dt * 0.4;
    if (!h.moving) continue;
    h.phase += dt * h.speed;
    const lat = Math.sin(h.phase) * h.amp;
    const at = placeOnLat(h.t, lat);
    h.x = at.x; h.z = at.z;
    if (h.mesh) {
      const bob = h.kind === "bird" ? Math.sin(h.phase * 3.2) * 0.55 : Math.sin(h.phase * 2.1) * 0.38;
      h.mesh.position.set(at.x, h.y + bob, at.z);
      if (h.kind === "bird") {
        h.mesh.lookAt(at.x + at.tan.x, h.y, at.z + at.tan.z);
        const flap = Math.sin(h.phase * 8) * 0.45;
        if (h.mesh.userData.wingL) h.mesh.userData.wingL.rotation.x = flap;
        if (h.mesh.userData.wingR) h.mesh.userData.wingR.rotation.x = -flap;
      } else {
        h.mesh.rotation.y += dt * (h.kind === "saucer" ? 1.4 : 2.4);
      }
    }
  }
}
function hitHazards(spdAbs, groundY) {
  if (hurtSafe() || car.spinT > 0) return;
  for (let i = 0; i < hazards.length; i++) {
    const h = hazards[i];
    if (h.coolUntil > timeMs) continue;
    const hx = h.x, hz = h.z;
    const hy = h.mesh ? h.mesh.position.y : h.y;
    const d = Math.hypot(car.x - hx, car.z - hz);
    const hitR = (h.r || 2) + 1.35;
    if (d > hitR) continue;
    const carBot = car.y - 0.15;
    const carTop = car.y + 2.55;
    const pad = h.kind === "bird" ? 1.15 : 1.4;
    const hBot = hy - pad;
    const hTop = hy + pad;
    if (carTop < hBot || carBot > hTop) continue;
    h.coolUntil = timeMs + 700;
    const nx = (car.x - hx) / (d || 1), nz = (car.z - hz) / (d || 1);
    car.x += nx * 1.35; car.z += nz * 1.35;
    h.phase += 0.85;
    bumpObject(spdAbs, h.kind === "bird" ? "BIRD" : h.kind === "quad" ? "DRONE" : h.kind === "saucer" ? "DRONE" : "HIT");
    return;
  }
}
const dogeMap = new THREE.TextureLoader().load("./lib/doge-coin.jpg");
dogeMap.colorSpace = THREE.SRGBColorSpace;
function makeCoinMesh() {
  const gold = new THREE.MeshStandardMaterial({
    color: 0xE8C84A, metalness: 0.88, roughness: 0.22,
    emissive: 0x6A4A10, emissiveIntensity: 0.35, fog: false
  });
  const face = new THREE.MeshStandardMaterial({
    map: dogeMap, color: 0xFFE08A, metalness: 0.72, roughness: 0.28,
    emissive: 0x3A2A08, emissiveIntensity: 0.22, fog: false
  });
  const mesh = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 0.22, 28), [gold, face, face]);
  core.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.12, 8, 28), gold);
  mesh.add(core, rim);
  mesh.frustumCulled = false;
  return mesh;
}
function plantCoin(t, lat, yAdd) {
  const at = placeOnLat(t, lat);
  const mesh = makeCoinMesh();
  const y = terrainH(at.x, at.z) + 2.6 + (yAdd || 0);
  mesh.position.set(at.x, y, at.z);
  scene.add(mesh);
  coins.push({ x: at.x, z: at.z, yAdd: yAdd || 0, mesh, taken: false });
}
function plantFlightCoins(j) {
  if (j.kind === "whoops") {
    for (let n = 0; n < 5; n++) {
      const u = 0.16 + n / 4 * 0.68;
      const t = (j.t + u * j.len / trackLen) % 1;
      plantCoin(t, ((n % 3) - 1) * 2.2, jumpProfile(j, u) + 1.7);
    }
    return;
  }
  if (j.kind !== "valley" && j.kind !== "table") return;
  const takeT = j.t + jumpTakeU(j) * j.len / trackLen;
  const flyLen = jumpFlyLen(j);
  const n = 14;
  const lift = PLANET.key === "moon" ? 2.4 : 1.5;
  for (let i = 0; i < n; i++) {
    const u = 0.12 + i / Math.max(1, n - 1) * 0.76;
    const t = (takeT + u * flyLen / trackLen) % 1;
    const y = flightArc(j, u) + lift;
    plantCoin(t, 0, y);
    if (i % 2) plantCoin(t, (i % 4 === 1 ? 3.2 : -3.2), y + 0.5);
  }
}
function seedSkyCoinsForJumps() {
  const nDirt = 48;
  for (let i = 0; i < nDirt; i++) {
    const t = 0.10 + (i + 0.4) / nDirt * 0.84;
    if (onBigAir(t) || onWhoops(t)) continue;
    plantCoin(t, ((i % 3) - 1) * 4.2, 0);
  }
  JUMPS.forEach((j) => plantFlightCoins(j));
}
function seedCoins() {
  while (coins.length) {
    const c = coins.pop();
    if (c.mesh) scene.remove(c.mesh);
  }
  if (MODE.key === "trial" || MODE.key === "hunt") return;
  if (MODE.key === "free") {
    seedSkyCoinsForJumps();
    return;
  }
  for (let i = 0; i < COIN_N; i++) {
    const t = 0.16 + (i + 0.5) / COIN_N * 0.76;
    if (onBigAir(t) || onWhoops(t)) continue;
    const lane = i % 6;
    const lat = lane === 0 || lane === 3 ? 0 : (lane === 1 || lane === 4 ? 1 : -1) * (lane < 3 ? 4.2 : 6.4);
    plantCoin(t, lat, 0);
  }
  JUMPS.forEach((j) => plantFlightCoins(j));
}
function dumpCoinsOnHit() {
  if (!(MODE.key === "tour" || MODE.key === "raid" || MODE.key === "free")) return;
  if (coinsGot <= 0) return;
  const n = Math.min(coinsGot, 2 + Math.floor(Math.random() * 6));
  coinsGot -= n;
  showToast("DUMP  -" + n, 0.7);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + timeMs * 0.001;
    const rad = 4.5 + (i % 4) * 1.35;
    const x = car.x + Math.cos(ang) * rad;
    const z = car.z + Math.sin(ang) * rad;
    const mesh = makeCoinMesh();
    const y = terrainH(x, z) + 2.4;
    mesh.position.set(x, y, z);
    scene.add(mesh);
    coins.push({ x, z, yAdd: 0, mesh, taken: false, dump: true, coolUntil: timeMs + 450 });
  }
}
function grabCoin(c, who) {
  if (c.taken) return;
  c.taken = true;
  c.takenLap = raceLap;
  if (c.mesh) c.mesh.visible = false;
  if (who === "cpu") {
    rivalCoins += 1;
    showToast("CPU  +" + rivalCoins, 0.35);
  } else {
    coinsGot += 1;
    if (MODE.key === "free") showToast("+" + coinsGot + "  SKY", 0.35);
    else if (MODE.key !== "tour" && coinsGot >= coins.length && coins.length) showToast("SWEEP  +" + SWEEP_BONUS, 1.1);
    else showToast("+" + coinsGot + "  COIN", 0.35);
  }
}
function respawnLapCoins() {
  coins.forEach((c) => {
    if (!c.taken) return;
    c.taken = false;
    if (c.mesh) c.mesh.visible = true;
  });
}
function stepCoins(dt) {
  for (let i = 0; i < coins.length; i++) {
    const c = coins[i];
    if (c.mesh && !c.taken) {
      c.mesh.rotation.y += dt * 2.2;
      c.mesh.position.y = terrainH(c.x, c.z) + 2.6 + (c.yAdd || 0) + Math.sin(timeMs * 0.007 + i) * 0.28;
    }
    if (c.taken || startLock || finished || MODE.key === "trial") continue;
    if (c.coolUntil && timeMs < c.coolUntil) continue;
    const xz = Math.hypot(car.x - c.x, car.z - c.z);
    if (xz <= 7.4) {
      const cy = terrainH(c.x, c.z) + 2.6 + (c.yAdd || 0);
      if (car.y + 2.4 >= cy - 3.2 && car.y - 1.2 <= cy + 18) grabCoin(c, "player");
    }
    if (c.taken || MODE.key !== "tour") continue;
    const r = rivals[0];
    if (!r || !r.mesh) continue;
    if (Math.hypot(r.mesh.position.x - c.x, r.mesh.position.z - c.z) < 4.2) grabCoin(c, "cpu");
  }
}
const HUNT_CATALOG = [
  { name: "COW", url: "./lib/hunt/cow.glb", h: 2.8, hex: 0xC4A070 },
  { name: "CHICKEN", url: "./lib/hunt/chicken.glb", h: 1.6, hex: 0xF2C14E },
  { name: "SHEEP", url: "./lib/hunt/sheep.glb", h: 1.9, hex: 0xF0EDE8 },
  { name: "RAPTOR", kind: "engine", h: 2.8 },
  { name: "ALIEN", url: "./lib/hunt/alien.glb", h: 2.4 },
  { name: "BANANA", url: "./lib/hunt/banana.glb", h: 1.8, hex: 0xFFE135 },
  { name: "DONUT", url: "./lib/hunt/donut-sprinkles.glb", h: 1.6, hex: 0xFF8AB0 },
  { name: "HOTDOG", url: "./lib/hunt/hot-dog.glb", h: 1.6, hex: 0xE07040 },
  { name: "GINGER", url: "./lib/hunt/gingerbread-man.glb", h: 2.1, hex: 0xC4783A },
  { name: "PUMPKIN", url: "./lib/hunt/pumpkin-carved.glb", h: 1.9, hex: 0xFF7A22 },
  { name: "SNOWMAN", url: "./lib/hunt/snowman.glb", h: 2.8, hex: 0xF4F7FA },
  { name: "CACTUS", url: "./lib/hunt/cactus.glb", h: 2.8, hex: 0x3DBF7A },
  { name: "APPLE", url: "./lib/hunt/apple.glb", h: 1.6, hex: 0xE23D28 },
  { name: "DUCK", url: "./lib/hunt/duck/duck.gltf", h: 1.8, hex: 0xFFD24A },
  { name: "PINEAPPLE", url: "./lib/hunt/pineapple.glb", h: 2.2, hex: 0xE8B84A }
];
function huntNeed() {
  if (DIFF.key === "easy") return 4;
  if (DIFF.key === "hard") return 10;
  if (DIFF.key === "extra") return 14;
  return 7;
}
function clearHunt() {
  while (huntItems.length) {
    const it = huntItems.pop();
    if (it.mesh && it.mesh.parent) it.mesh.parent.remove(it.mesh);
  }
  huntFound = 0;
}
const HUNT_SITES = [
  { t: 0.06, side: 1, dist: 40 },
  { t: 0.14, side: -1, dist: 42 },
  { t: 0.21, side: 1, dist: 39 },
  { t: 0.27, side: -1, dist: 43 },
  { t: 0.34, side: 1, dist: 41 },
  { t: 0.43, side: -1, dist: 40 },
  { t: 0.51, side: 1, dist: 44 },
  { t: 0.59, side: -1, dist: 41 },
  { t: 0.65, side: 1, dist: 39 },
  { t: 0.73, side: -1, dist: 42 },
  { t: 0.79, side: 1, dist: 40 },
  { t: 0.85, side: -1, dist: 43 },
  { t: 0.91, side: 1, dist: 41 },
  { t: 0.97, side: -1, dist: 39 }
];
function huntBlocked(x, z, r, skip) {
  if (nearShipFire(x, z)) return true;
  if (minDistToPath(x, z) < HALF_W + 18) return true;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (Math.hypot(x - c.x, z - c.z) < (c.r || 2) + r + 5) return true;
  }
  for (let i = 0; i < duneSpots.length; i++) {
    const d = duneSpots[i];
    if (Math.hypot(x - d.x, z - d.z) < d.r + r + 6) return true;
  }
  const sep = 32;
  for (let i = 0; i < huntItems.length; i++) {
    const it = huntItems[i];
    if (it === skip || it.x == null) continue;
    if (Math.hypot(x - it.x, z - it.z) < sep) return true;
  }
  return false;
}
function huntDistBoost() {
  if (DIFF.key === "medium") return 12;
  if (DIFF.key === "hard") return 22;
  if (DIFF.key === "extra") return 30;
  return 0;
}
function huntHideNames() {
  return DIFF.key === "hard" || DIFF.key === "extra";
}
function huntLabel(it) {
  if (!it) return "DONE";
  if (it.found) return it.name;
  return huntHideNames() ? "???" : it.name;
}
function huntSiteAt(i, skip) {
  const n = HUNT_SITES.length;
  const start = ((i % n) + n) % n;
  const boost = huntDistBoost();
  for (let s = 0; s < n; s++) {
    const site = HUNT_SITES[(start + s * 3) % n];
    const p = alongTrack(site.t, site.side, site.dist + boost);
    const rgt = p.right, tan = p.tan;
    for (let k = 0; k < 20; k++) {
      const along = ((k % 5) - 2) * 8;
      const out = 6 + k * 5;
      const x = p.x + rgt.x * site.side * out + tan.x * along;
      const z = p.z + rgt.z * site.side * out + tan.z * along;
      if (!huntBlocked(x, z, 5.5, skip)) return { x, z, yaw: p.yaw };
    }
  }
  const site = HUNT_SITES[start];
  const q = alongTrack(site.t, site.side, 80 + boost);
  return { x: q.x, z: q.z, yaw: q.yaw };
}
function dressHuntMesh(root, spec) {
  spec = spec || {};
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const hasColor = !!(o.geometry && o.geometry.attributes && o.geometry.attributes.color);
    const srcs = Array.isArray(o.material) ? o.material : [o.material];
    const out = srcs.map((m) => {
      const mat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        vertexColors: hasColor,
        fog: true,
        side: m.side != null ? m.side : THREE.FrontSide
      });
      if (m.map) {
        mat.map = m.map;
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.needsUpdate = true;
      } else if (!hasColor) {
        if (spec.hex) mat.color.setHex(spec.hex);
        else if (m.color) mat.color.copy(m.color);
      }
      return mat;
    });
    o.material = out.length === 1 ? out[0] : out;
    o.renderOrder = 3;
  });
}
function makeRaptorEngine() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xC5CCD2, metalness: 0.88, roughness: 0.26 });
  const soot = new THREE.MeshStandardMaterial({ color: 0x2A2C30, metalness: 0.42, roughness: 0.52 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xC4F2FF, transparent: true, opacity: 0.88, toneMapped: false, fog: false, side: THREE.DoubleSide });
  const pink = new THREE.MeshBasicMaterial({ color: 0xFF7AD9, transparent: true, opacity: 0.42, toneMapped: false, fog: false, side: THREE.DoubleSide });
  const purp = new THREE.MeshBasicMaterial({ color: 0x8A4DFF, transparent: true, opacity: 0.28, toneMapped: false, fog: false, side: THREE.DoubleSide });
  const layout = [[0, 0], [1.2, 0], [-1.2, 0], [0.6, 1.05], [-0.6, 1.05], [0.6, -1.05], [-0.6, -1.05]];
  layout.forEach(([x, z]) => {
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.58, 1.4, 14, 1, true), soot);
    bell.position.set(x, 1.15, z);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.05, 6, 16), steel);
    lip.rotation.x = Math.PI / 2;
    lip.position.set(x, 0.45, z);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.7, 8, 1, true), glow);
    core.position.set(x, -0.22, z);
    const sheath = new THREE.Mesh(new THREE.ConeGeometry(0.52, 2.3, 10, 1, true), pink);
    sheath.position.set(x, -0.58, z);
    const halo = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.8, 10, 1, true), purp);
    halo.position.set(x, -0.85, z);
    g.add(bell, lip, core, sheath, halo);
  });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.3, 16), steel);
  plate.position.y = 1.92;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.1, 8), steel);
  pipe.position.set(0, 2.55, 0);
  g.add(plate, pipe);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}
function sitHuntItem(root, x, z, worldH, yaw) {
  root.rotation.y = yaw || 0;
  root.position.set(x, 0, z);
  root.scale.setScalar(1);
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root);
  const h = Math.max(0.05, box.max.y - box.min.y);
  if (worldH) root.scale.setScalar(worldH / h);
  root.updateMatrixWorld(true);
  box.setFromObject(root);
  root.position.y = groundH(x, z) - box.min.y + 0.12;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;
    o.renderOrder = 3;
  });
  scene.add(root);
  return root;
}
function addHuntBeacon(it, h) {
  if (!it.mesh) return;
  if (DIFF.key !== "easy") return;
  const mat = new THREE.MeshBasicMaterial({ color: 0x3de8ff, toneMapped: false, fog: false });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, Math.max(1.8, h * 0.55), 6), mat);
  pole.position.y = Math.max(1.6, h * 0.7);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), mat);
  ball.position.y = pole.position.y + Math.max(1.0, h * 0.28);
  pole.name = "huntBeacon";
  ball.name = "huntBeacon";
  it.mesh.add(pole, ball);
  it.beacon = [pole, ball];
}
function seedHunt() {
  clearHunt();
  if (!isOpenWorld()) return;
  const n = MODE.key === "free" ? HUNT_CATALOG.length : Math.min(HUNT_CATALOG.length, huntNeed());
  for (let i = 0; i < n; i++) {
    const spec = HUNT_CATALOG[i];
    const slot = Math.floor(i * HUNT_SITES.length / Math.max(1, n));
    const p = huntSiteAt(slot);
    const it = { name: spec.name, x: p.x, z: p.z, mesh: null, found: false, goal: true };
    huntItems.push(it);
    if (spec.kind === "engine") {
      const g = makeRaptorEngine();
      sitHuntItem(g, p.x, p.z, spec.h, p.yaw);
      it.mesh = g;
      addHuntBeacon(it, spec.h);
      continue;
    }
    loadGlb(spec.url, (root) => {
      if (nearShipFire(p.x, p.z) || huntBlocked(p.x, p.z, 5, it)) {
        const q = huntSiteAt(slot + 5, it);
        p.x = q.x; p.z = q.z; p.yaw = q.yaw;
        it.x = q.x; it.z = q.z;
      }
      dressHuntMesh(root, spec);
      sitHuntItem(root, p.x, p.z, spec.h, p.yaw);
      it.mesh = root;
      it.x = root.position.x;
      it.z = root.position.z;
      addHuntBeacon(it, spec.h);
    });
  }
  renderHuntList();
}
function huntNextName() {
  const it = huntNearest();
  return it ? it.name : "DONE";
}
function huntNearest() {
  let best = null, bestD = 1e9;
  for (let i = 0; i < huntItems.length; i++) {
    const it = huntItems[i];
    if (!it.goal || it.found) continue;
    const d = Math.hypot(it.x - car.x, it.z - car.z);
    if (d < bestD) { bestD = d; best = it; }
  }
  return best;
}
function renderHuntList() {
  const el = document.getElementById("hunt-list");
  if (!el) return;
  if (MODE.key !== "hunt") { el.innerHTML = ""; return; }
  el.innerHTML = huntItems.map((it) => {
    return "<li class=\"" + (it.found ? "got" : "") + "\">" + huntLabel(it) + "</li>";
  }).join("");
}
let snapCool = 0;
function huntShotTarget() {
  if (MODE.key !== "hunt" || startLock || finished || waitingDiff) return null;
  let best = null, bestD = 1e9;
  for (let i = 0; i < huntItems.length; i++) {
    const it = huntItems[i];
    if (it.found || !it.mesh || !it.goal) continue;
    const dx = it.x - camera.position.x, dz = it.z - camera.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2.2 || dist > 78) continue;
    const y = (it.mesh.position.y || terrainH(it.x, it.z)) + 1.2;
    _p.set(it.x, y, it.z).project(camera);
    if (_p.z > 1 || Math.abs(_p.x) > 0.72 || Math.abs(_p.y) > 0.78) continue;
    camera.getWorldDirection(_look);
    if ((dx / (dist || 1)) * _look.x + (dz / (dist || 1)) * _look.z < 0.18) continue;
    if (dist < bestD) { bestD = dist; best = it; }
  }
  return best;
}
function markHuntShot(it) {
  if (!it || it.found) return;
  it.found = true;
  huntFound += 1;
  if (it.mesh && !it.shotRing) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.9, 0.08, 6, 18),
      new THREE.MeshBasicMaterial({ color: 0x3de8ff, toneMapped: false, fog: false })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    it.mesh.add(ring);
    it.shotRing = ring;
  } else if (it.shotRing) it.shotRing.visible = true;
  if (it.beacon) it.beacon.forEach((b) => { b.visible = false; });
  showToast("SNAP  " + it.name, 0.7);
  renderHuntList();
  if (MODE.key === "hunt") {
    const need = huntNeed();
    const got = huntItems.filter((h) => h.goal && h.found).length;
    if (got >= need && !finished) {
      finished = true;
      playerWon = true;
      showFinish("EXPLORER DONE");
    }
  }
}
function trySnap() {
  if (MODE.key !== "hunt" || startLock || finished || waitingDiff) return;
  if (snapCool > 0) return;
  snapCool = 0.5;
  const flash = document.getElementById("snap-flash");
  if (flash) {
    flash.classList.add("show");
    setTimeout(() => { if (flash) flash.classList.remove("show"); }, 90);
  }
  const it = huntShotTarget();
  if (!it) { showToast("NO SHOT", 0.4); return; }
  markHuntShot(it);
}
function stepHunt(dt) {
  if (snapCool > 0) snapCool -= dt;
  if (!isOpenWorld()) return;
  huntItems.forEach((it) => {
    if (!it.mesh || it.found) return;
    if (MODE.key === "free") it.mesh.rotation.y += dt * 0.25;
  });
}
function raceScore() {
  const timePts = Math.max(0, Math.floor((200000 - timeMs) / 20));
  if (MODE.key === "trial") return Math.max(0, 500000 - timeMs);
  if (MODE.key === "hunt") return huntFound * 8000 + Math.max(0, Math.floor((300000 - timeMs) / 20));
  if (MODE.key === "free") return coinsGot * 1000;
  if (MODE.key === "tour") {
    const sweepPts = coins.length && coinsGot >= coins.length ? SWEEP_BONUS : 0;
    return coinsGot * 2500 + timePts + sweepPts + (DIFF.scoreMul || 0) * 1000;
  }
  const winPts = playerWon ? 25000 : 0;
  const linePts = (DIFF.scoreMul || 0) * 1000;
  const sweepPts = coins.length && coinsGot >= coins.length ? SWEEP_BONUS : 0;
  return coinsGot * 1000 + timePts + winPts + linePts + sweepPts;
}
function cupTier() {
  if (MODE.key === "trial") return playerWon ? "GOLD" : "NONE";
  if (!playerWon) return "NONE";
  const s = raceScore();
  const k = DIFF.key;
  if (s >= (CUP_GOLD[k] || CUP_GOLD.medium)) return "GOLD";
  if (s >= (CUP_SILVER[k] || CUP_SILVER.medium)) return "SILVER";
  return "BRONZE";
}
const HS_KEY = "rdb-hs-v3";
const BOARD_OLD = "rdb-board-v1";
const BOARD_KEY = "rdb-board-v2";
function emptyLane() { return { raid: [], trial: [], tour: [], hunt: [], free: [] }; }
function emptyBoard() { return { mars: emptyLane(), moon: emptyLane(), earth: emptyLane() }; }
function laneOf(raw) {
  const d = emptyLane();
  ["raid", "trial", "tour", "hunt", "free"].forEach((k) => {
    if (raw && Array.isArray(raw[k])) d[k] = raw[k];
  });
  return d;
}
function loadBoard() {
  try {
    const raw = JSON.parse(localStorage.getItem(BOARD_KEY) || "null");
    if (raw && typeof raw === "object" && (raw.mars || raw.moon || raw.earth)) {
      return { mars: laneOf(raw.mars), moon: laneOf(raw.moon), earth: laneOf(raw.earth) };
    }
  } catch (err) {}
  const b = emptyBoard();
  try {
    const v1 = JSON.parse(localStorage.getItem(BOARD_OLD) || "null");
    if (v1 && typeof v1 === "object") b.mars = laneOf(v1);
  } catch (err2) {}
  try {
    const old = JSON.parse(localStorage.getItem(HS_KEY) || "[]");
    if (Array.isArray(old) && old.length && !b.mars.raid.length) b.mars.raid = old;
  } catch (err3) {}
  return b;
}
function saveBoard(b) {
  try { localStorage.setItem(BOARD_KEY, JSON.stringify(b)); } catch (err) {}
}
function importSharedRun() {
  const g = urlParams.get("g");
  const t = parseInt(urlParams.get("t"), 10);
  const s = parseInt(urlParams.get("s"), 10);
  const c = parseInt(urlParams.get("c"), 10);
  const n = sanitizeName(urlParams.get("n") || "");
  if (!g && !Number.isFinite(t) && !Number.isFinite(s)) return;
  addBoardRow(MODE.key, {
    name: n || "ACE",
    time: Number.isFinite(t) ? t : 0,
    score: Number.isFinite(s) ? s : 0,
    coins: Number.isFinite(c) ? c : 0,
    diff: DIFF.tag,
    ghost: g || "",
    mode: MODE.key
  });
}
function sortBoard(mode, list) {
  const rows = (list || []).slice();
  if (mode === "trial") rows.sort((a, b) => (a.time || 9e9) - (b.time || 9e9));
  else rows.sort((a, b) => (b.score || 0) - (a.score || 0));
  return rows.slice(0, 3);
}
function listBoard(mode) {
  const b = loadBoard();
  const lane = b[PLANET.key] || emptyLane();
  return sortBoard(mode, lane[mode] || []);
}
function rowBetter(mode, a, b) {
  if (mode === "trial") return (a.time || 9e9) < (b.time || 9e9);
  return (a.score || 0) > (b.score || 0);
}
function addBoardRow(mode, row) {
  const b = loadBoard();
  const pk = PLANET.key;
  if (!b[pk]) b[pk] = emptyLane();
  const list = (b[pk][mode] || []).slice();
  const i = list.findIndex((r) => (r.name || "") === (row.name || ""));
  if (i >= 0) {
    if (!rowBetter(mode, row, list[i])) {
      b[pk][mode] = sortBoard(mode, list);
      saveBoard(b);
      return b[pk][mode];
    }
    list[i] = row;
  } else list.push(row);
  b[pk][mode] = sortBoard(mode, list);
  saveBoard(b);
  return b[pk][mode];
}
function rowHtml(mode, r) {
  const tag = (r.name || "ACE").padEnd(4, " ");
  if (mode === "trial") {
    return "<li><b>" + tag + "</b>  " + fmtTime(r.time || 0) + "  <span>" + (r.diff || "") + "</span></li>";
  }
  return "<li><b>" + tag + "</b>  " + (r.score || 0) + "  <span>" + (r.diff || "") + " · " + (r.coins || 0) + "c · " + fmtTime(r.time || 0) + "</span></li>";
}
function renderHsBoard() {
  const list = listBoard(MODE.key);
  const html = list.length ? list.map((r) => rowHtml(MODE.key, r)).join("") : "<li>NO SCORES YET</li>";
  const el = document.getElementById("hs-board");
  if (el) el.innerHTML = html;
  const planetTag = document.getElementById("scores-planet");
  if (planetTag) planetTag.textContent = PLANET.tag + "  ·  TOP 3";
  ["trial", "tour", "hunt", "free"].forEach((m) => {
    const ol = document.getElementById("hs-" + m);
    if (!ol) return;
    const rows = listBoard(m);
    ol.innerHTML = rows.length ? rows.map((r) => rowHtml(m, r)).join("") : "<li>NO SCORES YET</li>";
  });
}
function fillFinishCard(label) {
  if (elFinishLabel) elFinishLabel.textContent = label;
  if (elFinishTime) elFinishTime.textContent = fmtTime(timeMs);
  const elScore = document.getElementById("finish-score");
  if (elScore) {
    elScore.textContent = MODE.key === "trial"
      ? fmtTime(timeMs)
      : MODE.key === "hunt"
      ? (raceScore() + " PTS   ·   " + huntFound + " SHOTS")
      : MODE.key === "free"
      ? (coinsGot + " COINS   ·   " + raceScore() + " PTS")
      : (raceScore() + " PTS   ·   " + coinsGot + " COINS");
  }
  const elRank = document.getElementById("finish-rank");
  if (elRank) {
    const cup = cupTier();
    const sweep = coins.length && coinsGot >= coins.length ? "  ·  SWEEP" : "";
    if (MODE.key === "hunt") elRank.textContent = cup + " CUP  ·  " + huntFound + " SHOTS";
    else if (MODE.key === "free") elRank.textContent = coinsGot + " SKY COINS";
    else elRank.textContent = playerWon
      ? ("1st  ·  " + cup + " CUP" + sweep)
      : ("2nd  ·  NO CUP" + sweep);
  }
  const inp = document.getElementById("hs-name");
  if (inp) inp.value = playerName;
  hsSubmitted = false;
  hsSavedName = "";
  renderHsBoard();
  grantPaintUnlocks();
}
function revealFinishCard() {
  if (ceremony.hudShown) return;
  ceremony.hudShown = true;
  if (elFinish) elFinish.classList.add("show");
  document.body.classList.remove("ceremony-hide-hud");
}
function showFinish(label) {
  fillFinishCard(label);
  beginCeremony(label);
  submitHs(true);
}
function submitHs(silent) {
  if (!finished) return;
  const inp = document.getElementById("hs-name");
  const name = commitName((inp && inp.value) || playerName);
  if (hsSavedName === name) {
    if (!silent) showToast("ALREADY SAVED", 0.45);
    return;
  }
  const row = {
    name, score: raceScore(), coins: MODE.key === "trial" ? 0 : (MODE.key === "hunt" ? huntFound : coinsGot),
    time: timeMs, diff: DIFF.tag, place: playerWon ? "1st" : "2nd",
    cup: cupTier(), mode: MODE.key, planet: PLANET.key, ghost: encGhost(ghostRec) || ""
  };
  const board = addBoardRow(MODE.key, row);
  hsSubmitted = true;
  hsSavedName = name;
  renderHsBoard();
  const made = board.some((r) => r.name === name && (MODE.key === "trial" ? r.time === row.time : r.score === row.score));
  if (!silent) showToast(made ? ("SAVED  " + name) : "NOT TOP 3", 0.7);
  else if (made) showToast("BOARD  " + name, 0.55);
}
function pickDifficulty(name) {
  const bootName = document.getElementById("boot-name");
  commitName(bootName ? bootName.value : playerName);
  DIFF = parseDiff(name);
  waitingDiff = false;
  setDiffChip();
  if (MODE.key === "hunt" || MODE.key === "free") {
    while (hazards.length) {
      const h = hazards.pop();
      if (h.mesh) scene.remove(h.mesh);
    }
  } else seedHazards();
  seedCoins();
  seedHunt();
  plantPlayRamps();
  hideMenuSheets();
  setMenuOn(false);
  menuPage = "play";
  document.body.classList.toggle("mode-trial", MODE.key === "trial");
  document.body.classList.toggle("mode-open", isOpenWorld());
  document.body.classList.toggle("mode-hunt", MODE.key === "hunt");
  document.body.classList.toggle("mode-free", MODE.key === "free");
  if (elHint) {
    elHint.textContent = MODE.key === "hunt"
      ? "F  SNAP   ·   FRAME THE LIST"
      : isPlayground()
      ? "FREESTYLE  ·  90s SKY COINS"
      : "CYBERBAJA: PLANETARY TOUR";
    elHint.classList.remove("gone");
  }
  spawnStart();
  if (ghostIn) showToast("GHOST  " + DIFF.tag, 1.1);
  else showToast(playerName + "  " + LIVERIES[liveryIdx].name, 0.8);
}
function pickFree(kind) {
  freeKind = "track";
  pickDifficulty("medium");
}
function encGhost(rec) {
  const n = Math.min(150, rec.length);
  if (n < 8) return "";
  const buf = new Uint8Array(2 + n * 5);
  buf[0] = n & 255;
  buf[1] = (n >> 8) & 255;
  for (let i = 0; i < n; i++) {
    const s = rec[Math.floor(i * (rec.length - 1) / Math.max(1, n - 1))];
    const ms = Math.min(65535, Math.round(s.ms / 20));
    const prog = Math.min(65535, Math.round((s.lap + s.t) * 20000));
    const lat = Math.max(0, Math.min(255, Math.round((s.lat + 16) * 8)));
    const o = 2 + i * 5;
    buf[o] = ms & 255; buf[o + 1] = (ms >> 8) & 255;
    buf[o + 2] = prog & 255; buf[o + 3] = (prog >> 8) & 255;
    buf[o + 4] = lat;
  }
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decGhost(str) {
  try {
    const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - str.length % 4);
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const n = buf[0] | (buf[1] << 8);
    if (n < 8 || 2 + n * 5 > buf.length) return null;
    const out = [];
    for (let i = 0; i < n; i++) {
      const o = 2 + i * 5;
      const ms = (buf[o] | (buf[o + 1] << 8)) * 20;
      const prog = (buf[o + 2] | (buf[o + 3] << 8)) / 20000;
      const lat = buf[o + 4] / 8 - 16;
      out.push({ ms, t: prog % 1, lap: Math.floor(prog), lat });
    }
    return out;
  } catch (err) { return null; }
}
function ghostPose(samples, ms) {
  if (!samples || !samples.length) return null;
  if (ms <= samples[0].ms) return samples[0];
  if (ms >= samples[samples.length - 1].ms) return samples[samples.length - 1];
  let lo = 0, hi = samples.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].ms < ms) lo = mid; else hi = mid;
  }
  const a = samples[lo], b = samples[hi];
  const u = (ms - a.ms) / Math.max(1, b.ms - a.ms);
  return {
    ms, t: a.t + (b.t - a.t) * u, lap: u < 0.5 ? a.lap : b.lap,
    lat: a.lat + (b.lat - a.lat) * u
  };
}
async function shareChallenge() {
  const g = encGhost(ghostRec);
  const url = location.href.split("?")[0] + "?m=" + MODE.key + "&d=" + DIFF.key
    + "&n=" + encodeURIComponent(playerName) + "&t=" + timeMs + "&s=" + raceScore()
    + "&c=" + coinsGot + (g ? "&g=" + g : "");
  const text = playerName + "  CyberBaja  " + MODE.tag + "  " + DIFF.tag + "  "
    + (MODE.key === "trial" ? fmtTime(timeMs) : (raceScore() + " pts")) + " — beat this";
  try {
    if (navigator.share) {
      await navigator.share({ title: GAME_TITLE, text, url });
      showToast("SENT", 0.7);
      return;
    }
  } catch (err) {}
  try {
    await navigator.clipboard.writeText(text + "\n" + url);
    showToast("COPIED — PASTE IN MESSAGES", 1.4);
  } catch (err2) {
    showToast("COPY FAILED", 0.8);
  }
}
if (elShare) elShare.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); shareChallenge(); });
document.querySelectorAll(".boot-btn[data-diff]").forEach((btn) => {
  btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); pickDifficulty(btn.getAttribute("data-diff")); });
});
const elHsSave = document.getElementById("hs-save");
if (elHsSave) elHsSave.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); submitHs(); });
const elHsAgain = document.getElementById("hs-again");
if (elHsAgain) elHsAgain.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); onRetry(); });
const elHsHome = document.getElementById("hs-home");
if (elHsHome) elHsHome.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); goHome(); });
document.querySelectorAll("[data-home]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    const k = btn.getAttribute("data-home");
    if (k === "raid") { MODE = MODES.raid; showBoot(); }
    else if (k === "trial") { MODE = MODES.trial; showBoot(); }
    else if (k === "tour") { MODE = MODES.tour; showBoot(); }
    else if (k === "hunt") { MODE = MODES.hunt; showBoot(); }
    else if (k === "free") { MODE = MODES.free; freeKind = "track"; showBoot(); }
    else if (k === "race") { MODE = MODES.raid; showBoot(); }
    else if (k === "how") showHow();
    else if (k === "scores") showScores();
    else showHome();
  });
});
document.querySelectorAll("[data-free]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    pickFree(btn.getAttribute("data-free"));
  });
});
function wireNameInput(el) {
  if (!el) return;
  el.addEventListener("input", () => { el.value = sanitizeName(el.value); });
  el.addEventListener("change", () => { commitName(el.value); });
}
wireNameInput(document.getElementById("hs-name"));
wireNameInput(document.getElementById("boot-name"));
(function seedBootPaint() {
  const row = document.getElementById("paint-row");
  if (row) {
    row.innerHTML = "";
    LIVERIES.forEach((L, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "paint-swatch";
      b.title = L.name;
      b.setAttribute("aria-label", L.name);
      b.style.background = hexCss(L.color);
      b.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!paintUnlocked(i)) { showToast("LOCKED  " + L.need + " PTS", 0.8); return; }
        applyLivery(i, true);
      });
      row.appendChild(b);
    });
  }
  applyLivery(liveryIdx, false);
  commitName(playerName);
})();

function spawnStart() {
  lastClearT = START_T;
  lastClearYaw = headingAt(START_T);
  if (isOpenWorld()) {
    const at = alongTrack(0.12, -1, 40);
    car.x = at.x; car.z = at.z;
    car.y = terrainH(at.x, at.z) + GROUND_SIT;
    car.yaw = Math.atan2(PAD_ROCKET_X - car.x, PAD_ROCKET_Z - car.z);
    car.pitch = 0; car.roll = 0; car.speed = 0; car.lat = 0; car.vy = 0; car.air = false;
  } else {
    placeCar(START_T, lastClearYaw);
    {
      const pr = projectTrack(_p.set(car.x, 0, car.z));
      car.x -= pr.right.x * 3.2;
      car.z -= pr.right.z * 3.2;
    }
  }
  nextGate = 0; gatesHit = 0; lapDriven = 0;
  lastT = START_T; prevDriveT = START_T; timeMs = 0; finished = false;
  car.boost = 1; car.overheating = false; car.spinT = 0;
  car.vy = 0; car.air = false; car.turboT = 0; car.starT = 0;
  truck.userData.wheels.forEach((w) => {
    w.fold = 0;
    w.hub.rotation.z = 0;
    if (w.blob) w.blob.visible = true;
  });
  startLock = !isOpenWorld() && !isPlayground();
  countT = startLock ? 3.5 : 0; falseStart = false; holdLaunch = false;
  playerWon = true; raceLap = 0;
  pickups.forEach((p) => {
    const race = MODE.key === "trial" || MODE.key === "tour" || MODE.key === "raid";
    const show = (p.kind === "BOLT" && race) || (p.kind === "STAR" && (race || MODE.key === "free"));
    if (show) { p.taken = 0; if (p.mesh) p.mesh.visible = true; }
    else { p.taken = 1e9; if (p.mesh) p.mesh.visible = false; }
  });
  coinsGot = 0;
  rivalCoins = 0;
  huntFound = 0;
  huntItems.forEach((it) => {
    it.found = false;
    if (it.mesh) it.mesh.visible = true;
    if (it.shotRing) it.shotRing.visible = false;
    if (it.beacon) it.beacon.forEach((b) => { b.visible = true; });
  });
  renderHuntList();
  coins.forEach((c) => { c.taken = false; if (c.mesh) c.mesh.visible = true; });
  hsSubmitted = false;
  hsSavedName = "";
  ghostRec = []; lastGhostMs = 0;
  hazards.forEach((h) => { h.coolUntil = 0; });
  hurtSafeT = 0;
  if (truck) truck.visible = true;
  clearRivals();
  rivals.forEach((r) => {
    r.spinT = 0; r.t = START_T; r.lat = 3.2; r.speed = DIFF.rival[0]; r.laps = 0; r.prevT = START_T;
    if (r.mesh) r.mesh.rotation.set(0, headingAt(START_T), 0, "YXZ");
  });
  steerVis = 0; offHold = 0;
  endCeremony();
  if (elFinish) elFinish.classList.remove("show");
  if (elFailToast) elFailToast.classList.remove("show");
  toastT = 0;
  prevGateSide = (car.x - gates[0].pos.x) * gates[0].forward.x + (car.z - gates[0].pos.z) * gates[0].forward.z;
  syncTruck(); sitWheels();
  camera.position.set(car.x + 3, car.y + 6.55, car.z - 16.4);
  camera.lookAt(car.x, car.y + 1.7, car.z + 6);
  camReady = false;
}

function isTouchPlay() {
  return document.body.classList.contains("touch-on") || document.documentElement.classList.contains("touch-on");
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
  if (!startLock && isTouchPlay() && touchCtl.th >= 0 && !keys.KeyS && !keys.ArrowDown) th = Math.max(th, 1);
  return { th: Math.max(-1, Math.min(1, th)), st: Math.max(-1, Math.min(1, st)), hb, bo };
}

function drive(dt) {
  stepHurtSafe(dt);
  const ctl = readControls();
  let th = ctl.th, st = -ctl.st, hb = ctl.hb, bo = ctl.bo;
  if (waitingDiff) {
    const fxW = Math.sin(car.yaw), fzW = Math.cos(car.yaw);
    syncTruck(); sitWheels();
    return { boosting: false, fx: fxW, fz: fzW };
  }
  if (startLock) {
    if (isTouchPlay()) {
      if (touchCtl.th >= 0) holdLaunch = true;
    } else {
      if (countT > 1.08 && th > 0.25) falseStart = true;
      if (countT <= 1.08 && countT > 0.12 && th > 0.25) holdLaunch = true;
    }
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
  let vmax = car.turboT > 0 ? TURBO_SPEED : (boosting ? BOOST_SPEED : MAX_SPEED);
  if (isPlayground()) vmax *= 1.22;
  if (car.air) vmax = car.turboT > 0 ? MAX_SPEED + 34 : MAX_SPEED * 1.04;
  const accel = car.air ? (isPlayground() ? 16 : 12) : 48;
  const punch = car.air
    ? (car.turboT > 0 ? 1.2 : 1)
    : (car.turboT > 0 ? 3.2 : (boosting ? 2.35 : 1));
  if (th > 0) car.speed += th * accel * punch * (1 - Math.max(0, car.speed) / (vmax + 14)) * dt;
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
  if (!finished && !isOpenWorld() && !isPlayground() && timeMs - lastGhostMs > 80) {
    lastGhostMs = timeMs;
    ghostRec.push({ ms: timeMs, t: lastT, lap: raceLap, lat: proj.offset });
  }

  const off = Math.max(0, Math.abs(proj.offset) - HALF_W);
  if (isOpenWorld()) {
    if (off > 0 && !car.air) car.speed -= car.speed * 0.08 * dt;
  } else {
    if (off > 0 && !car.air) {
      car.speed -= car.speed * (0.55 + off * 0.03) * dt;
      if (spdAbs > 4) emitDust(car.x, car.y + 0.3, car.z, fx, fz, 18 * dt);
    }
    if (Math.abs(proj.offset) > 70) {
      const sign = Math.sign(proj.offset);
      car.x -= proj.right.x * sign * 10 * dt;
      car.z -= proj.right.z * sign * 10 * dt;
    }
  }
  if (!car.air) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      const d = Math.hypot(car.x - c.x, car.z - c.z);
      if (d < c.r + 1.4) {
        const nx = (car.x - c.x) / (d || 1), nz = (car.z - c.z) / (d || 1);
        car.x += nx * 0.35; car.z += nz * 0.35;
        if (!hurtSafe()) bumpObject(spdAbs, "HIT");
      }
    }
  }

  const groundY = terrainH(car.x, car.z) + GROUND_SIT;
  hitHazards(spdAbs, groundY);
  const yA = terrainH(car.x + fx * 3.2, car.z + fz * 3.2);
  const yB = terrainH(car.x - fx * 3.2, car.z - fz * 3.2);
  const hit = jumpAtT(proj.t);
  const onTake = hit && (hit.j.kind === "valley" || hit.j.kind === "table") && hit.u >= 0.18 && hit.u <= 0.30;
  if (!car.air) {
    car.y = groundY;
    car.vy = 0;
    const wantPitch = THREE.MathUtils.clamp(Math.atan2(yA - yB, 6.4), -0.45, 0.45);
    car.pitch += (wantPitch - car.pitch) * Math.min(1, dt * 9);
    if (car.spinT <= 0 && spdAbs > 18 && onTake && !isOpenWorld()) {
      const ang = Math.atan2(hit.j.h, Math.max(12, hit.j.len * 0.22));
      car.air = true;
      const moon = PLANET.key === "moon";
      car.vy = Math.sin(ang) * spdAbs * 1.05 + (car.turboT > 0 ? (moon ? 1.4 : 2.6) : 0.55);
      car.speed += car.turboT > 0 ? 6 : 2;
      if (isPlayground()) { car.vy += moon ? 1.1 : 3.0; car.speed += 6; }
    }
  } else {
    car.vy -= (isPlayground() ? 24 : GRAVITY) * (PLANET.gravMul || 1) * dt;
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
      if (mismatch > 0.6 && spdAbs > 12 && !hurtSafe()) spinOut(0.8);
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

  if (!finished && !isOpenWorld() && !isPlayground()) {
    const g = gates[nextGate];
    const side = (car.x - g.pos.x) * g.forward.x + (car.z - g.pos.z) * g.forward.z;
    const lat = (car.x - g.pos.x) * g.right.x + (car.z - g.pos.z) * g.right.z;
    if (prevGateSide < 0.15 && side >= 0 && Math.abs(lat) < g.halfW + 1.4 && spdAbs > MIN_GATE_SPEED) {
      lastClearT = (g.t + 0.01) % 1;
      lastClearYaw = Math.atan2(g.forward.x, g.forward.z);
      gatesHit++;
      flashT = 0.12;
      showToast("GATE " + (g.index + 1), 0.55);
      if (nextGate === GATE_COUNT - 1) {
        if (gatesHit >= GATE_COUNT && lapDriven >= MIN_LAP_FRAC) {
          raceLap++;
          if (raceLap >= LAP_COUNT && MODE.key !== "hunt" && MODE.key !== "free") {
            finished = true;
            let label = "YOU WIN";
            if (MODE.key === "trial") {
              const best = listBoard("trial")[0];
              playerWon = !best || timeMs <= (best.time || 9e9);
              label = playerWon ? "NEW BEST" : "TIME";
            } else if (MODE.key === "tour") {
              playerWon = coinsGot >= rivalCoins;
              label = playerWon ? "TOUR WIN" : "CPU WINS";
            } else if (MODE.key === "hunt") {
              playerWon = true;
              label = "EXPLORER DONE";
            } else playerWon = true;
            showFinish(label);
          } else {
            nextGate = 0; gatesHit = 0; lapDriven = 0;
            showToast("LAP " + (raceLap + 1), 0.8);
          }
        } else { nextGate = 0; gatesHit = 0; lapDriven = 0; }
      } else nextGate++;
    }
    prevGateSide = side;
  }

  const wr = truck.userData.wheelRadius || 0.74;
  truck.userData.wheels.forEach((w) => {
    w.spin.rotation.x += car.speed * dt / wr;
    w.hub.rotation.y = (!car.air && w.front) ? steerVis * 0.45 : 0;
    const wantFold = car.air ? (w.x < 0 ? 1 : -1) * Math.PI / 2 : 0;
    const foldK = wantFold === 0 ? 18 : 7;
    w.fold += (wantFold - w.fold) * Math.min(1, dt * foldK);
    if (wantFold === 0 && Math.abs(w.fold) < 0.04) w.fold = 0;
    w.hub.rotation.z = w.fold;
    if (w.blob) w.blob.visible = !car.air;
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
  bodyMat.fog = false;
  bodyMat.emissive = new THREE.Color(hex);
  bodyMat.emissiveIntensity = 0.16;
  const glass = glassMat.clone();
  glass.fog = false;
  kit.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === "windshield") o.material = glass;
    else if (o.name === "tail-bar") o.material = tailMat.clone();
    else o.material = bodyMat;
    o.castShadow = true;
    o.frustumCulled = false;
    o.renderOrder = 3;
  });
}
function playerKitReady() {
  const src = truck.getObjectByName("stlBody");
  return src && src.children.length >= 5;
}
function makeRival(kind, hex, monster) {
  const g = new THREE.Group();
  g.name = "rival";
  const mat = steelBody.clone();
  mat.color.setHex(hex);
  mat.fog = false;
  mat.emissive = new THREE.Color(hex);
  mat.emissiveIntensity = 0.14;
  const hull = new THREE.Mesh(wedgeHullGeo(), mat);
  hull.name = "rivalHull";
  hull.castShadow = true;
  hull.frustumCulled = false;
  hull.renderOrder = 2;
  g.add(hull);
  const src = truck.getObjectByName("stlBody");
  let kit = null;
  if (kind === "truck" && src && src.children.length >= 5) {
    kit = new THREE.Group();
    kit.name = "rivalKit";
    kit.position.copy(src.position);
    kit.rotation.copy(src.rotation);
    kit.scale.copy(src.scale);
    src.children.forEach((child) => {
      if (!child.isMesh || !child.geometry) return;
      const m = new THREE.Mesh(child.geometry, child.material);
      m.name = child.name;
      m.position.copy(child.position);
      m.quaternion.copy(child.quaternion);
      m.scale.copy(child.scale);
      kit.add(m);
    });
    paintRivalKit(kit, hex);
    if (monster) kit.scale.multiplyScalar(1.16);
    g.add(kit);
  } else {
    kind = "wedge";
  }
  hull.visible = !kit;
  addRivalWheels(g, monster);
  g.scale.setScalar(LOOK_TRUCK);
  g.traverse((o) => { o.frustumCulled = false; });
  scene.add(g);
  g.userData.monster = monster;
  g.userData.hex = hex;
  g.userData.kind = kind;
  g.userData.hull = hull;
  return g;
}
function clearRivals() {
  while (rivals.length) {
    const r = rivals.pop();
    if (r.mesh) scene.remove(r.mesh);
  }
}
function pushGhosts(mode, colors, maxN) {
  const pack = [];
  if (ghostIn) {
    const rec = decGhost(ghostIn);
    if (rec) pack.push({ rec, hex: colors[0] });
  }
  listBoard(mode).forEach((row) => {
    if (pack.length >= maxN) return;
    if (!row.ghost || (row.diff && row.diff !== DIFF.tag)) return;
    const rec = decGhost(row.ghost);
    if (rec) pack.push({ rec, hex: colors[pack.length % colors.length] });
  });
  pack.forEach((p, i) => {
    rivals.push({
      mesh: makeRival("truck", p.hex, false),
      t: START_T, lat: i === 1 ? -3.2 : (i === 2 ? 0 : 3.2),
      speed: DIFF.rival[0], spinT: 0, laps: 0, prevT: START_T,
      hex: p.hex, monster: false, kind: "truck", upgraded: true,
      ghost: true, samples: p.rec, phantom: true
    });
  });
}
function spawnRivals() {
  if (rivals.length) return;
  if (!playerKitReady()) return;
  if (MODE.key === "hunt" || MODE.key === "free") return;
  if (MODE.key === "trial") {
    rivals.push({
      mesh: makeRival("truck", 0x161618, false),
      t: START_T, lat: 3.2, speed: DIFF.rival[0], spinT: 0, laps: 0, prevT: START_T,
      hex: 0x161618, monster: false, kind: "truck", upgraded: true,
      ghost: false, samples: null, phantom: false
    });
    pushGhosts("trial", [0x3de8ff, 0xffee55, 0xc48cff], 3);
    return;
  }
  if (MODE.key === "tour") {
    rivals.push({
      mesh: makeRival("truck", 0x161618, false),
      t: START_T, lat: 3.2, speed: DIFF.rival[0], spinT: 0, laps: 0, prevT: START_T,
      hex: 0x161618, monster: false, kind: "truck", upgraded: true,
      ghost: false, samples: null, phantom: false
    });
    pushGhosts("tour", [0x3de8ff], 1);
    if (rivals.length < 2) pushGhosts("trial", [0x3de8ff], 1);
    return;
  }
  const rec = ghostIn ? decGhost(ghostIn) : null;
  rivals.push({
    mesh: makeRival("truck", rec ? 0x3de8ff : 0x161618, false),
    t: START_T, lat: 3.2, speed: DIFF.rival[0], spinT: 0, laps: 0, prevT: START_T,
    hex: rec ? 0x3de8ff : 0x161618, monster: false, kind: "truck", upgraded: true,
    ghost: !!rec, samples: rec, phantom: false
  });
}
let boostChain = 0, boostChainT = 0;
function grant(kind) {
  car.overheating = false;
  boostChainT = 2.6;
  boostChain += 1;
  if (kind === "TANK") {
    car.boost = 1;
    showToast(boostChain > 1 ? "REFILL  x" + boostChain : "REFILL", 0.45);
  } else if (kind === "RING") {
    car.boost = Math.min(1, car.boost + 0.28);
    car.turboT = Math.max(car.turboT, 0.58);
    if (car.air) car.vy += 2.4;
    showToast(boostChain > 1 ? "AIR  x" + boostChain : "AIR", 0.4);
  } else if (kind === "BOLT") {
    car.turboT = Math.max(car.turboT, 3.6);
    car.boost = Math.min(1, car.boost + 0.35);
    showToast(boostChain > 1 ? "BOLT  x" + boostChain : "BOLT", 0.55);
  } else if (kind === "STAR") {
    car.starT = 20;
    showToast("STAR  20", 1.1);
  } else {
    car.turboT = Math.max(car.turboT, 0.68);
    car.boost = Math.min(1, car.boost + 0.18);
    showToast(boostChain > 1 ? "BOOST  x" + boostChain : "BOOST", 0.4);
  }
}
function addPickup(kind, t, lat, yOff, cool, pack) {
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t);
  const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const x = p.x + right.x * lat, z = p.z + right.z * lat;
  const y = terrainH(x, z) + yOff;
  const mesh = new THREE.Group();
  mesh.rotation.y = Math.atan2(tan.x, tan.z);
  if (kind === "RING") {
    const mat = new THREE.MeshBasicMaterial({ color: 0xFF7A22, toneMapped: false, fog: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.16, 8, 20), mat);
    mesh.add(ring);
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45),
      new THREE.MeshBasicMaterial({ color: 0xFFEE88, toneMapped: false, fog: false })
    );
    mesh.add(core);
  } else if (kind === "TANK") {
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.05, 0),
      new THREE.MeshStandardMaterial({
        color: 0x3de8ff, emissive: 0x3de8ff, emissiveIntensity: 1.6,
        metalness: 0.2, roughness: 0.2, toneMapped: false, fog: false
      })
    );
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.12, 8, 22),
      new THREE.MeshBasicMaterial({ color: 0x9af6ff, toneMapped: false, fog: false })
    );
    halo.rotation.x = Math.PI / 2;
    mesh.add(core);
    mesh.add(halo);
  } else if (kind === "BOLT") {
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0xC4F2FF, metalness: 0.35, roughness: 0.18,
      emissive: 0x3de8ff, emissiveIntensity: 1.4, toneMapped: false, fog: false
    });
    const shape = new THREE.Shape();
    shape.moveTo(0.35, 2.4);
    shape.lineTo(1.15, 2.4);
    shape.lineTo(0.2, 0.35);
    shape.lineTo(0.85, 0.35);
    shape.lineTo(-0.45, -2.5);
    shape.lineTo(0.05, -0.15);
    shape.lineTo(-0.85, -0.15);
    shape.closePath();
    const bolt = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 1 }), boltMat);
    bolt.position.set(-0.15, 0, -0.14);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(2.35, 0.14, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x9AF0FF, toneMapped: false, fog: false })
    );
    halo.rotation.x = Math.PI / 2;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.85, 24),
      new THREE.MeshBasicMaterial({ color: 0x3de8ff, transparent: true, opacity: 0.18, toneMapped: false, fog: false, side: THREE.DoubleSide })
    );
    disc.rotation.x = -Math.PI / 2;
    mesh.add(bolt, halo, disc);
    mesh.scale.setScalar(2.2);
  } else if (kind === "STAR") {
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xFFE566, metalness: 0.35, roughness: 0.22,
      emissive: 0xFFC400, emissiveIntensity: 1.6, toneMapped: false, fog: false
    });
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rad = i % 2 === 0 ? 1.55 : 0.62;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
    }
    sh.closePath();
    const star = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 1 }), starMat);
    star.position.z = -0.14;
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(2.15, 0.12, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xFFF3A0, toneMapped: false, fog: false })
    );
    halo.rotation.x = Math.PI / 2;
    mesh.add(star, halo);
    mesh.scale.setScalar(2.0);
  } else {
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.35),
      new THREE.MeshBasicMaterial({ color: 0xFF4020, toneMapped: false, fog: false })
    );
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.65, 0.14, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xFFEE88, toneMapped: false, fog: false })
    );
    halo.rotation.x = Math.PI / 2;
    mesh.add(core);
    mesh.add(halo);
  }
  mesh.position.set(x, y, z);
  mesh.frustumCulled = false;
  scene.add(mesh);
  pickups.push({ kind, x, z, y, mesh, taken: 0, cool: cool || 8, hitR: kind === "STAR" ? (PLANET.key === "moon" ? 9.6 : 7.6) : (kind === "RING" ? 4.2 : 6.8), pack: pack || "core", baseScale: mesh.scale.x || 1 });
}
function clearPickups() {
  while (pickups.length) {
    const p = pickups.pop();
    if (p.mesh) scene.remove(p.mesh);
  }
}
function seedPickups() {
  clearPickups();
  const bolts = [
    [0.16, 3.6], [0.24, -3.6], [0.32, 0], [0.40, 4.4], [0.48, -4.4],
    [0.56, 0], [0.64, 4.4], [0.72, -3.6], [0.80, 3.6], [0.90, -4.4]
  ];
  const yOff = PLANET.key === "moon" ? 6.4 : 4.8;
  bolts.forEach((s) => addPickup("BOLT", snapOffBigAir(s[0]), s[1], yOff, 10, "core"));
  const j = JUMPS.find((x) => x.kind === "valley" || x.kind === "table");
  if (j) {
    const takeT = j.t + jumpTakeU(j) * j.len / trackLen;
    const u = PLANET.key === "moon" ? 0.34 : 0.42;
    const t = (takeT + u * jumpFlyLen(j) / trackLen) % 1;
    addPickup("STAR", t, 0, flightArc(j, u) + (PLANET.key === "moon" ? 0.7 : 2.1), 1e9, "star");
  }
}
seedPickups();
function clearPlayRamps() {
  while (playRamps.length) {
    const m = playRamps.pop();
    if (m) scene.remove(m);
  }
}
let playRampGen = 0;
function plantPlayRamps() {
  clearPlayRamps();
  // BUILD 127: freestyle uses ribbon JUMPS only — no PLAY_JUMPS kickers.
  return;
  if (!isPlayground()) return;
  const gen = ++playRampGen;
  const kits = [
    { url: "./lib/play/hill-lip.glb", h: 1 },
    { url: "./lib/play/hill-table.glb", h: 1 },
    { url: "./lib/play/hill-bump.glb", h: 1 },
    { url: "./lib/play/rock-ramp.glb", h: 1 },
    { url: "./lib/play/cliff-slope.glb", h: 1 }
  ];
  const dress = [
    "./lib/sandstone-boulder.glb",
    "./lib/rock_tallA.glb",
    "./lib/crate-01.glb",
    "./lib/oil-drum.glb",
    "./lib/space-barrel.glb",
    "./lib/rock_largeB.glb"
  ];
  PLAY_JUMPS.forEach((j, i) => {
    const kit = kits[i % kits.length];
    const lip = (j.t + 0.22 * j.len / trackLen) % 1;
    const mid = (j.t + 0.40 * j.len / trackLen) % 1;
    const at = placeOnLat(lip, 0);
    loadGlb(kit.url, (root) => {
      if (gen !== playRampGen) return;
      marsPaint(root, 0.38);
      const mesh = sitGlb(root, at.x, at.z, Math.max(3.4, j.h * 0.95), at.yaw, {
        allowPath: true, collider: false, bury: 0.12
      });
      if (mesh) playRamps.push(mesh);
    });
    const side = i % 2 ? 1 : -1;
    const dAt = placeOnLat(mid, side * (HALF_W + 5.5));
    loadGlb(dress[i % dress.length], (root) => {
      if (gen !== playRampGen) return;
      marsPaint(root, 0.28);
      const mesh = sitGlb(root, dAt.x, dAt.z, 2.4 + (i % 3) * 1.1, dAt.yaw + 0.4, {
        collider: false, bury: 0.06, keepOffRocket: true
      });
      if (mesh) playRamps.push(mesh);
    });
  });
}
function stepRivals(dt) {
  spawnRivals();
  if (boostChainT > 0) {
    boostChainT -= dt;
    if (boostChainT <= 0) boostChain = 0;
  }
  pickups.forEach((p) => {
    if (p.mesh) {
      p.mesh.rotation.y += dt * (p.kind === "RING" ? 1.5 : 2.6);
      const base = p.y != null ? p.y : terrainH(p.x, p.z) + 2.5;
      p.mesh.position.y = base + Math.sin(timeMs * 0.006 + p.x) * 0.38;
      p.mesh.scale.setScalar((p.baseScale || 1) * (1 + Math.sin(timeMs * 0.008) * 0.08));
    }
    if (p.taken > 0) { p.taken -= dt; if (p.taken <= 0 && p.mesh) p.mesh.visible = true; return; }
    if (startLock) return;
    const d = Math.hypot(p.x - car.x, p.z - car.z);
    if (d > (p.hitR || 3.4)) return;
    if (p.kind === "RING") {
      if (!car.air) return;
      if (Math.abs(car.y - p.y) > 2.3) return;
    }
    if (p.kind === "STAR") {
      if (!car.air) return;
      if (Math.abs(car.y - p.y) > (PLANET.key === "moon" ? 12 : 7.5)) return;
    }
    grant(p.kind);
    p.taken = p.kind === "STAR" ? 1e9 : (p.cool || 8);
    if (p.mesh) p.mesh.visible = false;
  });
  const r = rivals[0];
  if (!r) return;
  {
    const kit = r.mesh.getObjectByName("rivalKit");
    const hull = r.mesh.userData.hull;
    if (hull) hull.visible = !kit;
    if (kit) {
      kit.traverse((o) => {
        if (!o.isMesh) return;
        o.visible = true;
        o.frustumCulled = false;
      });
    }
    r.mesh.traverse((o) => { o.frustumCulled = false; });
  }
  if (startLock) {
    const p0 = curve.getPointAt(r.t);
    const tan0 = curve.getTangentAt(r.t);
    const right0 = new THREE.Vector3(tan0.z, 0, -tan0.x).normalize();
    const x0 = p0.x + right0.x * r.lat;
    const z0 = p0.z + right0.z * r.lat;
    r.mesh.position.set(x0, terrainH(x0, z0) + GROUND_SIT + rivalFlightY(r.t), z0);
    r.mesh.rotation.set(0, Math.atan2(tan0.x, tan0.z), 0, "YXZ");
    return;
  }
  if (r.ghost && r.samples) {
    const pose = ghostPose(r.samples, startLock ? 0 : timeMs);
    if (pose) {
      r.prevT = r.t;
      r.t = (pose.t + 1) % 1;
      r.lat = pose.lat;
      r.laps = pose.lap;
      r.speed = DIFF.rival[0];
    }
  } else if (r.spinT > 0) {
    r.spinT -= dt;
    r.mesh.rotation.y += 6 * dt;
    r.speed *= Math.exp(-1.6 * dt);
  } else {
    const lead = r.t - lastT;
    let wrapped = lead;
    if (wrapped > 0.5) wrapped -= 1;
    if (wrapped < -0.5) wrapped += 1;
    r.speed = DIFF.rival[0];
    if (wrapped < -0.025) r.speed = DIFF.rival[1];
    if (wrapped > 0.035) r.speed = DIFF.rival[2];
    r.prevT = r.t;
    r.t = (r.t + (r.speed / trackLen) * dt) % 1;
    if (r.prevT > 0.7 && r.t < 0.2) r.laps += 1;
    if (Math.abs(r.lat) > HALF_W) r.lat += -Math.sign(r.lat) * 3 * dt;
  }
  const p = curve.getPointAt(r.t);
  const tan = curve.getTangentAt(r.t);
  const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
  const x = p.x + right.x * r.lat;
  const z = p.z + right.z * r.lat;
  const yaw = Math.atan2(tan.x, tan.z);
  const airY = rivalFlightY(r.t);
  r.mesh.position.set(x, terrainH(x, z) + GROUND_SIT + airY, z);
  if (r.spinT <= 0) {
    const look = 10 / trackLen;
    const yA = rivalFlightY((r.t + look) % 1);
    const yB = rivalFlightY((r.t - look + 1) % 1);
    const pitch = THREE.MathUtils.clamp(Math.atan2(yA - yB, 20), -0.5, 0.5);
    r.mesh.rotation.set(pitch, yaw, 0, "YXZ");
  }
  const d = Math.hypot(x - car.x, z - car.z);
  if (d < 3.5 && car.spinT <= 0 && r.spinT <= 0) {
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
    } else if (rel < -6 && !hurtSafe()) {
      car.speed *= 0.82;
      if (Math.abs((car.x - p.x) * right.x + (car.z - p.z) * right.z) > HALF_W + 1.2 && car.spinT <= 0) spinOut(0.85);
    }
  }
  if (r.ghost && r.samples && !finished) {
    const last = r.samples[r.samples.length - 1];
    if (timeMs >= last.ms && last.lap >= LAP_COUNT - 1) r.laps = LAP_COUNT;
  }
  if (!finished && !r.phantom && r.laps >= LAP_COUNT && r.t > START_T + 0.01) {
    finished = true;
    playerWon = false;
    showFinish(r.ghost ? "GHOST WINS" : "RIVAL WINS");
  }
}

function ceremonyAnchor() {
  const g = gates[GATE_COUNT - 1];
  const dist = HALF_W + 20;
  const x = g.pos.x + g.right.x * dist;
  const z = g.pos.z + g.right.z * dist;
  return { x, z, y: terrainH(x, z), yaw: Math.atan2(g.forward.x, g.forward.z), right: g.right, fwd: g.forward };
}
function resetSpray() {
  const spray = ceremony.spray;
  if (!spray) return;
  const n = spray.userData.n;
  const pos = spray.geometry.attributes.position.array;
  const vel = spray.userData.vel;
  const life = spray.userData.life;
  for (let i = 0; i < n; i++) {
    life[i] = 0.35 + Math.random() * 0.7;
    vel[i * 3] = (Math.random() - 0.35) * 3.2;
    vel[i * 3 + 1] = 2.4 + Math.random() * 4.2;
    vel[i * 3 + 2] = (Math.random() - 0.2) * 2.4;
    pos[i * 3] = 0;
    pos[i * 3 + 1] = 0;
    pos[i * 3 + 2] = 0;
  }
  spray.geometry.attributes.position.needsUpdate = true;
  spray.visible = true;
}
function stepSpray(dt) {
  const spray = ceremony.spray;
  if (!spray || !spray.visible) return;
  const n = spray.userData.n;
  const pos = spray.geometry.attributes.position.array;
  const vel = spray.userData.vel;
  const life = spray.userData.life;
  let live = 0;
  for (let i = 0; i < n; i++) {
    if (life[i] <= 0) continue;
    live++;
    life[i] -= dt;
    vel[i * 3 + 1] -= 6.5 * dt;
    pos[i * 3] += vel[i * 3] * dt;
    pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
    pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
  }
  spray.geometry.attributes.position.needsUpdate = true;
  spray.material.opacity = live ? 0.9 : 0;
  if (!live) spray.visible = false;
}
function layoutCeremony() {
  if (!ceremony.g) return;
  const a = ceremonyAnchor();
  ceremony.x = a.x; ceremony.y = a.y; ceremony.z = a.z; ceremony.yaw = a.yaw;
  ceremony.g.position.set(a.x, a.y, a.z);
  ceremony.g.rotation.y = a.yaw;
  ceremony.g.visible = ceremony.won;
  if (ceremony.hero) {
    ceremony.g.remove(ceremony.hero);
    ceremony.hero = null;
  }
  if (ceremony.girl) ceremony.girl.visible = false;
  if (ceremony.bottle) ceremony.bottle.visible = false;
  if (ceremony.playerFig) ceremony.playerFig.visible = false;
  if (ceremony.podium) ceremony.podium.visible = false;
  if (ceremony.spray) ceremony.spray.visible = false;
  if (ceremony.trophy) {
    const tier = cupTier();
    ceremony.trophy.visible = ceremony.won;
    ceremony.trophy.position.set(0, 2.35, 0);
    ceremony.trophy.traverse((o) => {
      if (!o.isMesh || !o.material || !o.material.color) return;
      if (tier === "GOLD") o.material.color.setHex(0xE8C84A);
      else if (tier === "SILVER") o.material.color.setHex(0xC0C4C8);
      else o.material.color.setHex(0xB87333);
    });
  }
  if (!ceremony.won && scene.fog) scene.fog.color.setHex(0x8A7068);
  document.body.classList.add("ceremony-hide-hud");
}
function beginCeremony(label) {
  ceremony.active = true;
  ceremony.t = 0;
  ceremony.won = playerWon;
  ceremony.hudShown = false;
  ceremony.label = label;
  fillFinishCard(label);
  car.air = false; car.vy = 0; car.pitch = 0; car.roll = 0;
  car.y = terrainH(car.x, car.z) + GROUND_SIT;
  truck.userData.wheels.forEach((w) => {
    w.fold = 0;
    w.hub.rotation.z = 0;
    if (w.blob) w.blob.visible = true;
  });
  layoutCeremony();
  playSting(playerWon);
}
function skipCeremony() {
  if (!ceremony.active) return;
  ceremony.t = ceremony.won ? 3.25 : 1.45;
  revealFinishCard();
}
function endCeremony() {
  ceremony.active = false;
  ceremony.t = 0;
  ceremony.hudShown = false;
  if (ceremony.g) ceremony.g.visible = false;
  if (ceremony.spray) ceremony.spray.visible = false;
  if (scene.fog) scene.fog.color.setHex(PLANET.fog);
  document.body.classList.remove("ceremony-hide-hud");
}
function stepCeremony(dt) {
  if (!ceremony.active) return;
  ceremony.t += dt;
  if (ceremony.trophy && ceremony.trophy.visible) {
    ceremony.trophy.rotation.y += dt * 0.85;
    ceremony.trophy.position.y = 2.35 + Math.sin(ceremony.t * 1.8) * 0.18;
  }
  const hudAt = ceremony.won ? 3.2 : 1.4;
  if (!ceremony.hudShown && ceremony.t >= hudAt) revealFinishCard();
}
function ceremonyCam() {
  const sx = Math.sin(car.yaw), cz = Math.cos(car.yaw);
  const t = ceremony.t;
  if (ceremony.won && t < 1.6) {
    const back = 16, h = 6.4;
    camera.position.set(car.x - sx * back + cz * 1.4, car.y + h, car.z - cz * back - sx * 1.4);
    camera.lookAt(car.x + sx * 10, car.y + 1.4, car.z + cz * 10);
    camera.fov = 44;
  } else if (ceremony.won && t < 3.2) {
    const u = (t - 1.6) / 1.6;
    const ang = car.yaw + 0.7 + u * 0.9;
    const r = 13.5;
    camera.position.set(car.x + Math.sin(ang) * r, car.y + 5.2, car.z + Math.cos(ang) * r);
    camera.lookAt(car.x, car.y + 1.15, car.z);
    camera.fov = 40;
  } else if (!ceremony.won) {
    const back = 10.5, side = 6.2, h = 3.9;
    camera.position.set(car.x - sx * back + cz * side, car.y + h, car.z - cz * back - sx * side);
    camera.lookAt(car.x, car.y + 1.05, car.z);
    camera.fov = 42;
  } else {
    const u = Math.min(1, (t - 3.2) / 2.6);
    const dist = 10.8 - u * 1.1;
    const height = 3.05;
    const yaw = ceremony.yaw + u * 0.4;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    camera.position.set(ceremony.x - fx * dist, ceremony.y + height, ceremony.z - fz * dist);
    camera.lookAt(ceremony.x, ceremony.y + 2.2, ceremony.z);
    camera.fov = 34 + u * 3;
    sun.target.position.set(ceremony.x, ceremony.y + 2.2, ceremony.z);
    sun.position.set(ceremony.x - 12, ceremony.y + 16, ceremony.z - 8);
  }
  camera.updateProjectionMatrix();
  camReady = true;
  if (!(ceremony.won && t >= 3.2)) {
    sun.target.position.set(car.x, car.y, car.z);
    sun.position.set(car.x - 36, car.y + 32, car.z - 24);
  }
  fill.target.position.set(car.x, car.y, car.z);
  sky.position.copy(camera.position);
}

function chaseCam(dt, boosting) {
  if (ceremony.active) { ceremonyCam(); return; }
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
  sky.position.copy(camera.position);
  camera.updateProjectionMatrix();
  camReady = true;
  sun.target.position.set(car.x, car.y, car.z);
  sun.position.set(car.x - 36, car.y + 32, car.z - 24);
  fill.target.position.set(car.x, car.y, car.z);
}

function hudBind() {
  const g = gates[finished ? GATE_COUNT - 1 : nextGate];
  const speedMph = Math.abs(car.speed) * 2.236936;
  elSpeed.textContent = String(Math.round(speedMph));
  if (elBoostFill) elBoostFill.style.height = Math.round(car.boost * 100) + "%";
  elCluster.classList.toggle("overheat", car.overheating);
  elTimer.textContent = isPlayground() ? fmtTime(Math.max(0, FREE_MS - timeMs)) : fmtTime(timeMs);
  const elCoinLab = document.querySelector("#coin-panel .label");
  const vf = document.getElementById("viewfinder");
  if (vf) vf.classList.toggle("hot", MODE.key === "hunt" && !!huntShotTarget());
  if (MODE.key === "hunt") {
    const need = huntNeed();
    const got = huntItems.filter((h) => h.goal && h.found).length;
    elGateIdx.textContent = "SHOTS " + got + "/" + need;
    const nxt = huntNearest();
    elGateDist.textContent = nxt
      ? (huntLabel(nxt) + "  " + Math.round(Math.hypot(nxt.x - car.x, nxt.z - car.z)) + " m")
      : "DONE";
    if (elCoinLab) elCoinLab.textContent = "SHOTS";
  } else if (isPlayground()) {
    const left = Math.max(0, FREE_MS - timeMs);
    elGateIdx.textContent = "FREE  " + fmtTime(left);
    elGateDist.textContent = car.air ? "AIR" : "RIBBON";
    if (elCoinLab) elCoinLab.textContent = "COINS";
  } else {
    elGateIdx.textContent = "L" + Math.min(LAP_COUNT, raceLap + 1) + "/" + LAP_COUNT + "  GATE " + (finished ? GATE_COUNT : nextGate + 1) + "/" + GATE_COUNT;
    elGateDist.textContent = Math.round(Math.hypot(g.pos.x - car.x, g.pos.z - car.z)) + " m";
    if (elCoinLab) elCoinLab.textContent = "COINS";
  }
  if (elPlaceVal) {
    const r = rivals[0];
    let ahead = true;
    if (r) {
      let lead = lastT - r.t;
      if (lead > 0.5) lead -= 1;
      if (lead < -0.5) lead += 1;
      ahead = lead >= 0;
    }
    if (finished) {
      elPlaceVal.textContent = playerWon ? "1st" : "2nd";
      elPlaceVal.style.color = playerWon ? "#ffee55" : "#f4f4f2";
    } else {
      elPlaceVal.textContent = ahead ? "1st" : "2nd";
      elPlaceVal.style.color = ahead ? "#ffee55" : "#f4f4f2";
    }
  }
  const elCoinVal = document.getElementById("coin-val");
  if (elCoinVal) {
    if (MODE.key === "tour") elCoinVal.textContent = coinsGot + "  CPU " + rivalCoins;
    else if (MODE.key === "hunt") elCoinVal.textContent = String(huntFound);
    else if (isPlayground()) elCoinVal.textContent = String(coinsGot);
    else elCoinVal.textContent = coins.length ? (coinsGot + "/" + coins.length) : String(coinsGot);
  }
  gates.forEach((gt, i) => {
    if (!gt.lights) return;
    const live = !finished && i === nextGate;
    const flash = live && flashT > 0;
    gt.lights.forEach((L) => {
      L.mat.color.setHex(live || flash ? gt.litHex : 0x1a2228);
    });
  });
  if (elCount) {
    if (startLock && !waitingDiff) {
      elCount.classList.add("show");
      if (countT > 2.2) elCount.textContent = "3";
      else if (countT > 1.2) elCount.textContent = "2";
      else if (countT > 0.15) elCount.textContent = "1";
      else elCount.textContent = "GO";
    } else elCount.classList.remove("show");
  }
  const aim = isOpenWorld() ? huntNearest() : g;
  const ax = aim ? (aim.x != null ? aim.x : aim.pos.x) : car.x;
  const ay = aim ? (aim.mesh ? aim.mesh.position.y + 1.2 : (aim.pos ? aim.pos.y + 3 : car.y)) : car.y;
  const az = aim ? (aim.z != null ? aim.z : aim.pos.z) : car.z;
  _gateNdc.set(ax, ay, az).project(camera);
  const on = Math.abs(_gateNdc.x) < 0.92 && Math.abs(_gateNdc.y) < 0.88 && _gateNdc.z < 1;
  elGatePanel.classList.toggle("offscreen", !on);
  if (!on && !finished && aim) {
    elChevron.classList.add("show");
    let ang = Math.atan2(ax - car.x, az - car.z) - car.yaw;
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
function playSting(won) {
  if (!sfx || !sfx.ctx) return;
  const ctx = sfx.ctx;
  const now = ctx.currentTime;
  const notes = won ? [523.25, 659.25, 783.99] : [392, 311.13];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator();
    const gain = ctx.createGain();
    o.type = won ? "triangle" : "sine";
    o.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.02 + i * 0.11);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38 + i * 0.11);
    o.connect(gain);
    gain.connect(ctx.destination);
    o.start(now + i * 0.11);
    o.stop(now + 0.48 + i * 0.11);
  });
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
  } else if (launchPhase === "coast") {
    if (launchT > 5) { stl.visible = true; launchPhase = "land"; launchT = 0; rocket.userData.exhaust.visible = true; }
  } else {
    const y = Math.max(0, 280 - 42 * launchT);
    stl.position.y = y;
    rocket.userData.exhaust.scale.setScalar(0.65);
    if (y <= 0) { launchPhase = "pad"; launchT = 0; rocket.userData.exhaust.visible = false; }
  }
}
function stepWorld(dt) {
  worldAnim.crowds.forEach((g) => {
    g.children.forEach((c) => {
      if (!c.userData || c.userData.baseY == null) return;
      c.userData.phase = (c.userData.phase || 0) + dt * 5.2;
      c.position.y = c.userData.baseY + Math.abs(Math.sin(c.userData.phase)) * 0.15;
      if (c.userData.armR) c.userData.armR.rotation.z = -0.25 - Math.abs(Math.sin(c.userData.phase * 1.35)) * 0.85;
      if (c.userData.armL) c.userData.armL.rotation.z = 0.28 + Math.abs(Math.sin(c.userData.phase * 1.35 + 0.5)) * 0.55;
    });
  });
  worldAnim.flyers.forEach((f) => {
    f.t += dt;
    const setY = (y) => { f.g.position.y = f.baseY + y; };
    if (f.phase === "hover") {
      setY(7 + Math.sin(f.t * 0.75) * 1.5);
      f.exhaust.visible = true;
      f.exhaust.scale.setScalar(0.32 + Math.sin(f.t * 3.1) * 0.07);
      return;
    }
    if (f.phase === "pad") {
      setY(0); f.exhaust.visible = false; f.g.visible = true;
      if (f.t > 8 + (f.worldH % 7)) { f.phase = "ign"; f.t = 0; }
    } else if (f.phase === "ign") {
      setY((Math.random() - 0.5) * 0.28);
      f.exhaust.visible = true;
      f.exhaust.scale.setScalar(0.35 + f.t);
      if (f.t > 2.1) { f.phase = "up"; f.t = 0; }
    } else if (f.phase === "up") {
      const y = 11 * f.t + 15 * f.t * f.t;
      setY(y);
      f.exhaust.scale.setScalar(1.05);
      if (y > 300) { f.phase = "coast"; f.t = 0; f.exhaust.visible = false; f.g.visible = false; }
    } else if (f.phase === "coast") {
      if (f.t > 4.5) { f.g.visible = true; f.phase = "land"; f.t = 0; setY(260); f.exhaust.visible = true; }
    } else {
      const y = Math.max(0, 260 - 40 * f.t);
      setY(y);
      f.exhaust.scale.setScalar(0.7);
      if (y <= 0) { f.phase = "pad"; f.t = 0; f.exhaust.visible = false; }
    }
  });
  if (!startLock && Math.abs(car.speed) > 16) {
    worldAnim.landmarks.forEach((lm) => {
      if (lm.cool > 0) { lm.cool -= dt; return; }
      if (Math.hypot(car.x - lm.x, car.z - lm.z) > lm.r) return;
      lm.cool = 16;
      if (lm.kind === "CROWD") {
        car.boost = Math.min(1, car.boost + 0.1);
        showToast("CHEER", 0.4);
      } else if (lm.kind === "GAUNTLET") {
        car.turboT = Math.max(car.turboT, 0.65);
        car.boost = Math.min(1, car.boost + 0.14);
        showToast("GAUNTLET", 0.55);
      } else if (lm.kind === "SOLAR") {
        car.boost = Math.min(1, car.boost + 0.08);
        showToast("SOLAR", 0.4);
      }
    });
  } else {
    worldAnim.landmarks.forEach((lm) => { if (lm.cool > 0) lm.cool -= dt; });
  }
}

function applyPlanetLook() {
  scene.background = new THREE.Color(PLANET.bg);
  if (scene.fog) scene.fog.color.setHex(PLANET.fog);
  if (sky && sky.material && sky.material.uniforms) {
    sky.material.uniforms.uHor.value.fromArray(PLANET.skyHor);
    sky.material.uniforms.uZen.value.fromArray(PLANET.skyZen);
  }
  if (ground && ground.material) {
    ground.material.map = PLANET.key === "moon" ? DIRT_MOON : PLANET.key === "earth" ? DIRT_EARTH : DIRT_MARS;
    ground.material.color.setHex(PLANET.ground);
    ground.material.needsUpdate = true;
  }
  if (typeof ribbon !== "undefined" && ribbon && ribbon.material) {
    ribbon.material.map = PLANET.key === "moon" ? TRACK_MOON : PLANET.key === "earth" ? TRACK_EARTH : TRACK_MARS;
    ribbon.material.needsUpdate = true;
  }
  if (dustMesh && dustMesh.material) {
    dustMesh.material.color.setHex(PLANET.key === "moon" ? 0xE8ECF0 : PLANET.key === "earth" ? 0xE8DCC8 : 0xE87840);
  }
  if (sunMesh) {
    sunMesh.visible = true;
    sunMesh.scale.setScalar(PLANET.key === "moon" ? 0.45 : 1);
    sunMesh.material.color.setHex(PLANET.key === "moon" ? 0xFFF6E8 : PLANET.key === "earth" ? 0xFFF2B0 : 0xFFD090);
    if (PLANET.key === "moon") sunMesh.position.set(2400, 620, 1200);
    else if (PLANET.key === "earth") sunMesh.position.set(-2400, 520, 1400);
    else sunMesh.position.set(-620, 420, -380);
  }
  if (earthSky) earthSky.visible = PLANET.key === "moon";
  const dunes = scene.getObjectByName("dunes");
  if (dunes) dunes.visible = PLANET.key === "mars";
  const tag = document.querySelector(".home-tag");
  if (tag) tag.textContent = PLANET.tag + "  ·  FOUR MODES  ·  ONE CORE";
  document.querySelectorAll("[data-planet]").forEach((b) => {
    b.classList.toggle("on", b.getAttribute("data-planet") === PLANET.key);
  });
}
function setMarsDressVisible(on) {
  ["dunes", "starshipGarden", "padRocket"].forEach((name) => {
    const o = scene.getObjectByName(name);
    if (o) o.visible = on;
  });
  if (typeof olympus !== "undefined" && olympus) olympus.visible = on;
  worldAnim.flyers.forEach((f) => {
    if (f.mars && f.g) f.g.visible = on;
  });
}
function relocateGates() {
  if (typeof gates === "undefined" || !gates) return;
  gates.forEach((g) => {
    const p = curve.getPointAt(g.t);
    const tan = curve.getTangentAt(g.t);
    const y = terrainH(p.x, p.z);
    const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    g.mesh.position.set(p.x, 0, p.z);
    g.mesh.rotation.y = Math.atan2(tan.x, tan.z);
    g.pos.copy(p).setY(y);
    g.forward.copy(tan);
    g.right.copy(right);
  });
}
function applyCourse() {
  const key = PLANET.key;
  const pts = key === "moon" ? makeMoonPath() : key === "earth" ? makeEarthPath() : makeMarsPath();
  const jumps = key === "moon" ? MOON_JUMPS : key === "earth" ? EARTH_JUMPS : MARS_JUMPS;
  pathPts.length = 0;
  pts.forEach((p) => pathPts.push(p));
  curve = new THREE.CatmullRomCurve3(pathPts, true, "catmullrom", 0.15);
  trackLen = curve.getLength();
  JUMPS.length = 0;
  jumps.forEach((j) => JUMPS.push(Object.assign({}, j)));
  refreshPathSamples();
  rebuildRibbon();
  rebuildJumpMarks();
  relocateGates();
  seedPickups();
  seedCoins();
  seedHazards();
  applyPlanetLook();
  seedPlanetProps();
}
function pickPlanet(key) {
  PLANET = parsePlanet(key);
  applyCourse();
  spawnStart();
  renderHsBoard();
  showToast(PLANET.tag, 0.6);
}
const planetPropRoot = new THREE.Group();
scene.add(planetPropRoot);
function clearPlanetProps() {
  worldAnim.crowds = worldAnim.crowds.filter((g) => !g.userData.planetCrowd);
  worldAnim.flyers = worldAnim.flyers.filter((f) => {
    if (!f.planet) return true;
    if (f.g && f.g.parent) f.g.parent.remove(f.g);
    return false;
  });
  for (let i = colliders.length - 1; i >= 0; i--) {
    if (colliders[i].planet) colliders.splice(i, 1);
  }
  while (planetPropRoot.children.length) {
    const c = planetPropRoot.children.pop();
    planetPropRoot.remove(c);
  }
}
function plantPlanetCrowds() {
  const spots = [0.11, 0.24, 0.37, 0.51, 0.66, 0.81, 0.93];
  spots.forEach((t, i) => {
    const side = i % 2 ? 1 : -1;
    const at = alongTrack(t, side, HALF_W + 10);
    const g = new THREE.Group();
    g.userData.planetCrowd = true;
    g.position.set(at.x, 0, at.z);
    g.rotation.y = at.yaw + (side > 0 ? Math.PI : 0);
    const n = IS_MOBILE ? 4 : 8;
    const earthCols = [0x1E4A8A, 0xC45C18, 0xF4F6F8, 0x2E7D4F, 0x8B1E3F];
    const suitCols = [0xf4f6f8, 0x3d5a80, 0xd0d4da, 0xc45c18];
    for (let k = 0; k < n; k++) {
      let a;
      if (PLANET.key === "earth") a = makeFan(earthCols[k % earthCols.length]);
      else a = (k % 3 === 0) ? makeAlien() : makeAstronaut(suitCols[k % suitCols.length]);
      const lx = (k - (n - 1) * 0.5) * 1.12;
      a.position.set(lx, groundH(at.x + lx, at.z), 0);
      a.userData.baseY = a.position.y;
      a.userData.phase = k * 0.55 + i;
      g.add(a);
    }
    planetPropRoot.add(g);
    worldAnim.crowds.push(g);
  });
}
let planetPropGen = 0;
function makeUSFlag() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, 11.2, 8),
    new THREE.MeshStandardMaterial({ color: 0xC8CCD4, metalness: 0.72, roughness: 0.28 })
  );
  pole.position.y = 5.6;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.7, 0.28, 8),
    new THREE.MeshStandardMaterial({ color: 0x8A8E96, metalness: 0.35, roughness: 0.65 })
  );
  base.position.y = 0.14;
  const c = document.createElement("canvas");
  c.width = 256; c.height = 160;
  const ctx = c.getContext("2d");
  const stripeH = 160 / 13;
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#B22234" : "#FFFFFF";
    ctx.fillRect(0, i * stripeH, 256, stripeH + 1);
  }
  ctx.fillStyle = "#3C3B6E";
  ctx.fillRect(0, 0, 102, stripeH * 7);
  ctx.fillStyle = "#FFFFFF";
  for (let r = 0; r < 9; r++) {
    const n = r % 2 === 0 ? 6 : 5;
    const ox = r % 2 === 0 ? 10 : 18;
    for (let s = 0; s < n; s++) {
      ctx.beginPath();
      ctx.arc(ox + s * 16, 8 + r * 10, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 4.0),
    new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.04 })
  );
  cloth.position.set(3.3, 8.8, 0);
  g.add(pole, base, cloth);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}
function cloneParkedTruck(hex) {
  const g = new THREE.Group();
  g.userData.parkedTruck = true;
  const src = truck.getObjectByName("stlBody");
  if (src && src.children.length >= 5) {
    const kit = new THREE.Group();
    kit.position.copy(src.position);
    kit.rotation.copy(src.rotation);
    kit.scale.copy(src.scale);
    src.children.forEach((child) => {
      if (!child.isMesh || !child.geometry) return;
      const m = new THREE.Mesh(child.geometry, child.material);
      m.name = child.name;
      m.position.copy(child.position);
      m.quaternion.copy(child.quaternion);
      m.scale.copy(child.scale);
      kit.add(m);
    });
    paintRivalKit(kit, hex);
    g.add(kit);
    addRivalWheels(g, false);
    g.scale.setScalar(LOOK_TRUCK);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}
function plantParkedTrucks(gen) {
  if (gen !== planetPropGen) return;
  if (!playerKitReady()) {
    setTimeout(() => plantParkedTrucks(gen), 280);
    return;
  }
  const spots = [0.11, 0.24, 0.37, 0.51, 0.66, 0.81, 0.93];
  spots.forEach((t, i) => {
    const side = i % 2 ? 1 : -1;
    const at = alongTrack(t, side, HALF_W + 16);
    if (footprintHitsDirt(at.x, at.z, 6)) return;
    const ct = cloneParkedTruck(0xC8CCD4);
    if (!ct.children.length) return;
    ct.position.set(at.x, terrainH(at.x, at.z) + GROUND_SIT, at.z);
    ct.rotation.y = at.yaw + 0.55 * side;
    planetPropRoot.add(ct);
  });
}
function makeParkedCybertruck() {
  return cloneParkedTruck(0xC8CCD4);
}
function plantLandingBeats(gen) {
  [[0.08, -1], [0.55, 1]].forEach(([t, side]) => {
    const at = alongTrack(t, side, HALF_W + 22);
    const flag = makeUSFlag();
    const gy = terrainH(at.x, at.z);
    flag.position.set(at.x, gy, at.z);
    flag.lookAt(at.p.x, gy, at.p.z);
    flag.rotateY(Math.PI);
    planetPropRoot.add(flag);
    if (PLANET.key === "earth") return;
    const rx = at.x + at.right.x * side * 5;
    const rz = at.z + at.right.z * side * 5;
    loadGlb("./lib/rover.glb", (root) => {
      if (gen !== planetPropGen) return;
      sitGlb(root, rx, rz, 2.4, at.yaw + 0.5, { parent: planetPropRoot, collider: false, bury: 0.02, keepOffRocket: true });
    });
  });
}
function seedPlanetProps() {
  const gen = ++planetPropGen;
  clearPlanetProps();
  setMarsDressVisible(PLANET.key === "mars");
  plantPlanetCrowds();
  plantLandingBeats(gen);
  plantParkedTrucks(gen);
  if (PLANET.key === "mars") return;
  const off = HALF_W + 26;
  if (PLANET.key === "moon") {
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(210, 270, 16, IS_MOBILE ? 20 : 36, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x5C6068, roughness: 0.97, metalness: 0.04, side: THREE.DoubleSide })
    );
    bowl.position.set(2000, -5, 2400);
    planetPropRoot.add(bowl);
    const spots = [0.12, 0.22, 0.34, 0.48, 0.62, 0.74, 0.86, 0.96];
    spots.forEach((t, i) => {
      const side = i % 2 ? 1 : -1;
      const at = alongTrack(t, side, off + (i % 3) * 8);
      if (hitsPath(at.x, at.z, 8)) return;
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(4.2 + (i % 3), 0.7, 8, 18),
        new THREE.MeshStandardMaterial({ color: 0x6A6E78, roughness: 0.95 })
      );
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(at.x, terrainH(at.x, at.z) + 0.12, at.z);
      planetPropRoot.add(rim);
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.4 + (i % 3) * 0.5, 0),
        new THREE.MeshStandardMaterial({ color: 0x9AA0AA, roughness: 0.9 })
      );
      rock.position.set(at.x - side * 6, terrainH(at.x - side * 6, at.z) + 0.8, at.z + 4);
      planetPropRoot.add(rock);
    });
    const landerAt = alongTrack(0.04, -1, 48);
    const lander = new THREE.Group();
    const can = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 4.2, 10), new THREE.MeshStandardMaterial({ color: 0xD8DCE4, metalness: 0.62, roughness: 0.32 }));
    can.position.y = 2.4;
    lander.add(can);
    [[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0xA8ACB4, metalness: 0.4, roughness: 0.45 }));
      leg.position.set(lx, 1.1, lz);
      lander.add(leg);
    });
    lander.position.set(landerAt.x, terrainH(landerAt.x, landerAt.z), landerAt.z);
    planetPropRoot.add(lander);
    const moonKit = [
      ["./lib/dress/moon/rock_largeA.glb", 4.8],
      ["./lib/dress/moon/rock_largeB.glb", 5.2],
      ["./lib/dress/moon/rocks_smallB.glb", 2.4],
      ["./lib/dress/moon/rock.glb", 3.0],
      ["./lib/dress/moon/rock.glb", 3.2],
      ["./lib/dress/moon/meteor_detailed.glb", 3.6],
      ["./lib/dress/moon/meteor_half.glb", 3.2],
      ["./lib/crate-01.glb", 1.6],
      ["./lib/dress/moon/barrel.glb", 1.8],
      ["./lib/dress/moon/barrels.glb", 2.4],
      ["./lib/space-barrel.glb", 1.9],
      ["./lib/dress/moon/structure_closed.glb", 6.5],
      ["./lib/dress/moon/platform_low.glb", 3.2],
      ["./lib/dress/moon/rocket_baseA.glb", 5.5],
      ["./lib/dress/moon/hangar_smallB.glb", 7.2],
      ["./lib/dress/moon/satelliteDish_detailed.glb", 4.4],
      ["./lib/rover.glb", 2.4],
      ["./lib/craterLarge.glb", 3.0],
      ["./lib/dress/moon/crater.glb", 2.4]
    ];
    const nMoon = IS_MOBILE ? 22 : 42;
    for (let i = 0; i < nMoon; i++) {
      const t = 0.06 + (i + 0.4) / nMoon * 0.90;
      const side = i % 2 ? 1 : -1;
      const dist = off + 8 + (i % 5) * 7;
      const at = alongTrack(t, side, dist);
      if (hitsPath(at.x, at.z, 10)) continue;
      const kit = moonKit[i % moonKit.length];
      const h = kit[1] * (0.85 + (i % 4) * 0.08);
      loadGlb(kit[0], (root) => {
        if (gen !== planetPropGen) return;
        sitGlb(root, at.x, at.z, h, at.yaw + i * 0.31, { parent: planetPropRoot, collider: i % 3 === 0, bury: 0.1, keepOffRocket: true });
      });
    }
    return;
  }
  if (PLANET.key === "earth") {
    const gulf = new THREE.Mesh(
      new THREE.CircleGeometry(920, IS_MOBILE ? 24 : 40),
      new THREE.MeshStandardMaterial({ color: 0x2A6A9A, roughness: 0.16, metalness: 0.46 })
    );
    gulf.rotation.x = -Math.PI / 2;
    gulf.position.set(520, -0.4, 2680);
    planetPropRoot.add(gulf);
    plantStarbase();
    const scrub = [
      ["./lib/dress/earth/tree_palmTall.glb", 13],
      ["./lib/dress/earth/plant_bushLarge.glb", 3.2],
      ["./lib/dress/earth/plant_bush.glb", 2.4],
      ["./lib/dress/earth/grass_large.glb", 2.0],
      ["./lib/dress/earth/rock_largeC.glb", 4.0],
      ["./lib/date-palm.glb", 11]
    ];
    const nScrub = IS_MOBILE ? 10 : 18;
    for (let i = 0; i < nScrub; i++) {
      const t = 0.10 + (i + 0.3) / nScrub * 0.82;
      const at = alongTrack(t, -1, HALF_W + 88 + (i % 4) * 10);
      if (footprintHitsDirt(at.x, at.z, 12)) continue;
      const kit = scrub[i % scrub.length];
      loadGlb(kit[0], (root) => {
        if (gen !== planetPropGen) return;
        sitGlb(root, at.x, at.z, kit[1], at.yaw + i * 0.2, { parent: planetPropRoot, collider: false, bury: 0.08, keepOffRocket: true });
      });
    }
    const yard = [
      ["./lib/dress/earth/crane.glb", 16],
      ["./lib/dress/earth/hopper-high-square.glb", 10],
      ["./lib/dress/earth/chimney-large.glb", 14],
      ["./lib/detail-tank.glb", 5.5]
    ];
    for (let i = 0; i < 8; i++) {
      const t = 0.46 + i * 0.018;
      const at = alongTrack(t, -1, HALF_W + 52 + (i % 3) * 8);
      if (footprintHitsDirt(at.x, at.z, 10)) continue;
      const kit = yard[i % yard.length];
      loadGlb(kit[0], (root) => {
        if (gen !== planetPropGen) return;
        paintRoot(root, i % 2 ? 0xC45C18 : 0x2A2C30, 0.55);
        sitGlb(root, at.x, at.z, kit[1], at.yaw, { parent: planetPropRoot, collider: 2.2, bury: 0.08, keepOffRocket: true });
      });
    }
    for (let i = 0; i < 5; i++) {
      const t = 0.18 + i * 0.16;
      const at = alongTrack(t, -1, HALF_W + 110 + (i % 2) * 18);
      const rad = 28 + i * 4;
      if (footprintHitsDirt(at.x, at.z, rad)) continue;
      const hill = new THREE.Mesh(
        new THREE.SphereGeometry(1, 14, 10),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0xA88850 : 0x8A7040, roughness: 0.95, metalness: 0.02 })
      );
      hill.scale.set(rad, 9 + (i % 3) * 3, rad * 0.7);
      hill.position.set(at.x, terrainH(at.x, at.z) - 6, at.z);
      planetPropRoot.add(hill);
    }
  }
}
function hitsPath(x, z, pad) {
  return minDistToPath(x, z) < HALF_W + (pad || 10);
}
function footprintHitsDirt(x, z, rad) {
  if (minDistToPath(x, z) < HALF_W + 10 + rad) return true;
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI * 0.125;
    if (minDistToPath(x + Math.cos(a) * rad, z + Math.sin(a) * rad) < HALF_W + 6) return true;
  }
  return false;
}
function paintRoot(root, hex, k) {
  const tint = new THREE.Color(hex);
  const amt = k == null ? 0.5 : k;
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (m.color) m.color.lerp(tint, amt);
      m.needsUpdate = true;
    });
  });
}
function matSteel(hex, rough, metal) {
  return new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal });
}
function makeMechazilla() {
  const g = new THREE.Group();
  const blk = matSteel(0x1A1C1E, 0.62, 0.4);
  const orn = matSteel(0xC45C18, 0.45, 0.35);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(4.2, 54, 4.2), blk);
  mast.position.y = 27;
  g.add(mast);
  for (let y = 8; y < 52; y += 8) {
    const cross = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.45, 0.45), blk);
    cross.position.y = y;
    g.add(cross);
  }
  const armGeo = new THREE.BoxGeometry(1.1, 1.6, 16);
  const a1 = new THREE.Mesh(armGeo, blk); a1.position.set(-3.2, 41, 7); g.add(a1);
  const a2 = new THREE.Mesh(armGeo, blk); a2.position.set(3.2, 41, 7); g.add(a2);
  const qd = new THREE.Mesh(new THREE.BoxGeometry(2.2, 10, 1.4), orn);
  qd.position.set(4.2, 22, 1);
  g.add(qd);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}
function makeStarshipStack() {
  const g = new THREE.Group();
  const ss = matSteel(0xD0D4DC, 0.22, 0.88);
  const blk = matSteel(0x1A1A1A, 0.55, 0.25);
  const boost = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.35, 26, 18), ss);
  boost.position.y = 13.2;
  const ship = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 2.15, 16, 18), ss);
  ship.position.y = 34.2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.85, 7.2, 18), ss);
  nose.position.y = 45.8;
  const tiles = new THREE.Mesh(new THREE.CylinderGeometry(1.92, 2.22, 15, 18, 1, true, 0, Math.PI), blk);
  tiles.position.y = 34.2;
  tiles.rotation.y = Math.PI;
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.4, 8), blk);
    bell.position.set(Math.cos(a) * 1.35, 0.4, Math.sin(a) * 1.35);
    bell.rotation.x = Math.PI;
    g.add(bell);
  }
  [[-2.4, 38], [2.4, 38], [-2.1, 42], [2.1, 42]].forEach(([x, y]) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.2, 1.6), ss);
    f.position.set(x, y, 0.2);
    f.rotation.z = (x < 0 ? 1 : -1) * 0.18;
    g.add(f);
  });
  g.add(boost, ship, nose, tiles);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}
function makeBay(w, h, d, col) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matSteel(col, 0.7, 0.22));
  body.position.y = h * 0.5;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 1.1, d + 0.3), matSteel(0xC45C18, 0.5, 0.25));
  stripe.position.y = h * 0.78;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.5, d + 0.8), matSteel(0x2A2C30, 0.55, 0.3));
  roof.position.y = h + 0.2;
  g.add(body, stripe, roof);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}
function makeCryoTank(r, h) {
  const g = new THREE.Group();
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), matSteel(0xF2F4F8, 0.35, 0.45));
  tank.position.y = h * 0.5 + 0.4;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.08, r + 0.08, 0.35, 14), matSteel(0xC45C18, 0.4, 0.3));
  band.position.y = h * 0.55;
  g.add(tank, band);
  return g;
}
function makeStarbaseSign() {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(36, 7.2, 0.7), matSteel(0x111214, 0.7, 0.15));
  wall.position.y = 3.6;
  const c = document.createElement("canvas");
  c.width = 512; c.height = 96;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#111214"; ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = "#F4F6F8";
  ctx.font = "bold 64px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("STARBASE", 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(32, 5.6), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  board.position.set(0, 3.7, 0.4);
  g.add(wall, board);
  return g;
}
function attachShipExhaust(root) {
  const exhaust = new THREE.Group();
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, 14, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x8A4DFF, transparent: true, opacity: 0.7, fog: false, toneMapped: false, side: THREE.DoubleSide, depthWrite: false })
  );
  flame.rotation.x = Math.PI;
  flame.position.y = -7;
  exhaust.add(flame);
  exhaust.visible = false;
  exhaust.scale.setScalar(0.001);
  root.add(exhaust);
  return exhaust;
}
function plantStarbase() {
  function sit(g, t, side, dist, yawAdd, rad, hit) {
    const at = alongTrack(t, side, dist);
    if (footprintHitsDirt(at.x, at.z, rad || 16)) return null;
    g.position.set(at.x, terrainH(at.x, at.z), at.z);
    g.rotation.y = at.yaw + (yawAdd || 0);
    planetPropRoot.add(g);
    if (hit) addCollider(at.x, at.z, hit, true);
    return at;
  }
  sit(makeStarbaseSign(), 0.07, -1, HALF_W + 42, Math.PI, 20, 0);
  const pad = alongTrack(0.34, 1, HALF_W + 64);
  if (!footprintHitsDirt(pad.x, pad.z, 24)) {
    const tower = makeMechazilla();
    tower.position.set(pad.x, terrainH(pad.x, pad.z), pad.z);
    tower.rotation.y = pad.yaw;
    planetPropRoot.add(tower);
    addCollider(pad.x, pad.z, 6, true);
    const sx = pad.x + pad.right.x * 9, sz = pad.z + pad.right.z * 9;
    if (!footprintHitsDirt(sx, sz, 8)) {
      const ship = makeStarshipStack();
      ship.position.set(sx, terrainH(sx, sz), sz);
      ship.rotation.y = pad.yaw;
      planetPropRoot.add(ship);
      addCollider(sx, sz, 4, true);
    }
  }
  sit(makeBay(28, 34, 20, 0x1E1E20), 0.48, -1, HALF_W + 70, 0, 22, 8);
  sit(makeBay(22, 28, 16, 0x2A2C30), 0.54, -1, HALF_W + 88, 0.08, 18, 7);
  sit(makeBay(18, 16, 22, 0xC45C18), 0.60, -1, HALF_W + 74, 0.12, 16, 6);
  for (let i = 0; i < 6; i++) {
    sit(makeCryoTank(2.1 + (i % 3) * 0.35, 7 + (i % 2) * 3), 0.36 + i * 0.012, 1, HALF_W + 48 + (i % 3) * 6, 0, 5, 2.4);
  }
  [[0.26, 1, 148], [0.42, 1, 172], [0.70, 1, 156]].forEach(([t, side, dist], i) => {
    const at = alongTrack(t, side, dist);
    if (footprintHitsDirt(at.x, at.z, 14)) return;
    const ship = makeStarshipStack();
    ship.scale.setScalar(0.82);
    const gy = terrainH(at.x, at.z);
    ship.position.set(at.x, gy, at.z);
    ship.rotation.y = at.yaw;
    const ex = attachShipExhaust(ship);
    planetPropRoot.add(ship);
    worldAnim.flyers.push({
      g: ship, exhaust: ex, phase: i % 2 ? "pad" : "coast",
      t: i * 4.2, baseY: gy, worldH: 40, planet: true
    });
  });
}
document.querySelectorAll("[data-planet]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    pickPlanet(btn.getAttribute("data-planet"));
  });
});
applyPlanetLook();
seedPlanetProps();
if (PLANET.key !== "mars") applyCourse();

importSharedRun();
spawnStart();
setDiffChip();
if (waitingDiff) {
  if (ghostIn) {
    if (elBootSub) elBootSub.textContent = "Ghost challenge loaded. Pick a line and beat their run.";
    showBoot();
  } else showHome();
} else {
  seedHazards();
  seedCoins();
  hideMenuSheets();
  setMenuOn(false);
  if (ghostIn) showToast("GHOST  " + DIFF.tag, 1.2);
}
if (PODIUM_PREVIEW === "win" || PODIUM_PREVIEW === "lose") {
  hideMenuSheets();
  setMenuOn(false);
  if (elBoot) elBoot.classList.remove("show");
  setTimeout(() => {
    startLock = false;
    countT = 0;
    finished = true;
    playerWon = PODIUM_PREVIEW !== "lose";
    timeMs = playerWon ? 98000 : 151200;
    coinsGot = playerWon ? 18 : 5;
    showFinish(playerWon ? "YOU WIN" : "RIVAL WINS");
    skipCeremony();
  }, 2800);
}
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  let dt = clock.getDelta();
  if (dt > MAX_DT) dt = MAX_DT;
  const { boosting } = drive(dt);
  stepHazards(dt);
  stepCoins(dt);
  stepHunt(dt);
  stepRivals(dt);
  stepLaunch(dt);
  stepWorld(dt);
  stepDust(dt);
  stepCeremony(dt);
  chaseCam(dt, boosting);
  if (!finished && !startLock) {
    if (MODE.key === "free") {
      timeMs += dt * 1000;
      if (timeMs >= FREE_MS) {
        timeMs = FREE_MS;
        finished = true;
        playerWon = true;
        showFinish("TIME UP");
      }
    } else {
      timeMs += dt * 1000;
    }
  }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0 && elFailToast) elFailToast.classList.remove("show"); }
  hudBind();
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
