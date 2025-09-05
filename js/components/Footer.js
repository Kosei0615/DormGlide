const Footer = () => {
    return React.createElement('footer', { className: 'footer' },
        React.createElement('div', { className: 'footer-container' },
            React.createElement('div', { className: 'footer-section' },
                React.createElement('h3', null, 'DormGlide'),
                React.createElement('p', null, 'The trusted marketplace for students to buy and sell used goods safely and easily.')
            ),
            React.createElement('div', { className: 'footer-section' },
                React.createElement('h4', null, 'Quick Links'),
                React.createElement('ul', null,
                    React.createElement('li', null, React.createElement('a', { href: '#' }, 'How it Works')),
                    React.createElement('li', null, React.createElement('a', { href: '#' }, 'Safety Tips')),
                    React.createElement('li', null, React.createElement('a', { href: '#' }, 'FAQ')),
                    React.createElement('li', null, React.createElement('a', { href: '#' }, 'Contact Us'))
                )
            ),
            React.createElement('div', { className: 'footer-section' },
                React.createElement('h4', null, 'Categories'),
                React.createElement('ul', null,
                    React.createElement('li', null, React.createElement('a', { href: '#' }, 'Electronics')),
                    React.createElement('li', null, React.createElement('a', { href: '#' }, 'Textbooks')),
                    React.createElement('li', null, React.createElement('a', { href: '#' }, 'Furniture')),
                    React.createElement('li', null, React.createElement('a', { href: '#' }, 'Clothing'))
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
            React.createElement('p', null, '© 2025 DormGlide. All rights reserved. Made for students, by students.')
        )
    );
};
