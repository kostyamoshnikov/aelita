// Browser-only ownership labels. The account and payment APIs validate the token.
(function () {
  'use strict';
  const TOKEN_KEY = 'aelita_account_token';
  const PREFIX = 'aelita_draft_v830:';

  function token() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; }
  }

  function emailOwner(email) {
    const normalized = String(email || '').trim().toLowerCase();
    return normalized.includes('@') ? 'email:' + normalized : null;
  }

  function owner(value) {
    if (!value) return 'guest';
    const parts = value.split('.');
    if (parts.length !== 2) return null;
    try {
      const bytes = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(bytes, c => c.charCodeAt(0))));
      return emailOwner(payload.email);
    } catch (_) { return null; }
  }

  function remove(key) {
    try { sessionStorage.removeItem(PREFIX + key); } catch (_) {}
  }

  function read(key, expectedOwner, ttl) {
    try {
      const record = JSON.parse(sessionStorage.getItem(PREFIX + key) || 'null');
      if (!record) return null;
      const age = Date.now() - record.at;
      if (expectedOwner && record.owner === expectedOwner && age >= 0 && age < ttl) return record.value;
    } catch (_) {}
    remove(key);
    return null;
  }

  function write(key, expectedOwner, value, at = Date.now()) {
    if (!expectedOwner) return;
    try { sessionStorage.setItem(PREFIX + key, JSON.stringify({owner: expectedOwner, value, at})); } catch (_) {}
  }

  window.AelitaCustomerDrafts = {TOKEN_KEY, token, emailOwner, owner, read, write, remove};
})();
