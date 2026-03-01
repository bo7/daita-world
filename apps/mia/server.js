import express from 'express';
import cors from 'cors';
import { randomBytes } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const app = express();
app.use(express.json({ limit: '16mb' }));
app.use(cors());

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://10.200.0.11:11434';
const MODEL       = process.env.OLLAMA_MODEL  || 'qwen3:235b';
const MLX_HOST    = process.env.MLX_HOST      || 'http://10.200.0.12:8082';
const MLX_MODEL   = 'mlx-community/Qwen2.5-14B-Instruct-4bit';
const PORT        = process.env.PORT          || 3100;
const RESEND_KEY  = process.env.RESEND_KEY    || '';
const SITE_URL    = process.env.SITE_URL      || 'https://hands.trembling-hands.com';
const SB_URL      = process.env.SB_URL        || 'https://imuhzzxnkrmiwlccraff.supabase.co';
const SB_SECRET   = process.env.SB_SECRET     || '';
const SITE_ROOT   = process.env.SITE_ROOT     || '/site';

const tokens = new Map();

async function sbAdmin(method, path, body) {
  const res = await fetch(`${SB_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'apikey': SB_SECRET, 'Authorization': `Bearer ${SB_SECRET}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

async function sendMail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'DAITA-CRAFTER <noreply@daita-crafter.com>', to: [to], subject, html }),
  });
  return res.json();
}

function confirmMailHtml(name, link) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:'Helvetica Neue',sans-serif;background:#f7fbff;padding:40px 0;margin:0;">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #d0e4f4;">
  <div style="background:#1e3a5f;padding:24px 32px;"><span style="font-size:13px;font-weight:700;letter-spacing:0.12em;color:#8fafc8;">DAITA-CRAFTER</span></div>
  <div style="padding:40px 32px;">
    <h1 style="font-size:22px;font-weight:700;color:#1e3a5f;margin:0 0 16px;">Zugang bestätigen</h1>
    <p style="font-size:14px;color:#4a6580;line-height:1.7;margin:0 0 32px;">Hallo${name ? ' ' + name : ''},<br><br>Bitte bestätigen Sie Ihre E-Mail-Adresse:</p>
    <a href="${link}" style="display:inline-block;background:#0078d4;color:#fff;font-size:13px;font-weight:700;padding:14px 28px;text-decoration:none;">ZUGANG BESTÄTIGEN</a>
    <p style="font-size:12px;color:#8fafc8;margin:32px 0 0;">Dieser Link ist 24 Stunden gültig.</p>
  </div>
  <div style="background:#f0f6fd;padding:16px 32px;border-top:1px solid #d0e4f4;"><p style="font-size:11px;color:#8fafc8;margin:0;">DAITA-CRAFTER · ETL-Kontor UG · Hamburg</p></div>
