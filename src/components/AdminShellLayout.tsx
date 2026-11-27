'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, ScanBarcode, Search, X } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-teal-700 text-white flex items-center justify-center font-display font-bold text-sm">
              M
            </div>
            <div>
              <div className="font-display text-sm font-semibold text-slate-900">
                MargBooks Admin
              </div>
              <div className="text-xs text-slate-500">
                {authLoading ? 'Verifying Google session...' : 'Redirecting to sign in...'}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-2.5 w-3/4 rounded bg-slate-200 animate-pulse" />
            <div className="h-2.5 w-1/2 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const breadcrumb = resolveBreadcrumbFromPathname(pathname);

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <SidebarNav
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean 3-Zone Top Bar */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-4 border-b border-slate-200 bg-white px-3 sm:px-4 lg:px-6 py-3">
          {/* Zone 1: Contextual Breadcrumb */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden shrink-0 rounded-md border border-slate-200 p-1.5 text-slate-700 hover:bg-slate-50"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 text-sm min-w-0 overflow-hidden">
              <Link
                href="/admin/dashboard"
                className="font-semibold text-slate-900 whitespace-nowrap shrink-0 hover:text-teal-800"
              >
                MargBooks
              </Link>
              <span className="text-slate-300 hidden md:inline" aria-hidden="true">
                /
              </span>
              <span className="text-slate-600 truncate whitespace-nowrap hidden md:inline">
                {breadcrumb.section}
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-teal-800 truncate whitespace-nowrap hidden sm:inline">
                {breadcrumb.page}
              </span>
            </div>
          </div>

          {/* Zone 2 & 3: Search, Operator Account & Primary POS CTA */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/admin/search"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 whitespace-nowrap shrink-0"
              title="Global Search & Shortcuts (Alt+K)"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden md:inline">Search</span>
              <span className="hidden xl:inline font-mono text-[10px] text-slate-400">Alt+K</span>
            </Link>

            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600">
              <span className="font-medium text-slate-800 truncate max-w-[140px]">
                {user.displayName || user.email}
              </span>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="capitalize text-slate-500">{workspace.currentUserRole}</span>
            </div>

            <button
              type="button"
              onClick={() => void signOutUser()}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            {activeModule !== 'pos' && (
              <Link
                href="/admin/pos"
                className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
              >
                <ScanBarcode className="h-3.5 w-3.5 shrink-0" />
                <span>POS</span>
              </Link>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          {!workspaceLoaded ? (
            <div className="space-y-4 py-4">
              <div className="h-7 w-56 rounded bg-slate-200 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="h-24 rounded-lg border border-slate-200 bg-white animate-pulse" />
                <div className="h-24 rounded-lg border border-slate-200 bg-white animate-pulse" />
                <div className="h-24 rounded-lg border border-slate-200 bg-white animate-pulse" />
              </div>
              <div className="h-64 rounded-lg border border-slate-200 bg-white animate-pulse" />
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
              ? 'border-red-300 bg-red-50 text-red-900'
              : toast.tone === 'warning'
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-teal-300 bg-white text-slate-900'
          }`}
        >
          <span>{toast.title}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={clearToast}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
