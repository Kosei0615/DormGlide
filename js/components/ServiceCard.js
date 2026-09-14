// Service card for Glyde browse: category chip, provider, rate, availability.
const ServiceCard = ({ product, onProductClick, ratingSummary }) => {
    const glyde = window.DormGlideGlyde;
    const glyph = glyde?.categoryGlyph(product.serviceCategory) || '✨';
    const rate = glyde?.formatRate(product) || '';
    const location = glyde?.locationLabel(product.locationNote) || '';
    const hasPhoto = Array.isArray(product.images) && product.images.length > 0 && product.images[0];

    return React.createElement('div', {
        className: 'service-card',
        onClick: () => onProductClick(product.id),
        role: 'button',
        tabIndex: 0,
        onKeyDown: (event) => { if (event.key === 'Enter') onProductClick(product.id); }
    },
        React.createElement('div', { className: 'service-card-top' },
            hasPhoto
                ? React.createElement('img', { className: 'service-card-photo', src: product.images[0], alt: product.title, loading: 'lazy' })
                : React.createElement('div', { className: 'service-card-glyph', 'aria-hidden': true }, glyph),
            React.createElement('div', { className: 'service-card-main' },
                React.createElement('span', { className: 'service-category-chip' }, product.serviceCategory || 'Service'),
                React.createElement('h3', { className: 'service-card-title' }, product.title),
                React.createElement('p', { className: 'service-card-provider' },
                    '👤 ', product.sellerName || 'Student',
                    product.sellerCampus ? ` · ${product.sellerCampus}` : ''
                )
            )
        ),
        React.createElement('div', { className: 'service-card-bottom' },
            React.createElement('span', { className: 'service-card-rate' }, rate),
            React.createElement('span', { className: 'service-card-meta' },
                location ? `${location}` : '',
                product.availabilityNote ? ` · ${String(product.availabilityNote).slice(0, 40)}` : ''
            ),
            ratingSummary && ratingSummary.count > 0 && React.createElement('span', { className: 'service-card-rating' },
                `⭐ ${ratingSummary.average.toFixed(1)} (${ratingSummary.count})`)
        )
    );
};

window.DormGlideServiceCard = ServiceCard;
