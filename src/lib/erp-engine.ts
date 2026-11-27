import type {
  InventoryItem,
  InvoiceLineItem,
  InvoiceRecord,
  ItemBatch,
  Ledger,
  PaymentSplit,
  PromoCoupon,
  PurchaseLineItem,
  PurchaseRecord,
  Scheme,
  VoucherRecord,
} from '../types/erp';

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/**
 * Parses fast supermarket scanner input supporting:
 * 1) Weighted EAN-13 produce/deli stickers (e.g., "210101012500" / "2101010125007"):
 *    [2-digit prefix][4-digit PLU suffix][5-digit grams][optional check digit]
 * 2) Quantity multiplier input (e.g., "3*8901262010016", "0.5*200101")
 * 3) Plain EAN-13 / PLU / SKU / item name lookup
 */
export function parseBarcodeOrPluInput(
  raw: string,
  weightedPrefix = '21'
): { qty: number; query: string; isWeightedBarcode?: boolean; pluSuffix?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { qty: 1, query: '' };

  const prefix = (weightedPrefix || '21').trim();
  if (
    prefix.length === 2 &&
    /^\d{12,13}$/.test(trimmed) &&
    trimmed.startsWith(prefix)
  ) {
    const pluSuffix = trimmed.slice(2, 6);
    const grams = Number(trimmed.slice(6, 11));
    if (Number.isFinite(grams) && grams > 0) {
      const kg = round3(grams / 1000);
      return {
        qty: kg,
        query: `20${pluSuffix}`,
        isWeightedBarcode: true,
        pluSuffix,
      };
    }
  }

  const starIdx = trimmed.indexOf('*');
  if (starIdx > 0 && starIdx < trimmed.length - 1) {
    const qtyCandidate = Number(trimmed.slice(0, starIdx).trim());
    const queryPart = trimmed.slice(starIdx + 1).trim();
    if (Number.isFinite(qtyCandidate) && qtyCandidate > 0 && qtyCandidate <= 999 && queryPart) {
      return { qty: round3(qtyCandidate), query: queryPart };
    }
  }
  return { qty: 1, query: trimmed };
}

export interface EvaluatedCouponResult {
  valid: boolean;
  coupon?: PromoCoupon;
  discountAmount: number;
  error?: string;
}

export function evaluatePromoCoupon(params: {
  code: string;
  coupons: PromoCoupon[];
  billTotalBeforeCoupon: number;
  asOfDate: string;
}): EvaluatedCouponResult {
  const cleanCode = params.code.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, discountAmount: 0, error: 'Enter a coupon code.' };
  }
  const match = params.coupons.find(
    (c) => c.code.trim().toUpperCase() === cleanCode && c.active
  );
  if (!match) {
    return { valid: false, discountAmount: 0, error: `Coupon "${cleanCode}" is invalid or inactive.` };
  }
  if (match.validTill && params.asOfDate > match.validTill) {
    return { valid: false, discountAmount: 0, error: `Coupon "${cleanCode}" expired on ${match.validTill}.` };
  }
  if (params.billTotalBeforeCoupon < match.minBillAmount) {
    return {
      valid: false,
      discountAmount: 0,
      error: `Minimum bill ₹${match.minBillAmount.toLocaleString('en-IN')} required for ${cleanCode}.`,
    };
  }

  const rawDiscount =
    match.discountType === 'PERCENT'
      ? round2((params.billTotalBeforeCoupon * match.discountValue) / 100)
      : round2(match.discountValue);
  const capped = round2(
    Math.min(
      rawDiscount,
      match.maxDiscount > 0 ? match.maxDiscount : rawDiscount,
      params.billTotalBeforeCoupon
    )
  );
  return { valid: true, coupon: match, discountAmount: Math.max(0, capped) };
}

