import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

// In-app toast notifications (no browser push).
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (toast) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, ...toast }]);
      setTimeout(() => removeToast(id), toast.duration || 4000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[90vw]">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              t.onClick?.();
              removeToast(t.id);
            }}
            className="text-left bg-white shadow-lg rounded-lg border border-gray-200 px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition animate-[slidein_0.2s_ease]"
          >
            <div className="w-9 h-9 rounded-full bg-wa-green text-white flex items-center justify-center font-semibold shrink-0">
              {(t.title || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">{t.title}</p>
              <p className="text-sm text-gray-600 truncate">{t.body}</p>
            </div>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
