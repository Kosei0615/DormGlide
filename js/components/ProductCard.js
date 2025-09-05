const ProductCard = ({ product, onProductClick }) => {
    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price);
    };

    const timeAgo = (date) => {
        const now = new Date();
        const diff = now - new Date(date);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'Today';
        if (days === 1) return '1 day ago';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return `${Math.floor(days / 30)} months ago`;
    };

    return React.createElement('div', {
        className: 'product-card',
        onClick: () => onProductClick(product.id)
    },
        React.createElement('div', { className: 'product-image' },
            React.createElement('img', {
                src: product.image || 'https://via.placeholder.com/300x200?text=No+Image',
                alt: product.title,
                loading: 'lazy'
            }),
            product.condition && React.createElement('span', {
                className: `condition-badge condition-${product.condition.toLowerCase()}`
            }, product.condition)
        ),
        React.createElement('div', { className: 'product-info' },
            React.createElement('h3', { className: 'product-title' }, product.title),
            React.createElement('p', { className: 'product-price' }, formatPrice(product.price)),
            React.createElement('div', { className: 'product-meta' },
                React.createElement('span', { className: 'product-category' },
                    React.createElement('i', { className: 'fas fa-tag' }),
                    product.category
                ),
                React.createElement('span', { className: 'product-location' },
                    React.createElement('i', { className: 'fas fa-map-marker-alt' }),
                    product.location
                )
            ),
            React.createElement('div', { className: 'product-footer' },
                React.createElement('span', { className: 'product-seller' },
                    React.createElement('i', { className: 'fas fa-user' }),
                    product.sellerName
                ),
                React.createElement('span', { className: 'product-date' }, timeAgo(product.createdAt))
            )
        )
    );
};
