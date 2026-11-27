import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGlobalSearchResults,
  buildGstr1PortalJson,
  calculateInvoiceTotals,
  calculateShiftVariance,
  classifyExpiryStatus,
  computeFinancialStatements,
  evaluateLineScheme,
  evaluatePromoCoupon,
  generateDeterministicIrn,
  parseBarcodeOrPluInput,
  parsePurchaseImportCsv,
  sanitizeNextPath,
  validateMultiPayments,
  validateUdhaarLimit,
} from './erp-engine';
import {
  buildUpiPaymentUri,
  buildWhatsAppBillText,
  encodeCode128B,
} from './barcode-utils';
import type { InventoryItem, PromoCoupon, Scheme } from '../types/erp';

const sampleGroceryItem: InventoryItem = {
  id: 1,
  companyId: 1,
  sku: 'GRC-BISC-01',
  barcode: '8901063014121',
  name: 'Britannia Good Day Cashew 200g',
  brand: 'Britannia',
  category: 'Beverages & Snacks',
  hsnCode: '19053100',
  uqc: 'PKT',
  rackLocation: 'Aisle-4-B2',
  taxSlab: 12,
  mrp: 40,
  saleRate: 30,
  purchaseRate: 24,
  wholesaleRate: 27,
  reorderLevel: 50,
  isWeighed: false,
};

const sampleWeighedProduceItem: InventoryItem = {
  id: 2,
  companyId: 1,
  sku: 'VEG-TOM-01',
  barcode: '200101',
  name: 'Fresh Farm Tomatoes (Loose)',
  brand: 'FreshFarm Mandi',
  category: 'Fresh Produce',
  hsnCode: '07020000',
  uqc: 'KG',
  rackLocation: 'Produce-01',
  taxSlab: 0,
  mrp: 48,
  saleRate: 40,
  purchaseRate: 28,
  wholesaleRate: 34,
  reorderLevel: 25,
  isWeighed: true,
};

const sampleSchemes: Scheme[] = [
  {
    id: 1,
    companyId: 1,
    name: 'Snack Saver Buy 10 Get 1 Free',
    barcodeOrCategory: '8901063014121',
    schemeType: 'BUY_X_GET_Y',
    minQty: 10,
    freeQty: 1,
    discountPercent: 0,
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    active: true,
  },
  {
    id: 2,
    companyId: 1,
    name: 'Weekend Snacks 5% Off',
    barcodeOrCategory: 'Beverages & Snacks',
    schemeType: 'PERCENT_DISCOUNT',
    minQty: 5,
    freeQty: 0,
    discountPercent: 5,
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    active: true,
  },
];

test('evaluateLineScheme applies percentage discount and buy-X-get-Y free quantity', () => {
  const res = evaluateLineScheme(sampleGroceryItem, 20, sampleSchemes, true, '2026-11-26');
  assert.equal(res.discountPercent, 5);
  assert.equal(res.freeQty, 2);
  assert.ok(res.schemeName);

  const disabled = evaluateLineScheme(sampleGroceryItem, 20, sampleSchemes, false, '2026-11-26');
  assert.equal(disabled.discountPercent, 0);
  assert.equal(disabled.freeQty, 0);
});

test('calculateInvoiceTotals computes intra-state CGST/SGST, schemes, MRP savings, and loyalty', () => {
  const bill = calculateInvoiceTotals({
    cartLines: [
      {
        item: sampleGroceryItem,
        batchNo: 'BR26A',
        expiryDate: '2027-08-31',
        qty: 10,
      },
    ],
    schemes: sampleSchemes,
    autoApplySchemes: true,
    asOfDate: '2026-11-26',
    isInterState: false,
    redeemPoints: 20,
    availableCustomerPoints: 100,
    loyaltyPointValue: 1,
    loyaltyEarnPer100: 2,
    enableLoyaltyPoints: true,
  });

  // Gross = 10 * 30 = 300; 5% scheme discount = 15; taxable = 285
  // 12% GST on 285 = 34.20 -> CGST 17.10, SGST 17.10
  // Pre-loyalty = 319.20 - 20 loyalty = 299.20 -> rounded 299
  // MRP savings = (40 - 30) * 10 + 15 scheme + 20 loyalty = 135
  assert.equal(bill.subtotal, 300);
  assert.equal(bill.taxableTotal, 285);
  assert.equal(bill.cgstAmount, 17.1);
  assert.equal(bill.sgstAmount, 17.1);
  assert.equal(bill.igstAmount, 0);
  assert.equal(bill.loyaltyRedeemed, 20);
  assert.equal(bill.grandTotal, 299);
  assert.equal(bill.totalMrpSavings, 135);
  assert.equal(bill.loyaltyEarned, 5); // floor(299/100 * 2) = 5
  assert.equal(bill.lines[0].freeQty, 1);
});

