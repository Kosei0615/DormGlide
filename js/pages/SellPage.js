const SellPage = ({ onNavigate, onProductAdd, currentUser, onShowAuth, initialListingType = null }) => {
    const toast = window.DormGlideToast || {
        success: () => {},
        error: () => {},
        warning: () => {},
        info: () => {}
    };

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
        availableFrom: '',
        stripePaymentLink: '',
        // Glyde service fields (used when listingType === 'service')
        serviceCategory: '',
        rate: '',
        rateUnit: 'hour',
        availabilityNote: '',
        locationNote: 'on campus',
        images: [],
        // Remember the seller's last choice across listings (device-local).
        paymentMethods: (() => {
            try {
                const saved = JSON.parse(localStorage.getItem('dormglide_seller_payment_methods') || '[]');
                return Array.isArray(saved) ? saved : [];
            } catch (_error) { return []; }
        })()
    });

    const PAYMENT_METHOD_OPTIONS = ['Venmo', 'Zelle', 'Cash App', 'Cash'];

    // First step: Item (DormGlide) or Service (Glyde). null = show the chooser.
    const [listingType, setListingType] = React.useState(initialListingType || null);
    React.useEffect(() => {
        if (initialListingType) setListingType(initialListingType);
    }, [initialListingType]);
    const isService = listingType === 'service';
    const glyde = window.DormGlideGlyde;

    const togglePaymentMethod = (method) => {
        setFormData((prev) => {
            const current = Array.isArray(prev.paymentMethods) ? prev.paymentMethods : [];
            const next = current.includes(method)
                ? current.filter((entry) => entry !== method)
                : [...current, method];
            try {
                localStorage.setItem('dormglide_seller_payment_methods', JSON.stringify(next));
            } catch (_error) { /* storage unavailable */ }
            return { ...prev, paymentMethods: next };
        });
    };
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

    const MAX_PHOTOS = 6;
    const [isProcessingPhotos, setIsProcessingPhotos] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState('');

    // Photos are compressed on selection (canvas, ~200KB each) and held as
    // { id, blob, preview } entries; array order is display order, first = cover.
    // The actual Storage upload happens at submit time.
    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = ''; // allow re-selecting the same file

        if (files.length === 0) return;
        if (files.length + formData.images.length > MAX_PHOTOS) {
            toast.warning(`You can add up to ${MAX_PHOTOS} photos.`);
            return;
        }
        if (!window.DormGlidePhotos?.compressImage) {
            toast.error('Photo tools failed to load. Please refresh the page.');
            return;
        }

        setIsProcessingPhotos(true);
        try {
            const entries = [];
            for (const file of files) {
                if (!file.type.startsWith('image/')) {
                    toast.warning(`"${file.name}" is not an image and was skipped.`);
                    continue;
                }
                if (file.size > 20 * 1024 * 1024) {
                    toast.warning(`"${file.name}" is over 20MB and was skipped.`);
                    continue;
                }
                const blob = await window.DormGlidePhotos.compressImage(file);
                entries.push({
                    id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    blob,
                    preview: URL.createObjectURL(blob)
                });
            }
            if (entries.length > 0) {
                setFormData(prev => ({
                    ...prev,
                    images: [...prev.images, ...entries].slice(0, MAX_PHOTOS)
                }));
            }
        } catch (error) {
            console.error('[DormGlide] Photo processing failed:', error);
            toast.error('One or more photos could not be processed.');
        } finally {
            setIsProcessingPhotos(false);
        }
    };

    const removeImage = (index) => {
        setFormData(prev => {
            const removed = prev.images[index];
            if (removed?.preview) URL.revokeObjectURL(removed.preview);
            return { ...prev, images: prev.images.filter((_, i) => i !== index) };
        });
    };

    // "Set as cover" moves the photo to the front; array order is display order.
    const makeCover = (index) => {
        setFormData(prev => {
            if (index <= 0 || index >= prev.images.length) return prev;
            const next = [...prev.images];
            const [chosen] = next.splice(index, 1);
            next.unshift(chosen);
            return { ...prev, images: next };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!currentUser) {
            toast.warning('Please log in or create an account first.');
            if (onShowAuth) {
                onShowAuth();
            } else {
                onNavigate('profile');
            }
            return;
        }

        setIsSubmitting(true);

        // Validate form
        const missingGoods = !isService && (!formData.price || !formData.category || !formData.condition);
        const missingService = isService && (!formData.serviceCategory || !formData.rate || Number(formData.rate) <= 0);
        if (!formData.title || !formData.description || missingGoods || missingService) {
            toast.warning('Please fill in all required fields.');
            setIsSubmitting(false);
            return;
        }

        if (formData.availableFrom) {
            const handoff = new Date(`${formData.availableFrom}T00:00:00`);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const maxDate = new Date(today); maxDate.setMonth(maxDate.getMonth() + 6);
            if (Number.isNaN(handoff.getTime()) || handoff <= today) {
                toast.warning('The handoff date must be in the future.');
                setIsSubmitting(false);
                return;
            }
            if (handoff > maxDate) {
                toast.warning('The handoff date can be at most 6 months out.');
                setIsSubmitting(false);
                return;
            }
        }

        if (!formData.contactInfo || !formData.contactInfo.trim()) {
            toast.warning('Please provide contact information so buyers can reach you.');
            setIsSubmitting(false);
            return;
        }

        // Upload compressed photos to Storage first; a listing is only created
        // once every photo made it (no half-broken listings).
        let imageUrls = [];
        if (formData.images.length > 0) {
            try {
                setUploadProgress(`Uploading photos (0/${formData.images.length})...`);
                imageUrls = await window.DormGlidePhotos.uploadListingPhotos({
                    userId: currentUser.id,
                    blobs: formData.images.map((entry) => entry.blob),
                    onProgress: (done, total) => setUploadProgress(`Uploading photos (${done}/${total})...`)
                });
            } catch (error) {
                console.error('[DormGlide] Photo upload failed:', error);
                toast.error(error?.message || 'Photo upload failed. Please try again.');
                setUploadProgress('');
                setIsSubmitting(false);
                return;
            }
            setUploadProgress('');
        }

        const newProduct = {
            id: Date.now().toString(),
            title: formData.title,
            description: formData.description,
            // Services: price mirrors rate (sorting/wishlist caps), category
            // mirrors the service category, condition is n/a.
            price: isService ? parseFloat(formData.rate) : parseFloat(formData.price),
            category: isService ? formData.serviceCategory : formData.category,
            condition: isService ? 'n/a' : formData.condition,
            location: isService
                ? (glyde?.locationLabel(formData.locationNote) || 'On campus')
                : (formData.location || 'Campus'),
            listingType: isService ? 'service' : 'goods',
            serviceCategory: isService ? formData.serviceCategory : null,
            rate: isService ? parseFloat(formData.rate) : null,
            rateUnit: isService ? formData.rateUnit : null,
            availabilityNote: isService ? String(formData.availabilityNote || '').trim() : '',
            locationNote: isService ? formData.locationNote : null,
            contactInfo: formData.contactInfo.trim(),
            availableFrom: formData.availableFrom || null,
            paymentMethods: Array.isArray(formData.paymentMethods) ? formData.paymentMethods : [],
            images: imageUrls,
            image: imageUrls[0] || 'https://via.placeholder.com/300x200?text=No+Image',
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

            toast.success('Your item has been listed successfully.');
            setFormData({
                title: '',
                description: '',
                price: '',
                category: '',
                condition: '',
                location: currentUser.campusLocation || currentUser.university || '',
                contactInfo: currentUser.phone || currentUser.email || '',
                availableFrom: '',
                stripePaymentLink: '',
                serviceCategory: '',
                rate: '',
                rateUnit: 'hour',
                availabilityNote: '',
                locationNote: 'on campus',
                images: [],
                paymentMethods: formData.paymentMethods
            });
            onNavigate('home', persisted?.id);
        } catch (error) {
            console.error('Failed to save product:', error);
            toast.error('Something went wrong while listing your item. Please try again.');
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
                React.createElement('h1', null,
                    listingType === null ? 'What are you listing?' : (isService ? 'Offer a Service' : 'Sell Your Item')),
                React.createElement('p', null,
                    listingType === null
                        ? 'Items go on DormGlide. Skills go on Glyde. Same account, same campus.'
                        : (isService
                            ? 'Post a skill and get booked by students on your campus'
                            : 'List your item and reach hundreds of students on campus'))
            ),

            listingType === null ? React.createElement('div', { className: 'listing-type-choice' },
                React.createElement('button', {
                    type: 'button',
                    className: 'listing-type-card',
                    onClick: () => setListingType('goods')
                },
                    React.createElement('span', { className: 'listing-type-glyph', 'aria-hidden': true }, '🏠'),
                    React.createElement('strong', null, 'Item'),
                    React.createElement('span', null, 'Furniture, textbooks, electronics, clothes — stuff you hand over.')
                ),
                React.createElement('button', {
                    type: 'button',
                    className: 'listing-type-card listing-type-card-glyde',
                    onClick: () => setListingType('service')
                },
                    React.createElement('span', { className: 'listing-type-glyph', 'aria-hidden': true }, '✨'),
                    React.createElement('strong', null, 'Service'),
                    React.createElement('span', null, 'Tutoring, haircuts, tech help, photos, moving help — skills you offer.')
                )
            ) : React.createElement('form', { className: 'sell-form', onSubmit: handleSubmit },
                React.createElement('button', {
                    type: 'button',
                    className: 'listing-type-back',
                    onClick: () => setListingType(null)
                }, `← Listing ${isService ? 'a service' : 'an item'} — change`),

                // Images Section
                React.createElement('div', { className: 'form-section' },
                    React.createElement('h3', null, isService ? 'Photos (optional)' : 'Photos'),
                    React.createElement('p', { className: 'section-description' },
                        `Add up to ${MAX_PHOTOS} photos. The cover photo is what buyers see while browsing — tap the star on any photo to make it the cover.`
                    ),

                    React.createElement('div', { className: 'image-upload-area' },
                        formData.images.length > 0 && React.createElement('div', { className: 'uploaded-images' },
                            formData.images.map((entry, index) =>
                                React.createElement('div', { key: entry.id || index, className: 'uploaded-image' },
                                    React.createElement('img', { src: entry.preview || entry, alt: `Photo ${index + 1}` }),
                                    React.createElement('button', {
                                        type: 'button',
                                        className: 'remove-image icon-btn danger',
                                        title: 'Remove photo',
                                        'aria-label': 'Remove photo',
                                        onClick: () => removeImage(index)
                                    },
                                        React.createElement('i', { className: 'fa-solid fa-trash' })
                                    ),
                                    index === 0
                                        ? React.createElement('span', { className: 'main-image-badge' },
                                            React.createElement('i', { className: 'fa-solid fa-star' }), ' Cover')
                                        : React.createElement('button', {
                                            type: 'button',
                                            className: 'set-cover-btn',
                                            title: 'Set as cover photo',
                                            'aria-label': 'Set as cover photo',
                                            onClick: () => makeCover(index)
                                        },
                                            React.createElement('i', { className: 'fa-regular fa-star' }), ' Set cover')
                                )
                            )
                        ),

                        formData.images.length < MAX_PHOTOS && React.createElement('label', {
                            className: 'image-upload-btn icon-btn',
                            title: 'Add photos'
                        },
                            React.createElement('i', { className: isProcessingPhotos ? 'fas fa-spinner fa-spin' : 'fa-solid fa-image' }),
                            React.createElement('input', {
                                type: 'file',
                                accept: 'image/*',
                                multiple: true,
                                disabled: isProcessingPhotos,
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
                            placeholder: isService ? 'e.g. CS 173 tutoring, Men\'s haircuts, Laptop repair' : 'What are you selling?',
                            required: true
                        })
                    ),

                    isService && React.createElement('div', { className: 'form-row' },
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'Service category *'),
                            React.createElement('select', {
                                name: 'serviceCategory',
                                value: formData.serviceCategory,
                                onChange: handleInputChange,
                                required: true
                            },
                                React.createElement('option', { value: '' }, 'Select a category'),
                                (glyde?.SERVICE_CATEGORIES || []).map((entry) =>
                                    React.createElement('option', { key: entry.name, value: entry.name }, `${entry.glyph} ${entry.name}`))
                            )
                        ),
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'Where'),
                            React.createElement('select', {
                                name: 'locationNote',
                                value: formData.locationNote,
                                onChange: handleInputChange
                            },
                                (glyde?.LOCATION_OPTIONS || []).map((entry) =>
                                    React.createElement('option', { key: entry.value, value: entry.value }, `${entry.glyph} ${entry.label}`))
                            )
                        )
                    ),

                    isService && React.createElement('p', { className: 'form-hint excluded-services-notice' },
                        '⚠️ ', glyde?.EXCLUDED_SERVICES_NOTICE),

                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'Description *'),
                        React.createElement('textarea', {
                            name: 'description',
                            value: formData.description,
                            onChange: handleInputChange,
                            placeholder: isService
                                ? 'What you offer, your experience, what a session looks like...'
                                : 'Describe your item, its condition, and any important details...',
                            rows: 4,
                            required: true
                        })
                    ),

                    isService && React.createElement('div', { className: 'form-row' },
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'Rate *'),
                            React.createElement('div', { className: 'price-input' },
                                React.createElement('span', { className: 'currency' }, '$'),
                                React.createElement('input', {
                                    type: 'number',
                                    name: 'rate',
                                    value: formData.rate,
                                    onChange: handleInputChange,
                                    placeholder: '20',
                                    min: '1',
                                    step: '1',
                                    required: true
                                })
                            )
                        ),
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'Per'),
                            React.createElement('select', {
                                name: 'rateUnit',
                                value: formData.rateUnit,
                                onChange: handleInputChange
                            },
                                (glyde?.RATE_UNITS || []).map((entry) =>
                                    React.createElement('option', { key: entry.value, value: entry.value }, entry.label))
                            )
                        )
                    ),

                    isService && React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'Availability'),
                        React.createElement('input', {
                            type: 'text',
                            name: 'availabilityNote',
                            value: formData.availabilityNote,
                            onChange: handleInputChange,
                            placeholder: 'e.g. Tue/Thu evenings, weekends',
                            maxLength: 120
                        })
                    ),

                    !isService && React.createElement('div', { className: 'form-row' },
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

                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, isService
                            ? 'Bookable from (optional)'
                            : 'Handoff date (optional) — for reserve-ahead selling'),
                        React.createElement('input', {
                            type: 'date',
                            name: 'availableFrom',
                            value: formData.availableFrom,
                            onChange: handleInputChange
                        }),
                        React.createElement('small', { className: 'form-hint' },
                            'Moving out at the end of the semester? Set the day you can hand the item over. Buyers can reserve it TODAY and pick it up on that date — you lock in your buyer early.')
                    ),

                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'Payment apps you accept (optional)'),
                        React.createElement('div', { className: 'payment-method-choices' },
                            PAYMENT_METHOD_OPTIONS.map((method) => React.createElement('label', {
                                key: method,
                                className: `payment-method-choice ${formData.paymentMethods.includes(method) ? 'selected' : ''}`
                            },
                                React.createElement('input', {
                                    type: 'checkbox',
                                    checked: formData.paymentMethods.includes(method),
                                    onChange: () => togglePaymentMethod(method)
                                }),
                                method
                            ))
                        ),
                        React.createElement('small', { className: 'form-hint' }, 'Shown on your listing so buyers know how to pay at handoff. DormGlide never handles money.')
                    ),

                    // Stripe Payment Link field removed (2026-08): DormGlide's
                    // positioning is "we never handle money" — payment happens
                    // in person via the deal flow's payment-apps chips.

                    !isService && React.createElement('div', { className: 'form-row' },
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
                        isSubmitting ? (uploadProgress || 'Posting...') : (isService ? 'Post Service' : 'List Item')
                    )
                )
            )
        )
    );
};
