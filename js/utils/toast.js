(function () {
    if (window.DormGlideToast) return;

    const CONTAINER_ID = 'dormglide-toast-container';
    const TOAST_LIFETIME_MS = 5000;

    const ensureStyles = () => {
        if (document.getElementById('dormglide-toast-styles')) return;
        const style = document.createElement('style');
        style.id = 'dormglide-toast-styles';
        style.textContent = `
            #${CONTAINER_ID} {
                position: fixed;
                top: 16px;
                right: 16px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                z-index: 4000;
                width: min(360px, calc(100vw - 32px));
            }

            .dormglide-toast {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                background: #111827;
                color: #f9fafb;
                border-radius: 10px;
                box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
                padding: 12px;
                border-left: 4px solid #60a5fa;
                opacity: 0;
                transform: translateY(-6px);
                animation: dormglide-toast-enter 0.18s ease forwards;
            }

            .dormglide-toast--success { border-left-color: #22c55e; }
            .dormglide-toast--error { border-left-color: #ef4444; }
            .dormglide-toast--warning { border-left-color: #f59e0b; }
            .dormglide-toast--info { border-left-color: #60a5fa; }

            .dormglide-toast__body {
                flex: 1;
                font-size: 0.92rem;
                line-height: 1.3;
                word-break: break-word;
            }

            .dormglide-toast__close {
                border: none;
                background: transparent;
                color: #e5e7eb;
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
                padding: 2px;
            }

            .dormglide-toast--closing {
                animation: dormglide-toast-exit 0.18s ease forwards;
            }

            @keyframes dormglide-toast-enter {
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes dormglide-toast-exit {
                to {
                    opacity: 0;
                    transform: translateY(-6px);
                }
            }
        `;
        document.head.appendChild(style);
    };

    const getContainer = () => {
        let container = document.getElementById(CONTAINER_ID);
        if (container) return container;

        container = document.createElement('div');
        container.id = CONTAINER_ID;
        document.body.appendChild(container);
        return container;
    };

    const dismissToast = (toastEl) => {
        if (!toastEl || toastEl.classList.contains('dormglide-toast--closing')) return;
        toastEl.classList.add('dormglide-toast--closing');
        window.setTimeout(() => {
            if (toastEl.parentElement) {
                toastEl.parentElement.removeChild(toastEl);
            }
        }, 180);
    };

    const show = (type, message) => {
        ensureStyles();
        const container = getContainer();

        const toast = document.createElement('div');
        toast.className = `dormglide-toast dormglide-toast--${type}`;

        const body = document.createElement('div');
        body.className = 'dormglide-toast__body';
        body.textContent = String(message || 'Something happened.');

        const closeBtn = document.createElement('button');
        closeBtn.className = 'dormglide-toast__close';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Dismiss notification');
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => dismissToast(toast));

        toast.appendChild(body);
        toast.appendChild(closeBtn);
        container.appendChild(toast);

        window.setTimeout(() => dismissToast(toast), TOAST_LIFETIME_MS);
    };

    window.DormGlideToast = {
        success: (message) => show('success', message),
        error: (message) => show('error', message),
        warning: (message) => show('warning', message),
        info: (message) => show('info', message)
    };
})();
