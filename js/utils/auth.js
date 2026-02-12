(() => {
// Authentication and User Management System for DormGlide

// Local persistence keys (used for Supabase metadata caching and offline fallback)
const USERS_STORAGE_KEY = 'dormglide_users';
const CURRENT_USER_KEY = 'dormglide_current_user';
const USER_ACTIVITY_KEY = 'dormglide_user_activity';

const getSupabaseClient = () => window.SupabaseClient || null;
let supabaseAuthAvailable = true;
const markSupabaseUnavailable = (error) => {
    supabaseAuthAvailable = false;
    console.warn('[DormGlide] Supabase auth disabled for this session, falling back to local auth.', error);
};

const shouldDisableSupabaseAuth = (error) => {
    if (!error) return false;
    const status = Number(error.status || error.statusCode || 0);
    const message = String(error.message || error.error_description || error || '').toLowerCase();

    // Network/config/misconfiguration signals → fall back to local.
    if (
        message.includes('failed to fetch') ||
        message.includes('network') ||
        message.includes('load failed') ||
        message.includes('fetcherror') ||
        message.includes('invalid api key') ||
        message.includes('jwt') ||
        message.includes('not found')
    ) {
        return true;
    }

    // Server-side outages / invalid project configuration
    if (status >= 500 || status === 401 || status === 403) {
        // Avoid disabling on expected credential errors (usually 400)
        return true;
    }

    return false;
};

const isSupabaseEnabled = () => Boolean(getSupabaseClient()) && supabaseAuthAvailable;

const sanitizePhoneNumber = (raw) => {
    if (!raw) return '';
    const digits = String(raw).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 11 && digits.startsWith('1')) {
        return `+1${digits.slice(1)}`;
    }
    if (digits.length === 10) {
        return `+1${digits}`;
    }
    return `+${digits}`;
};

const formatPhoneNumberReadable = (raw) => {
    if (!raw) return '';
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
        return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return raw;
};

// Get all cached users from storage
const getAllUsers = () => {
    try {
        const users = localStorage.getItem(USERS_STORAGE_KEY);
        return users ? JSON.parse(users) : [];
    } catch (error) {
        console.error('Error loading users:', error);
        return [];
    }
};

// Save all cached users to storage
const saveAllUsers = (users) => {
    try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (error) {
        console.error('Error saving users:', error);
    }
};

const upsertCachedUser = (user) => {
    if (!user?.id) return;
    const users = getAllUsers();
    const index = users.findIndex((existing) => existing.id === user.id);
    const payload = { ...users[index], ...user };
    if (index === -1) {
        users.push(payload);
    } else {
        users[index] = payload;
    }
    saveAllUsers(users);
};

const cacheSessionUser = (user) => {
    if (!user) {
        localStorage.removeItem(CURRENT_USER_KEY);
        return null;
    }
    const sessionUser = { ...user };
    delete sessionUser.password;
    if (!sessionUser.joinedAt) {
        sessionUser.joinedAt = sessionUser.createdAt || new Date().toISOString();
    }
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionUser));
    return sessionUser;
};

const normalizeSupabaseUser = (supabaseUser, fallback = {}) => {
    if (!supabaseUser) return null;
    const metadata = supabaseUser.user_metadata || {};
    const resolvedRole = metadata.role || fallback.role || 'user';
    const sanitizedPhone = sanitizePhoneNumber(metadata.phone || fallback.phone || '');
    const joinedAt = metadata.joinedAt || fallback.joinedAt || supabaseUser.created_at || new Date().toISOString();

    const normalized = {
        id: supabaseUser.id,
        email: supabaseUser.email || fallback.email || '',
        name: metadata.name || fallback.name || supabaseUser.email || 'DormGlide user',
        phone: sanitizedPhone,
        university: metadata.university ?? fallback.university ?? '',
        campusLocation: metadata.campusLocation ?? fallback.campusLocation ?? '',
        role: resolvedRole,
        bio: metadata.bio ?? fallback.bio ?? '',
        createdAt: supabaseUser.created_at || new Date().toISOString(),
        lastLogin: supabaseUser.last_sign_in_at || new Date().toISOString(),
        joinedAt,
        status: metadata.status || 'active',
        rating: metadata.rating ?? fallback.rating ?? 0,
        totalSales: metadata.totalSales ?? fallback.totalSales ?? 0,
        totalPurchases: metadata.totalPurchases ?? fallback.totalPurchases ?? 0,
        verified: Boolean(supabaseUser.email_confirmed_at || metadata.verified)
    };

    return normalized;
};

