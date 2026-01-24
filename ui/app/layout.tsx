import type { Metadata } from "next"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import "./globals.css" // ← Tambahkan ini

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
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <AppSidebar />

            <main className="flex-1 overflow-auto">
              <div className="p-4">
                <SidebarTrigger />
                {children}
              </div>
            </main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  )
}