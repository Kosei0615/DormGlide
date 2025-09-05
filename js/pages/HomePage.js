const HomePage = ({ products, onProductClick, onNavigate }) => {
    const [filteredProducts, setFilteredProducts] = React.useState(products);
    const [searchTerm, setSearchTerm] = React.useState('');

    React.useEffect(() => {
        setFilteredProducts(products);
    }, [products]);

    const categories = [...new Set(products.map(product => product.category))];

    const handleSearch = (term) => {
        setSearchTerm(term);
        const filtered = products.filter(product =>
            product.title.toLowerCase().includes(term.toLowerCase()) ||
            product.description.toLowerCase().includes(term.toLowerCase())
        );
        setFilteredProducts(filtered);
    };

    const handleFilter = (filters) => {
        let filtered = products;

        // Apply search term
        if (searchTerm) {
            filtered = filtered.filter(product =>
                product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply category filter
        if (filters.category) {
            filtered = filtered.filter(product => product.category === filters.category);
        }

        // Apply price range filter
        if (filters.priceRange && (filters.priceRange.min || filters.priceRange.max)) {
            filtered = filtered.filter(product => {
                const price = product.price;
                const min = filters.priceRange.min ? parseFloat(filters.priceRange.min) : 0;
                const max = filters.priceRange.max ? parseFloat(filters.priceRange.max) : Infinity;
                return price >= min && price <= max;
            });
        }

        // Apply condition filter
        if (filters.condition) {
            filtered = filtered.filter(product => product.condition === filters.condition);
        }

        setFilteredProducts(filtered);
    };

    const featuredProducts = products.slice(0, 6);

    return React.createElement('div', { className: 'home-page' },
        // Hero Section
        React.createElement('section', { className: 'hero-section' },
            React.createElement('div', { className: 'hero-content' },
                React.createElement('h1', null, 'Welcome to DormGlide'),
                React.createElement('p', null, 'Buy and sell student goods easily and safely'),
                React.createElement('div', { className: 'hero-stats' },
                    React.createElement('div', { className: 'stat' },
                        React.createElement('i', { className: 'fas fa-users' }),
                        React.createElement('span', null, '500+ Students')
                    ),
                    React.createElement('div', { className: 'stat' },
                        React.createElement('i', { className: 'fas fa-box' }),
                        React.createElement('span', null, `${products.length} Items`)
                    ),
                    React.createElement('div', { className: 'stat' },
                        React.createElement('i', { className: 'fas fa-handshake' }),
                        React.createElement('span', null, '100% Safe')
                    )
                ),
                React.createElement('button', {
                    className: 'cta-button',
                    onClick: () => onNavigate('sell')
                },
                    React.createElement('i', { className: 'fas fa-plus' }),
                    'Start Selling'
                )
            )
        ),

        // Quick Categories
        React.createElement('section', { className: 'quick-categories' },
            React.createElement('h2', null, 'Shop by Category'),
            React.createElement('div', { className: 'category-grid' },
                categories.slice(0, 8).map(category => {
                    const categoryIcons = {
                        'Electronics': 'fas fa-laptop',
                        'Textbooks': 'fas fa-book',
                        'Furniture': 'fas fa-couch',
                        'Clothing': 'fas fa-tshirt',
                        'Sports': 'fas fa-football-ball',
                        'Kitchen': 'fas fa-utensils',
                        'Dorm Decor': 'fas fa-palette',
                        'Other': 'fas fa-box'
                    };
                    
                    return React.createElement('div', {
                        key: category,
                        className: 'category-card',
                        onClick: () => {
                            handleFilter({ category });
                        }
                    },
                        React.createElement('i', { className: categoryIcons[category] || 'fas fa-box' }),
                        React.createElement('span', null, category)
                    );
                })
            )
        ),

        // Search and Filter
        React.createElement('section', { className: 'search-section' },
            React.createElement(SearchFilter, {
                onSearch: handleSearch,
                onFilter: handleFilter,
                categories: categories
            })
        ),

        // Featured Products
        featuredProducts.length > 0 && React.createElement('section', { className: 'featured-section' },
            React.createElement('h2', null, 'Featured Items'),
            React.createElement('div', { className: 'featured-grid' },
                featuredProducts.map(product =>
                    React.createElement(ProductCard, {
                        key: product.id,
                        product: product,
                        onProductClick: onProductClick
                    })
                )
            )
        ),

        // All Products
        React.createElement('section', { className: 'products-section' },
            React.createElement('div', { className: 'section-header' },
                React.createElement('h2', null, 'All Items'),
                React.createElement('span', { className: 'product-count' }, 
                    `${filteredProducts.length} item${filteredProducts.length !== 1 ? 's' : ''} found`
                )
            ),
            React.createElement(ProductGrid, {
                products: filteredProducts,
                onProductClick: onProductClick
            })
        )
    );
};
