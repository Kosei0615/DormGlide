const Header = ({ currentPage, onNavigate, currentUser, onShowAuth, onLogout }) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [showUserMenu, setShowUserMenu] = React.useState(false);
    const [chatBackend, setChatBackend] = React.useState(null);

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

    // Close user menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (showUserMenu && !event.target.closest('.user-menu-container')) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showUserMenu]);

    React.useEffect(() => {
        let isMounted = true;

        const refresh = () => {
            const status = window.DormGlideChat?.getStatus?.();
            const backend = status?.backend || (window.SupabaseClient ? 'supabase' : 'local');
            if (isMounted) setChatBackend(backend);
        };

        refresh();
        const timer = setInterval(refresh, 2500);
        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, []);

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

                currentUser && React.createElement('button', {
                    className: `nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`,
                    onClick: () => handleNavigation('dashboard')
                },
                    React.createElement('i', { className: 'fas fa-chart-line' }),
                    React.createElement('span', null, 'Dashboard')
                ),
                
                currentUser ? (
                    // User menu dropdown
                    React.createElement('div', { className: 'user-menu-container' },
                        React.createElement('button', {
                            className: 'nav-btn user-menu-btn active',
                            onClick: (e) => {
                                e.stopPropagation();
                                setShowUserMenu(!showUserMenu);
                            }
                        },
                            React.createElement('div', { className: 'user-avatar' },
                                React.createElement('i', { className: 'fas fa-user-circle' })
                            ),
                            React.createElement('div', { className: 'user-info-compact' },
                                React.createElement('span', { className: 'user-name' }, currentUser.name),
                                React.createElement('span', { className: 'user-status' }, 
                                    React.createElement('span', { className: 'status-dot' }),
                                    `Chat: ${chatBackend === 'supabase' ? 'Live' : 'Local'}`
                                )
                            ),
                            React.createElement('i', { className: `fas fa-chevron-down ${showUserMenu ? 'rotated' : ''}` })
                        ),
                        
                        showUserMenu && React.createElement('div', { className: 'user-dropdown' },
                            React.createElement('div', { className: 'user-dropdown-header' },
                                React.createElement('div', { className: 'user-avatar-large' },
                                    React.createElement('i', { className: 'fas fa-user-circle' })
                                ),
                                React.createElement('div', null,
                                    React.createElement('p', null, currentUser.name),
                                    React.createElement('small', null, currentUser.email)
                                )
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
                        className: 'nav-btn btn-primary login-btn',
                        onClick: onShowAuth
                    }, 
                        React.createElement('i', { className: 'fas fa-sign-in-alt' }),
                        React.createElement('span', null, 'Login')
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
