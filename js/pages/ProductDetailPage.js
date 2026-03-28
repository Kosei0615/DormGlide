const ProductDetailPage = ({ product, onNavigate, currentUser, onShowAuth, onProductUpdate }) => {
    const [isImageModalOpen, setIsImageModalOpen] = React.useState(false);
    const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
    const [isSaved, setIsSaved] = React.useState(false);
    const [isChatOpen, setIsChatOpen] = React.useState(false);
    const [sellerProfile, setSellerProfile] = React.useState(null);
    const [sellerRatingSummary, setSellerRatingSummary] = React.useState({ average: 0, count: 0 });
    const [isSavingStatus, setIsSavingStatus] = React.useState(false);

    if (!product) {
        return React.createElement('div', { className: 'product-detail-page' },
            React.createElement('div', { className: 'error-state' },
                React.createElement('i', { className: 'fas fa-exclamation-triangle' }),
                React.createElement('h2', null, 'Product not found'),
                React.createElement('p', null, 'The product you\'re looking for doesn\'t exist or has been removed.'),
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

    React.useEffect(() => {
        if (currentUser && product && window.DormGlideAuth) {
            const favorited = window.DormGlideAuth.isProductFavorited
                ? window.DormGlideAuth.isProductFavorited(currentUser.id, product.id)
                : window.DormGlideAuth.getUserActivity(currentUser.id).favorites.some(f => f.productId === product.id);
            setIsSaved(favorited);
        } else {
            setIsSaved(false);
        }
    }, [currentUser, product ? product.id : null]);

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
        if (currentUser) {
            return true;
        }
        alert(message || 'Please log in or create an account to continue.');
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
            alert('Seller information is missing for this listing.');
            return;
        }
        if (currentUser.id === product.sellerId) {
            alert('This is your own listing.');
            return;
        }
        setIsChatOpen(true);
    };

    const handleBuyNow = () => {
        if (!ensureAuthenticated('Log in to start the purchase flow.')) return;
        if (String(product?.status || 'active').toLowerCase() === 'sold') {
            alert('This item is already marked as sold.');
            return;
        }
        if (!product?.sellerId) {
            alert('Seller information is missing for this listing.');
            return;
        }
        if (currentUser.id === product.sellerId) {
            alert('This is your own listing.');
            return;
        }

        setIsChatOpen(true);
    };

    const saveProductStatus = async (nextStatus) => {
        if (!currentUser?.id || currentUser.id !== product?.sellerId) return;
        if (!window.DormGlideStorage?.updateProduct) {
            alert('Listing update service is unavailable right now.');
            return;
        }

        const normalized = String(nextStatus || '').toLowerCase();
        const now = new Date().toISOString();
        const updates = normalized === 'sold'
            ? {
                ...product,
                status: 'sold',
                requestedAt: product?.requestedAt || now,
                soldAt: product?.soldAt || now,
                sellerConfirmedAt: now
            }
            : {
                ...product,
                status: 'active',
                requestedAt: null,
                soldAt: null,
                buyerId: null,
                soldMethod: null,
                buyerConfirmedAt: null,
                sellerConfirmedAt: null
            };

        setIsSavingStatus(true);
        try {
            const updated = await window.DormGlideStorage.updateProduct(product.id, updates);
            if (updated && onProductUpdate) {
                onProductUpdate(updated);
            }
            alert(normalized === 'sold' ? 'Listing marked as sold.' : 'Listing is available again.');
        } catch (error) {
            console.error('[DormGlide] Failed updating listing status:', error);
            alert(error?.message || 'Unable to update listing status right now.');
        } finally {
            setIsSavingStatus(false);
        }
    };

    const listingStatus = String(product?.status || 'active').toLowerCase();
    const isSellerOwner = Boolean(currentUser?.id && product?.sellerId && currentUser.id === product.sellerId);
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
            at: product?.sellerConfirmedAt || product?.soldAt
        }
    ];

    const handleToggleSave = () => {
        if (!ensureAuthenticated('Log in to mark this item as a favorite.')) return;
        if (!window.DormGlideAuth) {
            alert('Favorites are not available at the moment.');
            return;
        }

        if (isSaved) {
            window.DormGlideAuth.removeFromFavorites(currentUser.id, product.id);
            setIsSaved(false);
            alert('Removed from your saved items.');
        } else {
            const result = window.DormGlideAuth.addToFavorites(currentUser.id, product.id, product.title);
            if (result.success) {
                setIsSaved(true);
                if (confirm('Saved to your favorites! Open your dashboard now?')) {
                    onNavigate('dashboard');
                }
            } else {
                alert(result.message || 'Unable to save this item right now.');
            }
        }
    };

    const handleRateSeller = async () => {
        if (!ensureAuthenticated('Please log in to rate this seller.')) return;
        if (!product?.sellerId || currentUser?.id === product.sellerId) {
            alert('You cannot rate your own listing.');
            return;
        }
        if (!window.DormGlideAuth?.submitSellerRating) {
            alert('Rating service is unavailable right now.');
            return;
        }

        const raw = window.prompt('Rate this seller from 1 to 5 stars (e.g. 5):');
        if (raw === null) return;
        const rating = Number(raw);
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
            alert('Please enter a number between 1 and 5.');
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
                alert(result.message || 'Unable to submit rating right now.');
                return;
            }

            setSellerRatingSummary(result.summary || { average: rating, count: 1 });
            alert('Thanks! Your seller rating has been submitted.');
        } catch (error) {
            console.error('[DormGlide] Failed to submit seller rating:', error);
            alert('Unable to submit rating right now.');
        }
    };

    const images = product.images && product.images.length > 0 ? product.images : [product.image || 'https://via.placeholder.com/600x400?text=No+Image'];

    return React.createElement('div', { className: 'product-detail-page' },
        React.createElement('div', { className: 'product-detail-container' },
            // Back button
            React.createElement('button', {
                className: 'back-btn',
                onClick: () => onNavigate('home')
            },
                React.createElement('i', { className: 'fas fa-arrow-left' }),
                'Back to Browse'
            ),

            React.createElement('div', { className: 'product-detail-content' },
                // Product Images
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
                            },
                                React.createElement('i', { className: 'fas fa-chevron-left' })
                            ),
                            React.createElement('span', null, `${currentImageIndex + 1} / ${images.length}`),
                            React.createElement('button', {
                                onClick: () => setCurrentImageIndex(Math.min(images.length - 1, currentImageIndex + 1)),
                                disabled: currentImageIndex === images.length - 1
                            },
                                React.createElement('i', { className: 'fas fa-chevron-right' })
                            )
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

                // Product Info
                React.createElement('div', { className: 'product-info-detail' },
                    React.createElement('div', { className: 'product-header' },
                        React.createElement('h1', null, product.title),
                        React.createElement('div', { className: 'product-price-large' }, formatPrice(product.price)),
                        React.createElement('div', { className: `listing-status-badge listing-status-${listingStatus}` },
                            listingStatus === 'sold' ? 'Sold' : 'Available'
                        ),
                        React.createElement('div', { className: 'product-badges' },
                            React.createElement('span', {
                                className: `condition-badge condition-${product.condition.toLowerCase()}`
                            }, product.condition),
                            React.createElement('span', { className: 'category-badge' },
                                React.createElement('i', { className: 'fas fa-tag' }),
                                product.category
                            )
                        )
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
                            product.contactInfo && React.createElement('div', { className: 'detail-item' },
                                React.createElement('i', { className: 'fas fa-phone' }),
                                React.createElement('span', null, 'Contact: ', product.contactInfo)
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
                                        React.createElement('i', { className: completed ? 'fas fa-check' : 'fas fa-circle' })
                                    ),
                                    React.createElement('div', { className: 'deal-timeline-content' },
                                        React.createElement('h4', null, step.label),
                                        React.createElement('p', null, formatTimelineDate(step.at))
                                    )
                                );
                            })
                        )
                    ),

                    // Seller Info
                    React.createElement('div', { className: 'seller-info' },
                        React.createElement('h3', null, 'Seller Information'),
                        React.createElement('div', { className: 'seller-card' },
                            React.createElement('div', { className: 'seller-avatar' },
                                React.createElement('i', { className: 'fas fa-user-circle' })
                            ),
                            React.createElement('div', { className: 'seller-details' },
                                React.createElement('h4', null, product.sellerName),
                                React.createElement('p', null, product.sellerEmail || 'Student at University'),
                                React.createElement('div', { className: 'seller-rating' },
                                    React.createElement('i', { className: 'fas fa-star' }),
                                    React.createElement('span', null,
                                        sellerRatingSummary.count > 0
                                            ? `${sellerRatingSummary.average} (${sellerRatingSummary.count} review${sellerRatingSummary.count === 1 ? '' : 's'})`
                                            : 'No ratings yet'
                                    )
                                ),
                                product.contactInfo && React.createElement('p', { className: 'seller-contact' },
                                    React.createElement('i', { className: 'fas fa-comment-dots' }),
                                    ' Preferred contact: ', product.contactInfo
                                ),
                                chatParticipant?.phone && React.createElement('p', { className: 'seller-contact' },
                                    React.createElement('i', { className: 'fas fa-phone' }),
                                    ' Phone: ', window.DormGlideAuth?.formatPhoneNumberReadable?.(chatParticipant.phone) || chatParticipant.phone
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
                    ),

                    // Action Buttons
                    React.createElement('div', { className: 'product-actions' },
                        React.createElement('button', {
                            className: 'btn btn-primary btn-large',
                            onClick: handleBuyNow,
                            disabled: listingStatus === 'sold' || isSellerOwner
                        },
                            React.createElement('i', { className: 'fas fa-shopping-cart' }),
                            listingStatus === 'sold' ? 'Sold Out' : (isSellerOwner ? 'Your Listing' : 'Proceed to Purchase')
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
                            onClick: () => saveProductStatus(listingStatus === 'sold' ? 'active' : 'sold'),
                            disabled: isSavingStatus
                        },
                            React.createElement('i', { className: listingStatus === 'sold' ? 'fas fa-rotate-left' : 'fas fa-check-circle' }),
                            isSavingStatus
                                ? 'Saving...'
                                : (listingStatus === 'sold' ? 'Mark as Available' : 'Mark as Sold')
                        )
                    )
                )
            )
        ),

        // Image Modal
        isImageModalOpen && React.createElement('div', {
            className: 'image-modal',
            onClick: () => setIsImageModalOpen(false)
        },
            React.createElement('div', { className: 'image-modal-content' },
                React.createElement('button', {
                    className: 'close-modal',
                    onClick: () => setIsImageModalOpen(false)
                },
                    React.createElement('i', { className: 'fas fa-times' })
                ),
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
