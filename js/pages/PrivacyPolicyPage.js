const PrivacyPolicyPage = ({ onNavigate }) => {
    const [acknowledged, setAcknowledged] = React.useState(false);

    return React.createElement('div', { className: 'policy-page' },
        React.createElement('div', { className: 'policy-container' },
            React.createElement('button', {
                className: 'back-btn',
                onClick: () => onNavigate('home')
            },
                React.createElement('i', { className: 'fas fa-arrow-left' }),
                'Back to Home'
            ),
            React.createElement('h1', null, 'DormGlide Privacy Policy'),
            React.createElement('p', { className: 'policy-lead' },
                'Effective date: March 31, 2026. This policy explains what information DormGlide uses, why we use it, and your controls.'
            ),

            React.createElement('section', { className: 'policy-section' },
                React.createElement('h2', null, '1. Information We Collect'),
                React.createElement('ul', { className: 'policy-list' },
                    React.createElement('li', null, 'Account details: name, university email, and optional phone number for account setup and trust signals.'),
                    React.createElement('li', null, 'Listing details: item title, photos, price, category, condition, and meetup preference details you provide.'),
                    React.createElement('li', null, 'Transaction and chat activity: buyer/seller confirmations, payment method selection, and support reports.'),
                    React.createElement('li', null, 'Technical information: basic device and session information used to keep the service secure and reliable.')
                )
            ),

            React.createElement('section', { className: 'policy-section' },
                React.createElement('h2', null, '2. How We Use Information'),
                React.createElement('ul', { className: 'policy-list' },
                    React.createElement('li', null, 'Operate marketplace features such as listing visibility, chat, and sold-status updates.'),
                    React.createElement('li', null, 'Support safer transactions with confirmation steps, issue reporting, and moderation workflows.'),
                    React.createElement('li', null, 'Prevent abuse, fraud, and policy violations to protect students and campus communities.'),
                    React.createElement('li', null, 'Improve product experience, usability, and support response quality.')
                )
            ),

            React.createElement('section', { className: 'policy-section' },
                React.createElement('h2', null, '3. Sharing and Visibility'),
                React.createElement('p', null,
                    'DormGlide limits exposure of personal contact data on public listing pages. Buyers and sellers can coordinate through in-app chat. We do not sell personal data.'
                ),
                React.createElement('p', null,
                    'We may share limited data with service providers that host infrastructure or help with security, analytics, and moderation under confidentiality obligations.'
                )
            ),

            React.createElement('section', { className: 'policy-section' },
                React.createElement('h2', null, '4. User Controls'),
                React.createElement('ul', { className: 'policy-list' },
                    React.createElement('li', null, 'Edit profile and listing information from your account pages.'),
                    React.createElement('li', null, 'Use built-in chat confirmations and transaction issue reporting tools.'),
                    React.createElement('li', null, 'Request account deletion or data export by contacting the DormGlide team.')
                )
            ),

            React.createElement('section', { className: 'policy-section' },
                React.createElement('h2', null, '5. Safety and Retention'),
                React.createElement('p', null,
                    'We keep data only as long as needed for core marketplace operations, safety investigations, legal compliance, and dispute support.'
                ),
                React.createElement('p', null,
                    'Sensitive personal details should not be posted in listing descriptions. Use in-app controls and campus-safe meetup practices.'
                )
            ),

            React.createElement('section', { className: 'policy-section policy-ack' },
                React.createElement('label', { className: 'policy-checkbox-row' },
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: acknowledged,
                        onChange: (event) => setAcknowledged(Boolean(event.target.checked))
                    }),
                    React.createElement('span', null, 'I have read and understand the DormGlide Privacy Policy.')
                ),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    disabled: !acknowledged,
                    onClick: () => onNavigate('home')
                }, 'Return to Marketplace')
            )
        )
    );
};