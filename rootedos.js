(function () {
  const STORAGE_KEY = 'rootedosTrail';

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
    try { return JSON.parse(value); } catch (error) { return fallback; }
  }

  function getStoredTrail() {
    return safeParse(localStorage.getItem(STORAGE_KEY) || '{}', {});
  }

  function setStoredTrail(nextState) {
    const merged = Object.assign({}, getStoredTrail(), nextState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
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
    return (text || '').replace(/\b\w/g, function (char) { return char.toUpperCase(); });
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

        categoryOrbs.forEach(function (item) { item.classList.remove('active'); });
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
        setStoredTrail({
          category: category,
          input: inputBox.value.trim()
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
    const state = getStoredTrail();
    const meta = getMeta();
    const questions = meta.questions || [];

    if (!questionHeading || !choiceNodes.length) return;

    applyCategoryTheme();

    if (eyebrow) eyebrow.textContent = meta.title + ' • Reflection Step';
    if (title) title.textContent = 'Tap what rises to the surface.';
    if (intro) intro.textContent = 'RootedOS uses guided questions instead of chat so the deeper theme can surface step by step.';
    if (tag) tag.textContent = 'Discovery Node • ' + meta.title;

    questionHeading.textContent = questions[0] ? questions[0].title : 'What stands out most from this input?';

    choiceNodes.forEach(function (choice, index) {
      const strong = choice.querySelector('strong');
      const span = choice.querySelector('span');
      const option = questions[0] && questions[0].options[index] ? questions[0].options[index] : 'Theme ' + (index + 1);

      if (strong) strong.textContent = option;
      if (span) span.textContent = 'Select this if it feels closest to the heart of your input.';

      choice.href = 'trail.html?category=' + encodeURIComponent(getActiveCategory());
      choice.addEventListener('click', function () {
        const first = option;
        const second = questions[1] && questions[1].options[index] ? questions[1].options[index] : '';
        const theme = second || first || ensureTheme(state) || 'Truth Trail Theme';

        setStoredTrail({
          category: getActiveCategory(),
          questionOne: first,
          questionTwo: second,
          theme: theme
        });
      });
    });

    pillNodes.forEach(function (pill, index) {
      const label = questions[1] && questions[1].options[index - 1] ? questions[1].options[index - 1] : '';
      if (index === 0) {
        pill.textContent = questions[1] ? 'Next: ' + questions[1].title : 'Next discovery layer';
      } else if (label) {
        pill.textContent = label;
      }
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
  addCategoryToEyebrow();

  window.RootedOS = {
    CATEGORY_META: CATEGORY_META,
    getStoredTrail: getStoredTrail,
    setStoredTrail: setStoredTrail,
    getActiveCategory: getActiveCategory
  };
})();
