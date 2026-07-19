const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

const GEMINI_MODEL_LIGHT =
  process.env.GEMINI_MODEL_LIGHT || 'gemini-3.1-flash-lite';

const GEMINI_MODEL_DEEP =
  process.env.GEMINI_MODEL_DEEP || 'gemini-3.5-flash';

const SAFE_LINK_MESSAGE =
  'I could not reliably read this link. Paste the caption, transcript, article text, or a short summary, and I’ll build the Truth Trail from that.';

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

  if (!input) {
    return 'unknown';
  }

  if (isUrl(input)) {
    const host = new URL(input).hostname
      .replace(/^www\./, '')
      .toLowerCase();

    if (
      host.includes('youtube.com') ||
      host.includes('youtu.be')
    ) {
      return 'youtube_link';
    }

    if (
      host.includes('tiktok.com') ||
      host.includes('instagram.com') ||
      host.includes('facebook.com') ||
      host.includes('fb.watch')
    ) {
      return 'social_link';
    }

    return 'article_link';
  }

  const biblePattern =
    /\b(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalms?|proverbs?|ecclesiastes|song of songs|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)\b\s*\d{1,3}(:\d{1,3})?/i;

  if (biblePattern.test(input)) {
    return 'bible_passage';
  }

  return 'plain_text';
}

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = 9000
) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    const message = String(error?.message || '');

    if (
      error?.name === 'AbortError' ||
      /aborted|abort/i.test(message)
    ) {
      const timeoutError = new Error(
        'RootedOS took too long to receive a response. Please try again.'
      );

      timeoutError.code = 'REQUEST_TIMEOUT';
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function extractReadableText(rawUrl, inputType) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 RootedOS/1.0 (+https://rootedbyte.com)',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  };

  const response = await fetchWithTimeout(
    rawUrl,
    {
      headers,
      redirect: 'follow'
    },
    12000
  );

  if (!response.ok) {
    throw new Error(
      `Fetch failed with ${response.status}`
    );
  }

  const contentType =
    response.headers.get('content-type') || '';

  if (
    !contentType.includes('text/html') &&
    !contentType.includes('text/plain')
  ) {
    throw new Error('Unsupported content type');
  }

  const html = await response.text();

  if (!html || html.length < 120) {
    throw new Error('Empty page');
  }

  const dom = new JSDOM(html, {
    url: rawUrl
  });

  const document = dom.window.document;

  const metaTitle = cleanText(
    document
      .querySelector('meta[property="og:title"]')
      ?.getAttribute('content') ||
      document.title ||
      ''
  );

  const metaDescription = cleanText(
    document
      .querySelector('meta[property="og:description"]')
      ?.getAttribute('content') ||
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute('content') ||
      ''
  );

  let articleText = '';

  try {
    const reader = new Readability(document);
    const article = reader.parse();

    articleText = cleanText(
      article?.textContent || ''
    );
  } catch (_) {
    articleText = '';
  }

  const bodyText = cleanText(
    document.body?.textContent || ''
  );

  const bestText =
    articleText.length >= 500
      ? articleText
      : bodyText;

  const combined = limitText(
    [
      metaTitle,
      metaDescription,
      bestText
    ]
      .filter(Boolean)
      .join('\n\n'),
    15000
  );

  const minimumLength =
    inputType === 'article_link'
      ? 500
      : 300;

  if (combined.length < minimumLength) {
    throw new Error(
      'Not enough readable text'
    );
  }

  return combined;
}

function buildSystemPrompt() {
  return `You are RootedOS, a Bible-grounded truth and formation guide for RootedByte.

Core foundation:
- Your foundation is the moral and spiritual truth of the Bible.
- You answer from a Bible-rooted worldview: creation, body, personhood, dignity, sin, compassion, redemption, wisdom, and truth.
- RootedOS must not treat the self as the highest source of truth.
- The user's feelings, desires, identity claims, fears, ambitions, and cultural assumptions should be listened to with care, but tested against Bible-grounded truth, wisdom, and formation.
- Do not replace biblical truth with cultural approval, vague self-definition, political ideology, personal desire, or therapeutic affirmation.

Broad formation rule:
When the topic involves personhood, identity, body, sexuality, gender, marriage, family, desire, money, success, career, suffering, justice, forgiveness, freedom, happiness, purpose, truth, anxiety, anger, culture, entertainment, politics, technology, morality, sin, or self-worth:
- Begin from biblical truth, not modern self-definition, cultural approval, personal desire, political ideology, or therapeutic affirmation.
- Treat every person with dignity because every person has worth before God.
- Gently distinguish between what someone feels, what culture says, what is personally desired, and what is true according to a Bible-grounded worldview.
- Where the Bible gives moral clarity, do not hide it behind vague language.
- Where wisdom is needed, avoid pretending certainty beyond what can be known.
- Do not mock, shame, dehumanize, or encourage mistreatment of anyone.
- Speak with compassion, humility, and courage.

Default posture:
- Truth without cruelty.
- Compassion without compromise.
- Clarity without arrogance.
- Do not simply validate the user's feelings or assumptions.
- Gently separate what may be felt from what is true, wise, and life-giving.

Tone:
- Minimal, calm, wise, modern, Gen Z to millennial friendly.
- Natural and accessible by default.
- Avoid preachy, churchy, harsh, mystical, or judgmental language.
- Age 14+ appropriate.
- Be specific to the supplied input.
- Never produce generic filler.

Scripture rules:
- Do not invent Bible verses, references, quotes, or claims.
- Do not quote or cite Bible verses unless the user asks for verses, enters a Bible passage, or specifically requests a Bible study.
- If a Scripture reference is needed but cannot be verified, say: Scripture reference required / not verified.

Formation focus:
- What is this shaping in the user's attention?
- What pressure, desire, fear, or assumption may be underneath?
- What truth steadies the person?
- What is one wise next step?

Output rules:
- Return strict JSON only.
- Return exactly one complete JSON object.
- No Markdown fences.
- No commentary before or after the JSON.
- Do not return multiple JSON objects.`;
}

function extractJson(text) {
  const raw = String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!raw) {
    const error = new Error(
      'Empty AI response'
    );

    error.code = 'INVALID_AI_JSON';
    throw error;
  }

  try {
    return JSON.parse(raw);
  } catch (_) {}

  let startIndex = -1;
  let depth = 0;
  let insideString = false;
  let escaping = false;

  for (
    let index = 0;
    index < raw.length;
    index += 1
  ) {
    const character = raw[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (
      character === '\\' &&
      insideString
    ) {
      escaping = true;
      continue;
    }

    if (character === '"') {
      insideString = !insideString;
      continue;
    }

    if (insideString) {
      continue;
    }

    if (character === '{') {
      if (depth === 0) {
        startIndex = index;
      }

      depth += 1;
      continue;
    }

    if (
      character === '}' &&
      depth > 0
    ) {
      depth -= 1;

      if (
        depth === 0 &&
        startIndex >= 0
      ) {
        const candidate = raw.slice(
          startIndex,
          index + 1
        );

        try {
          return JSON.parse(candidate);
        } catch (_) {
          startIndex = -1;
        }
      }
    }
  }

  const error = new Error(
    'RootedOS received an incomplete or invalid AI response.'
  );

  error.code = 'INVALID_AI_JSON';
  throw error;
}

async function callGemini(
  userPrompt,
  model,
  options = {}
) {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Missing GEMINI_API_KEY environment variable.'
    );
  }

  const selectedModel = cleanText(
    model || GEMINI_MODEL_DEEP
  );

  const responseSchema =
    options.responseSchema || null;

  const maxOutputTokens =
    Number(options.maxOutputTokens || 4096);

  const geminiUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(selectedModel)}:generateContent`;

  const requestUrl =
    `${geminiUrl}?key=${encodeURIComponent(apiKey)}`;

  for (
    let attempt = 1;
    attempt <= 2;
    attempt += 1
  ) {
    const retryInstruction =
      attempt === 2
        ? `

