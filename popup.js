// popup.js

const SYSTEM_PROMPT = `You are a precise, analytical job application assistant. Return ONLY valid JSON mapping field keys to values.

CRITICAL ANALYTICAL RULES — follow these exactly:

1. COUNTING — always derive numbers from actual data, never guess:
   - "How many companies have you worked for?" → count DISTINCT companies in the experience list
   - "Years of experience" → sum months across all roles, convert to years (round to nearest whole number)
   - "Number of projects" → count project entries if available

2. EDUCATION STATUS — check graduation year vs current year (2026):
   - graduation year ≤ 2026 → degree is COMPLETED. Say "completed" or "graduated", NEVER "currently pursuing"
   - graduation year > 2026 → still in progress
   - If a field asks for degree result/classification and none is given, write "First Class" or "Distinction" for strong profiles

3. DROPDOWNS — read EVERY option carefully:
   - For numerical dropdowns [0, 1, 2, 3, 4+] pick the exact computed number
   - Never default to 1 without verifying — always count first
   - If options include ranges like "1-2 years", pick the range that contains the exact value

4. SALARY FIELDS — distinguish carefully:
   - "minimum salary" / "lowest acceptable" → use minimum_salary from profile
   - "expected / desired salary" → use desired_salary
   - "current salary" → use current_salary

5. COVER LETTERS & ESSAYS — write specific, achievement-focused content:
   - Reference actual companies, project names, technologies, and measurable outcomes
   - Do NOT write generic text; use real achievements from the profile

6. SKIP these (will be asked separately): home address, street, apartment, zip/postal, date of birth, age, SSN, race, ethnicity, gender, disability status, veteran status

7. Return ONLY the JSON object — no explanation, no markdown, no extra text`;

// SVG icon strings for status icons
const ICONS = {
  info: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12" y2="16.5" stroke-width="2.5"></line></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
  x:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
  spin:  `<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>`,
};

// ── Status helpers ────────────────────────────────────────────────────────────

function setStatus(text, type = 'default', iconKey = 'info') {
  const el = document.getElementById('status');
  el.className = `status ${type}`;
  document.getElementById('statusIcon').outerHTML =
    `<span class="status-icon" id="statusIcon">${ICONS[iconKey]}</span>`;
  document.getElementById('statusText').textContent = text;
}

function setFillBtn(loading) {
  const btn = document.getElementById('fillBtn');
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `${ICONS.spin} Analyzing…`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"></path></svg> Auto Fill Form`;
}

// ── Profile helpers ───────────────────────────────────────────────────────────

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function completeness(p) {
  if (!p) return { pct: 0, name: '', role: '' };
  const checks = [
    p.personal?.firstName, p.personal?.lastName, p.personal?.email,
    p.personal?.phone, p.personal?.linkedin, p.professional?.currentTitle,
    p.professional?.summary, p.skills,
    p.experience?.length > 0, p.education?.length > 0,
  ];
  const n = checks.filter(Boolean).length;
  return {
    pct: Math.round((n / checks.length) * 100),
    name: [p.personal?.firstName, p.personal?.lastName].filter(Boolean).join(' ') || 'No name',
    role: p.professional?.currentTitle || 'No title set',
  };
}

