const WishlistPage = ({ currentUser, onNavigate, onShowAuth }) => {
    const [entries, setEntries] = React.useState([]);
    const [keyword, setKeyword] = React.useState('');
    const [category, setCategory] = React.useState('');
    const [maxPrice, setMaxPrice] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [isAdding, setIsAdding] = React.useState(false);
    const [deletingEntryId, setDeletingEntryId] = React.useState('');

    const toast = window.DormGlideToast || {
        success: () => {},
        error: () => {},
        warning: () => {},
        info: () => {}
    };

    const categories = [
        'Electronics', 'Textbooks', 'Furniture', 'Clothing', 'Sports',
        'Kitchen', 'Dorm Decor', 'Other'
    ];

    const loadEntries = React.useCallback(async () => {
        if (!currentUser?.id || !window.DormGlidePersonalization?.fetchWishlistEntries) {
            setEntries([]);
            return;
        }

        setIsLoading(true);
        try {
            const data = await window.DormGlidePersonalization.fetchWishlistEntries(currentUser.id);
            setEntries(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('[DormGlide] Failed to load wishlist entries:', error);
            toast.error('Unable to load wishlist right now.');
            setEntries([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser?.id]);

    React.useEffect(() => {
        loadEntries();
    }, [loadEntries]);

    const handleAddEntry = async (event) => {
        event.preventDefault();

        if (!currentUser?.id) {
            toast.warning('Please sign in to use wishlist.');
            return;
        }

        if (!keyword.trim()) {
            toast.warning('Please enter a keyword.');
            return;
        }

        if (!window.DormGlidePersonalization?.addWishlistEntry) {
            toast.error('Wishlist service is unavailable right now.');
            return;
        }

        setIsAdding(true);
        try {
            const result = await window.DormGlidePersonalization.addWishlistEntry({
                userId: currentUser.id,
                keyword: keyword.trim(),
                category,
                maxPrice: maxPrice === '' ? null : Number(maxPrice)
            });

            if (!result?.success) {
                toast.error(result?.message || 'Unable to add wishlist entry right now.');
                return;
            }

            setKeyword('');
            setCategory('');
            setMaxPrice('');
            await loadEntries();
            toast.success('Added to wishlist.');
        } catch (error) {
            console.error('[DormGlide] Failed to add wishlist entry:', error);
            toast.error('Unable to add wishlist entry right now.');
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteEntry = async (entryId) => {
        if (!currentUser?.id || !entryId) return;
        if (!window.DormGlidePersonalization?.deleteWishlistEntry) {
            toast.error('Wishlist service is unavailable right now.');
            return;
        }

        setDeletingEntryId(entryId);
        try {
            const result = await window.DormGlidePersonalization.deleteWishlistEntry({
                userId: currentUser.id,
                entryId
            });

            if (!result?.success) {
                toast.error(result?.message || 'Unable to remove wishlist entry right now.');
                return;
            }

            await loadEntries();
            toast.success('Removed from wishlist.');
        } catch (error) {
            console.error('[DormGlide] Failed to delete wishlist entry:', error);
            toast.error('Unable to remove wishlist entry right now.');
        } finally {
            setDeletingEntryId('');
        }
    };

    if (!currentUser) {
        return React.createElement('div', { className: 'wishlist-page' },
            React.createElement('div', { className: 'auth-required wishlist-auth-required' },
                React.createElement('i', { className: 'fa-solid fa-bell' }),
                React.createElement('h2', null, 'Sign in to use Wishlist'),
                React.createElement('p', null, 'Create alerts for items you want and get notified when matches are posted.'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => {
                        if (onShowAuth) {
                            onShowAuth('login');
                            return;
                        }
                        onNavigate('profile');
                    }
                }, 'Log In / Sign Up')
            )
        );
    }

    return React.createElement('div', { className: 'wishlist-page' },
        React.createElement('div', { className: 'wishlist-container' },
            React.createElement('div', { className: 'wishlist-page-header' },
                React.createElement('h1', null,
                    React.createElement('i', { className: 'fa-solid fa-bell' }),
                    'My Wishlist'
                ),
                React.createElement('p', null, 'Get notified when new listings match your keywords.')
            ),

            React.createElement('form', { className: 'wishlist-form-card', onSubmit: handleAddEntry },
                React.createElement('div', { className: 'wishlist-form-grid' },
                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', { htmlFor: 'wishlist-keyword' }, 'Keyword *'),
                        React.createElement('input', {
                            id: 'wishlist-keyword',
                            type: 'text',
                            value: keyword,
                            placeholder: 'desk lamp, bike, calculus textbook',
                            onChange: (event) => setKeyword(event.target.value),
                            required: true
                        })
                    ),
                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', { htmlFor: 'wishlist-category' }, 'Category'),
                        React.createElement('select', {
                            id: 'wishlist-category',
                            value: category,
                            onChange: (event) => setCategory(event.target.value)
                        },
                            React.createElement('option', { value: '' }, 'Any category'),
                            categories.map((option) => React.createElement('option', { key: option, value: option }, option))
                        )
                    ),
                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', { htmlFor: 'wishlist-max-price' }, 'Max Price'),
                        React.createElement('input', {
                            id: 'wishlist-max-price',
                            type: 'number',
                            min: '0',
                            step: '0.01',
                            value: maxPrice,
                            placeholder: 'Only notify me if under $X',
                            onChange: (event) => setMaxPrice(event.target.value)
                        })
                    )
                ),
                React.createElement('button', {
                    type: 'submit',
                    className: 'btn btn-primary wishlist-add-btn',
                    disabled: isAdding
                },
                    isAdding && React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' }),
                    !isAdding && React.createElement('i', { className: 'fa-solid fa-plus' }),
                    isAdding ? 'Adding...' : 'Add to Wishlist'
                )
            ),

            React.createElement('section', { className: 'wishlist-list-section' },
                isLoading
                    ? React.createElement('div', { className: 'wishlist-empty-state' }, 'Loading wishlist...')
                    : entries.length === 0
                        ? React.createElement('div', { className: 'wishlist-empty-state' },
                            React.createElement('p', null, 'Your wishlist is empty. Add keywords above to get notified when matching items are posted!')
                        )
                        : React.createElement('div', { className: 'wishlist-entry-grid' },
                            entries.map((entry) => React.createElement('article', { key: entry.id, className: 'wishlist-entry-card' },
                                React.createElement('div', { className: 'wishlist-entry-main' },
                                    React.createElement('h3', null, entry.keyword || 'Keyword'),
                                    entry.category && React.createElement('p', { className: 'wishlist-entry-meta' }, `Category: ${entry.category}`),
                                    entry.max_price !== null && entry.max_price !== undefined && entry.max_price !== '' && React.createElement('p', { className: 'wishlist-entry-meta' }, `Max Price: $${Number(entry.max_price).toFixed(2)}`)
                                ),
                                React.createElement('button', {
                                    type: 'button',
                                    className: 'icon-btn danger wishlist-delete-btn',
                                    title: 'Remove wishlist entry',
                                    'aria-label': 'Remove wishlist entry',
                                    disabled: deletingEntryId === entry.id,
                                    onClick: () => handleDeleteEntry(entry.id)
                                },
                                    deletingEntryId === entry.id
                                        ? React.createElement('i', { className: 'fa-solid fa-spinner fa-spin' })
                                        : React.createElement('i', { className: 'fa-solid fa-trash' })
                                )
                            ))
                        )
            )
        )
    );
};