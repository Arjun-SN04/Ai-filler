// profile.js

// ── Default profile from Arjun S Nair's resume ──────────────────────────────

const ARJUN_PROFILE = {
  personal: {
    firstName: 'Arjun',
    lastName: 'S Nair',
    email: '2004arjunsnair@gmail.com',
    phone: '8377931844',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'India',
    nationality: 'Indian',
    linkedin: 'https://linkedin.com/in/arjun-s-nair',
    github: 'https://github.com/Arjun-SN04',
    portfolio: 'https://arjunsn-portfolio.vercel.app',
    otherUrl: '',
  },
  professional: {
    currentTitle: 'Full Stack AI Integration Developer',
    desiredTitle: 'Full Stack Developer / AI Engineer',
    yearsExperience: '2',
    workAuthorization: 'Indian Citizen',
    requireSponsorship: 'No',
    noticePeriod: 'Immediately available',
    workType: 'Remote or Hybrid',
    willingToRelocate: 'Yes',
    summary: 'Full-stack developer and Computer Science graduate specializing in AI-integrated web applications, scalable backend systems, and modern MERN stack development. Experienced in integrating LLMs, designing secure RESTful APIs, and building production-grade authentication and payment systems. Patent holder and competitive hackathon finalist with a strong passion for solving real-world problems through technology.',
    currentSalary: '',
    minSalary: '',
    desiredSalary: '',
    currency: 'INR',
    payPeriod: 'Annual',
    availability: 'Immediately available',
  },
  experience: [
    {
      company: 'IFOA (International Flight Operational Academy)',
      title: 'Full Stack AI Integration Developer',
      startDate: 'March 2026',
      endDate: '',
      current: true,
      location: 'Remote',
      description: 'Built a provider-agnostic LLM abstraction layer (Gemini + Groq fallback) with auto-failover, token logging, AI-generated quizzes, Edge-TTS audio pipeline, and Mongoose-cached responses. Engineered a JWT/bcrypt-secured certificate service generating EASA/ICAO-compliant PDFs via pdf-lib, with Mongoose schemas for 12 training modules. Built a Stripe billing service with transactional emails, cron renewal jobs, ExcelJS exports, and rate-limit hardening; resolved 13+ payment and email defects. Contributed to a MERN operations platform with Socket.io real-time broadcasting, Multer file uploads, and role-gated HR/sprint/leave modules.',
    },
    {
      company: 'Brainpulse',
      title: 'Web Development Intern',
      startDate: 'June 2025',
      endDate: 'August 2025',
      current: false,
      location: 'Noida',
      description: 'Built responsive React.js front-end features that improved UI responsiveness by 20%. Automated content-formatting workflows with Python scripts. Collaborated in an agile team across multiple client projects.',
    },
  ],
  education: [
    {
      school: 'Dronacharya Group of Institutions, AKTU',
      degree: 'B.Tech',
      field: 'Computer Science & Engineering',
      startYear: '2022',
      endYear: '2026',
      gpa: '',
      current: false,
    },
  ],
  skills: 'Python, JavaScript, Java, React.js, Node.js, Express.js, Socket.io, HTML5, CSS3, Tailwind CSS, MongoDB, REST APIs, Git, GitHub, Vercel, Render, Postman, Stripe API, Prompt Engineering, LLM Integration (Gemini, Groq), AI Model Testing, Content Structuring, Generative AI, Pandas, NumPy, SQL, JSON Data Handling, JWT, bcrypt, pdf-lib, Mongoose, Multer, ExcelJS',
  certifications: 'Full-Stack Web Development, Data Structures & Algorithms, Cisco Cybersecurity. Currently pursuing: Prompt Engineering for Generative AI, Machine Learning Fundamentals (Python)',
  languages: 'English (Fluent), Hindi (Native), Malayalam (Native)',
  customQA: [
    {
      question: 'Why do you want to work here?',
      answer: 'I am excited about this opportunity because it aligns with my passion for building AI-integrated, production-grade applications. I thrive in environments where I can combine my backend and frontend expertise with modern LLM capabilities to solve real-world problems.',
    },
    {
      question: 'Tell us about a challenging project you worked on.',
      answer: 'At IFOA, I built a provider-agnostic LLM abstraction layer supporting Gemini and Groq with automatic failover. The challenge was handling token budgets, caching responses in Mongoose, and maintaining an Edge-TTS audio pipeline reliably. I solved this by designing robust fallback logic and implementing detailed logging for observability.',
    },
    {
      question: 'What is your greatest strength?',
      answer: 'My greatest strength is the ability to bridge AI/ML capabilities with practical full-stack engineering. I can integrate LLMs, design secure APIs, and build end-to-end features that are production-ready — not just prototypes.',
    },
  ],
  customContext: `Patent holder in AI-assisted systems. Smart India Hackathon (SIH) qualifier, Microsoft Imagine Cup qualifier, 1st Prize Technical Quiz, 2nd Prize Hackathon. Strong interest in AI/LLM-integrated products and developer tools. B.Tech COMPLETED in 2026 — do not say "currently pursuing". Worked at exactly 2 companies: IFOA and Brainpulse.`,
  savedAnswers: {},
  projects: [
    {
      name: 'AI Form Filler Chrome Extension',
      description: 'Built a Chrome extension that auto-fills job application forms using Groq LLM. It scans form fields, sends them with user profile context to the AI, and fills answers intelligently including ARIA-based Google Forms widgets.',
      techStack: 'JavaScript, Chrome Extension APIs, Groq API, Shadow DOM, MutationObserver',
      startDate: 'June 2026',
      endDate: 'Present',
      link: 'https://github.com/Arjun-SN04',
      solo: true,
    },
  ],
};

