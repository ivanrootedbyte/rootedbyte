(function () {
  const STORAGE_KEY = 'rootedosTrail';
const JOURNAL_KEY = 'rootedosJournalEntries';
const SESSION_KEY = 'rootedosStudySession';

const ROOTEDOS_GEMINI_ENDPOINT = '/api/gemini';

/*
  MVP NOTE:
  Do not expose a real Gemini API key in production frontend code long-term.
  For first local/Vercel prototype testing, this can be used temporarily.
  Later, move Gemini calls into a Supabase Edge Function or Vercel serverless function.
*/
const GEMINI_API_KEY = '';

  const CATEGORY_META = {
    word: {
      title: 'The Word',
      desc: 'Begin directly from Scripture, a passage, or a Bible study question and let RootedOS build a guided trail toward reflection, understanding, and study output.',
      pills: ['Bible passage', 'Study question', 'Theme', 'Book chapter'],
      sampleInput: 'Romans 12 and renewing the mind',
      questions: [
        { title: 'What stands out most?', options: ['Obedience', 'Renewal', 'Sacrifice'] },
        { title: 'What feels most personal here?', options: ['Identity', 'Calling', 'Transformation'] }
      ]
    },
    culture: {
      title: 'Culture',
      desc: 'Start with a cultural question, trend, worldview, identity struggle, or modern pressure, then follow the trail toward Biblical truth and a study-ready output.',
      pills: ['Culture trend', 'Identity', 'Worldview', 'Modern pressure'],
      sampleInput: 'Why is comparison so normal online?',
      questions: [
        { title: 'What pressure feels strongest?', options: ['Comparison', 'Approval', 'Performance'] },
        { title: 'What sits underneath it?', options: ['Fear', 'Identity', 'Control'] }
      ]
    },
    movies: {
      title: 'Movies',
      desc: 'Bring a movie, character, quote, or scene into the trail and uncover the deeper theme, the Biblical parallel, and the study path that follows.',
      pills: ['Movie scene', 'Character', 'Quote', 'Story theme'],
      sampleInput: 'The Lord of the Rings - Mount Doom scene',
      questions: [
        { title: 'What stood out most?', options: ['Temptation', 'Sacrifice', 'Courage'] },
        { title: 'What kind of struggle is it?', options: ['Power', 'Weakness', 'Loyalty'] }
      ]
    },
    science: {
      title: 'Science',
      desc: 'Start with wonder, discovery, design, creation, or a science question and let the trail move toward wisdom, humility, meaning, and Scripture.',
      pills: ['Discovery', 'Creation', 'Design', 'Big question'],
      sampleInput: 'Why does the universe feel so vast?',
      questions: [
        { title: 'What does this create in you?', options: ['Wonder', 'Smallness', 'Curiosity'] },
        { title: 'What theme fits best?', options: ['Glory', 'Humility', 'Meaning'] }
      ]
    },
    emotions: {
      title: 'Emotions',
      desc: 'Begin from what you feel, identify what lies beneath it, and follow the trail toward a grounded truth statement, reflection, and study output.',
      pills: ['Anxiety', 'Anger', 'Grief', 'Identity'],
      sampleInput: 'I feel anxious and restless',
      questions: [
        { title: 'What is closest to what you feel?', options: ['Fear', 'Grief', 'Pressure'] },
        { title: 'What is underneath that feeling?', options: ['Lack of peace', 'Need for control', 'Feeling unseen'] }
      ]
    },
    life: {
      title: 'Life Questions',
      desc: 'Start with a personal question about purpose, pain, trust, wisdom, or direction, then move through a guided truth trail into Bible study output.',
      pills: ['Purpose', 'Trust', 'Suffering', 'Wisdom'],
      sampleInput: 'How do I trust God when life feels uncertain?',
      questions: [
        { title: 'What part feels most real?', options: ['Fear of the future', 'Need for direction', 'Loss of peace'] },
        { title: 'What theme is forming?', options: ['Trust', 'Wisdom', 'Hope'] }
      ]
    }
  };

  function safeParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function hasGeminiKey() {
  return true;
}

function getGeminiUrl() {
  return ROOTEDOS_GEMINI_ENDPOINT;
}

  function extractGeminiText(data) {
  const candidate = data &&
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0];

  return candidate && candidate.text ? candidate.text : '';
}

function parseGeminiJson(text) {
  if (!text) return null;

  const cleaned = text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch (innerError) {
      return null;
    }
  }
}