export function validateUdhaarLimit(params: {
  customer?: Pick<Ledger, 'name' | 'currentBalance' | 'balanceType' | 'creditLimit'>;
  creditAmount: number;
}): { allowed: boolean; currentDue: number; availableLimit: number; error?: string } {
  const creditAmount = round2(Math.max(0, params.creditAmount));
  if (creditAmount <= 0) {
    return { allowed: true, currentDue: 0, availableLimit: params.customer?.creditLimit || 0 };
  }
  if (!params.customer) {
    return {
      allowed: false,
      currentDue: 0,
      availableLimit: 0,
      error: 'Select a registered customer account for Credit (Udhaar) billing.',
    };
  }
  const currentDue =
    params.customer.balanceType === 'Dr' ? round2(params.customer.currentBalance) : 0;
  const limit = round2(Math.max(0, params.customer.creditLimit || 0));
  const availableLimit = round2(Math.max(0, limit - currentDue));

  if (limit <= 0) {
    return {
      allowed: false,
      currentDue,
      availableLimit: 0,
      error: `${params.customer.name} does not have a Credit (Udhaar) limit enabled.`,
    };
  }
  if (creditAmount > availableLimit + 0.01) {
    return {
      allowed: false,
      currentDue,
      availableLimit,
      error: `Udhaar ₹${creditAmount.toFixed(2)} exceeds ${params.customer.name}'s available limit of ₹${availableLimit.toFixed(2)}.`,
    };
  }
  return { allowed: true, currentDue, availableLimit };
}

export interface EvaluatedScheme {
  discountPercent: number;
  freeQty: number;
  schemeName?: string;
}

export function evaluateLineScheme(
  item: Pick<InventoryItem, 'barcode' | 'category'>,
  qty: number,
  schemes: Scheme[],
  autoApplySchemes: boolean,
  asOfDate: string
): EvaluatedScheme {
  if (!autoApplySchemes || qty <= 0) {
    return { discountPercent: 0, freeQty: 0 };
  }

  let bestDiscount = 0;
  let bestFreeQty = 0;
  let appliedName: string | undefined;

  for (const s of schemes) {
    if (!s.active) continue;
    if (asOfDate < s.validFrom || asOfDate > s.validTo) continue;

    const matchesItem =
      s.barcodeOrCategory === item.barcode ||
      s.barcodeOrCategory.toLowerCase() === item.category.toLowerCase() ||
      s.barcodeOrCategory === 'ALL';

    if (!matchesItem || qty < s.minQty) continue;

    if (s.schemeType === 'PERCENT_DISCOUNT' && s.discountPercent > bestDiscount) {
      bestDiscount = s.discountPercent;
      appliedName = s.name;
    } else if (s.schemeType === 'BUY_X_GET_Y' && s.minQty > 0) {
      const multiples = Math.floor(qty / s.minQty);
      const free = multiples * s.freeQty;
      if (free > bestFreeQty) {
        bestFreeQty = free;
        appliedName = s.name;
      }
    }
  }

  return {
    discountPercent: bestDiscount,
    freeQty: bestFreeQty,
    schemeName: appliedName,
  };
}

export interface RawCartLine {
  item: InventoryItem;
  batchNo: string;
  expiryDate: string;
  qty: number;
  rateOverride?: number;
  manualDiscountPercent?: number;
}

export interface CalculatedBill {
  lines: InvoiceLineItem[];
  subtotal: number;
  discountAmount: number;
  couponCode: string;
  couponDiscountAmount: number;
  loyaltyDiscountAmount: number;
  taxableTotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  totalMrpSavings: number;
  loyaltyEarned: number;
  loyaltyRedeemed: number;
}

