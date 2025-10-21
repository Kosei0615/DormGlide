// Sample data for DormGlide marketplace

const getSampleProducts = () => {
    const products = [
        {
            id: '1',
            title: 'MacBook Air M1 13-inch',
            description: 'Barely used MacBook Air with M1 chip. Perfect for students! Comes with original charger and box. No scratches or dents. Selling because I upgraded to a desktop setup.',
            price: 850,
            category: 'Electronics',
            condition: 'Like New',
            location: 'North Campus',
            image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=400&fit=crop',
                'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=600&h=400&fit=crop'
            ],
            sellerId: 'user1',
            sellerName: 'Sarah Chen',
            sellerEmail: 'sarah.chen@university.edu',
            createdAt: '2025-01-15T10:30:00Z',
            views: 45
        },
        {
            id: '2',
            title: 'Calculus Textbook (Stewart 8th Edition)',
            description: 'Essential Calculus textbook for Math 151/152. All pages intact, minimal highlighting. Saved me $200 when I bought it used, hoping to help another student!',
            price: 120,
            category: 'Textbooks',
            condition: 'Good',
            location: 'South Campus',
            image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=300&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=400&fit=crop'
            ],
            sellerId: 'user2',
            sellerName: 'Mike Rodriguez',
            sellerEmail: 'mike.r@university.edu',
            createdAt: '2025-01-14T15:45:00Z',
            views: 23
        },
        {
            id: '3',
            title: 'IKEA Study Desk with Drawer',
            description: 'White IKEA desk perfect for dorm room or apartment. Has one drawer for storage. Easy to assemble/disassemble. Moving out and can\'t take it with me.',
            price: 60,
            category: 'Furniture',
            condition: 'Good',
            location: 'East Campus',
            image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=400&fit=crop',
                'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&h=400&fit=crop'
            ],
            sellerId: 'user3',
            sellerName: 'Emily Johnson',
            sellerEmail: 'emily.j@university.edu',
            createdAt: '2025-01-13T09:20:00Z',
            views: 67
        },
        {
            id: '4',
            title: 'Nintendo Switch with Games',
            description: 'Nintendo Switch console with Super Mario Odyssey and The Legend of Zelda: Breath of the Wild. Perfect condition, barely used due to studies. Includes all original accessories.',
            price: 280,
            category: 'Electronics',
            condition: 'Like New',
            location: 'West Campus',
            image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400&h=300&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=600&h=400&fit=crop'
            ],
            sellerId: 'user4',
            sellerName: 'Alex Kim',
            sellerEmail: 'alex.kim@university.edu',
            createdAt: '2025-01-12T18:30:00Z',
            views: 89
        },
        {
            id: '5',
            title: 'Winter Jacket - North Face',
            description: 'Warm winter jacket from North Face, size Medium. Great for cold campus walks! Only worn for one semester. Clean and smoke-free.',
            price: 45,
            category: 'Clothing',
            condition: 'Good',
            location: 'North Campus',
            image: 'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=400&h=300&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=600&h=400&fit=crop'
            ],
            sellerId: 'user5',
            sellerName: 'Jessica Park',
            sellerEmail: 'jessica.park@university.edu',
            createdAt: '2025-01-11T14:15:00Z',
            views: 34
        },
        {
            id: '6',
            title: 'Coffee Maker - Keurig K-Classic',
            description: 'Single-serve coffee maker perfect for dorm life. Makes great coffee quickly between classes. Includes some K-cups to get you started!',
            price: 35,
            category: 'Kitchen',
            condition: 'Good',
            location: 'South Campus',
            image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=300&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&h=400&fit=crop'
            ],
            sellerId: 'user6',
            sellerName: 'David Wilson',
            sellerEmail: 'david.w@university.edu',
            createdAt: '2025-01-10T11:45:00Z',
            views: 56
        },
        {
            id: '7',
            title: 'Basketball (Official Size)',
            description: 'Official size basketball, barely used. Great for pickup games at the campus courts. Good grip and bounce.',
            price: 15,
            category: 'Sports',
            condition: 'Like New',
            location: 'East Campus',
            image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=300&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&h=400&fit=crop'
            ],
            sellerId: 'user7',
            sellerName: 'Marcus Thompson',
            sellerEmail: 'marcus.t@university.edu',
            createdAt: '2025-01-09T16:20:00Z',
            views: 28
        },
        {
            id: '8',
            title: 'String Lights for Dorm',
            description: 'Warm white LED string lights to make your dorm cozy. 20 feet long, perfect for decorating your room. Battery operated, very energy efficient.',
            price: 12,
            category: 'Dorm Decor',
            condition: 'New',
            location: 'West Campus',
            image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&h=400&fit=crop'
            ],
            sellerId: 'user8',
            sellerName: 'Lisa Wang',
            sellerEmail: 'lisa.wang@university.edu',
            createdAt: '2025-01-08T13:10:00Z',
            views: 42
        },
        {
            id: '9',
            title: 'Organic Chemistry Textbook Bundle',
            description: 'Organic Chemistry textbook with solutions manual and molecular model kit. Everything you need for Orgo 1 & 2. Some highlighting but all in good condition.',
            price: 180,
            category: 'Textbooks',
            condition: 'Good',
            location: 'North Campus',
            image: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&h=300&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600&h=400&fit=crop'
            ],
            sellerId: 'user9',
            sellerName: 'Rachel Green',
            sellerEmail: 'rachel.green@university.edu',
            createdAt: '2025-01-07T10:30:00Z',
            views: 71
        },
        {
            id: '10',
            title: 'Mini Fridge - 3.2 Cu Ft',
            description: 'Perfect size mini fridge for dorm room. Keeps drinks cold and has a small freezer compartment. Energy efficient and quiet operation.',
            price: 85,
            category: 'Kitchen',
            condition: 'Good',
            location: 'South Campus',
            image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop'
            ],
            sellerId: 'user10',
            sellerName: 'Tom Anderson',
            sellerEmail: 'tom.anderson@university.edu',
            createdAt: '2025-01-06T15:45:00Z',
            views: 63
        },
        {
            id: '11',
            title: 'Wireless Bluetooth Headphones',
            description: 'Sony WH-CH720N wireless headphones with noise canceling. Great for studying in noisy environments. Battery lasts all day. Includes carrying case.',
            price: 90,
            category: 'Electronics',
            condition: 'Like New',
            location: 'East Campus',
            image: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&h=300&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600&h=400&fit=crop'
            ],
            sellerId: 'user11',
            sellerName: 'Hannah Lee',
            sellerEmail: 'hannah.lee@university.edu',
            createdAt: '2025-01-05T12:20:00Z',
            views: 38
        },
        {
            id: '12',
            title: 'Wooden Bookshelf (5-tier)',
            description: 'Tall wooden bookshelf perfect for textbooks and decorations. Sturdy construction, easy to assemble. Great for organizing your room.',
            price: 70,
            category: 'Furniture',
            condition: 'Good',
            location: 'West Campus',
            image: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=300&fit=crop',
            images: [
                'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=600&h=400&fit=crop'
            ],
            sellerId: 'user12',
            sellerName: 'Kevin Zhang',
            sellerEmail: 'kevin.zhang@university.edu',
            createdAt: '2025-01-04T09:15:00Z',
            views: 52
        }
    ];

    return products.map((product) => ({
        ...product,
        isDemo: true,
        sellerCampus: product.sellerCampus || product.location || ''
    }));
};

