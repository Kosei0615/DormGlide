// DormGlide payment helpers (Stripe Payment Links)
(() => {
    const isValidStripePaymentLink = (value) => {
        if (!value) return false;
        try {
            const parsed = new URL(String(value).trim());
            return (
                parsed.protocol === 'https:' &&
                (parsed.hostname === 'buy.stripe.com' || parsed.hostname.endsWith('.stripe.com'))
            );
        } catch (_error) {
            return false;
        }
    };

    const getProductPaymentLink = (product) => {
        const link = String(product?.stripePaymentLink || product?.paymentLink || '').trim();
        return isValidStripePaymentLink(link) ? link : '';
    };

    const startCheckout = ({ product }) => {
        const link = getProductPaymentLink(product);
        if (!link) {
            return {
                success: false,
                message: 'This seller has not connected a Stripe payment link yet. Please use Chat with Seller to arrange payment.'
            };
        }

        window.open(link, '_blank', 'noopener,noreferrer');
        return { success: true };
    };

    window.DormGlidePayments = {
        isValidStripePaymentLink,
        getProductPaymentLink,
        startCheckout
    };
})();
