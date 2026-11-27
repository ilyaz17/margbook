import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  bomRecipes,
  companies,
  controlRoomSettings,
  crmRecords,
  invoices,
  itemBatches,
  items,
  ledgers,
  posCounters,
  purchases,
  schemes,
  shiftHandovers,
  stockMovements,
  users,
  vouchers,
} from './schema.ts';
import { createInitialWorkspaceData } from '../lib/seed-data.ts';
import type {
  BomComponent,
  ControlRoomConfig,
  InvoiceLineItem,
  PaymentSplit,
  PurchaseLineItem,
  UserAccessRole,
  WorkspaceData,
} from '../types/erp.ts';

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function ensureCompanySeeded(ownerUid: string): Promise<number> {
  try {
    const existing = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.ownerUid, ownerUid));

    if (existing.length > 0) {
      return existing[0].id;
    }

    const seed = createInitialWorkspaceData();
    const insertedCompanies = await db
      .insert(companies)
      .values(
        seed.companies.map((c) => ({
          ownerUid,
          name: c.name,
          gstin: c.gstin,
          stateCode: c.stateCode,
          stateName: c.stateName,
          address: c.address,
          phone: c.phone,
          currency: c.currency,
          financialYear: c.financialYear,
          fyLocked: c.fyLocked,
          branchName: c.branchName,
        }))
      )
      .returning({ id: companies.id });

    const primaryCompanyId = insertedCompanies[0].id;

    // Seed ledgers
    const insertedLedgers = await db
      .insert(ledgers)
      .values(
        seed.ledgers.map((l) => ({
          companyId: primaryCompanyId,
          name: l.name,
          groupType: l.groupType,
          gstin: l.gstin,
          phone: l.phone,
          email: l.email,
          address: l.address,
          stateCode: l.stateCode,
          openingBalance: l.openingBalance,
          currentBalance: l.currentBalance,
          balanceType: l.balanceType,
          creditLimit: l.creditLimit,
          loyaltyPoints: l.loyaltyPoints,
        }))
      )
      .returning({ id: ledgers.id, name: ledgers.name });

    const ledgerNameToId = new Map(insertedLedgers.map((l) => [l.name, l.id]));

    // Seed items and map old IDs -> real PostgreSQL IDs
    const insertedItems = await db
      .insert(items)
      .values(
        seed.items.map((it) => ({
          companyId: primaryCompanyId,
          sku: it.sku,
          barcode: it.barcode,
          name: it.name,
          brand: it.brand,
          category: it.category,
          hsnCode: it.hsnCode,
          uqc: it.uqc,
          rackLocation: it.rackLocation,
          taxSlab: it.taxSlab,
          mrp: it.mrp,
          saleRate: it.saleRate,
          purchaseRate: it.purchaseRate,
          wholesaleRate: it.wholesaleRate,
          reorderLevel: it.reorderLevel,
          isWeighed: it.isWeighed,
        }))
      )
      .returning({ id: items.id, sku: items.sku });

    const oldItemIdToNewId = new Map<number, number>();
    seed.items.forEach((it) => {
      const match = insertedItems.find((row) => row.sku === it.sku);
      if (match) oldItemIdToNewId.set(it.id, match.id);
    });

    // Seed batches
    const batchRows = seed.batches
      .map((b) => {
        const mappedItemId = oldItemIdToNewId.get(b.itemId);
        if (!mappedItemId) return null;
        return {
          companyId: primaryCompanyId,
          itemId: mappedItemId,
          godownName: b.godownName,
          batchNo: b.batchNo,
          serialNo: b.serialNo,
          expiryDate: b.expiryDate,
          qtyOnHand: b.qtyOnHand,
          costRate: b.costRate,
          mrp: b.mrp,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (batchRows.length > 0) {
      await db.insert(itemBatches).values(batchRows);
    }

    await db.insert(bomRecipes).values(
      seed.bomRecipes.map((r) => ({
        companyId: primaryCompanyId,
        finishedItemName: r.finishedItemName,
        recipeCode: r.recipeCode,
        yieldQty: r.yieldQty,
        yieldUqc: r.yieldUqc,
        componentsJson: JSON.stringify(r.components),
        laborCost: r.laborCost,
      }))
    );

    await db.insert(schemes).values(
      seed.schemes.map((s) => ({
        companyId: primaryCompanyId,
        name: s.name,
        barcodeOrCategory: s.barcodeOrCategory,
        schemeType: s.schemeType,
        minQty: s.minQty,
        freeQty: s.freeQty,
        discountPercent: s.discountPercent,
        validFrom: s.validFrom,
        validTo: s.validTo,
        active: s.active,
      }))
    );

    await db.insert(invoices).values(
      seed.invoices.map((inv) => ({
        companyId: primaryCompanyId,
        invoiceNo: inv.invoiceNo,
        docType: inv.docType,
        counterCode: inv.counterCode,
        ledgerId: ledgerNameToId.get(inv.customerName) ?? null,
        customerName: inv.customerName,
        customerPhone: inv.customerPhone,
        customerGstin: inv.customerGstin,
        invoiceDate: inv.invoiceDate,
        subtotal: inv.subtotal,
        discountAmount: inv.discountAmount,
        cgstAmount: inv.cgstAmount,
        sgstAmount: inv.sgstAmount,
        igstAmount: inv.igstAmount,
        roundOff: inv.roundOff,
        grandTotal: inv.grandTotal,
        loyaltyEarned: inv.loyaltyEarned,
        loyaltyRedeemed: inv.loyaltyRedeemed,
        paymentModeSummary: inv.paymentModeSummary,
        paymentsJson: JSON.stringify(inv.payments),
        itemsJson: JSON.stringify(inv.items),
        irn: inv.irn,
        ewayBillNo: inv.ewayBillNo,
        status: inv.status,
        createdByUid: ownerUid,
      }))
    );

    await db.insert(purchases).values(
      seed.purchases.map((p) => ({
        companyId: primaryCompanyId,
        billNo: p.billNo,
        docType: p.docType,
        ledgerId: ledgerNameToId.get(p.supplierName) ?? null,
        supplierName: p.supplierName,
        supplierGstin: p.supplierGstin,
        billDate: p.billDate,
        subtotal: p.subtotal,
        taxAmount: p.taxAmount,
        grandTotal: p.grandTotal,
        itemsJson: JSON.stringify(p.items),
        importSource: p.importSource,
        status: p.status,
      }))
    );

    await db.insert(vouchers).values(
      seed.vouchers.map((v) => ({
        companyId: primaryCompanyId,
        voucherNo: v.voucherNo,
        voucherType: v.voucherType,
        voucherDate: v.voucherDate,
        debitLedgerName: v.debitLedgerName,
        creditLedgerName: v.creditLedgerName,
        amount: v.amount,
        narration: v.narration,
        referenceInvoiceNo: v.referenceInvoiceNo,
        paymentMode: v.paymentMode,
        chequeNo: v.chequeNo,
        pdcDate: v.pdcDate,
        reconciled: v.reconciled,
      }))
    );

    await db.insert(stockMovements).values(
      seed.stockMovements.map((m) => ({
        companyId: primaryCompanyId,
        movementType: m.movementType,
        itemName: m.itemName,
        batchNo: m.batchNo,
        fromGodown: m.fromGodown,
        toGodown: m.toGodown,
        qtyDelta: m.qtyDelta,
        reason: m.reason,
        movementDate: m.movementDate,
      }))
    );

    await db.insert(crmRecords).values(
      seed.crmRecords.map((c) => ({
        companyId: primaryCompanyId,
        channel: c.channel,
        customerName: c.customerName,
        phone: c.phone,
        stage: c.stage,
        orderValue: c.orderValue,
        nextFollowUp: c.nextFollowUp,
        notes: c.notes,
        itemsSummary: c.itemsSummary,
      }))
    );

    await db.insert(posCounters).values(
      seed.posCounters.map((pc) => ({
        companyId: primaryCompanyId,
        counterCode: pc.counterCode,
        counterName: pc.counterName,
        operatorName: pc.operatorName,
        operatorRole: pc.operatorRole,
        openingCash: pc.openingCash,
        cashSales: pc.cashSales,
        upiSales: pc.upiSales,
        cardSales: pc.cardSales,
        walletSales: pc.walletSales,
        pdcSales: pc.pdcSales,
        status: pc.status,
        lastClosedAt: pc.lastClosedAt,
      }))
    );

    if (seed.shiftHandovers.length > 0) {
      await db.insert(shiftHandovers).values(
        seed.shiftHandovers.map((sh) => ({
          companyId: primaryCompanyId,
          counterCode: sh.counterCode,
          counterName: sh.counterName,
          outgoingOperator: sh.outgoingOperator,
          outgoingRole: sh.outgoingRole,
          incomingOperator: sh.incomingOperator,
          shiftStatus: sh.shiftStatus,
          openingCash: sh.openingCash,
          cashSales: sh.cashSales,
          upiSales: sh.upiSales,
          cardSales: sh.cardSales,
          walletSales: sh.walletSales,
          pdcSales: sh.pdcSales,
          expectedCash: sh.expectedCash,
          countedCash: sh.countedCash,
          cashVariance: sh.cashVariance,
          notes: sh.notes,
          handedOverAt: sh.handedOverAt,
        }))
      );
    }

    for (const insertedComp of insertedCompanies) {
      await db
        .insert(controlRoomSettings)
        .values({
          companyId: insertedComp.id,
          autoApplySchemes: seed.controlRoom.autoApplySchemes,
          enableLoyaltyPoints: seed.controlRoom.enableLoyaltyPoints,
          loyaltyEarnPer100: seed.controlRoom.loyaltyEarnPer100,
          loyaltyPointValue: seed.controlRoom.loyaltyPointValue,
          allowNegativeStock: seed.controlRoom.allowNegativeStock,
          multiCounterEnabled: seed.controlRoom.multiCounterEnabled,
          requireBatchOnBilling: seed.controlRoom.requireBatchOnBilling,
          nearExpiryAlertDays: seed.controlRoom.nearExpiryAlertDays,
          eInvoiceAutoIrn: seed.controlRoom.eInvoiceAutoIrn,
          invoiceHeaderTitle: seed.controlRoom.invoiceHeaderTitle,
          invoiceTerms: seed.controlRoom.invoiceTerms,
          thermalPaperWidth: seed.controlRoom.thermalPaperWidth,
          lastBooksRebuildAt: seed.controlRoom.lastBooksRebuildAt,
          lastBackupAt: seed.controlRoom.lastBackupAt,
        })
        .onConflictDoNothing();
    }

    return primaryCompanyId;
  } catch (error) {
    console.error('Failed to seed workspace in PostgreSQL:', error);
    throw new Error('Failed to initialize workspace records.', { cause: error });
  }
}

export async function loadWorkspaceForUser(
  ownerUid: string,
  requestedCompanyId?: number
): Promise<WorkspaceData> {
  try {
    const defaultCompanyId = await ensureCompanySeeded(ownerUid);
    const userCompanies = await db
      .select()
      .from(companies)
      .where(eq(companies.ownerUid, ownerUid))
      .orderBy(companies.id);

    const activeCompany =
      userCompanies.find((c) => c.id === requestedCompanyId) ??
      userCompanies.find((c) => c.id === defaultCompanyId) ??
      userCompanies[0];

    const companyId = activeCompany.id;

    // Auto-migrate legacy medical demo seed company to pure Supermarket catalog once
    if (activeCompany.name === 'Shree Balaji Supermart & Pharma Pvt. Ltd.') {
      await resetCompanyToSupermarket(companyId, ownerUid);
      return loadWorkspaceForUser(ownerUid, companyId);
    }

    const [
      ledgerRows,
      itemRows,
      batchRows,
      bomRows,
      schemeRows,
      invoiceRows,
      purchaseRows,
      voucherRows,
      movementRows,
      crmRows,
      counterRows,
      shiftRows,
      controlRows,
      userRows,
    ] = await Promise.all([
      db.select().from(ledgers).where(eq(ledgers.companyId, companyId)).orderBy(ledgers.id),
      db.select().from(items).where(eq(items.companyId, companyId)).orderBy(items.id),
      db.select().from(itemBatches).where(eq(itemBatches.companyId, companyId)).orderBy(itemBatches.id),
      db.select().from(bomRecipes).where(eq(bomRecipes.companyId, companyId)).orderBy(bomRecipes.id),
      db.select().from(schemes).where(eq(schemes.companyId, companyId)).orderBy(schemes.id),
      db
        .select()
        .from(invoices)
        .where(eq(invoices.companyId, companyId))
        .orderBy(desc(invoices.id)),
      db
        .select()
        .from(purchases)
        .where(eq(purchases.companyId, companyId))
        .orderBy(desc(purchases.id)),
      db
        .select()
        .from(vouchers)
        .where(eq(vouchers.companyId, companyId))
        .orderBy(desc(vouchers.id)),
      db
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.companyId, companyId))
        .orderBy(desc(stockMovements.id)),
      db
        .select()
        .from(crmRecords)
        .where(eq(crmRecords.companyId, companyId))
        .orderBy(desc(crmRecords.id)),
      db.select().from(posCounters).where(eq(posCounters.companyId, companyId)).orderBy(posCounters.id),
      db
        .select()
        .from(shiftHandovers)
        .where(eq(shiftHandovers.companyId, companyId))
        .orderBy(desc(shiftHandovers.id)),
      db
        .select()
        .from(controlRoomSettings)
        .where(eq(controlRoomSettings.companyId, companyId)),
      db.select({ role: users.role }).from(users).where(eq(users.uid, ownerUid)),
    ]);

    const fallbackSeed = createInitialWorkspaceData();
    const cr = controlRows[0];
    const controlRoom: ControlRoomConfig = cr
      ? {
          id: cr.id,
          companyId: cr.companyId,
          autoApplySchemes: cr.autoApplySchemes,
          enableLoyaltyPoints: cr.enableLoyaltyPoints,
          loyaltyEarnPer100: cr.loyaltyEarnPer100,
          loyaltyPointValue: cr.loyaltyPointValue,
          allowNegativeStock: cr.allowNegativeStock,
          multiCounterEnabled: cr.multiCounterEnabled,
          requireBatchOnBilling: cr.requireBatchOnBilling,
          nearExpiryAlertDays: cr.nearExpiryAlertDays,
          eInvoiceAutoIrn: cr.eInvoiceAutoIrn,
          invoiceHeaderTitle: cr.invoiceHeaderTitle,
          invoiceTerms: cr.invoiceTerms,
          thermalPaperWidth: (cr.thermalPaperWidth as '58mm' | '80mm' | 'A4') || '80mm',
          lastBooksRebuildAt: cr.lastBooksRebuildAt,
          lastBackupAt: cr.lastBackupAt,
        }
      : { ...fallbackSeed.controlRoom, companyId };

    return {
      companies: userCompanies.map((c) => ({
        id: c.id,
        name: c.name,
        gstin: c.gstin,
        stateCode: c.stateCode,
        stateName: c.stateName,
        address: c.address,
        phone: c.phone,
        currency: c.currency,
        financialYear: c.financialYear,
        fyLocked: c.fyLocked,
        branchName: c.branchName,
      })),
      activeCompanyId: companyId,
      currentUserRole: (userRows[0]?.role as UserAccessRole) || 'admin',
      ledgers: ledgerRows.map((l) => ({
        id: l.id,
        companyId: l.companyId,
        name: l.name,
        groupType: l.groupType as WorkspaceData['ledgers'][number]['groupType'],
        gstin: l.gstin,
        phone: l.phone,
        email: l.email,
        address: l.address,
        stateCode: l.stateCode,
        openingBalance: l.openingBalance,
        currentBalance: l.currentBalance,
        balanceType: (l.balanceType as 'Dr' | 'Cr') || 'Dr',
        creditLimit: l.creditLimit,
        loyaltyPoints: l.loyaltyPoints,
      })),
      items: itemRows.map((it) => ({
        id: it.id,
        companyId: it.companyId,
        sku: it.sku,
        barcode: it.barcode,
        name: it.name,
        brand: it.brand,
        category: it.category,
        hsnCode: it.hsnCode,
        uqc: it.uqc,
        rackLocation: it.rackLocation,
        taxSlab: it.taxSlab,
        mrp: it.mrp,
        saleRate: it.saleRate,
        purchaseRate: it.purchaseRate,
        wholesaleRate: it.wholesaleRate,
        reorderLevel: it.reorderLevel,
        isWeighed: it.isWeighed,
      })),
      batches: batchRows.map((b) => ({
        id: b.id,
        companyId: b.companyId,
        itemId: b.itemId,
        godownName: b.godownName,
        batchNo: b.batchNo,
        serialNo: b.serialNo,
        expiryDate: b.expiryDate,
        qtyOnHand: b.qtyOnHand,
        costRate: b.costRate,
        mrp: b.mrp,
      })),
      bomRecipes: bomRows.map((r) => ({
        id: r.id,
        companyId: r.companyId,
        finishedItemName: r.finishedItemName,
        recipeCode: r.recipeCode,
        yieldQty: r.yieldQty,
        yieldUqc: r.yieldUqc,
        components: safeJsonParse<BomComponent[]>(r.componentsJson, []),
        laborCost: r.laborCost,
      })),
      schemes: schemeRows.map((s) => ({
        id: s.id,
        companyId: s.companyId,
        name: s.name,
        barcodeOrCategory: s.barcodeOrCategory,
        schemeType: s.schemeType as 'PERCENT_DISCOUNT' | 'BUY_X_GET_Y',
        minQty: s.minQty,
        freeQty: s.freeQty,
        discountPercent: s.discountPercent,
        validFrom: s.validFrom,
        validTo: s.validTo,
        active: s.active,
      })),
      invoices: invoiceRows.map((inv) => ({
        id: inv.id,
        companyId: inv.companyId,
        invoiceNo: inv.invoiceNo,
        docType: inv.docType as WorkspaceData['invoices'][number]['docType'],
        counterCode: inv.counterCode,
        ledgerId: inv.ledgerId,
        customerName: inv.customerName,
        customerPhone: inv.customerPhone,
        customerGstin: inv.customerGstin,
        invoiceDate: inv.invoiceDate,
        subtotal: inv.subtotal,
        discountAmount: inv.discountAmount,
        cgstAmount: inv.cgstAmount,
        sgstAmount: inv.sgstAmount,
        igstAmount: inv.igstAmount,
        roundOff: inv.roundOff,
        grandTotal: inv.grandTotal,
        loyaltyEarned: inv.loyaltyEarned,
        loyaltyRedeemed: inv.loyaltyRedeemed,
        paymentModeSummary: inv.paymentModeSummary,
        payments: safeJsonParse<PaymentSplit[]>(inv.paymentsJson, []),
        items: safeJsonParse<InvoiceLineItem[]>(inv.itemsJson, []),
        irn: inv.irn,
        ewayBillNo: inv.ewayBillNo,
        status: inv.status as WorkspaceData['invoices'][number]['status'],
      })),
      purchases: purchaseRows.map((p) => ({
        id: p.id,
        companyId: p.companyId,
        billNo: p.billNo,
        docType: p.docType as WorkspaceData['purchases'][number]['docType'],
        ledgerId: p.ledgerId,
        supplierName: p.supplierName,
        supplierGstin: p.supplierGstin,
        billDate: p.billDate,
        subtotal: p.subtotal,
        taxAmount: p.taxAmount,
        grandTotal: p.grandTotal,
        items: safeJsonParse<PurchaseLineItem[]>(p.itemsJson, []),
        importSource: p.importSource as WorkspaceData['purchases'][number]['importSource'],
        status: p.status as WorkspaceData['purchases'][number]['status'],
      })),
      vouchers: voucherRows.map((v) => ({
        id: v.id,
        companyId: v.companyId,
        voucherNo: v.voucherNo,
        voucherType: v.voucherType as WorkspaceData['vouchers'][number]['voucherType'],
        voucherDate: v.voucherDate,
        debitLedgerName: v.debitLedgerName,
        creditLedgerName: v.creditLedgerName,
        amount: v.amount,
        narration: v.narration,
        referenceInvoiceNo: v.referenceInvoiceNo,
        paymentMode: v.paymentMode,
        chequeNo: v.chequeNo,
        pdcDate: v.pdcDate,
        reconciled: v.reconciled,
      })),
      stockMovements: movementRows.map((m) => ({
        id: m.id,
        companyId: m.companyId,
        movementType: m.movementType as WorkspaceData['stockMovements'][number]['movementType'],
        itemName: m.itemName,
        batchNo: m.batchNo,
        fromGodown: m.fromGodown,
        toGodown: m.toGodown,
        qtyDelta: m.qtyDelta,
        reason: m.reason,
        movementDate: m.movementDate,
      })),
      crmRecords: crmRows.map((c) => ({
        id: c.id,
        companyId: c.companyId,
        channel: c.channel as WorkspaceData['crmRecords'][number]['channel'],
        customerName: c.customerName,
        phone: c.phone,
        stage: c.stage as WorkspaceData['crmRecords'][number]['stage'],
        orderValue: c.orderValue,
        nextFollowUp: c.nextFollowUp,
        notes: c.notes,
        itemsSummary: c.itemsSummary,
      })),
      posCounters: counterRows.map((pc) => ({
        id: pc.id,
        companyId: pc.companyId,
        counterCode: pc.counterCode,
        counterName: pc.counterName,
        operatorName: pc.operatorName,
        operatorRole: pc.operatorRole,
        openingCash: pc.openingCash,
        cashSales: pc.cashSales,
        upiSales: pc.upiSales,
        cardSales: pc.cardSales,
        walletSales: pc.walletSales,
        pdcSales: pc.pdcSales,
        status: (pc.status as 'OPEN' | 'CLOSED') || 'OPEN',
        lastClosedAt: pc.lastClosedAt,
      })),
      shiftHandovers: shiftRows.map((sh) => ({
        id: sh.id,
        companyId: sh.companyId,
        counterCode: sh.counterCode,
        counterName: sh.counterName,
        outgoingOperator: sh.outgoingOperator,
        outgoingRole: sh.outgoingRole,
        incomingOperator: sh.incomingOperator,
        shiftStatus: (sh.shiftStatus as 'HANDED_OVER' | 'CLOSED' | 'OPENED') || 'HANDED_OVER',
        openingCash: sh.openingCash,
        cashSales: sh.cashSales,
        upiSales: sh.upiSales,
        cardSales: sh.cardSales,
        walletSales: sh.walletSales,
        pdcSales: sh.pdcSales,
        expectedCash: sh.expectedCash,
        countedCash: sh.countedCash,
        cashVariance: sh.cashVariance,
        notes: sh.notes,
        handedOverAt: sh.handedOverAt,
      })),
      controlRoom,
      operators: fallbackSeed.operators,
    };
  } catch (error) {
    console.error('Failed to load workspace from PostgreSQL:', error);
    throw new Error('Failed to load workspace data. Please try again.', {
      cause: error,
    });
  }
}

