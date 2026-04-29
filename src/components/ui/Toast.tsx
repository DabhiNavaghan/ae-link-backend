'use client';

import React, { createContext, useContext, useState, useCallback, CSSProperties } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 3000) => {
      const id = Math.random().toString(36).substr(2, 9);
      const toast: Toast = { id, type, message, duration };

      setToasts((prev) => [...prev, toast]);

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-3 max-w-md">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

interface ToastItemProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const getTypeStyle = (type: ToastType): CSSProperties => {
    const typeStyles: Record<ToastType, CSSProperties> = {
      success: {
        backgroundColor: 'var(--color-success)',
        borderColor: 'var(--color-success)',
        color: 'var(--color-bg)',
      },
      error: {
        backgroundColor: 'var(--color-danger)',
        borderColor: 'var(--color-danger)',
        color: 'var(--color-bg)',
      },
      warning: {
        backgroundColor: 'var(--color-warning)',
        borderColor: 'var(--color-warning)',
        color: 'var(--color-bg)',
      },
      info: {
        backgroundColor: 'var(--color-primary)',
        borderColor: 'var(--color-primary)',
        color: 'var(--color-bg)',
      },
    };
    return typeStyles[type];
  };

  const getIconColor = (type: ToastType): string => {
    const iconColors: Record<ToastType, string> = {
      success: 'var(--color-bg)',
      error: 'var(--color-bg)',
      warning: 'var(--color-bg)',
      info: 'var(--color-bg)',
    };
    return iconColors[type];
  };

  const icons: Record<ToastType, React.ReactNode> = {
    success: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
    error: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
    warning: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4v2m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
    info: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  };

  return (
    <div
      className="card p-4 flex items-start gap-3 animate-slideInRight shadow-lg"
      style={{
        border: '1px solid',
        ...getTypeStyle(toast.type),
      }}
    >
      <svg
        className="w-5 h-5 flex-shrink-0 mt-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        style={{ color: getIconColor(toast.type) }}
      >
        {icons[toast.type]}
      </svg>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => onClose(toast.id)}
        className="transition-colors duration-200 flex-shrink-0"
        style={{ color: 'currentColor', opacity: 0.7 }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
};
