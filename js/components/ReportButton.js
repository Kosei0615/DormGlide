// Report button with a reason picker. Writes to public.reports (insert-only
// for clients; the founder reads reports via the admin counts function).
const ReportButton = ({ targetType, targetId, currentUser, label = 'Report', compact = false }) => {
    const [open, setOpen] = React.useState(false);
    const [reason, setReason] = React.useState('');
    const [details, setDetails] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const [done, setDone] = React.useState(false);
    const toast = window.DormGlideToast || { success: () => {}, error: () => {}, warning: () => {} };
    const reasons = window.DormGlideGlyde?.REPORT_REASONS || [];

    if (!targetId) return null;

    const submit = async () => {
        if (!currentUser?.id) { toast.warning('Please log in to report.'); return; }
        if (!reason) { toast.warning('Pick a reason first.'); return; }
        setSending(true);
        try {
            const result = await window.DormGlideGlyde.createReport({
                reporterId: currentUser.id, targetType, targetId, reason, details
            });
            if (result?.success) {
                setDone(true);
                setOpen(false);
                toast.success('Thanks — we received your report.');
            } else {
                toast.error(result?.message || 'Could not send the report.');
            }
        } finally {
            setSending(false);
        }
    };

    if (done) {
        return React.createElement('span', { className: 'report-done' }, '🚩 Reported');
    }

    return React.createElement('span', { className: 'report-wrap' },
        React.createElement('button', {
            type: 'button',
            className: `report-btn ${compact ? 'compact' : ''}`,
            onClick: (event) => { event.stopPropagation(); setOpen(true); }
        }, '🚩 ', label),
        open && React.createElement('div', {
            className: 'onboarding-overlay',
            onClick: (event) => { if (event.target.className === 'onboarding-overlay') setOpen(false); }
        },
            React.createElement('div', { className: 'onboarding-card report-card', onClick: (event) => event.stopPropagation() },
                React.createElement('h2', null, 'Report this'),
                React.createElement('p', null, 'Reports go straight to the DormGlide team. Only they can see them.'),
                React.createElement('div', { className: 'report-reasons' },
                    reasons.map((entry) => React.createElement('label', {
                        key: entry,
                        className: `report-reason ${reason === entry ? 'selected' : ''}`
                    },
                        React.createElement('input', { type: 'radio', name: 'report-reason', value: entry,
                            checked: reason === entry, onChange: () => setReason(entry) }),
                        entry
                    ))
                ),
                React.createElement('textarea', {
                    className: 'report-details',
                    placeholder: 'Anything else we should know? (optional)',
                    value: details,
                    maxLength: 500,
                    rows: 3,
                    onChange: (event) => setDetails(event.target.value)
                }),
                React.createElement('div', { className: 'onboarding-actions' },
                    React.createElement('button', { className: 'btn btn-secondary', onClick: () => setOpen(false) }, 'Cancel'),
                    React.createElement('button', { className: 'btn btn-primary', disabled: sending || !reason, onClick: submit },
                        sending && React.createElement('i', { className: 'fas fa-spinner fa-spin' }), 'Send report')
                )
            )
        )
    );
};

window.DormGlideReportButton = ReportButton;
