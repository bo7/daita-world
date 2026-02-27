import express from 'express';
import cors from 'cors';
import { randomBytes } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const app = express();
app.use(express.json({ limit: '4mb' }));
app.use(cors());

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://10.200.0.11:11434';
const MODEL       = process.env.OLLAMA_MODEL  || 'Qwen3-Coder-Next:latest';
const PORT        = process.env.PORT          || 3100;
const RESEND_KEY  = process.env.RESEND_KEY    || '';
const SITE_URL    = process.env.SITE_URL      || 'https://hands.trembling-hands.com';
const SB_URL      = process.env.SB_URL        || 'https://imuhzzxnkrmiwlccraff.supabase.co';
const SB_SECRET   = process.env.SB_SECRET     || '';
const SITE_ROOT   = process.env.SITE_ROOT     || '/site';

// In-memory confirm tokens: token -> { userId, email, name, expires }
const tokens = new Map();

// ── Helpers ───────────────────────────────────────────────────

async function sbAdmin(method, path, body) {
  const res = await fetch(`${SB_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SB_SECRET,
      'Authorization': `Bearer ${SB_SECRET}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

async function sendMail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'DAITA-CRAFTER <noreply@daita-crafter.com>',
      to: [to],
      subject,
      html,
    }),
  });
  return res.json();
}

function confirmMailHtml(name, link) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:'Helvetica Neue',sans-serif;background:#f7fbff;padding:40px 0;margin:0;">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #d0e4f4;">
  <div style="background:#1e3a5f;padding:24px 32px;">
    <span style="font-size:13px;font-weight:700;letter-spacing:0.12em;color:#8fafc8;">DAITA-CRAFTER</span>
  </div>
  <div style="padding:40px 32px;">
    <h1 style="font-size:22px;font-weight:700;color:#1e3a5f;margin:0 0 16px;">Zugang bestätigen</h1>
    <p style="font-size:14px;color:#4a6580;line-height:1.7;margin:0 0 32px;">
      Hallo${name ? ' ' + name : ''},<br><br>
      Sie haben sich für den geschützten Bereich von DAITA-CRAFTER registriert.<br>
      Bitte bestätigen Sie Ihre E-Mail-Adresse:
    </p>
    <a href="${link}" style="display:inline-block;background:#0078d4;color:#fff;font-size:13px;font-weight:700;letter-spacing:0.06em;padding:14px 28px;text-decoration:none;">ZUGANG BESTÄTIGEN</a>
    <p style="font-size:12px;color:#8fafc8;margin:32px 0 0;line-height:1.6;">
      Dieser Link ist 24 Stunden gültig.<br>
      Falls Sie sich nicht registriert haben, ignorieren Sie diese Mail.
    </p>
  </div>
  <div style="background:#f0f6fd;padding:16px 32px;border-top:1px solid #d0e4f4;">
    <p style="font-size:11px;color:#8fafc8;margin:0;">DAITA-CRAFTER · ETL-Kontor UG · Hamburg</p>
  </div>
