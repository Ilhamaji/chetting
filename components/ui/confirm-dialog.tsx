"use client"

import { useState, useCallback, createContext, useContext, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, Trash2, X, CheckCircle2, XCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"

// ─── Confirm Dialog ───

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "warning" | "info"
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(async () => false)

export function useConfirm() {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve })
    })
  }, [])

  const close = (result: boolean) => {
    state?.resolve(result)
    setState(null)
  }

  const variantIcon = {
    danger: <Trash2 className="w-6 h-6" />,
    warning: <AlertTriangle className="w-6 h-6" />,
    info: <Info className="w-6 h-6" />,
  }

  const variantColor = {
    danger: {
      ring: "ring-rose-500/20",
      iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
      btn: "bg-rose-600 hover:bg-rose-700 text-white",
    },
    warning: {
      ring: "ring-amber-500/20",
      iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
      btn: "bg-amber-600 hover:bg-amber-700 text-white",
    },
    info: {
      ring: "ring-blue-500/20",
      iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
      btn: "bg-blue-600 hover:bg-blue-700 text-white",
    },
  }

  const v = state?.variant || "danger"

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {state && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => close(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.35 }}
              className={`relative w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl ring-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${variantColor[v].ring}`}
            >
              <button
                onClick={() => close(false)}
                className="absolute top-3 right-3 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center text-center gap-3">
                <div className={`p-3 rounded-2xl ${variantColor[v].iconBg}`}>
                  {variantIcon[v]}
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{state.title}</h3>
                {state.description && (
                  <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{state.description}</p>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  variant="outline"
                  className="flex-1 h-10 rounded-xl font-medium"
                  onClick={() => close(false)}
                >
                  {state.cancelLabel || "Cancel"}
                </Button>
                <button
                  className={`flex-1 h-10 rounded-xl font-medium text-sm transition-colors ${variantColor[v].btn}`}
                  onClick={() => close(true)}
                >
                  {state.confirmLabel || "Confirm"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  )
}

// ─── Toast Notifications ───

type ToastVariant = "success" | "error" | "info" | "warning"

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

type ToastFn = (message: string, variant?: ToastVariant) => void

const ToastContext = createContext<ToastFn>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const addToast = useCallback<ToastFn>((message, variant = "info") => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  const variantStyles: Record<ToastVariant, { bg: string; icon: React.ReactNode }> = {
    success: {
      bg: "bg-emerald-600",
      icon: <CheckCircle2 className="w-4 h-4 text-white" />,
    },
    error: {
      bg: "bg-rose-600",
      icon: <XCircle className="w-4 h-4 text-white" />,
    },
    info: {
      bg: "bg-blue-600",
      icon: <Info className="w-4 h-4 text-white" />,
    },
    warning: {
      bg: "bg-amber-500",
      icon: <AlertTriangle className="w-4 h-4 text-white" />,
    },
  }

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: "spring", duration: 0.35 }}
              className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${variantStyles[toast.variant].bg}`}
            >
              {variantStyles[toast.variant].icon}
              <span>{toast.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="ml-2 opacity-70 hover:opacity-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
