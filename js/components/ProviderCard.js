// Provider trust card for service detail pages: completed bookings, rating,
// reply time (only with >=3 samples), categories offered, plus Report.
const ProviderCard = ({ product, currentUser }) => {
    const [stats, setStats] = React.useState(null);
    const glyde = window.DormGlideGlyde;

    React.useEffect(() => {
        let mounted = true;
        if (!product?.sellerId || !glyde?.fetchProviderStats) return undefined;
        glyde.fetchProviderStats(product.sellerId).then((result) => { if (mounted) setStats(result); });
        return () => { mounted = false; };
    }, [product?.sellerId]);

    if (!product?.sellerId) return null;

    const replyLabel = stats && stats.replyMinutes !== null && stats.replySamples >= 3
        ? `usually replies within ${glyde.formatReplyTime(stats.replyMinutes)}`
        : 'new provider';

    return React.createElement('div', { className: 'provider-card' },
        React.createElement('div', { className: 'provider-card-head' },
            React.createElement('div', { className: 'provider-avatar', 'aria-hidden': true }, '👤'),
            React.createElement('div', { className: 'provider-card-main' },
                React.createElement('strong', null, product.sellerName || 'Student provider'),
                React.createElement('span', { className: 'provider-card-sub' },
                    `${currentUser?.schoolName || 'Verified'} student · ${replyLabel}`)
            ),
            window.DormGlideReportButton && React.createElement(window.DormGlideReportButton, {
                targetType: 'user', targetId: product.sellerId, currentUser, compact: true
            })
        ),
        React.createElement('div', { className: 'provider-stats' },
            React.createElement('span', null,
                stats && stats.ratingCount > 0 ? `⭐ ${stats.avgRating.toFixed(1)} (${stats.ratingCount})` : '⭐ No ratings yet'),
            React.createElement('span', null,
                `✅ ${stats ? stats.completedBookings : 0} session${stats && stats.completedBookings === 1 ? '' : 's'} completed`),
            stats && stats.categories.length > 0 && React.createElement('span', null,
                '✨ ', stats.categories.join(' · '))
        )
    );
};

window.DormGlideProviderCard = ProviderCard;
