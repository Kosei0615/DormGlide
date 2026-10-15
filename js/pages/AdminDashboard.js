// Admin Dashboard for Managing Users and Platform
const AdminDashboard = ({ onNavigate, currentUser }) => {
    // Glyde founder counts (DB-gated by admin_users; non-admins get null).
    const [glydeCounts, setGlydeCounts] = React.useState(null);
    const [delivery, setDelivery] = React.useState(null);
    const [deliveryTick, setDeliveryTick] = React.useState(0);
    React.useEffect(() => {
        let mounted = true;
        window.DormGlideGlyde?.fetchGlydeAdminCounts?.().then((counts) => { if (mounted) setGlydeCounts(counts); });
        window.DormGlideDelivery?.fetchAdminSummary?.().then((summary) => { if (mounted) setDelivery(summary); });
        return () => { mounted = false; };
    }, [currentUser?.id, deliveryTick]);
    const copyText = async (text) => {
        try { await navigator.clipboard.writeText(text); toast.success('Copied.'); }
        catch (_e) { window.prompt('Copy this link:', text); }
    };
    const makeConsoleLink = async (provider) => {
        const key = await window.DormGlideDelivery?.issueConsoleKey?.(provider.id);
        if (!key) { toast.error('Could not create the link.'); return; }
        setDeliveryTick((t) => t + 1);
        await copyText(`https://dormglide.com/courier/?k=${key}`);
    };
    const rotateConsoleLink = async (provider) => {
        if (!window.confirm(`Replace ${provider.display_name}'s courier link? The old link stops working immediately.`)) return;
        const key = await window.DormGlideDelivery?.rotateConsoleKey?.(provider.id);
        if (!key) { toast.error('Could not replace the link.'); return; }
        setDeliveryTick((t) => t + 1);
        await copyText(`https://dormglide.com/courier/?k=${key}`);
    };
    const fee = (cents) => `$${(Number(cents || 0) / 100).toFixed(2).replace(/\.00$/, '')}`;
    const when = (iso) => iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    const toast = window.DormGlideToast || {
        success: () => {},
        error: () => {},
        warning: () => {},
        info: () => {}
    };

    const [users, setUsers] = React.useState([]);
    const [products, setProducts] = React.useState([]);
    const [activeTab, setActiveTab] = React.useState('overview');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [filterStatus, setFilterStatus] = React.useState('all');

    React.useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            if (!window.DormGlideAuth || !window.DormGlideAuth.isAdmin(currentUser)) {
                return;
            }

            try {
                if (typeof window.DormGlideAuth.getAllUsersForAdmin === 'function') {
                    const allUsers = await window.DormGlideAuth.getAllUsersForAdmin();
                    if (isMounted) {
                        setUsers(allUsers);
                    }
                }

                if (typeof getProductsFromStorage !== 'undefined') {
                    const allProducts = await getProductsFromStorage();
                    if (isMounted) {
                        setProducts(allProducts);
                    }
                }
            } catch (error) {
                console.error('Failed to load admin data:', error);
            }
        };

        loadData();

        return () => {
            isMounted = false;
        };
    }, [currentUser]);

    const reloadData = async () => {
        if (window.DormGlideAuth && window.DormGlideAuth.isAdmin(currentUser)) {
            await Promise.all([
                typeof window.DormGlideAuth.getAllUsersForAdmin === 'function'
                    ? Promise.resolve(window.DormGlideAuth.getAllUsersForAdmin()).then((data) => setUsers(data))
                    : Promise.resolve(),
                typeof getProductsFromStorage !== 'undefined'
                    ? Promise.resolve(getProductsFromStorage()).then((data) => setProducts(data))
                    : Promise.resolve()
            ]);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const handleSuspendUser = async (userId) => {
        if (confirm('Are you sure you want to suspend this user?')) {
            const result = await window.DormGlideAuth.suspendUser(currentUser.id, userId);
            if (result.success) {
                toast.success('User suspended successfully.');
                reloadData();
            }
        }
    };

    const handleActivateUser = async (userId) => {
        const result = await window.DormGlideAuth.activateUser(currentUser.id, userId);
        if (result.success) {
            toast.success('User activated successfully.');
            reloadData();
        }
    };

    const handleDeleteProduct = async (productId) => {
        if (confirm('Are you sure you want to delete this product?')) {
            await deleteProductFromStorage(productId);
            await reloadData();
            toast.success('Product deleted successfully.');
        }
    };

    const calculatePlatformStats = () => {
        const totalUsers = users.length;
        const activeUsers = users.filter(u => u.status === 'active').length;
        const totalProducts = products.length;
        const totalRevenue = products.reduce((sum, p) => sum + (p.price || 0), 0);
        
        return {
            totalUsers,
            activeUsers,
            totalProducts,
            totalRevenue
        };
    };

    const filterUsers = () => {
        let filtered = users;
        
        if (searchTerm) {
            filtered = filtered.filter(u => 
                u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        if (filterStatus !== 'all') {
            filtered = filtered.filter(u => u.status === filterStatus);
        }
        
        return filtered;
    };

    const renderOverviewTab = () => {
        const stats = calculatePlatformStats();
        
        return React.createElement('div', { className: 'admin-overview' },
            delivery && React.createElement('section', { className: 'admin-glyde-panel admin-delivery-panel' },
                React.createElement('h3', null, '🛼 Campus Delivery'),
                (delivery.providers || []).length === 0 && React.createElement('p', null, 'No couriers enrolled yet.'),
                (delivery.providers || []).map((p) => React.createElement('div', { key: p.id, className: 'admin-courier' },
                    React.createElement('div', { className: 'admin-courier-head' },
                        React.createElement('strong', null, p.display_name),
                        React.createElement('span', { className: `delivery-pill ${p.is_online ? 'is-open' : ''}` }, p.is_online ? 'Online' : 'Offline'),
                        React.createElement('span', { className: 'admin-courier-email' }, p.email || '')),
                    React.createElement('div', { className: 'admin-glyde-totals' },
                        React.createElement('div', null, React.createElement('strong', null, p.counts?.delivered ?? 0), ' delivered'),
                        React.createElement('div', null, React.createElement('strong', null, p.counts?.delivered_7d ?? 0), ' last 7 days'),
                        React.createElement('div', null, React.createElement('strong', null, fee(p.counts?.fees_delivered_cents)), ' earned'),
                        React.createElement('div', null, React.createElement('strong', null, p.counts?.active ?? 0), ' in progress'),
                        React.createElement('div', null, React.createElement('strong', null, p.counts?.pending ?? 0), ' waiting'),
                        React.createElement('div', null, React.createElement('strong', null, p.counts?.declined ?? 0), ' declined'),
                        React.createElement('div', null, React.createElement('strong', null, p.counts?.cancelled ?? 0), ' cancelled'),
                        React.createElement('div', null, React.createElement('strong', null, p.counts?.expired ?? 0), ' expired'),
                        p.counts?.avg_accept_seconds != null && React.createElement('div', null, React.createElement('strong', null, `${Math.round(p.counts.avg_accept_seconds / 60)} min`), ' avg. to answer'),
                        p.counts?.avg_delivery_minutes != null && React.createElement('div', null, React.createElement('strong', null, `${p.counts.avg_delivery_minutes} min`), ' avg. delivery')),
                    React.createElement('div', { className: 'admin-courier-link' },
                        p.console_url
                            ? React.createElement(React.Fragment, null,
                                React.createElement('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: () => copyText(p.console_url) }, 'Copy courier link'),
                                React.createElement('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: () => rotateConsoleLink(p) }, 'Replace link'))
                            : React.createElement('button', { type: 'button', className: 'btn btn-primary btn-sm', onClick: () => makeConsoleLink(p) }, 'Create courier link'))
                )),
                Array.isArray(delivery.recent) && delivery.recent.length > 0 && React.createElement('table', { className: 'admin-glyde-table' },
                    React.createElement('thead', null, React.createElement('tr', null,
                        React.createElement('th', null, 'When'), React.createElement('th', null, 'Courier'), React.createElement('th', null, 'Customer'),
                        React.createElement('th', null, 'Order'), React.createElement('th', null, 'Status'), React.createElement('th', null, 'Fee'))),
                    React.createElement('tbody', null, delivery.recent.map((r) => React.createElement('tr', { key: r.id },
                        React.createElement('td', null, when(r.created_at)), React.createElement('td', null, r.courier), React.createElement('td', null, r.customer),
                        React.createElement('td', null, `${r.items} · ${r.pickup_spot} → ${r.deliver_to}`),
                        React.createElement('td', null, window.DormGlideDelivery?.STATUS_LABELS?.[r.status] || r.status), React.createElement('td', null, fee(r.fee_cents))))))
            ),
            glydeCounts && React.createElement('section', { className: 'admin-glyde-panel' },
                React.createElement('h3', null, '✨ Glyde (services)'),
                React.createElement('div', { className: 'admin-glyde-totals' },
                    React.createElement('div', null, React.createElement('strong', null, glydeCounts.services), ' services'),
                    React.createElement('div', null, React.createElement('strong', null, glydeCounts.bookings_requested), ' bookings requested'),
                    React.createElement('div', null, React.createElement('strong', null, glydeCounts.bookings_completed), ' completed'),
                    React.createElement('div', null, React.createElement('strong', null, glydeCounts.open_requests), ' open requests'),
                    React.createElement('div', null, React.createElement('strong', null, glydeCounts.open_reports), ' open reports')
                ),
                Array.isArray(glydeCounts.by_category) && glydeCounts.by_category.length > 0 && React.createElement('table', { className: 'admin-glyde-table' },
                    React.createElement('thead', null, React.createElement('tr', null,
                        React.createElement('th', null, 'Category'), React.createElement('th', null, 'Services'),
                        React.createElement('th', null, 'Requested'), React.createElement('th', null, 'Completed'))),
                    React.createElement('tbody', null, glydeCounts.by_category.map((row) => React.createElement('tr', { key: row.category },
                        React.createElement('td', null, row.category), React.createElement('td', null, row.services),
                        React.createElement('td', null, row.bookings_requested), React.createElement('td', null, row.bookings_completed))))
                ),
                Array.isArray(glydeCounts.recent_reports) && glydeCounts.recent_reports.length > 0 && React.createElement('div', { className: 'admin-glyde-reports' },
                    React.createElement('h4', null, 'Open reports'),
                    glydeCounts.recent_reports.map((report) => React.createElement('p', { key: report.id },
                        `🚩 ${report.reason} — ${report.target_type} ${String(report.target_id).slice(0, 8)}… ${report.details ? `— "${report.details}"` : ''}`))
                )
            ),
            React.createElement('div', { className: 'stats-grid' },
                React.createElement('div', { className: 'stat-card' },
                    React.createElement('div', { className: 'stat-icon', style: { background: '#e3f2fd' } },
                        React.createElement('i', { className: 'fas fa-users', style: { color: '#2196f3' } })
                    ),
                    React.createElement('div', { className: 'stat-info' },
                        React.createElement('h3', null, stats.totalUsers),
                        React.createElement('p', null, 'Total Users')
                    )
                ),

                React.createElement('div', { className: 'stat-card' },
                    React.createElement('div', { className: 'stat-icon', style: { background: '#e8f5e9' } },
                        React.createElement('i', { className: 'fas fa-user-check', style: { color: '#4caf50' } })
                    ),
                    React.createElement('div', { className: 'stat-info' },
                        React.createElement('h3', null, stats.activeUsers),
                        React.createElement('p', null, 'Active Users')
                    )
                ),

                React.createElement('div', { className: 'stat-card' },
                    React.createElement('div', { className: 'stat-icon', style: { background: '#fff3e0' } },
                        React.createElement('i', { className: 'fas fa-box', style: { color: '#ff9800' } })
                    ),
                    React.createElement('div', { className: 'stat-info' },
                        React.createElement('h3', null, stats.totalProducts),
                        React.createElement('p', null, 'Total Listings')
                    )
                ),

                React.createElement('div', { className: 'stat-card' },
                    React.createElement('div', { className: 'stat-icon', style: { background: '#f1f8e9' } },
                        React.createElement('i', { className: 'fas fa-dollar-sign', style: { color: '#8bc34a' } })
                    ),
                    React.createElement('div', { className: 'stat-info' },
                        React.createElement('h3', null, `$${stats.totalRevenue.toFixed(2)}`),
                        React.createElement('p', null, 'Total Platform Value')
                    )
                )
            ),

            React.createElement('div', { className: 'recent-activity-section' },
                React.createElement('h3', null, 'Recent Users'),
                React.createElement('div', { className: 'user-list-compact' },
                    users.slice(0, 5).map(user =>
                        React.createElement('div', { key: user.id, className: 'user-item-compact' },
                            React.createElement('div', { className: 'user-avatar' },
                                React.createElement('i', { className: 'fas fa-user-circle' })
                            ),
                            React.createElement('div', { className: 'user-info' },
                                React.createElement('h4', null, user.name),
                                React.createElement('p', null, user.email)
                            ),
                            React.createElement('span', { 
                                className: `status-badge ${user.status}` 
                            }, user.status)
                        )
                    )
                )
            )
        );
    };

    const renderUsersTab = () => {
        const filteredUsers = filterUsers();

        return React.createElement('div', { className: 'admin-users' },
            React.createElement('div', { className: 'users-header' },
                React.createElement('h3', null, 'User Management'),
                React.createElement('div', { className: 'users-controls' },
                    React.createElement('input', {
                        type: 'text',
                        className: 'search-input',
                        placeholder: 'Search users...',
                        value: searchTerm,
                        onChange: (e) => setSearchTerm(e.target.value)
                    }),
                    React.createElement('select', {
                        className: 'filter-select',
                        value: filterStatus,
                        onChange: (e) => setFilterStatus(e.target.value)
                    },
                        React.createElement('option', { value: 'all' }, 'All Status'),
                        React.createElement('option', { value: 'active' }, 'Active'),
                        React.createElement('option', { value: 'suspended' }, 'Suspended')
                    )
                )
            ),

            React.createElement('div', { className: 'users-table' },
                React.createElement('table', null,
                    React.createElement('thead', null,
                        React.createElement('tr', null,
                            React.createElement('th', null, 'User'),
                            React.createElement('th', null, 'Email'),
                            React.createElement('th', null, 'Role'),
                            React.createElement('th', null, 'Joined'),
                            React.createElement('th', null, 'Activity'),
                            React.createElement('th', null, 'Status'),
                            React.createElement('th', null, 'Actions')
                        )
                    ),
                    React.createElement('tbody', null,
                        filteredUsers.map(user =>
                            React.createElement('tr', { key: user.id },
                                React.createElement('td', null,
                                    React.createElement('div', { className: 'user-cell' },
                                        React.createElement('i', { className: 'fas fa-user-circle' }),
                                        React.createElement('span', null, user.name)
                                    )
                                ),
                                React.createElement('td', null, user.email),
                                React.createElement('td', null,
                                    React.createElement('span', { className: `role-badge ${user.role}` }, 
                                        user.role
                                    )
                                ),
                                React.createElement('td', null, formatDate(user.createdAt)),
                                React.createElement('td', null,
                                    React.createElement('div', { className: 'activity-summary' },
                                        React.createElement('span', { title: 'Sales' },
                                            React.createElement('i', { className: 'fas fa-tag' }),
                                            user.activitySummary.totalSales
                                        ),
                                        React.createElement('span', { title: 'Purchases' },
                                            React.createElement('i', { className: 'fas fa-shopping-bag' }),
                                            user.activitySummary.totalPurchases
                                        ),
                                        React.createElement('span', { title: 'Views' },
                                            React.createElement('i', { className: 'fas fa-eye' }),
                                            user.activitySummary.totalViews
                                        )
                                    )
                                ),
                                React.createElement('td', null,
                                    React.createElement('span', { 
                                        className: `status-badge ${user.status}` 
                                    }, user.status)
                                ),
                                React.createElement('td', null,
                                    React.createElement('div', { className: 'action-buttons' },
                                        user.status === 'active' ? (
                                            React.createElement('button', {
                                                className: 'btn btn-sm btn-warning',
                                                onClick: () => handleSuspendUser(user.id),
                                                title: 'Suspend User'
                                            },
                                                React.createElement('i', { className: 'fas fa-ban' })
                                            )
                                        ) : (
                                            React.createElement('button', {
                                                className: 'btn btn-sm btn-success',
                                                onClick: () => handleActivateUser(user.id),
                                                title: 'Activate User'
                                            },
                                                React.createElement('i', { className: 'fas fa-check' })
                                            )
                                        ),
                                        React.createElement('button', {
                                            className: 'btn btn-sm btn-info',
                                            title: 'View Details'
                                        },
                                            React.createElement('i', { className: 'fas fa-info-circle' })
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            ),

            filteredUsers.length === 0 && React.createElement('div', { className: 'empty-state' },
                React.createElement('i', { className: 'fas fa-users' }),
                React.createElement('p', null, 'No users found')
            )
        );
    };

    const renderProductsTab = () => {
        return React.createElement('div', { className: 'admin-products' },
            React.createElement('div', { className: 'products-header' },
                React.createElement('h3', null, 'Product Management'),
                React.createElement('p', null, `Total: ${products.length} listings`)
            ),

            React.createElement('div', { className: 'products-grid' },
                products.map(product =>
                    React.createElement('div', { key: product.id, className: 'admin-product-card' },
                        React.createElement('img', {
                            src: product.image || 'https://via.placeholder.com/200',
                            alt: product.title
                        }),
                        React.createElement('div', { className: 'product-info' },
                            React.createElement('h4', null, product.title),
                            React.createElement('p', { className: 'product-price' }, `$${product.price}`),
                            React.createElement('p', { className: 'product-seller' }, 
                                `Seller: ${product.sellerName || 'Unknown'}`
                            ),
                            React.createElement('div', { className: 'product-meta' },
                                React.createElement('span', null, product.category),
                                React.createElement('span', null, formatDate(product.createdAt || new Date()))
                            )
                        ),
                        React.createElement('div', { className: 'product-actions' },
                            React.createElement('button', {
                                className: 'btn btn-sm btn-danger icon-btn danger',
                                title: 'Delete listing',
                                'aria-label': 'Delete listing',
                                onClick: () => handleDeleteProduct(product.id)
                            },
                                React.createElement('i', { className: 'fa-solid fa-trash' })
                            )
                        )
                    )
                )
            ),

            products.length === 0 && React.createElement('div', { className: 'empty-state' },
                React.createElement('i', { className: 'fas fa-box-open' }),
                React.createElement('p', null, 'No products listed yet')
            )
        );
    };

    if (!currentUser || !window.DormGlideAuth.isAdmin(currentUser)) {
        return React.createElement('div', { className: 'admin-dashboard' },
            React.createElement('div', { className: 'unauthorized' },
                React.createElement('i', { className: 'fas fa-lock' }),
                React.createElement('h2', null, 'Access Denied'),
                React.createElement('p', null, 'You do not have permission to access this page'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => onNavigate('home')
                }, 'Go to Home')
            )
        );
    }

    return React.createElement('div', { className: 'admin-dashboard' },
        React.createElement('div', { className: 'admin-header' },
            React.createElement('h1', null, 
                React.createElement('i', { className: 'fas fa-shield-alt' }),
                'Admin Dashboard'
            ),
            React.createElement('p', null, 'Manage users, products, and platform settings')
        ),

        React.createElement('div', { className: 'admin-tabs' },
            React.createElement('button', {
                className: `tab ${activeTab === 'overview' ? 'active' : ''}`,
                onClick: () => setActiveTab('overview')
            },
                React.createElement('i', { className: 'fas fa-chart-line' }),
                'Overview'
            ),
            React.createElement('button', {
                className: `tab ${activeTab === 'users' ? 'active' : ''}`,
                onClick: () => setActiveTab('users')
            },
                React.createElement('i', { className: 'fas fa-users' }),
                'Users'
            ),
            React.createElement('button', {
                className: `tab ${activeTab === 'products' ? 'active' : ''}`,
                onClick: () => setActiveTab('products')
            },
                React.createElement('i', { className: 'fas fa-box' }),
                'Products'
            )
        ),

        React.createElement('div', { className: 'admin-content' },
            activeTab === 'overview' && renderOverviewTab(),
            activeTab === 'users' && renderUsersTab(),
            activeTab === 'products' && renderProductsTab()
        )
    );
};
