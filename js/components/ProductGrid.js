const ProductGrid = ({ products, onProductClick }) => {
    if (products.length === 0) {
        return React.createElement('div', { className: 'empty-state' },
            React.createElement('i', { className: 'fas fa-inbox empty-icon' }),
            React.createElement('h3', null, 'No products found'),
            React.createElement('p', null, 'Try adjusting your search or filters to find what you\'re looking for.')
        );
    }

    return React.createElement('div', { className: 'product-grid' },
        products.map(product =>
            React.createElement(ProductCard, {
                key: product.id,
                product: product,
                onProductClick: onProductClick
            })
        )
    );
};
