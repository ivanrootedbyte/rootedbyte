# RootedOS Production Flow

This package replaces the old category/fallback RootedOS flow with:

Big Orb -> Input -> AI Question Flow -> AI Truth Trail Map -> Journal / Generate PPT / Share

## Files included

- `index.html`
- `questions.html`
- `trail.html`
- `study.html`
- `journal.html`
- `styles.css`
- `rootedos.js`
- `api/rootedos.js`
- `package.json`
- `vercel.json`

## Required Vercel environment variable

Add this in Vercel Project Settings -> Environment Variables:

```txt
GEMINI_API_KEY=your_gemini_api_key_here
```

Do not hardcode the production key in frontend JavaScript.

## Deployment steps

1. Back up the current RootedOS files.
2. Replace the current RootedOS files with the files in this zip.
3. Keep any unrelated RootedByte files that are not part of this RootedOS flow.
4. In Vercel, add `GEMINI_API_KEY`.
5. Redeploy from Vercel.
6. Test `/api/rootedos` with the live frontend.

## What to remove from the old app

Remove old category/fallback logic from the previous `rootedos.js`, including:

- visible category sphere selection logic
- `themeSupport()`
- `inferThemeFromInput()` category forcing
- any local template outputs that say fallback worked
- UI text such as `Using a grounded fallback trail for now.`
- UI text such as `Using a grounded fallback study output for now.`

This replacement package does not use those functions.

## Link extraction limitations

- Plain text is used directly.
- Article links are fetched server-side and parsed with Readability/JSDOM when accessible.
- YouTube links use available metadata/page text only. This package does not guarantee transcript extraction.
- TikTok, Instagram, and Facebook frequently block scraping or require login/cookies. If extraction is not reliable, the app shows a safe message asking the user to paste the caption, transcript, article text, or summary.
- The app does not pretend blocked private/social content was read.

## Monthly MVP limits

Local browser limits are stored in `localStorage`:

- 5 saved journal entries per month
- 5 PPT generations per month

Move this to Supabase later for account-based limits.

## Test checklist after deployment

1. Open `index.html` and click the orb.
2. Paste plain text and confirm it routes to `questions.html`.
3. Confirm questions are specific to the input.
4. Select one Discovery Node option and continue.
5. Confirm `trail.html` shows five AI-specific sections.
6. Open Study Builder and confirm `study.html` loads the same session.
7. Save one journal entry.
8. Generate one PPT and confirm it downloads.
9. Paste a blocked Facebook/TikTok/Instagram link and confirm the app shows the safe extraction message.
10. Confirm no old fallback messages appear anywhere.
