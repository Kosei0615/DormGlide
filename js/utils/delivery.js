// Campus Delivery (Glyde): a student courier takes orders from students on the
// same campus. The customer has already ordered and paid the vendor; the courier
// picks up and delivers for a flat fee paid in person.
//
// Everything that must be trusted (fee, status transitions, expiry, who may
// change what) lives in the database (migration 22). This file is the thin
// client: queries, realtime, and the availability math for the hours UI.
(function () {
    const client = () => window.SupabaseClient || null;

    const STATUS_LABELS = {
        pending: 'Waiting for the courier to accept',
        accepted: 'Accepted — heading to pick up',
        picked_up: 'Picked up',
        on_the_way: 'On the way to you',
        delivered: 'Delivered',
        declined: 'Declined',
        expired: 'Expired (no answer in time)',
        cancelled: 'Cancelled'
    };
    const ACTIVE_STATUSES = ['pending', 'accepted', 'picked_up', 'on_the_way'];
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const normalizeProvider = (row) => row && ({
        id: row.id, userId: row.user_id, schoolId: row.school_id,
        displayName: row.display_name || 'Campus Delivery', blurb: row.blurb || '',
        isActive: row.is_active !== false, isOnline: Boolean(row.is_online),
        feeCents: Number(row.fee_cents || 0),
        schedule: Array.isArray(row.schedule) ? row.schedule : [],
        preorderMinutes: Number(row.preorder_minutes ?? 60),
        confirmMinutes: Number(row.confirm_minutes ?? 10),
        pickupSpots: Array.isArray(row.pickup_spots) ? row.pickup_spots : [],
        timezone: row.timezone || 'America/New_York',
        photoUrl: row.photo_url || '', videoUrl: row.video_url || '', sortOrder: Number(row.sort_order || 0),
        updatedAt: row.updated_at
    });
    const normalizeOrder = (row) => row && ({
        id: row.id, providerId: row.provider_id, customerId: row.customer_id, status: row.status,
        pickupSpot: row.pickup_spot, orderRef: row.order_ref || '', items: row.items, deliverTo: row.deliver_to,
        notes: row.notes || '', requestedFor: row.requested_for, feeCents: Number(row.fee_cents || 0),
        expiresAt: row.expires_at, decidedAt: row.decided_at, pickedUpAt: row.picked_up_at, deliveredAt: row.delivered_at,
        cancelledBy: row.cancelled_by, createdAt: row.created_at, updatedAt: row.updated_at
    });

    const formatFee = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

    // ---- time helpers (all in the provider's campus timezone) ----------------
    const partsInTz = (date, tz) => {
        const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const o = {}; f.formatToParts(date).forEach((p) => { o[p.type] = p.value; });
        return { dow: DAYS.indexOf(o.weekday), y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute };
    };
    // Wall-clock time in tz -> real instant (good enough across DST for a campus schedule)
    const zonedToUtc = (y, m, d, h, mi, tz) => {
        const guess = Date.UTC(y, m - 1, d, h, mi);
        const p = partsInTz(new Date(guess), tz);
        const wall = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
        return new Date(guess - (wall - guess));
    };
    const hm = (s) => { const [h, m] = String(s || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
    const fmtTime = (date, tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(date);
    const fmtDay = (date, tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);

    const fmt12 = (hhmm) => { const [h, m] = String(hhmm || '').split(':').map(Number); if (Number.isNaN(h)) return hhmm; const ap = h >= 12 ? 'PM' : 'AM'; const hh = ((h + 11) % 12) + 1; return `${hh}:${String(m || 0).padStart(2, '0')} ${ap}`; };
    const windowLabel = (w) => `${fmt12(w.start)}–${fmt12(w.end)}`;

    // Hours are a description for customers; the Online switch decides whether
    // orders are accepted. "Today" follows the campus date.
    const todayHours = (provider, now = new Date()) => {
        const p = partsInTz(now, provider.timezone);
        return provider.schedule.filter((w) => w && w.dow === p.dow).map(windowLabel);
    };
    const nextWindowStart = (provider, now = new Date()) => {
        const tz = provider.timezone; const p = partsInTz(now, tz); const nowMin = p.h * 60 + p.mi;
        const windows = provider.schedule.filter((w) => w && typeof w.dow === 'number');
        for (let off = 0; off < 8; off += 1) {
            const dp = partsInTz(new Date(now.getTime() + off * 86400000), tz);
            const cands = windows.filter((w) => w.dow === dp.dow && (off > 0 || hm(w.start) > nowMin)).sort((a, b) => hm(a.start) - hm(b.start));
            if (cands.length) return zonedToUtc(dp.y, dp.m, dp.d, Math.floor(hm(cands[0].start) / 60), hm(cands[0].start) % 60, tz);
        }
        return null;
    };
    // { state: 'open' | 'preorder' | 'closed', label, nextStart?, today: [] }
    const getAvailability = (provider, now = new Date()) => {
        if (!provider || !provider.isActive) return { state: 'closed', label: 'Not taking orders', today: [] };
        const tz = provider.timezone; const today = todayHours(provider, now);
        if (provider.isOnline) {
            return { state: 'open', today, label: today.length ? `Online now · today ${today.join(', ')}` : 'Online now · taking orders' };
        }
        const nextStart = nextWindowStart(provider, now);
        if (nextStart) {
            const minsUntil = (nextStart - now) / 60000;
            const sameDay = partsInTz(nextStart, tz).d === partsInTz(now, tz).d;
            const when = (sameDay ? '' : `${fmtDay(nextStart, tz)} `) + fmtTime(nextStart, tz);
            if (minsUntil <= provider.preorderMinutes) return { state: 'preorder', nextStart, today, label: `Offline · opens ${when} · preorder now` };
            return { state: 'closed', nextStart, today, label: `Offline · usually back ${when}` };
        }
        return { state: 'closed', today, label: 'Offline right now' };
    };

    const scheduleSummary = (provider) => {
        const byDay = {};
        provider.schedule.forEach((w) => { (byDay[w.dow] = byDay[w.dow] || []).push(windowLabel(w)); });
        return DAYS.map((d, i) => byDay[i] ? `${d} ${byDay[i].join(', ')}` : null).filter(Boolean).join(' · ');
    };

    // ---- queries ------------------------------------------------------------
    const fetchProviders = async () => {
        const c = client(); if (!c) return [];
        const { data, error } = await c.from('delivery_providers').select('*').eq('is_active', true).order('sort_order').order('created_at');
        if (error) { console.warn('[DormGlide] delivery providers fetch failed:', error); return []; }
        return (data || []).map(normalizeProvider);
    };
    const fetchMyProvider = async (userId) => {
        const c = client(); if (!c || !userId) return null;
        const { data, error } = await c.from('delivery_providers').select('*').eq('user_id', userId).maybeSingle();
        if (error) { console.warn('[DormGlide] my provider fetch failed:', error); return null; }
        return data ? normalizeProvider(data) : null;
    };
    const updateProvider = async (providerId, patch) => {
        const c = client(); if (!c) return { success: false, message: 'Needs a live connection.' };
        const payload = {};
        if ('isOnline' in patch) payload.is_online = Boolean(patch.isOnline);
        if ('displayName' in patch) payload.display_name = String(patch.displayName || '').trim().slice(0, 60) || 'Campus Delivery';
        if ('blurb' in patch) payload.blurb = String(patch.blurb || '').trim().slice(0, 200) || null;
        if ('feeCents' in patch) payload.fee_cents = Math.max(0, Math.min(5000, Math.round(Number(patch.feeCents) || 0)));
        if ('schedule' in patch) payload.schedule = patch.schedule;
        if ('preorderMinutes' in patch) payload.preorder_minutes = Math.max(0, Math.min(240, Number(patch.preorderMinutes) || 0));
        if ('photoUrl' in patch) payload.photo_url = String(patch.photoUrl || '').trim().slice(0, 400) || null;
        if ('videoUrl' in patch) payload.video_url = String(patch.videoUrl || '').trim().slice(0, 400) || null;
        if ('pickupSpots' in patch) payload.pickup_spots = patch.pickupSpots.map((s) => String(s).trim().slice(0, 60)).filter(Boolean).slice(0, 12);
        const { data, error } = await c.from('delivery_providers').update(payload).eq('id', providerId).select('*').single();
        if (error) { console.error('[DormGlide] provider update failed:', error); return { success: false, message: error.message }; }
        return { success: true, provider: normalizeProvider(data) };
    };
    const createOrder = async ({ providerId, customerId, pickupSpot, orderRef, items, deliverTo, notes, requestedFor }) => {
        const c = client(); if (!c) return { success: false, message: 'Ordering needs a live connection.' };
        const { data, error } = await c.from('delivery_orders').insert({
            provider_id: providerId, customer_id: customerId, pickup_spot: pickupSpot, order_ref: orderRef || null,
            items, deliver_to: deliverTo, notes: notes || null, requested_for: requestedFor || null
        }).select('*').single();
        if (error) { console.error('[DormGlide] delivery order failed:', error); return { success: false, message: error.message || 'Could not place the order.' }; }
        return { success: true, order: normalizeOrder(data) };
    };
    const fetchMyOrders = async (customerId) => {
        const c = client(); if (!c || !customerId) return [];
        const { data, error } = await c.from('delivery_orders').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(50);
        if (error) { console.warn('[DormGlide] my delivery orders fetch failed:', error); return []; }
        return (data || []).map(normalizeOrder);
    };
    const fetchProviderOrders = async (providerId) => {
        const c = client(); if (!c || !providerId) return [];
        const { data, error } = await c.from('delivery_orders').select('*').eq('provider_id', providerId).order('created_at', { ascending: false }).limit(100);
        if (error) { console.warn('[DormGlide] provider orders fetch failed:', error); return []; }
        return (data || []).map(normalizeOrder);
    };
    const updateOrderStatus = async (orderId, status) => {
        const c = client(); if (!c) return { success: false, message: 'Needs a live connection.' };
        const { data, error } = await c.from('delivery_orders').update({ status }).eq('id', orderId).select('*').single();
        if (error) { console.error('[DormGlide] order status update failed:', error); return { success: false, message: error.message }; }
        return { success: true, order: normalizeOrder(data) };
    };
    // Realtime: any change to orders or providers the current user may see (RLS applies)
    const subscribe = (onChange) => {
        const c = client(); if (!c?.channel) return () => {};
        const ch = c.channel('dormglide-delivery')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_orders' }, (payload) => onChange({ table: 'orders', row: normalizeOrder(payload.new || payload.old) }))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_providers' }, (payload) => onChange({ table: 'providers', row: normalizeProvider(payload.new || payload.old) }))
            .subscribe();
        return () => { try { c.removeChannel(ch); } catch (_e) { /* noop */ } };
    };

    // Founder-only (DB-gated by admin_users): per-courier numbers + console links.
    const fetchAdminSummary = async () => {
        const c = client(); if (!c) return null;
        const { data, error } = await c.rpc('delivery_admin_summary');
        if (error) { console.warn('[DormGlide] delivery_admin_summary:', error.message); return null; }
        return data || null;
    };
    const issueConsoleKey = async (providerId) => {
        const c = client(); if (!c) return null;
        const { data, error } = await c.rpc('delivery_console_key_issue', { p_provider: providerId });
        if (error) { console.warn('[DormGlide] delivery_console_key_issue:', error.message); return null; }
        return data || null;
    };
    const rotateConsoleKey = async (providerId) => {
        const c = client(); if (!c) return null;
        const { data, error } = await c.rpc('delivery_console_key_rotate', { p_provider: providerId });
        if (error) { console.warn('[DormGlide] delivery_console_key_rotate:', error.message); return null; }
        return data || null;
    };

    window.DormGlideDelivery = {
        STATUS_LABELS, ACTIVE_STATUSES, DAYS,
        fetchAdminSummary, issueConsoleKey, rotateConsoleKey,
        formatFee, getAvailability, scheduleSummary, todayHours, fmt12, fmtTime, fmtDay,
        fetchProviders, fetchMyProvider, updateProvider,
        createOrder, fetchMyOrders, fetchProviderOrders, updateOrderStatus, subscribe
    };
})();
