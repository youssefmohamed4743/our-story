/* ============================================================
   gate.js — the front door.

   BE CLEAR ABOUT WHAT THIS IS: the accepted answers ship inside
   the JavaScript, so anyone who opens dev tools can read them.
   This is a romantic entrance, not security. What it actually
   buys you is real, though — it keeps the link from opening
   straight into your photos for anyone who happens on it, it
   pairs with <meta name="robots" content="noindex"> to keep
   search engines out, and it gives her a small moment of
   "he knew I'd know this".

   If you ever need genuine privacy, that is password protection
   at the host (Netlify/Vercel), not here.

   It also serves a second, unavoidable purpose: browsers refuse
   to start audio without a real user gesture, and the submit tap
   is that gesture.
   ============================================================ */

import gsap from 'gsap';
import { REDUCED_MOTION, clamp, rand, Stage, Twinkles } from './lib/canvas.js';

/* Forgiving comparison: case, spaces, punctuation and accents all
   ignored. She should never fail on a capital letter. */
function normalize(s){
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // strip accents
    .replace(/[^a-z0-9]/g, '');                        // strip everything else
}

/* The button beats before the world opens — a moment of anticipation
   between her tap and the film. Four beats at 420ms ≈ 1.7s. */
const BEATS = 4;
const BEAT_MS = 420;