// ── Tabs ─────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`section-${tab.dataset.tab}`).classList.add('active');
  });
});

// ── Dynamic entry rendering ───────────────────────────────────────────────────

function esc(v) { return (v || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

function createExpEntry(data, idx) {
  const d = document.createElement('div');
  d.className = 'entry';
  d.dataset.index = idx;
  d.innerHTML = `
    <div class="entry-header">
      <span class="entry-num">Experience #${idx + 1}</span>
      <button class="btn-remove" onclick="removeEntry('exp',${idx})">Remove</button>
    </div>
    <div class="grid">
      <div class="field"><label>Company</label><input name="exp_company" value="${esc(data.company)}" placeholder="Google"></div>
      <div class="field"><label>Job Title</label><input name="exp_title" value="${esc(data.title)}" placeholder="Senior Engineer"></div>
      <div class="field"><label>Start Date</label><input name="exp_startDate" value="${esc(data.startDate)}" placeholder="Jan 2023"></div>
      <div class="field"><label>End Date</label><input name="exp_endDate" value="${esc(data.endDate)}" placeholder="Present" ${data.current ? 'disabled' : ''}></div>
      <div class="field"><label>Location</label><input name="exp_location" value="${esc(data.location)}" placeholder="Remote / New York"></div>
      <div class="field" style="justify-content:flex-end">
        <div class="check-field">
          <input type="checkbox" name="exp_current" id="ec${idx}" ${data.current ? 'checked' : ''}>
          <label for="ec${idx}">Currently working here</label>
        </div>
      </div>
      <div class="field col-2"><label>Description / Achievements</label><textarea name="exp_desc">${esc(data.description)}</textarea></div>
    </div>`;
  d.querySelector(`#ec${idx}`).addEventListener('change', e => {
    d.querySelector('[name=exp_endDate]').disabled = e.target.checked;
  });
  return d;
}

function createEduEntry(data, idx) {
  const d = document.createElement('div');
  d.className = 'entry';
  d.dataset.index = idx;
  d.innerHTML = `
    <div class="entry-header">
      <span class="entry-num">Education #${idx + 1}</span>
      <button class="btn-remove" onclick="removeEntry('edu',${idx})">Remove</button>
    </div>
    <div class="grid">
      <div class="field col-2"><label>School / University</label><input name="edu_school" value="${esc(data.school)}" placeholder="MIT"></div>
      <div class="field"><label>Degree</label><input name="edu_degree" value="${esc(data.degree)}" placeholder="Bachelor of Science"></div>
      <div class="field"><label>Field of Study</label><input name="edu_field" value="${esc(data.field)}" placeholder="Computer Science"></div>
      <div class="field"><label>Start Year</label><input name="edu_startYear" value="${esc(data.startYear)}" placeholder="2020"></div>
      <div class="field"><label>End Year</label><input name="edu_endYear" value="${esc(data.endYear)}" placeholder="2024"></div>
      <div class="field"><label>GPA (optional)</label><input name="edu_gpa" value="${esc(data.gpa)}" placeholder="3.8 / 4.0"></div>
    </div>`;
  return d;
}

function createQAEntry(data, idx) {
  const d = document.createElement('div');
  d.className = 'entry';
  d.dataset.index = idx;
  d.innerHTML = `
    <div class="entry-header">
      <span class="entry-num">Q&amp;A #${idx + 1}</span>
      <button class="btn-remove" onclick="removeEntry('qa',${idx})">Remove</button>
    </div>
    <div class="field" style="margin-bottom:10px"><label>Question</label><input name="qa_q" value="${esc(data.question)}" placeholder="Why do you want to work here?"></div>
    <div class="field"><label>Your Answer</label><textarea name="qa_a">${esc(data.answer)}</textarea></div>`;
  return d;
}

let expList     = [];
let eduList     = [];
let qaList      = [];
let projectList = [];

function createProjectEntry(data, idx) {
  const d = document.createElement('div');
  d.className = 'entry';
  d.dataset.index = idx;
  d.innerHTML = `
    <div class="entry-header">
      <span class="entry-num">Project #${idx + 1}</span>
      <button class="btn-remove" onclick="removeEntry('project',${idx})">Remove</button>
    </div>
    <div class="grid">
      <div class="field col-2"><label>Project Name</label><input name="proj_name" value="${esc(data.name)}" placeholder="My Awesome App"></div>
      <div class="field col-2"><label>Description</label><textarea name="proj_desc">${esc(data.description)}</textarea></div>
      <div class="field col-2"><label>Tech Stack</label><input name="proj_tech" value="${esc(data.techStack)}" placeholder="React, Node.js, MongoDB…"></div>
      <div class="field"><label>Start Date</label><input name="proj_start" value="${esc(data.startDate)}" placeholder="Jan 2024"></div>
      <div class="field"><label>End Date</label><input name="proj_end" value="${esc(data.endDate)}" placeholder="Mar 2024 or Present"></div>
      <div class="field"><label>GitHub / Demo Link</label><input name="proj_link" value="${esc(data.link)}" placeholder="https://github.com/…"></div>
      <div class="field" style="justify-content:flex-end">
        <div class="check-field">
          <input type="checkbox" name="proj_solo" id="ps${idx}" ${data.solo !== false ? 'checked' : ''}>
          <label for="ps${idx}">Solo / Individual project</label>
        </div>
      </div>
    </div>`;
  return d;
}

function renderList(type) {
  const configs = {
    exp:     { list: expList,     id: 'experienceList', fn: createExpEntry },
    edu:     { list: eduList,     id: 'educationList',  fn: createEduEntry },
    qa:      { list: qaList,      id: 'qaList',         fn: createQAEntry  },
    project: { list: projectList, id: 'projectsList',   fn: createProjectEntry },
  };
  const { list, id, fn } = configs[type];
  const container = document.getElementById(id);
  container.innerHTML = '';
  list.forEach((item, i) => container.appendChild(fn(item, i)));
}

window.removeEntry = (type, idx) => {
  if (type === 'exp')     expList.splice(idx, 1);
  else if (type === 'edu')     eduList.splice(idx, 1);
  else if (type === 'qa')      qaList.splice(idx, 1);
  else if (type === 'project') projectList.splice(idx, 1);
  renderList(type);
};

document.getElementById('addExpBtn').addEventListener('click',     () => { expList.push({});     renderList('exp');     });
document.getElementById('addEduBtn').addEventListener('click',     () => { eduList.push({});     renderList('edu');     });
document.getElementById('addQABtn').addEventListener('click',      () => { qaList.push({});      renderList('qa');      });
document.getElementById('addProjectBtn').addEventListener('click', () => { projectList.push({}); renderList('project'); });

// ── Read / write helpers ──────────────────────────────────────────────────────

const fv = id => document.getElementById(id)?.value?.trim() || '';

function readEntries(type) {
  const list = { exp: expList, edu: eduList, qa: qaList, project: projectList }[type];
  const containerId = { exp: 'experienceList', edu: 'educationList', qa: 'qaList', project: 'projectsList' }[type];
  const container = document.getElementById(containerId);

  return list.map((_, i) => {
    const el = container.querySelector(`.entry[data-index="${i}"]`);
    if (!el) return null;
    const g = name => el.querySelector(`[name=${name}]`)?.value?.trim() || '';
    if (type === 'exp') return {
      company: g('exp_company'), title: g('exp_title'),
      startDate: g('exp_startDate'), endDate: g('exp_endDate'),
      current: el.querySelector('[name=exp_current]')?.checked || false,
      location: g('exp_location'), description: g('exp_desc'),
    };
    if (type === 'edu') return {
      school: g('edu_school'), degree: g('edu_degree'), field: g('edu_field'),
      startYear: g('edu_startYear'), endYear: g('edu_endYear'), gpa: g('edu_gpa'),
    };
    if (type === 'project') return {
      name: g('proj_name'), description: g('proj_desc'), techStack: g('proj_tech'),
      startDate: g('proj_start'), endDate: g('proj_end'), link: g('proj_link'),
      solo: el.querySelector('[name=proj_solo]')?.checked !== false,
    };
    return { question: g('qa_q'), answer: g('qa_a') };
  }).filter(Boolean).filter(e => Object.values(e).some(v => v && v !== false));
}

function collectProfile() {
  return {
    personal: {
      firstName: fv('firstName'), lastName: fv('lastName'),
      email: fv('email'), phone: fv('phone'), address: fv('address'),
      city: fv('city'), state: fv('state'), zip: fv('zip'),
      country: fv('country'), nationality: fv('nationality'),
      linkedin: fv('linkedin'), github: fv('github'),
      portfolio: fv('portfolio'), otherUrl: fv('otherUrl'),
    },
    professional: {
      currentTitle: fv('currentTitle'), desiredTitle: fv('desiredTitle'),
      yearsExperience: fv('yearsExperience'), workAuthorization: fv('workAuthorization'),
      requireSponsorship: fv('requireSponsorship'), noticePeriod: fv('noticePeriod'),
      workType: fv('workType'), willingToRelocate: fv('willingToRelocate'),
      summary: fv('summary'),
      currentSalary: fv('currentSalary'), minSalary: fv('minSalary'),
      desiredSalary: fv('desiredSalary'), currency: fv('currency'),
      payPeriod: fv('payPeriod'), availability: fv('availability'),
    },
    experience:     readEntries('exp'),
    education:      readEntries('edu'),
    projects:       readEntries('project'),
    skills:         fv('skills'),
    certifications: fv('certifications'),
    languages:      fv('languages'),
    customContext:  fv('customContext'),
    customQA:       readEntries('qa'),
  };
}

function populateForm(profile) {
  const p = profile || {};
  const per = p.personal || {};
  const pro = p.professional || {};

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val != null) el.value = val;
  };

  Object.entries(per).forEach(([k, v]) => set(k, v));
  Object.entries(pro).forEach(([k, v]) => set(k, v));
  set('skills', p.skills);
  set('certifications', p.certifications);
  set('languages', p.languages);
  set('customContext', p.customContext);

  expList     = Array.isArray(p.experience) ? [...p.experience] : [];
  eduList     = Array.isArray(p.education)  ? [...p.education]  : [];
  qaList      = Array.isArray(p.customQA)   ? [...p.customQA]   : [];
  projectList = Array.isArray(p.projects)   ? [...p.projects]   : [];

  renderList('exp');
  renderList('edu');
  renderList('qa');
  renderList('project');
}

