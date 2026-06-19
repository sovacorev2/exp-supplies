import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from './providers'

export const metadata: Metadata = {
  title: 'Exp Forms',
  description: 'Data collection forms platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 antialiased transition-colors">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
