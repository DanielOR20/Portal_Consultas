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
                ? 'border-[#E6004C] bg-[#E6004C] text-white shadow-[0_0_16px_rgba(230,0,76,0.35)]'
                : isInfo
                  ? 'border-[#FFB8D0] bg-[#FFF0F5] text-[#18181B]'
                  : 'border-[#FFB8D0] bg-white text-[#18181B]'
            }`}
          >
            {isError ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-white" />
            ) : isInfo ? (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#E6004C]" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#E6004C]" />
            )}

            <p className="flex-1 text-xs font-medium leading-relaxed">{toast.message}</p>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Cerrar notificación"
              className={`rounded p-0.5 transition cursor-pointer ${
                isError
                  ? 'text-white/85 hover:bg-white/20 hover:text-white'
                  : 'text-[#52525B] hover:bg-[#FFF0F5] hover:text-[#E6004C]'
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
