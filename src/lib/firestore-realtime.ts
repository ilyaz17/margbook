'use client';

import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import type { EnabledAddonsMap } from '../types/erp';

export interface LiveDisplayFirestorePayload {
  storeName: string;
  branchName: string;
  upiVpa: string;
  customerName: string;
  counterCode: string;
  status: 'IDLE' | 'SCANNING' | 'PAID';
  subtotal: number;
  totalTax: number;
  couponDiscount: number;
  loyaltyDiscount: number;
  totalMrpSavings: number;
  grandTotal: number;
  upiAmount: number;
  couponCode: string;
  lastInvoiceNo: string;
  lines: Array<{
    name: string;
    qty: number;
    uqc: string;
    rate: number;
    mrp: number;
    lineTotal: number;
    freeQty?: number;
  }>;
}

export interface RealtimeOpsEvent {
  id: string;
  ownerId: string;
  storeId: string;
  eventType: 'DELIVERY_DISPATCH' | 'WASTAGE_ALERT' | 'ADDON_TOGGLE' | 'POS_CHECKOUT';
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'alert';
  createdAtMs: number;
}

export function getStoreDocId(companyId: number): string {
  return `company_${Math.max(1, Math.floor(companyId))}`;
}

function sanitizeCounterId(counterCode: string): string {
  const cleaned = counterCode.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  return cleaned || 'LANE-01';
}

