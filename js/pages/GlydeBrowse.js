// Glyde browse: the services storefront. Renders inside HomePage when the
// mode switch is set to Glyde. Reads the same products list (campus-scoped
// by RLS) and shows only listingType === 'service'.
const GlydeBrowse = ({ products, currentUser, onProductClick, onNavigate, onShowAuth }) => {
    const glyde = window.DormGlideGlyde;
    const [category, setCategory] = React.useState('');
    const [sort, setSort] = React.useState('newest');

    const services = React.useMemo(() => {
        const list = (Array.isArray(products) ? products : []).filter((product) => glyde?.isService(product));
        const filtered = category ? list.filter((product) => product.serviceCategory === category) : list;
        const sorted = [...filtered];
        if (sort === 'rate-asc') sorted.sort((a, b) => Number(a.rate ?? a.price ?? 0) - Number(b.rate ?? b.price ?? 0));
        else if (sort === 'rate-desc') sorted.sort((a, b) => Number(b.rate ?? b.price ?? 0) - Number(a.rate ?? a.price ?? 0));
        else sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        return sorted;
    }, [products, category, sort]);

    const handlePostService = () => {
        if (!currentUser) {
            if (onShowAuth) onShowAuth('signup');
            return;
        }
        onNavigate('sell', null, { listingType: 'service' });
    };

    const categories = glyde?.SERVICE_CATEGORIES || [];

    return React.createElement('div', { className: 'glyde-browse' },
        React.createElement('section', { className: 'glyde-hero' },
            React.createElement('h1', null, 'Skills from students on your campus'),
            React.createElement('p', null, 'Tutoring, haircuts, tech help, photos, moving muscle — book a fellow student. Pay them directly at the session.'),
            React.createElement('button', { className: 'btn btn-primary', onClick: handlePostService }, '➕ Offer a service')
        ),

        React.createElement('div', { className: 'glyde-category-chips' },
            React.createElement('button', {
                className: `glyde-chip ${category === '' ? 'active' : ''}`,
                onClick: () => setCategory('')
            }, 'All'),
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
                    onProductClick
                }))
            )
    );
};

window.DormGlideGlydeBrowse = GlydeBrowse;
