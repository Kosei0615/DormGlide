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
        console.log('User logged out');
    };

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
                    onShowAuth: () => setShowAuthModal(true)
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
        })
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
