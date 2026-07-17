const crypto = require('crypto');

function sendJson(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).json(payload);
}

function clean(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.headers['x-real-ip'] || '').trim() || 'unknown';
}

async function supabaseRequest(path, options = {}) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!base || !key) throw new Error('Contact storage is not configured.');
  return fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, message: 'Method not allowed.' });

  try {
    const siteUrl = String(process.env.SITE_URL || '').replace(/\/$/, '');
    const origin = String(req.headers.origin || '').replace(/\/$/, '');
    if (siteUrl && origin && origin !== siteUrl) return sendJson(res, 403, { ok: false, message: 'Request origin was not accepted.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (clean(body.website, 200)) return sendJson(res, 200, { ok: true, message: 'Message received.' });

    const name = clean(body.name, 80);
    const email = clean(body.email, 160).toLowerCase();
    const category = clean(body.category, 30);
    const subject = clean(body.subject, 140);
    const message = clean(body.message, 5000);
    const validCategories = new Set(['support','feedback','collaboration','privacy','other']);

    if (name.length < 2) throw new Error('Enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
    if (!validCategories.has(category)) throw new Error('Choose a message type.');
    if (subject.length < 3) throw new Error('Enter a subject.');
    if (message.length < 10) throw new Error('Enter a message with at least 10 characters.');

    const salt = String(process.env.CONTACT_RATE_LIMIT_SALT || '').trim();
    if (!salt) throw new Error('Contact rate limiting is not configured.');
    const ipHash = crypto.createHash('sha256').update(`${salt}:${getClientIp(req)}`).digest('hex');
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const ratePath = `contact_submissions?ip_hash=eq.${encodeURIComponent(ipHash)}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=5`;
    const rateResponse = await supabaseRequest(ratePath, { method: 'GET' });
    if (!rateResponse.ok) throw new Error('Contact rate check failed.');
    const recent = await rateResponse.json();
    if (Array.isArray(recent) && recent.length >= 5) {
      return sendJson(res, 429, { ok: false, message: 'Too many messages were submitted. Please try again later.' });
    }

    const insertResponse = await supabaseRequest('contact_submissions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        name,
        email,
        category,
        subject,
        message,
        ip_hash: ipHash,
        user_agent: clean(req.headers['user-agent'], 500)
      })
    });
    if (!insertResponse.ok) {
      const detail = await insertResponse.text();
      console.error('Contact insert failed:', detail.slice(0, 500));
      throw new Error('The message could not be saved. Please try again.');
    }

    return sendJson(res, 200, { ok: true, message: 'Your message was sent successfully.' });
  } catch (error) {
    return sendJson(res, 400, { ok: false, message: error.message || 'The message could not be sent.' });
  }
};
