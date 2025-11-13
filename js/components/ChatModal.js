const ChatModal = ({
    product,
    currentUser,
    participant,
    initialConversation = null,
    onClose,
    onConversationActivity
}) => {
    const [message, setMessage] = React.useState('');
    const [messages, setMessages] = React.useState([]);
    const [conversation, setConversation] = React.useState(initialConversation);
    const [isSending, setIsSending] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);
    const listRef = React.useRef(null);

    const numericPrice = React.useMemo(() => {
        if (product?.price === undefined || product?.price === null || product?.price === '') return null;
        const value = Number(product.price);
        return Number.isFinite(value) ? value : null;
    }, [product?.price]);

    React.useEffect(() => {
        setConversation(initialConversation || null);
    }, [initialConversation?.id]);

    React.useEffect(() => {
        if (!listRef.current) return;
        listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [messages.length]);

    React.useEffect(() => {
        if (!currentUser?.id || !participant?.id || !window.DormGlideChat) return;

        let isMounted = true;
        let unsubscribe = null;
        setIsLoading(true);

        const bootstrapConversation = async () => {
            try {
                const convo = await window.DormGlideChat.getOrCreateConversation({
                    productId: product?.id || null,
                    participantA: currentUser.id,
                    participantB: participant.id
                });

                if (!isMounted) return;
                setConversation(convo);

                const history = await window.DormGlideChat.fetchMessages(convo.id);
                if (!isMounted) return;
                setMessages(history);

                unsubscribe = window.DormGlideChat.subscribeToConversation(convo.id, (incoming) => {
                    if (!incoming) return;
                    setMessages((prev) => {
                        if (prev.some((msg) => msg.id === incoming.id)) {
                            return prev;
                        }
                        return [...prev, incoming].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                    });
                });
            } catch (error) {
                console.error('[DormGlide] Failed to load conversation', error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        bootstrapConversation();

        return () => {
            isMounted = false;
            if (unsubscribe) unsubscribe();
        };
    }, [currentUser?.id, participant?.id, product?.id]);

    const handleOverlayClick = (event) => {
        if (event.target === event.currentTarget) {
            onClose();
        }
    };

    const handleSendMessage = async () => {
        const trimmed = message.trim();
        if (!trimmed || !currentUser?.id || !participant?.id || !window.DormGlideChat) return;
        if (!conversation?.id && !product?.id) {
            alert('Unable to determine listing information for this chat.');
            return;
        }

        setIsSending(true);
        try {
            const result = await window.DormGlideChat.sendMessage({
                conversationId: conversation?.id || null,
                senderId: currentUser.id,
                receiverId: participant.id,
                productId: product?.id || null,
                productTitle: product?.title || '',
                body: trimmed
            });

            if (result?.conversation) {
                setConversation(result.conversation);
                onConversationActivity?.(result.conversation);
            }

            setMessage('');
        } catch (error) {
            console.error('[DormGlide] Failed to send message', error);
            alert('Unable to send your message right now. Please try again.');
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };

    const friendlyPhone = participant?.phone
        ? (window.DormGlideAuth?.formatPhoneNumberReadable?.(participant.phone) || participant.phone)
        : '';

    return React.createElement('div', {
        className: 'chat-modal-overlay',
        onClick: handleOverlayClick,
        role: 'dialog',
        'aria-modal': true
    },
        React.createElement('div', { className: 'chat-modal' },
            React.createElement('div', { className: 'chat-header' },
                React.createElement('div', { className: 'chat-participant' },
                    React.createElement('div', { className: 'chat-avatar' },
                        React.createElement('i', { className: 'fas fa-user' })
                    ),
                    React.createElement('div', { className: 'chat-meta' },
                        React.createElement('h3', null, participant?.name || product?.sellerName || 'Contact'),
                        friendlyPhone && React.createElement('span', { className: 'chat-phone' },
                            React.createElement('i', { className: 'fas fa-phone' }),
                            ' ',
                            friendlyPhone
                        )
                    )
                ),
                React.createElement('button', {
                    className: 'chat-close-btn',
                    onClick: onClose,
                    'aria-label': 'Close chat'
                },
                    React.createElement('i', { className: 'fas fa-times' })
                )
            ),
            React.createElement('div', { className: 'chat-product-summary' },
                React.createElement('div', { className: 'chat-product-title' }, product?.title || 'Listing'),
                numericPrice !== null && React.createElement('span', { className: 'chat-product-price' },
                    `$${numericPrice.toLocaleString()}`
                )
            ),
            React.createElement('div', { className: 'chat-message-list', ref: listRef },
                isLoading
                    ? React.createElement('div', { className: 'chat-empty-state' },
                        React.createElement('i', { className: 'fas fa-spinner fa-spin' }),
                        React.createElement('p', null, 'Loading conversation...')
                    )
                    : messages.length === 0
                        ? React.createElement('div', { className: 'chat-empty-state' },
                            React.createElement('i', { className: 'fas fa-comments' }),
                            React.createElement('p', null, 'No messages yet. Say hello!')
                        )
                        : messages.map((entry) => {
                            const isSelf = entry.senderId === currentUser.id;
                            return React.createElement('div', {
                                key: entry.id,
                                className: `chat-message ${isSelf ? 'self' : 'other'}`
                            },
                                React.createElement('div', { className: 'chat-message-body' }, entry.body),
                                React.createElement('span', { className: 'chat-message-time' }, formatTimestamp(entry.createdAt))
                            );
                        })
            ),
            React.createElement('div', { className: 'chat-input-bar' },
                React.createElement('textarea', {
                    className: 'chat-input',
                    placeholder: 'Type your message... (Shift + Enter for a new line)',
                    value: message,
                    onChange: (event) => setMessage(event.target.value),
                    onKeyDown: handleKeyDown,
                    rows: 2,
                    disabled: isSending
                }),
                React.createElement('button', {
                    className: 'chat-send-btn',
                    onClick: handleSendMessage,
                    disabled: isSending || !message.trim()
                },
                    isSending
                        ? React.createElement('i', { className: 'fas fa-spinner fa-spin' })
                        : React.createElement('i', { className: 'fas fa-paper-plane' })
                )
            )
        )
    );
};
