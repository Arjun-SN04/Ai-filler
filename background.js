// Service worker — Groq API, resume parsing, overlay fill
// ES Module: import keys from keys.js

import { GROQ_KEYS, currentKey, advanceKey } from './keys.js';

// ─── System prompts ───────────────────────────────────────────────────────────

const FILL_SYSTEM_PROMPT = `You are an aggressive job application assistant whose ONLY goal is to maximize the candidate's chances of getting hired. Return ONLY valid JSON mapping field keys to values.

═══════════════════════════════════════════════
CANDIDATE-FIRST RULES (apply to every field):
═══════════════════════════════════════════════
- ALWAYS choose the most favorable answer that doesn't contradict the profile.
- For YES/NO questions: YES unless the profile clearly says otherwise.
- For experience level dropdowns: pick the highest level the profile can support.
- For "years of experience" fields: round up generously to the nearest tier.
- For skill-fit/rating questions: always pick "Expert" or highest tier.
- For essay/narrative fields: write confidently and persuasively. You may elaborate and present the candidate in the best possible light. Emphasize impact, scale, and outcomes.

ORGANIZATION / COMPANY FIELDS (label contains: organization, company, employer, internship organization, current or previous):
- ALWAYS prefer the MOST RECENT / CURRENT company from the experience list first.
- Use format "Company, Location" if location is available.
- If asking for "current or previous internship" → use the most recent internship company name.

INTERNSHIP / EXPERIENCE DURATION FIELDS (label contains: internship experience, duration, months of experience, how long):
- NEVER pick "NA", "None", "Not Applicable", or "0" if the profile has any work experience or internship entries.
- Instead, calculate from actual experience dates in the profile and pick the CLOSEST realistic option.
- When unsure, pick the MODERATE option (e.g. "6 months" or "1 year") — not the lowest, not the highest.
- Rule: if profile has ≥1 internship → at minimum pick "6 months". If ≥2 internships or total ≥1 year → pick "1 year".

═══════════════════════════════════════════════
STRICT FIELD TYPE RULES:
═══════════════════════════════════════════════

TYPE A — PROJECT / EXPERIENCE QUESTIONS
Triggered when label contains ANY of: project, describe, tell us about, explain, challenge, responsibility, worked on, backend, frontend, built, developed, personally, solo, achievement, contribution, what did you, walk us through, give an example, your role, your experience with

MANDATORY for TYPE A:
1. READ the PROJECTS section in the profile — this has all project data.
2. PICK the best-matching project based on keywords in the question:
   - "backend" → pick project with Backend tag
   - "AI" / "LLM" → pick project with AI/LLM tag
   - "real-time" / "socket" → pick project with Real-time tag
   - "solo" / "personally" / "not group" → pick SOLO/Individual project
   - "frontend" / "UI" → pick project with Frontend tag
   - No specific keyword → pick the most impressive project overall
3. WRITE a compelling 100-180 word answer in warm first-person prose using ONLY that project's data.
4. STRUCTURE every project answer as:
   • Problem: What problem existed and why it mattered
   • Responsibility: Exactly what YOU built/owned (be specific — name the actual feature/module)
   • Tech stack: Name the actual technologies used
   • Result/Impact: A concrete outcome, metric, or challenge overcome

NEVER for TYPE A:
- NEVER copy a "Why do you want to work here?" answer for a project question
- NEVER use the professional summary for a project question
- NEVER use customQA answers for project/experience/challenge questions
- NEVER make up projects not in the profile
- NEVER give a generic motivation answer when asked about a specific project

TYPE B — MOTIVATION / FIT QUESTIONS
Triggered when label contains: why do you want, why this company, why are you interested, motivation, why us, what excites you
→ Use customQA answers or write from the professional summary. Keep it enthusiastic.

TYPE C — STANDARD FIELDS
Name, email, phone, links, dropdowns, checkboxes, salary, dates → fill from profile data directly.

═══════════════════════════════════════════════
GENERAL RULES:
═══════════════════════════════════════════════
1. COUNT from data: "how many companies" = count distinct companies in experience list.
2. EDUCATION: graduation year ≤ 2026 = COMPLETED. Never say "currently pursuing".
3. SALARY: "minimum"→min salary, "expected/desired"→desired salary, "current"→current salary.
4. SKIP: home address, street, zip, DOB, SSN, race, gender, disability, veteran status.
5. Return ONLY the JSON object — no markdown, no explanation.`;


const PARSE_SYSTEM_PROMPT = `Resume parser. Extract info and return JSON only. Use null for missing fields. Be concise.`;

// ─── Key rotation ─────────────────────────────────────────────────────────────

