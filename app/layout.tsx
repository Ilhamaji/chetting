import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/providers/session-provider"

export const metadata: Metadata = {
  title: "Chetting - Real-time Chat",
  description: "Real-time chat platform for communities and friends",
  icons: {
    icon: "/ceting-icon.svg",
    shortcut: "/ceting-icon.svg",
    apple: "/ceting-icon.svg",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
