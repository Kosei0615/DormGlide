// User Dashboard Component - Shows user activity and history
const UserDashboard = ({ currentUser, onNavigate, initialTab = 'overview', onListingDeleted }) => {
    const [activeTab, setActiveTab] = React.useState(initialTab);
    const [activity, setActivity] = React.useState(null);
    const [products, setProducts] = React.useState([]);
    const [allProducts, setAllProducts] = React.useState([]);
    const [chatContext, setChatContext] = React.useState(null);
    const [chatConversations, setChatConversations] = React.useState([]);
    const [purchaseRequests, setPurchaseRequests] = React.useState([]);
    const [updatingListingId, setUpdatingListingId] = React.useState(null);
    const [wishlistListingIds, setWishlistListingIds] = React.useState([]);
    const [keywordAlerts, setKeywordAlerts] = React.useState([]);
    const [newKeyword, setNewKeyword] = React.useState('');
    const [savingKeyword, setSavingKeyword] = React.useState(false);
    const toast = window.DormGlideToast || {
        success: () => {},
        error: () => {},
        warning: () => {},
        info: () => {}
    };

    React.useEffect(() => {
        setActiveTab(initialTab || 'overview');
    }, [initialTab]);

    React.useEffect(() => {
        let isMounted = true;

        const loadDashboardData = async () => {
            if (!currentUser) {
                if (isMounted) {
                    setActivity(null);
                    setProducts([]);
                }
                return;
            }

            try {
                if (window.DormGlideAuth && typeof window.DormGlideAuth.getUserActivity === 'function') {
                    const userActivity = await window.DormGlideAuth.getUserActivity(currentUser.id);
                    if (isMounted) {
                        setActivity(userActivity);
                    }
                }

                if (typeof getProductsFromStorage !== 'undefined') {
                    const productsFromStorage = await getProductsFromStorage();
                    const userProds = (productsFromStorage || []).filter(p => p.sellerId === currentUser.id);
                    if (isMounted) {
                        setProducts(userProds);
                        setAllProducts(productsFromStorage || []);
                    }
                }

                if (window.DormGlideChat && typeof window.DormGlideChat.fetchConversations === 'function') {
                    try {
                        const conversations = await window.DormGlideChat.fetchConversations(currentUser.id);
                        if (isMounted) {
                            setChatConversations(conversations || []);
                        }
                    } catch (error) {
                        console.warn('[DormGlide] Failed to fetch Supabase chat conversations for dashboard:', error);
                        if (isMounted) {
                            setChatConversations([]);
                        }
                    }
                }

                if (window.DormGlideStorage?.fetchPurchaseRequestsForUser) {
                    const requests = await window.DormGlideStorage.fetchPurchaseRequestsForUser(currentUser.id);
                    if (isMounted) {
                        setPurchaseRequests(Array.isArray(requests) ? requests : []);
                    }
                }

                if (window.DormGlidePersonalization?.fetchWishlistListingIds) {
                    try {
                        const ids = await window.DormGlidePersonalization.fetchWishlistListingIds(currentUser.id);
                        if (isMounted) {
                            setWishlistListingIds(Array.isArray(ids) ? ids : []);
                        }
                    } catch (error) {
                        console.warn('[DormGlide] Failed to load wishlist ids:', error);
                        if (isMounted) {
                            setWishlistListingIds([]);
                        }
                    }
                }

                if (window.DormGlidePersonalization?.fetchKeywordAlerts) {
                    try {
                        const alerts = await window.DormGlidePersonalization.fetchKeywordAlerts(currentUser.id);
                        if (isMounted) {
                            setKeywordAlerts(Array.isArray(alerts) ? alerts : []);
                        }
                    } catch (error) {
                        console.warn('[DormGlide] Failed to load keyword alerts:', error);
                        if (isMounted) {
                            setKeywordAlerts([]);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load dashboard data:', error);
            }
        };

        loadDashboardData();

        return () => {
            isMounted = false;
        };
    }, [currentUser]);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatTimelineDate = (dateString) => {
        if (!dateString) return 'Pending';
        return new Date(dateString).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatSoldDate = (dateString) => {
        if (!dateString) return 'Sold recently';
        return `Sold on ${new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })}`;
    };

    const calculateTotalEarnings = () => {
        const completedSales = getCompletedSales();
        return completedSales.reduce((total, sale) => total + (sale.price || 0), 0);
    };

    const getCompletedSales = () => {
        if (!activity?.sales) return [];
        return activity.sales.filter((sale) => {
            if (!sale) return false;
            return sale.status === 'completed';
        });
    };

    const calculateTotalSpent = () => {
        if (!activity || !activity.purchases) return 0;
        return activity.purchases.reduce((total, purchase) => total + (purchase.price || 0), 0);
    };

    const refreshListings = async () => {
        if (typeof getProductsFromStorage === 'undefined' || !currentUser?.id) return;
        const productsFromStorage = await getProductsFromStorage();
        const userProds = (productsFromStorage || []).filter((p) => p.sellerId === currentUser.id);
        setProducts(userProds);
        setAllProducts(productsFromStorage || []);
    };

    const refreshWishlist = async () => {
        if (!currentUser?.id || !window.DormGlidePersonalization?.fetchWishlistListingIds) return;
        const ids = await window.DormGlidePersonalization.fetchWishlistListingIds(currentUser.id);
        setWishlistListingIds(Array.isArray(ids) ? ids : []);
    };

    const refreshKeywordAlerts = async () => {
        if (!currentUser?.id || !window.DormGlidePersonalization?.fetchKeywordAlerts) return;
        const alerts = await window.DormGlidePersonalization.fetchKeywordAlerts(currentUser.id);
        setKeywordAlerts(Array.isArray(alerts) ? alerts : []);
    };

    const refreshPurchaseRequests = async () => {
        if (!currentUser?.id || !window.DormGlideStorage?.fetchPurchaseRequestsForUser) return;
        const requests = await window.DormGlideStorage.fetchPurchaseRequestsForUser(currentUser.id);
        setPurchaseRequests(Array.isArray(requests) ? requests : []);
    };

    const handleRequestDecision = async (request, decision) => {
        if (!request?.id || !request?.listingId || !window.DormGlideStorage?.respondToPurchaseRequest) {
            toast.error('Purchase request service is unavailable right now.');
            return;
        }

        setUpdatingListingId(request.listingId);
        try {
            await window.DormGlideStorage.respondToPurchaseRequest({
                listingId: request.listingId,
                purchaseRequestId: request.id,
                decision,
                buyerId: request.buyerId || null
            });
            await refreshListings();
            await refreshPurchaseRequests();
            toast.success(decision === 'accepted' ? 'Purchase request accepted.' : 'Purchase request declined.');
        } catch (error) {
            console.error('[DormGlide] Failed responding to dashboard purchase request:', error);
            toast.error('Unable to update this request right now.');
        } finally {
            setUpdatingListingId(null);
        }
    };

    const handleListingStatusUpdate = async (product, nextStatus) => {
        if (!product?.id || !window.DormGlideStorage?.updateProduct) {
            toast.error('Listing update service is unavailable right now.');
            return;
        }

        setUpdatingListingId(product.id);
        const now = new Date().toISOString();
        const updates = String(nextStatus).toLowerCase() === 'sold'
            ? null
            : {
                ...product,
                status: 'available',
                requestedAt: null,
                purchasedAt: null,
                soldAt: null,
                buyerId: null,
                soldMethod: null,
                buyerConfirmedAt: null,
                sellerConfirmedAt: null
            };

        try {
            if (String(nextStatus).toLowerCase() === 'sold') {
                let pendingRequest = null;
                if (window.DormGlideStorage?.fetchPurchaseRequests) {
                    const requests = await window.DormGlideStorage.fetchPurchaseRequests(product.id);
                    pendingRequest = (requests || []).find((entry) => entry?.status === 'pending') || null;
                }

                if (window.DormGlideStorage?.confirmPurchase) {
                    await window.DormGlideStorage.confirmPurchase({
                        listingId: product.id,
                        purchaseRequestId: pendingRequest?.id || null,
                        buyerId: pendingRequest?.buyerId || product?.buyerId || null
                    });
                } else {
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
                await window.DormGlideStorage.updateProduct(product.id, updates);
                toast.success('Listing is available again.');
            }

            await refreshListings();
        } catch (error) {
            console.error('[DormGlide] Failed to update listing status from dashboard:', error);
            toast.error('Unable to update this listing right now.');
        } finally {
            setUpdatingListingId(null);
        }
    };

    const handleRelistItem = async (product) => {
        if (!product || !window.DormGlideStorage?.createProduct) {
            toast.error('Relist service is unavailable right now.');
            return;
        }

        setUpdatingListingId(product.id);
        try {
            const relisted = {
                ...product,
                id: undefined,
                status: 'available',
                requestedAt: null,
                purchasedAt: null,
                soldAt: null,
                buyerId: null,
                soldMethod: null,
                buyerConfirmedAt: null,
                sellerConfirmedAt: null,
                createdAt: new Date().toISOString()
            };
            await window.DormGlideStorage.createProduct(relisted);
            await refreshListings();
            toast.success('Item relisted as a new available listing.');
        } catch (error) {
            console.error('[DormGlide] Failed to relist item:', error);
            toast.error('Unable to relist this item right now.');
        } finally {
            setUpdatingListingId(null);
        }
    };

    const handleDeleteListing = async (listingId) => {
        if (!listingId || !currentUser?.id) return;

        const confirmed = window.confirm('Are you sure you want to delete this listing? This cannot be undone.');
        if (!confirmed) return;

        setUpdatingListingId(listingId);
        try {
            const client = window.SupabaseClient;
            if (client) {
                const tryListingsDelete = await client
                    .from('listings')
                    .delete()
                    .eq('id', listingId)
                    .eq('seller_id', currentUser.id);

                let deleteError = tryListingsDelete.error || null;
                if (deleteError) {
                    const relationMissing = String(deleteError?.message || '').toLowerCase().includes('relation')
                        && String(deleteError?.message || '').toLowerCase().includes('listings');

                    if (relationMissing) {
                        const tryProductsDelete = await client
                            .from('products')
                            .delete()
                            .eq('id', listingId)
                            .eq('seller_id', currentUser.id);
                        deleteError = tryProductsDelete.error || null;
                    }
                }

                if (deleteError) {
                    throw deleteError;
                }
            } else if (window.DormGlideStorage?.deleteProduct) {
                await window.DormGlideStorage.deleteProduct(listingId);
            }

            setProducts((prev) => prev.filter((product) => product.id !== listingId));
            setAllProducts((prev) => prev.filter((product) => product.id !== listingId));
            setWishlistListingIds((prev) => prev.filter((id) => id !== listingId));
            if (onListingDeleted) {
                onListingDeleted(listingId);
            }

            toast.success('Listing deleted successfully');
        } catch (error) {
            console.error('[DormGlide] Failed to delete listing from dashboard:', error);
            toast.error('Unable to delete this listing right now.');
        } finally {
            setUpdatingListingId(null);
        }
    };

    const wishlistProducts = React.useMemo(() => {
        if (!Array.isArray(wishlistListingIds) || wishlistListingIds.length === 0) return [];
        const lookup = new Map((allProducts || []).map((product) => [product.id, product]));
        return wishlistListingIds.map((id) => lookup.get(id)).filter(Boolean);
    }, [wishlistListingIds, allProducts]);

    const handleRemoveFromWishlist = async (listingId) => {
        if (!currentUser?.id || !listingId || !window.DormGlidePersonalization?.toggleWishlist) return;
        try {
            await window.DormGlidePersonalization.toggleWishlist(currentUser.id, listingId);
            await refreshWishlist();
            toast.success('Removed from wishlist.');
        } catch (error) {
            console.error('[DormGlide] Failed to remove from wishlist:', error);
            toast.error('Unable to update wishlist right now.');
        }
    };

    const handleAddKeywordAlert = async () => {
        if (!currentUser?.id || !window.DormGlidePersonalization?.addKeywordAlert) return;
        const keyword = String(newKeyword || '').trim();
        if (!keyword) {
            toast.warning('Please enter a keyword.');
            return;
        }

        setSavingKeyword(true);
        try {
            const result = await window.DormGlidePersonalization.addKeywordAlert({
                userId: currentUser.id,
                keyword,
                notifyInApp: true,
                notifyEmail: true
            });

            if (!result?.success) {
                toast.warning(result?.message || 'Unable to save keyword alert.');
                return;
            }

            setNewKeyword('');
            await refreshKeywordAlerts();
            toast.success('Keyword alert saved.');
        } catch (error) {
            console.error('[DormGlide] Failed to create keyword alert:', error);
            toast.error('Unable to save keyword alert right now.');
        } finally {
            setSavingKeyword(false);
        }
    };

    const handleDeleteKeywordAlert = async (alertId) => {
        if (!currentUser?.id || !alertId || !window.DormGlidePersonalization?.deleteKeywordAlert) return;
        try {
            await window.DormGlidePersonalization.deleteKeywordAlert({ userId: currentUser.id, alertId });
            await refreshKeywordAlerts();
            toast.success('Alert removed.');
        } catch (error) {
            console.error('[DormGlide] Failed deleting keyword alert:', error);
            toast.error('Unable to remove alert right now.');
        }
    };

    const renderOverviewTab = () => {
        const activeListings = products.filter((product) => {
            const statusRaw = String(product?.status || 'available').toLowerCase();
            const status = statusRaw === 'active' ? 'available' : statusRaw;
            return status === 'available' || status === 'pending';
        });

        const soldListings = products.filter((product) => {
            const statusRaw = String(product?.status || 'available').toLowerCase();
            const status = statusRaw === 'active' ? 'available' : statusRaw;
            return status === 'sold';
        });

        return React.createElement('div', { className: 'dashboard-overview' },
            React.createElement('div', { className: 'stats-grid' },
                React.createElement('div', { className: 'stat-card' },
                    React.createElement('div', { className: 'stat-icon', style: { background: '#e3f2fd' } },
                        React.createElement('i', { className: 'fas fa-eye', style: { color: '#2196f3' } })
                    ),
                    React.createElement('div', { className: 'stat-info' },
                        React.createElement('h3', null, activity?.views?.length || 0),
                        React.createElement('p', null, 'Items Viewed')
                    )
                ),

                React.createElement('div', { className: 'stat-card' },
                    React.createElement('div', { className: 'stat-icon', style: { background: '#f3e5f5' } },
                        React.createElement('i', { className: 'fas fa-heart', style: { color: '#9c27b0' } })
                    ),
                    React.createElement('div', { className: 'stat-info' },
                        React.createElement('h3', null, activity?.favorites?.length || 0),
                        React.createElement('p', null, 'Favorites')
                    )
                ),

                React.createElement('div', { className: 'stat-card' },
                    React.createElement('div', { className: 'stat-icon', style: { background: '#e3f2fd' } },
                        React.createElement('i', { className: 'fas fa-comment', style: { color: '#1976d2' } })
                    ),
                    React.createElement('div', { className: 'stat-info' },
                        React.createElement('h3', null, activity?.messages?.length || 0),
                        React.createElement('p', null, 'Conversations')
                    )
                ),

                React.createElement('div', { className: 'stat-card' },
                    React.createElement('div', { className: 'stat-icon', style: { background: '#e8f5e9' } },
                        React.createElement('i', { className: 'fas fa-shopping-bag', style: { color: '#4caf50' } })
                    ),
                    React.createElement('div', { className: 'stat-info' },
                        React.createElement('h3', null, activity?.purchases?.length || 0),
                        React.createElement('p', null, 'Purchases')
                    )
                ),

                React.createElement('div', { className: 'stat-card' },
                    React.createElement('div', { className: 'stat-icon', style: { background: '#fff3e0' } },
                        React.createElement('i', { className: 'fas fa-dollar-sign', style: { color: '#ff9800' } })
                    ),
                    React.createElement('div', { className: 'stat-info' },
                        React.createElement('h3', null, `$${calculateTotalSpent()}`),
                        React.createElement('p', null, 'Total Spent')
                    )
                ),

                React.createElement('div', { className: 'stat-card' },
                    React.createElement('div', { className: 'stat-icon', style: { background: '#fce4ec' } },
                        React.createElement('i', { className: 'fas fa-tag', style: { color: '#e91e63' } })
                    ),
                    React.createElement('div', { className: 'stat-info' },
                        React.createElement('h3', null, products.length),
                        React.createElement('p', null, 'Items Listed')
                    )
                ),

                React.createElement('div', { className: 'stat-card' },
                    React.createElement('div', { className: 'stat-icon', style: { background: '#e0f2f1' } },
                        React.createElement('i', { className: 'fas fa-check-circle', style: { color: '#009688' } })
                    ),
                    React.createElement('div', { className: 'stat-info' },
                        React.createElement('h3', null, getCompletedSales().length),
                        React.createElement('p', null, 'Items Sold')
                    )
                ),

                React.createElement('div', { className: 'stat-card' },
                    React.createElement('div', { className: 'stat-icon', style: { background: '#f1f8e9' } },
                        React.createElement('i', { className: 'fas fa-coins', style: { color: '#8bc34a' } })
                    ),
                    React.createElement('div', { className: 'stat-info' },
                        React.createElement('h3', null, `$${calculateTotalEarnings()}`),
                        React.createElement('p', null, 'Total Earned')
                    )
                ),

                React.createElement('div', { className: 'stat-card' },
                    React.createElement('div', { className: 'stat-icon', style: { background: '#fff9c4' } },
                        React.createElement('i', { className: 'fas fa-star', style: { color: '#fbc02d' } })
                    ),
                    React.createElement('div', { className: 'stat-info' },
                        React.createElement('h3', null, currentUser?.rating || '5.0'),
                        React.createElement('p', null, 'User Rating')
                    )
                )
            ),

            React.createElement('div', { className: 'recent-activity' },
                React.createElement('h3', null, 'Recent Activity'),
                
                activity?.views && activity.views.length > 0 ? (
                    React.createElement('div', { className: 'activity-list' },
                        activity.views.slice(0, 5).map((view, index) =>
                            React.createElement('div', { key: index, className: 'activity-item' },
                                React.createElement('div', { className: 'activity-icon' },
                                    React.createElement('i', { className: 'fas fa-eye' })
                                ),
                                React.createElement('div', { className: 'activity-content' },
                                    React.createElement('p', null, `Viewed "${view.productTitle}"`),
                                    React.createElement('span', { className: 'activity-time' }, formatDate(view.timestamp))
                                )
                            )
                        )
                    )
                ) : (
                    React.createElement('div', { className: 'empty-state' },
                        React.createElement('i', { className: 'fas fa-history' }),
                        React.createElement('p', null, 'No recent activity'),
                        React.createElement('button', {
                            className: 'btn btn-primary',
                            onClick: () => onNavigate('home')
                        }, 'Start Browsing')
                    )
                )
            ),

            React.createElement('div', { className: 'recent-activity' },
                React.createElement('h3', null, 'Active Listings'),
                activeListings.length === 0
                    ? React.createElement('div', { className: 'empty-state' },
                        React.createElement('i', { className: 'fas fa-tag' }),
                        React.createElement('p', null, 'You have no active listings yet.')
                    )
                    : React.createElement('div', { className: 'activity-list' },
                        activeListings.slice(0, 6).map((product) => {
                            const statusRaw = String(product.status || 'available').toLowerCase();
                            const status = statusRaw === 'active' ? 'available' : statusRaw;
                            const isBusy = updatingListingId === product.id;
                            return React.createElement('div', { key: product.id, className: 'message-thread' },
                                React.createElement('div', { className: 'message-thread-avatar' },
                                    React.createElement('i', { className: 'fas fa-box' })
                                ),
                                React.createElement('div', { className: 'message-thread-content' },
                                    React.createElement('h4', null, product.title),
                                    React.createElement('p', { className: 'message-thread-product' }, `$${product.price || 0}`),
                                    React.createElement('span', { className: `message-thread-badge listing-status-${status}` },
                                        React.createElement('span', { className: 'status-dot' }),
                                        status === 'pending' ? 'Pending' : 'Available'
                                    ),
                                    React.createElement('div', { className: 'dashboard-timeline-mini' },
                                        React.createElement('span', { className: product?.requestedAt ? 'done' : '' }, `Requested: ${formatTimelineDate(product?.requestedAt)}`),
                                        React.createElement('span', { className: product?.buyerConfirmedAt ? 'done' : '' }, `Buyer confirmed: ${formatTimelineDate(product?.buyerConfirmedAt)}`),
                                        React.createElement('span', { className: (product?.sellerConfirmedAt || product?.soldAt) ? 'done' : '' }, `Seller confirmed: ${formatTimelineDate(product?.sellerConfirmedAt || product?.soldAt)}`)
                                    )
                                ),
                                React.createElement('div', { className: 'message-thread-meta' },
                                    React.createElement('button', {
                                        className: 'btn btn-sm btn-secondary',
                                        onClick: () => onNavigate('product-detail', product.id)
                                    }, React.createElement('i', { className: 'fas fa-up-right-from-square' }), 'Open'),
                                    React.createElement('button', {
                                        className: 'btn btn-sm btn-danger btn-delete-listing',
                                        title: 'Delete listing',
                                        'aria-label': 'Delete listing',
                                        onClick: () => handleDeleteListing(product.id),
                                        disabled: isBusy
                                    },
                                        React.createElement('i', { className: isBusy ? 'fas fa-spinner fa-spin' : 'fa-solid fa-trash' }),
                                        isBusy ? 'Deleting...' : 'Delete'
                                    ),
                                    React.createElement('button', {
                                        className: `btn btn-sm ${status === 'sold' ? 'btn-outline' : 'btn-danger'}`,
                                        onClick: () => handleListingStatusUpdate(product, status === 'sold' ? 'available' : 'sold'),
                                        disabled: isBusy
                                    },
                                        React.createElement('i', { className: isBusy ? 'fas fa-spinner fa-spin' : 'fas fa-circle-check' }),
                                        isBusy ? 'Saving...' : 'Confirm Purchase'
                                    )
                                )
                            );
                        })
                    ),
                React.createElement('h3', { className: 'sold-items-title' }, 'Sold Items'),
                soldListings.length === 0
                    ? React.createElement('div', { className: 'empty-state' },
                        React.createElement('i', { className: 'fas fa-box-open' }),
                        React.createElement('p', null, 'No sold items yet.')
                    )
                    : React.createElement('div', { className: 'sold-items-grid' },
                        soldListings.map((product) => {
                            const buyerName = product?.buyerId
                                ? (window.DormGlideAuth?.getUserById?.(product.buyerId)?.name || 'Buyer info unavailable')
                                : 'Buyer info unavailable';
                            const isBusy = updatingListingId === product.id;
                            return React.createElement('div', { key: `sold-${product.id}`, className: 'sold-item-card' },
                                React.createElement('div', { className: 'sold-item-image-wrap' },
                                    React.createElement('img', {
                                        className: 'sold-item-image',
                                        src: product.image || 'https://via.placeholder.com/300x200?text=No+Image',
                                        alt: product.title
                                    }),
                                    React.createElement('span', { className: 'sold-item-banner' }, 'SOLD')
                                ),
                                React.createElement('div', { className: 'sold-item-body' },
                                    React.createElement('h4', null, product.title),
                                    React.createElement('p', { className: 'message-thread-product' }, `$${product.price || 0}`),
                                    React.createElement('p', { className: 'sold-item-meta' }, formatSoldDate(product.purchasedAt || product.soldAt)),
                                    React.createElement('p', { className: 'sold-item-meta' }, `Buyer: ${buyerName}`),
                                    React.createElement('div', { className: 'sold-item-actions' },
                                        React.createElement('button', {
                                            className: 'btn btn-sm btn-secondary',
                                            onClick: () => onNavigate('product-detail', product.id)
                                        }, React.createElement('i', { className: 'fas fa-up-right-from-square' }), 'Open'),
                                        React.createElement('button', {
                                            className: 'btn btn-sm btn-danger btn-delete-listing',
                                            title: 'Delete listing',
                                            'aria-label': 'Delete listing',
                                            onClick: () => handleDeleteListing(product.id),
                                            disabled: isBusy
                                        },
                                            React.createElement('i', { className: isBusy ? 'fas fa-spinner fa-spin' : 'fa-solid fa-trash' }),
                                            isBusy ? 'Deleting...' : 'Delete'
                                        ),
                                        React.createElement('button', {
                                            className: 'btn btn-sm btn-primary',
                                            onClick: () => handleRelistItem(product),
                                            disabled: isBusy
                                        },
                                            React.createElement('i', { className: isBusy ? 'fas fa-spinner fa-spin' : 'fas fa-plus' }),
                                            isBusy ? 'Relisting...' : 'Relist Item'
                                        )
                                    )
                                )
                            );
                        })
                    )
            )
        );
    };

    const renderPurchasesTab = () => {
        const outgoingRequests = (purchaseRequests || [])
            .filter((entry) => entry?.buyerId === currentUser?.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (outgoingRequests.length > 0) {
            return React.createElement('div', { className: 'purchases-list' },
                React.createElement('h3', null, 'Purchase Requests'),
                React.createElement('div', { className: 'activity-list' },
                    outgoingRequests.map((request) => {
                        const listing = allProducts.find((product) => product.id === request.listingId);
                        return React.createElement('div', { key: request.id, className: 'purchase-item' },
                            React.createElement('div', { className: 'purchase-icon' },
                                React.createElement('i', { className: request.status === 'accepted' ? 'fas fa-circle-check' : (request.status === 'declined' ? 'fas fa-circle-xmark' : 'fas fa-hourglass-half') })
                            ),
                            React.createElement('div', { className: 'purchase-details' },
                                React.createElement('h4', null, listing?.title || 'Listing'),
                                React.createElement('p', { className: 'purchase-price' }, `$${listing?.price || 0}`),
                                React.createElement('span', { className: 'purchase-date' }, formatDate(request.createdAt))
                            ),
                            React.createElement('div', { className: 'purchase-status' },
                                React.createElement('span', {
                                    className: `status-badge ${request.status}`
                                }, request.status)
                            )
                        );
                    })
                )
            );
        }

        if (!activity?.purchases || activity.purchases.length === 0) {
            return React.createElement('div', { className: 'empty-state' },
                React.createElement('i', { className: 'fas fa-shopping-bag' }),
                React.createElement('h3', null, 'No purchases yet'),
                React.createElement('p', null, 'Items you buy will appear here'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => onNavigate('home')
                }, 'Browse Items')
            );
        }

        return React.createElement('div', { className: 'purchases-list' },
            React.createElement('h3', null, 'Purchase History'),
            React.createElement('div', { className: 'activity-list' },
                activity.purchases.map((purchase, index) =>
                    React.createElement('div', { key: index, className: 'purchase-item' },
                        React.createElement('div', { className: 'purchase-icon' },
                            React.createElement('i', { className: 'fas fa-check-circle' })
                        ),
                        React.createElement('div', { className: 'purchase-details' },
                            React.createElement('h4', null, purchase.productTitle),
                            React.createElement('p', { className: 'purchase-price' }, `$${purchase.price}`),
                            React.createElement('span', { className: 'purchase-date' }, formatDate(purchase.timestamp))
                        ),
                        React.createElement('div', { className: 'purchase-status' },
                            React.createElement('span', { 
                                className: `status-badge ${purchase.status}` 
                            }, purchase.status)
                        )
                    )
                )
            ),
            React.createElement('div', { className: 'total-spent' },
                React.createElement('h3', null, 'Total Spent: '),
                React.createElement('span', { className: 'amount' }, `$${calculateTotalSpent()}`)
            )
        );
    };

    const renderSalesTab = () => {
        const incomingRequests = (purchaseRequests || [])
            .filter((entry) => entry?.sellerId === currentUser?.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (incomingRequests.length > 0) {
            return React.createElement('div', { className: 'sales-list' },
                React.createElement('h3', null, 'Incoming Purchase Requests'),
                React.createElement('div', { className: 'activity-list' },
                    incomingRequests.map((request) => {
                        const listing = allProducts.find((product) => product.id === request.listingId);
                        const buyer = request?.buyerId ? window.DormGlideAuth?.getUserById?.(request.buyerId) : null;
                        const isBusy = updatingListingId === request.listingId;
                        return React.createElement('div', { key: request.id, className: 'sale-item' },
                            React.createElement('div', { className: 'sale-icon' },
                                React.createElement('i', { className: request.status === 'accepted' ? 'fas fa-circle-check' : (request.status === 'declined' ? 'fas fa-circle-xmark' : 'fas fa-hourglass-half') })
                            ),
                            React.createElement('div', { className: 'sale-details' },
                                React.createElement('h4', null, listing?.title || 'Listing'),
                                React.createElement('p', { className: 'sale-price' }, `Buyer: ${buyer?.name || request.buyerId || 'Unknown'}`),
                                React.createElement('span', { className: 'sale-date' }, formatDate(request.createdAt))
                            ),
                            React.createElement('div', { className: 'sale-status' },
                                React.createElement('span', {
                                    className: `status-badge ${request.status}`
                                }, request.status),
                                request.status === 'pending' && React.createElement('div', { className: 'seller-request-actions' },
                                    React.createElement('button', {
                                        className: 'btn btn-sm btn-primary icon-btn',
                                        title: 'Accept request',
                                        'aria-label': 'Accept purchase request',
                                        onClick: () => handleRequestDecision(request, 'accepted'),
                                        disabled: isBusy
                                    }, React.createElement('i', { className: isBusy ? 'fas fa-spinner fa-spin' : 'fa-solid fa-check' })),
                                    React.createElement('button', {
                                        className: 'btn btn-sm btn-danger icon-btn danger',
                                        title: 'Decline request',
                                        'aria-label': 'Decline purchase request',
                                        onClick: () => handleRequestDecision(request, 'declined'),
                                        disabled: isBusy
                                    }, React.createElement('i', { className: 'fa-solid fa-xmark' }))
                                )
                            )
                        );
                    })
                )
            );
        }

        const completedSales = getCompletedSales();

        if (completedSales.length === 0) {
            return React.createElement('div', { className: 'empty-state' },
                React.createElement('i', { className: 'fas fa-tag' }),
                React.createElement('h3', null, 'No sales yet'),
                React.createElement('p', null, 'Start selling to see your sales here'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => onNavigate('sell')
                }, 'List an Item')
            );
        }

        return React.createElement('div', { className: 'sales-list' },
            React.createElement('h3', null, 'Sales History'),
            React.createElement('div', { className: 'activity-list' },
                completedSales.map((sale, index) =>
                    React.createElement('div', { key: index, className: 'sale-item' },
                        React.createElement('div', { className: 'sale-icon' },
                            React.createElement('i', { className: 'fas fa-dollar-sign' })
                        ),
                        React.createElement('div', { className: 'sale-details' },
                            React.createElement('h4', null, sale.productTitle),
                            React.createElement('p', { className: 'sale-price' }, `Sold for $${sale.price}`),
                            React.createElement('span', { className: 'sale-date' }, formatDate(sale.timestamp))
                        ),
                        React.createElement('div', { className: 'sale-status' },
                            React.createElement('span', { 
                                className: `status-badge ${sale.status}` 
                            }, sale.status)
                        )
                    )
                )
            ),
            React.createElement('div', { className: 'total-earned' },
                React.createElement('h3', null, 'Total Earned: '),
                React.createElement('span', { className: 'amount success' }, `$${calculateTotalEarnings()}`)
            )
        );
    };

    const renderFavoritesTab = () => {
        if (!activity?.favorites || activity.favorites.length === 0) {
            return React.createElement('div', { className: 'empty-state' },
                React.createElement('i', { className: 'fas fa-heart' }),
                React.createElement('h3', null, 'No favorites yet'),
                React.createElement('p', null, 'Save items you like to find them easily later'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => onNavigate('home')
                }, 'Browse Items')
            );
        }

        return React.createElement('div', { className: 'favorites-list' },
            React.createElement('h3', null, 'Your Favorites'),
            React.createElement('div', { className: 'favorites-grid' },
                activity.favorites.map((favorite, index) =>
                    React.createElement('div', { key: index, className: 'favorite-card' },
                        React.createElement('div', { className: 'favorite-icon' },
                            React.createElement('i', { className: 'fas fa-heart' })
                        ),
                        React.createElement('h4', null, favorite.productTitle),
                        React.createElement('span', { className: 'favorite-date' }, 
                            'Added ', formatDate(favorite.timestamp)
                        ),
                        React.createElement('button', {
                            className: 'btn btn-sm btn-outline icon-btn danger',
                            title: 'Remove favorite',
                            'aria-label': 'Remove favorite',
                            onClick: () => {
                                window.DormGlideAuth.removeFromFavorites(currentUser.id, favorite.productId);
                                setActivity(window.DormGlideAuth.getUserActivity(currentUser.id));
                            }
                        }, React.createElement('i', { className: 'fa-solid fa-trash' }))
                    )
                )
            )
        );
    };

    const renderWishlistTab = () => {
        if (wishlistProducts.length === 0) {
            return React.createElement('div', { className: 'empty-state' },
                React.createElement('i', { className: 'fa-regular fa-heart' }),
                React.createElement('h3', null, 'Your wishlist is empty'),
                React.createElement('p', null, 'Tap hearts on listings to save them for later.'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => onNavigate('home')
                }, 'Browse Listings')
            );
        }

        return React.createElement('div', { className: 'favorites-list' },
            React.createElement('h3', null, 'Wishlist'),
            React.createElement('div', { className: 'favorites-grid' },
                wishlistProducts.map((listing) =>
                    React.createElement('div', { key: `wishlist-${listing.id}`, className: 'favorite-card' },
                        React.createElement('div', { className: 'favorite-icon' },
                            React.createElement('i', { className: 'fa-solid fa-heart' })
                        ),
                        React.createElement('h4', null, listing.title),
                        React.createElement('p', { className: 'purchase-price' }, `$${listing.price || 0}`),
                        React.createElement('div', { className: 'listing-actions' },
                            React.createElement('button', {
                                className: 'btn btn-sm btn-secondary',
                                onClick: () => onNavigate('product-detail', listing.id)
                            }, React.createElement('i', { className: 'fas fa-up-right-from-square' }), 'Open'),
                            React.createElement('button', {
                                className: 'btn btn-sm btn-outline icon-btn danger',
                                title: 'Remove from wishlist',
                                'aria-label': 'Remove from wishlist',
                                onClick: () => handleRemoveFromWishlist(listing.id)
                            }, React.createElement('i', { className: 'fa-solid fa-trash' }))
                        )
                    )
                )
            )
        );
    };

    const renderAlertsTab = () => {
        return React.createElement('div', { className: 'dashboard-alerts' },
            React.createElement('h3', null, 'Keyword Alerts'),
            React.createElement('p', { className: 'message-thread-product' }, 'Get notified when new listings match your keywords (e.g., mini fridge, desk lamp, MacBook).'),
            React.createElement('div', { className: 'seller-request-actions', style: { marginBottom: '1rem', alignItems: 'center' } },
                React.createElement('input', {
                    type: 'text',
                    value: newKeyword,
                    placeholder: 'Type a keyword and press Add',
                    onChange: (event) => setNewKeyword(event.target.value),
                    onKeyDown: (event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            handleAddKeywordAlert();
                        }
                    },
                    style: {
                        flex: 1,
                        minWidth: '220px',
                        border: '1px solid #d1d5db',
                        borderRadius: '10px',
                        padding: '10px 12px'
                    }
                }),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: handleAddKeywordAlert,
                    disabled: savingKeyword
                },
                    React.createElement('i', { className: savingKeyword ? 'fas fa-spinner fa-spin' : 'fas fa-plus' }),
                    savingKeyword ? 'Saving...' : 'Add Alert'
                )
            ),
            keywordAlerts.length === 0
                ? React.createElement('div', { className: 'empty-state', style: { padding: '2rem 1rem' } },
                    React.createElement('i', { className: 'fa-solid fa-bell' }),
                    React.createElement('p', null, 'No alerts yet. Add your first keyword above.')
                )
                : React.createElement('div', { className: 'activity-list' },
                    keywordAlerts.map((alert) => React.createElement('div', { key: alert.id, className: 'message-thread' },
                        React.createElement('div', { className: 'message-thread-avatar' },
                            React.createElement('i', { className: 'fa-solid fa-bell' })
                        ),
                        React.createElement('div', { className: 'message-thread-content' },
                            React.createElement('h4', null, alert.keyword),
                            React.createElement('p', { className: 'message-thread-product' }, `In-app: ${alert.notify_in_app === false ? 'Off' : 'On'} | Email: ${alert.notify_email === false ? 'Off' : 'On'}`),
                            React.createElement('span', { className: 'message-thread-time' }, formatDate(alert.created_at || new Date().toISOString()))
                        ),
                        React.createElement('div', { className: 'message-thread-meta' },
                            React.createElement('button', {
                                className: 'btn btn-sm btn-danger icon-btn danger',
                                title: 'Delete alert',
                                'aria-label': 'Delete alert',
                                onClick: () => handleDeleteKeywordAlert(alert.id)
                            }, React.createElement('i', { className: 'fa-solid fa-trash' }))
                        )
                    ))
                )
        );
    };

    const renderMessagesTab = () => {
        const localConversations = [];
        if (activity?.messages && activity.messages.length > 0) {
            const conversationMap = new Map();
            activity.messages.forEach((entry) => {
                const otherUserId = entry.senderId === currentUser.id ? entry.receiverId : entry.senderId;
                if (!otherUserId) return;
                const key = `${otherUserId}_${entry.productId}`;
                const existing = conversationMap.get(key);
                if (!existing || new Date(entry.timestamp) > new Date(existing.timestamp)) {
                    conversationMap.set(key, { ...entry, otherUserId });
                }
            });
            localConversations.push(...Array.from(conversationMap.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        }

        const supabaseConversations = (chatConversations || []).map((conversation) => ({
            otherUserId: conversation.otherUserId,
            productId: conversation.productId,
            productTitle: allProducts.find((prod) => prod.id === conversation.productId)?.title || 'Listing',
            message: conversation.lastMessage || '',
            timestamp: conversation.lastMessageAt || conversation.createdAt,
            conversationId: conversation.id
        }));

        const merged = [];
        const seenKeys = new Set();
        [...supabaseConversations, ...localConversations].forEach((conversation) => {
            if (!conversation?.otherUserId) return;
            const key = `${conversation.otherUserId}_${conversation.productId || ''}`;
            if (seenKeys.has(key)) return;
            seenKeys.add(key);
            merged.push(conversation);
        });

        const conversations = merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (conversations.length === 0) {
            return React.createElement('div', { className: 'empty-state' },
                React.createElement('i', { className: 'fas fa-comment' }),
                React.createElement('h3', null, 'No conversations yet'),
                React.createElement('p', null, 'Start chatting with buyers and sellers from product pages'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => onNavigate('home')
                }, 'Browse Listings')
            );
        }

        const handleOpenChat = (conversation) => {
            const productData = allProducts.find((prod) => prod.id === conversation.productId) || {
                id: conversation.productId,
                title: conversation.productTitle,
                price: null
            };
            const participant = window.DormGlideAuth?.getUserById
                ? window.DormGlideAuth.getUserById(conversation.otherUserId)
                : null;
            setActiveTab('messages');
            setChatContext({
                product: {
                    id: productData.id,
                    title: productData.title || conversation.productTitle || 'Listing',
                    price: productData.price
                },
                participant: {
                    id: conversation.otherUserId,
                    name: participant?.name || 'DormGlide user',
                    phone: participant?.phone || ''
                }
            });
        };

        return React.createElement('div', { className: 'messages-tab' },
            React.createElement('h3', null, 'Conversations'),
            React.createElement('div', { className: 'message-thread-list' },
                conversations.map((conversation, index) => {
                    const otherUser = window.DormGlideAuth?.getUserById
                        ? window.DormGlideAuth.getUserById(conversation.otherUserId)
                        : null;
                    const displayName = otherUser?.name || 'DormGlide user';
                    const productData = allProducts.find((prod) => prod.id === conversation.productId);
                    const title = productData?.title || conversation.productTitle || 'Listing';
                    return React.createElement('div', { key: `${conversation.otherUserId}_${conversation.productId}_${index}`, className: 'message-thread' },
                        React.createElement('div', { className: 'message-thread-avatar' },
                            React.createElement('i', { className: 'fas fa-user-circle' })
                        ),
                        React.createElement('div', { className: 'message-thread-content' },
                            React.createElement('h4', null, displayName),
                            React.createElement('p', { className: 'message-thread-product' }, title),
                            React.createElement('p', { className: 'message-thread-snippet' }, conversation.message)
                        ),
                        React.createElement('div', { className: 'message-thread-meta' },
                            React.createElement('span', { className: 'message-thread-time' }, formatDate(conversation.timestamp)),
                            React.createElement('button', {
                                className: 'btn btn-secondary btn-sm',
                                onClick: () => handleOpenChat(conversation)
                            },
                                React.createElement('i', { className: 'fas fa-comment' }),
                                ' Open Chat'
                            )
                        )
                    );
                })
            )
        );
    };

    if (!currentUser) {
        return React.createElement('div', { className: 'dashboard-page' },
            React.createElement('div', { className: 'auth-required' },
                React.createElement('i', { className: 'fas fa-lock' }),
                React.createElement('h2', null, 'Login Required'),
                React.createElement('p', null, 'Please login to view your dashboard')
            )
        );
    }

    if (!activity) {
        return React.createElement('div', { className: 'dashboard-page' },
            React.createElement('div', { className: 'loading' },
                React.createElement('i', { className: 'fas fa-spinner fa-spin' }),
                React.createElement('p', null, 'Loading your dashboard...')
            )
        );
    }

    return React.createElement('div', { className: 'dashboard-page' },
        React.createElement('div', { className: 'dashboard-header' },
            React.createElement('h1', null, 'My Dashboard'),
            React.createElement('p', null, `Welcome back, ${currentUser.name}!`)
        ),

        React.createElement('div', { className: 'dashboard-tabs' },
            React.createElement('button', {
                className: `tab ${activeTab === 'overview' ? 'active' : ''}`,
                onClick: () => setActiveTab('overview')
            },
                React.createElement('i', { className: 'fas fa-chart-line' }),
                'Overview'
            ),
            React.createElement('button', {
                className: `tab ${activeTab === 'purchases' ? 'active' : ''}`,
                onClick: () => setActiveTab('purchases')
            },
                React.createElement('i', { className: 'fas fa-shopping-bag' }),
                'Purchases'
            ),
            React.createElement('button', {
                className: `tab ${activeTab === 'sales' ? 'active' : ''}`,
                onClick: () => setActiveTab('sales')
            },
                React.createElement('i', { className: 'fas fa-dollar-sign' }),
                'Sales'
            ),
            React.createElement('button', {
                className: `tab ${activeTab === 'favorites' ? 'active' : ''}`,
                onClick: () => setActiveTab('favorites')
            },
                React.createElement('i', { className: 'fas fa-heart' }),
                'Favorites'
            ),
            React.createElement('button', {
                className: `tab ${activeTab === 'wishlist' ? 'active' : ''}`,
                onClick: () => setActiveTab('wishlist')
            },
                React.createElement('i', { className: 'fa-regular fa-heart' }),
                'Wishlist'
            ),
            React.createElement('button', {
                className: `tab ${activeTab === 'alerts' ? 'active' : ''}`,
                onClick: () => setActiveTab('alerts')
            },
                React.createElement('i', { className: 'fa-solid fa-bell' }),
                'Alerts'
            )
        ),

        React.createElement('div', { className: 'dashboard-content' },
            activeTab === 'overview' && renderOverviewTab(),
            activeTab === 'purchases' && renderPurchasesTab(),
            activeTab === 'sales' && renderSalesTab(),
            activeTab === 'favorites' && renderFavoritesTab(),
            activeTab === 'wishlist' && renderWishlistTab(),
            activeTab === 'alerts' && renderAlertsTab()
        ),

        chatContext && React.createElement(ChatModal, {
            product: chatContext.product,
            currentUser,
            participant: chatContext.participant,
            onProductUpdate: (updated) => {
                if (!updated?.id) return;
                setProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
                setAllProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            },
            onClose: () => setChatContext(null)
        })
    );
};