// Sample user data for demo
const getSampleUsers = () => {
    return [
        {
            id: 'user1',
            name: 'Sarah Chen',
            email: 'sarah.chen@university.edu',
            phone: '(555) 123-4567',
            university: 'State University',
            major: 'Computer Science',
            graduationYear: '2026',
            bio: 'CS major who loves tech and helping fellow students save money on electronics.',
            joinedAt: '2024-09-01T00:00:00Z'
        },
        {
            id: 'user2',
            name: 'Mike Rodriguez',
            email: 'mike.r@university.edu',
            phone: '(555) 234-5678',
            university: 'State University',
            major: 'Mathematics',
            graduationYear: '2025',
            bio: 'Math major selling textbooks to help other students succeed.',
            joinedAt: '2024-08-15T00:00:00Z'
        }
    ];
};

// Categories with icons for quick access
const getCategories = () => {
    return [
        { name: 'Electronics', icon: 'fas fa-laptop', color: '#007bff' },
        { name: 'Textbooks', icon: 'fas fa-book', color: '#28a745' },
        { name: 'Furniture', icon: 'fas fa-couch', color: '#dc3545' },
        { name: 'Clothing', icon: 'fas fa-tshirt', color: '#fd7e14' },
        { name: 'Sports', icon: 'fas fa-football-ball', color: '#20c997' },
        { name: 'Kitchen', icon: 'fas fa-utensils', color: '#6f42c1' },
        { name: 'Dorm Decor', icon: 'fas fa-palette', color: '#e83e8c' },
        { name: 'Other', icon: 'fas fa-box', color: '#6c757d' }
    ];
};

