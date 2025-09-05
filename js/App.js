const { useState, useEffect } = React;

const App = () => {
    const [currentPage, setCurrentPage] = useState('home');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [products, setProducts] = useState([]);
    const [showAdminPanel, setShowAdminPanel] = useState(false);

    useEffect(() => {
        // Initialize sample data (will check demo mode vs production)
        initializeSampleData();
        
        // Load products from storage
        const storedProducts = getProductsFromStorage();
        setProducts(storedProducts);
        
        // Check for logged in user
        const user = getCurrentUser();
        setCurrentUser(user);

        // Admin panel keyboard shortcut (Ctrl+Shift+A)
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                setShowAdminPanel(true);
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
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
ReactDOM.render(React.createElement(App), document.getElementById('root'));
