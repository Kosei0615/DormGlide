// Campus Delivery page. Two faces on one route:
//  - customers: courier status, order form, live tracking of their orders
//  - the courier (a delivery_providers row for this user): online toggle,
//    incoming orders with a confirm countdown, status buttons, settings
const DeliveryPage = ({ currentUser, onNavigate, onShowAuth }) => {
    const D = window.DormGlideDelivery;
    const toast = window.DormGlideToast || { success: () => {}, error: () => {}, info: () => {}, warning: () => {} };
    const [providers, setProviders] = React.useState([]);
    const [myProvider, setMyProvider] = React.useState(null);
    const [myOrders, setMyOrders] = React.useState([]);
    const [providerOrders, setProviderOrders] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [tick, setTick] = React.useState(0);
    const [view, setView] = React.useState('auto'); // 'auto' | 'order' | 'console'

    const load = React.useCallback(async () => {
        if (!D || !currentUser?.id) { setLoading(false); return; }
        const [list, mine, orders] = await Promise.all([D.fetchProviders(), D.fetchMyProvider(currentUser.id), D.fetchMyOrders(currentUser.id)]);
        setProviders(list); setMyProvider(mine); setMyOrders(orders);
        if (mine) setProviderOrders(await D.fetchProviderOrders(mine.id));
        setLoading(false);
    }, [currentUser?.id]);

    React.useEffect(() => { load(); }, [load]);
    React.useEffect(() => {
        if (!D || !currentUser?.id) return undefined;
        const unsub = D.subscribe(() => load());
        const timer = setInterval(() => setTick((t) => t + 1), 15000);
        return () => { unsub(); clearInterval(timer); };
    }, [currentUser?.id, load]);

    if (!currentUser) {
        return React.createElement('div', { className: 'delivery-page' },
            React.createElement('div', { className: 'delivery-empty' },
                React.createElement('h2', null, '🛼 Campus Delivery'),
                React.createElement('p', null, 'Log in with your school email to order a delivery from a student courier.'),
                React.createElement('button', { className: 'btn btn-primary', onClick: () => onShowAuth?.('login') }, 'Log in')));
    }
    if (loading) return React.createElement('div', { className: 'delivery-page' }, React.createElement('p', { className: 'delivery-muted' }, 'Loading…'));

    const showConsole = myProvider && view !== 'order';
    return React.createElement('div', { className: 'delivery-page' },
        React.createElement('div', { className: 'delivery-head' },
            React.createElement('button', { className: 'btn btn-outline delivery-back', onClick: () => onNavigate('home') }, '← Back'),
            React.createElement('h1', null, '🛼 Campus Delivery'),
            myProvider && React.createElement('div', { className: 'delivery-viewswitch' },
                React.createElement('button', { className: `tab ${showConsole ? 'active' : ''}`, onClick: () => setView('console') }, 'My courier console'),
                React.createElement('button', { className: `tab ${!showConsole ? 'active' : ''}`, onClick: () => setView('order') }, 'Order as a customer'))),
        showConsole
            ? React.createElement(DeliveryConsole, { provider: myProvider, orders: providerOrders, onProviderChange: setMyProvider, reload: load, tick })
            : React.createElement(DeliveryCustomer, { providers, orders: myOrders, currentUser, reload: load, tick }));
};