// Try each key in order; rotate on 429. Throws only when ALL keys are exhausted.
async function callGroqWithRotation({ model, systemPrompt, userPrompt, maxTokens = 1200 }) {
  const total = GROQ_KEYS.length;
  let attempts = 0;

  while (attempts < total) {
    const key = currentKey();
    try {
      const result = await callGroqOnce(key, model, systemPrompt, userPrompt, maxTokens);
      return result;
    } catch (err) {
      const isRateLimit = err.message.includes('429') || err.message.toLowerCase().includes('rate limit');
      if (isRateLimit && total > 1) {
        console.warn(`[FF] Key #${attempts + 1} rate-limited, rotating to next key…`);
        advanceKey();
        attempts++;
        // Small back-off before retrying with next key
        await new Promise(r => setTimeout(r, 300));
      } else {
        throw err; // non-rate-limit error or only one key — surface immediately
      }
    }
  }
  throw new Error('All Groq API keys are rate-limited. Please wait a moment and try again.');
}

async function callGroqOnce(apiKey, model, systemPrompt, userPrompt, maxTokens) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const e = await res.json(); msg = e.error?.message || msg; } catch {}
    throw new Error(msg);
  }
  const json = await res.json();
  return json.choices[0].message.content;
}

// Legacy callGroq — used by popup.js GROQ_REQUEST (passes its own apiKey)
async function callGroq({ apiKey, model, systemPrompt, userPrompt }) {
  // If popup passes its own key, use it directly; otherwise use key pool
  if (apiKey && !apiKey.startsWith('gsk_YOUR')) {
    return callGroqOnce(apiKey, model, systemPrompt, userPrompt, 1200);
  }
  return callGroqWithRotation({ model, systemPrompt, userPrompt });
}

