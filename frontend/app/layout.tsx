import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600"],
})

export const metadata: Metadata = {
  title: "Cerno Docs",
  description: "AI-powered document intelligence and question-answering system",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="font-sans antialiased bg-black text-white">
        <Suspense
          fallback={
            <div className="min-h-screen bg-black text-white flex items-center justify-center text-sm">Loading...</div>
          }
        >
          {children}
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
