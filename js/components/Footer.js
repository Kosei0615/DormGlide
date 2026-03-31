const Footer = ({ onNavigate }) => {
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
            React.createElement('div', { className: 'footer-section' },
                React.createElement('h3', null, 'DormGlide'),
                React.createElement('p', null, 'Move in lighter, live smarter: trusted student-to-student buying and selling on campus.')
            ),
            React.createElement('div', { className: 'footer-section' },
                React.createElement('h4', null, 'Quick Links'),
                React.createElement('ul', null,
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleNavClick(event, 'how-it-works')
                    }, 'How It Works')),
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleNavClick(event, 'privacy-policy')
                    }, 'Privacy Policy')),
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleNavClick(event, 'how-it-works')
                    }, 'Safety Tips')),
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleNavClick(event, 'how-it-works')
                    }, 'Risk Checklist'))
                )
            ),
            React.createElement('div', { className: 'footer-section' },
                React.createElement('h4', null, 'Categories'),
                React.createElement('ul', null,
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleCategoryClick(event, 'Electronics')
                    }, 'Electronics')),
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleCategoryClick(event, 'Textbooks')
                    }, 'Textbooks')),
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleCategoryClick(event, 'Furniture')
                    }, 'Furniture')),
                    React.createElement('li', null, React.createElement('a', {
                        href: '#',
                        onClick: (event) => handleCategoryClick(event, 'Clothing')
                    }, 'Clothing'))
                )
            ),
            React.createElement('div', { className: 'footer-section' },
                React.createElement('h4', null, 'Connect'),
                React.createElement('div', { className: 'social-links' },
                    React.createElement('a', { href: '#', 'aria-label': 'Facebook' }, 
                        React.createElement('i', { className: 'fab fa-facebook' })
                    ),
                    React.createElement('a', { href: '#', 'aria-label': 'Twitter' }, 
                        React.createElement('i', { className: 'fab fa-twitter' })
                    ),
                    React.createElement('a', { href: '#', 'aria-label': 'Instagram' }, 
                        React.createElement('i', { className: 'fab fa-instagram' })
                    )
                )
            )
        ),
        React.createElement('div', { className: 'footer-bottom' },
            React.createElement('p', null, '© 2026 DormGlide. Built for real campus life: clear deals, safer meetups, and respectful community trade.')
        )
    );
};
