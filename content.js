/* ============================================================
   ✏️  THIS IS THE ONLY FILE YOU NEED TO EDIT.

   Everything personal lives here — her name, your dates, every
   photo, every caption, every reason, the whole letter. No name
   or memory is hardcoded anywhere else in the project.

   Nothing here has a required length. Write 3 memories or 30,
   5 reasons or 50 — the layouts are built to look right either
   way. Fill it in gradually; the site works at every stage.

   See FILL-ME-IN.md for the step-by-step checklist.
   ============================================================ */

export const CONTENT = {

  /* --- who this is for ------------------------------------ */
  her: {
    name: 'Jee',            // used in the film + the letter + the wish
    nickname: 'my love',     // used in a few softer moments
  },

  /* --- the two dates that matter --------------------------
     Format: 'YYYY-MM-DD'. The film shows `together` as the
     moment your paths crossed; the last section counts the
     days since it. `birthday` is currently unused on the page
     but kept here so it lives with the rest.                */
  dates: {
    birthday: '2026-09-20',
    together: '2025-11-11',
  },

  /* --- the soft secret gate -------------------------------
     A romantic front door, NOT real security — the answer is
     visible to anyone who opens the page source. It keeps
     strangers and search engines out, and gives her a small
     "how did he know I'd know" moment.

     `answers` can hold several accepted spellings. Matching
     ignores case, spaces, and punctuation, so 'Habibti' and
     'habibti!' both pass.                                    */
  gate: {
    intro:    'a little secret…',
    question: 'what is our Favorite memory?',
    answers:  ['dahab', 'Dahab', 'DAHAB',],
    hint:     'Rakzy ya bet !!!',
    button:   'start story',

    // On a computer, the button darts away the first four times the
    // cursor reaches for it, then gives in and stays put. One line
    // per dodge; the last one shows as it settles. Phones skip this
    // entirely — there is no cursor to run from.
    //
    // Pressing Enter will not skip the chase — she gets this line
    // instead until she has actually caught the button.
    chaseNudge: 'no shortcuts — catch it first 😉',

    chase: [
      'not so fast…',
      'nearly had me',
      'closer…',
      'alright, alright — I’m yours',
    ],
  },

  /* --- the song -------------------------------------------
     Drop ONE .mp3 into public/music/ and point `src` at it.
     It starts when she taps to enter (browsers block audio
     before a real tap — that is enforced, not a setting).
     startVolume 0–1. 0.35 is a gentle background level.     */
  music: {
    src: 'music/our-song.mp3',
    title: 'Our Song',
    startVolume: 0.90,
  },

  /* --- the film's words -----------------------------------
     Five acts: before you → two paths → they meet → memories
     → the letter → the wish. Keep these SHORT. They are held
     on screen alone, in large type, with nothing to hide
     behind. One clean line each beats three clever ones.    */
  film: {
    opening:      'Before you…',
    ordinary:     '…there was just another ordinary day.',
    meetingLabel: 'Then, one day —',
    meetingTitle: 'the day our paths crossed.',
    memoriesLead: 'And then the ordinary days started to matter.',
    andSomehow:   'And somehow…',
    closing:      'that ordinary day became my favorite story.',
    wish:         'Happy Birthday',
    outro:        'there is more to our story',

    /* The film's ENDING, now that the wish has its own card at the
       start. She has already been told 'Happy Birthday Jee' in full,
       in the largest type in the project — saying it again, identically,
       an act later would land flat. So the film closes on the quiet
       version of the same sentence instead: smaller, lowercase, italic.
       A callback, not a repeat.

       {name} and {nickname} are filled in from `her` at the top.

       Set this to '' to go back to the old ending — the full
       'Happy Birthday' + her name, at full size.                     */
    wishEcho:     'and happy birthday, {nickname}.',

    /* --- the card that opens the gift ----------------------
       The first thing she sees after answering the secret: her
       name, in the largest type here, and one button under it.

       Nothing advances on its own — no timer, no tap-anywhere.
       The film starts when she presses play and not before, which
       is the whole point of the card: the moment is hers to open.

       `greeting` and the name are the same words the film used to
       end on, so in the usual case you change nothing here but the
       button's word.                                                */
    wishCard: {
      greeting:  'Happy Birthday',
      play:      'play our story',
      // Read out in place of the ▶ by a screen reader.
      playLabel: 'Play our story',
    },

    /* --- the card before the film rolls --------------------
       The moment after she answers, before the first frame:
       one dark card asking her to turn the sound up, held for
       a few seconds like the "please silence your phones"
       slide in a cinema. The song has already started under
       it, so she can hear exactly what she is adjusting.

       `hold` is seconds. Around 4 is right — long enough to
       find the volume keys, short enough not to feel like a
       loading screen. She can tap to go early.

       It is skipped automatically if the song is missing or
       she has muted it, because telling her to turn up
       silence would be a strange way to begin.               */
    volumeCue: {
      line: 'turn your volume up and make sure your device not silent',
      note: 'this one is meant to be heard',

      /* Shown INSTEAD of `note` on a phone or tablet.

         There is one thing that defeats all of this silently: the
         physical silent switch on the side of an iPhone. With it
         on, iOS mutes the song outright and no code anywhere can
         override that — she would turn the volume up, hear
         nothing, and reasonably conclude it is broken. So on a
         touch device the card says so. On a laptop it would only
         be confusing, which is why it is a separate line.

         Leave it empty to use `note` everywhere.                */
      noteTouch: 'meant to be heard — check your silent switch',

      hold: 4,
    },

    /* The film's OWN photos — Act 3, up to five glimpses.
       These are separate from `story` below on purpose, so nothing
       she sees in the film turns up again when she scrolls.

       Only the date and title are shown, held about three seconds
       each. No body text: the film is the trailer, the site is the
       feature, and it should end owing her something.

       Pick your most striking pictures — these are the first ones
       she ever sees.                                              */
    shots: [
      { photo: 'photos/01.JPG', title: 'The night we met' },
      { photo: 'photos/02.JPG', title: 'When everything started' },
      { photo: 'photos/03.jpg', title: 'Our first adventure' },
      { photo: 'photos/04.JPG', title: 'More memories together' },
      { photo: 'photos/05.JPG', title: 'And then us' },
    ],
  },

  /* --- your story -----------------------------------------
     The heart of the whole thing. Each entry is one moment.

       photo  — a file in public/photos/ (path is relative,
                no leading slash). Any shape works.
       date   — free text. 'April 2023', 'that summer',
                'the night it rained' — it does not have to
                be a real date.
       title  — a short headline for the moment.
       text   — the actual memory. Write as much as you like.
     The film does NOT pull from this list — it has its own
     photos in `film.shots` above, so nothing repeats.

     Aim for 8–12 entries total. Order them chronologically —
     they read as a journey.                                  */
  story: [
        {
      photo: 'photos/09.JPG',
      date:  'September 2025',
      text:  'Every picture here reminds me of a different moment, but they all have one thing in common — you❤️',
    },
    {
      photo: 'photos/06.JPG',
      date:  'October 2025',
      text:  'Looking back at all these moments, I realize how lucky I am to have you in my life😍',
    },
    {
      photo: 'photos/08.JPG',
      date:  'November 2025',
      text:  'You’ve been there through so many little moments, and somehow those are the ones I remember the most🌍',
    },
        {
      photo: 'photos/10.JPG',
      date:  'February 2026',
      text:  'I don’t know what the future holds, but I know I want to keep making memories with you. ❤️🌍',
    },
    {
      photo: 'photos/07.JPG',
      date:  'April 2026',
      text:  'I love how we can turn even the simplest days into memories I never want to forget❤️',
    },
    {
      photo: 'photos/32.JPG',
      date:  'August 2026',
      text:  'No matter how much time passes, I’ll always be grateful for every moment we’ve shared. ❤️',
    },
  ],

  /* --- the photo wall -------------------------------------
     EXTRA photos, for the last section only. These are not part
     of the story timeline — no chapter, no long text, just
     pictures. Use them for everything that didn't earn its own
     chapter but you still want her to see.

     Drop the files into public/photos/ and point each entry at
     one. Add as many as you like; the grid handles any number.
     A file that isn't there yet shows a soft placeholder telling
     you which filename to add, so nothing ever looks broken.

       photo   — a file in public/photos/
       caption — OPTIONAL. Shown when she taps to enlarge.       */
  gallery: [
    { photo: 'photos/11.JPG', caption: 'us' },
    { photo: 'photos/12.JPG', caption: 'us' },
    { photo: 'photos/13.JPG', caption: 'us' },
    { photo: 'photos/14.jpg', caption: 'us' },
    { photo: 'photos/15.JPG', caption: 'us' },
    { photo: 'photos/16.jpg', caption: 'us' },
    { photo: 'photos/17.JPG', caption: 'us' },
    { photo: 'photos/18.JPG', caption: 'us' },
    { photo: 'photos/19.JPG', caption: 'us' },
    { photo: 'photos/20.JPG', caption: 'us' },
    { photo: 'photos/21.JPG', caption: 'us' },
    { photo: 'photos/22.JPG', caption: 'us' },
    { photo: 'photos/23.JPG', caption: 'us' },
    { photo: 'photos/24.JPG', caption: 'us' },
    { photo: 'photos/25.JPG', caption: 'us' },
    { photo: 'photos/26.JPG', caption: 'us' },
    { photo: 'photos/27.JPG', caption: 'us' },
    { photo: 'photos/28.JPG', caption: 'us' },
    { photo: 'photos/29.JPG', caption: 'us' },
    { photo: 'photos/30.JPG', caption: 'us' },
  ],

  /* --- reasons i love you ---------------------------------
     Short, specific, one line each. Specific always beats
     poetic: 'the way you narrate what the cat is thinking'
     lands harder than 'your beautiful soul'.

     15–20 is the sweet spot. She taps each card to reveal it.  */
  reasons: [
    'You make ordinary moments feel special.',
    'The way you make me feel like I am the only person in the world.',
    'That you never let me get away with a bad mood in silence.',
    'Your smile, eyes, pretty, everything about you.',
    'How safe it feels to be completely myself around you.',
    'You are always there when I need you.',
    'I do not care where we end up, as long as I am with you.',
    'I love our random conversations that make us happy.',
    'That you are the first person I want to tell everything to.',
    'Because with you, things just feel right.',
    'How you argue with me and still hold my hand.',
    'That you make me want to be better without ever asking me to be.',
    'Because I want you in my future and beside me all the time.',
    'Because I never expected to find someone like you, and now I can’t imagine my life without you.',
    'Because you are my best friend, my partner, and my love all in one.',
    'Because you are my favorite notification and I could spend hours talking to you.',
    'Because I can never stay mad at you for long.',
    'I want keep growing with you and make more memories with you.',
    'You became my favorite part of every day and I choose you every time.',
    'Because even doing nothing with you is fun.',
    'Because my favorite part in my day to annoy you and you put up with me.',
    'I love the story we are creating together and I love how far we have come.',
    'I love sharing my life with you and I love how much you care.',
    'I love our "where should we go?" moments, jokes, late night talks, random pictures, time together.',
    'You feel like home, make me feel like I am not alone, support me every time I need, make me feel better, understand me without saying much.',
    'Your happiness makes me happy, and I love hearing your voice.',
    'I love how kind you are, I love how you always try and I admire the person you are.',
    'You bring out the best in me, you listen to me, you remember the little things I tell you, you know how to calm me down.',
  ],

  /* --- the letter -----------------------------------------
     The full letter lives in `paragraphs` and appears in the
     website's letter section. The film shows only `filmLines`
     — two or three teaser lines — so the real letter still
     lands as a surprise when she scrolls to it.

     Write the letter properly. Take your time with it. It is
     the part she will read twice.                             */
  letter: {
    opening: 'Dear Jee,',

    // 2–3 short lines, shown in the film's fourth act only.
    filmLines: [
      "I don't know if I ever told you this…",
      'but all of my favorite memories begin with you.',
    ],

    // The real letter. One string per paragraph, as many as you want.
    paragraphs: [
      "I honestly don't know how to start this without making it sound way more serious than I mean it to, so I'll just say it the way I would say it to you.",
      "It's crazy to think about how much has happened since we first met. So many things changed, we grew up, went through different moments, and somehow we're still here, making another memory together.",
      "Looking back at all of it makes me realize that I wouldn't want to change our story. Even the small things, the random days, the things we probably forgot about, they all became a part of something that means a lot to me.",
      "I'm really excited for everything we haven't done yet. There are still so many places to go, things to try, days to spend together, and memories we haven't made yet.",
      "I don't know exactly what the next years will look like, but I hope when we look back at this someday, we'll laugh at how young we were and how much we still had ahead of us.",
      "So here's to everything we've been through, everything we're about to go through, and all the memories still waiting for us.",
      'Happy birthday, my love.',
      'I hope this new year of your life is full of everything that makes you happy. And selfishly, I hope I get to be a part of as much of it as possible.',
      "I'm so happy I get to celebrate another year of you, and I can't wait to see what this year brings us.",
      "Here's to you, to us, and to everything that's still ahead. ❤️",
    ],

    signoff:   'Always yours,',
    signature: 'TETE',
  },

  /* --- section headings ------------------------------------
     The website's five section titles. Change the wording if
     something else sounds more like you.                      */
  ui: {
    storyEyebrow:    'chapter one',
    storyTitle:      'Our Story',
    reasonsEyebrow:  'in no particular order',
    reasonsTitle:    'Reasons I Love You',
    reasonsHint:     'tap to turn over',
    letterEyebrow:   'the rest of what I wanted to say',
    letterTitle:     'The Letter',
    wallEyebrow:     'everything else',
    wallTitle:       'Us',

    // false = the photo wall shows ONLY the `gallery` photos, so no
    // picture appears twice in the whole site: Our Story gets its
    // photos, the wall gets its own. Set to true if you'd rather the
    // wall also collect the story photos into one album at the end.
    wallShowsStoryPhotos: false,
  },

  /* --- the closing wish ----------------------------------- */
  closing: {
    headline: 'Happy Birthday',
    message:  "Here's to another year of ordinary days that turn out to matter.",
    counterLabel: 'days since our paths crossed',
    replay: 'watch it again',

    /* A one-tap reply, so she can answer the moment she finishes
       instead of switching apps and hunting for the words.

         number  — YOUR WhatsApp number, international format,
                   digits only: country code + number, no +, no
                   spaces, no leading zero.
                   Egypt example: 20 then 1XXXXXXXXX -> '201XXXXXXXXX'
         label   — the button text
         message — what's already typed for her when it opens

       Leave `number` empty and the button simply doesn't appear. */
    reply: {
      number:  '+201001589043',
      label:   'say something back',
      message: 'I just watched it. ',
    },
  },

  /* --- one more thing ---------------------------------------
     One quiet final message, not a string of separate quotes —
     she taps `label` to reveal it. `message` is the emotional
     headline; `note` is the short explanation underneath it;
     `signature` signs it. All three arrive together in one
     brief cascade. Leave `message` empty to skip this entirely;
     leave `note`/`signature` empty to skip just that line.      */
  oneMoreThing: {
    label:     'One more thing…',
    photo:     'photos/31.JPG',
    message:   'We grew up, but somehow, we found our way to each other',
    note:      'Thank you for being one of the most beautiful parts of my life.',
  },

  /* --- the signature ------------------------------------------
     The very last thing on the page — small, quiet, easy to
     miss on purpose. Its own tiny signature group, separate from
     the one inside "One more thing" above. `date` is optional
     free text in whatever format you like ('08.20.2026', 'her
     birthday, 2026'…); leave it, or `name`, empty to hide.      */
  signature: {
    text: 'Made with love, just for you.',
    name: '— TETE',
    date: '',
  },
};