async function callGeminiRootedOS(prompt, options) {
  const settings = options || {};

  try {
    const response = await fetch(getGeminiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        json: Boolean(settings.json),
        temperature: typeof settings.temperature === 'number' ? settings.temperature : 0.45,
        maxOutputTokens: settings.maxOutputTokens || 1200
      })
    });

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        reason: 'backend_' + response.status,
        text: '',
        json: null
      };
    }

    const data = payload.data;
    const text = extractGeminiText(data);
    const json = settings.json ? parseGeminiJson(text) : null;

    return {
      ok: true,
      reason: '',
      text: text,
      json: json
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'network_or_backend_error',
      text: '',
      json: null
    };
  }
}
  
  function getStoredTrail() {
    return safeParse(localStorage.getItem(STORAGE_KEY) || '{}', {});
  }

  function setStoredTrail(nextState) {
    const merged = Object.assign({}, getStoredTrail(), nextState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  }

  function getJournalEntries() {
    return safeParse(localStorage.getItem(JOURNAL_KEY) || '[]', []);
  }

  function setJournalEntries(entries) {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
    return entries;
  }

  function saveJournalEntry(entry) {
    const normalized = normalizeJournalEntry(entry);
    const entries = getJournalEntries();
    entries.unshift(normalized);
    setJournalEntries(entries);
    return normalized;
  }

  function getStudySession() {
    return safeParse(localStorage.getItem(SESSION_KEY) || '{}', {});
  }

  function setStudySession(nextState) {
    const now = new Date().toISOString();

    const merged = Object.assign({}, getStudySession(), nextState, {
      updatedAt: now
    });

    if (!merged.id) {
      merged.id = 'session_' + Date.now();
      merged.createdAt = now;
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
    return merged;
  }

  function resetStudySession(category) {
    const meta = CATEGORY_META[category] || CATEGORY_META.life;

    const session = {
      id: 'session_' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: category || 'life',
      categoryTitle: meta.title,
      input: '',
      questionOne: '',
      questionTwo: '',
      theme: '',
      biblicalParallel: '',
      scriptureConnection: 'Scripture reference required (not generated)',
      truthStatement: '',
      studyTitle: '',
      trailMap: null,
      studyOutput: null,
      savedJournalId: ''
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function todayKey() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  function dateLabel(dateKey) {
    if (!dateKey) return 'Undated';
    const parts = dateKey.split('-');
    if (parts.length !== 3) return dateKey;
    return parts[1] + '/' + parts[2] + '/' + parts[0];
  }

  function addDaysToDateKey(baseDate, amount) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + amount);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');

    return yyyy + '-' + mm + '-' + dd;
  }

  function buildCalendarWindow() {
    const today = new Date();
    const days = [];

    for (let offset = -3; offset <= 3; offset += 1) {
      const dateKey = addDaysToDateKey(today, offset);
      const label = offset === 0 ? 'Today' : dateKey.split('-')[2];

      days.push({
        dateKey: dateKey,
        label: label,
        isToday: offset === 0
      });
    }

    return days;
  }

  function escapeHTML(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeJournalEntry(entry) {
    return {
      id: entry.id || 'journal_' + Date.now(),
      dateKey: entry.dateKey || todayKey(),
      createdAt: entry.createdAt || new Date().toISOString(),
      source: entry.source || 'journal',
      category: entry.category || getActiveCategory(),
      categoryTitle: entry.categoryTitle || getMeta().title,
      input: entry.input || '',
      theme: entry.theme || '',
      studyTitle: entry.studyTitle || entry.title || 'Saved Reflection',
      text: entry.text || entry.content || '',
      truthStatement: entry.truthStatement || '',
      scriptureConnection: entry.scriptureConnection || 'Scripture reference required (not generated)',
      biblicalParallel: entry.biblicalParallel || ''
    };
  }

  function buildStudyJournalText(state, meta, theme, support) {
    return [
      'Study saved from RootedOS.',
      '',
      'Starting Point:',
      state.input || meta.sampleInput || 'No starting point saved.',
      '',
      'Main Theme:',
      theme || 'Truth Trail Theme',
      '',
      'Biblical Parallel:',
      state.biblicalParallel || support.parallel || 'Scripture reference required (not generated)',
      '',
      'Scripture Connection:',
      state.scriptureConnection || support.scripture || 'Scripture reference required (not generated)',
      '',
      'Truth Statement:',
      state.truthStatement || support.truth || 'Truth statement not available yet.',
      '',
      'Reflection Prompts:',
      '- What part of this trail felt most real?',
      '- What truth should I remember this week?',
      '- What Scripture passage needs to be verified before expanding this study?'
    ].join('\n');
  }

  function getQueryCategory() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    return CATEGORY_META[category] ? category : null;
  }

  function getActiveCategory() {
    return getQueryCategory() || getStoredTrail().category || 'life';
  }

  function getMeta() {
    return CATEGORY_META[getActiveCategory()] || CATEGORY_META.life;
  }

  function applyCategoryTheme() {
    document.body.setAttribute('data-category', getActiveCategory());
  }

  function titleCase(text) {
    return (text || '').replace(/\b\w/g, function (char) {
      return char.toUpperCase();
    });
  }

  function inferThemeFromInput(input) {
    const value = (input || '').toLowerCase();
    if (!value) return '';
    if (value.includes('control')) return 'Control';
    if (value.includes('fear') || value.includes('anx')) return 'Fear';
    if (value.includes('purpose')) return 'Purpose';
    if (value.includes('tempt')) return 'Temptation';
    if (value.includes('grief') || value.includes('loss')) return 'Grief';
    if (value.includes('compare')) return 'Identity';
    if (value.includes('trust')) return 'Trust';
    if (value.includes('forgive')) return 'Forgiveness';
    if (value.includes('wisdom')) return 'Wisdom';
    if (value.includes('suffer')) return 'Suffering';
    return '';
  }

  function themeSupport(theme, category) {
    const key = (theme || '').toLowerCase();
    const map = {
      temptation: {
        parallel: 'A struggle with desire, power, and weakness that calls for dependence on God.',
        scripture: 'Scripture reference required (not generated)',
        truth: 'Temptation grows when desire rules the heart, but truth invites surrender, endurance, and dependence on God.',
        studyTitle: 'Temptation, Weakness, and the Need for Grace'
      },
      trust: {
        parallel: 'A tension between uncertainty and the call to rest in God\'s wisdom and care.',
        scripture: 'Scripture reference required (not generated)',
        truth: 'Trust grows when fear stops leading and God\'s truth becomes steadier than uncertainty.',
        studyTitle: 'Trusting God When the Path Feels Unclear'
      },
      fear: {
        parallel: 'A human response to uncertainty, pressure, and lack of control.',
        scripture: 'Scripture reference required (not generated)',
        truth: 'Fear shrinks the heart, but truth reminds us that God remains steady when life does not.',
        studyTitle: 'Facing Fear with Steady Truth'
      },
      identity: {
        parallel: 'A search for worth, belonging, and definition that must be anchored in truth rather than comparison.',
        scripture: 'Scripture reference required (not generated)',
        truth: 'Identity becomes unstable when built on comparison, but truth roots worth in what God says.',
        studyTitle: 'Identity Beyond Comparison'
      },
      purpose: {
        parallel: 'A longing to know why life matters and how calling is shaped by truth.',
        scripture: 'Scripture reference required (not generated)',
        truth: 'Purpose becomes clearer when life is shaped by truth, obedience, and faithful steps rather than pressure.',
        studyTitle: 'Purpose, Calling, and Faithful Steps'
      },
      wisdom: {
        parallel: 'A need for discernment when decisions feel heavy or unclear.',
        scripture: 'Scripture reference required (not generated)',
        truth: 'Wisdom grows when truth leads the next step and pride stops trying to know everything at once.',
        studyTitle: 'Seeking Wisdom for the Next Step'
      },
      grief: {
        parallel: 'A response to loss that needs honesty, comfort, and hope.',
        scripture: 'Scripture reference required (not generated)',
        truth: 'Grief tells the truth about loss, but truth also keeps hope alive in the middle of pain.',
        studyTitle: 'Grief, Comfort, and Lasting Hope'
      },
      control: {
        parallel: 'A desire to hold outcomes too tightly instead of yielding to truth and trust.',
        scripture: 'Scripture reference required (not generated)',
        truth: 'Control feels safe for a moment, but lasting peace comes when truth reshapes what we hold onto.',
        studyTitle: 'When Control Becomes a Weight'
      },
      suffering: {
        parallel: 'A deep question about pain, endurance, and where hope is found.',
        scripture: 'Scripture reference required (not generated)',
        truth: 'Suffering raises hard questions, but truth keeps calling the heart toward endurance, hope, and God\'s presence.',
        studyTitle: 'Holding On Through Suffering'
      }
    };

    return map[key] || {
      parallel: 'A real human struggle or theme that can be traced toward a Biblical parallel and a truth statement.',
      scripture: 'Scripture reference required (not generated)',
      truth: 'Truth becomes clearer when honest questions are guided toward Scripture, reflection, and wise response.',
      studyTitle: titleCase((category || 'life') + ' Truth Trail')
    };
  }

  function ensureTheme(state) {
    if (state.theme) return state.theme;
    const inferred = inferThemeFromInput(state.input || '');
    if (inferred) {
      setStoredTrail({ theme: inferred });
      return inferred;
    }
    return '';
  }

  function updateTopbarBrand() {
    document.querySelectorAll('.brand-mark').forEach(function (brand) {
      brand.textContent = 'RootedOS';
    });
  }

  function bindHomeOrbPanel() {
    const categoryOrbs = document.querySelectorAll('.category-orb');
    const resultPanel = document.getElementById('orb-result-panel');
    if (!categoryOrbs.length || !resultPanel) return;

    const resultTitle = document.getElementById('orb-result-title');
    const resultDesc = document.getElementById('orb-result-desc');
    const resultOpen = document.getElementById('orb-result-open');
    const resultClose = document.getElementById('orb-result-close');
    const resultCancel = document.getElementById('orb-result-cancel');
    const desktopPreviewTitle = document.querySelector('.desktop-preview h2');
    const desktopPreviewText = document.querySelector('.desktop-preview p');
    const desktopPreviewButton = document.querySelector('.desktop-preview .ghost-btn');

    categoryOrbs.forEach(function (orb) {
      orb.addEventListener('click', function (event) {
        event.preventDefault();

        categoryOrbs.forEach(function (item) {
          item.classList.remove('active');
        });

        orb.classList.add('active');

        const category = orb.dataset.category || 'life';
        const title = orb.dataset.title || orb.textContent.trim();
        const desc = orb.dataset.desc || 'Open this sphere to continue your RootedOS trail.';
        const glow = orb.dataset.glow || '94,183,255';
        const href = orb.getAttribute('href') || 'input.html?category=life';

        setStoredTrail({
          category: category,
          input: '',
          theme: '',
          questionOne: '',
          questionTwo: ''
        });

        resetStudySession(category);
        applyCategoryTheme();

        if (resultTitle) resultTitle.textContent = title;
        if (resultDesc) resultDesc.textContent = desc;
        if (resultOpen) resultOpen.href = href;

        resultPanel.style.setProperty('--result-glow', glow);
        resultPanel.classList.add('show');

        if (desktopPreviewTitle) desktopPreviewTitle.textContent = title;
        if (desktopPreviewText) desktopPreviewText.textContent = desc;
        if (desktopPreviewButton) desktopPreviewButton.href = href;
      });
    });

    function closeOrbResult(event) {
      if (event) event.preventDefault();
      resultPanel.classList.remove('show');
    }

    if (resultClose) resultClose.addEventListener('click', closeOrbResult);
    if (resultCancel) resultCancel.addEventListener('click', closeOrbResult);
  }

  function hydrateInputPage() {
    const inputBox = document.querySelector('.input-box');
    const title = document.querySelector('.page-title h1');
    const intro = document.querySelector('.page-title p');
    const eyebrow = document.querySelector('.eyebrow');
    const pillNodes = document.querySelectorAll('.pill-row .pill');
    const primaryLink = document.querySelector('.primary-btn');

    if (!inputBox || !title || !intro) return;

    const category = getActiveCategory();
    const meta = getMeta();

    setStoredTrail({ category: category });
    setStudySession({
      category: category,
      categoryTitle: meta.title
    });

    applyCategoryTheme();

    if (eyebrow) eyebrow.textContent = meta.title + ' • Input Node';

    title.textContent = 'Start with one honest thing.';
    intro.textContent = meta.desc;
    inputBox.placeholder = meta.sampleInput || 'Type your question, topic, scene, emotion, or Bible passage...';
    inputBox.value = getStoredTrail().input || '';
    inputBox.setAttribute('data-selected-category', category);

    pillNodes.forEach(function (pill, index) {
      if (meta.pills[index]) pill.textContent = meta.pills[index];
    });

    if (primaryLink) {
      primaryLink.href = 'questions.html?category=' + encodeURIComponent(category);

      primaryLink.addEventListener('click', function () {
        const cleanInput = inputBox.value.trim();

        setStoredTrail({
          category: category,
          input: cleanInput
        });

        setStudySession({
          category: category,
          categoryTitle: meta.title,
          input: cleanInput
        });
      });
    }
  }

  function buildAdaptiveQuestionsPrompt(session, meta) {
  return [
    'You are generating guided discovery questions for RootedOS.',
    '',
    'RootedOS is not a chatbot and not a search engine.',
    'It is a guided discovery experience that helps the user move from a starting point toward a clearer theme.',
    '',
    'Audience: ages 14 to 33+.',
    '',
    'Category:',
    meta.title,
    '',
    'User starting point:',
    session.input || 'No input provided.',
    '',
    'Rules:',
    '- Do not quote Bible verses.',
    '- Do not invent Scripture references.',
    '- Do not create a Bible study yet.',
    '- Do not mention Gemini or AI.',
    '- Keep wording simple, warm, and reflective.',
    '- Questions should feel like selectable path options, not a chat reply.',
    '',
    'Return ONLY valid JSON in this shape:',
    '{',
    '  "questionTitle": "string",',
    '  "options": [',
    '    { "label": "string", "description": "string", "theme": "string" },',
    '    { "label": "string", "description": "string", "theme": "string" },',
    '    { "label": "string", "description": "string", "theme": "string" }',
    '  ]',
    '}',
    '',
    'The three options should be distinct but related to the user input.'
  ].join('\n');
}

async function generateAdaptiveQuestions(meta, fallbackQuestions) {
  const session = getStudySession();
  const prompt = buildAdaptiveQuestionsPrompt(session, meta);

  const result = await callGeminiRootedOS(prompt, {
    json: true,
    temperature: 0.35,
    maxOutputTokens: 700
  });

  if (!result.ok || !result.json || !result.json.options || result.json.options.length < 3) {
    return {
      source: 'fallback',
      questionTitle: fallbackQuestions[0] ? fallbackQuestions[0].title : 'What stands out most from this input?',
      options: fallbackQuestions[0] && fallbackQuestions[0].options
        ? fallbackQuestions[0].options.map(function (label) {
            return {
              label: label,
              description: 'Select this if it feels closest to the heart of your input.',
              theme: label
            };
          })
        : [
            { label: 'Truth', description: 'Select this if you want to trace the deeper truth.', theme: 'Truth' },
            { label: 'Pressure', description: 'Select this if the starting point feels heavy or urgent.', theme: 'Pressure' },
            { label: 'Wisdom', description: 'Select this if you are looking for a wiser next step.', theme: 'Wisdom' }
          ]
    };
  }

  return {
    source: 'gemini',
    questionTitle: result.json.questionTitle || 'What stands out most from this input?',
    options: result.json.options.slice(0, 3).map(function (option) {
      return {
        label: option.label || 'Theme',
        description: option.description || 'Select this if it feels closest to the heart of your input.',
        theme: option.theme || option.label || 'Truth Trail Theme'
      };
    })
  };
}
  
  function hydrateQuestionPage() {
  const eyebrow = document.querySelector('.eyebrow');
  const title = document.querySelector('.page-title h1');
  const intro = document.querySelector('.page-title p');
  const tag = document.querySelector('.question-card .scripture-tag');
  const questionHeading = document.querySelector('.question-card h2');
  const choiceNodes = document.querySelectorAll('.choice');
  const pillNodes = document.querySelectorAll('.question-card .pill-row .pill');
  const state = getStoredTrail();
  const meta = getMeta();
  const questions = meta.questions || [];

  if (!questionHeading || !choiceNodes.length) return;

  applyCategoryTheme();

  if (eyebrow) eyebrow.textContent = meta.title + ' • Reflection Step';
  if (title) title.textContent = 'Tap what rises to the surface.';
  if (intro) intro.textContent = 'RootedOS uses guided questions instead of chat so the deeper theme can surface step by step.';
  if (tag) {
    tag.textContent = hasGeminiKey()
      ? 'Discovery Node • Preparing adaptive paths'
      : 'Discovery Node • Local fallback paths';
  }

  questionHeading.textContent = questions[0] ? questions[0].title : 'What stands out most from this input?';

  function applyQuestionSet(questionSet) {
    questionHeading.textContent = questionSet.questionTitle;

    if (tag) {
      tag.textContent = questionSet.source === 'gemini'
        ? 'Discovery Node • Adaptive paths'
        : 'Discovery Node • Local fallback paths';
    }

    choiceNodes.forEach(function (choice, index) {
      const strong = choice.querySelector('strong');
      const span = choice.querySelector('span');
      const option = questionSet.options[index] || questionSet.options[0];

      if (strong) strong.textContent = option.label;
      if (span) span.textContent = option.description;

      choice.href = 'trail.html?category=' + encodeURIComponent(getActiveCategory());

      choice.addEventListener('click', function () {
        setStoredTrail({
          category: getActiveCategory(),
          questionOne: option.label,
          questionTwo: '',
          theme: option.theme || option.label
        });

        setStudySession({
          category: getActiveCategory(),
          categoryTitle: meta.title,
          questionOne: option.label,
          questionTwo: '',
          theme: option.theme || option.label,
          adaptiveQuestionSource: questionSet.source
        });
      });
    });

    pillNodes.forEach(function (pill, index) {
      if (index === 0) {
        pill.textContent = questionSet.source === 'gemini'
          ? 'Adaptive question layer'
          : 'Local question layer';
      } else if (questionSet.options[index - 1]) {
        pill.textContent = questionSet.options[index - 1].theme || questionSet.options[index - 1].label;
      }
    });
  }

  const fallbackSet = {
    source: 'fallback',
    questionTitle: questions[0] ? questions[0].title : 'What stands out most from this input?',
    options: questions[0] && questions[0].options
      ? questions[0].options.map(function (label) {
          return {
            label: label,
            description: 'Select this if it feels closest to the heart of your input.',
            theme: label
          };
        })
      : [
          { label: 'Truth', description: 'Select this if you want to trace the deeper truth.', theme: 'Truth' },
          { label: 'Pressure', description: 'Select this if the starting point feels heavy or urgent.', theme: 'Pressure' },
          { label: 'Wisdom', description: 'Select this if you are looking for a wiser next step.', theme: 'Wisdom' }
        ]
  };

  applyQuestionSet(fallbackSet);

  if (!hasGeminiKey()) return;

  generateAdaptiveQuestions(meta, questions).then(function (questionSet) {
    applyQuestionSet(questionSet);
  });
}

  function hydrateTrailPage() {
    const eyebrow = document.querySelector('.eyebrow');
    const title = document.querySelector('.page-title h1');
    const intro = document.querySelector('.page-title p');
    const trailItems = document.querySelectorAll('.trail-content');
    const continueButton = document.querySelector('.primary-btn');
    const state = getStoredTrail();
    const meta = getMeta();
    const theme = ensureTheme(state) || 'Truth Trail Theme';
    const support = themeSupport(theme, getActiveCategory());

    if (!trailItems.length) return;

    applyCategoryTheme();

    if (eyebrow) eyebrow.textContent = meta.title + ' • Truth Trail Map';
    if (title) title.textContent = 'A journey, not a reply.';
    if (intro) intro.textContent = 'Your pathway moves from a real starting point toward a core theme, a Biblical parallel, a Scripture connection, and a truth statement.';

    const labels = [
      { title: 'Starting Point', text: state.input || meta.sampleInput },
      { title: 'Core Theme', text: theme },
      { title: 'Biblical Parallel', text: support.parallel },
      { title: 'Scripture Connection', text: support.scripture, tag: 'NASB / NIV / GNB only' },
      { title: 'Truth Statement', text: support.truth }
    ];

    trailItems.forEach(function (item, index) {
      const strong = item.querySelector('strong');
      const muted = item.querySelector('.muted');
      const tag = item.querySelector('.scripture-tag');

      if (labels[index]) {
        if (strong) strong.textContent = labels[index].title;
        if (muted) muted.textContent = labels[index].text;
        if (tag && labels[index].tag) tag.textContent = labels[index].tag;
      }
    });

    if (continueButton) {
      continueButton.href = 'study.html?category=' + encodeURIComponent(getActiveCategory());
    }

    setStoredTrail({
      theme: theme,
      truthStatement: support.truth,
      biblicalParallel: support.parallel,
      scriptureConnection: support.scripture,
      studyTitle: support.studyTitle
    });

    setStudySession({
      category: getActiveCategory(),
      categoryTitle: meta.title,
      input: state.input || meta.sampleInput,
      theme: theme,
      biblicalParallel: support.parallel,
      scriptureConnection: support.scripture,
      truthStatement: support.truth,
      studyTitle: support.studyTitle,
      trailMap: {
        startingPoint: state.input || meta.sampleInput,
        coreTheme: theme,
        biblicalParallel: support.parallel,
        scriptureConnection: support.scripture,
        truthStatement: support.truth
      }
    });
  }

  function hydrateStudyPage() {
    const eyebrow = document.querySelector('.eyebrow');
    const pageTitle = document.querySelector('.page-title h1');
    const pageIntro = document.querySelector('.page-title p');
    const sections = document.querySelectorAll('.study-section');
    const state = getStoredTrail();
    const meta = getMeta();
    const theme = ensureTheme(state) || 'Truth Trail Theme';
    const support = themeSupport(theme, getActiveCategory());

    if (!sections.length) return;

    applyCategoryTheme();

    if (eyebrow) eyebrow.textContent = meta.title + ' • Study Builder';
    if (pageTitle) pageTitle.textContent = 'Turn discovery into a guide.';
    if (pageIntro) pageIntro.textContent = 'This output is shaped for easy reading, small groups, personal reflection, and future Bible study building.';

    const primary = sections[0];
    const secondary = sections[1];

    const primaryTitle = primary.querySelector('h2');
    const primaryParagraphs = primary.querySelectorAll('.muted');
    const primaryLists = primary.querySelectorAll('ul');
    const primaryHeadings = primary.querySelectorAll('h3');
    const tag = primary.querySelector('.scripture-tag');

    if (tag) tag.textContent = 'Scripture reference required (not generated)';
    if (primaryTitle) primaryTitle.textContent = state.studyTitle || support.studyTitle;

    if (primaryHeadings[0]) primaryHeadings[0].textContent = 'Main Theme';
    if (primaryParagraphs[0]) primaryParagraphs[0].textContent = theme;

    if (primaryHeadings[1]) primaryHeadings[1].textContent = 'Key Scriptures';
    if (primaryLists[0]) {
      primaryLists[0].innerHTML = '<li>Scripture reference required (not generated)</li><li>Only verified NASB, NIV, or GNB passages should appear here.</li>';
    }

    const bridgesHeading = document.createElement('h3');
    bridgesHeading.textContent = 'Scripture Bridges';
    bridgesHeading.setAttribute('data-bridges', 'true');

    const bridgesList = document.createElement('ul');
    bridgesList.innerHTML = '<li>Old Testament connection: add only when a clear related passage is verified.</li><li>New Testament connection: add only when a clear related passage is verified.</li><li>Related theme or story bridge: do not force parallels if they are not present.</li>';

    if (primaryHeadings[2]) primaryHeadings[2].textContent = 'Exegesis / Context';
    if (primaryParagraphs[1]) {
      primaryParagraphs[1].textContent = 'Explain what the chosen passage means in context using clear, age-appropriate language. Keep it simple, grounded, and easy to follow for ages 14 to 33+.';
    }

    const inclusioHeading = document.createElement('h3');
    inclusioHeading.textContent = 'Inclusio / Literary Pattern';

    const inclusioParagraph = document.createElement('p');
    inclusioParagraph.className = 'muted';
    inclusioParagraph.textContent = 'No clear inclusio identified in this passage. Only include this section when the selected text truly contains a repeated opening and closing frame or another clear literary bracket.';

    const truthHeading = document.createElement('h3');
    truthHeading.textContent = 'Truth Statement';

    const truthParagraph = document.createElement('p');
    truthParagraph.className = 'muted';
    truthParagraph.textContent = state.truthStatement || support.truth;

    if (!primary.querySelector('[data-bridges]')) {
      primary.appendChild(bridgesHeading);
      primary.appendChild(bridgesList);
      primary.appendChild(inclusioHeading);
      primary.appendChild(inclusioParagraph);
      primary.appendChild(truthHeading);
      primary.appendChild(truthParagraph);
    }

    const secondaryHeadings = secondary.querySelectorAll('h3');
    const secondaryLists = secondary.querySelectorAll('ul');
    const secondaryParagraph = secondary.querySelector('.muted');
    const shareButton = secondary.querySelector('.ghost-btn');

    if (secondaryHeadings[0]) secondaryHeadings[0].textContent = 'Discussion Questions';
    if (secondaryLists[0]) {
      secondaryLists[0].innerHTML = '<li>What part of the starting point felt most real to you?</li><li>How did the core theme become clearer through the trail?</li><li>Where do you see this theme in everyday life?</li><li>What kind of Scripture bridge would help this study feel more complete?</li><li>What is one response step this truth invites this week?</li>';
    }

    if (secondaryHeadings[1]) secondaryHeadings[1].textContent = 'Reflection Prompts';
    if (secondaryLists[1]) {
      secondaryLists[1].innerHTML = '<li>Write one honest sentence about what this theme reveals in you.</li><li>Name one truth you need to remember this week.</li><li>What question do you still want Scripture to answer more clearly?</li>';
    }

    const activityHeading = document.createElement('h3');
    activityHeading.textContent = 'Group Activity / Application';
    activityHeading.setAttribute('data-activity', 'true');

    const activityList = document.createElement('ul');
    activityList.innerHTML = '<li>Share your starting point in one sentence.</li><li>Compare which theme surfaced for each person.</li><li>Build a shared list of verified Scripture bridges before finalizing the study.</li>';

    const outlineHeading = document.createElement('h3');
    outlineHeading.textContent = 'Optional PowerPoint Outline';

    const outlineList = document.createElement('ul');
    outlineList.innerHTML = '<li>Slide 1: Study title</li><li>Slide 2: Starting point and category</li><li>Slide 3: Core theme</li><li>Slide 4: Scripture connection</li><li>Slide 5: Truth statement</li><li>Slide 6: Discussion questions</li><li>Slide 7: Reflection and prayer</li>';

    if (!secondary.querySelector('[data-activity]')) {
      secondary.appendChild(activityHeading);
      secondary.appendChild(activityList);
      secondary.appendChild(outlineHeading);
      secondary.appendChild(outlineList);
    }

    if (secondaryHeadings[2]) secondaryHeadings[2].textContent = 'Prayer Section';
    if (secondaryParagraph) {
      secondaryParagraph.textContent = 'Prayer should stay simple, honest, and grounded in verified Scripture once passages are confirmed.';
    }

    if (shareButton) {
      shareButton.textContent = 'Preview Sharing →';
    }

    setStudySession({
      category: getActiveCategory(),
      categoryTitle: meta.title,
      input: state.input || meta.sampleInput,
      theme: theme,
      biblicalParallel: state.biblicalParallel || support.parallel,
      scriptureConnection: state.scriptureConnection || support.scripture,
      truthStatement: state.truthStatement || support.truth,
      studyTitle: state.studyTitle || support.studyTitle,
      studyOutput: {
        title: state.studyTitle || support.studyTitle,
        mainTheme: theme,
        keyScriptures: [
          'Scripture reference required (not generated)',
          'Only verified NASB, NIV, or GNB passages should appear here.'
        ],
        exegesisContext: 'Explain what the chosen passage means in context using clear, age-appropriate language.',
        scriptureBridges: [
          'Old Testament connection: add only when a clear related passage is verified.',
          'New Testament connection: add only when a clear related passage is verified.'
        ],
        inclusio: 'No clear inclusio identified in this passage.',
        truthStatement: state.truthStatement || support.truth,
        discussionQuestions: [
          'What part of the starting point felt most real to you?',
          'How did the core theme become clearer through the trail?',
          'Where do you see this theme in everyday life?',
          'What is one response step this truth invites this week?'
        ],
        reflectionPrompts: [
          'Write one honest sentence about what this theme reveals in you.',
          'Name one truth you need to remember this week.',
          'What question do you still want Scripture to answer more clearly?'
        ],
        prayer: 'Prayer should stay simple, honest, and grounded in verified Scripture once passages are confirmed.',
        slideOutline: [
          'Slide 1: Study title',
          'Slide 2: Starting point and category',
          'Slide 3: Core theme',
          'Slide 4: Scripture connection',
          'Slide 5: Truth statement',
          'Slide 6: Discussion questions',
          'Slide 7: Reflection and prayer'
        ]
      }
    });

    const saveStudyBtn = document.querySelector('[data-save-study-journal]');
    const saveStudyStatus = document.querySelector('[data-study-save-status]');

    if (saveStudyBtn) {
      saveStudyBtn.addEventListener('click', function (event) {
        event.preventDefault();

        const freshState = getStoredTrail();
        const freshTheme = ensureTheme(freshState) || theme || 'Truth Trail Theme';
        const freshSupport = themeSupport(freshTheme, getActiveCategory());
        const freshMeta = getMeta();

        const entry = normalizeJournalEntry({
          id: 'study_' + Date.now(),
          dateKey: todayKey(),
          createdAt: new Date().toISOString(),
          source: 'study',
          category: getActiveCategory(),
          categoryTitle: freshMeta.title,
          input: freshState.input || freshMeta.sampleInput || '',
          theme: freshTheme,
          studyTitle: freshState.studyTitle || freshSupport.studyTitle || 'Saved Study',
          text: buildStudyJournalText(freshState, freshMeta, freshTheme, freshSupport),
          truthStatement: freshState.truthStatement || freshSupport.truth,
          scriptureConnection: freshState.scriptureConnection || freshSupport.scripture,
          biblicalParallel: freshState.biblicalParallel || freshSupport.parallel
        });

        saveJournalEntry(entry);

        setStudySession({
          savedJournalId: entry.id
        });

        if (saveStudyStatus) {
          saveStudyStatus.textContent = 'Study saved to Journal locally on this device.';
        }

        saveStudyBtn.textContent = 'Saved to Journal ✓';
      });
    }
  }

  function hydrateJournalPage() {
    const textarea = document.querySelector('[data-journal-input]');
    const saveBtn = document.querySelector('[data-save-journal]');
    const list = document.querySelector('[data-journal-list]');
    const status = document.querySelector('[data-journal-status]');
    const filterStatus = document.querySelector('[data-journal-filter-status]');
    const calendarGrid = document.querySelector('[data-calendar-grid]');
    const showAllBtn = document.querySelector('[data-show-all-journal]');
    const state = getStoredTrail();
    const category = getActiveCategory();

    if (!textarea) return;

    applyCategoryTheme();

    const existingDraft = state.journalDraft || '';
    textarea.value = existingDraft;

    textarea.addEventListener('input', function () {
      setStoredTrail({ journalDraft: textarea.value });
    });

    function renderCalendarPills(activeDateKey) {
      if (!calendarGrid) return;

      const days = buildCalendarWindow();
      const entries = getJournalEntries().map(normalizeJournalEntry);

      calendarGrid.innerHTML = days.map(function (day) {
        const count = entries.filter(function (entry) {
          return entry.dateKey === day.dateKey;
        }).length;

        const activeClass = activeDateKey === day.dateKey ? ' active-day' : '';
        const todayLabel = day.isToday ? 'Today' : day.label;
        const countLabel = count ? ' · ' + count : '';

        return (
          '<button class="pill' + activeClass + '" type="button" data-calendar-day data-date-key="' + escapeHTML(day.dateKey) + '">' +
            escapeHTML(todayLabel + countLabel) +
          '</button>'
        );
      }).join('');

      calendarGrid.querySelectorAll('[data-calendar-day]').forEach(function (pill) {
        pill.addEventListener('click', function () {
          const dateKey = pill.getAttribute('data-date-key') || '';

          calendarGrid.querySelectorAll('[data-calendar-day]').forEach(function (item) {
            item.classList.remove('active-day');
          });

          pill.classList.add('active-day');
          renderEntries(dateKey);
        });
      });
    }

    function renderEntries(filterDate) {
      if (!list) return;

      if (filterStatus) {
        filterStatus.textContent = filterDate
          ? 'Showing entries for ' + dateLabel(filterDate) + '.'
          : 'Showing all saved entries.';
      }

      const entries = getJournalEntries().map(normalizeJournalEntry);
      const filtered = filterDate
        ? entries.filter(function (entry) {
            return entry.dateKey === filterDate;
          })
        : entries;

      if (!filtered.length) {
        list.innerHTML =
          '<article class="glass-card">' +
            '<h2>No saved journal for this date yet</h2>' +
            '<p class="muted">Save a reflection or study and it will appear here.</p>' +
          '</article>';
        return;
      }

      list.innerHTML = filtered.map(function (entry) {
        const sourceLabel = entry.source === 'study' ? 'Saved Study' : 'Journal Reflection';

        return (
          '<article class="glass-card" data-entry-id="' + escapeHTML(entry.id) + '">' +
            '<div class="pill-row" style="margin-bottom:14px;">' +
              '<span class="pill">' + escapeHTML(sourceLabel) + '</span>' +
              '<span class="pill">' + escapeHTML(entry.categoryTitle || 'Life Questions') + '</span>' +
              '<span class="pill">' + escapeHTML(dateLabel(entry.dateKey)) + '</span>' +
            '</div>' +

            '<h2>' + escapeHTML(entry.studyTitle || 'Saved Reflection') + '</h2>' +

            '<p class="muted"><strong>Starting Point:</strong> ' + escapeHTML(entry.input || 'None') + '</p>' +
            '<p class="muted"><strong>Theme:</strong> ' + escapeHTML(entry.theme || 'None') + '</p>' +

            '<div style="white-space:pre-wrap;margin-top:16px;">' + escapeHTML(entry.text || '') + '</div>' +

            '<div class="pill-row" style="margin-top:18px;">' +
              '<button class="ghost-btn" type="button" data-delete-journal="' + escapeHTML(entry.id) + '">Delete</button>' +
            '</div>' +
          '</article>'
        );
      }).join('');

      list.querySelectorAll('[data-delete-journal]').forEach(function (button) {
        button.addEventListener('click', function () {
          const id = button.getAttribute('data-delete-journal');

          const nextEntries = getJournalEntries().filter(function (entry) {
            return normalizeJournalEntry(entry).id !== id;
          });

          setJournalEntries(nextEntries);

          if (status) status.textContent = 'Entry deleted locally.';

          renderCalendarPills(filterDate || '');
          renderEntries(filterDate);
        });
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function (event) {
        event.preventDefault();

        const text = textarea.value.trim();

        if (!text) {
          if (status) status.textContent = 'Write something before saving.';
          return;
        }

        const meta = CATEGORY_META[category] || CATEGORY_META.life;
        const latestState = getStoredTrail();

        const entry = normalizeJournalEntry({
          id: 'journal_' + Date.now(),
          dateKey: todayKey(),
          createdAt: new Date().toISOString(),
          source: 'journal',
          category: category,
          categoryTitle: meta.title,
          input: latestState.input || '',
          theme: latestState.theme || '',
          studyTitle: latestState.studyTitle || 'Saved Reflection',
          text: text,
          truthStatement: latestState.truthStatement || '',
          scriptureConnection: latestState.scriptureConnection || 'Scripture reference required (not generated)',
          biblicalParallel: latestState.biblicalParallel || ''
        });

        saveJournalEntry(entry);
        setStoredTrail({ journalDraft: '' });
        textarea.value = '';

        if (status) status.textContent = 'Journal saved locally on this device.';

        renderCalendarPills(todayKey());
        renderEntries(todayKey());
      });
    }

    if (showAllBtn) {
      showAllBtn.addEventListener('click', function (event) {
        event.preventDefault();
        renderCalendarPills('');
        renderEntries();
      });
    }

    renderCalendarPills(todayKey());
    renderEntries(todayKey());
  }

  function addCategoryToEyebrow() {
    const eyebrow = document.querySelector('.eyebrow');
    if (!eyebrow) return;

    const meta = getMeta();

    if (!eyebrow.textContent.toLowerCase().includes(meta.title.toLowerCase())) {
      eyebrow.textContent = meta.title + ' • ' + eyebrow.textContent;
    }
  }

  updateTopbarBrand();
  applyCategoryTheme();
  bindHomeOrbPanel();
  hydrateInputPage();
  hydrateQuestionPage();
  hydrateTrailPage();
  hydrateStudyPage();
  hydrateJournalPage();
  addCategoryToEyebrow();

  window.RootedOS = {
    CATEGORY_META: CATEGORY_META,
    getStoredTrail: getStoredTrail,
    setStoredTrail: setStoredTrail,
    getActiveCategory: getActiveCategory,
    getJournalEntries: getJournalEntries,
    setJournalEntries: setJournalEntries,
    saveJournalEntry: saveJournalEntry,
    todayKey: todayKey,
    getStudySession: getStudySession,
    setStudySession: setStudySession,
    resetStudySession: resetStudySession,
    hasGeminiKey: hasGeminiKey,
    callGeminiRootedOS: callGeminiRootedOS
  };
})();
