function sendJson(res, status, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(payload);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, message: 'Method not allowed.' });

  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const supabaseAnonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return sendJson(res, 503, {
      ok: false,
      configured: false,
      message: 'Member Posts is not configured yet. Add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel.'
    });
  }

  return sendJson(res, 200, { ok: true, configured: true, supabaseUrl, supabaseAnonKey });
};
