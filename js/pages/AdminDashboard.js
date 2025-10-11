// Admin Dashboard for Managing Users and Platform
const AdminDashboard = ({ onNavigate, currentUser }) => {
    const [users, setUsers] = React.useState([]);
    const [products, setProducts] = React.useState([]);
    const [activeTab, setActiveTab] = React.useState('overview');
    const [searchTerm, setSearchTerm] = React.useState('');
    const [filterStatus, setFilterStatus] = React.useState('all');

    React.useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        if (window.DormGlideAuth && window.DormGlideAuth.isAdmin(currentUser)) {
            const allUsers = window.DormGlideAuth.getAllUsersForAdmin();
            setUsers(allUsers);
            
            if (typeof getProductsFromStorage !== 'undefined') {
                const allProducts = getProductsFromStorage();
                setProducts(allProducts);
            }
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const handleSuspendUser = (userId) => {
        if (confirm('Are you sure you want to suspend this user?')) {
            const result = window.DormGlideAuth.suspendUser(currentUser.id, userId);
            if (result.success) {
                alert('User suspended successfully');
                loadData();
            }
        }
    };

    const handleActivateUser = (userId) => {
        const result = window.DormGlideAuth.activateUser(currentUser.id, userId);
        if (result.success) {
            alert('User activated successfully');
            loadData();
        }
    };

    const handleDeleteProduct = (productId) => {
        if (confirm('Are you sure you want to delete this product?')) {
            deleteProductFromStorage(productId);
            loadData();
            alert('Product deleted successfully');
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
                                className: 'btn btn-sm btn-danger',
                                onClick: () => handleDeleteProduct(product.id)
                            },
                                React.createElement('i', { className: 'fas fa-trash' }),
                                'Delete'
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
