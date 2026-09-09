/* ============================================================
   main.js — the conductor.

     gate → wish + play → volume card → film →
     the film's last frame becomes the page → story

   Nothing personal lives here. Every word and photo comes from
   content.js; this file only decides what happens when.
   ============================================================ */

import gsap from 'gsap';
import { CONTENT } from './content.js';
import { createFilm } from './film.js';
import { buildStory } from './story.js';
import { createGate } from './gate.js';
import { createAudio } from './audio.js';
import { REDUCED_MOTION } from './lib/canvas.js';

/* ------------------------------------------------------------
   Asset paths.
   content.js holds plain relative paths ('photos/01.jpg'), which
   keeps that file friendly to edit. Everything is resolved
   against Vite's base here, so the same build works at a domain
   root, in a GitHub Pages subfolder, or opened locally.
   ------------------------------------------------------------ */
const BASE = import.meta.env.BASE_URL || './';
const resolve = (p) => {
  if (!p) return '';
  if (/^(https?:)?\/\//.test(p) || p.startsWith('data:')) return p;
  return BASE.replace(/\/?$/, '/') + String(p).replace(/^\//, '');
};

/* One content object with every photo path already resolved, so
   neither the film nor the story has to think about it. */
const C = {
  ...CONTENT,
  story: (CONTENT.story || []).map((s) => ({ ...s, photo: s.photo ? resolve(s.photo) : '' })),
};

const $ = (id) => document.getElementById(id);

const filmRoot  = $('film');
const filmActs  = $('filmActs');
const filmCanvas= $('filmCanvas');
const storyRoot = $('story');
const gateRoot  = $('gate');
const skipBtn   = $('skip');
const outro     = $('outro');
const outroText = $('outroText');
const audioBtn  = $('audioToggle');

outroText.textContent = (C.film && C.film.outro) || 'there is more to our story';

/* ============================================================
   LIGHTBOX
   ============================================================ */
const lightbox = $('lightbox');
const lbImg    = $('lightboxImg');
const lbCap    = $('lightboxCap');

const lbPrev  = $('lightboxPrev');
const lbNext  = $('lightboxNext');
const lbCount = $('lightboxCount');

/* The lightbox is a gallery over ONE group. story.js hands us the array
   the photo came from, so paging inside the wall never wanders into the
   story chapters and vice versa. */
let lbItems = [];
let lbIndex = 0;
let lbOpener = null;      // the button she tapped, so focus can go home

function lbShow(i){
  if (!lbItems.length) return;
  // wrap at both ends — reaching the last photo and stopping feels broken
  lbIndex = (i + lbItems.length) % lbItems.length;
  const item = lbItems[lbIndex];

  lbImg.src = item.photo;
  lbImg.alt = item.title || item.caption || '';
  lbCap.textContent = [item.title || item.caption, item.date].filter(Boolean).join(' · ');

  const many = lbItems.length > 1;
  lbCount.textContent = many ? `${lbIndex + 1} / ${lbItems.length}` : '';
  lbPrev.hidden = lbNext.hidden = !many;

  // Warm the neighbours so a swipe is instant rather than a white flash.
  if (many){
    for (const step of [1, -1]){
      const n = lbItems[(lbIndex + step + lbItems.length) % lbItems.length];
      if (n && n.photo) new Image().src = n.photo;
    }
  }
}

function openLightbox(group, index, opener){
  lbItems = Array.isArray(group) ? group : [group];
  lbOpener = opener || null;
  lbShow(index || 0);
  lightbox.hidden = false;
  requestAnimationFrame(() => lightbox.classList.add('is-open'));
  $('lightboxClose').focus({ preventScroll: true });
}

function closeLightbox(){
  lightbox.classList.remove('is-open');
  setTimeout(() => { lightbox.hidden = true; lbImg.src = ''; }, REDUCED_MOTION ? 0 : 350);
  // Send focus back to the photo she opened, not to the top of the page.
  if (lbOpener){ lbOpener.focus({ preventScroll: true }); lbOpener = null; }
}

$('lightboxClose').addEventListener('click', closeLightbox);
lbPrev.addEventListener('click', () => lbShow(lbIndex - 1));
lbNext.addEventListener('click', () => lbShow(lbIndex + 1));
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

addEventListener('keydown', (e) => {
  if (lightbox.hidden) return;
  if (e.key === 'Escape')     closeLightbox();
  if (e.key === 'ArrowLeft')  lbShow(lbIndex - 1);
  if (e.key === 'ArrowRight') lbShow(lbIndex + 1);
});

/* Swipe. Horizontal only: a mostly-vertical drag is her trying to scroll,
   and turning that into a photo change would feel like a misfire. */
let swipeX = null, swipeY = null;
lightbox.addEventListener('pointerdown', (e) => { swipeX = e.clientX; swipeY = e.clientY; });
lightbox.addEventListener('pointerup', (e) => {
  if (swipeX == null) return;
  const dx = e.clientX - swipeX, dy = e.clientY - swipeY;
  swipeX = swipeY = null;
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
  lbShow(lbIndex + (dx < 0 ? 1 : -1));
});
lightbox.addEventListener('pointercancel', () => { swipeX = swipeY = null; });

/* ============================================================
   AUDIO
   ============================================================ */
const audio = createAudio({ content: C, toggle: audioBtn, resolve });

/* Unlock the song at the earliest moment the browser will allow: it tries
   straight away, and otherwise catches the very first gesture of any kind.
   In practice that is the tap that opens the gate.

   Unlocking is not the same as playing it to her — this runs the track at
   volume 0. The sound itself is turned on later, by the play button
   on the wish card. */
audio.arm();

/* ------------------------------------------------------------
   BOOT-ERROR FALLBACK

   content.js is the one file meant for hand-editing, often by
   someone who isn't a developer. A missing comma or quote there
   would otherwise throw synchronously below and leave a silent
   blank page behind the gate — this turns that into a readable
   message instead.
   ------------------------------------------------------------ */
function showBootError(err){
  console.error('[Interactive Birthday Gift] content.js failed to load:', err);
  if ($('bootError')) return;   // already shown once — don't stack overlays
  [gateRoot, filmRoot, storyRoot].forEach((n) => { if (n) n.hidden = true; });
  const box = document.createElement('div');
  box.id = 'bootError';
  box.setAttribute('style',
    'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;' +
    'padding:2rem;text-align:center;background:#03060e;color:#f3e6d3;' +
    'font:16px/1.6 system-ui,sans-serif;');
  box.innerHTML =
    '<div style="max-width:32rem">' +
    '<p style="font-size:1.2em;margin-bottom:.6em">Something didn’t load right.</p>' +
    '<p>If you just edited <code>content.js</code>, check for a typo — a missing comma ' +
    'or quote is the usual culprit. Open the browser console (F12) for the exact error.</p>' +
    '</div>';
  document.body.appendChild(box);
}

// Everything below reads content.js-derived data. Wrapped so a mistake
// there surfaces the message above instead of an uncaught exception.
try {

/* ============================================================
   THE STORY (built up front, revealed later)
   ============================================================ */
buildStory({
  content: C,
  root: storyRoot,
  openLightbox,
  onReplay: () => replay(),
});

/* ============================================================
   THE FILM
   ============================================================ */
let storyOpen = false;
let spacerIO = null;

const film = createFilm({
  content: C,
  root: filmRoot,
  actsRoot: filmActs,
  canvas: filmCanvas,
  onEnd: () => openStory(),
});

/* The handoff. The film does not unmount and nothing fades out:
   its final frame stays exactly where it is, fixed behind the
   page, and the story scrolls up over it. That is the whole
   reason this feels like one piece instead of two. */
function openStory(){
  if (storyOpen) return;
  storyOpen = true;

  storyRoot.hidden = false;
  document.documentElement.classList.add('is-open');

  skipBtn.classList.add('is-gone');
  if (audio.available) audioBtn.hidden = false;

  outro.hidden = false;
  gsap.to(outro, { opacity: 1, duration: REDUCED_MOTION ? 0 : 1.4, ease: 'power2.out' });

  watchSpacer();
}

/* Stop rendering the canvas once the film's frame is fully
   covered. On a phone this is the biggest battery saving here —
   otherwise a rAF loop would run for the entire visit.

   The film element is position:fixed, so it never leaves the
   viewport and cannot be observed directly. The story's first
   screen — the transparent spacer the final frame shows through —
   is the honest proxy for "can she still see the film?". */
function watchSpacer(){
  const spacer = storyRoot.querySelector('.story__spacer');
  if (!spacer || !('IntersectionObserver' in window)) return;
  if (spacerIO) spacerIO.disconnect();

  spacerIO = new IntersectionObserver((entries) => {
    const visible = entries.some((e) => e.isIntersecting);
    film.setRendering(visible);
    // The scroll cue has done its job the moment she scrolls.
    if (!visible) outro.classList.add('is-gone');
  }, { threshold: 0 });

  spacerIO.observe(spacer);
}

/* Hide the scroll cue as soon as she takes the hint, without
   waiting for the spacer to leave entirely. */
addEventListener('scroll', () => {
  if (storyOpen && scrollY > 40) outro.classList.add('is-gone');
}, { passive: true });

/* ============================================================
   SKIP — a door, not an emergency exit.
   ============================================================ */
skipBtn.addEventListener('click', () => film.skip());

/* ------------------------------------------------------------
   SCROLLING DURING THE FILM

   The page is locked while the film plays, so a two-finger
   touchpad scroll — the single most instinctive "I'm ready to
   move on" gesture there is — would otherwise do nothing at all
   and just feel broken.

   So a deliberate scroll means "continue": it hands off to the
   story exactly as the Skip button does. Same single code path,
   so it lands on the same final frame.

   Two guards keep it from firing by accident:
     · it accumulates distance, so one stray notch is not enough
     · the accumulator decays, so slow drift never adds up
   And the first hint of a scroll lights up the Skip button, so
   the way out becomes obvious before the gesture completes.
   ------------------------------------------------------------ */
const CONTINUE_THRESHOLD = 220;      // ≈ one deliberate swipe
let scrollIntent = 0;
let intentTimer = 0;
let filmStarted = false;

function intentToContinue(amount){
  if (storyOpen || !filmStarted || !gateRoot.hidden) return;

  scrollIntent += Math.abs(amount);
  skipBtn.classList.add('is-shown', 'is-urgent');

  clearTimeout(intentTimer);
  intentTimer = setTimeout(() => { scrollIntent = 0; }, 450);

  if (scrollIntent >= CONTINUE_THRESHOLD){
    scrollIntent = 0;
    film.skip();
  }
}

addEventListener('wheel', (e) => intentToContinue(e.deltaY), { passive: true });

/* the same gesture on a phone, where the lock also swallows it */
let touchY = null;
addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
addEventListener('touchmove', (e) => {
  if (touchY == null || storyOpen) return;
  const y = e.touches[0].clientY;
  intentToContinue(touchY - y);
  touchY = y;
}, { passive: true });

/* and the keys a laptop user would reach for */
addEventListener('keydown', (e) => {
  if (['ArrowDown', 'PageDown', 'End', ' ', 'Spacebar'].includes(e.key)){
    intentToContinue(CONTINUE_THRESHOLD);
  }
});

/* ============================================================
   REPLAY
   The old film had a real bug here: replaying while scrolled down
   left its viewport measurements reading against the wrong scroll
   position, and the arrow fired at nothing. This version measures
   only the canvas, and returns to the top before restarting, so
   there is nothing left to get wrong.

   The story stays mounted throughout — she loses nothing.
   ============================================================ */
function replay(){
  scrollTo({ top: 0, behavior: 'auto' });

  requestAnimationFrame(() => {
    document.documentElement.classList.remove('is-open');   // re-lock
    storyOpen = false;
    if (spacerIO){ spacerIO.disconnect(); spacerIO = null; }

    outro.classList.remove('is-gone');
    gsap.set(outro, { opacity: 0 });
    outro.hidden = true;

    scrollIntent = 0;
    clearTimeout(intentTimer);
    skipBtn.classList.remove('is-gone', 'is-urgent');
    if (!REDUCED_MOTION) skipBtn.classList.add('is-shown');

    film.restart();
  });
}

/* ============================================================
   BOOT
   ============================================================ */
function startFilm(){
  filmRoot.hidden = false;
  filmStarted = true;
  film.play();
  // Let the first act breathe before offering the exit.
  if (!REDUCED_MOTION){
    setTimeout(() => skipBtn.classList.add('is-shown'), 2200);
  } else {
    skipBtn.classList.add('is-shown');
  }
}

/* ============================================================
   THE VOLUME CUE — the held beat between the gate and act one.

   A cinema does not cut from the foyer to the film; it dims the
   room and asks something of you first. This is that card.

   The SOUND begins one screen earlier now, on the play button of
   the wish card — see rollWish(). Everything before that tap is
   deliberately silent, and by the time this card appears the song
   is already under it, which is what makes the instruction
   actionable: she is asked to turn something up that she can
   already hear. beginSong() below is what keeps that single, and
   this card still calls it, so the card remains correct on its own
   if the wish card is ever removed from content.js.

   Three things keep it a beat rather than a wait:
     · the hairline fills, so the end is visible from the start
     · a tap anywhere goes straight through
     · it advances on its own regardless, so doing nothing is
       also the right answer

   WHAT IT DOES NOT DEPEND ON: the state of the audio element.
   An earlier version skipped the card whenever the song was
   muted or `available` had gone false, and both of those turned
   out to be traps. `available` flips only when an error event
   has already fired, which is a race — early on it reads true
   for a file that will fail and false for one still loading.
   And a mute is remembered in localStorage, so a single tap of
   the toggle during testing silently removed this card from
   that device for good, with no way to tell why.

   So the card is now a property of the FILM, not of the audio:
   if there is a song configured and a line to show, it plays.
   Whether sound actually comes out is swell()'s business, and
   it makes that decision itself.
   ============================================================ */
const cueRoot = $('cue');
const cueFill = $('cueFill');

/* The song arrives exactly once, on the first screen that asks for
   it — normally the wish card's play button, and the volume card
   only if there is no wish card to tap. A second swell() would set
   the level back to zero and fade up again, which she would hear as
   the song ducking for no reason, so this is a one-way switch. */
let songBegun = false;
function beginSong(dur = 2.6){
  if (songBegun) return;
  songBegun = true;
  audio.swell(dur);
}

/* ============================================================
   THE WISH — the card that opens the gift.

   She answers the secret, the button beats four times, the gate
   dissolves, and this is underneath it: the wish, in the largest
   type in the project, and one button.

   It is the only screen in the whole flow that WAITS. No timer,
   no tap-anywhere — the film starts when she presses play and
   not a moment before, because the point of the card is that the
   moment belongs to her. She cannot get stuck: the button is the
   only thing on screen, it is focused, and Enter or Space works
   on it like any other button.

   The tap is doing quiet work too. It is a second real user
   gesture, which is a free retry for any browser that refused
   the audio unlock at the gate — and it is where the song comes
   in, so the volume card that follows has something audible to
   be about.
   ============================================================ */
const wishRoot = $('wishCard');
const wishPlay = $('wishCardPlay');

function rollWish(then){
  const W = (C.film && C.film.wishCard) || {};
  const greeting = W.greeting || (C.film && C.film.wish) || '';
  const name = (C.her && C.her.name) || '';

  // Nothing to say — don't hold her behind an empty card.
  if (!greeting && !name){ then(); return; }

  $('wishCardGreeting').textContent = greeting;
  $('wishCardName').textContent = name;
  $('wishCardWord').textContent = W.play || 'play our story';
  wishPlay.setAttribute('aria-label', W.playLabel || W.play || 'Play our story');

  const greetEl = $('wishCardGreeting');
  const nameEl  = $('wishCardName');

  wishRoot.hidden = false;

  let done = false;
  let tl = null;

  const preUnlock = () => audio.start();

  function go(){
    if (done) return;                  // double-tap, or click + keypress
    done = true;

    /* THE SONG STARTS HERE, and it is deliberately the FIRST thing this
       handler does — before the listener teardown, before disabling the
       button, before any DOM work. Safari grants audio to the gesture
       itself, and the further into a handler the call sits the more
       chances there are for something to end up between it and the tap.
       If the gate's unlock was refused, swell() retries the play() and
       builds the audio graph itself; this gesture is what makes that
       retry legal. */
    beginSong(2.6);

    wishPlay.removeEventListener('click', go);
    wishPlay.removeEventListener('pointerdown', preUnlock);
    wishPlay.disabled = true;          // no second press during the fade

    // She may have pressed while the card was still arriving; kill the
    // entrance outright or its fade-IN and this fade-OUT tween the same
    // property against each other and the card flickers on the way out.
    if (tl) tl.kill();
    gsap.killTweensOf([wishRoot, greetEl, nameEl, wishPlay]);

    if (REDUCED_MOTION){
      wishRoot.hidden = true;
      then();
      return;
    }
    // Out first, then the volume card — never both at once.
    gsap.to(wishRoot, {
      opacity: 0, duration: .7, ease: 'power2.inOut',
      onComplete: () => { wishRoot.hidden = true; then(); },
    });
  }

  /* On a phone the touch lands before the click does, and the earliest
     moment is the safest one to spend on the unlock — so pointerdown
     silently starts the song (volume still at zero) and the click a
     moment later brings the sound up. Two chances at the one thing iOS
     is strict about. A keyboard press fires no pointerdown, so the
     click below still does both on its own. */
  wishPlay.addEventListener('pointerdown', preUnlock, { passive: true });
  wishPlay.addEventListener('click', go);

  if (REDUCED_MOTION){
    gsap.set([wishRoot, greetEl, nameEl, wishPlay], { opacity: 1 });
    wishPlay.focus({ preventScroll: true });
    return;
  }

  /* This arrives while the gate is still fading out beneath it —
     same dark ground on both, so one dissolves into the other with
     no black flash between them. The greeting, then her name, then
     the way forward: the order she would read them in anyway. */
  tl = gsap.timeline()
    .to(wishRoot, { opacity: 1, duration: .9, ease: 'power2.out' }, 0)
    .to(greetEl,  { opacity: 1, duration: 1.2, ease: 'power2.out' }, .35)
    .to(nameEl,   { opacity: 1, duration: 1.2, ease: 'power2.out' }, .95)
    .to(wishPlay, { opacity: 1, duration: 1.0, ease: 'power2.out' }, 1.7)
    // Focused only once it is actually visible — focusing a button she
    // cannot see yet is how a keyboard user ends up pressing Enter on
    // nothing.
    .call(() => { wishPlay.focus({ preventScroll: true }); }, null, 2.2);
}

function rollCue(then){
  const V = (C.film && C.film.volumeCue) || {};
  const line = V.line || '';

  // The only two reasons to skip it, both static and both decided in
  // content.js: no words to show, or no song to turn up. The audio
  // element gets no vote — see the note above. The song still has to
  // arrive somewhere, so it arrives here.
  const hasSong = !!(C.music && C.music.src);
  if (!line || !hasSong){ beginSong(); then(); return; }

  /* The silent-switch warning belongs on her phone and nowhere else.
     The question is "is this a touch device?", so the honest test is
     whether there is a pointer that can hover — not a screen width,
     which says nothing about the hardware. Same reasoning the gate's
     chase used to use. */
  const touchDevice = typeof matchMedia === 'function'
    && matchMedia('(hover: none) and (pointer: coarse)').matches;

  $('cueLine').textContent = line;
  $('cueNote').textContent = (touchDevice && V.noteTouch) || V.note || '';

  const hold = Math.max(1, Number(V.hold) || 4);
  const icon = cueRoot.querySelector('.cue__icon');
  const note = $('cueNote');
  const meter = cueRoot.querySelector('.cue__meter');

  cueRoot.hidden = false;

  let done = false;
  let tl = null;
  function go(){
    if (done) return;                  // tap and timer can both arrive
    done = true;
    cueRoot.removeEventListener('pointerdown', go);
    removeEventListener('keydown', go);

    // She may have tapped a quarter of a second in, while the card is
    // still arriving. Kill the intro outright — otherwise its fade-IN
    // and this fade-OUT tween the same property against each other and
    // the card flickers instead of leaving.
    if (tl) tl.kill();
    gsap.killTweensOf([cueRoot, cueFill]);

    if (REDUCED_MOTION){
      cueRoot.hidden = true;
      then();
      return;
    }
    // Out first, then the film — never both at once, or the first
    // act plays behind a card that is still there.
    gsap.to(cueRoot, {
      opacity: 0, duration: .7, ease: 'power2.inOut',
      onComplete: () => { cueRoot.hidden = true; then(); },
    });
  }

  // Every way she might say "yes, I'm ready" before the timer does.
  cueRoot.addEventListener('pointerdown', go);
  addEventListener('keydown', go);

  if (REDUCED_MOTION){
    gsap.set([cueRoot, icon, $('cueLine'), note, meter], { opacity: 1 });
    gsap.set(cueFill, { scaleX: 1 });
    beginSong(1.6);
    setTimeout(go, hold * 1000);
    return;
  }

  /* The card arrives while the gate is still fading out beneath it.
     That overlap is the point: both are the same dark ground, so
     there is no black flash between them — one dissolves into the
     other the way a film reel changes over. */
  tl = gsap.timeline()
    .to(cueRoot,      { opacity: 1, duration: .8, ease: 'power2.out' }, 0)
    /* The song arrives HERE and nowhere earlier. Everything before this
       — the gate, the four beats, the dissolve — is silent, so the first
       note lands on the card that asks her to listen for it. It starts a
       beat after the card so the words land first and the music answers
       them, rather than the two shouting over each other. */
    .call(() => beginSong(2.6), null, .35)
    .to(icon,         { opacity: 1, duration: .9, ease: 'power2.out' }, .25)
    .to($('cueLine'), { opacity: 1, duration: .9, ease: 'power2.out' }, .5)
    .to(note,         { opacity: .95, duration: .9, ease: 'power2.out' }, .85)
    .to(meter,        { opacity: 1, duration: .6, ease: 'power2.out' }, 1.1)
    // Linear, and exactly as long as the hold: this line is a promise
    // about time, so it must not ease or it starts telling a small lie.
    .to(cueFill,      { scaleX: 1, duration: hold, ease: 'none' }, 1.1)
    .call(go, null, 1.1 + hold);
}

/* Add ?reset to the URL to clear the remembered mute choice. The gate
   itself remembers nothing — every load asks the secret question again
   — so there is nothing else to forget. Purely a testing convenience.
   The query string is stripped straight afterwards so a reload doesn't
   keep re-clearing. */
if (new URLSearchParams(location.search).has('reset')){
  try {
    localStorage.removeItem('ourstory.muted');
  } catch { /* private mode — nothing was stored anyway */ }
  history.replaceState(null, '', location.pathname);
}

const gate = createGate({
  content: C,
  root: gateRoot,
  // Fires synchronously inside the tap — the one moment a browser will
  // let audio begin, so it must not be deferred. This only UNLOCKS the
  // song and plays it at volume 0; nothing is audible until the volume
  // card's play button calls audio.swell(). See the top of audio.js.
  onGesture: () => audio.start(),
  // Fires after the button has beaten four times. The wish waits for
  // her to press play, the volume card holds the room for a moment,
  // and then the film begins.
  onEnter: () => rollWish(() => rollCue(startFilm)),
});

// The secret question is asked on every load, refresh included.
gate.show();

} catch (err) {
  showBootError(err);
}