</div>
</body></html>`;
}

async function ollamaGenerate(prompt, timeoutMs = 300000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0.1, num_predict: 8192 } })
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
  ar:'Arabic',he:'Hebrew',zh:'Chinese (Simplified)',ja:'Japanese',ko:'Korean'
};

// ── Health ────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, model: MODEL }));

// ── Models ────────────────────────────────────────────────────
app.get('/models', async (_, res) => {
  try {
    const r = await fetch(`${OLLAMA_HOST}/api/tags`);
    const d = await r.json();
    res.json(d.models.map(m => m.name));
  } catch(e) { res.status(502).json({ error: e.message }); }
});

// ── Languages ─────────────────────────────────────────────────
let langsCache = null;
app.get('/languages', async (_, res) => {
  if (langsCache) return res.json(langsCache);
  try {
    const text = await ollamaGenerate(
      `List 30 languages you can translate to with high quality. Respond ONLY with a JSON array: [{"code":"en","name":"English","native":"English"},...]. No other text.`,
      60000
    );
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('no json');
    langsCache = JSON.parse(match[0]);
    res.json(langsCache);
  } catch {
    langsCache = [
      {code:'en',name:'English',native:'English'},{code:'fr',name:'French',native:'Français'},
      {code:'es',name:'Spanish',native:'Español'},{code:'nl',name:'Dutch',native:'Nederlands'},
      {code:'it',name:'Italian',native:'Italiano'},{code:'pt',name:'Portuguese',native:'Português'},
      {code:'pl',name:'Polish',native:'Polski'},{code:'sv',name:'Swedish',native:'Svenska'},
      {code:'tr',name:'Turkish',native:'Türkçe'},{code:'ru',name:'Russian',native:'Русский'},
      {code:'ar',name:'Arabic',native:'العربية'},{code:'zh',name:'Chinese',native:'中文'},
      {code:'ja',name:'Japanese',native:'日本語'},{code:'ko',name:'Korean',native:'한국어'},
    ];
    res.json(langsCache);
  }
});

// ── Register ─────────────────────────────────────────────────
// POST /register { email, password, full_name, company }
app.post('/register', async (req, res) => {
  const { email, password, full_name, company } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email und password erforderlich' });

  // Create user via admin API (email NOT confirmed yet)
  const { status, data } = await sbAdmin('POST', '/auth/v1/admin/users', {
    email,
    password,
    email_confirm: false,
    user_metadata: { full_name, company },
  });

  if (status !== 200 && status !== 201) {
    const msg = data?.msg || data?.message || JSON.stringify(data);
    return res.status(400).json({ error: msg });
  }

  const userId = data.id;

  // Upsert profile
  await sbAdmin('POST', '/rest/v1/profiles', {
    id: userId, full_name, company, email, approved: false
  });

  // Generate confirm token (24h)
  const token = randomBytes(32).toString('hex');
  tokens.set(token, { userId, email, name: full_name, expires: Date.now() + 86400000 });

  // Send confirm mail
  const link = `${SITE_URL}/api/confirm?token=${token}`;
  try {
    await sendMail(email, 'Ihren Zugang bestätigen — DAITA-CRAFTER', confirmMailHtml(full_name, link));
  } catch(e) {
    console.error('Mail error:', e.message);
  }

  res.json({ ok: true, message: 'Bestätigungsmail gesendet' });
});

// ── Confirm ───────────────────────────────────────────────────
// GET /confirm?token=xxx  → redirect to login with message
app.get('/confirm', async (req, res) => {
  const { token } = req.query;
  const entry = tokens.get(token);

  if (!entry || Date.now() > entry.expires) {
    return res.redirect(`${SITE_URL}/register.html?error=token_expired`);
  }

  // Confirm email in Supabase
  await sbAdmin('PUT', `/auth/v1/admin/users/${entry.userId}`, {
    email_confirm: true,
  });

  // Mark approved
  await sbAdmin('PATCH', `/rest/v1/profiles?id=eq.${entry.userId}`, {
    approved: true,
  });

  tokens.delete(token);

  res.redirect(`${SITE_URL}/login.html?confirmed=1`);
});

// ── Translate ─────────────────────────────────────────────────
app.post('/translate', async (req, res) => {
  const { text, sourceLang = 'de', targetLang = 'en' } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  const src = langNames[sourceLang] || sourceLang;
  const tgt = langNames[targetLang] || targetLang;
  const prompt = `You are a professional translator for B2B IT services marketing copy.
Translate the following HTML from ${src} to ${tgt}.
Rules: preserve ALL HTML tags; translate only visible text; keep professional tone; do not translate URLs, brand names, prices.
Output ONLY the translated HTML, nothing else.

