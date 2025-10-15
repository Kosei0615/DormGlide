// Authentication and User Management System for DormGlide

// User database (stored in localStorage)
const USERS_STORAGE_KEY = 'dormglide_users';
const CURRENT_USER_KEY = 'dormglide_current_user';
const USER_ACTIVITY_KEY = 'dormglide_user_activity';

// Get all users from storage
const getAllUsers = () => {
    try {
        const users = localStorage.getItem(USERS_STORAGE_KEY);
        return users ? JSON.parse(users) : [];
    } catch (error) {
        console.error('Error loading users:', error);
        return [];
    }
};

// Save all users to storage
const saveAllUsers = (users) => {
    try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (error) {
        console.error('Error saving users:', error);
    }
};

// Register new user
const registerUser = (userData) => {
    const users = getAllUsers();
    
    // Check if email already exists
    if (users.some(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
        return { success: false, message: 'Email already registered' };
    }
    
    const validRoles = ['user', 'seller', 'admin'];
    const resolvedRole = validRoles.includes(userData.role) ? userData.role : 'user';

    const newUser = {
        id: `user_${Date.now()}`,
        ...userData,
        role: resolvedRole, // respect explicit role when provided
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        status: 'active', // 'active', 'suspended', 'deleted'
        rating: 0,
        totalSales: 0,
        totalPurchases: 0,
        verified: false
    };
    
    users.push(newUser);
    saveAllUsers(users);
    
    return { success: true, user: newUser };
};

// Login user
const loginUser = (email, password) => {
    const users = getAllUsers();
    const user = users.find(u => 
        u.email.toLowerCase() === email.toLowerCase() && 
        u.password === password && 
        u.status === 'active'
    );
    
    if (user) {
        // Update last login
        user.lastLogin = new Date().toISOString();
        saveAllUsers(users);
        
        // Set current user (don't store password in session)
        const sessionUser = { ...user };
        delete sessionUser.password;
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionUser));
        
        return { success: true, user: sessionUser };
    }
    
    return { success: false, message: 'Invalid email or password' };
};

// Logout user
const logoutUser = () => {
    localStorage.removeItem(CURRENT_USER_KEY);
};

// Get current logged-in user
const getCurrentUser = () => {
    try {
        const user = localStorage.getItem(CURRENT_USER_KEY);
        return user ? JSON.parse(user) : null;
    } catch (error) {
        console.error('Error loading current user:', error);
        return null;
    }
};

// Update user profile
const updateUserProfile = (userId, updates) => {
    const users = getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], ...updates };
        saveAllUsers(users);
        
        // Update current session if this is the logged-in user
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.id === userId) {
            const sessionUser = { ...users[userIndex] };
            delete sessionUser.password;
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionUser));
        }
        
        return { success: true, user: users[userIndex] };
    }
    
    return { success: false, message: 'User not found' };
};

// User Activity Tracking
const getUserActivity = (userId) => {
    try {
        const allActivity = localStorage.getItem(USER_ACTIVITY_KEY);
        const activities = allActivity ? JSON.parse(allActivity) : {};
        return activities[userId] || {
            views: [],
            purchases: [],
            sales: [],
            favorites: [],
            messages: [],
            searches: []
        };
    } catch (error) {
        console.error('Error loading user activity:', error);
        return {
            views: [],
            purchases: [],
            sales: [],
            favorites: [],
            messages: [],
            searches: []
        };
    }
};

const saveUserActivity = (userId, activity) => {
    try {
        const allActivity = localStorage.getItem(USER_ACTIVITY_KEY);
        const activities = allActivity ? JSON.parse(allActivity) : {};
        activities[userId] = activity;
        localStorage.setItem(USER_ACTIVITY_KEY, JSON.stringify(activities));
    } catch (error) {
        console.error('Error saving user activity:', error);
    }
};

// Track product view
const trackProductView = (userId, productId, productTitle) => {
    if (!userId) return;
    
    const activity = getUserActivity(userId);
    activity.views.unshift({
        productId,
        productTitle,
        timestamp: new Date().toISOString()
    });
    
    // Keep only last 50 views
    activity.views = activity.views.slice(0, 50);
    saveUserActivity(userId, activity);
};

// Track purchase
const trackPurchase = (userId, productId, productTitle, price, sellerId) => {
    if (!userId) return;
    
    const activity = getUserActivity(userId);
    activity.purchases.push({
        productId,
        productTitle,
        price,
        sellerId,
        timestamp: new Date().toISOString(),
        status: 'completed'
    });
    saveUserActivity(userId, activity);
    
    // Update user stats
    const users = getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
        users[userIndex].totalPurchases = (users[userIndex].totalPurchases || 0) + 1;
        saveAllUsers(users);
    }
};