// Safety tips for students
const getSafetyTips = () => {
    return [
        {
            title: 'Meet in Public Places',
            description: 'Always meet in well-lit, public areas on campus like the student center or library.',
            icon: 'fas fa-users'
        },
        {
            title: 'Bring a Friend',
            description: 'Consider bringing a friend when meeting someone to buy or sell items.',
            icon: 'fas fa-user-friends'
        },
        {
            title: 'Trust Your Instincts',
            description: 'If something feels wrong, trust your gut and don\'t proceed with the transaction.',
            icon: 'fas fa-exclamation-triangle'
        },
        {
            title: 'Use Secure Payment',
            description: 'Use secure payment methods like Venmo, PayPal, or cash. Avoid wire transfers.',
            icon: 'fas fa-credit-card'
        },
        {
            title: 'Verify Identity',
            description: 'Make sure the seller is actually a student at your university when possible.',
            icon: 'fas fa-id-card'
        }
    ];
};

// Popular search terms
const getPopularSearches = () => {
    return [
        'MacBook',
        'Textbooks',
        'Desk',
        'Chair',
        'Mini fridge',
        'Coffee maker',
        'Winter jacket',
        'Electronics',
        'Furniture',
        'Calculator'
    ];
};

// Demo notification messages
const getSampleNotifications = () => {
    return [
        {
            id: '1',
            type: 'message',
            title: 'New message about MacBook Air',
            message: 'Sarah Chen sent you a message about your MacBook Air listing.',
            timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
            read: false
        },
        {
            id: '2',
            type: 'sale',
            title: 'Item sold!',
            message: 'Your Calculus textbook has been sold to Mike Rodriguez.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
            read: false
        },
        {
            id: '3',
            type: 'price_drop',
            title: 'Price drop alert',
            message: 'Nintendo Switch in Electronics is now $280 (was $320).',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
            read: true
        }
    ];
};

// Initialize data helper function - PRODUCTION VERSION
const initializeSampleData = () => {
    console.log('Initializing DormGlide for DEMO...');
    const existing = localStorage.getItem('dormglide_products');
    let hasExistingProducts = false;

    if (existing) {
        try {
            const parsed = JSON.parse(existing);
            hasExistingProducts = Array.isArray(parsed) && parsed.length > 0;
        } catch (error) {
            console.warn('DormGlide demo init: Unable to parse existing products, re-seeding sample data.', error);
        }
    }

    if (hasExistingProducts) {
        console.log('Demo mode: Existing products detected, preserving current listings.');
    } else {
        const products = getSampleProducts();
        localStorage.setItem('dormglide_products', JSON.stringify(products));
        console.log(`Demo mode: Initialized ${products.length} sample products`);
    }

    localStorage.setItem('dormglide_demo_mode', 'true');
    console.log('DormGlide initialization complete!');
};

// Function to toggle demo mode (for testing purposes)
const toggleDemoMode = () => {
    const currentMode = localStorage.getItem('dormglide_demo_mode') === 'true';
    localStorage.setItem('dormglide_demo_mode', (!currentMode).toString());
    
    if (!currentMode) {
        // Switching to demo mode - load sample data
        const products = getSampleProducts();
        localStorage.setItem('dormglide_products', JSON.stringify(products));
        console.log('Demo mode enabled - sample products loaded');
    } else {
        // Switching to production mode - clear fake data
        localStorage.setItem('dormglide_products', JSON.stringify([]));
        console.log('Production mode enabled - sample products cleared');
    }
    
    // Reload page to reflect changes
    window.location.reload();
};

// Function to clear all demo data for production launch
const prepareForProduction = () => {
    localStorage.setItem('dormglide_demo_mode', 'false');
    localStorage.setItem('dormglide_products', JSON.stringify([]));
    localStorage.removeItem('dormglide_current_user');
    localStorage.removeItem('dormglide_preferences');
    console.log('App prepared for production - all demo data cleared');
    window.location.reload();
};

// Export for global access
window.getSampleProducts = getSampleProducts;
window.getSampleUsers = getSampleUsers;
window.getCategories = getCategories;
window.getSafetyTips = getSafetyTips;
window.getPopularSearches = getPopularSearches;
window.getSampleNotifications = getSampleNotifications;
window.initializeSampleData = initializeSampleData;
window.toggleDemoMode = toggleDemoMode;
window.prepareForProduction = prepareForProduction;