// ---------------------------------------------------------------------------
// Customer side
// ---------------------------------------------------------------------------
const DeliveryCustomer = ({ providers, orders, currentUser, reload, tick }) => {
    const D = window.DormGlideDelivery;
    const toast = window.DormGlideToast || { success: () => {}, error: () => {}, info: () => {} };
    const [chosenId, setChosenId] = React.useState(null);
    const provider = providers.find((p) => p.id === chosenId) || providers[0] || null;
    const avail = provider ? D.getAvailability(provider) : null;
    const [form, setForm] = React.useState({ pickupSpot: '', orderRef: '', items: '', deliverTo: '', notes: '' });
    const [submitting, setSubmitting] = React.useState(false);
    React.useEffect(() => { if (provider && !form.pickupSpot && provider.pickupSpots[0]) setForm((f) => ({ ...f, pickupSpot: provider.pickupSpots[0] })); }, [provider?.id]);

    if (!provider) {
        return React.createElement('div', { className: 'delivery-empty' },
            React.createElement('p', null, 'No campus courier is signed up yet. Check back soon.'));
    }
    const canOrder = avail.state === 'open' || avail.state === 'preorder';
    const active = orders.filter((o) => D.ACTIVE_STATUSES.includes(o.status));
    const past = orders.filter((o) => !D.ACTIVE_STATUSES.includes(o.status)).slice(0, 10);

    const submit = async (e) => {
        e.preventDefault();
        if (!canOrder || submitting) return;
        if (!form.items.trim() || !form.deliverTo.trim() || !form.pickupSpot) { toast.error('Pickup spot, what to pick up, and where to deliver are required.'); return; }
        setSubmitting(true);
        const result = await D.createOrder({
            providerId: provider.id, customerId: currentUser.id, pickupSpot: form.pickupSpot, orderRef: form.orderRef,
            items: form.items, deliverTo: form.deliverTo, notes: form.notes,
            requestedFor: avail.state === 'preorder' ? avail.nextStart.toISOString() : null
        });
        setSubmitting(false);
        if (!result.success) { toast.error(result.message || 'Could not place the order.'); return; }
        toast.success(`Order sent. ${provider.displayName} has ${provider.confirmMinutes} minutes to accept.`);
        setForm((f) => ({ ...f, orderRef: '', items: '', deliverTo: '', notes: '' }));
        reload();
    };
    const cancel = async (order) => {
        const r = await D.updateOrderStatus(order.id, 'cancelled');
        if (!r.success) toast.error(r.message || 'Could not cancel.'); else { toast.info('Order cancelled.'); reload(); }
    };

    return React.createElement(React.Fragment, null,
        providers.length > 1 && React.createElement('div', { className: 'delivery-chooser' },
            providers.map((p) => { const a = D.getAvailability(p); return React.createElement('button', {
                key: p.id, className: `delivery-choice ${p.id === provider.id ? 'active' : ''}`, onClick: () => setChosenId(p.id)
            }, p.photoUrl && React.createElement('img', { src: p.photoUrl, alt: '' }),
               React.createElement('span', { className: 'delivery-choice-name' }, p.displayName),
               React.createElement('span', { className: `delivery-pill is-${a.state}` }, a.label)); })),
        React.createElement('section', { className: 'delivery-card delivery-provider' },
            (provider.videoUrl || provider.photoUrl) && React.createElement('div', { className: 'delivery-media' },
                provider.videoUrl
                    ? React.createElement('video', { src: provider.videoUrl, poster: provider.photoUrl || undefined, controls: true, playsInline: true, muted: true, loop: true, autoPlay: true })
                    : React.createElement('img', { src: provider.photoUrl, alt: provider.displayName })),
            React.createElement('div', { className: 'delivery-provider-head' },
                React.createElement('div', null,
                    React.createElement('h2', null, provider.displayName),
                    provider.blurb && React.createElement('p', { className: 'delivery-muted' }, provider.blurb)),
                React.createElement('span', { className: `delivery-pill is-${avail.state}` }, avail.label)),
            React.createElement('p', { className: 'delivery-hours' }, '🕒 ', D.scheduleSummary(provider) || 'Hours not set yet'),
            React.createElement('p', { className: 'delivery-hours' }, '💵 Delivery fee ', React.createElement('strong', null, D.formatFee(provider.feeCents)), ', paid in person at delivery')),

        active.length > 0 && React.createElement('section', { className: 'delivery-card' },
            React.createElement('h3', null, 'Your current delivery'),
            active.map((o) => React.createElement(DeliveryOrderRow, { key: o.id, order: o, provider, role: 'customer', onCancel: cancel, tick }))),

        React.createElement('section', { className: 'delivery-card' },
            React.createElement('h3', null, canOrder ? (avail.state === 'preorder' ? `Preorder for ${D.fmtTime(avail.nextStart, provider.timezone)}` : 'Order a delivery') : 'Ordering is closed right now'),
            !canOrder && React.createElement('p', { className: 'delivery-muted' }, avail.state === 'offline'
                ? `${provider.displayName} is off right now. Preordering opens ${provider.preorderMinutes} minutes before the next window.`
                : `${avail.label}. Preordering opens ${provider.preorderMinutes} minutes before each window.`),
            React.createElement('form', { className: 'delivery-form', onSubmit: submit },
                React.createElement('label', null, 'Pick up from',
                    React.createElement('select', { value: form.pickupSpot, onChange: (e) => setForm({ ...form, pickupSpot: e.target.value }), disabled: !canOrder },
                        provider.pickupSpots.map((s) => React.createElement('option', { key: s, value: s }, s)))),
                React.createElement('label', null, 'Order number (if you already ordered)',
                    React.createElement('input', { type: 'text', value: form.orderRef, placeholder: 'e.g. 4821', maxLength: 60, disabled: !canOrder, onChange: (e) => setForm({ ...form, orderRef: e.target.value }) })),
                React.createElement('label', null, 'What to pick up *',
                    React.createElement('input', { type: 'text', value: form.items, placeholder: 'e.g. Iced matcha latte, sea-salt chips', maxLength: 300, disabled: !canOrder, onChange: (e) => setForm({ ...form, items: e.target.value }) })),
                React.createElement('label', null, 'Deliver to *',
                    React.createElement('input', { type: 'text', value: form.deliverTo, placeholder: 'Building + room, or a spot like "Library front steps"', maxLength: 160, disabled: !canOrder, onChange: (e) => setForm({ ...form, deliverTo: e.target.value }) })),
                React.createElement('label', null, 'Notes (optional)',
                    React.createElement('input', { type: 'text', value: form.notes, placeholder: 'e.g. text me when you arrive', maxLength: 300, disabled: !canOrder, onChange: (e) => setForm({ ...form, notes: e.target.value }) })),
                React.createElement('div', { className: 'delivery-terms' },
                    React.createElement('strong', null, `Fee ${D.formatFee(provider.feeCents)}`), ' — paid to the courier in person at delivery. ',
                    'You order and pay the vendor yourself. The courier is an independent student. ',
                    React.createElement('em', null, 'Pay at delivery, in person, never before.')),
                React.createElement('button', { className: 'btn btn-primary delivery-submit', type: 'submit', disabled: !canOrder || submitting },
                    submitting ? 'Sending…' : (avail.state === 'preorder' ? 'Place preorder' : 'Request delivery')))),

        past.length > 0 && React.createElement('section', { className: 'delivery-card' },
            React.createElement('h3', null, 'Past deliveries'),
            past.map((o) => React.createElement(DeliveryOrderRow, { key: o.id, order: o, provider, role: 'customer', tick }))));
};