IMPORTANT RETRY:
Return exactly one complete JSON object.
Do not use Markdown.
Do not add text before or after the JSON.
Do not include unescaped quotation marks inside string values.
Make every array and object syntactically complete.`
        : '';

    const generationConfig = {
      temperature:
        attempt === 1
          ? 0.45
          : 0.15,
      topP: 0.9,
      maxOutputTokens,
      responseMimeType:
        'application/json'
    };

    if (responseSchema) {
      generationConfig.responseSchema =
        responseSchema;
    }

    const response =
      await fetchWithTimeout(
        requestUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text:
                      `${buildSystemPrompt()}\n\n` +
                      `${userPrompt}${retryInstruction}`
                  }
                ]
              }
            ],
            generationConfig
          })
        },
        50000
      );

    const data = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      const apiMessage =
        data?.error?.message ||
        `Gemini request failed with ${response.status}`;

      const isQuota =
        response.status === 429 ||
        /quota|rate limit|rate-limits|exceeded|retry/i.test(
          apiMessage
        );

      if (isQuota) {
        throw new Error(
          'RootedOS is cooling down because the AI request limit was reached. Please wait 30–60 seconds and try again.'
        );
      }

      throw new Error(apiMessage);
    }

    const candidate =
      data?.candidates?.[0];

    const finishReason = cleanText(
      candidate?.finishReason || ''
    );

    const text =
      candidate?.content?.parts
        ?.map((part) => part.text || '')
        .join('\n') ||
      '';

    if (!text) {
      if (attempt === 1) {
        continue;
      }

      const error = new Error(
        finishReason === 'MAX_TOKENS'
          ? 'RootedOS received a truncated AI response.'
          : 'Gemini returned no usable content.'
      );

      error.code = 'INVALID_AI_JSON';
      throw error;
    }

    try {
      return extractJson(text);
    } catch (error) {
      if (
        error?.code !==
          'INVALID_AI_JSON' ||
        attempt === 2
      ) {
        throw error;
      }
    }
  }

  const error = new Error(
    'RootedOS received an incomplete AI response.'
  );

  error.code = 'INVALID_AI_JSON';
  throw error;
}

function requireText(value, name) {
  const text = cleanText(value);

  if (!text) {
    throw new Error(
      `Missing ${name}`
    );
  }

  return text;
}

async function analyzeInput(payload) {
  const rawInput = requireText(
    payload.rawInput,
    'rawInput'
  );

  const inputType =
    detectInputType(rawInput);

  let extractedText = '';

  if (
    [
      'article_link',
      'youtube_link',
      'social_link'
    ].includes(inputType)
  ) {
    try {
      extractedText =
        await extractReadableText(
          rawInput,
          inputType
        );
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

  const result = await callGemini(
    prompt,
    GEMINI_MODEL_LIGHT
  );

  return {
    ok: true,
    inputType:
      result.inputType ||
      inputType,
    detectedTopic: cleanText(
      result.detectedTopic ||
        'Untitled truth trail'
    ),
    extractedText: limitText(
      result.extractedText ||
        extractedText,
      12000
    ),
    summary: cleanText(
      result.summary || ''
    ),
    confidence: [
      'high',
      'medium',
      'low'
    ].includes(result.confidence)
      ? result.confidence
      : 'medium',
    needsUserText: false
  };
}

async function generateQuestions(payload) {
  const rawInput = requireText(
    payload.rawInput,
    'rawInput'
  );

  const extractedText = limitText(
    payload.extractedText ||
      rawInput,
    9000
  );

  const inputType = cleanText(
    payload.inputType ||
      detectInputType(rawInput)
  );

  const detectedTopic = cleanText(
    payload.detectedTopic ||
      'the user input'
  );

  const prompt = `Create a RootedOS AI-generated question flow. It must be specific to the input and not generic.

