/* AELITA · three-way JSON reconciliation (pack-v761).
   Baseline = what the editor actually opened; mine = its draft; current = published.
   Arrays are atomic: positional merging could attach edits to the wrong menu item.
   No network, storage, publication or side effects. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AelitaContentReconcile = api;
}(typeof window === 'object' ? window : this, function () {
  'use strict';
  const MISSING = Symbol('missing');
  const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const owns = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
  function validate(v, depth = 0, count = { n: 0 }) {
    if (depth > 40 || ++count.n > 20000) throw new Error('invalid_draft');
    if (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return;
    if (!v || typeof v !== 'object') throw new Error('invalid_draft');
    for (const k of Object.keys(v)) {
      if (['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error('invalid_draft');
      validate(v[k], depth + 1, count);
    }
  }
  function equal(a, b) {
    if (a === b) return true;
    if (a === MISSING || b === MISSING || a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    const ak = Object.keys(a), bk = Object.keys(b);
    return ak.length === bk.length && ak.every(k => owns(b, k) && equal(a[k], b[k]));
  }
  const copy = (v) => v === MISSING ? MISSING : JSON.parse(JSON.stringify(v));
  function merge(base, mine, current) {
    [base, mine, current].forEach(v => validate(v));
    const conflicts = [];
    function walk(b, m, c, path) {
      if (equal(m, b)) return copy(c);
      if (equal(c, b) || equal(m, c)) return copy(m);
      if (object(b) && object(m) && object(c)) {
        const out = {};
        for (const k of new Set([...Object.keys(b), ...Object.keys(m), ...Object.keys(c)])) {
          const v = walk(owns(b, k) ? b[k] : MISSING, owns(m, k) ? m[k] : MISSING, owns(c, k) ? c[k] : MISSING, path.concat(k));
          if (v !== MISSING) out[k] = v;
        }
        return out;
      }
      const entry = { path, basePresent: b !== MISSING, minePresent: m !== MISSING, currentPresent: c !== MISSING };
      if (b !== MISSING) entry.base = copy(b);
      if (m !== MISSING) entry.mine = copy(m);
      if (c !== MISSING) entry.current = copy(c);
      conflicts.push(entry);
      // Keeping the published value is only a proposal. The UI MUST require
      // an explicit choice for every conflict before accepting the draft.
      return copy(c);
    }
    return { value: walk(base, mine, current, []), conflicts };
  }
  function choose(value, conflict, side) {
    if (!['mine', 'current'].includes(side)) throw new Error('invalid_draft');
    validate(value); validate(conflict);
    if (!Array.isArray(conflict.path) || conflict.path.some(k => typeof k !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(k))) throw new Error('invalid_draft');
    const out = copy(value), present = conflict[side + 'Present'];
    if (!conflict.path.length) return present ? copy(conflict[side]) : null;
    let cursor = out;
    for (const key of conflict.path.slice(0, -1)) {
      if (!object(cursor[key])) cursor[key] = {};
      cursor = cursor[key];
    }
    const key = conflict.path[conflict.path.length - 1];
    if (present) cursor[key] = copy(conflict[side]); else delete cursor[key];
    return out;
  }
  return { merge, choose, equal, validate };
}));
