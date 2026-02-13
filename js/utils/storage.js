// Storage utilities with Supabase support (fallback to localStorage)

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300x200?text=No+Image';
const LOCAL_PRODUCT_KEY = 'dormglide_products';
const LOCAL_PREFS_KEY = 'dormglide_preferences';

const getStorageSupabaseClient = () => window.SupabaseClient || null;
const isSupabaseConfigured = () => Boolean(getStorageSupabaseClient());
let supabaseAvailable = true;
let supabaseDisabledUntil = 0;

const isSupabaseActive = () => {
    if (!isSupabaseConfigured()) return false;
    if (!supabaseAvailable && Date.now() >= supabaseDisabledUntil) {
        supabaseAvailable = true;
        supabaseDisabledUntil = 0;
    }
    return supabaseAvailable;
};
const hasSupabaseSession = () => Boolean(window.DormGlideSupabaseSessionActive);
const getAuthMode = () => String(window.DORMGLIDE_AUTH_MODE || 'hybrid').toLowerCase();
const isSupabaseOnlyMode = () => getAuthMode() === 'supabase';
const markSupabaseUnavailable = (error) => {
    supabaseAvailable = false;
    supabaseDisabledUntil = Date.now() + 30 * 1000;
    console.warn('[DormGlide] Supabase disabled for this session, falling back to local storage.', error);
};

const isConnectivityError = (error) => {
    const status = Number(error?.status || error?.statusCode || 0);
    const message = String(error?.message || error || '').toLowerCase();
    return (
        status >= 500 ||
        message.includes('failed to fetch') ||
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('load failed')
    );
};

// -----------------------------
// Helper mappers
// -----------------------------
const normalizeProductRecord = (record) => {
    if (!record) return null;
    const images = Array.isArray(record.images) ? record.images : (record.images ? [record.images] : []);
    return {
        id: record.id || record.product_id || record.uuid || record.slug,
        title: record.title,
        description: record.description,
        price: typeof record.price === 'number' ? record.price : Number(record.price || 0),
        category: record.category,
        condition: record.condition,
        location: record.location,
        contactInfo: record.contact_info || record.contactInfo || '',
        images,
        image: record.main_image || record.image || images[0] || PLACEHOLDER_IMAGE,
        sellerId: record.seller_id || record.sellerId,
        sellerName: record.seller_name || record.sellerName,
        sellerEmail: record.seller_email || record.sellerEmail,
        sellerCampus: record.seller_campus || record.sellerCampus || record.location || '',
        isDemo: Boolean(record.isDemo ?? record.is_demo ?? false),
        createdAt: record.created_at || record.createdAt || new Date().toISOString(),
        views: record.views || 0
    };
};

const productToSupabasePayload = (product) => ({
    title: product.title,
    description: product.description,
    price: typeof product.price === 'number' ? product.price : parseFloat(product.price || 0),
    category: product.category,
    condition: product.condition,
    location: product.location || null,
    contact_info: product.contactInfo || null,
    images: product.images || [],
    main_image: product.image || (product.images && product.images[0]) || null,
    seller_id: product.sellerId,
    seller_name: product.sellerName,
    seller_email: product.sellerEmail,
    seller_campus: product.sellerCampus || product.location || null,
    is_demo: Boolean(product.isDemo),
    created_at: product.createdAt || new Date().toISOString(),
    views: product.views || 0
});

// -----------------------------
// Local storage adapter
// -----------------------------
const readLocal = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch (error) {
        console.error(`[DormGlide] Failed reading ${key}:`, error);
        return fallback;
    }
};

const writeLocal = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`[DormGlide] Failed writing ${key}:`, error);
    }
};

const localProductAdapter = {
    async fetchAll() {
        const raw = readLocal(LOCAL_PRODUCT_KEY, []);
        return Array.isArray(raw) ? raw.map((item) => normalizeProductRecord(item)).filter(Boolean) : [];
    },
    async create(product) {
        const products = readLocal(LOCAL_PRODUCT_KEY, []);
        const record = {
            id: product.id || Date.now().toString(),
            ...product,
            image: product.image || product.images?.[0] || PLACEHOLDER_IMAGE,
            sellerCampus: product.sellerCampus || product.location || '',
            isDemo: Boolean(product.isDemo),
            createdAt: product.createdAt || new Date().toISOString()
        };
        products.push(record);
        writeLocal(LOCAL_PRODUCT_KEY, products);
        return normalizeProductRecord(record);
    },
    async update(productId, updates) {
        const products = readLocal(LOCAL_PRODUCT_KEY, []);
        const idx = products.findIndex((item) => item.id === productId);
        if (idx === -1) return null;
        products[idx] = { ...products[idx], ...updates };
        writeLocal(LOCAL_PRODUCT_KEY, products);
        return normalizeProductRecord(products[idx]);
    },
    async remove(productId) {
        const products = readLocal(LOCAL_PRODUCT_KEY, []);
        const filtered = products.filter((item) => item.id !== productId);
        writeLocal(LOCAL_PRODUCT_KEY, filtered);
        return true;
    }
};