// Register new user
const registerUser = async (userData) => {
    const client = getSupabaseClient();
    const validRoles = ['user', 'seller', 'admin'];
    const resolvedRole = validRoles.includes(userData.role) ? userData.role : 'user';
    const sanitizedPhone = sanitizePhoneNumber(userData.phone);

    if (client && isSupabaseEnabled()) {
        try {
            const joinedAt = new Date().toISOString();

            const { data, error } = await client.auth.signUp({
                email: userData.email,
                password: userData.password,
                options: {
                    data: {
                        name: userData.name,
                        phone: sanitizedPhone,
                        university: userData.university || '',
                        campusLocation: userData.campusLocation || '',
                        role: resolvedRole,
                        bio: userData.bio || `${resolvedRole === 'seller' ? 'Seller' : 'Student'} at ${userData.university || 'DormGlide University'}`,
                        status: 'active',
                        joinedAt
                    }
                }
            });

            if (error) {
                if (shouldDisableSupabaseAuth(error)) {
                    markSupabaseUnavailable(error);
                } else {
                    return { success: false, message: error.message || 'Unable to create account' };
                }
            }

            const supabaseUser = data.user || data.session?.user;
            const normalized = normalizeSupabaseUser(supabaseUser, {
                ...userData,
                phone: sanitizedPhone,
                role: resolvedRole,
                joinedAt
            });

            if (normalized) {
                upsertCachedUser({ ...normalized, password: undefined });
                cacheSessionUser(data.session ? normalized : null);
            }

            return {
                success: true,
                user: normalized,
                requiresEmailConfirmation: !data.session
            };
        } catch (error) {
            if (shouldDisableSupabaseAuth(error)) {
                markSupabaseUnavailable(error);
            } else {
                return { success: false, message: error.message || 'Unexpected error creating account' };
            }
        }
    }

    // Local fallback
    const users = getAllUsers();
    if (users.some(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
        return { success: false, message: 'Email already registered' };
    }

    const newUser = {
        id: `user_${Date.now()}`,
        ...userData,
        role: resolvedRole,
        createdAt: new Date().toISOString(),
        joinedAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        campusLocation: userData.campusLocation || '',
        phone: sanitizedPhone,
        status: 'active',
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
const loginUser = async (email, password) => {
    const client = getSupabaseClient();

    if (client && isSupabaseEnabled()) {
        try {
            const { data, error } = await client.auth.signInWithPassword({ email, password });
            if (error) {
                if (shouldDisableSupabaseAuth(error)) {
                    markSupabaseUnavailable(error);
                } else {
                    return { success: false, message: error.message || 'Invalid email or password' };
                }
            }

            const supabaseUser = data.user || data.session?.user;
            const normalized = normalizeSupabaseUser(supabaseUser, { email });
            if (normalized) {
                upsertCachedUser(normalized);
                cacheSessionUser(normalized);
            }

            return { success: true, user: normalized };
        } catch (error) {
            if (shouldDisableSupabaseAuth(error)) {
                markSupabaseUnavailable(error);
            } else {
                return { success: false, message: error.message || 'Unexpected error signing in' };
            }
        }
    }

    const users = getAllUsers();
    const user = users.find(u =>
        u.email.toLowerCase() === email.toLowerCase() &&
        u.password === password &&
        u.status === 'active'
    );

    if (user) {
        user.lastLogin = new Date().toISOString();
        saveAllUsers(users);
        const sessionUser = cacheSessionUser(user);
        return { success: true, user: sessionUser };
    }

    return { success: false, message: 'Invalid email or password' };
};

// Logout user
const logoutUser = async () => {
    const client = getSupabaseClient();
    if (client && isSupabaseEnabled()) {
        try {
            await client.auth.signOut();
        } catch (error) {
            console.warn('[DormGlide] Supabase sign out failed:', error);
            if (shouldDisableSupabaseAuth(error)) {
                markSupabaseUnavailable(error);
            }
        }
    }
    cacheSessionUser(null);
};

// Get current logged-in user
const getCurrentUser = async () => {
    const client = getSupabaseClient();
    if (client && isSupabaseEnabled()) {
        try {
            const { data, error } = await client.auth.getSession();
            if (error) {
                console.warn('[DormGlide] Failed to fetch Supabase session:', error);
                if (shouldDisableSupabaseAuth(error)) {
                    markSupabaseUnavailable(error);
                }
            }
            const supabaseUser = data?.session?.user;
            if (!supabaseUser) {
                const cached = localStorage.getItem(CURRENT_USER_KEY);
                return cached ? JSON.parse(cached) : null;
            }

            const cachedProfile = getAllUsers().find((user) => user.id === supabaseUser.id) || {};
            const normalized = normalizeSupabaseUser(supabaseUser, cachedProfile);
            if (normalized) {
                upsertCachedUser(normalized);
                cacheSessionUser(normalized);
            }
            return normalized;
        } catch (error) {
            console.error('[DormGlide] Error resolving current Supabase user:', error);
            if (shouldDisableSupabaseAuth(error)) {
                markSupabaseUnavailable(error);
            }
        }
    }

    try {
        const user = localStorage.getItem(CURRENT_USER_KEY);
        return user ? JSON.parse(user) : null;
    } catch (error) {
        console.error('Error loading current user:', error);
        return null;
    }
};

// Update user profile
const updateUserProfile = async (userId, updates) => {
    const nextUpdates = { ...updates };
    if (Object.prototype.hasOwnProperty.call(nextUpdates, 'phone')) {
        nextUpdates.phone = sanitizePhoneNumber(nextUpdates.phone);
    }

    const client = getSupabaseClient();
    if (client && userId && isSupabaseEnabled()) {
        try {
            const metadataUpdates = {
                name: nextUpdates.name,
                phone: nextUpdates.phone,
                university: nextUpdates.university,
                campusLocation: nextUpdates.campusLocation,
                bio: nextUpdates.bio,
                role: nextUpdates.role
            };

            const { data, error } = await client.auth.updateUser({
                data: Object.fromEntries(
                    Object.entries(metadataUpdates).filter(([_, value]) => value !== undefined)
                )
            });

            if (error) {
                if (shouldDisableSupabaseAuth(error)) {
                    markSupabaseUnavailable(error);
                } else {
                    return { success: false, message: error.message || 'Unable to update profile' };
                }
            }

            const supabaseUser = data.user;
            const cachedProfile = getAllUsers().find((user) => user.id === supabaseUser.id) || {};
            const normalized = normalizeSupabaseUser(supabaseUser, { ...cachedProfile, ...nextUpdates });
            if (normalized) {
                upsertCachedUser(normalized);
                cacheSessionUser(normalized);
            }

            return { success: true, user: normalized };
        } catch (error) {
            if (shouldDisableSupabaseAuth(error)) {
                markSupabaseUnavailable(error);
            } else {
                return { success: false, message: error.message || 'Unexpected error updating profile' };
            }
        }
    }

    const users = getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], ...nextUpdates };
        saveAllUsers(users);

        const currentUser = cacheSessionUser(users[userIndex]);
        if (currentUser && currentUser.id === userId) {
            cacheSessionUser(users[userIndex]);
        }

        return { success: true, user: users[userIndex] };
    }

    return { success: false, message: 'User not found' };
};

