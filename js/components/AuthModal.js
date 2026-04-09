// Authentication Modal Component
const AuthModal = ({ onClose, onAuthSuccess, initialMode = 'login' }) => {
    const [mode, setMode] = React.useState(initialMode === 'signup' ? 'signup' : 'login'); // 'login', 'signup', or 'reset'
    const [formData, setFormData] = React.useState({
        email: '',
        password: '',
        name: '',
        phone: '',
        university: '',
        campusLocation: ''
    });
    const [errorMessage, setErrorMessage] = React.useState('');
    const [successMessage, setSuccessMessage] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [failedAttempts, setFailedAttempts] = React.useState(0);
    const [loginCooldownUntil, setLoginCooldownUntil] = React.useState(0);
    const [loginCooldownRemaining, setLoginCooldownRemaining] = React.useState(0);

    React.useEffect(() => {
        if (!loginCooldownUntil || Date.now() >= loginCooldownUntil) {
            setLoginCooldownRemaining(0);
            return undefined;
        }

        const tick = () => {
            const remainingSeconds = Math.max(0, Math.ceil((loginCooldownUntil - Date.now()) / 1000));
            setLoginCooldownRemaining(remainingSeconds);
        };

        tick();
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, [loginCooldownUntil]);

    React.useEffect(() => {
        setMode(initialMode === 'signup' ? 'signup' : 'login');
        setErrorMessage('');
        setSuccessMessage('');
    }, [initialMode]);

    const startLoginCooldown = (seconds) => {
        const safeSeconds = Number.isFinite(Number(seconds)) && Number(seconds) > 0 ? Number(seconds) : 60;
        const until = Date.now() + (safeSeconds * 1000);
        setLoginCooldownUntil(until);
        setLoginCooldownRemaining(Math.ceil(safeSeconds));
    };

    const isRateLimitError = (authError) => {
        if (!authError) return false;
        const status = Number(authError.status || authError.statusCode || 0);
        const message = String(authError.message || authError.error_description || '').toLowerCase();
        return (
            authError.rateLimited === true ||
            status === 429 ||
            message.includes('too many requests') ||
            message.includes('rate limit')
        );
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setErrorMessage('');
        setSuccessMessage('');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (loginCooldownRemaining > 0) {
            setErrorMessage(`Too many login attempts. Try again in ${loginCooldownRemaining}s.`);
            return;
        }
        setLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        if (!window.DormGlideAuth?.loginUser) {
            setErrorMessage('Authentication service is unavailable. Please refresh the page.');
            setLoading(false);
            return;
        }

        try {
            const result = await window.DormGlideAuth.loginUser(formData.email, formData.password);
            if (result.success) {
                setFailedAttempts(0);
                onAuthSuccess(result.user);
                onClose();
            } else {
                const nextFailedAttempts = failedAttempts + 1;
                setFailedAttempts(nextFailedAttempts);

                if (isRateLimitError(result)) {
                    startLoginCooldown(60);
                    setErrorMessage("Too many login attempts. Please wait a few minutes and try again. If you forgot your password, use the 'Forgot Password' link below.");
                } else if (nextFailedAttempts >= 3) {
                    setErrorMessage('Multiple failed attempts detected. Please double-check your password or reset it to avoid being temporarily locked out.');
                } else {
                    setErrorMessage(result.message || 'Unable to log in');
                }
            }
        } catch (error) {
            console.error('[DormGlide] Login failed', error);
            const nextFailedAttempts = failedAttempts + 1;
            setFailedAttempts(nextFailedAttempts);

            if (isRateLimitError(error)) {
                startLoginCooldown(60);
                setErrorMessage("Too many login attempts. Please wait a few minutes and try again. If you forgot your password, use the 'Forgot Password' link below.");
            } else if (nextFailedAttempts >= 3) {
                setErrorMessage('Multiple failed attempts detected. Please double-check your password or reset it to avoid being temporarily locked out.');
            } else {
                setErrorMessage('Unexpected error logging in. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        const email = String(formData.email || '').trim();
        if (!email) {
            setErrorMessage('Please enter your email address first');
            return;
        }

        if (!window.SupabaseClient?.auth?.resetPasswordForEmail) {
            setErrorMessage('Password reset is currently unavailable. Please try again later.');
            return;
        }

        setLoading(true);
        try {
            const { error } = await window.SupabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: 'https://dormglide.com/app.html'
            });

            if (error) {
                if (isRateLimitError(error)) {
                    setErrorMessage('Too many reset attempts. Please wait a few minutes before trying again.');
                } else {
                    setErrorMessage(error.message || 'Unable to send password reset email.');
                }
                return;
            }

            setSuccessMessage('Check your email for a password reset link!');
        } catch (error) {
            console.error('[DormGlide] Password reset request failed', error);
            setErrorMessage('Unable to send password reset email. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        if (!formData.email || !formData.password || !formData.name) {
            setErrorMessage('Please fill in all required fields');
            setLoading(false);
            return;
        }

        if (formData.password.length < 6) {
            setErrorMessage('Password must be at least 6 characters');
            setLoading(false);
            return;
        }

        if (!window.DormGlideAuth?.registerUser) {
            setErrorMessage('Authentication service is unavailable. Please refresh and try again.');
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
                    switchMode('login');
                    setSuccessMessage('Account created! Check your email to confirm before logging in.');
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
                        switchMode('login');
                        setErrorMessage(loginResult.message || 'Account created. Please log in.');
                    }
                }
            } else {
                setErrorMessage(result.message || 'Unable to create account');
            }
        } catch (error) {
            console.error('[DormGlide] Signup failed', error);
            setErrorMessage('Unexpected error creating account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target.className === 'auth-modal-overlay') {
            onClose();
        }
    };

    const switchMode = (nextMode) => {
        setMode(nextMode);
        setErrorMessage('');
        setSuccessMessage('');
    };

    return React.createElement('div', { 
        className: 'auth-modal-overlay',
        onClick: handleOverlayClick
    },
        React.createElement('div', { className: 'auth-modal' },
            React.createElement('button', {
                className: 'auth-modal-close icon-btn',
                title: 'Close',
                'aria-label': 'Close',
                onClick: onClose
            },
                React.createElement('i', { className: 'fa-solid fa-xmark' })
            ),

            React.createElement('div', { className: 'auth-modal-header' },
                React.createElement('h2', null,
                    mode === 'login' ? 'Welcome Back!' : (mode === 'signup' ? 'Join DormGlide' : 'Reset Password')
                ),
                React.createElement('p', null, 
                    mode === 'login'
                        ? 'Login to continue buying and selling'
                        : (mode === 'signup' ? 'Create an account to start your journey' : 'Enter your account email to receive a reset link')
                )
            ),

            mode !== 'reset' && React.createElement('div', { className: 'auth-tabs' },
                React.createElement('button', {
                    className: `auth-tab ${mode === 'login' ? 'active' : ''}`,
                    onClick: () => {
                        switchMode('login');
                    }
                }, 'Login'),
                React.createElement('button', {
                    className: `auth-tab ${mode === 'signup' ? 'active' : ''}`,
                    onClick: () => {
                        switchMode('signup');
                    }
                }, 'Sign Up')
            ),

            errorMessage && React.createElement('div', { className: 'auth-error' },
                React.createElement('i', { className: 'fas fa-exclamation-circle' }),
                errorMessage
            ),

            successMessage && React.createElement('div', { className: 'auth-success' },
                React.createElement('i', { className: 'fas fa-check-circle' }),
                successMessage
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

                    React.createElement('div', { className: 'auth-inline-actions' },
                        React.createElement('a', {
                            href: '#',
                            className: 'auth-inline-link',
                            onClick: (e) => {
                                e.preventDefault();
                                switchMode('reset');
                            }
                        }, 'Forgot Password?')
                    ),

                    React.createElement('button', {
                        type: 'submit',
                        className: 'btn btn-primary btn-block',
                        disabled: loading || loginCooldownRemaining > 0
                    },
                        loading && React.createElement('i', { className: 'fas fa-spinner fa-spin' }),
                        loading
                            ? 'Logging in...'
                            : (loginCooldownRemaining > 0 ? `Try again in ${loginCooldownRemaining}s...` : 'Login')
                    ),

                    React.createElement('div', { className: 'auth-footer' },
                        React.createElement('p', null,
                            'Don\'t have an account? ',
                            React.createElement('a', {
                                href: '#',
                                onClick: (e) => {
                                    e.preventDefault();
                                    switchMode('signup');
                                }
                            }, 'Sign up')
                        )
                    )
                )
            ) : mode === 'signup' ? (
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
                        disabled: loading
                    },
                        loading && React.createElement('i', { className: 'fas fa-spinner fa-spin' }),
                        loading ? 'Creating account...' : 'Create account'
                    ),

                    React.createElement('div', { className: 'auth-footer' },
                        React.createElement('p', null,
                            'Already have an account? ',
                            React.createElement('a', {
                                href: '#',
                                onClick: (e) => {
                                    e.preventDefault();
                                    switchMode('login');
                                }
                            }, 'Login')
                        )
                    )
                )
            ) : (
                React.createElement('form', { className: 'auth-form', onSubmit: handleResetPassword },
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

                    React.createElement('button', {
                        type: 'submit',
                        className: 'btn btn-primary btn-block',
                        disabled: loading
                    },
                        loading && React.createElement('i', { className: 'fas fa-spinner fa-spin' }),
                        loading ? 'Sending reset link...' : 'Send reset link'
                    ),

                    React.createElement('div', { className: 'auth-footer' },
                        React.createElement('p', null,
                            React.createElement('a', {
                                href: '#',
                                onClick: (e) => {
                                    e.preventDefault();
                                    switchMode('login');
                                }
                            }, 'Back to login')
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
