// "Complete your deal" panel — the guided transaction flow shown to both
// parties once a purchase request exists. One primary action per state per
// role; the database triggers own listing sync + counterparty notifications.
const DEAL_STATUS_META = {
    pending: { label: 'Requested', cls: 'deal-status-requested', step: 0 },
    accepted: { label: 'Accepted', cls: 'deal-status-accepted', step: 1 },
    meetup_arranged: { label: 'Meetup arranged', cls: 'deal-status-meetup', step: 2 },
    completed: { label: 'Completed', cls: 'deal-status-completed', step: 3 },
    cancelled: { label: 'Cancelled', cls: 'deal-status-cancelled', step: -1 },
    declined: { label: 'Declined', cls: 'deal-status-cancelled', step: -1 }
};

const DEAL_CANCEL_REASONS = [
    'Changed my mind',
    'Item no longer available',
    "We couldn't meet up",
    "Seller didn't follow through",
    'Other'
];

const DealPaymentHelp = ({ paymentMethods }) => {
    const [open, setOpen] = React.useState(false);

    return React.createElement('div', { className: 'deal-payment-help' },
        React.createElement('button', {
            type: 'button',
            className: 'deal-payment-toggle',
            onClick: () => setOpen(!open),
            'aria-expanded': open
        },
            React.createElement('i', { className: 'fa-solid fa-circle-dollar-to-slot' }),
            ' How do I pay? ',
            React.createElement('i', { className: `fa-solid fa-chevron-${open ? 'up' : 'down'}` })
        ),
        open && React.createElement('div', { className: 'deal-payment-body' },
            Array.isArray(paymentMethods) && paymentMethods.length > 0 && React.createElement('p', { className: 'deal-payment-accepts' },
                React.createElement('strong', null, 'This seller accepts: '),
                paymentMethods.join(' · ')
            ),
            React.createElement('ul', { className: 'deal-payment-options' },
                React.createElement('li', null, React.createElement('strong', null, 'Venmo / Cash App / Zelle'), ' — free student-to-student transfers from your phone. Exchange usernames in chat.'),
                React.createElement('li', null, React.createElement('strong', null, 'Cash'), ' — always works. Bring exact change if you can.')
            ),
            React.createElement('div', { className: 'deal-safety-rules' },
                React.createElement('p', null, '✅ Pay only at handoff, after inspecting the item.'),
                React.createElement('p', null, '🚫 Never pay before seeing the item in person.'),
                React.createElement('p', null, '🏫 Meet in public campus spots (library, student union).')
            ),
            React.createElement('p', { className: 'deal-disclaimer' },
                React.createElement('i', { className: 'fa-solid fa-shield-halved' }),
                ' DormGlide never handles money — you pay each other directly.'
            )
        )
    );
};

