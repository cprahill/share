/* 20 original-form cabinets. Classic rules, our names. No ROMs. */
(function (w) {
  const CABS = [
    { id: "paddle", title: "Paddle Court", year: 1972, era: "1970s", genre: "Ball & paddle", hint: "Drag / d-pad · you are left · CPU right · 11 points" },
    { id: "bricks", title: "Brick Yard", year: 1976, era: "1970s", genre: "Breakout", hint: "Mouse or ← → · click / Space serve" },
    { id: "night", title: "Night Road", year: 1976, era: "1970s", genre: "Driving", hint: "← → steer · last as long as you can" },
    { id: "armor", title: "Armor Duel", year: 1974, era: "1970s", genre: "Tank", hint: "D-pad drive · A fire · CPU is amber" },
    { id: "rows", title: "Lunar Rows", year: 1978, era: "1980s", genre: "Fixed shooter", hint: "← → move · Space fire · bunkers" },
    { id: "rocks", title: "Drift Rocks", year: 1979, era: "1980s", genre: "Vector", hint: "← → rotate · up thrust · Space fire" },
    { id: "hopper", title: "Garden Hopper", year: 1981, era: "1980s", genre: "Cross the road", hint: "↑ hop · don't get hit" },
    { id: "bugs", title: "Bug Sweep", year: 1981, era: "1980s", genre: "Garden shooter", hint: "← → · Space spray" },
    { id: "manor", title: "Dot Manor", year: 1980, era: "1980s", genre: "Maze", hint: "arrows · eat dots · avoid the hunters" },
    { id: "swarm", title: "Sky Swarm", year: 1981, era: "1980s", genre: "Gallery shooter", hint: "← → · Space" },
    { id: "rig", title: "Barrel Rig", year: 1981, era: "1980s", genre: "Climb", hint: "← → · up ladder · Z jump" },
    { id: "grid", title: "Missile Grid", year: 1980, era: "1980s", genre: "Defense", hint: "click / tap to burst · save the cities" },
    { id: "stack", title: "Stack Well", year: 1985, era: "1980s", genre: "Falling blocks", hint: "← → · up rotate · down drop" },
    { id: "foam", title: "Foam Kid", year: 1986, era: "1980s", genre: "Platform bubble", hint: "← → · Z jump · Space foam" },
    { id: "stripe", title: "Stripe Run", year: 1991, era: "1990s", genre: "Speed platform", hint: "auto-run · Z jump" },
    { id: "ring", title: "Ring Fighter", year: 1991, era: "1990s", genre: "Versus", hint: "← → move · J punch · K kick · L block" },
    { id: "dual", title: "Twin Storm", year: 2005, era: "2000s", genre: "Twin-stick", hint: "WASD move · mouse aim · click fire" },
    { id: "beat", title: "Beat Tap", year: 2005, era: "2000s", genre: "Rhythm", hint: "D F J K · hit when the note lands" },
    { id: "volt", title: "Volt Dash", year: 2013, era: "2010s", genre: "Endless run", hint: "Space / tap jump" },
    { id: "hex", title: "Hex Pulse", year: 2015, era: "2010s", genre: "Survival", hint: "← → rotate · last through the pulse" }
  ];
  w.RETRO_CABS = CABS;

  function field(ctx, W, H, id, opt) {
    if (w.Look) w.Look.bg(ctx, W, H, id, opt);
    else { ctx.fillStyle = "#050308"; ctx.fillRect(0, 0, W, H); }
  }
  function pop(x, y, col, n) { if (w.Look) w.Look.burst(x, y, col, n); }
  function spark(x, y, col, n) { if (w.Look) w.Look.spark(x, y, col, n); }
  function glow(ctx, x, y, r, col) { if (w.Look) w.Look.glow(ctx, x, y, r, col); }
  function rr(ctx, x, y, ww, hh, r) {
    if (w.Look) w.Look.round(ctx, x, y, ww, hh, r);
    else ctx.fillRect(x, y, ww, hh);
  }

  function loop(cvs, tick, cab) {
    const ctx = cvs.getContext("2d");
    const keys = Object.create(null);
    const pointer = { x: 0, y: 0, down: false, click: false };
    let raf = 0, live = true, last = 0, W = 320, H = 240;
    const aliases = {
      ArrowLeft: ["KeyA"],
      ArrowRight: ["KeyD"],
      ArrowUp: ["KeyW"],
      ArrowDown: ["KeyS"],
      Space: ["KeyZ", "KeyF", "KeyJ"],
      KeyZ: ["Space"],
      KeyJ: ["KeyZ", "Space"],
      KeyK: ["KeyS"],
      KeyL: ["ShiftLeft"]
    };
    function setKey(code, on) {
      keys[code] = on;
      (aliases[code] || []).forEach((a) => { keys[a] = on; });
    }
    function resize() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const r = cvs.getBoundingClientRect();
      W = Math.max(160, r.width || innerWidth);
      H = Math.max(120, r.height || innerHeight * 0.55);
      cvs.width = W * dpr;
      cvs.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }
    const kd = (e) => {
      setKey(e.code, true);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    };
    const ku = (e) => { setKey(e.code, false); };
    function pos(e) {
      const r = cvs.getBoundingClientRect();
      const w = r.width || 1, h = r.height || 1;
      pointer.x = (e.clientX - r.left) * (W / w);
      pointer.y = (e.clientY - r.top) * (H / h);
    }
    const pd = (e) => {
      pos(e);
      pointer.down = true;
      pointer.click = true;
      try { cvs.setPointerCapture(e.pointerId); } catch (err) { /* */ }
      e.preventDefault();
    };
    const pm = (e) => { if (pointer.down || e.buttons) pos(e); };
    const pu = () => { pointer.down = false; };
    function holdBtn(el, on) {
      const code = el.getAttribute("data-k");
      if (!code) return;
      setKey(code, on);
      el.classList.toggle("on", on);
    }
    const pad = document.getElementById("pad");
    const btnDown = (e) => {
      const el = e.target.closest("[data-k]");
      if (!el) return;
      holdBtn(el, true);
      e.preventDefault();
    };
    const btnUp = (e) => {
      if (pad) pad.querySelectorAll("[data-k]").forEach((b) => holdBtn(b, false));
    };
    addEventListener("keydown", kd);
    addEventListener("keyup", ku);
    addEventListener("resize", resize);
    addEventListener("orientationchange", resize);
    cvs.addEventListener("pointerdown", pd, { passive: false });
    cvs.addEventListener("pointermove", pm, { passive: false });
    addEventListener("pointerup", pu);
    addEventListener("pointercancel", pu);
    if (pad) {
      pad.addEventListener("pointerdown", btnDown, { passive: false });
      pad.addEventListener("pointerup", btnUp);
      pad.addEventListener("pointercancel", btnUp);
      pad.addEventListener("pointerleave", btnUp);
    }
    document.body.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    resize();
    setTimeout(resize, 200);
    let started = false;
    function frame(t) {
      if (!live) return;
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      const Look = w.Look;
      ctx.save();
      if (Look && Look.shake > 0.4) {
        ctx.translate((Math.random() - 0.5) * Look.shake, (Math.random() - 0.5) * Look.shake);
      }
      if (!started) {
        field(ctx, W, H, cab && cab.id);
        if (Look) Look.gate(ctx, W, H, (cab && cab.title) || "RETRO", cab && cab.hint);
        if (Look) Look.crt(ctx, W, H);
        if (pointer.click || keys.Space || keys.KeyZ) {
          started = true;
          keys.Space = false;
          pointer.click = false;
        }
      } else {
        if (Look) Look.tick(dt);
        tick(ctx, dt, { keys, pointer, W, H });
        if (Look) { Look.drawParts(ctx); Look.crt(ctx, W, H); }
      }
      ctx.restore();
      pointer.click = false;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return {
      destroy() {
        live = false;
        cancelAnimationFrame(raf);
        removeEventListener("keydown", kd);
        removeEventListener("keyup", ku);
        removeEventListener("resize", resize);
        cvs.removeEventListener("pointerdown", pd);
        cvs.removeEventListener("pointermove", pm);
        removeEventListener("pointerup", pu);
        if (pad) pad.removeEventListener("pointerdown", btnDown);
      }
    };
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  const G = {};

  G.paddle = (api) => (ctx, dt, io) => {
    const { W, H, keys, pointer } = io;
    const st = G.paddle.s || (G.paddle.s = { l: 0.4, r: 0.4, x: 0.5, y: 0.5, vx: 0.35, vy: 0.28, ls: 0, rs: 0, dead: false });
    if (st.dead) return;
    const ph = H * 0.18, pw = 12;
    if (pointer.down) st.l = pointer.y / H - (ph / H) / 2;
    if (keys.ArrowUp || keys.KeyW) st.l -= dt * 0.9;
    if (keys.ArrowDown || keys.KeyS) st.l += dt * 0.9;
    st.l = Math.max(0, Math.min(1 - ph / H, st.l));
    const want = st.y - (ph / H) / 2;
    st.r += (want - st.r) * Math.min(1, dt * 5.5);
    st.x += st.vx * dt;
    st.y += st.vy * dt;
    if (st.y < 0.02 || st.y > 0.98) st.vy *= -1;
    const ly = st.l * H, ry = st.r * H;
    const bx = st.x * W, by = st.y * H;
    if (bx < 24 && by > ly && by < ly + ph) {
      st.vx = Math.abs(st.vx); api.sfx.hit && api.sfx.hit(); spark(bx, by, "#3df0c8", 8);
    }
    if (bx > W - 24 && by > ry && by < ry + ph) {
      st.vx = -Math.abs(st.vx); api.sfx.hit && api.sfx.hit(); spark(bx, by, "#f0c040", 8);
    }
    if (st.x < 0) { st.rs++; st.x = 0.5; st.vx = 0.35; api.sfx.die && api.sfx.die(); pop(16, by, "#f46", 16); }
    if (st.x > 1) { st.ls++; st.x = 0.5; st.vx = -0.35; api.sfx.die && api.sfx.die(); pop(W - 16, by, "#3df0c8", 16); }
    api.hud("YOU  " + st.ls + "   ·   CPU  " + st.rs);
    if (st.ls >= 11 || st.rs >= 11) {
      st.dead = true;
      api.over(st.ls >= 11 ? "YOU WIN" : "CPU WINS", st.ls + "–" + st.rs);
    }
    field(ctx, W, H, "paddle");
    ctx.fillStyle = "#3df0c888";
    for (let y = 8; y < H; y += 18) ctx.fillRect(W / 2 - 2, y, 4, 10);
    glow(ctx, 8 + pw / 2, ly + ph / 2, ph * 0.7, "rgba(61,240,200,0.35)");
    glow(ctx, W - 12, ry + ph / 2, ph * 0.7, "rgba(240,192,64,0.35)");
    ctx.fillStyle = "#3df0c8";
    rr(ctx, 8, ly, pw, ph, 4);
    ctx.fillStyle = "#f0c040";
    rr(ctx, W - 18, ry, pw, ph, 4);
    glow(ctx, bx, by, 16, "rgba(255,255,255,0.55)");
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, 7);
    ctx.fill();
  };

  G.bricks = (api) => (ctx, dt, io) => {
    const { W, H, keys, pointer } = io;
    const st = G.bricks.s || (G.bricks.s = null);
    const cols = 10, rows = 5;
    if (!G.bricks.s) {
      const bricks = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) bricks.push({ c, r, on: true });
      G.bricks.s = { bricks, px: 0.5, ball: null, score: 0, lives: 3, dead: false };
    }
    const s = G.bricks.s;
    if (s.dead) return;
    const pal = ["#ff4d6d", "#ff8a3d", "#f0d04a", "#3ee08a", "#4aa3ff"];
    const pw = Math.min(90, W * 0.18), ph = 12;
    if (pointer.down) s.px = pointer.x / W;
    if (keys.ArrowLeft || keys.KeyA) s.px -= dt * 1.2;
    if (keys.ArrowRight || keys.KeyD) s.px += dt * 1.2;
    s.px = Math.max(pw / 2 / W, Math.min(1 - pw / 2 / W, s.px));
    const px = s.px * W, py = H - 36;
    if (!s.ball) {
      if (pointer.click || keys.Space) {
        s.ball = { x: px, y: py - 10, vx: 180, vy: -240 };
        api.sfx.shoot && api.sfx.shoot();
      }
    } else {
      s.ball.x += s.ball.vx * dt;
      s.ball.y += s.ball.vy * dt;
      if (s.ball.x < 8 || s.ball.x > W - 8) s.ball.vx *= -1;
      if (s.ball.y < 56) s.ball.vy = Math.abs(s.ball.vy);
      if (s.ball.y > py - 6 && s.ball.y < py + ph && Math.abs(s.ball.x - px) < pw / 2) {
        s.ball.vy = -Math.abs(s.ball.vy);
        s.ball.vx += (s.ball.x - px) * 4;
      }
      const bw = (W - 24) / cols, bh = 16;
      for (const b of s.bricks) {
        if (!b.on) continue;
        const x = 12 + b.c * bw, y = 64 + b.r * (bh + 4);
        if (s.ball.x > x && s.ball.x < x + bw - 4 && s.ball.y > y && s.ball.y < y + bh) {
          b.on = false; s.score += (5 - b.r) * 10; s.ball.vy *= -1;
          api.sfx.brick && api.sfx.brick();
          pop(s.ball.x, s.ball.y, pal[b.r], 10);
        }
      }
      if (s.ball.y > H) {
        s.lives--; s.ball = null;
        api.sfx.die && api.sfx.die();
        if (s.lives <= 0) { s.dead = true; api.over("GAME OVER", "SCORE " + s.score); }
      }
      if (s.bricks.every((b) => !b.on)) { s.dead = true; api.over("CLEARED", "SCORE " + s.score); api.sfx.win && api.sfx.win(); }
    }
    api.hud(s.score + "   ·   " + "♥".repeat(Math.max(0, s.lives)));
    field(ctx, W, H, "bricks");
    const bw = (W - 24) / cols, bh = 16;
    for (const b of s.bricks) {
      if (!b.on) continue;
      const x = 12 + b.c * bw, y = 64 + b.r * (bh + 4);
      ctx.fillStyle = pal[b.r];
      rr(ctx, x, y, bw - 4, bh, 3);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(x, y, bw - 4, 3);
    }
    glow(ctx, px, py + ph / 2, 28, "rgba(244,234,216,0.3)");
    ctx.fillStyle = "#f4ead8";
    rr(ctx, px - pw / 2, py, pw, ph, 5);
    if (s.ball) {
      glow(ctx, s.ball.x, s.ball.y, 14, "rgba(255,255,255,0.5)");
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.ball.x, s.ball.y, 5, 0, 7);
      ctx.fill();
    }
  };

  G.night = (api) => (ctx, dt, io) => {
    const { W, H, keys, pointer } = io;
    const s = G.night.s || (G.night.s = { x: 0.5, t: 0, cars: [], dist: 0, dead: false, spawn: 0 });
    if (s.dead) return;
    if (keys.ArrowLeft || keys.KeyA || (pointer.down && pointer.x < W / 2)) s.x -= dt * 0.55;
    if (keys.ArrowRight || keys.KeyD || (pointer.down && pointer.x > W / 2)) s.x += dt * 0.55;
    s.x = Math.max(0.18, Math.min(0.82, s.x));
    s.t += dt;
    s.dist += dt * 40;
    s.spawn -= dt;
    if (s.spawn <= 0) {
      s.cars.push({ lane: Math.random() < 0.5 ? 0.35 : 0.65, z: 1, w: 0.08 });
      s.spawn = 0.7 + Math.random() * 0.5;
    }
    for (const c of s.cars) c.z -= dt * 0.55;
    s.cars = s.cars.filter((c) => c.z > 0);
    for (const c of s.cars) {
      if (c.z < 0.12 && Math.abs(c.lane - s.x) < 0.1) {
        s.dead = true;
        api.over("CRASH", Math.floor(s.dist) + " m");
        api.sfx.die && api.sfx.die();
        pop(s.x * W, H - 40, "#ff6a3d", 22);
      }
    }
    api.hud(Math.floor(s.dist) + " m");
    field(ctx, W, H, "night", { ox: (0.5 - s.x) * 40 });
    ctx.strokeStyle = "rgba(240,208,80,0.45)";
    ctx.setLineDash([14, 18]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2, H);
    ctx.lineTo(W / 2, H * 0.4);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const c of s.cars) {
      const y = H * 0.38 + (1 - c.z) * H * 0.62;
      const sc = 8 + (1 - c.z) * 40;
      const x = W * (0.5 + (c.lane - 0.5) * (0.2 + (1 - c.z) * 1.1));
      glow(ctx, x, y, sc, "rgba(255,60,40,0.35)");
      ctx.fillStyle = "#e24";
      rr(ctx, x - sc / 2, y - sc * 0.4, sc, sc * 0.55, 4);
      ctx.fillStyle = "#ffd080";
      ctx.fillRect(x - sc * 0.28, y - sc * 0.12, sc * 0.18, 3);
      ctx.fillRect(x + sc * 0.1, y - sc * 0.12, sc * 0.18, 3);
    }
    glow(ctx, s.x * W, H - 36, 36, "rgba(80,180,255,0.45)");
    ctx.fillStyle = "#6cf";
    rr(ctx, s.x * W - 16, H - 48, 32, 22, 5);
    ctx.fillStyle = "#dff";
    ctx.fillRect(s.x * W - 10, H - 42, 8, 6);
    ctx.fillRect(s.x * W + 2, H - 42, 8, 6);
  };

  G.armor = (api) => (ctx, dt, io) => {
    const { W, H, keys } = io;
    const s = G.armor.s || (G.armor.s = {
      a: { x: 0.2, y: 0.5, a: 0, cd: 0 },
      b: { x: 0.8, y: 0.5, a: 3.14, cd: 0 },
      shots: [], walls: [{ x: 0.45, y: 0.2, w: 0.1, h: 0.6 }],
      sa: 0, sb: 0, dead: false
    });
    if (s.dead) return;
    function drive(t, up, dn, lf, rt, fire) {
      if (lf) t.a -= dt * 3;
      if (rt) t.a += dt * 3;
      if (up) { t.x += Math.cos(t.a) * dt * 0.35; t.y += Math.sin(t.a) * dt * 0.35; }
      if (dn) { t.x -= Math.cos(t.a) * dt * 0.2; t.y -= Math.sin(t.a) * dt * 0.2; }
      t.x = Math.max(0.05, Math.min(0.95, t.x));
      t.y = Math.max(0.08, Math.min(0.92, t.y));
      t.cd -= dt;
      if (fire && t.cd <= 0) {
        t.cd = 0.45;
        s.shots.push({ x: t.x, y: t.y, a: t.a, who: t });
        api.sfx.shoot && api.sfx.shoot();
      }
    }
    drive(s.a, keys.KeyW || keys.ArrowUp, keys.KeyS || keys.ArrowDown, keys.KeyA || keys.ArrowLeft, keys.KeyD || keys.ArrowRight, keys.KeyF || keys.Space);
    const aim = Math.atan2(s.a.y - s.b.y, s.a.x - s.b.x);
    s.b.a += (aim - s.b.a) * dt * 3;
    drive(s.b, true, false, false, false, Math.random() < dt * 1.6);
    for (const sh of s.shots) {
      sh.x += Math.cos(sh.a) * dt * 0.9;
      sh.y += Math.sin(sh.a) * dt * 0.9;
    }
    s.shots = s.shots.filter((sh) => sh.x > 0 && sh.x < 1 && sh.y > 0 && sh.y < 1);
    function hit(t, other) {
      for (const sh of s.shots) {
        if (sh.who === t) continue;
        if (Math.hypot(sh.x - t.x, sh.y - t.y) < 0.04) {
          if (t === s.a) s.sb++; else s.sa++;
          pop(t.x * W, t.y * H, t === s.a ? "#6c6" : "#da4", 16);
          t.x = t === s.a ? 0.2 : 0.8;
          t.y = 0.5;
          api.sfx.die && api.sfx.die();
          sh.x = -1;
        }
      }
    }
    hit(s.a); hit(s.b);
    api.hud("YOU  " + s.sa + "   ·   CPU  " + s.sb);
    if (s.sa >= 5 || s.sb >= 5) { s.dead = true; api.over(s.sa >= 5 ? "GREEN WINS" : "AMBER WINS"); }
    field(ctx, W, H, "armor");
    ctx.fillStyle = "rgba(58,42,24,0.82)";
    for (const w of s.walls) rr(ctx, w.x * W, w.y * H, w.w * W, w.h * H, 4);
    function tank(t, col, glowCol) {
      glow(ctx, t.x * W, t.y * H, 28, glowCol);
      ctx.save();
      ctx.translate(t.x * W, t.y * H);
      ctx.rotate(t.a);
      ctx.fillStyle = col;
      rr(ctx, -12, -8, 24, 16, 3);
      ctx.fillRect(4, -3, 16, 6);
      ctx.fillStyle = "#fff8";
      ctx.fillRect(-8, -6, 10, 3);
      ctx.restore();
    }
    tank(s.a, "#5e8", "rgba(90,220,110,0.4)");
    tank(s.b, "#e94", "rgba(240,160,60,0.4)");
    for (const sh of s.shots) {
      glow(ctx, sh.x * W, sh.y * H, 10, "rgba(255,240,180,0.6)");
      ctx.fillStyle = "#fff";
      ctx.fillRect(sh.x * W - 2, sh.y * H - 2, 4, 4);
    }
  };

  G.rows = (api) => (ctx, dt, io) => {
    const { W, H, keys, pointer } = io;
    const s = G.rows.s || (G.rows.s = null);
    if (!G.rows.s) {
      const aliens = [];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) aliens.push({ c, r, on: true });
      G.rows.s = { aliens, px: 0.5, shots: [], eshots: [], dir: 1, t: 0, score: 0, lives: 3, dead: false, bunk: [0.2, 0.4, 0.6, 0.8].map((x) => ({ x, hp: 4 })) };
    }
    const st = G.rows.s;
    if (st.dead) return;
    if (keys.ArrowLeft || keys.KeyA || (pointer.down && pointer.x < W / 2)) st.px -= dt * 0.7;
    if (keys.ArrowRight || keys.KeyD || (pointer.down && pointer.x > W / 2)) st.px += dt * 0.7;
    st.px = Math.max(0.06, Math.min(0.94, st.px));
    if ((keys.Space || pointer.click) && st.shots.length < 1) {
      st.shots.push({ x: st.px, y: 0.88 });
      api.sfx.shoot && api.sfx.shoot();
    }
    st.t += dt;
    const step = 0.18;
    if (st.t > step) {
      st.t = 0;
      let edge = false;
      for (const a of st.aliens) if (a.on) {
        const x = 0.12 + a.c * 0.1;
        if (x + st.dir * 0.03 > 0.92 || x + st.dir * 0.03 < 0.08) edge = true;
      }
      if (edge) {
        st.dir *= -1;
        for (const a of st.aliens) a.r += 0.35;
      } else for (const a of st.aliens) a.c += st.dir * 0.28;
      if (Math.random() < 0.4) {
        const live = st.aliens.filter((a) => a.on);
        if (live.length) {
          const a = live[(Math.random() * live.length) | 0];
          st.eshots.push({ x: 0.12 + a.c * 0.1, y: 0.18 + a.r * 0.07 });
        }
      }
    }
    for (const sh of st.shots) sh.y -= dt * 1.1;
    for (const sh of st.eshots) sh.y += dt * 0.55;
    st.shots = st.shots.filter((sh) => sh.y > 0.1);
    st.eshots = st.eshots.filter((sh) => sh.y < 1);
    for (const a of st.aliens) {
      if (!a.on) continue;
      const ax = 0.12 + a.c * 0.1, ay = 0.18 + a.r * 0.07;
      for (const sh of st.shots) {
        if (Math.abs(sh.x - ax) < 0.04 && Math.abs(sh.y - ay) < 0.03) {
          a.on = false; sh.y = -1; st.score += 20; api.sfx.hit && api.sfx.hit();
          pop(ax * W, ay * H, "#5e8", 8);
        }
      }
    }
    for (const sh of st.eshots) {
      if (Math.abs(sh.x - st.px) < 0.04 && sh.y > 0.86) {
        st.lives--; sh.y = 2; api.sfx.die && api.sfx.die();
        if (st.lives <= 0) { st.dead = true; api.over("GAME OVER", "SCORE " + st.score); }
      }
    }
    if (st.aliens.every((a) => !a.on)) { st.dead = true; api.over("WAVE CLEAR", "SCORE " + st.score); api.sfx.win && api.sfx.win(); }
    api.hud(st.score + "   ·   " + "♥".repeat(Math.max(0, st.lives)));
    field(ctx, W, H, "rows");
    const palA = ["#5ef08a", "#c8f44a", "#4ad0ff", "#f08ad0", "#fff06a"];
    for (const a of st.aliens) {
      if (!a.on) continue;
      const ax = (0.12 + a.c * 0.1) * W, ay = (0.18 + a.r * 0.07) * H;
      ctx.fillStyle = palA[a.r | 0] || "#5e8";
      glow(ctx, ax, ay + 6, 16, "rgba(90,240,140,0.25)");
      rr(ctx, ax - 10, ay, 20, 12, 3);
      ctx.fillStyle = "#041";
      ctx.fillRect(ax - 5, ay + 3, 3, 3);
      ctx.fillRect(ax + 2, ay + 3, 3, 3);
    }
    ctx.fillStyle = "#3a6";
    for (const b of st.bunk) if (b.hp > 0) rr(ctx, b.x * W - 18, H * 0.78, 36, 14, 2);
    glow(ctx, st.px * W, H * 0.9, 22, "rgba(244,234,216,0.3)");
    ctx.fillStyle = "#f4ead8";
    rr(ctx, st.px * W - 14, H * 0.9, 28, 10, 3);
    ctx.fillStyle = "#fff";
    for (const sh of st.shots) ctx.fillRect(sh.x * W - 1, sh.y * H, 3, 10);
    ctx.fillStyle = "#ff6a6a";
    for (const sh of st.eshots) ctx.fillRect(sh.x * W - 1, sh.y * H, 3, 8);
  };

  G.rocks = (api) => (ctx, dt, io) => {
    const { W, H, keys } = io;
    const s = G.rocks.s || (G.rocks.s = {
      x: 0.5, y: 0.5, a: 0, vx: 0, vy: 0, shots: [],
      rocks: [0, 1, 2, 3].map(() => ({ x: Math.random(), y: Math.random(), r: 0.06, a: Math.random() * 6, v: 0.08 + Math.random() * 0.06 })),
      score: 0, dead: false, cd: 0
    });
    if (s.dead) return;
    if (keys.ArrowLeft || keys.KeyA) s.a -= dt * 4;
    if (keys.ArrowRight || keys.KeyD) s.a += dt * 4;
    if (keys.ArrowUp || keys.KeyW) { s.vx += Math.cos(s.a) * dt * 0.8; s.vy += Math.sin(s.a) * dt * 0.8; }
    s.cd -= dt;
    if ((keys.Space) && s.cd <= 0) {
      s.cd = 0.18;
      s.shots.push({ x: s.x, y: s.y, a: s.a, t: 0.8 });
      api.sfx.shoot && api.sfx.shoot();
    }
    s.x = (s.x + s.vx * dt + 1) % 1;
    s.y = (s.y + s.vy * dt + 1) % 1;
    s.vx *= 0.99; s.vy *= 0.99;
    for (const sh of s.shots) {
      sh.x = (sh.x + Math.cos(sh.a) * dt * 0.9 + 1) % 1;
      sh.y = (sh.y + Math.sin(sh.a) * dt * 0.9 + 1) % 1;
      sh.t -= dt;
    }
    s.shots = s.shots.filter((sh) => sh.t > 0);
    for (const r of s.rocks) {
      r.x = (r.x + Math.cos(r.a) * r.v * dt + 1) % 1;
      r.y = (r.y + Math.sin(r.a) * r.v * dt + 1) % 1;
      if (Math.hypot(r.x - s.x, r.y - s.y) < r.r + 0.015) {
        s.dead = true; api.over("DESTROYED", "SCORE " + s.score); api.sfx.die && api.sfx.die();
      }
      for (const sh of s.shots) {
        if (Math.hypot(r.x - sh.x, r.y - sh.y) < r.r) {
          s.score += 50; sh.t = 0; api.sfx.hit && api.sfx.hit();
          pop(r.x * W, r.y * H, "#cfe", 10);
          if (r.r > 0.03) {
            r.r *= 0.5;
            s.rocks.push({ x: r.x, y: r.y, r: r.r, a: r.a + 1, v: r.v + 0.04 });
          } else r.r = 0;
        }
      }
    }
    s.rocks = s.rocks.filter((r) => r.r > 0.01);
    if (!s.rocks.length) { s.dead = true; api.over("CLEAR", "SCORE " + s.score); api.sfx.win && api.sfx.win(); }
    api.hud(String(s.score));
    field(ctx, W, H, "rocks");
    ctx.strokeStyle = "#cfe";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#3df0c8";
    ctx.shadowBlur = 8;
    ctx.save();
    ctx.translate(s.x * W, s.y * H);
    ctx.rotate(s.a);
    glow(ctx, 0, 0, 22, "rgba(61,240,200,0.35)");
    ctx.beginPath();
    ctx.moveTo(12, 0); ctx.lineTo(-8, 8); ctx.lineTo(-4, 0); ctx.lineTo(-8, -8);
    ctx.closePath(); ctx.stroke();
    if (keys.ArrowUp || keys.KeyW) {
      ctx.strokeStyle = "#fa4";
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-16, 0); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = "#d8f0e8";
    for (const r of s.rocks) {
      ctx.beginPath();
      ctx.arc(r.x * W, r.y * H, r.r * W, 0, 7);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    for (const sh of s.shots) {
      glow(ctx, sh.x * W, sh.y * H, 8, "rgba(255,255,255,0.5)");
      ctx.fillRect(sh.x * W - 1, sh.y * H - 1, 3, 3);
    }
  };

  G.hopper = (api) => (ctx, dt, io) => {
    const { W, H, keys, pointer } = io;
    const s = G.hopper.s || (G.hopper.s = { y: 0, x: 0.5, cars: [], t: 0, dead: false, home: 0, cd: 0 });
    if (s.dead) return;
    s.cd -= dt;
    if ((keys.ArrowUp || keys.KeyW || pointer.click) && s.cd <= 0) {
      s.y++; s.cd = 0.18; api.sfx.jump && api.sfx.jump();
      if (s.y >= 8) { s.home++; s.y = 0; s.x = 0.5; api.sfx.win && api.sfx.win(); }
    }
    s.t += dt;
    if (s.t > 0.4) {
      s.t = 0;
      const lane = 1 + ((Math.random() * 6) | 0);
      s.cars.push({ lane, x: Math.random() < 0.5 ? -0.1 : 1.1, v: (Math.random() < 0.5 ? 1 : -1) * (0.15 + Math.random() * 0.15) });
    }
    for (const c of s.cars) c.x += c.v * dt;
    s.cars = s.cars.filter((c) => c.x > -0.2 && c.x < 1.2);
    const fy = s.y;
    for (const c of s.cars) {
      if (c.lane === fy && Math.abs(c.x - s.x) < 0.08) {
        s.dead = true; api.over("SPLAT", s.home + " home"); api.sfx.die && api.sfx.die();
        pop(s.x * W, 48 + fy * ((H - 48) / 9), "#6e6", 14);
      }
    }
    api.hud("HOME " + s.home);
    field(ctx, W, H, "hopper");
    const lh = (H - 48) / 9;
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i === 0 || i === 8 ? "rgba(30,80,50,0.45)" : (i % 2 ? "rgba(20,20,24,0.55)" : "rgba(40,40,44,0.4)");
      ctx.fillRect(0, 48 + i * lh, W, lh);
    }
    const carCol = ["#ff4d6d", "#ff8a3d", "#4aa3ff", "#f0d04a"];
    for (const c of s.cars) {
      const cx = c.x * W, cy = 48 + c.lane * lh + 6;
      ctx.fillStyle = carCol[c.lane % 4];
      rr(ctx, cx - 18, cy, 36, lh - 12, 4);
      ctx.fillStyle = "#dff8";
      ctx.fillRect(cx - 8, cy + 4, 10, 4);
    }
    glow(ctx, s.x * W, 48 + fy * lh + lh / 2, 18, "rgba(90,240,120,0.45)");
    ctx.fillStyle = "#6e6";
    rr(ctx, s.x * W - 10, 48 + fy * lh + 8, 20, lh - 16, 6);
    ctx.fillStyle = "#cfc";
    ctx.fillRect(s.x * W - 4, 48 + fy * lh + 12, 3, 3);
    ctx.fillRect(s.x * W + 2, 48 + fy * lh + 12, 3, 3);
  };

  G.bugs = (api) => (ctx, dt, io) => {
    const { W, H, keys, pointer } = io;
    const s = G.bugs.s || (G.bugs.s = {
      px: 0.5, segs: Array.from({ length: 12 }, (_, i) => ({ x: 0.2 + i * 0.05, y: 0.2 })),
      dir: 1, sh: null, mush: Array.from({ length: 18 }, () => ({ x: Math.random() * 0.8 + 0.1, y: Math.random() * 0.4 + 0.15, hp: 2 })),
      score: 0, dead: false
    });
    if (s.dead) return;
    if (keys.ArrowLeft || keys.KeyA || (pointer.down && pointer.x < W / 2)) s.px -= dt * 0.7;
    if (keys.ArrowRight || keys.KeyD || (pointer.down && pointer.x > W / 2)) s.px += dt * 0.7;
    s.px = Math.max(0.05, Math.min(0.95, s.px));
    if ((keys.Space || pointer.click) && !s.sh) { s.sh = { x: s.px, y: 0.88 }; api.sfx.shoot && api.sfx.shoot(); }
    if (s.sh) {
      s.sh.y -= dt * 1.2;
      if (s.sh.y < 0.1) s.sh = null;
    }
    const head = s.segs[0];
    head.x += s.dir * dt * 0.22;
    if (head.x > 0.95 || head.x < 0.05) { s.dir *= -1; for (const g of s.segs) g.y += 0.04; }
    for (let i = s.segs.length - 1; i > 0; i--) {
      s.segs[i].x += (s.segs[i - 1].x - s.segs[i].x) * 8 * dt;
      s.segs[i].y += (s.segs[i - 1].y - s.segs[i].y) * 8 * dt;
    }
    if (s.sh) {
      const hit = s.segs.findIndex((g) => Math.abs(g.x - s.sh.x) < 0.03 && Math.abs(g.y - s.sh.y) < 0.03);
      if (hit >= 0) {
        const g = s.segs[hit];
        pop(g.x * W, g.y * H, "#e44", 8);
        s.segs.splice(hit, 1); s.sh = null; s.score += 25; api.sfx.hit && api.sfx.hit();
      }
    }
    if (s.segs.some((g) => g.y > 0.82 && Math.abs(g.x - s.px) < 0.05) || !s.segs.length) {
      if (!s.segs.length) { s.dead = true; api.over("GARDEN CLEAR", "SCORE " + s.score); api.sfx.win && api.sfx.win(); }
      else if (s.segs.some((g) => g.y > 0.85)) { s.dead = true; api.over("INFESTED", "SCORE " + s.score); api.sfx.die && api.sfx.die(); }
    }
    api.hud(String(s.score));
    field(ctx, W, H, "bugs");
    for (const m of s.mush) {
      ctx.fillStyle = "#7a4";
      rr(ctx, m.x * W - 6, m.y * H - 6, 12, 12, 3);
      ctx.fillStyle = "#c66";
      ctx.beginPath(); ctx.arc(m.x * W, m.y * H - 4, 4, 0, 7); ctx.fill();
    }
    s.segs.forEach((g, i) => {
      glow(ctx, g.x * W, g.y * H, 14, "rgba(255,70,70,0.3)");
      ctx.fillStyle = i === 0 ? "#ff6a6a" : "#e44";
      ctx.beginPath(); ctx.arc(g.x * W, g.y * H, i === 0 ? 9 : 7, 0, 7); ctx.fill();
    });
    glow(ctx, s.px * W, H * 0.9, 20, "rgba(244,234,216,0.3)");
    ctx.fillStyle = "#f4ead8";
    rr(ctx, s.px * W - 12, H * 0.9, 24, 10, 3);
    if (s.sh) { ctx.fillStyle = "#fff"; ctx.fillRect(s.sh.x * W - 1, s.sh.y * H, 3, 10); }
  };

  G.manor = (api) => (ctx, dt, io) => {
    const { W, H, keys } = io;
    const map = [
      "#################",
      "#........#......#",
      "#.##.###.#.###.##",
      "#o#...........#o#",
      "#.###.#.###.#.###",
      "#.....#...#.....#",
      "#####.###.###.###",
      "#...............#",
      "#################"
    ];
    const s = G.manor.s || (G.manor.s = { x: 1, y: 1, gx: 8, gy: 7, dots: 0, score: 0, dead: false, t: 0, eaten: {} });
    if (s.dead) return;
    let vx = 0, vy = 0;
    if (keys.ArrowLeft || keys.KeyA) vx = -1;
    if (keys.ArrowRight || keys.KeyD) vx = 1;
    if (keys.ArrowUp || keys.KeyW) vy = -1;
    if (keys.ArrowDown || keys.KeyS) vy = 1;
    s.t += dt;
    if (s.t > 0.12) {
      s.t = 0;
      const nx = s.x + vx, ny = s.y + vy;
      if (map[ny] && map[ny][nx] !== "#") { s.x = nx; s.y = ny; }
      const cell = map[s.y][s.x] + ":" + s.x + "," + s.y;
      if ((map[s.y][s.x] === "." || map[s.y][s.x] === "o") && !s.eaten[cell]) {
        s.eaten[cell] = true; s.score += map[s.y][s.x] === "o" ? 50 : 10; s.dots++;
        api.sfx.tick && api.sfx.tick();
      }
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const d = dirs[(Math.random() * 4) | 0];
      const gx = s.gx + d[0], gy = s.gy + d[1];
      if (map[gy] && map[gy][gx] !== "#") { s.gx = gx; s.gy = gy; }
    }
    if (s.x === s.gx && s.y === s.gy) {
      s.dead = true; api.over("CAUGHT", "SCORE " + s.score); api.sfx.die && api.sfx.die();
      pop(s.x * (W / 17), 48 + s.y * ((H - 48) / 9), "#ff0", 16);
    }
    if (s.dots >= 50) { s.dead = true; api.over("MANOR CLEAR", "SCORE " + s.score); api.sfx.win && api.sfx.win(); }
    api.hud(String(s.score));
    const tw = W / 17, th = (H - 48) / 9;
    field(ctx, W, H, "manor");
    for (let y = 0; y < 9; y++) for (let x = 0; x < 17; x++) {
      const ch = map[y][x];
      if (ch === "#") {
        ctx.fillStyle = "rgba(50,90,200,0.72)";
        rr(ctx, x * tw, 48 + y * th, tw - 1, th - 1, 2);
      } else if (!s.eaten[ch + ":" + x + "," + y] && (ch === "." || ch === "o")) {
        glow(ctx, x * tw + tw / 2, 48 + y * th + th / 2, ch === "o" ? 10 : 5, "rgba(255,240,180,0.4)");
        ctx.fillStyle = "#ffe9a0";
        ctx.beginPath();
        ctx.arc(x * tw + tw / 2, 48 + y * th + th / 2, ch === "o" ? 5 : 2, 0, 7);
        ctx.fill();
      }
    }
    const px = s.x * tw + tw / 2, py = 48 + s.y * th + th / 2;
    glow(ctx, px, py, 16, "rgba(255,220,40,0.45)");
    ctx.fillStyle = "#ffd24a";
    ctx.beginPath();
    ctx.arc(px, py, tw * 0.35, 0.4, 5.8);
    ctx.lineTo(px, py);
    ctx.fill();
    const gx = s.gx * tw + tw / 2, gy = 48 + s.gy * th + th / 2;
    glow(ctx, gx, gy, 16, "rgba(255,60,140,0.4)");
    ctx.fillStyle = "#ff4d8a";
    ctx.beginPath();
    ctx.arc(gx, gy, tw * 0.35, Math.PI, 0);
    ctx.lineTo(gx + tw * 0.35, gy + tw * 0.28);
    ctx.lineTo(gx, gy + tw * 0.12);
    ctx.lineTo(gx - tw * 0.35, gy + tw * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(gx - 4, gy - 2, 3, 0, 7); ctx.arc(gx + 4, gy - 2, 3, 0, 7); ctx.fill();
    ctx.fillStyle = "#226";
    ctx.beginPath(); ctx.arc(gx - 4, gy - 2, 1.4, 0, 7); ctx.arc(gx + 4, gy - 2, 1.4, 0, 7); ctx.fill();
  };

  G.swarm = (api) => (ctx, dt, io) => {
    const { W, H, keys, pointer } = io;
    const s = G.swarm.s || (G.swarm.s = {
      px: 0.5, ships: [{ x: 0, y: 0.2, t: 0, dive: false }], shots: [], score: 0, lives: 3, dead: false, cd: 0
    });
    if (s.dead) return;
    if (keys.ArrowLeft || keys.KeyA || (pointer.down && pointer.x < W / 2)) s.px -= dt * 0.7;
    if (keys.ArrowRight || keys.KeyD || (pointer.down && pointer.x > W / 2)) s.px += dt * 0.7;
    s.px = Math.max(0.06, Math.min(0.94, s.px));
    s.cd -= dt;
    if ((keys.Space || pointer.click) && s.cd <= 0) {
      s.cd = 0.2; s.shots.push({ x: s.px, y: 0.88 }); api.sfx.shoot && api.sfx.shoot();
    }
    for (const e of s.ships) {
      e.t += dt;
      if (!e.dive && Math.random() < dt * 0.4) e.dive = true;
      if (e.dive) { e.y += dt * 0.35; e.x += Math.sin(e.t * 6) * dt * 0.2; }
      else e.x = 0.5 + Math.sin(e.t) * 0.3;
      if (e.y > 1) { e.y = 0.2; e.dive = false; }
    }
    for (const sh of s.shots) sh.y -= dt * 1.1;
    s.shots = s.shots.filter((sh) => sh.y > 0.1);
    for (const e of s.ships) {
      for (const sh of s.shots) {
        if (Math.abs(sh.x - e.x) < 0.04 && Math.abs(sh.y - e.y) < 0.04) {
          pop(e.x * W, e.y * H, "#fc4", 10);
          e.y = 0.15; e.dive = false; sh.y = -1; s.score += 80; api.sfx.hit && api.sfx.hit();
        }
      }
      if (Math.abs(e.x - s.px) < 0.05 && e.y > 0.85) {
        s.lives--; e.y = 0.2; e.dive = false; api.sfx.die && api.sfx.die();
        if (s.lives <= 0) { s.dead = true; api.over("GAME OVER", "SCORE " + s.score); }
      }
    }
    api.hud(s.score + "   ·   " + "♥".repeat(Math.max(0, s.lives)));
    field(ctx, W, H, "swarm");
    for (const e of s.ships) {
      const ex = e.x * W, ey = e.y * H;
      glow(ctx, ex, ey + 7, 18, "rgba(255,180,40,0.4)");
      ctx.fillStyle = "#fc4";
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + 14, ey + 16);
      ctx.lineTo(ex - 14, ey + 16);
      ctx.closePath();
      ctx.fill();
    }
    glow(ctx, s.px * W, H * 0.9, 22, "rgba(120,200,255,0.4)");
    ctx.fillStyle = "#8cf";
    ctx.beginPath();
    ctx.moveTo(s.px * W, H * 0.88);
    ctx.lineTo(s.px * W + 16, H * 0.96);
    ctx.lineTo(s.px * W - 16, H * 0.96);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    for (const sh of s.shots) ctx.fillRect(sh.x * W - 1, sh.y * H, 3, 10);
  };

  G.rig = (api) => (ctx, dt, io) => {
    const { W, H, keys } = io;
    const floors = [0.85, 0.65, 0.45, 0.25];
    const s = G.rig.s || (G.rig.s = { x: 0.1, fi: 0, vy: 0, barrels: [], t: 0, dead: false, score: 0 });
    if (s.dead) return;
    if (keys.ArrowLeft || keys.KeyA) s.x -= dt * 0.4;
    if (keys.ArrowRight || keys.KeyD) s.x += dt * 0.4;
    s.x = Math.max(0.05, Math.min(0.95, s.x));
    if ((keys.ArrowUp || keys.KeyW) && s.x > 0.88 && s.fi < 3) { s.fi++; s.x = 0.12; api.sfx.jump && api.sfx.jump(); }
    if ((keys.KeyZ || keys.Space) && s.vy === 0) s.vy = -0.9;
    s.vy += dt * 2.4;
    const y = floors[s.fi] + Math.min(0, s.vy * 0.08);
    if (s.vy > 0) s.vy = 0;
    s.t += dt;
    if (s.t > 1.1) { s.t = 0; s.barrels.push({ fi: 3, x: 0.2, v: 0.25 }); }
    for (const b of s.barrels) {
      b.x += b.v * dt;
      if (b.x > 0.95) { b.fi--; b.v *= -1; b.x = 0.94; }
      if (b.x < 0.05) { b.fi--; b.v *= -1; b.x = 0.06; }
    }
    s.barrels = s.barrels.filter((b) => b.fi >= 0);
    for (const b of s.barrels) {
      if (b.fi === s.fi && Math.abs(b.x - s.x) < 0.05 && s.vy === 0) {
        s.dead = true; api.over("FLATTENED", "SCORE " + s.score); api.sfx.die && api.sfx.die();
        pop(s.x * W, y * H, "#fa4", 16);
      }
    }
    if (s.fi === 3 && s.x < 0.2) { s.score += 100; s.fi = 0; s.x = 0.1; api.sfx.win && api.sfx.win(); }
    api.hud(String(s.score));
    field(ctx, W, H, "rig");
    ctx.fillStyle = "rgba(200,90,40,0.85)";
    for (const f of floors) rr(ctx, W * 0.06, f * H, W * 0.88, 8, 2);
    ctx.fillStyle = "#9ab";
    for (const f of floors) ctx.fillRect(W * 0.9, f * H - 40, 8, 40);
    glow(ctx, s.x * W, y * H - 11, 18, "rgba(255,180,60,0.4)");
    ctx.fillStyle = "#fa4";
    rr(ctx, s.x * W - 8, y * H - 22, 16, 22, 4);
    ctx.fillStyle = "#fff8";
    ctx.fillRect(s.x * W - 5, y * H - 16, 4, 3);
    for (const b of s.barrels) {
      const bx = b.x * W, by = floors[b.fi] * H - 8;
      glow(ctx, bx, by, 14, "rgba(220,60,30,0.35)");
      ctx.fillStyle = "#c40";
      ctx.beginPath(); ctx.arc(bx, by, 8, 0, 7); ctx.fill();
      ctx.strokeStyle = "#fa8";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, 7); ctx.stroke();
    }
  };

  G.grid = (api) => (ctx, dt, io) => {
    const { W, H, pointer } = io;
    const s = G.grid.s || (G.grid.s = {
      cities: [0.15, 0.35, 0.5, 0.65, 0.85].map((x) => ({ x, on: true })),
      missiles: [], bursts: [], t: 0, score: 0, dead: false
    });
    if (s.dead) return;
    s.t += dt;
    if (s.t > 0.9) {
      s.t = 0;
      s.missiles.push({ x: Math.random(), y: 0, tx: s.cities[(Math.random() * 5) | 0].x, v: 0.12 + Math.random() * 0.08 });
    }
    if (pointer.click) {
      s.bursts.push({ x: pointer.x / W, y: pointer.y / H, r: 0, life: 0.45 });
      api.sfx.shoot && api.sfx.shoot();
    }
    for (const m of s.missiles) {
      m.y += m.v * dt;
      m.x += (m.tx - m.x) * dt * 0.4;
    }
    for (const b of s.bursts) { b.r += dt * 0.25; b.life -= dt; }
    s.bursts = s.bursts.filter((b) => b.life > 0);
    for (const m of s.missiles) {
      for (const b of s.bursts) {
        if (Math.hypot(m.x - b.x, m.y - b.y) < b.r) {
          m.y = 2; s.score += 25; api.sfx.hit && api.sfx.hit();
          spark(m.x * W, m.y * H, "#ff8", 8);
        }
      }
      if (m.y > 0.9) {
        const c = s.cities.reduce((a, c) => Math.abs(c.x - m.x) < Math.abs(a.x - m.x) ? c : a);
        c.on = false; m.y = 2;
      }
    }
    s.missiles = s.missiles.filter((m) => m.y < 1.1);
    if (s.cities.every((c) => !c.on)) { s.dead = true; api.over("CITIES LOST", "SCORE " + s.score); api.sfx.die && api.sfx.die(); }
    api.hud(String(s.score));
    field(ctx, W, H, "grid");
    ctx.fillStyle = "rgba(20,40,70,0.55)";
    ctx.fillRect(0, H * 0.92, W, H * 0.08);
    for (const c of s.cities) if (c.on) {
      glow(ctx, c.x * W, H * 0.9, 20, "rgba(120,200,255,0.3)");
      ctx.fillStyle = "#8cf";
      rr(ctx, c.x * W - 12, H * 0.88, 24, 16, 2);
      ctx.fillRect(c.x * W - 6, H * 0.84, 6, 8);
    }
    ctx.strokeStyle = "#ff7a3a";
    ctx.lineWidth = 2;
    for (const m of s.missiles) {
      ctx.beginPath();
      ctx.moveTo(m.tx * W, 8);
      ctx.lineTo(m.x * W, m.y * H);
      ctx.stroke();
      glow(ctx, m.x * W, m.y * H, 8, "rgba(255,120,40,0.6)");
    }
    for (const b of s.bursts) {
      glow(ctx, b.x * W, b.y * H, b.r * W, "rgba(255,240,120,0.35)");
      ctx.strokeStyle = "#ffe080";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x * W, b.y * H, b.r * W, 0, 7);
      ctx.stroke();
    }
  };

  const PIECES = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]]
  };
  function rot(p) {
    const h = p.length, w = p[0].length, n = [];
    for (let x = 0; x < w; x++) { n[x] = []; for (let y = h - 1; y >= 0; y--) n[x].push(p[y][x]); }
    return n;
  }

  G.stack = (api) => (ctx, dt, io) => {
    const { W, H, keys } = io;
    const COLS = 10, ROWS = 18;
    const COLORS = ["#000", "#5ec8ff", "#f0d04a", "#c86bff", "#3ee08a", "#ff4d6d", "#4aa3ff", "#ff8a3d"];
    const s = G.stack.s || (G.stack.s = {
      grid: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
      p: PIECES.T, col: 1, x: 3, y: 0, t: 0, score: 0, dead: false, k: 0
    });
    if (s.dead) return;
    function collide(p, x, y) {
      for (let r = 0; r < p.length; r++) for (let c = 0; c < p[r].length; c++) {
        if (!p[r][c]) continue;
        const gx = x + c, gy = y + r;
        if (gx < 0 || gx >= COLS || gy >= ROWS || (gy >= 0 && s.grid[gy][gx])) return true;
      }
      return false;
    }
    function spawn() {
      const names = Object.keys(PIECES);
      const ni = (Math.random() * names.length) | 0;
      s.p = PIECES[names[ni]].map((r) => r.slice());
      s.col = 1 + ni;
      s.x = 3; s.y = 0;
      if (collide(s.p, s.x, s.y)) { s.dead = true; api.over("TOP OUT", "SCORE " + s.score); api.sfx.die && api.sfx.die(); }
    }
    s.k -= dt;
    if (s.k <= 0) {
      if (keys.ArrowLeft) { if (!collide(s.p, s.x - 1, s.y)) s.x--; s.k = 0.12; }
      if (keys.ArrowRight) { if (!collide(s.p, s.x + 1, s.y)) s.x++; s.k = 0.12; }
      if (keys.ArrowUp) { const n = rot(s.p); if (!collide(n, s.x, s.y)) s.p = n; s.k = 0.16; }
    }
    const grav = keys.ArrowDown ? 0.05 : 0.45;
    s.t += dt;
    if (s.t > grav) {
      s.t = 0;
      if (!collide(s.p, s.x, s.y + 1)) s.y++;
      else {
        for (let r = 0; r < s.p.length; r++) for (let c = 0; c < s.p[r].length; c++) {
          if (s.p[r][c] && s.y + r >= 0) s.grid[s.y + r][s.x + c] = s.col || 1;
        }
        for (let r = ROWS - 1; r >= 0; r--) {
          if (s.grid[r].every(Boolean)) {
            s.grid.splice(r, 1);
            s.grid.unshift(Array(COLS).fill(0));
            s.score += 100;
            r++;
            api.sfx.brick && api.sfx.brick();
            pop(W / 2, H * 0.45, "#fff", 14);
          }
        }
        spawn();
      }
    }
    api.hud(String(s.score));
    const cw = Math.min(24, (W - 40) / COLS), ch = Math.min(24, (H - 80) / ROWS);
    const ox = (W - cw * COLS) / 2, oy = 64;
    field(ctx, W, H, "stack");
    ctx.fillStyle = "rgba(8,8,16,0.72)";
    rr(ctx, ox - 6, oy - 6, cw * COLS + 12, ch * ROWS + 12, 6);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (s.grid[r][c]) {
      ctx.fillStyle = COLORS[s.grid[r][c]] || "#6cf";
      rr(ctx, ox + c * cw, oy + r * ch, cw - 2, ch - 2, 3);
    }
    ctx.fillStyle = COLORS[s.col] || "#fc4";
    for (let r = 0; r < s.p.length; r++) for (let c = 0; c < s.p[r].length; c++) if (s.p[r][c]) {
      rr(ctx, ox + (s.x + c) * cw, oy + (s.y + r) * ch, cw - 2, ch - 2, 3);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(ox + (s.x + c) * cw, oy + (s.y + r) * ch, cw - 2, 3);
      ctx.fillStyle = COLORS[s.col] || "#fc4";
    }
  };

  G.foam = (api) => (ctx, dt, io) => {
    const { W, H, keys } = io;
    const s = G.foam.s || (G.foam.s = { x: 0.2, y: 0.7, vy: 0, dir: 1, foams: [], foes: [{ x: 0.7, y: 0.7, v: -0.15 }], score: 0, dead: false });
    if (s.dead) return;
    if (keys.ArrowLeft || keys.KeyA) { s.x -= dt * 0.4; s.dir = -1; }
    if (keys.ArrowRight || keys.KeyD) { s.x += dt * 0.4; s.dir = 1; }
    if ((keys.KeyZ || keys.ArrowUp) && s.y >= 0.69) s.vy = -1.1;
    s.vy += dt * 2.5;
    s.y += s.vy * dt;
    if (s.y > 0.7) { s.y = 0.7; s.vy = 0; }
    if (keys.Space) {
      keys.Space = false;
      s.foams.push({ x: s.x + s.dir * 0.04, y: s.y, v: s.dir * 0.35, t: 2 });
      api.sfx.shoot && api.sfx.shoot();
    }
    for (const f of s.foams) { f.x += f.v * dt; f.t -= dt; }
    s.foams = s.foams.filter((f) => f.t > 0);
    for (const e of s.foes) {
      e.x += e.v * dt;
      if (e.x < 0.1 || e.x > 0.9) e.v *= -1;
      for (const f of s.foams) {
        if (Math.abs(f.x - e.x) < 0.05 && Math.abs(f.y - e.y) < 0.06) {
          e.x = 0.8; s.score += 100; f.t = 0; api.sfx.hit && api.sfx.hit();
          pop(e.x * W, e.y * H, "#adf", 10);
        }
      }
      if (Math.abs(e.x - s.x) < 0.04 && Math.abs(e.y - s.y) < 0.05) {
        s.dead = true; api.over("POPPED", "SCORE " + s.score); api.sfx.die && api.sfx.die();
      }
    }
    api.hud(String(s.score));
    field(ctx, W, H, "foam");
    ctx.fillStyle = "rgba(80,50,30,0.7)";
    ctx.fillRect(0, H * 0.78, W, H * 0.22);
    glow(ctx, s.x * W, s.y * H - 8, 22, "rgba(255,200,120,0.35)");
    ctx.fillStyle = "#fc8";
    rr(ctx, s.x * W - 10, s.y * H - 20, 20, 24, 6);
    for (const f of s.foams) {
      glow(ctx, f.x * W, f.y * H, 16, "rgba(160,220,255,0.4)");
      ctx.fillStyle = "rgba(170,220,255,0.75)";
      ctx.beginPath(); ctx.arc(f.x * W, f.y * H, 10, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff8";
      ctx.beginPath(); ctx.arc(f.x * W - 3, f.y * H - 3, 3, 0, 7); ctx.fill();
    }
    ctx.fillStyle = "#f46";
    for (const e of s.foes) rr(ctx, e.x * W - 10, e.y * H - 18, 20, 22, 5);
  };

  G.stripe = (api) => (ctx, dt, io) => {
    const { W, H, keys, pointer } = io;
    const s = G.stripe.s || (G.stripe.s = { x: 0, y: 0, vy: 0, gaps: [{ x: 400, w: 80 }], dist: 0, dead: false });
    if (s.dead) return;
    s.dist += dt * 220;
    if ((keys.Space || keys.KeyZ || pointer.down) && s.y === 0) s.vy = -520;
    s.vy += 1400 * dt;
    s.y += s.vy * dt;
    if (s.y > 0) { s.y = 0; s.vy = 0; }
    for (const g of s.gaps) g.x -= dt * 280;
    if (s.gaps[s.gaps.length - 1].x < W) s.gaps.push({ x: W + 200 + Math.random() * 160, w: 70 + Math.random() * 40 });
    s.gaps = s.gaps.filter((g) => g.x + g.w > -20);
    const px = 80, py = H * 0.7 + s.y;
    for (const g of s.gaps) {
      if (px > g.x && px < g.x + g.w && py >= H * 0.7 - 2) {
        s.dead = true; api.over("TRIP", Math.floor(s.dist) + " m"); api.sfx.die && api.sfx.die();
        pop(px, py, "#4cf", 14);
      }
    }
    api.hud(Math.floor(s.dist) + " m");
    field(ctx, W, H, "stripe");
    ctx.fillStyle = "rgba(40,160,70,0.55)";
    ctx.fillRect(0, H * 0.72, W, H);
    ctx.fillStyle = "#0a0610";
    for (const g of s.gaps) ctx.fillRect(g.x, H * 0.72, g.w, 16);
    glow(ctx, px, py - 14, 22, "rgba(80,200,255,0.4)");
    ctx.fillStyle = "#4cf";
    rr(ctx, px - 10, py - 28, 20, 28, 5);
    ctx.fillStyle = "#dff";
    ctx.fillRect(px - 5, py - 20, 4, 4);
  };

  G.ring = (api) => (ctx, dt, io) => {
    const { W, H, keys } = io;
    const s = G.ring.s || (G.ring.s = { x: 0.3, hp: 5, e: 0.7, eh: 5, cd: 0, atk: 0, dead: false });
    if (s.dead) return;
    if (keys.ArrowLeft || keys.KeyA) s.x -= dt * 0.4;
    if (keys.ArrowRight || keys.KeyD) s.x += dt * 0.4;
    s.x = Math.max(0.15, Math.min(0.55, s.x));
    s.cd -= dt; s.atk -= dt;
    if ((keys.KeyJ || keys.KeyZ) && s.cd <= 0) { s.cd = 0.35; s.atk = 0.15; }
    s.e += (s.x + 0.25 - s.e) * dt * 0.6;
    if (Math.random() < dt * 0.8) s.e -= 0.01;
    if (s.atk > 0 && Math.abs(s.x + 0.08 - s.e) < 0.08) {
      s.eh -= dt * 8; api.sfx.hit && api.sfx.hit();
      spark(s.e * W, H * 0.6, "#fff", 6);
    }
    if (Math.abs(s.e - s.x) < 0.06 && s.atk <= 0 && !keys.KeyL) s.hp -= dt * 2;
    if (s.eh <= 0) { s.dead = true; api.over("YOU WIN", "K.O."); api.sfx.win && api.sfx.win(); }
    if (s.hp <= 0) { s.dead = true; api.over("K.O.", "YOU LOSE"); api.sfx.die && api.sfx.die(); }
    api.hud("HP " + Math.ceil(s.hp) + "   ·   FOE " + Math.ceil(s.eh));
    field(ctx, W, H, "ring");
    ctx.fillStyle = "rgba(90,70,50,0.7)";
    ctx.fillRect(0, H * 0.7, W, H * 0.3);
    ctx.fillStyle = "rgba(10,8,12,0.55)";
    rr(ctx, W * 0.12, 16, W * 0.32, 12, 6);
    rr(ctx, W * 0.56, 16, W * 0.32, 12, 6);
    ctx.fillStyle = "#4af";
    ctx.fillRect(W * 0.12, 16, W * 0.32 * (s.hp / 5), 12);
    ctx.fillStyle = "#f44";
    ctx.fillRect(W * 0.56, 16, W * 0.32 * (s.eh / 5), 12);
    glow(ctx, s.x * W, H * 0.62, 30, "rgba(80,140,255,0.35)");
    ctx.fillStyle = "#48f";
    rr(ctx, s.x * W - 14, H * 0.55, 28, 70, 8);
    glow(ctx, s.e * W, H * 0.62, 30, "rgba(255,70,70,0.35)");
    ctx.fillStyle = "#f44";
    rr(ctx, s.e * W - 14, H * 0.55, 28, 70, 8);
    if (s.atk > 0) {
      ctx.fillStyle = "#fff";
      rr(ctx, s.x * W + 14, H * 0.6, 22, 8, 4);
    }
  };

  G.dual = (api) => (ctx, dt, io) => {
    const { W, H, keys, pointer } = io;
    const s = G.dual.s || (G.dual.s = { x: 0.5, y: 0.5, sh: [], en: [], t: 0, score: 0, dead: false, cd: 0 });
    if (s.dead) return;
    if (keys.KeyA || keys.ArrowLeft) s.x -= dt * 0.55;
    if (keys.KeyD || keys.ArrowRight) s.x += dt * 0.55;
    if (keys.KeyW || keys.ArrowUp) s.y -= dt * 0.55;
    if (keys.KeyS || keys.ArrowDown) s.y += dt * 0.55;
    s.x = Math.max(0.05, Math.min(0.95, s.x));
    s.y = Math.max(0.1, Math.min(0.9, s.y));
    s.cd -= dt;
    let ang = Math.atan2(pointer.y / H - s.y, pointer.x / W - s.x);
    if (!pointer.down && s.en[0]) ang = Math.atan2(s.en[0].y - s.y, s.en[0].x - s.x);
    if ((pointer.down || keys.Space) && s.cd <= 0) {
      s.cd = 0.08; s.sh.push({ x: s.x, y: s.y, a: ang }); api.sfx.shoot && api.sfx.shoot();
    }
    s.t += dt;
    if (s.t > 0.5) { s.t = 0; s.en.push({ x: Math.random(), y: Math.random() < 0.5 ? 0 : 1, a: Math.random() * 6 }); }
    for (const sh of s.sh) { sh.x += Math.cos(sh.a) * dt * 0.9; sh.y += Math.sin(sh.a) * dt * 0.9; }
    for (const e of s.en) { e.x += Math.cos(e.a) * dt * 0.15; e.y += Math.sin(e.a) * dt * 0.15; }
    s.sh = s.sh.filter((sh) => sh.x > 0 && sh.x < 1 && sh.y > 0 && sh.y < 1);
    for (const e of s.en) {
      for (const sh of s.sh) if (Math.hypot(e.x - sh.x, e.y - sh.y) < 0.03) {
        spark(e.x * W, e.y * H, "#f8f", 8); e.x = -1; s.score += 15;
      }
      if (Math.hypot(e.x - s.x, e.y - s.y) < 0.04) { s.dead = true; api.over("VOID", "SCORE " + s.score); api.sfx.die && api.sfx.die(); }
    }
    s.en = s.en.filter((e) => e.x >= 0);
    api.hud(String(s.score));
    field(ctx, W, H, "dual");
    glow(ctx, s.x * W, s.y * H, 22, "rgba(120,255,255,0.45)");
    ctx.fillStyle = "#8ff";
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H, 8, 0, 7); ctx.fill();
    for (const e of s.en) {
      glow(ctx, e.x * W, e.y * H, 16, "rgba(255,80,220,0.4)");
      ctx.fillStyle = "#f8f";
      ctx.beginPath(); ctx.arc(e.x * W, e.y * H, 7, 0, 7); ctx.fill();
    }
    ctx.fillStyle = "#fff";
    for (const sh of s.sh) {
      glow(ctx, sh.x * W, sh.y * H, 8, "rgba(255,255,255,0.5)");
      ctx.fillRect(sh.x * W - 1, sh.y * H - 1, 3, 3);
    }
  };

  G.beat = (api) => (ctx, dt, io) => {
    const { W, H, keys } = io;
    const lanes = ["KeyD", "KeyF", "KeyJ", "KeyK"];
    const col = ["#ff4d6d", "#4aa3ff", "#3ee08a", "#f0d04a"];
    const s = G.beat.s || (G.beat.s = { notes: [], t: 0, score: 0, miss: 0, dead: false, spawn: 0 });
    if (s.dead) return;
    s.spawn -= dt;
    if (s.spawn <= 0) {
      s.notes.push({ lane: (Math.random() * 4) | 0, y: 0 });
      s.spawn = 0.45;
    }
    for (const n of s.notes) n.y += dt * 0.55;
    const hitY = 0.82;
    for (let i = 0; i < 4; i++) {
      if (keys[lanes[i]]) {
        keys[lanes[i]] = false;
        const n = s.notes.find((n) => n.lane === i && Math.abs(n.y - hitY) < 0.08);
        if (n) {
          n.y = 2; s.score += 10; api.sfx.pickup && api.sfx.pickup();
          spark((i + 0.5) * (W / 4), hitY * H, col[i], 8);
        }
        else s.miss++;
      }
    }
    for (const n of s.notes) if (n.y > 0.95 && n.y < 1.5) { n.y = 2; s.miss++; }
    s.notes = s.notes.filter((n) => n.y < 1.5);
    if (s.miss >= 8) { s.dead = true; api.over("BREAK", "SCORE " + s.score); api.sfx.die && api.sfx.die(); }
    api.hud(s.score + "   ·   miss " + s.miss);
    field(ctx, W, H, "beat");
    const lw = W / 4;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    rr(ctx, 8, hitY * H - 8, W - 16, 16, 6);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = col[i];
      ctx.globalAlpha = 0.18;
      rr(ctx, i * lw + 6, 48, lw - 12, H - 56, 8);
      ctx.globalAlpha = 1;
    }
    for (const n of s.notes) {
      glow(ctx, n.lane * lw + lw / 2, n.y * H + 8, 18, col[n.lane] + "66");
      ctx.fillStyle = col[n.lane];
      rr(ctx, n.lane * lw + 10, n.y * H, lw - 20, 16, 6);
    }
  };

  G.volt = (api) => (ctx, dt, io) => {
    const { W, H, keys, pointer } = io;
    const s = G.volt.s || (G.volt.s = { y: 0, vy: 0, obs: [{ x: 500, h: 40 }], dist: 0, dead: false });
    if (s.dead) return;
    s.dist += dt * 200;
    if ((keys.Space || pointer.down) && s.y === 0) s.vy = -640;
    s.vy += 1800 * dt;
    s.y += s.vy * dt;
    if (s.y > 0) { s.y = 0; s.vy = 0; }
    for (const o of s.obs) o.x -= dt * 320;
    if (s.obs[s.obs.length - 1].x < W - 180) s.obs.push({ x: W + 40, h: 30 + Math.random() * 50 });
    s.obs = s.obs.filter((o) => o.x > -40);
    const px = 70, py = H * 0.72 + s.y;
    for (const o of s.obs) {
      if (px + 12 > o.x && px < o.x + 22 && py + 24 > H * 0.72 - o.h && py < H * 0.72) {
        s.dead = true; api.over("ZAPPED", Math.floor(s.dist) + " m"); api.sfx.die && api.sfx.die();
        pop(px, py, "#6ef", 16);
      }
    }
    api.hud(Math.floor(s.dist) + " m");
    field(ctx, W, H, "volt");
    ctx.fillStyle = "rgba(20,40,60,0.55)";
    ctx.fillRect(0, H * 0.72, W, H);
    for (const o of s.obs) {
      glow(ctx, o.x + 9, H * 0.72 - o.h / 2, 16, "rgba(255,220,60,0.35)");
      ctx.fillStyle = "#fd4";
      rr(ctx, o.x, H * 0.72 - o.h, 18, o.h, 3);
    }
    glow(ctx, px + 9, py - 12, 22, "rgba(80,240,255,0.45)");
    ctx.fillStyle = "#6ef";
    rr(ctx, px, py - 24, 18, 24, 5);
    ctx.fillStyle = "#dff";
    ctx.fillRect(px + 3, py - 18, 5, 4);
  };

  G.hex = (api) => (ctx, dt, io) => {
    const { W, H, keys, pointer } = io;
    const s = G.hex.s || (G.hex.s = { rot: 0, walls: [], t: 0, time: 0, dead: false, open: 0 });
    if (s.dead) return;
    if (keys.ArrowLeft || keys.KeyA || (pointer.down && pointer.x < W / 2)) s.rot -= dt * 4;
    if (keys.ArrowRight || keys.KeyD || (pointer.down && pointer.x > W / 2)) s.rot += dt * 4;
    s.t += dt; s.time += dt;
    if (s.t > 0.9) {
      s.t = 0;
      s.open = (Math.random() * 6) | 0;
      s.walls.push({ r: 1.1, open: s.open });
    }
    for (const w of s.walls) w.r -= dt * 0.35;
    s.walls = s.walls.filter((w) => w.r > 0.08);
    const slot = ((Math.round(s.rot / (Math.PI / 3)) % 6) + 6) % 6;
    for (const w of s.walls) {
      if (w.r < 0.18 && w.r > 0.1 && w.open !== slot) {
        s.dead = true; api.over("CRUSHED", s.time.toFixed(1) + "s"); api.sfx.die && api.sfx.die();
        pop(W / 2, H / 2, "#f46", 18);
      }
    }
    api.hud(s.time.toFixed(1) + "s");
    field(ctx, W, H, "hex");
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(s.rot);
    glow(ctx, 0, 0, 28, "rgba(70,255,230,0.4)");
    ctx.fillStyle = "#4fe";
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, 10);
    ctx.lineTo(-8, -10);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.shadowColor = "#ff4d8a";
    ctx.shadowBlur = 12;
    for (const w of s.walls) {
      for (let i = 0; i < 6; i++) {
        if (i === w.open) continue;
        const a0 = i * Math.PI / 3, a1 = a0 + Math.PI / 3;
        ctx.strokeStyle = w.r < 0.28 ? "#ff8ab0" : "#f46";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(0, 0, w.r * Math.min(W, H) * 0.42, a0, a1);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  w.bootCab = function (id, canvas, api) {
    Object.keys(G).forEach((k) => { if (G[k]) G[k].s = null; });
    const cab = CABS.find((c) => c.id === id) || CABS[0];
    const fn = G[id] || G.paddle;
    const tick = fn(api);
    return loop(canvas, tick, cab);
  };
})(window);