// ── PDF text extraction ───────────────────────────────────────────────────────

async function extractPdfText(file) {
  if (typeof pdfjsLib !== 'undefined') {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let text = '';
      const allUrls = [];

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);

        // Extract visible text
        const content = await page.getTextContent();
        text += content.items.map(i => i.str).join(' ') + '\n';

        // Extract hyperlink annotations (URLs are NOT in the text stream)
        try {
          const annotations = await page.getAnnotations();
          annotations.forEach(ann => {
            if (ann.subtype === 'Link' && ann.url) allUrls.push(ann.url);
          });
        } catch (_) {}
      }

      // Append discovered URLs as a labelled block so the AI parser can match them
      if (allUrls.length) {
        text += '\n\nHYPERLINKS FOUND IN DOCUMENT:\n' + [...new Set(allUrls)].join('\n');
      }

      return text.trim();
    } catch (e) {
      console.warn('[FF] pdf.js failed:', e);
    }
  }

  // Fallback: regex extractor for simple text-based PDFs
  try {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let raw = '';
    for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);

    let text = '';
    const tjRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
    const tjArrRe = /\[([^\]]*)\]\s*TJ/g;
    let m;
    while ((m = tjRe.exec(raw)) !== null) text += m[1].replace(/\\n/g, ' ').replace(/\\/g, '') + ' ';
    while ((m = tjArrRe.exec(raw)) !== null) {
      const parts = m[1].match(/\([^)]*\)/g) || [];
      text += parts.map(p => p.slice(1, -1)).join('') + ' ';
    }

    // Also extract URIs from PDF annotation streams (regex fallback)
    const uriRe = /\/URI\s*\(([^)]+)\)/g;
    const fallbackUrls = [];
    while ((m = uriRe.exec(raw)) !== null) fallbackUrls.push(m[1]);
    if (fallbackUrls.length) {
      text += '\n\nHYPERLINKS FOUND IN DOCUMENT:\n' + [...new Set(fallbackUrls)].join('\n');
    }

    return text.trim() || null;
  } catch { return null; }
}

