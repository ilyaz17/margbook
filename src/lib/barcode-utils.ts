import type { CustomerDisplaySnapshot, InvoiceLineItem } from '../types/erp';

// Standard ISO/IEC 15417 Code 128 patterns (indices 0..106)
// Each string encodes alternating bar-space-bar-space-bar-space module widths (stop code 106 has 7 elements)
const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

export interface EncodedBarcode {
  bars: Array<{ x: number; width: number }>;
  totalWidth: number;
  encodedText: string;
}

/**
 * Generates a genuine, scannable ISO/IEC 15417 Code-128B vector bar layout.
 */
export function encodeCode128B(rawText: string): EncodedBarcode {
  const sanitized = rawText
    .trim()
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, 32) || '000000';

  const startCode = 104; // Start B
  const stopCode = 106;
  const codes: number[] = [startCode];
  let checksum = startCode;

  for (let i = 0; i < sanitized.length; i++) {
    const code = sanitized.charCodeAt(i) - 32;
    codes.push(code);
    checksum += code * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(stopCode);

  const quietZone = 8;
  let cursor = quietZone;
  const bars: Array<{ x: number; width: number }> = [];

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code] || CODE128_PATTERNS[0];
    for (let j = 0; j < pattern.length; j++) {
      const width = Number(pattern[j]);
      const isBar = j % 2 === 0;
      if (isBar) {
        bars.push({ x: cursor, width });
      }
      cursor += width;
    }
  }

  return {
    bars,
    totalWidth: cursor + quietZone,
    encodedText: sanitized,
  };
}

/**
 * Builds an NPCI-standard Indian UPI payment intent URI for dynamic QR codes.
 */
export function buildUpiPaymentUri(params: {
  vpa: string;
  payeeName: string;
  amount: number;
  note?: string;
  txnRef?: string;
}): string {
  const pa = (params.vpa || 'freshmart@upi').trim();
  const pn = (params.payeeName || 'FreshMart Superstore').trim();
  const am = Math.max(0, Number(params.amount || 0)).toFixed(2);
  const query = new URLSearchParams({
    pa,
    pn,
    am,
    cu: 'INR',
  });
  if (params.note) query.set('tn', params.note.slice(0, 60));
  if (params.txnRef) query.set('tr', params.txnRef.slice(0, 35));
  return `upi://pay?${query.toString()}`;
}

/**
 * Formats an itemized Indian supermarket digital receipt ready for WhatsApp sharing.
 */
export function buildWhatsAppBillText(params: {
  companyName: string;
  branchName?: string;
  invoiceNo: string;
  invoiceDate: string;
  customerName: string;
  items: InvoiceLineItem[];
  grandTotal: number;
  totalMrpSavings: number;
  couponCode?: string;
  couponDiscount?: number;
  loyaltyEarned?: number;
  upiVpa?: string;
}): string {
  const lines = [
    `*${params.companyName}*${params.branchName ? ` (${params.branchName})` : ''}`,
    `Digital Bill: *${params.invoiceNo}* | Date: ${params.invoiceDate}`,
    `Customer: ${params.customerName}`,
    `--------------------------------`,
    ...params.items.map(
      (it) =>
        `• ${it.name} (${it.qty} ${it.uqc}) — ₹${it.lineTotal.toFixed(2)}${
          it.mrp > it.rate ? ` [MRP ₹${it.mrp}]` : ''
        }`
    ),
    `--------------------------------`,
    ...(params.couponCode && (params.couponDiscount || 0) > 0
      ? [`Coupon (${params.couponCode}): -₹${(params.couponDiscount || 0).toFixed(2)}`]
      : []),
    `*Grand Total: ₹${params.grandTotal.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}*`,
    ...(params.totalMrpSavings > 0
      ? [`*You Saved ₹${params.totalMrpSavings.toFixed(2)} on MRP Today!*`]
      : []),
    ...(params.loyaltyEarned && params.loyaltyEarned > 0
      ? [`Loyalty Points Earned: +${params.loyaltyEarned} pts`]
      : []),
    ...(params.upiVpa ? [`UPI Pay ID: ${params.upiVpa}`] : []),
    `Thank you for shopping fresh with us!`,
  ];
  return lines.join('\n');
}

/**
 * Synthesizes tactile checkout scanner tones using the Web Audio API (no external audio assets).
 */
export function playCheckoutBeep(kind: 'scan' | 'error' | 'cash', enabled: boolean): void {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (kind === 'scan') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046, now);
      osc.frequency.setValueAtTime(1318, now + 0.045);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (kind === 'cash') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1174, now + 0.07);
      osc.frequency.setValueAtTime(1568, now + 0.14);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.26);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.19);
    }

    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 350);
  } catch {
    // Ignore audio context autoplay restrictions silently
  }
}

export const CUSTOMER_DISPLAY_CHANNEL = 'freshmart-pos-display';
const CUSTOMER_DISPLAY_STORAGE_KEY = 'freshmart-pos-display-snapshot';

export function broadcastCustomerDisplay(snapshot: CustomerDisplaySnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUSTOMER_DISPLAY_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota errors
  }
  try {
    if ('BroadcastChannel' in window) {
      const ch = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
      ch.postMessage(snapshot);
      ch.close();
    }
  } catch {
    // Ignore BroadcastChannel errors
  }
}

export function readLastCustomerDisplay(): CustomerDisplaySnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CUSTOMER_DISPLAY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CustomerDisplaySnapshot;
  } catch {
    return null;
  }
}
