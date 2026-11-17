'use strict';
// MS Ads Agent Exchange server SDK for Node 18+ (zero dependencies). Keep keys on your server, never in an app or browser.
const crypto = require('crypto');
const VERSION = '0.1.0';

function sign(secret, timestamp, nonce, method, path, body) {
  const b = Buffer.isBuffer(body) ? body : Buffer.from(body || '', 'utf8');
  const s = [String(timestamp), nonce, method.toUpperCase(), '/' + path.replace(/^\/+/, ''), crypto.createHash('sha256').update(b).digest('hex')].join('\n');
  return 'v1=' + crypto.createHmac('sha256', secret).update(s).digest('hex');
}

class MsadsError extends Error {
  constructor(status, body) { super(`HTTP ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`); this.status = status; this.body = body; }
}

class AgentExchange {
  constructor({ agentId, key, secret = null, baseUrl = 'https://msadsnetwork.com', timeoutMs = 2000 }) {
    Object.assign(this, { agentId, key, secret, base: baseUrl.replace(/\/+$/, ''), timeoutMs });
  }
  async _post(path, payload) {
    const raw = JSON.stringify(payload);
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'X-MSADS-Key': this.key, 'User-Agent': 'msads-agent-node/' + VERSION };
    if (this.secret) {
      const ts = String(Math.floor(Date.now() / 1000)), nonce = crypto.randomBytes(12).toString('hex');
      Object.assign(headers, { 'X-MSADS-Agent': this.agentId, 'X-MSADS-Timestamp': ts, 'X-MSADS-Nonce': nonce, 'X-MSADS-Signature': sign(this.secret, ts, nonce, 'POST', path, raw) });
    }
    const res = await fetch(this.base + path, { method: 'POST', headers, body: raw, signal: AbortSignal.timeout(this.timeoutMs) });
    const txt = await res.text();
    let body; try { body = txt ? JSON.parse(txt) : {}; } catch { body = txt; }
    if (!res.ok) throw new MsadsError(res.status, body);
    return body;
  }
  /** Intent summary only: no raw chat text, no personal data. */
  getOffers(request) { return this._post('/api/v1/agent-exchange/offers', request); }
  sendEvent(offerRef, event, idempotencyKey, proofHash) {
    return this._post('/api/v1/agent-exchange/events', Object.assign({ offer_ref: offerRef, event, idempotency_key: idempotencyKey }, proofHash ? { proof_hash: proofHash } : {}));
  }
  sendEvents(events) { return this._post('/api/v1/agent-exchange/events', { events: events.slice(0, 100) }); }
  static proofHash(orderRef) { return crypto.createHash('sha256').update(orderRef).digest('hex'); }
  /** WhatsApp / Telegram text that keeps the mandatory Sponsored label. */
  static sponsoredText(o) {
    const label = (o.disclosure && o.disclosure.label) || 'Sponsored', m = o.merchant || {}, p = o.price || {};
    return `[${label}] ${o.title || ''} - ${m.name || ''}\n${(p.currency || '') + ' ' + (p.amount || '')}\n${(o.checkout && o.checkout.url) || ''}`;
  }
}
module.exports = { AgentExchange, MsadsError, sign, VERSION };
