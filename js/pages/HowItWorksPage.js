const HowItWorksPage = ({ onNavigate }) => {
    const steps = [
        {
            title: 'Find the Item',
            details: 'Browse listings, verify condition, and review seller rating before making an offer.'
        },
        {
            title: 'Start Purchase Chat',
            details: 'Use Proceed to Purchase to open chat and agree on payment method, amount, and meetup details.'
        },
        {
            title: 'Use Safety Checklist',
            details: 'Meet in public campus areas, confirm item condition first, and keep payment proof until both confirmations are complete.'
        },
        {
            title: 'Confirm Transaction',
            details: 'Buyer confirms item received and seller confirms sold so listing status and dashboard history stay accurate.'
        }
    ];

    const riskItems = [
        'Payment mismatch: Confirm exact amount and method in chat before meetup.',
        'No-show risk: Set clear location/time and send a final confirmation message before leaving.',
        'Item condition mismatch: Inspect the product in person before final handoff.',
        'Safety concern: Move to a populated area and report the transaction issue from chat.'
    ];

    return React.createElement('div', { className: 'policy-page' },
        React.createElement('div', { className: 'policy-container' },
            React.createElement('button', {
                className: 'back-btn',
                onClick: () => onNavigate('home')
            },
                React.createElement('i', { className: 'fas fa-arrow-left' }),
                'Back to Home'
            ),
            React.createElement('h1', null, 'How DormGlide Works'),
            React.createElement('p', { className: 'policy-lead' },
                'DormGlide is designed for clear agreements, safer meetups, and transparent buyer/seller confirmations.'
            ),
            React.createElement('div', { className: 'policy-card-grid' },
                steps.map((step, index) => React.createElement('article', { key: step.title, className: 'policy-card' },
                    React.createElement('span', { className: 'policy-step-number' }, `Step ${index + 1}`),
                    React.createElement('h3', null, step.title),
                    React.createElement('p', null, step.details)
                ))
            ),
            React.createElement('section', { className: 'policy-section' },
                React.createElement('h2', null, 'Risk Checklist'),
                React.createElement('ul', { className: 'policy-list' },
                    riskItems.map((item) => React.createElement('li', { key: item }, item))
                )
            ),
            React.createElement('section', { className: 'policy-section' },
                React.createElement('h2', null, 'Need Policy Details?'),
                React.createElement('p', null, 'See our Privacy Policy for what data we collect and how we protect it.'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => onNavigate('privacy-policy')
                },
                    React.createElement('i', { className: 'fas fa-shield-halved' }),
                    'Open Privacy Policy'
                )
            )
        )
    );
};