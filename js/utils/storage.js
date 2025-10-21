// Storage utilities with Supabase support (fallback to localStorage)

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300x200?text=No+Image';
const LOCAL_PRODUCT_KEY = 'dormglide_products';
const LOCAL_PREFS_KEY = 'dormglide_preferences';

const getSupabaseClient = () => window.SupabaseClient || null;
const isSupabaseConfigured = () => Boolean(getSupabaseClient());
let supabaseAvailable = true;

const isSupabaseActive = () => isSupabaseConfigured() && supabaseAvailable;
const markSupabaseUnavailable = (error) => {
    supabaseAvailable = false;
    console.warn('[DormGlide] Supabase disabled for this session, falling back to local storage.', error);
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
        return readLocal(LOCAL_PRODUCT_KEY, []);
    },
    async create(product) {
        const products = readLocal(LOCAL_PRODUCT_KEY, []);
        const record = {
            id: product.id || Date.now().toString(),
            ...product,
            image: product.image || product.images?.[0] || PLACEHOLDER_IMAGE,
            createdAt: product.createdAt || new Date().toISOString()
        };
        products.push(record);
        writeLocal(LOCAL_PRODUCT_KEY, products);
        return record;
    },
    async update(productId, updates) {
        const products = readLocal(LOCAL_PRODUCT_KEY, []);
        const idx = products.findIndex((item) => item.id === productId);
        if (idx === -1) return null;
        products[idx] = { ...products[idx], ...updates };
        writeLocal(LOCAL_PRODUCT_KEY, products);
        return products[idx];
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
        const client = getSupabaseClient();
        if (!client) throw new Error('Supabase client not available');
        const { data, error } = await client.from('products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(normalizeProductRecord);
    },
    async create(product) {
        const client = getSupabaseClient();
        if (!client) throw new Error('Supabase client not available');
        const payload = productToSupabasePayload(product);
        const { data, error } = await client.from('products').insert(payload).select('*').single();
        if (error) throw error;
        return normalizeProductRecord(data);
    },
    async update(productId, updates) {
        const client = getSupabaseClient();
        if (!client) throw new Error('Supabase client not available');
        const payload = productToSupabasePayload({ ...updates, id: productId });
        const { data, error } = await client.from('products').update(payload).eq('id', productId).select('*').maybeSingle();
        if (error) throw error;
        return normalizeProductRecord(data || { id: productId, ...updates });
    },
    async remove(productId) {
        const client = getSupabaseClient();
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
    try {
        return await productAdapter().create(product);
    } catch (error) {
        console.error('[DormGlide] Failed to create product:', error);
        if (usingSupabase) {
            markSupabaseUnavailable(error.message || error);
            try {
                return await localProductAdapter.create(product);
            } catch (localError) {
                console.error('[DormGlide] Local fallback create failed:', localError);
            }
        }
        throw error;
    }
};

const updateProduct = async (productId, updates) => {
    const usingSupabase = isSupabaseActive();
    try {
        return await productAdapter().update(productId, updates);
    } catch (error) {
        console.error('[DormGlide] Failed to update product:', error);
        if (usingSupabase) {
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
    try {
        return await productAdapter().remove(productId);
    } catch (error) {
        console.error('[DormGlide] Failed to delete product:', error);
        if (usingSupabase) {
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
    deleteProductFromStorage
};
