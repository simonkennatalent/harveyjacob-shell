// /api/auth — proxies MFA send-code / verify-code to the Harvey Jacob mfa-gate edge function.
const SUPABASE_URL = 'https://acehnasjmgzysntxhrmy.supabase.co';
const MFA_GATE = `${SUPABASE_URL}/functions/v1/mfa-gate`;
const PUBLISHABLE = 'sb_publishable_iDKoS7zN7N-FoWmPNPdXjw_6y0E8CKM';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body || {};
  const action = body.action;
  if (action === 'send-code' || action === 'verify-code') {
    try {
      const r = await fetch(MFA_GATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: PUBLISHABLE, Authorization: 'Bearer ' + PUBLISHABLE },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      let payload;
      try { payload = JSON.parse(text); } catch { payload = { error: text || 'Login service unavailable' }; }
      return res.status(r.status).json(payload);
    } catch (e) {
      return res.status(502).json({ error: 'Could not reach the login service. Please try again.' });
    }
  }
  return res.status(400).json({ error: 'Unknown action' });
};