test('calculateInvoiceTotals handles decimal loose-weight kg supermarket produce with 0% GST', () => {
  const bill = calculateInvoiceTotals({
    cartLines: [
      {
        item: sampleWeighedProduceItem,
        batchNo: 'FM-2611',
        expiryDate: '2026-12-03',
        qty: 1.25,
      },
    ],
    schemes: [],
    autoApplySchemes: true,
    asOfDate: '2026-11-26',
    isInterState: false,
    redeemPoints: 0,
    availableCustomerPoints: 0,
    loyaltyPointValue: 1,
    loyaltyEarnPer100: 2,
    enableLoyaltyPoints: false,
  });

  // 1.25 kg * ₹40 = ₹50.00, 0% GST, MRP savings = (48 - 40) * 1.25 = ₹10.00
  assert.equal(bill.lines[0].qty, 1.25);
  assert.equal(bill.subtotal, 50);
  assert.equal(bill.totalTax, 0);
  assert.equal(bill.grandTotal, 50);
  assert.equal(bill.totalMrpSavings, 10);
});

test('parseBarcodeOrPluInput parses qty*barcode multipliers and loose weights cleanly', () => {
  assert.deepEqual(parseBarcodeOrPluInput('3*8901262010016'), {
    qty: 3,
    query: '8901262010016',
  });
  assert.deepEqual(parseBarcodeOrPluInput('0.5*200101'), {
    qty: 0.5,
    query: '200101',
  });
  assert.deepEqual(parseBarcodeOrPluInput('8901262010016'), {
    qty: 1,
    query: '8901262010016',
  });
  assert.deepEqual(parseBarcodeOrPluInput('0*8901262010016'), {
    qty: 1,
    query: '0*8901262010016',
  });
});

test('calculateInvoiceTotals switches to IGST for inter-state B2B invoices', () => {
  const bill = calculateInvoiceTotals({
    cartLines: [
      {
        item: sampleGroceryItem,
        batchNo: 'BR26A',
        expiryDate: '2027-08-31',
        qty: 2,
      },
    ],
    schemes: [],
    autoApplySchemes: false,
    asOfDate: '2026-11-26',
    isInterState: true,
    redeemPoints: 0,
    availableCustomerPoints: 0,
    loyaltyPointValue: 1,
    loyaltyEarnPer100: 2,
    enableLoyaltyPoints: false,
  });

  assert.equal(bill.cgstAmount, 0);
  assert.equal(bill.sgstAmount, 0);
  assert.equal(bill.igstAmount, 7.2);
  assert.equal(bill.grandTotal, 67);
});

test('validateMultiPayments handles split Cash + UPI and catches underpayment', () => {
  const short = validateMultiPayments([{ mode: 'Cash', amount: 200 }], 350);
  assert.equal(short.valid, false);
  assert.equal(short.balanceDue, 150);

  const exactSplit = validateMultiPayments(
    [
      { mode: 'Cash', amount: 200 },
      { mode: 'UPI', amount: 150, reference: 'UPI99281' },
    ],
    350
  );
  assert.equal(exactSplit.valid, true);
  assert.equal(exactSplit.changeToReturn, 0);
  assert.equal(exactSplit.summaryLabel, 'Cash + UPI');
});

test('parsePurchaseImportCsv parses valid supermarket rows and reports malformed lines', () => {
  const csv = [
    'ItemName,Barcode,HSN,Batch,Expiry,Qty,Rate,TaxPct',
    'India Gate Basmati Rice 5kg,8901526100105,10063020,IG2609,2027-10-31,50,510,5',
    'BadRowOnlyThreeCols,123,10063020',
  ].join('\n');

  const parsed = parsePurchaseImportCsv(csv);
  assert.equal(parsed.lines.length, 1);
  assert.equal(parsed.subtotal, 25500);
  assert.equal(parsed.taxAmount, 1275);
  assert.equal(parsed.grandTotal, 26775);
  assert.equal(parsed.errors.length, 1);
});

test('classifyExpiryStatus distinguishes EXPIRED, NEAR_EXPIRY, and HEALTHY batches', () => {
  assert.equal(classifyExpiryStatus('2026-10-01', '2026-11-26', 30).status, 'EXPIRED');
  assert.equal(classifyExpiryStatus('2026-12-15', '2026-11-26', 30).status, 'NEAR_EXPIRY');
  assert.equal(classifyExpiryStatus('2028-05-01', '2026-11-26', 30).status, 'HEALTHY');
});

