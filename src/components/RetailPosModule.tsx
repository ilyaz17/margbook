'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  History,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  Scale,
  ScanBarcode,
  Search,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  calculateInvoiceTotals,
  generateDeterministicIrn,
  parseBarcodeOrPluInput,
  round2,
  round3,
  validateMultiPayments,
  type RawCartLine,
} from '../lib/erp-engine';
import type {
  HeldCart,
  InventoryItem,
  PaymentMode,
  PaymentSplit,
} from '../types/erp';
import { useMargBooks } from './MargBooksContext';

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatQtyDisplay(qty: number, uqc: string, isWeighed?: boolean) {
  if (isWeighed || uqc === 'KG') {
    return `${Number(qty.toFixed(3))} ${uqc}`;
  }
  return `${qty} ${uqc}`;
}

const QUICK_WEIGHT_PRESETS = [
  { label: '250g', kg: 0.25 },
  { label: '500g', kg: 0.5 },
  { label: '750g', kg: 0.75 },
  { label: '1 kg', kg: 1 },
  { label: '2 kg', kg: 2 },
];

export function RetailPosModule() {
  const router = useRouter();
  const { workspace, dispatchActionWithResult, showToast } = useMargBooks();
  const activeCompany =
    workspace.companies.find((c) => c.id === workspace.activeCompanyId) ||
    workspace.companies[0];

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedCounter, setSelectedCounter] = useState<string>(
    workspace.posCounters[0]?.counterCode || 'LANE-01'
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(
    workspace.ledgers.find((l) => l.groupType === 'Customer' && l.loyaltyPoints > 0)?.id ||
      workspace.ledgers.find((l) => l.groupType === 'Customer')?.id ||
      1
  );
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [cart, setCart] = useState<RawCartLine[]>([]);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [weighingItem, setWeighingItem] = useState<InventoryItem | null>(null);
  const [customKgInput, setCustomKgInput] = useState('1.00');
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [payments, setPayments] = useState<PaymentSplit[]>([
    { mode: 'Cash', amount: 0, reference: '' },
  ]);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const today = '2026-11-26';

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  const customers = useMemo(
    () => workspace.ledgers.filter((l) => l.groupType === 'Customer'),
    [workspace.ledgers]
  );

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || customers[0],
    [customers, selectedCustomerId]
  );

  const activeCounterObj = useMemo(
    () =>
      workspace.posCounters.find((c) => c.counterCode === selectedCounter) ||
      workspace.posCounters[0],
    [workspace.posCounters, selectedCounter]
  );

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    workspace.items.forEach((i) => set.add(i.category));
    return Array.from(set);
  }, [workspace.items]);

  const itemStockMap = useMemo(() => {
    const map = new Map<
      number,
      { totalQty: number; preferredBatch: string; expiryDate: string }
    >();
    workspace.items.forEach((item) => {
      const validBatches = workspace.batches
        .filter((b) => b.itemId === item.id && b.qtyOnHand > 0)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
      const totalQty = round3(validBatches.reduce((s, b) => s + b.qtyOnHand, 0));
      map.set(item.id, {
        totalQty,
        preferredBatch: validBatches[0]?.batchNo || 'STD-01',
        expiryDate: validBatches[0]?.expiryDate || '2027-12-31',
      });
    });
    return map;
  }, [workspace.items, workspace.batches]);

  // Fast-moving supermarket quick-add strip (Carry Bag, Milk, Bread, Water, Onions)
  const quickEssentialItems = useMemo(() => {
    const priorityBarcodes = ['100001', '8901262150019', '8901063311022', '8906017290018', '200102'];
    const found: InventoryItem[] = [];
    for (const code of priorityBarcodes) {
      const match = workspace.items.find((it) => it.barcode === code);
      if (match) found.push(match);
    }
    if (found.length < 5) {
      for (const it of workspace.items) {
        if (!found.some((f) => f.id === it.id)) {
          found.push(it);
        }
        if (found.length === 5) break;
      }
    }
    return found;
  }, [workspace.items]);

  const filteredItems = useMemo(() => {
    const parsed = parseBarcodeOrPluInput(barcodeQuery);
    const q = parsed.query.toLowerCase();
    return workspace.items.filter((item) => {
      const catOk = categoryFilter === 'All' || item.category === categoryFilter;
      const searchOk =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.barcode.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q);
      return catOk && searchOk;
    });
  }, [workspace.items, categoryFilter, barcodeQuery]);

  const isInterState = Boolean(
    selectedCustomer?.stateCode &&
      activeCompany?.stateCode &&
      selectedCustomer.stateCode !== activeCompany.stateCode
  );

  const calculatedBill = useMemo(
    () =>
      calculateInvoiceTotals({
        cartLines: cart,
        schemes: workspace.schemes,
        autoApplySchemes: workspace.controlRoom.autoApplySchemes,
        asOfDate: today,
        isInterState,
        redeemPoints,
        availableCustomerPoints: selectedCustomer?.loyaltyPoints || 0,
        loyaltyPointValue: workspace.controlRoom.loyaltyPointValue,
        loyaltyEarnPer100: workspace.controlRoom.loyaltyEarnPer100,
        enableLoyaltyPoints: workspace.controlRoom.enableLoyaltyPoints,
      }),
    [
      cart,
      workspace.schemes,
      workspace.controlRoom,
      isInterState,
      redeemPoints,
      selectedCustomer,
    ]
  );

  const addItemWithQty = useCallback(
    (item: InventoryItem, qtyToAdd: number) => {
      setCheckoutError(null);
      const safeAdd = round3(qtyToAdd);
      if (safeAdd <= 0) return;

      const stock = itemStockMap.get(item.id);
      const available = stock?.totalQty ?? 0;

      setCart((prev) => {
        const existing = prev.find((l) => l.item.id === item.id);
        const nextQty = round3((existing?.qty || 0) + safeAdd);
        if (!workspace.controlRoom.allowNegativeStock && nextQty > available) {
          showToast(
            `Insufficient stock for ${item.name} (${formatQtyDisplay(available, item.uqc, item.isWeighed)} available).`,
            'warning'
          );
          return prev;
        }
        if (existing) {
          return prev.map((l) =>
            l.item.id === item.id ? { ...l, qty: nextQty } : l
          );
        }
        return [
          ...prev,
          {
            item,
            batchNo: stock?.preferredBatch || 'STD-01',
            expiryDate: stock?.expiryDate || '2027-12-31',
            qty: safeAdd,
          },
        ];
      });
    },
    [itemStockMap, workspace.controlRoom.allowNegativeStock, showToast]
  );

  const handleTileClick = (item: InventoryItem) => {
    if (item.isWeighed) {
      setWeighingItem(item);
      setCustomKgInput('1.00');
      return;
    }
    addItemWithQty(item, 1);
  };

  const handleAddWeighedQty = (kg: number) => {
    if (!weighingItem) return;
    const safeKg = round3(kg);
    if (!Number.isFinite(safeKg) || safeKg <= 0) {
      showToast('Enter a valid weight in KG (e.g. 0.25 or 1.5).', 'warning');
      return;
    }
    addItemWithQty(weighingItem, safeKg);
    showToast(
      `Added ${safeKg} ${weighingItem.uqc} of ${weighingItem.name}`,
      'info'
    );
    setWeighingItem(null);
    barcodeInputRef.current?.focus();
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { qty, query } = parseBarcodeOrPluInput(barcodeQuery);
    const q = query.toLowerCase();
    if (!q) return;

    const exact = workspace.items.find(
      (i) => i.barcode.toLowerCase() === q || i.sku.toLowerCase() === q
    );
    const target = exact || filteredItems[0];

    if (target) {
      // If item is weighed and user didn't pass an explicit qty multiplier like 0.5*200101, open inline weigh bar
      if (target.isWeighed && !barcodeQuery.includes('*')) {
        setWeighingItem(target);
        setCustomKgInput('1.00');
        setBarcodeQuery('');
        return;
      }
      addItemWithQty(target, qty);
      setBarcodeQuery('');
      showToast(
        `Scanned ${formatQtyDisplay(qty, target.uqc, target.isWeighed)} · ${target.name}`,
        'info'
      );
    } else {
      showToast(`No product matched barcode / PLU "${query}"`, 'warning');
    }
  };

  const updateLineQty = (itemId: number, delta: number) => {
    setCheckoutError(null);
    const available = itemStockMap.get(itemId)?.totalQty ?? 0;
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.item.id !== itemId) return line;
          const nextQty = round3(line.qty + delta);
          if (!workspace.controlRoom.allowNegativeStock && nextQty > available) {
            showToast(
              `Only ${formatQtyDisplay(available, line.item.uqc, line.item.isWeighed)} in stock for ${line.item.name}.`,
              'warning'
            );
            return line;
          }
          return { ...line, qty: nextQty };
        })
        .filter((line) => line.qty > 0.0001)
    );
  };

  const handleHoldCart = useCallback(() => {
    if (cart.length === 0) {
      showToast('Scan at least one item before holding a cart.', 'warning');
      return;
    }
    const nowTime = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const nextHold: HeldCart = {
      id: `hold-${Date.now()}`,
      label: `Cart #${heldCarts.length + 1}`,
      customerId: selectedCustomer?.id || 1,
      customerName: selectedCustomer?.name || 'Walk-in Shopper',
      heldAt: nowTime,
      itemCount: cart.length,
      estimatedTotal: calculatedBill.grandTotal,
      lines: cart.map((l) => ({
        itemId: l.item.id,
        batchNo: l.batchNo,
        expiryDate: l.expiryDate,
        qty: l.qty,
        rateOverride: l.rateOverride,
        manualDiscountPercent: l.manualDiscountPercent,
      })),
    };
    setHeldCarts((prev) => [nextHold, ...prev]);
    setCart([]);
    setRedeemPoints(0);
    setPayments([{ mode: 'Cash', amount: 0, reference: '' }]);
    setCheckoutError(null);
    showToast(
      `Parked ${nextHold.label} (${nextHold.itemCount} items · ${formatInr(nextHold.estimatedTotal)}) — ready for next shopper.`,
      'info'
    );
    barcodeInputRef.current?.focus();
  }, [cart, heldCarts.length, selectedCustomer, calculatedBill.grandTotal, showToast]);

  const handleResumeHeldCart = (held: HeldCart) => {
    // If active cart has items, auto-hold it first so nothing is lost
    if (cart.length > 0) {
      handleHoldCart();
    }
    const restoredLines: RawCartLine[] = [];
    for (const ln of held.lines) {
      const item = workspace.items.find((it) => it.id === ln.itemId);
      if (item) {
        restoredLines.push({
          item,
          batchNo: ln.batchNo,
          expiryDate: ln.expiryDate,
          qty: ln.qty,
          rateOverride: ln.rateOverride,
          manualDiscountPercent: ln.manualDiscountPercent,
        });
      }
    }
    setCart(restoredLines);
    setSelectedCustomerId(held.customerId);
    setHeldCarts((prev) => prev.filter((h) => h.id !== held.id));
    setPayments([{ mode: 'Cash', amount: 0, reference: '' }]);
    setCheckoutError(null);
    showToast(`Resumed ${held.label} (${held.customerName}).`, 'info');
    barcodeInputRef.current?.focus();
  };

  const setExactPaymentForSingleMode = useCallback(
    (mode: PaymentMode) => {
      setCheckoutError(null);
      setPayments([{ mode, amount: calculatedBill.grandTotal, reference: '' }]);
    },
    [calculatedBill.grandTotal]
  );

  const addSplitPaymentRow = () => {
    const used = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const rem = Math.max(0, round2(calculatedBill.grandTotal - used));
    const nextMode: PaymentMode = payments.some((p) => p.mode === 'UPI')
      ? 'Card'
      : 'UPI';
    setPayments((prev) => [...prev, { mode: nextMode, amount: rem, reference: '' }]);
  };

  const updatePaymentRow = (idx: number, patch: Partial<PaymentSplit>) => {
    setCheckoutError(null);
    setPayments((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    );
  };

  const removePaymentRow = (idx: number) => {
    setPayments((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  };

  const paymentValidation = useMemo(
    () => validateMultiPayments(payments, calculatedBill.grandTotal),
    [payments, calculatedBill.grandTotal]
  );

  const handleCompleteSale = useCallback(async () => {
    setCheckoutError(null);
    if (activeCompany?.fyLocked) {
      setCheckoutError('Financial year is locked in Control Room. Unlock FY to post bills.');
      return;
    }
    if (activeCounterObj?.status === 'CLOSED') {
      setCheckoutError(
        `${activeCounterObj.counterCode} is closed for the day. Reopen lane in Control Room or Shifts.`
      );
      return;
    }
    if (calculatedBill.lines.length === 0) {
      setCheckoutError('Scan or tap at least one grocery item to create a supermarket bill.');
      return;
    }

    const validation = validateMultiPayments(payments, calculatedBill.grandTotal);
    if (!validation.valid) {
      setCheckoutError(validation.error || 'Verify multi-payment amounts or press F8 Cash / F9 UPI.');
      return;
    }

    const nextSeq = workspace.invoices.length + 413;
    const invoiceNo = `POS-26-0${nextSeq}`;
    const irn =
      workspace.controlRoom.eInvoiceAutoIrn && selectedCustomer?.gstin
        ? generateDeterministicIrn(activeCompany.gstin, invoiceNo, today)
        : '';

    const newInvoicePayload = {
      invoiceNo,
      docType: 'POS_BILL',
      counterCode: selectedCounter,
      ledgerId: selectedCustomer?.id || null,
      customerName: selectedCustomer?.name || 'Walk-in Supermarket Shopper',
      customerPhone: selectedCustomer?.phone || '',
      customerGstin: selectedCustomer?.gstin || '',
      invoiceDate: today,
      subtotal: calculatedBill.subtotal,
      discountAmount: calculatedBill.discountAmount,
      cgstAmount: calculatedBill.cgstAmount,
      sgstAmount: calculatedBill.sgstAmount,
      igstAmount: calculatedBill.igstAmount,
      roundOff: calculatedBill.roundOff,
      grandTotal: calculatedBill.grandTotal,
      loyaltyEarned: calculatedBill.loyaltyEarned,
      loyaltyRedeemed: calculatedBill.loyaltyRedeemed,
      paymentModeSummary: validation.summaryLabel,
      payments: payments.filter((p) => p.amount > 0),
      items: calculatedBill.lines,
      irn,
      ewayBillNo: '',
      status: 'Paid',
    };

    const res = await dispatchActionWithResult(
      'CREATE_INVOICE',
      newInvoicePayload,
      `Supermarket Bill ${invoiceNo} generated (${formatInr(calculatedBill.grandTotal)} · Saved ${formatInr(calculatedBill.totalMrpSavings)}).`
    );

    if (res.ok) {
      setCart([]);
      setRedeemPoints(0);
      setPayments([{ mode: 'Cash', amount: 0, reference: '' }]);
      const createdInvoice =
        res.data?.invoices.find((i) => i.invoiceNo === invoiceNo) ||
        res.data?.invoices[0];
      if (createdInvoice) {
        router.push(`/admin/bills/${createdInvoice.id}`);
      }
    }
  }, [
    activeCompany,
    activeCounterObj,
    calculatedBill,
    payments,
    workspace.invoices.length,
    workspace.controlRoom.eInvoiceAutoIrn,
    selectedCustomer,
    selectedCounter,
    dispatchActionWithResult,
    router,
  ]);

  // High-speed Supermarket Checkout Hotkeys: F2 Scan, F4 Hold, F8 Cash, F9 UPI, F12 Complete
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleHoldCart();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (calculatedBill.grandTotal > 0) {
          setExactPaymentForSingleMode('Cash');
          showToast(`Exact Cash set: ${formatInr(calculatedBill.grandTotal)}`, 'info');
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (calculatedBill.grandTotal > 0) {
          setExactPaymentForSingleMode('UPI');
          showToast(`Exact UPI set: ${formatInr(calculatedBill.grandTotal)}`, 'info');
        }
      } else if (e.key === 'F12') {
        e.preventDefault();
        void handleCompleteSale();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleHoldCart,
    calculatedBill.grandTotal,
    setExactPaymentForSingleMode,
    handleCompleteSale,
    showToast,
  ]);

  return (
    <div className="space-y-4">
      {/* Supermarket POS Top Lane Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Supermarket Fast POS</h1>
            <p className="text-xs text-slate-500">
              Barcode / PLU &amp; Loose Weight (KG) · Auto schemes{' '}
              {workspace.controlRoom.autoApplySchemes ? 'ON' : 'OFF'} · Loyalty{' '}
              {workspace.controlRoom.enableLoyaltyPoints ? 'ON' : 'OFF'}
            </p>
          </div>
          {workspace.controlRoom.multiCounterEnabled && (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <label htmlFor="pos-counter-select" className="text-xs font-medium text-slate-600">
                Lane
              </label>
              <select
                id="pos-counter-select"
                value={selectedCounter}
                onChange={(e) => setSelectedCounter(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                {workspace.posCounters.map((c) => (
                  <option key={c.id} value={c.counterCode}>
                    {c.counterCode} · {c.operatorName} ({c.status})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleHoldCart}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap cursor-pointer"
          >
            <PauseCircle className="h-3.5 w-3.5" />
            <span>Hold Cart (F4)</span>
          </button>
          <Link
            href={`/admin/ledgers/${selectedCustomer?.id || 1}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <History className="h-3.5 w-3.5" />
            <span>Shopper Profile</span>
          </Link>
          <Link
            href="/admin/shifts"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Day-End Cash</span>
          </Link>
        </div>
      </div>

      {/* Parked / Held Customer Carts Strip (Inline, Zero Modals) */}
      {heldCarts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-2.5">
          <span className="text-xs font-semibold text-amber-900 mr-1">
            Parked Carts ({heldCarts.length}):
          </span>
          {heldCarts.map((held) => (
            <button
              key={held.id}
              type="button"
              onClick={() => handleResumeHeldCart(held)}
              className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-slate-900 hover:border-teal-600 hover:text-teal-800 cursor-pointer"
            >
              <PlayCircle className="h-3.5 w-3.5 text-teal-700" />
              <span>
                {held.label} · {held.itemCount} items ·{' '}
                <strong className="font-mono tabular-nums">{formatInr(held.estimatedTotal)}</strong>
              </span>
              <span className="text-[11px] text-slate-400">{held.heldAt}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Split: Left Fast Barcode/PLU Scanner + Loose Weight + Touch Catalog | Right Live Bill */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: Barcode Scanner + Quick Essentials + Inline Weighing Bar + Product Grid */}
        <section className="xl:col-span-7 rounded-lg border border-slate-200 bg-white p-4 space-y-3.5">
          <form onSubmit={handleBarcodeSubmit} className="space-y-1.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-700" />
                <label htmlFor="pos-barcode-input" className="sr-only">
                  Scan EAN barcode, PLU code, or qty*barcode
                </label>
                <input
                  ref={barcodeInputRef}
                  id="pos-barcode-input"
                  type="text"
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value)}
                  placeholder="Scan barcode, PLU (200101), or qty*code (e.g. 3*8901262010016, 0.5*200101)…"
                  className="w-full rounded-md border border-slate-300 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Search className="h-4 w-4" />
                <span>Scan / Add</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-mono">
              <span>F2: Focus Scan</span>
              <span>F4: Hold Cart</span>
              <span>F8: Exact Cash</span>
              <span>F9: Exact UPI</span>
              <span>F12: Complete &amp; Print</span>
            </div>
          </form>

          {/* 1-Tap Supermarket Quick Essentials Strip */}
          {quickEssentialItems.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
                Quick Tap:
              </span>
              {quickEssentialItems.map((qItem) => (
                <button
                  key={qItem.id}
                  type="button"
                  onClick={() => handleTileClick(qItem)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 hover:border-teal-600 hover:bg-teal-50/60 hover:text-teal-900 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>{qItem.name.split(' ').slice(0, 3).join(' ')}</span>
                  <span className="font-mono text-[11px] text-teal-800 font-semibold tabular-nums">
                    ₹{qItem.saleRate}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Inline Loose-Weight Selector Bar (Zero Modals!) */}
          {weighingItem && (
            <div className="rounded-lg border border-teal-300 bg-teal-50/70 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Scale className="h-4 w-4 text-teal-800 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      Weigh &amp; Add: {weighingItem.name}
                    </div>
                    <div className="text-xs text-teal-900 font-mono tabular-nums">
                      PLU {weighingItem.barcode} · ₹{weighingItem.saleRate.toFixed(2)} / KG (MRP ₹
                      {weighingItem.mrp}/KG)
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Cancel loose weight entry"
                  onClick={() => setWeighingItem(null)}
                  className="rounded p-1 text-slate-500 hover:bg-white hover:text-slate-900 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {QUICK_WEIGHT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleAddWeighedQty(preset.kg)}
                    className="rounded-md border border-teal-600 bg-white px-3 py-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-700 hover:text-white transition-colors cursor-pointer"
                  >
                    {preset.label} (₹{(weighingItem.saleRate * preset.kg).toFixed(0)})
                  </button>
                ))}
                <div className="flex items-center gap-1.5 ml-auto">
                  <label htmlFor="custom-kg-input" className="text-xs font-medium text-slate-700">
                    Custom KG:
                  </label>
                  <input
                    id="custom-kg-input"
                    type="number"
                    step="0.05"
                    min="0.05"
                    value={customKgInput}
                    onChange={(e) => setCustomKgInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddWeighedQty(Number(customKgInput));
                      }
                    }}
                    className="w-20 rounded-md border border-teal-400 bg-white px-2 py-1.5 text-right font-mono text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddWeighedQty(Number(customKgInput))}
                    className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
                  >
                    Add KG
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Supermarket Department / Category Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Touch-Screen Supermarket Product Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredItems.map((item) => {
              const stock = itemStockMap.get(item.id);
              const qtyInCart = cart.find((c) => c.item.id === item.id)?.qty || 0;
              const matchingScheme = workspace.schemes.find(
                (s) =>
                  s.active &&
                  (s.barcodeOrCategory === item.barcode ||
                    s.barcodeOrCategory.toLowerCase() === item.category.toLowerCase())
              );
              const unitSave = Math.max(0, round2(item.mrp - item.saleRate));

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTileClick(item)}
                  className={`text-left rounded-lg border p-3 transition-colors focus-visible:outline-2 focus-visible:outline-teal-600 cursor-pointer ${
                    qtyInCart > 0
                      ? 'border-teal-600 bg-teal-50/40'
                      : 'border-slate-200 bg-white hover:border-teal-600/50 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                      {item.name}
                    </span>
                    {qtyInCart > 0 ? (
                      <span className="font-mono text-xs font-bold text-teal-800 shrink-0 tabular-nums">
                        {item.isWeighed ? `${qtyInCart}kg` : `×${qtyInCart}`}
                      </span>
                    ) : item.isWeighed ? (
                      <Scale className="h-3.5 w-3.5 text-emerald-700 shrink-0 mt-0.5" />
                    ) : null}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 font-mono tabular-nums truncate">
                    {item.isWeighed ? `PLU ${item.barcode}` : item.barcode} · {item.rackLocation}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-1.5">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="font-mono text-base font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        ₹{item.saleRate.toFixed(2)}
                      </span>
                      {item.isWeighed && (
                        <span className="text-[11px] font-medium text-slate-500">/kg</span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums whitespace-nowrap truncate">
                      {unitSave > 0 && (
                        <span className="line-through text-slate-400 mr-1">₹{item.mrp}</span>
                      )}
                      <span className="text-slate-500">{item.taxSlab}%</span>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono tabular-nums">
                      Stock: {formatQtyDisplay(stock?.totalQty ?? 0, item.uqc, item.isWeighed)}
                    </span>
                    {matchingScheme && workspace.controlRoom.autoApplySchemes ? (
                      <span className="font-medium text-teal-700 truncate max-w-[120px]">
                        {matchingScheme.schemeType === 'BUY_X_GET_Y'
                          ? `${matchingScheme.minQty}+${matchingScheme.freeQty} Free`
                          : `${matchingScheme.discountPercent}% Offer`}
                      </span>
                    ) : unitSave > 0 ? (
                      <span className="font-medium text-emerald-700 tabular-nums">
                        Save ₹{unitSave}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right: Shopper, Live Supermarket Bill, MRP Savings & Multi-Payment */}
        <section className="xl:col-span-5 rounded-lg border border-slate-200 bg-white p-4 space-y-4">
          {/* Shopper & Loyalty Account */}
          <div className="space-y-2 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <label
                htmlFor="pos-customer-select"
                className="text-xs font-semibold text-slate-700"
              >
                Shopper / Loyalty Member
              </label>
              {selectedCustomer && (
                <span className="text-xs font-mono text-teal-800 tabular-nums">
                  {selectedCustomer.loyaltyPoints} pts available
                </span>
              )}
            </div>
            <select
              id="pos-customer-select"
              value={selectedCustomerId}
              onChange={(e) => {
                setSelectedCustomerId(Number(e.target.value));
                setRedeemPoints(0);
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''} — {c.loyaltyPoints} pts
                </option>
              ))}
            </select>
            {selectedCustomer && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {isInterState ? 'Inter-State IGST' : 'Intra-State CGST + SGST'} ·{' '}
                  {selectedCustomer.gstin || 'Retail B2C'}
                </span>
                {workspace.controlRoom.enableLoyaltyPoints &&
                  selectedCustomer.loyaltyPoints > 0 && (
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="pos-redeem-pts" className="text-slate-600">
                        Redeem pts:
                      </label>
                      <input
                        id="pos-redeem-pts"
                        type="number"
                        min={0}
                        max={selectedCustomer.loyaltyPoints}
                        value={redeemPoints}
                        onChange={(e) =>
                          setRedeemPoints(Math.max(0, Number(e.target.value) || 0))
                        }
                        className="w-20 rounded border border-slate-300 px-2 py-0.5 text-right font-mono text-xs text-slate-900"
                      />
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* Active Basket Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Basket ({calculatedBill.lines.length} items)
              </h2>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCart([]);
                    setPayments([{ mode: 'Cash', amount: 0, reference: '' }]);
                  }}
                  className="text-xs text-red-700 hover:underline cursor-pointer"
                >
                  Clear Basket
                </button>
              )}
            </div>

            {calculatedBill.lines.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-7 text-center">
                <p className="text-sm font-medium text-slate-600">
                  Ready for next supermarket shopper
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Tap any item tile, try loose produce (kg), or scan{' '}
                  <span className="font-mono text-slate-700">2*8901526100105</span>.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
                {calculatedBill.lines.map((line) => {
                  const matchedItem = workspace.items.find((it) => it.id === line.itemId);
                  const step = matchedItem?.isWeighed ? 0.25 : 1;
                  return (
                    <div
                      key={line.itemId}
                      className="py-2.5 flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {line.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          {line.mrp > line.rate && (
                            <span className="line-through text-slate-400 mr-1.5">
                              MRP ₹{line.mrp}
                            </span>
                          )}
                          <span>₹{line.rate.toFixed(2)}/{line.uqc}</span>
                          <span> · GST {line.taxSlab}%</span>
                          {line.discountPercent > 0 ? ` · -${line.discountPercent}%` : ''}
                          {line.freeQty > 0 ? ` · +${line.freeQty} FREE` : ''}
                        </div>
                        {line.appliedSchemeName && (
                          <div className="text-[11px] font-medium text-teal-700 truncate">
                            Offer: {line.appliedSchemeName}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          aria-label={`Decrease quantity for ${line.name}`}
                          onClick={() => updateLineQty(line.itemId, -step)}
                          className="h-7 w-7 flex items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-11 text-center font-mono text-xs font-semibold tabular-nums">
                          {matchedItem?.isWeighed ? `${line.qty}kg` : line.qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity for ${line.name}`}
                          onClick={() => updateLineQty(line.itemId, step)}
                          className="h-7 w-7 flex items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-20 text-right font-mono text-sm font-semibold text-slate-900 tabular-nums">
                          ₹{line.lineTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Supermarket MRP Savings Banner */}
          {calculatedBill.totalMrpSavings > 0 && (
            <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-900">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                <span>Shopper Total Savings on MRP</span>
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-emerald-800">
                {formatInr(calculatedBill.totalMrpSavings)}
              </span>
            </div>
          )}

          {/* GST & Tax Summary */}
          <div className="rounded-md bg-slate-50 p-3 space-y-1.5 text-xs border border-slate-200">
            <div className="flex justify-between text-slate-600">
              <span>Store Rate Subtotal</span>
              <span className="font-mono tabular-nums">
                {formatInr(calculatedBill.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Scheme &amp; Loyalty Discount</span>
              <span className="font-mono tabular-nums text-teal-800">
                -{formatInr(calculatedBill.discountAmount)}
              </span>
            </div>
            {isInterState ? (
              <div className="flex justify-between text-slate-600">
                <span>IGST (Inter-State)</span>
                <span className="font-mono tabular-nums">
                  {formatInr(calculatedBill.igstAmount)}
                </span>
              </div>
            ) : (
              <div className="flex justify-between text-slate-600">
                <span>CGST + SGST</span>
                <span className="font-mono tabular-nums">
                  {formatInr(calculatedBill.cgstAmount)} +{' '}
                  {formatInr(calculatedBill.sgstAmount)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
              <span className="text-sm font-bold text-slate-900">Net Payable</span>
              <span
                data-testid="pos-grand-total"
                className="font-mono text-xl font-bold text-teal-800 tabular-nums"
              >
                {formatInr(calculatedBill.grandTotal)}
              </span>
            </div>
            {workspace.controlRoom.enableLoyaltyPoints && calculatedBill.loyaltyEarned > 0 && (
              <div className="text-[11px] text-teal-700 text-right font-medium">
                +{calculatedBill.loyaltyEarned} supermarket loyalty points will be credited
              </div>
            )}
          </div>

          {/* Multi-Payment Settlement Panel */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Quick Tender &amp; Split Payment
              </span>
              <button
                type="button"
                onClick={addSplitPaymentRow}
                className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap cursor-pointer"
              >
                + Split Mode
              </button>
            </div>

            {/* Quick Exact Tender Buttons */}
            <div className="grid grid-cols-5 gap-1.5">
              {(
                [
                  { mode: 'Cash', hint: 'F8' },
                  { mode: 'UPI', hint: 'F9' },
                  { mode: 'Card', hint: '' },
                  { mode: 'Wallet', hint: '' },
                  { mode: 'PDC', hint: '' },
                ] as Array<{ mode: PaymentMode; hint: string }>
              ).map(({ mode, hint }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setExactPaymentForSingleMode(mode)}
                  className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:border-teal-600 hover:text-teal-800 whitespace-nowrap cursor-pointer"
                >
                  {mode}
                  {hint ? <span className="ml-1 text-[10px] text-slate-400">{hint}</span> : null}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {payments.map((pay, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    aria-label={`Payment mode ${idx + 1}`}
                    value={pay.mode}
                    onChange={(e) =>
                      updatePaymentRow(idx, { mode: e.target.value as PaymentMode })
                    }
                    className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-900"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Wallet">Wallet</option>
                    <option value="PDC">PDC</option>
                  </select>
                  <input
                    aria-label={`Payment amount ${idx + 1}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={pay.amount || ''}
                    onChange={(e) =>
                      updatePaymentRow(idx, { amount: Number(e.target.value) || 0 })
                    }
                    placeholder="Amount ₹"
                    className="w-28 rounded-md border border-slate-300 px-2.5 py-1.5 text-right font-mono text-xs text-slate-900"
                  />
                  <input
                    aria-label={`Payment reference ${idx + 1}`}
                    type="text"
                    value={pay.reference || ''}
                    onChange={(e) => updatePaymentRow(idx, { reference: e.target.value })}
                    placeholder="UTR / Ref No."
                    className="flex-1 min-w-0 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900"
                  />
                  {payments.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove payment split ${idx + 1}`}
                      onClick={() => removePaymentRow(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-600">
              <span>Tendered: {formatInr(paymentValidation.totalTendered)}</span>
              {paymentValidation.changeToReturn > 0 ? (
                <span className="text-emerald-700 font-semibold">
                  Return Change: {formatInr(paymentValidation.changeToReturn)}
                </span>
              ) : (
                <span>Balance Due: {formatInr(paymentValidation.balanceDue)}</span>
              )}
            </div>

            {checkoutError && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
              >
                {checkoutError}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleCompleteSale()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors cursor-pointer"
            >
              <CreditCard className="h-4 w-4" />
              <span>Complete &amp; Print Supermarket Bill (F12)</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
