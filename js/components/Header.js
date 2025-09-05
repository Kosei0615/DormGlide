const Header = ({ currentPage, onNavigate, currentUser }) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const handleNavigation = (page) => {
        onNavigate(page);
        setIsMenuOpen(false);
    };

    return React.createElement('header', { className: 'header' },
        React.createElement('div', { className: 'header-container' },
            // Logo and brand
            React.createElement('div', { 
                className: 'header-brand',
                onClick: () => handleNavigation('home')
            },
                React.createElement('i', { className: 'fas fa-home' }),
                React.createElement('span', null, 'DormGlide')
            ),

            // Desktop Navigation
            React.createElement('nav', { className: 'header-nav desktop-nav' },
                React.createElement('button', {
                    className: `nav-btn ${currentPage === 'home' ? 'active' : ''}`,
                    onClick: () => handleNavigation('home')
                }, 
                    React.createElement('i', { className: 'fas fa-store' }),
                    React.createElement('span', null, 'Browse')
                ),
                React.createElement('button', {
                    className: `nav-btn ${currentPage === 'sell' ? 'active' : ''}`,
                    onClick: () => handleNavigation('sell')
                }, 
                    React.createElement('i', { className: 'fas fa-plus-circle' }),
                    React.createElement('span', null, 'Sell')
                ),
                React.createElement('button', {
                    className: `nav-btn ${currentPage === 'profile' ? 'active' : ''}`,
                    onClick: () => handleNavigation('profile')
                }, 
                    React.createElement('i', { className: 'fas fa-user' }),
                    React.createElement('span', null, currentUser ? currentUser.name : 'Profile')
                )
            ),

            // Mobile menu toggle
            React.createElement('button', {
                className: 'mobile-menu-toggle',
                onClick: toggleMenu
            },
                React.createElement('i', { className: isMenuOpen ? 'fas fa-times' : 'fas fa-bars' })
            )
        ),

        // Mobile Navigation Menu
        isMenuOpen && React.createElement('nav', { className: 'header-nav mobile-nav' },
            React.createElement('button', {
                className: `nav-btn ${currentPage === 'home' ? 'active' : ''}`,
                onClick: () => handleNavigation('home')
            }, 
                React.createElement('i', { className: 'fas fa-store' }),
                React.createElement('span', null, 'Browse')
            ),
            React.createElement('button', {
                className: `nav-btn ${currentPage === 'sell' ? 'active' : ''}`,
                onClick: () => handleNavigation('sell')
            }, 
                React.createElement('i', { className: 'fas fa-plus-circle' }),
                React.createElement('span', null, 'Sell')
            ),
            React.createElement('button', {
                className: `nav-btn ${currentPage === 'profile' ? 'active' : ''}`,
                onClick: () => handleNavigation('profile')
            }, 
                React.createElement('i', { className: 'fas fa-user' }),
                React.createElement('span', null, currentUser ? currentUser.name : 'Profile')
            )
        )
    );
};