test('computeFinancialStatements produces balanced Trial Balance and deterministic GSTR-1 JSON', () => {
  const summary = computeFinancialStatements({
    ledgers: [
      {
        id: 1,
        companyId: 1,
        name: 'Cash-in-Hand',
        groupType: 'Cash',
        gstin: '',
        phone: '',
        email: '',
        address: '',
        stateCode: '29',
        openingBalance: 10000,
        currentBalance: 25000,
        balanceType: 'Dr',
        creditLimit: 0,
        loyaltyPoints: 0,
      },
      {
        id: 2,
        companyId: 1,
        name: 'Hindustan FMCG Supply Co.',
        groupType: 'Supplier',
        gstin: '29AABCH9911K1Z5',
        phone: '',
        email: '',
        address: '',
        stateCode: '29',
        openingBalance: 5000,
        currentBalance: 12000,
        balanceType: 'Cr',
        creditLimit: 100000,
        loyaltyPoints: 0,
      },
    ],
    invoices: [],
    purchases: [],
    vouchers: [],
    batches: [
      {
        id: 1,
        companyId: 1,
        itemId: 1,
        godownName: 'Main Supermarket Floor',
        batchNo: 'B1',
        serialNo: '',
        expiryDate: '2027-12-31',
        qtyOnHand: 100.5,
        costRate: 20,
        mrp: 40,
      },
    ],
  });

  assert.equal(summary.trialDebitTotal, summary.trialCreditTotal);
  assert.equal(summary.closingStockValue, 2010);
  assert.equal(summary.cashBankBalance, 25000);

  const irn = generateDeterministicIrn('29AABCF1429B1ZB', 'INV-26-001', '2026-11-26');
  assert.equal(irn.length, 64);

  const gstr1 = buildGstr1PortalJson('29AABCF1429B1ZB', '112026', []);
  assert.equal(gstr1.gstin, '29AABCF1429B1ZB');
  assert.equal(gstr1.fp, '112026');
});

test('sanitizeNextPath permits only internal /admin paths and blocks open redirects', () => {
  assert.equal(sanitizeNextPath('/admin/pos'), '/admin/pos');
  assert.equal(sanitizeNextPath('/admin/bills/1001'), '/admin/bills/1001');
  assert.equal(sanitizeNextPath('https://evil.example/phish'), '/admin/dashboard');
  assert.equal(sanitizeNextPath('//evil.example/admin'), '/admin/dashboard');
  assert.equal(sanitizeNextPath('/admin/../login'), '/admin/dashboard');
  assert.equal(sanitizeNextPath(null), '/admin/dashboard');
});

test('calculateShiftVariance accurately detects matched, excess, and shortage cash', () => {
  const matched = calculateShiftVariance({
    openingCash: 5000,
    cashSales: 10000,
    upiSales: 8000,
    cardSales: 2000,
    walletSales: 500,
    pdcSales: 0,
    countedCash: 15000,
  });
  assert.equal(matched.expectedCash, 15000);
  assert.equal(matched.cashVariance, 0);
  assert.equal(matched.varianceStatus, 'MATCHED');
  assert.equal(matched.totalDigitalCollection, 10500);
  assert.equal(matched.totalCounterCollection, 20500);

  const shortage = calculateShiftVariance({
    openingCash: 5000,
    cashSales: 4000,
    upiSales: 0,
    cardSales: 0,
    walletSales: 0,
    pdcSales: 0,
    countedCash: 8925,
  });
  assert.equal(shortage.cashVariance, -75);
  assert.equal(shortage.varianceStatus, 'SHORTAGE');
});

test('buildGlobalSearchResults finds supermarket items and modules with routable links', () => {
  const results = buildGlobalSearchResults(
    {
      items: [sampleGroceryItem, sampleWeighedProduceItem],
      ledgers: [],
      invoices: [],
      purchases: [],
      vouchers: [],
    },
    'tomato'
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].category, 'Item');
  assert.ok(results[0].href.startsWith('/admin/masters'));
});

test('parseBarcodeOrPluInput decodes weighted scale EAN-13 stickers into kg and PLU', () => {
  const parsed = parseBarcodeOrPluInput('2101010125007', '21');
  assert.equal(parsed.isWeightedBarcode, true);
  assert.equal(parsed.pluSuffix, '0101');
  assert.equal(parsed.query, '200101');
  assert.equal(parsed.qty, 1.25);

  const customPrefix = parseBarcodeOrPluInput('250102005000', '25');
  assert.equal(customPrefix.isWeightedBarcode, true);
  assert.equal(customPrefix.query, '200102');
  assert.equal(customPrefix.qty, 0.5);
});

