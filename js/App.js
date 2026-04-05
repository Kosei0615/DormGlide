const { useState, useEffect } = React;

console.log('DormGlide App.js loading...');
console.log('React version:', React.version);

const hasSupabaseAuthCallback = () => {
    const searchParams = new URLSearchParams(window.location.search || '');
    const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));

    return (
        searchParams.has('code') ||
        searchParams.has('token_hash') ||
        hashParams.has('access_token') ||
        hashParams.has('refresh_token') ||
        hashParams.has('type') ||
        searchParams.has('type')
    );
};

const getSupabaseAuthCallbackType = () => {
    const searchParams = new URLSearchParams(window.location.search || '');
    const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    return String(searchParams.get('type') || hashParams.get('type') || '').toLowerCase();
};

const hasSupabaseRecoveryCallback = () => getSupabaseAuthCallbackType() === 'recovery';

const clearSupabaseAuthCallbackFromUrl = () => {
    const url = new URL(window.location.href);
    const authParams = ['code', 'token_hash', 'type', 'access_token', 'refresh_token', 'expires_at', 'expires_in', 'provider_token', 'provider_refresh_token'];

    authParams.forEach((key) => {
        if (url.searchParams.has(key)) {
            url.searchParams.delete(key);
        }
    });

    url.hash = '';
    const nextUrl = `${url.pathname}${url.search ? `?${url.searchParams.toString()}` : ''}`;
    window.history.replaceState({}, document.title, nextUrl || '/');
};

