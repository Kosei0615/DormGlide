// Housing-policy popups shown from the Sell page.
//   kind 'items'  — a prohibited item was found in a Dorm listing; blocks posting.
//   kind 'spaces' — shown once per session before a Glyde service is posted; acknowledge to continue.
const PolicyModal = ({ kind, matched, onClose, onContinue }) => {
    const P = window.DormGlidePolicy;
    if (!P) return null;
    const isItems = kind === 'items';
    const [showList, setShowList] = React.useState(false);

    React.useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const excerpt = isItems ? P.ITEMS_EXCERPT : P.SPACES_EXCERPT;
    const sections = isItems ? P.ITEMS_SECTIONS : P.SPACES_SECTIONS;

    return React.createElement('div', { className: 'policy-overlay', onClick: onClose, role: 'dialog', 'aria-modal': true },
        React.createElement('div', { className: 'policy-modal', onClick: (e) => e.stopPropagation() },
            React.createElement('button', { type: 'button', className: 'policy-close', 'aria-label': 'Close', onClick: onClose }, '✕'),
            React.createElement('div', { className: 'policy-head' },
                React.createElement('span', { className: 'policy-glyph', 'aria-hidden': true }, isItems ? '🚫' : '🏠'),
                React.createElement('h2', null, isItems ? 'This item can\'t be listed' : 'Before you post a service')
            ),
            isItems
                ? React.createElement('p', { className: 'policy-lead' },
                    'DormGlide follows Denison\'s policy on prohibited items in the residence halls. ',
                    matched && React.createElement(React.Fragment, null,
                        'Your listing mentions ', React.createElement('strong', null, matched.match),
                        ' (', matched.label, '), which students may not keep in campus housing, so it can\'t be posted here.'))
                : React.createElement('p', { className: 'policy-lead' },
                    'DormGlide follows Denison\'s residence policies on shared spaces. Services are arranged in chat and happen in spaces you\'re allowed to use. Don\'t turn a lounge, kitchen, hallway or your room into a storefront, keep common areas clear, and respect quiet hours.'),
            React.createElement('div', { className: 'policy-excerpt' },
                React.createElement('div', { className: 'policy-source' }, P.SOURCE, React.createElement('br'), React.createElement('span', null, sections)),
                excerpt.map((q, i) => React.createElement('p', { key: i }, q))
            ),
            isItems && React.createElement('div', { className: 'policy-listwrap' },
                React.createElement('button', { type: 'button', className: 'policy-link', onClick: () => setShowList((v) => !v) },
                    showList ? 'Hide the full list' : 'See the full list of prohibited items'),
                showList && React.createElement('ul', { className: 'policy-list' },
                    P.PROHIBITED_SUMMARY.map((line, i) => React.createElement('li', { key: i }, line)))
            ),
            React.createElement('div', { className: 'policy-actions' },
                isItems
                    ? React.createElement('button', { type: 'button', className: 'btn btn-primary', onClick: onClose }, 'Edit my listing')
                    : React.createElement(React.Fragment, null,
                        React.createElement('button', { type: 'button', className: 'btn btn-secondary', onClick: onClose }, 'Cancel'),
                        React.createElement('button', { type: 'button', className: 'btn btn-primary', onClick: onContinue }, 'I understand, post it'))
            )
        )
    );
};
window.PolicyModal = PolicyModal;
