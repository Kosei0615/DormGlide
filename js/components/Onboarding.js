// First-time welcome walkthrough: 4 compact cards, always skippable,
// under 30 seconds. Shows once per account (profiles.onboarded_at,
// localStorage fallback for offline/demo mode).
const OnboardingModal = ({ currentUser, onDone }) => {
    const [step, setStep] = React.useState(0);

    const steps = [
        {
            glyph: '🏫',
            title: `Welcome to the ${currentUser?.schoolName || 'campus'} market!`,
            body: 'Everything here is your campus only — every listing, every buyer, every seller is a fellow student. Browse from the Home tab any time.'
        },
        {
            glyph: '🔔',
            title: 'Wishlist finds things FOR you',
            body: 'Looking for something? Add it to your Wishlist (a keyword, a category, a max price). The moment a matching item is posted, you get a notification and an email. No more refreshing.'
        },
        {
            glyph: '🤝',
            title: 'Deals happen in person',
            body: 'Request an item, agree on a campus meetup in chat, pay at handoff with Venmo, Zelle, Cash App, or cash. DormGlide never touches your money — a step-by-step guide walks you both through every deal.'
        },
        {
            glyph: '➕',
            title: 'Selling takes a minute',
            body: 'Tap Sell, snap a few photos, set a price — done. Moving out later? Set a handoff date and buyers can RESERVE your item today, pick it up when you\'re ready. Every listing is matched against everyone\'s wishlists.'
        }
    ];

    const isLast = step === steps.length - 1;
    const current = steps[step];

    const finish = () => {
        if (currentUser?.id) {
            window.DormGlideAuth?.markOnboarded?.(currentUser.id);
        }
        onDone();
    };

    return React.createElement('div', { className: 'onboarding-overlay', role: 'dialog', 'aria-modal': true },
        React.createElement('div', { className: 'onboarding-card' },
            React.createElement('button', {
                className: 'onboarding-skip',
                onClick: finish
            }, 'Skip'),

            React.createElement('div', { className: 'onboarding-glyph', 'aria-hidden': true }, current.glyph),
            React.createElement('h2', null, current.title),
            React.createElement('p', null, current.body),

            React.createElement('div', { className: 'onboarding-dots' },
                steps.map((_, index) => React.createElement('span', {
                    key: index,
                    className: `onboarding-dot ${index === step ? 'active' : ''}`
                }))
            ),

            React.createElement('div', { className: 'onboarding-actions' },
                step > 0 && React.createElement('button', {
                    className: 'btn btn-secondary',
                    onClick: () => setStep(step - 1)
                }, 'Back'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => (isLast ? finish() : setStep(step + 1))
                }, isLast ? "Let's go!" : 'Next')
            )
        )
    );
};

// One-time contextual hint bar for key screens. Dismisses forever per device.
const DormGlideHint = ({ hintKey, icon = '💡', children }) => {
    const storageKey = `dormglide_hint_${hintKey}`;
    const [visible, setVisible] = React.useState(() => {
        try {
            return !localStorage.getItem(storageKey);
        } catch (_error) {
            return false;
        }
    });

    if (!visible) return null;

    const dismiss = () => {
        try {
            localStorage.setItem(storageKey, 'seen');
        } catch (_error) { /* storage unavailable */ }
        setVisible(false);
    };

    return React.createElement('div', { className: 'contextual-hint' },
        React.createElement('span', { className: 'contextual-hint-icon', 'aria-hidden': true }, icon),
        React.createElement('p', null, children),
        React.createElement('button', {
            className: 'contextual-hint-close',
            'aria-label': 'Dismiss tip',
            onClick: dismiss
        }, React.createElement('i', { className: 'fa-solid fa-xmark' }))
    );
};

window.DormGlideOnboarding = OnboardingModal;
window.DormGlideHint = DormGlideHint;
