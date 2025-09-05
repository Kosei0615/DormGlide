const ProductGrid = ({ products, onProductClick, searchTerm = '' }) => {
    if (products.length === 0) {
        return React.createElement('div', { className: 'empty-state' },
            React.createElement('i', { className: 'fas fa-search empty-icon' }),
            React.createElement('h3', null, searchTerm ? 'No results found' : 'No products found'),
            React.createElement('p', null, 
                searchTerm ? 
                `No items match "${searchTerm}". Try adjusting your search or filters.` :
                'Try adjusting your search or filters to find what you\'re looking for.'
            ),
            searchTerm && React.createElement('div', { className: 'search-suggestions-help' },
                React.createElement('p', null, 'Search tips:'),
                React.createElement('ul', null,
                    React.createElement('li', null, 'Try different keywords (e.g., "laptop" instead of "computer")'),
                    React.createElement('li', null, 'Check your spelling'),
                    React.createElement('li', null, 'Use broader terms (e.g., "electronics" instead of specific brands)'),
                    React.createElement('li', null, 'Try searching by category or condition')
                )
            )
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
