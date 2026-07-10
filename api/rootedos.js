const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const SAFE_LINK_MESSAGE = 'I could not reliably read this link. Paste the caption, transcript, article text, or a short summary, and I’ll build the Truth Trail from that.';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, payload) {
  setCors(res);
  res.status(status).json(payload);
}

function cleanText(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function limitText(value, max = 12000) {
  const text = cleanText(value);
  return text.length > max ? text.slice(0, max) : text;
}

function isUrl(value) {
  try {
    const url = new URL(String(value).trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function detectInputType(rawInput) {
  const input = String(rawInput || '').trim();
  if (!input) return 'unknown';

  if (isUrl(input)) {
    const host = new URL(input).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube_link';
    if (host.includes('tiktok.com') || host.includes('instagram.com') || host.includes('facebook.com') || host.includes('fb.watch')) return 'social_link';
    return 'article_link';
  }

  const biblePattern = /\b(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalms?|proverbs?|ecclesiastes|song of songs|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)\b\s*\d{1,3}(:\d{1,3})?/i;
  if (biblePattern.test(input)) return 'bible_passage';

  return 'plain_text';
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function extractReadableText(rawUrl, inputType) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 RootedOS/1.0 (+https://rootedbyte.com)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  };

  const response = await fetchWithTimeout(rawUrl, { headers, redirect: 'follow' });
  if (!response.ok) throw new Error(`Fetch failed with ${response.status}`);

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    throw new Error('Unsupported content type');
  }

  const html = await response.text();
  if (!html || html.length < 120) throw new Error('Empty page');

  const dom = new JSDOM(html, { url: rawUrl });
  const document = dom.window.document;

  const metaTitle = cleanText(document.querySelector('meta[property="og:title"]')?.getAttribute('content') || document.title || '');
  const metaDescription = cleanText(
    document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
    document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
  );

  let articleText = '';
  try {
    const reader = new Readability(document);
    const article = reader.parse();
    articleText = cleanText(article?.textContent || '');
  } catch (_) {
    articleText = '';
  }

  const bodyText = cleanText(document.body?.textContent || '');
  const bestText = articleText.length >= 500 ? articleText : bodyText;
  const combined = limitText([metaTitle, metaDescription, bestText].filter(Boolean).join('\n\n'), 15000);

  const minimumLength = inputType === 'article_link' ? 500 : 300;
  if (combined.length < minimumLength) throw new Error('Not enough readable text');

  return combined;
}

function buildSystemPrompt() {
  return `You are RootedOS, a premium AI truth-discovery guide for RootedByte.

Tone:
- Minimal, calm, wise, modern, Gen Z to millennial friendly.
- Rooted in biblical truth while accessible to non-Christians and people who just want to be rooted to truth.
- Avoid preachy/churchy tone by default.
- Do not invent Scripture references.
- If Scripture cannot be verified, say: Scripture reference required / not verified.
- Age 14+ appropriate.
- Be specific to the supplied input. Never produce generic filler.

Output rules:
- Return strict JSON only.
- No markdown fences.
- No commentary outside JSON.`;
}

function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Empty AI response');
  try { return JSON.parse(raw); } catch (_) {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object in AI response');
  return JSON.parse(match[0]);
}

async function callGemini(userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable.');
  }

  const response = await fetchWithTimeout(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${buildSystemPrompt()}\n\n${userPrompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.55,
        topP: 0.9,
        responseMimeType: 'application/json'
      }
    })
  }, 22000);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini request failed with ${response.status}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n') || '';
  return extractJson(text);
}

function requireText(value, name) {
  const text = cleanText(value);
  if (!text) throw new Error(`Missing ${name}`);
  return text;
}

async function analyzeInput(payload) {
  const rawInput = requireText(payload.rawInput, 'rawInput');
  const inputType = detectInputType(rawInput);
  let extractedText = '';

  if (['article_link', 'youtube_link', 'social_link'].includes(inputType)) {
    try {
      extractedText = await extractReadableText(rawInput, inputType);
    } catch (_) {
      return {
        ok: false,
        needsUserText: true,
        message: SAFE_LINK_MESSAGE,
        inputType
      };
    }
  } else {
    extractedText = rawInput;
  }

  const prompt = `Analyze this RootedOS input and return JSON with exactly:
{
  "ok": true,
  "inputType": "plain_text | article_link | youtube_link | social_link | bible_passage | unknown",
  "detectedTopic": "short specific topic",
  "extractedText": "cleaned source text, shortened if needed",
  "summary": "2-4 sentence specific summary",
  "confidence": "high | medium | low",
  "needsUserText": false
}

Detected inputType: ${inputType}
Raw input: ${rawInput}
Readable content: ${limitText(extractedText, 9000)}`;

  const result = await callGemini(prompt);
  return {
    ok: true,
    inputType: result.inputType || inputType,
    detectedTopic: cleanText(result.detectedTopic || 'Untitled truth trail'),
    extractedText: limitText(result.extractedText || extractedText, 12000),
    summary: cleanText(result.summary || ''),
    confidence: ['high', 'medium', 'low'].includes(result.confidence) ? result.confidence : 'medium',
    needsUserText: false
  };
}

