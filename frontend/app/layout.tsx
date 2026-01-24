import type { Metadata } from "next"
import "./globals.css"
import Topbar from "@/components/topbar"

export const metadata: Metadata = {
  title: "VoxRoom",
  description: "Live Audio Room Platform",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body className="min-h-screen" suppressHydrationWarning>
        {/* Top Taskbar */}
        <Topbar />

        {/* Content */}
        <main className="pt-14">
          {children}
        </main>
      </body>
    </html>
  )
}
