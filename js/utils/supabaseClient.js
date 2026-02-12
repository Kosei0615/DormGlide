(function () {
    const SUPABASE_URL = window.SUPABASE_URL || 'https://YOUR-PROJECT-REF.supabase.co';
    const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'YOUR_PUBLIC_ANON_KEY';

    window.DormGlideSupabaseSessionActive = false;

    if (!window.SupabaseClient && window.supabase && SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY !== 'YOUR_PUBLIC_ANON_KEY') {
        window.SupabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true
            }
        });
        console.log('[DormGlide] Supabase client initialized.');

        // Track whether there is an active Supabase Auth session.
        try {
            window.SupabaseClient.auth.getSession().then(({ data }) => {
                window.DormGlideSupabaseSessionActive = Boolean(data?.session);
            }).catch(() => {
                window.DormGlideSupabaseSessionActive = false;
            });

            window.SupabaseClient.auth.onAuthStateChange((_event, session) => {
                window.DormGlideSupabaseSessionActive = Boolean(session);
            });
        } catch (error) {
            console.warn('[DormGlide] Supabase session tracking unavailable:', error);
            window.DormGlideSupabaseSessionActive = false;
        }
    } else if (!window.supabase) {
        console.warn('[DormGlide] Supabase JS library not loaded.');
    } else {
        console.warn('[DormGlide] Supabase client not configured. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY before loading supabaseClient.js.');
    }
})();
