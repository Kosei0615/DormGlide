const SearchFilter = ({ onSearch, onFilter, categories }) => {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedCategory, setSelectedCategory] = React.useState('');
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
        onSearch(value);
        setShowSuggestions(value.length > 0 && value.length < 3);
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

    const toggleFilter = () => {
        setIsFilterOpen(!isFilterOpen);
    };

    const clearFilters = () => {
        setSelectedCategory('');
        setPriceRange({ min: '', max: '' });
        setCondition('');
        setSearchTerm('');
        onSearch('');
        onFilter({});
    };

    return React.createElement('div', { className: 'search-filter' },
        React.createElement('div', { className: 'search-bar' },
            React.createElement('div', { className: 'search-input-container' },
                React.createElement('i', { className: 'fas fa-search search-icon' }),
                React.createElement('input', {
                    type: 'text',
                    placeholder: 'Search for items, categories, sellers...',
                    value: searchTerm,
                    onChange: handleSearch,
                    onFocus: handleSearchFocus,
                    onBlur: handleSearchBlur,
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
                    type: 'button'
                },
                    React.createElement('i', { className: 'fas fa-times' })
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
            React.createElement('button', {
                className: `filter-toggle ${isFilterOpen ? 'active' : ''}`,
                onClick: toggleFilter
            },
                React.createElement('i', { className: 'fas fa-filter' }),
                React.createElement('span', null, 'Filters')
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
