const { useState, useEffect } = React;

console.log('DormGlide App.js loading...');
console.log('React version:', React.version);

const App = () => {
    console.log('App component initializing...');
    const [currentPage, setCurrentPage] = useState('home');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [products, setProducts] = useState([]);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const seenMessageIdsRef = React.useRef(new Set());

    useEffect(() => {
        let isMounted = true;

        const bootstrapApp = async () => {
            console.log('App bootstrap starting...');
            try {
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

    const navigateToPage = (page, productId = null) => {
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
            }
        }
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
                    onShowAuth: () => setShowAuthModal(true)
                });
            case 'product-detail':
                return React.createElement(ProductDetailPage, {
                    product: selectedProduct,
                    onNavigate: navigateToPage,
                    currentUser: currentUser,
                    onShowAuth: () => setShowAuthModal(true),
                    onProductUpdate: handleProductUpdate
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
                    onShowAuth: () => setShowAuthModal(true)
                });
            case 'dashboard':
                return React.createElement(UserDashboard, {
                    currentUser: currentUser,
                    onNavigate: navigateToPage,
                    initialTab: 'overview'
                });
            case 'messages':
                return React.createElement(MessagesPage, {
                    currentUser: currentUser,
                    onNavigate: navigateToPage
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
                    onShowAuth: () => setShowAuthModal(true)
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
        React.createElement(Footer, null),
        
        // Auth Modal
        showAuthModal && React.createElement(AuthModal, {
            onClose: () => setShowAuthModal(false),
            onAuthSuccess: handleAuthSuccess
        }),
        
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
