// Glyde browse: the services storefront. Renders inside HomePage when the
// mode switch is set to Glyde. Reads the same products list (campus-scoped
// by RLS) and shows only listingType === 'service'. Phase 3 adds category
// landing tiles, a "How Glyde works" explainer, batched provider ratings,
// and the "Looking for..." request board.
const GlydeBrowse = ({ products, currentUser, onProductClick, onNavigate, onShowAuth }) => {
    const glyde = window.DormGlideGlyde;
    const toast = window.DormGlideToast || { success: () => {}, error: () => {}, warning: () => {}, info: () => {} };
    const [category, setCategory] = React.useState('');
    const [sort, setSort] = React.useState('newest');
    const [ratingBySeller, setRatingBySeller] = React.useState({});

    // Request board state
    const [requests, setRequests] = React.useState([]);
    const [showRequestForm, setShowRequestForm] = React.useState(false);
    const [requestForm, setRequestForm] = React.useState({ category: '', title: '', details: '', budgetNote: '' });
    const [postingRequest, setPostingRequest] = React.useState(false);
    const [chatRequest, setChatRequest] = React.useState(null);

    const services = React.useMemo(() => {
        const list = (Array.isArray(products) ? products : []).filter((product) => glyde?.isService(product));
        const filtered = category ? list.filter((product) => product.serviceCategory === category) : list;
        const sorted = [...filtered];
        if (sort === 'rate-asc') sorted.sort((a, b) => Number(a.rate ?? a.price ?? 0) - Number(b.rate ?? b.price ?? 0));
        else if (sort === 'rate-desc') sorted.sort((a, b) => Number(b.rate ?? b.price ?? 0) - Number(a.rate ?? a.price ?? 0));
        else sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        return sorted;
    }, [products, category, sort]);

    // Batch provider rating summaries for visible cards (one fetch per seller).
    React.useEffect(() => {
        let mounted = true;
        const sellers = [...new Set(services.map((s) => s.sellerId).filter(Boolean))].filter((id) => !(id in ratingBySeller));
        if (sellers.length === 0 || !window.DormGlideAuth?.getSellerRatingSummary) return undefined;
        Promise.all(sellers.map((id) => window.DormGlideAuth.getSellerRatingSummary(id).then((summary) => [id, summary]).catch(() => [id, null])))
            .then((entries) => { if (mounted) setRatingBySeller((prev) => ({ ...prev, ...Object.fromEntries(entries) })); });
        return () => { mounted = false; };
    }, [services]);

    const loadRequests = React.useCallback(async () => {
        if (!glyde?.fetchServiceRequests) return;
        const list = await glyde.fetchServiceRequests();
        setRequests(Array.isArray(list) ? list : []);
    }, []);

    React.useEffect(() => { loadRequests(); }, [loadRequests]);

    const requireLogin = (mode = 'login') => {
        if (currentUser) return true;
        if (onShowAuth) onShowAuth(mode);
        return false;
    };

    const handlePostService = () => {
        if (!requireLogin('signup')) return;
        onNavigate('sell', null, { listingType: 'service' });
    };

    const submitRequest = async (event) => {
        event.preventDefault();
        if (!requireLogin('login')) return;
        if (!requestForm.category || !requestForm.title.trim()) {
            toast.warning('Pick a category and say what you need.');
            return;
        }
        setPostingRequest(true);
        try {
            const result = await glyde.createServiceRequest({
                userId: currentUser.id,
                requesterName: currentUser.name || '',
                ...requestForm
            });
            if (!result?.success) { toast.error(result?.message || 'Could not post your request.'); return; }
            toast.success('Posted! Providers on your campus can now respond in chat.');
            setRequestForm({ category: '', title: '', details: '', budgetNote: '' });
            setShowRequestForm(false);
            await loadRequests();
        } finally {
            setPostingRequest(false);
        }
    };

    const closeRequest = async (request) => {
        const result = await glyde.closeServiceRequest({ requestId: request.id, userId: currentUser.id });
        if (result?.success) { toast.success('Request closed.'); await loadRequests(); }
        else toast.error('Could not close the request.');
    };

    const respondToRequest = (request) => {
        if (!requireLogin('login')) return;
        if (request.userId === currentUser.id) { toast.info('This is your own request.'); return; }
        setChatRequest(request);
    };

    const categories = glyde?.SERVICE_CATEGORIES || [];
    const timeAgo = (value) => {
        const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
        return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
    };

    return React.createElement('div', { className: 'glyde-browse' },
        React.createElement('section', { className: 'glyde-hero' },
            React.createElement('h1', null, 'Skills from students on your campus'),
            React.createElement('p', null, 'Tutoring, haircuts, tech help, photos, moving muscle — book a fellow student. Pay them directly at the session.'),
            React.createElement('div', { className: 'glyde-hero-actions' },
                React.createElement('button', { className: 'btn btn-primary', onClick: handlePostService }, '➕ Offer a service'),
                React.createElement('button', { className: 'btn glyde-hero-secondary', onClick: () => {
                    setShowRequestForm(true);
                    document.getElementById('glyde-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } }, '🙋 Post what you need')
            )
        ),

        // Category landing tiles (only when no category is selected)
        !category && React.createElement('section', { className: 'glyde-tiles' },
            categories.map((entry) => React.createElement('button', {
                key: entry.name,
                className: 'glyde-tile',
                onClick: () => setCategory(entry.name)
            },
                React.createElement('span', { className: 'glyde-tile-glyph', 'aria-hidden': true }, entry.glyph),
                React.createElement('span', { className: 'glyde-tile-label' }, entry.name)
            ))
        ),

        // How Glyde works — the three-step model, money rule verbatim
        !category && React.createElement('section', { className: 'deal-model-strip glyde-how' },
            React.createElement('h2', null, 'How Glyde works'),
            React.createElement('div', { className: 'deal-model-steps' },
                React.createElement('div', { className: 'deal-model-step' },
                    React.createElement('span', { className: 'deal-model-icon', 'aria-hidden': true }, '🔍'),
                    React.createElement('h3', null, '1. Find'),
                    React.createElement('p', null, 'Browse skills by category, or post what you need and let providers come to you.')
                ),
                React.createElement('div', { className: 'deal-model-step' },
                    React.createElement('span', { className: 'deal-model-icon', 'aria-hidden': true }, '📅'),
                    React.createElement('h3', null, '2. Book'),
                    React.createElement('p', null, 'Tap Book, the provider accepts, and you agree on a session time and place in chat.')
                ),
                React.createElement('div', { className: 'deal-model-step' },
                    React.createElement('span', { className: 'deal-model-icon', 'aria-hidden': true }, '💵'),
                    React.createElement('h3', null, '3. Pay at the session'),
                    React.createElement('p', null, 'Cash, Venmo, Zelle, or Cash App — directly to the provider when you meet.')
                )
            ),
            React.createElement('p', { className: 'deal-model-rule' },
                '🛡️ Providers are 18+ students on your campus. Meet in public campus spaces for first sessions. ',
                React.createElement('strong', null, 'DormGlide never handles money.')
            )
        ),

        React.createElement('div', { className: 'glyde-category-chips' },
            React.createElement('button', { className: `glyde-chip ${category === '' ? 'active' : ''}`, onClick: () => setCategory('') }, 'All'),
            categories.map((entry) => React.createElement('button', {
                key: entry.name,
                className: `glyde-chip ${category === entry.name ? 'active' : ''}`,
                onClick: () => setCategory(category === entry.name ? '' : entry.name)
            }, `${entry.glyph} ${entry.name}`))
        ),

        React.createElement('div', { className: 'glyde-toolbar' },
            React.createElement('span', { className: 'product-count' },
                `${services.length} service${services.length === 1 ? '' : 's'}${category ? ` in ${category}` : ''}`),
            React.createElement('label', { className: 'glyde-sort' },
                'Sort ',
                React.createElement('select', { value: sort, onChange: (event) => setSort(event.target.value) },
                    React.createElement('option', { value: 'newest' }, 'Newest'),
                    React.createElement('option', { value: 'rate-asc' }, 'Rate: low to high'),
                    React.createElement('option', { value: 'rate-desc' }, 'Rate: high to low')
                )
            )
        ),

        services.length === 0
            ? React.createElement('div', { className: 'empty-marketplace glyde-empty' },
                React.createElement('div', { className: 'empty-content' },
                    React.createElement('span', { className: 'empty-icon', 'aria-hidden': true }, '✨'),
                    React.createElement('h2', null, category ? `No ${category} services yet` : 'Be the first to offer a skill'),
                    React.createElement('p', null, 'Tutor a class you aced, cut hair, fix laptops, walk dogs, help someone move — your campus is looking for exactly what you can do.'),
                    React.createElement('div', { className: 'empty-actions' },
                        React.createElement('button', { className: 'btn btn-primary', onClick: handlePostService }, 'Post the first service')
                    )
                )
            )
            : React.createElement('div', { className: 'service-grid' },
                services.map((product) => React.createElement(window.DormGlideServiceCard, {
                    key: product.id,
                    product,
                    onProductClick,
                    ratingSummary: ratingBySeller[product.sellerId] || null
                }))
            ),

        // "Looking for..." request board
        React.createElement('section', { className: 'glyde-board', id: 'glyde-board' },
            React.createElement('div', { className: 'glyde-board-head' },
                React.createElement('div', null,
                    React.createElement('h2', null, '🙋 Looking for…'),
                    React.createElement('p', null, "Can't find it? Post what you need — providers on your campus respond in chat.")
                ),
                !showRequestForm && React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => { if (requireLogin('login')) setShowRequestForm(true); }
                }, 'Post a request')
            ),

            showRequestForm && React.createElement('form', { className: 'glyde-request-form', onSubmit: submitRequest },
                React.createElement('div', { className: 'form-row' },
                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'Category *'),
                        React.createElement('select', {
                            value: requestForm.category, required: true,
                            onChange: (event) => setRequestForm({ ...requestForm, category: event.target.value })
                        },
                            React.createElement('option', { value: '' }, 'Select a category'),
                            categories.map((entry) => React.createElement('option', { key: entry.name, value: entry.name }, `${entry.glyph} ${entry.name}`))
                        )
                    ),
                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'Budget (optional)'),
                        React.createElement('input', {
                            type: 'text', placeholder: 'e.g. up to $20/hr', maxLength: 60,
                            value: requestForm.budgetNote,
                            onChange: (event) => setRequestForm({ ...requestForm, budgetNote: event.target.value })
                        })
                    )
                ),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', null, 'What do you need? *'),
                    React.createElement('input', {
                        type: 'text', placeholder: 'e.g. CS 173 tutor, Tuesday evenings', maxLength: 120, required: true,
                        value: requestForm.title,
                        onChange: (event) => setRequestForm({ ...requestForm, title: event.target.value })
                    })
                ),
                React.createElement('div', { className: 'form-group' },
                    React.createElement('label', null, 'Details (optional)'),
                    React.createElement('textarea', {
                        rows: 2, maxLength: 500, placeholder: 'When, where, anything else helpful',
                        value: requestForm.details,
                        onChange: (event) => setRequestForm({ ...requestForm, details: event.target.value })
                    })
                ),
                React.createElement('div', { className: 'deal-actions' },
                    React.createElement('button', { type: 'submit', className: 'btn btn-primary', disabled: postingRequest },
                        postingRequest && React.createElement('i', { className: 'fas fa-spinner fa-spin' }), 'Post request'),
                    React.createElement('button', { type: 'button', className: 'btn btn-secondary', onClick: () => setShowRequestForm(false) }, 'Cancel')
                )
            ),

            requests.length === 0
                ? React.createElement('p', { className: 'glyde-board-empty' }, 'No open requests yet. Be the first — it takes 20 seconds.')
                : React.createElement('div', { className: 'glyde-request-list' },
                    requests.map((request) => React.createElement('article', { key: request.id, className: 'glyde-request-card' },
                        React.createElement('div', { className: 'glyde-request-main' },
                            React.createElement('span', { className: 'service-category-chip' },
                                `${glyde.categoryGlyph(request.category)} ${request.category}`),
                            React.createElement('h3', null, request.title),
                            request.details && React.createElement('p', { className: 'glyde-request-details' }, request.details),
                            React.createElement('p', { className: 'glyde-request-meta' },
                                `${request.requesterName || 'A student'} · ${timeAgo(request.createdAt)}`,
                                request.budgetNote ? ` · 💵 ${request.budgetNote}` : '')
                        ),
                        React.createElement('div', { className: 'glyde-request-actions' },
                            currentUser?.id === request.userId
                                ? React.createElement('button', { className: 'btn btn-sm btn-secondary', onClick: () => closeRequest(request) }, 'Close')
                                : React.createElement('button', { className: 'btn btn-sm btn-primary', onClick: () => respondToRequest(request) }, '💬 Respond'),
                            currentUser?.id !== request.userId && window.DormGlideReportButton && React.createElement(window.DormGlideReportButton, {
                                targetType: 'request', targetId: request.id, currentUser, compact: true
                            })
                        )
                    ))
                )
        ),

        // Respond → chat with the requester (no listing; a request-scoped thread)
        chatRequest && currentUser && React.createElement(ChatModal, {
            product: {
                id: `request_${chatRequest.id}`,
                title: `Looking for: ${chatRequest.title}`,
                price: 0,
                sellerId: chatRequest.userId,
                sellerName: chatRequest.requesterName || 'Student',
                images: []
            },
            currentUser,
            participant: { id: chatRequest.userId, name: chatRequest.requesterName || 'Student' },
            initialDraft: `Hi! I saw you're looking for ${chatRequest.title.toLowerCase()} — I can help. When works for you?`,
            dealKind: 'booking',
            onClose: () => setChatRequest(null)
        })
    );
};

window.DormGlideGlydeBrowse = GlydeBrowse;
