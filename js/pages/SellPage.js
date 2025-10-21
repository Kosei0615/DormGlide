const SellPage = ({ onNavigate, onProductAdd, currentUser, onShowAuth }) => {
    const preferredContact = currentUser?.phone || currentUser?.email || '';
    const preferredLocation = currentUser?.campusLocation || currentUser?.university || '';
    const [formData, setFormData] = React.useState({
        title: '',
        description: '',
        price: '',
        category: '',
        condition: '',
        location: preferredLocation,
        contactInfo: preferredContact,
        images: []
    });
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const categories = [
        'Electronics', 'Textbooks', 'Furniture', 'Clothing', 'Sports', 
        'Kitchen', 'Dorm Decor', 'Other'
    ];

    const conditions = ['New', 'Like New', 'Good', 'Fair'];

    React.useEffect(() => {
        if (currentUser) {
            setFormData(prev => ({
                ...prev,
                contactInfo: prev.contactInfo || currentUser.phone || currentUser.email || '',
                location: prev.location || currentUser.campusLocation || currentUser.university || ''
            }));
        }
    }, [currentUser]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        
        if (files.length + formData.images.length > 5) {
            alert('You can upload maximum 5 images');
            return;
        }
        
        // Convert images to base64 for demo (in production, upload to server)
        const promises = files.map(file => {
            return new Promise((resolve, reject) => {
                if (!file.type.startsWith('image/')) {
                    reject('Only image files are allowed');
                    return;
                }
                
                if (file.size > 5 * 1024 * 1024) { // 5MB limit
                    reject('Image size should be less than 5MB');
                    return;
                }
                
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });
        
        Promise.all(promises)
            .then(imageUrls => {
                setFormData(prev => ({
                    ...prev,
                    images: [...prev.images, ...imageUrls].slice(0, 5)
                }));
            })
            .catch(error => {
                alert(error);
            });
    };

    const removeImage = (index) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!currentUser) {
            alert('Please login or create an account first!');
            if (onShowAuth) {
                onShowAuth();
            } else {
                onNavigate('profile');
            }
            return;
        }

        setIsSubmitting(true);

        // Validate form
        if (!formData.title || !formData.description || !formData.price || !formData.category || !formData.condition) {
            alert('Please fill in all required fields.');
            setIsSubmitting(false);
            return;
        }

        if (!formData.contactInfo || !formData.contactInfo.trim()) {
            alert('Please provide contact information so buyers can reach you.');
            setIsSubmitting(false);
            return;
        }

        const newProduct = {
            id: Date.now().toString(),
            title: formData.title,
            description: formData.description,
            price: parseFloat(formData.price),
            category: formData.category,
            condition: formData.condition,
            location: formData.location || 'Campus',
            contactInfo: formData.contactInfo.trim(),
            images: formData.images,
            image: formData.images[0] || 'https://via.placeholder.com/300x200?text=No+Image',
            sellerId: currentUser.id,
            sellerName: currentUser.name,
            sellerEmail: currentUser.email,
            sellerCampus: currentUser.campusLocation || currentUser.university || formData.location || '',
            isDemo: false,
            createdAt: new Date().toISOString(),
            views: 0
        };

        try {
            const persisted = await onProductAdd(newProduct);
            alert('Your item has been listed successfully!');
            setFormData({
                title: '',
                description: '',
                price: '',
                category: '',
                condition: '',
                location: currentUser.campusLocation || currentUser.university || '',
                contactInfo: currentUser.phone || currentUser.email || '',
                images: []
            });
            onNavigate('home', persisted?.id);
        } catch (error) {
            console.error('Failed to save product:', error);
            alert('Something went wrong while listing your item. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!currentUser) {
        return React.createElement('div', { className: 'sell-page' },
            React.createElement('div', { className: 'auth-required' },
                React.createElement('i', { className: 'fas fa-user-plus' }),
                React.createElement('h2', null, 'Login Required'),
                React.createElement('p', null, 'Please login or create an account before selling items.'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: onShowAuth || (() => onNavigate('profile'))
                }, 'Login / Sign Up')
            )
        );
    }

    return React.createElement('div', { className: 'sell-page' },
        React.createElement('div', { className: 'sell-container' },
            React.createElement('div', { className: 'page-header' },
                React.createElement('h1', null, 'Sell Your Item'),
                React.createElement('p', null, 'List your item and reach hundreds of students on campus')
            ),

            React.createElement('form', { className: 'sell-form', onSubmit: handleSubmit },
                // Images Section
                React.createElement('div', { className: 'form-section' },
                    React.createElement('h3', null, 'Photos'),
                    React.createElement('p', { className: 'section-description' }, 
                        'Add up to 5 photos to show your item (first photo will be the main image)'
                    ),
                    
                    React.createElement('div', { className: 'image-upload-area' },
                        formData.images.length > 0 && React.createElement('div', { className: 'uploaded-images' },
                            formData.images.map((image, index) =>
                                React.createElement('div', { key: index, className: 'uploaded-image' },
                                    React.createElement('img', { src: image, alt: `Upload ${index + 1}` }),
                                    React.createElement('button', {
                                        type: 'button',
                                        className: 'remove-image',
                                        onClick: () => removeImage(index)
                                    },
                                        React.createElement('i', { className: 'fas fa-times' })
                                    ),
                                    index === 0 && React.createElement('span', { className: 'main-image-badge' }, 'Main')
                                )
                            )
                        ),
                        
                        formData.images.length < 5 && React.createElement('label', { className: 'image-upload-btn' },
                            React.createElement('i', { className: 'fas fa-camera' }),
                            React.createElement('span', null, 'Add Photos'),
                            React.createElement('input', {
                                type: 'file',
                                accept: 'image/*',
                                multiple: true,
                                onChange: handleImageUpload,
                                style: { display: 'none' }
                            })
                        )
                    )
                ),

                // Basic Info Section
                React.createElement('div', { className: 'form-section' },
                    React.createElement('h3', null, 'Basic Information'),
                    
                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'Title *'),
                        React.createElement('input', {
                            type: 'text',
                            name: 'title',
                            value: formData.title,
                            onChange: handleInputChange,
                            placeholder: 'What are you selling?',
                            required: true
                        })
                    ),

                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'Description *'),
                        React.createElement('textarea', {
                            name: 'description',
                            value: formData.description,
                            onChange: handleInputChange,
                            placeholder: 'Describe your item, its condition, and any important details...',
                            rows: 4,
                            required: true
                        })
                    ),

                    React.createElement('div', { className: 'form-row' },
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'Price *'),
                            React.createElement('div', { className: 'price-input' },
                                React.createElement('span', { className: 'currency' }, '$'),
                                React.createElement('input', {
                                    type: 'number',
                                    name: 'price',
                                    value: formData.price,
                                    onChange: handleInputChange,
                                    placeholder: '0.00',
                                    min: '0',
                                    step: '0.01',
                                    required: true
                                })
                            )
                        ),

                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'Location'),
                            React.createElement('input', {
                                type: 'text',
                                name: 'location',
                                value: formData.location,
                                onChange: handleInputChange,
                                placeholder: 'e.g., North Campus, Dorm Building A'
                            })
                        )
                    ),

                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'Contact Information *'),
                        React.createElement('input', {
                            type: 'text',
                            name: 'contactInfo',
                            value: formData.contactInfo,
                            onChange: handleInputChange,
                            placeholder: 'Phone, email, LINE, KakaoTalk, etc.',
                            required: true
                        }),
                        React.createElement('small', { className: 'form-hint' }, 'Buyers will see this after they tap “Chat with Seller”.')
                    ),

                    React.createElement('div', { className: 'form-row' },
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'Category *'),
                            React.createElement('select', {
                                name: 'category',
                                value: formData.category,
                                onChange: handleInputChange,
                                required: true
                            },
                                React.createElement('option', { value: '' }, 'Select a category'),
                                categories.map(category =>
                                    React.createElement('option', { key: category, value: category }, category)
                                )
                            )
                        ),

                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'Condition *'),
                            React.createElement('select', {
                                name: 'condition',
                                value: formData.condition,
                                onChange: handleInputChange,
                                required: true
                            },
                                React.createElement('option', { value: '' }, 'Select condition'),
                                conditions.map(condition =>
                                    React.createElement('option', { key: condition, value: condition }, condition)
                                )
                            )
                        )
                    )
                ),

                // Safety Tips
                React.createElement('div', { className: 'safety-tips' },
                    React.createElement('h4', null, 'Safety Tips'),
                    React.createElement('ul', null,
                        React.createElement('li', null, 'Meet in public places on campus'),
                        React.createElement('li', null, 'Bring a friend when meeting buyers'),
                        React.createElement('li', null, 'Use secure payment methods'),
                        React.createElement('li', null, 'Trust your instincts')
                    )
                ),

                // Submit Button
                React.createElement('div', { className: 'form-actions' },
                    React.createElement('button', {
                        type: 'button',
                        className: 'btn btn-secondary',
                        onClick: () => onNavigate('home')
                    }, 'Cancel'),
                    React.createElement('button', {
                        type: 'submit',
                        className: 'btn btn-primary',
                        disabled: isSubmitting
                    },
                        isSubmitting && React.createElement('i', { className: 'fas fa-spinner fa-spin' }),
                        isSubmitting ? 'Listing...' : 'List Item'
                    )
                )
            )
        )
    );
};