export function calculateInvoiceTotals(params: {
  cartLines: RawCartLine[];
  schemes: Scheme[];
  autoApplySchemes: boolean;
  asOfDate: string;
  isInterState: boolean;
  redeemPoints: number;
  availableCustomerPoints: number;
  loyaltyPointValue: number;
  loyaltyEarnPer100: number;
  enableLoyaltyPoints: boolean;
  promoCoupon?: PromoCoupon | null;
}): CalculatedBill {
  const {
    cartLines,
    schemes,
    autoApplySchemes,
    asOfDate,
    isInterState,
    redeemPoints,
    availableCustomerPoints,
    loyaltyPointValue,
    loyaltyEarnPer100,
    enableLoyaltyPoints,
    promoCoupon,
  } = params;

  let subtotal = 0;
  let totalDiscount = 0;
  let taxableTotal = 0;
  let totalTax = 0;
  let lineMrpSavingsSum = 0;

  const lines: InvoiceLineItem[] = cartLines
    .filter((l) => l.qty > 0)
    .map((line) => {
      const normalizedQty = round3(line.qty);
      const rate = line.rateOverride ?? line.item.saleRate;
      const evaluated = evaluateLineScheme(
        line.item,
        normalizedQty,
        schemes,
        autoApplySchemes,
        asOfDate
      );
      const effectiveDiscountPct = Math.min(
        100,
        Math.max(0, line.manualDiscountPercent ?? evaluated.discountPercent)
      );

      const gross = round2(rate * normalizedQty);
      const discountAmount = round2((gross * effectiveDiscountPct) / 100);
      const taxableValue = round2(gross - discountAmount);
      const taxAmount = round2((taxableValue * line.item.taxSlab) / 100);
      const lineTotal = round2(taxableValue + taxAmount);
      const unitMrpGap = Math.max(0, line.item.mrp - rate);
      const mrpSavings = round2(unitMrpGap * normalizedQty + discountAmount);

      subtotal = round2(subtotal + gross);
      totalDiscount = round2(totalDiscount + discountAmount);
      taxableTotal = round2(taxableTotal + taxableValue);
      totalTax = round2(totalTax + taxAmount);
      lineMrpSavingsSum = round2(lineMrpSavingsSum + mrpSavings);

      return {
        itemId: line.item.id,
        barcode: line.item.barcode,
        name: line.item.name,
        hsnCode: line.item.hsnCode,
        batchNo: line.batchNo,
        expiryDate: line.expiryDate,
        uqc: line.item.uqc,
        qty: normalizedQty,
        freeQty: evaluated.freeQty,
        mrp: line.item.mrp,
        rate,
        discountPercent: effectiveDiscountPct,
        discountAmount,
        taxSlab: line.item.taxSlab,
        taxableValue,
        taxAmount,
        lineTotal,
        mrpSavings,
        appliedSchemeName: evaluated.schemeName,
      };
    });

  const cgstAmount = isInterState ? 0 : round2(totalTax / 2);
  const sgstAmount = isInterState ? 0 : round2(totalTax - cgstAmount);
  const igstAmount = isInterState ? round2(totalTax) : 0;

  const preLoyaltyTotal = round2(taxableTotal + totalTax);
  const couponEval = promoCoupon
    ? evaluatePromoCoupon({
        code: promoCoupon.code,
        coupons: [promoCoupon],
        billTotalBeforeCoupon: preLoyaltyTotal,
        asOfDate,
      })
    : { valid: false, discountAmount: 0 };
  const couponCode = couponEval.valid && promoCoupon ? promoCoupon.code.toUpperCase() : '';
  const couponDiscountAmount = couponEval.valid ? couponEval.discountAmount : 0;

  const afterCouponTotal = Math.max(0, round2(preLoyaltyTotal - couponDiscountAmount));
  const safeRedeemPoints = enableLoyaltyPoints
    ? Math.max(
        0,
        Math.min(
          Math.floor(redeemPoints),
          Math.floor(availableCustomerPoints),
          Math.floor(afterCouponTotal / Math.max(0.01, loyaltyPointValue))
        )
      )
    : 0;
  const loyaltyDiscountAmount = round2(safeRedeemPoints * loyaltyPointValue);

  const netBeforeRound = Math.max(0, round2(afterCouponTotal - loyaltyDiscountAmount));
  const grandTotal = Math.round(netBeforeRound);
  const roundOff = round2(grandTotal - netBeforeRound);
  const totalMrpSavings = round2(
    lineMrpSavingsSum + couponDiscountAmount + loyaltyDiscountAmount
  );

  const loyaltyEarned =
    enableLoyaltyPoints && grandTotal > 0
      ? Math.floor((grandTotal / 100) * loyaltyEarnPer100)
      : 0;

  return {
    lines,
    subtotal,
    discountAmount: round2(totalDiscount + couponDiscountAmount + loyaltyDiscountAmount),
    couponCode,
    couponDiscountAmount,
    loyaltyDiscountAmount,
    taxableTotal,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
    roundOff,
    grandTotal,
    totalMrpSavings,
    loyaltyEarned,
    loyaltyRedeemed: safeRedeemPoints,
  };
}

export interface PaymentValidationResult {
  valid: boolean;
  totalTendered: number;
  balanceDue: number;
  changeToReturn: number;
  summaryLabel: string;
  error?: string;
}

export function validateMultiPayments(
  payments: PaymentSplit[],
  grandTotal: number
): PaymentValidationResult {
  const active = payments.filter((p) => Number.isFinite(p.amount) && p.amount > 0);
  if (active.length === 0) {
    return {
      valid: false,
      totalTendered: 0,
      balanceDue: round2(grandTotal),
      changeToReturn: 0,
      summaryLabel: 'Unpaid',
      error: 'Enter at least one payment amount greater than zero.',
    };
  }

  const totalTendered = round2(active.reduce((sum, p) => sum + p.amount, 0));
  const diff = round2(totalTendered - grandTotal);

  if (diff < -0.01) {
    return {
      valid: false,
      totalTendered,
      balanceDue: round2(Math.abs(diff)),
      changeToReturn: 0,
      summaryLabel: active.map((p) => p.mode).join(' + '),
      error: `Tendered amount is short by ₹${Math.abs(diff).toFixed(2)}.`,
    };
  }

  return {
    valid: true,
    totalTendered,
    balanceDue: 0,
    changeToReturn: diff > 0 ? diff : 0,
    summaryLabel:
      active.length === 1
        ? active[0].mode
        : active.map((p) => `${p.mode}`).join(' + '),
  };
}

