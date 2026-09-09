/* ============================================================
   audio.js — one song, looping, under the whole thing.

   Every browser refuses to start audio until a real user
   gesture. That is enforced by the browser, not a setting we
   can opt out of, and no amount of cleverness gets around it.
   So the gate's submit tap is the gesture.

   But the song is not supposed to be heard yet — it belongs to
   the volume card, a couple of seconds later. Hence the split
   this file is built around:

     start()  UNLOCK. Called inside the tap, because that is the
              only instant the browser allows. It plays at volume
              0 — running, and completely silent.
     swell()  SOUND. Called when the volume card appears. Fades
              from that silence up to the real level.

   Delaying the play() call itself instead would be the obvious
   approach and it is the wrong one: Safari in particular hands
   out permission to the gesture, not to the page, and a play()
   fired from a timer two seconds later can simply be refused.
   Playing silence keeps the permission and still gives us an
   exact moment to turn the sound on.

   It fades up over a couple of seconds rather than arriving at
   full volume — a song that swells feels intentional, a song
   that blares feels like an autoplay ad.
   ============================================================ */

import gsap from 'gsap';

const KEY = 'ourstory.muted';

export function createAudio({ content, toggle, resolve }){
  const M = (content && content.music) || {};
  const target = typeof M.startVolume === 'number' ? M.startVolume : 0.35;

  const audio = new Audio();
  audio.src = resolve(M.src || '');
  audio.loop = true;
  audio.preload = 'auto';
  // Let it play with the phone's ringer switch on silent — this is
  // the whole point of the gift, and she has an explicit mute here.
  audio.setAttribute('playsinline', '');

  /* IN the document, not floating beside it. `new Audio()` gives a
     detached element, and iOS is measurably less reliable with those —
     particularly once one is handed to createMediaElementSource(),
     where a detached element is a known source of a graph that runs,
     reports playing, and emits nothing. It costs one hidden node. */
  audio.style.display = 'none';
  if (document.body) document.body.appendChild(audio);
  else addEventListener('DOMContentLoaded', () => document.body.appendChild(audio));

  /* ============================================================
     HOLDING THE SILENCE — and why this needs Web Audio on iOS

     The requirement is awkward: begin the track inside her tap,
     because that is the only instant a browser permits it, but
     let nothing be heard until the volume card appears a couple
     of seconds later. Two obvious ways to do that, and iOS
     defeats both:

       volume = 0   iOS ignores the volume property entirely.
                    Level belongs to the hardware buttons; the
                    write is dropped and it still reads back 1.
                    The song plays at FULL volume from the tap.

       muted = true iOS honours the mute, so the silence holds —
                    but unmuting LATER, outside a gesture, does
                    not restore sound. The permission was granted
                    to a muted element, and quietly does not
                    extend to an unmuted one. Result: silence for
                    the entire visit.

     So the level is held OUTSIDE the element, in a Web Audio gain
     node, and the element itself plays unmuted from the tap —
     a genuine, complete unlock with nothing to revoke later.
     Gain is honoured on iOS, so this also buys back the fade the
     volume property could not give us, and makes the mute button
     work there for the first time.

     The element route is kept as a fallback for anything without
     Web Audio, where `muted` and `volume` behave properly anyway.
     ============================================================ */
  let ctx = null, gain = null;

  /* Built inside the first gesture, and exactly once — an element can
     only ever be handed to createMediaElementSource() one time. */
  function buildGraph(){
    if (ctx) return !!gain;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      /* THE SILENT SWITCH — the one thing that used to defeat all of
         this on an iPhone.

         Routing through Web Audio puts us in iOS's default audio
         session, which obeys the physical ringer switch: with it on,
         the graph runs, the element plays, every promise resolves,
         and nothing comes out. She turns the volume up, hears silence,
         and concludes the gift is broken.

         'playback' is the category a music or video app uses, and it
         plays THROUGH the switch. Safari 16.4+; older iOS ignores the
         assignment, which is exactly the behaviour we had before, so
         there is nothing to lose by asking. */
      try {
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
      } catch { /* not supported — the silent switch stays in charge */ }

      ctx = new AC();
      const src = ctx.createMediaElementSource(audio);
      gain = ctx.createGain();
      gain.gain.value = 0;               // the silence lives here
      src.connect(gain);
      gain.connect(ctx.destination);
      // Routed through the graph now, so the element must not attenuate
      // as well — the two would multiply.
      audio.volume = 1;
      audio.muted = false;
      return true;
    } catch {
      // Anything at all went wrong: fall back to the element's own
      // controls rather than leaving her with a half-built graph.
      ctx = null; gain = null;
      return false;
    }
  }

  /* Feature test for the fallback path only: can we set volume at all?
     Write-and-read-back is the only honest way to ask — there is no
     capability flag, and sniffing the user agent for "iPhone" would
     miss every other browser that behaves the same way. */
  audio.volume = 0;
  const CAN_FADE = audio.volume === 0;

  // Silence for the fallback path. The graph, if we get one, replaces
  // this with gain 0 and unmutes the element.
  audio.muted = true;

  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch { /* private mode */ }

  let started = false;
  let available = true;

  // A missing or unplayable file must not break anything else —
  // he may well be testing before he has picked the song.
  audio.addEventListener('error', () => {
    available = false;
    toggle.hidden = true;
  });

  function paint(){
    toggle.setAttribute('aria-pressed', String(muted));
    toggle.setAttribute('aria-label', muted ? 'Unmute music' : 'Mute music');
  }

  /* Let the button tell the truth about whether sound is coming out,
     rather than about what we last asked for. */
  audio.addEventListener('play',  () => toggle.classList.add('is-playing'));
  audio.addEventListener('pause', () => toggle.classList.remove('is-playing'));

  /* The one place level is changed, so callers never have to know which
     of the two routes is live. Through the graph it is a gain ramp that
     works on every platform; without one it falls back to the element's
     volume, and to a clean cut where even that is refused. */
  function fadeTo(v, dur = 1.8){
    if (gain){
      gsap.killTweensOf(gain.gain);
      gsap.to(gain.gain, { value: v, duration: dur, ease: 'power2.out' });
      return;
    }
    if (!CAN_FADE) return;
    gsap.killTweensOf(audio);
    gsap.to(audio, { volume: v, duration: dur, ease: 'power2.out' });
  }

  /* Level, immediately and with no animation. */
  function setLevel(v){
    if (gain){ gsap.killTweensOf(gain.gain); gain.gain.value = v; return; }
    if (CAN_FADE){ gsap.killTweensOf(audio); audio.volume = v; }
  }

  /* Every event that could plausibly count as "she touched the page".
     The first one that lands starts the song, then they all detach. */
  const GESTURES = ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click', 'wheel', 'scroll'];

  /* …but only these COUNT as a gesture for the purpose of building the
     audio graph. A scroll or a wheel is a fine excuse to retry play(),
     and it is not user activation: a context created during one is born
     suspended on iOS with no way back. Those two retry; they do not
     build. */
  const ACTIVATING = new Set(['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click']);
  let armed = false;

  function disarm(){
    if (!armed) return;
    armed = false;
    for (const t of GESTURES) removeEventListener(t, onGesture, true);
  }
  function onGesture(e){ start(!!e && ACTIVATING.has(e.type)); }

  /* Arm autoplay as early as possible.

     Browsers refuse to play audio until the page has had a real user
     gesture — that is enforced by the browser and there is no way to
     code around it. What we CAN do is take the very first opportunity:

       1. try immediately, which actually succeeds more often than you'd
          expect — Chrome grants autoplay to origins the user has
          engaged with before, and installed/home-screen apps qualify too
       2. if that is refused, listen for every plausible first gesture
          in the CAPTURE phase, so we hear it before anything else can
          stop it — a tap, a key, a scroll, anything at all

     The practical result: it starts on her first touch of the page,
     usually the same tap that opens the gate. */
  function arm(){
    if (!available || armed) return;

    // Listen FIRST, attempt second. start() flips `started` synchronously
    // but play() only rejects a tick later, so checking `started` before
    // arming would always look like success and we would never listen for
    // the gesture at all. start() disarms itself if the attempt works.
    armed = true;
    for (const t of GESTURES) addEventListener(t, onGesture, true);
    // false: there is no gesture yet, so this attempt must NOT build the
    // graph — see start().
    start(false);
  }

  /* UNLOCK — silent on purpose. See the note at the top of the file:
     this has to happen inside the gesture, and the element stays muted
     until swell() asks for sound. */
  function start(fromGesture = false){
    if (started || !available) return;
    started = true;

    /* THE GRAPH IS BUILT ONLY INSIDE A REAL GESTURE, and this flag is
       the whole point of it.

       The note above is right and the old code broke its own rule: it
       built the graph on every call, including the speculative attempt
       arm() makes at page load, before she has touched anything. On
       iOS that created a suspended AudioContext and — permanently,
       because an element can only be handed to
       createMediaElementSource() once — routed the song through it.
       From that moment the element was downstream of a context that
       had never been allowed to start, so every later play() resolved
       happily and produced silence for the entire visit.

       So: no gesture, no graph. Without one this attempt is just a
       plain element play(), which is free to fail and be retried. */
    if (fromGesture) buildGraph();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});

    const p = audio.play();
    if (p && typeof p.catch === 'function'){
      p.then(() => {
        // We're playing — stop listening for a gesture we no longer need.
        disarm();
      }).catch(() => {
        // Refused. Stay armed so the next gesture tries again.
        started = false;
      });
    }
  }

  /* SOUND — the moment the song actually arrives, which is the volume
     card and nowhere earlier.

     The toggle is revealed here rather than in start(), so the control
     appears with the thing it controls. A mute button floating over a
     silent gate is a puzzle she should never have to solve.

     Safe to call more than once: the fade simply retargets. */
  function swell(dur = 2.6){
    if (!available) return;

    /* swell() is only ever reached from something she pressed — the
       wish card's play button, or the mute toggle — so this IS a
       gesture, and it is the last chance to build the graph if the
       earlier attempts never got one. Build before start(), so the
       play() below already runs through the gain node. */
    if (!ctx) buildGraph();
    if (!started) start(true);      // the gesture was refused — try again now
    toggle.hidden = false;
    paint();
    if (muted) return;              // she chose silence — leave it silent

    // A context can be suspended again by the browser while the page is
    // backgrounded, and comes back suspended. By now she has tapped, so
    // this resume is allowed.
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});

    // Order matters. Put the level at zero BEFORE opening the element,
    // or the first instant of the song escapes at full volume as a click
    // in front of the fade.
    setLevel(0);
    audio.muted = false;

    audio.play().catch(() => {});   // no-op when it is already running
    fadeTo(target, dur);
  }

  toggle.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* ignore */ }
    paint();

    if (muted){
      fadeTo(0, 0.6);
      // Belt and braces on the element too — but ONLY where the element
      // is the thing carrying the sound. Muting it while the graph is
      // live would be unrecoverable on iOS: unmuting later, outside a
      // gesture, is exactly the thing that does not work there.
      if (!gain && !CAN_FADE) audio.muted = true;
    } else {
      // Unmuting is itself a gesture, so this doubles as the retry path
      // if the very first play() was refused. swell() covers both: it
      // unlocks if it must, then brings the volume up either way.
      swell(1.2);
    }
  });

  paint();
  return {
    /* Every external caller is inside something she pressed — the gate's
       submit, the wish card's play button — so the public start() always
       counts as a gesture. arm()'s speculative attempt is the only one
       that does not, and it calls the internal start(false) directly. */
    start: () => start(true),
    swell,
    arm,
    get playing(){ return started && !audio.paused },
    get muted(){ return muted },
    // false once the file has failed to load — main.js checks this
    // before showing the toggle, so a missing song leaves no dead button.
    get available(){ return available },
  };
}
