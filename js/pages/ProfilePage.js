const ProfilePage = ({ onNavigate, currentUser, setCurrentUser, userProducts, onShowAuth }) => {
    const [isEditing, setIsEditing] = React.useState(!currentUser);
    const [formData, setFormData] = React.useState({
        name: currentUser?.name || '',
        email: currentUser?.email || '',
        phone: currentUser?.phone || '',
        university: currentUser?.university || '',
        campusLocation: currentUser?.campusLocation || '',
        major: currentUser?.major || '',
        graduationYear: currentUser?.graduationYear || '',
        bio: currentUser?.bio || ''
    });
    const [activeTab, setActiveTab] = React.useState('profile');

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.email) {
            alert('Please fill in required fields (Name and Email).');
            return;
        }

        const userData = {
            id: currentUser?.id || Date.now().toString(),
            ...formData,
            joinedAt: currentUser?.joinedAt || new Date().toISOString()
        };

        let resolvedUser = { ...userData };
        if (window.DormGlideAuth?.updateUserProfile) {
            try {
                const result = await window.DormGlideAuth.updateUserProfile(userData.id, userData);
                if (result?.success && result.user) {
                    resolvedUser = { ...resolvedUser, ...result.user };
                }
            } catch (error) {
                console.error('[DormGlide] Failed to update profile', error);
                alert('Unable to save profile right now. Please try again.');
                return;
            }
        } else {
            saveUserToStorage(userData);
        }

        setCurrentUser(resolvedUser);
        setIsEditing(false);
        alert('Profile saved successfully!');
    };

    const handleDeleteAccount = () => {
        if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            setCurrentUser(null);
            localStorage.removeItem('currentUser');
            alert('Account deleted successfully.');
            onNavigate('home');
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const calculateTotalEarnings = () => {
        return userProducts.reduce((total, product) => total + product.price, 0);
    };

    const renderProfileTab = () => {
        if (isEditing) {
            return React.createElement('form', { className: 'profile-form', onSubmit: handleSaveProfile },
                React.createElement('div', { className: 'form-section' },
                    React.createElement('h3', null, 'Personal Information'),
                    
                    React.createElement('div', { className: 'form-row' },
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'Full Name *'),
                            React.createElement('input', {
                                type: 'text',
                                name: 'name',
                                value: formData.name,
                                onChange: handleInputChange,
                                required: true
                            })
                        ),
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'Email *'),
                            React.createElement('input', {
                                type: 'email',
                                name: 'email',
                                value: formData.email,
                                onChange: handleInputChange,
                                required: true
                            })
                        )
                    ),

                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'Phone Number'),
                        React.createElement('input', {
                            type: 'tel',
                            name: 'phone',
                            value: formData.phone,
                            onChange: handleInputChange,
                            placeholder: '(555) 123-4567'
                        })
                    )
                ),

                React.createElement('div', { className: 'form-section' },
                    React.createElement('h3', null, 'Academic Information'),
                    
                    React.createElement('div', { className: 'form-row' },
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'University'),
                            React.createElement('input', {
                                type: 'text',
                                name: 'university',
                                value: formData.university,
                                onChange: handleInputChange,
                                placeholder: 'Your University Name'
                            })
                        ),
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'Primary Campus Location'),
                            React.createElement('input', {
                                type: 'text',
                                name: 'campusLocation',
                                value: formData.campusLocation,
                                onChange: handleInputChange,
                                placeholder: 'e.g., North Campus, Dorm A'
                            })
                        )
                    ),

                    React.createElement('div', { className: 'form-row' },
                        React.createElement('div', { className: 'form-group' },
                            React.createElement('label', null, 'Major'),
                            React.createElement('input', {
                                type: 'text',
                                name: 'major',
                                value: formData.major,
                                onChange: handleInputChange,
                                placeholder: 'Computer Science, Business, etc.'
                            })
                        )
                    ),

                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'Graduation Year'),
                        React.createElement('select', {
                            name: 'graduationYear',
                            value: formData.graduationYear,
                            onChange: handleInputChange
                        },
                            React.createElement('option', { value: '' }, 'Select Year'),
                            ...Array.from({ length: 10 }, (_, i) => {
                                const year = new Date().getFullYear() + i;
                                return React.createElement('option', { key: year, value: year }, year);
                            })
                        )
                    ),

                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'Bio'),
                        React.createElement('textarea', {
                            name: 'bio',
                            value: formData.bio,
                            onChange: handleInputChange,
                            placeholder: 'Tell other students about yourself...',
                            rows: 3
                        })
                    )
                ),

                React.createElement('div', { className: 'form-actions' },
                    React.createElement('button', {
                        type: 'button',
                        className: 'btn btn-secondary',
                        onClick: () => setIsEditing(false)
                    }, 'Cancel'),
                    React.createElement('button', {
                        type: 'submit',
                        className: 'btn btn-primary'
                    }, 'Save Profile')
                )
            );
        }

        return React.createElement('div', { className: 'profile-view' },
            React.createElement('div', { className: 'profile-header' },
                React.createElement('div', { className: 'profile-avatar' },
                    React.createElement('i', { className: 'fas fa-user-circle' })
                ),
                React.createElement('div', { className: 'profile-info' },
                    React.createElement('h2', null, currentUser.name),
                    React.createElement('p', null, currentUser.email),
                    React.createElement('div', { className: 'profile-meta' },
                        React.createElement('span', null,
                            React.createElement('i', { className: 'fas fa-calendar' }),
                            'Joined ', formatDate(currentUser.joinedAt)
                        ),
                        currentUser.university && React.createElement('span', null,
                            React.createElement('i', { className: 'fas fa-graduation-cap' }),
                            currentUser.university
                        ),
                        currentUser.campusLocation && React.createElement('span', null,
                            React.createElement('i', { className: 'fas fa-map-marker-alt' }),
                            currentUser.campusLocation
                        )
                    )
                ),
                React.createElement('button', {
                    className: 'btn btn-outline',
                    onClick: () => setIsEditing(true)
                },
                    React.createElement('i', { className: 'fas fa-edit' }),
                    'Edit Profile'
                )
            ),

            React.createElement('div', { className: 'profile-stats' },
                React.createElement('div', { className: 'stat-card' },
                    React.createElement('i', { className: 'fas fa-box' }),
                    React.createElement('h3', null, userProducts.length),
                    React.createElement('p', null, 'Items Listed')
                ),
                React.createElement('div', { className: 'stat-card' },
                    React.createElement('i', { className: 'fas fa-dollar-sign' }),
                    React.createElement('h3', null, `$${calculateTotalEarnings()}`),
                    React.createElement('p', null, 'Total Value')
                ),
                React.createElement('div', { className: 'stat-card' },
                    React.createElement('i', { className: 'fas fa-star' }),
                    React.createElement('h3', null, '4.8'),
                    React.createElement('p', null, 'Rating')
                )
            ),

            currentUser.bio && React.createElement('div', { className: 'profile-section' },
                React.createElement('h3', null, 'About'),
                React.createElement('p', null, currentUser.bio)
            ),

            React.createElement('div', { className: 'profile-section' },
                React.createElement('h3', null, 'Contact Information'),
                React.createElement('div', { className: 'contact-info' },
                    React.createElement('div', { className: 'contact-item' },
                        React.createElement('i', { className: 'fas fa-envelope' }),
                        React.createElement('span', null, currentUser.email)
                    ),
                    currentUser.phone && React.createElement('div', { className: 'contact-item' },
                        React.createElement('i', { className: 'fas fa-phone' }),
                        React.createElement('span', null, currentUser.phone)
                    )
                )
            ),

            React.createElement('div', { className: 'danger-zone' },
                React.createElement('h3', null, 'Danger Zone'),
                React.createElement('button', {
                    className: 'btn btn-danger',
                    onClick: handleDeleteAccount
                },
                    React.createElement('i', { className: 'fas fa-trash' }),
                    'Delete Account'
                )
            )
        );
    };

    const renderListingsTab = () => {
        if (userProducts.length === 0) {
            return React.createElement('div', { className: 'empty-state' },
                React.createElement('i', { className: 'fas fa-box-open' }),
                React.createElement('h3', null, 'No listings yet'),
                React.createElement('p', null, 'Start selling your items to see them here.'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => onNavigate('sell')
                }, 'List Your First Item')
            );
        }

        return React.createElement('div', { className: 'user-listings' },
            React.createElement('div', { className: 'listings-header' },
                React.createElement('h3', null, 'Your Listings'),
                React.createElement('button', {
                    className: 'btn btn-primary',
                    onClick: () => onNavigate('sell')
                },
                    React.createElement('i', { className: 'fas fa-plus' }),
                    'Add New Item'
                )
            ),
            React.createElement('div', { className: 'listings-grid' },
                userProducts.map(product =>
                    React.createElement('div', { key: product.id, className: 'listing-card' },
                        React.createElement('img', {
                            src: product.image,
                            alt: product.title
                        }),
                        React.createElement('div', { className: 'listing-info' },
                            React.createElement('h4', null, product.title),
                            React.createElement('p', { className: 'listing-price' }, `$${product.price}`),
                            React.createElement('div', { className: 'listing-meta' },
                                React.createElement('span', null, product.category),
                                React.createElement('span', null, formatDate(product.createdAt))
                            ),
                            React.createElement('div', { className: 'listing-actions' },
                                React.createElement('button', { className: 'btn btn-sm btn-outline' }, 'Edit'),
                                React.createElement('button', { className: 'btn btn-sm btn-secondary' }, 'Delete')
                            )
                        )
                    )
                )
            )
        );
    };

    if (!currentUser && !isEditing) {
        return React.createElement('div', { className: 'profile-page' },
            React.createElement('div', { className: 'welcome-section' },
                React.createElement('i', { className: 'fas fa-user-plus welcome-icon' }),
                React.createElement('h1', null, 'Welcome to DormGlide!'),
                React.createElement('p', null, 'Create your profile to start buying and selling with other students.'),
                React.createElement('button', {
                    className: 'btn btn-primary btn-large',
                    onClick: onShowAuth || (() => setIsEditing(true))
                }, 'Create Profile')
            )
        );
    }

    return React.createElement('div', { className: 'profile-page' },
        React.createElement('div', { className: 'profile-container' },
            currentUser && React.createElement('div', { className: 'profile-tabs' },
                React.createElement('button', {
                    className: `tab ${activeTab === 'profile' ? 'active' : ''}`,
                    onClick: () => setActiveTab('profile')
                },
                    React.createElement('i', { className: 'fas fa-user' }),
                    'Profile'
                ),
                React.createElement('button', {
                    className: `tab ${activeTab === 'listings' ? 'active' : ''}`,
                    onClick: () => setActiveTab('listings')
                },
                    React.createElement('i', { className: 'fas fa-list' }),
                    'My Listings'
                )
            ),

            React.createElement('div', { className: 'tab-content' },
                activeTab === 'profile' ? renderProfileTab() : renderListingsTab()
            )
        )
    );
};
