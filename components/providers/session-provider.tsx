"use client"

import { SessionProvider } from "next-auth/react"
import { ConfirmProvider, ToastProvider } from "@/components/ui/confirm-dialog"
import { ThemeProvider } from "@/components/providers/theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <ConfirmProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ConfirmProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
