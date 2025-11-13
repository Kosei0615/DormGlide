// User Dashboard Component - Shows user activity and history
const UserDashboard = ({ currentUser, onNavigate }) => {
    const [activeTab, setActiveTab] = React.useState('overview');
    const [activity, setActivity] = React.useState(null);
    const [products, setProducts] = React.useState([]);
    const [allProducts, setAllProducts] = React.useState([]);
    const [chatContext, setChatContext] = React.useState(null);

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

    const calculateTotalEarnings = () => {
        if (!activity || !activity.sales) return 0;
        return activity.sales.reduce((total, sale) => total + (sale.price || 0), 0);
    };

    const calculateTotalSpent = () => {
        if (!activity || !activity.purchases) return 0;
        return activity.purchases.reduce((total, purchase) => total + (purchase.price || 0), 0);
    };

    const renderOverviewTab = () => {
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
                        React.createElement('i', { className: 'fas fa-comments', style: { color: '#1976d2' } })
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
                        React.createElement('h3', null, activity?.sales?.length || 0),
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
            )
        );
    };

    const renderPurchasesTab = () => {
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
        if (!activity?.sales || activity.sales.length === 0) {
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
                activity.sales.map((sale, index) =>
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
                            className: 'btn btn-sm btn-outline',
                            onClick: () => {
                                window.DormGlideAuth.removeFromFavorites(currentUser.id, favorite.productId);
                                setActivity(window.DormGlideAuth.getUserActivity(currentUser.id));
                            }
                        }, 'Remove')
                    )
                )
            )
        );
    };

    const renderMessagesTab = () => {
        if (!activity?.messages || activity.messages.length === 0) {
            return React.createElement('div', { className: 'empty-state' },
                React.createElement('i', { className: 'fas fa-comments' }),
                React.createElement('h3', null, 'No conversations yet'),
                React.createElement('p', null, 'Start chatting with buyers and sellers from product pages'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => onNavigate('home')
                }, 'Browse Listings')
            );
        }

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

        const conversations = Array.from(conversationMap.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

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
                                React.createElement('i', { className: 'fas fa-comments' }),
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
                className: `tab ${activeTab === 'messages' ? 'active' : ''}`,
                onClick: () => setActiveTab('messages')
            },
                React.createElement('i', { className: 'fas fa-comments' }),
                'Messages'
            )
        ),

        React.createElement('div', { className: 'dashboard-content' },
            activeTab === 'overview' && renderOverviewTab(),
            activeTab === 'purchases' && renderPurchasesTab(),
            activeTab === 'sales' && renderSalesTab(),
            activeTab === 'favorites' && renderFavoritesTab(),
            activeTab === 'messages' && renderMessagesTab()
        ),

        chatContext && React.createElement(ChatModal, {
            product: chatContext.product,
            currentUser,
            participant: chatContext.participant,
            onClose: () => setChatContext(null)
        })
    );
};
