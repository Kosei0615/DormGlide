const ProductCard = ({ product, onProductClick, currentUser }) => {
    const [isWishlisted, setIsWishlisted] = React.useState(false);

    React.useEffect(() => {
        let isMounted = true;

        const loadWishlistedState = async () => {
            if (!currentUser?.id || !product?.id || !window.DormGlidePersonalization?.isListingWishlisted) {
                if (isMounted) setIsWishlisted(false);
                return;
            }

            try {
                const saved = await window.DormGlidePersonalization.isListingWishlisted(currentUser.id, product.id);
                if (isMounted) {
                    setIsWishlisted(Boolean(saved));
                }
            } catch (error) {
                console.warn('[DormGlide] Failed to resolve wishlist state:', error);
                if (isMounted) setIsWishlisted(false);
            }
        };

        loadWishlistedState();
        return () => {
            isMounted = false;
        };
    }, [currentUser?.id, product?.id]);

    const handleWishlistToggle = async (event) => {
        event.stopPropagation();

        if (!currentUser?.id) {
            window.DormGlideToast?.warning?.('Please log in to save listings to your wishlist.');
            return;
        }

        if (!window.DormGlidePersonalization?.toggleWishlist) {
            window.DormGlideToast?.error?.('Wishlist service is unavailable right now.');
            return;
        }

        try {
            const result = await window.DormGlidePersonalization.toggleWishlist(currentUser.id, product.id);
            if (!result?.success) {
                window.DormGlideToast?.error?.(result?.message || 'Unable to update wishlist right now.');
                return;
            }

            setIsWishlisted(Boolean(result.saved));
            window.DormGlideToast?.success?.(result.saved ? 'Saved to wishlist.' : 'Removed from wishlist.');
        } catch (error) {
            console.error('[DormGlide] Failed toggling wishlist:', error);
            window.DormGlideToast?.error?.('Unable to update wishlist right now.');
        }
    };

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

    const isDemo = Boolean(product.isDemo);
    const isNearby = Boolean(product.isNearby);
    const sellerCampus = product.sellerCampus || product.location || '';
    const listingStatusRaw = String(product.status || 'active').toLowerCase();
    const listingStatus = listingStatusRaw === 'active' ? 'available' : listingStatusRaw;
    const isSold = listingStatus === 'sold' || Boolean(product?.soldAt);
    const isAvailable = listingStatus === 'available' && !isSold;
    const statusLabel = isSold ? 'Sold' : (listingStatus === 'pending' ? 'Pending' : 'Available');
    const iconGlyph = (glyph, className = 'meta-glyph') => React.createElement('span', { className, 'aria-hidden': 'true' }, glyph);

    return React.createElement('div', {
        className: 'product-card',
        onClick: () => onProductClick(product.id)
    },
        React.createElement('div', { className: 'product-image' },
            React.createElement('button', {
                className: `wishlist-icon-btn icon-btn ${isWishlisted ? 'active' : ''}`,
                title: isWishlisted ? 'Remove from wishlist' : 'Save to wishlist',
                'aria-label': isWishlisted ? 'Remove from wishlist' : 'Save to wishlist',
                onClick: handleWishlistToggle
            },
                iconGlyph(isWishlisted ? '❤️' : '🤍', 'heart-glyph')
            ),
            isSold && React.createElement('span', { className: 'sold-ribbon' }, 'SOLD'),
            (isDemo || isNearby) && React.createElement('div', { className: 'product-tags' },
                isNearby && React.createElement('span', { className: 'product-tag nearby' },
                    iconGlyph('📍', 'tag-glyph'),
                    'Near you'
                ),
                isDemo && React.createElement('span', { className: 'product-tag demo' },
                    iconGlyph('🎓', 'tag-glyph'),
                    'DormGlide demo'
                )
            ),
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
                    iconGlyph('🏷️'),
                    product.category
                ),
                React.createElement('span', { className: 'product-location' },
                    iconGlyph('📍'),
                    product.location || sellerCampus || 'On campus'
                )
            ),
            React.createElement('div', { className: 'product-footer' },
                React.createElement('span', { className: 'product-seller' },
                    iconGlyph('👤'),
                    product.sellerName
                ),
                React.createElement('span', { className: 'product-date' }, `${timeAgo(product.createdAt)} • ${statusLabel}`)
            )
        )
    );
};