// ---------------------------------------------------------------------------
// Courier console
// ---------------------------------------------------------------------------
const DeliveryConsole = ({ provider, orders, onProviderChange, reload, tick }) => {
    const D = window.DormGlideDelivery;
    const toast = window.DormGlideToast || { success: () => {}, error: () => {}, info: () => {} };
    const avail = D.getAvailability(provider);
    const [saving, setSaving] = React.useState(false);
    const [showSettings, setShowSettings] = React.useState(provider.schedule.length === 0);
    const [settings, setSettings] = React.useState(() => ({
        displayName: provider.displayName, blurb: provider.blurb, fee: (provider.feeCents / 100).toFixed(2),
        preorderMinutes: provider.preorderMinutes, pickupSpots: provider.pickupSpots.join(', '),
        photoUrl: provider.photoUrl || '', videoUrl: provider.videoUrl || '',
        days: D.DAYS.map((_, i) => { const w = provider.schedule.find((x) => x.dow === i); return { on: Boolean(w), start: w?.start || '11:00', end: w?.end || '20:00' }; })
    }));

    const toggleOnline = async () => {
        const r = await D.updateProvider(provider.id, { isOnline: !provider.isOnline });
        if (!r.success) { toast.error(r.message || 'Could not update.'); return; }
        onProviderChange(r.provider); toast.info(r.provider.isOnline ? 'You are online. Orders can come in.' : 'You are offline. Only preorders for your next window are possible.');
    };
    const saveSettings = async () => {
        setSaving(true);
        const schedule = settings.days.map((d, i) => d.on ? { dow: i, start: d.start, end: d.end } : null).filter(Boolean).filter((w) => w.start < w.end);
        const r = await D.updateProvider(provider.id, {
            displayName: settings.displayName, blurb: settings.blurb, feeCents: Math.round(parseFloat(settings.fee || '0') * 100),
            preorderMinutes: settings.preorderMinutes, pickupSpots: settings.pickupSpots.split(',').map((s) => s.trim()).filter(Boolean), schedule,
            photoUrl: settings.photoUrl, videoUrl: settings.videoUrl
        });
        setSaving(false);
        if (!r.success) { toast.error(r.message || 'Could not save.'); return; }
        onProviderChange(r.provider); toast.success('Settings saved.'); setShowSettings(false);
    };
    const act = async (order, status) => {
        const r = await D.updateOrderStatus(order.id, status);
        if (!r.success) toast.error(r.message || 'Could not update the order.'); else reload();
    };

    const pending = orders.filter((o) => o.status === 'pending');
    const inProgress = orders.filter((o) => ['accepted', 'picked_up', 'on_the_way'].includes(o.status));
    const history = orders.filter((o) => !D.ACTIVE_STATUSES.includes(o.status)).slice(0, 20);

    return React.createElement(React.Fragment, null,
        React.createElement('section', { className: 'delivery-card delivery-toggle-card' },
            React.createElement('div', null,
                React.createElement('h2', null, provider.displayName),
                React.createElement('span', { className: `delivery-pill is-${avail.state}` }, avail.label)),
            React.createElement('button', { className: `delivery-toggle ${provider.isOnline ? 'on' : ''}`, onClick: toggleOnline, 'aria-pressed': provider.isOnline },
                React.createElement('span', { className: 'delivery-toggle-knob' }),
                React.createElement('span', { className: 'delivery-toggle-label' }, provider.isOnline ? 'Online' : 'Offline'))),

        React.createElement('section', { className: 'delivery-card' },
            React.createElement('h3', null, `New orders (${pending.length})`),
            pending.length === 0 ? React.createElement('p', { className: 'delivery-muted' }, 'Nothing waiting. New orders also arrive by email with Accept / Decline buttons.')
                : pending.map((o) => React.createElement(DeliveryOrderRow, { key: o.id, order: o, provider, role: 'courier', tick,
                    actions: [{ label: 'Accept', status: 'accepted', cls: 'btn-primary' }, { label: 'Decline', status: 'declined', cls: 'btn-outline' }], onAct: act }))),

        React.createElement('section', { className: 'delivery-card' },
            React.createElement('h3', null, `In progress (${inProgress.length})`),
            inProgress.length === 0 ? React.createElement('p', { className: 'delivery-muted' }, 'No active deliveries.')
                : inProgress.map((o) => React.createElement(DeliveryOrderRow, { key: o.id, order: o, provider, role: 'courier', tick, onAct: act,
                    actions: o.status === 'accepted' ? [{ label: 'Picked up', status: 'picked_up', cls: 'btn-primary' }, { label: 'Cancel', status: 'cancelled', cls: 'btn-outline' }]
                        : o.status === 'picked_up' ? [{ label: 'On the way', status: 'on_the_way', cls: 'btn-primary' }, { label: 'Delivered', status: 'delivered', cls: 'btn-outline' }]
                        : [{ label: 'Delivered ✓', status: 'delivered', cls: 'btn-primary' }] }))),

        React.createElement('section', { className: 'delivery-card' },
            React.createElement('button', { className: 'delivery-settings-toggle', onClick: () => setShowSettings((s) => !s) }, showSettings ? '▾ Hours, fee & pickup spots' : '▸ Hours, fee & pickup spots'),
            showSettings && React.createElement('div', { className: 'delivery-settings' },
                React.createElement('label', null, 'Display name', React.createElement('input', { type: 'text', value: settings.displayName, maxLength: 60, onChange: (e) => setSettings({ ...settings, displayName: e.target.value }) })),
                React.createElement('label', null, 'One-line description', React.createElement('input', { type: 'text', value: settings.blurb, maxLength: 200, placeholder: 'e.g. Campus delivery on roller skates', onChange: (e) => setSettings({ ...settings, blurb: e.target.value }) })),
                React.createElement('div', { className: 'delivery-settings-row' },
                    React.createElement('label', null, 'Fee per delivery ($)', React.createElement('input', { type: 'number', min: 0, max: 50, step: 0.5, value: settings.fee, onChange: (e) => setSettings({ ...settings, fee: e.target.value }) })),
                    React.createElement('label', null, 'Preorders open (minutes before a window)', React.createElement('input', { type: 'number', min: 0, max: 240, step: 15, value: settings.preorderMinutes, onChange: (e) => setSettings({ ...settings, preorderMinutes: e.target.value }) }))),
                React.createElement('label', null, 'Pickup spots (comma separated)', React.createElement('input', { type: 'text', value: settings.pickupSpots, onChange: (e) => setSettings({ ...settings, pickupSpots: e.target.value }) })),
                React.createElement('div', { className: 'delivery-settings-row' },
                    React.createElement('label', null, 'Photo URL (shown on Glyde)', React.createElement('input', { type: 'url', value: settings.photoUrl, placeholder: 'https://…/photo.jpg', onChange: (e) => setSettings({ ...settings, photoUrl: e.target.value }) })),
                    React.createElement('label', null, 'Video URL (optional, mp4)', React.createElement('input', { type: 'url', value: settings.videoUrl, placeholder: 'https://…/clip.mp4', onChange: (e) => setSettings({ ...settings, videoUrl: e.target.value }) }))),
                React.createElement('div', { className: 'delivery-hours-grid' },
                    React.createElement('div', { className: 'delivery-hours-head' }, 'Working hours (campus time)'),
                    settings.days.map((d, i) => React.createElement('div', { key: i, className: `delivery-hours-row ${d.on ? '' : 'off'}` },
                        React.createElement('label', { className: 'delivery-day' }, React.createElement('input', { type: 'checkbox', checked: d.on, onChange: (e) => { const days = settings.days.slice(); days[i] = { ...d, on: e.target.checked }; setSettings({ ...settings, days }); } }), ' ', D.DAYS[i]),
                        React.createElement('input', { type: 'time', value: d.start, disabled: !d.on, onChange: (e) => { const days = settings.days.slice(); days[i] = { ...d, start: e.target.value }; setSettings({ ...settings, days }); } }),
                        React.createElement('span', null, 'to'),
                        React.createElement('input', { type: 'time', value: d.end, disabled: !d.on, onChange: (e) => { const days = settings.days.slice(); days[i] = { ...d, end: e.target.value }; setSettings({ ...settings, days }); } })))),
                React.createElement('p', { className: 'delivery-muted' }, 'Customers can order while you are Online inside these hours, and preorder before a window opens. Flip Offline any time to pause.'),
                React.createElement('button', { className: 'btn btn-primary', disabled: saving, onClick: saveSettings }, saving ? 'Saving…' : 'Save settings'))),

        history.length > 0 && React.createElement('section', { className: 'delivery-card' },
            React.createElement('h3', null, 'History'),
            history.map((o) => React.createElement(DeliveryOrderRow, { key: o.id, order: o, provider, role: 'courier', tick }))));
};