function buildProfileText(p) {
  const lines = [];
  const add = (k, v) => { if (v) lines.push(`${k}: ${v}`); };

  // ── Computed analytics (give AI pre-calculated facts) ──
  const expEntries = (p.experience || []).filter(e => e.company || e.title);
  const distinctCompanies = [...new Set(expEntries.map(e => e.company).filter(Boolean))];
  const eduEntries = (p.education || []).filter(e => e.school);
  const CURRENT_YEAR = 2026;

  lines.push('=== COMPUTED FACTS (use these for counting/numerical questions) ===');
  lines.push(`Total distinct companies worked: ${distinctCompanies.length}`);
  if (distinctCompanies.length) lines.push(`Company names: ${distinctCompanies.join(', ')}`);
  lines.push(`Years of professional experience: ${p.professional?.yearsExperience || expEntries.length}`);
  if (eduEntries.length) {
    eduEntries.forEach(e => {
      const yr = parseInt(e.endYear);
      const status = yr && yr <= CURRENT_YEAR ? 'COMPLETED' : 'In Progress';
      lines.push(`Education: ${e.degree} in ${e.field}, ${e.school} — ${status} (${e.endYear})`);
    });
  }

  // ── Personal ──
  lines.push('\n=== PERSONAL ===');
  add('Name', [p.personal?.firstName, p.personal?.lastName].filter(Boolean).join(' '));
  add('Email', p.personal?.email);
  add('Phone', p.personal?.phone);
  add('City/State', [p.personal?.city, p.personal?.state].filter(Boolean).join(', '));
  add('Country', p.personal?.country);
  add('Nationality', p.personal?.nationality);
  add('LinkedIn', p.personal?.linkedin);
  add('GitHub', p.personal?.github);
  add('Portfolio', p.personal?.portfolio);

  // ── Professional ──
  lines.push('\n=== PROFESSIONAL ===');
  add('Current Title', p.professional?.currentTitle);
  add('Desired Title', p.professional?.desiredTitle);
  add('Years of Experience', p.professional?.yearsExperience);
  add('Summary', p.professional?.summary);

  const cur = p.professional?.currency || 'INR';
  if (p.professional?.currentSalary)  add('Current Salary',  `${p.professional.currentSalary} ${cur}`);
  if (p.professional?.desiredSalary)  add('Desired/Expected Salary', `${p.professional.desiredSalary} ${cur}`);
  if (p.professional?.minSalary)      add('Minimum Acceptable Salary', `${p.professional.minSalary} ${cur}`);

  add('Work Authorization', p.professional?.workAuthorization);
  add('Requires Sponsorship', p.professional?.requireSponsorship);
  add('Notice Period', p.professional?.noticePeriod);
  add('Preferred Work Type', p.professional?.workType);
  add('Willing to Relocate', p.professional?.willingToRelocate);
  add('Availability', p.professional?.availability);

  // ── Experience ──
  if (expEntries.length) {
    lines.push(`\n=== WORK EXPERIENCE (${expEntries.length} roles at ${distinctCompanies.length} companies) ===`);
    expEntries.forEach((e, i) => {
      lines.push(`${i+1}. ${e.title} at ${e.company} (${e.startDate} – ${e.current ? 'Present' : e.endDate})`);
      if (e.location) lines.push(`   Location: ${e.location}`);
      if (e.description) lines.push(`   ${e.description}`);
    });
  }

  // ── Education ──
  if (eduEntries.length) {
    lines.push('\n=== EDUCATION ===');
    eduEntries.forEach((e, i) => {
      const yr = parseInt(e.endYear);
      const status = yr && yr <= CURRENT_YEAR ? 'COMPLETED' : 'In Progress';
      lines.push(`${i+1}. ${e.degree} in ${e.field} — ${e.school} (${e.endYear}) [${status}]`);
      if (e.gpa) lines.push(`   GPA: ${e.gpa}`);
    });
  }

  if (p.skills) lines.push(`\n=== SKILLS ===\n${p.skills}`);
  if (p.certifications) lines.push(`\n=== CERTIFICATIONS ===\n${p.certifications}`);
  if (p.languages) lines.push(`LANGUAGES: ${p.languages}`);

  // ── Custom context (free-form user notes) ──
  if (p.customContext?.trim()) {
    lines.push('\n=== ADDITIONAL CONTEXT (candidate-provided, high priority) ===');
    lines.push(p.customContext);
  }

  // ── Previously saved personal answers ──
  if (p.savedAnswers && Object.keys(p.savedAnswers).length) {
    lines.push('\n=== PREVIOUSLY ANSWERED PERSONAL FIELDS (reuse these exactly) ===');
    Object.entries(p.savedAnswers).forEach(([k, v]) => {
      lines.push(`${k.replace(/_/g, ' ')}: ${v}`);
    });
  }

  // ── Custom Q&A ──
  if (p.customQA?.length) {
    const valid = p.customQA.filter(q => q.question && q.answer);
    if (valid.length) {
      lines.push('\n=== CUSTOM Q&A (pick the most relevant answer for matching questions) ===');
      valid.forEach(q => { lines.push(`Q: ${q.question}`); lines.push(`A: ${q.answer}`); });
    }
  }

  return lines.join('\n');
}

function buildPrompt(profileText, fields) {
  const list = fields.map(f => {
    let s = `[${f.key}] ${f.tag}`;
    if (f.type && f.type !== f.tag) s += `[${f.type}]`;
    if (f.label) s += ` "${f.label}"`;
    if (f.placeholder && f.placeholder !== f.label) s += ` placeholder="${f.placeholder}"`;
    if (f.name) s += ` name="${f.name}"`;
    if (f.options?.length) s += ` options=[${f.options.slice(0, 10).join(' | ')}]`;
    if (f.required) s += ' *required';
    return s;
  }).join('\n');

  return `CANDIDATE PROFILE:\n${profileText}\n\nFORM FIELDS:\n${list}\n\nReturn ONLY JSON: {"f0":"value",...}`;
}

// ── Communication helpers ─────────────────────────────────────────────────────

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function msg(tabId, message) {
  return new Promise((res, rej) => {
    chrome.tabs.sendMessage(tabId, message, r => {
      if (chrome.runtime.lastError) rej(new Error(chrome.runtime.lastError.message));
      else res(r);
    });
  });
}

