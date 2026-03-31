// Storage utilities with Supabase support (fallback to localStorage)

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300x200?text=No+Image';
const LOCAL_PRODUCT_KEY = 'dormglide_products';
const LOCAL_PREFS_KEY = 'dormglide_preferences';
const LOCAL_TRANSACTION_KEY = 'dormglide_transactions';
const LOCAL_SUPPORT_KEY = 'dormglide_support_requests';
const LOCAL_PURCHASE_REQUESTS_KEY = 'dormglide_purchase_requests';

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

const normalizeListingStatus = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (!normalized || normalized === 'active') return 'available';
    return normalized;
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
        stripePaymentLink: record.payment_link || record.stripePaymentLink || '',
        images,
        image: record.main_image || record.image || images[0] || PLACEHOLDER_IMAGE,
        sellerId: record.seller_id || record.sellerId,
        sellerName: record.seller_name || record.sellerName,
        sellerEmail: record.seller_email || record.sellerEmail,
        sellerCampus: record.seller_campus || record.sellerCampus || record.location || '',
        status: normalizeListingStatus(record.status || 'available'),
        requestedAt: record.requested_at || record.requestedAt || null,
        purchasedAt: record.purchased_at || record.purchasedAt || null,
        soldAt: record.sold_at || record.soldAt || null,
        buyerId: record.buyer_id || record.buyerId || null,
        soldMethod: record.sold_method || record.soldMethod || null,
        buyerConfirmedAt: record.buyer_confirmed_at || record.buyerConfirmedAt || null,
        sellerConfirmedAt: record.seller_confirmed_at || record.sellerConfirmedAt || null,
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
    payment_link: (product.stripePaymentLink || '').trim() || null,
    images: product.images || [],
    main_image: product.image || (product.images && product.images[0]) || null,
    seller_id: product.sellerId,
    seller_name: product.sellerName,
    seller_email: product.sellerEmail,
    seller_campus: product.sellerCampus || product.location || null,
    status: normalizeListingStatus(product.status || 'available'),
    requested_at: product.requestedAt || null,
    purchased_at: product.purchasedAt || null,
    sold_at: product.soldAt || null,
    buyer_id: product.buyerId || null,
    sold_method: product.soldMethod || null,
    buyer_confirmed_at: product.buyerConfirmedAt || null,
    seller_confirmed_at: product.sellerConfirmedAt || null,
    is_demo: Boolean(product.isDemo),
    created_at: product.createdAt || new Date().toISOString(),
    views: product.views || 0
});

const normalizeTransactionRecord = (record) => {
    if (!record) return null;
    return {
        id: record.id || record.transaction_id || `txn_${Date.now()}`,
        productId: record.product_id || record.productId || null,
        sellerId: record.seller_id || record.sellerId || null,
        buyerId: record.buyer_id || record.buyerId || null,
        amount: typeof record.amount === 'number' ? record.amount : Number(record.amount || 0),
        currency: String(record.currency || 'USD').toUpperCase(),
        paymentMethod: record.payment_method || record.paymentMethod || 'cash',
        status: String(record.status || 'completed').toLowerCase(),
        source: record.source || 'manual_chat',
        notes: record.notes || '',
        confirmedBySellerAt: record.confirmed_by_seller_at || record.confirmedBySellerAt || null,
        confirmedByBuyerAt: record.confirmed_by_buyer_at || record.confirmedByBuyerAt || null,
        createdAt: record.created_at || record.createdAt || new Date().toISOString()
    };
};

const normalizeSupportRecord = (record) => {
    if (!record) return null;
    return {
        id: record.id || `support_${Date.now()}`,
        productId: record.product_id || record.productId || null,
        reporterId: record.reporter_id || record.reporterId || null,
        counterpartyId: record.counterparty_id || record.counterpartyId || null,
        issueType: record.issue_type || record.issueType || 'other',
        details: record.details || '',
        status: String(record.status || 'open').toLowerCase(),
        createdAt: record.created_at || record.createdAt || new Date().toISOString()
    };
};

const normalizePurchaseRequestRecord = (record) => {
    if (!record) return null;
    return {
        id: record.id,
        listingId: record.listing_id || record.listingId,
        buyerId: record.buyer_id || record.buyerId,
        sellerId: record.seller_id || record.sellerId,
        status: String(record.status || 'pending').toLowerCase(),
        createdAt: record.created_at || record.createdAt || new Date().toISOString(),
        updatedAt: record.updated_at || record.updatedAt || new Date().toISOString()
    };
};

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