const DealPanel = ({ request, product, currentUser, onRefresh, onOpenChat }) => {
    const toast = window.DormGlideToast || { success: () => {}, error: () => {}, info: () => {}, warning: () => {} };
    const [busyAction, setBusyAction] = React.useState('');
    const [meetupNote, setMeetupNote] = React.useState(request?.meetupNote || '');
    const [showCancel, setShowCancel] = React.useState(false);
    const [cancelReason, setCancelReason] = React.useState(DEAL_CANCEL_REASONS[0]);

    React.useEffect(() => {
        setMeetupNote(request?.meetupNote || '');
    }, [request?.id, request?.meetupNote]);

    if (!request || !currentUser?.id) return null;

    const status = String(request.status || 'pending').toLowerCase();
    const meta = DEAL_STATUS_META[status] || DEAL_STATUS_META.pending;
    const isBuyer = currentUser.id === request.buyerId;
    const isSeller = currentUser.id === request.sellerId;
    if (!isBuyer && !isSeller) return null;

    const otherName = window.DormGlideAuth?.getUserById?.(isBuyer ? request.sellerId : request.buyerId)?.name
        || (isBuyer ? 'the seller' : 'the buyer');

    const run = async (actionKey, fn, successMessage) => {
        if (busyAction) return;
        setBusyAction(actionKey);
        try {
            await fn();
            if (successMessage) toast.success(successMessage);
            if (onRefresh) await onRefresh();
        } catch (error) {
            console.error(`[DormGlide] Deal action ${actionKey} failed:`, error);
            toast.error(error?.message || 'Unable to update the deal right now. Please try again.');
        } finally {
            setBusyAction('');
        }
    };

    const spinner = (key) => busyAction === key && React.createElement('i', { className: 'fas fa-spinner fa-spin' });

    const steps = ['Accepted', 'Meet up', 'Pay & complete'];
    const activeStep = meta.step;

    const primaryBtn = (key, label, fn, successMsg) => React.createElement('button', {
        className: 'btn btn-primary deal-action-btn',
        disabled: Boolean(busyAction),
        onClick: () => run(key, fn, successMsg)
    }, spinner(key), label);

    const renderActions = () => {
        if (status === 'pending') {
            if (isSeller) {
                return React.createElement('div', { className: 'deal-actions' },
                    primaryBtn('accept',
                        'Accept request',
                        () => window.DormGlideStorage.acceptDeal({ listingId: request.listingId, requestId: request.id }),
                        'Request accepted! Now arrange a meetup.'),
                    React.createElement('button', {
                        className: 'btn btn-outline btn-danger deal-action-btn',
                        disabled: Boolean(busyAction),
                        onClick: () => run('decline',
                            () => window.DormGlideStorage.declineDeal({ listingId: request.listingId, requestId: request.id }),
                            'Request declined.')
                    }, spinner('decline'), 'Decline')
                );
            }
            return React.createElement('p', { className: 'deal-waiting' },
                React.createElement('i', { className: 'fas fa-hourglass-half' }),
                ` Waiting for ${otherName} to accept your request.`);
        }

        if (status === 'accepted' || status === 'meetup_arranged') {
            return React.createElement('div', null,
                React.createElement('div', { className: 'deal-meetup-row' },
                    React.createElement('input', {
                        type: 'text',
                        className: 'deal-meetup-input',
                        placeholder: 'Meetup spot & time — e.g. Slayter steps, Fri 3pm',
                        value: meetupNote,
                        maxLength: 200,
                        onChange: (e) => setMeetupNote(e.target.value)
                    }),
                    React.createElement('button', {
                        className: `btn ${status === 'accepted' ? 'btn-primary' : 'btn-secondary'} deal-action-btn`,
                        disabled: Boolean(busyAction) || !meetupNote.trim(),
                        onClick: () => run('meetup',
                            () => window.DormGlideStorage.arrangeDealMeetup({ requestId: request.id, note: meetupNote }),
                            'Meetup saved — the other person has been notified.')
                    }, spinner('meetup'), status === 'meetup_arranged' ? 'Update meetup' : 'Set meetup')
                ),
                status === 'meetup_arranged' && request.meetupNote && React.createElement('p', { className: 'deal-meetup-note' },
                    React.createElement('i', { className: 'fas fa-location-dot' }),
                    ` ${request.meetupNote}`),
                React.createElement('div', { className: 'deal-actions' },
                    status === 'meetup_arranged'
                        ? primaryBtn('complete',
                            'Mark complete',
                            () => window.DormGlideStorage.completeDeal({ listingId: request.listingId, requestId: request.id }),
                            'Deal complete — congrats! 🎉')
                        : React.createElement('button', {
                            className: 'btn btn-secondary deal-action-btn',
                            disabled: Boolean(busyAction),
                            onClick: () => run('complete',
                                () => window.DormGlideStorage.completeDeal({ listingId: request.listingId, requestId: request.id }),
                                'Deal complete — congrats! 🎉')
                        }, spinner('complete'), 'Mark complete'),
                    onOpenChat && React.createElement('button', {
                        className: 'btn btn-secondary deal-action-btn',
                        onClick: onOpenChat
                    }, React.createElement('i', { className: 'fas fa-comment' }), ` Message ${isBuyer ? 'seller' : 'buyer'}`)
                )
            );
        }

        if (status === 'completed') {
            return React.createElement('div', { className: 'deal-done' },
                React.createElement('p', null, '🎉 This deal is complete.'),
                isBuyer && React.createElement('p', { className: 'deal-done-hint' },
                    'Help other students: rate this seller on the listing page.')
            );
        }

        if (status === 'cancelled' || status === 'declined') {
            return React.createElement('p', { className: 'deal-cancelled-note' },
                status === 'declined'
                    ? 'This request was declined.'
                    : `This deal was cancelled${request.cancelReason ? ` — ${request.cancelReason}` : ''}.`);
        }

        return null;
    };

    // Sellers already have Decline while a request is pending; Cancel would duplicate it.
    const cancellable = ['accepted', 'meetup_arranged'].includes(status)
        || (status === 'pending' && isBuyer);

    return React.createElement('div', { className: 'deal-panel' },
        window.DormGlideHint && React.createElement(window.DormGlideHint, { hintKey: 'deal', icon: '🤝' },
            'This panel guides you both through the deal: agree on a campus meetup, pay in person at handoff, then mark it complete.'
        ),
        React.createElement('div', { className: 'deal-panel-header' },
            React.createElement('h3', null, 'Complete your deal'),
            React.createElement('span', { className: `deal-status-chip ${meta.cls}` }, meta.label)
        ),

        // Reserve-ahead deals show the pickup date up front.
        (() => {
            const pickup = product?.availableFrom ? new Date(`${product.availableFrom}T00:00:00`) : null;
            if (!pickup || Number.isNaN(pickup.getTime()) || pickup <= new Date()) return null;
            if (!['pending', 'accepted', 'meetup_arranged'].includes(status)) return null;
            return React.createElement('p', { className: 'deal-pickup-line' },
                '📅 ',
                React.createElement('strong', null,
                    `Pickup from ${pickup.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`),
                ' — this is a reservation. No money changes hands until handoff day. We\'ll remind you both as it gets close.'
            );
        })(),

        activeStep >= 0 && React.createElement('ol', { className: 'deal-steps' },
            steps.map((label, index) => React.createElement('li', {
                key: label,
                className: `deal-step ${index < activeStep ? 'done' : ''} ${index === activeStep ? 'current' : ''}`
            },
                React.createElement('span', { className: 'deal-step-dot' }, index < activeStep ? '✓' : index + 1),
                React.createElement('span', { className: 'deal-step-label' }, label)
            ))
        ),

        renderActions(),

        ['accepted', 'meetup_arranged'].includes(status) && React.createElement(DealPaymentHelp, {
            paymentMethods: product?.paymentMethods
        }),

        cancellable && (showCancel
            ? React.createElement('div', { className: 'deal-cancel-box' },
                React.createElement('label', null, 'Why are you cancelling?'),
                React.createElement('select', {
                    value: cancelReason,
                    onChange: (e) => setCancelReason(e.target.value)
                }, DEAL_CANCEL_REASONS.map((reason) =>
                    React.createElement('option', { key: reason, value: reason }, reason))),
                React.createElement('div', { className: 'deal-actions' },
                    React.createElement('button', {
                        className: 'btn btn-sm btn-danger deal-action-btn',
                        disabled: Boolean(busyAction),
                        onClick: () => run('cancel', async () => {
                            await window.DormGlideStorage.cancelDeal({ listingId: request.listingId, requestId: request.id, reason: cancelReason });
                            if (isBuyer && cancelReason === "Seller didn't follow through") {
                                toast.info('Sorry that happened. Consider rating this seller below to help other students.');
                            }
                        }, 'Deal cancelled.')
                    }, spinner('cancel'), 'Confirm cancel'),
                    React.createElement('button', {
                        className: 'btn btn-sm btn-secondary deal-action-btn',
                        onClick: () => setShowCancel(false)
                    }, 'Keep the deal')
                )
            )
            : React.createElement('button', {
                className: 'deal-cancel-link',
                onClick: () => setShowCancel(true)
            }, 'Cancel this deal'))
    );
};

window.DormGlideDealPanel = DealPanel;
window.DormGlideDealStatusLabel = (status) =>
    (DEAL_STATUS_META[String(status || '').toLowerCase()] || DEAL_STATUS_META.pending).label;
window.DormGlideDealStatusClass = (status) =>
    (DEAL_STATUS_META[String(status || '').toLowerCase()] || DEAL_STATUS_META.pending).cls;
