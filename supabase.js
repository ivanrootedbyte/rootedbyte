(function () {
  const CDN_SOURCES = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
    'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js'
  ];
  let clientPromise = null;

  function loadScript(src, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-rootedos-supabase-src="${src}"]`);
      if (window.supabase?.createClient) return resolve();
      const script = existing || document.createElement('script');
      const timer = setTimeout(() => reject(new Error('Supabase library timed out.')), timeoutMs);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Supabase library failed to load.')); };
      if (!existing) {
        script.src = src;
        script.async = true;
        script.dataset.rootedosSupabaseSrc = src;
        document.head.appendChild(script);
      }
    });
  }

  async function ensureLibrary() {
    if (window.supabase?.createClient) return;
    for (const src of CDN_SOURCES) {
      try {
        await loadScript(src);
        if (window.supabase?.createClient) return;
      } catch (_) {}
    }
    throw new Error('RootedOS could not load its secure account library. Please refresh and try again.');
  }

  async function getClient() {
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
      const response = await fetch('/api/public-config', { cache: 'no-store' });
      const config = await response.json().catch(() => ({}));
      if (!response.ok || !config.configured) throw new Error(config.message || 'RootedOS accounts are not configured.');
      await ensureLibrary();
      return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    })();
    try { return await clientPromise; } catch (error) { clientPromise = null; throw error; }
  }

  async function currentUser() {
    const client = await getClient();
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    return data.user || null;
  }

  async function signInWithEmail(email) {
    const client = await getClient();
    const redirectTo = `${window.location.origin}/account.html`;
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) throw error;
  }

  async function signOut() {
    const client = await getClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  async function getProfile() {
    const user = await currentUser();
    if (!user) return null;
    const client = await getClient();
    const { data, error } = await client.from('profiles').select('id, username').eq('id', user.id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function saveUsername(username) {
    const user = await currentUser();
    if (!user) throw new Error('Sign in before setting a username.');
    const clean = String(username || '').trim();
    if (!/^[A-Za-z0-9_]{3,24}$/.test(clean)) throw new Error('Username must be 3–24 characters using letters, numbers, or underscores.');
    const client = await getClient();
    const { error } = await client.from('profiles').upsert({ id: user.id, username: clean }, { onConflict: 'id' });
    if (error) throw error;
  }

  async function createPost(title, content) {
    const user = await currentUser();
    if (!user) throw new Error('Sign in before posting publicly.');
    const profile = await getProfile();
    if (!profile?.username) throw new Error('Set your public username in My RootedOS before posting.');
    const cleanTitle = String(title || '').trim();
    const cleanContent = String(content || '').trim();
    if (cleanTitle.length < 3 || cleanTitle.length > 120) throw new Error('Post title must be 3–120 characters.');
    if (cleanContent.length < 10 || cleanContent.length > 5000) throw new Error('Post content must be 10–5,000 characters.');
    const client = await getClient();
    const { error } = await client.from('member_posts').insert({ user_id: user.id, title: cleanTitle, content: cleanContent });
    if (error) throw error;
  }

  async function listPosts() {
    const client = await getClient();
    const { data, error } = await client.from('member_posts').select('id, title, content, username, created_at').order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return data || [];
  }

  function randomSlug() {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(36).padStart(2, '0')).join('').slice(0, 20);
  }

  async function createSharedTrail(snapshot) {
    const user = await currentUser();
    if (!user) throw new Error('Sign in before creating a public trail link.');
    const profile = await getProfile();
    if (!profile?.username) throw new Error('Set your public username in My RootedOS before sharing.');

    const topic = String(snapshot?.topic || '').trim().slice(0, 160);
    const summary = String(snapshot?.summary || '').trim().slice(0, 1200);
    const rawInputPreview = String(snapshot?.rawInputPreview || '').trim().slice(0, 600);
    const sourceUrl = String(snapshot?.sourceUrl || '').trim().slice(0, 1200);
    if (!topic || !summary || !snapshot?.trailMap) throw new Error('This trail is not ready to share.');

    const client = await getClient();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const shareSlug = randomSlug();
      const { data, error } = await client.from('shared_trails').insert({
        owner_id: user.id,
        share_slug: shareSlug,
        topic,
        summary,
        raw_input_preview: rawInputPreview,
        source_url: sourceUrl || null,
        selected_path: snapshot.selectedPath || {},
        trail_map: snapshot.trailMap,
        question_seed: snapshot.questionSeed || {},
        is_public: true
      }).select('share_slug').single();

      if (!error) return data;
      if (error.code !== '23505') throw error;
    }
    throw new Error('Could not create a unique share link. Please try again.');
  }

  window.RootedSupabase = {
    getClient,
    currentUser,
    signInWithEmail,
    signOut,
    getProfile,
    saveUsername,
    createPost,
    listPosts,
    createSharedTrail
  };
})();
