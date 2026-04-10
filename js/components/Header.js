const Header = ({ currentPage, onNavigate, currentUser, onShowAuth, onLogout }) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [showUserMenu, setShowUserMenu] = React.useState(false);
    const [showNotificationMenu, setShowNotificationMenu] = React.useState(false);
    const [unreadNotificationCount, setUnreadNotificationCount] = React.useState(0);
    const [notificationItems, setNotificationItems] = React.useState([]);
    const [chatBackend, setChatBackend] = React.useState(null);
    const [isMarkingAllRead, setIsMarkingAllRead] = React.useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const formatTimeAgo = (dateValue) => {
        if (!dateValue) return 'Just now';
        const diffMs = Date.now() - new Date(dateValue).getTime();
        const minutes = Math.floor(diffMs / (1000 * 60));
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} min ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days === 1 ? '' : 's'} ago`;
    };

    const getNotificationMeta = (type) => {
        const normalized = String(type || '').toLowerCase();
        if (normalized === 'purchase_requested') {
            return { iconClass: 'fa-solid fa-cart-shopping', colorClass: 'notification-type-requested' };
        }
        if (normalized === 'purchase_confirmed') {
            return { iconClass: 'fa-solid fa-circle-check', colorClass: 'notification-type-confirmed' };
        }
        return { iconClass: 'fa-solid fa-bell', colorClass: 'notification-type-wishlist' };
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
                window.DormGlidePersonalization.fetchNotifications({ userId: currentUser.id, limit: 10 })
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
            setShowNotificationMenu(false);
        }
    };

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
        refreshNotifications();
    }, [currentUser?.id, refreshNotifications]);

    React.useEffect(() => {
        if (!currentUser?.id || !window.SupabaseClient?.channel) {
            return;
        }

        const channelName = `notifications-${currentUser.id}`;
        const channel = window.SupabaseClient
            .channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${currentUser.id}`
            }, (payload) => {
                const next = payload?.new;
                if (!next) return;

                setNotificationItems((prev) => [next, ...prev].slice(0, 10));
                setUnreadNotificationCount((prev) => prev + 1);
                if (window.DormGlideToast?.info && next?.message) {
                    window.DormGlideToast.info(next.message);
                }
            })
            .subscribe();

        return () => {
            try {
                window.SupabaseClient.removeChannel(channel);
            } catch (error) {
                console.warn('[DormGlide] Failed to unsubscribe notifications channel:', error);
            }
        };
    }, [currentUser?.id]);

    const handleToggleNotifications = (event) => {
        event.stopPropagation();
        const next = !showNotificationMenu;
        setShowNotificationMenu(next);
        if (next) {
            refreshNotifications();
        }
    };

    const handleMarkAllAsRead = async (event) => {
        event.stopPropagation();
        if (!currentUser?.id || !window.DormGlidePersonalization?.markNotificationsRead) return;

        setIsMarkingAllRead(true);
        try {
            await window.DormGlidePersonalization.markNotificationsRead({ userId: currentUser.id });
            setNotificationItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
            setUnreadNotificationCount(0);
        } catch (error) {
            console.warn('[DormGlide] Failed marking notifications read:', error);
            window.DormGlideToast?.error?.('Unable to mark notifications as read right now.');
        } finally {
            setIsMarkingAllRead(false);
        }
    };

    const handleNotificationClick = async (item) => {
        if (!item) return;

        if (!item.is_read && currentUser?.id && window.DormGlidePersonalization?.markNotificationRead) {
            try {
                await window.DormGlidePersonalization.markNotificationRead({
                    userId: currentUser.id,
                    notificationId: item.id
                });
                setNotificationItems((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, is_read: true } : entry));
                setUnreadNotificationCount((prev) => Math.max(0, prev - 1));
            } catch (error) {
                console.warn('[DormGlide] Failed marking notification read:', error);
            }
        }

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

                currentUser && React.createElement('button', {
                    className: `nav-btn ${currentPage === 'wishlist' ? 'active' : ''}`,
                    onClick: () => handleNavigation('wishlist')
                },
                    React.createElement('i', { className: 'fa-solid fa-bell' }),
                    React.createElement('span', null, 'Wishlist')
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
                        React.createElement('div', { className: 'notifications-dropdown-header' },
                            React.createElement('div', null,
                                React.createElement('p', null, 'Notifications'),
                                React.createElement('small', null, unreadNotificationCount > 0 ? `${unreadNotificationCount} unread` : 'All caught up')
                            ),
                            React.createElement('button', {
                                type: 'button',
                                className: 'notifications-mark-read-btn',
                                disabled: unreadNotificationCount === 0 || isMarkingAllRead,
                                onClick: handleMarkAllAsRead
                            }, isMarkingAllRead ? 'Marking...' : 'Mark all as read')
                        ),
                        notificationItems.length === 0
                            ? React.createElement('div', { className: 'notifications-empty' }, 'You are all caught up!')
                            : notificationItems.map((item) => React.createElement('button', {
                                key: item.id,
                                onClick: () => handleNotificationClick(item),
                                className: `notification-item ${item.is_read ? '' : 'unread'}`
                            },
                                React.createElement('span', {
                                    className: `notification-type-icon ${getNotificationMeta(item?.type).colorClass}`
                                }, React.createElement('i', { className: getNotificationMeta(item?.type).iconClass })),
                                React.createElement('span', { className: 'notification-copy' },
                                    React.createElement('strong', null, item.title || 'DormGlide update'),
                                    React.createElement('span', null, item.message || 'New DormGlide notification'),
                                    React.createElement('small', null, formatTimeAgo(item.created_at))
                                )
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
                                onClick: () => handleNavigation('wishlist')
                            },
                                React.createElement('i', { className: 'fa-solid fa-bell' }),
                                'Wishlist'
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
                    React.createElement('div', { className: 'auth-actions-inline' },
                        React.createElement('button', {
                            className: 'nav-btn auth-cta-btn auth-cta-login',
                            onClick: () => onShowAuth('login')
                        },
                            React.createElement('i', { className: 'fas fa-right-to-bracket' }),
                            React.createElement('span', null, 'Log In')
                        ),
                        React.createElement('button', {
                            className: 'nav-btn auth-cta-btn auth-cta-signup',
                            onClick: () => onShowAuth('signup')
                        },
                            React.createElement('i', { className: 'fas fa-user-plus' }),
                            React.createElement('span', null, 'Sign Up')
                        )
                    )
                )
            ),

            // Mobile menu toggle
            React.createElement('button', {
                className: `mobile-menu-toggle ${isMenuOpen ? 'open' : ''}`,
                title: isMenuOpen ? 'Close menu' : 'Open menu',
                'aria-label': isMenuOpen ? 'Close menu' : 'Open menu',
                'aria-expanded': isMenuOpen,
                'aria-controls': 'dormglide-mobile-nav',
                onClick: toggleMenu
            },
                React.createElement('i', { className: isMenuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars' }),
                React.createElement('span', { className: 'mobile-menu-label' }, isMenuOpen ? 'Close' : 'Menu')
            )
        ),

        // Mobile Navigation Menu
        isMenuOpen && React.createElement('nav', { className: 'header-nav mobile-nav', id: 'dormglide-mobile-nav' },
            React.createElement('p', { className: 'mobile-nav-hint' }, 'Quick navigation'),
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
                        className: `nav-btn ${currentPage === 'wishlist' ? 'active' : ''}`,
                        onClick: () => handleNavigation('wishlist')
                    },
                        React.createElement('i', { className: 'fa-solid fa-bell' }),
                        React.createElement('span', null, 'Wishlist')
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
                React.createElement('div', { className: 'mobile-auth-actions' },
                    React.createElement('button', {
                        className: 'nav-btn auth-cta-btn auth-cta-login',
                        onClick: () => {
                            onShowAuth('login');
                            setIsMenuOpen(false);
                        }
                    },
                        React.createElement('i', { className: 'fas fa-right-to-bracket' }),
                        React.createElement('span', null, 'Log In')
                    ),
                    React.createElement('button', {
                        className: 'nav-btn auth-cta-btn auth-cta-signup',
                        onClick: () => {
                            onShowAuth('signup');
                            setIsMenuOpen(false);
                        }
                    },
                        React.createElement('i', { className: 'fas fa-user-plus' }),
                        React.createElement('span', null, 'Sign Up')
                    )
                )
            )
        )
    );
};