function groq(payload) {
  return new Promise((res, rej) => {
    chrome.runtime.sendMessage({ action: 'GROQ_REQUEST', payload }, r => {
      if (chrome.runtime.lastError) return rej(new Error(chrome.runtime.lastError.message));
      if (!r.success) return rej(new Error(r.error));
      res(r.data);
    });
  });
}

// ── Missing fields panel ──────────────────────────────────────────────────────

// Personal field labels that we intentionally skip and ask the user about
const PERSONAL_KEYWORDS = [
  'address', 'street', 'apt', 'suite', 'zip', 'postal', 'city', 'state', 'province',
  'date of birth', 'dob', 'age', 'gender', 'sex', 'race', 'ethnicity',
  'disability', 'veteran', 'ssn', 'social security', 'tax id', 'national id',
  'emergency', 'reference',
];

function isPersonalField(label) {
  const l = label.toLowerCase();
  return PERSONAL_KEYWORDS.some(kw => l.includes(kw));
}

let _currentUnfilled = [];
let _currentTabId = null;

function showMissingPanel(unfilled) {
  // Filter to fields we actually can't fill (personal OR genuinely missing)
  const toShow = unfilled.filter(f => f.label && isPersonalField(f.label) || f.required);
  if (!toShow.length) return;

  _currentUnfilled = toShow;
  const list = document.getElementById('missingList');
  list.innerHTML = '';

  toShow.forEach(f => {
    const row = document.createElement('div');
    row.className = 'missing-field-row';

    const label = document.createElement('div');
    label.className = 'missing-field-label';
    label.textContent = f.label || f.name || 'Unknown field';
    if (f.required) {
      const req = document.createElement('span');
      req.className = 'req';
      req.textContent = '*';
      label.appendChild(req);
    }

    let input;
    if (f.tag === 'select' && f.options?.length) {
      input = document.createElement('select');
      input.className = 'missing-select';
      input.dataset.fieldKey = f.key;
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '— select —';
      input.appendChild(blank);
      f.options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o;
        input.appendChild(opt);
      });
    } else {
      input = document.createElement('input');
      input.className = 'missing-input';
      input.type = f.type === 'date' ? 'date' : 'text';
      input.placeholder = f.placeholder || '';
      input.dataset.fieldKey = f.key;
    }

    row.appendChild(label);
    row.appendChild(input);
    list.appendChild(row);
  });

  document.getElementById('missingTitle').textContent =
    `${toShow.length} field${toShow.length > 1 ? 's' : ''} need your input`;
  document.getElementById('missingPanel').style.display = 'block';
}

async function applyMissingFields() {
  const { profile } = await chrome.storage.local.get('profile');
  const saved = profile?.savedAnswers || {};

  const inputs = document.querySelectorAll('#missingList [data-field-key]');
  const fieldValues = {};

  inputs.forEach(input => {
    const val = input.value.trim();
    if (!val) return;
    const key = input.dataset.fieldKey;
    fieldValues[key] = val;

    // Save by normalised label for future reuse
    const field = _currentUnfilled.find(f => f.key === key);
    if (field?.label) {
      const saveKey = field.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      saved[saveKey] = val;
    }
  });

  if (!Object.keys(fieldValues).length) {
    hideMissingPanel();
    return;
  }

  // Save personal answers to profile
  if (profile) {
    profile.savedAnswers = saved;
    await chrome.storage.local.set({ profile });
  }

  // Fill in the form
  if (_currentTabId) {
    await msg(_currentTabId, { action: 'FILL_FORM', fieldValues });
  }

  setStatus(`Personal fields applied and saved for future.`, 'success', 'check');
  hideMissingPanel();
}

function hideMissingPanel() {
  document.getElementById('missingPanel').style.display = 'none';
  _currentUnfilled = [];
}

// ── Main fill flow ────────────────────────────────────────────────────────────