// ---------------------------------------------------------------------------
// One order (both sides)
// ---------------------------------------------------------------------------
const DeliveryOrderRow = ({ order, provider, role, actions = [], onAct, onCancel, tick }) => {
    const D = window.DormGlideDelivery;
    const tz = provider.timezone;
    const when = order.requestedFor ? `${D.fmtDay(new Date(order.requestedFor), tz)} ${D.fmtTime(new Date(order.requestedFor), tz)}` : 'ASAP';
    const secondsLeft = order.status === 'pending' && order.expiresAt ? Math.max(0, Math.round((new Date(order.expiresAt) - Date.now()) / 1000)) : null;
    const countdown = secondsLeft !== null ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` : null;
    const steps = ['accepted', 'picked_up', 'on_the_way', 'delivered'];
    const stepIndex = steps.indexOf(order.status);
    const canCancel = role === 'customer' && ['pending', 'accepted'].includes(order.status);
    return React.createElement('article', { className: `delivery-order is-${order.status}` },
        React.createElement('div', { className: 'delivery-order-main' },
            React.createElement('div', { className: 'delivery-order-title' }, order.items),
            React.createElement('div', { className: 'delivery-order-meta' },
                `${order.pickupSpot}${order.orderRef ? ` · order #${order.orderRef}` : ''} → ${order.deliverTo} · ${when} · ${D.formatFee(order.feeCents)}`),
            order.notes && React.createElement('div', { className: 'delivery-order-notes' }, '📝 ', order.notes),
            React.createElement('div', { className: 'delivery-order-status' },
                React.createElement('span', { className: `delivery-pill is-status-${order.status}` }, D.STATUS_LABELS[order.status] || order.status),
                countdown && React.createElement('span', { className: 'delivery-countdown' }, `⏱ ${countdown} left to answer`)),
            stepIndex >= 0 && React.createElement('div', { className: 'delivery-timeline' },
                steps.map((s, i) => React.createElement('span', { key: s, className: `delivery-step ${i <= stepIndex ? 'done' : ''}` }, D.STATUS_LABELS[s].split(' — ')[0])))),
        (actions.length > 0 || canCancel) && React.createElement('div', { className: 'delivery-order-actions' },
            actions.map((a) => React.createElement('button', { key: a.status, className: `btn ${a.cls}`, onClick: () => onAct(order, a.status) }, a.label)),
            canCancel && React.createElement('button', { className: 'btn btn-outline', onClick: () => onCancel(order) }, 'Cancel')));
};
