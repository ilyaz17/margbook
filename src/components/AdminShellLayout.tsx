'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  ScanBarcode,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { resolveBreadcrumbFromPathname } from '../lib/routes';
import { useMargBooks } from './MargBooksContext';
import { SidebarNav } from './SidebarNav';

export function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '/admin/dashboard';
  const {
    workspace,
    workspaceLoaded,
    activeModule,
    user,
    authLoading,
    signOutUser,
    toast,
    clearToast,
    theme,
    toggleTheme,
    posFocusMode,
    togglePosFocusMode,
  } = useMargBooks();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Strict Route Guard: Unauthenticated visitors are redirected to /login?next=...
  useEffect(() => {
    if (!authLoading && !user) {
      const target = `/login?next=${encodeURIComponent(pathname)}`;
      router.replace(target);
    }
  }, [authLoading, user, pathname, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B1120] px-6">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-emerald-700 text-white flex items-center justify-center font-display font-bold text-sm">
              M
            </div>
            <div>
              <div className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                MargBooks Admin
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {authLoading ? 'Verifying Google session...' : 'Redirecting to sign in...'}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-2.5 w-3/4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Full-bleed Customer Live Display bypasses the admin chrome completely
  if (pathname.startsWith('/admin/pos/customer-display')) {
    return <>{children}</>;
  }

  const isPosPage = pathname === '/admin/pos';
  const isCollapsedDesktop = isPosPage && posFocusMode;
  const breadcrumb = resolveBreadcrumbFromPathname(pathname);

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 transition-colors">
      <SidebarNav
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        collapsedDesktop={isCollapsedDesktop}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean 3-Zone Top Bar */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-3 sm:px-4 lg:px-6 py-2.5">
          {/* Zone 1: Contextual Breadcrumb */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden shrink-0 rounded-md border border-slate-200 dark:border-slate-700 p-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 text-sm min-w-0 overflow-hidden">
              <Link
                href="/admin/dashboard"
                className="font-display font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 hover:text-emerald-700 dark:hover:text-emerald-400"
              >
                MargBooks
              </Link>
              <span className="text-slate-300 dark:text-slate-700 hidden md:inline" aria-hidden="true">
                /
              </span>
              <span className="text-slate-600 dark:text-slate-400 truncate whitespace-nowrap hidden md:inline">
                {breadcrumb.section}
              </span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-emerald-700 dark:text-emerald-400 truncate whitespace-nowrap hidden sm:inline">
                {breadcrumb.page}
              </span>
            </div>
          </div>

          {/* Zone 2 & 3: Search, Light/Dark Switch, Focus Toggle, Account & POS CTA */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <Link
              href="/admin/search"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0"
              title="Global Search & Shortcuts (Alt+K)"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden md:inline">Search</span>
              <span className="hidden xl:inline font-mono text-[10px] text-slate-400">Alt+K</span>
            </Link>

            {isPosPage && (
              <button
                type="button"
                onClick={togglePosFocusMode}
                title={posFocusMode ? 'Exit Full-Screen POS Mode' : 'Full-Screen POS Focus Mode'}
                className="hidden lg:inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-emerald-500 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {posFocusMode ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Show Menu</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Focus POS</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} checkout theme`}
              title={theme === 'dark' ? 'Switch to Daylight Light Mode' : 'Switch to Dark Checkout Mode'}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-slate-600 shrink-0" />
              )}
              <span className="hidden xl:inline">
                {theme === 'dark' ? 'Daylight' : 'Dark POS'}
              </span>
            </button>

            <div className="hidden xl:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 pl-1">
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                {user.displayName || user.email}
              </span>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                ·
              </span>
              <span className="capitalize text-slate-500 dark:text-slate-400">
                {workspace.currentUserRole}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void signOutUser()}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            {activeModule !== 'pos' && (
              <Link
                href="/admin/pos"
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-white whitespace-nowrap shrink-0"
              >
                <ScanBarcode className="h-3.5 w-3.5 shrink-0" />
                <span>POS</span>
              </Link>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main
          className={`flex-1 w-full mx-auto ${
            isCollapsedDesktop ? 'p-3 lg:p-4 max-w-none' : 'p-4 lg:p-6 max-w-[1440px]'
          }`}
        >
          {!workspaceLoaded ? (
            <div className="space-y-4 py-4">
              <div className="h-7 w-56 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="h-24 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] animate-pulse" />
                <div className="h-24 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] animate-pulse" />
                <div className="h-24 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] animate-pulse" />
              </div>
              <div className="h-64 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] animate-pulse" />
            </div>
          ) : (
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          )}
        </main>
      </div>

      {/* Non-intrusive Action Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`no-print fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-lg border px-4 py-3 text-xs font-medium shadow-lg ${
            toast.tone === 'error'
              ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100'
              : toast.tone === 'warning'
                ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100'
                : 'border-emerald-300 dark:border-emerald-800 bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100'
          }`}
        >
          <span>{toast.title}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={clearToast}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
