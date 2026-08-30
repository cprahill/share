/* Shared arcade kit: HOLD, beeps, honest fail. Idle cannot win. */
(function (w) {
  const AudioCtx = w.AudioContext || w.webkitAudioContext;
  let ctx;

  function audio() {
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function beep(freq, dur, type, gain) {
    try {
      const a = audio();
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type || "square";
      o.frequency.value = freq;
      g.gain.value = gain == null ? 0.05 : gain;
      o.connect(g);
      g.connect(a.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + (dur || 0.08));
      o.stop(a.currentTime + (dur || 0.08) + 0.02);
    } catch (e) {
      /* no audio */
    }
  }

  const sfx = {
    shoot: () => beep(880, 0.05, "square", 0.04),
    hit: () => beep(220, 0.09, "sawtooth", 0.06),
    die: () => {
      beep(160, 0.28, "sawtooth", 0.07);
      setTimeout(() => beep(90, 0.35, "triangle", 0.06), 80);
    },
    win: () => {
      beep(523, 0.12, "triangle", 0.05);
      setTimeout(() => beep(659, 0.12, "triangle", 0.05), 110);
      setTimeout(() => beep(784, 0.22, "triangle", 0.05), 220);
    },
    pickup: () => beep(740, 0.08, "sine", 0.05),
    tick: () => beep(440, 0.03, "square", 0.02),
    jump: () => beep(620, 0.07, "square", 0.04),
    slide: () => beep(190, 0.07, "sawtooth", 0.03),
    brick: () => beep(880, 0.04, "triangle", 0.04),
    charge: () => beep(320, 0.12, "sine", 0.05),
  };

  function hold({ onGo } = {}) {
    /* HOLD was a miss. Start immediately. */
    if (onGo) onGo();
  }

  function loadKeyed(url, done) {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height);
      const p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        const r = p[i], g = p[i + 1], b = p[i + 2];
        if (r > 160 && b > 120 && g < 140 && r > g + 40 && b > g + 20) p[i + 3] = 0;
      }
      x.putImageData(d, 0, 0);
      done(c);
    };
    img.src = url;
  }
  function blit(ctx, spr, x, y, s, rot) {
    if (!spr) return false;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(spr, -s / 2, -s / 2, s, s);
    ctx.restore();
    return true;
  }

  w.RetroKit = { beep, sfx, hold, audio, loadKeyed, blit };
})(window);
