'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Monitor,
  Moon,
  QrCode,
  ShoppingBasket,
  Sparkles,
  Sun,
} from 'lucide-react';
import {
  CUSTOMER_DISPLAY_CHANNEL,
  readLastCustomerDisplay,
} from '../lib/barcode-utils';
import { subscribeLiveDisplayFromFirestore } from '../lib/firestore-realtime';
import type { CustomerDisplaySnapshot } from '../types/erp';
import { UpiQrCodeSvg } from './QrAndBarcodeWidgets';
import { useMargBooks } from './MargBooksContext';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function CustomerDisplayPage() {
  const { workspace, theme, toggleTheme } = useMargBooks();
  const activeCompany =
    workspace.companies.find((c) => c.id === workspace.activeCompanyId) ||
    workspace.companies[0];

  const [selectedLane, setSelectedLane] = useState<string>(
    workspace.posCounters[0]?.counterCode || 'LANE-01'
  );
  const [snapshot, setSnapshot] = useState<CustomerDisplaySnapshot | null>(null);

  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      const initial = readLastCustomerDisplay();
      if (initial) setSnapshot(initial);
    }, 0);

    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data && typeof event.data === 'object') {
          const incoming = event.data as CustomerDisplaySnapshot;
          if (!incoming.counterCode || incoming.counterCode === selectedLane) {
            setSnapshot(incoming);
          }
        }
      };
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'freshmart-pos-display-snapshot' && e.newValue) {
        try {
          const incoming = JSON.parse(e.newValue) as CustomerDisplaySnapshot;
          if (!incoming.counterCode || incoming.counterCode === selectedLane) {
            setSnapshot(incoming);
          }
        } catch {
          // Ignore malformed snapshot
        }
      }
    };
    window.addEventListener('storage', onStorage);

    const unsubFirestore = subscribeLiveDisplayFromFirestore(
      workspace.activeCompanyId,
      selectedLane,
      (payload) => {
        setSnapshot({
          updatedAt: new Date().toISOString(),
          storeName: payload.storeName,
          branchName: payload.branchName,
          counterCode: payload.counterCode,
          customerName: payload.customerName,
          upiVpa: payload.upiVpa,
          lines: payload.lines.map((ln) => ({
            name: ln.name,
            qty: ln.qty,
            uqc: ln.uqc,
            mrp: ln.mrp,
            rate: ln.rate,
            lineTotal: ln.lineTotal,
          })),
          subtotal: payload.subtotal,
          totalTax: payload.totalTax,
          couponCode: payload.couponCode,
          couponDiscount: payload.couponDiscount,
          loyaltyDiscount: payload.loyaltyDiscount,
          totalMrpSavings: payload.totalMrpSavings,
          grandTotal: payload.grandTotal,
          upiAmount: payload.upiAmount,
          status: payload.status,
          lastInvoiceNo: payload.lastInvoiceNo || undefined,
        });
      }
    );

    return () => {
      window.clearTimeout(initTimer);
      if (channel) channel.close();
      window.removeEventListener('storage', onStorage);
      if (unsubFirestore) unsubFirestore();
    };
  }, [workspace.activeCompanyId, selectedLane]);

  const storeName = snapshot?.storeName || activeCompany?.name || 'FreshMart Superstore';
  const branchName = snapshot?.branchName || activeCompany?.branchName || 'Main Flagship Store';
  const upiVpa = snapshot?.upiVpa || workspace.controlRoom.upiVpa || 'freshmart@upi';
  const hasItems = Boolean(snapshot && snapshot.lines.length > 0);
  const activeCoupons = workspace.promoCoupons.filter((c) => c.active).slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Clean Minimal Pole Display Header */}
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white font-display font-bold text-lg">
            F
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
              {storeName}
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{branchName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{snapshot?.counterCode || 'LANE-01'}</span>
              <span aria-hidden="true">·</span>
              <span>Customer Live Display</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            aria-label="Monitor Checkout Lane"
            value={selectedLane}
            onChange={(e) => setSelectedLane(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs font-mono font-semibold text-slate-700 dark:text-slate-200"
          >
            {(workspace.posCounters.length > 0
              ? workspace.posCounters.map((c) => c.counterCode)
              : ['LANE-01', 'LANE-02', 'LANE-03']
            ).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle light or dark display"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <Link
            href="/admin/pos"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>POS Terminal</span>
          </Link>
        </div>
      </header>

      {/* Main Split Screen */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Live Itemized Shopping Tape or Welcome Offers */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShoppingBasket className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                {snapshot?.status === 'PAID'
                  ? 'Thank You For Shopping With Us'
                  : hasItems
                    ? `Live Basket · ${snapshot?.customerName || 'Walk-in Shopper'}`
                    : 'Welcome to FreshMart Superstore'}
              </h2>
            </div>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {hasItems ? `${snapshot!.lines.length} items scanned` : 'Ready at checkout'}
            </span>
          </div>

          {snapshot?.status === 'PAID' ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-4">
              <CheckCircle2 className="h-14 w-14 text-emerald-600 dark:text-emerald-400" />
              <div className="space-y-1">
                <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Payment Confirmed
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Bill {snapshot.lastInvoiceNo} completed · Please collect your receipt and carry bag.
                </p>
              </div>
              {snapshot.totalMrpSavings > 0 && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-5 py-3 text-base font-semibold text-emerald-800 dark:text-emerald-200 font-mono tabular-nums">
                  Total Saved Today: {formatInr(snapshot.totalMrpSavings)}
                </div>
              )}
            </div>
          ) : hasItems ? (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {snapshot!.lines.map((line, idx) => (
                <div
                  key={`${line.name}-${idx}`}
                  className="flex items-center justify-between gap-4 px-6 py-3.5"
                >
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {line.name}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {line.qty} {line.uqc} × ₹{line.rate.toFixed(2)}
                      {line.mrp > line.rate ? ` (MRP ₹${line.mrp})` : ''}
                    </div>
                  </div>
                  <div className="text-right font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                    {formatInr(line.lineTotal)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between p-8 space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <Monitor className="h-4 w-4" />
                  <span>Live Sync Active</span>
                </div>
                <h3 className="font-display text-3xl font-bold text-slate-900 dark:text-slate-100">
                  Fresh groceries, transparent MRP savings, instant UPI checkout.
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl">
                  Keep this window open on your customer-facing counter monitor. Items scanned on the Retail POS terminal appear here automatically in real time.
                </p>
              </div>

              {activeCoupons.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Today&apos;s In-Store Supermarket Offers
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {activeCoupons.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 space-y-1"
                      >
                        <div className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                          {c.code}
                        </div>
                        <div className="text-xs text-slate-700 dark:text-slate-300">
                          {c.description}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          Min bill ₹{c.minBillAmount}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right 5 Cols: Giant Total + Savings Banner + Dynamic Scannable UPI QR */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Payable Amount
            </div>
            <div className="font-mono text-5xl font-bold tracking-tight text-slate-950 dark:text-white tabular-nums">
              {formatInr(snapshot?.grandTotal || 0)}
            </div>

            {snapshot && snapshot.totalMrpSavings > 0 && (
              <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-emerald-900 dark:text-emerald-100">
                <Sparkles className="h-5 w-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <div className="text-sm font-semibold">
                  You Save{' '}
                  <span className="font-mono font-bold tabular-nums">
                    {formatInr(snapshot.totalMrpSavings)}
                  </span>{' '}
                  on MRP Today!
                </div>
              </div>
            )}

            {hasItems && (
              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">{formatInr(snapshot!.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>GST Included</span>
                  <span className="font-mono tabular-nums">{formatInr(snapshot!.totalTax)}</span>
                </div>
                {snapshot!.couponCode && snapshot!.couponDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                    <span>Coupon ({snapshot!.couponCode})</span>
                    <span className="font-mono tabular-nums">
                      -{formatInr(snapshot!.couponDiscount)}
                    </span>
                  </div>
                )}
                {snapshot!.loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                    <span>Loyalty Points Redeemed</span>
                    <span className="font-mono tabular-nums">
                      -{formatInr(snapshot!.loyaltyDiscount)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Scannable Dynamic UPI QR Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-5 flex flex-col items-center text-center space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <QrCode className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              <span>Scan &amp; Pay with Any UPI App</span>
            </div>
            <UpiQrCodeSvg
              vpa={upiVpa}
              payeeName={storeName}
              amount={snapshot?.upiAmount || snapshot?.grandTotal || 0}
              note={`POS Bill ${snapshot?.counterCode || 'LANE-01'}`}
              size={200}
            />
            <div className="text-xs text-slate-500 dark:text-slate-400">
              GPay · PhonePe · Paytm · BHIM · Exact bill amount pre-filled
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
