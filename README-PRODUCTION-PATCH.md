# RootedOS Production Patch

## Replace these existing files
- `api/rootedos.js`
- `rootedos.js`
- `styles.css`
- `index.html`
- `questions.html`
- `trail.html`
- `study.html`
- `journal.html`
- `account.html`

## Add these new files
- `api/public-config.js`
- `supabase.js`
- `posts.html`
- `SUPABASE-SETUP.sql`

## Vercel environment variables
Required for AI:
- `GEMINI_API_KEY`
- `GEMINI_MODEL_LIGHT=gemini-2.5-flash-lite`
- `GEMINI_MODEL_DEEP=gemini-2.5-flash`

Required for real Member Posts:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Redeploy after adding or changing environment variables. Never put the Supabase service-role key in this project or in browser code.

## Supabase setup
1. Create or use a Supabase project.
2. In Authentication > URL Configuration, add the production site URL and `https://YOUR-DOMAIN/account.html` as an allowed redirect URL. Add the Vercel preview URL only when testing previews.
3. Run `SUPABASE-SETUP.sql` once in the Supabase SQL Editor.
4. Enable Email authentication. Magic-link sign-in is used; no fake/local sign-in is implemented.
5. Add `SUPABASE_URL` and the public anon key as Vercel environment variables.

Private journal saves remain local to the browser. Public posts require a real Supabase-authenticated user and a saved public username.

## Gemini routing in this patch
- `analyze_input` -> `gemini-2.5-flash-lite`
- `generate_questions` -> `gemini-2.5-flash-lite`
- `continue_trail` -> `gemini-2.5-flash-lite`
- `generate_trail` -> `gemini-2.5-flash`
- `generate_study` -> `gemini-2.5-flash`

Quota/rate-limit errors show the required cooling-down message. The Bible-grounded system rules remain in `api/rootedos.js`; Scripture is not quoted by default and unverifiable references use `Scripture reference required / not verified.`

## What to test after deployment
1. Open the orb and submit plain text. Confirm Questions, Trail, Question Trail, and Study load without generic fallback content.
2. Test a blocked/unreadable social link. Confirm the app asks for pasted text rather than fabricating content.
3. Click Journal it on the Trail and select each reflection path. Confirm the chosen prompt appears in Study Builder.
4. Click Generate Study PPT. Test once normally, then block jsDelivr and confirm unpkg is attempted.
5. Save a private journal and confirm it appears in `journal.html` only in that browser.
6. In My RootedOS, send a magic link, sign in, save a username, and sign out.
7. Publish from Study Builder. Confirm signed-out publishing is rejected and signed-in publishing appears in `posts.html` with the username.
8. Trigger or simulate a Gemini 429 and confirm: `RootedOS is cooling down because the AI request limit was reached. Please wait 30–60 seconds and try again.`
9. Test desktop and mobile widths, especially navigation, question cards, trail cards, journal prompt choices, and public posts.

## Generate PPT status
Generate PPT should work after this patch when either jsDelivr or unpkg is reachable and the browser permits CDN scripts and downloads. `study.html` keeps the jsDelivr PptxGenJS script before `rootedos.js`; `rootedos.js` also retries jsDelivr and then unpkg dynamically and recognizes the common browser global names. If both CDNs are blocked, the user receives a clear error and no fake file is generated.

## Known limitations
- Private journals and usage limits remain browser-local; they are not synchronized across devices.
- Member Posts shows the newest 50 posts and does not yet include moderation, reporting, editing, pagination, or administrator controls. Public posting should not be enabled broadly without a moderation plan.
- Link extraction still depends on what the source site exposes to a server request. TikTok, Instagram, Facebook, and some YouTube pages may require the user to paste text/transcript.
- CDN-dependent PPT and Supabase browser libraries require network access.
