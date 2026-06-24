// Content script — form scanning, filling, and tracking overlay

(function () {
  if (window.__ffAIInjected) return;
  window.__ffAIInjected = true;

  // ─────────────────────────────────────────────────────────────────────────
  // FIELD DETECTION
  // ─────────────────────────────────────────────────────────────────────────

  function getLabel(el) {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) return cleanText(lbl);
    }
    const parentLabel = el.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll('input,select,textarea').forEach(c => c.remove());
      const t = clone.textContent.trim();
      if (t) return t;
    }
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const t = labelledBy.split(' ').map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
      if (t) return t;
    }
    const prev = el.previousElementSibling;
    if (prev && /^(LABEL|SPAN|P|DIV|H[1-6])$/.test(prev.tagName)) {
      const t = prev.textContent.trim();
      if (t && t.length < 120) return t;
    }
    const parentPrev = el.parentElement?.previousElementSibling;
    if (parentPrev && parentPrev.textContent.trim().length < 120) return parentPrev.textContent.trim();
    return el.placeholder || el.name || el.id || '';
  }

  function cleanText(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('script,style').forEach(c => c.remove());
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'file', 'image', 'search']);
  let _lastScannedFields = [];

  // Map: ariaKey -> { type, groupEl, items: [{el, label, value}] }
  let _ariaFieldMap = new Map();

  function scanAriaChoiceFields(startIdx) {
    const fields = [];
    _ariaFieldMap.clear();

    // Google Forms radio groups
    document.querySelectorAll('[role="radiogroup"]').forEach((group, gi) => {
      if (!isVisible(group)) return;
      const labelEl = group.getAttribute('aria-labelledby')
        ? document.getElementById(group.getAttribute('aria-labelledby'))
        : null;
      const label = labelEl?.textContent?.trim() ||
        group.getAttribute('aria-label') ||
        group.previousElementSibling?.textContent?.trim() || '';
      const items = [];
      group.querySelectorAll('[role="radio"]').forEach(opt => {
        const optLabel = opt.getAttribute('aria-label') ||
          opt.textContent?.trim() ||
          opt.getAttribute('data-value') || '';
        items.push({ el: opt, label: optLabel, value: optLabel });
      });
      if (!items.length) return;
      const key = `aria_rg_${startIdx + gi}`;
      _ariaFieldMap.set(key, { type: 'radiogroup', groupEl: group, items });
      fields.push({
        key,
        tag: 'div',
        type: 'radio',
        id: group.id || '',
        name: '',
        placeholder: '',
        label,
        currentValue: items.find(i => i.el.getAttribute('aria-checked') === 'true')?.label || '',
        required: group.getAttribute('aria-required') === 'true',
        options: items.map(i => i.label),
      });
    });

    // Standalone ARIA checkboxes (outside radiogroups)
    document.querySelectorAll('[role="checkbox"]').forEach((cb, ci) => {
      if (!isVisible(cb)) return;
      // Skip if inside a radiogroup (already handled)
      if (cb.closest('[role="radiogroup"]')) return;
      const label = cb.getAttribute('aria-label') ||
        cb.textContent?.trim() ||
        cb.previousElementSibling?.textContent?.trim() || '';
      const key = `aria_cb_${startIdx + ci}`;
      _ariaFieldMap.set(key, { type: 'checkbox', groupEl: null, items: [{ el: cb, label, value: label }] });
      fields.push({
        key,
        tag: 'div',
        type: 'checkbox',
        id: cb.id || '',
        name: '',
        placeholder: '',
        label,
        currentValue: cb.getAttribute('aria-checked') === 'true' ? 'true' : 'false',
        required: cb.getAttribute('aria-required') === 'true',
      });
    });

    return fields;
  }

  function scanFields() {
    const allNative = document.querySelectorAll('input, textarea, select');
    const fields = [];
    allNative.forEach((el, idx) => {
      if (el.tagName === 'INPUT' && SKIP_TYPES.has(el.type)) return;
      if (!isVisible(el)) return;
      if (el.disabled || el.readOnly) return;
      const field = {
        key: `f${idx}`,
        tag: el.tagName.toLowerCase(),
        type: el.type || 'text',
        id: el.id || '',
        name: el.name || '',
        placeholder: el.placeholder || '',
        label: getLabel(el),
        currentValue: el.value || '',
        required: el.required,
      };
      if (el.tagName === 'SELECT') {
        field.options = Array.from(el.options)
          .map(o => o.text.trim())
          .filter(t => t && t !== '--' && !/^select/i.test(t))
          .slice(0, 30);
      }
      fields.push(field);
    });

    // Also scan ARIA-based widgets (Google Forms style)
    const ariaFields = scanAriaChoiceFields(allNative.length);
    fields.push(...ariaFields);

    return fields;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FILLING
  // ─────────────────────────────────────────────────────────────────────────

  function setInputValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    ['input', 'change', 'blur'].forEach(ev =>
      el.dispatchEvent(new Event(ev, { bubbles: true, cancelable: true }))
    );
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  function fillSelect(el, value) {
    const v = String(value).toLowerCase().trim();
    const opts = Array.from(el.options);
    let m = opts.find(o => o.value.toLowerCase() === v || o.text.toLowerCase() === v);
    if (!m) m = opts.find(o => o.text.toLowerCase().includes(v) || v.includes(o.text.toLowerCase()));
    if (m) { el.value = m.value; el.dispatchEvent(new Event('change', { bubbles: true })); }
  }

  function fillRadio(name, value) {
    const v = String(value).toLowerCase().trim();
    document.querySelectorAll(`input[type=radio][name="${CSS.escape(name)}"]`).forEach(r => {
      const lbl = getLabel(r).toLowerCase();
      const rv = r.value.toLowerCase();
      if (rv === v || lbl === v || lbl.includes(v) || v.includes(rv)) r.click();
    });
  }

  function fillAriaField(key, value) {
    const info = _ariaFieldMap.get(key);
    if (!info) return false;
    const v = String(value).toLowerCase().trim();

    if (info.type === 'radiogroup') {
      // Select the best-matching radio option
      // Allow multiple selections if value is comma-separated, but default to single
      const targets = v.split(',').map(s => s.trim()).filter(Boolean);
      let matched = false;
      info.items.forEach(item => {
        const lbl = item.label.toLowerCase();
        const shouldSelect = targets.some(t => lbl === t || lbl.includes(t) || t.includes(lbl));
        if (shouldSelect && item.el.getAttribute('aria-checked') !== 'true') {
          item.el.click();
          matched = true;
        }
      });
      return matched;
    }

    if (info.type === 'checkbox') {
      const want = /^(yes|true|1|on)$/i.test(value);
      const current = info.items[0].el.getAttribute('aria-checked') === 'true';
      if (want !== current) info.items[0].el.click();
      return true;
    }

    return false;
  }

  function highlight(el, ok) {
    el.style.transition = 'background-color 0.3s';
    el.style.backgroundColor = ok ? '#d1fae5' : '#fef3c7';
    setTimeout(() => { el.style.backgroundColor = ''; }, 2500);
  }

  function applyFills(fieldValues) {
    const all = Array.from(document.querySelectorAll('input, textarea, select'));
    let filled = 0;
    for (const [key, value] of Object.entries(fieldValues)) {
      if (value === null || value === undefined || value === '') continue;

      // Handle ARIA-based fields (Google Forms etc.)
      if (key.startsWith('aria_')) {
        try {
          if (fillAriaField(key, value)) filled++;
        } catch (e) { console.warn('[FF aria]', key, e); }
        continue;
      }

      const idx = parseInt(key.replace('f', ''), 10);
      if (isNaN(idx)) continue;
      const el = all[idx];
      if (!el || el.disabled || el.readOnly) continue;
      try {
        if (el.tagName === 'SELECT') fillSelect(el, value);
        else if (el.type === 'checkbox') { const c = /^(yes|true|1|on)$/i.test(String(value)); if (el.checked !== c) el.click(); }
        else if (el.type === 'radio') fillRadio(el.name, value);
        else setInputValue(el, value);
        highlight(el, true);
        filled++;
      } catch (e) { console.warn('[FF]', key, e); }
    }
    const unfilled = _lastScannedFields
      .filter(f => { const v = fieldValues[f.key]; return v === null || v === undefined || v === ''; })
      .map(f => ({ key: f.key, label: f.label || f.placeholder || f.name, type: f.type, tag: f.tag, options: f.options, required: f.required }));
    unfilled.filter(f => f.required).forEach(f => {
      if (f.key.startsWith('aria_')) return; // no native element to highlight
      const idx = parseInt(f.key.replace('f', ''), 10);
      const el = all[idx];
      if (el) highlight(el, false);
    });
    return { filled, unfilled };
  }

  function clearAllFields() {
    document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=file]), textarea')
      .forEach(el => { if (!el.disabled && !el.readOnly) setInputValue(el, ''); });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRACKING OVERLAY
  // ─────────────────────────────────────────────────────────────────────────

  const OVERLAY_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :host { all: initial; }

    #ov {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      background: #18181b;
      border: 1px solid #3f3f46;
      border-radius: 12px;
      width: 218px;
      box-shadow: 0 8px 32px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.3);
      overflow: hidden;
      color: #f4f4f5;
      transition: opacity 0.2s;
    }

    #drag {
      background: #111113;
      padding: 9px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: grab;
      border-bottom: 1px solid #2d2d35;
      user-select: none;
    }
    #drag:active { cursor: grabbing; }

    #brand {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #a78bfa;
    }

    .zap {
      width: 20px; height: 20px;
      background: #7c3aed;
      border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
    }

    #grip { color: #52525b; font-size: 11px; letter-spacing: 2px; line-height: 1; }

    #body { padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }

    #toggle-row {
      display: flex;
      align-items: center;
      gap: 7px;
    }

    #dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 6px #22c55e80;
      flex-shrink: 0;
      transition: background 0.3s, box-shadow 0.3s;
    }
    #dot.off { background: #52525b; box-shadow: none; }

    #toggle-label {
      flex: 1;
      font-size: 10px;
      font-weight: 700;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    #tog {
      width: 34px; height: 19px;
      border-radius: 10px;
      background: #7c3aed;
      border: none;
      cursor: pointer;
      position: relative;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    #tog.off { background: #3f3f46; }
    #tog::after {
      content: '';
      position: absolute;
      width: 15px; height: 15px;
      border-radius: 50%;
      background: white;
      top: 2px; left: 17px;
      transition: left 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,.3);
    }
    #tog.off::after { left: 2px; }

    #msg {
      font-size: 11px;
      color: #71717a;
      line-height: 1.5;
      min-height: 16px;
    }
    #msg.hi { color: #e4e4e7; font-weight: 600; }
    #msg.ok { color: #4ade80; }
    #msg.err { color: #f87171; }

    #acts { display: flex; gap: 6px; }

    #fill-btn {
      flex: 1;
      background: #7c3aed;
      color: white;
      border: none;
      border-radius: 7px;
      padding: 7px 6px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: background 0.15s;
      font-family: inherit;
    }
    #fill-btn:hover { background: #6d28d9; }
    #fill-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    #skip-btn {
      background: #27272a;
      color: #a1a1aa;
      border: 1px solid #3f3f46;
      border-radius: 7px;
      padding: 7px 12px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
      font-family: inherit;
    }
    #skip-btn:hover { background: #3f3f46; }

    @keyframes pulse {
      0%,100% { opacity: 1; } 50% { opacity: 0.5; }
    }
    .pulse { animation: pulse 1.5s ease-in-out infinite; }
  `;

  const OVERLAY_HTML = `
    <div id="ov">
      <div id="drag">
        <div id="brand">
          <div class="zap">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          </div>
          Form Filler
        </div>
        <span id="grip">⠿</span>
      </div>
      <div id="body">
        <div id="toggle-row">
          <span id="dot"></span>
          <span id="toggle-label">Tracking</span>
          <button id="tog" title="Toggle tracking"></button>
        </div>
        <div id="msg">Watching for form changes…</div>
        <div id="acts" style="display:none">
          <button id="fill-btn">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            Fill Now
          </button>
          <button id="skip-btn">Skip</button>
        </div>
      </div>
    </div>
  `;

  // State
  let _host = null;
  let _shadow = null;
  let _trackingOn = false;
  let _observer = null;
  let _mutationTimer = null;
  let _urlTimer = null;
  let _lastUrl = location.href;
  let _lastFieldSignature = '';
  let _isFilling = false;
  let _pendingFields = null;
  let _ariaFillMap = new Map(); // key -> { type, elements, labels }

  function fieldSignature(fields) {
    return fields.map(f => f.key + f.label).join('|');
  }

  // ── Create / remove overlay ──────────────────────────────────────────────

  function createOverlay() {
    if (document.getElementById('__ff-host')) return;

    _host = document.createElement('div');
    _host.id = '__ff-host';
    // NOTE: Do NOT set `all: 'initial'` here — it resets position:fixed to static,
    // making the overlay invisible. Style isolation is handled by the Shadow DOM instead.
    Object.assign(_host.style, {
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      zIndex: '2147483647',
      display: 'block',
      width: 'auto',
      height: 'auto',
      margin: '0',
      padding: '0',
      border: 'none',
      background: 'transparent',
      boxShadow: 'none',
      outline: 'none',
    });
    document.body.appendChild(_host);

    _shadow = _host.attachShadow({ mode: 'open' });
    _shadow.innerHTML = `<style>${OVERLAY_CSS}</style>${OVERLAY_HTML}`;

    // Restore position
    chrome.storage.local.get('overlayPos', ({ overlayPos }) => {
      if (overlayPos?.left && overlayPos?.top) {
        Object.assign(_host.style, { left: overlayPos.left, top: overlayPos.top, right: 'auto', bottom: 'auto' });
      }
    });

    makeDraggable(_host, _shadow.getElementById('drag'));
    _shadow.getElementById('tog').addEventListener('click', toggleOverlayTracking);
    _shadow.getElementById('fill-btn').addEventListener('click', overlayFill);
    _shadow.getElementById('skip-btn').addEventListener('click', dismissPrompt);

    setOverlayTracking(true);
  }

  function removeOverlay() {
    if (_host) { _host.remove(); _host = null; _shadow = null; }
    stopObserver();
  }

  // ── Drag ────────────────────────────────────────────────────────────────

  function makeDraggable(host, handle) {
    let startX, startY, startL, startT;

    handle.addEventListener('mousedown', e => {
      startX = e.clientX; startY = e.clientY;
      const rect = host.getBoundingClientRect();
      startL = rect.left; startT = rect.top;
      Object.assign(host.style, { left: startL + 'px', top: startT + 'px', right: 'auto', bottom: 'auto' });
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    });

    function onMove(e) {
      const l = Math.max(0, Math.min(startL + e.clientX - startX, window.innerWidth - host.offsetWidth));
      const t = Math.max(0, Math.min(startT + e.clientY - startY, window.innerHeight - host.offsetHeight));
      host.style.left = l + 'px';
      host.style.top  = t + 'px';
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      chrome.storage.local.set({ overlayPos: { left: host.style.left, top: host.style.top } });
    }
  }

  // ── Overlay state helpers ────────────────────────────────────────────────

  function setMsg(text, cls = '') {
    if (!_shadow) return;
    const el = _shadow.getElementById('msg');
    el.textContent = text;
    el.className = cls;
  }

  function showActions(show) {
    if (!_shadow) return;
    _shadow.getElementById('acts').style.display = show ? 'flex' : 'none';
  }

  function setOverlayTracking(on) {
    _trackingOn = on;
    if (!_shadow) return;
    const tog = _shadow.getElementById('tog');
    const dot = _shadow.getElementById('dot');
    tog.classList.toggle('off', !on);
    dot.classList.toggle('off', !on);
    if (on) {
      setMsg('Watching for form changes…');
      showActions(false);
      startObserver();
    } else {
      setMsg('Tracking paused.');
      showActions(false);
      stopObserver();
    }
    chrome.storage.local.set({ trackingEnabled: on });
  }

  function toggleOverlayTracking() {
    setOverlayTracking(!_trackingOn);
  }

  function dismissPrompt() {
    _pendingFields = null;
    showActions(false);
    setMsg('Skipped. Watching…');
    setTimeout(() => setMsg('Watching for form changes…'), 2000);
  }

  // ── Observer ────────────────────────────────────────────────────────────

  function startObserver() {
    if (_observer) return;
    _lastFieldSignature = fieldSignature(scanFields());
    _lastUrl = location.href;

    _observer = new MutationObserver(() => {
      if (_isFilling) return;
      clearTimeout(_mutationTimer);
      _mutationTimer = setTimeout(checkForFormChange, 700);
    });

    _observer.observe(document.body, { childList: true, subtree: true });

    // URL change (SPA navigation)
    const tick = setInterval(() => {
      if (location.href !== _lastUrl) {
        _lastUrl = location.href;
        clearTimeout(_urlTimer);
        _urlTimer = setTimeout(checkForFormChange, 900);
      }
    }, 500);
    _observer._urlTick = tick;
  }

  function stopObserver() {
    if (_observer) {
      _observer.disconnect();
      clearInterval(_observer._urlTick);
      _observer = null;
    }
    clearTimeout(_mutationTimer);
    clearTimeout(_urlTimer);
  }

  // ── Form change detection ────────────────────────────────────────────────

  // Next/Continue button interception (capture phase, before page handles it)
  const NEXT_RE = /^(next|continue|proceed|save\s*(&amp;|and)\s*continue|next\s*(page|step)|forward)$/i;

  document.addEventListener('click', e => {
    if (!_trackingOn) return;
    const el = e.target.closest('button, a, [role=button], input[type=submit], input[type=button]');
    if (!el) return;
    const txt = el.textContent.trim();
    if (NEXT_RE.test(txt) || el.getAttribute('aria-label')?.match(NEXT_RE)) {
      // Give page time to transition
      setTimeout(checkForFormChange, 900);
      setTimeout(checkForFormChange, 1600); // double-check for slow transitions
    }
  }, true);

  function checkForFormChange() {
    if (!_trackingOn || _isFilling) return;
    const fields = scanFields();
    if (!fields.length) return;

    const sig = fieldSignature(fields);
    if (sig === _lastFieldSignature) return; // same fields, ignore

    _lastFieldSignature = sig;
    _pendingFields = fields;
    notifyNewForm(fields);
  }

  function notifyNewForm(fields) {
    if (!_shadow) return;
    setMsg(`New form detected — ${fields.length} field${fields.length > 1 ? 's' : ''}.\nFill it?`, 'hi');
    showActions(true);
    // Brief flash on the overlay to attract attention
    const ov = _shadow.getElementById('ov');
    ov.style.boxShadow = '0 0 0 2px #7c3aed, 0 8px 32px rgba(0,0,0,.5)';
    setTimeout(() => { ov.style.boxShadow = ''; }, 2000);
  }

  // ── Overlay fill (talks to background, no popup needed) ─────────────────

  async function overlayFill() {
    const fields = _pendingFields || scanFields();
    if (!fields.length) { setMsg('No form fields found.', 'err'); return; }

    _isFilling = true;
    _lastScannedFields = fields;
    showActions(false);
    setMsg('Analyzing form…', 'pulse');

    const btn = _shadow.getElementById('fill-btn');
    btn.disabled = true;

    try {
      const raw = await new Promise((res, rej) => {
        chrome.runtime.sendMessage({ action: 'OVERLAY_FILL_REQUEST', fields }, r => {
          if (chrome.runtime.lastError) return rej(new Error(chrome.runtime.lastError.message));
          if (!r?.success) return rej(new Error(r?.error || 'Unknown error'));
          res(r.data);
        });
      });

      let fieldValues;
      try { fieldValues = JSON.parse(raw); }
      catch { const m = raw.match(/\{[\s\S]*\}/); fieldValues = JSON.parse(m?.[0] || '{}'); }

      const { filled, unfilled } = applyFills(fieldValues);
      _pendingFields = null;
      _lastFieldSignature = fieldSignature(scanFields());

      const skipped = unfilled.filter(f => f.required).length;
      setMsg(`Filled ${filled} fields${skipped ? ` · ${skipped} need input` : ''} ✓`, 'ok');
      setTimeout(() => { if (!_pendingFields) setMsg('Watching for form changes…'); }, 4000);

    } catch (err) {
      setMsg(`Error: ${err.message}`, 'err');
    } finally {
      _isFilling = false;
      btn.disabled = false;
    }
  }

  // ── Auto-init on page load if tracking was enabled ───────────────────────

  chrome.storage.local.get('trackingEnabled', ({ trackingEnabled }) => {
    if (trackingEnabled) createOverlay();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POPUP MESSAGES
  // ─────────────────────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'PING') {
      sendResponse({ alive: true }); return true;
    }
    if (msg.action === 'SCAN_FORM') {
      _lastScannedFields = scanFields();
      sendResponse({ fields: _lastScannedFields }); return true;
    }
    if (msg.action === 'FILL_FORM') {
      const result = applyFills(msg.fieldValues);
      sendResponse(result); return true;
    }
    if (msg.action === 'CLEAR_FORM') {
      clearAllFields(); sendResponse({ done: true }); return true;
    }
    if (msg.action === 'START_TRACKING') {
      createOverlay();
      sendResponse({ ok: true }); return true;
    }
    if (msg.action === 'STOP_TRACKING') {
      removeOverlay();
      chrome.storage.local.set({ trackingEnabled: false });
      sendResponse({ ok: true }); return true;
    }
  });
})();