const App = () => {
    console.log('App component initializing...');
    const [currentPage, setCurrentPage] = useState('home');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [products, setProducts] = useState([]);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [resetPasswordError, setResetPasswordError] = useState('');
    const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [homeInitialCategory, setHomeInitialCategory] = useState('');
    const [dashboardInitialTab, setDashboardInitialTab] = useState('overview');
    const seenMessageIdsRef = React.useRef(new Set());

    useEffect(() => {
        let isMounted = true;

        const bootstrapApp = async () => {
            console.log('App bootstrap starting...');
            try {
                const authCallbackPresent = hasSupabaseAuthCallback();
                const authCallbackType = getSupabaseAuthCallbackType();

                if (hasSupabaseRecoveryCallback() && isMounted) {
                    setShowRecoveryModal(true);
                    setShowAuthModal(false);
                }

                if (authCallbackPresent && window.SupabaseClient?.auth?.getSession) {
                    const { data, error } = await window.SupabaseClient.auth.getSession();
                    if (error) {
                        console.warn('[DormGlide] Supabase callback session check failed:', error);
                    }

                    if (data?.session?.user && authCallbackType !== 'recovery' && window.DormGlideToast?.success) {
                        window.DormGlideToast.success('Email confirmed. Welcome to DormGlide!');
                    }

                    if (authCallbackType !== 'recovery') {
                        clearSupabaseAuthCallbackFromUrl();
                    }
                }

                if (window.DormGlideStorage?.initializeDefaultData) {
                    await window.DormGlideStorage.initializeDefaultData();
                } else if (typeof initializeSampleData !== 'undefined') {
                    await initializeSampleData();
                }

                if (typeof getProductsFromStorage !== 'undefined') {
                    const storedProducts = await getProductsFromStorage();
                    if (isMounted) {
                        setProducts(storedProducts);
                        console.log('Loaded products:', storedProducts.length);
                    }
                } else if (isMounted) {
                    console.warn('getProductsFromStorage not available; using fallback data.');
                    setProducts([
                        {
                            id: '1',
                            title: 'MacBook Air M1',
                            description: 'Barely used MacBook Air with M1 chip.',
                            price: 850,
                            category: 'Electronics',
                            condition: 'Like New',
                            location: 'North Campus',
                            sellerId: 'user1',
                            sellerName: 'Sarah Chen'
                        }
                    ]);
                }

                if (window.DormGlideAuth && typeof window.DormGlideAuth.getCurrentUser === 'function') {
                    const user = await window.DormGlideAuth.getCurrentUser();
                    if (isMounted) {
                        setCurrentUser(user);
                        console.log('Current user:', user);
                    }
                }
            } catch (error) {
                console.error('Error during App bootstrap:', error);
            }
        };

        bootstrapApp();

        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                setShowAdminPanel(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            isMounted = false;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const navigateToPage = (page, productId = null, options = {}) => {
        if (page === 'home') {
            setHomeInitialCategory(String(options?.category || '').trim());
        } else if (homeInitialCategory) {
            setHomeInitialCategory('');
        }

        if (page === 'dashboard') {
            setDashboardInitialTab(String(options?.tab || 'overview'));
        } else if (dashboardInitialTab !== 'overview') {
            setDashboardInitialTab('overview');
        }

        setCurrentPage(page);
        if (productId) {
            const product = products.find(p => p.id === productId);
            setSelectedProduct(product);
            
            // Track product view
            if (currentUser && window.DormGlideAuth) {
                window.DormGlideAuth.trackProductView(
                    currentUser.id, 
                    productId, 
                    product?.title || 'Unknown Product'
                );

                if (product && window.DormGlidePersonalization?.recordProductView) {
                    window.DormGlidePersonalization.recordProductView({
                        userId: currentUser.id,
                        listing: product
                    });
                }
            }
        }
    };

    const handleListingDeleted = (listingId) => {
        if (!listingId) return;
        setProducts((prev) => prev.filter((item) => item.id !== listingId));
        setSelectedProduct((prev) => {
            if (!prev || prev.id !== listingId) return prev;
            return null;
        });
    };

    const addProduct = async (newProduct) => {
        try {
            const persistedProduct = await (window.DormGlideStorage?.createProduct?.(newProduct) || Promise.resolve(newProduct));
            setProducts(prev => [...prev, persistedProduct]);

            return persistedProduct;
        } catch (error) {
            console.error('Failed to add product:', error);
            throw error;
        }
    };

    const handleProductUpdate = (updatedProduct) => {
        if (!updatedProduct?.id) return;
        setProducts((prev) => prev.map((item) => (item.id === updatedProduct.id ? { ...item, ...updatedProduct } : item)));
        setSelectedProduct((prev) => {
            if (!prev || prev.id !== updatedProduct.id) return prev;
            return { ...prev, ...updatedProduct };
        });
    };

    const handleAuthSuccess = (user) => {
        setCurrentUser(user);
        console.log('User logged in:', user);
    };

    const handleLogout = async () => {
        if (window.DormGlideAuth && typeof window.DormGlideAuth.logoutUser === 'function') {
            await window.DormGlideAuth.logoutUser();
        }
        setCurrentUser(null);
        setCurrentPage('home');
        setNotifications([]);
        seenMessageIdsRef.current.clear();
        console.log('User logged out');
    };

    const handleSetNewPassword = async (e) => {
        e.preventDefault();
        setResetPasswordError('');

        const password = String(newPassword || '').trim();
        if (password.length < 6) {
            setResetPasswordError('Password must be at least 6 characters.');
            return;
        }

        if (!window.SupabaseClient?.auth?.updateUser) {
            setResetPasswordError('Password update is unavailable right now. Please try again later.');
            return;
        }

        setResetPasswordLoading(true);
        try {
            const { error } = await window.SupabaseClient.auth.updateUser({ password });
            if (error) {
                setResetPasswordError(error.message || 'Unable to update password. Please try again.');
                return;
            }

            window.history.replaceState({}, '', window.location.pathname);
            if (window.SupabaseClient?.auth?.signOut) {
                await window.SupabaseClient.auth.signOut();
            }

            setShowRecoveryModal(false);
            setNewPassword('');
            setCurrentUser(null);
            setShowAuthModal(true);
            window.DormGlideToast?.success('Password updated! Please log in.');
        } catch (error) {
            console.error('[DormGlide] Password update failed:', error);
            setResetPasswordError('Unable to update password. Please try again.');
        } finally {
            setResetPasswordLoading(false);
        }
    };

    useEffect(() => {
        if (!currentUser?.id || !window.DormGlideChat?.subscribeToConversationUpdates) {
            return;
        }

        const removeNotification = (id) => {
            setNotifications((prev) => prev.filter((item) => item.id !== id));
        };

        const unsubscribe = window.DormGlideChat.subscribeToConversationUpdates(currentUser.id, (payload) => {
            const message = payload?.message;
            if (!message) {
                return;
            }

            const isIncoming = message.receiverId === currentUser.id && message.senderId !== currentUser.id;
            const isOutgoing = message.senderId === currentUser.id;
            if (!isIncoming && !isOutgoing) return;

            if (seenMessageIdsRef.current.has(message.id)) {
                return;
            }
            seenMessageIdsRef.current.add(message.id);

            const sender = window.DormGlideAuth?.getUserById?.(message.senderId);
            const receiver = window.DormGlideAuth?.getUserById?.(message.receiverId);
            const toastId = `toast_${message.id || Date.now()}`;
            const toast = {
                id: toastId,
                title: isIncoming
                    ? `New message from ${sender?.name || 'DormGlide user'}`
                    : `Message sent to ${receiver?.name || 'DormGlide user'}`,
                body: String(message.body || '').slice(0, 120)
            };

            setNotifications((prev) => [...prev, toast].slice(-4));
            window.setTimeout(() => removeNotification(toastId), 4500);

            if (isIncoming && 'Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification(toast.title, { body: toast.body || 'Open DormGlide to reply.' });
                } catch (_error) {
                    // Browser notification support varies by platform.
                }
            }
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [currentUser?.id]);

    useEffect(() => {
        if (!currentUser?.id || !('Notification' in window)) return;
        if (Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
    }, [currentUser?.id]);

    const renderCurrentPage = () => {
        switch (currentPage) {
            case 'home':
                return React.createElement(HomePage, {
                    products: products,
                    onProductClick: (productId) => navigateToPage('product-detail', productId),
                    onNavigate: navigateToPage,
                    currentUser: currentUser,
                    onShowAuth: () => setShowAuthModal(true),
                    initialCategory: homeInitialCategory
                });
            case 'product-detail':
                return React.createElement(ProductDetailPage, {
                    product: selectedProduct,
                    onNavigate: navigateToPage,
                    currentUser: currentUser,
                    onShowAuth: () => setShowAuthModal(true),
                    onProductUpdate: handleProductUpdate,
                    allProducts: products
                });
            case 'sell':
                return React.createElement(SellPage, {
                    onNavigate: navigateToPage,
                    onProductAdd: addProduct,
                    currentUser: currentUser,
                    onShowAuth: () => setShowAuthModal(true)
                });
            case 'profile':
                return React.createElement(ProfilePage, {
                    onNavigate: navigateToPage,
                    currentUser: currentUser,
                    setCurrentUser: setCurrentUser,
                    userProducts: products.filter(p => p.sellerId === currentUser?.id),
                    onShowAuth: () => setShowAuthModal(true),
                    onListingDeleted: handleListingDeleted
                });
            case 'dashboard':
                return React.createElement(UserDashboard, {
                    currentUser: currentUser,
                    onNavigate: navigateToPage,
                    initialTab: dashboardInitialTab,
                    onListingDeleted: handleListingDeleted
                });
            case 'messages':
                return React.createElement(MessagesPage, {
                    currentUser: currentUser,
                    onNavigate: navigateToPage
                });
            case 'how-it-works':
                return React.createElement(HowItWorksPage, {
                    onNavigate: navigateToPage,
                    currentUser: currentUser
                });
            case 'privacy-policy':
                return React.createElement(PrivacyPolicyPage, {
                    onNavigate: navigateToPage,
                    currentUser: currentUser
                });
            case 'admin':
                return React.createElement(AdminDashboard, {
                    currentUser: currentUser,
                    onNavigate: navigateToPage
                });
            default:
                return React.createElement(HomePage, {
                    products: products,
                    onProductClick: (productId) => navigateToPage('product-detail', productId),
                    onNavigate: navigateToPage,
                    currentUser: currentUser,
                    onShowAuth: () => setShowAuthModal(true),
                    initialCategory: homeInitialCategory
                });
        }
    };

    return React.createElement('div', { className: 'app' },
        React.createElement(Header, {
            currentPage: currentPage,
            onNavigate: navigateToPage,
            currentUser: currentUser,
            onShowAuth: () => setShowAuthModal(true),
            onLogout: handleLogout
        }),
        React.createElement('main', { className: 'main-content' },
            renderCurrentPage()
        ),
        React.createElement(Footer, {
            onNavigate: navigateToPage
        }),
        
        // Auth Modal
        showAuthModal && React.createElement(AuthModal, {
            onClose: () => setShowAuthModal(false),
            onAuthSuccess: handleAuthSuccess
        }),

        // Password Recovery Modal
        showRecoveryModal && React.createElement('div', {
            className: 'auth-modal-overlay',
            onClick: (event) => {
                if (event.target.className === 'auth-modal-overlay') {
                    setShowRecoveryModal(false);
                }
            }
        },
            React.createElement('div', { className: 'auth-modal' },
                React.createElement('button', {
                    className: 'auth-modal-close icon-btn',
                    title: 'Close',
                    'aria-label': 'Close',
                    onClick: () => setShowRecoveryModal(false)
                }, React.createElement('i', { className: 'fa-solid fa-xmark' })),

                React.createElement('div', { className: 'auth-modal-header' },
                    React.createElement('h2', null, 'Set New Password'),
                    React.createElement('p', null, 'Create a new password for your DormGlide account.')
                ),

                resetPasswordError && React.createElement('div', { className: 'auth-error' },
                    React.createElement('i', { className: 'fas fa-exclamation-circle' }),
                    resetPasswordError
                ),

                React.createElement('form', { className: 'auth-form', onSubmit: handleSetNewPassword },
                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'New Password'),
                        React.createElement('input', {
                            type: 'password',
                            value: newPassword,
                            onChange: (event) => {
                                setNewPassword(event.target.value);
                                setResetPasswordError('');
                            },
                            placeholder: 'Enter a new password',
                            minLength: 6,
                            required: true,
                            autoComplete: 'new-password'
                        })
                    ),

                    React.createElement('button', {
                        type: 'submit',
                        className: 'btn btn-primary btn-block',
                        disabled: resetPasswordLoading
                    },
                        resetPasswordLoading && React.createElement('i', { className: 'fas fa-spinner fa-spin' }),
                        resetPasswordLoading ? 'Updating password...' : 'Update password'
                    )
                )
            )
        ),
        
        // Admin Panel (hidden by default, activated with Ctrl+Shift+A)
        showAdminPanel && React.createElement(AdminPanel, {
            onClose: () => setShowAdminPanel(false)
        }),

        notifications.length > 0 && React.createElement('div', {
            style: {
                position: 'fixed',
                right: '16px',
                top: '84px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                zIndex: 1200,
                maxWidth: '320px'
            }
        }, notifications.map((item) =>
            React.createElement('div', {
                key: item.id,
                onClick: () => navigateToPage('messages'),
                style: {
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
                    padding: '10px 12px',
                    cursor: 'pointer'
                }
            },
                React.createElement('div', { style: { fontWeight: 600, marginBottom: '2px' } }, item.title),
                React.createElement('div', { style: { fontSize: '0.9rem', color: '#4b5563' } }, item.body || 'Tap to open messages')
            )
        ))
    );
};

// Render the app
console.log('Attempting to render DormGlide app...');
try {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
        throw new Error('Root element not found');
    }
    
    console.log('Root element found, rendering...');
    if (ReactDOM.createRoot) {
        // React 18+
        console.log('Using React 18 createRoot');
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(App));
    } else {
        // React 17 fallback
        console.log('Using React 17 render');
        ReactDOM.render(React.createElement(App), rootElement);
    }
    console.log('DormGlide app rendered successfully!');
} catch (error) {
    console.error('Error rendering DormGlide app:', error);
    // Fallback: show error message
    document.getElementById('root').innerHTML = `
        <div style="padding: 2rem; text-align: center; font-family: Arial, sans-serif;">
            <h2 style="color: #dc3545;">⚠️ App Loading Error</h2>
            <p>There was an issue loading DormGlide. Please refresh the page.</p>
            <p style="color: #666; font-size: 0.9rem;">Error: ${error.message}</p>
        </div>
    `;
}
