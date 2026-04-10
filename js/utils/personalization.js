(function () {
    if (window.DormGlidePersonalization) return;

    const LOCAL_LISTING_WISHLIST_KEY = 'dormglide_listing_wishlists';
    const LOCAL_WISHLIST_ENTRIES_KEY = 'dormglide_wishlist_entries';
    const LOCAL_KEYWORD_ALERTS_KEY = 'dormglide_keyword_alerts';
    const LOCAL_NOTIFICATIONS_KEY = 'dormglide_notifications';
    const VIEW_HISTORY_KEY = 'dormglide_view_history';

    const readLocal = (key, fallback) => {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (error) {
            console.error(`[DormGlide] Failed reading ${key}:`, error);
            return fallback;
        }
    };

    const writeLocal = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`[DormGlide] Failed writing ${key}:`, error);
        }
    };

    const getClient = () => window.SupabaseClient || null;
    const hasSupabaseSession = () => Boolean(window.DormGlideSupabaseSessionActive);
    const canUseSupabase = () => Boolean(getClient() && hasSupabaseSession());

    const nowIso = () => new Date().toISOString();
    const randomId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const normalizeKeyword = (keyword) => String(keyword || '').trim().toLowerCase();

    const fetchWishlistListingIds = async (userId) => {
        if (!userId) return [];

        if (canUseSupabase()) {
            const client = getClient();
            const { data, error } = await client
                .from('wishlists')
                .select('listing_id')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (!error) {
                return (data || []).map((row) => row.listing_id).filter(Boolean);
            }
            console.warn('[DormGlide] Falling back to local wishlist store:', error);
        }

        const local = readLocal(LOCAL_LISTING_WISHLIST_KEY, []);
        return (Array.isArray(local) ? local : [])
            .filter((entry) => entry?.user_id === userId)
            .map((entry) => entry.listing_id)
            .filter(Boolean);
    };

    const isListingWishlisted = async (userId, listingId) => {
        if (!userId || !listingId) return false;
        const ids = await fetchWishlistListingIds(userId);
        return ids.includes(listingId);
    };

    const toggleWishlist = async (userId, listingId) => {
        if (!userId || !listingId) {
            return { success: false, message: 'Missing user or listing.' };
        }

        if (canUseSupabase()) {
            const client = getClient();
            const { data: existing, error: existingError } = await client
                .from('wishlists')
                .select('id')
                .eq('user_id', userId)
                .eq('listing_id', listingId)
                .maybeSingle();

            if (!existingError && existing?.id) {
                const { error: deleteError } = await client
                    .from('wishlists')
                    .delete()
                    .eq('id', existing.id)
                    .eq('user_id', userId);
                if (!deleteError) {
                    return { success: true, saved: false };
                }
            }

            if (!existingError && !existing?.id) {
                const { error: insertError } = await client
                    .from('wishlists')
                    .insert({ user_id: userId, listing_id: listingId });
                if (!insertError) {
                    return { success: true, saved: true };
                }
            }
        }

        const local = readLocal(LOCAL_LISTING_WISHLIST_KEY, []);
        const normalized = Array.isArray(local) ? local : [];
        const index = normalized.findIndex((entry) => entry?.user_id === userId && entry?.listing_id === listingId);

        if (index >= 0) {
            normalized.splice(index, 1);
            writeLocal(LOCAL_LISTING_WISHLIST_KEY, normalized);
            return { success: true, saved: false };
        }

        normalized.push({
            id: randomId('wishlist'),
            user_id: userId,
            listing_id: listingId,
            created_at: nowIso()
        });
        writeLocal(LOCAL_LISTING_WISHLIST_KEY, normalized);
        return { success: true, saved: true };
    };

    const fetchWishlistEntries = async (userId) => {
        if (!userId) return [];

        if (canUseSupabase()) {
            const client = getClient();
            const { data, error } = await client
                .from('wishlists')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (!error) {
                return data || [];
            }
            console.warn('[DormGlide] Falling back to local wishlist entries fetch:', error);
        }

        const local = readLocal(LOCAL_WISHLIST_ENTRIES_KEY, []);
        return (Array.isArray(local) ? local : [])
            .filter((entry) => entry?.user_id === userId)
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    };

    const addWishlistEntry = async ({ userId, keyword, category = '', maxPrice = null }) => {
        const normalizedKeyword = String(keyword || '').trim();
        const normalizedCategory = String(category || '').trim() || null;
        const normalizedMaxPrice = maxPrice === null || maxPrice === undefined || maxPrice === ''
            ? null
            : Number(maxPrice);

        if (!userId || !normalizedKeyword) {
            return { success: false, message: 'Please add a keyword.' };
        }

        if (normalizedMaxPrice !== null && (Number.isNaN(normalizedMaxPrice) || normalizedMaxPrice < 0)) {
            return { success: false, message: 'Please enter a valid max price.' };
        }

        if (canUseSupabase()) {
            const client = getClient();
            const { data, error } = await client
                .from('wishlists')
                .insert({
                    user_id: userId,
                    keyword: normalizedKeyword,
                    category: normalizedCategory,
                    max_price: normalizedMaxPrice
                })
                .select('*')
                .single();
            if (!error) {
                return { success: true, entry: data };
            }
            console.warn('[DormGlide] Falling back to local wishlist entries insert:', error);
        }

        const local = readLocal(LOCAL_WISHLIST_ENTRIES_KEY, []);
        const next = Array.isArray(local) ? local : [];
        const entry = {
            id: randomId('wishlist-entry'),
            user_id: userId,
            keyword: normalizedKeyword,
            category: normalizedCategory,
            max_price: normalizedMaxPrice,
            created_at: nowIso()
        };
        next.push(entry);
        writeLocal(LOCAL_WISHLIST_ENTRIES_KEY, next);
        return { success: true, entry };
    };

    const deleteWishlistEntry = async ({ userId, entryId }) => {
        if (!userId || !entryId) {
            return { success: false, message: 'Missing wishlist entry.' };
        }

        if (canUseSupabase()) {
            const client = getClient();
            const { error } = await client
                .from('wishlists')
                .delete()
                .eq('id', entryId)
                .eq('user_id', userId);
            if (!error) {
                return { success: true };
            }
            console.warn('[DormGlide] Falling back to local wishlist entries delete:', error);
        }

        const local = readLocal(LOCAL_WISHLIST_ENTRIES_KEY, []);
        const next = (Array.isArray(local) ? local : []).filter((entry) => !(entry?.id === entryId && entry?.user_id === userId));
        writeLocal(LOCAL_WISHLIST_ENTRIES_KEY, next);
        return { success: true };
    };

    const fetchWishlistListings = async (userId, allListings = []) => {
        const listingIds = await fetchWishlistListingIds(userId);
        const lookup = new Map((Array.isArray(allListings) ? allListings : []).map((listing) => [listing.id, listing]));
        return listingIds.map((id) => lookup.get(id)).filter(Boolean);
    };

    const fetchKeywordAlerts = async (userId) => {
        if (!userId) return [];

        if (canUseSupabase()) {
            const client = getClient();
            const { data, error } = await client
                .from('keyword_alerts')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (!error) {
                return data || [];
            }
            console.warn('[DormGlide] Falling back to local keyword alerts:', error);
        }

        const local = readLocal(LOCAL_KEYWORD_ALERTS_KEY, []);
        return (Array.isArray(local) ? local : [])
            .filter((entry) => entry?.user_id === userId)
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    };

    const addKeywordAlert = async ({ userId, keyword, notifyInApp = true, notifyEmail = true }) => {
        const normalizedKeyword = normalizeKeyword(keyword);
        if (!userId || !normalizedKeyword) {
            return { success: false, message: 'Please enter a keyword.' };
        }

        const existing = await fetchKeywordAlerts(userId);
        if (existing.some((entry) => normalizeKeyword(entry.keyword) === normalizedKeyword)) {
            return { success: false, message: 'You already have this keyword alert.' };
        }

        if (canUseSupabase()) {
            const client = getClient();
            const { data, error } = await client
                .from('keyword_alerts')
                .insert({
                    user_id: userId,
                    keyword: normalizedKeyword,
                    notify_in_app: Boolean(notifyInApp),
                    notify_email: Boolean(notifyEmail)
                })
                .select('*')
                .single();
            if (!error) {
                return { success: true, alert: data };
            }
            console.warn('[DormGlide] Falling back to local keyword alerts insert:', error);
        }

        const local = readLocal(LOCAL_KEYWORD_ALERTS_KEY, []);
        const next = Array.isArray(local) ? local : [];
        const record = {
            id: randomId('alert'),
            user_id: userId,
            keyword: normalizedKeyword,
            notify_in_app: Boolean(notifyInApp),
            notify_email: Boolean(notifyEmail),
            created_at: nowIso()
        };
        next.push(record);
        writeLocal(LOCAL_KEYWORD_ALERTS_KEY, next);
        return { success: true, alert: record };
    };

    const deleteKeywordAlert = async ({ userId, alertId }) => {
        if (!userId || !alertId) return { success: false, message: 'Missing alert.' };

        if (canUseSupabase()) {
            const client = getClient();
            const { error } = await client
                .from('keyword_alerts')
                .delete()
                .eq('id', alertId)
                .eq('user_id', userId);
            if (!error) {
                return { success: true };
            }
            console.warn('[DormGlide] Falling back to local keyword alert delete:', error);
        }

        const local = readLocal(LOCAL_KEYWORD_ALERTS_KEY, []);
        const next = (Array.isArray(local) ? local : []).filter((entry) => !(entry?.id === alertId && entry?.user_id === userId));
        writeLocal(LOCAL_KEYWORD_ALERTS_KEY, next);
        return { success: true };
    };

    const createNotification = async ({ userId, type = 'wishlist_match', title = 'DormGlide notification', message, listingId, keyword = null }) => {
        if (!userId || !message) return null;

        if (canUseSupabase()) {
            const client = getClient();
            const { data, error } = await client
                .from('notifications')
                .insert({
                    user_id: userId,
                    type,
                    title,
                    message,
                    listing_id: listingId || null,
                    is_read: false
                })
                .select('*')
                .single();
            if (!error) {
                return data;
            }
            console.warn('[DormGlide] Falling back to local notification insert:', error);
        }

        const local = readLocal(LOCAL_NOTIFICATIONS_KEY, []);
        const next = Array.isArray(local) ? local : [];
        const record = {
            id: randomId('notif'),
            user_id: userId,
            type,
            title,
            message,
            listing_id: listingId || null,
            keyword,
            is_read: false,
            created_at: nowIso()
        };
        next.push(record);
        writeLocal(LOCAL_NOTIFICATIONS_KEY, next);
        return record;
    };

    const fetchNotifications = async ({ userId, limit = 8 }) => {
        if (!userId) return [];

        if (canUseSupabase()) {
            const client = getClient();
            const { data, error } = await client
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (!error) {
                return data || [];
            }
            console.warn('[DormGlide] Falling back to local notifications fetch:', error);
        }

        const local = readLocal(LOCAL_NOTIFICATIONS_KEY, []);
        return (Array.isArray(local) ? local : [])
            .filter((entry) => entry?.user_id === userId)
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
            .slice(0, limit);
    };

    const getUnreadNotificationCount = async (userId) => {
        if (!userId) return 0;

        if (canUseSupabase()) {
            const client = getClient();
            const { count, error } = await client
                .from('notifications')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('is_read', false);
            if (!error) {
                return Number(count || 0);
            }
            console.warn('[DormGlide] Falling back to local unread count:', error);
        }

        const local = readLocal(LOCAL_NOTIFICATIONS_KEY, []);
        return (Array.isArray(local) ? local : []).filter((entry) => entry?.user_id === userId && !entry?.is_read).length;
    };

    const markNotificationsRead = async ({ userId, notificationIds = [] }) => {
        if (!userId) return;

        if (canUseSupabase()) {
            const client = getClient();
            let query = client
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', userId)
                .eq('is_read', false);

            if (Array.isArray(notificationIds) && notificationIds.length > 0) {
                query = query.in('id', notificationIds);
            }

            const { error } = await query;
            if (!error) {
                return;
            }
            console.warn('[DormGlide] Falling back to local mark-read:', error);
        }

        const idSet = new Set(Array.isArray(notificationIds) ? notificationIds : []);
        const local = readLocal(LOCAL_NOTIFICATIONS_KEY, []);
        const next = (Array.isArray(local) ? local : []).map((entry) => {
            if (entry?.user_id !== userId || entry?.is_read) return entry;
            if (idSet.size > 0 && !idSet.has(entry.id)) return entry;
            return { ...entry, is_read: true };
        });
        writeLocal(LOCAL_NOTIFICATIONS_KEY, next);
    };

    const markNotificationRead = async ({ userId, notificationId }) => {
        if (!userId || !notificationId) return;
        return markNotificationsRead({ userId, notificationIds: [notificationId] });
    };

    const keywordMatchesListing = (keyword, listing) => {
        const normalizedKeyword = normalizeKeyword(keyword);
        if (!normalizedKeyword) return false;
        const haystack = `${listing?.title || ''} ${listing?.description || ''}`.toLowerCase();
        return haystack.includes(normalizedKeyword);
    };

    const postNotificationWebhook = async (payload) => {
        const url = String(window.DORMGLIDE_NOTIFICATION_WEBHOOK_URL || '').trim();
        if (!url) return;

        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.warn('[DormGlide] Notification webhook request failed:', error);
        }
    };

    const processListingKeywordAlerts = async (listing) => {
        if (!listing?.id) return { matches: 0 };

        if (!canUseSupabase()) {
            const alerts = readLocal(LOCAL_KEYWORD_ALERTS_KEY, []);
            const matches = [];

            (Array.isArray(alerts) ? alerts : []).forEach((alert) => {
                if (!alert?.user_id || !alert?.keyword) return;
                if (!keywordMatchesListing(alert.keyword, listing)) return;
                matches.push(alert);
            });

            for (const alert of matches) {
                const message = `A new listing matches your alert: "${alert.keyword}" - ${listing.title} $${listing.price}`;
                if (alert.notify_in_app !== false) {
                    await createNotification({
                        userId: alert.user_id,
                        message,
                        listingId: listing.id,
                        keyword: alert.keyword
                    });
                }
                if (alert.notify_email !== false) {
                    await postNotificationWebhook({
                        event: 'keyword_match',
                        userId: alert.user_id,
                        keyword: alert.keyword,
                        listing: {
                            id: listing.id,
                            title: listing.title,
                            price: listing.price,
                            description: String(listing.description || '').slice(0, 240),
                            link: 'https://dormglide.com/app.html'
                        },
                        subject: `New DormGlide match: ${alert.keyword}`
                    });
                }
            }

            return { matches: matches.length };
        }

        // In Supabase mode with strict RLS, keyword matching should run server-side.
        // We notify the webhook with the new listing payload so your edge layer can fan out emails.
        await postNotificationWebhook({
            event: 'listing_created',
            listing: {
                id: listing.id,
                title: listing.title,
                price: listing.price,
                description: String(listing.description || '').slice(0, 240),
                sellerId: listing.sellerId,
                category: listing.category,
                link: 'https://dormglide.com/app.html'
            }
        });

        return { matches: 0 };
    };

    const getViewHistory = () => {
        const history = readLocal(VIEW_HISTORY_KEY, {});
        return history && typeof history === 'object' ? history : {};
    };

    const saveViewHistory = (history) => {
        writeLocal(VIEW_HISTORY_KEY, history || {});
    };

    const recordProductView = ({ userId, listing }) => {
        if (!userId || !listing?.id) return;

        const history = getViewHistory();
        const userHistory = history[userId] || {
            recent: [],
            categories: {}
        };

        const recent = (Array.isArray(userHistory.recent) ? userHistory.recent : []).filter((entry) => entry?.listingId !== listing.id);
        recent.unshift({
            listingId: listing.id,
            category: listing.category || 'Other',
            viewedAt: nowIso()
        });

        const categories = { ...(userHistory.categories || {}) };
        const categoryKey = String(listing.category || 'Other');
        categories[categoryKey] = Number(categories[categoryKey] || 0) + 1;

        history[userId] = {
            recent: recent.slice(0, 30),
            categories
        };

        saveViewHistory(history);
    };

    const getMostViewedCategories = ({ userId, limit = 3 }) => {
        if (!userId) return [];
        const history = getViewHistory();
        const categories = history?.[userId]?.categories || {};
        return Object.entries(categories)
            .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
            .slice(0, limit)
            .map(([name]) => name);
    };

    const getRecentlyViewedListingIds = ({ userId, limit = 6 }) => {
        if (!userId) return [];
        const history = getViewHistory();
        const recent = history?.[userId]?.recent || [];
        return (Array.isArray(recent) ? recent : [])
            .slice(0, limit)
            .map((entry) => entry?.listingId)
            .filter(Boolean);
    };

    window.DormGlidePersonalization = {
        fetchWishlistListingIds,
        isListingWishlisted,
        toggleWishlist,
        fetchWishlistListings,
        fetchWishlistEntries,
        addWishlistEntry,
        deleteWishlistEntry,
        fetchKeywordAlerts,
        addKeywordAlert,
        deleteKeywordAlert,
        fetchNotifications,
        getUnreadNotificationCount,
        markNotificationsRead,
        markNotificationRead,
        createNotification,
        processListingKeywordAlerts,
        recordProductView,
        getMostViewedCategories,
        getRecentlyViewedListingIds
    };
})();