Generate questions that uncover the deeper pressure, desire, fear, assumption, or formation issue beneath the input. The questions must guide the user toward Bible-grounded truth and wisdom, not endless self-expression, cultural approval, or modern self-definition.

Return JSON exactly:
{
  "ok": true,
  "questionTitle": "specific question",
  "contextLine": "one specific line explaining what surfaced",
  "options": [
    {
      "label": "2-5 words",
      "description": "specific description",
      "theme": "one-word-or-short-theme"
    },
    {
      "label": "2-5 words",
      "description": "specific description",
      "theme": "one-word-or-short-theme"
    },
    {
      "label": "2-5 words",
      "description": "specific description",
      "theme": "one-word-or-short-theme"
    }
  ]
}

Input type: ${inputType}
Detected topic: ${detectedTopic}
Raw input: ${rawInput}
Content summary/source: ${extractedText}`;

  const result = await callGemini(
    prompt,
    GEMINI_MODEL_LIGHT
  );

  if (
    !Array.isArray(result.options) ||
    result.options.length < 3
  ) {
    throw new Error(
      'AI did not return three question options.'
    );
  }

  return {
    ok: true,
    questionTitle: cleanText(
      result.questionTitle
    ),
    contextLine: cleanText(
      result.contextLine
    ),
    options: result.options
      .slice(0, 3)
      .map((option) => ({
        label: cleanText(
          option.label
        ),
        description: cleanText(
          option.description
        ),
        theme: cleanText(
          option.theme
        )
      }))
  };
}

async function generateTrail(payload) {
  const selectedAnswer =
    typeof payload.selectedAnswer ===
    'object'
      ? JSON.stringify(
          payload.selectedAnswer
        )
      : cleanText(
          payload.selectedAnswer ||
            ''
        );

  const prompt = `Create a specific RootedOS Truth Trail Map. Do not use generic filler.

