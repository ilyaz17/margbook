'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Keyboard, Search } from 'lucide-react';
import { buildGlobalSearchResults, type GlobalSearchResultItem } from '../lib/erp-engine';
import { useMargBooks } from './MargBooksContext';

const CATEGORIES: Array<'All' | GlobalSearchResultItem['category']> = [
  'All',
  'Module',
  'Item',
  'Ledger',
  'Invoice',
  'Purchase',
  'Voucher',
];

const SHORTCUTS = [
  { keys: 'F2', label: 'Retail POS Terminal', desc: 'Touch-screen & barcode billing counter', href: '/admin/pos' },
  { keys: 'F6', label: 'Accounting Vouchers', desc: 'Receipt, Payment, Contra & Journal entries', href: '/admin/accounting' },
  { keys: 'F8', label: 'Sale & Billing Register', desc: 'GST invoices, estimates, challans & schemes', href: '/admin/sales' },
  { keys: 'F9', label: 'Purchase & CSV Import', desc: 'Supplier bills, purchase orders & rate compare', href: '/admin/purchases' },
  { keys: 'Alt + S', label: 'Shift Handover & Cash', desc: 'Cashier cash drawer count & variance log', href: '/admin/shifts' },
  { keys: 'Alt + C', label: 'Control Room', desc: 'POS rules, paper format & books rebuild', href: '/admin/control-room' },
  { keys: 'Alt + K', label: 'Global Search', desc: 'Jump to any item, ledger, bill, or module', href: '/admin/search' },
];

export function GlobalSearchPage() {
  const { workspace } = useMargBooks();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | GlobalSearchResultItem['category']>('All');

  const allResults = useMemo(
    () =>
      buildGlobalSearchResults(
        {
          items: workspace.items,
          ledgers: workspace.ledgers,
          invoices: workspace.invoices,
          purchases: workspace.purchases,
          vouchers: workspace.vouchers,
        },
        query
      ),
    [workspace, query]
  );

  const visibleResults = useMemo(
    () =>
      category === 'All'
        ? allResults.slice(0, 40)
        : allResults.filter((r) => r.category === category).slice(0, 40),
    [allResults, category]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Global Quick Search &amp; Keyboard Shortcuts
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Search across items, barcodes, HSN codes, party ledgers, bills, vouchers, and ERP modules.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Search Column */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type barcode, item name, customer, invoice number, or module..."
                className="w-full rounded-md border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              {CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Matching Records</span>
              <span className="font-mono tabular-nums">{visibleResults.length} shown</span>
            </div>

            {visibleResults.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No records matched &ldquo;{query}&rdquo;. Try searching by barcode, customer name, or
                invoice prefix.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleResults.map((res) => (
                  <Link
                    key={res.id}
                    href={res.href}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-teal-800 font-medium">
                        <span>{res.category}</span>
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900 truncate">
                        {res.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{res.subtitle}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-xs font-medium text-slate-700 tabular-nums">
                        {res.meta}
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* F-Key Directory Column */}
        <aside className="lg:col-span-4 rounded-lg border border-slate-200 bg-white p-5 h-fit space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Keyboard className="h-5 w-5 text-teal-700" />
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                MargBooks F-Key Directory
              </h2>
              <p className="text-xs text-slate-500">
                Active anywhere inside the Admin workspace.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {SHORTCUTS.map((sc) => (
              <Link
                key={sc.keys}
                href={sc.href}
                className="py-3 flex items-start justify-between gap-3 hover:text-teal-800 group"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 group-hover:text-teal-800">
                    {sc.label}
                  </div>
                  <div className="text-xs text-slate-500">{sc.desc}</div>
                </div>
                <kbd className="rounded border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-[11px] font-semibold text-slate-700 whitespace-nowrap shrink-0">
                  {sc.keys}
                </kbd>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
