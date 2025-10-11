const Header = ({ currentPage, onNavigate, currentUser, onShowAuth, onLogout }) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [showUserMenu, setShowUserMenu] = React.useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const handleNavigation = (page) => {
        onNavigate(page);
        setIsMenuOpen(false);
        setShowUserMenu(false);
    };

    const handleLogout = () => {
        if (confirm('Are you sure you want to logout?')) {
            onLogout();
            setShowUserMenu(false);
            setIsMenuOpen(false);
        }
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
                
                currentUser ? (
                    // User menu dropdown
                    React.createElement('div', { className: 'user-menu-container' },
                        React.createElement('button', {
                            className: 'nav-btn user-menu-btn',
                            onClick: () => setShowUserMenu(!showUserMenu)
                        },
                            React.createElement('i', { className: 'fas fa-user-circle' }),
                            React.createElement('span', null, currentUser.name),
                            React.createElement('i', { className: 'fas fa-chevron-down' })
                        ),
                        
                        showUserMenu && React.createElement('div', { className: 'user-dropdown' },
                            React.createElement('div', { className: 'user-dropdown-header' },
                                React.createElement('p', null, currentUser.name),
                                React.createElement('small', null, currentUser.email)
                            ),
                            React.createElement('button', {
                                onClick: () => handleNavigation('dashboard')
                            },
                                React.createElement('i', { className: 'fas fa-chart-line' }),
                                'My Dashboard'
                            ),
                            React.createElement('button', {
                                onClick: () => handleNavigation('profile')
                            },
                                React.createElement('i', { className: 'fas fa-user' }),
                                'My Profile'
                            ),
                            window.DormGlideAuth && window.DormGlideAuth.isAdmin(currentUser) && (
                                React.createElement('button', {
                                    onClick: () => handleNavigation('admin')
                                },
                                    React.createElement('i', { className: 'fas fa-shield-alt' }),
                                    'Admin Panel'
                                )
                            ),
                            React.createElement('hr'),
                            React.createElement('button', {
                                onClick: handleLogout,
                                className: 'logout-btn'
                            },
                                React.createElement('i', { className: 'fas fa-sign-out-alt' }),
                                'Logout'
                            )
                        )
                    )
                ) : (
                    React.createElement('button', {
                        className: 'nav-btn btn-primary',
                        onClick: onShowAuth
                    }, 
                        React.createElement('i', { className: 'fas fa-sign-in-alt' }),
                        React.createElement('span', null, 'Login / Sign Up')
                    )
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
            
            currentUser ? (
                React.createElement(React.Fragment, null,
                    React.createElement('button', {
                        className: `nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`,
                        onClick: () => handleNavigation('dashboard')
                    }, 
                        React.createElement('i', { className: 'fas fa-chart-line' }),
                        React.createElement('span', null, 'Dashboard')
                    ),
                    React.createElement('button', {
                        className: `nav-btn ${currentPage === 'profile' ? 'active' : ''}`,
                        onClick: () => handleNavigation('profile')
                    }, 
                        React.createElement('i', { className: 'fas fa-user' }),
                        React.createElement('span', null, 'Profile')
                    ),
                    window.DormGlideAuth && window.DormGlideAuth.isAdmin(currentUser) && (
                        React.createElement('button', {
                            className: `nav-btn ${currentPage === 'admin' ? 'active' : ''}`,
                            onClick: () => handleNavigation('admin')
                        }, 
                            React.createElement('i', { className: 'fas fa-shield-alt' }),
                            React.createElement('span', null, 'Admin')
                        )
                    ),
                    React.createElement('button', {
                        className: 'nav-btn logout-btn',
                        onClick: handleLogout
                    }, 
                        React.createElement('i', { className: 'fas fa-sign-out-alt' }),
                        React.createElement('span', null, 'Logout')
                    )
                )
            ) : (
                React.createElement('button', {
                    className: 'nav-btn btn-primary',
                    onClick: () => {
                        onShowAuth();
                        setIsMenuOpen(false);
                    }
                }, 
                    React.createElement('i', { className: 'fas fa-sign-in-alt' }),
                    React.createElement('span', null, 'Login / Sign Up')
                )
            )
        )
    );
};
