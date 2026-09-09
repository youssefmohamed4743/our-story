# Fill me in

Everything runs already — the film plays, the site scrolls, the placeholders are
in place. What is missing is the part only you can write.

**You only ever edit one file: `content.js`.** Nothing personal lives anywhere else.

---

## 1. Run it

```bash
npm install
npm run dev
```

Open the link it prints. The secret answer is currently **`dahab`**.

---

## 2. Add your photos

Drop your pictures into `public/photos/`. Then in `content.js`, point each
`story` entry at one:

```js
{ photo: 'photos/first-night.jpg', date: 'April 2023', title: 'The night we met',
  text: 'What you actually remember about it.', inFilm: true },
```

- **Any shape works** — portrait, landscape, square. They are cropped to fit.
- **Aim for ~1600px on the long side.** Straight-off-the-phone photos are often
  4–6 MB each; ten of those is a 50 MB page that takes forever on her data.
  Squoosh.app or any "compress image" tool will get them under 400 KB with no
  visible loss.
- Delete the five `photos/0X.jpg` placeholders once yours are in.
- A photo that isn't there yet shows a soft striped placeholder, never a broken
  image — so you can add them one at a time without the site ever looking broken.

### `inFilm: true` — read this bit

Mark **three or four** of your best moments with `inFilm: true`. Those, and only
those, appear in the opening film — as glimpses, with the date and title but not
the text.

That restraint is deliberate. If the film showed everything, she would have already
seen the whole gift by the time it ended and had no reason to scroll. The film is
the trailer. The site is the feature.

---

## 3. Add the song

Put one `.mp3` into `public/music/` and set:

```js
music: { src: 'music/our-song.mp3', title: 'Our Song', startVolume: 0.35 },
```

It starts when she taps to come in — browsers refuse to play audio before a real
tap, so the gate does double duty. It fades up over two seconds rather than
blaring, loops forever, and she can mute it with the ♪ button in the corner.

If there is no file yet, the button simply doesn't appear. Nothing breaks.

---

## 4. Write the words

In `content.js`:

| Where | What |
|---|---|
| `her.name` | Her name. Used in the film, the letter, and the wish. |
| `dates.together` | The day you met. The film shows it; the last section counts the days since. |
| `gate.question` / `gate.answers` | The secret. Something only she would answer instantly. |
| `film.*` | The film's lines. **Keep these short** — they sit alone in huge type with nothing to hide behind. |
| `story[].text` | The real memories. Specific beats poetic every time. |
| `reasons[]` | 15–20 short lines. "The way you narrate what the cat is thinking" lands harder than "your beautiful soul". |
| `letter.paragraphs` | The whole letter. This is the part she will read twice. |
| `letter.filmLines` | Two or three teaser lines for the film only. |

---

## 5. Check it on a phone

This is the device that matters — she will not open it on a laptop.

```bash
npm run dev:phone
```

It prints a `Network:` address. Open that on your phone (same Wi-Fi). Check the
first screen isn't clipped, nothing scrolls sideways, and the Skip button is
easy to reach with one thumb.

**If the film feels too long**, open `film.js` and change one number near the top:

```js
const PACE = 1;    // 1.00 ≈ 50s · 0.80 ≈ 40s · 0.65 ≈ 33s
```

---

## 6. Send it to her

```bash
npm run build
```

Then drag the `dist/` folder onto **[app.netlify.com/drop](https://app.netlify.com/drop)**.
You get a link in under a minute, no account or git required. Rename the site to
something nicer in Netlify's settings, then send her the link.

**Before you send it:** open `index.html`, find the `og:image` line near the top,
and change it from `preview.png` to the full link
(`https://your-site.netlify.app/preview.png`, using your actual Netlify URL).
Skip this and the chat preview in WhatsApp/iMessage may not show your image at all —
it's the one thing in this whole setup you can't know until after you've deployed,
so it's easy to forget. Rebuild (`npm run build`) and re-drag the `dist/` folder
after changing it.

*(The GitHub Pages workflow in `.github/` also works, but this folder isn't a git
repository yet, so that route needs `git init` and a GitHub repo first.)*

---

## A word about the gate

The accepted answers are inside the JavaScript, so anyone who opens developer
tools can read them. **It is a romantic front door, not security.** What it does
buy you is real: the link doesn't open straight into your photos for anyone who
stumbles on it, search engines are told to stay away, and she gets a small "he
knew I'd know that" moment.

If you ever want it genuinely private, use Netlify's or Vercel's password
protection instead.

---

## What's where

| File | |
|---|---|
| **`content.js`** | **Everything you edit.** |
| `film.js` / `film.css` | The five-act opening film. |
| `story.js` / `story.css` | The five scrolling sections. |
| `gate.js`, `audio.js`, `main.js` | The door, the song, and the wiring. |
| `lib/canvas.js` | Canvas particle/sprite engine. |
| `base.css` | Palette, type, grain. Change colours here and both the film and the site follow. |
| `legacy/` | The original bow-and-arrow film, kept intact. Nothing was deleted. |
