const ProductDetailPage = ({ product, onNavigate, currentUser, onShowAuth, onProductUpdate }) => {
    const [isImageModalOpen, setIsImageModalOpen] = React.useState(false);
    const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
    const [isSaved, setIsSaved] = React.useState(false);
    const [isChatOpen, setIsChatOpen] = React.useState(false);
    const [sellerProfile, setSellerProfile] = React.useState(null);
    const [sellerRatingSummary, setSellerRatingSummary] = React.useState({ average: 0, count: 0 });
    const [isSavingStatus, setIsSavingStatus] = React.useState(false);
    const [isRequestingPurchase, setIsRequestingPurchase] = React.useState(false);
    const [purchaseRequests, setPurchaseRequests] = React.useState([]);

    const toast = window.DormGlideToast || {
        success: () => {},
        error: () => {},
        warning: () => {},
        info: () => {}
    };

    if (!product) {
        return React.createElement('div', { className: 'product-detail-page' },
            React.createElement('div', { className: 'error-state' },
                React.createElement('i', { className: 'fas fa-exclamation-triangle' }),
                React.createElement('h2', null, 'Product not found'),
                React.createElement('p', null, 'The product you\'re looking for does not exist or has been removed.'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => onNavigate('home')
                }, 'Back to Browse')
            )
        );
    }

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

    const formatTimelineDate = (value) => {
        if (!value) return 'Pending';
        return new Date(value).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const refreshListingState = React.useCallback(async () => {
        if (!product?.id || !window.DormGlideStorage?.fetchListingById) return;
        try {
            const latest = await window.DormGlideStorage.fetchListingById(product.id);
            if (latest && onProductUpdate) {
                onProductUpdate(latest);
            }
        } catch (error) {
            console.error('[DormGlide] Failed to refresh listing state:', error);
        }
    }, [product?.id, onProductUpdate]);

    const refreshPurchaseRequests = React.useCallback(async () => {
        if (!product?.id || !window.DormGlideStorage?.fetchPurchaseRequests) {
            setPurchaseRequests([]);
            return;
        }
        try {
            const requests = await window.DormGlideStorage.fetchPurchaseRequests(product.id);
            setPurchaseRequests(Array.isArray(requests) ? requests : []);
        } catch (error) {
            console.error('[DormGlide] Failed to fetch purchase requests:', error);
            setPurchaseRequests([]);
        }
    }, [product?.id]);

    React.useEffect(() => {
        if (currentUser && product && window.DormGlideAuth) {
            const favorited = window.DormGlideAuth.isProductFavorited
                ? window.DormGlideAuth.isProductFavorited(currentUser.id, product.id)
                : window.DormGlideAuth.getUserActivity(currentUser.id).favorites.some((f) => f.productId === product.id);
            setIsSaved(favorited);
        } else {
            setIsSaved(false);
        }
    }, [currentUser, product?.id]);

    React.useEffect(() => {
        if (!product?.sellerId || !window.DormGlideAuth?.getUserById) {
            setSellerProfile(null);
            return;
        }
        const seller = window.DormGlideAuth.getUserById(product.sellerId);
        setSellerProfile(seller);
    }, [product?.sellerId]);

    React.useEffect(() => {
        let isMounted = true;
        const loadRating = async () => {
            if (!product?.sellerId || !window.DormGlideAuth?.getSellerRatingSummary) return;
            try {
                const summary = await window.DormGlideAuth.getSellerRatingSummary(product.sellerId);
                if (isMounted) {
                    setSellerRatingSummary(summary || { average: 0, count: 0 });
                }
            } catch (error) {
                console.warn('[DormGlide] Failed to load seller rating summary:', error);
            }
        };
        loadRating();
        return () => {
            isMounted = false;
        };
    }, [product?.sellerId]);

    React.useEffect(() => {
        refreshPurchaseRequests();
    }, [refreshPurchaseRequests, currentUser?.id]);

    const chatParticipant = React.useMemo(() => {
        if (sellerProfile) {
            return {
                id: sellerProfile.id,
                name: sellerProfile.name || product?.sellerName,
                phone: sellerProfile.phone || product?.contactInfo
            };
        }
        return {
            id: product?.sellerId,
            name: product?.sellerName,
            phone: product?.contactInfo
        };
    }, [sellerProfile, product]);

    const ensureAuthenticated = (message) => {
        if (currentUser) return true;
        toast.warning(message || 'Please log in or create an account to continue.');
        if (onShowAuth) {
            onShowAuth();
        } else {
            onNavigate('profile');
        }
        return false;
    };

    const handleChatWithSeller = () => {
        if (!ensureAuthenticated('Please log in to chat with the seller.')) return;
        if (!product.sellerId) {
            toast.error('This listing is missing seller details.');
            return;
        }
        if (currentUser.id === product.sellerId) {
            toast.info('This is your own listing.');
            return;
        }
        setIsChatOpen(true);
    };

    const handleBuyNow = async () => {
        if (!ensureAuthenticated('Log in to start the purchase flow.')) return;

        const currentStatus = String(product?.status || 'available').toLowerCase();
        if (currentStatus === 'sold') {
            toast.info('This item is already sold.');
            return;
        }

        if (!product?.sellerId) {
            toast.error('This listing is missing seller details.');
            return;
        }

        if (currentUser.id === product.sellerId) {
            toast.info('This is your own listing.');
            return;
        }

        if (!window.DormGlideStorage?.requestPurchase || !product?.id) {
            toast.error('Purchase requests are unavailable right now.');
            return;
        }

        setIsRequestingPurchase(true);
        try {
            await window.DormGlideStorage.requestPurchase({
                listingId: product.id,
                buyerId: currentUser.id,
                sellerId: product.sellerId
            });

            await refreshPurchaseRequests();
            await refreshListingState();
            toast.success('Purchase request sent! The seller will be notified.');
        } catch (error) {
            console.error('[DormGlide] Failed to send purchase request:', error);
            toast.error('Unable to send purchase request right now.');
        } finally {
            setIsRequestingPurchase(false);
        }
    };

    const saveProductStatus = async (nextStatus) => {
        if (!currentUser?.id || currentUser.id !== product?.sellerId || !product?.id) return;

        const normalized = String(nextStatus || '').toLowerCase();
        setIsSavingStatus(true);
        try {
            if (normalized === 'sold') {
                const pendingRequest = purchaseRequests.find((request) => request?.status === 'pending');

                if (window.DormGlideStorage?.confirmPurchase) {
                    await window.DormGlideStorage.confirmPurchase({
                        listingId: product.id,
                        purchaseRequestId: pendingRequest?.id || null,
                        buyerId: pendingRequest?.buyerId || product?.buyerId || null
                    });
                } else if (window.DormGlideStorage?.updateProduct) {
                    const now = new Date().toISOString();
                    await window.DormGlideStorage.updateProduct(product.id, {
                        ...product,
                        status: 'sold',
                        buyerId: pendingRequest?.buyerId || product?.buyerId || null,
                        purchasedAt: now,
                        soldAt: now,
                        sellerConfirmedAt: now
                    });
                }

                toast.success('Sale confirmed! The item has been marked as sold.');
            } else {
                await window.DormGlideStorage.updateProduct(product.id, {
                    ...product,
                    status: 'available',
                    requestedAt: null,
                    purchasedAt: null,
                    soldAt: null,
                    buyerId: null,
                    soldMethod: null,
                    buyerConfirmedAt: null,
                    sellerConfirmedAt: null
                });
                toast.success('Listing is available again.');
            }

            await refreshPurchaseRequests();
            await refreshListingState();
        } catch (error) {
            console.error('[DormGlide] Failed updating listing status:', error);
            toast.error('Unable to update listing status right now.');
        } finally {
            setIsSavingStatus(false);
        }
    };

    const handleToggleSave = () => {
        if (!ensureAuthenticated('Log in to mark this item as a favorite.')) return;
        if (!window.DormGlideAuth) {
            toast.error('Favorites are not available right now.');
            return;
        }

        if (isSaved) {
            window.DormGlideAuth.removeFromFavorites(currentUser.id, product.id);
            setIsSaved(false);
            toast.info('Removed from your saved items.');
            return;
        }

        const result = window.DormGlideAuth.addToFavorites(currentUser.id, product.id, product.title);
        if (result.success) {
            setIsSaved(true);
            if (confirm('Saved to your favorites! Open your dashboard now?')) {
                onNavigate('dashboard');
            }
            return;
        }

        toast.error('Unable to save this item right now.');
    };

    const handleRateSeller = async () => {
        if (!ensureAuthenticated('Please log in to rate this seller.')) return;
        if (!product?.sellerId || currentUser?.id === product.sellerId) {
            toast.warning('You cannot rate your own listing.');
            return;
        }
        if (!window.DormGlideAuth?.submitSellerRating) {
            toast.error('Rating service is unavailable right now.');
            return;
        }

        const raw = window.prompt('Rate this seller from 1 to 5 stars (e.g. 5):');
        if (raw === null) return;
        const rating = Number(raw);
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
            toast.warning('Please enter a number between 1 and 5.');
            return;
        }

        const comment = window.prompt('Optional review comment (max 280 chars):', '') || '';

        try {
            const result = await window.DormGlideAuth.submitSellerRating({
                sellerId: product.sellerId,
                buyerId: currentUser.id,
                productId: product.id,
                rating,
                comment
            });

            if (!result.success) {
                toast.error('Unable to submit rating right now.');
                return;
            }

            setSellerRatingSummary(result.summary || { average: rating, count: 1 });
            toast.success('Thanks! Your seller rating has been submitted.');
        } catch (error) {
            console.error('[DormGlide] Failed to submit seller rating:', error);
            toast.error('Unable to submit rating right now.');
        }
    };

    const listingStatusRaw = String(product?.status || 'available').toLowerCase();
    const listingStatus = listingStatusRaw === 'active' ? 'available' : listingStatusRaw;
    const isSellerOwner = Boolean(currentUser?.id && product?.sellerId && currentUser.id === product.sellerId);
    const myPurchaseRequest = purchaseRequests.find((request) => request?.buyerId === currentUser?.id) || null;
    const sellerPendingRequest = purchaseRequests.find((request) => request?.sellerId === currentUser?.id && request?.status === 'pending') || null;
    const pendingBuyerName = sellerPendingRequest?.buyerId
        ? (window.DormGlideAuth?.getUserById?.(sellerPendingRequest.buyerId)?.name || sellerPendingRequest.buyerId)
        : '';
    const isRequestAlreadySent = Boolean(myPurchaseRequest && ['pending', 'confirmed'].includes(myPurchaseRequest.status));

    const dealTimeline = [
        {
            key: 'requested',
            label: 'Requested purchase',
            at: product?.requestedAt
        },
        {
            key: 'buyer-confirmed',
            label: 'Buyer confirmed received',
            at: product?.buyerConfirmedAt
        },
        {
            key: 'seller-confirmed',
            label: 'Seller confirmed sold',
            at: product?.sellerConfirmedAt || product?.purchasedAt || product?.soldAt
        }
    ];

    const safetyTips = [
        {
            icon: 'fas fa-people-group',
            bubble: 'tip-blue',
            text: 'Meet in a public place on campus (library, student union, cafeteria)'
        },
        {
            icon: 'fas fa-user-friends',
            bubble: 'tip-indigo',
            text: 'Bring a friend when meeting to exchange items'
        },
        {
            icon: 'fas fa-mobile-screen',
            bubble: 'tip-green',
            text: 'Use digital payment (Zelle, Venmo) and avoid carrying large amounts of cash'
        },
        {
            icon: 'fas fa-magnifying-glass',
            bubble: 'tip-amber',
            text: 'Inspect the item thoroughly before paying'
        },
        {
            icon: 'fas fa-lock',
            bubble: 'tip-red',
            text: 'Never share your login credentials, SSN, or bank account details'
        },
        {
            icon: 'fas fa-heart-pulse',
            bubble: 'tip-rose',
            text: 'If something feels off, trust your gut and back out of the deal'
        },
        {
            icon: 'fas fa-flag',
            bubble: 'tip-slate',
            text: 'Report suspicious listings to DormGlide support'
        }
    ];

    const images = product.images && product.images.length > 0
        ? product.images
        : [product.image || 'https://via.placeholder.com/600x400?text=No+Image'];

    return React.createElement('div', { className: 'product-detail-page' },
        React.createElement('div', { className: 'product-detail-container' },
            React.createElement('button', {
                className: 'back-btn',
                onClick: () => onNavigate('home')
            },
                React.createElement('i', { className: 'fas fa-arrow-left' }),
                'Back to Browse'
            ),

            React.createElement('div', { className: 'product-detail-content' },
                React.createElement('div', { className: 'product-images' },
                    React.createElement('div', { className: 'main-image' },
                        React.createElement('img', {
                            src: images[currentImageIndex],
                            alt: product.title,
                            onClick: () => setIsImageModalOpen(true)
                        }),
                        images.length > 1 && React.createElement('div', { className: 'image-nav' },
                            React.createElement('button', {
                                onClick: () => setCurrentImageIndex(Math.max(0, currentImageIndex - 1)),
                                disabled: currentImageIndex === 0
                            }, React.createElement('i', { className: 'fas fa-chevron-left' })),
                            React.createElement('span', null, `${currentImageIndex + 1} / ${images.length}`),
                            React.createElement('button', {
                                onClick: () => setCurrentImageIndex(Math.min(images.length - 1, currentImageIndex + 1)),
                                disabled: currentImageIndex === images.length - 1
                            }, React.createElement('i', { className: 'fas fa-chevron-right' }))
                        )
                    ),
                    images.length > 1 && React.createElement('div', { className: 'thumbnail-strip' },
                        images.map((image, index) =>
                            React.createElement('img', {
                                key: index,
                                src: image,
                                alt: `${product.title} ${index + 1}`,
                                className: index === currentImageIndex ? 'active' : '',
                                onClick: () => setCurrentImageIndex(index)
                            })
                        )
                    )
                ),

                React.createElement('div', { className: 'product-info-detail' },
                    React.createElement('div', { className: 'product-header' },
                        React.createElement('h1', null, product.title),
                        React.createElement('div', { className: 'product-price-large' }, formatPrice(product.price)),
                        React.createElement('div', { className: `listing-status-badge listing-status-${listingStatus}` },
                            React.createElement('span', { className: 'status-dot' }),
                            listingStatus === 'sold' ? 'Sold' : (listingStatus === 'pending' ? 'Pending' : 'Available')
                        ),
                        React.createElement('div', { className: 'product-badges' },
                            React.createElement('span', { className: `condition-badge condition-${product.condition.toLowerCase()}` }, product.condition),
                            React.createElement('span', { className: 'category-badge' },
                                React.createElement('i', { className: 'fas fa-tag' }),
                                product.category
                            )
                        )
                    ),

                    React.createElement('div', { className: 'product-actions product-actions-priority' },
                        React.createElement('button', {
                            className: 'btn btn-primary btn-large',
                            onClick: handleBuyNow,
                            disabled: listingStatus === 'sold' || isSellerOwner || isRequestingPurchase || isRequestAlreadySent
                        },
                            React.createElement('i', { className: isRequestingPurchase ? 'fas fa-spinner fa-spin' : 'fas fa-shopping-cart' }),
                            isRequestingPurchase
                                ? 'Sending Request...'
                                : (isRequestAlreadySent ? 'Request Sent' : (listingStatus === 'sold' ? 'Sold Out' : (isSellerOwner ? 'Your Listing' : 'Request Purchase')))
                        ),
                        React.createElement('button', {
                            className: 'btn btn-secondary btn-large',
                            onClick: handleChatWithSeller
                        },
                            React.createElement('i', { className: 'fas fa-comments' }),
                            'Chat with Seller'
                        ),
                        React.createElement('button', {
                            className: `btn btn-outline ${isSaved ? 'saved' : ''}`,
                            onClick: handleToggleSave
                        },
                            React.createElement('i', { className: isSaved ? 'fas fa-heart' : 'far fa-heart' }),
                            isSaved ? 'Saved' : 'Save'
                        ),
                        isSellerOwner && React.createElement('button', {
                            className: `btn btn-outline ${listingStatus === 'sold' ? '' : 'btn-danger'}`,
                            onClick: () => saveProductStatus(listingStatus === 'sold' ? 'available' : 'sold'),
                            disabled: isSavingStatus
                        },
                            React.createElement('i', { className: isSavingStatus ? 'fas fa-spinner fa-spin' : (listingStatus === 'sold' ? 'fas fa-rotate-left' : 'fas fa-check-circle') }),
                            isSavingStatus
                                ? 'Saving...'
                                : (listingStatus === 'sold' ? 'Mark as Available' : 'Confirm Purchase')
                        )
                    ),

                    myPurchaseRequest?.status === 'pending' && React.createElement('p', { className: 'message-thread-product' },
                        '⏳ Your purchase request is pending seller approval'
                    ),
                    myPurchaseRequest?.status === 'confirmed' && React.createElement('p', { className: 'message-thread-product' },
                        '✅ Purchase confirmed!'
                    ),
                    sellerPendingRequest && React.createElement('p', { className: 'message-thread-product' },
                        `Purchase request pending from buyer ${pendingBuyerName}`
                    ),

                    React.createElement('div', { className: 'product-description' },
                        React.createElement('h3', null, 'Description'),
                        React.createElement('p', null, product.description)
                    ),

                    React.createElement('div', { className: 'product-details' },
                        React.createElement('h3', null, 'Details'),
                        React.createElement('div', { className: 'detail-grid' },
                            React.createElement('div', { className: 'detail-item' },
                                React.createElement('i', { className: 'fas fa-map-marker-alt' }),
                                React.createElement('span', null, 'Location: ', product.location)
                            ),
                            React.createElement('div', { className: 'detail-item' },
                                React.createElement('i', { className: 'fas fa-clock' }),
                                React.createElement('span', null, 'Posted: ', timeAgo(product.createdAt))
                            ),
                            React.createElement('div', { className: 'detail-item' },
                                React.createElement('i', { className: 'fas fa-eye' }),
                                React.createElement('span', null, 'Views: ', product.views || 0)
                            ),
                            React.createElement('div', { className: 'detail-item' },
                                React.createElement('i', { className: 'fas fa-handshake' }),
                                React.createElement('span', null, 'Deal Type: Direct via chat (Zelle, Venmo, Cash)')
                            )
                        )
                    ),

                    React.createElement('div', { className: 'deal-timeline-card' },
                        React.createElement('h3', null, 'Deal Timeline'),
                        React.createElement('div', { className: 'deal-timeline-list' },
                            dealTimeline.map((step) => {
                                const completed = Boolean(step.at);
                                return React.createElement('div', {
                                    key: step.key,
                                    className: `deal-timeline-item ${completed ? 'completed' : ''}`
                                },
                                    React.createElement('div', { className: 'deal-timeline-dot' },
                                        React.createElement('i', { className: completed ? 'fas fa-check' : 'fas fa-clock' })
                                    ),
                                    React.createElement('div', { className: 'deal-timeline-content' },
                                        React.createElement('h4', null, step.label),
                                        React.createElement('p', null, formatTimelineDate(step.at))
                                    )
                                );
                            })
                        )
                    ),

                    React.createElement('div', { className: 'safety-tips-card' },
                        React.createElement('h3', null,
                            React.createElement('i', { className: 'fas fa-shield-halved' }),
                            'Safety Tips'
                        ),
                        React.createElement('div', { className: 'safety-tips-grid' },
                            safetyTips.map((tip, index) => React.createElement('div', {
                                key: `${tip.icon}-${index}`,
                                className: 'safety-tip-row'
                            },
                                React.createElement('span', { className: `safety-tip-icon ${tip.bubble}` },
                                    React.createElement('i', { className: tip.icon })
                                ),
                                React.createElement('p', null, tip.text)
                            ))
                        )
                    ),

                    React.createElement('div', { className: 'seller-info' },
                        React.createElement('h3', null, 'Seller Information'),
                        React.createElement('div', { className: 'seller-card' },
                            React.createElement('div', { className: 'seller-avatar' },
                                React.createElement('i', { className: 'fas fa-user-circle' })
                            ),
                            React.createElement('div', { className: 'seller-details' },
                                React.createElement('h4', null, product.sellerName),
                                React.createElement('p', null, 'Verified DormGlide student seller'),
                                React.createElement('div', { className: 'seller-rating' },
                                    React.createElement('i', { className: 'fas fa-star' }),
                                    React.createElement('span', null,
                                        sellerRatingSummary.count > 0
                                            ? `${sellerRatingSummary.average} (${sellerRatingSummary.count} review${sellerRatingSummary.count === 1 ? '' : 's'})`
                                            : 'No ratings yet'
                                    )
                                ),
                                currentUser && currentUser.id !== product.sellerId && React.createElement('button', {
                                    className: 'btn btn-outline btn-sm',
                                    onClick: handleRateSeller
                                },
                                    React.createElement('i', { className: 'fas fa-star' }),
                                    ' Rate Seller'
                                )
                            )
                        )
                    )
                )
            )
        ),

        isImageModalOpen && React.createElement('div', {
            className: 'image-modal',
            onClick: () => setIsImageModalOpen(false)
        },
            React.createElement('div', { className: 'image-modal-content' },
                React.createElement('button', {
                    className: 'close-modal',
                    onClick: () => setIsImageModalOpen(false)
                }, React.createElement('i', { className: 'fas fa-times' })),
                React.createElement('img', {
                    src: images[currentImageIndex],
                    alt: product.title
                })
            )
        ),

        isChatOpen && chatParticipant?.id && React.createElement(ChatModal, {
            product,
            currentUser,
            participant: chatParticipant,
            initialDraft: `Hi ${chatParticipant?.name || 'there'}, I want to proceed with this purchase. Is it still available?`,
            onProductUpdate,
            onClose: () => setIsChatOpen(false)
        })
    );
};
