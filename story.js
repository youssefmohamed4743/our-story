/* ============================================================
   story.js — the five scrolling sections.

     1  Our Story           every moment, in full
     2  Reasons I Love You  tap-to-turn cards
     3  The Letter          the whole letter
     4  The Photo Wall      everything else
     5  The Birthday Wish   the counter, the message, replay

   Act 3 of the film shows three or four photos with a date and
   a title and nothing more. This is where those moments — and
   all the others — actually pay off. The film is the trailer;
   this is the feature.

   Reveals use one shared IntersectionObserver rather than a
   scroll listener: cheaper, and it will not stutter on a phone.
   ============================================================ */

import { REDUCED_MOTION, easeOutCubic } from './lib/canvas.js';

/* Photos whose file isn't there yet. The lightbox skips these so she
   never pages into an empty frame. */
const missing = new Set();

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* Whole days between two dates, ignoring clock time and DST. */
function daysSince(iso){
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  const then = Date.UTC(y, m - 1, d);
  const now  = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const n = Math.floor((today - then) / 86400000);
  return n >= 0 ? n : null;
}

/* One photo, as a button that opens the lightbox.

   It is handed the whole GROUP it belongs to plus its index, so the
   lightbox can page through that group and no further. The story
   chapters and the photo wall are separate groups on purpose —
   swiping through the wall should never wander into the chapters.

   A photo that hasn't been added yet degrades to a soft striped
   placeholder — never a broken-image icon in a gift. */
function makePhoto(item, onOpen, group, index){
  const btn = el('button', 'photo');
  btn.type = 'button';
  btn.dataset.placeholder = item.title || 'a photo goes here';
  btn.setAttribute('aria-label', item.title ? `View photo: ${item.title}` : 'View photo');

  const img = el('img');
  img.src = item.photo;
  img.alt = item.title || '';
  img.loading = 'lazy';
  img.decoding = 'async';
  // A photo that isn't there yet names the file it wants, so adding
  // them one at a time is obvious rather than a guessing game.
  img.addEventListener('error', () => {
    missing.add(item.photo);
    btn.classList.add('is-missing');
    const file = String(item.photo).split('/').pop();
    btn.dataset.placeholder = file ? `add ${file}` : 'a photo goes here';
  });
  btn.append(img);

  btn.addEventListener('click', () => {
    if (btn.classList.contains('is-missing')) return;
    // Page only over photos that actually loaded — paging into an empty
    // slot would show a blank frame with no way to tell what went wrong.
    const live = (group || [item]).filter((g) => g && g.photo && !missing.has(g.photo));
    const at = Math.max(0, live.indexOf(item));
    onOpen(live, at, btn);
  });
  return btn;
}

