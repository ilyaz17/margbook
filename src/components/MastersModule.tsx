'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { useMargBooks } from './MargBooksContext';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function MastersModule() {
  const { workspace } = useMargBooks();
  const [tab, setTab] = useState<'ledgers' | 'inventory' | 'bom'>('ledgers');
  const [search, setSearch] = useState('');
  const [ledgerGroupFilter, setLedgerGroupFilter] = useState<string>('All');

  const filteredLedgers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workspace.ledgers.filter((l) => {
      const grpOk = ledgerGroupFilter === 'All' || l.groupType === ledgerGroupFilter;
      const qOk =
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.gstin.toLowerCase().includes(q) ||
        l.phone.includes(q);
      return grpOk && qOk;
    });
  }, [workspace.ledgers, ledgerGroupFilter, search]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workspace.items.filter(
      (i) =>
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        i.barcode.includes(q) ||
        i.hsnCode.includes(q) ||
        i.brand.toLowerCase().includes(q)
    );
  }, [workspace.items, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Master Module
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Account & Ledger Master · Inventory, HSN/GST, Racks & Rate Lists · Bill of Material (BOM)
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {tab === 'ledgers' && (
            <Link
              href="/admin/masters/ledgers/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>New Ledger Account</span>
            </Link>
          )}
          {tab === 'inventory' && (
            <Link
              href="/admin/masters/items/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>New Inventory Item</span>
            </Link>
          )}
          {tab === 'bom' && (
            <Link
              href="/admin/masters/bom/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>New BOM Formula</span>
            </Link>
          )}
        </div>
      </div>

      {/* Sub-Module Tabs + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-1 rounded-md bg-slate-100 p-1">
          {[
            { id: 'ledgers', label: `Account / Ledger Master (${workspace.ledgers.length})` },
            { id: 'inventory', label: `Inventory & Rate Master (${workspace.items.length})` },
            { id: 'bom', label: `Bill of Material (${workspace.bomRecipes.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as 'ledgers' | 'inventory' | 'bom')}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {tab === 'ledgers' && (
            <select
              aria-label="Filter ledgers by group"
              value={ledgerGroupFilter}
              onChange={(e) => setLedgerGroupFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
            >
              <option value="All">All Groups</option>
              <option value="Customer">Customer</option>
              <option value="Supplier">Supplier</option>
              <option value="Bank">Bank</option>
              <option value="Cash">Cash</option>
              <option value="Expense">Expense</option>
            </select>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, GSTIN, HSN…"
              className="w-56 rounded-md border border-slate-300 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tab 1: Account / Ledger Master */}
      {tab === 'ledgers' && (
        <section className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Ledger Name & Contact</th>
                <th className="py-3 px-3">Account Group</th>
                <th className="py-3 px-3">GSTIN / State</th>
                <th className="py-3 px-3 text-right">Opening Bal</th>
                <th className="py-3 px-3 text-right">Closing Bal</th>
                <th className="py-3 px-4 text-right">Loyalty / Credit Limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLedgers.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <Link
                      href={`/admin/ledgers/${l.id}`}
                      className="font-medium text-teal-800 hover:underline"
                    >
                      {l.name}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {l.phone || 'No phone'} {l.email ? `· ${l.email}` : ''}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-700 font-medium">
                    {l.groupType}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-600 tabular-nums">
                    {l.gstin || 'Unregistered'} · St {l.stateCode}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-slate-600">
                    {formatInr(l.openingBalance)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs font-semibold tabular-nums text-slate-900">
                    {formatInr(l.currentBalance)} {l.balanceType}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-600">
                    {l.loyaltyPoints > 0 ? `${l.loyaltyPoints} pts · ` : ''}
                    {l.creditLimit > 0 ? `Limit ₹${l.creditLimit.toLocaleString('en-IN')}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Tab 2: Inventory Master */}
      {tab === 'inventory' && (
        <section className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Item Name / Brand</th>
                <th className="py-3 px-3">Barcode / SKU</th>
                <th className="py-3 px-3">HSN / GST / UQC</th>
                <th className="py-3 px-3">Rack</th>
                <th className="py-3 px-3 text-right">MRP</th>
                <th className="py-3 px-3 text-right">Retail / Wholesale</th>
                <th className="py-3 px-4 text-right">Purchase Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{it.name}</div>
                    <div className="text-xs text-slate-500">
                      {it.brand} · {it.category}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-600 tabular-nums">
                    <div>{it.barcode}</div>
                    <div className="text-slate-400">{it.sku}</div>
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-700 tabular-nums">
                    {it.hsnCode} · {it.taxSlab}% · {it.uqc}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-600">
                    {it.rackLocation}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs tabular-nums text-slate-700">
                    ₹{it.mrp.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs font-semibold tabular-nums text-slate-900">
                    ₹{it.saleRate.toFixed(2)} / ₹{it.wholesaleRate.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-600">
                    ₹{it.purchaseRate.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Tab 3: Bill of Material (BOM) */}
      {tab === 'bom' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {workspace.bomRecipes.map((bom) => {
            const materialCost = bom.components.reduce(
              (s, c) => s + c.qty * c.unitCost,
              0
            );
            const totalCost = materialCost + bom.laborCost;
            return (
              <section
                key={bom.id}
                className="rounded-lg border border-slate-200 bg-white p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      {bom.finishedItemName}
                    </h2>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {bom.recipeCode} · Yield: {bom.yieldQty} {bom.yieldUqc}
                    </p>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-xs text-slate-500">Landed Cost</div>
                    <div className="text-base font-bold text-teal-800">
                      {formatInr(totalCost)}
                    </div>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="pb-1.5">Raw Material Component</th>
                      <th className="pb-1.5 text-right">Qty</th>
                      <th className="pb-1.5 text-right">Unit Cost</th>
                      <th className="pb-1.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bom.components.map((c, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 text-slate-800">{c.itemName}</td>
                        <td className="py-1.5 text-right font-mono tabular-nums">
                          {c.qty} {c.uqc}
                        </td>
                        <td className="py-1.5 text-right font-mono tabular-nums">
                          ₹{c.unitCost.toFixed(2)}
                        </td>
                        <td className="py-1.5 text-right font-mono font-medium tabular-nums">
                          ₹{(c.qty * c.unitCost).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="pt-2 border-t border-slate-100 flex justify-between text-xs text-slate-600 font-mono tabular-nums">
                  <span>Material: {formatInr(materialCost)}</span>
                  <span>Assembly / Packaging Labor: {formatInr(bom.laborCost)}</span>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
