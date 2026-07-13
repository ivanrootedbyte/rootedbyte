# RootedOS V8 Patch

This patch contains only the files that need to be replaced or added for the latest requested corrections.

## Replace these existing files

- `index.html`
- `trail.html`
- `study.html`
- `journal.html`
- `styles.css`
- `rootedos.js`
- `api/rootedos.js`

## Add these new files

- `about.html`
- `contact.html`
- `account.html`

## What changed

### Home page
- Shows `RootedOS` on the top left.
- Adds About / Journal / My RootedOS / Contact navigation.
- Keeps the page orb-focused and minimal.
- Adds a one-time welcome popup saved by `localStorage` key `rootedosIntroSeen`.
- Adds a daily RootedOS-original quote. These are not Bible quotes and do not pretend to be Scripture.

### Bible-grounded AI behavior
- Updated `api/rootedos.js` system prompt to answer from a Bible-rooted worldview: creation, body, personhood, dignity, sin, compassion, redemption, wisdom, and truth.
- Adds rules so RootedOS does not place modern self-definition, cultural approval, political ideology, personal desire, or therapeutic affirmation above biblical truth.
- Keeps tone compassionate and natural by default.
- Still avoids invented Scripture references and does not quote Scripture unless requested or a Bible passage is entered.

### Gemini model / quota handling
- `api/rootedos.js` now uses:
  `process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'`
- This lets you change the model in Vercel without editing code.
- Adds a safer quota/rate-limit message.

### PPT generation fix
- `study.html` still loads PptxGenJS from jsDelivr.
- `rootedos.js` now retries loading PptxGenJS and uses a backup CDN from unpkg before failing.

### Share / copy improvement
- Trail share now copies or shares a RootedOS-branded summary and includes a link back to the orb.
- This is not yet a real public share URL. It is MVP text sharing.

### Account page
- `account.html` is a localStorage MVP page.
- It shows monthly journal/PPT usage and saved journal count for this browser.
- It is not cross-device login yet.

## Vercel updates required

In Vercel Project Settings > Environment Variables, make sure these exist:

- `GEMINI_API_KEY` = your Gemini API key
- `GEMINI_MODEL` = `gemini-2.5-flash-lite`

You can later switch `GEMINI_MODEL` to `gemini-2.5-flash` if needed.

## Supabase updates required

None for this patch.

Current journal/account behavior is localStorage only. Supabase is only required later if you want:

- real sign-in
- journals saved across devices
- public share links like `/share.html?id=abc123`
- account dashboard backed by database

## Optional future Supabase tables

For real accounts and share links later:

- `profiles`
- `journal_entries`
- `rootedos_sessions`
- `shared_trails`

## Deployment steps

1. Back up current files.
2. Replace the listed files at project root.
3. Replace `api/rootedos.js` inside your `/api` folder.
4. Add the new `about.html`, `contact.html`, and `account.html` files to project root.
5. Confirm Vercel env vars are set.
6. Redeploy.
7. Hard refresh browser.

## Tests after deploy

1. Home page loads and shows RootedOS top left.
2. Intro popup appears only once, then stays closed after clicking Open the orb.
3. Daily quote appears under the orb and inside popup.
4. Orb input opens and generates Questions.
5. Questions generate Trail.
6. Trail flip cards scroll long output in `.trail-back-text`.
7. Share / Copy copies RootedOS-branded text.
8. Study Builder loads.
9. Save Journal works and updates usage.
10. Generate Study PPT works. If CDN is slow, the app should retry a backup CDN.
11. About, Contact, and My RootedOS pages open.
12. Test Bible-grounded topics for clear, compassionate, Bible-rooted responses without verse dumping unless requested.

## Production limitation

The share button currently copies/share text only. To generate true social share links that display public output, build a Supabase-backed `shared_trails` table and a `share.html` page later.
