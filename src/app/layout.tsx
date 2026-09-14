import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AppShell } from '@/components/layout/AppShell';

// Self-hosted from src/app/fonts/ instead of next/font/google, so the build
// never has to reach out to Google's font servers — same Inter variable font,
// zero external requests at any point.
const inter = localFont({
  src: './fonts/Inter-Variable.woff2',
  variable: '--font-inter',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'GitHub Copilot Usage & ROI Enterprise Dashboard',
  description: 'Production-ready analytics, adoption tracking, and ROI measurement for GitHub Copilot.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-ey-black text-ey-light antialiased min-h-screen`}>
        <ThemeProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