const localTransactionAdapter = {
    async fetchAll() {
        const raw = readLocal(LOCAL_TRANSACTION_KEY, []);
        return Array.isArray(raw) ? raw.map((item) => normalizeTransactionRecord(item)).filter(Boolean) : [];
    },
    async create(transaction) {
        const records = readLocal(LOCAL_TRANSACTION_KEY, []);
        const record = {
            id: transaction.id || `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            ...transaction,
            createdAt: transaction.createdAt || new Date().toISOString()
        };
        records.push(record);
        writeLocal(LOCAL_TRANSACTION_KEY, records);
        return normalizeTransactionRecord(record);
    }
};

const localSupportAdapter = {
    async fetchAll() {
        const raw = readLocal(LOCAL_SUPPORT_KEY, []);
        return Array.isArray(raw) ? raw.map((item) => normalizeSupportRecord(item)).filter(Boolean) : [];
    },
    async create(request) {
        const records = readLocal(LOCAL_SUPPORT_KEY, []);
        const record = {
            id: request.id || `support_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            ...request,
            createdAt: request.createdAt || new Date().toISOString(),
            status: request.status || 'open'
        };
        records.push(record);
        writeLocal(LOCAL_SUPPORT_KEY, records);
        return normalizeSupportRecord(record);
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
            stripePaymentLink: (product.stripePaymentLink || '').trim(),
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

const supabaseTransactionAdapter = {
    async fetchAll() {
        const client = getStorageSupabaseClient();
        if (!client) throw new Error('Supabase client not available');
        const { data, error } = await client
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(normalizeTransactionRecord);
    },
    async create(transaction) {
        const client = getStorageSupabaseClient();
        if (!client) throw new Error('Supabase client not available');
        const payload = {
            product_id: transaction.productId || null,
            seller_id: transaction.sellerId || null,
            buyer_id: transaction.buyerId || null,
            amount: typeof transaction.amount === 'number' ? transaction.amount : Number(transaction.amount || 0),
            currency: String(transaction.currency || 'USD').toUpperCase(),
            payment_method: transaction.paymentMethod || 'cash',
            status: String(transaction.status || 'completed').toLowerCase(),
            source: transaction.source || 'manual_chat',
            notes: transaction.notes || null,
            confirmed_by_seller_at: transaction.confirmedBySellerAt || null,
            confirmed_by_buyer_at: transaction.confirmedByBuyerAt || null,
            created_at: transaction.createdAt || new Date().toISOString()
        };
        const { data, error } = await client
            .from('transactions')
            .insert(payload)
            .select('*')
            .single();
        if (error) throw error;
        return normalizeTransactionRecord(data);
    }
};

const supabaseSupportAdapter = {
    async create(request) {
        const client = getStorageSupabaseClient();
        if (!client) throw new Error('Supabase client not available');
        const payload = {
            product_id: request.productId || null,
            reporter_id: request.reporterId || null,
            counterparty_id: request.counterpartyId || null,
            issue_type: request.issueType || 'other',
            details: request.details || null,
            status: String(request.status || 'open').toLowerCase(),
            created_at: request.createdAt || new Date().toISOString()
        };
        const { data, error } = await client
            .from('support_requests')
            .insert(payload)
            .select('*')
            .single();
        if (error) throw error;
        return normalizeSupportRecord(data);
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

const fetchTransactions = async () => {
    const usingSupabase = isSupabaseActive();
    try {
        return usingSupabase
            ? await supabaseTransactionAdapter.fetchAll()
            : await localTransactionAdapter.fetchAll();
    } catch (error) {
        console.error('[DormGlide] Failed to fetch transactions:', error);
        if (usingSupabase && isConnectivityError(error)) {
            markSupabaseUnavailable(error.message || error);
            return await localTransactionAdapter.fetchAll();
        }
        return [];
    }
};

const createManualTransaction = async (transaction) => {
    const usingSupabase = isSupabaseActive();
    const payload = {
        ...transaction,
        source: transaction?.source || 'manual_chat',
        status: String(transaction?.status || 'completed').toLowerCase(),
        createdAt: transaction?.createdAt || new Date().toISOString()
    };

    try {
        return usingSupabase
            ? await supabaseTransactionAdapter.create(payload)
            : await localTransactionAdapter.create(payload);
    } catch (error) {
        console.error('[DormGlide] Failed to create transaction:', error);
        if (usingSupabase && isConnectivityError(error)) {
            markSupabaseUnavailable(error.message || error);
            return await localTransactionAdapter.create(payload);
        }
        throw error;
    }
};

const createSupportRequest = async (request) => {
    const usingSupabase = isSupabaseActive();
    const payload = {
        ...request,
        status: String(request?.status || 'open').toLowerCase(),
        createdAt: request?.createdAt || new Date().toISOString()
    };

    try {
        return usingSupabase
            ? await supabaseSupportAdapter.create(payload)
            : await localSupportAdapter.create(payload);
    } catch (error) {
        console.error('[DormGlide] Failed to create support request:', error);

        const code = String(error?.code || '').toUpperCase();
        const message = String(error?.message || '').toLowerCase();
        const missingTable = code === '42P01' || (message.includes('relation') && message.includes('support_requests'));

        if (usingSupabase && (isConnectivityError(error) || missingTable)) {
            if (isConnectivityError(error)) {
                markSupabaseUnavailable(error.message || error);
            }
            return await localSupportAdapter.create(payload);
        }

        throw error;
    }
};

const fetchListingById = async (listingId) => {
    if (!listingId) return null;
    const records = await fetchProducts();
    return (records || []).find((item) => item?.id === listingId) || null;
};

const fetchPurchaseRequests = async (listingId) => {
    if (!listingId) return [];
    const client = getStorageSupabaseClient();

    if (isSupabaseActive() && client) {
        const { data, error } = await client
            .from('purchase_requests')
            .select('*')
            .eq('listing_id', listingId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(normalizePurchaseRequestRecord);
    }

    const raw = readLocal(LOCAL_PURCHASE_REQUESTS_KEY, []);
    return (Array.isArray(raw) ? raw : [])
        .map(normalizePurchaseRequestRecord)
        .filter((request) => request?.listingId === listingId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const createPurchaseRequest = async ({ listingId, buyerId, sellerId }) => {
    if (!listingId || !buyerId || !sellerId) {
        throw new Error('Missing purchase request fields.');
    }

    const now = new Date().toISOString();
    const client = getStorageSupabaseClient();

    if (isSupabaseActive() && client) {
        const { data, error } = await client
            .from('purchase_requests')
            .insert({
                listing_id: listingId,
                buyer_id: buyerId,
                seller_id: sellerId,
                status: 'pending'
            })
            .select('*')
            .single();
        if (error) throw error;
        return normalizePurchaseRequestRecord(data);
    }

    const requests = readLocal(LOCAL_PURCHASE_REQUESTS_KEY, []);
    const record = {
        id: `pr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        listingId,
        buyerId,
        sellerId,
        status: 'pending',
        createdAt: now,
        updatedAt: now
    };
    requests.push(record);
    writeLocal(LOCAL_PURCHASE_REQUESTS_KEY, requests);
    return normalizePurchaseRequestRecord(record);
};

const updatePurchaseRequestStatus = async (requestId, status) => {
    if (!requestId) return null;
    const nextStatus = String(status || 'pending').toLowerCase();
    const now = new Date().toISOString();
    const client = getStorageSupabaseClient();

    if (isSupabaseActive() && client) {
        const { data, error } = await client
            .from('purchase_requests')
            .update({ status: nextStatus, updated_at: now })
            .eq('id', requestId)
            .select('*')
            .single();
        if (error) throw error;
        return normalizePurchaseRequestRecord(data);
    }

    const requests = readLocal(LOCAL_PURCHASE_REQUESTS_KEY, []);
    const index = requests.findIndex((entry) => entry?.id === requestId);
    if (index === -1) return null;
    requests[index] = { ...requests[index], status: nextStatus, updatedAt: now };
    writeLocal(LOCAL_PURCHASE_REQUESTS_KEY, requests);
    return normalizePurchaseRequestRecord(requests[index]);
};

const requestPurchase = async ({ listingId, buyerId, sellerId }) => {
    const existing = await fetchPurchaseRequests(listingId);
    const existingForBuyer = (existing || []).find((entry) => entry?.buyerId === buyerId && ['pending', 'confirmed'].includes(entry?.status));
    const request = existingForBuyer || await createPurchaseRequest({ listingId, buyerId, sellerId });
    await updateProduct(listingId, {
        status: 'pending',
        buyerId,
        requestedAt: request?.createdAt || new Date().toISOString()
    });
    const listing = await fetchListingById(listingId);
    return { request, listing };
};

const confirmPurchase = async ({ listingId, purchaseRequestId, buyerId }) => {
    const now = new Date().toISOString();

    if (purchaseRequestId) {
        await updatePurchaseRequestStatus(purchaseRequestId, 'confirmed');
    }

    await updateProduct(listingId, {
        status: 'sold',
        buyerId: buyerId || null,
        purchasedAt: now,
        soldAt: now,
        sellerConfirmedAt: now
    });

    const listing = await fetchListingById(listingId);
    return { listing };
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
    fetchTransactions,
    createManualTransaction,
    createSupportRequest,
    fetchListingById,
    fetchPurchaseRequests,
    requestPurchase,
    confirmPurchase,
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
