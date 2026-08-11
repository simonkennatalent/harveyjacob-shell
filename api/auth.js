// /api/auth — proxies MFA + password-reset actions to the Harvey Jacob edge functions.
const SUPABASE_URL = 'https://acehnasjmgzysntxhrmy.supabase.co';
const PUBLISHABLE = 'sb_publishable_iDKoS7zN7N-FoWmPNPdXjw_6y0E8CKM';
const ROUTES = {
  'send-code': '/functions/v1/mfa-gate',
  'verify-code': '/functions/v1/mfa-gate',
  'reset-send-code': '/functions/v1/hj-reset',
  'reset-password': '/functions/v1/hj-reset',
};
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body || {};
  const path = ROUTES[body.action];
  if (!path) return res.status(400).json({ error: 'Unknown action' });
  try {
    const r = await fetch(SUPABASE_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: PUBLISHABLE, Authorization: 'Bearer ' + PUBLISHABLE },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let payload; try { payload = JSON.parse(text); } catch { payload = { error: text || 'Login service unavailable' }; }
    return res.status(r.status).json(payload);
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach the login service. Please try again.' });
  }
};
