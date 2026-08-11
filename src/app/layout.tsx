import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pizarra',
  description: 'Whiteboard colaborativo con Supabase',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <Script src="https://js.puter.com/v2/" strategy="afterInteractive" data-puter-sdk="v2" />
      </body>
    </html>
  )
}
