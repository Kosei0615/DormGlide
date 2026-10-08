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

    // Returns the courier's availability right now:
    //  { state: 'open' | 'preorder' | 'offline' | 'closed', windowEnd?, nextStart?, label }
    const getAvailability = (provider, now = new Date()) => {
        if (!provider || !provider.isActive) return { state: 'closed', label: 'Not taking orders' };
        const tz = provider.timezone; const p = partsInTz(now, tz); const nowMin = p.h * 60 + p.mi;
        const windows = provider.schedule.filter((w) => w && typeof w.dow === 'number');
        const today = windows.filter((w) => w.dow === p.dow && hm(w.start) <= nowMin && nowMin < hm(w.end));
        if (today.length) {
            const w = today[0]; const end = zonedToUtc(p.y, p.m, p.d, Math.floor(hm(w.end) / 60), hm(w.end) % 60, tz);
            if (provider.isOnline) return { state: 'open', windowEnd: end, label: `Open now · until ${fmtTime(end, tz)}` };
            return { state: 'offline', windowEnd: end, label: 'Off right now · back soon' };
        }
        // next window within 7 days
        for (let off = 0; off < 8; off += 1) {
            const dayDate = new Date(now.getTime() + off * 86400000); const dp = partsInTz(dayDate, tz);
            const cands = windows.filter((w) => w.dow === dp.dow && (off > 0 || hm(w.start) > nowMin)).sort((a, b) => hm(a.start) - hm(b.start));
            if (cands.length) {
                const w = cands[0]; const start = zonedToUtc(dp.y, dp.m, dp.d, Math.floor(hm(w.start) / 60), hm(w.start) % 60, tz);
                const minsUntil = (start - now) / 60000;
                const when = (off === 0 ? '' : `${fmtDay(start, tz)} `) + fmtTime(start, tz);
                if (minsUntil <= provider.preorderMinutes) return { state: 'preorder', nextStart: start, label: `Opens ${when} · preorder now` };
                return { state: 'closed', nextStart: start, label: `Closed · opens ${when}` };
            }
        }
        return { state: 'closed', label: 'No hours set yet' };
    };

    const scheduleSummary = (provider) => {
        const byDay = {};
        provider.schedule.forEach((w) => { (byDay[w.dow] = byDay[w.dow] || []).push(`${w.start}–${w.end}`); });
        return DAYS.map((d, i) => byDay[i] ? `${d} ${byDay[i].join(', ')}` : null).filter(Boolean).join(' · ');
    };

    // ---- queries ------------------------------------------------------------
    const fetchProviders = async () => {
        const c = client(); if (!c) return [];
        const { data, error } = await c.from('delivery_providers').select('*').eq('is_active', true).order('created_at');
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

    window.DormGlideDelivery = {
        STATUS_LABELS, ACTIVE_STATUSES, DAYS,
        formatFee, getAvailability, scheduleSummary, fmtTime, fmtDay,
        fetchProviders, fetchMyProvider, updateProvider,
        createOrder, fetchMyOrders, fetchProviderOrders, updateOrderStatus, subscribe
    };
})();
