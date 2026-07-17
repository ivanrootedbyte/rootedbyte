# RootedOS Share Links, Social Preview, Contact Form, and Orb Zoom Patch

## Replace
- `index.html`
- `trail.html`
- `contact.html`
- `rootedos.js`
- `styles.css`
- `supabase.js`
- `SUPABASE-SETUP.sql`
- `vercel.json`
- `package.json`

## Add
- `api/contact.js`
- `api/share-page.js`
- `api/share-image.js`

## Required Vercel environment variables
- `GEMINI_API_KEY`
- `GEMINI_MODEL_LIGHT`
- `GEMINI_MODEL_DEEP`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose it in browser code)
- `SITE_URL` (for example `https://your-production-domain.com`, without a trailing slash)
- `CONTACT_RATE_LIMIT_SALT` (a long random secret used to hash IP addresses for anti-spam rate limiting)

## Supabase
Run the complete `SUPABASE-SETUP.sql` in Supabase SQL Editor. It adds:
- `shared_trails`
- `contact_submissions`
- RLS policies for public trail viewing and owner-controlled sharing
- secure triggers that attach the authenticated public username
- indexes for share lookup and contact rate limiting

## How sharing works
1. Signed-in user with a public username clicks **Share Trail**.
2. RootedOS shows exactly what becomes public.
3. Supabase stores a public-safe snapshot. Private journal text is not stored.
4. RootedOS opens the native share sheet or copies the URL.
5. `/share/<slug>` is server-rendered with Open Graph and X metadata.
6. `/api/share-image?slug=<slug>` generates a 1200×630 PNG preview.
7. Visitors can continue the Question Trail anonymously. Their continuation is a separate browser session and never changes the original shared record.

## Contact form
The form posts to `/api/contact`. The server validates fields, checks the request origin, stores the message with the Supabase service role, and allows up to five submissions per hashed IP per hour. Raw IP addresses are not stored.

## Test after deployment
1. Sign in and set a public username.
2. Generate a complete Truth Trail and click Share Trail.
3. Confirm the share URL opens in a private/incognito window.
4. Confirm all five cards reveal correctly.
5. Continue with Go deeper, Make practical, and Challenge assumption.
6. Paste the URL into Slack, Teams, iMessage, LinkedIn Post Inspector, and Facebook Sharing Debugger to verify the PNG preview.
7. Submit the contact form and confirm the row appears in `contact_submissions`.
8. Confirm journals are absent from `shared_trails`.
9. Confirm an unsigned user cannot create a shared trail.
10. Confirm the home orb zooms first, then the Discovery workspace opens.

## Known limitations
- Social platforms cache previews. Their debugger/inspector may be needed after changing an existing share.
- Contact rate limiting is database-backed but is not a full CAPTCHA or abuse-prevention service.
- Shared trails can be unpublished through Supabase now; an in-app management screen is not included in this patch.
- Visitor continuation is stored in that visitor's browser until account-backed saved studies are implemented.
