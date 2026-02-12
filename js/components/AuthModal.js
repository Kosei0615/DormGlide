// Authentication Modal Component
const AuthModal = ({ onClose, onAuthSuccess }) => {
    const [mode, setMode] = React.useState('login'); // 'login' or 'signup'
    const [formData, setFormData] = React.useState({
        email: '',
        password: '',
        name: '',
        phone: '',
        university: '',
        campusLocation: ''
    });
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [cooldownUntil, setCooldownUntil] = React.useState(0);
    const [cooldownRemaining, setCooldownRemaining] = React.useState(0);

    React.useEffect(() => {
        if (!cooldownUntil || Date.now() >= cooldownUntil) {
            setCooldownRemaining(0);
            return undefined;
        }

        const tick = () => {
            const remainingSeconds = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
            setCooldownRemaining(remainingSeconds);
        };

        tick();
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, [cooldownUntil]);

    const startCooldown = (seconds) => {
        const safeSeconds = Number.isFinite(Number(seconds)) && Number(seconds) > 0 ? Number(seconds) : 60;
        const until = Date.now() + (safeSeconds * 1000);
        setCooldownUntil(until);
        setCooldownRemaining(Math.ceil(safeSeconds));
    };

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
        if (cooldownRemaining > 0) {
            setError(`Too many attempts. Please wait ${cooldownRemaining}s before trying again.`);
            return;
        }
        setLoading(true);
        setError('');

        if (!window.DormGlideAuth?.loginUser) {
            setError('Authentication service is unavailable. Please refresh the page.');
            setLoading(false);
            return;
        }

        try {
            const result = await window.DormGlideAuth.loginUser(formData.email, formData.password);
            if (result.success) {
                onAuthSuccess(result.user);
                onClose();
            } else {
                if (result.rateLimited) {
                    startCooldown(result.retryAfterSeconds || 60);
                }
                setError(result.message || 'Unable to log in');
            }
        } catch (error) {
            console.error('[DormGlide] Login failed', error);
            setError('Unexpected error logging in. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        if (cooldownRemaining > 0) {
            setError(`Too many attempts. Please wait ${cooldownRemaining}s before trying again.`);
            return;
        }
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

        if (!window.DormGlideAuth?.registerUser) {
            setError('Authentication service is unavailable. Please refresh and try again.');
            setLoading(false);
            return;
        }

        const digitsOnly = (formData.phone || '').replace(/\D/g, '');
        const sanitizedPhone = digitsOnly
            ? (window.DormGlideAuth?.sanitizePhoneNumber?.(formData.phone) || `+${digitsOnly}`)
            : '';

        try {
            const result = await window.DormGlideAuth.registerUser({
                email: formData.email,
                password: formData.password,
                name: formData.name,
                phone: sanitizedPhone,
                university: formData.university,
                campusLocation: formData.campusLocation,
                // Mercari-style: every account can both buy and sell.
                role: 'user',
                bio: `Student at ${formData.university || 'University'}`
            });

            if (result.success) {
                if (result.requiresEmailConfirmation) {
                    setMode('login');
                    setError('Account created! Check your email to confirm before logging in.');
                } else if (result.user) {
                    onAuthSuccess(result.user);
                    onClose();
                } else {
                    // Fallback: attempt explicit login
                    const loginResult = await window.DormGlideAuth.loginUser(formData.email, formData.password);
                    if (loginResult.success) {
                        onAuthSuccess(loginResult.user);
                        onClose();
                    } else {
                        if (loginResult.rateLimited) {
                            startCooldown(loginResult.retryAfterSeconds || 60);
                        }
                        setMode('login');
                        setError(loginResult.message || 'Account created. Please log in.');
                    }
                }
            } else {
                setError(result.message || 'Unable to create account');
            }
        } catch (error) {
            console.error('[DormGlide] Signup failed', error);
            setError('Unexpected error creating account. Please try again.');
        } finally {
            setLoading(false);
        }
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
                            placeholder: 'you@example.com',
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
                        disabled: loading || cooldownRemaining > 0
                    },
                        loading && React.createElement('i', { className: 'fas fa-spinner fa-spin' }),
                        loading ? 'Logging in...' : (cooldownRemaining > 0 ? `Wait ${cooldownRemaining}s` : 'Login')
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
                        React.createElement('label', null, 'Phone Number (optional)'),
                        React.createElement('input', {
                            type: 'tel',
                            name: 'phone',
                            value: formData.phone,
                            onChange: handleInputChange,
                            placeholder: '(555) 123-4567',
                            required: false
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

                    React.createElement('button', {
                        type: 'submit',
                        className: 'btn btn-primary btn-block',
                        disabled: loading || cooldownRemaining > 0
                    },
                        loading && React.createElement('i', { className: 'fas fa-spinner fa-spin' }),
                        loading ? 'Creating account...' : (cooldownRemaining > 0 ? `Wait ${cooldownRemaining}s` : 'Create account')
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
