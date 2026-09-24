// Glyde — the services mode of DormGlide. Shared constants + mode helpers.
// Services are products rows with listingType 'service'; bookings are
// purchase_requests rows with kind 'booking'. Same account, campus, chat,
// deal flow and ratings — only the storefront and accent color differ.
(() => {
    const MODE_KEY = 'dormglide_mode';

    // v1 categories — must match the DB check constraint exactly.
    const SERVICE_CATEGORIES = [
        { name: 'Tutoring & academic help', glyph: '📚' },
        { name: 'Hair & beauty', glyph: '💇' },
        { name: 'Tech help', glyph: '💻' },
        { name: 'Photography & video', glyph: '📸' },
        { name: 'Moving & carrying help', glyph: '🚚' },
        { name: 'Pet sitting & dog walking', glyph: '🐶' },
        { name: 'Fitness & sports coaching', glyph: '🏋️' },
        { name: 'Music lessons', glyph: '🎸' },
        { name: 'Other', glyph: '✨' }
    ];

    const RATE_UNITS = [
        { value: 'hour', label: 'per hour', short: '/hr' },
        { value: 'session', label: 'per session', short: '/session' },
        { value: 'flat', label: 'flat rate', short: ' flat' }
    ];

    const LOCATION_OPTIONS = [
        { value: 'on campus', label: 'On campus', glyph: '🏫' },
        { value: 'my place', label: 'My place', glyph: '🏠' },
        { value: 'your place', label: 'Your place', glyph: '🚪' },
        { value: 'remote', label: 'Remote', glyph: '💻' }
    ];

    // Enforced in the UI (this notice + the fixed category list) and by the
    // DB check constraint on service_category.
    const EXCLUDED_SERVICES_NOTICE =
        'Not allowed on Glyde: childcare or anything involving minors, medical or mental-health services, ' +
        'anything that requires a professional license, and doing academic work ' +
        'that someone else will submit as their own (tutoring is welcome — ghostwriting is not). ' +
        'Rides are allowed only if you have a valid license and an insured, registered vehicle.';

    const getMode = () => {
        try {
            return localStorage.getItem(MODE_KEY) === 'glyde' ? 'glyde' : 'goods';
        } catch (_error) {
            return 'goods';
        }
    };

    const setMode = (mode) => {
        const next = mode === 'glyde' ? 'glyde' : 'goods';
        try {
            localStorage.setItem(MODE_KEY, next);
        } catch (_error) { /* storage unavailable */ }
        return next;
    };

    const categoryGlyph = (name) =>
        (SERVICE_CATEGORIES.find((entry) => entry.name === name) || { glyph: '✨' }).glyph;

    const formatRate = (product) => {
        const rate = Number(product?.rate ?? product?.price ?? 0);
        const unit = RATE_UNITS.find((entry) => entry.value === product?.rateUnit) || RATE_UNITS[0];
        const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: rate % 1 === 0 ? 0 : 2 }).format(rate);
        return `${money}${unit.short}`;
    };

    const locationLabel = (value) =>
        (LOCATION_OPTIONS.find((entry) => entry.value === value) || {}).label || '';

    const isService = (product) => String(product?.listingType || 'goods') === 'service';

    window.DormGlideGlyde = {
        SERVICE_CATEGORIES,
        RATE_UNITS,
        LOCATION_OPTIONS,
        EXCLUDED_SERVICES_NOTICE,
        getMode,
        setMode,
        categoryGlyph,
        formatRate,
        locationLabel,
        isService
    };
})();

