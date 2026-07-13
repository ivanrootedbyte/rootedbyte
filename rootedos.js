(function () {
  const SESSION_KEY = 'rootedosSession';
  const USAGE_KEY = 'rootedosUsage';
  const JOURNAL_KEY = 'rootedosJournalEntries';
  const LIMITS = { journalsPerMonth: 5, pptPerMonth: 5 };
  const PAYGATE_MESSAGE = 'You’ve reached the free monthly limit. Upgrade to unlock more saved journals and PowerPoint generations.';
  const INTRO_KEY = 'rootedosIntroSeen';
  const DAILY_QUOTES = [
    'Truth does not rush you. It roots you.',
    'Not every strong feeling is a faithful guide.',
    'What shapes your attention eventually shapes your direction.',
    'Wisdom begins when reaction slows down.',
    'The question underneath the question is often where truth begins.',
    'Peace is not the absence of pressure; it is being anchored under it.',
    'Do not only ask what this means. Ask what it is forming in you.'
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function nowIso() { return new Date().toISOString(); }
  function monthKey() { return new Date().toISOString().slice(0, 7); }
  function cleanText(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }

  function dailyQuote() {
    const day = Math.floor(Date.now() / 86400000);
    return DAILY_QUOTES[day % DAILY_QUOTES.length];
  }

  function rootUrl() {
    return window.location.origin + window.location.pathname.replace(/[^/]*$/, 'index.html');
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
  }

  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  function getSession() { return readJson(SESSION_KEY, null); }

  function saveSession(patch) {
    const existing = getSession() || { id: String(Date.now()), createdAt: nowIso() };
    const next = { ...existing, ...patch, updatedAt: nowIso() };
    writeJson(SESSION_KEY, next);
    return next;
  }

  function getUsage() { return readJson(USAGE_KEY, { journal: {}, ppt: {} }); }

  function incrementUsage(type) {
    const usage = getUsage();
    const key = monthKey();
    usage[type] = usage[type] || {};
    usage[type][key] = Number(usage[type][key] || 0) + 1;
    writeJson(USAGE_KEY, usage);
    return usage[type][key];
  }

  function usageCount(type) {
    const usage = getUsage();
    return Number(usage?.[type]?.[monthKey()] || 0);
  }

  function canUse(type) {
    const limit = type === 'ppt' ? LIMITS.pptPerMonth : LIMITS.journalsPerMonth;
    return usageCount(type) < limit;
  }

  function setStatus(message, mode = '') {
    const els = $$('[data-status]');
    if (!els.length) return;
    els.forEach((el) => {
      el.textContent = message || '';
      el.dataset.mode = mode;
    });
  }

  function showLoading(message) {
    document.body.classList.add('is-loading');
    setStatus(message || 'Building...');
  }

  function hideLoading(message) {
    document.body.classList.remove('is-loading');
    if (message !== undefined) setStatus(message);
  }

  async function api(action, payload) {
    const response = await fetch('/api/rootedos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      const message = data.message || 'RootedOS could not complete this request. Please try again.';
      const error = new Error(message);
      error.payload = data;
      throw error;
    }
    return data;
  }

  function requireSession(redirectTo = 'index.html') {
    const session = getSession();
    if (!session || !cleanText(session.rawInput)) {
      window.location.href = redirectTo;
      return null;
    }
    return session;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function initIndex() {
    const orb = $('[data-open-input]');
    const panel = $('[data-input-panel]');
    const form = $('[data-input-form]');
    const input = $('[data-rooted-input]');
    const quoteEls = $$('[data-daily-quote], [data-intro-quote]');
    const intro = $('[data-intro-modal]');

    quoteEls.forEach(el => { el.textContent = dailyQuote(); });

    if (intro && localStorage.getItem(INTRO_KEY) !== 'true') {
      intro.classList.add('is-open');
    }

    $('[data-close-intro]')?.addEventListener('click', () => {
      localStorage.setItem(INTRO_KEY, 'true');
      intro?.classList.remove('is-open');
      panel?.classList.add('is-open');
      input?.focus();
    });

    if (!orb || !panel || !form || !input) return;

    orb.addEventListener('click', () => {
      panel.classList.add('is-open');
      input.focus();
    });

    $('[data-close-input]')?.addEventListener('click', () => panel.classList.remove('is-open'));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const rawInput = cleanText(input.value);
      if (!rawInput) {
        setStatus('Paste a link or type something first.', 'error');
        input.focus();
        return;
      }

      const session = saveSession({
        id: String(Date.now()),
        createdAt: nowIso(),
        rawInput,
        inputType: '',
        detectedTopic: '',
        extractedText: '',
        summary: '',
        questionSet: null,
        selectedAnswer: null,
        trailMap: null,
        study: null,
        questionTrail: []
      });

      try {
        showLoading('Reading what you gave me...');
        const analyzed = await api('analyze_input', { rawInput: session.rawInput });
        saveSession({
          inputType: analyzed.inputType,
          detectedTopic: analyzed.detectedTopic,
          extractedText: analyzed.extractedText,
          summary: analyzed.summary,
          confidence: analyzed.confidence
        });
        window.location.href = 'questions.html';
      } catch (error) {
        hideLoading('');
        setStatus(error.message, 'error');
      }
    });
  }

  async function initQuestions() {
    const session = requireSession();
    if (!session) return;

    const title = $('[data-question-title]');
    const context = $('[data-question-context]');
    const optionsWrap = $('[data-question-options]');
    const topic = $('[data-topic]');

    if (topic) topic.textContent = session.detectedTopic || 'Discovery Node';

    async function loadQuestions() {
      if (session.questionSet?.options?.length) return session.questionSet;
      showLoading('Generating your Discovery Node...');
      const result = await api('generate_questions', {
        rawInput: session.rawInput,
        extractedText: session.extractedText,
        inputType: session.inputType,
        detectedTopic: session.detectedTopic
      });
      saveSession({ questionSet: result });
      return result;
    }

    try {
      const questionSet = await loadQuestions();
      hideLoading('Choose the path that feels closest to what you want to explore.');
      if (title) title.textContent = questionSet.questionTitle;
      if (context) context.textContent = questionSet.contextLine;
      if (optionsWrap) {
        optionsWrap.innerHTML = questionSet.options.map((option, index) => `
          <button class="node-card" type="button" data-select-option="${index}">
            <span class="node-index">0${index + 1}</span>
            <strong>${escapeHtml(option.label)}</strong>
            <small>${escapeHtml(option.theme)}</small>
            <p>${escapeHtml(option.description)}</p>
          </button>
        `).join('');

        $$('[data-select-option]', optionsWrap).forEach(button => {
          button.addEventListener('click', async () => {
            const index = Number(button.dataset.selectOption);
            const selected = questionSet.options[index];
            saveSession({ selectedAnswer: selected });
            try {
              showLoading('Building your Truth Trail Map...');
              const trail = await api('generate_trail', {
                rawInput: session.rawInput,
                extractedText: session.extractedText,
                summary: session.summary,
                questionTitle: questionSet.questionTitle,
                selectedAnswer: selected,
                theme: selected.theme
              });
              saveSession({ trailMap: trail.trailMap });
              window.location.href = 'trail.html';
            } catch (error) {
              hideLoading('');
              setStatus(error.message, 'error');
            }
          });
        });
      }
    } catch (error) {
      hideLoading('');
      setStatus(error.message, 'error');
    }
  }

  function initTrail() {
    const session = requireSession();
    if (!session) return;
    if (!session.trailMap) {
      window.location.href = 'questions.html';
      return;
    }

    $('[data-topic]') && ($('[data-topic]').textContent = session.detectedTopic || 'Truth Trail');
    $('[data-summary]') && ($('[data-summary]').textContent = session.summary || session.rawInput);
    $('[data-selected]') && ($('[data-selected]').textContent = session.selectedAnswer?.label || 'Selected path');

    const map = session.trailMap;
    const nodes = [
      ['01', 'Signal', map.signal],
      ['02', 'Pressure', map.pressure],
      ['03', 'Formation', map.formation],
      ['04', 'Truth Anchor', map.truthAnchor],
      ['05', 'Next Step', map.nextStep]
    ];

    const wrap = $('[data-trail-map]');
    if (wrap) {
      wrap.innerHTML = nodes.map(([num, label, text]) => `
        <article class="trail-node trail-flip">
          <div class="trail-flip-card" role="button" tabindex="0" aria-label="Flip ${escapeHtml(label)} trail card">
            <span class="trail-flip-inner">
              <span class="trail-face trail-front">
                <span class="trail-num">${num}</span>
                <span class="trail-front-title">${escapeHtml(label)}</span>
                <span class="trail-front-hint">Tap to reveal</span>
              </span>
              <span class="trail-face trail-back">
                <span class="trail-back-kicker">${num} · ${escapeHtml(label)}</span>
                <span class="trail-back-text">${escapeHtml(text)}</span>
              </span>
            </span>
          </div>
        </article>
      `).join('');

      wrap.querySelectorAll('.trail-flip-card').forEach((card) => {
        card.addEventListener('click', (event) => {
          if (event.target.closest('.trail-back-text')) return;
          card.classList.toggle('is-flipped');
        });

        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            card.classList.toggle('is-flipped');
          }
        });
      });
    }

    function ensureTrailLoop() {
      let loop = $('[data-trail-loop]');
      if (!loop) {
        loop = document.createElement('section');
        loop.className = 'trail-loop';
        loop.setAttribute('data-trail-loop', '');
        const status = $('[data-status]');
        if (status?.parentNode) status.parentNode.insertBefore(loop, status);
        else wrap?.after(loop);
      }
      return loop;
    }

    function modeLabel(mode) {
      return ({
        go_deeper: 'Go deeper',
        make_practical: 'Make it practical',
        challenge_assumption: 'Challenge my assumption',
        help_journal: 'Help me journal this'
      })[mode] || 'Keep exploring';
    }

    function renderTrailLoop() {
      const current = getSession() || session;
      const trail = Array.isArray(current.questionTrail) ? current.questionTrail : [];
      const loop = ensureTrailLoop();
      const latest = trail[trail.length - 1];
      const history = trail.filter(node => node.selectedOption || node.reflection).slice(-3);

      loop.innerHTML = `
        <div class="trail-loop-shell">
          <div class="trail-loop-top">
            <span class="eyebrow">Question Trail</span>
            <h2>Where do you want to go next?</h2>
            <p>RootedOS should not end with an output. Choose a direction and keep asking better questions.</p>
          </div>

          <div class="trail-loop-modes" aria-label="Continue exploring options">
            <button type="button" data-continue-mode="go_deeper">Go deeper</button>
            <button type="button" data-continue-mode="make_practical">Make practical</button>
            <button type="button" data-continue-mode="challenge_assumption">Challenge assumption</button>
            <button type="button" data-continue-mode="help_journal">Journal it</button>
          </div>

          ${latest ? `
            <article class="trail-question-node">
              <div class="trail-question-meta">${escapeHtml(modeLabel(latest.mode))}</div>
              ${latest.reflection ? `
                <div class="trail-reflection-card">
                  <strong>${escapeHtml(latest.reflection.title || 'What surfaced')}</strong>
                  <p>${escapeHtml(latest.reflection.insight || '')}</p>
                  <p>${escapeHtml(latest.reflection.truthReframe || '')}</p>
                  <small>${escapeHtml(latest.reflection.practice || '')}</small>
                </div>
              ` : ''}
              <h3>${escapeHtml(latest.question)}</h3>
              <div class="trail-answer-grid">
                ${(latest.options || []).map((option, index) => `
                  <button type="button" class="trail-answer-btn ${latest.selectedOption?.label === option.label ? 'is-selected' : ''}" data-answer-node="${escapeHtml(latest.id)}" data-answer-index="${index}">
                    <strong>${escapeHtml(option.label)}</strong>
                    <span>${escapeHtml(option.description)}</span>
                  </button>
                `).join('')}
              </div>
            </article>
          ` : ''}

          ${history.length ? `
            <div class="trail-loop-history">
              <strong>Recent exploration</strong>
              ${history.map(node => `
                <p><span>${escapeHtml(modeLabel(node.mode))}</span> ${escapeHtml(node.selectedOption?.label || node.question || '')}</p>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;

      loop.querySelectorAll('[data-continue-mode]').forEach(button => {
        button.addEventListener('click', () => requestNextQuestion(button.dataset.continueMode));
      });

      loop.querySelectorAll('[data-answer-node]').forEach(button => {
        button.addEventListener('click', () => answerQuestionNode(button.dataset.answerNode, Number(button.dataset.answerIndex)));
      });
    }

    async function requestNextQuestion(mode, userResponse = null, previousQuestion = '') {
      const current = getSession() || session;
      try {
        showLoading(userResponse ? 'Building the next honest question...' : 'Opening the next question...');
        const result = await api('continue_trail', {
          mode,
          rawInput: current.rawInput,
          extractedText: current.extractedText,
          summary: current.summary,
          detectedTopic: current.detectedTopic,
          selectedAnswer: current.selectedAnswer,
          trailMap: current.trailMap,
          questionTrail: current.questionTrail || [],
          previousQuestion,
          userResponse
        });

        const nextNode = {
          ...(result.node || {}),
          id: String(Date.now()),
          createdAt: nowIso(),
          mode
        };

        const nextTrail = [...(current.questionTrail || []), nextNode];
        saveSession({ questionTrail: nextTrail });
        hideLoading('Choose the answer that feels most honest right now.');
        renderTrailLoop();
      } catch (error) {
        hideLoading('');
        setStatus(error.message, 'error');
      }
    }

    async function answerQuestionNode(nodeId, optionIndex) {
      const current = getSession() || session;
      const trail = Array.isArray(current.questionTrail) ? current.questionTrail : [];
      const nodeIndex = trail.findIndex(node => String(node.id) === String(nodeId));
      if (nodeIndex < 0) return;

      const node = trail[nodeIndex];
      const option = node.options?.[optionIndex];
      if (!option) return;

      const updatedTrail = trail.map((item, index) => index === nodeIndex ? { ...item, selectedOption: option } : item);
      saveSession({ questionTrail: updatedTrail });
      renderTrailLoop();
      await requestNextQuestion(node.mode, option, node.question);
    }

    renderTrailLoop();

    $('[data-open-study]')?.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = 'study.html';
    });

    $('[data-share-trail]')?.addEventListener('click', async (event) => {
      event.preventDefault();
      const current = getSession() || session;
      const currentMap = current.trailMap || map;
      const text = `RootedOS Truth Trail: ${current.detectedTopic}\n\nSignal: ${currentMap.signal}\nTruth Anchor: ${currentMap.truthAnchor}\nNext Step: ${currentMap.nextStep}`;
      try {
        if (navigator.share) await navigator.share({ title: 'RootedOS Truth Trail', text });
        else {
          await navigator.clipboard.writeText(text);
          setStatus('Truth Trail copied to clipboard.');
        }
      } catch (_) {}
    });
  }

  function renderList(items) {
    return (Array.isArray(items) ? items : []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  }

  async function ensureStudy(session) {
    if (session.study?.title) return session.study;
    showLoading('Preparing your Study Builder...');
    const result = await api('generate_study', {
      rawInput: session.rawInput,
      extractedText: session.extractedText,
      summary: session.summary,
      questionTitle: session.questionSet?.questionTitle,
      selectedAnswer: session.selectedAnswer,
      trailMap: session.trailMap
    });
    saveSession({ study: result.study });
    return result.study;
  }

  async function initStudy() {
    const session = requireSession();
    if (!session) return;
    if (!session.trailMap) {
      window.location.href = 'trail.html';
      return;
    }

    const body = $('[data-study-body]');
    const journal = $('[data-journal-text]');

    try {
      const study = await ensureStudy(session);
      hideLoading('Study Builder ready. Journal first, then generate PPT only when needed.');
      if (body) {
        body.innerHTML = `
          <section class="study-card hero-study">
            <span class="eyebrow">Study Builder</span>
            <h1>${escapeHtml(study.title)}</h1>
            <p>${escapeHtml(study.summary)}</p>
          </section>
          <section class="study-grid">
            <article class="study-card"><h2>Truth Trail</h2><ul>${renderList(study.truthTrail)}</ul></article>
            <article class="study-card"><h2>Study Notes</h2><ul>${renderList(study.studyNotes)}</ul></article>
            <article class="study-card"><h2>Reflection Prompts</h2><ul>${renderList(study.reflectionPrompts)}</ul></article>
            <article class="study-card"><h2>Practical Next Steps</h2><ul>${renderList(study.practicalNextSteps)}</ul></article>
            <article class="study-card"><h2>Rooted Truth Anchors</h2><ul>${renderList(study.truthAnchors)}</ul></article>
            <article class="study-card"><h2>Journal Prompt</h2><p>${escapeHtml(study.journalPrompt)}</p></article>
          </section>
        `;
      }
      if (journal && !journal.value) journal.placeholder = study.journalPrompt || 'Write what you are noticing...';
    } catch (error) {
      hideLoading('');
      setStatus(error.message, 'error');
    }

    $('[data-save-journal]')?.addEventListener('click', (event) => {
      event.preventDefault();
      const text = cleanText(journal?.value || '');
      if (!text) return setStatus('Write a journal entry before saving.', 'error');
      if (!canUse('journal')) return setStatus(PAYGATE_MESSAGE, 'error');

      const entries = readJson(JOURNAL_KEY, []);
      const current = getSession();
      entries.unshift({
        id: String(Date.now()),
        createdAt: nowIso(),
        topic: current?.detectedTopic || 'RootedOS Journal',
        rawInput: current?.rawInput || '',
        selectedAnswer: current?.selectedAnswer || null,
        trailMap: current?.trailMap || null,
        text
      });
      writeJson(JOURNAL_KEY, entries);
      incrementUsage('journal');
      setStatus(`Journal saved. ${LIMITS.journalsPerMonth - usageCount('journal')} free saves left this month.`);
    });

    $('[data-generate-ppt]')?.addEventListener('click', async (event) => {
      event.preventDefault();
      if (!canUse('ppt')) return setStatus(PAYGATE_MESSAGE, 'error');
      const current = getSession();
      if (!current?.study) return setStatus('Study is not ready yet.', 'error');
      try {
        await generatePpt(current, cleanText(journal?.value || ''));
        incrementUsage('ppt');
        setStatus(`PowerPoint generated. ${LIMITS.pptPerMonth - usageCount('ppt')} free downloads left this month.`);
      } catch (error) {
        setStatus(error.message || 'Could not generate PowerPoint.', 'error');
      }
    });
  }

  function addBullets(slide, title, items) {
    slide.addText(title, { x: 0.5, y: 0.35, w: 9, h: 0.35, fontSize: 22, bold: true });
    const bulletText = (Array.isArray(items) ? items : [items]).filter(Boolean).map(item => `• ${String(item)}`).join('\n');
    slide.addText(bulletText || 'No notes added.', { x: 0.65, y: 1.0, w: 8.6, h: 4.2, fontSize: 15, breakLine: false, fit: 'shrink' });
  }


  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        if (window.pptxgen) resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function loadPptxGen() {
    const sources = [
      'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
      'https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'
    ];

    for (const src of sources) {
      try {
        await loadScriptOnce(src);
        if (window.pptxgen) return;
      } catch (_) {}
    }
  }

  async function generatePpt(session, journalText) {
    if (!window.pptxgen) {
      await loadPptxGen();
    }

    if (!window.pptxgen) {
      throw new Error('PowerPoint generator could not load. Please refresh the page and try again.');
    }

    const pptx = new window.pptxgen();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'RootedOS';
    pptx.subject = session.detectedTopic || 'RootedOS Study';
    pptx.title = session.study.title || 'RootedOS Study';
    pptx.company = 'RootedByte';
    pptx.lang = 'en-US';

    let slide = pptx.addSlide();
    slide.addText(session.study.title || 'RootedOS Study', { x: 0.6, y: 1.2, w: 8.8, h: 0.7, fontSize: 34, bold: true, fit: 'shrink' });
    slide.addText('A Truth Trail study generated from your input.', { x: 0.65, y: 2.1, w: 8.5, h: 0.4, fontSize: 16 });
    slide.addText('RootedOS by RootedByte', { x: 0.65, y: 4.8, w: 5, h: 0.3, fontSize: 12 });

    slide = pptx.addSlide();
    addBullets(slide, 'User Topic / Input', [
      `Topic: ${session.detectedTopic || session.study.topic || 'Untitled'}`,
      `Input type: ${session.inputType || 'unknown'}`,
      `Original input: ${session.rawInput || ''}`
    ]);

    slide = pptx.addSlide();
    addBullets(slide, 'Extracted Summary', [session.summary || session.study.summary || 'No summary available.']);

    slide = pptx.addSlide();
    addBullets(slide, 'AI Question + Selected Path', [
      session.questionSet?.questionTitle || '',
      session.selectedAnswer?.label || '',
      session.selectedAnswer?.description || ''
    ]);

    slide = pptx.addSlide();
    addBullets(slide, 'Truth Trail Map', [
      `Signal: ${session.trailMap?.signal || ''}`,
      `Pressure: ${session.trailMap?.pressure || ''}`,
      `Formation: ${session.trailMap?.formation || ''}`,
      `Truth Anchor: ${session.trailMap?.truthAnchor || ''}`,
      `Next Step: ${session.trailMap?.nextStep || ''}`
    ]);

    slide = pptx.addSlide();
    addBullets(slide, 'Study Notes', session.study.studyNotes);

    slide = pptx.addSlide();
    addBullets(slide, 'Reflection Prompts', session.study.reflectionPrompts);

    slide = pptx.addSlide();
    addBullets(slide, 'Practical Next Steps', session.study.practicalNextSteps);

    slide = pptx.addSlide();
    addBullets(slide, 'Rooted Truth Anchors', session.study.truthAnchors);

    slide = pptx.addSlide();
    addBullets(slide, 'Journal Prompt + Notes', [session.study.journalPrompt, journalText ? `Journal notes: ${journalText}` : 'Journal notes: not added yet.']);

    const safeName = cleanText(session.study.title || 'rootedos-study').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rootedos-study';
    await pptx.writeFile({ fileName: `${safeName}.pptx` });
  }

  function initJournal() {
    const entries = readJson(JOURNAL_KEY, []);
    const wrap = $('[data-journal-list]');
    const counter = $('[data-journal-count]');
    if (counter) counter.textContent = `${usageCount('journal')} / ${LIMITS.journalsPerMonth} free saves used this month`;
    if (!wrap) return;
    if (!entries.length) {
      wrap.innerHTML = '<p class="empty-state">No saved journal entries yet.</p>';
      return;
    }
    wrap.innerHTML = entries.map(entry => `
      <article class="journal-entry">
        <span>${escapeHtml(new Date(entry.createdAt).toLocaleString())}</span>
        <h2>${escapeHtml(entry.topic)}</h2>
        <p>${escapeHtml(entry.text)}</p>
      </article>
    `).join('');
  }


  function initAccount() {
    const journalUsed = usageCount('journal');
    const pptUsed = usageCount('ppt');
    const entries = readJson(JOURNAL_KEY, []);

    const journalCount = $('[data-account-journal-count]');
    const pptCount = $('[data-account-ppt-count]');
    const savedCount = $('[data-account-saved-count]');
    const journalMeter = $('[data-account-journal-meter]');
    const pptMeter = $('[data-account-ppt-meter]');

    if (journalCount) journalCount.textContent = `Journals: ${journalUsed} / ${LIMITS.journalsPerMonth}`;
    if (pptCount) pptCount.textContent = `PPT: ${pptUsed} / ${LIMITS.pptPerMonth}`;
    if (savedCount) savedCount.textContent = `${entries.length} saved entr${entries.length === 1 ? 'y' : 'ies'} on this browser.`;
    if (journalMeter) journalMeter.style.setProperty('--meter', `${Math.min(100, (journalUsed / LIMITS.journalsPerMonth) * 100)}%`);
    if (pptMeter) pptMeter.style.setProperty('--meter', `${Math.min(100, (pptUsed / LIMITS.pptPerMonth) * 100)}%`);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    if (page === 'index') initIndex();
    if (page === 'questions') initQuestions();
    if (page === 'trail') initTrail();
    if (page === 'study') initStudy();
    if (page === 'journal') initJournal();
    if (page === 'account') initAccount();
  });
})();