export interface ParsedPurchaseImport {
  lines: PurchaseLineItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  errors: string[];
}

export function parsePurchaseImportCsv(csvText: string): ParsedPurchaseImport {
  const rawLines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) {
    return {
      lines: [],
      subtotal: 0,
      taxAmount: 0,
      grandTotal: 0,
      errors: ['Paste or upload CSV rows with columns: ItemName,Barcode,HSN,Batch,Expiry,Qty,Rate,TaxPct'],
    };
  }

  const errors: string[] = [];
  const lines: PurchaseLineItem[] = [];
  let subtotal = 0;
  let taxAmount = 0;

  rawLines.forEach((row, index) => {
    const cols = row.split(',').map((c) => c.trim());
    // Skip header row
    if (index === 0 && cols[0].toLowerCase().includes('item')) {
      return;
    }
    if (cols.length < 8) {
      errors.push(`Row ${index + 1}: Expected 8 comma-separated columns.`);
      return;
    }

    const [itemName, barcode, hsnCode, batchNo, expiryDate, qtyStr, rateStr, taxStr] =
      cols;
    const qty = Number(qtyStr);
    const rate = Number(rateStr);
    const taxSlab = Number(taxStr);

    if (!itemName || !batchNo) {
      errors.push(`Row ${index + 1}: Item name and batch number are required.`);
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(rate) || rate < 0) {
      errors.push(`Row ${index + 1}: Invalid quantity or purchase rate.`);
      return;
    }
    if (!Number.isFinite(taxSlab) || taxSlab < 0 || taxSlab > 28) {
      errors.push(`Row ${index + 1}: GST slab must be between 0 and 28.`);
      return;
    }

    const base = round2(qty * rate);
    const tax = round2((base * taxSlab) / 100);
    subtotal = round2(subtotal + base);
    taxAmount = round2(taxAmount + tax);

    lines.push({
      itemName,
      barcode: barcode || `890${String(1000000000 + index).slice(0, 10)}`,
      hsnCode: hsnCode || '10063020',
      batchNo,
      expiryDate: expiryDate || '2027-12-31',
      qty,
      rate,
      taxSlab,
      lineTotal: round2(base + tax),
    });
  });

  return {
    lines,
    subtotal,
    taxAmount,
    grandTotal: round2(subtotal + taxAmount),
    errors,
  };
}

export type ExpiryStatus = 'EXPIRED' | 'NEAR_EXPIRY' | 'HEALTHY';

export function classifyExpiryStatus(
  expiryDate: string,
  asOfDate: string,
  nearExpiryAlertDays: number
): { status: ExpiryStatus; daysRemaining: number } {
  const expTime = Date.parse(`${expiryDate}T00:00:00Z`);
  const nowTime = Date.parse(`${asOfDate}T00:00:00Z`);
  if (Number.isNaN(expTime) || Number.isNaN(nowTime)) {
    return { status: 'HEALTHY', daysRemaining: 365 };
  }
  const daysRemaining = Math.ceil((expTime - nowTime) / (1000 * 60 * 60 * 24));
  if (daysRemaining <= 0) {
    return { status: 'EXPIRED', daysRemaining };
  }
  if (daysRemaining <= nearExpiryAlertDays) {
    return { status: 'NEAR_EXPIRY', daysRemaining };
  }
  return { status: 'HEALTHY', daysRemaining };
}

