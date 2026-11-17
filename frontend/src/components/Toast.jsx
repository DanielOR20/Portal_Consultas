import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2.5 sm:right-6 sm:bottom-6">
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isInfo = toast.type === 'info';

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all ${
              isError
                ? 'border-[#722F37] bg-[#722F37] text-white'
                : isInfo
                  ? 'border-[#F3D5DB] bg-[#FDF2F4] text-[#4E1A21]'
                  : 'border-[#F3D5DB] bg-white text-[#1F1416]'
            }`}
          >
            {isError ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-white" />
            ) : isInfo ? (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#722F37]" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#722F37]" />
            )}

            <p className="flex-1 text-xs font-medium leading-relaxed">{toast.message}</p>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Cerrar notificación"
              className={`rounded p-0.5 transition cursor-pointer ${
                isError
                  ? 'text-white/80 hover:bg-white/15 hover:text-white'
                  : 'text-[#6E5A5E] hover:bg-[#FDF2F4] hover:text-[#722F37]'
              }`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