test('evaluatePromoCoupon validates flat, percentage cap, min bill, and expiry', () => {
  const coupons: PromoCoupon[] = [
    {
      id: 1,
      companyId: 1,
      code: 'FRESH50',
      description: 'Flat ₹50 off above ₹500',
      discountType: 'FLAT',
      discountValue: 50,
      minBillAmount: 500,
      maxDiscount: 50,
      validTill: '2027-03-31',
      active: true,
    },
    {
      id: 2,
      companyId: 1,
      code: 'WEEKEND10',
      description: '10% off up to ₹150',
      discountType: 'PERCENT',
      discountValue: 10,
      minBillAmount: 1000,
      maxDiscount: 150,
      validTill: '2027-03-31',
      active: true,
    },
  ];

  const tooLow = evaluatePromoCoupon({
    code: 'FRESH50',
    coupons,
    billTotalBeforeCoupon: 420,
    asOfDate: '2026-11-26',
  });
  assert.equal(tooLow.valid, false);

  const flatOk = evaluatePromoCoupon({
    code: 'fresh50',
    coupons,
    billTotalBeforeCoupon: 650,
    asOfDate: '2026-11-26',
  });
  assert.equal(flatOk.valid, true);
  assert.equal(flatOk.discountAmount, 50);

  const cappedPct = evaluatePromoCoupon({
    code: 'WEEKEND10',
    coupons,
    billTotalBeforeCoupon: 2400,
    asOfDate: '2026-11-26',
  });
  assert.equal(cappedPct.valid, true);
  assert.equal(cappedPct.discountAmount, 150);

  const billWithCoupon = calculateInvoiceTotals({
    cartLines: [
      {
        item: sampleGroceryItem,
        batchNo: 'BR26A',
        expiryDate: '2027-08-31',
        qty: 20,
      },
    ],
    schemes: [],
    autoApplySchemes: false,
    asOfDate: '2026-11-26',
    isInterState: false,
    redeemPoints: 0,
    availableCustomerPoints: 0,
    loyaltyPointValue: 1,
    loyaltyEarnPer100: 2,
    enableLoyaltyPoints: false,
    promoCoupon: coupons[0],
  });
  // 20 * 30 = 600 + 72 GST = 672 - 50 coupon = 622
  assert.equal(billWithCoupon.couponCode, 'FRESH50');
  assert.equal(billWithCoupon.couponDiscountAmount, 50);
  assert.equal(billWithCoupon.grandTotal, 622);
});

test('validateUdhaarLimit enforces customer credit limit and blocks walk-ins', () => {
  const noCust = validateUdhaarLimit({ creditAmount: 500 });
  assert.equal(noCust.allowed, false);

  const ok = validateUdhaarLimit({
    customer: {
      name: 'Meenakshi Family Store',
      currentBalance: 1200,
      balanceType: 'Dr',
      creditLimit: 5000,
    },
    creditAmount: 2500,
  });
  assert.equal(ok.allowed, true);
  assert.equal(ok.availableLimit, 3800);

  const exceeded = validateUdhaarLimit({
    customer: {
      name: 'Meenakshi Family Store',
      currentBalance: 4500,
      balanceType: 'Dr',
      creditLimit: 5000,
    },
    creditAmount: 800,
  });
  assert.equal(exceeded.allowed, false);
});

test('encodeCode128B, buildUpiPaymentUri, and buildWhatsAppBillText generate valid outputs', () => {
  const encoded = encodeCode128B('8901526100105');
  assert.equal(encoded.encodedText, '8901526100105');
  assert.ok(encoded.bars.length > 30);
  assert.ok(encoded.totalWidth > 100);

  const uri = buildUpiPaymentUri({
    vpa: 'freshmart@upi',
    payeeName: 'FreshMart Superstore',
    amount: 645.5,
    note: 'Bill POS-26-0101',
  });
  assert.ok(uri.startsWith('upi://pay?'));
  assert.ok(uri.includes('pa=freshmart%40upi'));
  assert.ok(uri.includes('am=645.50'));
  assert.ok(uri.includes('cu=INR'));

  const msg = buildWhatsAppBillText({
    companyName: 'FreshMart Superstore',
    invoiceNo: 'POS-26-0101',
    invoiceDate: '2026-11-26',
    customerName: 'Ramesh Iyer',
    items: [
      {
        itemId: 1,
        barcode: '8901063014121',
        name: 'Britannia Good Day 200g',
        hsnCode: '19053100',
        batchNo: 'BR26A',
        expiryDate: '2027-08-31',
        uqc: 'PKT',
        qty: 2,
        freeQty: 0,
        mrp: 40,
        rate: 30,
        discountPercent: 0,
        discountAmount: 0,
        taxSlab: 12,
        taxableValue: 60,
        taxAmount: 7.2,
        lineTotal: 67.2,
      },
    ],
    grandTotal: 67,
    totalMrpSavings: 20,
    couponCode: 'FRESH50',
    couponDiscount: 50,
    loyaltyEarned: 2,
    upiVpa: 'freshmart@upi',
  });
  assert.ok(msg.includes('FreshMart Superstore'));
  assert.ok(msg.includes('POS-26-0101'));
  assert.ok(msg.includes('You Saved ₹20.00'));
  assert.ok(msg.includes('freshmart@upi'));
});

