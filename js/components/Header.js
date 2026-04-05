const Header = ({ currentPage, onNavigate, currentUser, onShowAuth, onLogout }) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [showUserMenu, setShowUserMenu] = React.useState(false);
    const [showNotificationMenu, setShowNotificationMenu] = React.useState(false);
    const [unreadNotificationCount, setUnreadNotificationCount] = React.useState(0);
    const [notificationItems, setNotificationItems] = React.useState([]);
    const [chatBackend, setChatBackend] = React.useState(null);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const handleNavigation = (page, productId = null, options = {}) => {
        onNavigate(page, productId, options);
        setIsMenuOpen(false);
        setShowUserMenu(false);
        setShowNotificationMenu(false);
    };

    const refreshNotifications = React.useCallback(async () => {
        if (!currentUser?.id || !window.DormGlidePersonalization) {
            setUnreadNotificationCount(0);
            setNotificationItems([]);
            return;
        }

        try {
            const [count, items] = await Promise.all([
                window.DormGlidePersonalization.getUnreadNotificationCount(currentUser.id),
                window.DormGlidePersonalization.fetchNotifications({ userId: currentUser.id, limit: 8 })
            ]);
            setUnreadNotificationCount(Number(count || 0));
            setNotificationItems(Array.isArray(items) ? items : []);
        } catch (error) {
            console.warn('[DormGlide] Failed to refresh notifications:', error);
            setUnreadNotificationCount(0);
            setNotificationItems([]);
        }
    }, [currentUser?.id]);

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
            if (showNotificationMenu && !event.target.closest('.notifications-menu-container')) {
                setShowNotificationMenu(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showUserMenu, showNotificationMenu]);

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

    React.useEffect(() => {
        let timer = null;
        refreshNotifications();
        if (currentUser?.id) {
            timer = setInterval(refreshNotifications, 8000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [currentUser?.id, refreshNotifications]);

    const handleToggleNotifications = async (event) => {
        event.stopPropagation();
        const next = !showNotificationMenu;
        setShowNotificationMenu(next);
        if (next && currentUser?.id && window.DormGlidePersonalization?.markNotificationsRead) {
            await window.DormGlidePersonalization.markNotificationsRead({ userId: currentUser.id });
            refreshNotifications();
        }
    };

    const handleNotificationClick = (item) => {
        setShowNotificationMenu(false);
        if (item?.listing_id) {
            onNavigate('product-detail', item.listing_id);
            return;
        }
        onNavigate('dashboard', null, { tab: 'alerts' });
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
                    className: `nav-btn ${currentPage === 'how-it-works' ? 'active' : ''}`,
                    onClick: () => handleNavigation('how-it-works')
                },
                    React.createElement('i', { className: 'fas fa-compass' }),
                    React.createElement('span', null, 'How It Works')
                ),
                React.createElement('button', {
                    className: `nav-btn ${currentPage === 'privacy-policy' ? 'active' : ''}`,
                    onClick: () => handleNavigation('privacy-policy')
                },
                    React.createElement('i', { className: 'fas fa-shield-halved' }),
                    React.createElement('span', null, 'Policy')
                ),

                currentUser && React.createElement('button', {
                    className: `nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`,
                    onClick: () => handleNavigation('dashboard')
                },
                    React.createElement('i', { className: 'fas fa-chart-line' }),
                    React.createElement('span', null, 'Dashboard')
                ),

                currentUser && React.createElement('button', {
                    className: `nav-btn ${currentPage === 'messages' ? 'active' : ''}`,
                    onClick: () => handleNavigation('messages')
                },
                    React.createElement('i', { className: 'fa-solid fa-comment' }),
                    React.createElement('span', null, 'Messages')
                ),

                currentUser && React.createElement('div', { className: 'notifications-menu-container' },
                    React.createElement('button', {
                        className: `nav-btn notification-btn ${showNotificationMenu ? 'active' : ''}`,
                        title: 'Notifications',
                        'aria-label': 'Notifications',
                        onClick: handleToggleNotifications
                    },
                        React.createElement('i', { className: 'fa-solid fa-bell' }),
                        unreadNotificationCount > 0 && React.createElement('span', { className: 'notification-badge' }, unreadNotificationCount > 9 ? '9+' : unreadNotificationCount)
                    ),
                    showNotificationMenu && React.createElement('div', { className: 'notifications-dropdown' },
                        React.createElement('div', { className: 'user-dropdown-header' },
                            React.createElement('p', null, 'Notifications'),
                            React.createElement('small', null, unreadNotificationCount > 0 ? `${unreadNotificationCount} unread` : 'All caught up')
                        ),
                        notificationItems.length === 0
                            ? React.createElement('div', { className: 'notifications-empty' }, 'No notifications yet.')
                            : notificationItems.map((item) => React.createElement('button', {
                                key: item.id,
                                onClick: () => handleNotificationClick(item),
                                className: `notification-item ${item.is_read ? '' : 'unread'}`
                            },
                                React.createElement('i', { className: 'fa-solid fa-bell' }),
                                React.createElement('span', null, item.message || 'New DormGlide notification')
                            ))
                    )
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
                                onClick: () => handleNavigation('messages')
                            },
                                React.createElement('i', { className: 'fa-solid fa-comment' }),
                                'Messages'
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
                                React.createElement('i', { className: 'fa-solid fa-right-from-bracket' }),
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
                className: 'mobile-menu-toggle icon-btn',
                title: isMenuOpen ? 'Close menu' : 'Open menu',
                'aria-label': isMenuOpen ? 'Close menu' : 'Open menu',
                onClick: toggleMenu
            },
                React.createElement('i', { className: isMenuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars' })
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
                className: `nav-btn ${currentPage === 'how-it-works' ? 'active' : ''}`,
                onClick: () => handleNavigation('how-it-works')
            },
                React.createElement('i', { className: 'fas fa-compass' }),
                React.createElement('span', null, 'How It Works')
            ),
            React.createElement('button', {
                className: `nav-btn ${currentPage === 'privacy-policy' ? 'active' : ''}`,
                onClick: () => handleNavigation('privacy-policy')
            },
                React.createElement('i', { className: 'fas fa-shield-halved' }),
                React.createElement('span', null, 'Policy')
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
                        className: `nav-btn ${currentPage === 'messages' ? 'active' : ''}`,
                        onClick: () => handleNavigation('messages')
                    }, 
                        React.createElement('i', { className: 'fa-solid fa-comment' }),
                        React.createElement('span', null, 'Messages')
                    ),
                    React.createElement('button', {
                        className: 'nav-btn',
                        onClick: () => handleNavigation('dashboard', null, { tab: 'alerts' })
                    },
                        React.createElement('i', { className: 'fa-solid fa-bell' }),
                        React.createElement('span', null, `Notifications${unreadNotificationCount > 0 ? ` (${unreadNotificationCount})` : ''}`)
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
                        React.createElement('i', { className: 'fa-solid fa-right-from-bracket' }),
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
