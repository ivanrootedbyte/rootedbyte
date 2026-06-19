(function () {
  let clientPromise = null;
  let currentUser = null;

  async function getPublicConfig() {
    const response = await fetch('/api/public-config');
    if (!response.ok) {
      throw new Error('Could not load public config.');
    }
    return response.json();
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async function () {
        const config = await getPublicConfig();

        if (!config.supabaseUrl || !config.supabaseAnonKey) {
          throw new Error('Supabase public config is missing.');
        }

        if (!window.supabase || !window.supabase.createClient) {
          throw new Error('Supabase browser library is not loaded.');
        }

        const client = window.supabase.createClient(
          config.supabaseUrl,
          config.supabaseAnonKey
        );

        const authResult = await client.auth.getUser();
        currentUser = authResult && authResult.data ? authResult.data.user : null;

        client.auth.onAuthStateChange(function (_event, session) {
          currentUser = session && session.user ? session.user : null;
        });

        return client;
      })();
    }

    return clientPromise;
  }

  async function getUser() {
    await getClient();
    return currentUser;
  }

  async function signInWithMagicLink(email) {
    const client = await getClient();

    const redirectTo = window.location.origin + '/journal.html';

    const { error } = await client.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: redirectTo
      }
    });

    if (error) {
      throw error;
    }

    return true;
  }

  async function signOut() {
    const client = await getClient();
    const { error } = await client.auth.signOut();
    if (error) {
      throw error;
    }
    return true;
  }

  async function upsertProfile(profile) {
    const client = await getClient();
    const user = await getUser();

    if (!user) return null;

    const payload = {
      id: user.id,
      display_name: (profile && profile.display_name) || ''
    };

    const { error } = await client
      .from('profiles')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw error;
    }

    return payload;
  }

  async function saveStudySession(session) {
    const client = await getClient();
    const user = await getUser();

    if (!user) return null;

    const payload = {
      user_id: user.id,
      category: session.category || 'life',
      category_title: session.categoryTitle || '',
      input: session.input || '',
      question_one: session.questionOne || '',
      question_two: session.questionTwo || '',
      theme: session.theme || '',
      biblical_parallel: session.biblicalParallel || '',
      scripture_connection: session.scriptureConnection || 'Scripture reference required (not generated)',
      truth_statement: session.truthStatement || '',
      study_title: session.studyTitle || '',
      trail_map_json: session.trailMap || null,
      study_output_json: session.studyOutput || null
    };

    if (session.cloudId) {
      payload.id = session.cloudId;
    }

    const { data, error } = await client
      .from('study_sessions')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async function saveJournalEntryCloud(entry) {
    const client = await getClient();
    const user = await getUser();

    if (!user) return null;

    const payload = {
      user_id: user.id,
      category: entry.category || 'life',
      category_title: entry.categoryTitle || '',
      date_key: entry.dateKey || '',
      input: entry.input || '',
      theme: entry.theme || '',
      study_title: entry.studyTitle || '',
      text: entry.text || '',
      truth_statement: entry.truthStatement || '',
      scripture_connection: entry.scriptureConnection || 'Scripture reference required (not generated)',
      biblical_parallel: entry.biblicalParallel || '',
      source: entry.source || 'journal'
    };

    const { data, error } = await client
      .from('journal_entries')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async function fetchJournalEntriesCloud() {
    const client = await getClient();
    const user = await getUser();

    if (!user) return [];

    const { data, error } = await client
      .from('journal_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function deleteJournalEntryCloud(id) {
    const client = await getClient();
    const user = await getUser();

    if (!user || !id) return false;

    const { error } = await client
      .from('journal_entries')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return true;
  }

  window.RootedOSSupabase = {
    getClient: getClient,
    getUser: getUser,
    signInWithMagicLink: signInWithMagicLink,
    signOut: signOut,
    upsertProfile: upsertProfile,
    saveStudySession: saveStudySession,
    saveJournalEntryCloud: saveJournalEntryCloud,
    fetchJournalEntriesCloud: fetchJournalEntriesCloud,
    deleteJournalEntryCloud: deleteJournalEntryCloud
  };
})();
