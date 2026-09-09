/* ============================================================
   film.js — the five-act opening film.

     1  BEFORE YOU     a single light in a warm dark
     2  TWO PATHS      two lives, wandering, that meet once
     3  THE MEMORIES   the ordinary days that started to matter
     4  THE LETTER     a few lines, in his hand
     5  THE PAYOFF     the wish — then a deliberate silence

   ARCHITECTURE — the one thing to understand before editing:

     A single PAUSED GSAP timeline is the only source of truth.
     It animates DOM elements *and* a plain state object `S`.
     A separate rAF loop renders the canvas from `S` and never
     decides anything.

     That split is what makes Skip safe. `master.progress(1)`
     replays every tween and set to its end value, so skipping
     lands on a state byte-identical to watching it through.
     There is no second code path to keep in sync.

   All words and photos come from content.js. Nothing personal
   is written here.
   ============================================================ */

import gsap from 'gsap';
import {
  Stage, Bokeh, Dust, Twinkles,
  rand, clamp, clamp01, lerp, mixHex, quad, REDUCED_MOTION,
} from './lib/canvas.js';

/* ------------------------------------------------------------
   PACE — one dial for the whole film.
   1.00 ≈ 50s  ·  0.80 ≈ 40s  ·  0.65 ≈ 33s
   Watch it once on your phone, then tune this single number.
   ------------------------------------------------------------ */
const PACE = 1;
const T = (s) => s * PACE;

/* where the two paths meet, in viewport fractions */
const MEET = { x: 0.5, y: 0.44 };

/* Two lives: asymmetric on purpose. They wander, nearly touch
   (segment 2), drift apart again (segment 3), then converge.
   Coordinates are fractions of the viewport; scaled on resize. */
const PATH_A = [
  { x1: -0.10, y1: 0.08, cx:  0.10, cy: 0.00, x2: 0.30, y2: 0.20 },
  { x1:  0.30, y1: 0.20, cx:  0.47, cy: 0.31, x2: 0.38, y2: 0.42 },
  { x1:  0.38, y1: 0.42, cx:  0.24, cy: 0.55, x2: 0.33, y2: 0.68 },
  { x1:  0.33, y1: 0.68, cx:  0.42, cy: 0.63, x2: MEET.x, y2: MEET.y },
];
const PATH_B = [
  { x1:  1.10, y1: 0.94, cx:  0.92, cy: 1.02, x2: 0.72, y2: 0.80 },
  { x1:  0.72, y1: 0.80, cx:  0.57, cy: 0.63, x2: 0.61, y2: 0.52 },
  { x1:  0.61, y1: 0.52, cx:  0.78, cy: 0.43, x2: 0.67, y2: 0.31 },
  { x1:  0.67, y1: 0.31, cx:  0.57, cy: 0.35, x2: MEET.x, y2: MEET.y },
];
/* after they meet, one line continues */
const PATH_ONE = [
  { x1: MEET.x, y1: MEET.y, cx: 0.54, cy: 0.26, x2: 0.47, y2: 0.06 },
  { x1: 0.47,   y1: 0.06,   cx: 0.44, cy: -0.06, x2: 0.49, y2: -0.18 },
];

/* ------------------------------------------------------------
   helpers
   ------------------------------------------------------------ */
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* Split into per-glyph spans so each can hinge up on its own.
   Carried over from the original film's kinetic headline.

   Two things this has to get right, both learned the hard way:

   1. WRAPPING. Glyphs are inline-block, and an inline-block cannot
      break mid-word — so words are grouped and the spaces between
      them stay real text nodes. Substituting &nbsp; (the obvious
      shortcut) makes the whole sentence one unbreakable run, which
      overflows a 390px phone horizontally.

   2. READING. A screen reader handed 43 separate one-letter spans
      may well spell the sentence out. So the paragraph carries the
      real text as its aria-label and the glyph soup is hidden. */
function splitChars(node){
  const text = node.textContent;
  node.textContent = '';
  node.setAttribute('aria-label', text);

  const chars = [];
  const words = text.split(' ');
  words.forEach((word, i) => {
    const w = el('span', 'word');
    w.setAttribute('aria-hidden', 'true');
    for (const c of word){
      const s = el('span', 'ch', c);
      w.append(s);
      chars.push(s);
    }
    node.append(w);
    if (i < words.length - 1) node.append(document.createTextNode(' '));
  });
  return chars;
}