export function createGate({ content, root, onEnter, onGesture }){
  const G = (content && content.gate) || {};
  const intro    = root.querySelector('#gateIntro');
  const question = root.querySelector('#gateQuestion');
  const form     = root.querySelector('#gateForm');
  const input    = root.querySelector('#gateInput');
  const submit   = root.querySelector('#gateSubmit');
  const hint     = root.querySelector('#gateHint');
  const burstCanvas = root.querySelector('#gateBurst');

  intro.textContent    = G.intro    || 'a little secret…';
  question.textContent = G.question || 'which is our Favorite memory?';
  submit.textContent   = G.button   || 'start story';

  const accepted = (G.answers && G.answers.length ? G.answers : ['love'])
    .map(normalize)
    .filter(Boolean);

  let attempts = 0;
  let opened = false;

  /* A brief scatter of glints where she touched the button — the same
     "moment that deserves one" pattern film.js uses when the two paths
     meet. Built lazily so a gate she never opens costs nothing. */
  let burstStage = null, burstTwinkles = null;

  function burstAt(x, y){
    if (REDUCED_MOTION || !burstCanvas) return;
    if (!burstStage){ burstStage = new Stage(burstCanvas); burstTwinkles = new Twinkles(); }

    const n = 14;
    for (let i = 0; i < n; i++){
      burstTwinkles.spawn(
        x + rand(-70, 70),
        y + rand(-70, 70),
        rand(0.6, 1.3) * Math.min(burstStage.W, burstStage.H) * 0.05,
      );
    }
    burstStage.start((dt) => {
      burstStage.clear();
      burstTwinkles.update(dt);
      burstTwinkles.draw(burstStage, 1);
      if (!burstTwinkles.items.length) burstStage.stop();
    });
  }

  function enter(){
    if (opened) return;
    opened = true;

    // Whatever the chase was doing, it's over — and the button must be
    // back at its origin, or the entry animation (which also drives
    // transform) would fight this inline style.
    chasing = false;
    clearTimeout(giveInTimer);
    clearTimeout(swallowTimer);
    swallowClick = false;
    submit.removeEventListener('pointerenter', onReach);
    submit.removeEventListener('pointermove',  onReach);
    submit.removeEventListener('pointerdown',  onGrab);
    submit.removeEventListener('click',        onClickGuard, true);
    submit.style.transform = '';

    // The music MUST start here, synchronously inside the tap. Browsers
    // grant audio permission for the gesture itself, not for a timer
    // that runs afterwards — delaying this by even one tick loses it.
    onGesture && onGesture();

    const r = submit.getBoundingClientRect();
    burstAt(r.left + r.width / 2, r.top + r.height / 2);

    // Then the button beats four times before the film begins.
    submit.classList.add('is-entering');

    const hold = REDUCED_MOTION ? 0 : BEATS * BEAT_MS;
    setTimeout(() => {
      root.classList.add('is-leaving');
      onEnter();
      setTimeout(() => {
        root.hidden = true;
        if (burstStage) burstStage.destroy();
      }, REDUCED_MOTION ? 0 : 900);
    }, hold);
  }

  function refuse(){
    attempts++;
    form.classList.remove('is-wrong');
    void form.offsetWidth;                 // restart the animation
    form.classList.add('is-wrong');

    // Nudge, don't scold. After a couple of tries, offer the hint.
    hint.textContent = attempts >= 2 ? (G.hint || 'you already know this one') : '…not quite';
    hint.classList.add('is-shown');
    input.select();
  }

  /* ============================================================
     THE BUTTON THAT PLAYS HARD TO GET

     Four times the button darts away; then it gives in, glides home,
     and stays put for good. It has to be caught, not just reached.

     It runs on EVERY device, but it cannot be triggered the same way
     on both, because the two inputs are shaped differently:

       cursor — there is an approach to react to, so it flees on
                contact: the moment the pointer is ON it, it leaves.
       touch  — a finger gives no warning; it arrives already tapping.
                So the tap ITSELF is the escape. She taps, it jumps,
                nothing is submitted. Four taps, then it lets her have
                it. `pointerdown` is where that has to happen — early
                enough to cancel the click that would otherwise open
                the gate.

     Neither can be skipped with the keyboard: while the button is
     still running, Enter (and the phone keyboard's Go key) is refused
     with a nudge — see the submit handler. Once it settles, Enter
     works normally; by then the chase has already happened.

     TWO WAYS OUT, so she can never be stranded behind a joke: the
     button gives in by itself after GIVE_IN_MS, and after GIVE_IN_TRIES
     attempts, whichever comes first. That covers a browser that
     misreports its pointer, a screen too small for the jump to read,
     and simply not finding it funny.

     Under reduced motion there is no chase at all, and nothing is
     blocked.

     Once it settles, transform is cleared entirely, so the four-beat
     entry animation (which also drives transform) is never fighting
     an inline style.
     ============================================================ */
  const DODGES = 4;
  const LEAP = 165;           // how far it jumps (capped on small screens)
  const EDGE = 14;            // keep it this far inside the viewport
  const COOLDOWN = 260;       // ms; one dodge per approach, not per jitter
  const GIVE_IN_MS = 20000;   // it stops running by itself after this
  const GIVE_IN_TRIES = 6;    // …or after this many attempts

  const chase = (G.chase && G.chase.length) ? G.chase : [];
  let dodges = 0, tries = 0, offX = 0, offY = 0, home = null;
  let chasing = false, lastDodge = 0, giveInTimer = 0;
  let swallowClick = false, swallowTimer = 0;

  function canChase(){
    return !REDUCED_MOTION && chase.length > 0;
  }

  /* True from the moment the gate is built until the button is caught.
     `chasing` alone is not enough to guard the keyboard: it only turns
     on once armChase() runs, which would leave a window where Enter
     could still skip everything. */
  let mustCatch = canChase();

  function say(msg){
    if (!msg) return;
    hint.hidden = false;
    hint.textContent = msg;
    hint.classList.add('is-shown');
  }

  function settle(){
    if (!chasing && !mustCatch) return;
    chasing = false;
    mustCatch = false;
    clearTimeout(giveInTimer);
    clearTimeout(swallowTimer);
    swallowClick = false;
    submit.removeEventListener('pointerenter', onReach);
    submit.removeEventListener('pointermove',  onReach);
    submit.removeEventListener('pointerdown',  onGrab);
    submit.removeEventListener('click',        onClickGuard, true);
    offX = offY = 0;
    submit.style.transform = '';
    // Only if she actually chased it. Giving in on the timer while she
    // has not touched anything should not congratulate her.
    if (dodges > 0) say(chase[DODGES - 1]);
  }

  /* The visible area, in the same coordinates getBoundingClientRect
     uses. On a phone this is NOT innerWidth/innerHeight: the on-screen
     keyboard is open while she types, and innerHeight still counts the
     space behind it — so the button could hop under the keyboard and
     be untouchable. visualViewport is the part she can actually see. */
  function viewport(){
    const v = window.visualViewport;
    return v
      ? { x: v.offsetLeft, y: v.offsetTop, w: v.width, h: v.height }
      : { x: 0, y: 0, w: innerWidth, h: innerHeight };
  }

  /* One escape, away from the point she reached for. Shared by both
     inputs — only the trigger differs, never the motion. */
  function flee(px, py){
    const r = submit.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;

    // remember where it actually lives, before any of this moved it
    if (!home) home = { left: r.left - offX, top: r.top - offY, w: r.width, h: r.height };

    // Away from her, with a swerve so it never feels mechanical. If she
    // arrived dead-centre — a tap right on the middle, a teleport, a
    // very fast sweep — there is no "away" to compute, so pick one.
    let vx = cx - px, vy = cy - py;
    let len = Math.hypot(vx, vy);
    if (len < 1){ const t = rand(0, Math.PI * 2); vx = Math.cos(t); vy = Math.sin(t); len = 1; }
    vx /= len; vy /= len;
    const a = rand(-0.7, 0.7);
    const dx = vx * Math.cos(a) - vy * Math.sin(a);
    const dy = vx * Math.sin(a) + vy * Math.cos(a);

    const vp = viewport();
    const minX = vp.x + EDGE - home.left, maxX = vp.x + vp.w - EDGE - home.w - home.left;
    const minY = vp.y + EDGE - home.top,  maxY = vp.y + vp.h - EDGE - home.h - home.top;

    // A phone screen cannot absorb a 165px leap the way a monitor can —
    // it would just slam into the clamp every time. Scale to the screen.
    const leap = Math.min(LEAP, Math.min(vp.w, vp.h) * 0.35);

    const prevX = offX, prevY = offY;
    offX = clamp(offX + dx * leap, minX, maxX);
    offY = clamp(offY + dy * leap, minY, maxY);

    // If it's cornered, the clamp leaves it sitting right where she is —
    // and on a cursor that also deadlocks the chase, because the pointer
    // never leaves and no further `pointerenter` fires. So when the jump
    // got squashed, bolt somewhere else entirely: sample a few spots and
    // take the one furthest from her.
    if (Math.hypot(offX - prevX, offY - prevY) < 40){
      let bestD = -1;
      for (let i = 0; i < 12; i++){
        const tx = rand(minX, maxX), ty = rand(minY, maxY);
        const d = Math.hypot(home.left + tx + home.w / 2 - px,
                             home.top  + ty + home.h / 2 - py);
        if (d > bestD){ bestD = d; offX = tx; offY = ty; }
      }
    }

    submit.style.transform = `translate(${offX}px, ${offY}px)`;

    dodges++;
    tries++;
    if (dodges >= DODGES)          setTimeout(settle, 520);   // caught — come home
    else if (tries >= GIVE_IN_TRIES) settle();                // enough is enough
    else                            say(chase[dodges - 1]);
  }

  /* CURSOR. Fires only while the pointer is actually ON the button —
     she has to catch it, not just get near it. There is no proximity
     radius.

     Both `pointerenter` AND `pointermove` are bound, and the second one
     matters: enter fires only on the way IN, so if the cursor ends up
     sitting inside the button (it got cornered, or the clamp squashed
     its jump) no further enter ever arrives and the chase deadlocks
     with the button stuck under the cursor. Move keeps it honest. The
     cooldown is what stops one approach burning several dodges. */
  function onReach(e){
    if (!chasing || opened) return;
    if (e.pointerType && e.pointerType !== 'mouse') return;   // touch has its own handler

    const now = performance.now();
    if (now - lastDodge < COOLDOWN) return;
    lastDodge = now;

    flee(e.clientX, e.clientY);
  }

  /* TOUCH. The tap is the escape, so this has to cancel the tap as well
     as move the button. preventDefault() on `pointerdown` is what does
     it: for a touch contact it suppresses the compatibility mouse events
     the browser would synthesise afterwards — including the click that
     would submit the form. That is also why this listener CANNOT be
     passive, and why it is pointerdown rather than pointerup: by pointerup
     the click is already on its way.

     A happy side effect: focus never leaves the input, so the keyboard
     does not close and reopen and shove the layout around mid-chase. */
  function onGrab(e){
    if (!chasing || opened) return;
    if (e.pointerType === 'mouse') return;                    // cursor has its own handler

    e.preventDefault();

    // …and a second lock on the same door. Some iOS builds fire the click
    // anyway despite the preventDefault above, which would open the gate
    // on the very tap that was supposed to be dodged. So the next click,
    // if one arrives at all, is swallowed outright. The window is short
    // and self-clearing: a synthesised click follows within a few hundred
    // ms or never comes, and this must not be left armed for a real tap.
    swallowClick = true;
    clearTimeout(swallowTimer);
    swallowTimer = setTimeout(() => { swallowClick = false; }, 400);

    flee(e.clientX, e.clientY);
  }

  function onClickGuard(e){
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  }

  /* Both inputs are bound on every device, and each handler refuses the
     pointer type that is not its own. That is deliberate: a laptop with
     a touchscreen has genuinely got both, and asking a media query which
     one she is using right now gets it wrong. The event knows. */
  function armChase(){
    if (!canChase()) return;
    chasing = true;
    submit.addEventListener('pointerenter', onReach, { passive: true });
    submit.addEventListener('pointermove',  onReach, { passive: true });
    submit.addEventListener('pointerdown',  onGrab,  { passive: false });
    submit.addEventListener('click',        onClickGuard, true);
    // The way out that needs nothing from her at all.
    giveInTimer = setTimeout(settle, GIVE_IN_MS);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // The button has not been caught yet. Enter on a keyboard, or Go on
    // a phone keypad, would submit straight from the input and skip the
    // whole chase — so it is refused here, with a nudge rather than
    // silence. She is never stuck: the button gives in on its own after
    // GIVE_IN_MS, which clears this too.
    if (mustCatch){
      tries++;
      form.classList.remove('is-wrong');
      void form.offsetWidth;               // restart the animation
      form.classList.add('is-wrong');
      if (tries >= GIVE_IN_TRIES) settle();
      else say(G.chaseNudge || 'catch the button first');
      return;
    }

    const given = normalize(input.value);
    if (given && accepted.includes(given)) enter();
    else refuse();
  });

  /* The gate is asked EVERY visit — nothing is remembered between
     loads, so a refresh always comes back to the secret question.
     That also keeps the audio gesture honest: the answer tap is
     what lets the browser start the song. */
  function show(){
    root.hidden = false;
    if (REDUCED_MOTION){
      gsap.set([intro, question, form], { opacity: 1 });
      input.focus({ preventScroll: true });
      return;
    }
    gsap.timeline()
      .to(intro,    { opacity: 1, duration: 1.1, ease: 'power2.out' }, 0.35)
      .to(question, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 1.1)
      .to(form,     { opacity: 1, duration: 1.0, ease: 'power2.out' }, 1.9)
      // Armed the moment the button starts appearing, not later: from
      // here on Enter is refused until it is caught, so the button must
      // already be dodging or a click on it would be refused too.
      .call(armChase, null, 1.9)
      // Focus late and without scrolling: focusing early makes the
      // iOS keyboard jump up over the question she hasn't read yet.
      .call(() => { input.focus({ preventScroll: true }); }, null, 2.6);
  }

  return { show, enter };
}
