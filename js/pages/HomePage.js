const HomePage = ({ products, onProductClick, onNavigate }) => {
    const [filteredProducts, setFilteredProducts] = React.useState(products);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [activeCategory, setActiveCategory] = React.useState('');

    React.useEffect(() => {
        setFilteredProducts(products);
    }, [products]);

    const categories = [...new Set(products.map(product => product.category))];

    const handleSearch = (term) => {
        setSearchTerm(term);
        setActiveCategory(''); // Clear category when searching
        
        if (!term.trim()) {
            setFilteredProducts(products);
            return;
        }
        
        const searchLower = term.toLowerCase();
        const filtered = products.filter(product => {
            return (
                product.title.toLowerCase().includes(searchLower) ||
                product.description.toLowerCase().includes(searchLower) ||
                product.category.toLowerCase().includes(searchLower) ||
                product.condition.toLowerCase().includes(searchLower) ||
                product.location.toLowerCase().includes(searchLower) ||
                product.sellerName.toLowerCase().includes(searchLower)
            );
        });
        setFilteredProducts(filtered);
    };

    const handleCategoryClick = (category) => {
        setActiveCategory(category);
        setSearchTerm(''); // Clear search when selecting category
        
        const filtered = products.filter(product => product.category === category);
        setFilteredProducts(filtered);
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setActiveCategory('');
        setFilteredProducts(products);
    };

    const handleFilter = (filters) => {
        let filtered = products;

        // Apply search term first
        if (searchTerm && searchTerm.trim()) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(product => {
                return (
                    product.title.toLowerCase().includes(searchLower) ||
                    product.description.toLowerCase().includes(searchLower) ||
                    product.category.toLowerCase().includes(searchLower) ||
                    product.condition.toLowerCase().includes(searchLower) ||
                    product.location.toLowerCase().includes(searchLower) ||
                    product.sellerName.toLowerCase().includes(searchLower)
                );
            });
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
                        React.createElement('span', null, 'Trusted by Students')
                    ),
                    React.createElement('div', { className: 'stat' },
                        React.createElement('i', { className: 'fas fa-box' }),
                        React.createElement('span', null, `${products.length} Items${products.length === 0 ? ' (Start Selling!)' : ''}`)
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
                    products.length === 0 ? 'Be the First to Sell!' : 'Start Selling'
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
                        className: `category-card ${activeCategory === category ? 'active' : ''}`,
                        onClick: () => handleCategoryClick(category)
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
            }),
            
            // Clear filters button (show when there are active filters)
            (filters.searchTerm || activeCategory) &&
            React.createElement('div', { className: 'clear-filters-container', style: { marginTop: '1rem' } },
                React.createElement('button', {
                    className: 'clear-filters-btn',
                    onClick: clearAllFilters
                },
                    React.createElement('i', { className: 'fas fa-times' }),
                    ' Clear all filters'
                )
            )
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
            products.length === 0 ? 
                // Empty marketplace - encourage first listings
                React.createElement('div', { className: 'empty-marketplace' },
                    React.createElement('div', { className: 'empty-content' },
                        React.createElement('i', { className: 'fas fa-store empty-icon' }),
                        React.createElement('h3', null, 'Be the First to Start Trading!'),
                        React.createElement('p', null, 'Your college marketplace is ready and waiting. List your first item and help build a thriving student community.'),
                        React.createElement('div', { className: 'empty-actions' },
                            React.createElement('button', {
                                className: 'btn btn-primary btn-large',
                                onClick: () => onNavigate('sell')
                            },
                                React.createElement('i', { className: 'fas fa-plus' }),
                                'List Your First Item'
                            ),
                            React.createElement('button', {
                                className: 'btn btn-outline btn-large',
                                onClick: () => onNavigate('profile')
                            },
                                React.createElement('i', { className: 'fas fa-user' }),
                                'Set Up Profile'
                            )
                        ),
                        React.createElement('div', { className: 'getting-started-tips' },
                            React.createElement('h4', null, 'Getting Started Tips:'),
                            React.createElement('ul', null,
                                React.createElement('li', null, '📱 Take clear photos of your items'),
                                React.createElement('li', null, '💰 Price competitively for quick sales'),
                                React.createElement('li', null, '📝 Write detailed, honest descriptions'),
                                React.createElement('li', null, '🏫 Meet safely on campus in public areas'),
                                React.createElement('li', null, '🤝 Build trust with good communication')
                            )
                        )
                    )
                ) :
                React.createElement(ProductGrid, {
                    products: filteredProducts,
                    onProductClick: onProductClick,
                    searchTerm: searchTerm
                })
        )
    );
};