/* 'YYYY-MM-DD' → 'April 12, 2023'.
   Parsed by hand: new Date('2023-04-12') is UTC midnight, which
   renders as the 11th for anyone west of Greenwich. */
function formatDate(iso){
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return String(iso);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

/* Sample a chain of quadratic segments into a flat point list, so
   tracing is just "draw the first N points". */
function samplePath(segs, W, H, per = 64){
  const pts = [];
  for (const s of segs){
    const abs = { x1: s.x1 * W, y1: s.y1 * H, cx: s.cx * W, cy: s.cy * H, x2: s.x2 * W, y2: s.y2 * H };
    for (let i = 0; i <= per; i++) pts.push(quad(abs, i / per));
  }
  return pts;
}

/* ============================================================
   createFilm
   ============================================================ */
export function createFilm({ content, root, actsRoot, canvas, onEnd, onFirstFrame }){
  const C = content;

  /* --- canvas state. The timeline writes it; the loop reads it. --- */
  const S = {
    warmth: 0,      // 0 = warm dark  →  1 = cream daylight
    glow: 0,        // the central light
    glowSpread: 1,  // how wide that light throws
    bokeh: 0,       // big soft orbs
    dust: 0,        // fine airborne dust
    pathP: 0,       // 0→1 tracing of the two paths
    pathAlpha: 0,
    oneP: 0,        // the single line after they meet
    meetFlash: 0,   // the bloom at the intersection
    split: 0,       // 0 = one light, 1 = two lights apart
  };

  const stage = new Stage(canvas);
  // Rose, champagne and ivory motes drifting through navy air — the
  // same discipline the CSS keeps: the dark is blue, every light in
  // front of it is warm.
  const bokeh = new Bokeh(['221,166,160', '201,166,107', '244,235,221']);
  const dust  = new Dust('236,222,203');
  const twinkles = new Twinkles();

  let ptsA = [], ptsB = [], ptsOne = [];

  stage.onResize = (W, H) => {
    bokeh.build(W, H);
    dust.build(W, H);
    ptsA   = samplePath(PATH_A, W, H);
    ptsB   = samplePath(PATH_B, W, H);
    ptsOne = samplePath(PATH_ONE, W, H);
  };
  stage.onResize(stage.W, stage.H);

  /* ------------------------------------------------------------
     RENDER — pure. Draws S, decides nothing.
     ------------------------------------------------------------ */
  // Both gradients below are rebuilt only when the values that shape
  // them actually change. GSAP holds S steady between tweens for most
  // of the film's runtime, so this turns "rebuild every frame for 50s"
  // into "rebuild only during the few seconds a transition is live" —
  // the gradient sprites are already cached this way (see lib/canvas.js);
  // these two just couldn't be pre-rendered since their colours move.
  let bgKey = null, bgGradient = null;
  function drawBackground(){
    const { ctx, W, H } = stage;
    const w = S.warmth;
    const key = `${w.toFixed(4)}|${W}|${H}`;
    if (key !== bgKey){
      bgKey = key;
      // Deep navy → a warm dusty rose light. The dark is blue and every
      // light in front of it is warm, which is what keeps this cinematic
      // rather than cold. Never true black: at its darkest the ground is
      // still navy, and that is what makes Act 1 nostalgic, not bleak.
      const inner = mixHex('#0d1424', '#c2917f', w);
      const outer = mixHex('#03060e', '#43293a', w * 0.82);
      bgGradient = ctx.createRadialGradient(
        W * MEET.x, H * MEET.y, 0,
        W * MEET.x, H * MEET.y, Math.hypot(W, H) * 0.68,
      );
      bgGradient.addColorStop(0, inner);
      bgGradient.addColorStop(1, outer);
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, W, H);
  }

  let glowKey = null, glowGradients = null;
  function drawGlow(){
    if (S.glow <= 0.001) return;
    const { ctx, W, H } = stage;
    const r = Math.min(W, H) * 0.42 * S.glowSpread;
    const cx = W * MEET.x, cy = H * MEET.y;

    // Act 1 shows one light; Act 2 pulls it into two before they travel.
    const offs = S.split > 0
      ? [[-W * 0.19 * S.split, -H * 0.13 * S.split], [W * 0.19 * S.split, H * 0.13 * S.split]]
      : [[0, 0]];

    const key = `${S.glow.toFixed(4)}|${S.glowSpread.toFixed(4)}|${S.split.toFixed(4)}|${W}|${H}`;
    if (key !== glowKey){
      glowKey = key;
      glowGradients = offs.map(([ox, oy]) => {
        const g = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
        // Ivory core → champagne → rose falloff. Three warm steps, so the
        // light reads as candlelight rather than a spotlight.
        g.addColorStop(0,   `rgba(244,235,221,${0.55 * S.glow})`);
        g.addColorStop(0.18,`rgba(201,166,107,${0.28 * S.glow})`);
        g.addColorStop(0.55,`rgba(201,130,134,${0.16 * S.glow})`);
        g.addColorStop(1,   'rgba(201,130,134,0)');
        return g;
      });
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    offs.forEach(([ox, oy], i) => {
      ctx.fillStyle = glowGradients[i];
      ctx.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2);
    });
    ctx.restore();
  }

  /* Trace `pts` up to progress p, with a bright head. */
  function tracePath(pts, p, alpha, colour){
    if (!pts.length || p <= 0 || alpha <= 0) return null;
    const { ctx, W, H } = stage;
    const last = Math.max(1, Math.floor(p * (pts.length - 1)));
    const scale = Math.min(W, H);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // the settled line — quiet, it stays behind as history
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= last; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = `rgba(${colour},${0.30 * alpha})`;
    ctx.lineWidth = Math.max(1, scale * 0.0018);
    ctx.stroke();

    // the live head — brighter for the most recent stretch
    const tailStart = Math.max(0, last - 34);
    ctx.beginPath();
    ctx.moveTo(pts[tailStart].x, pts[tailStart].y);
    for (let i = tailStart + 1; i <= last; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = `rgba(${colour},${0.85 * alpha})`;
    ctx.lineWidth = Math.max(1.4, scale * 0.0032);
    ctx.stroke();
    ctx.restore();

    const head = pts[last];
    if (p < 1) stage.sprite(twinkles.sprite, head.x, head.y, scale * 0.055, 0, alpha);
    return head;
  }

  function drawPaths(){
    if (S.pathAlpha <= 0.001) return;
    // Two different colours of light, because they are two different
    // people. They leave as one line, brighter than either was alone.
    tracePath(ptsA, S.pathP, S.pathAlpha, '214,178,120');   // champagne
    tracePath(ptsB, S.pathP, S.pathAlpha, '221,166,160');   // rose
    if (S.oneP > 0) tracePath(ptsOne, S.oneP, S.pathAlpha, '244,235,221');
  }

  function drawMeetFlash(){
    if (S.meetFlash <= 0.001) return;
    const { ctx, W, H } = stage;
    const cx = W * MEET.x, cy = H * MEET.y;
    const r = Math.min(W, H) * (0.10 + 0.5 * (1 - S.meetFlash));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(248,242,230,${0.9 * S.meetFlash})`);
    g.addColorStop(0.3, `rgba(201,166,107,${0.5 * S.meetFlash})`);
    g.addColorStop(1, 'rgba(201,166,107,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  let firstFrameDone = false;
  function frame(dt, t){
    stage.clear();
    drawBackground();
    bokeh.update(dt, t, stage.W, stage.H);
    bokeh.draw(stage, S.bokeh);
    drawGlow();
    drawPaths();
    drawMeetFlash();
    dust.update(dt, t, stage.W, stage.H);
    dust.draw(stage, S.dust);
    twinkles.update(dt);
    twinkles.draw(stage, 1);

    if (!firstFrameDone){ firstFrameDone = true; onFirstFrame && onFirstFrame(); }
  }

  /* Paint one static frame — used for reduced motion and for the
     moment before the loop starts, so there is never a black flash. */
  function drawStill(){ frame(0, 0); }

  /* ============================================================
     BUILD THE ACTS from content.js
     ============================================================ */
  const F = C.film || {};

  /* --- Act 1 --- */
  const a1 = el('div', 'act a1');
  const a1lines = el('div', 'a1__lines');
  const a1a = el('p', 'f-line', F.opening || 'Before you…');
  const a1b = el('p', 'f-line f-line--soft', F.ordinary || '…there was just another ordinary day.');
  a1lines.append(a1a, a1b);
  a1.append(a1lines);

  /* --- Act 2 --- */
  const a2 = el('div', 'act a2');
  const a2stack = el('div', 'act__stack');
  const a2label = el('p', 'a2__label', F.meetingLabel || 'Then, one day —');
  const a2date  = el('p', 'a2__date', formatDate(C.dates && C.dates.together));
  const a2rule  = el('span', 'a2__rule');
  const a2title = el('p', 'f-line f-line--script', F.meetingTitle || 'the day our paths crossed.');
  a2stack.append(a2label, a2date, a2rule, a2title);
  a2.append(a2stack);

  /* --- Act 3 — up to four photos.
         `film.shots` in content.js gives the film its OWN pictures,
         so nothing she sees here turns up again in Our Story. Two
         fallbacks keep the act from ever being empty while content
         is still being filled in: story entries flagged `inFilm`,
         then simply the first few story photos. --- */
  const allStory = Array.isArray(C.story) ? C.story : [];
  // Capped at 5. Each photo holds the frame for ~3s, so this is the
  // one content list that directly lengthens the film — every extra
  // shot is three more seconds before she can touch anything.
  let filmShots = (Array.isArray(F.shots) ? F.shots : []).filter((s) => s && s.photo).slice(0, 5);
  if (!filmShots.length) filmShots = allStory.filter((s) => s && s.inFilm && s.photo).slice(0, 4);
  if (!filmShots.length) filmShots = allStory.filter((s) => s && s.photo).slice(0, 3);

  // Hint the browser to fetch these now, before their ~3s hold in
  // the film arrives — on a slow connection an <img src> discovered
  // only once this function builds the DOM can still visibly pop in
  // mid-act otherwise.
  filmShots.forEach((shot) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = shot.photo;
    document.head.appendChild(link);
  });

  const a3 = el('div', 'act a3');
  const deck = el('div', 'a3__deck');
  const a3lead = el('p', 'f-line f-line--soft a3__lead', F.memoriesLead || '');
  const polaroids = filmShots.map((shot) => {
    const card  = el('div', 'polaroid');
    const frame = el('div', 'polaroid__frame');
    const img   = el('img', 'polaroid__img');
    img.alt = shot.title || '';
    img.decoding = 'async';
    img.src = shot.photo;
    // A missing photo must never show a broken-image icon in a gift.
    // It names the file it wants instead.
    img.addEventListener('error', () => {
      img.remove();
      frame.classList.add('is-missing');
      const file = String(shot.photo).split('/').pop();
      frame.dataset.placeholder = file ? `add ${file}` : 'a photo goes here';
    });
    frame.append(img);

    const meta = el('div', 'polaroid__meta');
    if (shot.date)  meta.append(el('p', 'polaroid__date', shot.date));
    if (shot.title) meta.append(el('p', 'polaroid__title', shot.title));

    card.append(frame, meta);
    card._img = img;
    return card;
  });
  deck.append(...polaroids);
  a3.append(deck, a3lead);

  /* --- Act 4 --- */
  const L = C.letter || {};
  const filmLines = (L.filmLines && L.filmLines.length)
    ? L.filmLines
    : (L.paragraphs || []).slice(0, 1);

  const a4 = el('div', 'act a4');
  const card = el('div', 'a4__card');
  const salut = el('p', 'a4__salut', `Dear ${(C.her && C.her.name) || 'you'},`);
  const linesWrap = el('div', 'a4__lines');
  const a4lines = filmLines.map((text) => {
    const p = el('p', 'a4__line', text);
    linesWrap.append(p);
    return p;
  });
  card.append(salut, linesWrap);
  a4.append(card);

  /* --- Act 5 --- */
  const a5 = el('div', 'act a5');
  const a5stack = el('div', 'act__stack');
  const a5and = el('p', 'a5__and', F.andSomehow || 'And somehow…');
  const a5closing = el('p', 'a5__closing', F.closing || 'that ordinary day became my favorite story.');
  /* The wish, twice — loudly on the card that opened the gift, and
     quietly here. `wishEcho` in content.js is the quiet one, and its
     {name}/{nickname} tokens come from `her`. With no echo set, this
     falls back to the original ending: the full greeting, her name
     under it, at the largest size in the film. */
  const a5wish = el('p', 'a5__wish');
  const echo = (F.wishEcho || '').trim();
  if (echo){
    a5wish.classList.add('a5__wish--echo');
    a5wish.textContent = echo
      .replace(/\{name\}/g,     (C.her && C.her.name)     || '')
      .replace(/\{nickname\}/g, (C.her && C.her.nickname) || (C.her && C.her.name) || '');
  } else {
    a5wish.append(document.createTextNode(F.wish || 'Happy Birthday'));
    a5wish.append(el('span', 'a5__name', (C.her && C.her.name) || ''));
  }
  a5stack.append(a5and, a5closing, a5wish);
  a5.append(a5stack);

  actsRoot.append(a1, a2, a3, a4, a5);
  const closingChars = splitChars(a5closing);

  /* ============================================================
     THE TIMELINE
     Times are absolute seconds through PACE(), so the score is
     readable top to bottom and easy to re-cut.
     ============================================================ */
  function build(){
    // finish() is hoisted; it guards against onEnd firing twice
    // (once here, once from skip()).
    const tl = gsap.timeline({ paused: true, onComplete: () => finish() });

    /* --- opening state (every value the film touches) ---------
       Every .set() is pinned to position 0 explicitly, and the
       two content-driven groups are guarded: while he is still
       filling in content.js there may be no photos and no letter
       lines yet, and GSAP warns loudly about empty targets. */
    tl.set(S, { warmth: 0, glow: 0, glowSpread: 1, bokeh: 0, dust: 0,
                pathP: 0, pathAlpha: 0, oneP: 0, meetFlash: 0, split: 0 }, 0)
      .set([a1, a2, a3, a4, a5], { opacity: 0 }, 0)
      .set([a1a, a1b], { opacity: 0, y: 18 }, 0)
      .set([a2label, a2date, a2title], { opacity: 0, y: 16 }, 0)
      .set(a2rule, { scaleX: 0 }, 0)
      .set(a3lead, { opacity: 0, y: 14 }, 0)
      .set(deck, { y: 0, opacity: 1, filter: 'blur(0px)' }, 0)
      .set(card, { opacity: 0, y: 40, scale: 0.97 }, 0)
      .set(salut, { opacity: 0 }, 0)
      .set(a5and, { opacity: 0, y: 12 }, 0)
      .set(closingChars, { opacity: 0, yPercent: 110, rotationX: -78,
                           transformPerspective: 700, transformOrigin: '50% 100%' }, 0)
      .set(a5wish, { opacity: 0, y: 20 }, 0);

    if (polaroids.length) tl.set(polaroids, { opacity: 0, y: 60, scale: 0.92, rotate: 0 }, 0);
    if (a4lines.length)   tl.set(a4lines, { clipPath: 'inset(0 100% 0 0)' }, 0);

    /* ==========================================================
       ACT 1 — BEFORE YOU        (0 → 7s)
       A light finds focus in the dark. Nothing else happens, on
       purpose: the ordinariness is the point.
       ========================================================== */
    tl.set(a1, { opacity: 1 }, T(0))
      .to(S, { glow: 0.75, glowSpread: 0.62, duration: T(3.4), ease: 'power2.out' }, T(0.2))
      .to(S, { bokeh: 0.55, dust: 0.4, duration: T(4), ease: 'power1.out' }, T(0.4))
      .to(a1a, { opacity: 1, y: 0, duration: T(1.6), ease: 'power2.out' }, T(1.1))
      .to(a1b, { opacity: 1, y: 0, duration: T(1.6), ease: 'power2.out' }, T(3.5))
      .to(a1, { opacity: 0, duration: T(1.1), ease: 'power2.in' }, T(6.3));

    /* ==========================================================
       ACT 2 — TWO PATHS         (7 → 17.5s)
       The one light becomes two, and they go their own ways.
       ========================================================== */
    tl.to(S, { split: 1, glowSpread: 0.34, duration: T(1.6), ease: 'power2.inOut' }, T(6.9))
      .to(S, { pathAlpha: 1, duration: T(0.8) }, T(7.4))
      // the long wander — linear, so the pace feels like time passing
      .to(S, { pathP: 1, duration: T(5.6), ease: 'none' }, T(7.6))
      .to(S, { glow: 0.32, duration: T(3) }, T(8))
      // they arrive together
      .to(S, { split: 0, duration: T(1.2), ease: 'power2.in' }, T(12))
      .call(() => {
        // a scatter of glints at the intersection
        const n = REDUCED_MOTION ? 0 : 10;
        for (let i = 0; i < n; i++){
          twinkles.spawn(
            stage.W * MEET.x + rand(-40, 40),
            stage.H * MEET.y + rand(-40, 40),
            rand(0.5, 1.2) * Math.min(stage.W, stage.H) * 0.06,
          );
        }
      }, null, T(13.2))
      .fromTo(S, { meetFlash: 0 }, { meetFlash: 1, duration: T(0.22), ease: 'power2.out' }, T(13.2))
      .to(S, { meetFlash: 0, duration: T(1.5), ease: 'power2.out' }, T(13.42))
      .to(S, { glow: 0.8, glowSpread: 0.8, duration: T(1.4), ease: 'power2.out' }, T(13.2))
      // and continue as one
      .to(S, { oneP: 1, duration: T(2.4), ease: 'power1.inOut' }, T(13.6))
      .set(a2, { opacity: 1 }, T(13.4))
      .to(a2label, { opacity: 1, y: 0, duration: T(0.9), ease: 'power2.out' }, T(13.6))
      .to(a2date,  { opacity: 1, y: 0, duration: T(1.1), ease: 'power2.out' }, T(14.1))
      .to(a2rule,  { scaleX: 1, duration: T(1),   ease: 'power2.inOut' }, T(14.7))
      .to(a2title, { opacity: 1, y: 0, duration: T(1.1), ease: 'power2.out' }, T(15.1))
      .to(a2, { opacity: 0, duration: T(1.1), ease: 'power2.in' }, T(17.2));

    /* ==========================================================
       ACT 3 — THE MEMORIES      (18 → 31s)
       The world warms. Photos arrive, hold, and settle back into
       a stack rather than vanishing — the memories accumulate.
       ========================================================== */
    const A3 = T(18);
    tl.to(S, { warmth: 0.62, duration: T(3.4), ease: 'power2.inOut' }, T(17.6))
      .to(S, { pathAlpha: 0, duration: T(1.8), ease: 'power2.in' }, T(17.6))
      .to(S, { glow: 0.45, glowSpread: 1.15, dust: 0.75, bokeh: 0.85, duration: T(3) }, T(17.8))
      .set(a3, { opacity: 1 }, T(17.8));

    const HOLD = T(2.9);            // how long each photo owns the frame
    polaroids.forEach((p, i) => {
      const at = A3 + i * HOLD;
      // arrive
      tl.to(p, {
        opacity: 1, y: 0, scale: 1,
        rotate: [-3.5, 2.6, -1.8, 3.2][i % 4],
        duration: T(1.05), ease: 'power3.out',
      }, at);
      // a very restrained drift while it holds — 2%, not a zoom
      if (!REDUCED_MOTION && p._img){
        tl.fromTo(p._img,
          { scale: 1.06, xPercent: i % 2 ? 1.2 : -1.2 },
          { scale: 1.0, xPercent: 0, duration: HOLD + T(1.4), ease: 'none' }, at);
      }
      // settle back into the deck as the next one arrives
      if (i < polaroids.length - 1){
        tl.to(p, {
          y: -14 - i * 5,
          scale: 0.93 - i * 0.03,
          rotate: [-7, 5.5, -4][i % 3],
          duration: T(1.05), ease: 'power2.inOut',
        }, at + HOLD - T(0.25));
      }
    });

    const a3End = A3 + Math.max(polaroids.length, 1) * HOLD;
    tl.to(a3lead, { opacity: 1, y: 0, duration: T(1.2), ease: 'power2.out' }, a3End - T(1.4))
      // the memories move into the background — they don't disappear
      .to(deck, { y: 70, scale: 0.9, opacity: 0, filter: 'blur(7px)',
                  duration: T(1.5), ease: 'power2.in' }, a3End + T(0.7))
      .to(a3lead, { opacity: 0, duration: T(1), ease: 'power2.in' }, a3End + T(0.9))
      .set(a3, { opacity: 0 }, a3End + T(2.3));

    /* ==========================================================
       ACT 4 — THE LETTER
       The world cools back down so cream paper reads as light.
       Lines sweep in left-to-right: handwriting appearing, without
       the cliché (or the sluggishness) of a typewriter.
       ========================================================== */
    const A4 = a3End + T(1.9);
    tl.to(S, { warmth: 0.3, glow: 0.34, glowSpread: 0.9, dust: 0.45, bokeh: 0.45,
               duration: T(2.6), ease: 'power2.inOut' }, A4 - T(0.6))
      .set(a4, { opacity: 1 }, A4)
      .to(card,  { opacity: 1, y: 0, scale: 1, duration: T(1.5), ease: 'power3.out' }, A4)
      .to(salut, { opacity: 1, duration: T(1), ease: 'power2.out' }, A4 + T(0.9));

    let cursor = A4 + T(1.7);
    a4lines.forEach((line) => {
      // sweep speed scales with line length so long and short lines
      // both feel like they were written at the same hand-speed
      const dur = T(clamp(line.textContent.length * 0.045, 1.2, 3.4));
      tl.to(line, { clipPath: 'inset(0 0% 0 0)', duration: dur, ease: 'power1.inOut' }, cursor);
      cursor += dur + T(0.75);
    });

    const a4End = cursor + T(1.1);
    tl.to(card, { opacity: 0, y: -26, scale: 0.985, duration: T(1.3), ease: 'power2.in' }, a4End)
      .set(a4, { opacity: 0 }, a4End + T(1.3));

    /* ==========================================================
       ACT 5 — THE PAYOFF, then silence.
       ========================================================== */
    const A5 = a4End + T(1.1);
    tl.set(a5, { opacity: 1 }, A5)
      .to(a5and, { opacity: 1, y: 0, duration: T(1.1), ease: 'power2.out' }, A5 + T(0.3))
      .to(a5and, { opacity: 0, duration: T(0.8), ease: 'power2.in' }, A5 + T(2.6))
      // the largest type in the film, glyph by glyph
      .to(closingChars, {
        opacity: 1, yPercent: 0, rotationX: 0,
        duration: T(0.85), ease: 'power3.out', stagger: T(0.026),
      }, A5 + T(3.1))
      .to(S, { glow: 0.62, glowSpread: 1.05, warmth: 0.36,
               duration: T(2.4), ease: 'power2.out' }, A5 + T(3.4))
      .to(a5wish, { opacity: 1, y: 0, duration: T(1.6), ease: 'power2.out' }, A5 + T(5.6));

    /* THE HOLD — roughly three seconds where nothing moves but the
       dust. It is empty on purpose: the payoff needs room to land
       before she is asked to do anything. Do not fill it. */
    tl.to({}, { duration: T(3.2) }, A5 + T(7.4));

    return tl;
  }

  let master = build();

  /* ============================================================
     CONTROLS
     ============================================================ */
  let ended = false;

  function play(){
    root.hidden = false;
    stage.resize();
    drawStill();

    if (REDUCED_MOTION){
      // Don't trap her behind an animation that will not run.
      // Land on the final frame immediately; every word is still
      // reachable in the website below. One static paint, not a
      // running loop — she asked for reduced motion, so the ambient
      // bokeh/dust drift has no business continuing indefinitely.
      master.progress(1, true);
      drawStill();
      finish();
      return;
    }

    stage.start(frame);
    master.play(0);
  }

  function finish(){
    if (ended) return;
    ended = true;
    onEnd && onEnd();
  }

  /* Skip = jump the single source of truth to its end. Because every
     act's final state is written by the timeline, this lands exactly
     where a full playthrough lands — no second code path. */
  function skip(){
    if (ended) return;
    master.progress(1, true).pause();
    twinkles.clear();
    finish();
  }

  function restart(){
    ended = false;
    twinkles.clear();
    stage.resize();

    if (REDUCED_MOTION){
      master.progress(1, true);
      drawStill();
      finish();
      return;
    }

    if (!stage.running) stage.start(frame);

    // Rewind BEFORE unpausing, and do NOT use master.restart().
    // restart() calls play() first and rewinds second. The timeline is
    // parked at its very end (skip() put it there, and so does a normal
    // playthrough), so that play() immediately re-fires onComplete —
    // which re-opens the story before the film has drawn one frame, and
    // the replay silently does nothing at all.
    master.pause(0, true);   // seek to 0, paused, events suppressed
    master.play();
  }

  /* Once the film has scrolled out of view there is nothing to see,
     so stop rendering entirely. On a phone this is the single biggest
     battery saving in the project — otherwise a rAF loop would run
     for the whole visit. */
  function setRendering(on){
    // Reduced motion never runs the loop in the first place (see play()/
    // restart()) — the landed frame is a single static paint, so there
    // is nothing here to start.
    if (REDUCED_MOTION) return;
    if (on && !stage.running) stage.start(frame);
    else if (!on && stage.running){ stage.stop(); }
  }

  function destroy(){
    master.kill();
    stage.destroy();
  }

  return { play, skip, restart, setRendering, destroy, drawStill, get master(){ return master }, get ended(){ return ended } };
}