const getUserById = (userId) => {
    if (!userId) return null;
    const users = getAllUsers();
    return users.find((user) => user.id === userId) || null;
};

const getConversationMessages = (userId, otherUserId, productId) => {
    if (!userId || !otherUserId) return [];
    const activity = getUserActivity(userId);
    const messages = (activity.messages || []).filter((message) => {
        if (productId && message.productId !== productId) return false;
        return (
            message.senderId === otherUserId ||
            message.receiverId === otherUserId
        );
    });
    return messages.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
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

const recordMessageActivity = ({ senderId, receiverId, productId, productTitle, body, timestamp, conversationId }) => {
    if (!senderId || !receiverId) return;
    const baseMessage = {
        productId,
        productTitle,
        message: body,
        senderId,
        receiverId,
        timestamp,
        conversationId
    };

    const senderActivity = getUserActivity(senderId);
    senderActivity.messages.unshift({ ...baseMessage, direction: 'outgoing' });
    senderActivity.messages = senderActivity.messages.slice(0, 200);
    saveUserActivity(senderId, senderActivity);

    const receiverActivity = getUserActivity(receiverId);
    receiverActivity.messages.unshift({ ...baseMessage, direction: 'incoming' });
    receiverActivity.messages = receiverActivity.messages.slice(0, 200);
    saveUserActivity(receiverId, receiverActivity);
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

const suspendUser = async (adminId, userId) => {
    const admin = await getCurrentUser();
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

const activateUser = async (adminId, userId) => {
    const admin = await getCurrentUser();
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
    getUserById,
    getUserActivity,
    trackProductView,
    trackPurchase,
    trackSale,
    addToFavorites,
    removeFromFavorites,
    isProductFavorited,
    trackSearch,
    sendMessage,
    getConversationMessages,
    sanitizePhoneNumber,
    formatPhoneNumberReadable,
    isAdmin,
    getAllUsersForAdmin,
    suspendUser,
    activateUser,
    recordMessageActivity
};

console.log('DormGlide Auth system loaded');
})();