async function generateQuestions(payload) {
  const rawInput = requireText(payload.rawInput, 'rawInput');
  const extractedText = limitText(payload.extractedText || rawInput, 9000);
  const inputType = cleanText(payload.inputType || detectInputType(rawInput));
  const detectedTopic = cleanText(payload.detectedTopic || 'the user input');

  const prompt = `Create a RootedOS AI-generated question flow. It must be specific to the input and not generic.

Return JSON exactly:
{
  "ok": true,
  "questionTitle": "specific question",
  "contextLine": "one specific line explaining what surfaced",
  "options": [
    { "label": "2-5 words", "description": "specific description", "theme": "one-word-or-short-theme" },
    { "label": "2-5 words", "description": "specific description", "theme": "one-word-or-short-theme" },
    { "label": "2-5 words", "description": "specific description", "theme": "one-word-or-short-theme" }
  ]
}

Input type: ${inputType}
Detected topic: ${detectedTopic}
Raw input: ${rawInput}
Content summary/source: ${extractedText}`;

  const result = await callGemini(prompt);
  if (!Array.isArray(result.options) || result.options.length < 3) {
    throw new Error('AI did not return three question options.');
  }
  return {
    ok: true,
    questionTitle: cleanText(result.questionTitle),
    contextLine: cleanText(result.contextLine),
    options: result.options.slice(0, 3).map(option => ({
      label: cleanText(option.label),
      description: cleanText(option.description),
      theme: cleanText(option.theme)
    }))
  };
}

async function generateTrail(payload) {
  const selectedAnswer = typeof payload.selectedAnswer === 'object'
    ? JSON.stringify(payload.selectedAnswer)
    : cleanText(payload.selectedAnswer || '');

  const prompt = `Create a specific RootedOS Truth Trail Map. Do not use generic filler.

Return JSON exactly:
{
  "ok": true,
  "trailMap": {
    "signal": "what surfaced, specific to the input",
    "pressure": "what is pulling the heart, attention, or meaning",
    "formation": "what this may shape in the person",
    "truthAnchor": "truth that steadies the issue, natural and inclusive",
    "nextStep": "what to journal, study, or practice next"
  }
}

Raw input: ${cleanText(payload.rawInput)}
Extracted text: ${limitText(payload.extractedText || '', 9000)}
Summary: ${cleanText(payload.summary)}
Question: ${cleanText(payload.questionTitle)}
Selected answer/path: ${selectedAnswer}
Theme: ${cleanText(payload.theme)}`;

  const result = await callGemini(prompt);
  const trail = result.trailMap || {};
  ['signal', 'pressure', 'formation', 'truthAnchor', 'nextStep'].forEach(key => {
    if (!cleanText(trail[key])) throw new Error(`AI did not return trailMap.${key}`);
  });
  return { ok: true, trailMap: trail };
}

async function generateStudy(payload) {
  const prompt = `Create a concise, useful RootedOS Study Builder output for journaling and optional PPT.

Return JSON exactly:
{
  "ok": true,
  "study": {
    "title": "specific study title",
    "topic": "specific topic",
    "summary": "specific 2-4 sentence summary",
    "truthTrail": ["3-5 concise items"],
    "studyNotes": ["4-6 concise notes"],
    "reflectionPrompts": ["3-5 specific prompts"],
    "practicalNextSteps": ["3-5 practical next steps"],
    "truthAnchors": ["3-5 rooted truth anchors, no invented references"],
    "journalPrompt": "one specific journal prompt"
  }
}

Raw input: ${cleanText(payload.rawInput)}
Extracted text: ${limitText(payload.extractedText || '', 9000)}
Summary: ${cleanText(payload.summary)}
Question: ${cleanText(payload.questionTitle)}
Selected answer: ${typeof payload.selectedAnswer === 'object' ? JSON.stringify(payload.selectedAnswer) : cleanText(payload.selectedAnswer)}
Trail map: ${JSON.stringify(payload.trailMap || {})}`;

  const result = await callGemini(prompt);
  if (!result.study || !cleanText(result.study.title)) throw new Error('AI did not return a study.');
  return { ok: true, study: result.study };
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, message: 'Method not allowed.' });

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const action = cleanText(payload.action);

    if (action === 'analyze_input') return sendJson(res, 200, await analyzeInput(payload));
    if (action === 'generate_questions') return sendJson(res, 200, await generateQuestions(payload));
    if (action === 'generate_trail') return sendJson(res, 200, await generateTrail(payload));
    if (action === 'generate_study') return sendJson(res, 200, await generateStudy(payload));

    return sendJson(res, 400, { ok: false, message: 'Unknown RootedOS action.' });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      message: error.message || 'RootedOS could not complete this request.'
    });
  }
};
