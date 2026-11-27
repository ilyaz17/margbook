import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { verifyRequestAuth } from '../../../../src/lib/auth-server.ts';
import {
  assertCompanyOwnership,
  loadWorkspaceForUser,
  resetCompanyToSupermarket,
} from '../../../../src/db/workspace-repo.ts';
import { db } from '../../../../src/db/index.ts';
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
  promoCoupons,
  purchases,
  schemes,
  shiftHandovers,
  stockMovements,
  users,
  vouchers,
} from '../../../../src/db/schema.ts';
import { calculateShiftVariance, round2, round3 } from '../../../../src/lib/erp-engine.ts';

const actionSchema = z.object({
  companyId: z.number().int().positive(),
  type: z.enum([
    'CREATE_LEDGER',
    'CREATE_ITEM',
    'CREATE_BOM',
    'CREATE_SCHEME',
    'TOGGLE_SCHEME',
    'CREATE_COUPON',
    'TOGGLE_COUPON',
    'SETTLE_UDHAAR',
    'CREATE_INVOICE',
    'UPDATE_INVOICE_COMPLIANCE',
    'CREATE_PURCHASE',
    'CREATE_VOUCHER',
    'TOGGLE_VOUCHER_RECONCILED',
    'STOCK_MOVEMENT',
    'CREATE_CRM',
    'UPDATE_CRM_STAGE',
    'UPDATE_COUNTER_STATUS',
    'UPDATE_CONTROL_ROOM',
    'UPDATE_COMPANY_SETTINGS',
    'CREATE_COMPANY',
    'RECORD_SHIFT_HANDOVER',
    'UPDATE_USER_ROLE',
    'RESET_TO_SUPERMARKET',
  ]),
  payload: z.record(z.string(), z.any()),
});

