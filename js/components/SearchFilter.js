const SearchFilter = ({ onSearch, onFilter, categories, activeCategory = '', searchValue = '' }) => {
    const [searchTerm, setSearchTerm] = React.useState(searchValue);
    const [selectedCategory, setSelectedCategory] = React.useState(activeCategory || '');
    const [priceRange, setPriceRange] = React.useState({ min: '', max: '' });
    const [condition, setCondition] = React.useState('');
    const [isFilterOpen, setIsFilterOpen] = React.useState(false);
    const [showSuggestions, setShowSuggestions] = React.useState(false);

    const popularSearches = [
        'MacBook', 'iPhone', 'iPad', 'Textbook', 'Calculator', 'Desk', 'Chair', 
        'Mini Fridge', 'Coffee Maker', 'Nintendo Switch', 'Headphones', 'Backpack'
    ];

    const handleSearch = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        setShowSuggestions(value.length > 0 && value.length < 3);
    };

    const handleSearchSubmit = () => {
        const trimmed = searchTerm.trim();
        setSearchTerm(trimmed);
        onSearch(trimmed);
        setShowSuggestions(false);
    };

    const handleSuggestionClick = (suggestion) => {
        setSearchTerm(suggestion);
        onSearch(suggestion);
        setShowSuggestions(false);
    };

    const handleSearchFocus = () => {
        if (searchTerm.length === 0) {
            setShowSuggestions(true);
        }
    };

    const handleSearchBlur = () => {
        // Delay hiding suggestions to allow clicking
        setTimeout(() => setShowSuggestions(false), 200);
    };

    const handleFilterChange = () => {
        onFilter({
            category: selectedCategory,
            priceRange: priceRange,
            condition: condition
        });
    };

    React.useEffect(() => {
        handleFilterChange();
    }, [selectedCategory, priceRange, condition]);

    React.useEffect(() => {
        setSelectedCategory(activeCategory || '');
    }, [activeCategory]);

    React.useEffect(() => {
        setSearchTerm(searchValue || '');
        if (!searchValue) {
            setShowSuggestions(false);
        }
    }, [searchValue]);

    const toggleFilter = () => {
        setIsFilterOpen(!isFilterOpen);
    };

    const clearFilters = () => {
        setSelectedCategory('');
        setPriceRange({ min: '', max: '' });
        setCondition('');
        setSearchTerm('');
        setShowSuggestions(false);
        onSearch('');
        onFilter({ category: '', priceRange: {}, condition: '' });
    };

    return React.createElement('div', { className: 'search-filter' },
        React.createElement('div', { className: 'search-filter-header' },
            React.createElement('h3', null,
                React.createElement('i', { className: 'fa-solid fa-magnifying-glass' }),
                ' Find items fast'
            ),
            React.createElement('p', { className: 'search-filter-help' }, 'Search by item name, seller, or category. Then narrow results with smart filters.')
        ),
        React.createElement('div', { className: 'search-bar' },
            React.createElement('div', { className: 'search-input-container' },
                React.createElement('span', { className: 'search-leading-icon', 'aria-hidden': 'true' },
                    React.createElement('i', { className: 'fa-solid fa-magnifying-glass' })
                ),
                React.createElement('input', {
                    type: 'text',
                    placeholder: 'Search listings, categories, or seller name',
                    value: searchTerm,
                    onChange: handleSearch,
                    onFocus: handleSearchFocus,
                    onBlur: handleSearchBlur,
                    onKeyDown: (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearchSubmit();
                        }
                    },
                    className: 'search-input'
                }),

                // Clear search button
                searchTerm && React.createElement('button', {
                    className: 'clear-search-btn',
                    onClick: () => {
                        setSearchTerm('');
                        onSearch('');
                        setShowSuggestions(false);
                    },
                    type: 'button',
                    title: 'Close search',
                    'aria-label': 'Close search'
                },
                    React.createElement('i', { className: 'fa-solid fa-xmark' })
                ),

                // Search suggestions dropdown
                showSuggestions && React.createElement('div', { className: 'search-suggestions' },
                    React.createElement('div', { className: 'suggestions-header' }, 
                        searchTerm.length === 0 ? 'Popular Searches' : 'Keep typing...'
                    ),
                    searchTerm.length === 0 && popularSearches.slice(0, 6).map(suggestion =>
                        React.createElement('div', {
                            key: suggestion,
                            className: 'suggestion-item',
                            onClick: () => handleSuggestionClick(suggestion)
                        },
                            React.createElement('i', { className: 'fas fa-search' }),
                            suggestion
                        )
                    )
                )
            ),
            React.createElement('div', { className: 'search-actions' },
                React.createElement('button', {
                    className: 'search-submit-btn',
                    onClick: handleSearchSubmit,
                    type: 'button',
                    title: 'Search',
                    'aria-label': 'Search DormGlide listings'
                },
                    React.createElement('i', { className: 'fa-solid fa-magnifying-glass' }),
                    React.createElement('span', null, 'Search')
                ),
                React.createElement('button', {
                    className: `filter-toggle ${isFilterOpen ? 'active' : ''}`,
                    onClick: toggleFilter,
                    type: 'button',
                    title: isFilterOpen ? 'Hide filters' : 'Open filters',
                    'aria-label': isFilterOpen ? 'Hide filters' : 'Open filters',
                    'aria-expanded': isFilterOpen
                },
                    React.createElement('i', { className: 'fa-solid fa-sliders' }),
                    React.createElement('span', null, isFilterOpen ? 'Hide Filters' : 'Filters')
                )
            ),
            React.createElement('p', { className: 'search-actions-help' },
                React.createElement('strong', null, 'Tip: '),
                'Search finds keyword matches. Use Filters for price, category, and condition.'
            )
        ),

        isFilterOpen && React.createElement('div', { className: 'filter-panel' },
            React.createElement('div', { className: 'filter-group' },
                React.createElement('label', null, 'Category'),
                React.createElement('select', {
                    value: selectedCategory,
                    onChange: (e) => setSelectedCategory(e.target.value)
                },
                    React.createElement('option', { value: '' }, 'All Categories'),
                    categories.map(category =>
                        React.createElement('option', { key: category, value: category }, category)
                    )
                )
            ),

            React.createElement('div', { className: 'filter-group' },
                React.createElement('label', null, 'Price Range'),
                React.createElement('div', { className: 'price-range' },
                    React.createElement('input', {
                        type: 'number',
                        placeholder: 'Min',
                        value: priceRange.min,
                        onChange: (e) => setPriceRange({ ...priceRange, min: e.target.value })
                    }),
                    React.createElement('span', null, 'to'),
                    React.createElement('input', {
                        type: 'number',
                        placeholder: 'Max',
                        value: priceRange.max,
                        onChange: (e) => setPriceRange({ ...priceRange, max: e.target.value })
                    })
                )
            ),

            React.createElement('div', { className: 'filter-group' },
                React.createElement('label', null, 'Condition'),
                React.createElement('select', {
                    value: condition,
                    onChange: (e) => setCondition(e.target.value)
                },
                    React.createElement('option', { value: '' }, 'Any Condition'),
                    React.createElement('option', { value: 'New' }, 'New'),
                    React.createElement('option', { value: 'Like New' }, 'Like New'),
                    React.createElement('option', { value: 'Good' }, 'Good'),
                    React.createElement('option', { value: 'Fair' }, 'Fair')
                )
            ),

            React.createElement('div', { className: 'filter-actions' },
                React.createElement('button', {
                    className: 'clear-filters-btn',
                    onClick: clearFilters
                }, 'Clear All'),
                React.createElement('button', {
                    className: 'apply-filters-btn',
                    onClick: () => setIsFilterOpen(false)
                }, 'Apply')
            )
        )
    );
};
