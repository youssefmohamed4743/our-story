/* ============================================================
   lib/canvas.js — shared canvas primitives.

   Most of this is lifted, near-verbatim, from the original
   four-act film's tree renderer (now in legacy/birthday.js).
   The bow and the blossom tree had no place in the new story,
   but this layer — pre-rendered sprites, drifting bokeh, warm
   dust, twinkles, DPR-aware sizing — was the best code in the
   project and it transfers wholesale.

   Everything here is dumb on purpose: it renders state it is
   handed. All timing and orchestration lives in film.js, so
   there is exactly one source of truth for "where are we".
   ============================================================ */

/* --- math ------------------------------------------------- */
export const rand    = (a, b) => a + Math.random() * (b - a);
export const pick    = (a)    => a[(Math.random() * a.length) | 0];
export const clamp   = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp    = (a, b, t) => a + (b - a) * t;

export const easeOutCubic   = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack    = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

/* quadratic bezier point — the old film used this for branches;
   here it traces the two paths in Act 2. */
export const quad = (b, t) => {
  const m = 1 - t, a = m * m, k = 2 * m * t, d = t * t;
  return { x: a * b.x1 + k * b.cx + d * b.x2, y: a * b.y1 + k * b.cy + d * b.y2 };
};

/* --- colour ----------------------------------------------- */
export function hexToRgb(hex){
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/* blend two hex colours — how the world warms from Act 1 to Act 3 */
export function mixHex(a, b, t){
  const A = hexToRgb(a), B = hexToRgb(b), k = clamp01(t);
  return `rgb(${Math.round(lerp(A[0], B[0], k))},${Math.round(lerp(A[1], B[1], k))},${Math.round(lerp(A[2], B[2], k))})`;
}

export const REDUCED_MOTION =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================
   SPRITES — drawn once into offscreen canvases, then blitted.
   Re-rendering these gradients every frame is what kills phone
   battery; caching them is the single biggest perf win here.
   ============================================================ */

export function makeBokehSprite(rgb){
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, `rgba(${rgb},0.9)`);
  g.addColorStop(0.45, `rgba(${rgb},0.22)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  return cv;
}

export function makeSparkleSprite(){
  const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d'), m = S / 2;
  const g = c.createRadialGradient(m, m, 0, m, m, m);
  // Warm ivory, never pure white — a #fff glint reads digital against
  // this palette, and every other light in the film is warm.
  g.addColorStop(0, 'rgba(248,242,230,0.95)');
  g.addColorStop(0.25, 'rgba(233,206,168,0.5)');
  g.addColorStop(1, 'rgba(233,206,168,0)');
  c.fillStyle = g; c.beginPath(); c.arc(m, m, m, 0, 6.2832); c.fill();
  c.fillStyle = 'rgba(248,242,230,0.95)';
  c.translate(m, m);
  for (let k = 0; k < 2; k++){
    c.beginPath();
    c.moveTo(0, -m);
    c.quadraticCurveTo(0, 0, m, 0); c.quadraticCurveTo(0, 0, 0, m);
    c.quadraticCurveTo(0, 0, -m, 0); c.quadraticCurveTo(0, 0, 0, -m);
    c.fill(); c.rotate(Math.PI / 4); c.scale(0.5, 0.5);
  }
  return cv;
}

/* a soft mote of dust — no shape, just falloff */
export function makeDustSprite(rgb){
  const S = 32, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(0.4, `rgba(${rgb},0.5)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  return cv;
}

/* ============================================================
   STAGE — a DPR-aware 2D canvas with a rAF loop that pauses
   itself when the tab is hidden or the stage scrolls away.
   ============================================================ */

export class Stage {
  constructor(el){
    this.el  = el;
    this.ctx = el.getContext('2d');
    this.W = 0; this.H = 0; this.dpr = 1;
    this.running = false;
    this._raf = 0;
    this._last = 0;
    this._onFrame = null;
    this._visible = true;

    this._resizeRAF = 0;
    this._onResize = () => {
      if (this._resizeRAF) return;
      this._resizeRAF = requestAnimationFrame(() => { this._resizeRAF = 0; this.resize(); });
    };
    addEventListener('resize', this._onResize);
    addEventListener('orientationchange', this._onResize);

    // Don't burn battery animating a tab nobody is looking at.
    document.addEventListener('visibilitychange', () => {
      this._visible = !document.hidden;
      if (this._visible && this.running){
        // Restart the chain cleanly: cancel anything still queued and
        // reset the clock, so returning to the tab doesn't teleport
        // every particle by however long she was away.
        if (this._raf) cancelAnimationFrame(this._raf);
        this._last = performance.now();
        this._raf = requestAnimationFrame((t) => this._tick(t));
      }
    });

    this.resize();
  }

  resize(){
    // Capping DPR at 2 costs nothing visible and saves a lot of fill
    // rate on phones that report 3 or 4.
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.W = this.el.clientWidth;
    this.H = this.el.clientHeight;
    this.el.width  = Math.round(this.W * this.dpr);
    this.el.height = Math.round(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.onResize && this.onResize(this.W, this.H);
  }

  clear(){ this.ctx.clearRect(0, 0, this.W, this.H); }

  /* blit a cached sprite, centred, optionally rotated */
  sprite(img, x, y, size, rot = 0, alpha = 1){
    if (alpha <= 0) return;
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    c.globalAlpha = alpha;
    c.drawImage(img, -size * 0.5, -size * 0.5, size, size);
    c.restore();
  }

  start(onFrame){
    this._onFrame = onFrame;
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame((t) => this._tick(t));
  }

  stop(){
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _tick(now){
    if (!this.running || !this._visible) return;
    // Clamp dt so a backgrounded tab returning doesn't teleport particles.
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now;
    this._onFrame && this._onFrame(dt, now / 1000);
    this._raf = requestAnimationFrame((t) => this._tick(t));
  }

  destroy(){
    this.stop();
    removeEventListener('resize', this._onResize);
    removeEventListener('orientationchange', this._onResize);
  }
}

/* ============================================================
   PARTICLE SYSTEMS
   Each builds against a viewport, updates on dt, draws at a
   given master alpha so the director can fade it in and out.
   Counts scale with viewport area — a phone renders far fewer
   particles than a desktop, which is the point.
   ============================================================ */

/* Big soft out-of-focus orbs drifting upward. Atmosphere, not detail. */
export class Bokeh {
  constructor(palette = ['221,166,160', '201,166,107', '244,235,221']){
    this.sprites = palette.map(makeBokehSprite);
    this.items = [];
  }
  build(W, H){
    const n = Math.round(clamp((W * H) / 42000, 6, 22));
    this.items = Array.from({ length: n }, () => ({
      x: rand(0, W), y: rand(0, H),
      r: rand(Math.min(W, H) * 0.04, Math.min(W, H) * 0.13),
      vy: rand(4, 16), drift: rand(0.1, 0.5), phase: rand(0, 6.28),
      alpha: rand(0.05, 0.2),
      sprite: pick(this.sprites),
    }));
  }
  update(dt, t, W, H){
    for (const o of this.items){
      o.y -= o.vy * dt;
      o.x += Math.sin(t * 0.3 + o.phase) * o.drift;
      if (o.y < -o.r){ o.y = H + o.r; o.x = rand(0, W); }
    }
  }
  draw(stage, alpha = 1){
    if (alpha <= 0) return;
    const c = stage.ctx;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const o of this.items){
      c.globalAlpha = o.alpha * alpha;
      c.drawImage(o.sprite, o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
    }
    c.restore();
  }
}

/* Fine warm dust hanging in a light beam. The thing that makes the
   frame feel like air rather than a flat colour. */
export class Dust {
  constructor(rgb = '236,222,203'){
    this.sprite = makeDustSprite(rgb);
    this.items = [];
  }
  build(W, H){
    const n = Math.round(clamp((W * H) / 9000, 24, 90));
    this.items = Array.from({ length: n }, () => ({
      x: rand(0, W), y: rand(0, H),
      size: rand(1.5, 5),
      vy: rand(3, 14), sway: rand(3, 14), phase: rand(0, 6.28),
      alpha: rand(0.2, 0.8),
      twinkle: rand(0.4, 1.4),
    }));
  }
  update(dt, t, W, H){
    for (const d of this.items){
      d.y -= d.vy * dt;
      d.x += Math.sin(t * 0.4 + d.phase) * d.sway * dt;
      if (d.y < -6){ d.y = H + 6; d.x = rand(0, W); }
      else if (d.x < -6) d.x = W + 6;
      else if (d.x > W + 6) d.x = -6;
    }
  }
  draw(stage, alpha = 1){
    if (alpha <= 0) return;
    const c = stage.ctx;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const d of this.items){
      const flicker = 0.65 + 0.35 * Math.sin(performance.now() * 0.001 * d.twinkle + d.phase);
      stage.sprite(this.sprite, d.x, d.y, d.size * 4, 0, d.alpha * flicker * alpha);
    }
    c.restore();
  }
}

/* Short-lived star glints. Spawned by the director at moments that
   deserve one — never continuously. */
export class Twinkles {
  constructor(){
    this.sprite = makeSparkleSprite();
    this.items = [];
  }
  spawn(x, y, size){
    if (this.items.length > 14) return;
    this.items.push({ x, y, size, age: 0, life: rand(0.7, 1.3), rot: rand(0, 6.28) });
  }
  update(dt){
    for (let i = this.items.length - 1; i >= 0; i--){
      const s = this.items[i];
      s.age += dt;
      if (s.age >= s.life) this.items.splice(i, 1);
    }
  }
  draw(stage, alpha = 1){
    if (alpha <= 0 || !this.items.length) return;
    const c = stage.ctx;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const s of this.items){
      const k = s.age / s.life;
      const a = Math.sin(k * Math.PI);
      stage.sprite(this.sprite, s.x, s.y, s.size * (0.6 + 0.4 * a), s.rot + k * 1.2, a * alpha);
    }
    c.restore();
  }
  clear(){ this.items.length = 0; }
}
