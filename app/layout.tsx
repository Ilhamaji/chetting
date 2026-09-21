import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/providers/session-provider"

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: "Cheting - Real-time Chat",
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
      <head>
        <link rel="icon" href="/ceting-icon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/ceting-icon.svg" />
        <link rel="apple-touch-icon" href="/ceting-icon.svg" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
