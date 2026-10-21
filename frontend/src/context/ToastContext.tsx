import React, { createContext, useContext, useState, useCallback } from 'react'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (type: Toast['type'], title: string, message?: string) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: Toast['type'], title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, title, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => (
          <div key={toast.id} className={`glass-card p-4 animate-slide-up border-l-4 ${
            toast.type === 'success' ? 'border-l-low' :
            toast.type === 'error'   ? 'border-l-critical' :
            toast.type === 'warning' ? 'border-l-medium' : 'border-l-accent-500'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-white">{toast.title}</p>
                {toast.message && <p className="text-xs text-navy-300 mt-0.5">{toast.message}</p>}
              </div>
              <button onClick={() => removeToast(toast.id)} className="text-navy-400 hover:text-white transition-colors text-lg leading-none">×</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
