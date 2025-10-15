(function () {
    const SUPABASE_URL = window.SUPABASE_URL || 'https://YOUR-PROJECT-REF.supabase.co';
    const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'YOUR_PUBLIC_ANON_KEY';

    if (!window.SupabaseClient && window.supabase && SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY !== 'YOUR_PUBLIC_ANON_KEY') {
        window.SupabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true
            }
        });
        console.log('[DormGlide] Supabase client initialized.');
    } else if (!window.supabase) {
        console.warn('[DormGlide] Supabase JS library not loaded.');
    } else {
        console.warn('[DormGlide] Supabase client not configured. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY before loading supabaseClient.js.');
    }
})();