// ─── Message router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'GROQ_REQUEST') {
    callGroq(message.payload)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.action === 'PARSE_RESUME') {
    parseResume(message.payload)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.action === 'OVERLAY_FILL_REQUEST') {
    overlayFill(message.fields)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// ─── Overlay fill ─────────────────────────────────────────────────────────────

async function overlayFill(fields) {
  const { model, profile } = await chrome.storage.local.get(['model', 'profile']);
  if (!profile) throw new Error('No profile set up');

  const profileText = buildProfileText(profile);
  const userPrompt  = buildFieldPrompt(profileText, fields);

  // Use more tokens for narrative/essay fields; always use a capable model
  const hasNarrative = fields.some(f => /project|describe|tell us|explain|challenge|responsib|worked on|backend|frontend|built|develop|personal|achievement|strength|weakness|motivat|why|how|walk|role|experience with|give an example/i.test(f.label || ''));
  const maxTokens = hasNarrative ? 2000 : 800;
  const fillModel = 'llama-3.3-70b-versatile'; // needs big model to follow complex routing rules

  return callGroqWithRotation({ model: fillModel, systemPrompt: FILL_SYSTEM_PROMPT, userPrompt, maxTokens });
}

// ─── Profile text builder ─────────────────────────────────────────────────────

function buildProfileText(p) {
  const lines = [];
  const add = (k, v) => { if (v) lines.push(`${k}: ${v}`); };

  const expEntries = (p.experience || []).filter(e => e.company || e.title);
  const companies  = [...new Set(expEntries.map(e => e.company).filter(Boolean))];
  const eduEntries = (p.education  || []).filter(e => e.school);

  lines.push(`COMPUTED: Total companies: ${companies.length} (${companies.join(', ')})`);
  eduEntries.forEach(e => {
    const done = parseInt(e.endYear) <= 2026 ? 'COMPLETED' : 'In Progress';
    lines.push(`COMPUTED: ${e.degree} in ${e.field}, ${e.school} — ${done} (${e.endYear})`);
  });

  add('\nName',        [p.personal?.firstName, p.personal?.lastName].filter(Boolean).join(' '));
  add('Email',        p.personal?.email);
  add('Phone',        p.personal?.phone);
  add('LinkedIn',     p.personal?.linkedin);
  add('GitHub',       p.personal?.github);
  add('Portfolio',    p.personal?.portfolio);
  add('Country',      p.personal?.country);
  add('Nationality',  p.personal?.nationality);
  add('\nTitle',      p.professional?.currentTitle);
  add('Exp',          p.professional?.yearsExperience + ' years');
  add('Summary',      p.professional?.summary);
  add('Salary (cur)', p.professional?.currentSalary  ? `${p.professional.currentSalary} ${p.professional.currency}`  : '');
  add('Salary (min)', p.professional?.minSalary       ? `${p.professional.minSalary} ${p.professional.currency}`      : '');
  add('Salary (des)', p.professional?.desiredSalary   ? `${p.professional.desiredSalary} ${p.professional.currency}` : '');
  add('Work Auth',    p.professional?.workAuthorization);
  add('Sponsorship',  p.professional?.requireSponsorship);
  add('Notice',       p.professional?.noticePeriod);
  add('Work Type',    p.professional?.workType);
  add('Relocate',     p.professional?.willingToRelocate);

  if (expEntries.length) {
    lines.push(`\nEXPERIENCE (${expEntries.length} roles):`);
    expEntries.forEach((e, i) => {
      lines.push(`${i+1}. ${e.title} @ ${e.company} (${e.startDate}–${e.current ? 'Present' : e.endDate})`);
      if (e.description) lines.push(`   ${e.description}`); // full, no truncation
    });
  }

  // PROJECTS block — merges work experience + personal/side projects
  // This is what the AI reads for narrative/essay question matching.
  const projectEntries = (p.projects || []).filter(pr => pr.name || pr.description);
  const allProjectSources = [
    ...expEntries.map(e => ({
      title: e.title ? `${e.title} @ ${e.company}` : e.company,
      desc: e.description || '',
      tech: '',
      solo: !e.current, // intern/non-current = likely solo
      link: '',
      type: 'work',
    })),
    ...projectEntries.map(pr => ({
      title: pr.name || 'Project',
      desc: pr.description || '',
      tech: pr.techStack || '',
      solo: pr.solo !== false,
      link: pr.link || '',
      type: 'personal',
    })),
  ];

  if (allProjectSources.length) {
    lines.push('\nPROJECTS (for narrative/essay matching — pick best match per question):');
    allProjectSources.forEach((proj, i) => {
      const combined = proj.desc + ' ' + proj.tech;
      const tags = [];
      if (/llm|groq|gemini|ai|gpt|language model/i.test(combined))                      tags.push('AI/LLM');
      if (/backend|api|rest|express|node|server|jwt|auth|mongo|stripe|pdf|cert/i.test(combined)) tags.push('Backend');
      if (/react|frontend|ui|css|tailwind|html|responsive/i.test(combined))             tags.push('Frontend');
      if (/socket|real.?time|broadcast/i.test(combined))                                tags.push('Real-time');
      if (/stripe|payment|billing/i.test(combined))                                     tags.push('Payments');
      if (/python|script|automat/i.test(combined))                                      tags.push('Automation');
      if (/mobile|android|ios|flutter|react native/i.test(combined))                    tags.push('Mobile');
      lines.push(`P${i+1} [${proj.type}]: "${proj.title}" | Tags: ${tags.join(', ') || 'General'} | ${proj.solo ? 'SOLO/Individual' : 'Team'}${proj.link ? ' | ' + proj.link : ''}`);
      if (proj.tech) lines.push(`  Tech: ${proj.tech}`);
      lines.push(`  ${proj.desc}`);
    });
  }

  if (eduEntries.length) {
    lines.push('\nEDUCATION:');
    eduEntries.forEach((e, i) => {
      const done = parseInt(e.endYear) <= 2026 ? 'COMPLETED' : 'In Progress';
      lines.push(`${i+1}. ${e.degree} in ${e.field} — ${e.school} (${e.endYear}) [${done}]`);
    });
  }

  if (p.skills)         lines.push(`\nSKILLS: ${p.skills}`);
  if (p.certifications) lines.push(`CERTS: ${p.certifications}`);
  if (p.languages)      lines.push(`LANGUAGES: ${p.languages}`);
  if (p.customContext)  lines.push(`\nCONTEXT: ${p.customContext}`);

  if (p.savedAnswers && Object.keys(p.savedAnswers).length) {
    lines.push('\nSAVED ANSWERS:');
    Object.entries(p.savedAnswers).forEach(([k, v]) => lines.push(`${k.replace(/_/g,' ')}: ${v}`));
  }
  if (p.customQA?.length) {
    const valid = p.customQA.filter(q => q.question && q.answer);
    if (valid.length) {
      // ⚠️  These answers are ONLY for motivation/fit questions ("why do you want to work here" etc.)
      // NEVER use these for project/experience/challenge/describe fields — use PROJECTS section instead.
      lines.push('\nCUSTOM Q&A [MOTIVATION/FIT QUESTIONS ONLY — DO NOT use for project or experience description fields]:');
      valid.forEach(q => { lines.push(`Q: ${q.question}`); lines.push(`A: ${q.answer}`); });
    }
  }
  return lines.join('\n');
}

// ─── Field prompt ─────────────────────────────────────────────────────────────

const PROJECT_FIELD_RE    = /project|describe|explain|challenge|responsib|worked on|backend|frontend|built|developed|personally|not group|solo|achievement|contribution|what did you|walk us through|give an example|your role|your experience with|tell us about a/i;
const MOTIVATION_FIELD_RE = /why do you want|why this company|why are you interested|why us|what excites you|motivation/i;
const ORGANIZATION_FIELD_RE = /organization|internship org|current or previous|employer|company name/i;
const DURATION_FIELD_RE   = /internship experience|duration|months of experience|how long|length of.*intern|intern.*duration/i;

function buildFieldPrompt(profileText, fields) {
  const list = fields.map(f => {
    let s = `[${f.key}] ${f.tag}`;
    if (f.type && f.type !== f.tag) s += `[${f.type}]`;
    if (f.label) s += ` "${f.label}"`;
    if (f.placeholder && f.placeholder !== f.label) s += ` ph="${f.placeholder}"`;
    if (f.options?.length) s += ` opts=[${f.options.slice(0, 8).join('|')}]`;
    if (f.required) s += ' *';

    const label = f.label || '';
    if (PROJECT_FIELD_RE.test(label)) {
      s += `
  *** TYPE-A PROJECT FIELD ***
  Source: PROJECTS section ONLY. Pick the best-matching project.
  Write 120-180 words: (1) Problem statement (2) YOUR exact responsibility — name the module/feature you built (3) Tech stack (4) Concrete result.
  DO NOT use the CUSTOM Q&A section. DO NOT use the professional summary. DO NOT say "I am excited about this opportunity".`;
    } else if (ORGANIZATION_FIELD_RE.test(label)) {
      s += `
  *** ORGANIZATION FIELD ***
  Use the MOST RECENT / CURRENT company from the EXPERIENCE list. Prefer current role. Format: "Company, Location".`;
    } else if (DURATION_FIELD_RE.test(label)) {
      s += `
  *** DURATION FIELD — NEVER pick NA/None/Not Applicable ***
  Check EXPERIENCE section for internship entries. Pick the CLOSEST realistic option based on actual dates.
  If ≥2 internships or total ≥1 year experience → pick "1 year". If 1 internship ~6 months → pick "6 months".
  Minimum: "6 months" if any internship exists. NA is only for candidates with ZERO experience.`;
    } else if (MOTIVATION_FIELD_RE.test(label)) {
      s += `
  *** TYPE-B MOTIVATION FIELD ***
  Source: CUSTOM Q&A section. Pick the most relevant pre-written answer.`;
    }

    return s;
  }).join('\n\n');
  return `PROFILE:\n${profileText}\n\nFIELDS TO FILL (follow per-field directives exactly):\n${list}\n\nReturn ONLY JSON {"key":"value",...}:`;
}

// ─── Resume parsing ───────────────────────────────────────────────────────────

async function parseResume({ apiKey, model, resumeText }) {
  const schema = `{
  "personal": {"firstName":"","lastName":"","email":"","phone":"","city":"","state":"","country":"","linkedin":"","github":"","portfolio":""},
  "professional": {"currentTitle":"","yearsExperience":"","summary":"","workAuthorization":"","noticePeriod":"","workType":"","desiredSalary":"","currency":"USD"},
  "experience": [{"company":"","title":"","startDate":"","endDate":"","current":false,"location":"","description":""}],
  "projects": [{"name":"","description":"","techStack":"","startDate":"","endDate":"","link":"","solo":true}],
  "education": [{"school":"","degree":"","field":"","startYear":"","endYear":"","gpa":""}],
  "skills": "", "certifications": "", "languages": ""
}`;

  const userPrompt = `You are extracting a resume into structured JSON. Follow every rule precisely.

RULES:
1. HYPERLINKS: The resume text ends with a "HYPERLINKS FOUND IN DOCUMENT" section listing all URLs. Match each URL to the correct field:
   - linkedin.com URL → personal.linkedin (use FULL URL with https://)
   - github.com URL → personal.github (use FULL URL with https://)
   - portfolio/vercel/netlify/personal site URL → personal.portfolio (use FULL URL)
2. PROJECTS — for each project's "description": copy ALL bullet points and details VERBATIM. Do NOT summarize. Do NOT shorten. Include every feature, tech detail, and achievement exactly as written.
3. EXPERIENCE — copy full description with all bullet points verbatim. Do not truncate.
4. SOLO: set solo=true for personal/individual projects, solo=false for team/group projects.
5. Return null for truly missing fields. Return ONLY the JSON object.

SCHEMA:
${schema}

RESUME TEXT:
${resumeText.slice(0, 10000)}`;

  // Always use a large capable model for parsing — small 8B models miss details and truncate
  const parseModel = 'llama-3.3-70b-versatile';

  if (apiKey && !apiKey.startsWith('gsk_YOUR')) {
    return callGroqOnce(apiKey, parseModel, PARSE_SYSTEM_PROMPT, userPrompt, 3000);
  }
  return callGroqWithRotation({ model: parseModel, systemPrompt: PARSE_SYSTEM_PROMPT, userPrompt, maxTokens: 3000 });
}
