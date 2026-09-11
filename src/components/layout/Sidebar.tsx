'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Building2,
  ChevronRight,
  Zap,
  LogOut,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  Database,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

const NAV_ITEMS = [
  { name: 'Executive Overview', href: '/', icon: LayoutDashboard },
  { name: 'Token & Spend ROI', href: '/dashboard/roi', icon: DollarSign },
  { name: 'Org & Regional Analytics', href: '/dashboard/teams', icon: Building2 },
  { name: 'Metrics Derivation Guide', href: '/dashboard/metrics-derivation', icon: BookOpen },
  { name: 'Admin & Data Upload', href: '/dashboard/admin', icon: Database },
];

interface SidebarProps {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  isDesktopCollapsed: boolean;
  setIsDesktopCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Sidebar({
  isMobileOpen,
  setIsMobileOpen,
  isDesktopCollapsed,
  setIsDesktopCollapsed,
}: SidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [datasetName, setDatasetName] = useState<string>('ai_usage_data.csv');
  const [isCustom, setIsCustom] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/admin/dataset')
      .then((res) => res.json())
      .then((data) => {
        if (data?.fileName) {
          setDatasetName(data.fileName);
          setIsCustom(!!data.isCustom);
        }
      })
      .catch(() => { });
  }, [pathname]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-200"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`bg-ey-card border-r border-ey-border text-ey-light flex flex-col h-screen fixed top-0 left-0 z-50 transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:z-30 shrink-0 ${isMobileOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full lg:translate-x-0'
          } ${isDesktopCollapsed ? 'lg:w-16' : 'lg:w-64'
          }`}
      >
        {/* Brand Header */}
        <div className="border-b border-ey-border">
          {isDesktopCollapsed && !isMobileOpen ? (
            /* Collapsed Header layout (Desktop) */
            <div className="hidden lg:flex flex-col items-center justify-center p-3 space-y-2">
              <div
                title="AI Usage Analytics"
                className="p-2 bg-ey-yellow rounded-lg text-ey-black shadow-lg shadow-yellow-500/10 shrink-0"
              >
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <button
                onClick={() => setIsDesktopCollapsed(false)}
                title="Expand Sidebar"
                className="p-1.5 hover:bg-ey-card-hover text-ey-muted hover:text-ey-yellow rounded-md transition-colors"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Expanded Header layout (Desktop & Mobile) */
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="p-2 bg-ey-yellow rounded-lg text-ey-black shadow-lg shadow-yellow-500/10 shrink-0">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-bold text-ey-light text-sm tracking-wide truncate">AI Usage Analytics</h1>
                  <p className="text-xs text-ey-yellow font-semibold truncate">CSV Token &amp; Cost Engine</p>
                </div>
              </div>

              {/* Desktop Collapse Toggle Button */}
              <button
                onClick={() => setIsDesktopCollapsed(true)}
                title="Collapse Sidebar"
                className="hidden lg:flex p-1.5 hover:bg-ey-card-hover text-ey-muted hover:text-ey-light rounded-md transition-colors"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>

              {/* Mobile Close Button */}
              <button
                onClick={() => setIsMobileOpen(false)}
                aria-label="Close sidebar menu"
                className="lg:hidden p-1.5 hover:bg-ey-card-hover text-ey-muted hover:text-ey-light rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          {/* {(!isDesktopCollapsed || isMobileOpen) && (
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ey-muted">
              CSV Analytics Pages ({NAV_ITEMS.length})
            </div>
          )} */}

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            const isCollapsed = isDesktopCollapsed && !isMobileOpen;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                title={isCollapsed ? item.name : undefined}
                className={`flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
                  } rounded-md text-xs font-medium transition-all duration-150 ${isActive
                    ? 'bg-ey-yellow/15 text-ey-yellow border border-ey-yellow/30 font-semibold'
                    : 'hover:bg-ey-card-hover hover:text-ey-light text-ey-muted'
                  }`}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2.5 min-w-0'}`}>
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-ey-yellow' : 'text-ey-muted'}`} />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </div>
                {!isCollapsed && isActive && <ChevronRight className="w-3.5 h-3.5 text-ey-yellow shrink-0 ml-1" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer info & User session */}
        <div className="p-3 border-t border-ey-border space-y-2">
          <div className={`flex items-center justify-between bg-ey-black/40 p-2 rounded-lg border border-ey-border/60 ${isDesktopCollapsed && !isMobileOpen ? 'flex-col items-center justify-center p-1.5 gap-2' : ''
            }`}>
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-ey-yellow/20 border border-ey-yellow/40 flex items-center justify-center text-ey-yellow font-bold text-xs shrink-0">
                N
              </div>
              {(!isDesktopCollapsed || isMobileOpen) && (
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ey-light truncate">admin</p>
                  <p className="text-[10px] text-ey-muted truncate">Enterprise Admin</p>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-1 shrink-0">
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
                className="p-1.5 hover:bg-ey-card-hover text-ey-yellow rounded-md transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={logout}
                title="Log Out"
                className="p-1.5 hover:bg-red-500/20 text-ey-muted hover:text-red-400 rounded-md transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {(!isDesktopCollapsed || isMobileOpen) && (
            <div className="text-[10px] text-ey-muted flex items-center justify-between px-1">
              <span>CSV Engine</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border truncate max-w-[120px] ${isCustom
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                {datasetName}
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