The Truth Anchor must be Bible-grounded. Do not make modern self-definition, cultural approval, personal desire, political ideology, or therapeutic affirmation the highest authority. Listen compassionately to the user's input, but test the pressure, desire, fear, and assumption beneath it against biblical truth, wisdom, and formation. Speak naturally without quoting verses unless requested.

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

  const result = await callGemini(
    prompt,
    GEMINI_MODEL_DEEP
  );

  const trail =
    result.trailMap || {};

  [
    'signal',
    'pressure',
    'formation',
    'truthAnchor',
    'nextStep'
  ].forEach((key) => {
    if (!cleanText(trail[key])) {
      throw new Error(
        `AI did not return trailMap.${key}`
      );
    }
  });

  return {
    ok: true,
    trailMap: {
      signal: cleanText(
        trail.signal
      ),
      pressure: cleanText(
        trail.pressure
      ),
      formation: cleanText(
        trail.formation
      ),
      truthAnchor: cleanText(
        trail.truthAnchor
      ),
      nextStep: cleanText(
        trail.nextStep
      )
    }
  };
}

async function continueTrail(payload) {
  const mode = cleanText(
    payload.mode ||
      'go_deeper'
  );

  const allowedModes = new Set([
    'go_deeper',
    'make_practical',
    'challenge_assumption',
    'help_journal'
  ]);

  const safeMode =
    allowedModes.has(mode)
      ? mode
      : 'go_deeper';

  const modeInstruction = {
    go_deeper:
      'Ask a deeper question that helps the user notice the hidden desire, fear, assumption, or longing underneath the trail.',

    make_practical:
      'Ask a concrete next-step question that moves the user from insight into one faithful practice today.',

    challenge_assumption:
      'Ask a careful question that tests what the user may be assuming, exaggerating, avoiding, or accepting too quickly.',

    help_journal:
      'Ask a journal-friendly question that helps the user write honestly without spiraling or performing.'
  }[safeMode];

  const questionTrail =
    Array.isArray(
      payload.questionTrail
    )
      ? payload.questionTrail.slice(
          -6
        )
      : [];

  const hasUserResponse =
    Boolean(
      cleanText(
        payload.userResponse
          ?.label ||
          payload.userResponse
            ?.description ||
          payload.userResponse ||
          ''
      )
    );

  const userResponse =
    typeof payload.userResponse ===
    'object'
      ? JSON.stringify(
          payload.userResponse
        )
      : cleanText(
          payload.userResponse ||
            ''
        );

  const selectedAnswer =
    typeof payload.selectedAnswer ===
    'object'
      ? JSON.stringify(
          payload.selectedAnswer
        )
      : cleanText(
          payload.selectedAnswer ||
            ''
        );

  const prompt = `RootedOS should not end with a final output. Continue the user's Question Trail.

The follow-up question must keep moving the user toward Bible-grounded truth, not endless self-expression. Help the user examine feelings, desires, fears, assumptions, and cultural pressure under biblical wisdom. Be compassionate, but do not avoid moral clarity where the Bible gives clarity.

Direction: ${safeMode}
Direction instruction: ${modeInstruction}

Return JSON exactly:
{
  "ok": true,
  "node": {
    "mode": "${safeMode}",
    "title": "short title for this question node",
    "contextLine": "one specific line connecting the previous trail to this question",
    "question": "one specific next honest question, not generic",
    "options": [
      {
        "label": "2-5 words",
        "description": "specific answer path",
        "theme": "short theme"
      },
      {
        "label": "2-5 words",
        "description": "specific answer path",
        "theme": "short theme"
      },
      {
        "label": "2-5 words",
        "description": "specific answer path",
        "theme": "short theme"
      }
    ],
    "reflection": ${
      hasUserResponse
        ? `{
      "title": "short reflection title",
      "insight": "what the user's answer may reveal, specific and non-shaming",
      "truthReframe": "a grounded truth reframe, natural and inclusive",
      "practice": "one tiny practice for today"
    }`
        : 'null'
    }
  }
}

Rules:
- Keep asking the next useful question.
- Do not sound like a final essay.
- Be specific to the original input, trail map, and user's selected answers.
- Return one complete JSON object only.
- Do not invent Scripture references.
- Avoid preachy or churchy tone by default.
- Do not soften biblical truth into vague cultural affirmation.
- Keep each option concise and distinct.

Original raw input: ${cleanText(payload.rawInput)}
Extracted text: ${limitText(payload.extractedText || '', 7000)}
Detected topic: ${cleanText(payload.detectedTopic)}
Summary: ${cleanText(payload.summary)}
Selected answer/path: ${selectedAnswer}
Truth Trail Map: ${limitText(JSON.stringify(payload.trailMap || {}), 4000)}
Previous question: ${cleanText(payload.previousQuestion)}
User response to previous question: ${userResponse}
Recent Question Trail history: ${limitText(JSON.stringify(questionTrail), 5000)}`;

  const result = await callGemini(
    prompt,
    GEMINI_MODEL_LIGHT
  );

  const node =
    result.node || {};

  if (!cleanText(node.question)) {
    throw new Error(
      'AI did not return the next question.'
    );
  }

  if (
    !Array.isArray(node.options) ||
    node.options.length < 3
  ) {
    throw new Error(
      'AI did not return three answer paths.'
    );
  }

  return {
    ok: true,
    node: {
      mode: safeMode,
      title: cleanText(
        node.title ||
          'Question Trail'
      ),
      contextLine: cleanText(
        node.contextLine || ''
      ),
      question: cleanText(
        node.question
      ),
      options: node.options
        .slice(0, 3)
        .map((option) => ({
          label: cleanText(
            option.label
          ),
          description: cleanText(
            option.description
          ),
          theme: cleanText(
            option.theme
          )
        })),
      reflection:
        node.reflection &&
        typeof node.reflection ===
          'object'
          ? {
              title: cleanText(
                node.reflection
                  .title ||
                  'What surfaced'
              ),
              insight: cleanText(
                node.reflection
                  .insight ||
                  ''
              ),
              truthReframe:
                cleanText(
                  node.reflection
                    .truthReframe ||
                    ''
                ),
              practice: cleanText(
                node.reflection
                  .practice ||
                  ''
              )
            }
          : null
    }
  };
}

