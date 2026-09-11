'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Zap, Menu, Sun, Moon } from 'lucide-react';
import { OnboardingModal } from '@/components/ui/OnboardingModal';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const isLoginPage = pathname === '/login';

  // Show modal ONLY on fresh login via login screen (not on page refresh)
  useEffect(() => {
    if (isAuthenticated && !loading) {
      const justLoggedIn = sessionStorage.getItem('just_logged_in') === 'true';
      const onboardingSeen = sessionStorage.getItem('onboarding_seen') === 'true';

      if (justLoggedIn && !onboardingSeen) {
        setShowOnboarding(true);
        sessionStorage.setItem('onboarding_seen', 'true');
        sessionStorage.removeItem('just_logged_in');
      }
    }
  }, [isAuthenticated, loading]);

  // Automatically close mobile menu on route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-ey-black flex flex-col items-center justify-center space-y-4">
        <div className="p-3 bg-ey-yellow rounded-xl text-ey-black animate-bounce shadow-lg shadow-yellow-500/20">
          <Zap className="w-8 h-8 fill-current" />
        </div>
        <p className="text-ey-muted text-xs tracking-wide">Authenticating AI Analytics...</p>
      </div>
    );
  }

  if (isLoginPage) {
    return <main className="min-h-screen w-full bg-ey-black">{children}</main>;
  }

  if (!isAuthenticated) {
    return null; // Will redirect via AuthContext
  }

  return (
    <div className="flex min-h-screen w-full bg-ey-black text-ey-light relative">
      <Sidebar
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        isDesktopCollapsed={isDesktopCollapsed}
        setIsDesktopCollapsed={setIsDesktopCollapsed}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Mobile Navbar Header */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-ey-card border-b border-ey-border shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              aria-label="Open sidebar menu"
              className="p-2 rounded-lg text-ey-muted hover:text-ey-light hover:bg-ey-card-hover focus:outline-none focus:ring-2 focus:ring-ey-yellow/40 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-ey-yellow rounded-md text-ey-black shadow-md shadow-yellow-500/10">
                <Zap className="w-4 h-4 fill-current" />
              </div>
              <span className="font-bold text-xs tracking-wide text-ey-light">AI Analytics</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              className="p-1.5 rounded-lg text-ey-yellow hover:bg-ey-card-hover transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <span className="text-[10px] text-ey-yellow font-semibold px-2 py-0.5 rounded bg-ey-yellow/10 border border-ey-yellow/20">
              Mobile
            </span>
          </div>
        </header>

        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>

      {/* Onboarding modal — shown after every login */}
      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}
