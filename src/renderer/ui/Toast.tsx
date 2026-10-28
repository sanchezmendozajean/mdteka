import { CheckCircle2, X } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../app/toast';
import { Icon } from './Icon';

const TIMEOUT_MS = 10_000;

export function Toast() {
  const { t } = useTranslation();
  const toast = useToast((s) => s.toast);
  const dismiss = useToast((s) => s.dismiss);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismiss, TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  if (!toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite" data-testid="toast">
      <Icon icon={CheckCircle2} size={18} />
      <span className="toast-message">{toast.message}</span>
      {toast.action && (
        <button
          className="toast-link"
          data-testid="toast-action"
          onClick={() => {
            toast.action?.run();
            dismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button className="btn btn-mini" aria-label={t('export.closeNotice')} onClick={dismiss}>
        <Icon icon={X} size={14} />
      </button>
    </div>
  );
}
