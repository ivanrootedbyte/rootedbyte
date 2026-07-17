function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function clean(value, max = 1200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function siteUrl(req) {
  const configured = String(process.env.SITE_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const proto = String(req.headers['x-forwarded-proto'] || 'https');
  return `${proto}://${host}`;
}

async function getSharedTrail(slug) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_ANON_KEY || '').trim();
  if (!base || !key) throw new Error('Share service is not configured.');
  const select = 'share_slug,owner_username,topic,summary,raw_input_preview,source_url,selected_path,trail_map,question_seed,created_at';
  const url = `${base}/rest/v1/shared_trails?share_slug=eq.${encodeURIComponent(slug)}&is_public=eq.true&select=${encodeURIComponent(select)}&limit=1`;
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error('Could not load shared trail.');
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}

function nodeMarkup(num, label, text) {
  return `<article class="trail-node trail-flip"><div class="trail-flip-card" role="button" tabindex="0" aria-label="Reveal ${escapeHtml(label)}"><span class="trail-flip-inner"><span class="trail-face trail-front"><span class="trail-num">${num}</span><span class="trail-front-title">${escapeHtml(label)}</span><span class="trail-front-hint">Tap to reveal</span></span><span class="trail-face trail-back"><span class="trail-back-kicker">${num} · ${escapeHtml(label)}</span><span class="trail-back-text">${escapeHtml(text)}</span></span></span></div></article>`;
}

module.exports = async function handler(req, res) {
  const slug = clean(req.query?.slug, 40).toLowerCase();
  if (!/^[a-z0-9]{12,32}$/.test(slug)) return res.status(404).send('Shared trail not found.');

  try {
    const trail = await getSharedTrail(slug);
    if (!trail) return res.status(404).send('<!doctype html><title>Trail unavailable | RootedOS</title><h1>This RootedOS trail is no longer available.</h1>');

    const base = siteUrl(req);
    const canonical = `${base}/share/${encodeURIComponent(slug)}`;
    const image = `${base}/api/share-image?slug=${encodeURIComponent(slug)}`;
    const title = `RootedOS Trail: ${clean(trail.topic, 120)}`;
    const description = clean(trail.summary, 220);
    const map = trail.trail_map || {};
    const embedded = JSON.stringify(trail).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');

    const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="RootedOS">
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css?v=13"></head>
<body data-page="shared-trail"><main class="page-shell">
<header class="topbar"><a class="brand" href="/index.html"><span class="brand-mark"></span><span>RootedOS</span></a><nav class="nav-links"><a href="/index.html">Start a new trail</a><a href="/about.html">About</a><a href="/account.html">Sign in</a></nav></header>
<section class="page-heading shared-trail-heading"><span class="eyebrow">Shared Truth Trail</span><h1>${escapeHtml(trail.topic)}</h1><p>${escapeHtml(trail.summary)}</p><span class="topic-pill">Shared by ${escapeHtml(trail.owner_username)}</span></section>
<section class="trail-path" data-shared-map>${nodeMarkup('01','Signal',map.signal || '')}${nodeMarkup('02','Pressure',map.pressure || '')}${nodeMarkup('03','Formation',map.formation || '')}${nodeMarkup('04','Truth Anchor',map.truthAnchor || '')}${nodeMarkup('05','Next Step',map.nextStep || '')}</section>
<section class="shared-continue-card"><span class="eyebrow">Continue from this trail</span><h2>Choose where to explore next.</h2><p>You can try the Question Trail without an account. Sign in before you want to keep your work, journal privately, or publish your own trail.</p><div class="trail-loop-modes shared-mode-grid"><button type="button" data-shared-mode="go_deeper"><strong>Go deeper</strong><span>Find the question underneath</span></button><button type="button" data-shared-mode="make_practical"><strong>Make practical</strong><span>Turn insight into one action</span></button><button type="button" data-shared-mode="challenge_assumption"><strong>Challenge assumption</strong><span>Test what may be driving this</span></button></div><div data-shared-question></div><div class="actions"><a class="primary-btn" href="/account.html">Sign in to save and journal</a><a class="secondary-btn" href="/index.html">Start your own trail</a></div><p class="status" data-status aria-live="polite"></p></section>
</main><script>window.__ROOTED_SHARED_TRAIL__=${embedded};</script><script src="/rootedos.js?v=13"></script></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Shared trail page failed:', error.message);
    return res.status(500).send('<!doctype html><title>RootedOS</title><h1>RootedOS could not load this shared trail.</h1>');
  }
};