export function generateDeterministicIrn(
  gstin: string,
  invoiceNo: string,
  invoiceDate: string
): string {
  const seed = `${gstin}|${invoiceNo}|${invoiceDate}|MARG`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const partA = ((h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0')).toUpperCase();
  const partB = ((Math.imul(h1 ^ h2, 2246822507) >>> 0)
    .toString(16)
    .padStart(8, '0') +
    (Math.imul(h2 ^ 0x9e3779b9, 3266489909) >>> 0)
      .toString(16)
      .padStart(8, '0')).toUpperCase();
  return `${partA}${partB}A1B2C3D4E5F678901234567890ABCDEF`;
}

export function generateEwayBillNo(invoiceNo: string, grandTotal: number): string {
  const digits = invoiceNo.replace(/\D/g, '').padEnd(6, '4').slice(0, 6);
  const amtPart = String(Math.round(grandTotal)).padStart(4, '1').slice(0, 4);
  return `38${digits}${amtPart}`;
}

export interface FinancialSummary {
  totalSales: number;
  totalPurchases: number;
  totalReceivables: number;
  totalPayables: number;
  cashBankBalance: number;
  totalExpenses: number;
  closingStockValue: number;
  grossProfit: number;
  netProfit: number;
  outputGst: { cgst: number; sgst: number; igst: number; total: number };
  inputGstItc: number;
  netGstPayable: number;
  trialBalance: Array<{ ledger: string; group: string; debit: number; credit: number }>;
  trialDebitTotal: number;
  trialCreditTotal: number;
}

export function computeFinancialStatements(params: {
  ledgers: Ledger[];
  invoices: InvoiceRecord[];
  purchases: PurchaseRecord[];
  vouchers: VoucherRecord[];
  batches: ItemBatch[];
}): FinancialSummary {
  const { ledgers, invoices, purchases, vouchers, batches } = params;

  const salesInvoices = invoices.filter(
    (inv) => inv.docType === 'POS_BILL' || inv.docType === 'GST_INVOICE'
  );
  const creditNotes = invoices.filter((inv) => inv.docType === 'CREDIT_NOTE');

  const grossSales = round2(
    salesInvoices.reduce((sum, i) => sum + i.grandTotal, 0) -
      creditNotes.reduce((sum, i) => sum + i.grandTotal, 0)
  );

  const postedPurchases = purchases.filter((p) => p.docType === 'PURCHASE_BILL');
  const debitNotes = purchases.filter((p) => p.docType === 'DEBIT_NOTE');
  const totalPurchases = round2(
    postedPurchases.reduce((sum, p) => sum + p.grandTotal, 0) -
      debitNotes.reduce((sum, p) => sum + p.grandTotal, 0)
  );

  const totalReceivables = round2(
    ledgers
      .filter((l) => l.groupType === 'Customer' && l.balanceType === 'Dr')
      .reduce((sum, l) => sum + l.currentBalance, 0)
  );

  const totalPayables = round2(
    ledgers
      .filter((l) => l.groupType === 'Supplier' && l.balanceType === 'Cr')
      .reduce((sum, l) => sum + l.currentBalance, 0)
  );

  const cashBankBalance = round2(
    ledgers
      .filter((l) => l.groupType === 'Cash' || l.groupType === 'Bank')
      .reduce(
        (sum, l) => sum + (l.balanceType === 'Dr' ? l.currentBalance : -l.currentBalance),
        0
      )
  );

  const expenseLedgers = round2(
    ledgers
      .filter((l) => l.groupType === 'Expense')
      .reduce((sum, l) => sum + l.currentBalance, 0)
  );
  const expenseVouchers = round2(
    vouchers
      .filter((v) => v.voucherType === 'Payment' && v.debitLedgerName.toLowerCase().includes('expense'))
      .reduce((sum, v) => sum + v.amount, 0)
  );
  const totalExpenses = round2(expenseLedgers + expenseVouchers);

  const closingStockValue = round2(
    batches.reduce((sum, b) => sum + Math.max(0, b.qtyOnHand) * b.costRate, 0)
  );

  const outputCgst = round2(salesInvoices.reduce((s, i) => s + i.cgstAmount, 0));
  const outputSgst = round2(salesInvoices.reduce((s, i) => s + i.sgstAmount, 0));
  const outputIgst = round2(salesInvoices.reduce((s, i) => s + i.igstAmount, 0));
  const outputTotal = round2(outputCgst + outputSgst + outputIgst);
  const inputGstItc = round2(postedPurchases.reduce((s, p) => s + p.taxAmount, 0));
  const netGstPayable = round2(Math.max(0, outputTotal - inputGstItc));

  const salesExTax = round2(grossSales - outputTotal);
  const purchaseExTax = round2(totalPurchases - inputGstItc);
  const estimatedCogs = round2(Math.max(0, purchaseExTax * 0.72));
  const grossProfit = round2(salesExTax - estimatedCogs);
  const netProfit = round2(grossProfit - totalExpenses);

  const trialRows: Array<{ ledger: string; group: string; debit: number; credit: number }> = [
    ...ledgers.map((l) => ({
      ledger: l.name,
      group: l.groupType,
      debit: l.balanceType === 'Dr' ? round2(l.currentBalance) : 0,
      credit: l.balanceType === 'Cr' ? round2(l.currentBalance) : 0,
    })),
    {
      ledger: 'Sales Account (GST)',
      group: 'Income',
      debit: 0,
      credit: Math.max(0, salesExTax),
    },
    {
      ledger: 'Purchase Account (GST)',
      group: 'Direct Expense',
      debit: Math.max(0, purchaseExTax),
      credit: 0,
    },
    {
      ledger: 'Output GST Liability',
      group: 'Duties & Taxes',
      debit: 0,
      credit: outputTotal,
    },
    {
      ledger: 'Input GST Credit (ITC)',
      group: 'Current Asset',
      debit: inputGstItc,
      credit: 0,
    },
  ];

  const rawDr = round2(trialRows.reduce((s, r) => s + r.debit, 0));
  const rawCr = round2(trialRows.reduce((s, r) => s + r.credit, 0));
  const capitalDiff = round2(rawDr - rawCr);
  if (Math.abs(capitalDiff) > 0.01) {
    trialRows.push({
      ledger: 'Owner Capital & Retained Reserves',
      group: 'Capital Account',
      debit: capitalDiff < 0 ? Math.abs(capitalDiff) : 0,
      credit: capitalDiff > 0 ? capitalDiff : 0,
    });
  }

  const trialDebitTotal = round2(trialRows.reduce((s, r) => s + r.debit, 0));
  const trialCreditTotal = round2(trialRows.reduce((s, r) => s + r.credit, 0));

  return {
    totalSales: grossSales,
    totalPurchases,
    totalReceivables,
    totalPayables,
    cashBankBalance,
    totalExpenses,
    closingStockValue,
    grossProfit,
    netProfit,
    outputGst: {
      cgst: outputCgst,
      sgst: outputSgst,
      igst: outputIgst,
      total: outputTotal,
    },
    inputGstItc,
    netGstPayable,
    trialBalance: trialRows,
    trialDebitTotal,
    trialCreditTotal,
  };
}

export function buildGstr1PortalJson(
  companyGstin: string,
  fpMonthYear: string,
  invoices: InvoiceRecord[]
) {
  const b2b = invoices
    .filter((i) => i.docType === 'GST_INVOICE' && i.customerGstin.trim().length >= 15)
    .map((i) => ({
      ctin: i.customerGstin,
      inv: [
        {
          inum: i.invoiceNo,
          idt: i.invoiceDate,
          val: i.grandTotal,
          pos: i.customerGstin.slice(0, 2),
          rchrg: 'N',
          inv_typ: 'R',
          irn: i.irn || undefined,
          itms: i.items.map((line, idx) => ({
            num: idx + 1,
            itm_det: {
              rt: line.taxSlab,
              txval: line.taxableValue,
              camt: i.igstAmount > 0 ? 0 : round2(line.taxAmount / 2),
              samt: i.igstAmount > 0 ? 0 : round2(line.taxAmount / 2),
              iamt: i.igstAmount > 0 ? line.taxAmount : 0,
            },
          })),
        },
      ],
    }));

  const b2csMap = new Map<number, { txval: number; camt: number; samt: number }>();
  invoices
    .filter((i) => i.docType === 'POS_BILL' || !i.customerGstin)
    .forEach((inv) => {
      inv.items.forEach((line) => {
        const prev = b2csMap.get(line.taxSlab) || { txval: 0, camt: 0, samt: 0 };
        prev.txval = round2(prev.txval + line.taxableValue);
        prev.camt = round2(prev.camt + line.taxAmount / 2);
        prev.samt = round2(prev.samt + line.taxAmount / 2);
        b2csMap.set(line.taxSlab, prev);
      });
    });

  return {
    gstin: companyGstin,
    fp: fpMonthYear,
    version: 'GST3.1.6',
    b2b,
    b2cs: Array.from(b2csMap.entries()).map(([rt, val]) => ({
      sply_ty: 'INTRA',
      rt,
      txval: val.txval,
      camt: val.camt,
      samt: val.samt,
    })),
  };
}

/**
 * Strictly validates a post-login redirect path to prevent open redirects.
 * Only allows internal /admin or /admin/... paths with no protocol or double-slash prefixes.
 */
export function sanitizeNextPath(rawNext: string | null | undefined): string {
  if (!rawNext || typeof rawNext !== 'string') return '/admin/dashboard';
  const trimmed = rawNext.trim();
  if (!trimmed.startsWith('/admin')) return '/admin/dashboard';
  if (trimmed.startsWith('//') || trimmed.includes('://') || trimmed.includes('\\')) {
    return '/admin/dashboard';
  }
  if (trimmed.includes('..')) return '/admin/dashboard';
  return trimmed;
}

export interface ShiftVarianceSummary {
  expectedCash: number;
  totalDigitalCollection: number;
  totalCounterCollection: number;
  cashVariance: number;
  varianceStatus: 'MATCHED' | 'EXCESS' | 'SHORTAGE';
}

export function calculateShiftVariance(params: {
  openingCash: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  walletSales: number;
  pdcSales: number;
  countedCash: number;
}): ShiftVarianceSummary {
  const expectedCash = round2(params.openingCash + params.cashSales);
  const totalDigitalCollection = round2(
    params.upiSales + params.cardSales + params.walletSales + params.pdcSales
  );
  const totalCounterCollection = round2(params.cashSales + totalDigitalCollection);
  const cashVariance = round2(params.countedCash - expectedCash);
  const varianceStatus =
    Math.abs(cashVariance) < 0.01
      ? 'MATCHED'
      : cashVariance > 0
        ? 'EXCESS'
        : 'SHORTAGE';

  return {
    expectedCash,
    totalDigitalCollection,
    totalCounterCollection,
    cashVariance,
    varianceStatus,
  };
}

export interface GlobalSearchResultItem {
  id: string;
  category: 'Module' | 'Item' | 'Ledger' | 'Invoice' | 'Purchase' | 'Voucher';
  title: string;
  subtitle: string;
  meta: string;
  href: string;
}

export function buildGlobalSearchResults(
  params: {
    items: InventoryItem[];
    ledgers: Ledger[];
    invoices: InvoiceRecord[];
    purchases: PurchaseRecord[];
    vouchers: VoucherRecord[];
  },
  query: string
): GlobalSearchResultItem[] {
  const q = query.trim().toLowerCase();

  const moduleEntries: GlobalSearchResultItem[] = [
    { id: 'mod-dash', category: 'Module', title: 'Executive Dashboard', subtitle: 'Real-time KPIs, trends & quick shortcuts', meta: 'Overview', href: '/admin/dashboard' },
    { id: 'mod-pos', category: 'Module', title: 'Supermarket POS Terminal', subtitle: 'Fast barcode, loose-weight kg/gm & multi-payment billing', meta: 'F2', href: '/admin/pos' },
    { id: 'mod-masters', category: 'Module', title: 'Master Module', subtitle: 'Ledgers, Inventory items, HSN/GST & BOM recipes', meta: 'Masters', href: '/admin/masters' },
    { id: 'mod-sales', category: 'Module', title: 'Sale & Billing Register', subtitle: 'GST invoices, estimates, challans & schemes', meta: 'F8', href: '/admin/sales' },
    { id: 'mod-purchases', category: 'Module', title: 'Purchase & CSV Import', subtitle: 'Purchase bills, orders, debit notes & rate compare', meta: 'F9', href: '/admin/purchases' },
    { id: 'mod-inventory', category: 'Module', title: 'Stock & Inventory', subtitle: 'Multi-godown batches, expiry alerts & transfers', meta: 'Stock', href: '/admin/inventory' },
    { id: 'mod-barcodes', category: 'Module', title: 'Barcode & Shelf Label Studio', subtitle: 'Print 38x25mm thermal stickers, shelf MRP tags & A4 24-up sheets', meta: 'Alt+B', href: '/admin/barcodes' },
    { id: 'mod-display', category: 'Module', title: 'Customer Live Display & UPI QR', subtitle: 'Second-screen basket tape, savings highlight & dynamic UPI QR', meta: 'Display', href: '/admin/pos/customer-display' },
    { id: 'mod-accounting', category: 'Module', title: 'Accounting Vouchers', subtitle: 'Receipt, payment, contra, journal & reminders', meta: 'F6', href: '/admin/accounting' },
    { id: 'mod-banking', category: 'Module', title: 'Banking & PDC Reconciliation', subtitle: 'Connected bank feeds, PDC tracker & BRS', meta: 'Banking', href: '/admin/banking' },
    { id: 'mod-gst', category: 'Module', title: 'GST & E-Invoice Compliance', subtitle: 'IRN, E-Way Bill, GSTR-1 JSON & GSTR-2B/3B', meta: 'GST', href: '/admin/gst' },
    { id: 'mod-crm', category: 'Module', title: 'CRM & Marg Mart Store', subtitle: 'Follow-up pipeline & online storefront orders', meta: 'CRM', href: '/admin/crm' },
    { id: 'mod-reports', category: 'Module', title: 'Reports & Financial P&L', subtitle: 'Trial Balance, P&L, Balance Sheet & CSV export', meta: 'Reports', href: '/admin/reports' },
    { id: 'mod-shifts', category: 'Module', title: 'Shift Handover & Day-End Cash', subtitle: 'Cashier shifts, cash count variance & roles', meta: 'Alt+S', href: '/admin/shifts' },
    { id: 'mod-setup', category: 'Module', title: 'Company & Branch Setup', subtitle: 'Multi-company onboarding, GSTIN & FY setup', meta: 'Setup', href: '/admin/company/setup' },
    { id: 'mod-ctrl', category: 'Module', title: 'Control Room Configuration', subtitle: 'POS billing rules, invoice templates & rebuild', meta: 'Alt+C', href: '/admin/control-room' },
  ];

  const results: GlobalSearchResultItem[] = [];

  for (const mod of moduleEntries) {
    if (
      !q ||
      mod.title.toLowerCase().includes(q) ||
      mod.subtitle.toLowerCase().includes(q) ||
      mod.meta.toLowerCase().includes(q)
    ) {
      results.push(mod);
    }
  }

  for (const item of params.items) {
    if (
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.barcode.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.hsnCode.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    ) {
      results.push({
        id: `item-${item.id}`,
        category: 'Item',
        title: item.name,
        subtitle: `${item.brand} · Barcode ${item.barcode} · HSN ${item.hsnCode}`,
        meta: `MRP ₹${item.mrp} · GST ${item.taxSlab}%`,
        href: `/admin/masters?tab=items&q=${encodeURIComponent(item.sku)}`,
      });
    }
  }

  for (const ledger of params.ledgers) {
    if (
      !q ||
      ledger.name.toLowerCase().includes(q) ||
      ledger.groupType.toLowerCase().includes(q) ||
      ledger.phone.toLowerCase().includes(q) ||
      ledger.gstin.toLowerCase().includes(q)
    ) {
      results.push({
        id: `ledger-${ledger.id}`,
        category: 'Ledger',
        title: ledger.name,
        subtitle: `${ledger.groupType}${ledger.phone ? ` · ${ledger.phone}` : ''}${ledger.gstin ? ` · ${ledger.gstin}` : ''}`,
        meta: `₹${ledger.currentBalance.toLocaleString('en-IN')} ${ledger.balanceType}`,
        href: `/admin/ledgers/${ledger.id}`,
      });
    }
  }

  for (const inv of params.invoices) {
    if (
      !q ||
      inv.invoiceNo.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      inv.docType.toLowerCase().includes(q)
    ) {
      results.push({
        id: `inv-${inv.id}`,
        category: 'Invoice',
        title: `${inv.invoiceNo} — ${inv.customerName}`,
        subtitle: `${inv.docType.replace('_', ' ')} · ${inv.invoiceDate} · ${inv.paymentModeSummary}`,
        meta: `₹${inv.grandTotal.toLocaleString('en-IN')}`,
        href: `/admin/bills/${inv.id}`,
      });
    }
  }

  for (const pur of params.purchases) {
    if (
      !q ||
      pur.billNo.toLowerCase().includes(q) ||
      pur.supplierName.toLowerCase().includes(q)
    ) {
      results.push({
        id: `pur-${pur.id}`,
        category: 'Purchase',
        title: `${pur.billNo} — ${pur.supplierName}`,
        subtitle: `${pur.docType.replace('_', ' ')} · ${pur.billDate} · ${pur.importSource}`,
        meta: `₹${pur.grandTotal.toLocaleString('en-IN')}`,
        href: '/admin/purchases',
      });
    }
  }

  for (const v of params.vouchers) {
    if (
      !q ||
      v.voucherNo.toLowerCase().includes(q) ||
      v.debitLedgerName.toLowerCase().includes(q) ||
      v.creditLedgerName.toLowerCase().includes(q) ||
      v.narration.toLowerCase().includes(q)
    ) {
      results.push({
        id: `vch-${v.id}`,
        category: 'Voucher',
        title: `${v.voucherNo} (${v.voucherType})`,
        subtitle: `Dr ${v.debitLedgerName} / Cr ${v.creditLedgerName}`,
        meta: `₹${v.amount.toLocaleString('en-IN')}`,
        href: '/admin/accounting',
      });
    }
  }

  return results;
}