// ── Resume parsing ────────────────────────────────────────────────────────────

let _resumeFile = null;

function showParseStatus(text, type) {
  const el = document.getElementById('parseStatus');
  el.textContent = text;
  el.className = `parse-status visible ${type}`;
}

async function parseResume(resumeText) {
  const { apiKey, model } = await chrome.storage.local.get(['apiKey', 'model']);
  if (!apiKey) {
    showParseStatus('Add your Groq API key in Settings first.', 'error');
    return;
  }

  const btn = document.getElementById('parseBtn');
  btn.disabled = true;
  showParseStatus('Extracting profile from resume…', 'loading');

  try {
    const raw = await new Promise((res, rej) => {
      chrome.runtime.sendMessage({
        action: 'PARSE_RESUME',
        payload: { apiKey, model: model || 'llama-3.1-8b-instant', resumeText },
      }, r => {
        if (chrome.runtime.lastError) return rej(new Error(chrome.runtime.lastError.message));
        if (!r.success) return rej(new Error(r.error));
        res(r.data);
      });
    });

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { const m = raw.match(/\{[\s\S]*\}/); parsed = JSON.parse(m?.[0] || '{}'); }

    // Preserve existing savedAnswers and customQA if any
    const { profile: existing } = await chrome.storage.local.get('profile');
    parsed.savedAnswers = existing?.savedAnswers || {};
    if (!parsed.customQA?.length && existing?.customQA?.length) {
      parsed.customQA = existing.customQA;
    }
    // Preserve existing projects if AI didn't extract any
    if (!parsed.projects?.length && existing?.projects?.length) {
      parsed.projects = existing.projects;
    }

    populateForm(parsed);
    await chrome.storage.local.set({ profile: collectProfile() });

    showParseStatus('Profile extracted and saved. Review the tabs and adjust if needed.', 'success');
    // Switch to Personal tab so user can review
    document.querySelector('[data-tab=personal]').click();
  } catch (err) {
    showParseStatus(`Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ── Save / Load ───────────────────────────────────────────────────────────────

async function saveProfile() {
  const profile = collectProfile();
  // Preserve savedAnswers
  const { profile: existing } = await chrome.storage.local.get('profile');
  profile.savedAnswers = existing?.savedAnswers || {};
  await chrome.storage.local.set({ profile });
  showToast();
}

async function loadProfile() {
  const { profile } = await chrome.storage.local.get('profile');
  populateForm(profile || ARJUN_PROFILE);

  // If no profile saved yet, persist the default
  if (!profile) {
    await chrome.storage.local.set({ profile: ARJUN_PROFILE });
  }
}

function showToast() {
  const t = document.getElementById('toast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ── Event wiring ──────────────────────────────────────────────────────────────

document.getElementById('saveBtn').addEventListener('click', saveProfile);
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProfile(); }
});

// Resume drag & drop
const zone = document.getElementById('resumeZone');
const fileInput = document.getElementById('resumeFileInput');

zone.addEventListener('click', () => fileInput.click());

zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
zone.addEventListener('drop', e => {
  e.preventDefault();
  zone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  if (!file.name.match(/\.(pdf|txt)$/i)) {
    showParseStatus('Only PDF and TXT files are supported.', 'error');
    return;
  }
  _resumeFile = file;
  document.getElementById('resumeFileName').textContent = file.name;
  document.getElementById('resumeFileInfo').classList.add('visible');
  document.getElementById('parseStatus').className = 'parse-status';
}

document.getElementById('parseBtn').addEventListener('click', async () => {
  let text = '';

  if (_resumeFile) {
    if (_resumeFile.name.endsWith('.txt')) {
      text = await _resumeFile.text();
    } else {
      showParseStatus('Extracting text from PDF…', 'loading');
      text = await extractPdfText(_resumeFile);
    }
  }

  // Fallback to pasted text
  if (!text?.trim()) {
    text = document.getElementById('resumeText').value.trim();
  }

  if (!text) {
    showParseStatus('Could not extract text. Try pasting your resume text in the box below.', 'error');
    return;
  }

  await parseResume(text);
});

// ── Export profile as text ────────────────────────────────────────────────────

function generateProfileText() {
  const p = collectProfile();
  const lines = [];

  // Header
  const name = [p.personal?.firstName, p.personal?.lastName].filter(Boolean).join(' ');
  if (name) lines.push(name.toUpperCase());

  const contacts = [p.personal?.email, p.personal?.phone, [p.personal?.city, p.personal?.state, p.personal?.country].filter(Boolean).join(', ')].filter(Boolean);
  if (contacts.length) lines.push(contacts.join(' | '));

  const links = [p.personal?.linkedin, p.personal?.github, p.personal?.portfolio].filter(Boolean);
  if (links.length) lines.push(links.join(' | '));

  lines.push('');

  // Professional Summary
  if (p.professional?.summary) {
    lines.push('PROFESSIONAL SUMMARY');
    lines.push(p.professional.summary);
    lines.push('');
  }

  // Professional Details
  const profDetails = [];
  if (p.professional?.currentTitle)    profDetails.push(`Current Title: ${p.professional.currentTitle}`);
  if (p.professional?.yearsExperience) profDetails.push(`Years of Experience: ${p.professional.yearsExperience}`);
  if (p.professional?.workType)        profDetails.push(`Work Type: ${p.professional.workType}`);
  if (p.professional?.noticePeriod)    profDetails.push(`Notice Period: ${p.professional.noticePeriod}`);
  if (p.professional?.desiredSalary)   profDetails.push(`Expected Salary: ${p.professional.desiredSalary} ${p.professional.currency || ''}`);
  if (profDetails.length) {
    lines.push('PROFESSIONAL DETAILS');
    profDetails.forEach(d => lines.push(d));
    lines.push('');
  }

  // Work Experience
  if (p.experience?.length) {
    lines.push('EXPERIENCE');
    p.experience.forEach(e => {
      const period = [e.startDate, e.current ? 'Present' : e.endDate].filter(Boolean).join(' – ');
      lines.push(`${e.title || ''}${e.title && e.company ? ' @ ' : ''}${e.company || ''} | ${period}${e.location ? ' | ' + e.location : ''}`);
      if (e.description) lines.push(e.description);
      lines.push('');
    });
  }

  // Projects
  if (p.projects?.length) {
    lines.push('PROJECTS');
    p.projects.forEach(pr => {
      const period = [pr.startDate, pr.endDate].filter(Boolean).join(' – ');
      lines.push(`${pr.name || 'Project'}${period ? ' | ' + period : ''}${pr.solo ? ' | Individual' : ' | Team'}${pr.link ? ' | ' + pr.link : ''}`);
      if (pr.techStack) lines.push(`Tech: ${pr.techStack}`);
      if (pr.description) lines.push(pr.description);
      lines.push('');
    });
  }

  // Education
  if (p.education?.length) {
    lines.push('EDUCATION');
    p.education.forEach(e => {
      const period = [e.startYear, e.endYear].filter(Boolean).join(' – ');
      lines.push(`${e.degree || ''}${e.field ? ' in ' + e.field : ''} – ${e.school || ''}${period ? ' (' + period + ')' : ''}${e.gpa ? ' | GPA: ' + e.gpa : ''}`);
    });
    lines.push('');
  }

  // Skills
  if (p.skills) {
    lines.push('SKILLS');
    lines.push(p.skills);
    lines.push('');
  }

  // Certifications
  if (p.certifications) {
    lines.push('CERTIFICATIONS');
    lines.push(p.certifications);
    lines.push('');
  }

  // Languages
  if (p.languages) {
    lines.push('LANGUAGES');
    lines.push(p.languages);
    lines.push('');
  }

  // Custom Q&A
  if (p.customQA?.length) {
    const valid = p.customQA.filter(q => q.question && q.answer);
    if (valid.length) {
      lines.push('CUSTOM Q&A');
      valid.forEach(q => { lines.push(`Q: ${q.question}`); lines.push(`A: ${q.answer}`); lines.push(''); });
    }
  }

  return lines.join('\n').trim();
}

document.getElementById('exportProfileBtn').addEventListener('click', async () => {
  const text = generateProfileText();
  document.getElementById('exportPreview').value = text;
  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('exportProfileBtn');
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  } catch {
    // Clipboard blocked — text is still visible in the preview box
  }
});

document.getElementById('exportToParseBtn').addEventListener('click', () => {
  const text = generateProfileText();
  document.getElementById('exportPreview').value = text;
  document.getElementById('resumeText').value = text;
  // Scroll up to the parse section
  document.getElementById('resumeText').scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('resumeText').focus();
});

// ── Init ──────────────────────────────────────────────────────────────────────

loadProfile();