async function doFill() {
  const { apiKey, model, profile } = await chrome.storage.local.get(['apiKey', 'model', 'profile']);

  if (!apiKey) {
    setStatus('Add your Groq API key in Settings.', 'error', 'x');
    document.getElementById('settingsPanel').style.display = 'flex';
    document.getElementById('settingsBtn').classList.add('active');
    return;
  }

  if (!profile?.personal?.firstName && !profile?.professional?.summary) {
    setStatus('Set up your profile first.', 'error', 'x');
    return;
  }

  const tab = await getTab();
  if (!tab?.id) { setStatus('No active tab.', 'error', 'x'); return; }
  _currentTabId = tab.id;

  hideMissingPanel();

  try {
    setFillBtn(true);
    setStatus('Scanning form fields…', 'loading', 'spin');

    try { await msg(tab.id, { action: 'PING' }); }
    catch { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }); }

    const { fields } = await msg(tab.id, { action: 'SCAN_FORM' });

    if (!fields?.length) {
      setStatus('No fillable fields found on this page.', 'error', 'x');
      return;
    }

    setStatus(`Found ${fields.length} fields — asking AI…`, 'loading', 'spin');

    const profileText = buildProfileText(profile);
    const raw = await groq({
      apiKey, model: model || 'llama-3.1-8b-instant',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildPrompt(profileText, fields),
    });

    let fieldValues;
    try {
      fieldValues = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('AI returned invalid JSON. Try again.');
      fieldValues = JSON.parse(m[0]);
    }

    setStatus('Filling fields…', 'loading', 'spin');
    const { filled, unfilled } = await msg(tab.id, { action: 'FILL_FORM', fieldValues });

    setStatus(`Filled ${filled} of ${fields.length} fields.`, 'success', 'check');

    // Show personal / missing fields panel
    if (unfilled?.length) showMissingPanel(unfilled);

  } catch (err) {
    setStatus(err.message, 'error', 'x');
  } finally {
    setFillBtn(false);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function loadUI() {
  const { apiKey, model, profile } = await chrome.storage.local.get(['apiKey', 'model', 'profile']);

  if (apiKey) document.getElementById('apiKeyInput').value = apiKey;
  if (model) document.getElementById('modelSelect').value = model;

  const c = completeness(profile);
  const name = c.name;
  document.getElementById('profileAvatar').textContent = initials(name);
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileRole').textContent = c.role;
  document.getElementById('progressFill').style.width = `${c.pct}%`;
  document.getElementById('profilePct').textContent = `${c.pct}%`;
}

document.addEventListener('DOMContentLoaded', () => {
  loadUI();

  // Settings toggle
  document.getElementById('settingsBtn').addEventListener('click', () => {
    const p = document.getElementById('settingsPanel');
    const open = p.style.display === 'none' || !p.style.display;
    p.style.display = open ? 'flex' : 'none';
    p.style.flexDirection = 'column';
    document.getElementById('settingsBtn').classList.toggle('active', open);
  });

  // Save API key
  document.getElementById('saveKeyBtn').addEventListener('click', async () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    const model = document.getElementById('modelSelect').value;
    if (!key) return;
    await chrome.storage.local.set({ apiKey: key, model });
    document.getElementById('settingsPanel').style.display = 'none';
    document.getElementById('settingsBtn').classList.remove('active');
    setStatus('API key saved.', 'success', 'check');
  });

  document.getElementById('modelSelect').addEventListener('change', async e => {
    await chrome.storage.local.set({ model: e.target.value });
  });

  document.getElementById('fillBtn').addEventListener('click', doFill);

  document.getElementById('profileBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('profile.html') });
  });

  // Tracking toggle
  let _tracking = false;

  async function loadTrackingState() {
    const { trackingEnabled } = await chrome.storage.local.get('trackingEnabled');
    _tracking = !!trackingEnabled;
    updateTrackBtn();
  }

  function updateTrackBtn() {
    const btn = document.getElementById('trackBtn');
    const lbl = document.getElementById('trackLabel');
    btn.classList.toggle('track-active', _tracking);
    lbl.textContent = _tracking ? 'Tracking' : 'Track';
    btn.title = _tracking ? 'Click to stop tracking' : 'Click to start tracking mode';
  }

  document.getElementById('trackBtn').addEventListener('click', async () => {
    const tab = await getTab();
    if (!tab?.id) { setStatus('No active tab.', 'error', 'x'); return; }

    _tracking = !_tracking;
    await chrome.storage.local.set({ trackingEnabled: _tracking });
    updateTrackBtn();

    if (_tracking) {
      try {
        // Ensure content script is alive
        try { await msg(tab.id, { action: 'PING' }); }
        catch { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }); }
        await msg(tab.id, { action: 'START_TRACKING' });
        setStatus('Tracking mode ON — overlay is live on the page.', 'success', 'check');
      } catch (e) {
        setStatus('Could not start tracking: ' + e.message, 'error', 'x');
        _tracking = false;
        updateTrackBtn();
      }
    } else {
      try { await msg(tab.id, { action: 'STOP_TRACKING' }); } catch {}
      setStatus('Tracking stopped.', 'default', 'info');
    }
  });

  loadTrackingState();

  document.getElementById('clearBtn').addEventListener('click', async () => {
    const tab = await getTab();
    if (!tab?.id) return;
    try {
      await msg(tab.id, { action: 'CLEAR_FORM' });
      setStatus('Fields cleared.', 'default', 'info');
      hideMissingPanel();
    } catch {
      setStatus('Refresh the page and try again.', 'error', 'x');
    }
  });

  document.getElementById('applyMissingBtn').addEventListener('click', applyMissingFields);
  document.getElementById('skipMissingBtn').addEventListener('click', hideMissingPanel);
});
