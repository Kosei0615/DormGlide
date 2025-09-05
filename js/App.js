const { useState, useEffect } = React;

const App = () => {
    const [currentPage, setCurrentPage] = useState('home');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [products, setProducts] = useState([]);

    useEffect(() => {
        // Initialize empty marketplace (production mode)
        initializeDefaultData();
        
        // Load existing products (if any)
        const existingProducts = getProductsFromStorage();
        setProducts(existingProducts);
        
        // Check for logged in user
        const user = getCurrentUser();
        setCurrentUser(user);
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
        React.createElement(Footer, null)
    );
};

// Render the app
ReactDOM.render(React.createElement(App), document.getElementById('root'));