// ---------------------------------------------------------------------------
// Phase 3: request board, reports, provider stats, founder counts.
// All Supabase-only (RLS-enforced); local demo mode returns empty/no-ops.
// ---------------------------------------------------------------------------
(() => {
    const client = () => window.SupabaseClient || null;
    const G = window.DormGlideGlyde;

    const REPORT_REASONS = ['Not allowed on Glyde', 'Scam or no-show', 'Harassment', 'Wrong category', 'Other'];

    const normalizeRequest = (row) => row ? ({
        id: row.id,
        userId: row.user_id,
        requesterName: row.requester_name || '',
        category: row.category,
        title: row.title,
        details: row.details || '',
        budgetNote: row.budget_note || '',
        status: row.status || 'open',
        createdAt: row.created_at
    }) : null;

    const fetchServiceRequests = async () => {
        const c = client();
        if (!c) return [];
        const { data, error } = await c
            .from('service_requests')
            .select('*')
            .eq('status', 'open')
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) { console.warn('[DormGlide] Request board fetch failed:', error); return []; }
        return (data || []).map(normalizeRequest);
    };

    const createServiceRequest = async ({ userId, requesterName = '', category, title, details = '', budgetNote = '' }) => {
        const c = client();
        if (!c) return { success: false, message: 'Request board needs a live connection.' };
        const { data, error } = await c
            .from('service_requests')
            .insert({ user_id: userId, requester_name: String(requesterName || '').slice(0, 80) || null,
                      category, title: String(title).trim().slice(0, 120),
                      details: String(details || '').trim().slice(0, 500) || null,
                      budget_note: String(budgetNote || '').trim().slice(0, 60) || null })
            .select('*')
            .single();
        if (error) { console.error('[DormGlide] Post request failed:', error); return { success: false, message: 'Could not post your request. Please try again.' }; }
        return { success: true, request: normalizeRequest(data) };
    };

    const closeServiceRequest = async ({ requestId, userId }) => {
        const c = client();
        if (!c) return { success: false };
        const { error } = await c.from('service_requests').update({ status: 'closed' }).eq('id', requestId).eq('user_id', userId);
        if (error) { console.error('[DormGlide] Close request failed:', error); return { success: false }; }
        return { success: true };
    };

    const createReport = async ({ reporterId, targetType, targetId, reason, details = '' }) => {
        const c = client();
        if (!c) return { success: false, message: 'Reporting needs a live connection.' };
        const { error } = await c.from('reports').insert({
            reporter_id: reporterId, target_type: targetType, target_id: String(targetId),
            reason, details: String(details || '').trim().slice(0, 500) || null
        });
        if (error) { console.error('[DormGlide] Report failed:', error); return { success: false, message: 'Could not send the report. Please try again.' }; }
        return { success: true };
    };

    const statsCache = new Map();
    const fetchProviderStats = async (providerId) => {
        if (!providerId) return null;
        if (statsCache.has(providerId)) return statsCache.get(providerId);
        const c = client();
        if (!c) return null;
        const { data, error } = await c.rpc('provider_stats', { p_provider: providerId });
        if (error) { console.warn('[DormGlide] provider_stats failed:', error); return null; }
        const row = Array.isArray(data) ? data[0] : data;
        const stats = row ? {
            completedBookings: Number(row.completed_bookings || 0),
            avgRating: row.avg_rating !== null ? Number(row.avg_rating) : null,
            ratingCount: Number(row.rating_count || 0),
            categories: Array.isArray(row.categories) ? row.categories : [],
            replyMinutes: row.reply_minutes !== null && row.reply_minutes !== undefined ? Number(row.reply_minutes) : null,
            replySamples: Number(row.reply_samples || 0)
        } : null;
        statsCache.set(providerId, stats);
        return stats;
    };

    const formatReplyTime = (minutes) => {
        if (minutes === null || minutes === undefined) return null;
        if (minutes < 60) return `~${Math.max(1, Math.round(minutes))} min`;
        if (minutes < 60 * 24) return `~${Math.round(minutes / 60)} hour${Math.round(minutes / 60) === 1 ? '' : 's'}`;
        return `~${Math.round(minutes / 1440)} day${Math.round(minutes / 1440) === 1 ? '' : 's'}`;
    };

    const fetchGlydeAdminCounts = async () => {
        const c = client();
        if (!c) return null;
        const { data, error } = await c.rpc('glyde_admin_counts');
        if (error) { console.warn('[DormGlide] glyde_admin_counts:', error.message); return null; }
        return data || null;
    };

    Object.assign(G, {
        REPORT_REASONS,
        fetchServiceRequests,
        createServiceRequest,
        closeServiceRequest,
        createReport,
        fetchProviderStats,
        formatReplyTime,
        fetchGlydeAdminCounts
    });
})();