export async function resetCompanyToSupermarket(
  companyId: number,
  ownerUid: string
): Promise<void> {
  try {
    const seed = createInitialWorkspaceData();
    const primarySeedCompany = seed.companies[0];

    await db
      .update(companies)
      .set({
        name: primarySeedCompany.name,
        gstin: primarySeedCompany.gstin,
        stateCode: primarySeedCompany.stateCode,
        stateName: primarySeedCompany.stateName,
        address: primarySeedCompany.address,
        phone: primarySeedCompany.phone,
        branchName: primarySeedCompany.branchName,
      })
      .where(and(eq(companies.id, companyId), eq(companies.ownerUid, ownerUid)));

    // Clear child rows for this company in safe dependency order
    await db.delete(itemBatches).where(eq(itemBatches.companyId, companyId));
    await db.delete(items).where(eq(items.companyId, companyId));
    await db.delete(ledgers).where(eq(ledgers.companyId, companyId));
    await db.delete(bomRecipes).where(eq(bomRecipes.companyId, companyId));
    await db.delete(schemes).where(eq(schemes.companyId, companyId));
    await db.delete(invoices).where(eq(invoices.companyId, companyId));
    await db.delete(purchases).where(eq(purchases.companyId, companyId));
    await db.delete(vouchers).where(eq(vouchers.companyId, companyId));
    await db.delete(stockMovements).where(eq(stockMovements.companyId, companyId));
    await db.delete(crmRecords).where(eq(crmRecords.companyId, companyId));
    await db.delete(posCounters).where(eq(posCounters.companyId, companyId));
    await db.delete(shiftHandovers).where(eq(shiftHandovers.companyId, companyId));

    const insertedLedgers = await db
      .insert(ledgers)
      .values(
        seed.ledgers.map((l) => ({
          companyId,
          name: l.name,
          groupType: l.groupType,
          gstin: l.gstin,
          phone: l.phone,
          email: l.email,
          address: l.address,
          stateCode: l.stateCode,
          openingBalance: l.openingBalance,
          currentBalance: l.currentBalance,
          balanceType: l.balanceType,
          creditLimit: l.creditLimit,
          loyaltyPoints: l.loyaltyPoints,
        }))
      )
      .returning({ id: ledgers.id, name: ledgers.name });

    const ledgerNameToId = new Map(insertedLedgers.map((l) => [l.name, l.id]));

    const insertedItems = await db
      .insert(items)
      .values(
        seed.items.map((it) => ({
          companyId,
          sku: it.sku,
          barcode: it.barcode,
          name: it.name,
          brand: it.brand,
          category: it.category,
          hsnCode: it.hsnCode,
          uqc: it.uqc,
          rackLocation: it.rackLocation,
          taxSlab: it.taxSlab,
          mrp: it.mrp,
          saleRate: it.saleRate,
          purchaseRate: it.purchaseRate,
          wholesaleRate: it.wholesaleRate,
          reorderLevel: it.reorderLevel,
          isWeighed: it.isWeighed,
        }))
      )
      .returning({ id: items.id, sku: items.sku });

    const oldItemIdToNewId = new Map<number, number>();
    seed.items.forEach((it) => {
      const match = insertedItems.find((row) => row.sku === it.sku);
      if (match) oldItemIdToNewId.set(it.id, match.id);
    });

    const batchRows = seed.batches
      .map((b) => {
        const mappedItemId = oldItemIdToNewId.get(b.itemId);
        if (!mappedItemId) return null;
        return {
          companyId,
          itemId: mappedItemId,
          godownName: b.godownName,
          batchNo: b.batchNo,
          serialNo: b.serialNo,
          expiryDate: b.expiryDate,
          qtyOnHand: b.qtyOnHand,
          costRate: b.costRate,
          mrp: b.mrp,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (batchRows.length > 0) {
      await db.insert(itemBatches).values(batchRows);
    }

    await db.insert(bomRecipes).values(
      seed.bomRecipes.map((r) => ({
        companyId,
        finishedItemName: r.finishedItemName,
        recipeCode: r.recipeCode,
        yieldQty: r.yieldQty,
        yieldUqc: r.yieldUqc,
        componentsJson: JSON.stringify(r.components),
        laborCost: r.laborCost,
      }))
    );

    await db.insert(schemes).values(
      seed.schemes.map((s) => ({
        companyId,
        name: s.name,
        barcodeOrCategory: s.barcodeOrCategory,
        schemeType: s.schemeType,
        minQty: s.minQty,
        freeQty: s.freeQty,
        discountPercent: s.discountPercent,
        validFrom: s.validFrom,
        validTo: s.validTo,
        active: s.active,
      }))
    );

    await db.insert(invoices).values(
      seed.invoices.map((inv) => ({
        companyId,
        invoiceNo: inv.invoiceNo,
        docType: inv.docType,
        counterCode: inv.counterCode,
        ledgerId: ledgerNameToId.get(inv.customerName) ?? null,
        customerName: inv.customerName,
        customerPhone: inv.customerPhone,
        customerGstin: inv.customerGstin,
        invoiceDate: inv.invoiceDate,
        subtotal: inv.subtotal,
        discountAmount: inv.discountAmount,
        cgstAmount: inv.cgstAmount,
        sgstAmount: inv.sgstAmount,
        igstAmount: inv.igstAmount,
        roundOff: inv.roundOff,
        grandTotal: inv.grandTotal,
        loyaltyEarned: inv.loyaltyEarned,
        loyaltyRedeemed: inv.loyaltyRedeemed,
        paymentModeSummary: inv.paymentModeSummary,
        paymentsJson: JSON.stringify(inv.payments),
        itemsJson: JSON.stringify(inv.items),
        irn: inv.irn,
        ewayBillNo: inv.ewayBillNo,
        status: inv.status,
        createdByUid: ownerUid,
      }))
    );

    await db.insert(purchases).values(
      seed.purchases.map((p) => ({
        companyId,
        billNo: p.billNo,
        docType: p.docType,
        ledgerId: ledgerNameToId.get(p.supplierName) ?? null,
        supplierName: p.supplierName,
        supplierGstin: p.supplierGstin,
        billDate: p.billDate,
        subtotal: p.subtotal,
        taxAmount: p.taxAmount,
        grandTotal: p.grandTotal,
        itemsJson: JSON.stringify(p.items),
        importSource: p.importSource,
        status: p.status,
      }))
    );

    await db.insert(vouchers).values(
      seed.vouchers.map((v) => ({
        companyId,
        voucherNo: v.voucherNo,
        voucherType: v.voucherType,
        voucherDate: v.voucherDate,
        debitLedgerName: v.debitLedgerName,
        creditLedgerName: v.creditLedgerName,
        amount: v.amount,
        narration: v.narration,
        referenceInvoiceNo: v.referenceInvoiceNo,
        paymentMode: v.paymentMode,
        chequeNo: v.chequeNo,
        pdcDate: v.pdcDate,
        reconciled: v.reconciled,
      }))
    );

    await db.insert(stockMovements).values(
      seed.stockMovements.map((m) => ({
        companyId,
        movementType: m.movementType,
        itemName: m.itemName,
        batchNo: m.batchNo,
        fromGodown: m.fromGodown,
        toGodown: m.toGodown,
        qtyDelta: m.qtyDelta,
        reason: m.reason,
        movementDate: m.movementDate,
      }))
    );

    await db.insert(crmRecords).values(
      seed.crmRecords.map((c) => ({
        companyId,
        channel: c.channel,
        customerName: c.customerName,
        phone: c.phone,
        stage: c.stage,
        orderValue: c.orderValue,
        nextFollowUp: c.nextFollowUp,
        notes: c.notes,
        itemsSummary: c.itemsSummary,
      }))
    );

    await db.insert(posCounters).values(
      seed.posCounters.map((pc) => ({
        companyId,
        counterCode: pc.counterCode,
        counterName: pc.counterName,
        operatorName: pc.operatorName,
        operatorRole: pc.operatorRole,
        openingCash: pc.openingCash,
        cashSales: pc.cashSales,
        upiSales: pc.upiSales,
        cardSales: pc.cardSales,
        walletSales: pc.walletSales,
        pdcSales: pc.pdcSales,
        status: pc.status,
        lastClosedAt: pc.lastClosedAt,
      }))
    );

    if (seed.shiftHandovers.length > 0) {
      await db.insert(shiftHandovers).values(
        seed.shiftHandovers.map((sh) => ({
          companyId,
          counterCode: sh.counterCode,
          counterName: sh.counterName,
          outgoingOperator: sh.outgoingOperator,
          outgoingRole: sh.outgoingRole,
          incomingOperator: sh.incomingOperator,
          shiftStatus: sh.shiftStatus,
          openingCash: sh.openingCash,
          cashSales: sh.cashSales,
          upiSales: sh.upiSales,
          cardSales: sh.cardSales,
          walletSales: sh.walletSales,
          pdcSales: sh.pdcSales,
          expectedCash: sh.expectedCash,
          countedCash: sh.countedCash,
          cashVariance: sh.cashVariance,
          notes: sh.notes,
          handedOverAt: sh.handedOverAt,
        }))
      );
    }

    await db
      .update(controlRoomSettings)
      .set({
        nearExpiryAlertDays: seed.controlRoom.nearExpiryAlertDays,
        invoiceHeaderTitle: seed.controlRoom.invoiceHeaderTitle,
        invoiceTerms: seed.controlRoom.invoiceTerms,
      })
      .where(eq(controlRoomSettings.companyId, companyId));
  } catch (error) {
    console.error('Failed to reset company to supermarket catalog:', error);
    throw new Error('Unable to load supermarket catalog.', { cause: error });
  }
}

export async function assertCompanyOwnership(
  ownerUid: string,
  companyId: number
): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, companyId), eq(companies.ownerUid, ownerUid)));
    return rows.length > 0;
  } catch (error) {
    console.error('Ownership check failed:', error);
    throw new Error('Unable to verify company permissions.', { cause: error });
  }
}
