'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ScanBarcode,
  Shield,
  Users,
} from 'lucide-react';
import { calculateShiftVariance } from '../lib/erp-engine';
import type { UserAccessRole } from '../types/erp';
import { useMargBooks } from './MargBooksContext';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const ROLE_OPTIONS: Array<{
  role: UserAccessRole;
  label: string;
  scope: string;
}> = [
  { role: 'admin', label: 'Admin', scope: 'Full ERP, Control Room, FY Lock, Branches & Shift Audits' },
  { role: 'manager', label: 'Store Manager', scope: 'POS, Inventory, Purchases, Returns & Shift Handovers' },
  { role: 'cashier', label: 'POS Cashier', scope: 'Retail POS Billing, Thermal Print & Shift Cash Count' },
  { role: 'accountant', label: 'GST Accountant', scope: 'Vouchers, Banking PDC, GSTR-1/2B/3B & P&L Reports' },
];

export function ShiftHandoverPage() {
  const { workspace, dispatchAction, syncing } = useMargBooks();
  const [selectedCounterId, setSelectedCounterId] = useState<number>(
    workspace.posCounters[0]?.id || 1
  );

  const selectedCounter = useMemo(
    () =>
      workspace.posCounters.find((c) => c.id === selectedCounterId) ||
      workspace.posCounters[0],
    [workspace.posCounters, selectedCounterId]
  );

  const expectedDefaultCash = selectedCounter
    ? selectedCounter.openingCash + selectedCounter.cashSales
    : 0;

  const [countedCashInput, setCountedCashInput] = useState<string>(
    String(expectedDefaultCash)
  );
  const [incomingOperator, setIncomingOperator] = useState<string>('Neha Kapoor');
  const [shiftAction, setShiftAction] = useState<'HANDED_OVER' | 'CLOSED' | 'OPENED'>(
    'HANDED_OVER'
  );
  const [nextOpeningCash, setNextOpeningCash] = useState<string>('5000');
  const [resetSales, setResetSales] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  const handleCounterChange = (nextId: number) => {
    setSelectedCounterId(nextId);
    const c = workspace.posCounters.find((pc) => pc.id === nextId);
    if (c) {
      setCountedCashInput(String(c.openingCash + c.cashSales));
    }
  };

  const variance = useMemo(() => {
    if (!selectedCounter) {
      return calculateShiftVariance({
        openingCash: 0,
        cashSales: 0,
        upiSales: 0,
        cardSales: 0,
        walletSales: 0,
        pdcSales: 0,
        countedCash: 0,
      });
    }
    return calculateShiftVariance({
      openingCash: selectedCounter.openingCash,
      cashSales: selectedCounter.cashSales,
      upiSales: selectedCounter.upiSales,
      cardSales: selectedCounter.cardSales,
      walletSales: selectedCounter.walletSales,
      pdcSales: selectedCounter.pdcSales,
      countedCash: Number(countedCashInput || 0),
    });
  }, [selectedCounter, countedCashInput]);

  const totalsAcrossCounters = useMemo(() => {
    return workspace.posCounters.reduce(
      (acc, pc) => ({
        openingCash: acc.openingCash + pc.openingCash,
        cashSales: acc.cashSales + pc.cashSales,
        upiSales: acc.upiSales + pc.upiSales,
        cardSales: acc.cardSales + pc.cardSales,
        walletSales: acc.walletSales + pc.walletSales,
        pdcSales: acc.pdcSales + pc.pdcSales,
      }),
      { openingCash: 0, cashSales: 0, upiSales: 0, cardSales: 0, walletSales: 0, pdcSales: 0 }
    );
  }, [workspace.posCounters]);

  const handleSubmitHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCounter) return;
    const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const ok = await dispatchAction(
      'RECORD_SHIFT_HANDOVER',
      {
        counterId: selectedCounter.id,
        outgoingOperator: selectedCounter.operatorName,
        outgoingRole: selectedCounter.operatorRole,
        incomingOperator: incomingOperator.trim() || 'Store Admin',
        shiftStatus: shiftAction,
        countedCash: Number(countedCashInput || 0),
        nextOpeningCash: Number(nextOpeningCash || selectedCounter.openingCash),
        resetSales,
        notes: notes.trim(),
        handedOverAt: nowStamp,
      },
      `Shift handover recorded for ${selectedCounter.counterCode}.`
    );
    if (ok) {
      setNotes('');
    }
  };

  const handleRoleSwitch = async (role: UserAccessRole) => {
    await dispatchAction(
      'UPDATE_USER_ROLE',
      { role },
      `Active operator role updated to ${role}.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Shift Handover &amp; Day-End Cash Summary
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Multi-counter drawer reconciliation, cashier-to-admin handovers, and role-based access
            controls.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/pos"
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
          >
            <ScanBarcode className="h-3.5 w-3.5" />
            <span>Open Retail POS (F2)</span>
          </Link>
        </div>
      </div>

      {/* Consolidated Store Day-End Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Expected Drawer Cash (All Counters)</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
            {formatInr(totalsAcrossCounters.openingCash + totalsAcrossCounters.cashSales)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Float {formatInr(totalsAcrossCounters.openingCash)} + Cash{' '}
            {formatInr(totalsAcrossCounters.cashSales)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">UPI &amp; Wallet Collections</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
            {formatInr(totalsAcrossCounters.upiSales + totalsAcrossCounters.walletSales)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            UPI {formatInr(totalsAcrossCounters.upiSales)} · Wallet{' '}
            {formatInr(totalsAcrossCounters.walletSales)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Card &amp; PDC Settlements</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
            {formatInr(totalsAcrossCounters.cardSales + totalsAcrossCounters.pdcSales)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Card {formatInr(totalsAcrossCounters.cardSales)} · PDC{' '}
            {formatInr(totalsAcrossCounters.pdcSales)}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Active Counters</div>
          <div className="mt-1 font-mono text-xl font-bold text-teal-800 tabular-nums">
            {workspace.posCounters.filter((c) => c.status === 'OPEN').length} /{' '}
            {workspace.posCounters.length} Open
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {workspace.shiftHandovers.length} recorded shift handovers
          </div>
        </div>
      </div>

      {/* Main Grid: Record Handover Form + Active Role Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Handover Form */}
        <form
          onSubmit={(e) => void handleSubmitHandover(e)}
          className="lg:col-span-7 rounded-lg border border-slate-200 bg-white p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-teal-700" />
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Log Counter Shift Handover &amp; Cash Count
                </h2>
                <p className="text-xs text-slate-500">
                  Verify physical drawer cash against system totals before handing over or closing.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="shift-counter"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                POS Counter
              </label>
              <select
                id="shift-counter"
                value={selectedCounter?.id || ''}
                onChange={(e) => handleCounterChange(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                {workspace.posCounters.map((pc) => (
                  <option key={pc.id} value={pc.id}>
                    {pc.counterCode} — {pc.operatorName} ({pc.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="shift-action"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Shift Action
              </label>
              <select
                id="shift-action"
                value={shiftAction}
                onChange={(e) =>
                  setShiftAction(e.target.value as 'HANDED_OVER' | 'CLOSED' | 'OPENED')
                }
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                <option value="HANDED_OVER">Handover Shift to Incoming Operator</option>
                <option value="CLOSED">Close Counter for Day-End</option>
                <option value="OPENED">Open / Re-Open Counter Shift</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="incoming-operator"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Incoming / Receiving Operator
              </label>
              <input
                id="incoming-operator"
                type="text"
                required
                value={incomingOperator}
                onChange={(e) => setIncomingOperator(e.target.value)}
                placeholder="e.g. Neha Kapoor"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="counted-cash"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Physical Cash Counted (INR)
              </label>
              <input
                id="counted-cash"
                type="number"
                step="0.01"
                required
                value={countedCashInput}
                onChange={(e) => setCountedCashInput(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="next-opening-float"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Next Shift Opening Float (INR)
              </label>
              <input
                id="next-opening-float"
                type="number"
                step="1"
                value={nextOpeningCash}
                onChange={(e) => setNextOpeningCash(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetSales}
                  onChange={(e) => setResetSales(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                <span>Reset counter daily sales tallies after handover</span>
              </label>
            </div>
          </div>

          {/* Live Variance Box */}
          <div
            className={`rounded-lg border p-4 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
              variance.varianceStatus === 'MATCHED'
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                : variance.varianceStatus === 'EXCESS'
                  ? 'border-amber-200 bg-amber-50/70 text-amber-900'
                  : 'border-red-200 bg-red-50/70 text-red-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {variance.varianceStatus === 'MATCHED' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
              )}
              <div>
                <div className="font-semibold">
                  Drawer Status: {variance.varianceStatus}
                </div>
                <div>
                  Expected Cash {formatInr(variance.expectedCash)} · Digital{' '}
                  {formatInr(variance.totalDigitalCollection)}
                </div>
              </div>
            </div>
            <div className="font-mono text-sm font-bold tabular-nums">
              Variance: {variance.cashVariance >= 0 ? '+' : ''}
              {formatInr(variance.cashVariance)}
            </div>
          </div>

          <div>
            <label
              htmlFor="shift-notes"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Handover Remarks / Shortage Explanation
            </label>
            <textarea
              id="shift-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cash sealed in safe envelope, UPI settlement matched with HDFC app."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={syncing || !selectedCounter}
              className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
            >
              <span>{syncing ? 'Saving Shift Log...' : 'Save Shift Handover'}</span>
            </button>
          </div>
        </form>

        {/* Role-Based Access Control Panel */}
        <div className="lg:col-span-5 rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            <Shield className="h-5 w-5 text-teal-700" />
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Operator Role &amp; Access Scope
              </h2>
              <p className="text-xs text-slate-500">
                Current session role saved to your company audit ledger for access control.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {ROLE_OPTIONS.map((opt) => {
              const active = workspace.currentUserRole === opt.role;
              return (
                <button
                  key={opt.role}
                  type="button"
                  onClick={() => void handleRoleSwitch(opt.role)}
                  className={`w-full text-left rounded-lg border p-3.5 transition-colors cursor-pointer ${
                    active
                      ? 'border-teal-600 bg-teal-50/50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                    <span>{opt.label}</span>
                    <span className="text-xs font-medium text-teal-800">
                      {active ? 'Active Role' : 'Switch'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{opt.scope}</div>
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-2">
              <Users className="h-3.5 w-3.5 text-slate-500" />
              <span>Counter Roster</span>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {workspace.posCounters.map((pc) => (
                <div key={pc.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">
                      {pc.counterCode} · {pc.operatorName}
                    </div>
                    <div className="text-slate-500">{pc.operatorRole}</div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="font-semibold text-slate-900">
                      {formatInr(pc.openingCash + pc.cashSales)}
                    </div>
                    <div className={pc.status === 'OPEN' ? 'text-emerald-700' : 'text-slate-500'}>
                      {pc.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Shift Handover Audit History */}
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Shift Handover Audit Register
          </h2>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {workspace.shiftHandovers.length} entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Timestamp &amp; Counter</th>
                <th className="px-4 py-3 font-medium">Handover Path</th>
                <th className="px-4 py-3 text-right font-medium">Expected Cash</th>
                <th className="px-4 py-3 text-right font-medium">Counted Cash</th>
                <th className="px-4 py-3 text-right font-medium">Variance</th>
                <th className="px-5 py-3 font-medium">Status &amp; Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workspace.shiftHandovers.map((sh) => (
                <tr key={sh.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3">
                    <div className="font-mono text-xs font-semibold text-slate-900">
                      {sh.counterCode}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">{sh.handedOverAt}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium text-slate-900">
                      {sh.outgoingOperator} → {sh.incomingOperator}
                    </div>
                    <div className="text-slate-500">{sh.outgoingRole}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                    {formatInr(sh.expectedCash)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                    {formatInr(sh.countedCash)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-semibold tabular-nums ${
                      Math.abs(sh.cashVariance) < 0.01
                        ? 'text-emerald-700'
                        : sh.cashVariance > 0
                          ? 'text-amber-700'
                          : 'text-red-700'
                    }`}
                  >
                    {sh.cashVariance >= 0 ? '+' : ''}
                    {formatInr(sh.cashVariance)}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 max-w-xs">
                    <div className="font-medium text-slate-800">
                      {sh.shiftStatus.replace('_', ' ')}
                    </div>
                    <div className="truncate">{sh.notes || 'No variance notes'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
