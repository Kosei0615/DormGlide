// Glyde — the services mode of DormGlide. Shared constants + mode helpers.
// Services are products rows with listingType 'service'; bookings are
// purchase_requests rows with kind 'booking'. Same account, campus, chat,
// deal flow and ratings — only the storefront and accent color differ.
(() => {
    const MODE_KEY = 'dormglide_mode';

    // v1 categories — must match the DB check constraint exactly.
    const SERVICE_CATEGORIES = [
        { name: 'Tutoring & academic help', glyph: '📚' },
        { name: 'Hair & beauty', glyph: '💇' },
        { name: 'Tech help', glyph: '💻' },
        { name: 'Photography & video', glyph: '📸' },
        { name: 'Moving & carrying help', glyph: '🚚' },
        { name: 'Pet sitting & dog walking', glyph: '🐶' },
        { name: 'Fitness & sports coaching', glyph: '🏋️' },
        { name: 'Music lessons', glyph: '🎸' },
        { name: 'Other', glyph: '✨' }
    ];

    const RATE_UNITS = [
        { value: 'hour', label: 'per hour', short: '/hr' },
        { value: 'session', label: 'per session', short: '/session' },
        { value: 'flat', label: 'flat rate', short: ' flat' }
    ];

    const LOCATION_OPTIONS = [
        { value: 'on campus', label: 'On campus', glyph: '🏫' },
        { value: 'my place', label: 'My place', glyph: '🏠' },
        { value: 'your place', label: 'Your place', glyph: '🚪' },
        { value: 'remote', label: 'Remote', glyph: '💻' }
    ];

    // Enforced in the UI (this notice + the fixed category list) and by the
    // DB check constraint on service_category.
    const EXCLUDED_SERVICES_NOTICE =
        'Not allowed on Glyde: childcare or anything involving minors, medical or mental-health services, ' +
        'anything that requires a professional license, driving people anywhere, and doing academic work ' +
        'that someone else will submit as their own (tutoring is welcome — ghostwriting is not).';

    const getMode = () => {
        try {
            return localStorage.getItem(MODE_KEY) === 'glyde' ? 'glyde' : 'goods';
        } catch (_error) {
            return 'goods';
        }
    };

    const setMode = (mode) => {
        const next = mode === 'glyde' ? 'glyde' : 'goods';
        try {
            localStorage.setItem(MODE_KEY, next);
        } catch (_error) { /* storage unavailable */ }
        return next;
    };

    const categoryGlyph = (name) =>
        (SERVICE_CATEGORIES.find((entry) => entry.name === name) || { glyph: '✨' }).glyph;

    const formatRate = (product) => {
        const rate = Number(product?.rate ?? product?.price ?? 0);
        const unit = RATE_UNITS.find((entry) => entry.value === product?.rateUnit) || RATE_UNITS[0];
        const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: rate % 1 === 0 ? 0 : 2 }).format(rate);
        return `${money}${unit.short}`;
    };

    const locationLabel = (value) =>
        (LOCATION_OPTIONS.find((entry) => entry.value === value) || {}).label || '';

    const isService = (product) => String(product?.listingType || 'goods') === 'service';

    window.DormGlideGlyde = {
        SERVICE_CATEGORIES,
        RATE_UNITS,
        LOCATION_OPTIONS,
        EXCLUDED_SERVICES_NOTICE,
        getMode,
        setMode,
        categoryGlyph,
        formatRate,
        locationLabel,
        isService
    };
})();
