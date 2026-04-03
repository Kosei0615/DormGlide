const MessagesPage = ({ currentUser, onNavigate }) => {
    const [chatContext, setChatContext] = React.useState(null);
    const [chatConversations, setChatConversations] = React.useState([]);
    const [allProducts, setAllProducts] = React.useState([]);
    const [activity, setActivity] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [purchaseRequests, setPurchaseRequests] = React.useState([]);
    const [updatingRequestId, setUpdatingRequestId] = React.useState(null);

    React.useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            if (!currentUser) {
                if (isMounted) setIsLoading(false);
                return;
            }

            try {
                if (typeof getProductsFromStorage !== 'undefined') {
                    const productsFromStorage = await getProductsFromStorage();
                    if (isMounted) {
                        setAllProducts(productsFromStorage || []);
                    }
                }

                if (window.DormGlideAuth?.getUserActivity) {
                    const userActivity = await window.DormGlideAuth.getUserActivity(currentUser.id);
                    if (isMounted) {
                        setActivity(userActivity);
                    }
                }

                if (window.DormGlideChat?.fetchConversations) {
                    const conversations = await window.DormGlideChat.fetchConversations(currentUser.id);
                    if (isMounted) {
                        setChatConversations(conversations || []);
                    }
                }

                if (window.DormGlideStorage?.fetchPurchaseRequestsForUser) {
                    const requests = await window.DormGlideStorage.fetchPurchaseRequestsForUser(currentUser.id);
                    if (isMounted) {
                        setPurchaseRequests(Array.isArray(requests) ? requests : []);
                    }
                }
            } catch (error) {
                console.error('[DormGlide] Failed to load messages page data:', error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadData();

        let unsubscribe = null;
        if (currentUser?.id && window.DormGlideChat?.subscribeToConversationUpdates) {
            unsubscribe = window.DormGlideChat.subscribeToConversationUpdates(currentUser.id, async () => {
                try {
                    const conversations = await window.DormGlideChat.fetchConversations(currentUser.id);
                    if (isMounted) {
                        setChatConversations(conversations || []);
                    }
                } catch (error) {
                    console.warn('[DormGlide] Failed refreshing conversations:', error);
                }
            });
        }

        return () => {
            isMounted = false;
            if (unsubscribe) unsubscribe();
        };
    }, [currentUser?.id]);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const buildLocalFallbackConversations = () => {
        if (!activity?.messages || !currentUser?.id) return [];
        const map = new Map();
        activity.messages.forEach((entry) => {
            const otherUserId = entry.senderId === currentUser.id ? entry.receiverId : entry.senderId;
            if (!otherUserId) return;
            const key = `${otherUserId}_${entry.productId || ''}`;
            const existing = map.get(key);
            if (!existing || new Date(entry.timestamp) > new Date(existing.timestamp)) {
                map.set(key, {
                    otherUserId,
                    productId: entry.productId,
                    productTitle: entry.productTitle,
                    message: entry.message,
                    timestamp: entry.timestamp,
                    conversationId: entry.conversationId || null
                });
            }
        });
        return Array.from(map.values());
    };

    const mergedConversations = React.useMemo(() => {
        const supabaseConversations = (chatConversations || []).map((conversation) => ({
            otherUserId: conversation.otherUserId,
            productId: conversation.productId,
            productTitle: allProducts.find((prod) => prod.id === conversation.productId)?.title || 'Listing',
            message: conversation.lastMessage || '',
            timestamp: conversation.lastMessageAt || conversation.createdAt,
            conversationId: conversation.id
        }));

        const fallbackConversations = buildLocalFallbackConversations();
        const merged = [];
        const seen = new Set();

        [...supabaseConversations, ...fallbackConversations].forEach((conversation) => {
            if (!conversation?.otherUserId) return;
            const key = `${conversation.otherUserId}_${conversation.productId || ''}`;
            if (seen.has(key)) return;
            seen.add(key);
            merged.push(conversation);
        });

        return merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [chatConversations, activity, allProducts]);

    const directConversationIdByUser = React.useMemo(() => {
        const mapping = new Map();
        (chatConversations || []).forEach((conversation) => {
            if (!conversation?.otherUserId) return;
            if (conversation.productId !== null && conversation.productId !== undefined && conversation.productId !== '') return;
            const existing = mapping.get(conversation.otherUserId);
            if (!existing || new Date(conversation.lastMessageAt || conversation.createdAt) > new Date(existing.lastMessageAt || existing.createdAt)) {
                mapping.set(conversation.otherUserId, conversation);
            }
        });
        return mapping;
    }, [chatConversations]);

    const threadsByUser = React.useMemo(() => {
        const grouped = new Map();
        mergedConversations.forEach((conversation) => {
            const otherUserId = conversation.otherUserId;
            if (!otherUserId) return;

            const existing = grouped.get(otherUserId);
            if (!existing || new Date(conversation.timestamp) > new Date(existing.timestamp)) {
                grouped.set(otherUserId, {
                    otherUserId,
                    message: conversation.message,
                    timestamp: conversation.timestamp,
                    recentProductId: conversation.productId,
                    recentProductTitle: conversation.productTitle || allProducts.find((item) => item.id === conversation.productId)?.title || 'Listing',
                    conversationCount: (existing?.conversationCount || 0) + 1
                });
            } else {
                existing.conversationCount += 1;
            }
        });

        return Array.from(grouped.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [mergedConversations, allProducts]);

    const filteredThreads = React.useMemo(() => {
        const keyword = String(searchQuery || '').trim().toLowerCase();
        if (!keyword) return threadsByUser;

        return threadsByUser.filter((thread) => {
            const otherUser = window.DormGlideAuth?.getUserById
                ? window.DormGlideAuth.getUserById(thread.otherUserId)
                : null;
            const name = String(otherUser?.name || 'DormGlide user').toLowerCase();
            const productTitle = String(thread.recentProductTitle || '').toLowerCase();
            const preview = String(thread.message || '').toLowerCase();
            return name.includes(keyword) || productTitle.includes(keyword) || preview.includes(keyword);
        });
    }, [threadsByUser, searchQuery]);

    const incomingRequests = React.useMemo(() => {
        return (purchaseRequests || [])
            .filter((request) => request?.sellerId === currentUser?.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [purchaseRequests, currentUser?.id]);

    const outgoingRequests = React.useMemo(() => {
        return (purchaseRequests || [])
            .filter((request) => request?.buyerId === currentUser?.id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [purchaseRequests, currentUser?.id]);

    const refreshRequests = async () => {
        if (!currentUser?.id || !window.DormGlideStorage?.fetchPurchaseRequestsForUser) return;
        const requests = await window.DormGlideStorage.fetchPurchaseRequestsForUser(currentUser.id);
        setPurchaseRequests(Array.isArray(requests) ? requests : []);
    };

    const handleRequestDecision = async (request, decision) => {
        if (!request?.id || !request?.listingId || !window.DormGlideStorage?.respondToPurchaseRequest) return;

        setUpdatingRequestId(request.id);
        try {
            await window.DormGlideStorage.respondToPurchaseRequest({
                listingId: request.listingId,
                purchaseRequestId: request.id,
                decision,
                buyerId: request.buyerId || null
            });
            await refreshRequests();
            if (typeof getProductsFromStorage !== 'undefined') {
                const productsFromStorage = await getProductsFromStorage();
                setAllProducts(productsFromStorage || []);
            }
        } catch (error) {
            console.error('[DormGlide] Failed to update purchase request from messages page:', error);
        } finally {
            setUpdatingRequestId(null);
        }
    };

    const handleOpenChat = (thread) => {
        const directConversation = directConversationIdByUser.get(thread.otherUserId);
        const participant = window.DormGlideAuth?.getUserById
            ? window.DormGlideAuth.getUserById(thread.otherUserId)
            : null;

        setChatContext({
            product: {
                id: null,
                title: `Direct chat${thread.recentProductTitle ? ` - latest: ${thread.recentProductTitle}` : ''}`,
                price: null
            },
            participant: {
                id: thread.otherUserId,
                name: participant?.name || 'DormGlide user',
                phone: participant?.phone || ''
            },
            conversationId: directConversation?.id || null,
            initialDraft: 'Hi! Want to continue our deal here in one chat thread?'
        });
    };

    if (!currentUser) {
        return React.createElement('div', { className: 'dashboard-page' },
            React.createElement('div', { className: 'auth-required' },
                React.createElement('i', { className: 'fas fa-lock' }),
                React.createElement('h2', null, 'Login Required'),
                React.createElement('p', null, 'Please login to view your messages')
            )
        );
    }

    if (isLoading) {
        return React.createElement('div', { className: 'dashboard-page' },
            React.createElement('div', { className: 'loading' },
                React.createElement('i', { className: 'fas fa-spinner fa-spin' }),
                React.createElement('p', null, 'Loading conversations...')
            )
        );
    }

    return React.createElement('div', { className: 'dashboard-page' },
        React.createElement('div', { className: 'dashboard-header' },
            React.createElement('h1', null, 'Messages'),
            React.createElement('p', null, 'Stay connected with buyers and sellers in one unified thread per person')
        ),

        React.createElement('div', { className: 'messages-search-bar' },
            React.createElement('i', { className: 'fas fa-search' }),
            React.createElement('input', {
                type: 'search',
                placeholder: 'Search by user, listing, or message preview',
                value: searchQuery,
                onChange: (event) => setSearchQuery(event.target.value)
            })
        ),

        React.createElement('div', { className: 'seller-request-panel' },
            React.createElement('h3', null, 'Purchase Request Updates'),
            incomingRequests.length === 0 && outgoingRequests.length === 0
                ? React.createElement('p', null, 'No purchase request updates yet.')
                : React.createElement('div', { className: 'message-thread-list' },
                    incomingRequests.map((request) => {
                        const listing = allProducts.find((item) => item.id === request.listingId);
                        const buyer = request?.buyerId ? window.DormGlideAuth?.getUserById?.(request.buyerId) : null;
                        const isBusy = updatingRequestId === request.id;
                        return React.createElement('div', { key: `incoming_${request.id}`, className: 'seller-request-row' },
                            React.createElement('div', { className: 'seller-request-meta' },
                                React.createElement('strong', null, listing?.title || 'Listing'),
                                React.createElement('span', null, `Buyer: ${buyer?.name || request.buyerId || 'Unknown'}`),
                                React.createElement('span', null, `Status: ${request.status}`)
                            ),
                            request.status === 'pending' && React.createElement('div', { className: 'seller-request-actions' },
                                React.createElement('button', {
                                    className: 'btn btn-sm btn-primary icon-action-btn',
                                    title: 'Accept request',
                                    'aria-label': 'Accept purchase request',
                                    onClick: () => handleRequestDecision(request, 'accepted'),
                                    disabled: isBusy
                                }, React.createElement('i', { className: isBusy ? 'fas fa-spinner fa-spin' : 'fas fa-check' })),
                                React.createElement('button', {
                                    className: 'btn btn-sm btn-danger icon-action-btn',
                                    title: 'Decline request',
                                    'aria-label': 'Decline purchase request',
                                    onClick: () => handleRequestDecision(request, 'declined'),
                                    disabled: isBusy
                                }, React.createElement('i', { className: 'fas fa-xmark' }))
                            )
                        );
                    }),
                    outgoingRequests.map((request) => {
                        const listing = allProducts.find((item) => item.id === request.listingId);
                        return React.createElement('div', { key: `outgoing_${request.id}`, className: 'seller-request-row' },
                            React.createElement('div', { className: 'seller-request-meta' },
                                React.createElement('strong', null, listing?.title || 'Listing'),
                                React.createElement('span', null, 'Role: Buyer request'),
                                React.createElement('span', null, `Status: ${request.status}`)
                            )
                        );
                    })
                )
        ),

        filteredThreads.length === 0
            ? React.createElement('div', { className: 'empty-state' },
                React.createElement('i', { className: 'fas fa-comments' }),
                React.createElement('h3', null, searchQuery ? 'No matching conversations' : 'No conversations yet'),
                React.createElement('p', null, searchQuery ? 'Try a different keyword.' : 'Start chatting from product pages to negotiate and close deals'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => onNavigate('home')
                }, 'Browse Listings')
            )
            : React.createElement('div', { className: 'messages-tab' },
                React.createElement('div', { className: 'message-thread-list' },
                    filteredThreads.map((thread, index) => {
                        const otherUser = window.DormGlideAuth?.getUserById
                            ? window.DormGlideAuth.getUserById(thread.otherUserId)
                            : null;
                        const displayName = otherUser?.name || 'DormGlide user';
                        const title = thread.recentProductTitle || 'Listing';

                        return React.createElement('div', {
                            key: `${thread.otherUserId}_${index}`,
                            className: 'message-thread'
                        },
                            React.createElement('div', { className: 'message-thread-avatar' },
                                React.createElement('i', { className: 'fas fa-user-circle' })
                            ),
                            React.createElement('div', { className: 'message-thread-content' },
                                React.createElement('h4', null, displayName),
                                React.createElement('p', { className: 'message-thread-product' }, `Latest listing: ${title}`),
                                React.createElement('p', { className: 'message-thread-snippet' }, thread.message || 'No message preview'),
                                (thread.conversationCount || 0) > 1 && React.createElement('span', { className: 'message-thread-badge' },
                                    `${thread.conversationCount} related chats`
                                )
                            ),
                            React.createElement('div', { className: 'message-thread-meta' },
                                React.createElement('span', { className: 'message-thread-time' }, formatDate(thread.timestamp)),
                                React.createElement('button', {
                                    className: 'btn btn-secondary btn-sm',
                                    onClick: () => handleOpenChat(thread)
                                },
                                    React.createElement('i', { className: 'fas fa-comments' }),
                                    ' Open Unified Chat'
                                )
                            )
                        );
                    })
                )
            ),

        chatContext && React.createElement(ChatModal, {
            product: chatContext.product,
            currentUser,
            participant: chatContext.participant,
            initialConversation: chatContext.conversationId ? { id: chatContext.conversationId } : null,
            initialDraft: chatContext.initialDraft || '',
            onClose: () => setChatContext(null)
        })
    );
};