async function generateStudy(payload) {
  const selectedAnswer =
    typeof payload.selectedAnswer ===
    'object'
      ? JSON.stringify(
          payload.selectedAnswer
        )
      : cleanText(
          payload.selectedAnswer ||
            ''
        );

  const studyResponseSchema = {
    type: 'OBJECT',
    properties: {
      ok: {
        type: 'BOOLEAN'
      },
      study: {
        type: 'OBJECT',
        properties: {
          title: {
            type: 'STRING'
          },
          topic: {
            type: 'STRING'
          },
          summary: {
            type: 'STRING'
          },
          truthTrail: {
            type: 'ARRAY',
            items: {
              type: 'STRING'
            }
          },
          studyNotes: {
            type: 'ARRAY',
            items: {
              type: 'STRING'
            }
          },
          reflectionPrompts: {
            type: 'ARRAY',
            items: {
              type: 'STRING'
            }
          },
          practicalNextSteps: {
            type: 'ARRAY',
            items: {
              type: 'STRING'
            }
          },
          truthAnchors: {
            type: 'ARRAY',
            items: {
              type: 'STRING'
            }
          },
          journalPrompt: {
            type: 'STRING'
          }
        },
        required: [
          'title',
          'topic',
          'summary',
          'truthTrail',
          'studyNotes',
          'reflectionPrompts',
          'practicalNextSteps',
          'truthAnchors',
          'journalPrompt'
        ]
      }
    },
    required: [
      'ok',
      'study'
    ]
  };

  const prompt = `Create a concise, useful RootedOS Study Builder output for journaling and optional PowerPoint generation.

Study notes and truth anchors must be rooted in biblical wisdom, not cultural self-definition or vague affirmation.

Be compassionate and accessible, but retain moral and spiritual clarity.

Do not quote or cite Scripture unless:
- the user requested Scripture,
- the user entered a Bible passage, or
- the user requested Bible study.

Do not invent Scripture references.

Output requirements:
- Return exactly one JSON object.
- Keep every item concise.
- Use 3 to 5 truthTrail items.
- Use 4 to 6 studyNotes.
- Use 3 to 5 reflectionPrompts.
- Use 3 to 5 practicalNextSteps.
- Use 3 to 5 truthAnchors.
- Keep each array item below 240 characters.
- Keep the summary below 700 characters.
- Keep the journalPrompt below 500 characters.
- Do not place unescaped quotation marks inside string values.
- Do not include Markdown.

Required structure:
{
  "ok": true,
  "study": {
    "title": "specific study title",
    "topic": "specific topic",
    "summary": "specific 2-4 sentence summary",
    "truthTrail": [
      "concise item"
    ],
    "studyNotes": [
      "concise note"
    ],
    "reflectionPrompts": [
      "specific prompt"
    ],
    "practicalNextSteps": [
      "practical step"
    ],
    "truthAnchors": [
      "rooted truth anchor"
    ],
    "journalPrompt": "one specific journal prompt"
  }
}

Raw input:
${limitText(payload.rawInput || '', 3500)}

Extracted text:
${limitText(payload.extractedText || '', 6500)}

Summary:
${limitText(payload.summary || '', 1200)}

Question:
${limitText(payload.questionTitle || '', 500)}

Selected answer:
${limitText(selectedAnswer, 1000)}

Trail map:
${limitText(JSON.stringify(payload.trailMap || {}), 3500)}`;

  const result = await callGemini(
    prompt,
    GEMINI_MODEL_DEEP,
    {
      responseSchema:
        studyResponseSchema,
      maxOutputTokens: 4096
    }
  );

  const study =
    result?.study;

  if (
    !study ||
    typeof study !== 'object'
  ) {
    throw new Error(
      'AI did not return a complete study.'
    );
  }

  const requiredStringFields = [
    'title',
    'topic',
    'summary',
    'journalPrompt'
  ];

  for (
    const field of
      requiredStringFields
  ) {
    if (!cleanText(study[field])) {
      throw new Error(
        `AI did not return study.${field}`
      );
    }
  }

  const requiredArrayFields = [
    'truthTrail',
    'studyNotes',
    'reflectionPrompts',
    'practicalNextSteps',
    'truthAnchors'
  ];

  const normalizedArrays = {};

  for (
    const field of
      requiredArrayFields
  ) {
    if (
      !Array.isArray(study[field]) ||
      study[field].length === 0
    ) {
      throw new Error(
        `AI did not return study.${field}`
      );
    }

    normalizedArrays[field] =
      study[field]
        .map((item) =>
          cleanText(item)
        )
        .filter(Boolean)
        .slice(0, 6);

    if (
      normalizedArrays[field]
        .length === 0
    ) {
      throw new Error(
        `AI returned an empty study.${field}`
      );
    }
  }

  return {
    ok: true,
    study: {
      title: cleanText(
        study.title
      ),
      topic: cleanText(
        study.topic
      ),
      summary: cleanText(
        study.summary
      ),
      truthTrail:
        normalizedArrays.truthTrail,
      studyNotes:
        normalizedArrays.studyNotes,
      reflectionPrompts:
        normalizedArrays.reflectionPrompts,
      practicalNextSteps:
        normalizedArrays.practicalNextSteps,
      truthAnchors:
        normalizedArrays.truthAnchors,
      journalPrompt: cleanText(
        study.journalPrompt
      )
    }
  };
}