// Track sale
const trackSale = (sellerId, productId, productTitle, price, buyerId) => {
    if (!sellerId) return;
    
    const activity = getUserActivity(sellerId);
    activity.sales.push({
        productId,
        productTitle,
        price,
        buyerId,
        timestamp: new Date().toISOString(),
        status: 'completed'
    });
    saveUserActivity(sellerId, activity);
    
    // Update seller stats
    const users = getAllUsers();
    const userIndex = users.findIndex(u => u.id === sellerId);
    if (userIndex !== -1) {
        users[userIndex].totalSales = (users[userIndex].totalSales || 0) + 1;
        saveAllUsers(users);
    }
};

// Add to favorites
const addToFavorites = (userId, productId, productTitle) => {
    if (!userId) return;
    
    const activity = getUserActivity(userId);
    
    // Check if already favorited
    if (activity.favorites.some(f => f.productId === productId)) {
        return { success: false, message: 'Already in favorites' };
    }
    
    activity.favorites.push({
        productId,
        productTitle,
        timestamp: new Date().toISOString()
    });
    saveUserActivity(userId, activity);
    
    return { success: true };
};

// Remove from favorites
const removeFromFavorites = (userId, productId) => {
    if (!userId) return;
    
    const activity = getUserActivity(userId);
    activity.favorites = activity.favorites.filter(f => f.productId !== productId);
    saveUserActivity(userId, activity);
    
    return { success: true };
};

const isProductFavorited = (userId, productId) => {
    if (!userId || !productId) return false;
    const activity = getUserActivity(userId);
    return activity.favorites.some(favorite => favorite.productId === productId);
};

// Track search
const trackSearch = (userId, searchTerm, resultsCount) => {
    if (!userId) return;
    
    const activity = getUserActivity(userId);
    activity.searches.unshift({
        term: searchTerm,
        resultsCount,
        timestamp: new Date().toISOString()
    });
    
    // Keep only last 30 searches
    activity.searches = activity.searches.slice(0, 30);
    saveUserActivity(userId, activity);
};

const sendMessage = (senderId, receiverId, productId, message, productTitle = '') => {
    if (!senderId || !receiverId || !productId || !message) {
        return { success: false, message: 'Missing message data' };
    }

    const timestamp = new Date().toISOString();
    const baseMessage = {
        productId,
        productTitle,
        message,
        senderId,
        receiverId,
        timestamp
    };

    const senderActivity = getUserActivity(senderId);
    senderActivity.messages.unshift({
        ...baseMessage,
        direction: 'outgoing'
    });
    saveUserActivity(senderId, senderActivity);

    const receiverActivity = getUserActivity(receiverId);
    receiverActivity.messages.unshift({
        ...baseMessage,
        direction: 'incoming'
    });
    saveUserActivity(receiverId, receiverActivity);

    return { success: true };
};

// Admin functions
const isAdmin = (user) => {
    return user && user.role === 'admin';
};

const getAllUsersForAdmin = () => {
    const users = getAllUsers();
    return users.map(user => {
        const activity = getUserActivity(user.id);
        return {
            ...user,
            activitySummary: {
                totalViews: activity.views.length,
                totalPurchases: activity.purchases.length,
                totalSales: activity.sales.length,
                totalFavorites: activity.favorites.length
            }
        };
    });
};

const suspendUser = (adminId, userId) => {
    const admin = getCurrentUser();
    if (!isAdmin(admin)) {
        return { success: false, message: 'Unauthorized' };
    }
    
    const users = getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex !== -1) {
        users[userIndex].status = 'suspended';
        saveAllUsers(users);
        return { success: true };
    }
    
    return { success: false, message: 'User not found' };
};

const activateUser = (adminId, userId) => {
    const admin = getCurrentUser();
    if (!isAdmin(admin)) {
        return { success: false, message: 'Unauthorized' };
    }
    
    const users = getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex !== -1) {
        users[userIndex].status = 'active';
        saveAllUsers(users);
        return { success: true };
    }
    
    return { success: false, message: 'User not found' };
};

// Export all functions
window.DormGlideAuth = {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    updateUserProfile,
    getAllUsers,
    getUserActivity,
    trackProductView,
    trackPurchase,
    trackSale,
    addToFavorites,
    removeFromFavorites,
    isProductFavorited,
    trackSearch,
    sendMessage,
    isAdmin,
    getAllUsersForAdmin,
    suspendUser,
    activateUser
};

console.log('DormGlide Auth system loaded');
