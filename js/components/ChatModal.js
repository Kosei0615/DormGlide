const ChatModal = ({
    product,
    currentUser,
    participant,
    initialConversation = null,
    initialDraft = '',
    onProductUpdate,
    onClose,
    onConversationActivity
}) => {
    const toast = window.DormGlideToast || {
        success: () => {},
        error: () => {},
        warning: () => {},
        info: () => {}
    };

    const [message, setMessage] = React.useState('');
    const [messages, setMessages] = React.useState([]);
    const [conversation, setConversation] = React.useState(initialConversation);
    const [isSending, setIsSending] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isConfirming, setIsConfirming] = React.useState(false);
    const [isChecklistConfirmed, setIsChecklistConfirmed] = React.useState(false);
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
        const draft = String(initialDraft || '').trim();
        if (!draft) return;
        setMessage((prev) => (prev && prev.trim() ? prev : draft));
    }, [initialDraft]);

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
                toast.error('Unable to load this conversation right now.');
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

    const sendMessageBody = async (body) => {
        const trimmed = String(body || '').trim();
        if (!trimmed || !currentUser?.id || !participant?.id || !window.DormGlideChat) return false;
        if (!conversation?.id) {
            toast.error('Unable to load this chat right now. Please wait a moment and try again.');
            return false;
        }

        setIsSending(true);
        try {
            if (isBuyer && product?.id && !product?.requestedAt) {
                try {
                    await persistProductUpdate({
                        requestedAt: new Date().toISOString(),
                        buyerId: product?.buyerId || currentUser.id
                    });
                } catch (error) {
                    console.warn('[DormGlide] Failed to persist requested purchase metadata:', error);
                }
            }

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

            return true;
        } catch (error) {
            console.error('[DormGlide] Failed to send message', error);
            toast.error('Unable to send your message right now. Please try again.');
            return false;
        } finally {
            setIsSending(false);
        }
    };

    const handleSendMessage = async () => {
        const success = await sendMessageBody(message);
        if (success) {
            setMessage('');
        }
    };

    const handleQuickTemplate = async (type) => {
        if (isSending) return;

        if (type === 'proceed') {
            const intro = 'I want to proceed with this purchase. Payment options: Zelle, Venmo, or Cash.';
            const followUp = 'Can we confirm payment method, meetup location, and time?';
            setMessage(`${intro}\n${followUp}`);
            if (isBuyer && product?.id) {
                try {
                    await persistProductUpdate({
                        buyerId: product?.buyerId || currentUser.id,
                        requestedAt: product?.requestedAt || new Date().toISOString()
                    });
                } catch (error) {
                    console.warn('[DormGlide] Failed to store requested purchase timestamp:', error);
                }
            }
            return;
        }

        if (type === 'zelle' || type === 'venmo') {
            const methodLabel = type === 'zelle' ? 'Zelle' : 'Venmo';
            const accountInfo = window.prompt(`Share your ${methodLabel} handle/email (optional):`, '');
            const methodMessage = [
                `Payment method: ${methodLabel}`,
                accountInfo && accountInfo.trim() ? `${methodLabel} account: ${accountInfo.trim()}` : `${methodLabel} account: [please share here]`,
                'Please confirm amount and send a screenshot after payment.',
                'After payment, let us confirm pickup location/time in this chat.'
            ].join('\n');
            await sendMessageBody(methodMessage);
            return;
        }

        if (type === 'cash') {
            const meetup = window.prompt('Suggested public meetup place (optional):', 'Student Center / Library front desk');
            const cashMessage = [
                'Payment method: Cash on meetup',
                `Proposed meetup: ${(meetup || '').trim() || '[set safe public location]'}`,
                'Please confirm exact amount, date/time, and item condition before meetup.',
                'Safety: meet in public campus area and avoid late-night isolated spots.'
            ].join('\n');
            await sendMessageBody(cashMessage);
            return;
        }

        if (type === 'account-template') {
            setMessage([
                'Transaction details template:',
                '- Payment method: [Zelle / Venmo / Cash]',
                '- Payment account/handle: [fill in]',
                '- Buyer name: [fill in]',
                '- Amount: [fill in]',
                '- Meetup location and time: [fill in]',
                '- Confirmation: [paid / received / pending]'
            ].join('\n'));
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

    const listingStatus = String(product?.status || 'active').toLowerCase();
    const isSeller = Boolean(currentUser?.id && product?.sellerId && currentUser.id === product.sellerId);
    const isBuyer = Boolean(currentUser?.id && product?.sellerId && currentUser.id !== product.sellerId);
    const soldAtValue = product?.soldAt ? new Date(product.soldAt).getTime() : null;
    const isBuyerProtectionOpen = Boolean(
        isBuyer &&
        soldAtValue &&
        (Date.now() - soldAtValue <= 48 * 60 * 60 * 1000)
    );

    const persistProductUpdate = async (updates) => {
        if (!window.DormGlideStorage?.updateProduct || !product?.id) return null;
        let latestProduct = null;
        if (typeof getProductsFromStorage !== 'undefined') {
            try {
                const allProducts = await getProductsFromStorage();
                latestProduct = (allProducts || []).find((entry) => entry?.id === product.id) || null;
            } catch (error) {
                console.warn('[DormGlide] Unable to fetch latest product snapshot before chat update:', error);
            }
        }

        const payload = { ...(latestProduct || product), ...updates };
        const updated = await window.DormGlideStorage.updateProduct(product.id, payload);
        if (updated && onProductUpdate) {
            onProductUpdate(updated);
        }
        return updated;
    };

    const promptPeerRating = async ({ targetUserId, targetLabel }) => {
        if (!targetUserId || !window.DormGlideAuth?.submitSellerRating || !currentUser?.id) return;
        const shouldRate = window.confirm(`Would you like to rate ${targetLabel} now?`);
        if (!shouldRate) return;

        const raw = window.prompt(`Rate ${targetLabel} from 1 to 5:`);
        if (raw === null) return;
        const numeric = Number(raw);
        if (!Number.isFinite(numeric) || numeric < 1 || numeric > 5) {
            toast.warning('Please enter a valid number from 1 to 5.');
            return;
        }

        const comment = window.prompt('Optional short review (max 280 chars):', '') || '';
        try {
            const result = await window.DormGlideAuth.submitSellerRating({
                sellerId: targetUserId,
                buyerId: currentUser.id,
                productId: product?.id || null,
                rating: numeric,
                comment
            });

            if (!result?.success) {
                toast.error('Unable to save your rating right now.');
                return;
            }

            toast.success(`Thanks! Your rating for ${targetLabel} has been submitted.`);
        } catch (error) {
            console.error('[DormGlide] Failed to submit peer rating:', error);
            toast.error('Unable to save your rating right now.');
        }
    };

    const getSafetyChecklistMessage = () => {
        return [
            '[Safe Meetup Checklist]',
            '- Meet in a public, well-lit campus location.',
            '- Verify item condition before handoff.',
            '- Confirm payment amount and method in chat.',
            '- Keep screenshots/receipts until both sides confirm completion.'
        ].join('\n');
    };

    const ensureSafetyChecklistSent = async () => {
        const alreadySent = (messages || []).some((entry) => String(entry?.body || '').includes('[Safe Meetup Checklist]'));
        if (alreadySent) return true;
        return await sendMessageBody(getSafetyChecklistMessage());
    };

    const applyMeetupPreset = (preset) => {
        if (preset === 'library') {
            setMessage((prev) => `${prev ? `${prev}\n` : ''}Safe meetup option: Library lobby (public area).`);
            return;
        }
        if (preset === 'student-center') {
            setMessage((prev) => `${prev ? `${prev}\n` : ''}Safe meetup option: Student center info desk.`);
            return;
        }
        if (preset === 'daytime-only') {
            setMessage((prev) => `${prev ? `${prev}\n` : ''}Safety preference: Daytime meetup only (before sunset).`);
            return;
        }
        if (preset === 'checklist') {
            setMessage((prev) => `${prev ? `${prev}\n\n` : ''}${getSafetyChecklistMessage()}`);
        }
    };

    const handleBuyerProtectionReport = async () => {
        if (!isBuyerProtectionOpen || !product?.id || !currentUser?.id) return;

        const issueType = (window.prompt(
            'Issue type (item_not_as_described, not_received, payment_issue, safety_concern, other):',
            'item_not_as_described'
        ) || '').trim().toLowerCase();
        if (!issueType) return;

        const details = (window.prompt('Please describe what happened (required):', '') || '').trim();
        if (!details) {
            toast.warning('Please provide issue details so we can help.');
            return;
        }

        try {
            if (window.DormGlideStorage?.createSupportRequest) {
                await window.DormGlideStorage.createSupportRequest({
                    productId: product.id,
                    reporterId: currentUser.id,
                    counterpartyId: participant?.id || product?.sellerId || null,
                    issueType,
                    details,
                    status: 'open'
                });
            }

            await sendMessageBody(`[Buyer Protection Report]\nIssue: ${issueType}\nDetails: ${details}\nPlease respond here so we can resolve this fairly.`);
            toast.success('Your report has been submitted. We logged it and posted a guided summary in chat.');
        } catch (error) {
            console.error('[DormGlide] Failed creating buyer protection report:', error);
            toast.error('Unable to submit your report right now.');
        }
    };

    const handleBuyerConfirmReceived = async () => {
        if (!product?.id || !isBuyer || isConfirming) return;
        if (!window.confirm('Confirm that you received this item from the seller?')) return;

        setIsConfirming(true);
        try {
            const now = new Date().toISOString();
            await persistProductUpdate({
                buyerId: currentUser.id,
                buyerConfirmedAt: now
            });

            await sendMessageBody('Buyer confirmation: I received the item. Thank you!');
            toast.success('Buyer confirmation saved.');
            await promptPeerRating({
                targetUserId: product?.sellerId,
                targetLabel: participant?.name || 'the seller'
            });
        } catch (error) {
            console.error('[DormGlide] Buyer confirmation failed:', error);
            toast.error('Unable to save buyer confirmation right now.');
        } finally {
            setIsConfirming(false);
        }
    };

    const handleSellerConfirmSold = async () => {
        if (!product?.id || !isSeller || isConfirming) return;

        const method = (window.prompt('Payment method used? (cash, zelle, venmo)', product?.soldMethod || 'cash') || 'cash').trim().toLowerCase();
        if (!method) return;
        if (!window.confirm('Mark this listing as sold and record this transaction?')) return;

        setIsConfirming(true);
        try {
            const now = new Date().toISOString();
            const checklistSent = await ensureSafetyChecklistSent();
            if (!checklistSent) {
                toast.error('Unable to send the safety checklist message. Please try again.');
                return;
            }

            await persistProductUpdate({
                status: 'sold',
                soldAt: product?.soldAt || now,
                soldMethod: method,
                sellerConfirmedAt: now,
                requestedAt: product?.requestedAt || now,
                buyerId: product?.buyerId || participant?.id || null
            });

            if (window.DormGlideStorage?.createManualTransaction) {
                try {
                    await window.DormGlideStorage.createManualTransaction({
                        productId: product.id,
                        sellerId: currentUser.id,
                        buyerId: product?.buyerId || participant?.id || null,
                        amount: numericPrice || 0,
                        currency: 'USD',
                        paymentMethod: method,
                        status: 'completed',
                        source: 'manual_chat',
                        notes: `Recorded from chat conversation ${conversation?.id || ''}`.trim(),
                        confirmedBySellerAt: now,
                        confirmedByBuyerAt: product?.buyerConfirmedAt || null
                    });
                } catch (error) {
                    console.warn('[DormGlide] Transaction logging failed; keeping listing marked sold:', error);
                }
            }

            if (window.DormGlideAuth?.trackSale) {
                window.DormGlideAuth.trackSale(
                    currentUser.id,
                    product.id,
                    product.title || 'Listing',
                    numericPrice || 0,
                    product?.buyerId || participant?.id || null
                );
            }

            if (window.DormGlideAuth?.trackPurchase && (product?.buyerId || participant?.id)) {
                window.DormGlideAuth.trackPurchase(
                    product?.buyerId || participant?.id,
                    product.id,
                    product.title || 'Listing',
                    numericPrice || 0,
                    currentUser.id
                );
            }

            await sendMessageBody(`Seller confirmation: Marked as sold via ${method.toUpperCase()}. Thanks for the smooth transaction.`);
            toast.success('Listing marked sold and transaction recorded.');
            await promptPeerRating({
                targetUserId: product?.buyerId || participant?.id || null,
                targetLabel: participant?.name || 'the buyer'
            });
        } catch (error) {
            console.error('[DormGlide] Seller confirmation failed:', error);
            toast.error('Unable to mark this listing as sold right now.');
        } finally {
            setIsConfirming(false);
        }
    };

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
            React.createElement('div', { className: 'chat-transaction-actions' },
                React.createElement('button', {
                    className: 'chat-template-btn',
                    type: 'button',
                    onClick: () => handleQuickTemplate('proceed')
                }, 'Proceed Purchase'),
                React.createElement('button', {
                    className: 'chat-template-btn',
                    type: 'button',
                    onClick: () => handleQuickTemplate('zelle')
                }, 'Zelle'),
                React.createElement('button', {
                    className: 'chat-template-btn',
                    type: 'button',
                    onClick: () => handleQuickTemplate('venmo')
                }, 'Venmo'),
                React.createElement('button', {
                    className: 'chat-template-btn',
                    type: 'button',
                    onClick: () => handleQuickTemplate('cash')
                }, 'Cash'),
                React.createElement('button', {
                    className: 'chat-template-btn',
                    type: 'button',
                    onClick: () => handleQuickTemplate('account-template')
                }, 'Details Template')
            ),
            product?.id && React.createElement('div', { className: 'chat-safe-meetup-card' },
                React.createElement('h4', null, 'Safe Meetup'),
                React.createElement('div', { className: 'chat-safe-meetup-actions' },
                    React.createElement('button', {
                        className: 'chat-template-btn',
                        type: 'button',
                        onClick: () => applyMeetupPreset('library')
                    }, 'Library lobby'),
                    React.createElement('button', {
                        className: 'chat-template-btn',
                        type: 'button',
                        onClick: () => applyMeetupPreset('student-center')
                    }, 'Student center desk'),
                    React.createElement('button', {
                        className: 'chat-template-btn',
                        type: 'button',
                        onClick: () => applyMeetupPreset('daytime-only')
                    }, 'Daytime only'),
                    React.createElement('button', {
                        className: 'chat-template-btn',
                        type: 'button',
                        onClick: () => applyMeetupPreset('checklist')
                    }, 'Insert checklist')
                )
            ),
            product?.id && React.createElement('div', { className: 'chat-confirm-actions' },
                React.createElement('label', { className: 'chat-confirm-checkbox' },
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: isChecklistConfirmed,
                        onChange: (event) => setIsChecklistConfirmed(Boolean(event.target.checked))
                    }),
                    React.createElement('span', null, 'I confirmed payment details, meetup plan, and item condition.')
                ),
                isBuyer && React.createElement('button', {
                    className: 'chat-confirm-btn buyer',
                    type: 'button',
                    onClick: handleBuyerConfirmReceived,
                    disabled: isConfirming || !isChecklistConfirmed
                }, isConfirming ? 'Saving...' : 'Buyer: Confirm Received'),
                isSeller && React.createElement('button', {
                    className: 'chat-confirm-btn seller',
                    type: 'button',
                    onClick: handleSellerConfirmSold,
                    disabled: isConfirming || listingStatus === 'sold' || !isChecklistConfirmed
                }, listingStatus === 'sold' ? 'Already Sold' : (isConfirming ? 'Saving...' : 'Seller: Confirm Sold')),
                isBuyer && isBuyerProtectionOpen && React.createElement('button', {
                    className: 'chat-confirm-btn issue',
                    type: 'button',
                    onClick: handleBuyerProtectionReport,
                    disabled: isConfirming
                }, 'Problem with this transaction?')
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
