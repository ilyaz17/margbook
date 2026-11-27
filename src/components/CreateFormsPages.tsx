'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Save, Upload } from 'lucide-react';
import {
  generateDeterministicIrn,
  parsePurchaseImportCsv,
  round2,
} from '../lib/erp-engine';
import type {
  LedgerGroup,
  PurchaseDocType,
  SaleDocType,
  VoucherType,
} from '../types/erp';
import { useMargBooks } from './MargBooksContext';

function FormPageHeader({
  backHref,
  backLabel,
  title,
  subtitle,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>{backLabel}</span>
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

/* 1. New Account / Party Ledger Page */
export function NewLedgerPage() {
  const router = useRouter();
  const { dispatchAction, syncing } = useMargBooks();
  const [name, setName] = useState('');
  const [groupType, setGroupType] = useState<LedgerGroup>('Customer');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [stateCode, setStateCode] = useState('07');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [balanceType, setBalanceType] = useState<'Dr' | 'Cr'>('Dr');
  const [creditLimit, setCreditLimit] = useState('50000');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await dispatchAction(
      'CREATE_LEDGER',
      {
        name: name.trim(),
        groupType,
        gstin: gstin.trim().toUpperCase(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        stateCode: stateCode.trim() || '07',
        openingBalance: Number(openingBalance || 0),
        balanceType,
        creditLimit: Number(creditLimit || 0),
        loyaltyPoints: 0,
      },
      `Ledger "${name.trim()}" created.`
    );
    if (ok) router.push('/admin/masters');
  };

  return (
    <div className="max-w-3xl">
      <FormPageHeader
        backHref="/admin/masters"
        backLabel="Back to Master Module"
        title="New Account / Party Ledger"
        subtitle="Add a customer, supplier, bank, cash, expense, or income ledger to your books."
      />
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-lg border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="nl-name" className="block text-xs font-medium text-slate-700 mb-1">
              Account / Party Name
            </label>
            <input
              id="nl-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Metro Cash & Carry Wholesale"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="nl-group" className="block text-xs font-medium text-slate-700 mb-1">
              Account Group
            </label>
            <select
              id="nl-group"
              value={groupType}
              onChange={(e) => setGroupType(e.target.value as LedgerGroup)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            >
              {(['Customer', 'Supplier', 'Bank', 'Cash', 'Expense', 'Income', 'Tax'] as LedgerGroup[]).map(
                (g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label htmlFor="nl-gstin" className="block text-xs font-medium text-slate-700 mb-1">
              GSTIN (Optional)
            </label>
            <input
              id="nl-gstin"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="07AABCS1429B1ZB"
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm uppercase focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="nl-phone" className="block text-xs font-medium text-slate-700 mb-1">
              Phone Number
            </label>
            <input
              id="nl-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98110 44210"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="nl-email" className="block text-xs font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              id="nl-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="accounts@party.in"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="nl-state" className="block text-xs font-medium text-slate-700 mb-1">
              GST State Code
            </label>
            <input
              id="nl-state"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
              placeholder="07"
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="nl-limit" className="block text-xs font-medium text-slate-700 mb-1">
              Credit Limit (INR)
            </label>
            <input
              id="nl-limit"
              type="number"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="nl-opbal" className="block text-xs font-medium text-slate-700 mb-1">
              Opening Balance (INR)
            </label>
            <input
              id="nl-opbal"
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="nl-btype" className="block text-xs font-medium text-slate-700 mb-1">
              Balance Nature
            </label>
            <select
              id="nl-btype"
              value={balanceType}
              onChange={(e) => setBalanceType(e.target.value === 'Cr' ? 'Cr' : 'Dr')}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            >
              <option value="Dr">Debit (Dr)</option>
              <option value="Cr">Credit (Cr)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="nl-addr" className="block text-xs font-medium text-slate-700 mb-1">
              Address
            </label>
            <input
              id="nl-addr"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Shop 12, Connaught Circus, New Delhi"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Link
            href="/admin/masters"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{syncing ? 'Saving...' : 'Save Ledger'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/* 2. New Inventory Item Page */
export function NewItemPage() {
  const router = useRouter();
  const { dispatchAction, syncing } = useMargBooks();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Staples & Grains');
  const [hsnCode, setHsnCode] = useState('10063020');
  const [uqc, setUqc] = useState('PKT');
  const [rackLocation, setRackLocation] = useState('Aisle-1-R1');
  const [taxSlab, setTaxSlab] = useState('5');
  const [mrp, setMrp] = useState('185');
  const [saleRate, setSaleRate] = useState('158');
  const [purchaseRate, setPurchaseRate] = useState('132');
  const [wholesaleRate, setWholesaleRate] = useState('145');
  const [reorderLevel, setReorderLevel] = useState('25');
  const [initialQty, setInitialQty] = useState('50');
  const [batchNo, setBatchNo] = useState('LOT-2611');
  const [expiryDate, setExpiryDate] = useState('2027-12-31');
  const [isWeighed, setIsWeighed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await dispatchAction(
      'CREATE_ITEM',
      {
        name: name.trim(),
        sku: sku.trim(),
        barcode: barcode.trim(),
        brand: brand.trim() || 'FreshMart',
        category,
        hsnCode: hsnCode.trim() || '10063020',
        uqc,
        rackLocation: rackLocation.trim() || 'Aisle-1',
        taxSlab: Number(taxSlab),
        mrp: Number(mrp),
        saleRate: Number(saleRate),
        purchaseRate: Number(purchaseRate),
        wholesaleRate: Number(wholesaleRate),
        reorderLevel: Number(reorderLevel),
        initialQty: Number(initialQty),
        batchNo: batchNo.trim() || 'LOT-2611',
        expiryDate,
        godownName: 'Main Store Floor',
        isWeighed,
      },
      `Supermarket item "${name.trim()}" created with opening stock.`
    );
    if (ok) router.push('/admin/masters');
  };

  return (
    <div className="max-w-4xl">
      <FormPageHeader
        backHref="/admin/masters"
        backLabel="Back to Master Module"
        title="New Inventory Item & Opening Batch"
        subtitle="Configure HSN/SAC, GST slab, UQC, rack bin, rate lists, and initial batch stock."
      />
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-lg border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="ni-name" className="block text-xs font-medium text-slate-700 mb-1">
              Item Description
            </label>
            <input
              id="ni-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. India Gate Basmati Rice 5kg or Fresh Tomatoes (Loose)"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ni-brand" className="block text-xs font-medium text-slate-700 mb-1">
              Brand / Producer
            </label>
            <input
              id="ni-brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="India Gate / Amul / FreshFarm"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ni-sku" className="block text-xs font-medium text-slate-700 mb-1">
              SKU Code
            </label>
            <input
              id="ni-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="STP-BASM-5KG"
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ni-barcode" className="block text-xs font-medium text-slate-700 mb-1">
              EAN Barcode / PLU Code
            </label>
            <input
              id="ni-barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="8901526100105 or 200105"
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ni-cat" className="block text-xs font-medium text-slate-700 mb-1">
              Supermarket Department
            </label>
            <select
              id="ni-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            >
              {[
                'Fresh Produce',
                'Staples & Grains',
                'Dairy & Bakery',
                'Beverages & Snacks',
                'Household Care',
                'Personal Care',
                'Packaging',
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ni-hsn" className="block text-xs font-medium text-slate-700 mb-1">
              HSN / SAC Code
            </label>
            <input
              id="ni-hsn"
              value={hsnCode}
              onChange={(e) => setHsnCode(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ni-uqc" className="block text-xs font-medium text-slate-700 mb-1">
              Unit (UQC)
            </label>
            <select
              id="ni-uqc"
              value={uqc}
              onChange={(e) => setUqc(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            >
              {['PKT', 'KG', 'PCS', 'BAG', 'PAC', 'BTL', 'LTR', 'BOX'].map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ni-gst" className="block text-xs font-medium text-slate-700 mb-1">
              GST Slab (%)
            </label>
            <select
              id="ni-gst"
              value={taxSlab}
              onChange={(e) => setTaxSlab(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            >
              {['0', '5', '12', '18', '28'].map((t) => (
                <option key={t} value={t}>
                  {t}% GST
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ni-mrp" className="block text-xs font-medium text-slate-700 mb-1">
              MRP (INR)
            </label>
            <input
              id="ni-mrp"
              type="number"
              step="0.01"
              value={mrp}
              onChange={(e) => setMrp(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ni-srate" className="block text-xs font-medium text-slate-700 mb-1">
              Retail Sale Rate
            </label>
            <input
              id="ni-srate"
              type="number"
              step="0.01"
              value={saleRate}
              onChange={(e) => setSaleRate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ni-prate" className="block text-xs font-medium text-slate-700 mb-1">
              Purchase Cost Rate
            </label>
            <input
              id="ni-prate"
              type="number"
              step="0.01"
              value={purchaseRate}
              onChange={(e) => setPurchaseRate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ni-wrate" className="block text-xs font-medium text-slate-700 mb-1">
              Wholesale Rate
            </label>
            <input
              id="ni-wrate"
              type="number"
              step="0.01"
              value={wholesaleRate}
              onChange={(e) => setWholesaleRate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ni-rack" className="block text-xs font-medium text-slate-700 mb-1">
              Rack / Bin Location
            </label>
            <input
              id="ni-rack"
              value={rackLocation}
              onChange={(e) => setRackLocation(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ni-reorder" className="block text-xs font-medium text-slate-700 mb-1">
              Auto-Reorder Level
            </label>
            <input
              id="ni-reorder"
              type="number"
              value={reorderLevel}
              onChange={(e) => setReorderLevel(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ni-batch" className="block text-xs font-medium text-slate-700 mb-1">
              Opening Batch No
            </label>
            <input
              id="ni-batch"
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ni-exp" className="block text-xs font-medium text-slate-700 mb-1">
              Batch Expiry Date
            </label>
            <input
              id="ni-exp"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ni-qty" className="block text-xs font-medium text-slate-700 mb-1">
              Opening Stock Qty / KG
            </label>
            <input
              id="ni-qty"
              type="number"
              step="0.25"
              value={initialQty}
              onChange={(e) => setInitialQty(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="inline-flex items-center gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={isWeighed}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsWeighed(checked);
                  if (checked) {
                    setUqc('KG');
                    setTaxSlab('0');
                  }
                }}
                className="h-4 w-4 accent-teal-700"
              />
              <span>
                Sold by Loose Weight (KG / GM) — enables instant 250g / 500g / 1kg weighing presets
                in Supermarket POS
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Link
            href="/admin/masters"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{syncing ? 'Saving...' : 'Save Item Master'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/* 3. New Bill of Material (BOM) Page */
export function NewBomPage() {
  const router = useRouter();
  const { dispatchAction, syncing } = useMargBooks();
  const [finishedItemName, setFinishedItemName] = useState('');
  const [recipeCode, setRecipeCode] = useState('BOM-KIT-04');
  const [yieldQty, setYieldQty] = useState('1');
  const [yieldUqc, setYieldUqc] = useState('BOX');
  const [laborCost, setLaborCost] = useState('25');
  const [compName, setCompName] = useState('India Gate Basmati Rice 5kg');
  const [compQty, setCompQty] = useState('1');
  const [compCost, setCompCost] = useState('498');
  const [components, setComponents] = useState<
    Array<{ itemName: string; qty: number; uqc: string; unitCost: number }>
  >([
    { itemName: 'Amul Pasteurised Butter 500g', qty: 1, uqc: 'PAC', unitCost: 228 },
  ]);

  const addComponent = () => {
    if (!compName.trim()) return;
    setComponents((prev) => [
      ...prev,
      {
        itemName: compName.trim(),
        qty: Number(compQty || 1),
        uqc: 'PCS',
        unitCost: Number(compCost || 0),
      },
    ]);
    setCompName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await dispatchAction(
      'CREATE_BOM',
      {
        finishedItemName: finishedItemName.trim(),
        recipeCode: recipeCode.trim(),
        yieldQty: Number(yieldQty || 1),
        yieldUqc,
        laborCost: Number(laborCost || 0),
        components,
      },
      `BOM recipe "${finishedItemName.trim()}" created.`
    );
    if (ok) router.push('/admin/masters');
  };

  return (
    <div className="max-w-3xl">
      <FormPageHeader
        backHref="/admin/masters"
        backLabel="Back to Master Module"
        title="New Bill of Material (BOM) Formula"
        subtitle="Define raw material components and assembly cost for combo kits or manufactured packs."
      />
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-lg border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="bom-name" className="block text-xs font-medium text-slate-700 mb-1">
              Finished Assembly / Combo Name
            </label>
            <input
              id="bom-name"
              required
              value={finishedItemName}
              onChange={(e) => setFinishedItemName(e.target.value)}
              placeholder="e.g. Monthly Family Grocery Saver Box"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="bom-code" className="block text-xs font-medium text-slate-700 mb-1">
              Recipe Code
            </label>
            <input
              id="bom-code"
              required
              value={recipeCode}
              onChange={(e) => setRecipeCode(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="bom-labor" className="block text-xs font-medium text-slate-700 mb-1">
              Packing / Labor Overhead (INR)
            </label>
            <input
              id="bom-labor"
              type="number"
              value={laborCost}
              onChange={(e) => setLaborCost(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="bom-yield" className="block text-xs font-medium text-slate-700 mb-1">
              Yield Quantity
            </label>
            <input
              id="bom-yield"
              type="number"
              value={yieldQty}
              onChange={(e) => setYieldQty(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="bom-uqc" className="block text-xs font-medium text-slate-700 mb-1">
              Yield UQC
            </label>
            <input
              id="bom-uqc"
              value={yieldUqc}
              onChange={(e) => setYieldUqc(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="text-xs font-semibold text-slate-800">Raw Material Components</div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              value={compName}
              onChange={(e) => setCompName(e.target.value)}
              placeholder="Component item name"
              className="sm:col-span-6 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={compQty}
              onChange={(e) => setCompQty(e.target.value)}
              placeholder="Qty"
              className="sm:col-span-2 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
            <input
              type="number"
              step="0.01"
              value={compCost}
              onChange={(e) => setCompCost(e.target.value)}
              placeholder="Unit cost"
              className="sm:col-span-2 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
            <button
              type="button"
              onClick={addComponent}
              className="sm:col-span-2 inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {components.map((c, idx) => (
              <div key={`${c.itemName}-${idx}`} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="font-medium text-slate-900">{c.itemName}</span>
                <span className="font-mono text-slate-600">
                  {c.qty} {c.uqc} x ₹{c.unitCost.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Link
            href="/admin/masters"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{syncing ? 'Saving...' : 'Save BOM Formula'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/* 4. New Sale Document Page (Wholesale GST Invoice / Estimate / Order / Challan / Credit Note) */
export function NewSaleDocumentPage() {
  const router = useRouter();
  const { workspace, dispatchActionWithResult, syncing } = useMargBooks();
  const customers = workspace.ledgers.filter((l) => l.groupType === 'Customer');
  const activeCompany =
    workspace.companies.find((c) => c.id === workspace.activeCompanyId) ||
    workspace.companies[0];

  const [docType, setDocType] = useState<SaleDocType>('GST_INVOICE');
  const [customerId, setCustomerId] = useState<number>(customers[0]?.id || 1);
  const [itemId, setItemId] = useState<number>(workspace.items[0]?.id || 101);
  const [qty, setQty] = useState<number>(10);
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'Cash' | 'Card' | 'PDC'>('UPI');

  const selectedCustomer = customers.find((c) => c.id === customerId) || customers[0];
  const selectedItem = workspace.items.find((i) => i.id === itemId) || workspace.items[0];
  const isInterState = Boolean(
    selectedCustomer?.stateCode &&
      activeCompany?.stateCode &&
      selectedCustomer.stateCode !== activeCompany.stateCode
  );

  const calc = useMemo(() => {
    const rate = selectedItem ? selectedItem.wholesaleRate || selectedItem.saleRate : 0;
    const subtotal = round2(rate * qty);
    const tax = round2((subtotal * (selectedItem?.taxSlab || 12)) / 100);
    return {
      rate,
      subtotal,
      cgst: isInterState ? 0 : round2(tax / 2),
      sgst: isInterState ? 0 : round2(tax / 2),
      igst: isInterState ? tax : 0,
      grandTotal: Math.round(subtotal + tax),
    };
  }, [selectedItem, qty, isInterState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !selectedCustomer) return;
    const prefixMap: Record<SaleDocType, string> = {
      POS_BILL: 'POS',
      GST_INVOICE: 'INV',
      ESTIMATE: 'EST',
      SALES_ORDER: 'SO',
      CHALLAN: 'DC',
      CREDIT_NOTE: 'CN',
    };
    const invoiceNo = `${prefixMap[docType]}-26-${String(workspace.invoices.length + 501).padStart(
      4,
      '0'
    )}`;
    const matchedBatch = workspace.batches.find((b) => b.itemId === selectedItem.id);
    const irn =
      docType === 'GST_INVOICE' && selectedCustomer.gstin
        ? generateDeterministicIrn(activeCompany?.gstin || '07AABCS1429B1ZB', invoiceNo, '2026-11-26')
        : '';

    const res = await dispatchActionWithResult(
      'CREATE_INVOICE',
      {
        invoiceNo,
        docType,
        counterCode: 'POS-02',
        ledgerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        customerGstin: selectedCustomer.gstin,
        invoiceDate: '2026-11-26',
        subtotal: calc.subtotal,
        discountAmount: 0,
        cgstAmount: calc.cgst,
        sgstAmount: calc.sgst,
        igstAmount: calc.igst,
        roundOff: round2(calc.grandTotal - (calc.subtotal + calc.cgst + calc.sgst + calc.igst)),
        grandTotal: calc.grandTotal,
        loyaltyEarned: 0,
        loyaltyRedeemed: 0,
        paymentModeSummary: paymentMode,
        payments: [{ mode: paymentMode, amount: calc.grandTotal }],
        items: [
          {
            itemId: selectedItem.id,
            barcode: selectedItem.barcode,
            name: selectedItem.name,
            hsnCode: selectedItem.hsnCode,
            batchNo: matchedBatch?.batchNo || 'STD-01',
            expiryDate: matchedBatch?.expiryDate || '2027-12-31',
            uqc: selectedItem.uqc,
            qty,
            freeQty: 0,
            mrp: selectedItem.mrp,
            rate: calc.rate,
            discountPercent: 0,
            discountAmount: 0,
            taxSlab: selectedItem.taxSlab,
            taxableValue: calc.subtotal,
            taxAmount: round2(calc.cgst + calc.sgst + calc.igst),
            lineTotal: round2(calc.subtotal + calc.cgst + calc.sgst + calc.igst),
          },
        ],
        irn,
        ewayBillNo: '',
        status: docType === 'CREDIT_NOTE' ? 'Returned' : 'Paid',
      },
      `${docType.replace('_', ' ')} ${invoiceNo} saved.`
    );
    if (res.ok) {
      const createdId = res.data?.invoices[0]?.id;
      router.push(createdId ? `/admin/bills/${createdId}` : '/admin/sales');
    }
  };

  return (
    <div className="max-w-3xl">
      <FormPageHeader
        backHref="/admin/sales"
        backLabel="Back to Sale & Billing Register"
        title="Create Sale Document"
        subtitle="Generate wholesale GST invoices, estimates, sales orders, delivery challans, or credit notes."
      />
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-lg border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ns-type" className="block text-xs font-medium text-slate-700 mb-1">
              Document Type
            </label>
            <select
              id="ns-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value as SaleDocType)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="GST_INVOICE">Wholesale GST Invoice</option>
              <option value="ESTIMATE">Estimate / Quotation</option>
              <option value="SALES_ORDER">Sales Order</option>
              <option value="CHALLAN">Delivery Challan</option>
              <option value="CREDIT_NOTE">Credit Note (Sale Return)</option>
            </select>
          </div>

          <div>
            <label htmlFor="ns-cust" className="block text-xs font-medium text-slate-700 mb-1">
              Party / Customer Ledger
            </label>
            <select
              id="ns-cust"
              value={customerId}
              onChange={(e) => setCustomerId(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.gstin ? `(${c.gstin})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="ns-item" className="block text-xs font-medium text-slate-700 mb-1">
              Product / SKU
            </label>
            <select
              id="ns-item"
              value={itemId}
              onChange={(e) => setItemId(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {workspace.items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} · Wholesale ₹{it.wholesaleRate || it.saleRate} · GST {it.taxSlab}%
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ns-qty" className="block text-xs font-medium text-slate-700 mb-1">
              Quantity
            </label>
            <input
              id="ns-qty"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>

          <div>
            <label htmlFor="ns-mode" className="block text-xs font-medium text-slate-700 mb-1">
              Settlement Mode
            </label>
            <select
              id="ns-mode"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as 'UPI' | 'Cash' | 'Card' | 'PDC')}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="UPI">UPI / NEFT</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="PDC">Post-Dated Cheque (PDC)</option>
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-600">Taxable Subtotal</span>
            <span className="font-mono tabular-nums">₹{calc.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">
              {isInterState ? 'IGST (Inter-State)' : 'CGST + SGST (Intra-State)'}
            </span>
            <span className="font-mono tabular-nums">
              ₹{(calc.cgst + calc.sgst + calc.igst).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
            <span>Net Document Total</span>
            <span className="font-mono tabular-nums">₹{calc.grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/sales"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{syncing ? 'Posting...' : 'Save & View Printable Bill'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/* 5. New Promotional Scheme Page */
export function NewSchemePage() {
  const router = useRouter();
  const { dispatchAction, syncing } = useMargBooks();
  const [name, setName] = useState('');
  const [barcodeOrCategory, setBarcodeOrCategory] = useState('Staples & Grains');
  const [schemeType, setSchemeType] = useState<'PERCENT_DISCOUNT' | 'BUY_X_GET_Y'>(
    'PERCENT_DISCOUNT'
  );
  const [minQty, setMinQty] = useState('3');
  const [freeQty, setFreeQty] = useState('0');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [validFrom, setValidFrom] = useState('2026-11-01');
  const [validTo, setValidTo] = useState('2026-12-31');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await dispatchAction(
      'CREATE_SCHEME',
      {
        name: name.trim(),
        barcodeOrCategory: barcodeOrCategory.trim() || 'ALL',
        schemeType,
        minQty: Number(minQty || 1),
        freeQty: schemeType === 'BUY_X_GET_Y' ? Number(freeQty || 1) : 0,
        discountPercent: schemeType === 'PERCENT_DISCOUNT' ? Number(discountPercent || 0) : 0,
        validFrom,
        validTo,
      },
      `Promotional scheme "${name.trim()}" activated.`
    );
    if (ok) router.push('/admin/sales');
  };

  return (
    <div className="max-w-3xl">
      <FormPageHeader
        backHref="/admin/sales"
        backLabel="Back to Sale & Billing Register"
        title="Create Auto-Applied Promotional Scheme"
        subtitle="Configure date-bound percentage discounts or Buy-X-Get-Y free quantity offers applied automatically in Retail POS."
      />
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-lg border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="sch-name" className="block text-xs font-medium text-slate-700 mb-1">
              Scheme Title
            </label>
            <input
              id="sch-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend Dairy 5% Off (3+ Packs)"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="sch-target" className="block text-xs font-medium text-slate-700 mb-1">
              Target Barcode or Department
            </label>
            <input
              id="sch-target"
              required
              value={barcodeOrCategory}
              onChange={(e) => setBarcodeOrCategory(e.target.value)}
              placeholder="Staples & Grains / Dairy & Bakery / ALL / Barcode"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="sch-type" className="block text-xs font-medium text-slate-700 mb-1">
              Scheme Type
            </label>
            <select
              id="sch-type"
              value={schemeType}
              onChange={(e) =>
                setSchemeType(e.target.value === 'BUY_X_GET_Y' ? 'BUY_X_GET_Y' : 'PERCENT_DISCOUNT')
              }
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="PERCENT_DISCOUNT">Percentage Discount (%)</option>
              <option value="BUY_X_GET_Y">Buy X Get Y Free Qty</option>
            </select>
          </div>
          <div>
            <label htmlFor="sch-min" className="block text-xs font-medium text-slate-700 mb-1">
              Minimum Qualifying Qty
            </label>
            <input
              id="sch-min"
              type="number"
              min={1}
              value={minQty}
              onChange={(e) => setMinQty(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>
          {schemeType === 'PERCENT_DISCOUNT' ? (
            <div>
              <label htmlFor="sch-pct" className="block text-xs font-medium text-slate-700 mb-1">
                Discount Percentage (%)
              </label>
              <input
                id="sch-pct"
                type="number"
                step="0.5"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="sch-free" className="block text-xs font-medium text-slate-700 mb-1">
                Free Units Given
              </label>
              <input
                id="sch-free"
                type="number"
                min={1}
                value={freeQty}
                onChange={(e) => setFreeQty(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
          )}
          <div>
            <label htmlFor="sch-from" className="block text-xs font-medium text-slate-700 mb-1">
              Valid From
            </label>
            <input
              id="sch-from"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label htmlFor="sch-to" className="block text-xs font-medium text-slate-700 mb-1">
              Valid To
            </label>
            <input
              id="sch-to"
              type="date"
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Link
            href="/admin/sales"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{syncing ? 'Saving...' : 'Activate Scheme'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/* 6. New Purchase Bill / CSV Import Page */
export function NewPurchaseImportPage() {
  const router = useRouter();
  const { workspace, dispatchAction, syncing } = useMargBooks();
  const suppliers = workspace.ledgers.filter((l) => l.groupType === 'Supplier');
  const [supplierId, setSupplierId] = useState<number>(suppliers[0]?.id || 1);
  const [docType, setDocType] = useState<PurchaseDocType>('PURCHASE_BILL');
  const [billNo, setBillNo] = useState(`PB-26-${workspace.purchases.length + 401}`);
  const [csvText, setCsvText] = useState(
    'ItemName,Barcode,HSN,Batch,Expiry,Qty,Rate,TaxPct\nIndia Gate Basmati Rice 5kg,8901526100105,10063020,IG26-IMP9,2027-11-30,50,495.0,5\nAmul Pasteurised Butter 500g,8901262010016,04051000,AM26-IMP2,2027-05-31,40,226.0,12'
  );

  const parsed = useMemo(() => parsePurchaseImportCsv(csvText), [csvText]);
  const selectedSupplier = suppliers.find((s) => s.id === supplierId) || suppliers[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsed.lines.length === 0) return;
    const ok = await dispatchAction(
      'CREATE_PURCHASE',
      {
        billNo: billNo.trim(),
        docType,
        ledgerId: selectedSupplier?.id || null,
        supplierName: selectedSupplier?.name || 'Supplier',
        supplierGstin: selectedSupplier?.gstin || '',
        billDate: '2026-11-26',
        subtotal: parsed.subtotal,
        taxAmount: parsed.taxAmount,
        grandTotal: parsed.grandTotal,
        items: parsed.lines,
        importSource: 'CSV',
        status: 'Posted',
      },
      `Purchase ${billNo.trim()} imported and batches updated.`
    );
    if (ok) router.push('/admin/purchases');
  };

  return (
    <div className="max-w-4xl">
      <FormPageHeader
        backHref="/admin/purchases"
        backLabel="Back to Purchase Module"
        title="New Purchase Entry & CSV Invoice Import"
        subtitle="Import supplier bills directly into live branch stock batches with automatic GST calculation."
      />
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-lg border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="np-type" className="block text-xs font-medium text-slate-700 mb-1">
              Document Type
            </label>
            <select
              id="np-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value as PurchaseDocType)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="PURCHASE_BILL">Purchase Bill (Adds Stock)</option>
              <option value="PURCHASE_ORDER">Purchase Order</option>
              <option value="DEBIT_NOTE">Debit Note (Return)</option>
            </select>
          </div>
          <div>
            <label htmlFor="np-sup" className="block text-xs font-medium text-slate-700 mb-1">
              Supplier Ledger
            </label>
            <select
              id="np-sup"
              value={supplierId}
              onChange={(e) => setSupplierId(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="np-no" className="block text-xs font-medium text-slate-700 mb-1">
              Supplier Bill / PO No
            </label>
            <input
              id="np-no"
              required
              value={billNo}
              onChange={(e) => setBillNo(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="np-csv" className="block text-xs font-medium text-slate-700 mb-1">
            CSV Line Items (ItemName,Barcode,HSN,Batch,Expiry,Qty,Rate,TaxPct)
          </label>
          <textarea
            id="np-csv"
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
          />
        </div>

        {parsed.errors.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {parsed.errors.join(' ')}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <span>Parsed Lines: {parsed.lines.length}</span>
          <span className="font-mono">Subtotal: ₹{parsed.subtotal.toFixed(2)}</span>
          <span className="font-mono">GST: ₹{parsed.taxAmount.toFixed(2)}</span>
          <span className="font-mono font-bold text-slate-900">
            Grand Total: ₹{parsed.grandTotal.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/purchases"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={syncing || parsed.lines.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>{syncing ? 'Importing...' : 'Post Purchase & Update Batches'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/* 7. New Stock Movement Page */
export function NewStockMovementPage() {
  const router = useRouter();
  const { workspace, dispatchAction, syncing } = useMargBooks();
  const [batchId, setBatchId] = useState<number>(workspace.batches[0]?.id || 1);
  const [movementType, setMovementType] = useState<'TRANSFER' | 'ADJUSTMENT' | 'DUMP'>('TRANSFER');
  const [toGodown, setToGodown] = useState('Branch 02 — South Store');
  const [qtyDelta, setQtyDelta] = useState('10');
  const [reason, setReason] = useState('Store replenishment transfer');

  const selectedBatch = workspace.batches.find((b) => b.id === batchId) || workspace.batches[0];
  const matchedItem = workspace.items.find((i) => i.id === selectedBatch?.itemId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    const rawQty = Math.abs(Number(qtyDelta || 0));
    const signedDelta = movementType === 'DUMP' ? -rawQty : Number(qtyDelta || 0);
    const ok = await dispatchAction(
      'STOCK_MOVEMENT',
      {
        batchId: selectedBatch.id,
        movementType,
        itemName: matchedItem?.name || 'Item',
        batchNo: selectedBatch.batchNo,
        fromGodown: selectedBatch.godownName,
        toGodown: movementType === 'TRANSFER' ? toGodown : selectedBatch.godownName,
        qtyDelta: signedDelta,
        reason: reason.trim(),
        movementDate: '2026-11-26',
      },
      `Stock ${movementType.toLowerCase()} recorded for batch ${selectedBatch.batchNo}.`
    );
    if (ok) router.push('/admin/inventory');
  };

  return (
    <div className="max-w-3xl">
      <FormPageHeader
        backHref="/admin/inventory"
        backLabel="Back to Stock & Inventory"
        title="Record Stock Transfer, Adjustment, or Dump"
        subtitle="Move batches between godowns/branches, reconcile physical counts, or write off expired stock."
      />
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-lg border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="sm-batch" className="block text-xs font-medium text-slate-700 mb-1">
              Source Item Batch
            </label>
            <select
              id="sm-batch"
              value={batchId}
              onChange={(e) => setBatchId(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {workspace.batches.map((b) => {
                const it = workspace.items.find((i) => i.id === b.itemId);
                return (
                  <option key={b.id} value={b.id}>
                    {it?.name || `Item #${b.itemId}`} · Batch {b.batchNo} ({b.godownName}) · Qty{' '}
                    {b.qtyOnHand}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label htmlFor="sm-type" className="block text-xs font-medium text-slate-700 mb-1">
              Movement Type
            </label>
            <select
              id="sm-type"
              value={movementType}
              onChange={(e) =>
                setMovementType(e.target.value as 'TRANSFER' | 'ADJUSTMENT' | 'DUMP')
              }
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="TRANSFER">Inter-Godown / Branch Transfer</option>
              <option value="ADJUSTMENT">Physical Stock Adjustment (+/-)</option>
              <option value="DUMP">Expired / Damaged Stock Dump</option>
            </select>
          </div>
          <div>
            <label htmlFor="sm-qty" className="block text-xs font-medium text-slate-700 mb-1">
              Quantity
            </label>
            <input
              id="sm-qty"
              type="number"
              required
              value={qtyDelta}
              onChange={(e) => setQtyDelta(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>
          {movementType === 'TRANSFER' && (
            <div className="sm:col-span-2">
              <label htmlFor="sm-dest" className="block text-xs font-medium text-slate-700 mb-1">
                Destination Godown / Branch
              </label>
              <input
                id="sm-dest"
                value={toGodown}
                onChange={(e) => setToGodown(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <label htmlFor="sm-reason" className="block text-xs font-medium text-slate-700 mb-1">
              Audit Reason / Remarks
            </label>
            <input
              id="sm-reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Link
            href="/admin/inventory"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{syncing ? 'Posting...' : 'Record Movement'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/* 8. New Double-Entry Accounting Voucher Page */
export function NewVoucherPage() {
  const router = useRouter();
  const { workspace, dispatchAction, syncing } = useMargBooks();
  const [voucherType, setVoucherType] = useState<VoucherType>('Receipt');
  const [debitLedgerName, setDebitLedgerName] = useState(
    workspace.ledgers.find((l) => l.groupType === 'Bank' || l.groupType === 'Cash')?.name ||
      workspace.ledgers[0]?.name ||
      'Cash-in-Hand'
  );
  const [creditLedgerName, setCreditLedgerName] = useState(
    workspace.ledgers.find((l) => l.groupType === 'Customer')?.name ||
      workspace.ledgers[1]?.name ||
      'Customer'
  );
  const [amount, setAmount] = useState('5000');
  const [paymentMode, setPaymentMode] = useState('UPI / Bank Transfer');
  const [chequeNo, setChequeNo] = useState('');
  const [pdcDate, setPdcDate] = useState('');
  const [referenceInvoiceNo, setReferenceInvoiceNo] = useState('');
  const [narration, setNarration] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prefix = voucherType.slice(0, 3).toUpperCase();
    const voucherNo = `${prefix}-26-${String(workspace.vouchers.length + 101).padStart(4, '0')}`;
    const ok = await dispatchAction(
      'CREATE_VOUCHER',
      {
        voucherNo,
        voucherType,
        voucherDate: '2026-11-26',
        debitLedgerName,
        creditLedgerName,
        amount: Number(amount || 0),
        paymentMode,
        chequeNo: chequeNo.trim(),
        pdcDate,
        referenceInvoiceNo: referenceInvoiceNo.trim(),
        narration: narration.trim(),
        reconciled: false,
      },
      `${voucherType} voucher ${voucherNo} posted.`
    );
    if (ok) router.push('/admin/accounting');
  };

  return (
    <div className="max-w-3xl">
      <FormPageHeader
        backHref="/admin/accounting"
        backLabel="Back to Accounting Transactions"
        title="Post Double-Entry Accounting Voucher"
        subtitle="Record Receipt, Payment, Contra, Journal, Debit Note, or Credit Note entries with optional PDC tracking."
      />
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-lg border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="nv-type" className="block text-xs font-medium text-slate-700 mb-1">
              Voucher Type
            </label>
            <select
              id="nv-type"
              value={voucherType}
              onChange={(e) => setVoucherType(e.target.value as VoucherType)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {(['Receipt', 'Payment', 'Contra', 'Journal', 'Debit Note', 'Credit Note'] as VoucherType[]).map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <label htmlFor="nv-amt" className="block text-xs font-medium text-slate-700 mb-1">
              Amount (INR)
            </label>
            <input
              id="nv-amt"
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label htmlFor="nv-dr" className="block text-xs font-medium text-slate-700 mb-1">
              Debit (Dr) Account
            </label>
            <select
              id="nv-dr"
              value={debitLedgerName}
              onChange={(e) => setDebitLedgerName(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {workspace.ledgers.map((l) => (
                <option key={l.id} value={l.name}>
                  {l.name} ({l.groupType})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nv-cr" className="block text-xs font-medium text-slate-700 mb-1">
              Credit (Cr) Account
            </label>
            <select
              id="nv-cr"
              value={creditLedgerName}
              onChange={(e) => setCreditLedgerName(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {workspace.ledgers.map((l) => (
                <option key={l.id} value={l.name}>
                  {l.name} ({l.groupType})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nv-mode" className="block text-xs font-medium text-slate-700 mb-1">
              Payment / Instrument Mode
            </label>
            <input
              id="nv-mode"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="nv-ref" className="block text-xs font-medium text-slate-700 mb-1">
              Bill / Invoice Reference
            </label>
            <input
              id="nv-ref"
              value={referenceInvoiceNo}
              onChange={(e) => setReferenceInvoiceNo(e.target.value)}
              placeholder="e.g. INV-26-0412"
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label htmlFor="nv-chq" className="block text-xs font-medium text-slate-700 mb-1">
              Cheque / PDC No (Optional)
            </label>
            <input
              id="nv-chq"
              value={chequeNo}
              onChange={(e) => setChequeNo(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label htmlFor="nv-pdc" className="block text-xs font-medium text-slate-700 mb-1">
              PDC Maturity Date (Optional)
            </label>
            <input
              id="nv-pdc"
              type="date"
              value={pdcDate}
              onChange={(e) => setPdcDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="nv-narr" className="block text-xs font-medium text-slate-700 mb-1">
              Narration
            </label>
            <input
              id="nv-narr"
              required
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="Being payment received against bill settlement"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Link
            href="/admin/accounting"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{syncing ? 'Posting...' : 'Post Voucher'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/* 9. New CRM Lead / Marg Mart Online Order Page */
export function NewCrmRecordPage() {
  const router = useRouter();
  const { dispatchAction, syncing } = useMargBooks();
  const [channel, setChannel] = useState<'CRM_LEAD' | 'MARG_MART_ORDER'>('MARG_MART_ORDER');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [orderValue, setOrderValue] = useState('2450');
  const [nextFollowUp, setNextFollowUp] = useState('2026-11-28');
  const [itemsSummary, setItemsSummary] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await dispatchAction(
      'CREATE_CRM',
      {
        channel,
        customerName: customerName.trim(),
        phone: phone.trim(),
        stage: 'New',
        orderValue: Number(orderValue || 0),
        nextFollowUp,
        itemsSummary: itemsSummary.trim(),
        notes: notes.trim(),
      },
      `Record for "${customerName.trim()}" added to CRM & Marg Mart.`
    );
    if (ok) router.push('/admin/crm');
  };

  return (
    <div className="max-w-3xl">
      <FormPageHeader
        backHref="/admin/crm"
        backLabel="Back to CRM & Marg Mart"
        title="New CRM Follow-Up or Marg Mart Order"
        subtitle="Capture a B2B wholesale enquiry or incoming online storefront order directly into your pipeline."
      />
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-lg border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="crm-ch" className="block text-xs font-medium text-slate-700 mb-1">
              Channel
            </label>
            <select
              id="crm-ch"
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value === 'CRM_LEAD' ? 'CRM_LEAD' : 'MARG_MART_ORDER')
              }
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="MARG_MART_ORDER">Marg Mart Online Order</option>
              <option value="CRM_LEAD">CRM Sales Lead / Follow-Up</option>
            </select>
          </div>
          <div>
            <label htmlFor="crm-val" className="block text-xs font-medium text-slate-700 mb-1">
              Estimated Order Value (INR)
            </label>
            <input
              id="crm-val"
              type="number"
              required
              value={orderValue}
              onChange={(e) => setOrderValue(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label htmlFor="crm-name" className="block text-xs font-medium text-slate-700 mb-1">
              Customer / Restaurant Name
            </label>
            <input
              id="crm-name"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. SpiceRoute Kitchens"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="crm-phone" className="block text-xs font-medium text-slate-700 mb-1">
              Phone / WhatsApp
            </label>
            <input
              id="crm-phone"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98451 33019"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="crm-date" className="block text-xs font-medium text-slate-700 mb-1">
              Next Follow-Up / Delivery Date
            </label>
            <input
              id="crm-date"
              type="date"
              value={nextFollowUp}
              onChange={(e) => setNextFollowUp(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label htmlFor="crm-items" className="block text-xs font-medium text-slate-700 mb-1">
              Items Summary
            </label>
            <input
              id="crm-items"
              value={itemsSummary}
              onChange={(e) => setItemsSummary(e.target.value)}
              placeholder="e.g. 5x Basmati Rice 5kg, 10x Fortune Oil 1L"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="crm-notes" className="block text-xs font-medium text-slate-700 mb-1">
              Follow-Up Notes
            </label>
            <textarea
              id="crm-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Link
            href="/admin/crm"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{syncing ? 'Saving...' : 'Save Record'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
