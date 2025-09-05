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

    useEffect(() => {
        console.log('App useEffect running...');
        try {
            // Initialize sample data (will check demo mode vs production)
            if (typeof initializeSampleData !== 'undefined') {
                initializeSampleData();
            } else {
                console.warn('initializeSampleData not available');
            }
            
            // Load products from storage
            if (typeof getProductsFromStorage !== 'undefined') {
                const storedProducts = getProductsFromStorage();
                setProducts(storedProducts);
                console.log('Loaded products:', storedProducts.length);
            } else {
                console.warn('getProductsFromStorage not available, using sample data');
                // Fallback sample data
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
            
            // Check for logged in user
            if (typeof getCurrentUser !== 'undefined') {
                const user = getCurrentUser();
                setCurrentUser(user);
            }

            // Admin panel keyboard shortcut (Ctrl+Shift+A)
            const handleKeyDown = (e) => {
                if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                    setShowAdminPanel(true);
                }
            };
            
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        } catch (error) {
            console.error('Error in App useEffect:', error);
        }
    }, []);

    const navigateToPage = (page, productId = null) => {
        setCurrentPage(page);
        if (productId) {
            const product = products.find(p => p.id === productId);
            setSelectedProduct(product);
        }
    };

    const addProduct = (newProduct) => {
        const updatedProducts = [...products, newProduct];
        setProducts(updatedProducts);
        saveProductsToStorage(updatedProducts);
    };

    const renderCurrentPage = () => {
        switch (currentPage) {
            case 'home':
                return React.createElement(HomePage, {
                    products: products,
                    onProductClick: (productId) => navigateToPage('product-detail', productId),
                    onNavigate: navigateToPage
                });
            case 'product-detail':
                return React.createElement(ProductDetailPage, {
                    product: selectedProduct,
                    onNavigate: navigateToPage,
                    currentUser: currentUser
                });
            case 'sell':
                return React.createElement(SellPage, {
                    onNavigate: navigateToPage,
                    onProductAdd: addProduct,
                    currentUser: currentUser
                });
            case 'profile':
                return React.createElement(ProfilePage, {
                    onNavigate: navigateToPage,
                    currentUser: currentUser,
                    setCurrentUser: setCurrentUser,
                    userProducts: products.filter(p => p.sellerId === currentUser?.id)
                });
            default:
                return React.createElement(HomePage, {
                    products: products,
                    onProductClick: (productId) => navigateToPage('product-detail', productId),
                    onNavigate: navigateToPage
                });
        }
    };

    return React.createElement('div', { className: 'app' },
        React.createElement(Header, {
            currentPage: currentPage,
            onNavigate: navigateToPage,
            currentUser: currentUser
        }),
        React.createElement('main', { className: 'main-content' },
            renderCurrentPage()
        ),
        React.createElement(Footer, null),
        
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