export async function ensureStoreRealtimeDoc(
  companyId: number,
  storeName: string,
  enabledAddons: EnabledAddonsMap
): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const storeId = getStoreDocId(companyId);
  const path = `stores/${storeId}`;
  const ref = doc(db, 'stores', storeId);
  try {
    const existing = await getDoc(ref);
    const safeName = storeName.slice(0, 140) || 'FreshMart Superstore';
    const safeAddonsJson = JSON.stringify(enabledAddons).slice(0, 2000);
    if (!existing.exists()) {
      await setDoc(ref, {
        ownerId: uid,
        companyId,
        storeName: safeName,
        enabledAddonsJson: safeAddonsJson,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        storeName: safeName,
        enabledAddonsJson: safeAddonsJson,
        updatedAt: serverTimestamp(),
      });
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export async function publishLiveDisplayToFirestore(
  companyId: number,
  payload: LiveDisplayFirestorePayload,
  enabledAddons?: EnabledAddonsMap
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const storeId = getStoreDocId(companyId);
  const counterId = sanitizeCounterId(payload.counterCode);
  const path = `stores/${storeId}/liveDisplays/${counterId}`;
  try {
    if (enabledAddons) {
      await ensureStoreRealtimeDoc(companyId, payload.storeName, enabledAddons);
    }
    const boundedLines = payload.lines.slice(0, 40).map((l) => ({
      name: String(l.name).slice(0, 80),
      qty: Number(l.qty) || 0,
      uqc: String(l.uqc).slice(0, 12),
      rate: Number(l.rate) || 0,
      mrp: Number(l.mrp) || 0,
      lineTotal: Number(l.lineTotal) || 0,
      freeQty: Number(l.freeQty || 0),
    }));
    await setDoc(doc(db, 'stores', storeId, 'liveDisplays', counterId), {
      ownerId: uid,
      storeId,
      counterCode: counterId,
      storeName: (payload.storeName || 'FreshMart Superstore').slice(0, 140),
      branchName: (payload.branchName || 'Main Branch').slice(0, 140),
      upiVpa: (payload.upiVpa || 'freshmart@upi').slice(0, 120),
      customerName: (payload.customerName || 'Walk-in Shopper').slice(0, 120),
      status: payload.status,
      subtotal: Math.max(0, Number(payload.subtotal) || 0),
      totalTax: Math.max(0, Number(payload.totalTax) || 0),
      couponDiscount: Math.max(0, Number(payload.couponDiscount) || 0),
      loyaltyDiscount: Math.max(0, Number(payload.loyaltyDiscount) || 0),
      totalMrpSavings: Math.max(0, Number(payload.totalMrpSavings) || 0),
      grandTotal: Math.max(0, Number(payload.grandTotal) || 0),
      upiAmount: Math.max(0, Number(payload.upiAmount) || 0),
      couponCode: (payload.couponCode || '').slice(0, 40),
      lastInvoiceNo: (payload.lastInvoiceNo || '').slice(0, 60),
      linesJson: JSON.stringify(boundedLines).slice(0, 15900),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeLiveDisplayFromFirestore(
  companyId: number,
  counterCode: string,
  onUpdate: (payload: LiveDisplayFirestorePayload) => void
): Unsubscribe | null {
  if (!auth.currentUser?.uid) return null;
  const storeId = getStoreDocId(companyId);
  const counterId = sanitizeCounterId(counterCode);
  const path = `stores/${storeId}/liveDisplays/${counterId}`;
  return onSnapshot(
    doc(db, 'stores', storeId, 'liveDisplays', counterId),
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      let parsedLines: LiveDisplayFirestorePayload['lines'] = [];
      try {
        const raw = JSON.parse(String(d.linesJson || '[]'));
        if (Array.isArray(raw)) parsedLines = raw;
      } catch {
        parsedLines = [];
      }
      onUpdate({
        storeName: String(d.storeName || 'FreshMart Superstore'),
        branchName: String(d.branchName || ''),
        upiVpa: String(d.upiVpa || 'freshmart@upi'),
        customerName: String(d.customerName || 'Walk-in Shopper'),
        counterCode: String(d.counterCode || counterId),
        status:
          d.status === 'SCANNING' || d.status === 'PAID' ? d.status : 'IDLE',
        subtotal: Number(d.subtotal) || 0,
        totalTax: Number(d.totalTax) || 0,
        couponDiscount: Number(d.couponDiscount) || 0,
        loyaltyDiscount: Number(d.loyaltyDiscount) || 0,
        totalMrpSavings: Number(d.totalMrpSavings) || 0,
        grandTotal: Number(d.grandTotal) || 0,
        upiAmount: Number(d.upiAmount) || 0,
        couponCode: String(d.couponCode || ''),
        lastInvoiceNo: String(d.lastInvoiceNo || ''),
        lines: parsedLines,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function publishOpsEventToFirestore(
  companyId: number,
  storeName: string,
  enabledAddons: EnabledAddonsMap,
  event: {
    eventType: RealtimeOpsEvent['eventType'];
    title: string;
    detail: string;
    severity?: RealtimeOpsEvent['severity'];
  }
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const storeId = getStoreDocId(companyId);
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `stores/${storeId}/opsEvents/${eventId}`;
  try {
    await ensureStoreRealtimeDoc(companyId, storeName, enabledAddons);
    await setDoc(doc(db, 'stores', storeId, 'opsEvents', eventId), {
      ownerId: uid,
      storeId,
      eventType: event.eventType,
      title: event.title.slice(0, 140),
      detail: event.detail.slice(0, 400),
      severity: event.severity || 'info',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeOpsEventsFromFirestore(
  companyId: number,
  onEvents: (events: RealtimeOpsEvent[]) => void
): Unsubscribe | null {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const storeId = getStoreDocId(companyId);
  const path = `stores/${storeId}/opsEvents`;
  const q = query(
    collection(db, 'stores', storeId, 'opsEvents'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(15)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: RealtimeOpsEvent[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const ts = d.createdAt as { toMillis?: () => number } | undefined;
        return {
          id: docSnap.id,
          ownerId: String(d.ownerId || ''),
          storeId: String(d.storeId || storeId),
          eventType:
            d.eventType === 'DELIVERY_DISPATCH' ||
            d.eventType === 'WASTAGE_ALERT' ||
            d.eventType === 'ADDON_TOGGLE'
              ? d.eventType
              : 'POS_CHECKOUT',
          title: String(d.title || ''),
          detail: String(d.detail || ''),
          severity:
            d.severity === 'alert' || d.severity === 'warning'
              ? d.severity
              : 'info',
          createdAtMs: ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now(),
        };
      });
      onEvents(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
