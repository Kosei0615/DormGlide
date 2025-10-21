// Authentication Modal Component
const AuthModal = ({ onClose, onAuthSuccess }) => {
    const [mode, setMode] = React.useState('login'); // 'login' or 'signup'
    const [formData, setFormData] = React.useState({
        email: '',
        password: '',
        name: '',
        phone: '',
        university: '',
        campusLocation: '',
        userType: 'buyer' // 'buyer' or 'seller'
    });
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Simulate network delay
        setTimeout(() => {
            const result = window.DormGlideAuth.loginUser(formData.email, formData.password);
            
            if (result.success) {
                onAuthSuccess(result.user);
                onClose();
            } else {
                setError(result.message);
            }
            setLoading(false);
        }, 500);
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!formData.email || !formData.password || !formData.name) {
            setError('Please fill in all required fields');
            setLoading(false);
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            setLoading(false);
            return;
        }

        // Simulate network delay
        setTimeout(() => {
            const result = window.DormGlideAuth.registerUser({
                email: formData.email,
                password: formData.password,
                name: formData.name,
                phone: formData.phone,
                university: formData.university,
                campusLocation: formData.campusLocation,
                role: formData.userType === 'seller' ? 'seller' : 'user',
                bio: `${formData.userType === 'seller' ? 'Seller' : 'Student'} at ${formData.university || 'University'}`
            });
            
            if (result.success) {
                // Auto-login after signup
                const loginResult = window.DormGlideAuth.loginUser(formData.email, formData.password);
                if (loginResult.success) {
                    onAuthSuccess(loginResult.user);
                    onClose();
                }
            } else {
                setError(result.message);
            }
            setLoading(false);
        }, 500);
    };

    const handleOverlayClick = (e) => {
        if (e.target.className === 'auth-modal-overlay') {
            onClose();
        }
    };

    return React.createElement('div', { 
        className: 'auth-modal-overlay',
        onClick: handleOverlayClick
    },
        React.createElement('div', { className: 'auth-modal' },
            React.createElement('button', {
                className: 'auth-modal-close',
                onClick: onClose
            },
                React.createElement('i', { className: 'fas fa-times' })
            ),

            React.createElement('div', { className: 'auth-modal-header' },
                React.createElement('h2', null, mode === 'login' ? 'Welcome Back!' : 'Join DormGlide'),
                React.createElement('p', null, 
                    mode === 'login' 
                        ? 'Login to continue buying and selling' 
                        : 'Create an account to start your journey'
                )
            ),

            React.createElement('div', { className: 'auth-tabs' },
                React.createElement('button', {
                    className: `auth-tab ${mode === 'login' ? 'active' : ''}`,
                    onClick: () => {
                        setMode('login');
                        setError('');
                    }
                }, 'Login'),
                React.createElement('button', {
                    className: `auth-tab ${mode === 'signup' ? 'active' : ''}`,
                    onClick: () => {
                        setMode('signup');
                        setError('');
                    }
                }, 'Sign Up')
            ),

            error && React.createElement('div', { className: 'auth-error' },
                React.createElement('i', { className: 'fas fa-exclamation-circle' }),
                error
            ),

            mode === 'login' ? (
                React.createElement('form', { className: 'auth-form', onSubmit: handleLogin },
                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'Email'),
                        React.createElement('input', {
                            type: 'email',
                            name: 'email',
                            value: formData.email,
                            onChange: handleInputChange,
                            placeholder: 'your.email@university.edu',
                            required: true,
                            autoComplete: 'email'
                        })
                    ),

                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'Password'),
                        React.createElement('input', {
                            type: 'password',
                            name: 'password',
                            value: formData.password,
                            onChange: handleInputChange,
                            placeholder: '••••••••',
                            required: true,
                            autoComplete: 'current-password'
                        })
                    ),

                    React.createElement('button', {
                        type: 'submit',
                        className: 'btn btn-primary btn-block',
                        disabled: loading
                    },
                        loading && React.createElement('i', { className: 'fas fa-spinner fa-spin' }),
                        loading ? 'Logging in...' : 'Login'
                    ),

                    React.createElement('div', { className: 'auth-footer' },
                        React.createElement('p', null, 
                            'Don\'t have an account? ',
                            React.createElement('a', {
                                href: '#',
                                onClick: (e) => {
                                    e.preventDefault();
                                    setMode('signup');
                                }
                            }, 'Sign up')
                        )
                    )
                )
            ) : (
                React.createElement('form', { className: 'auth-form', onSubmit: handleSignup },
                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'Full Name *'),
                        React.createElement('input', {
                            type: 'text',
                            name: 'name',
                            value: formData.name,
                            onChange: handleInputChange,
                            placeholder: 'John Doe',
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
                            placeholder: 'your.email@university.edu',
                            required: true,
                            autoComplete: 'email'
                        })
                    ),

                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'Password * (min 6 characters)'),
                        React.createElement('input', {
                            type: 'password',
                            name: 'password',
                            value: formData.password,
                            onChange: handleInputChange,
                            placeholder: '••••••••',
                            required: true,
                            minLength: 6,
                            autoComplete: 'new-password'
                        })
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
                    ),

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
                    ),

                    React.createElement('div', { className: 'form-group' },
                        React.createElement('label', null, 'I want to:'),
                        React.createElement('div', { className: 'user-type-selector' },
                            React.createElement('label', { className: 'user-type-option' },
                                React.createElement('input', {
                                    type: 'radio',
                                    name: 'userType',
                                    value: 'buyer',
                                    checked: formData.userType === 'buyer',
                                    onChange: handleInputChange
                                }),
                                React.createElement('div', { className: 'user-type-content' },
                                    React.createElement('i', { className: 'fas fa-shopping-bag' }),
                                    React.createElement('span', null, 'Buy items')
                                )
                            ),
                            React.createElement('label', { className: 'user-type-option' },
                                React.createElement('input', {
                                    type: 'radio',
                                    name: 'userType',
                                    value: 'seller',
                                    checked: formData.userType === 'seller',
                                    onChange: handleInputChange
                                }),
                                React.createElement('div', { className: 'user-type-content' },
                                    React.createElement('i', { className: 'fas fa-store' }),
                                    React.createElement('span', null, 'Sell items')
                                )
                            )
                        )
                    ),

                    React.createElement('button', {
                        type: 'submit',
                        className: 'btn btn-primary btn-block',
                        disabled: loading
                    },
                        loading && React.createElement('i', { className: 'fas fa-spinner fa-spin' }),
                        loading ? 'Creating Account...' : 'Create Account'
                    ),

                    React.createElement('div', { className: 'auth-footer' },
                        React.createElement('p', null, 
                            'Already have an account? ',
                            React.createElement('a', {
                                href: '#',
                                onClick: (e) => {
                                    e.preventDefault();
                                    setMode('login');
                                }
                            }, 'Login')
                        )
                    )
                )
            ),

            React.createElement('div', { className: 'auth-demo-hint' },
                React.createElement('p', null, 
                    React.createElement('i', { className: 'fas fa-info-circle' }),
                    ' Demo Mode: You can create any account or use test@demo.com / password'
                )
            )
        )
    );
};