export function buildStory({ content, root, onReplay, openLightbox }){
  const C = content;
  const UI = C.ui || {};
  const withPhotos = (Array.isArray(C.story) ? C.story : []).filter((s) => s && s.photo);

  root.innerHTML = '';

  /* The film's last frame, held for one screen before the paper
     rises over it. This is the handoff — it is meant to feel like
     the film simply kept going. */
  root.append(el('div', 'story__spacer'));

  const sheet = el('div', 'story__sheet');
  root.append(sheet);

  const head = (eyebrow, title) => {
    const h = el('header', 'section__head reveal');
    if (eyebrow) h.append(el('p', 'section__eyebrow', eyebrow));
    h.append(el('h2', 'section__title', title));
    h.append(el('span', 'section__rule'));
    return h;
  };

  /* ==========================================================
     1 — OUR STORY
     ========================================================== */
  if (withPhotos.length || (C.story || []).length){
    const sec = el('section', 'section');
    sec.append(head(UI.storyEyebrow, UI.storyTitle || 'Our Story'));

    const list = el('div', 'chapters');
    const chapterPhotos = (C.story || []).filter((s) => s && s.photo);
    (C.story || []).forEach((item) => {
      const art = el('article', 'chapter reveal');

      if (item.photo){
        const media = el('div', 'chapter__media');
        media.append(makePhoto(item, openLightbox, chapterPhotos, chapterPhotos.indexOf(item)));
        art.append(media);
      }

      const body = el('div', 'chapter__body');
      if (item.date)  body.append(el('p',  'chapter__date',  item.date));
      if (item.title) body.append(el('h3', 'chapter__title', item.title));
      if (item.text)  body.append(el('p',  'chapter__text',  item.text));
      art.append(body);

      list.append(art);
    });
    sec.append(list);
    sheet.append(sec);
  }

  /* ==========================================================
     2 — REASONS I LOVE YOU
     ========================================================== */
  const reasons = Array.isArray(C.reasons) ? C.reasons : [];
  if (reasons.length){
    const sec = el('section', 'section section--tint');
    sec.append(head(UI.reasonsEyebrow, UI.reasonsTitle || 'Reasons I Love You'));

    const grid = el('div', 'reasons');
    reasons.forEach((text, i) => {
      const btn = el('button', 'reason reveal');
      btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false');

      const inner = el('span', 'reason__inner');
      const back  = el('span', 'reason__face reason__face--back');
      back.append(el('span', 'reason__num', String(i + 1).padStart(2, '0')));
      if (i === 0 && UI.reasonsHint) back.append(el('span', 'reason__hint', UI.reasonsHint));

      const front = el('span', 'reason__face reason__face--front', text);
      inner.append(back, front);
      btn.append(inner);

      // The card's accessible name is the reason itself, so a screen
      // reader gets the content without needing to "flip" anything.
      btn.setAttribute('aria-label', text);
      btn.addEventListener('click', () => {
        btn.setAttribute('aria-expanded', btn.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
      });

      grid.append(btn);
    });
    sec.append(grid);
    sheet.append(sec);
  }

  /* ==========================================================
     3 — THE LETTER
     ========================================================== */
  const L = C.letter || {};
  const paras = Array.isArray(L.paragraphs) ? L.paragraphs : [];
  if (paras.length){
    const sec = el('section', 'section');
    sec.append(head(UI.letterEyebrow, UI.letterTitle || 'The Letter'));

    const card = el('div', 'letter reveal');
    if (L.opening) card.append(el('p', 'letter__opening', L.opening));
    // Each paragraph reveals on its own, so she reads at the pace
    // the page sets rather than being handed a wall of text.
    paras.forEach((p) => card.append(el('p', 'letter__p reveal', p)));
    if (L.signoff)   card.append(el('p', 'letter__signoff reveal', L.signoff));
    if (L.signature) card.append(el('p', 'letter__signature reveal', L.signature));

    sec.append(card);
    sheet.append(sec);
  }

  /* ==========================================================
     4 — THE PHOTO WALL
     The extras from `gallery` first — pictures that never got a
     chapter — then the story photos, so the section is an album
     rather than a repeat of what she just scrolled through.
     Set ui.wallShowsStoryPhotos to false to show only the extras.
     ========================================================== */
  const gallery = (Array.isArray(C.gallery) ? C.gallery : []).filter((g) => g && g.photo);
  const wallItems = [
    ...gallery.map((g) => ({ ...g, title: g.caption || '' })),
    ...(UI.wallShowsStoryPhotos === false ? [] : withPhotos),
  ];

  if (wallItems.length){
    const sec = el('section', 'section section--tint');
    sec.append(head(UI.wallEyebrow, UI.wallTitle || 'Us'));

    const grid = el('div', 'wall');
    wallItems.forEach((item, i) => {
      const wrap = el('div', 'reveal');
      const photo = makePhoto(item, openLightbox, wallItems, i);
      // a fixed, repeating tilt — random would reshuffle on every
      // re-render and never settle
      photo.style.setProperty('--tilt', `${[-2.2, 1.6, -1.1, 2.4, -1.8, 1.2][i % 6]}deg`);
      wrap.append(photo);
      grid.append(wrap);
    });
    sec.append(grid);
    sheet.append(sec);
  }

  /* ==========================================================
     5 — THE BIRTHDAY WISH
     ========================================================== */
  {
    const CL = C.closing || {};
    const sec = el('section', 'wish');

    const days = daysSince(C.dates && C.dates.together);
    if (days != null){
      const box = el('div', 'reveal');
      const counterFinal = days.toLocaleString('en-US');
      const counterEl = el('p', 'wish__counter', (REDUCED_MOTION || !('IntersectionObserver' in window)) ? counterFinal : '0');
      box.append(counterEl);
      box.append(el('p', 'wish__label', CL.counterLabel || 'days since our paths crossed'));
      sec.append(box);

      // Count up from 0 the moment she scrolls to it, rather than the
      // number just appearing — same rootMargin/threshold as the shared
      // reveal observer below, so the motion feels like one gesture.
      if (!REDUCED_MOTION && 'IntersectionObserver' in window){
        const countIO = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            countIO.disconnect();
            const start = performance.now(), dur = 1400;
            const tick = (now) => {
              const p = Math.min((now - start) / dur, 1);
              counterEl.textContent = Math.round(days * easeOutCubic(p)).toLocaleString('en-US');
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
        }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
        countIO.observe(box);
      }
    }

    const h = el('h2', 'wish__headline reveal');
    h.append(document.createTextNode(CL.headline || 'Happy Birthday'));
    if (C.her && C.her.name) h.append(el('span', 'wish__name', C.her.name));
    sec.append(h);

    if (CL.message) sec.append(el('p', 'wish__message reveal', CL.message));

    const actions = el('div', 'wish__actions reveal');

    const replay = el('button', 'replay');
    replay.type = 'button';
    replay.append(document.createTextNode(CL.replay || 'watch it again'));
    replay.append(el('span', 'replay__heart', '♥'));
    replay.addEventListener('click', onReplay);
    actions.append(replay);

    /* One tap to answer. Rendered only when a number is configured —
       a dead button at the emotional peak is worse than no button. */
    const R = CL.reply || {};
    const digits = String(R.number || '').replace(/\D/g, '');
    if (digits){
      const a = el('a', 'reply', R.label || 'say something back');
      a.href = `https://wa.me/${digits}?text=${encodeURIComponent(R.message || '')}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      actions.append(a);
    }

    /* --------------------------------------------------------
       ONE MORE THING — one quiet final message, not a string of
       separate quotes. Easy to miss until she's decided the site
       is already finished. Lives inside the closing section
       rather than a new one, so it never reads as a sixth
       chapter. Opens once per visit — no modal, no new page, no
       particles. The headline, the short note underneath it, and
       the signature arrive as one brief cascade rather than all
       at once, using the same opacity/transform technique as
       every other reveal on the page, just staggered by a timer.
       -------------------------------------------------------- */
    const OMT = C.oneMoreThing || {};
    if (OMT.message){
      const omt = el('div', 'one-more reveal');

      const trigger = el('button', 'one-more__trigger', OMT.label || 'One more thing…');
      trigger.type = 'button';
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', 'oneMoreMessage');

      const msg = el('p', 'one-more__message', OMT.message);
      msg.id = 'oneMoreMessage';
      msg.hidden = true;

      /* One photo opening the cascade — the picture arrives, then the
         words land on top of it. Deliberately not a `.photo` button:
         it belongs to the ending, not to the wall, so it never opens
         the lightbox and never draws a striped "add 31.JPG" panel if
         the file is missing — it just quietly removes itself. */
      let pic = null;
      if (OMT.photo){
        pic = el('figure', 'one-more__photo');
        const pimg = el('img');
        pimg.src = OMT.photo;
        pimg.alt = '';
        pimg.loading = 'lazy';
        pimg.decoding = 'async';
        pimg.addEventListener('error', () => pic.remove());
        pic.append(pimg);
        pic.hidden = true;
      }

      const note = OMT.note ? el('p', 'one-more__note', OMT.note) : null;
      if (note) note.hidden = true;

      const sig = OMT.signature ? el('p', 'one-more__signature', OMT.signature) : null;
      if (sig) sig.hidden = true;

      let revealed = false;
      trigger.addEventListener('click', () => {
        if (revealed) return;   // a surprise, not a toggle — once per visit
        revealed = true;
        trigger.setAttribute('aria-expanded', 'true');
        trigger.classList.add('is-opened');

        [pic, msg, note, sig].forEach((n) => { if (n) n.hidden = false; });

        // Let the browser paint `hidden` removal first, or the first
        // transition in the cascade has nothing to animate from.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (pic) pic.classList.add('is-in');
          const after = (ms) => (pic && !REDUCED_MOTION ? ms + 300 : ms);
          if (pic && !REDUCED_MOTION) setTimeout(() => msg.classList.add('is-in'), 300);
          else msg.classList.add('is-in');
          if (note) setTimeout(() => note.classList.add('is-in'), REDUCED_MOTION ? 0 : after(450));
          if (sig)  setTimeout(() => sig.classList.add('is-in'),  REDUCED_MOTION ? 0 : after(750));
        }));
      });

      omt.append(trigger);
      if (pic) omt.append(pic);
      omt.append(msg);
      if (note) omt.append(note);
      if (sig) omt.append(sig);
      sec.append(omt);
    }

    // Watch it again now sits after the emotional cascade — a quiet
    // utility to revisit the film, not the thing the eye lands on
    // first at the end of the story.
    sec.append(actions);

    /* --------------------------------------------------------
       SIGNATURE — the very last thing on the page. A hidden
       signature, not a footer advert: its own tiny group.
       -------------------------------------------------------- */
    const SIG = C.signature || {};
    if (SIG.text){
      const foot = el('footer', 'site-signature reveal');
      foot.append(el('p', 'site-signature__text', SIG.text));
      if (SIG.name) foot.append(el('p', 'site-signature__name', SIG.name));
      if (SIG.date) foot.append(el('p', 'site-signature__date', SIG.date));
      sec.append(foot);
    }

    sheet.append(sec);
  }

  /* ==========================================================
     REVEALS — one observer for the whole page.
     ========================================================== */
  const targets = root.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)){
    targets.forEach((t) => t.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);          // reveal once; then stop watching
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  // Stagger siblings a little so a grid of cards arrives as a wave.
  let group = null, index = 0;
  targets.forEach((t) => {
    if (t.parentElement !== group){ group = t.parentElement; index = 0; }
    t.style.transitionDelay = `${Math.min(index++, 6) * 70}ms`;
    io.observe(t);
  });
}
