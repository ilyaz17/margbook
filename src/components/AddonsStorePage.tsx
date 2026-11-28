'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CreditCard,
  Gauge,
  PackageX,
  Puzzle,
  Scale,
  Trash2,
  Truck,
  WifiOff,
} from 'lucide-react';
import { computeWastageSummary } from '../lib/erp-engine';
import type { AddonKey } from '../types/erp';
import { useMargBooks } from './MargBooksContext';

interface AddonDescriptor {
  key: AddonKey;
  title: string;
  category: string;
  description: string;
  href: string;
  actionLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ADDON_CATALOG: AddonDescriptor[] = [
  {
    key: 'offline_pwa',
    title: 'Offline-Ready PWA & Auto-Sync Queue',
    category: 'Checkout Continuity',
    description:
      'Install FreshMart POS as a native app on billing counters and keep scanning bills even if store internet drops, with automatic background sync on reconnect.',
    href: '/admin/pos',
    actionLabel: 'Open POS Terminal',
    icon: WifiOff,
  },
  {
    key: 'weighing_scale',
    title: 'Live Digital Weighing Scale Bridge',
    category: 'Produce & Deli Hardware',
    description:
      'Connect USB-Serial weighing scales via Web Serial API for live 0.000 KG weight readout, Tare zeroing, and 1-tap capture directly onto supermarket bills.',
    href: '/admin/pos',
    actionLabel: 'Test Scale in POS',
    icon: Scale,
  },
  {
    key: 'home_delivery',
    title: 'Home Delivery & WhatsApp Order Dispatch',
    category: 'Local Fulfillment',
    description:
      'Track local supermarket orders from Received to Packing, Out for Delivery, and Delivered with rider assignment, COD/UPI settlement, and WhatsApp updates.',
    href: '/admin/crm',
    actionLabel: 'Open Dispatch Board',
    icon: Truck,
  },
  {
    key: 'petty_cash_analytics',
    title: 'Cashier Speed Analytics & Daily Petty Cash',
    category: 'Floor Operations',
    description:
      'Log counter petty cash payouts automatically deducted from expected drawer cash and compare cashier checkout speed (seconds per bill & items/min).',
    href: '/admin/shifts',
    actionLabel: 'Open Shift & Petty Cash',
    icon: Gauge,
  },
  {
    key: 'membership_wallet',
    title: 'Membership Cards & Family Prepaid Wallet',
    category: 'Shopper Retention',
    description:
      'Issue Silver, Gold, and Family Plus cards with scannable card IDs, prepaid family wallet top-ups on customer ledgers, and instant Wallet POS checkout.',
    href: '/admin/masters',
    actionLabel: 'Manage Member Ledgers',
    icon: CreditCard,
  },
  {
    key: 'damage_claims',
    title: 'Supplier Return & Damage Claims Tracker',
    category: 'Vendor Recovery',
    description:
      'Log transit-damaged or near-expiry supplier stock, track vendor approval stages, and convert settled claims into Purchase Debit Notes in 1 click.',
    href: '/admin/purchases',
    actionLabel: 'Open Damage Claims',
    icon: PackageX,
  },
  {
    key: 'wastage_tracking',
    title: 'Perishable & Store Wastage / Shrinkage System',
    category: 'Margin Protection',
    description:
      'Write off spoiled fruits, unsold bakery, expired dairy, or breakage in decimal KG/units with automatic batch deduction, stock-loss journal, and shrinkage % KPIs.',
    href: '/admin/inventory',
    actionLabel: 'Open Wastage Register',
    icon: Trash2,
  },
];

export function AddonsStorePage() {
  const { workspace, dispatchAction, offlineQueue, broadcastOpsEvent } = useMargBooks();
  const [busyKey, setBusyKey] = useState<AddonKey | null>(null);
  const enabledAddons = workspace.controlRoom.enabledAddons;

  const activeCount = useMemo(
    () => ADDON_CATALOG.filter((a) => enabledAddons[a.key] !== false).length,
    [enabledAddons]
  );

  const wastageSummary = useMemo(
    () =>
      computeWastageSummary({
        wastageLogs: workspace.wastageLogs,
        invoices: workspace.invoices,
        asOfDate: new Date().toISOString().slice(0, 10),
      }),
    [workspace.wastageLogs, workspace.invoices]
  );

  const liveMetrics: Record<AddonKey, string> = useMemo(() => {
    const activeDeliveries = workspace.deliveryOrders.filter(
      (d) => d.stage !== 'DELIVERED'
    ).length;
    const totalPettyCash = workspace.pettyCashExpenses.reduce((s, p) => s + p.amount, 0);
    const totalWalletPool = workspace.ledgers.reduce((s, l) => s + (l.walletBalance || 0), 0);
    const openClaims = workspace.supplierDamageClaims.filter(
      (c) => c.status !== 'SETTLED'
    ).length;

    return {
      offline_pwa: `${offlineQueue.length} queued offline bill${offlineQueue.length === 1 ? '' : 's'}`,
      weighing_scale: `${workspace.items.filter((i) => i.isWeighed).length} weighed KG produce items`,
      home_delivery: `${activeDeliveries} active dispatch order${activeDeliveries === 1 ? '' : 's'}`,
      petty_cash_analytics: `₹${totalPettyCash.toLocaleString('en-IN')} petty cash logged`,
      membership_wallet: `₹${totalWalletPool.toLocaleString('en-IN')} active wallet pool`,
      damage_claims: `${openClaims} open vendor claim${openClaims === 1 ? '' : 's'}`,
      wastage_tracking: `₹${wastageSummary.totalLossAllTime.toLocaleString('en-IN')} shrinkage (${wastageSummary.wastagePercentOfSales}%)`,
    };
  }, [
    offlineQueue.length,
    wastageSummary.totalLossAllTime,
    wastageSummary.wastagePercentOfSales,
    workspace.deliveryOrders,
    workspace.items,
    workspace.ledgers,
    workspace.pettyCashExpenses,
    workspace.supplierDamageClaims,
  ]);

  const handleToggle = async (addon: AddonDescriptor) => {
    const nextState = !(enabledAddons[addon.key] !== false);
    setBusyKey(addon.key);
    const ok = await dispatchAction(
      'TOGGLE_ADDON',
      { addonKey: addon.key, enabled: nextState },
      `${addon.title} ${nextState ? 'enabled' : 'disabled'} for this store.`
    );
    if (ok) {
      broadcastOpsEvent({
        eventType: 'ADDON_TOGGLE',
        title: `${addon.title} ${nextState ? 'Enabled' : 'Disabled'}`,
        detail: `Store switched ${addon.key} add-on ${nextState ? 'ON' : 'OFF'}.`,
        severity: 'info',
      });
    }
    setBusyKey(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <Puzzle className="h-4 w-4" />
            <span>Store Feature Switchboard</span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Add-On Modules Store
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Turn supermarket power modules ON or OFF per branch. Enabled modules integrate cleanly
            inside your existing POS, Inventory, Purchase, Shift, and CRM workflows.
          </p>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Active Add-Ons</div>
            <div className="font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {activeCount} / {ADDON_CATALOG.length}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ADDON_CATALOG.map((addon) => {
          const Icon = addon.icon;
          const isEnabled = enabledAddons[addon.key] !== false;
          const isBusy = busyKey === addon.key;
          return (
            <section
              key={addon.key}
              className={`rounded-xl border p-5 transition-colors flex flex-col justify-between gap-4 ${
                isEnabled
                  ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]'
                  : 'border-slate-200/80 dark:border-slate-800/70 bg-slate-50/70 dark:bg-slate-900/40 opacity-85'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        isEnabled
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {addon.category}
                      </div>
                      <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {addon.title}
                      </h2>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    aria-label={`Toggle ${addon.title}`}
                    disabled={isBusy}
                    onClick={() => void handleToggle(addon)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                      isEnabled
                        ? 'bg-emerald-600 dark:bg-emerald-500'
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {addon.description}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                  {liveMetrics[addon.key]}
                </span>
                {isEnabled ? (
                  <Link
                    href={addon.href}
                    className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                  >
                    <span>{addon.actionLabel}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Disabled on this branch
                  </span>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
