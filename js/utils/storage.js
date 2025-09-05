// Local Storage utility functions for DormGlide

// Product storage functions
const saveProductsToStorage = (products) => {
    try {
        localStorage.setItem('dormglide_products', JSON.stringify(products));
    } catch (error) {
        console.error('Error saving products to localStorage:', error);
    }
};

const getProductsFromStorage = () => {
    try {
        const products = localStorage.getItem('dormglide_products');
        return products ? JSON.parse(products) : [];
    } catch (error) {
        console.error('Error loading products from localStorage:', error);
        return [];
    }
};

const addProductToStorage = (product) => {
    const products = getProductsFromStorage();
    products.push(product);
    saveProductsToStorage(products);
};

const updateProductInStorage = (productId, updatedProduct) => {
    const products = getProductsFromStorage();
    const index = products.findIndex(p => p.id === productId);
    if (index !== -1) {
        products[index] = { ...products[index], ...updatedProduct };
        saveProductsToStorage(products);
    }
};

const deleteProductFromStorage = (productId) => {
    const products = getProductsFromStorage();
    const filteredProducts = products.filter(p => p.id !== productId);
    saveProductsToStorage(filteredProducts);
};

// User storage functions
const saveUserToStorage = (user) => {
    try {
        localStorage.setItem('dormglide_current_user', JSON.stringify(user));
    } catch (error) {
        console.error('Error saving user to localStorage:', error);
    }
};

const getCurrentUser = () => {
    try {
        const user = localStorage.getItem('dormglide_current_user');
        return user ? JSON.parse(user) : null;
    } catch (error) {
        console.error('Error loading user from localStorage:', error);
        return null;
    }
};

const clearUserFromStorage = () => {
    try {
        localStorage.removeItem('dormglide_current_user');
    } catch (error) {
        console.error('Error clearing user from localStorage:', error);
    }
};

// App preferences storage
const saveAppPreferences = (preferences) => {
    try {
        localStorage.setItem('dormglide_preferences', JSON.stringify(preferences));
    } catch (error) {
        console.error('Error saving preferences to localStorage:', error);
    }
};

const getAppPreferences = () => {
    try {
        const preferences = localStorage.getItem('dormglide_preferences');
        return preferences ? JSON.parse(preferences) : {
            theme: 'light',
            notifications: true,
            searchHistory: []
        };
    } catch (error) {
        console.error('Error loading preferences from localStorage:', error);
        return {
            theme: 'light',
            notifications: true,
            searchHistory: []
        };
    }
};

// Search history functions
const addToSearchHistory = (searchTerm) => {
    if (!searchTerm.trim()) return;
    
    const preferences = getAppPreferences();
    const history = preferences.searchHistory || [];
    
    // Remove if already exists and add to front
    const filteredHistory = history.filter(term => term !== searchTerm);
    filteredHistory.unshift(searchTerm);
    
    // Keep only last 10 searches
    preferences.searchHistory = filteredHistory.slice(0, 10);
    saveAppPreferences(preferences);
};

const getSearchHistory = () => {
    const preferences = getAppPreferences();
    return preferences.searchHistory || [];
};

// Clear all app data
const clearAllData = () => {
    try {
        localStorage.removeItem('dormglide_products');
        localStorage.removeItem('dormglide_current_user');
        localStorage.removeItem('dormglide_preferences');
        console.log('All DormGlide data cleared');
    } catch (error) {
        console.error('Error clearing app data:', error);
    }
};

// Initialize default data if storage is empty
const initializeDefaultData = () => {
    const existingProducts = getProductsFromStorage();
    if (existingProducts.length === 0) {
        const sampleProducts = getSampleProducts();
        saveProductsToStorage(sampleProducts);
        console.log('Sample products initialized');
    }
};

// Export functions for use in other files
window.DormGlideStorage = {
    saveProductsToStorage,
    getProductsFromStorage,
    addProductToStorage,
    updateProductInStorage,
    deleteProductFromStorage,
    saveUserToStorage,
    getCurrentUser,
    clearUserFromStorage,
    saveAppPreferences,
    getAppPreferences,
    addToSearchHistory,
    getSearchHistory,
    clearAllData,
    initializeDefaultData
};
