const Footer = ({ onNavigate }) => {
    const socialIcon = (kind) => {
        if (kind === 'instagram') {
            return React.createElement('svg', { viewBox: '0 0 24 24', role: 'img', 'aria-hidden': 'true' },
                React.createElement('rect', { x: '3', y: '3', width: '18', height: '18', rx: '5', ry: '5', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }),
                React.createElement('circle', { cx: '12', cy: '12', r: '4.2', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }),
                React.createElement('circle', { cx: '17.2', cy: '6.8', r: '1.3', fill: 'currentColor' })
            );
        }
        if (kind === 'x') {
            return React.createElement('svg', { viewBox: '0 0 24 24', role: 'img', 'aria-hidden': 'true' },
                React.createElement('path', { d: 'M4 4L20 20M20 4L4 20', stroke: 'currentColor', strokeWidth: '2.4', strokeLinecap: 'round' })
            );
        }
        return React.createElement('svg', { viewBox: '0 0 24 24', role: 'img', 'aria-hidden': 'true' },
            React.createElement('rect', { x: '3', y: '5', width: '18', height: '14', rx: '2', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }),
            React.createElement('path', { d: 'M4 7L12 13L20 7', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' })
        );
    };

    const handleNavClick = (event, page) => {
        event.preventDefault();
        if (onNavigate) onNavigate(page);
    };

    const handleCategoryClick = (event, category) => {
        event.preventDefault();
        if (onNavigate) onNavigate('home', null, { category });
    };

    return React.createElement('footer', { className: 'footer' },
        React.createElement('div', { className: 'footer-container' },
            React.createElement('div', { className: 'footer-section footer-brand' },
                React.createElement('h3', null,
                    React.createElement('span', { className: 'footer-logo-mark', 'aria-hidden': 'true' }, '🏠'),
                    'DormGlide'
                ),
                React.createElement('p', null, 'Move in lighter, live smarter: trusted student-to-student buying and selling on campus.')
            ),
            React.createElement('div', { className: 'footer-section' },
                React.createElement('h4', null, 'Quick Links'),
                React.createElement('ul', null,
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleNavClick(event, 'how-it-works')
                    }, '🧭 How It Works')),
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleNavClick(event, 'privacy-policy')
                    }, '🛡️ Privacy Policy')),
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleNavClick(event, 'how-it-works')
                    }, '✅ Safety Tips')),
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleNavClick(event, 'how-it-works')
                    }, '📋 Risk Checklist'))
                )
            ),
            React.createElement('div', { className: 'footer-section' },
                React.createElement('h4', null, 'Categories'),
                React.createElement('ul', null,
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleCategoryClick(event, 'Electronics')
                    }, '💻 Electronics')),
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleCategoryClick(event, 'Textbooks')
                    }, '📚 Textbooks')),
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleCategoryClick(event, 'Furniture')
                    }, '🛋️ Furniture')),
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleCategoryClick(event, 'Clothing')
                    }, '👕 Clothing'))
                )
            ),
            React.createElement('div', { className: 'footer-section' },
                React.createElement('h4', null, 'Connect'),
                React.createElement('div', { className: 'social-links' },
                    React.createElement('a', { href: '#', 'aria-label': 'Instagram' }, 
                        socialIcon('instagram')
                    ),
                    React.createElement('a', { href: '#', 'aria-label': 'X' }, 
                        socialIcon('x')
                    ),
                    React.createElement('a', { href: '#', 'aria-label': 'Email' }, 
                        socialIcon('mail')
                    )
                )
            )
        ),
        React.createElement('div', { className: 'footer-bottom' },
            React.createElement('p', null, '© 2026 DormGlide. Built for real campus life: clear deals, safer meetups, and respectful community trade.')
        )
    );
};