export async function POST(req: NextRequest) {
  const session = await verifyRequestAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid Firebase Bearer token required.' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid action payload.', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { companyId, type, payload } = parsed.data;

  try {
    const owns = await assertCompanyOwnership(session.user.uid, companyId);
    if (!owns) {
      return NextResponse.json(
        { error: 'Forbidden: Company does not belong to current user.' },
        { status: 403 }
      );
    }

    switch (type) {
      case 'CREATE_LEDGER': {
        await db.insert(ledgers).values({
          companyId,
          name: String(payload.name || '').trim(),
          groupType: String(payload.groupType || 'Customer'),
          gstin: String(payload.gstin || ''),
          phone: String(payload.phone || ''),
          email: String(payload.email || ''),
          address: String(payload.address || ''),
          stateCode: String(payload.stateCode || '07'),
          openingBalance: Number(payload.openingBalance || 0),
          currentBalance: Number(payload.openingBalance || 0),
          balanceType: payload.balanceType === 'Cr' ? 'Cr' : 'Dr',
          creditLimit: Number(payload.creditLimit || 0),
          loyaltyPoints: Number(payload.loyaltyPoints || 0),
        });
        break;
      }

      case 'CREATE_ITEM': {
        const [inserted] = await db
          .insert(items)
          .values({
            companyId,
            sku: String(payload.sku || `SKU-${Date.now().toString().slice(-4)}`),
            barcode: String(payload.barcode || `890${Date.now().toString().slice(-10)}`),
            name: String(payload.name || '').trim(),
            brand: String(payload.brand || 'Generic'),
            category: String(payload.category || 'Staples & Grains'),
            hsnCode: String(payload.hsnCode || '10063020'),
            uqc: String(payload.uqc || 'PCS'),
            rackLocation: String(payload.rackLocation || 'Aisle-1'),
            taxSlab: Number(payload.taxSlab ?? 5),
            mrp: Number(payload.mrp || 0),
            saleRate: Number(payload.saleRate || 0),
            purchaseRate: Number(payload.purchaseRate || 0),
            wholesaleRate: Number(payload.wholesaleRate || 0),
            reorderLevel: Number(payload.reorderLevel || 15),
            isWeighed: Boolean(payload.isWeighed),
          })
          .returning({ id: items.id });

        if (inserted && Number(payload.initialQty || 0) > 0) {
          await db.insert(itemBatches).values({
            companyId,
            itemId: inserted.id,
            godownName: String(payload.godownName || 'Main Store'),
            batchNo: String(payload.batchNo || 'B-INIT'),
            serialNo: String(payload.serialNo || ''),
            expiryDate: String(payload.expiryDate || '2027-12-31'),
            qtyOnHand: Number(payload.initialQty || 0),
            costRate: Number(payload.purchaseRate || 0),
            mrp: Number(payload.mrp || 0),
          });
        }
        break;
      }

      case 'CREATE_BOM': {
        await db.insert(bomRecipes).values({
          companyId,
          finishedItemName: String(payload.finishedItemName || '').trim(),
          recipeCode: String(payload.recipeCode || `BOM-${Date.now().toString().slice(-4)}`),
          yieldQty: Number(payload.yieldQty || 1),
          yieldUqc: String(payload.yieldUqc || 'BOX'),
          componentsJson: JSON.stringify(Array.isArray(payload.components) ? payload.components : []),
          laborCost: Number(payload.laborCost || 0),
        });
        break;
      }

      case 'CREATE_SCHEME': {
        await db.insert(schemes).values({
          companyId,
          name: String(payload.name || '').trim(),
          barcodeOrCategory: String(payload.barcodeOrCategory || 'ALL'),
          schemeType: payload.schemeType === 'BUY_X_GET_Y' ? 'BUY_X_GET_Y' : 'PERCENT_DISCOUNT',
          minQty: Number(payload.minQty || 1),
          freeQty: Number(payload.freeQty || 0),
          discountPercent: Number(payload.discountPercent || 0),
          validFrom: String(payload.validFrom || '2026-11-01'),
          validTo: String(payload.validTo || '2026-12-31'),
          active: true,
        });
        break;
      }

      case 'TOGGLE_SCHEME': {
        await db
          .update(schemes)
          .set({ active: Boolean(payload.active) })
          .where(and(eq(schemes.id, Number(payload.id)), eq(schemes.companyId, companyId)));
        break;
      }

      case 'CREATE_COUPON': {
        const code = String(payload.code || '').trim().toUpperCase();
        if (!code) {
          return NextResponse.json({ error: 'Coupon code is required.' }, { status: 400 });
        }
        await db.insert(promoCoupons).values({
          companyId,
          code,
          description: String(payload.description || `${code} supermarket offer`),
          discountType: payload.discountType === 'PERCENT' ? 'PERCENT' : 'FLAT',
          discountValue: Number(payload.discountValue || 0),
          minBillAmount: Number(payload.minBillAmount || 0),
          maxDiscount: Number(payload.maxDiscount || 500),
          validTill: String(payload.validTill || '2026-12-31'),
          active: true,
        });
        break;
      }

      case 'TOGGLE_COUPON': {
        await db
          .update(promoCoupons)
          .set({ active: Boolean(payload.active) })
          .where(and(eq(promoCoupons.id, Number(payload.id)), eq(promoCoupons.companyId, companyId)));
        break;
      }

      case 'SETTLE_UDHAAR': {
        const ledgerId = Number(payload.ledgerId || 0);
        const amount = round2(Math.max(0, Number(payload.amount || 0)));
        if (!ledgerId || amount <= 0) {
          return NextResponse.json({ error: 'Valid customer and settlement amount required.' }, { status: 400 });
        }
        const [cust] = await db
          .select()
          .from(ledgers)
          .where(and(eq(ledgers.id, ledgerId), eq(ledgers.companyId, companyId)));
        if (!cust) {
          return NextResponse.json({ error: 'Customer ledger not found.' }, { status: 404 });
        }
        const nextBal = round2(Math.max(0, cust.currentBalance - amount));
        await db
          .update(ledgers)
          .set({ currentBalance: nextBal })
          .where(eq(ledgers.id, cust.id));

        const mode = String(payload.paymentMode || 'UPI');
        await db.insert(vouchers).values({
          companyId,
          voucherNo: `KHATA-${Date.now().toString().slice(-5)}`,
          voucherType: 'Receipt',
          voucherDate: String(payload.voucherDate || '2026-11-26'),
          debitLedgerName: mode === 'Cash' ? 'Cash-in-Hand (Store Vault)' : 'HDFC Bank Current A/c',
          creditLedgerName: cust.name,
          amount,
          narration: String(payload.narration || `Udhaar Khata settlement received via ${mode}`),
          referenceInvoiceNo: '',
          paymentMode: mode,
          chequeNo: '',
          pdcDate: '',
          reconciled: mode !== 'Cash',
        });
        break;
      }

      case 'CREATE_INVOICE': {
        const lineItems = Array.isArray(payload.items) ? payload.items : [];
        const payments = Array.isArray(payload.payments) ? payload.payments : [];
        const counterCode = String(payload.counterCode || 'POS-01');
        const ledgerId = payload.ledgerId ? Number(payload.ledgerId) : null;
        const loyaltyEarned = Number(payload.loyaltyEarned || 0);
        const loyaltyRedeemed = Number(payload.loyaltyRedeemed || 0);

        await db.insert(invoices).values({
          companyId,
          invoiceNo: String(payload.invoiceNo),
          docType: String(payload.docType || 'POS_BILL'),
          counterCode,
          ledgerId,
          customerName: String(payload.customerName || 'Walk-in Retail Customer'),
          customerPhone: String(payload.customerPhone || ''),
          customerGstin: String(payload.customerGstin || ''),
          invoiceDate: String(payload.invoiceDate || '2026-11-26'),
          subtotal: Number(payload.subtotal || 0),
          discountAmount: Number(payload.discountAmount || 0),
          cgstAmount: Number(payload.cgstAmount || 0),
          sgstAmount: Number(payload.sgstAmount || 0),
          igstAmount: Number(payload.igstAmount || 0),
          roundOff: Number(payload.roundOff || 0),
          grandTotal: Number(payload.grandTotal || 0),
          loyaltyEarned,
          loyaltyRedeemed,
          couponCode: String(payload.couponCode || ''),
          couponDiscount: Number(payload.couponDiscount || 0),
          paymentModeSummary: String(payload.paymentModeSummary || 'Cash'),
          paymentsJson: JSON.stringify(payments),
          itemsJson: JSON.stringify(lineItems),
          irn: String(payload.irn || ''),
          ewayBillNo: String(payload.ewayBillNo || ''),
          status: String(payload.status || 'Paid'),
          createdByUid: session.user.uid,
        });

        // Update customer loyalty points and Credit (Udhaar) receivable balance if applicable
        const creditSplitAmount = round2(
          payments
            .filter((p: { mode?: string }) => p.mode === 'Credit')
            .reduce((sum: number, p: { amount?: number }) => sum + Number(p.amount || 0), 0)
        );
        if (ledgerId && (loyaltyEarned > 0 || loyaltyRedeemed > 0 || creditSplitAmount > 0)) {
          const [cust] = await db
            .select()
            .from(ledgers)
            .where(and(eq(ledgers.id, ledgerId), eq(ledgers.companyId, companyId)));
          if (cust) {
            await db
              .update(ledgers)
              .set({
                loyaltyPoints: Math.max(0, cust.loyaltyPoints - loyaltyRedeemed + loyaltyEarned),
                ...(creditSplitAmount > 0
                  ? {
                      currentBalance: round2(cust.currentBalance + creditSplitAmount),
                      balanceType: 'Dr',
                    }
                  : {}),
              })
              .where(eq(ledgers.id, cust.id));
          }
        }

        // Decrement stock batches for bills (increment for credit notes)
        const docType = String(payload.docType || 'POS_BILL');
        if (docType === 'POS_BILL' || docType === 'GST_INVOICE' || docType === 'CREDIT_NOTE') {
          const direction = docType === 'CREDIT_NOTE' ? 1 : -1;
          for (const line of lineItems) {
            const totalUnits = Number(line.qty || 0) + Number(line.freeQty || 0);
            if (!line.itemId || totalUnits <= 0) continue;
            const [batch] = await db
              .select()
              .from(itemBatches)
              .where(
                and(
                  eq(itemBatches.companyId, companyId),
                  eq(itemBatches.itemId, Number(line.itemId)),
                  eq(itemBatches.batchNo, String(line.batchNo || ''))
                )
              );
            if (batch) {
              await db
                .update(itemBatches)
                .set({
                  qtyOnHand: Math.max(0, round3(batch.qtyOnHand + direction * totalUnits)),
                })
                .where(eq(itemBatches.id, batch.id));
            }
          }
        }

        // Update POS counter cash/UPI/card/wallet/PDC tallies
        if (docType === 'POS_BILL' || docType === 'GST_INVOICE') {
          const [counter] = await db
            .select()
            .from(posCounters)
            .where(
              and(
                eq(posCounters.companyId, companyId),
                eq(posCounters.counterCode, counterCode)
              )
            );
          if (counter) {
            let cashAdd = 0;
            let upiAdd = 0;
            let cardAdd = 0;
            let walletAdd = 0;
            let pdcAdd = 0;
            let creditAdd = 0;
            for (const pay of payments) {
              const amt = Number(pay.amount || 0);
              if (pay.mode === 'Cash') cashAdd += amt;
              if (pay.mode === 'UPI') upiAdd += amt;
              if (pay.mode === 'Card') cardAdd += amt;
              if (pay.mode === 'Wallet') walletAdd += amt;
              if (pay.mode === 'PDC') pdcAdd += amt;
              if (pay.mode === 'Credit') creditAdd += amt;
            }
            await db
              .update(posCounters)
              .set({
                cashSales: counter.cashSales + cashAdd,
                upiSales: counter.upiSales + upiAdd,
                cardSales: counter.cardSales + cardAdd,
                walletSales: counter.walletSales + walletAdd,
                pdcSales: counter.pdcSales + pdcAdd,
                creditSales: (counter.creditSales || 0) + creditAdd,
              })
              .where(eq(posCounters.id, counter.id));
          }
        }
        break;
      }

      case 'UPDATE_INVOICE_COMPLIANCE': {
        await db
          .update(invoices)
          .set({
            ...(payload.irn !== undefined ? { irn: String(payload.irn) } : {}),
            ...(payload.ewayBillNo !== undefined
              ? { ewayBillNo: String(payload.ewayBillNo) }
              : {}),
          })
          .where(and(eq(invoices.id, Number(payload.id)), eq(invoices.companyId, companyId)));
        break;
      }

      case 'CREATE_PURCHASE': {
        const pItems = Array.isArray(payload.items) ? payload.items : [];
        await db.insert(purchases).values({
          companyId,
          billNo: String(payload.billNo),
          docType: String(payload.docType || 'PURCHASE_BILL'),
          ledgerId: payload.ledgerId ? Number(payload.ledgerId) : null,
          supplierName: String(payload.supplierName || 'Supplier'),
          supplierGstin: String(payload.supplierGstin || ''),
          billDate: String(payload.billDate || '2026-11-26'),
          subtotal: Number(payload.subtotal || 0),
          taxAmount: Number(payload.taxAmount || 0),
          grandTotal: Number(payload.grandTotal || 0),
          itemsJson: JSON.stringify(pItems),
          importSource: String(payload.importSource || 'Manual'),
          status: String(payload.status || 'Posted'),
        });

        // Add imported batches to stock if matching item exists
        if (String(payload.docType || 'PURCHASE_BILL') === 'PURCHASE_BILL') {
          const allItems = await db
            .select()
            .from(items)
            .where(eq(items.companyId, companyId));
          for (const line of pItems) {
            const matchedItem = allItems.find(
              (it) =>
                it.barcode === line.barcode ||
                it.name.toLowerCase() === String(line.itemName || '').toLowerCase()
            );
            if (matchedItem) {
              await db.insert(itemBatches).values({
                companyId,
                itemId: matchedItem.id,
                godownName: 'Main Store',
                batchNo: String(line.batchNo || 'IMP-26'),
                serialNo: '',
                expiryDate: String(line.expiryDate || '2027-12-31'),
                qtyOnHand: Number(line.qty || 0),
                costRate: Number(line.rate || matchedItem.purchaseRate),
                mrp: matchedItem.mrp,
              });
            }
          }
        }
        break;
      }

      case 'CREATE_VOUCHER': {
        await db.insert(vouchers).values({
          companyId,
          voucherNo: String(payload.voucherNo),
          voucherType: String(payload.voucherType || 'Receipt'),
          voucherDate: String(payload.voucherDate || '2026-11-26'),
          debitLedgerName: String(payload.debitLedgerName || ''),
          creditLedgerName: String(payload.creditLedgerName || ''),
          amount: Number(payload.amount || 0),
          narration: String(payload.narration || ''),
          referenceInvoiceNo: String(payload.referenceInvoiceNo || ''),
          paymentMode: String(payload.paymentMode || 'Bank Transfer'),
          chequeNo: String(payload.chequeNo || ''),
          pdcDate: String(payload.pdcDate || ''),
          reconciled: Boolean(payload.reconciled),
        });
        break;
      }

      case 'TOGGLE_VOUCHER_RECONCILED': {
        await db
          .update(vouchers)
          .set({ reconciled: Boolean(payload.reconciled) })
          .where(and(eq(vouchers.id, Number(payload.id)), eq(vouchers.companyId, companyId)));
        break;
      }

      case 'STOCK_MOVEMENT': {
        const batchId = Number(payload.batchId || 0);
        const qtyDelta = Number(payload.qtyDelta || 0);
        const movementType = String(payload.movementType || 'TRANSFER');
        const toGodown = String(payload.toGodown || 'Main Store');

        const [sourceBatch] = await db
          .select()
          .from(itemBatches)
          .where(and(eq(itemBatches.id, batchId), eq(itemBatches.companyId, companyId)));

        if (sourceBatch) {
          if (movementType === 'TRANSFER') {
            const transferQty = round3(Math.min(sourceBatch.qtyOnHand, Math.abs(qtyDelta)));
            await db
              .update(itemBatches)
              .set({ qtyOnHand: Math.max(0, round3(sourceBatch.qtyOnHand - transferQty)) })
              .where(eq(itemBatches.id, sourceBatch.id));

            await db.insert(itemBatches).values({
              companyId,
              itemId: sourceBatch.itemId,
              godownName: toGodown,
              batchNo: sourceBatch.batchNo,
              serialNo: sourceBatch.serialNo,
              expiryDate: sourceBatch.expiryDate,
              qtyOnHand: transferQty,
              costRate: sourceBatch.costRate,
              mrp: sourceBatch.mrp,
            });
          } else {
            await db
              .update(itemBatches)
              .set({ qtyOnHand: Math.max(0, round3(sourceBatch.qtyOnHand + qtyDelta)) })
              .where(eq(itemBatches.id, sourceBatch.id));
          }
        }

        await db.insert(stockMovements).values({
          companyId,
          movementType,
          itemName: String(payload.itemName || ''),
          batchNo: String(payload.batchNo || ''),
          fromGodown: String(payload.fromGodown || 'Main Store'),
          toGodown,
          qtyDelta,
          reason: String(payload.reason || ''),
          movementDate: String(payload.movementDate || '2026-11-26'),
        });
        break;
      }

      case 'CREATE_CRM': {
        await db.insert(crmRecords).values({
          companyId,
          channel: payload.channel === 'MARG_MART_ORDER' ? 'MARG_MART_ORDER' : 'CRM_LEAD',
          customerName: String(payload.customerName || '').trim(),
          phone: String(payload.phone || ''),
          stage: String(payload.stage || 'New'),
          orderValue: Number(payload.orderValue || 0),
          nextFollowUp: String(payload.nextFollowUp || '2026-11-28'),
          notes: String(payload.notes || ''),
          itemsSummary: String(payload.itemsSummary || ''),
        });
        break;
      }

      case 'UPDATE_CRM_STAGE': {
        await db
          .update(crmRecords)
          .set({ stage: String(payload.stage || 'Confirmed') })
          .where(and(eq(crmRecords.id, Number(payload.id)), eq(crmRecords.companyId, companyId)));
        break;
      }

      case 'UPDATE_COUNTER_STATUS': {
        await db
          .update(posCounters)
          .set({
            status: payload.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
            ...(payload.lastClosedAt ? { lastClosedAt: String(payload.lastClosedAt) } : {}),
            ...(payload.openingCash !== undefined
              ? { openingCash: Number(payload.openingCash) }
              : {}),
          })
          .where(and(eq(posCounters.id, Number(payload.id)), eq(posCounters.companyId, companyId)));
        break;
      }

      case 'UPDATE_CONTROL_ROOM': {
        await db
          .update(controlRoomSettings)
          .set({
            autoApplySchemes: Boolean(payload.autoApplySchemes),
            enableLoyaltyPoints: Boolean(payload.enableLoyaltyPoints),
            loyaltyEarnPer100: Number(payload.loyaltyEarnPer100 ?? 2),
            loyaltyPointValue: Number(payload.loyaltyPointValue ?? 1),
            allowNegativeStock: Boolean(payload.allowNegativeStock),
            multiCounterEnabled: Boolean(payload.multiCounterEnabled),
            requireBatchOnBilling: Boolean(payload.requireBatchOnBilling),
            nearExpiryAlertDays: Number(payload.nearExpiryAlertDays ?? 90),
            eInvoiceAutoIrn: Boolean(payload.eInvoiceAutoIrn),
            invoiceHeaderTitle: String(payload.invoiceHeaderTitle || 'SUPERMARKET TAX INVOICE / RETAIL BILL'),
            invoiceTerms: String(payload.invoiceTerms || ''),
            thermalPaperWidth: String(payload.thermalPaperWidth || '80mm'),
            ...(payload.upiVpa !== undefined ? { upiVpa: String(payload.upiVpa || 'freshmart@upi') } : {}),
            ...(payload.weightedBarcodePrefix !== undefined
              ? { weightedBarcodePrefix: String(payload.weightedBarcodePrefix || '21').slice(0, 2) }
              : {}),
            ...(payload.lastBooksRebuildAt
              ? { lastBooksRebuildAt: String(payload.lastBooksRebuildAt) }
              : {}),
            ...(payload.lastBackupAt ? { lastBackupAt: String(payload.lastBackupAt) } : {}),
          })
          .where(eq(controlRoomSettings.companyId, companyId));
        break;
      }

      case 'UPDATE_COMPANY_SETTINGS': {
        await db
          .update(companies)
          .set({
            ...(payload.fyLocked !== undefined ? { fyLocked: Boolean(payload.fyLocked) } : {}),
            ...(payload.financialYear ? { financialYear: String(payload.financialYear) } : {}),
            ...(payload.currency ? { currency: String(payload.currency) } : {}),
          })
          .where(and(eq(companies.id, companyId), eq(companies.ownerUid, session.user.uid)));
        break;
      }

      case 'CREATE_COMPANY': {
        const name = String(payload.name || '').trim();
        const gstin = String(payload.gstin || '').trim().toUpperCase();
        if (!name || !gstin) {
          return NextResponse.json(
            { error: 'Company name and GSTIN are required.' },
            { status: 400 }
          );
        }
        const [created] = await db
          .insert(companies)
          .values({
            ownerUid: session.user.uid,
            name,
            gstin,
            stateCode: String(payload.stateCode || gstin.slice(0, 2) || '07'),
            stateName: String(payload.stateName || 'Delhi'),
            address: String(payload.address || 'Commercial Street, India'),
            phone: String(payload.phone || ''),
            currency: String(payload.currency || 'INR'),
            financialYear: String(payload.financialYear || '2026-27'),
            fyLocked: false,
            branchName: String(payload.branchName || 'Main Branch'),
          })
          .returning({ id: companies.id });

        if (created) {
          await db.insert(controlRoomSettings).values({
            companyId: created.id,
          });
          await db.insert(posCounters).values({
            companyId: created.id,
            counterCode: 'POS-01',
            counterName: `Counter 01 — ${String(payload.branchName || 'Express Desk')}`,
            operatorName: session.user.displayName || 'Store Admin',
            operatorRole: 'Admin',
            openingCash: Number(payload.openingCash || 5000),
            status: 'OPEN',
            lastClosedAt: '',
          });
          await db.insert(ledgers).values([
            {
              companyId: created.id,
              name: 'Walk-in Retail Customer',
              groupType: 'Customer',
              stateCode: String(payload.stateCode || '07'),
              balanceType: 'Dr',
              loyaltyPoints: 0,
            },
            {
              companyId: created.id,
              name: 'Cash-in-Hand',
              groupType: 'Cash',
              stateCode: String(payload.stateCode || '07'),
              openingBalance: Number(payload.openingCash || 5000),
              currentBalance: Number(payload.openingCash || 5000),
              balanceType: 'Dr',
            },
          ]);

          const updatedNew = await loadWorkspaceForUser(session.user.uid, created.id);
          return NextResponse.json(updatedNew);
        }
        break;
      }

      case 'RECORD_SHIFT_HANDOVER': {
        const counterId = Number(payload.counterId || 0);
        const [counter] = await db
          .select()
          .from(posCounters)
          .where(and(eq(posCounters.id, counterId), eq(posCounters.companyId, companyId)));

        if (!counter) {
          return NextResponse.json(
            { error: 'Selected POS counter was not found.' },
            { status: 404 }
          );
        }

        const countedCash = Number(payload.countedCash ?? 0);
        const variance = calculateShiftVariance({
          openingCash: counter.openingCash,
          cashSales: counter.cashSales,
          upiSales: counter.upiSales,
          cardSales: counter.cardSales,
          walletSales: counter.walletSales,
          pdcSales: counter.pdcSales,
          countedCash,
        });

        const shiftStatus =
          payload.shiftStatus === 'CLOSED'
            ? 'CLOSED'
            : payload.shiftStatus === 'OPENED'
              ? 'OPENED'
              : 'HANDED_OVER';
        const handedOverAt = String(
          payload.handedOverAt || new Date().toISOString().slice(0, 16).replace('T', ' ')
        );
        const incomingOperator = String(payload.incomingOperator || 'Store Admin').trim();

        await db.insert(shiftHandovers).values({
          companyId,
          counterCode: counter.counterCode,
          counterName: counter.counterName,
          outgoingOperator: String(payload.outgoingOperator || counter.operatorName),
          outgoingRole: String(payload.outgoingRole || counter.operatorRole),
          incomingOperator,
          shiftStatus,
          openingCash: counter.openingCash,
          cashSales: counter.cashSales,
          upiSales: counter.upiSales,
          cardSales: counter.cardSales,
          walletSales: counter.walletSales,
          pdcSales: counter.pdcSales,
          expectedCash: variance.expectedCash,
          countedCash,
          cashVariance: variance.cashVariance,
          notes: String(payload.notes || ''),
          handedOverAt,
        });

        await db
          .update(posCounters)
          .set({
            status: shiftStatus === 'CLOSED' ? 'CLOSED' : 'OPEN',
            operatorName: incomingOperator,
            lastClosedAt: handedOverAt,
            ...(payload.nextOpeningCash !== undefined
              ? { openingCash: Number(payload.nextOpeningCash) }
              : {}),
            ...(payload.resetSales === true
              ? { cashSales: 0, upiSales: 0, cardSales: 0, walletSales: 0, pdcSales: 0 }
              : {}),
          })
          .where(eq(posCounters.id, counter.id));
        break;
      }

      case 'UPDATE_USER_ROLE': {
        const validRoles = ['admin', 'manager', 'cashier', 'accountant'] as const;
        const requestedRole = String(payload.role || 'admin').toLowerCase();
        if (!validRoles.includes(requestedRole as (typeof validRoles)[number])) {
          return NextResponse.json({ error: 'Invalid operator role.' }, { status: 400 });
        }
        await db
          .update(users)
          .set({ role: requestedRole })
          .where(eq(users.uid, session.user.uid));
        break;
      }

      case 'RESET_TO_SUPERMARKET': {
        await resetCompanyToSupermarket(companyId, session.user.uid);
        break;
      }
    }

    const updated = await loadWorkspaceForUser(session.user.uid, companyId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error(`POST /api/workspace/action (${type}) failed:`, error);
    return NextResponse.json(
      { error: 'Unable to save changes. Please verify inputs and try again.' },
      { status: 500 }
    );
  }
}
