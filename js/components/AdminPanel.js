const AdminPanel = ({ onClose }) => {
    const [isDemoMode, setIsDemoMode] = React.useState(
        localStorage.getItem('dormglide_demo_mode') === 'true'
    );
    const [productCount, setProductCount] = React.useState(0);

    React.useEffect(() => {
        const products = JSON.parse(localStorage.getItem('dormglide_products') || '[]');
        setProductCount(products.length);
    }, []);

    const handleToggleDemoMode = () => {
        toggleDemoMode();
        setIsDemoMode(!isDemoMode);
    };

    const handlePrepareForProduction = () => {
        if (confirm('This will remove all demo data and prepare the app for real college students. Are you sure?')) {
            prepareForProduction();
        }
    };

    const handleExportData = () => {
        const data = {
            products: JSON.parse(localStorage.getItem('dormglide_products') || '[]'),
            users: localStorage.getItem('dormglide_current_user'),
            preferences: JSON.parse(localStorage.getItem('dormglide_preferences') || '{}')
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dormglide-data-backup.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    return React.createElement('div', { className: 'admin-modal' },
        React.createElement('div', { className: 'admin-content' },
            React.createElement('div', { className: 'admin-header' },
                React.createElement('h2', null, 'DormGlide Admin Panel'),
                React.createElement('button', {
                    className: 'close-admin',
                    onClick: onClose
                }, '×')
            ),

            React.createElement('div', { className: 'admin-section' },
                React.createElement('h3', null, 'Current Status'),
                React.createElement('div', { className: 'status-grid' },
                    React.createElement('div', { className: 'status-item' },
                        React.createElement('span', { className: 'status-label' }, 'Mode:'),
                        React.createElement('span', { 
                            className: `status-value ${isDemoMode ? 'demo' : 'production'}`
                        }, isDemoMode ? 'Demo Mode' : 'Production Mode')
                    ),
                    React.createElement('div', { className: 'status-item' },
                        React.createElement('span', { className: 'status-label' }, 'Products:'),
                        React.createElement('span', { className: 'status-value' }, productCount)
                    )
                )
            ),

            React.createElement('div', { className: 'admin-section' },
                React.createElement('h3', null, 'Mode Control'),
                React.createElement('p', null, 'Demo mode shows fake products for testing. Production mode starts with an empty marketplace for real students.'),
                React.createElement('button', {
                    className: `btn ${isDemoMode ? 'btn-secondary' : 'btn-primary'}`,
                    onClick: handleToggleDemoMode
                },
                    isDemoMode ? 'Switch to Production Mode' : 'Switch to Demo Mode'
                )
            ),

            React.createElement('div', { className: 'admin-section' },
                React.createElement('h3', null, 'Production Launch'),
                React.createElement('p', null, 'Prepare the app for real college students by clearing all demo data.'),
                React.createElement('button', {
                    className: 'btn btn-danger',
                    onClick: handlePrepareForProduction
                }, 'Prepare for Production Launch')
            ),

            React.createElement('div', { className: 'admin-section' },
                React.createElement('h3', null, 'Data Management'),
                React.createElement('p', null, 'Export current data for backup or analysis.'),
                React.createElement('button', {
                    className: 'btn btn-outline',
                    onClick: handleExportData
                }, 'Export Data')
            ),

            React.createElement('div', { className: 'admin-tips' },
                React.createElement('h4', null, 'Launch Checklist for College:'),
                React.createElement('ul', null,
                    React.createElement('li', null, '✓ Switch to Production Mode'),
                    React.createElement('li', null, '✓ Test all features on mobile devices'),
                    React.createElement('li', null, '✓ Customize university name and locations'),
                    React.createElement('li', null, '✓ Set up student email verification'),
                    React.createElement('li', null, '✓ Add campus safety guidelines'),
                    React.createElement('li', null, '✓ Create social media accounts'),
                    React.createElement('li', null, '✓ Plan student ambassador program')
                )
            )
        )
    );
};