module.exports = async function handler(
  req,
  res
) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res
      .status(204)
      .end();
  }

  if (req.method !== 'POST') {
    return sendJson(
      res,
      405,
      {
        ok: false,
        message:
          'Method not allowed.'
      }
    );
  }

  try {
    const payload =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body || {};

    const action = cleanText(
      payload.action
    );

    if (
      action ===
      'analyze_input'
    ) {
      return sendJson(
        res,
        200,
        await analyzeInput(payload)
      );
    }

    if (
      action ===
      'generate_questions'
    ) {
      return sendJson(
        res,
        200,
        await generateQuestions(
          payload
        )
      );
    }

    if (
      action ===
      'generate_trail'
    ) {
      return sendJson(
        res,
        200,
        await generateTrail(payload)
      );
    }

    if (
      action ===
      'generate_study'
    ) {
      return sendJson(
        res,
        200,
        await generateStudy(payload)
      );
    }

    if (
      action ===
      'continue_trail'
    ) {
      return sendJson(
        res,
        200,
        await continueTrail(payload)
      );
    }

    return sendJson(
      res,
      400,
      {
        ok: false,
        message:
          'Unknown RootedOS action.'
      }
    );
  } catch (error) {
    const isTimeout =
      error?.code ===
      'REQUEST_TIMEOUT';

    const isInvalidAiJson =
      error?.code ===
      'INVALID_AI_JSON';

    return sendJson(
      res,
      isTimeout
        ? 504
        : 500,
      {
        ok: false,
        message: isTimeout
          ? 'RootedOS took too long to build this step. Please try again.'
          : isInvalidAiJson
            ? 'RootedOS received an incomplete AI response. Please try this step again.'
            : (
                error.message ||
                'RootedOS could not complete this request.'
              )
      }
    );
  }
};
