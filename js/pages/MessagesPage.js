const MessagesPage = ({ currentUser, onNavigate }) => {
    const [chatContext, setChatContext] = React.useState(null);
    const [chatConversations, setChatConversations] = React.useState([]);
    const [allProducts, setAllProducts] = React.useState([]);
    const [activity, setActivity] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);

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

    const handleOpenChat = (conversation) => {
        const productData = allProducts.find((prod) => prod.id === conversation.productId) || {
            id: conversation.productId,
            title: conversation.productTitle,
            price: null
        };
        const participant = window.DormGlideAuth?.getUserById
            ? window.DormGlideAuth.getUserById(conversation.otherUserId)
            : null;

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
            },
            conversationId: conversation.conversationId || null
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
            React.createElement('p', null, 'Stay connected with buyers and sellers')
        ),

        mergedConversations.length === 0
            ? React.createElement('div', { className: 'empty-state' },
                React.createElement('i', { className: 'fas fa-comments' }),
                React.createElement('h3', null, 'No conversations yet'),
                React.createElement('p', null, 'Start chatting from product pages to negotiate and close deals'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => onNavigate('home')
                }, 'Browse Listings')
            )
            : React.createElement('div', { className: 'messages-tab' },
                React.createElement('div', { className: 'message-thread-list' },
                    mergedConversations.map((conversation, index) => {
                        const otherUser = window.DormGlideAuth?.getUserById
                            ? window.DormGlideAuth.getUserById(conversation.otherUserId)
                            : null;
                        const displayName = otherUser?.name || 'DormGlide user';
                        const productData = allProducts.find((prod) => prod.id === conversation.productId);
                        const title = productData?.title || conversation.productTitle || 'Listing';

                        return React.createElement('div', {
                            key: `${conversation.otherUserId}_${conversation.productId || ''}_${index}`,
                            className: 'message-thread'
                        },
                            React.createElement('div', { className: 'message-thread-avatar' },
                                React.createElement('i', { className: 'fas fa-user-circle' })
                            ),
                            React.createElement('div', { className: 'message-thread-content' },
                                React.createElement('h4', null, displayName),
                                React.createElement('p', { className: 'message-thread-product' }, title),
                                React.createElement('p', { className: 'message-thread-snippet' }, conversation.message || 'No message preview')
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
            ),

        chatContext && React.createElement(ChatModal, {
            product: chatContext.product,
            currentUser,
            participant: chatContext.participant,
            initialConversation: chatContext.conversationId ? { id: chatContext.conversationId } : null,
            onClose: () => setChatContext(null)
        })
    );
};