</div></body></html>`;
}

async function ollamaGenerate(prompt, modelOverride, timeoutMs = 300000) {
  const useModel = modelOverride || MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model: useModel, prompt, stream: false, options: { temperature: 0.1, num_predict: 16384 } })
    });
    clearTimeout(timer);
    const d = await res.json();
    return (d.response || '').trim().replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  } catch(e) { clearTimeout(timer); throw e; }
}

const langNames = {
  de:'German',en:'English',fr:'French',nl:'Dutch',es:'Spanish',it:'Italian',
  pt:'Portuguese',pl:'Polish',sv:'Swedish',da:'Danish',fi:'Finnish',nb:'Norwegian',
  cs:'Czech',hu:'Hungarian',ro:'Romanian',tr:'Turkish',ru:'Russian',uk:'Ukrainian',
  ar:'Arabic',he:'Hebrew',zh:'Chinese (Simplified)',ja:'Japanese',ko:'Korean',hi:'Hindi'
};

const LANGUAGES = [
  {code:'fr',name:'French',native:'Français'},{code:'es',name:'Spanish',native:'Español'},
  {code:'nl',name:'Dutch',native:'Nederlands'},{code:'it',name:'Italian',native:'Italiano'},
  {code:'pt',name:'Portuguese',native:'Português'},{code:'pl',name:'Polish',native:'Polski'},
  {code:'sv',name:'Swedish',native:'Svenska'},{code:'da',name:'Danish',native:'Dansk'},
  {code:'fi',name:'Finnish',native:'Suomi'},{code:'nb',name:'Norwegian',native:'Norsk'},
  {code:'cs',name:'Czech',native:'Čeština'},{code:'hu',name:'Hungarian',native:'Magyar'},
  {code:'ro',name:'Romanian',native:'Română'},{code:'tr',name:'Turkish',native:'Türkçe'},
  {code:'ru',name:'Russian',native:'Русский'},{code:'uk',name:'Ukrainian',native:'Українська'},
  {code:'ar',name:'Arabic',native:'العربية'},{code:'zh',name:'Chinese',native:'中文'},
  {code:'ja',name:'Japanese',native:'日本語'},{code:'ko',name:'Korean',native:'한국어'},
  {code:'hi',name:'Hindi',native:'हिन्दी'},{code:'vi',name:'Vietnamese',native:'Tiếng Việt'},
];

app.get('/health', (_, res) => res.json({ ok: true, model: MODEL }));

app.get('/models', async (_, res) => {
  try {
    const r = await fetch(`${OLLAMA_HOST}/api/tags`);
    const d = await r.json();
    res.json(d.models.map(m => m.name));
  } catch(e) { res.status(502).json({ error: e.message }); }
});

app.get('/languages', (_, res) => res.json(LANGUAGES));

app.post('/register', async (req, res) => {
  const { email, password, full_name, company, preferred_language } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email und password erforderlich' });
  const { status, data } = await sbAdmin('POST', '/auth/v1/admin/users', {
    email, password, email_confirm: false, user_metadata: { full_name, company, preferred_language },
  });
  if (status !== 200 && status !== 201) {
    return res.status(400).json({ error: data?.msg || data?.message || JSON.stringify(data) });
  }
  const userId = data.id;
  await sbAdmin('POST', '/rest/v1/profiles', { id: userId, full_name, company, email, approved: false });
  const token = randomBytes(32).toString('hex');
  tokens.set(token, { userId, email, name: full_name, expires: Date.now() + 86400000 });
  const link = `${SITE_URL}/api/confirm?token=${token}`;
  try { await sendMail(email, 'Ihren Zugang bestätigen — DAITA-CRAFTER', confirmMailHtml(full_name, link)); }
  catch(e) { console.error('Mail error:', e.message); }
  res.json({ ok: true, message: 'Bestätigungsmail gesendet' });
});

app.get('/confirm', async (req, res) => {
  const { token } = req.query;
  const entry = tokens.get(token);
  if (!entry || Date.now() > entry.expires) return res.redirect(`${SITE_URL}/register.html?error=token_expired`);
  await sbAdmin('PUT', `/auth/v1/admin/users/${entry.userId}`, { email_confirm: true });
  await sbAdmin('PATCH', `/rest/v1/profiles?id=eq.${entry.userId}`, { approved: true });
  tokens.delete(token);
  res.redirect(`${SITE_URL}/login.html?confirmed=1`);
});

app.post('/translate', async (req, res) => {
  const { text, sourceLang = 'de', targetLang = 'en' } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  const src = langNames[sourceLang] || sourceLang;
  const tgt = langNames[targetLang] || targetLang;
  const prompt = `Translate the following HTML from ${src} to ${tgt}. Preserve ALL HTML tags. Output ONLY translated HTML.\n\n${text}`;
  try {
    const translated = await ollamaGenerate(prompt, null, 300000);
    res.json({ translated, model: MODEL });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/translate-page', async (req, res) => {
  const { html, sourceLang = 'de', targetLang = 'en' } = req.body;
  if (!html) return res.status(400).json({ error: 'html required' });
  const src = langNames[sourceLang] || sourceLang;
  const tgt = langNames[targetLang] || targetLang;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return res.status(400).json({ error: 'no body tag' });
  const prompt = `Translate this HTML body from ${src} to ${tgt}. Preserve all tags. Output ONLY translated HTML body content.\n\n${bodyMatch[1]}`;
  try {
    const translatedBody = await ollamaGenerate(prompt, null, 600000);
    const result = html
      .replace(/<html([^>]*)lang="[^"]*"/, `<html$1lang="${targetLang}"`)
      .replace(/<body([^>]*)>[\s\S]*<\/body>/i, `<body$1>${translatedBody}</body>`);
    res.json({ html: result, model: MODEL });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/translate-text', async (req, res) => {
  const { text, sourceLang = 'de', targetLang = 'en' } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  const src = langNames[sourceLang] || sourceLang;
  const tgt = langNames[targetLang] || targetLang;
  const prompt = `Translate from ${src} to ${tgt}. Keep formatting. Output ONLY translated text.\n\n${text}`;
  try {
    const translated = await ollamaGenerate(prompt, null, 300000);
    res.json({ translated, model: MODEL });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/deploy', async (req, res) => {
  const { lang, path: pagePath, html } = req.body;
  if (!lang || !pagePath || !html) return res.status(400).json({ error: 'lang, path, html required' });
  if (!/^[a-z]{2,3}$/.test(lang)) return res.status(400).json({ error: 'invalid lang' });
  if (!pagePath.startsWith('/') || pagePath.includes('..')) return res.status(400).json({ error: 'invalid path' });
  try {
    const fullPath = join(SITE_ROOT, lang, pagePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, html, 'utf8');
    res.json({ ok: true, deployedTo: `/${lang}${pagePath}` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// ── CV Translation → PDF (PyMuPDF overlay approach) ───────────
import { spawn } from 'child_process';

function runProcess(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { ...opts, stdio: ['ignore','pipe','pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { stdout += d; process.stdout.write(d); });
    proc.stderr.on('data', d => { stderr += d; process.stderr.write(d); });
    proc.on('close', code => resolve({ status: code, stdout, stderr }));
    proc.on('error', reject);
    if (opts.timeout) setTimeout(() => { proc.kill(); reject(new Error('timeout')); }, opts.timeout);
  });
}
import { writeFileSync as wfs, readFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join as pjoin } from 'path';

// Path to the canonical English CV inside the container (mounted via /site volume)
const CV_SOURCE_PDF  = pjoin(SITE_ROOT, 'cv', 'sven-bohnstedt-cv-en.pdf');
const CV_SOURCE_DOCX = pjoin(SITE_ROOT, 'cv', 'sven-bohnstedt-cv-en.docx');

app.get('/cv/list', (req, res) => {
  const cvDir = pjoin(SITE_ROOT, 'cv');
  const allLangs = ['de','en','fr','es','it','pt','nl','pl','cs','sk','hu','ro','hr','sv','da','no','fi','tr','ar','zh','ja','ko','ru','uk'];
  const available = allLangs.filter(lang => {
    try { return existsSync(pjoin(cvDir, `sven-bohnstedt-cv-${lang}.pdf`)); } catch { return false; }
  });
  res.json({ available });
});

app.post('/translate-cv', async (req, res) => {
  const { targetLang = 'en' } = req.body;

  const tgt = langNames[targetLang] || targetLang;
  const useModel = 'qwen2.5:14b';

  // Prefer DOCX source for better fidelity; fall back to PDF
  const useDocx = existsSync(CV_SOURCE_DOCX);
  const srcFile = useDocx ? CV_SOURCE_DOCX : CV_SOURCE_PDF;
  const tmpDocx = pjoin(tmpdir(), `cv-${targetLang}-${Date.now()}.docx`);
  const outPath = pjoin(tmpdir(), `cv-${targetLang}-${Date.now()}.pdf`);
  const script = useDocx ? '/app/translate_cv_docx.py' : '/app/translate_cv.py';
  const mimeType = 'application/pdf';
  const filename = `cv-sven-bohnstedt-${targetLang}.pdf`;

  try {
    if (!existsSync(srcFile)) {
      return res.status(500).json({ error: `Source CV not found at ${srcFile}` });
    }

    console.log(`[translate-cv] ${srcFile} → ${tgt} via ${useModel} (${useDocx ? 'docx→pdf' : 'pdf'})`);

    const scriptOut = useDocx ? tmpDocx : outPath;
    const result = await runProcess(
      'python3',
      [script, srcFile, tgt, scriptOut, useModel],
      { timeout: 600000 }
    );

    if (result.stderr) console.error('[translate_cv.py]', result.stderr);
    if (result.status !== 0) {
      const errMsg = result.stderr || result.error?.message || 'python script failed';
      return res.status(500).json({ error: errMsg });
    }

    let finalPath = outPath;
    if (useDocx) {
      // Translated DOCX → convert to PDF via LibreOffice
      const translated = result.status === 0 ? tmpDocx : null;
      if (!existsSync(tmpDocx)) {
        return res.status(500).json({ error: 'Translated DOCX not created' });
      }
      const lo = await runProcess('libreoffice', [
        '--headless', '--convert-to', 'pdf', '--outdir', tmpdir(), tmpDocx
      ], { timeout: 60000 });
      if (lo.status !== 0) {
        return res.status(500).json({ error: 'LibreOffice conversion failed: ' + lo.stderr });
      }
      // LibreOffice names output based on input filename
      const base = tmpDocx.replace(/\.docx$/, '.pdf');
      finalPath = base;
      try { unlinkSync(tmpDocx); } catch {}
    }

    if (!existsSync(finalPath)) {
      return res.status(500).json({ error: 'Output PDF not created' });
    }

    const pdfBuffer = readFileSync(finalPath);
    try { unlinkSync(finalPath); } catch {}

    // Cache the generated PDF for future requests
    try {
      const cacheDir = pjoin(SITE_ROOT, 'cv');
      const cachePath = pjoin(cacheDir, `sven-bohnstedt-cv-${targetLang}.pdf`);
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(cachePath, pdfBuffer);
      console.log(`[translate-cv] cached to ${cachePath}`);
    } catch(e) { console.error('[translate-cv] cache error:', e.message); }

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename=${filename}`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);

  } catch(e) {
    try { if (existsSync(outPath)) unlinkSync(outPath); } catch {}
    console.error('[translate-cv] error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});


// ─── BACKOFFICE ──────────────────────────────────────────────
const TWENTY_API = 'http://crm.inranet.daita-crafter.com/api';
const TWENTY_TOKEN = process.env.TWENTY_API_KEY || '';

// In-memory booking store (replace with DB later)
const bookingStore = new Map();

// Called from /mia/book — register booking in store
function registerBooking(data) {
  const id = 'bk-' + Date.now();
  bookingStore.set(id, {
    id,
    visitor_name: data.visitorName || 'Unbekannt',
    visitor_email: data.visitorEmail || '',
    company: data.company || '',
    job_title: data.jobTitle || '',
    concern: data.concern || '',
    slot_label: data.slot?.label || '',
    slot_start: data.slot?.start || '',
    video_type: data.videoType || 'meet',
    status: 'new',
    research: '',
    crm_id: null,
    log: [new Date().toISOString() + ': Buchung eingegangen via Mia']
  });
  return id;
}

// GET /api/backoffice/bookings
app.get('/api/backoffice/bookings', (req, res) => {
  res.json([...bookingStore.values()].sort((a,b) => b.id.localeCompare(a.id)));
});

// POST /api/backoffice/research
app.post('/api/backoffice/research', async (req, res) => {
  const { booking_id, company, name, email } = req.body;
  const booking = bookingStore.get(booking_id);
  try {
    // LLM research via Ollama
    const prompt = `Recherchiere das Unternehmen "${company}" kurz und prägnant auf Deutsch.
Antworte NUR mit einem JSON-Objekt: {"summary": "2-4 Sätze über das Unternehmen: Branche, Größe, Haupttätigkeiten, Standort falls bekannt."}
Kein Markdown, nur JSON.`;
    const r = await fetch('${OLLAMA_HOST}/api/generate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ model: 'qwen2.5:14b', prompt, stream: false, format: 'json', options: { temperature: 0.3, num_predict: 300 } })
    });
    const d = await r.json();
    const parsed = JSON.parse(d.response || '{"summary":"Keine Informationen gefunden."}');
    const summary = parsed.summary || d.response;
    if (booking) {
      booking.research = summary;
      booking.status = 'researched';
      booking.log.push(new Date().toISOString() + ': Recherche abgeschlossen');
    }
    res.json({ summary });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/backoffice/crm
app.post('/api/backoffice/crm', async (req, res) => {
  const { booking_id } = req.body;
  const b = bookingStore.get(booking_id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  try {
    // Twenty CRM GraphQL API — create person + company
    const mutation = `mutation CreateLead($firstName: String!, $lastName: String!, $email: String!, $jobTitle: String, $company: String) {
      createPerson(data: {
        name: { firstName: $firstName, lastName: $lastName },
        emails: { primaryEmail: $email },
        jobTitle: $jobTitle
      }) { id name { firstName lastName } }
    }`;
    const nameParts = b.visitor_name.trim().split(' ');
    const firstName = nameParts[0] || b.visitor_name;
    const lastName = nameParts.slice(1).join(' ') || '';
    const gqlRes = await fetch(`${TWENTY_API}/objects/people`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TWENTY_TOKEN}`
      },
      body: JSON.stringify({
        firstName, lastName,
        emails: { primaryEmail: b.visitor_email },
        jobTitle: b.job_title || '',
        city: 'Hamburg'
      })
    });
    const gqlData = await gqlRes.json();
    const crmId = gqlData.data?.id || gqlData.id || ('twenty-' + Date.now());
    b.crm_id = crmId;
    b.status = 'crm';
    b.log.push(new Date().toISOString() + ': CRM Lead angelegt: ' + crmId);
    res.json({ ok: true, crm_id: crmId });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve backoffice HTML
app.use('/backoffice', require('express').static('/opt/bridge/backoffice'));
// ─── END BACKOFFICE ───────────────────────────────────────────

app.listen(PORT, () => console.log(`Bridge :${PORT} → ${OLLAMA_HOST} (${MODEL})`));

// ─── MIA WALLACE — Appointment Agent ────────────────────────────────────────

const SECRETARY_URL = process.env.SECRETARY_URL || 'http://10.200.0.22:8302';
const SECRETARY_KEY = process.env.SECRETARY_KEY || '';
const BRIDGE_URL    = process.env.BRIDGE_URL_SEC || 'http://10.200.0.22:8303';
const BRIDGE_KEY    = process.env.BRIDGE_KEY    || '';
const TG_BOT_TOKEN  = process.env.TG_BOT_TOKEN  || '';
const TG_PETE_ID    = '6362521721';
const MIA_MODEL     = MLX_MODEL; // MLX Qwen2.5-14B on mac2:8082

// Session tracking: sessionId → { booked: bool, rounds: int, gotName: bool, gotEmail: bool, gotTopic: bool }
const miaSessionMap = new Map();

const MIA_SYSTEM = `You are Mia Wallace, appointment assistant for Sven Bohnstedt at DAITA-CRAFTER (data engineering consultancy, Hamburg).

YOUR ONLY JOB: Book appointments for IT/data engineering consultations only.

ALWAYS respond with valid JSON in this exact format:
{
  "reply": "<your message in German or English>",
  "visitor": {
    "name": "<name or empty string>",
    "email": "<email or empty string>",
    "company": "<company or empty string>",
    "concern": "<topic or empty string>",
    "timePref": "<morning|midday|afternoon or empty string>",
    "jobTitle": "<job title/position or empty string>",
    "videoType": "<meet|teams or empty string>"
  },
  "action": null
}

action values:
- null = continue collecting
- "show_slots" = all 6 fields collected (name, email, company, jobTitle, concern, timePref) + topic is IT/data related
- "book_now" = slot selected AND videoType confirmed
- "give_up" = 10+ exchanges, no progress

COLLECTION FLOW (collect ONE field per message, in order):
1. Greet warmly, ask for NAME
2. Got name → ask for EMAIL
3. Got email → ask for COMPANY ("Für welches Unternehmen sind Sie tätig?")
4. Got company → ask for TOPIC, check if IT/data related (reject politely if not)
5. Got topic → ask time preference: morgens (9-12), mittags (12-14) or nachmittags (14-17)?
6. Got timePref → set action="show_slots"

AFTER SLOTS SHOWN:
- Visitor picks slot → ask "Google Meet oder Microsoft Teams?" → set videoType → action="book_now"

RULES:
- Keep replies SHORT (2-4 sentences)
- Reply in visitor's language (German or English)
- Never invent appointment times
- Always fill visitor fields with what you know so far
- Be warm and professional, not robotic`;


async function miaChat(messages) {
  // MLX OpenAI-compatible endpoint — returns structured JSON
  const r = await fetch(`${MLX_HOST}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MIA_MODEL,
      messages: [{ role: 'system', content: MIA_SYSTEM }, ...messages],
      stream: false,
      temperature: 0.3,
      max_tokens: 512,
      response_format: { type: 'json_object' }
    })
  });
  const d = await r.json();
  const raw = (d.choices?.[0]?.message?.content || '{}').trim();
  try {
    return JSON.parse(raw);
  } catch(e) {
    // Fallback: extract JSON from response
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    return { reply: raw, visitor: {}, action: null };
  }
}

async function getSlots(pref = 'any') {
  // Rolling 14-day window starting tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startDate = tomorrow.toISOString().split('T')[0];
  const r = await fetch(`${SECRETARY_URL}/availability?date=${startDate}&days=14`, {
    headers: { 'X-API-Key': SECRETARY_KEY }
  });
  const data = await r.json();

  const timeFilter = {
    morning:   (h) => h >= 9 && h < 12,
    midday:    (h) => h >= 12 && h < 14,
    afternoon: (h) => h >= 14 && h < 17,
    any:       (h) => h >= 9 && h < 17,
  };
  const filter = timeFilter[pref] || timeFilter.any;

  const slots = [];
  const seenDays = new Set();
  const toISO = d => d.toISOString().replace('Z','').replace(/\.\d{3}$/,'');
  for (const day of data) {
    if (slots.length >= 3) break;
    for (const fs of (day.free_slots || [])) {
      if (slots.length >= 3) break;
      const winStart = new Date(fs.start);
      const winEnd   = new Date(fs.end);
      if (winStart.getDay() === 0 || winStart.getDay() === 6) continue;
      // Walk each hour — max 1 slot per calendar day
      const dayKey = winStart.toISOString().split('T')[0];
      if (seenDays.has(dayKey)) continue;
      const cur = new Date(winStart);
      let foundForDay = false;
      while (cur.getTime() + 3600000 <= winEnd.getTime() && !foundForDay) {
        const h = cur.getHours();
        if (filter(h)) {
          const slotEnd = new Date(cur.getTime() + 3600000);
          const hh = String(h).padStart(2,'0');
          const label = cur.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }) +
            ` — ${hh}:00 Uhr`;
          slots.push({ label, start: toISO(cur), end: toISO(slotEnd) });
          seenDays.add(dayKey);
          foundForDay = true;
        }
        cur.setTime(cur.getTime() + 3600000);
      }
    }
  }
  return slots;
}

function extractVisitor(messages) {
  // Extract name, email, concern from conversation history
  const userMsgs = messages.filter(m => m.role === 'user').map(m => m.content.trim());
  const allUserText = userMsgs.join('\n');

  // Email: simple regex
  const emailMatch = allUserText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);

  // Name: 2nd user message is always the name (after greeting)
  // Fall through more patterns until something matches
  let name = '';
  const candidateMsgs = userMsgs.slice(1).filter(l => !l.includes('@') && l.length <= 60);
  for (const line of candidateMsgs) {
    // Explicit name phrase
    const namePhrase = line.match(/(?:ich bin|mein name ist|I am|my name is|ich hei(?:ss|ß)e)\s+(.+)/i);
    if (namePhrase) { name = namePhrase[1].trim().split('\n')[0]; break; }
    // Multi-word name (any case)
    const multiWord = line.match(/^([A-Za-zÄÖÜäöüß][a-zA-ZÄÖÜäöüß\-]*(?:\s+[A-Za-zÄÖÜäöüß][a-zA-ZÄÖÜäöüß\-]*){1,3})$/);
    if (multiWord) { name = multiWord[1].trim(); break; }
    // Single word (≥3 chars, not a greeting)
    const single = line.trim();
    if (single.length >= 3 && single.length <= 30 && !/^(hallo|hi|hey|guten|good|morning|tag|yes|ja|nein|no|ok)$/i.test(single) && !single.includes(' ')) {
      if (!name) name = single;
    }
  }
  // Last resort: just take 2nd user message raw if still empty
  if (!name && candidateMsgs.length > 0) {
    const raw = candidateMsgs[0].trim();
    if (raw.length <= 40) name = raw;
  }

  // Concern: first user message mentioning IT topics
  let concern = '';
  for (const line of userMsgs) {
    if (line.length > 10 && /beratung|platform|data|azure|etl|lakehouse|projekt|pipeline|migration|dwh|warehouse|cloud|integration|architektur/i.test(line)) {
      concern = line; break;
    }
  }

  // Company: look for company field — skip first message (greeting) and require ≥2 words or explicit keyword
  let company = '';
  const compMsgs = userMsgs.slice(1); // skip greeting
  for (const line of compMsgs) {
    if (line.includes('@')) continue;
    if (/^(privat|freelance|freiberuflich|selbstständig|selbststaendig)$/i.test(line.trim())) { company = line.trim(); break; }
    const compMatch = line.match(/(?:firma|unternehmen|arbeite bei|bin bei|company|from|von)\s+([A-Za-zÄÖÜäöüß0-9 &.\-]{2,40})/i);
    if (compMatch) { company = compMatch[1].trim(); break; }
    // Heuristic: 2–5 words, not a topic, not a name, not email-like, not a greeting → likely company
    const words = line.trim().split(/\s+/);
    const isGreeting = /^(hallo|hi|guten tag|good morning|morning|hey)$/i.test(line.trim());
    if (!isGreeting && words.length >= 2 && words.length <= 5 &&
        !/beratung|platform|data|azure|etl|lakehouse|projekt|pipeline|migration|dwh|warehouse|cloud|integration|architektur/i.test(line) &&
        line.trim() !== name && concern) {
      company = line.trim(); break;
    }
  }

  return { name, email: emailMatch ? emailMatch[0] : '', concern, company };
}

