'use client';

import React from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Barcode,
  BookOpen,
  Boxes,
  Building2,
  ClipboardCheck,
  FileCheck2,
  Landmark,
  LayoutDashboard,
  Plus,
  ReceiptIndianRupee,
  ScanBarcode,
  Search,
  Settings2,
  ShoppingCart,
  Store,
  Truck,
  X,
} from 'lucide-react';
import { MODULE_ROUTES, type RouteMeta } from '../lib/routes';
import type { ModuleId } from '../types/erp';
import { useMargBooks } from './MargBooksContext';

const ICON_MAP: Record<ModuleId, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  pos: ScanBarcode,
  shifts: ClipboardCheck,
  masters: BookOpen,
  sales: ReceiptIndianRupee,
  purchases: Truck,
  inventory: Boxes,
  barcodes: Barcode,
  accounting: ShoppingCart,
  banking: Landmark,
  gst: FileCheck2,
  crm: Store,
  reports: BarChart3,
  'company-setup': Building2,
  'control-room': Settings2,
  search: Search,
};

interface SidebarNavProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  collapsedDesktop?: boolean;
}

export function SidebarNav({
  mobileOpen,
  onCloseMobile,
  collapsedDesktop = false,
}: SidebarNavProps) {
  const { workspace, activeModule, switchCompany } = useMargBooks();
  const activeCompany =
    workspace.companies.find((c) => c.id === workspace.activeCompanyId) ||
    workspace.companies[0];

  const sections: RouteMeta['section'][] = ['Core', 'Operations', 'Finance & Tax', 'System'];

  const navContent = (
    <div className="flex h-full flex-col bg-[#071E1A] dark:bg-[#091217] text-slate-100">
      {/* Brand Wordmark */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <Link
          href="/admin/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-2.5 min-w-0"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-slate-950 font-display font-bold text-sm">
            M
          </div>
          <span className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap truncate">
            MargBooks
          </span>
        </Link>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Multi-Company & FY Selector */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label
            htmlFor="company-switcher"
            className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-200/80"
          >
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>Active Store</span>
          </label>
          <Link
            href="/admin/company/setup"
            onClick={onCloseMobile}
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-300 hover:text-white whitespace-nowrap"
          >
            <Plus className="h-3 w-3" />
            <span>Branch</span>
          </Link>
        </div>
        <select
          id="company-switcher"
          value={workspace.activeCompanyId}
          onChange={(e) => void switchCompany(Number(e.target.value))}
          className="w-full rounded-md border border-white/15 bg-[#041411] dark:bg-[#0B171E] px-2.5 py-1.5 text-xs font-medium text-white focus:border-emerald-400 focus:outline-none"
        >
          {workspace.companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {activeCompany && (
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300 font-mono tabular-nums">
            <span>FY {activeCompany.financialYear}</span>
            <span>{activeCompany.gstin.slice(0, 10)}…</span>
          </div>
        )}
      </div>

      {/* Module Navigation */}
      <nav aria-label="MargBooks Modules" className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {sections.map((section) => {
          const items = MODULE_ROUTES.filter((item) => item.section === section);
          return (
            <div key={section}>
              <div className="px-2.5 pb-1 text-[11px] font-medium text-emerald-200/55">
                {section}
              </div>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = ICON_MAP[item.id];
                  const isActive = activeModule === item.id;
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        onClick={onCloseMobile}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-full flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-200 hover:bg-white/8 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.shortcut && (
                          <span
                            className={`font-mono text-[10px] shrink-0 ${
                              isActive ? 'text-emerald-100' : 'text-slate-400'
                            }`}
                          >
                            {item.shortcut}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Quiet Footer Info */}
      <div className="border-t border-white/10 px-4 py-3 text-[11px] text-slate-400">
        <div className="truncate text-slate-200 font-medium">
          {activeCompany?.branchName}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span>{activeCompany?.fyLocked ? 'FY Locked' : 'Books Open'}</span>
          <span className="capitalize text-emerald-300/80">{workspace.currentUserRole}</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {!collapsedDesktop && (
        <aside className="no-print hidden lg:block w-64 shrink-0 border-r border-slate-200 dark:border-slate-800">
          {navContent}
        </aside>
      )}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 max-w-[82vw] h-full shadow-xl">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
