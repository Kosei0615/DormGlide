const ProductDetailPage = ({ product, onNavigate, currentUser }) => {
    const [isImageModalOpen, setIsImageModalOpen] = React.useState(false);
    const [currentImageIndex, setCurrentImageIndex] = React.useState(0);

    if (!product) {
        return React.createElement('div', { className: 'product-detail-page' },
            React.createElement('div', { className: 'error-state' },
                React.createElement('i', { className: 'fas fa-exclamation-triangle' }),
                React.createElement('h2', null, 'Product not found'),
                React.createElement('p', null, 'The product you\'re looking for doesn\'t exist or has been removed.'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => onNavigate('home')
                }, 'Back to Browse')
            )
        );
    }

    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price);
    };

    const timeAgo = (date) => {
        const now = new Date();
        const diff = now - new Date(date);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'Today';
        if (days === 1) return '1 day ago';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return `${Math.floor(days / 30)} months ago`;
    };

    const handleContactSeller = () => {
        if (!currentUser) {
            alert('Please set up your profile first to contact sellers!');
            onNavigate('profile');
            return;
        }
        alert(`Contact feature would connect you with ${product.sellerName}. In a real app, this would open a messaging system or provide contact details.`);
    };

    const handleBuyNow = () => {
        if (!currentUser) {
            alert('Please set up your profile first to make purchases!');
            onNavigate('profile');
            return;
        }
        alert(`Purchase feature would initiate buying process for "${product.title}". In a real app, this would handle payment and delivery.`);
    };

    const images = product.images && product.images.length > 0 ? product.images : [product.image || 'https://via.placeholder.com/600x400?text=No+Image'];

    return React.createElement('div', { className: 'product-detail-page' },
        React.createElement('div', { className: 'product-detail-container' },
            // Back button
            React.createElement('button', {
                className: 'back-btn',
                onClick: () => onNavigate('home')
            },
                React.createElement('i', { className: 'fas fa-arrow-left' }),
                'Back to Browse'
            ),

            React.createElement('div', { className: 'product-detail-content' },
                // Product Images
                React.createElement('div', { className: 'product-images' },
                    React.createElement('div', { className: 'main-image' },
                        React.createElement('img', {
                            src: images[currentImageIndex],
                            alt: product.title,
                            onClick: () => setIsImageModalOpen(true)
                        }),
                        images.length > 1 && React.createElement('div', { className: 'image-nav' },
                            React.createElement('button', {
                                onClick: () => setCurrentImageIndex(Math.max(0, currentImageIndex - 1)),
                                disabled: currentImageIndex === 0
                            },
                                React.createElement('i', { className: 'fas fa-chevron-left' })
                            ),
                            React.createElement('span', null, `${currentImageIndex + 1} / ${images.length}`),
                            React.createElement('button', {
                                onClick: () => setCurrentImageIndex(Math.min(images.length - 1, currentImageIndex + 1)),
                                disabled: currentImageIndex === images.length - 1
                            },
                                React.createElement('i', { className: 'fas fa-chevron-right' })
                            )
                        )
                    ),
                    images.length > 1 && React.createElement('div', { className: 'thumbnail-strip' },
                        images.map((image, index) =>
                            React.createElement('img', {
                                key: index,
                                src: image,
                                alt: `${product.title} ${index + 1}`,
                                className: index === currentImageIndex ? 'active' : '',
                                onClick: () => setCurrentImageIndex(index)
                            })
                        )
                    )
                ),

                // Product Info
                React.createElement('div', { className: 'product-info-detail' },
                    React.createElement('div', { className: 'product-header' },
                        React.createElement('h1', null, product.title),
                        React.createElement('div', { className: 'product-price-large' }, formatPrice(product.price)),
                        React.createElement('div', { className: 'product-badges' },
                            React.createElement('span', {
                                className: `condition-badge condition-${product.condition.toLowerCase()}`
                            }, product.condition),
                            React.createElement('span', { className: 'category-badge' },
                                React.createElement('i', { className: 'fas fa-tag' }),
                                product.category
                            )
                        )
                    ),

                    React.createElement('div', { className: 'product-description' },
                        React.createElement('h3', null, 'Description'),
                        React.createElement('p', null, product.description)
                    ),

                    React.createElement('div', { className: 'product-details' },
                        React.createElement('h3', null, 'Details'),
                        React.createElement('div', { className: 'detail-grid' },
                            React.createElement('div', { className: 'detail-item' },
                                React.createElement('i', { className: 'fas fa-map-marker-alt' }),
                                React.createElement('span', null, 'Location: ', product.location)
                            ),
                            React.createElement('div', { className: 'detail-item' },
                                React.createElement('i', { className: 'fas fa-clock' }),
                                React.createElement('span', null, 'Posted: ', timeAgo(product.createdAt))
                            ),
                            React.createElement('div', { className: 'detail-item' },
                                React.createElement('i', { className: 'fas fa-eye' }),
                                React.createElement('span', null, 'Views: ', product.views || 0)
                            )
                        )
                    ),

                    // Seller Info
                    React.createElement('div', { className: 'seller-info' },
                        React.createElement('h3', null, 'Seller Information'),
                        React.createElement('div', { className: 'seller-card' },
                            React.createElement('div', { className: 'seller-avatar' },
                                React.createElement('i', { className: 'fas fa-user-circle' })
                            ),
                            React.createElement('div', { className: 'seller-details' },
                                React.createElement('h4', null, product.sellerName),
                                React.createElement('p', null, product.sellerEmail || 'Student at University'),
                                React.createElement('div', { className: 'seller-rating' },
                                    React.createElement('i', { className: 'fas fa-star' }),
                                    React.createElement('span', null, '4.8 (23 reviews)')
                                )
                            )
                        )
                    ),

                    // Action Buttons
                    React.createElement('div', { className: 'product-actions' },
                        React.createElement('button', {
                            className: 'btn btn-primary btn-large',
                            onClick: handleBuyNow
                        },
                            React.createElement('i', { className: 'fas fa-shopping-cart' }),
                            'Buy Now'
                        ),
                        React.createElement('button', {
                            className: 'btn btn-secondary btn-large',
                            onClick: handleContactSeller
                        },
                            React.createElement('i', { className: 'fas fa-comment' }),
                            'Contact Seller'
                        ),
                        React.createElement('button', {
                            className: 'btn btn-outline',
                            onClick: () => alert('Wishlist feature coming soon!')
                        },
                            React.createElement('i', { className: 'fas fa-heart' }),
                            'Save'
                        )
                    )
                )
            )
        ),

        // Image Modal
        isImageModalOpen && React.createElement('div', {
            className: 'image-modal',
            onClick: () => setIsImageModalOpen(false)
        },
            React.createElement('div', { className: 'image-modal-content' },
                React.createElement('button', {
                    className: 'close-modal',
                    onClick: () => setIsImageModalOpen(false)
                },
                    React.createElement('i', { className: 'fas fa-times' })
                ),
                React.createElement('img', {
                    src: images[currentImageIndex],
                    alt: product.title
                })
            )
        )
    );
};