function detectTimePref(messages) {
  // Scan user messages from newest to oldest — first match wins
  const userMsgs = messages.filter(m => m.role === 'user').map(m => m.content.toLowerCase()).reverse();
  for (const msg of userMsgs) {
    if (msg.includes('morgens') || msg.includes('morning') || msg.includes('vormittag')) return 'morning';
    if (msg.includes('nachmittags') || msg.includes('afternoon') || msg.includes('nachmittag')) return 'afternoon';
    if (msg.includes('mittags') || msg.includes('midday') || msg.includes('mittag')) return 'midday';
  }
  return null;
}

async function encryptField(value) {
  try {
    const r = await fetch(`${BRIDGE_URL}/encrypt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': BRIDGE_KEY },
      body: JSON.stringify({ field: 'title', value }),
      signal: AbortSignal.timeout(5000)
    });
    const d = await r.json();
    return d.token || value;
  } catch(e) {
    console.warn('[encryptField] fallback (bridge unavailable):', e.message);
    return value; // fall back to plain value
  }
}

function generateICS(name, email, topic, slot) {
  const dtStart = (slot.start || '').replace(/[-:]/g,'').replace('.000Z','Z').replace(/(\d{8}T\d{6})$/,'$1Z');
  const dtEnd   = (slot.end   || '').replace(/[-:]/g,'').replace('.000Z','Z').replace(/(\d{8}T\d{6})$/,'$1Z');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DAITA-CRAFTER//Mia//DE',
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:Meeting mit ${name} — DAITA-CRAFTER`,
    `DESCRIPTION:${topic}`,
    'ORGANIZER:mailto:sven@daita-crafter.com',
    `ATTENDEE:mailto:${email}`,
    `URL:https://meet.google.com/oev-zxxk-hjm`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

async function bookAppointment(body) {
  const { visitorName, visitorEmail, company, concern, slot, videoType, sessionId } = body;
  // Use /book endpoint — handles encryption server-side (bridge unreachable from Docker)
  await fetch(`${SECRETARY_URL}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': SECRETARY_KEY },
    body: JSON.stringify({
      visitor_name: visitorName,
      visitor_email: visitorEmail || '',
      company: company || null,
      concern: concern || '',
      slot_start: slot.start,
      slot_end: slot.end,
      slot_label: slot.label || slot.start,
      video_type: videoType === 'teams' ? 'teams' : 'meet'
    })
  });

  // Confirmation email via Resend
  if (RESEND_KEY && visitorEmail) {
    const icsContent = generateICS(visitorName, visitorEmail, concern || '', slot);
    const icsBase64  = Buffer.from(icsContent).toString('base64');
    const videoLabel = videoType === 'teams' ? 'Microsoft Teams' : 'Google Meet';
    const emailHtml  = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:'Helvetica Neue',sans-serif;background:#f7fbff;padding:40px 0;margin:0;">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #d0e4f4;">
  <div style="background:#1e3a5f;padding:24px 32px;"><span style="font-size:13px;font-weight:700;letter-spacing:0.12em;color:#8fafc8;">DAITA-CRAFTER</span></div>
  <div style="padding:40px 32px;">
    <h1 style="font-size:22px;font-weight:700;color:#1e3a5f;margin:0 0 16px;">Terminbestätigung</h1>
    <p style="font-size:14px;color:#4a6580;line-height:1.7;margin:0 0 16px;">Hallo ${visitorName},</p>
    <p style="font-size:14px;color:#4a6580;line-height:1.7;margin:0 0 24px;">Ihr Termin mit Sven Bohnstedt bei DAITA-CRAFTER wurde gebucht:</p>
    <table style="font-size:13px;color:#1e3a5f;border-collapse:collapse;width:100%;margin-bottom:24px;">
      <tr><td style="padding:6px 0;color:#8fafc8;width:120px;">Datum/Uhrzeit</td><td style="padding:6px 0;">${slot.label || slot.start}</td></tr>
      <tr><td style="padding:6px 0;color:#8fafc8;">Thema</td><td style="padding:6px 0;">${concern || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#8fafc8;">Format</td><td style="padding:6px 0;">${videoLabel}</td></tr>
    </table>
    <p style="font-size:13px;color:#4a6580;background:#f0f6fd;padding:12px 16px;border-left:3px solid #0078d4;margin:0 0 24px;">📹 <a href="https://meet.google.com/oev-zxxk-hjm" style="color:#0078d4;font-weight:600;">https://meet.google.com/oev-zxxk-hjm</a></p>
    <p style="font-size:12px;color:#8fafc8;">Bei Fragen: <a href="mailto:sven@daita-crafter.com" style="color:#0078d4;">sven@daita-crafter.com</a></p>
  </div>
  <div style="background:#f0f6fd;padding:16px 32px;border-top:1px solid #d0e4f4;">
    <p style="font-size:11px;color:#8fafc8;margin:0;">DAITA-CRAFTER · ETL-Kontor UG · Hamburg</p>
  </div>
</div></body></html>`;

    const mailPayload = {
      from: 'Mia Wallace · DAITA-CRAFTER <mia@daita-crafter.com>',
      to: [visitorEmail],
      subject: 'Terminbestätigung — DAITA-CRAFTER',
      html: emailHtml,
      attachments: [{ filename: 'termin-daita-crafter.ics', content: icsBase64, type: 'text/calendar' }]
    };
    const mailRes  = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(mailPayload)
    });
    const mailData = await mailRes.json().catch(() => ({}));
    console.log('[mia/book] email sent:', mailData.id || JSON.stringify(mailData));
  }

  // Telegram notification to Pete
  if (TG_BOT_TOKEN) {
    const MEET_LINK = 'https://meet.google.com/oev-zxxk-hjm';
    const msg = `📅 *Neuer Termin via Mia*\n\n👤 ${visitorName}${company ? ' · ' + company : ''}\n📧 ${visitorEmail || '—'}\n💬 ${concern}\n🕐 ${slot.label}\n📹 ${videoType === 'teams' ? 'Microsoft Teams' : `[Google Meet](${MEET_LINK})`}`;
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_PETE_ID, text: msg, parse_mode: 'Markdown' })
    }).catch(() => {});
  }

  // Mark session as booked
  if (sessionId) {
    const sess = miaSessionMap.get(sessionId) || { booked: false, rounds: 0, slotsShown: false };
    sess.booked = true;
    miaSessionMap.set(sessionId, sess);
  }

  // Async research
  fetch(`http://localhost:${PORT}/mia/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorName, company })
  }).catch(() => {});
}

// POST /mia/chat — JSON-mode, no regex
app.post('/mia/chat', async (req, res) => {
  const { history = [], message, sessionId } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  // Fixed opening — skip LLM on first message
  if (history.length === 0) {
    const opening = 'Hallo, ich bin Mia, die Assistentin von Sven Bohnstedt. Mit wem habe ich das Vergnügen?';
    const openVisitor = { name:'', email:'', company:'', concern:'', timePref:'', videoType:'' };
    return res.json({
      reply: opening, action: null, slots: [],
      visitor: openVisitor,
      history: [{ role: 'user', content: message }, { role: 'assistant', content: JSON.stringify({ reply: opening, visitor: openVisitor, action: null }) }]
    });
  }

  const sess = miaSessionMap.get(sessionId) || { booked: false, rounds: 0, slotsShown: false };
  sess.rounds += 1;
  if (sessionId) miaSessionMap.set(sessionId, sess);

  if (sess.rounds > 12) {
    return res.json({ reply: 'Ich leite Sie an unser Kontaktformular weiter.', action: 'give_up', slots: [], visitor: {}, history });
  }

  const messages = [...history, { role: 'user', content: message }];

  try {
    // miaChat now returns parsed JSON object
    const llmJson = await miaChat(messages);
    const reply = (llmJson.reply || '').trim();
    const visitor = llmJson.visitor || {};
    let action = llmJson.action || null;
    let slots = [];

    if (action === 'give_up') {
      return res.json({ reply: reply || 'Ich leite Sie an unser Kontaktformular weiter.', action: 'give_up', slots: [], visitor, history: [...messages, { role: 'assistant', content: JSON.stringify(llmJson) }] });
    }

    if (action === 'show_slots' && !sess.slotsShown) {
      const pref = visitor.timePref === 'morning' ? 'morning'
                 : visitor.timePref === 'midday'  ? 'midday'
                 : visitor.timePref === 'afternoon' || visitor.timePref === 'nachmittags' ? 'afternoon'
                 : visitor.timePref === 'morgens' ? 'morning'
                 : visitor.timePref === 'mittags' ? 'midday'
                 : 'any';
      slots = await getSlots(pref);
      sess.slotsShown = true;
      if (sessionId) miaSessionMap.set(sessionId, sess);
    } else if (action === 'show_slots' && sess.slotsShown) {
      action = null; // already shown
    }

    if (action === 'book_now') {
      if (sess.booked) return res.json({ reply: 'Es wurde bereits ein Termin gebucht.', action: 'already_booked', slots: [], visitor, history: messages });
    }

    const assistantContent = JSON.stringify(llmJson);
    res.json({ reply, action, slots, visitor, history: [...messages, { role: 'assistant', content: assistantContent }] });

  } catch(e) {
    console.error('[mia/chat error]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /mia/slots
app.get('/mia/slots', async (req, res) => {
  const pref = req.query.pref || 'any';
  try {
    res.json(await getSlots(pref));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /mia/book
app.post('/mia/book', async (req, res) => {
  const { sessionId } = req.body;

  if (sessionId) {
    const sess = miaSessionMap.get(sessionId);
    if (sess && sess.booked) {
      return res.json({ ok: false, error: 'Für diese Sitzung wurde bereits ein Termin gebucht.' });
    }
  }

  try {
    await bookAppointment(req.body);
    console.log('[mia/book] booking done for', req.body.visitorName, req.body.visitorEmail);
    res.json({ ok: true, action: 'done' });
  } catch(e) {
    console.error('[mia/book] ERROR:', e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
});

// POST /mia/research (internal async)
app.post('/mia/research', async (req, res) => {
  res.json({ ok: true });
  const { visitorName, company } = req.body;
  try {
    const query = `${visitorName} ${company || ''} data engineering LinkedIn XING`.trim();
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    const sr = await fetch(searchUrl).catch(() => null);
    const sd = sr ? await sr.json().catch(() => ({})) : {};
    const abstract = sd.AbstractText || sd.Abstract || '';
    const relatedTopics = (sd.RelatedTopics || []).slice(0,3).map(t => t.Text || '').filter(Boolean).join('\n');
    const prompt = `Research this person/company for a sales meeting:\nName: ${visitorName}\nCompany: ${company || 'unknown'}\nWeb info: ${abstract}\n${relatedTopics}\n\nProvide a brief 3-5 bullet profile: background, company size/industry, likely data maturity, potential pain points, conversation angle. Be concise.`;
    const r = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.1:8b', prompt, stream: false })
    });
    const d = await r.json();
    const summary = d.response || 'No research available.';
    if (TG_BOT_TOKEN) {
      const msg = `🔍 *Research: ${visitorName}${company ? ' · ' + company : ''}*\n\n${summary.substring(0, 3000)}`;
      await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_PETE_ID, text: msg, parse_mode: 'Markdown' })
      }).catch(() => {});
    }
  } catch(e) {
    console.error('[mia/research] error:', e.message);
  }
});
