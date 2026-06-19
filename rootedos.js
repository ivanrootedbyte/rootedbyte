(function () {
  const STORAGE_KEY = 'rootedosTrail';
  const JOURNAL_KEY = 'rootedosJournalEntries';
  const SESSION_KEY = 'rootedosStudySession';

  const ROOTEDOS_GEMINI_ENDPOINT = '/api/gemini';

  const CATEGORY_META = {
    word: {
      title: 'The Word',
      desc: 'Begin directly from Scripture, a passage, or a Bible study question and let RootedOS build a guided trail toward reflection, understanding, and study output.',
      pills: ['Bible passage', 'Study question', 'Theme', 'Book chapter'],
      sampleInput: 'Romans 12 and renewing the mind',
      questions: [
  { title: 'What do you want to understand more clearly in this passage?', options: ['Meaning', 'Context', 'Application'] },
  { title: 'What feels most important in this passage right now?', options: ['Identity', 'Obedience', 'Transformation'] }
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

  function getQuestionTagLabel(source) {
    if (source === 'gemini') return 'Discovery Node • Adaptive paths';
    if (source === 'rate_limited') return 'Discovery Node • Guided paths';
    return 'Discovery Node';
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

      let payload = null;

      try {
        payload = await response.json();
      } catch (jsonError) {
        payload = null;
      }

      if (response.status === 429) {
        return {
          ok: false,
          reason: 'rate_limited',
          text: '',
          json: null
        };
      }

      if (!response.ok || !payload || !payload.ok) {
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

  function isBadAutoLabel(value) {
    const text = String(value || '').trim();
    if (!text) return true;
    if (/^node\s*0*\d+$/i.test(text)) return true;
    if (/^node\s+\d+/i.test(text)) return true;
    if (/^option\s*0*\d+$/i.test(text)) return true;
    if (/^step\s*0*\d+$/i.test(text)) return true;
    return false;
  }

  function setLoadingButton(anchor, text) {
    if (!anchor) return null;
    const originalText = anchor.textContent;
    const originalHref = anchor.getAttribute('href');
    anchor.textContent = text;
    anchor.setAttribute('aria-disabled', 'true');
    anchor.style.pointerEvents = 'none';
    anchor.removeAttribute('href');
    return function restore() {
      anchor.textContent = originalText;
      anchor.setAttribute('href', originalHref || '#');
      anchor.removeAttribute('aria-disabled');
      anchor.style.pointerEvents = '';
    };
  }

  function buildAdaptiveQuestionsPrompt(session, meta) {
    return [
      'You generate guided discovery question sets for RootedOS.',
      'RootedOS is not a chatbot and not a search engine.',
      'It is a guided discovery experience.',
      '',
      'Audience: ages 14 to 33+.',
      'Tone: simple, warm, reflective, clear.',
      '',
      'Category: ' + meta.title,
      'User starting point: ' + (session.input || 'No input provided.'),
      '',
      'Rules:',
      '- Return ONLY valid JSON.',
      '- Do not include markdown fences.',
      '- Do not include commentary before or after JSON.',
      '- Do not quote Bible verses.',
      '- Do not invent Scripture references.',
      '- Do not mention AI or Gemini.',
      '- Do not use labels like Node 01, Step 1, Option 1, Path 1.',
      '- Create exactly 3 options.',
      '- Each option must feel distinct but closely related to the user input.',
      '- Each option label must be short, 1 to 3 words.',
      '- Each description must be one sentence, under 16 words.',
      '- Each theme must be short, 1 to 3 words.',
      '',
      'Return EXACTLY this schema:',
      '{',
      '  "questionTitle": "string",',
      '  "options": [',
      '    { "label": "string", "description": "string", "theme": "string" },',
      '    { "label": "string", "description": "string", "theme": "string" },',
      '    { "label": "string", "description": "string", "theme": "string" }',
      '  ]',
      '}'
    ].join('\n');
  }

  async function generateAdaptiveQuestions(meta, fallbackQuestions) {
    const session = getStudySession();
    const prompt = buildAdaptiveQuestionsPrompt(session, meta);

    const result = await callGeminiRootedOS(prompt, {
      json: true,
      temperature: 0.25,
      maxOutputTokens: 500
    });

    if (!result.ok || !result.json) {
      return {
        source: result.reason === 'rate_limited' ? 'rate_limited' : 'fallback',
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

    const rawOptions = Array.isArray(result.json.options) ? result.json.options : [];

    const cleanedOptions = rawOptions
      .map(function (option, index) {
        const fallbackLabel = fallbackQuestions[0] && fallbackQuestions[0].options && fallbackQuestions[0].options[index]
          ? fallbackQuestions[0].options[index]
          : 'Theme';

        const rawLabel = String((option && option.label) || '').trim();
        const rawTheme = String((option && option.theme) || '').trim();

        const safeLabel = isBadAutoLabel(rawLabel)
          ? (rawTheme && !isBadAutoLabel(rawTheme) ? rawTheme : fallbackLabel)
          : rawLabel;

        const safeTheme = isBadAutoLabel(rawTheme)
          ? safeLabel
          : rawTheme;

        return {
          label: String(safeLabel || fallbackLabel).trim(),
          description: String((option && option.description) || '').trim(),
          theme: String(safeTheme || safeLabel || fallbackLabel).trim()
        };
      })
      .filter(function (option) {
        return option.label && option.description && option.theme;
      })
      .slice(0, 3);

    if (cleanedOptions.length < 3) {
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
      questionTitle: String(result.json.questionTitle || 'What rises first here?').trim(),
      options: cleanedOptions
    };
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
    const desktopOrbit = document.querySelector('.desktop-orbit');

    categoryOrbs.forEach(function (orb) {
      orb.addEventListener('click', function (event) {
        event.preventDefault();

        categoryOrbs.forEach(function (item) {
          item.classList.remove('active');
        });

        if (desktopOrbit) {
          desktopOrbit.classList.add('has-active');
        }

        orb.classList.add('active');

        const category = orb.dataset.category || 'life';
        const title = orb.dataset.title || orb.textContent.trim();
        const desc = orb.dataset.desc || 'Open this sphere to continue your RootedOS trail.';
        const glow = orb.dataset.glow || '94,183,255';
        const href = orb.getAttribute('href') || 'input.html?category=life';

        if (CATEGORY_META[category]) {
          setStoredTrail({
            category: category,
            input: '',
            theme: '',
            questionOne: '',
            questionTwo: ''
          });
          resetStudySession(category);
          applyCategoryTheme();
        }

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
    const inputBox = document.querySelector('[data-discovery-input]');
    const title = document.querySelector('.page-title h1');
    const intro = document.querySelector('.page-title p');
    const eyebrow = document.querySelector('.eyebrow');
    const pillNodes = document.querySelectorAll('.pill-row .pill');
    const primaryLink = document.querySelector('.primary-btn');

    if (!inputBox || !title || !intro) return;

    const category = getActiveCategory();
    const meta = getMeta();
    const stored = getStoredTrail();

    setStoredTrail({ category: category });
    setStudySession({
      category: category,
      categoryTitle: meta.title
    });

    applyCategoryTheme();

    if (eyebrow) eyebrow.textContent = meta.title + ' • Input Node';
    title.textContent = 'Start with one honest thing.';
    intro.textContent = meta.desc;
    inputBox.placeholder = meta.sampleInput || 'Type your topic, scene, question, emotion, or Bible passage...';
    inputBox.value = stored.input || '';
    inputBox.setAttribute('data-selected-category', category);

    pillNodes.forEach(function (pill, index) {
      if (meta.pills[index]) pill.textContent = meta.pills[index];
    });

    if (primaryLink) {
      primaryLink.href = 'questions.html?category=' + encodeURIComponent(category);

      primaryLink.addEventListener('click', function (event) {
        const cleanInput = inputBox.value.trim();

        if (!cleanInput) {
          event.preventDefault();
          inputBox.focus();
          return;
        }

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

  function hydrateQuestionPage() {
    const eyebrow = document.querySelector('.eyebrow');
    const title = document.querySelector('.page-title h1');
    const intro = document.querySelector('.page-title p');
    const tag = document.querySelector('.question-card .scripture-tag');
    const questionHeading = document.querySelector('.question-card h2');
    const choiceNodes = document.querySelectorAll('.choice');
    const pillNodes = document.querySelectorAll('.question-card .pill-row .pill');
    const meta = getMeta();
    const questions = meta.questions || [];

    if (!questionHeading || !choiceNodes.length) return;

    applyCategoryTheme();

    if (eyebrow) eyebrow.textContent = meta.title + ' • Reflection Step';
    if (title) title.textContent = 'Tap what rises to the surface.';
    if (intro) intro.textContent = 'RootedOS uses guided questions instead of chat so the deeper theme can surface step by step.';
    if (tag) tag.textContent = 'Discovery Node';

    const fixedHeading = questions[0]
      ? questions[0].title
      : 'What stands out most from this input?';

    questionHeading.textContent = fixedHeading;

    function applyQuestionSet(questionSet) {
      questionHeading.textContent = fixedHeading;

      if (tag) {
        tag.textContent = getQuestionTagLabel(questionSet.source);
      }

      choiceNodes.forEach(function (choice, index) {
        const strong = choice.querySelector('strong');
        const span = choice.querySelector('span');
        const fallbackLabel = questions[0] && questions[0].options && questions[0].options[index]
          ? questions[0].options[index]
          : 'Theme';

        const option = questionSet.options[index] || questionSet.options[0] || {
          label: fallbackLabel,
          description: 'Select this if it feels closest to the heart of your input.',
          theme: fallbackLabel
        };

        const safeLabel = isBadAutoLabel(option.label)
          ? fallbackLabel
          : String(option.label || fallbackLabel).trim();

        const safeDescription = String(option.description || '').trim()
          || 'Select this if it feels closest to the heart of your input.';

        const safeTheme = isBadAutoLabel(option.theme)
          ? safeLabel
          : String(option.theme || safeLabel).trim();

        if (strong) strong.textContent = safeLabel;
        if (span) span.textContent = safeDescription;

        choice.href = 'trail.html?category=' + encodeURIComponent(getActiveCategory());

        choice.onclick = function () {
          setStoredTrail({
            category: getActiveCategory(),
            questionOne: safeLabel,
            questionTwo: '',
            theme: safeTheme
          });

          setStudySession({
            category: getActiveCategory(),
            categoryTitle: meta.title,
            questionOne: safeLabel,
            questionTwo: '',
            theme: safeTheme,
            adaptiveQuestionSource: questionSet.source
          });
        };
      });

      pillNodes.forEach(function (pill, index) {
        if (index === 0) {
          pill.textContent = 'Question layer';
        } else if (questionSet.options[index - 1]) {
          const option = questionSet.options[index - 1];
          const safePill = isBadAutoLabel(option.theme)
            ? (isBadAutoLabel(option.label) ? 'Theme' : option.label)
            : option.theme;
          pill.textContent = safePill;
        }
      });
    }

    const fallbackSet = {
      source: 'fallback',
      questionTitle: fixedHeading,
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

  function buildTrailPrompt(session, meta) {
    return [
      'You generate a guided truth trail for RootedOS.',
      'RootedOS is not a chatbot and not a search engine.',
      'It is a guided discovery experience moving from a real user starting point toward a clear truth trail.',
      '',
      'Audience: ages 14 to 33+.',
      'Tone: clear, grounded, reflective, simple, warm.',
      '',
      'Category: ' + meta.title,
      'User starting point: ' + (session.input || 'No input provided.'),
      'Selected question path: ' + (session.questionOne || 'None selected.'),
      'Theme if present: ' + (session.theme || 'None yet.'),
      '',
      'Rules:',
      '- Return ONLY valid JSON.',
      '- Do not include markdown fences.',
      '- Do not include commentary before or after JSON.',
      '- Do not invent Bible verses.',
      '- Do not invent Scripture references.',
      '- If exact Scripture is not verified, use the exact text: "Scripture reference required (not generated)".',
      '- Biblical parallel must be concept-level, not a fake citation.',
      '- Truth statement should be clear, concise, and meaningful.',
      '- Study title should sound usable for a real study session.',
      '',
      'Return EXACTLY this schema:',
      '{',
      '  "startingPoint": "string",',
      '  "coreTheme": "string",',
      '  "biblicalParallel": "string",',
      '  "scriptureConnection": "Scripture reference required (not generated)",',
      '  "truthStatement": "string",',
      '  "studyTitle": "string"',
      '}'
    ].join('\n');
  }

  async function generateTrailMap(meta) {
    const session = getStudySession();
    const prompt = buildTrailPrompt(session, meta);

    const result = await callGeminiRootedOS(prompt, {
      json: true,
      temperature: 0.3,
      maxOutputTokens: 700
    });

    if (!result.ok || !result.json) {
      return null;
    }

    return {
      startingPoint: String(result.json.startingPoint || session.input || meta.sampleInput || '').trim(),
      coreTheme: String(result.json.coreTheme || session.theme || 'Truth Trail Theme').trim(),
      biblicalParallel: String(result.json.biblicalParallel || '').trim(),
      scriptureConnection: 'Scripture reference required (not generated)',
      truthStatement: String(result.json.truthStatement || '').trim(),
      studyTitle: String(result.json.studyTitle || '').trim()
    };
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

    function renderTrail(labels) {
      trailItems.forEach(function (item, index) {
        const strong = item.querySelector('strong');
        const muted = item.querySelector('.muted');
        const tag = item.querySelector('.scripture-tag');

        if (labels[index]) {
          if (strong) strong.textContent = labels[index].title;
          if (muted) muted.textContent = labels[index].text;
          if (tag) {
            tag.textContent = labels[index].tag || '';
          }
        }
      });
    }

    const fallbackLabels = [
      { title: 'Starting Point', text: state.input || meta.sampleInput },
      { title: 'Core Theme', text: theme },
      { title: 'Biblical Parallel', text: support.parallel },
      { title: 'Scripture Connection', text: 'Scripture reference required (not generated)', tag: 'NASB / NIV / GNB only' },
      { title: 'Truth Statement', text: support.truth }
    ];

    renderTrail(fallbackLabels);

    if (continueButton) {
      continueButton.href = 'study.html?category=' + encodeURIComponent(getActiveCategory());
      const restore = setLoadingButton(continueButton, 'Building Trail…');
      setTimeout(function () {
        if (restore) restore();
      }, 700);
    }

    setStoredTrail({
      theme: theme,
      truthStatement: support.truth,
      biblicalParallel: support.parallel,
      scriptureConnection: 'Scripture reference required (not generated)',
      studyTitle: support.studyTitle
    });

    setStudySession({
      category: getActiveCategory(),
      categoryTitle: meta.title,
      input: state.input || meta.sampleInput,
      theme: theme,
      biblicalParallel: support.parallel,
      scriptureConnection: 'Scripture reference required (not generated)',
      truthStatement: support.truth,
      studyTitle: support.studyTitle,
      trailMap: {
        startingPoint: state.input || meta.sampleInput,
        coreTheme: theme,
        biblicalParallel: support.parallel,
        scriptureConnection: 'Scripture reference required (not generated)',
        truthStatement: support.truth
      }
    });

    generateTrailMap(meta).then(function (generated) {
      if (!generated) return;

      const actualLabels = [
        { title: 'Starting Point', text: generated.startingPoint || state.input || meta.sampleInput },
        { title: 'Core Theme', text: generated.coreTheme || theme },
        { title: 'Biblical Parallel', text: generated.biblicalParallel || support.parallel },
        { title: 'Scripture Connection', text: 'Scripture reference required (not generated)', tag: 'NASB / NIV / GNB only' },
        { title: 'Truth Statement', text: generated.truthStatement || support.truth }
      ];

      renderTrail(actualLabels);

      setStoredTrail({
        theme: generated.coreTheme || theme,
        truthStatement: generated.truthStatement || support.truth,
        biblicalParallel: generated.biblicalParallel || support.parallel,
        scriptureConnection: 'Scripture reference required (not generated)',
        studyTitle: generated.studyTitle || support.studyTitle
      });

      setStudySession({
        category: getActiveCategory(),
        categoryTitle: meta.title,
        input: state.input || meta.sampleInput,
        theme: generated.coreTheme || theme,
        biblicalParallel: generated.biblicalParallel || support.parallel,
        scriptureConnection: 'Scripture reference required (not generated)',
        truthStatement: generated.truthStatement || support.truth,
        studyTitle: generated.studyTitle || support.studyTitle,
        trailMap: {
          startingPoint: generated.startingPoint || state.input || meta.sampleInput,
          coreTheme: generated.coreTheme || theme,
          biblicalParallel: generated.biblicalParallel || support.parallel,
          scriptureConnection: 'Scripture reference required (not generated)',
          truthStatement: generated.truthStatement || support.truth
        }
      });
    });
  }

  function buildStudyPrompt(session, meta) {
    const trail = session.trailMap || {};

    return [
      'You generate a study builder output for RootedOS.',
      'RootedOS is a guided discovery experience, not a chatbot.',
      '',
      'Audience: ages 14 to 33+.',
      'Tone: clear, rooted, reflective, simple, thoughtful.',
      '',
      'Category: ' + meta.title,
      'Starting point: ' + (trail.startingPoint || session.input || 'No starting point provided.'),
      'Core theme: ' + (trail.coreTheme || session.theme || 'No theme provided.'),
      'Biblical parallel: ' + (trail.biblicalParallel || 'No biblical parallel provided.'),
      'Truth statement: ' + (trail.truthStatement || session.truthStatement || 'No truth statement provided.'),
      '',
      'Rules:',
      '- Return ONLY valid JSON.',
      '- Do not include markdown fences.',
      '- Do not include commentary before or after JSON.',
      '- Do not invent Bible verses.',
      '- Do not invent Scripture references.',
      '- The keyScriptures field must contain only this exact text: "Scripture reference required (not generated)".',
      '- Exegesis/context should be concept-level only until Scripture is verified.',
      '- Discussion questions should feel usable in a real study or small group.',
      '- Reflection prompts should feel personal and practical.',
      '- Prayer should be short, sincere, and grounded.',
      '- Slide outline should be concise and usable.',
      '',
      'Return EXACTLY this schema:',
      '{',
      '  "studyTitle": "string",',
      '  "mainTheme": "string",',
      '  "keyScriptures": ["Scripture reference required (not generated)"],',
      '  "exegesisContext": "string",',
      '  "discussionQuestions": ["string", "string", "string", "string"],',
      '  "reflectionPrompts": ["string", "string", "string"],',
      '  "prayer": "string",',
      '  "slideOutline": ["string", "string", "string", "string", "string", "string"]',
      '}'
    ].join('\n');
  }

  async function generateStudyOutput(meta) {
    const session = getStudySession();
    const prompt = buildStudyPrompt(session, meta);

    const result = await callGeminiRootedOS(prompt, {
      json: true,
      temperature: 0.3,
      maxOutputTokens: 1000
    });

    if (!result.ok || !result.json) {
      return null;
    }

    const json = result.json;

    return {
      studyTitle: String(json.studyTitle || session.studyTitle || 'Guided Study').trim(),
      mainTheme: String(json.mainTheme || session.theme || 'Truth Trail Theme').trim(),
      keyScriptures: ['Scripture reference required (not generated)'],
      exegesisContext: String(json.exegesisContext || '').trim(),
      discussionQuestions: Array.isArray(json.discussionQuestions)
        ? json.discussionQuestions.slice(0, 4).map(function (item) { return String(item || '').trim(); }).filter(Boolean)
        : [],
      reflectionPrompts: Array.isArray(json.reflectionPrompts)
        ? json.reflectionPrompts.slice(0, 3).map(function (item) { return String(item || '').trim(); }).filter(Boolean)
        : [],
      prayer: String(json.prayer || '').trim(),
      slideOutline: Array.isArray(json.slideOutline)
        ? json.slideOutline.slice(0, 6).map(function (item) { return String(item || '').trim(); }).filter(Boolean)
        : []
    };
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
    primaryLists[0].innerHTML = '<li>Scripture reference required (not generated)</li>';
  }

  const bridgesHeading = document.createElement('h3');
  bridgesHeading.textContent = 'Scripture Bridges';
  bridgesHeading.setAttribute('data-bridges', 'true');

  const bridgesList = document.createElement('ul');
  bridgesList.innerHTML = '<li>Old Testament connection: add only when a clear related passage is verified.</li><li>New Testament connection: add only when a clear related passage is verified.</li><li>Related theme or story bridge: do not force parallels if they are not present.</li>';

  if (primaryHeadings[2]) primaryHeadings[2].textContent = 'Exegesis / Context';
  if (primaryParagraphs[1]) {
    primaryParagraphs[1].textContent = 'Explain what the chosen passage means in context using clear, age-appropriate language. Keep it simple, grounded, and easy to follow.';
  }

  const truthHeading = document.createElement('h3');
  truthHeading.textContent = 'Truth Statement';

  const truthParagraph = document.createElement('p');
  truthParagraph.className = 'muted';
  truthParagraph.textContent = state.truthStatement || support.truth;

  if (!primary.querySelector('[data-bridges]')) {
    primary.appendChild(bridgesHeading);
    primary.appendChild(bridgesList);
    primary.appendChild(truthHeading);
    primary.appendChild(truthParagraph);
  }

  const secondaryHeadings = secondary.querySelectorAll('h3');
  const secondaryLists = secondary.querySelectorAll('ul');
  const secondaryParagraph = secondary.querySelector('.muted');
  const shareButton = secondary.querySelector('.ghost-btn');

  if (secondaryHeadings[0]) secondaryHeadings[0].textContent = 'Discussion Questions';
  if (secondaryLists[0]) {
    secondaryLists[0].innerHTML = '<li>What part of the starting point felt most real to you?</li><li>How did the core theme become clearer through the trail?</li><li>Where do you see this theme in everyday life?</li><li>What is one response step this truth invites this week?</li>';
  }

  if (secondaryHeadings[1]) secondaryHeadings[1].textContent = 'Reflection Prompts';
  if (secondaryLists[1]) {
    secondaryLists[1].innerHTML = '<li>Write one honest sentence about what this theme reveals in you.</li><li>Name one truth you need to remember this week.</li><li>What question do you still want Scripture to answer more clearly?</li>';
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
    scriptureConnection: 'Scripture reference required (not generated)',
    truthStatement: state.truthStatement || support.truth,
    studyTitle: state.studyTitle || support.studyTitle,
    studyOutput: {
      title: state.studyTitle || support.studyTitle,
      mainTheme: theme,
      keyScriptures: ['Scripture reference required (not generated)'],
      exegesisContext: primaryParagraphs[1] ? primaryParagraphs[1].textContent : '',
      scriptureBridges: [
        'Old Testament connection: add only when a clear related passage is verified.',
        'New Testament connection: add only when a clear related passage is verified.'
      ],
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
        'Slide 6: Reflection and prayer'
      ]
    }
  });

  generateStudyOutput(meta).then(function (generated) {
    if (!generated) return;

    if (primaryTitle) primaryTitle.textContent = generated.studyTitle || state.studyTitle || support.studyTitle;
    if (primaryParagraphs[0]) primaryParagraphs[0].textContent = generated.mainTheme || theme;

    if (primaryLists[0]) {
      primaryLists[0].innerHTML = '<li>Scripture reference required (not generated)</li>';
    }

    if (primaryParagraphs[1]) {
      primaryParagraphs[1].textContent = generated.exegesisContext || 'Explain what the chosen passage means in context using clear, age-appropriate language.';
    }

    truthParagraph.textContent = state.truthStatement || support.truth;

    if (secondaryLists[0]) {
      const discussionItems = (generated.discussionQuestions && generated.discussionQuestions.length)
        ? generated.discussionQuestions
        : [
            'What part of the starting point felt most real to you?',
            'How did the core theme become clearer through the trail?',
            'Where do you see this theme in everyday life?',
            'What is one response step this truth invites this week?'
          ];

      secondaryLists[0].innerHTML = discussionItems
        .map(function (item) { return '<li>' + escapeHTML(item) + '</li>'; })
        .join('');
    }

    if (secondaryLists[1]) {
      const reflectionItems = (generated.reflectionPrompts && generated.reflectionPrompts.length)
        ? generated.reflectionPrompts
        : [
            'Write one honest sentence about what this theme reveals in you.',
            'Name one truth you need to remember this week.',
            'What question do you still want Scripture to answer more clearly?'
          ];

      secondaryLists[1].innerHTML = reflectionItems
        .map(function (item) { return '<li>' + escapeHTML(item) + '</li>'; })
        .join('');
    }

    if (secondaryParagraph) {
      secondaryParagraph.textContent = generated.prayer || 'Prayer should stay simple, honest, and grounded in verified Scripture once passages are confirmed.';
    }

    setStoredTrail({
      studyTitle: generated.studyTitle || state.studyTitle || support.studyTitle
    });

    setStudySession({
      category: getActiveCategory(),
      categoryTitle: meta.title,
      input: state.input || meta.sampleInput,
      theme: generated.mainTheme || theme,
      biblicalParallel: state.biblicalParallel || support.parallel,
      scriptureConnection: 'Scripture reference required (not generated)',
      truthStatement: state.truthStatement || support.truth,
      studyTitle: generated.studyTitle || state.studyTitle || support.studyTitle,
      studyOutput: {
        title: generated.studyTitle || state.studyTitle || support.studyTitle,
        mainTheme: generated.mainTheme || theme,
        keyScriptures: ['Scripture reference required (not generated)'],
        exegesisContext: generated.exegesisContext || '',
        scriptureBridges: [
          'Old Testament connection: add only when a clear related passage is verified.',
          'New Testament connection: add only when a clear related passage is verified.'
        ],
        truthStatement: state.truthStatement || support.truth,
        discussionQuestions: generated.discussionQuestions || [],
        reflectionPrompts: generated.reflectionPrompts || [],
        prayer: generated.prayer || '',
        slideOutline: generated.slideOutline || []
      }
    });

    saveStudySessionToCloudIfSignedIn();
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
        scriptureConnection: 'Scripture reference required (not generated)',
        biblicalParallel: freshState.biblicalParallel || freshSupport.parallel
      });

      saveJournalEntry(entry);
      saveJournalEntryToCloudIfSignedIn(entry);
      saveStudySessionToCloudIfSignedIn();

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

  async function getCloudUserSafe() {
  try {
    if (!window.RootedOSSupabase) return null;
    return await window.RootedOSSupabase.getUser();
  } catch (error) {
    return null;
  }
}

async function saveStudySessionToCloudIfSignedIn() {
  try {
    if (!window.RootedOSSupabase) return null;

    const user = await window.RootedOSSupabase.getUser();
    if (!user) return null;

    const session = getStudySession();
    const saved = await window.RootedOSSupabase.saveStudySession(session);

    if (saved && saved.id) {
      setStudySession({ cloudId: saved.id });
    }

    return saved;
  } catch (error) {
    return null;
  }
}

async function saveJournalEntryToCloudIfSignedIn(entry) {
  try {
    if (!window.RootedOSSupabase) return null;

    const user = await window.RootedOSSupabase.getUser();
    if (!user) return null;

    return await window.RootedOSSupabase.saveJournalEntryCloud(entry);
  } catch (error) {
    return null;
  }
}

  async function hydrateAuthUI() {
  const authStatus = document.querySelector('[data-auth-status]');
  const signedOutBlock = document.querySelector('[data-auth-signed-out]');
  const signedInBlock = document.querySelector('[data-auth-signed-in]');
  const emailInput = document.querySelector('[data-auth-email]');
  const sendLinkButton = document.querySelector('[data-auth-send-link]');
  const authMessage = document.querySelector('[data-auth-message]');
  const emailDisplay = document.querySelector('[data-auth-email-display]');
  const signOutButton = document.querySelector('[data-auth-signout]');

  if (!authStatus || !window.RootedOSSupabase) return;

  function setSignedOutState() {
    authStatus.textContent = 'You are browsing as a guest.';
    if (signedOutBlock) signedOutBlock.style.display = '';
    if (signedInBlock) signedInBlock.style.display = 'none';
  }

  function setSignedInState(user) {
    authStatus.textContent = 'You are signed in.';
    if (signedOutBlock) signedOutBlock.style.display = 'none';
    if (signedInBlock) signedInBlock.style.display = '';
    if (emailDisplay) emailDisplay.textContent = user && user.email ? user.email : 'Signed in';
  }

  try {
    const user = await window.RootedOSSupabase.getUser();

    if (user) {
      setSignedInState(user);
    } else {
      setSignedOutState();
    }
  } catch (error) {
    setSignedOutState();
  }

  if (sendLinkButton) {
    sendLinkButton.addEventListener('click', async function () {
      const email = emailInput ? emailInput.value.trim() : '';

      if (!email) {
        if (authMessage) authMessage.textContent = 'Enter your email first.';
        return;
      }

      sendLinkButton.disabled = true;
      sendLinkButton.textContent = 'Sending…';

      try {
        await window.RootedOSSupabase.signInWithMagicLink(email);
        if (authMessage) authMessage.textContent = 'Magic link sent. Check your email.';
      } catch (error) {
        if (authMessage) authMessage.textContent = 'Could not send magic link. Please try again.';
      } finally {
        sendLinkButton.disabled = false;
        sendLinkButton.textContent = 'Send Magic Link';
      }
    });
  }

  if (signOutButton) {
    signOutButton.addEventListener('click', async function () {
      signOutButton.disabled = true;
      signOutButton.textContent = 'Signing out…';

      try {
        await window.RootedOSSupabase.signOut();
        setSignedOutState();
      } catch (error) {
        // keep current state
      } finally {
        signOutButton.disabled = false;
        signOutButton.textContent = 'Sign Out';
      }
    });
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
hydrateAuthUI();
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
