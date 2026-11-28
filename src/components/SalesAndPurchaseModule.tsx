'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { FileUp, Plus, ScanBarcode, ShieldAlert } from 'lucide-react';
import { parsePurchaseImportCsv, round2 } from '../lib/erp-engine';
import type {
  DamageClaimReason,
  PurchaseDocType,
  SaleDocType,
} from '../types/erp';
import { useMargBooks } from './MargBooksContext';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function SalesBillingModule() {
  const { workspace, dispatchAction, setActiveModule } = useMargBooks();
  const [docTab, setDocTab] = useState<'ALL' | SaleDocType | 'SCHEMES'>('ALL');

  const filteredInvoices = useMemo(() => {
    if (docTab === 'ALL' || docTab === 'SCHEMES') return workspace.invoices;
    return workspace.invoices.filter((i) => i.docType === docTab);
  }, [workspace.invoices, docTab]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Sale, Billing & Promotions
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Wholesale GST Invoices · Estimates · Sales Orders · Delivery Challans · Credit Notes · Auto Schemes
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveModule('pos')}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <ScanBarcode className="h-3.5 w-3.5" />
            <span>Retail POS (F2)</span>
          </button>
          <Link
            href="/admin/sales/schemes/new"
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            + Add Scheme
          </Link>
          <Link
            href="/admin/sales/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 dark:bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:hover:bg-emerald-500 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>New Sale / Credit Note</span>
          </Link>
        </div>
      </div>

      {/* Document Type Filter Bar */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-1.5">
        {[
          { id: 'ALL', label: 'All Sale Docs' },
          { id: 'GST_INVOICE', label: 'Wholesale GST' },
          { id: 'POS_BILL', label: 'POS Bills' },
          { id: 'ESTIMATE', label: 'Estimates / Quotes' },
          { id: 'SALES_ORDER', label: 'Sales Orders' },
          { id: 'CHALLAN', label: 'Delivery Challans' },
          { id: 'CREDIT_NOTE', label: 'Credit Notes (Returns)' },
          { id: 'SCHEMES', label: `Auto Schemes (${workspace.schemes.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setDocTab(t.id as typeof docTab)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              docTab === t.id
                ? 'bg-emerald-700 dark:bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 dark:text-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {docTab === 'SCHEMES' ? (
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4">Scheme Name</th>
                <th className="py-3 px-3">Target Item / Category</th>
                <th className="py-3 px-3">Rule</th>
                <th className="py-3 px-3">Validity Window</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {workspace.schemes.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{s.name}</td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {s.barcodeOrCategory}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-300 font-mono">
                    {s.schemeType === 'BUY_X_GET_Y'
                      ? `Buy ${s.minQty} Get ${s.freeQty} Free`
                      : `${s.discountPercent}% Off (Min Qty ${s.minQty})`}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {s.validFrom} to {s.validTo}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        void dispatchAction(
                          'TOGGLE_SCHEME',
                          { id: s.id, active: !s.active },
                          `Scheme "${s.name}" ${!s.active ? 'enabled' : 'paused'}.`
                        )
                      }
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                        s.active
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {s.active ? 'Active — Pause' : 'Paused — Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4">Invoice / Doc No</th>
                <th className="py-3 px-3">Date · Type</th>
                <th className="py-3 px-3">Customer / GSTIN</th>
                <th className="py-3 px-3">Payment / Counter</th>
                <th className="py-3 px-3 text-right">GST Tax</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <Link
                      href={`/admin/bills/${inv.id}`}
                      className="text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      {inv.invoiceNo}
                    </Link>
                    {inv.irn && (
                      <div className="text-[10px] font-normal text-emerald-700 dark:text-emerald-400">IRN Verified</div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-400 font-mono">
                    {inv.invoiceDate} · {inv.docType.replace('_', ' ')}
                  </td>
                  <td className="py-3 px-3">
                    {inv.ledgerId ? (
                      <Link
                        href={`/admin/ledgers/${inv.ledgerId}`}
                        className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-emerald-700 dark:text-emerald-400 hover:underline"
                      >
                        {inv.customerName}
                      </Link>
                    ) : (
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{inv.customerName}</div>
                    )}
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {inv.customerGstin || inv.customerPhone || 'B2C Retail'}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-400">
                    {inv.paymentModeSummary} · {inv.counterCode}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                    {formatInr(inv.cgstAmount + inv.sgstAmount + inv.igstAmount)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatInr(inv.grandTotal)}
                    <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">{inv.status}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

const SAMPLE_PURCHASE_CSV = `ItemName,Barcode,HSN,Batch,Expiry,Qty,Rate,TaxPct
India Gate Basmati Rice 5kg,8901526100105,10063020,IG26-IMP9,2027-11-30,50,495.00,5
Amul Pasteurised Butter 500g,8901262010016,04051000,AM26-IMP2,2027-05-15,40,226.00,12`;

export function PurchaseModule() {
  const { workspace, dispatchAction, syncing } = useMargBooks();
  const damageClaimsEnabled = workspace.controlRoom.enabledAddons?.damage_claims !== false;
  const [subTab, setSubTab] = useState<'register' | 'claims' | 'import' | 'compare'>('register');
  const [docTypeFilter, setDocTypeFilter] = useState<'ALL' | PurchaseDocType>('ALL');
  const [csvText, setCsvText] = useState(SAMPLE_PURCHASE_CSV);
  const [importSource, setImportSource] = useState<'CSV' | 'Excel' | 'PDF'>('CSV');
  const suppliers = workspace.ledgers.filter((l) => l.groupType === 'Supplier');
  const [selectedSupplierId, setSelectedSupplierId] = useState(
    String(suppliers[0]?.id || 5)
  );
  const [supplierBillNo, setSupplierBillNo] = useState('SUP-INV-9921');

  // Supplier Damage Claim Form State
  const [claimSupplierId, setClaimSupplierId] = useState<string>(
    String(suppliers[0]?.id || '')
  );
  const [claimItemId, setClaimItemId] = useState<string>(
    String(workspace.items[0]?.id || '')
  );
  const [claimBatchNo, setClaimBatchNo] = useState<string>('DMG-26A');
  const [claimExpiry, setClaimExpiry] = useState<string>('2026-12-30');
  const [claimQty, setClaimQty] = useState<string>('6');
  const [claimUnitCost, setClaimUnitCost] = useState<string>(
    String(workspace.items[0]?.purchaseRate || 100)
  );
  const [claimReason, setClaimReason] = useState<DamageClaimReason>('Transit Damage');
  const [claimNotes, setClaimNotes] = useState<string>('');

  const parsedImport = useMemo(() => parsePurchaseImportCsv(csvText), [csvText]);

  const filteredPurchases = useMemo(() => {
    if (docTypeFilter === 'ALL') return workspace.purchases;
    return workspace.purchases.filter((p) => p.docType === docTypeFilter);
  }, [workspace.purchases, docTypeFilter]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (parsedImport.lines.length === 0) return;
    const sup = suppliers.find((s) => s.id === Number(selectedSupplierId));
    const ok = await dispatchAction(
      'CREATE_PURCHASE',
      {
        billNo: supplierBillNo.trim() || `PUR-26-${Date.now().toString().slice(-4)}`,
        docType: 'PURCHASE_BILL',
        ledgerId: sup?.id || null,
        supplierName: sup?.name || 'Supplier',
        supplierGstin: sup?.gstin || '',
        billDate: '2026-11-26',
        subtotal: parsedImport.subtotal,
        taxAmount: parsedImport.taxAmount,
        grandTotal: parsedImport.grandTotal,
        items: parsedImport.lines,
        importSource,
        status: 'Posted',
      },
      `Imported ${parsedImport.lines.length} purchase lines (${formatInr(parsedImport.grandTotal)}) & updated stock batches.`
    );
    if (ok) {
      setSubTab('register');
    }
  };

  const handleCreateDebitNote = async () => {
    const sup = suppliers[0];
    await dispatchAction(
      'CREATE_PURCHASE',
      {
        billNo: `DN-26-0${workspace.purchases.length + 11}`,
        docType: 'DEBIT_NOTE',
        ledgerId: sup?.id || null,
        supplierName: sup?.name || 'Hindustan FMCG Supply Co.',
        supplierGstin: sup?.gstin || '',
        billDate: '2026-11-26',
        subtotal: 3560,
        taxAmount: 640.8,
        grandTotal: 4200.8,
        items: [
          {
            itemName: 'Surf Excel Matic Front Load 2kg',
            barcode: '8901030865214',
            hsnCode: '34022010',
            batchNo: 'SF-MT2609',
            expiryDate: '2028-04-30',
            qty: 10,
            rate: 356,
            taxSlab: 18,
            lineTotal: 4200.8,
          },
        ],
        importSource: 'Manual',
        status: 'Returned',
      },
      'Purchase Return Debit Note posted.'
    );
  };

  const claimStats = useMemo(() => {
    const open = workspace.supplierDamageClaims.filter((c) => c.status !== 'SETTLED');
    const converted = workspace.supplierDamageClaims.filter((c) => Boolean(c.debitNoteNo));
    return {
      openCount: open.length,
      claimableValue: round2(open.reduce((s, c) => s + c.claimAmount, 0)),
      convertedCount: converted.length,
    };
  }, [workspace.supplierDamageClaims]);

  const handleLogDamageClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === Number(claimSupplierId)) || suppliers[0];
    const item = workspace.items.find((i) => i.id === Number(claimItemId)) || workspace.items[0];
    if (!sup || !item) return;
    const qty = Number(claimQty);
    const unitCost = Number(claimUnitCost);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitCost) || unitCost <= 0) return;

    const ok = await dispatchAction(
      'CREATE_DAMAGE_CLAIM',
      {
        claimDate: '2026-11-26',
        ledgerId: sup.id,
        supplierName: sup.name,
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        batchNo: claimBatchNo.trim() || 'DMG-26',
        expiryDate: claimExpiry,
        qty,
        unitCost,
        reason: claimReason,
        notes: claimNotes.trim(),
      },
      `Logged supplier damage claim (${formatInr(round2(qty * unitCost))}) against ${sup.name}.`
    );
    if (ok) {
      setClaimNotes('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Purchase Module & Online Import
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Purchase Bills · Purchase Orders · Debit Notes · Supplier Rate Comparison · Direct CSV/Excel/PDF Import
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void handleCreateDebitNote()}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            + Debit Note (Return)
          </button>
          <Link
            href="/admin/purchases/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 dark:bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:hover:bg-emerald-500 whitespace-nowrap"
          >
            <FileUp className="h-4 w-4" />
            <span>New Purchase / Import</span>
          </Link>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-900 p-1">
          {[
            { id: 'register', label: `Purchase Register (${workspace.purchases.length})` },
            ...(damageClaimsEnabled
              ? [{ id: 'claims', label: `Damage & Return Claims (${workspace.supplierDamageClaims.length})` }]
              : []),
            { id: 'import', label: 'Online Purchase Import (CSV/Excel/PDF)' },
            { id: 'compare', label: 'Supplier Rate Comparison' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as typeof subTab)}
              className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                subTab === t.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {subTab === 'register' && (
          <select
            aria-label="Filter purchase document type"
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value as typeof docTypeFilter)}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Types</option>
            <option value="PURCHASE_BILL">Purchase Bills</option>
            <option value="PURCHASE_ORDER">Purchase Orders</option>
            <option value="DEBIT_NOTE">Debit Notes</option>
          </select>
        )}
      </div>

      {subTab === 'register' && (
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4">Bill / PO No</th>
                <th className="py-3 px-3">Date · Type</th>
                <th className="py-3 px-3">Supplier / GSTIN</th>
                <th className="py-3 px-3">Import Channel</th>
                <th className="py-3 px-3 text-right">Input GST ITC</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPurchases.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {p.billNo}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {p.billDate} · {p.docType.replace('_', ' ')}
                  </td>
                  <td className="py-3 px-3">
                    {p.ledgerId ? (
                      <Link
                        href={`/admin/ledgers/${p.ledgerId}`}
                        className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-emerald-700 dark:text-emerald-400 hover:underline"
                      >
                        {p.supplierName}
                      </Link>
                    ) : (
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{p.supplierName}</div>
                    )}
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">{p.supplierGstin}</div>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-400">
                    {p.importSource} · {p.items.length} line(s)
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatInr(p.taxAmount)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatInr(p.grandTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {subTab === 'claims' && damageClaimsEnabled && (
        <div className="space-y-5">
          {/* Claims KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Open Supplier Claims</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {claimStats.openCount} Claims
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Total Claimable Value</div>
              <div className="mt-1 font-mono text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {formatInr(claimStats.claimableValue)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Converted to Debit Notes</div>
              <div className="mt-1 font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {claimStats.convertedCount} Debit Notes
              </div>
            </div>
          </div>

          {/* Inline Log Supplier Damage / Return Claim Form */}
          <form
            onSubmit={(e) => void handleLogDamageClaim(e)}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Log Supplier Damage / Expiry Return Claim
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Track broken cartons, short supply, or expired stock and convert to GST Debit Notes in one click.
                  </p>
                </div>
              </div>
              <div className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                Claim: {formatInr(round2(Number(claimQty || 0) * Number(claimUnitCost || 0)))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Supplier
                </label>
                <select
                  value={claimSupplierId}
                  onChange={(e) => setClaimSupplierId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Product SKU
                </label>
                <select
                  value={claimItemId}
                  onChange={(e) => {
                    setClaimItemId(e.target.value);
                    const matched = workspace.items.find((i) => i.id === Number(e.target.value));
                    if (matched) setClaimUnitCost(String(matched.purchaseRate));
                  }}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                >
                  {workspace.items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Batch &amp; Expiry
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={claimBatchNo}
                    onChange={(e) => setClaimBatchNo(e.target.value)}
                    placeholder="Batch"
                    className="w-1/2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="date"
                    value={claimExpiry}
                    onChange={(e) => setClaimExpiry(e.target.value)}
                    className="w-1/2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Claim Reason
                </label>
                <select
                  value={claimReason}
                  onChange={(e) => setClaimReason(e.target.value as DamageClaimReason)}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="Transit Damage">Transit Damage</option>
                  <option value="Expired Stock">Expired Stock</option>
                  <option value="Short Supply">Short Supply</option>
                  <option value="Leaking Pack">Leaking Pack</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Claim Qty
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  required
                  value={claimQty}
                  onChange={(e) => setClaimQty(e.target.value)}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Unit Cost (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  required
                  value={claimUnitCost}
                  onChange={(e) => setClaimUnitCost(e.target.value)}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="sm:col-span-2 flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Notes / Carton Photo Ref
                  </label>
                  <input
                    type="text"
                    value={claimNotes}
                    onChange={(e) => setClaimNotes(e.target.value)}
                    placeholder="e.g. 2 crushed pouches during van unload"
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={syncing}
                  className="rounded-md bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white whitespace-nowrap disabled:opacity-60 cursor-pointer"
                >
                  Log Claim
                </button>
              </div>
            </div>
          </form>

          {/* Claims Register Table */}
          <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                  <th className="py-3 px-4">Claim No · Date</th>
                  <th className="py-3 px-3">Supplier &amp; Item</th>
                  <th className="py-3 px-3">Reason · Batch</th>
                  <th className="py-3 px-3 text-right">Claim Value</th>
                  <th className="py-3 px-3">Stage / Debit Note</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {workspace.supplierDamageClaims.map((cl) => (
                  <tr key={cl.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-xs">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {cl.claimNo}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">{cl.claimDate}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {cl.itemName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {cl.supplierName}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {cl.reason}
                      </div>
                      <div className="font-mono text-slate-500 dark:text-slate-400">
                        {cl.batchNo} · {cl.qty} × ₹{cl.unitCost}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatInr(cl.claimAmount)}
                    </td>
                    <td className="py-3 px-3 text-xs">
                      <div className="font-semibold text-amber-700 dark:text-amber-400">
                        {cl.status.replace(/_/g, ' ')}
                      </div>
                      {cl.debitNoteNo && (
                        <div className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                          {cl.debitNoteNo}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {cl.status === 'LOGGED' && (
                          <button
                            type="button"
                            onClick={() =>
                              void dispatchAction(
                                'UPDATE_CLAIM_STATUS',
                                { id: cl.id, status: 'CLAIM_RAISED' },
                                `Claim ${cl.claimNo} marked as Raised with supplier.`
                              )
                            }
                            className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-emerald-600 cursor-pointer"
                          >
                            Raise Claim
                          </button>
                        )}
                        {!cl.debitNoteNo && cl.status !== 'SETTLED' && (
                          <button
                            type="button"
                            onClick={() =>
                              void dispatchAction(
                                'CONVERT_CLAIM_TO_DEBIT_NOTE',
                                { id: cl.id },
                                `Converted ${cl.claimNo} to Purchase Return Debit Note & adjusted stock.`
                              )
                            }
                            className="rounded bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                          >
                            Convert to Debit Note
                          </button>
                        )}
                        {cl.status !== 'SETTLED' && cl.debitNoteNo && (
                          <button
                            type="button"
                            onClick={() =>
                              void dispatchAction(
                                'UPDATE_CLAIM_STATUS',
                                { id: cl.id, status: 'SETTLED' },
                                `Claim ${cl.claimNo} marked Settled.`
                              )
                            }
                            className="rounded border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200 cursor-pointer"
                          >
                            Mark Settled
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {subTab === 'import' && (
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label htmlFor="imp-supplier" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Supplier Party
              </label>
              <select
                id="imp-supplier"
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="imp-billno" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Supplier Invoice No
              </label>
              <input
                id="imp-billno"
                value={supplierBillNo}
                onChange={(e) => setSupplierBillNo(e.target.value)}
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-900 dark:text-slate-100 text-sm font-mono"
              />
            </div>
            <div>
              <label htmlFor="imp-source" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Source Format
              </label>
              <select
                id="imp-source"
                value={importSource}
                onChange={(e) => setImportSource(e.target.value as 'CSV' | 'Excel' | 'PDF')}
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
              >
                <option value="CSV">CSV Supplier Invoice</option>
                <option value="Excel">Excel (.xlsx/.csv) Sheet</option>
                <option value="PDF">PDF Invoice OCR Extract</option>
              </select>
            </div>
            <div>
              <label htmlFor="imp-file" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Upload .csv File (Optional)
              </label>
              <input
                id="imp-file"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-600 dark:text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2.5 file:py-1.5 file:text-xs file:font-medium"
              />
            </div>
          </div>

          <div>
            <label htmlFor="imp-csv-text" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Invoice Lines (ItemName, Barcode, HSN, Batch, Expiry, Qty, Rate, TaxPct)
            </label>
            <textarea
              id="imp-csv-text"
              rows={4}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-600 dark:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>

          {parsedImport.errors.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {parsedImport.errors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          )}

          {parsedImport.lines.length > 0 && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-slate-600 dark:text-slate-400">
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-2">Batch · Expiry</th>
                      <th className="py-2 px-2 text-right">Qty</th>
                      <th className="py-2 px-2 text-right">Rate</th>
                      <th className="py-2 px-2 text-right">GST %</th>
                      <th className="py-2 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedImport.lines.map((ln, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">{ln.itemName}</td>
                        <td className="py-2 px-2 font-mono text-slate-600 dark:text-slate-400">
                          {ln.batchNo} · {ln.expiryDate}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums">{ln.qty}</td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums">
                          ₹{ln.rate.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums">
                          {ln.taxSlab}%
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums">
                          {formatInr(ln.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                  Taxable {formatInr(parsedImport.subtotal)} · Input GST{' '}
                  {formatInr(parsedImport.taxAmount)} · Net Payable{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {formatInr(parsedImport.grandTotal)}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => void handleConfirmImport()}
                  className="rounded-md bg-emerald-700 dark:bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 dark:hover:bg-emerald-500"
                >
                  Confirm & Post Purchase Import
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {subTab === 'compare' && (
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                <th className="py-3 px-4">Product SKU</th>
                <th className="py-3 px-3 text-right">Metro Wholesale Rate</th>
                <th className="py-3 px-3 text-right">Hindustan FMCG Rate</th>
                <th className="py-3 px-3 text-right">Current Margin</th>
                <th className="py-3 px-4 text-right">Best Margin Supplier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {workspace.items.slice(0, 8).map((it, idx) => {
                const altRate = Number((it.purchaseRate * (idx % 2 === 0 ? 1.03 : 0.97)).toFixed(2));
                const bestName =
                  it.purchaseRate <= altRate
                    ? 'Metro Cash & Carry Wholesale'
                    : 'Hindustan FMCG Supply Co.';
                const bestRate = Math.min(it.purchaseRate, altRate);
                const marginPct = (((it.saleRate - bestRate) / it.saleRate) * 100).toFixed(1);
                return (
                  <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{it.name}</td>
                    <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                      ₹{it.purchaseRate.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                      ₹{altRate.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                      {marginPct}%
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-medium text-slate-800 dark:text-slate-200">
                      {bestName}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
