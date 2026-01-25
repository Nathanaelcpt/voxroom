import type { Metadata } from "next"
import "./globals.css"
import Topbar from "@/components/topbar"
import { ThemeProvider } from "@/components/theme-provider"

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
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>
          <Topbar />

          <main className="pt-14">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