${text}`;
  try {
    const translated = await ollamaGenerate(prompt, 300000);
    res.json({ translated, model: MODEL });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Translate full page ───────────────────────────────────────
app.post('/translate-page', async (req, res) => {
  const { html, sourceLang = 'de', targetLang = 'en' } = req.body;
  if (!html) return res.status(400).json({ error: 'html required' });
  const src = langNames[sourceLang] || sourceLang;
  const tgt = langNames[targetLang] || targetLang;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return res.status(400).json({ error: 'no body tag' });
  const prompt = `Translate this HTML body from ${src} to ${tgt}. Preserve all tags/attributes. Output ONLY translated HTML body content.\n\n${bodyMatch[1]}`;
  try {
    const translatedBody = await ollamaGenerate(prompt, 600000);
    let result = html
      .replace(/<html([^>]*)lang="[^"]*"/, `<html$1lang="${targetLang}"`)
      .replace(/<body([^>]*)>[\s\S]*<\/body>/i, `<body$1>${translatedBody}</body>`);
    res.json({ html: result, model: MODEL });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Translate PDF text ────────────────────────────────────────
// POST /translate-text { text, sourceLang, targetLang }
app.post('/translate-text', async (req, res) => {
  const { text, sourceLang = 'de', targetLang = 'en' } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  const src = langNames[sourceLang] || sourceLang;
  const tgt = langNames[targetLang] || targetLang;
  const prompt = `Translate the following text from ${src} to ${tgt}. Keep formatting, line breaks, and structure. Output ONLY the translated text.\n\n${text}`;
  try {
    const translated = await ollamaGenerate(prompt, 300000);
    res.json({ translated, model: MODEL });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Deploy translated page ────────────────────────────────────
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

app.listen(PORT, () => console.log(`Bridge :${PORT} → ${OLLAMA_HOST} (${MODEL})`));


// ── Translate CV PDF ──────────────────────────────────────────
// POST /translate-cv { pdfBase64, sourceLang, targetLang }
// Extracts text via pdftotext (poppler), translates, returns text
import { execSync, spawnSync } from 'child_process';
import { writeFileSync as wfs, readFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join as pjoin } from 'path';

app.post('/translate-cv', async (req, res) => {
  const { pdfBase64, sourceLang = 'de', targetLang = 'en' } = req.body;
  if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 required' });

  const tmp = tmpdir();
  const pdfPath = pjoin(tmp, `cv_${Date.now()}.pdf`);
  const txtPath = pdfPath.replace('.pdf', '.txt');

  try {
    // Write PDF
    wfs(pdfPath, Buffer.from(pdfBase64, 'base64'));

    // Extract text
    let cvText = '';
    try {
      spawnSync('pdftotext', ['-layout', pdfPath, txtPath]);
      if (existsSync(txtPath)) {
        cvText = readFileSync(txtPath, 'utf8');
      }
    } catch {}

    if (!cvText || cvText.trim().length < 50) {
      return res.status(422).json({ error: 'PDF-Textextraktion fehlgeschlagen. Bitte prüfen Sie ob die CV-Datei vorhanden ist.' });
    }

    // Cleanup temp files
    try { unlinkSync(pdfPath); unlinkSync(txtPath); } catch {}

    const src = langNames[sourceLang] || sourceLang;
    const tgt = langNames[targetLang] || targetLang;

    const prompt = `Translate the following CV/resume text from ${src} to ${tgt}.
Keep the structure, formatting, dates, company names, and technical terms.
Translate all section headers, descriptions, and text naturally.
Output ONLY the translated text, no preamble.

${cvText}`;

    const translated = await ollamaGenerate(prompt, 300000);
    res.json({ translated, model: MODEL });

  } catch(e) {
    try { if (existsSync(pdfPath)) unlinkSync(pdfPath); } catch {}
    try { if (existsSync(txtPath)) unlinkSync(txtPath); } catch {}
    res.status(500).json({ error: e.message });
  }
});
