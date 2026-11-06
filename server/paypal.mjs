const API = 'https://api-m.sandbox.paypal.com';
export class PayPal {
  constructor({clientId, clientSecret, webhookId, fetchImpl = fetch}) {
    Object.assign(this, {clientId, clientSecret, webhookId, fetchImpl});
  }
  get configured() {
    return Boolean(this.clientId && this.clientSecret && !this.clientId.startsWith('replace_') && !this.clientSecret.startsWith('replace_'));
  }
  async token() {
    if (!this.configured) throw Object.assign(new Error('Add your Sandbox Client ID and Secret to server/.env, then restart.'), {status:503});
    if (this.accessToken && this.expiresAt > Date.now()) return this.accessToken;
    const response = await this.fetchImpl(`${API}/v1/oauth2/token`, {
      method:'POST', headers:{Authorization:`Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'Content-Type':'application/x-www-form-urlencoded'}, body:'grant_type=client_credentials', signal:AbortSignal.timeout(20000)
    });
    const data = await response.json();
    if (!response.ok || !data.access_token) throw Object.assign(new Error('PayPal Sandbox authentication failed. Check the Sandbox credentials in server/.env.'), {status:502});
    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + Math.max(0, Number(data.expires_in || 0) - 60) * 1000;
    return this.accessToken;
  }
  async request(path, {method='GET', body, requestId} = {}) {
    const response = await this.fetchImpl(API + path, {
      method, headers:{Authorization:`Bearer ${await this.token()}`, 'Content-Type':'application/json',
        Prefer:'return=representation', ...(requestId ? {'PayPal-Request-Id':requestId} : {})},
      ...(body === undefined ? {} : {body:JSON.stringify(body)}), signal:AbortSignal.timeout(20000)
    });
    const data = response.status === 204 ? {} : await response.json();
    if (!response.ok) {
      const issue = data.details?.[0]?.issue || data.name || 'PAYPAL_ERROR';
      const safeIssue = /^[A-Z_]+$/.test(issue) ? issue : 'PAYPAL_ERROR';
      throw Object.assign(new Error(`PayPal Sandbox returned ${safeIssue}. Retry safely or check the Sandbox account.`), {status:502, issue:safeIssue});
    }
    return data;
  }
  create({participant, amountCents, customId, referenceId, returnUrl, cancelUrl, requestId}) {
    return this.request('/v2/checkout/orders', {method:'POST', requestId, body:{
      intent:'CAPTURE', purchase_units:[{reference_id:referenceId, custom_id:customId,
        description:`SplitSync Sandbox demo · ${participant} · Move-in essentials`,
        amount:{currency_code:'USD', value:(amountCents/100).toFixed(2)}}],
      payment_source:{paypal:{experience_context:{brand_name:'SplitSync Sandbox demo', user_action:'PAY_NOW',
        shipping_preference:'NO_SHIPPING', return_url:returnUrl, cancel_url:cancelUrl}}}
    }});
  }
  get(id) { return this.request(`/v2/checkout/orders/${encodeURIComponent(id)}`); }
  capture(id, requestId) { return this.request(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {method:'POST', requestId, body:{}}); }
  async verify(event, headers) {
    if (!this.webhookId) throw Object.assign(new Error('Configure PAYPAL_WEBHOOK_ID before accepting webhooks.'), {status:503});
    const fields = ['auth-algo','cert-url','transmission-id','transmission-sig','transmission-time'];
    if (fields.some(k => !headers[`paypal-${k}`])) return false;
    const cert = new URL(headers['paypal-cert-url']);
    if (cert.protocol !== 'https:' || !['api.paypal.com','api.sandbox.paypal.com','api-m.sandbox.paypal.com'].includes(cert.hostname)) return false;
    const data = await this.request('/v1/notifications/verify-webhook-signature', {method:'POST', body:{
      auth_algo:headers['paypal-auth-algo'], cert_url:headers['paypal-cert-url'], transmission_id:headers['paypal-transmission-id'],
      transmission_sig:headers['paypal-transmission-sig'], transmission_time:headers['paypal-transmission-time'],
      webhook_id:this.webhookId, webhook_event:event
    }});
    return data.verification_status === 'SUCCESS';
  }
}
