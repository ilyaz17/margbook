'use client';

import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  FileCheck2,
  ReceiptIndianRupee,
  ScanBarcode,
  Settings2,
  Truck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { classifyExpiryStatus } from '../lib/erp-engine';
import { useMargBooks } from './MargBooksContext';

function formatInr(value: number): string {
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function DashboardModule() {
  const { workspace, financials, setActiveModule } = useMargBooks();
  const activeCompany =
    workspace.companies.find((c) => c.id === workspace.activeCompanyId) ||
    workspace.companies[0];

  const today = '2026-11-26';

  const trendData = useMemo(() => {
    const base = [
      { day: '21 Nov', sales: 34200, purchases: 18500, expenses: 4200 },
      { day: '22 Nov', sales: 41800, purchases: 42784, expenses: 5100 },
      { day: '23 Nov', sales: 29650, purchases: 12400, expenses: 3800 },
      { day: '24 Nov', sales: 60480, purchases: 31806, expenses: 6400 },
      { day: '25 Nov', sales: 49200, purchases: 21000, expenses: 14500 },
    ];
    const todaySales = workspace.invoices
      .filter(
        (i) =>
          i.invoiceDate === today &&
          (i.docType === 'POS_BILL' || i.docType === 'GST_INVOICE')
      )
      .reduce((s, i) => s + i.grandTotal, 0);
    const todayPurchases = workspace.purchases
      .filter((p) => p.billDate === today && p.docType === 'PURCHASE_BILL')
      .reduce((s, p) => s + p.grandTotal, 0);
    return [
      ...base,
      {
        day: '26 Nov',
        sales: Math.max(24800, Math.round(todaySales + 24800)),
        purchases: Math.round(todayPurchases + 16800),
        expenses: 8200,
      },
    ];
  }, [workspace.invoices, workspace.purchases]);

  const expiryAlerts = useMemo(() => {
    return workspace.batches
      .map((b) => {
        const item = workspace.items.find((i) => i.id === b.itemId);
        const cls = classifyExpiryStatus(
          b.expiryDate,
          today,
          workspace.controlRoom.nearExpiryAlertDays
        );
        return {
          ...b,
          itemName: item?.name || 'Unknown SKU',
          rack: item?.rackLocation || '-',
          ...cls,
        };
      })
      .filter((b) => b.status !== 'HEALTHY' && b.qtyOnHand > 0)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [workspace.batches, workspace.items, workspace.controlRoom.nearExpiryAlertDays]);

  const lowStockItems = useMemo(() => {
    return workspace.items
      .map((item) => {
        const totalQty = workspace.batches
          .filter((b) => b.itemId === item.id)
          .reduce((s, b) => s + b.qtyOnHand, 0);
        return { ...item, totalQty };
      })
      .filter((item) => item.totalQty <= item.reorderLevel);
  }, [workspace.items, workspace.batches]);

  const counterTotals = useMemo(() => {
    return workspace.posCounters.reduce(
      (acc, c) => ({
        openingCash: acc.openingCash + c.openingCash,
        cash: acc.cash + c.cashSales,
        upi: acc.upi + c.upiSales,
        card: acc.card + c.cardSales,
        wallet: acc.wallet + c.walletSales,
        pdc: acc.pdc + c.pdcSales,
      }),
      { openingCash: 0, cash: 0, upi: 0, card: 0, wallet: 0, pdc: 0 }
    );
  }, [workspace.posCounters]);

  const kpis = [
    {
      label: 'Total Sales (Net GST)',
      value: formatInr(financials.totalSales),
      sub: `${workspace.invoices.filter((i) => i.docType === 'POS_BILL' || i.docType === 'GST_INVOICE').length} posted invoices`,
      action: () => setActiveModule('sales'),
    },
    {
      label: 'Total Purchases',
      value: formatInr(financials.totalPurchases),
      sub: `Input ITC ${formatInr(financials.inputGstItc)}`,
      action: () => setActiveModule('purchases'),
    },
    {
      label: 'Receivables (Debtors)',
      value: formatInr(financials.totalReceivables),
      sub: `${workspace.ledgers.filter((l) => l.groupType === 'Customer' && l.currentBalance > 0).length} active accounts`,
      action: () => setActiveModule('accounting'),
    },
    {
      label: 'Payables (Creditors)',
      value: formatInr(financials.totalPayables),
      sub: `${workspace.ledgers.filter((l) => l.groupType === 'Supplier' && l.currentBalance > 0).length} supplier ledgers`,
      action: () => setActiveModule('accounting'),
    },
    {
      label: 'Cash & Bank Balance',
      value: formatInr(financials.cashBankBalance),
      sub: 'HDFC Current + Vault Cash',
      action: () => setActiveModule('banking'),
    },
    {
      label: 'Operating Expenses',
      value: formatInr(financials.totalExpenses),
      sub: `Stock Value ${formatInr(financials.closingStockValue)}`,
      action: () => setActiveModule('reports'),
    },
  ];

  const shortcuts = [
    {
      key: 'F2',
      label: 'Retail POS Terminal',
      desc: 'Touch billing, barcode & split pay',
      icon: ScanBarcode,
      target: 'pos' as const,
      primary: true,
    },
    {
      key: 'F8',
      label: 'Wholesale GST Bill',
      desc: 'B2B invoices, quotes & credit notes',
      icon: ReceiptIndianRupee,
      target: 'sales' as const,
      primary: false,
    },
    {
      key: 'F9',
      label: 'Purchase Import',
      desc: 'CSV/Excel supplier bill import',
      icon: Truck,
      target: 'purchases' as const,
      primary: false,
    },
    {
      key: 'GST',
      label: 'E-Invoice & GSTR-1',
      desc: 'IRN QR, E-Way Bill & JSON export',
      icon: FileCheck2,
      target: 'gst' as const,
      primary: false,
    },
    {
      key: 'P&L',
      label: 'Financial Reports',
      desc: 'Trial Balance, P&L & Balance Sheet',
      icon: BarChart3,
      target: 'reports' as const,
      primary: false,
    },
    {
      key: 'Alt+C',
      label: 'Control Room',
      desc: 'POS rules, counters & books rebuild',
      icon: Settings2,
      target: 'control-room' as const,
      primary: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Header Strip */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Executive Overview
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {activeCompany?.name} · GSTIN {activeCompany?.gstin} · FY {activeCompany?.financialYear}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:shrink-0">
          <button
            type="button"
            onClick={() => setActiveModule('shifts')}
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            Day-End Cash Summary
          </button>
          <button
            type="button"
            onClick={() => setActiveModule('pos')}
            className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
          >
            <ScanBarcode className="h-4 w-4" />
            <span>Open Retail POS (F2)</span>
          </button>
        </div>
      </div>

      {/* 6-KPI Real-Time Financial Strip */}
      <section aria-label="Key Financial Metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={kpi.action}
            className="text-left rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-600/50 transition-colors focus-visible:outline-2 focus-visible:outline-teal-600"
          >
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>{kpi.label}</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {kpi.value}
            </div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">{kpi.sub}</div>
          </button>
        ))}
      </section>

      {/* Main Analytics + Quick Shortcuts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Sales vs Purchase & Expense Trend Chart */}
        <section className="xl:col-span-8 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Sales, Purchases & Expense Trends
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily movement in INR · Rolling 6-day ledger view
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-teal-700" aria-hidden="true" />
                Sales
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-slate-700" aria-hidden="true" />
                Purchases
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-amber-600" aria-hidden="true" />
                Expenses
              </span>
            </div>
          </div>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${Math.round(Number(v) / 1000)}k`}
                />
                <Tooltip
                  formatter={(val: unknown) => formatInr(Number(val || 0))}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="sales" name="Sales" fill="#0F766E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" name="Purchases" fill="#334155" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#D97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Quick-Action Shortcut Keys */}
        <section className="xl:col-span-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">
              Quick-Action Shortcuts
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Press MargBooks function keys or click directly
            </p>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {shortcuts.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setActiveModule(s.target)}
                  className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-slate-50 -mx-2 px-2 rounded-md transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        s.primary ? 'text-teal-700' : 'text-slate-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {s.label}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{s.desc}</div>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-medium text-slate-500 shrink-0">
                    {s.key}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Bottom Split: Day-End Multi-Counter Cash Summary + Expiry & Reorder Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Multi-Counter Day-End Cash Summary
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live register collection across {workspace.posCounters.length} counters
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModule('shifts')}
              className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap shrink-0"
            >
              Shift Handover & Counters
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                  <th className="pb-2 pr-3">Counter / Operator</th>
                  <th className="pb-2 px-2 text-right">Cash</th>
                  <th className="pb-2 px-2 text-right">UPI / Card</th>
                  <th className="pb-2 pl-2 text-right">Drawer Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workspace.posCounters.map((c) => {
                  const drawerTotal = c.openingCash + c.cashSales;
                  const digital = c.upiSales + c.cardSales + c.walletSales;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-slate-900">{c.counterCode}</div>
                        <div className="text-xs text-slate-500">
                          {c.operatorName} · {c.status}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700">
                        {formatInr(c.cashSales)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700">
                        {formatInr(digital)}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {formatInr(drawerTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 font-semibold text-slate-900">
                  <td className="pt-2.5 pr-3 text-xs">All Counters Combined</td>
                  <td className="pt-2.5 px-2 text-right font-mono tabular-nums text-xs">
                    {formatInr(counterTotals.cash)}
                  </td>
                  <td className="pt-2.5 px-2 text-right font-mono tabular-nums text-xs">
                    {formatInr(counterTotals.upi + counterTotals.card + counterTotals.wallet)}
                  </td>
                  <td className="pt-2.5 pl-2 text-right font-mono tabular-nums text-xs text-teal-800">
                    {formatInr(counterTotals.openingCash + counterTotals.cash)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Expiry & Auto-Reorder Alerts */}
        <section className="xl:col-span-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Batch Expiry & Auto-Reorder Alerts
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {expiryAlerts.length} expiry batches · {lowStockItems.length} below reorder level
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveModule('inventory')}
              className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap shrink-0"
            >
              Open Stock Control
            </button>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {expiryAlerts.slice(0, 4).map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {b.itemName}
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    Batch {b.batchNo} · {b.godownName} · Exp {b.expiryDate}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`text-xs font-semibold ${
                      b.status === 'EXPIRED' ? 'text-red-700' : 'text-amber-700'
                    }`}
                  >
                    {b.status === 'EXPIRED'
                      ? 'Expired — Dump'
                      : `${b.daysRemaining}d left`}
                  </div>
                  <div className="text-xs font-mono text-slate-500 tabular-nums">
                    {b.qtyOnHand} units
                  </div>
                </div>
              </div>
            ))}
            {lowStockItems.slice(0, 2).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {item.name}
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    SKU {item.sku} · Rack {item.rackLocation} · Reorder at {item.reorderLevel}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold text-amber-700">Low Stock</div>
                  <div className="text-xs font-mono text-slate-600 tabular-nums">
                    {item.totalQty} {item.uqc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
