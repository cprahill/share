/* Shared arcade look: painted playfields, CRT, juice. */
(function (w) {
  const SRC = {
    night: "art/bg-night.jpg",
    hopper: "art/bg-hopper.jpg",
    dual: "art/bg-dual.jpg",
    hex: "art/bg-hex.jpg",
    city: "art/bg-city.jpg",
    grid: "art/bg-grid.jpg",
    rig: "art/bg-rig.jpg",
    court: "art/bg-court.jpg",
    yard: "art/bg-yard.jpg",
    manor: "art/bg-manor.jpg",
    stars: "art/bg-stars.jpg"
  };
  const GAME_BG = {
    paddle: "court", bricks: "yard", night: "night", armor: "rig",
    rows: "stars", rocks: "stars", hopper: "hopper", bugs: "hopper",
    manor: "manor", swarm: "stars", rig: "rig", grid: "grid",
    stack: "hex", foam: "rig", stripe: "city", ring: "city",
    dual: "dual", beat: "city", volt: "city", hex: "hex"
  };
  const OVERLAY = {
    court: 0.58, yard: 0.64, night: 0.26, hopper: 0.42,
    rig: 0.5, dual: 0.4, hex: 0.38, city: 0.44, grid: 0.3,
    manor: 0.52, stars: 0.18
  };
  const imgs = {};
  Object.keys(SRC).forEach((k) => {
    const im = new Image();
    im.src = SRC[k];
    imgs[k] = im;
  });
  const parts = [];
  let shake = 0, flash = 0;

  function drawBg(ctx, W, H, key, opt) {
    opt = opt || {};
    const im = key && imgs[key];
    const ox = opt.ox || 0;
    const extra = Math.abs(ox) * 2 + 8;
    if (im && im.complete && im.naturalWidth) {
      ctx.drawImage(im, ox - extra / 2, 0, W + extra, H);
      const a = opt.overlay != null ? opt.overlay : (OVERLAY[key] != null ? OVERLAY[key] : 0.4);
      ctx.fillStyle = "rgba(4,2,8," + a + ")";
      ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#120818");
      g.addColorStop(1, "#050308");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }
  function bg(ctx, W, H, id, opt) {
    drawBg(ctx, W, H, GAME_BG[id] || "", opt);
  }
  function glow(ctx, x, y, r, col) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
  }
  function round(ctx, x, y, w, h, r) {
    r = Math.min(r || 4, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }
  function burst(x, y, col, n, hard) {
    n = n || 12;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = 50 + Math.random() * 160;
      parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        t: 0.28 + Math.random() * 0.32,
        col,
        r: 1.5 + Math.random() * 2.5
      });
    }
    if (hard !== false) {
      shake = Math.min(12, shake + 4);
      flash = 0.14;
    }
  }
  function spark(x, y, col, n) {
    burst(x, y, col, n || 7, false);
  }
  function tick(dt) {
    shake *= Math.pow(0.05, dt);
    flash = Math.max(0, flash - dt * 1.6);
    for (const p of parts) {
      p.t -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt;
    }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t <= 0) parts.splice(i, 1);
  }
  function drawParts(ctx) {
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.t * 3);
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r || 2, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function crt(ctx, W, H) {
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.12, W / 2, H / 2, Math.max(W, H) * 0.74);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(61,240,200,0.03)";
    ctx.fillRect(0, 0, W, H);
    if (flash > 0) {
      ctx.fillStyle = "rgba(255,255,255," + (flash * 0.4) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }
  function gate(ctx, W, H, title, hint) {
    ctx.fillStyle = "rgba(4,2,10,0.58)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#3df0c8";
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.fillText("INSERT COIN", W / 2, H * 0.34);
    ctx.fillStyle = "#f4ead8";
    ctx.font = "700 " + Math.max(22, Math.min(36, W / 14)) + "px Avenir Next, system-ui, sans-serif";
    ctx.fillText(title, W / 2, H * 0.46);
    ctx.fillStyle = "#c8b8a0";
    ctx.font = "14px Avenir Next, system-ui, sans-serif";
    ctx.fillText(hint || "tap / A to start", W / 2, H * 0.56);
    ctx.fillStyle = "#3df0c8";
    ctx.font = "700 13px ui-monospace, monospace";
    ctx.fillText("TAP  ·  A  ·  SPACE", W / 2, H * 0.68);
  }

  w.Look = {
    bg, drawBg, glow, round, burst, spark, tick, drawParts, crt, gate,
    GAME_BG, SRC, imgs,
    get shake() { return shake; }
  };
})(window);
