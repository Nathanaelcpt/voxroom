"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <NextThemesProvider
      attribute="class"      // ⬅️ INI KUNCI UTAMA
      defaultTheme="light"   // biar jelas kelihatan
      enableSystem={false}   // matikan override OS dulu
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