const localPreferencesAdapter = {
    async getPreferences() {
        return readLocal(LOCAL_PREFS_KEY, {
            theme: 'light',
            notifications: true,
            searchHistory: []
        });
    },
    async savePreferences(preferences) {
        writeLocal(LOCAL_PREFS_KEY, preferences);
    }
};

// -----------------------------
// Supabase adapter
// -----------------------------
const supabaseProductAdapter = {
    async fetchAll() {
        const client = getStorageSupabaseClient();
        if (!client) throw new Error('Supabase client not available');
        const { data, error } = await client.from('products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(normalizeProductRecord);
    },
    async create(product) {
        const client = getStorageSupabaseClient();
        if (!client) throw new Error('Supabase client not available');
        const payload = productToSupabasePayload(product);
        const { data, error } = await client.from('products').insert(payload).select('*').single();
        if (error) throw error;
        return normalizeProductRecord(data);
    },
    async update(productId, updates) {
        const client = getStorageSupabaseClient();
        if (!client) throw new Error('Supabase client not available');
        const payload = productToSupabasePayload({ ...updates, id: productId });
        const { data, error } = await client.from('products').update(payload).eq('id', productId).select('*').maybeSingle();
        if (error) throw error;
        return normalizeProductRecord(data || { id: productId, ...updates });
    },
    async remove(productId) {
        const client = getStorageSupabaseClient();
        if (!client) throw new Error('Supabase client not available');
        const { error } = await client.from('products').delete().eq('id', productId);
        if (error) throw error;
        return true;
    }
};

const productAdapter = () => (isSupabaseActive() ? supabaseProductAdapter : localProductAdapter);

// -----------------------------
// Public API (returns promises)
// -----------------------------
const fetchProducts = async () => {
    const usingSupabase = isSupabaseActive();
    try {
        return await productAdapter().fetchAll();
    } catch (error) {
        console.error('[DormGlide] Failed to fetch products:', error);
        if (usingSupabase) {
            markSupabaseUnavailable(error.message || error);
            try {
                await initializeDefaultData();
                return await localProductAdapter.fetchAll();
            } catch (localError) {
                console.error('[DormGlide] Local fallback fetch failed:', localError);
                return [];
            }
        }
        return [];
    }
};

const createProduct = async (product) => {
    const usingSupabase = isSupabaseActive();
    if (usingSupabase && !hasSupabaseSession()) {
        if (isSupabaseOnlyMode()) {
            throw new Error('Listing failed: you must be logged in (Supabase Auth) to post items.');
        }
        return await localProductAdapter.create(product);
    }
    try {
        return await productAdapter().create(product);
    } catch (error) {
        console.error('[DormGlide] Failed to create product:', error);

        if (usingSupabase) {
            const message = String(error?.message || '');
            const status = Number(error?.status || error?.statusCode || 0);
            const code = String(error?.code || '').toUpperCase();
            const lowered = message.toLowerCase();

            // If Supabase is configured, falling back to localStorage would make listings device-only
            // (other users will not see them). Instead, surface a clear setup/auth error.
            const looksLikeAuthOrRls =
                status === 401 ||
                status === 403 ||
                code === '42501' ||
                message.toLowerCase().includes('row level security') ||
                message.toLowerCase().includes('not authorized') ||
                message.toLowerCase().includes('permission denied');

            if (looksLikeAuthOrRls) {
                throw new Error('Listing failed: Supabase blocked the request (RLS/auth). Make sure you are logged in with Supabase Auth and that the products table + policies are set up.');
            }

            if (code === '42P01' || lowered.includes('relation') && lowered.includes('products')) {
                throw new Error('Listing failed: products table is missing in Supabase. Run SUPABASE-PRODUCTS-SETUP.md SQL in your new project.');
            }

            if (code === '22P02' || lowered.includes('invalid input syntax for type uuid')) {
                throw new Error('Listing failed: seller_id must be a Supabase Auth UUID. Please log out and log in again with Supabase Auth.');
            }

            // For genuine connectivity/outage issues we can still fall back to local,
            // but warn that the listing will not be shared.
            if (isConnectivityError(error)) {
                if (isSupabaseOnlyMode()) {
                    throw new Error('Listing failed: Supabase is temporarily unreachable. Please try again in a moment.');
                }

                markSupabaseUnavailable(error.message || error);
                try {
                    const local = await localProductAdapter.create(product);
                    console.warn('[DormGlide] Product saved locally because Supabase is unavailable; other users will not see it until Supabase is working.');
                    return local;
                } catch (localError) {
                    console.error('[DormGlide] Local fallback create failed:', localError);
                }
            }
        }

        throw error;
    }
};

const updateProduct = async (productId, updates) => {
    const usingSupabase = isSupabaseActive();
    if (usingSupabase && !hasSupabaseSession()) {
        if (isSupabaseOnlyMode()) {
            throw new Error('Update failed: you must be logged in (Supabase Auth) to edit items.');
        }
        return await localProductAdapter.update(productId, updates);
    }
    try {
        return await productAdapter().update(productId, updates);
    } catch (error) {
        console.error('[DormGlide] Failed to update product:', error);
        if (usingSupabase) {
            const message = String(error?.message || '');
            const status = Number(error?.status || error?.statusCode || 0);
            const code = String(error?.code || '').toUpperCase();
            const looksLikeAuthOrRls =
                status === 401 ||
                status === 403 ||
                code === '42501' ||
                message.toLowerCase().includes('row level security') ||
                message.toLowerCase().includes('not authorized') ||
                message.toLowerCase().includes('permission denied');
            if (looksLikeAuthOrRls) {
                throw new Error('Update failed: Supabase blocked the request (RLS/auth). Only the seller can edit listings, and you must be logged in with Supabase Auth.');
            }

            markSupabaseUnavailable(error.message || error);
            try {
                return await localProductAdapter.update(productId, updates);
            } catch (localError) {
                console.error('[DormGlide] Local fallback update failed:', localError);
            }
        }
        throw error;
    }
};

const deleteProduct = async (productId) => {
    const usingSupabase = isSupabaseActive();
    if (usingSupabase && !hasSupabaseSession()) {
        if (isSupabaseOnlyMode()) {
            throw new Error('Delete failed: you must be logged in (Supabase Auth) to delete items.');
        }
        return await localProductAdapter.remove(productId);
    }
    try {
        return await productAdapter().remove(productId);
    } catch (error) {
        console.error('[DormGlide] Failed to delete product:', error);
        if (usingSupabase) {
            const message = String(error?.message || '');
            const status = Number(error?.status || error?.statusCode || 0);
            const code = String(error?.code || '').toUpperCase();
            const looksLikeAuthOrRls =
                status === 401 ||
                status === 403 ||
                code === '42501' ||
                message.toLowerCase().includes('row level security') ||
                message.toLowerCase().includes('not authorized') ||
                message.toLowerCase().includes('permission denied');
            if (looksLikeAuthOrRls) {
                throw new Error('Delete failed: Supabase blocked the request (RLS/auth). Only the seller can delete listings, and you must be logged in with Supabase Auth.');
            }

            markSupabaseUnavailable(error.message || error);
            try {
                return await localProductAdapter.remove(productId);
            } catch (localError) {
                console.error('[DormGlide] Local fallback delete failed:', localError);
            }
        }
        throw error;
    }
};

const addToSearchHistory = async (searchTerm) => {
    if (!searchTerm || !searchTerm.trim()) return;
    const preferences = await localPreferencesAdapter.getPreferences();
    const history = preferences.searchHistory || [];
    const filtered = history.filter((term) => term !== searchTerm.trim());
    filtered.unshift(searchTerm.trim());
    preferences.searchHistory = filtered.slice(0, 10);
    await localPreferencesAdapter.savePreferences(preferences);
};

const getSearchHistory = async () => {
    const preferences = await localPreferencesAdapter.getPreferences();
    return preferences.searchHistory || [];
};

const clearAllData = async () => {
    if (isSupabaseActive()) {
        console.warn('[DormGlide] clearAllData skipped because Supabase is enabled.');
        return;
    }
    localStorage.removeItem(LOCAL_PRODUCT_KEY);
    localStorage.removeItem(LOCAL_PREFS_KEY);
    localStorage.removeItem('dormglide_current_user');
    console.log('[DormGlide] Local demo data cleared');
};

const initializeDefaultData = async () => {
    if (isSupabaseActive()) {
        console.log('[DormGlide] Supabase enabled; skipping demo data seeding.');
        return;
    }
    const existingProducts = await localProductAdapter.fetchAll();
    if (existingProducts.length === 0 && typeof getSampleProducts === 'function') {
        const sampleProducts = getSampleProducts();
        writeLocal(LOCAL_PRODUCT_KEY, sampleProducts);
        console.log('[DormGlide] Sample products initialized (local mode)');
    }
};

// Backwards-compatible helper names (return promises)
const getProductsFromStorage = fetchProducts;
const saveProductsToStorage = async (products) => {
    if (isSupabaseConfigured()) {
        console.warn('[DormGlide] saveProductsToStorage ignored in Supabase mode. Use createProduct/updateProduct instead.');
        return;
    }
    writeLocal(LOCAL_PRODUCT_KEY, products);
};

const addProductToStorage = createProduct;
const updateProductInStorage = updateProduct;
const deleteProductFromStorage = deleteProduct;

window.DormGlideStorage = {
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getSearchHistory,
    addToSearchHistory,
    clearAllData,
    initializeDefaultData,
    isSupabaseConfigured,
    isSupabaseActive,
    // legacy aliases
    saveProductsToStorage,
    getProductsFromStorage,
    addProductToStorage,
    updateProductInStorage,
    deleteProductFromStorage,
    getSupabaseClient: getStorageSupabaseClient,
    markSupabaseUnavailable
};
