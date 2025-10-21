const HomePage = ({ products, onProductClick, onNavigate, currentUser, onShowAuth }) => {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [filters, setFilters] = React.useState({
        category: '',
        priceRange: {},
        condition: ''
    });
    const [searchFilterVersion, setSearchFilterVersion] = React.useState(0);

    const CATEGORY_ICON_MAP = React.useMemo(() => ({
        'Electronics': 'fas fa-laptop',
        'Textbooks': 'fas fa-book',
        'Furniture': 'fas fa-couch',
        'Clothing': 'fas fa-tshirt',
        'Sports': 'fas fa-football-ball',
        'Kitchen': 'fas fa-utensils',
        'Dorm Decor': 'fas fa-palette',
        'Other': 'fas fa-box'
    }), []);

    const normalizedUserCampus = React.useMemo(() => (
        (currentUser?.campusLocation || currentUser?.university || '').trim().toLowerCase()
    ), [currentUser]);

    const determineNearby = React.useCallback((product) => {
        if (!normalizedUserCampus) return false;
        const location = (product.location || '').toLowerCase();
        const sellerCampus = (product.sellerCampus || '').toLowerCase();

        const normalizedLocation = location.replace(' campus', '').trim();
        const normalizedSeller = sellerCampus.replace(' campus', '').trim();

        return (
            normalizedLocation && (
                normalizedUserCampus.includes(normalizedLocation) ||
                normalizedLocation.includes(normalizedUserCampus)
            )
        ) || (
            normalizedSeller && (
                normalizedUserCampus.includes(normalizedSeller) ||
                normalizedSeller.includes(normalizedUserCampus)
            )
        );
    }, [normalizedUserCampus]);

    const decoratedProducts = React.useMemo(() => {
        if (!Array.isArray(products)) return [];
        return products.map((product) => {
            const base = {
                ...product,
                isDemo: Boolean(product.isDemo),
                sellerCampus: product.sellerCampus || product.location || ''
            };
            return {
                ...base,
                isNearby: determineNearby(base)
            };
        });
    }, [products, determineNearby]);

    const categoryMeta = React.useMemo(() => {
        const uniqueProductCategories = Array.from(
            new Set(decoratedProducts.map((product) => product?.category).filter(Boolean))
        );

        if (uniqueProductCategories.length > 0) {
            return uniqueProductCategories.map((name) => ({
                name,
                icon: CATEGORY_ICON_MAP[name] || CATEGORY_ICON_MAP['Other']
            }));
        }

        if (typeof getCategories === 'function') {
            return getCategories().map((category) => ({
                name: category.name,
                icon: category.icon || CATEGORY_ICON_MAP['Other']
            }));
        }

        return [];
    }, [decoratedProducts, CATEGORY_ICON_MAP]);

    const quickCategories = React.useMemo(() => categoryMeta.slice(0, 8), [categoryMeta]);

    const filteredProducts = React.useMemo(() => {
        let results = [...decoratedProducts];
        const normalizedSearch = searchTerm.trim().toLowerCase();

        if (normalizedSearch) {
            results = results.filter((product) => {
                const candidateFields = [
                    product.title,
                    product.description,
                    product.category,
                    product.condition,
                    product.location,
                    product.sellerName
                ].filter(Boolean);

                return candidateFields.some((field) => String(field).toLowerCase().includes(normalizedSearch));
            });
        }

        if (filters.category) {
            const categoryLower = filters.category.toLowerCase();
            results = results.filter(
                (product) => (product.category || '').toLowerCase() === categoryLower
            );
        }

        if (filters.priceRange && (filters.priceRange.min || filters.priceRange.max)) {
            const min = filters.priceRange.min ? parseFloat(filters.priceRange.min) : 0;
            const max = filters.priceRange.max ? parseFloat(filters.priceRange.max) : Number.POSITIVE_INFINITY;
            results = results.filter((product) => {
                const price = typeof product.price === 'number' ? product.price : parseFloat(product.price || 0);
                return price >= min && price <= max;
            });
        }

        if (filters.condition) {
            results = results.filter((product) => (product.condition || '').toLowerCase() === filters.condition.toLowerCase());
        }

        return results;
    }, [decoratedProducts, searchTerm, filters]);

    const sortedProducts = React.useMemo(() => {
        return [...filteredProducts].sort((a, b) => {
            if (a.isNearby !== b.isNearby) {
                return a.isNearby ? -1 : 1;
            }
            if (Boolean(a.isDemo) !== Boolean(b.isDemo)) {
                return a.isDemo ? 1 : -1;
            }
            const aDate = new Date(a.createdAt || 0).getTime();
            const bDate = new Date(b.createdAt || 0).getTime();
            return bDate - aDate;
        });
    }, [filteredProducts]);

    const nearbyProducts = React.useMemo(() => (
        sortedProducts.filter((product) => product.isNearby && !product.isDemo)
    ), [sortedProducts]);

    const studentCount = React.useMemo(() => (
        sortedProducts.filter((product) => !product.isDemo).length
    ), [sortedProducts]);

    const demoCount = Math.max(sortedProducts.length - studentCount, 0);

    const handleSearch = (term) => {
        setSearchTerm(term);
        if (term && term.trim().length >= 3) {
            window.DormGlideStorage?.addToSearchHistory?.(term.trim());
        }
    };

    const handleCategoryClick = (categoryName) => {
        setSearchTerm('');
        setFilters((prev) => ({
            ...prev,
            category: prev.category === categoryName ? '' : categoryName
        }));
    };

    const handleStartSelling = () => {
        if (currentUser) {
            onNavigate('sell');
        } else if (onShowAuth) {
            onShowAuth();
        } else {
            onNavigate('profile');
        }
    };

    const handleFilter = (nextFilters = {}) => {
        setFilters((prev) => ({
            category: nextFilters.category !== undefined ? nextFilters.category : prev.category,
            priceRange: nextFilters.hasOwnProperty('priceRange') ? nextFilters.priceRange : prev.priceRange,
            condition: nextFilters.condition !== undefined ? nextFilters.condition : prev.condition
        }));
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setFilters({ category: '', priceRange: {}, condition: '' });
        setSearchFilterVersion((prev) => prev + 1);
    };

    const hasActiveFilters = Boolean(
        searchTerm.trim() ||
        filters.category ||
        filters.condition ||
        (filters.priceRange && (filters.priceRange.min || filters.priceRange.max))
    );

    const featuredProducts = decoratedProducts.slice(0, 6);

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
                        React.createElement('span', null, `${decoratedProducts.length} Items${decoratedProducts.length === 0 ? ' (Start Selling!)' : ''}`)
                    ),
                    React.createElement('div', { className: 'stat' },
                        React.createElement('i', { className: 'fas fa-handshake' }),
                        React.createElement('span', null, '100% Safe')
                    )
                ),
                React.createElement('button', {
                    className: 'cta-button',
                    onClick: handleStartSelling
                },
                    React.createElement('i', { className: 'fas fa-plus' }),
                    decoratedProducts.length === 0 ? 'Be the First to Sell!' : 'Start Selling'
                )
            )
        ),

        // Quick Categories
        React.createElement('section', { className: 'quick-categories' },
            React.createElement('h2', null, 'Shop by Category'),
            React.createElement('div', { className: 'category-grid' },
                quickCategories.map((category) =>
                    React.createElement('div', {
                        key: category.name,
                        className: `category-card ${filters.category === category.name ? 'active' : ''}`,
                        onClick: () => handleCategoryClick(category.name)
                    },
                        React.createElement('i', { className: category.icon || CATEGORY_ICON_MAP['Other'] }),
                        React.createElement('span', null, category.name)
                    )
                )
            )
        ),

        // Search and Filter
        React.createElement('section', { className: 'search-section' },
            React.createElement(SearchFilter, {
                key: searchFilterVersion,
                onSearch: handleSearch,
                onFilter: handleFilter,
                categories: categoryMeta.map((category) => category.name),
                activeCategory: filters.category
            }),
            
            // Clear filters button (show when there are active filters)
            hasActiveFilters &&
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
                    `${sortedProducts.length} item${sortedProducts.length !== 1 ? 's' : ''} found`
                )
            ),
            decoratedProducts.length === 0 ? 
                // Empty marketplace - encourage first listings
                React.createElement('div', { className: 'empty-marketplace' },
                    React.createElement('div', { className: 'empty-content' },
                        React.createElement('i', { className: 'fas fa-store empty-icon' }),
                        React.createElement('h3', null, 'Be the First to Start Trading!'),
                        React.createElement('p', null, 'Your college marketplace is ready and waiting. List your first item and help build a thriving student community.'),
                        React.createElement('div', { className: 'empty-actions' },
                            React.createElement('button', {
                                className: 'btn btn-primary btn-large',
                                onClick: handleStartSelling
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
                    products: sortedProducts,
                    onProductClick: onProductClick,
                    searchTerm: searchTerm
                })
        )
    );
};
