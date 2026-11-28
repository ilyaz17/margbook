'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Barcode,
  Bike,
  Camera,
  CameraOff,
  CreditCard,
  History,
  Minus,
  Monitor,
  PauseCircle,
  PlayCircle,
  Plug,
  Plus,
  QrCode,
  RotateCcw,
  Scale,
  ScanBarcode,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Volume2,
  VolumeX,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react';
import {
  broadcastCustomerDisplay,
  playCheckoutBeep,
} from '../lib/barcode-utils';
import {
  calculateInvoiceTotals,
  evaluatePromoCoupon,
  generateDeterministicIrn,
  parseBarcodeOrPluInput,
  parseSerialScaleReading,
  round2,
  round3,
  validateFamilyWalletPayment,
  validateMultiPayments,
  validateUdhaarLimit,
  type RawCartLine,
} from '../lib/erp-engine';
import { publishLiveDisplayToFirestore } from '../lib/firestore-realtime';
import type {
  DeliveryPaymentType,
  HeldCart,
  InventoryItem,
  InvoiceRecord,
  PaymentMode,
  PaymentSplit,
  PromoCoupon,
} from '../types/erp';
import { UpiQrCodeSvg } from './QrAndBarcodeWidgets';
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

const INDIAN_CASH_NOTES = [50, 100, 200, 500, 2000];

export function RetailPosModule() {
  const router = useRouter();
  const {
    workspace,
    dispatchActionWithResult,
    showToast,
    isOnline,
    queueOfflineInvoice,
    broadcastOpsEvent,
  } = useMargBooks();
  const activeCompany =
    workspace.companies.find((c) => c.id === workspace.activeCompanyId) ||
    workspace.companies[0];
  const enabledAddons = workspace.controlRoom.enabledAddons;
  const scaleAddonEnabled = enabledAddons?.weighing_scale !== false;
  const deliveryAddonEnabled = enabledAddons?.home_delivery !== false;
  const walletAddonEnabled = enabledAddons?.membership_wallet !== false;
  const offlineAddonEnabled = enabledAddons?.offline_pwa !== false;

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastCameraScanRef = useRef<{ code: string; ts: number }>({ code: '', ts: 0 });
  const cartStartMsRef = useRef<number | null>(null);
  const serialPortRef = useRef<{ close?: () => Promise<void> } | null>(null);
  const serialReaderRef = useRef<{ cancel?: () => Promise<void> } | null>(null);

  const [posMode, setPosMode] = useState<'BILLING' | 'RETURN'>('BILLING');
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

  // Live Digital Weighing Scale State (Web Serial + Test Bench)
  const [scaleOpen, setScaleOpen] = useState(false);
  const [scaleConnected, setScaleConnected] = useState(false);
  const [scaleRawKg, setScaleRawKg] = useState(0);
  const [scaleTareKg, setScaleTareKg] = useState(0);
  const [scaleStable, setScaleStable] = useState(true);
  const [scaleStatusMsg, setScaleStatusMsg] = useState(
    'Connect USB/RS-232 scale or tap Test Scale Bench weights.'
  );

  // Home Delivery Assignment Toggle State
  const [assignDelivery, setAssignDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliverySlot, setDeliverySlot] = useState('Express (60 min)');
  const [deliveryRider, setDeliveryRider] = useState('Arjun Kumar');
  const [deliveryPaymentType, setDeliveryPaymentType] =
    useState<DeliveryPaymentType>('COD_UPI');

  // Promo Coupon State
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<PromoCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Audio Beep & Camera Scanner State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<string>(
    'Point camera at any EAN-13 barcode or weighted produce sticker.'
  );

  // Payment Split State
  const [payments, setPayments] = useState<PaymentSplit[]>([
    { mode: 'Cash', amount: 0, reference: '' },
  ]);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Return / Exchange Recall State
  const [returnSearch, setReturnSearch] = useState('');
  const [selectedReturnInvoice, setSelectedReturnInvoice] = useState<InvoiceRecord | null>(null);
  const [returnQtyMap, setReturnQtyMap] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState('Customer exchange / damaged pack');

  const today = '2026-11-26';
  const weightedPrefix = workspace.controlRoom.weightedBarcodePrefix || '21';
  const storeUpiVpa = workspace.controlRoom.upiVpa || 'freshmart@upi';
  const scaleNetKg = round3(Math.max(0, scaleRawKg - scaleTareKg));

  useEffect(() => {
    barcodeInputRef.current?.focus();
    const timer = window.setTimeout(() => {
      try {
        const savedSound = window.localStorage.getItem('freshmart-pos-sound');
        if (savedSound === 'off') setSoundEnabled(false);
      } catch {
        // Ignore storage errors
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      void serialReaderRef.current?.cancel?.();
      void serialPortRef.current?.close?.();
    };
  }, []);

  const handleDisconnectScale = useCallback(async () => {
    try {
      await serialReaderRef.current?.cancel?.();
      await serialPortRef.current?.close?.();
    } catch {
      // Ignore disconnect errors
    }
    serialReaderRef.current = null;
    serialPortRef.current = null;
    setScaleConnected(false);
    setScaleStatusMsg('Scale disconnected. You can reconnect or use Test Scale Bench.');
  }, []);

  const handleConnectSerialScale = async () => {
    const navSerial = (
      navigator as unknown as {
        serial?: {
          requestPort: () => Promise<{
            open: (opts: { baudRate: number }) => Promise<void>;
            close: () => Promise<void>;
            readable?: ReadableStream<Uint8Array>;
          }>;
        };
      }
    ).serial;

    if (!navSerial) {
      setScaleStatusMsg(
        'Web Serial requires Chrome/Edge desktop. Use Test Scale Bench presets below to simulate live weights.'
      );
      return;
    }
    try {
      const port = await navSerial.requestPort();
      await port.open({ baudRate: 9600 });
      serialPortRef.current = port;
      setScaleConnected(true);
      setScaleStatusMsg('Connected to digital weighing scale at 9600 baud.');

      if (port.readable) {
        const decoder = new TextDecoder();
        const reader = port.readable.getReader();
        serialReaderRef.current = reader;
        let buffer = '';
        void (async () => {
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) {
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || '';
                for (const line of lines) {
                  const parsed = parseSerialScaleReading(line);
                  if (parsed) {
                    setScaleRawKg(parsed.weightKg);
                    setScaleStable(parsed.stable);
                  }
                }
              }
            }
          } catch {
            // Port closed
          } finally {
            setScaleConnected(false);
          }
        })();
      }
    } catch {
      setScaleStatusMsg('Scale port selection cancelled. Use Test Scale Bench below anytime.');
    }
  };

  const applySimulatedScaleWeight = (kg: number) => {
    const parsed = parseSerialScaleReading(`ST,GS,+${kg.toFixed(3)}kg`);
    if (parsed) {
      setScaleRawKg(parsed.weightKg);
      setScaleTareKg(0);
      setScaleStable(parsed.stable);
      setCustomKgInput(parsed.weightKg.toFixed(3));
      setScaleStatusMsg(`Test Scale Bench reading locked: ${parsed.weightKg.toFixed(3)} kg`);
    }
  };

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('freshmart-pos-sound', next ? 'on' : 'off');
      } catch {
        // Ignore
      }
      if (next) playCheckoutBeep('scan', true);
      return next;
    });
  };

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

  const activeCoupons = useMemo(
    () => workspace.promoCoupons.filter((c) => c.active),
    [workspace.promoCoupons]
  );

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

  const quickEssentialItems = useMemo(() => {
    const priorityBarcodes = [
      '100001',
      '8901262150019',
      '8901063311022',
      '8906017290018',
      '200102',
    ];
    const found: InventoryItem[] = [];
    for (const code of priorityBarcodes) {
      const match = workspace.items.find((it) => it.barcode === code);
      if (match) found.push(match);
    }
    if (found.length < 5) {
      for (const it of workspace.items) {
        if (!found.some((f) => f.id === it.id)) found.push(it);
        if (found.length === 5) break;
      }
    }
    return found;
  }, [workspace.items]);

  const filteredItems = useMemo(() => {
    const parsed = parseBarcodeOrPluInput(barcodeQuery, weightedPrefix);
    const q = parsed.query.toLowerCase();
    return workspace.items.filter((item) => {
      const catOk = categoryFilter === 'All' || item.category === categoryFilter;
      const searchOk =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.barcode.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        (parsed.pluSuffix ? item.barcode.endsWith(parsed.pluSuffix) : false);
      return catOk && searchOk;
    });
  }, [workspace.items, categoryFilter, barcodeQuery, weightedPrefix]);

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
        promoCoupon: appliedCoupon,
      }),
    [
      cart,
      workspace.schemes,
      workspace.controlRoom,
      isInterState,
      redeemPoints,
      selectedCustomer,
      appliedCoupon,
    ]
  );

  // Keep single payment auto-synced when grand total updates (only if single non-overtendered payment)
  const effectivePayments = useMemo(() => {
    if (
      payments.length === 1 &&
      payments[0].amount === 0 &&
      calculatedBill.grandTotal > 0
    ) {
      return [{ ...payments[0], amount: calculatedBill.grandTotal }];
    }
    return payments;
  }, [payments, calculatedBill.grandTotal]);

  const paymentValidation = useMemo(
    () => validateMultiPayments(effectivePayments, calculatedBill.grandTotal),
    [effectivePayments, calculatedBill.grandTotal]
  );

  const creditSplitAmount = useMemo(
    () =>
      round2(
        effectivePayments
          .filter((p) => p.mode === 'Credit')
          .reduce((s, p) => s + (Number(p.amount) || 0), 0)
      ),
    [effectivePayments]
  );

  const udhaarCheck = useMemo(
    () =>
      validateUdhaarLimit({
        customer: selectedCustomer,
        creditAmount: creditSplitAmount,
      }),
    [selectedCustomer, creditSplitAmount]
  );

  const walletSplitAmount = useMemo(
    () =>
      round2(
        effectivePayments
          .filter((p) => p.mode === 'Wallet')
          .reduce((s, p) => s + (Number(p.amount) || 0), 0)
      ),
    [effectivePayments]
  );

  const walletCheck = useMemo(
    () =>
      validateFamilyWalletPayment({
        customer: selectedCustomer,
        walletAmount: walletSplitAmount,
      }),
    [selectedCustomer, walletSplitAmount]
  );

  const upiSplitAmount = useMemo(
    () =>
      round2(
        effectivePayments
          .filter((p) => p.mode === 'UPI')
          .reduce((s, p) => s + (Number(p.amount) || 0), 0)
      ),
    [effectivePayments]
  );

  const hasCashPayment = effectivePayments.some((p) => p.mode === 'Cash');
  const hasUpiPayment = effectivePayments.some((p) => p.mode === 'UPI');

  // Broadcast live basket updates to Customer-Facing Second Screen (Local Broadcast + Firestore)
  useEffect(() => {
    const liveLines = calculatedBill.lines.map((ln) => ({
      name: ln.name,
      qty: ln.qty,
      uqc: ln.uqc,
      mrp: ln.mrp,
      rate: ln.rate,
      lineTotal: ln.lineTotal,
    }));
    const liveStatus = calculatedBill.lines.length > 0 ? 'SCANNING' : 'IDLE';
    const liveUpiAmount = upiSplitAmount > 0 ? upiSplitAmount : calculatedBill.grandTotal;

    broadcastCustomerDisplay({
      updatedAt: new Date().toISOString(),
      storeName: activeCompany?.name || 'FreshMart Superstore',
      branchName: activeCompany?.branchName || 'Main Flagship Store',
      counterCode: selectedCounter,
      customerName: selectedCustomer?.name || 'Walk-in Shopper',
      upiVpa: storeUpiVpa,
      lines: liveLines,
      subtotal: calculatedBill.subtotal,
      totalTax: calculatedBill.totalTax,
      couponCode: calculatedBill.couponCode,
      couponDiscount: calculatedBill.couponDiscountAmount,
      loyaltyDiscount: calculatedBill.loyaltyDiscountAmount,
      totalMrpSavings: calculatedBill.totalMrpSavings,
      grandTotal: calculatedBill.grandTotal,
      upiAmount: liveUpiAmount,
      status: liveStatus,
    });

    const syncTimer = window.setTimeout(() => {
      void publishLiveDisplayToFirestore(
        workspace.activeCompanyId,
        {
          storeName: activeCompany?.name || 'FreshMart Superstore',
          branchName: activeCompany?.branchName || 'Main Flagship Store',
          upiVpa: storeUpiVpa,
          customerName: selectedCustomer?.name || 'Walk-in Shopper',
          counterCode: selectedCounter,
          status: liveStatus,
          subtotal: calculatedBill.subtotal,
          totalTax: calculatedBill.totalTax,
          couponDiscount: calculatedBill.couponDiscountAmount,
          loyaltyDiscount: calculatedBill.loyaltyDiscountAmount,
          totalMrpSavings: calculatedBill.totalMrpSavings,
          grandTotal: calculatedBill.grandTotal,
          upiAmount: liveUpiAmount,
          couponCode: calculatedBill.couponCode,
          lastInvoiceNo: '',
          lines: liveLines,
        },
        workspace.controlRoom.enabledAddons
      );
    }, 250);

    return () => window.clearTimeout(syncTimer);
  }, [
    workspace.activeCompanyId,
    workspace.controlRoom.enabledAddons,
    activeCompany,
    selectedCounter,
    selectedCustomer,
    storeUpiVpa,
    calculatedBill,
    upiSplitAmount,
  ]);

  const addItemToCart = useCallback(
    (item: InventoryItem, qtyToAdd = 1, skipWeighPrompt = false) => {
      const stockInfo = itemStockMap.get(item.id);
      const available = stockInfo?.totalQty ?? 0;

      if ((item.isWeighed || item.uqc === 'KG') && !skipWeighPrompt) {
        setWeighingItem(item);
        setCustomKgInput(scaleNetKg > 0 ? scaleNetKg.toFixed(3) : '1.00');
        return;
      }

      if (!workspace.controlRoom.allowNegativeStock && available <= 0) {
        playCheckoutBeep('error', soundEnabled);
        showToast(`${item.name} is out of stock.`, 'warning');
        return;
      }

      const normalizedAdd = round3(qtyToAdd);
      setCart((prev) => {
        if (prev.length === 0) {
          cartStartMsRef.current = Date.now();
        }
        const idx = prev.findIndex((line) => line.item.id === item.id);
        if (idx >= 0) {
          const next = [...prev];
          const nextQty = round3(next[idx].qty + normalizedAdd);
          if (!workspace.controlRoom.allowNegativeStock && nextQty > available) {
            playCheckoutBeep('error', soundEnabled);
            showToast(
              `Only ${formatQtyDisplay(available, item.uqc, item.isWeighed)} available in stock for ${item.name}.`,
              'warning'
            );
            return prev;
          }
          next[idx] = { ...next[idx], qty: nextQty };
          return next;
        }
        if (!workspace.controlRoom.allowNegativeStock && normalizedAdd > available) {
          playCheckoutBeep('error', soundEnabled);
          showToast(
            `Only ${formatQtyDisplay(available, item.uqc, item.isWeighed)} available in stock for ${item.name}.`,
            'warning'
          );
          return prev;
        }
        return [
          ...prev,
          {
            item,
            batchNo: stockInfo?.preferredBatch || 'STD-01',
            expiryDate: stockInfo?.expiryDate || '2027-12-31',
            qty: normalizedAdd,
          },
        ];
      });
      playCheckoutBeep('scan', soundEnabled);
      setWeighingItem(null);
      setCheckoutError(null);
      // Reset single cash tender back to auto-sync exact total unless split
      setPayments((prev) => (prev.length === 1 ? [{ ...prev[0], amount: 0 }] : prev));
    },
    [itemStockMap, workspace.controlRoom.allowNegativeStock, showToast, soundEnabled, scaleNetKg]
  );

  const processScannedCode = useCallback(
    (rawCode: string) => {
      const trimmed = rawCode.trim();
      if (!trimmed) return false;

      // Membership Card Barcode Lookup (e.g. FM-MEM-1042)
      if (walletAddonEnabled) {
        const matchedMember = customers.find(
          (c) =>
            c.membershipCardNo &&
            c.membershipCardNo.toLowerCase() === trimmed.toLowerCase()
        );
        if (matchedMember) {
          setSelectedCustomerId(matchedMember.id);
          setRedeemPoints(0);
          playCheckoutBeep('scan', soundEnabled);
          showToast(
            `Member Card Matched: ${matchedMember.name} (${(matchedMember.membershipTier || 'SILVER').replace('_', ' ')} · Wallet ${formatInr(matchedMember.walletBalance || 0)})`,
            'success'
          );
          return true;
        }
      }

      const parsed = parseBarcodeOrPluInput(trimmed, weightedPrefix);
      const q = parsed.query.toLowerCase();
      if (!q) return false;

      const exact = workspace.items.find(
        (i) =>
          i.barcode.toLowerCase() === q ||
          i.sku.toLowerCase() === q ||
          (parsed.pluSuffix ? i.barcode.endsWith(parsed.pluSuffix) : false)
      );
      if (exact) {
        const skipWeight =
          Boolean(parsed.isWeightedBarcode) ||
          rawCode.includes('*') ||
          (!exact.isWeighed && exact.uqc !== 'KG');
        addItemToCart(exact, parsed.qty, skipWeight);
        if (parsed.isWeightedBarcode) {
          showToast(
            `Weighted sticker decoded: ${exact.name} (${parsed.qty} ${exact.uqc})`,
            'success'
          );
        }
        return true;
      }

      const nameMatches = workspace.items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q)
      );
      if (nameMatches.length === 1) {
        const match = nameMatches[0];
        const skipWeight = rawCode.includes('*') || (!match.isWeighed && match.uqc !== 'KG');
        addItemToCart(match, parsed.qty, skipWeight);
        return true;
      }

      playCheckoutBeep('error', soundEnabled);
      showToast(`No supermarket item matched "${rawCode}".`, 'warning');
      return false;
    },
    [
      walletAddonEnabled,
      customers,
      workspace.items,
      weightedPrefix,
      addItemToCart,
      showToast,
      soundEnabled,
    ]
  );

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeQuery.trim()) return;
    if (processScannedCode(barcodeQuery)) {
      setBarcodeQuery('');
      barcodeInputRef.current?.focus();
    }
  };

  // Live Camera Barcode Scanner lifecycle
  useEffect(() => {
    if (!cameraOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return;
    }

    let cancelled = false;
    let rafId = 0;

    async function startCamera() {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraStatus(
          'Camera hardware unavailable in this browser. Use the 1-tap sample scanner buttons below to test.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const DetectorCtor = (
          window as unknown as {
            BarcodeDetector?: new (opts?: { formats: string[] }) => {
              detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
            };
          }
        ).BarcodeDetector;

        if (!DetectorCtor) {
          setCameraStatus(
            'Camera active · Browser BarcodeDetector API not supported here—use USB gun or sample triggers below.'
          );
          return;
        }

        const detector = new DetectorCtor({
          formats: ['ean_13', 'ean_8', 'upc_a', 'code_128', 'qr_code'],
        });
        setCameraStatus('Live camera scanner active · Hold EAN-13 or weighted sticker in frame.');

        const scanLoop = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results && results.length > 0 && results[0].rawValue) {
              const code = results[0].rawValue;
              const now = Date.now();
              if (
                lastCameraScanRef.current.code !== code ||
                now - lastCameraScanRef.current.ts > 1200
              ) {
                lastCameraScanRef.current = { code, ts: now };
                processScannedCode(code);
              }
            }
          } catch {
            // Ignore transient decode frame errors
          }
          rafId = requestAnimationFrame(() => {
            void scanLoop();
          });
        };
        rafId = requestAnimationFrame(() => {
          void scanLoop();
        });
      } catch {
        setCameraStatus(
          'Camera permission denied or no webcam found. Use 1-tap sample scanner triggers below.'
        );
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [cameraOpen, processScannedCode]);

  const updateCartQty = (itemId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.item.id !== itemId) return line;
          const step = line.item.isWeighed || line.item.uqc === 'KG' ? 0.25 : 1;
          const nextQty = round3(line.qty + delta * step);
          if (nextQty <= 0) return null;
          const available = itemStockMap.get(itemId)?.totalQty ?? 9999;
          if (!workspace.controlRoom.allowNegativeStock && nextQty > available) {
            showToast(`Max available stock reached for ${line.item.name}.`, 'warning');
            return line;
          }
          return { ...line, qty: nextQty };
        })
        .filter((l): l is RawCartLine => l !== null)
    );
    setPayments((prev) => (prev.length === 1 ? [{ ...prev[0], amount: 0 }] : prev));
  };

  const handleHoldCart = useCallback(() => {
    if (cart.length === 0) {
      showToast('Add items to the cart before parking a bill.', 'warning');
      return;
    }
    const newHeld: HeldCart = {
      id: `HOLD-${Date.now().toString().slice(-4)}`,
      label: `Shopper #${heldCarts.length + 1}`,
      customerId: selectedCustomerId,
      customerName: selectedCustomer?.name || 'Walk-in Shopper',
      heldAt: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
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
    setHeldCarts((prev) => [newHeld, ...prev]);
    setCart([]);
    setRedeemPoints(0);
    setAppliedCoupon(null);
    setCouponInput('');
    setPayments([{ mode: 'Cash', amount: 0, reference: '' }]);
    showToast(`Parked ${newHeld.label} (${newHeld.itemCount} items). Ready for next customer.`, 'info');
    barcodeInputRef.current?.focus();
  }, [cart, heldCarts.length, selectedCustomerId, selectedCustomer, calculatedBill.grandTotal, showToast]);

  const handleResumeHeldCart = (heldId: string) => {
    const target = heldCarts.find((h) => h.id === heldId);
    if (!target) return;
    const restoredLines: RawCartLine[] = [];
    for (const ln of target.lines) {
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
    setSelectedCustomerId(target.customerId);
    setHeldCarts((prev) => prev.filter((h) => h.id !== heldId));
    setPayments([{ mode: 'Cash', amount: 0, reference: '' }]);
    showToast(`Resumed ${target.label} into active lane.`, 'success');
    barcodeInputRef.current?.focus();
  };

  const handleApplyCouponCode = (rawCode: string) => {
    const preCouponTotal = round2(calculatedBill.taxableTotal + calculatedBill.totalTax);
    const evalRes = evaluatePromoCoupon({
      code: rawCode,
      coupons: workspace.promoCoupons,
      billTotalBeforeCoupon: preCouponTotal,
      asOfDate: today,
    });
    if (!evalRes.valid || !evalRes.coupon) {
      setCouponError(evalRes.error || 'Invalid coupon.');
      playCheckoutBeep('error', soundEnabled);
      return;
    }
    setAppliedCoupon(evalRes.coupon);
    setCouponInput(evalRes.coupon.code);
    setCouponError(null);
    playCheckoutBeep('scan', soundEnabled);
    showToast(
      `Coupon ${evalRes.coupon.code} applied (-${formatInr(evalRes.discountAmount)})!`,
      'success'
    );
  };

  const setQuickPaymentMode = (mode: PaymentMode) => {
    setCheckoutError(null);
    setPayments([{ mode, amount: calculatedBill.grandTotal, reference: '' }]);
  };

  const handleFastCashTender = (amount: number, additive = false) => {
    setCheckoutError(null);
    setPayments((prev) => {
      const cashIdx = prev.findIndex((p) => p.mode === 'Cash');
      if (cashIdx >= 0) {
        const next = [...prev];
        const currentAmt = next[cashIdx].amount === 0 ? 0 : next[cashIdx].amount;
        next[cashIdx] = {
          ...next[cashIdx],
          amount: additive ? round2(currentAmt + amount) : amount,
        };
        return next;
      }
      return [{ mode: 'Cash', amount, reference: '' }];
    });
  };

  const addSplitPaymentRow = () => {
    const remaining = Math.max(
      0,
      round2(
        calculatedBill.grandTotal -
          effectivePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
      )
    );
    setPayments([
      ...effectivePayments,
      { mode: 'UPI', amount: remaining, reference: '' },
    ]);
  };

  const handleCompleteCheckout = useCallback(async () => {
    if (cart.length === 0) {
      setCheckoutError('Scan or add at least one item before saving the bill.');
      return;
    }
    if (!paymentValidation.valid) {
      setCheckoutError(paymentValidation.error || 'Verify payment split amounts.');
      return;
    }
    if (!udhaarCheck.allowed) {
      setCheckoutError(udhaarCheck.error || 'Customer Udhaar limit exceeded.');
      playCheckoutBeep('error', soundEnabled);
      return;
    }
    if (walletAddonEnabled && walletSplitAmount > 0 && !walletCheck.allowed) {
      setCheckoutError(walletCheck.error || 'Insufficient Family Prepaid Wallet balance.');
      playCheckoutBeep('error', soundEnabled);
      return;
    }
    if (activeCounterObj?.status === 'CLOSED') {
      setCheckoutError(
        `${activeCounterObj.counterCode} is CLOSED. Reopen lane in Shifts & Cash or pick an open lane.`
      );
      return;
    }

    const invoiceNo = `POS-26-${String(Math.floor(1000 + Math.random() * 8999))}`;
    const irn = workspace.controlRoom.eInvoiceAutoIrn
      ? generateDeterministicIrn(activeCompany?.gstin || '07AABCF9182D1Z4', invoiceNo, today)
      : '';

    const normalizedPayments = effectivePayments
      .filter((p) => p.amount > 0)
      .map((p) => ({
        mode: p.mode,
        amount: round2(p.amount),
        reference: p.reference || '',
      }));

    const billStatus = creditSplitAmount > 0 && creditSplitAmount >= calculatedBill.grandTotal
      ? 'Unpaid'
      : creditSplitAmount > 0
        ? 'Partial'
        : 'Paid';

    const checkoutSeconds = cartStartMsRef.current
      ? Math.max(3, Math.round((Date.now() - cartStartMsRef.current) / 1000))
      : 18;
    const operatorName = activeCounterObj?.operatorName || 'Store Cashier';
    const itemCount = calculatedBill.lines.length;

    const invoicePayload: Record<string, unknown> = {
      invoiceNo,
      docType: 'POS_BILL',
      counterCode: selectedCounter,
      ledgerId: selectedCustomer?.id ?? null,
      customerName: selectedCustomer?.name || 'Walk-in Retail Customer',
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
      couponCode: calculatedBill.couponCode,
      couponDiscount: calculatedBill.couponDiscountAmount,
      operatorName,
      checkoutSeconds,
      itemCount,
      paymentModeSummary: paymentValidation.summaryLabel,
      payments: normalizedPayments,
      items: calculatedBill.lines,
      irn,
      ewayBillNo: '',
      status: billStatus,
      ...(deliveryAddonEnabled && assignDelivery
        ? {
            assignDelivery: {
              deliveryAddress:
                deliveryAddress.trim() ||
                selectedCustomer?.address ||
                'Local Neighborhood Delivery',
              deliverySlot,
              riderName: deliveryRider,
              paymentType: deliveryPaymentType,
              notes: `Linked to ${invoiceNo}`,
            },
          }
        : {}),
    };

    // Offline-Ready PWA Queue Branch
    if (offlineAddonEnabled && !isOnline) {
      queueOfflineInvoice(invoicePayload);
      playCheckoutBeep('cash', soundEnabled);
      cartStartMsRef.current = null;
      setCart([]);
      setRedeemPoints(0);
      setAppliedCoupon(null);
      setCouponInput('');
      setAssignDelivery(false);
      setPayments([{ mode: 'Cash', amount: 0, reference: '' }]);
      setCheckoutError(null);
      return;
    }

    const result = await dispatchActionWithResult(
      'CREATE_INVOICE',
      invoicePayload,
      `Bill ${invoiceNo} saved (${formatInr(calculatedBill.grandTotal)})`
    );

    if (result.ok) {
      playCheckoutBeep('cash', soundEnabled);
      const paidLines = calculatedBill.lines.map((ln) => ({
        name: ln.name,
        qty: ln.qty,
        uqc: ln.uqc,
        mrp: ln.mrp,
        rate: ln.rate,
        lineTotal: ln.lineTotal,
      }));
      broadcastCustomerDisplay({
        updatedAt: new Date().toISOString(),
        storeName: activeCompany?.name || 'FreshMart Superstore',
        branchName: activeCompany?.branchName || 'Main Flagship Store',
        counterCode: selectedCounter,
        customerName: selectedCustomer?.name || 'Walk-in Shopper',
        upiVpa: storeUpiVpa,
        lines: paidLines,
        subtotal: calculatedBill.subtotal,
        totalTax: calculatedBill.totalTax,
        couponCode: calculatedBill.couponCode,
        couponDiscount: calculatedBill.couponDiscountAmount,
        loyaltyDiscount: calculatedBill.loyaltyDiscountAmount,
        totalMrpSavings: calculatedBill.totalMrpSavings,
        grandTotal: calculatedBill.grandTotal,
        upiAmount: 0,
        status: 'PAID',
        lastInvoiceNo: invoiceNo,
      });

      void publishLiveDisplayToFirestore(
        workspace.activeCompanyId,
        {
          storeName: activeCompany?.name || 'FreshMart Superstore',
          branchName: activeCompany?.branchName || 'Main Flagship Store',
          upiVpa: storeUpiVpa,
          customerName: selectedCustomer?.name || 'Walk-in Shopper',
          counterCode: selectedCounter,
          status: 'PAID',
          subtotal: calculatedBill.subtotal,
          totalTax: calculatedBill.totalTax,
          couponDiscount: calculatedBill.couponDiscountAmount,
          loyaltyDiscount: calculatedBill.loyaltyDiscountAmount,
          totalMrpSavings: calculatedBill.totalMrpSavings,
          grandTotal: calculatedBill.grandTotal,
          upiAmount: 0,
          couponCode: calculatedBill.couponCode,
          lastInvoiceNo: invoiceNo,
          lines: paidLines,
        },
        workspace.controlRoom.enabledAddons
      );

      broadcastOpsEvent({
        eventType: deliveryAddonEnabled && assignDelivery ? 'DELIVERY_DISPATCH' : 'POS_CHECKOUT',
        title:
          deliveryAddonEnabled && assignDelivery
            ? `Home Delivery Assigned · ${invoiceNo}`
            : `Checkout Completed · ${invoiceNo}`,
        detail: `${selectedCustomer?.name || 'Walk-in'} · ${formatInr(calculatedBill.grandTotal)} · ${selectedCounter} (${checkoutSeconds}s)`,
        severity: 'info',
      });

      const created = result.data?.invoices.find((inv) => inv.invoiceNo === invoiceNo);
      cartStartMsRef.current = null;
      setCart([]);
      setRedeemPoints(0);
      setAppliedCoupon(null);
      setCouponInput('');
      setAssignDelivery(false);
      setPayments([{ mode: 'Cash', amount: 0, reference: '' }]);
      setCheckoutError(null);
      if (created) {
        router.push(`/admin/bills/${created.id}`);
      }
    }
  }, [
    cart.length,
    paymentValidation,
    udhaarCheck,
    walletAddonEnabled,
    walletSplitAmount,
    walletCheck,
    activeCounterObj,
    workspace.activeCompanyId,
    workspace.controlRoom.eInvoiceAutoIrn,
    workspace.controlRoom.enabledAddons,
    activeCompany,
    effectivePayments,
    creditSplitAmount,
    calculatedBill,
    deliveryAddonEnabled,
    assignDelivery,
    deliveryAddress,
    deliverySlot,
    deliveryRider,
    deliveryPaymentType,
    offlineAddonEnabled,
    isOnline,
    queueOfflineInvoice,
    dispatchActionWithResult,
    broadcastOpsEvent,
    selectedCounter,
    selectedCustomer,
    storeUpiVpa,
    soundEnabled,
    router,
  ]);

  // POS-specific hotkeys (F2 focus scanner, F4 hold cart, F8 Cash, F9 UPI, F12 Checkout)
  useEffect(() => {
    const onPosKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setPosMode('BILLING');
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleHoldCart();
      } else if (e.key === 'F8' && cart.length > 0) {
        e.preventDefault();
        setPayments([{ mode: 'Cash', amount: calculatedBill.grandTotal, reference: '' }]);
      } else if (e.key === 'F9' && cart.length > 0) {
        e.preventDefault();
        setPayments([{ mode: 'UPI', amount: calculatedBill.grandTotal, reference: '' }]);
      } else if (e.key === 'F12' && cart.length > 0) {
        e.preventDefault();
        void handleCompleteCheckout();
      }
    };
    window.addEventListener('keydown', onPosKey);
    return () => window.removeEventListener('keydown', onPosKey);
  }, [cart.length, calculatedBill.grandTotal, handleHoldCart, handleCompleteCheckout]);

  // Return / Exchange helpers
  const returnableInvoices = useMemo(() => {
    const q = returnSearch.trim().toLowerCase();
    return workspace.invoices
      .filter((inv) => inv.docType === 'POS_BILL' || inv.docType === 'GST_INVOICE')
      .filter(
        (inv) =>
          !q ||
          inv.invoiceNo.toLowerCase().includes(q) ||
          inv.customerName.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [workspace.invoices, returnSearch]);

  const handleSelectReturnInvoice = (inv: InvoiceRecord) => {
    setSelectedReturnInvoice(inv);
    const initialMap: Record<string, number> = {};
    inv.items.forEach((ln, idx) => {
      initialMap[`${ln.itemId}-${idx}`] = 0;
    });
    setReturnQtyMap(initialMap);
  };

  const handlePostCreditNoteReturn = async (resumeExchange: boolean) => {
    if (!selectedReturnInvoice) return;
    const returnLines = selectedReturnInvoice.items
      .map((ln, idx) => {
        const rQty = round3(returnQtyMap[`${ln.itemId}-${idx}`] || 0);
        if (rQty <= 0) return null;
        const gross = round2(ln.rate * rQty);
        const taxAmt = round2((gross * ln.taxSlab) / 100);
        return {
          ...ln,
          qty: rQty,
          freeQty: 0,
          discountAmount: 0,
          taxableValue: gross,
          taxAmount: taxAmt,
          lineTotal: round2(gross + taxAmt),
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    if (returnLines.length === 0) {
      showToast('Select quantity greater than 0 on at least one item to return.', 'warning');
      return;
    }

    const subtotal = round2(returnLines.reduce((s, l) => s + l.taxableValue, 0));
    const totalTax = round2(returnLines.reduce((s, l) => s + l.taxAmount, 0));
    const grandTotal = Math.round(subtotal + totalTax);
    const cnNo = `CN-26-${String(Math.floor(1000 + Math.random() * 8999))}`;

    const res = await dispatchActionWithResult(
      'CREATE_INVOICE',
      {
        invoiceNo: cnNo,
        docType: 'CREDIT_NOTE',
        counterCode: selectedCounter,
        ledgerId: selectedReturnInvoice.ledgerId,
        customerName: selectedReturnInvoice.customerName,
        customerPhone: selectedReturnInvoice.customerPhone,
        customerGstin: selectedReturnInvoice.customerGstin,
        invoiceDate: today,
        subtotal,
        discountAmount: 0,
        cgstAmount: round2(totalTax / 2),
        sgstAmount: round2(totalTax - round2(totalTax / 2)),
        igstAmount: 0,
        roundOff: round2(grandTotal - (subtotal + totalTax)),
        grandTotal,
        loyaltyEarned: 0,
        loyaltyRedeemed: 0,
        paymentModeSummary: `Credit Note (${returnReason})`,
        payments: [{ mode: 'Cash', amount: grandTotal, reference: selectedReturnInvoice.invoiceNo }],
        items: returnLines,
        irn: '',
        ewayBillNo: '',
        status: 'Returned',
      },
      `Credit Note ${cnNo} posted (${formatInr(grandTotal)}) & stock restocked`
    );

    if (res.ok) {
      playCheckoutBeep('cash', soundEnabled);
      setSelectedReturnInvoice(null);
      setReturnQtyMap({});
      if (resumeExchange) {
        setPosMode('BILLING');
        barcodeInputRef.current?.focus();
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Compact Supermarket Terminal Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            <h1 className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Supermarket Checkout Terminal
            </h1>
          </div>

          <div
            role="tablist"
            aria-label="POS Terminal Mode"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-900 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={posMode === 'BILLING'}
              onClick={() => setPosMode('BILLING')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                posMode === 'BILLING'
                  ? 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Fast Billing
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={posMode === 'RETURN'}
              onClick={() => setPosMode('RETURN')}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                posMode === 'RETURN'
                  ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <RotateCcw className="h-3 w-3" />
              <span>Return / Exchange</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Active POS Checkout Lane"
            value={selectedCounter}
            onChange={(e) => setSelectedCounter(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200"
          >
            {workspace.posCounters.map((c) => (
              <option key={c.id} value={c.counterCode}>
                {c.counterCode} · {c.operatorName} ({c.status})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? 'Mute scanner beep' : 'Enable scanner beep'}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline">{soundEnabled ? 'Beep On' : 'Muted'}</span>
          </button>

          <Link
            href="/admin/pos/customer-display"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-emerald-500 whitespace-nowrap"
          >
            <Monitor className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Customer Screen</span>
          </Link>

          <Link
            href="/admin/barcodes"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-emerald-500 whitespace-nowrap"
          >
            <Barcode className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span className="hidden md:inline">Labels</span>
          </Link>

          <button
            type="button"
            onClick={handleHoldCart}
            disabled={cart.length === 0 || posMode !== 'BILLING'}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-100 disabled:opacity-40 whitespace-nowrap cursor-pointer"
          >
            <PauseCircle className="h-3.5 w-3.5" />
            <span>Hold (F4)</span>
          </button>
        </div>
      </div>

      {/* Inline Return & Exchange Workspace */}
      {posMode === 'RETURN' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recall Supermarket Bill for Return / Exchange
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {returnableInvoices.length} bills
              </span>
            </div>
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={returnSearch}
                onChange={(e) => setReturnSearch(e.target.value)}
                placeholder="Scan receipt no. (e.g. POS-26-0412) or customer name..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {returnableInvoices.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => handleSelectReturnInvoice(inv)}
                  className={`w-full text-left py-2.5 px-2.5 rounded-lg transition-colors cursor-pointer ${
                    selectedReturnInvoice?.id === inv.id
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <span className="font-mono">{inv.invoiceNo}</span>
                    <span className="font-mono tabular-nums">{formatInr(inv.grandTotal)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="truncate">{inv.customerName}</span>
                    <span>
                      {inv.invoiceDate} · {inv.items.length} items
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4">
            {!selectedReturnInvoice ? (
              <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                Select a bill from the left to pick items for refund or exchange. Returned quantities restock automatically.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                      Return Items from {selectedReturnInvoice.invoiceNo}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedReturnInvoice.customerName} · {selectedReturnInvoice.invoiceDate}
                    </p>
                  </div>
                  <input
                    type="text"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Return reason"
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 w-64"
                  />
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedReturnInvoice.items.map((ln, idx) => {
                    const key = `${ln.itemId}-${idx}`;
                    const currentRet = returnQtyMap[key] || 0;
                    const step = ln.uqc === 'KG' ? 0.25 : 1;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-3 py-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {ln.name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            Billed: {ln.qty} {ln.uqc} × ₹{ln.rate} · GST {ln.taxSlab}%
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setReturnQtyMap((m) => ({
                                ...m,
                                [key]: Math.max(0, round3((m[key] || 0) - step)),
                              }))
                            }
                            className="rounded border border-slate-300 dark:border-slate-700 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-16 text-center font-mono font-semibold tabular-nums">
                            {currentRet} {ln.uqc}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setReturnQtyMap((m) => ({
                                ...m,
                                [key]: Math.min(ln.qty, round3((m[key] || 0) + step)),
                              }))
                            }
                            className="rounded border border-slate-300 dark:border-slate-700 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => void handlePostCreditNoteReturn(false)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Post Refund Credit Note
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePostCreditNoteReturn(true)}
                    className="rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                  >
                    Post Credit Note &amp; Start Exchange Bill
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : (
        /* Main 58/42 Fast Supermarket Checkout Split */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* LEFT 7 COLS (58%): Barcode + Camera Deck + Loose Weight + Touch Catalog */}
          <section className="xl:col-span-7 space-y-3">
            {/* Auto-Focus Barcode / Weighted EAN-13 / Camera Bar */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-3.5 space-y-3">
              <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <ScanBarcode className="h-4 w-4 text-emerald-700 dark:text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={barcodeQuery}
                    onChange={(e) => setBarcodeQuery(e.target.value)}
                    placeholder={`Scan EAN-13, weighted (${weightedPrefix}0101012500), or qty*code (3*8901262010016)...`}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-9 pr-3 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:font-sans placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-950 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setCameraOpen((v) => !v)}
                  title="Toggle Live Camera Barcode Scanner"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    cameraOpen
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {cameraOpen ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                  <span className="hidden sm:inline">{cameraOpen ? 'Stop Cam' : 'Camera'}</span>
                </button>
                {scaleAddonEnabled && (
                  <button
                    type="button"
                    onClick={() => setScaleOpen((v) => !v)}
                    title="Toggle Live Digital Weighing Scale Bridge"
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                      scaleOpen || scaleConnected
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Scale className="h-4 w-4" />
                    <span className="hidden sm:inline font-mono tabular-nums">
                      {scaleNetKg > 0 ? `${scaleNetKg.toFixed(3)} kg` : 'Scale'}
                    </span>
                  </button>
                )}
              </form>

              {/* Inline Collapsible Live Digital Weighing Scale Bridge (Web Serial + Test Scale Bench) */}
              {scaleAddonEnabled && scaleOpen && (
                <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-white space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-md border border-emerald-500/40 bg-slate-900 px-3 py-1.5 font-mono text-xl font-bold text-emerald-400 tabular-nums">
                        {scaleNetKg.toFixed(3)} <span className="text-xs font-medium text-emerald-300">KG</span>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-100">
                          Digital Scale Bridge · {scaleStable ? 'STABLE' : 'MOTION'}
                        </div>
                        <div className="text-[11px] text-slate-400">{scaleStatusMsg}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {scaleConnected ? (
                        <button
                          type="button"
                          onClick={() => void handleDisconnectScale()}
                          className="rounded border border-red-500/50 bg-red-950/60 px-2.5 py-1 text-[11px] font-semibold text-red-200 hover:bg-red-900/60 cursor-pointer"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleConnectSerialScale()}
                          className="inline-flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-900/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-800/60 cursor-pointer"
                        >
                          <Plug className="h-3 w-3" />
                          <span>Connect USB/RS-232</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setScaleTareKg(scaleRawKg);
                          setScaleStatusMsg(`Tare offset set at ${scaleRawKg.toFixed(3)} kg.`);
                        }}
                        className="rounded border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20 cursor-pointer"
                      >
                        Tare
                      </button>
                      <button
                        type="button"
                        onClick={() => setScaleOpen(false)}
                        className="text-slate-400 hover:text-white p-1 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-400">Test Scale Bench:</span>
                    {[0.35, 0.75, 1.25, 2.5].map((wt) => (
                      <button
                        key={wt}
                        type="button"
                        onClick={() => applySimulatedScaleWeight(wt)}
                        className="rounded border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-white hover:bg-emerald-700 cursor-pointer"
                      >
                        {wt.toFixed(3)} kg
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setScaleRawKg(0);
                        setScaleTareKg(0);
                      }}
                      className="rounded border border-white/10 px-2 py-1 font-mono text-slate-300 hover:text-white cursor-pointer"
                    >
                      Zero
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Collapsible Camera Barcode Scanner Deck (Zero Modals) */}
              {cameraOpen && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-slate-950 p-3 text-white space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-emerald-300">{cameraStatus}</span>
                    <button
                      type="button"
                      onClick={() => setCameraOpen(false)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="relative h-40 w-full overflow-hidden rounded-md bg-slate-900 flex items-center justify-center">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-x-10 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-400/90" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-slate-400">Quick Scan Test:</span>
                    <button
                      type="button"
                      onClick={() => processScannedCode('8901262010016')}
                      className="rounded border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-white hover:bg-white/20 cursor-pointer"
                    >
                      Amul Butter (8901262010016)
                    </button>
                    <button
                      type="button"
                      onClick={() => processScannedCode(`${weightedPrefix}0101012500`)}
                      className="rounded border border-emerald-500/40 bg-emerald-900/50 px-2.5 py-1 font-mono text-emerald-200 hover:bg-emerald-800/60 cursor-pointer"
                    >
                      Weighted 1.25kg Tomatoes ({weightedPrefix}0101012500)
                    </button>
                  </div>
                </div>
              )}

              {/* 1-Tap Supermarket Quick Essentials Strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0 pr-1">
                  Quick Add:
                </span>
                {quickEssentialItems.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => addItemToCart(it, 1, false)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span className="truncate max-w-[130px]">{it.name.split('(')[0].trim()}</span>
                    <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 tabular-nums">
                      ₹{it.saleRate}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Inline Loose-Weight KG / GM Selector Bar */}
            {weighingItem && (
              <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-950/40 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                    <Scale className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    <span>
                      Weighing Scale Entry: {weighingItem.name} (₹{weighingItem.saleRate}/kg)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWeighingItem(null)}
                    className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {scaleAddonEnabled && scaleNetKg > 0 && (
                    <button
                      type="button"
                      onClick={() => addItemToCart(weighingItem, scaleNetKg, true)}
                      className="rounded-lg bg-slate-900 dark:bg-emerald-600 px-3 py-1.5 text-xs font-semibold font-mono text-white hover:bg-slate-800 cursor-pointer"
                    >
                      Use Scale Weight ({scaleNetKg.toFixed(3)} kg)
                    </button>
                  )}
                  {QUICK_WEIGHT_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => addItemToCart(weighingItem, preset.kg, true)}
                      className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold font-mono text-emerald-900 dark:text-emerald-200 hover:bg-emerald-700 hover:text-white cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <input
                      type="number"
                      step="0.05"
                      min="0.05"
                      value={customKgInput}
                      onChange={(e) => setCustomKgInput(e.target.value)}
                      className="w-20 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                    />
                    <span className="text-xs font-mono text-emerald-900 dark:text-emerald-200">kg</span>
                    <button
                      type="button"
                      onClick={() => {
                        const kg = Number(customKgInput);
                        if (Number.isFinite(kg) && kg > 0) {
                          addItemToCart(weighingItem, kg, true);
                        }
                      }}
                      className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                    >
                      Add Weight
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Held / Parked Carts Strip */}
            {heldCarts.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  Parked Carts ({heldCarts.length}):
                </span>
                {heldCarts.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => handleResumeHeldCart(h.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-medium text-slate-900 dark:text-slate-100 hover:border-amber-500 cursor-pointer"
                  >
                    <PlayCircle className="h-3.5 w-3.5 text-amber-600" />
                    <span>{h.label}</span>
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                      ({h.itemCount} · {formatInr(h.estimatedTotal)})
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Category Filter Tabs + High-Speed Touch Product Grid */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      categoryFilter === cat
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[540px] overflow-y-auto pr-0.5">
                {filteredItems.map((item) => {
                  const stock = itemStockMap.get(item.id)?.totalQty ?? 0;
                  const outOfStock = stock <= 0;
                  const mrpSave = Math.max(0, round2(item.mrp - item.saleRate));
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItemToCart(item, 1, false)}
                      className={`text-left rounded-lg border p-3 transition-colors flex flex-col justify-between gap-2 cursor-pointer ${
                        outOfStock
                          ? 'border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 opacity-75'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 hover:border-emerald-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          <span className="truncate">{item.barcode}</span>
                          {item.isWeighed && (
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                              KG
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                          {item.name}
                        </div>
                      </div>
                      <div className="flex items-end justify-between gap-1 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                        <div>
                          <div className="font-mono text-sm font-bold text-slate-950 dark:text-white tabular-nums">
                            ₹{item.saleRate}
                            <span className="text-[10px] font-normal text-slate-500">
                              /{item.uqc}
                            </span>
                          </div>
                          {mrpSave > 0 && (
                            <div className="text-[10px] font-mono text-slate-400 line-through tabular-nums">
                              MRP ₹{item.mrp}
                            </div>
                          )}
                        </div>
                        <div
                          className={`text-[10px] font-mono tabular-nums ${
                            outOfStock
                              ? 'text-red-600 dark:text-red-400 font-semibold'
                              : stock <= item.reorderLevel
                                ? 'text-amber-600 dark:text-amber-400 font-medium'
                                : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {outOfStock
                            ? 'Out'
                            : formatQtyDisplay(stock, item.uqc, item.isWeighed)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* RIGHT 5 COLS (42%): Live Bill Tape + Coupons + Cash Denomination Pad + Dynamic UPI QR */}
          <section className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col overflow-hidden">
            {/* Customer Selector + Udhaar Status */}
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="pos-customer-select"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Shopper / Member Account
                </label>
                {selectedCustomer && (
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {selectedCustomer.loyaltyPoints} pts
                    {walletAddonEnabled && (selectedCustomer.walletBalance || 0) > 0
                      ? ` · Wallet ₹${(selectedCustomer.walletBalance || 0).toLocaleString('en-IN')}`
                      : ` · Limit ₹${(selectedCustomer.creditLimit || 0).toLocaleString('en-IN')}`}
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
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {walletAddonEnabled && c.membershipTier && c.membershipTier !== 'NONE'
                      ? ` [${c.membershipTier.replace('_', ' ')}]`
                      : ''}
                    {c.phone ? ` (${c.phone})` : ''}
                  </option>
                ))}
              </select>
              {walletAddonEnabled &&
                selectedCustomer &&
                (selectedCustomer.membershipCardNo ||
                  (selectedCustomer.walletBalance || 0) > 0) && (
                  <div className="flex items-center justify-between text-[11px] font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-md px-2.5 py-1">
                    <span>
                      {(selectedCustomer.membershipTier || 'MEMBER').replace('_', ' ')}
                      {selectedCustomer.membershipCardNo
                        ? ` · ${selectedCustomer.membershipCardNo}`
                        : ''}
                    </span>
                    <span className="font-semibold tabular-nums">
                      Family Wallet: {formatInr(selectedCustomer.walletBalance || 0)}
                    </span>
                  </div>
                )}
            </div>

            {/* Live Bill Line Items */}
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 px-3.5">
              {calculatedBill.lines.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                  Basket is empty. Scan a barcode, use camera, or tap any product tile.
                </div>
              ) : (
                calculatedBill.lines.map((ln) => {
                  const isKg = ln.uqc === 'KG';
                  return (
                    <div
                      key={ln.itemId}
                      className="py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {ln.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          ₹{ln.rate} × {ln.qty} {ln.uqc}
                          {ln.freeQty > 0 ? ` (+${ln.freeQty} Free)` : ''}
                          {ln.taxSlab > 0 ? ` · ${ln.taxSlab}% GST` : ' · 0% GST'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartQty(ln.itemId, -1)}
                          aria-label={`Decrease ${ln.name}`}
                          className="rounded border border-slate-200 dark:border-slate-700 p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-12 text-center font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          {isKg ? `${ln.qty}` : ln.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(ln.itemId, 1)}
                          aria-label={`Increase ${ln.name}`}
                          className="rounded border border-slate-200 dark:border-slate-700 p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <div className="w-16 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          ₹{ln.lineTotal.toFixed(0)}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setCart((prev) => prev.filter((c) => c.item.id !== ln.itemId))
                          }
                          aria-label={`Remove ${ln.name}`}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Promo Coupon & Loyalty Section */}
            <div className="px-3.5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase());
                    setCouponError(null);
                  }}
                  placeholder="Promo coupon (FRESH50, WEEKEND10)"
                  className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                />
                {appliedCoupon ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedCoupon(null);
                      setCouponInput('');
                    }}
                    className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-red-600 cursor-pointer"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleApplyCouponCode(couponInput)}
                    className="rounded-md bg-slate-900 dark:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                  >
                    Apply
                  </button>
                )}
              </div>

              {activeCoupons.length > 0 && !appliedCoupon && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeCoupons.slice(0, 3).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleApplyCouponCode(c.code)}
                      className="rounded border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 cursor-pointer"
                    >
                      {c.code} (Min ₹{c.minBillAmount})
                    </button>
                  ))}
                </div>
              )}

              {couponError && (
                <div className="text-[11px] font-medium text-red-600 dark:text-red-400">
                  {couponError}
                </div>
              )}

              {workspace.controlRoom.enableLoyaltyPoints &&
                selectedCustomer &&
                selectedCustomer.loyaltyPoints > 0 && (
                  <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-slate-200/70 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400">
                      Redeem Points (Avail: {selectedCustomer.loyaltyPoints})
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={selectedCustomer.loyaltyPoints}
                      value={redeemPoints}
                      onChange={(e) => setRedeemPoints(Math.max(0, Number(e.target.value)))}
                      className="w-20 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-right font-mono text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}
            </div>

            {/* Bill Totals & Live MRP Savings Banner */}
            <div className="px-3.5 py-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal · GST ({isInterState ? 'IGST' : 'CGST+SGST'})</span>
                <span className="font-mono tabular-nums">
                  {formatInr(calculatedBill.subtotal)} · +{formatInr(calculatedBill.totalTax)}
                </span>
              </div>
              {calculatedBill.couponDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                  <span>Coupon ({calculatedBill.couponCode})</span>
                  <span className="font-mono tabular-nums">
                    -{formatInr(calculatedBill.couponDiscountAmount)}
                  </span>
                </div>
              )}
              {calculatedBill.loyaltyDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                  <span>Loyalty Redeemed</span>
                  <span className="font-mono tabular-nums">
                    -{formatInr(calculatedBill.loyaltyDiscountAmount)}
                  </span>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Grand Total
                </span>
                <span className="font-mono text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
                  {formatInr(calculatedBill.grandTotal)}
                </span>
              </div>
              {calculatedBill.totalMrpSavings > 0 && (
                <div className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-mono tabular-nums">
                    Customer Saves {formatInr(calculatedBill.totalMrpSavings)} on MRP!
                  </span>
                </div>
              )}
            </div>

            {/* Multi-Mode Payment + Fast Cash Notes + Dynamic UPI QR */}
            <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 space-y-3">
              {/* Quick Mode Selector */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {(['Cash', 'UPI', 'Card', 'Credit', 'Wallet', 'PDC'] as PaymentMode[]).map(
                  (mode) => {
                    const isSelected =
                      effectivePayments.length === 1 && effectivePayments[0].mode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setQuickPaymentMode(mode)}
                        className={`rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-emerald-500'
                        }`}
                      >
                        {mode === 'Credit' ? 'Udhaar' : mode}
                      </button>
                    );
                  }
                )}
              </div>

              {/* Payment Split Rows */}
              <div className="space-y-1.5">
                {effectivePayments.map((split, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <select
                      value={split.mode}
                      onChange={(e) => {
                        const next = [...effectivePayments];
                        next[idx] = { ...next[idx], mode: e.target.value as PaymentMode };
                        setPayments(next);
                      }}
                      className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                      <option value="Credit">Credit (Udhaar)</option>
                      <option value="Wallet">Wallet</option>
                      <option value="PDC">PDC</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={split.amount}
                      onChange={(e) => {
                        const next = [...effectivePayments];
                        next[idx] = { ...next[idx], amount: Number(e.target.value) };
                        setPayments(next);
                      }}
                      className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-right font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums"
                    />
                    {effectivePayments.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPayments(effectivePayments.filter((_, i) => i !== idx))
                        }
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSplitPaymentRow}
                  className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  + Split Payment (e.g. Cash + UPI)
                </button>
              </div>

              {/* Fast Indian Cash Denomination Pad + Instant Change to Return */}
              {hasCashPayment && calculatedBill.grandTotal > 0 && (
                <div className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleFastCashTender(calculatedBill.grandTotal)}
                      className="rounded border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 cursor-pointer"
                    >
                      Exact
                    </button>
                    {INDIAN_CASH_NOTES.map((note) => (
                      <button
                        key={note}
                        type="button"
                        onClick={() => handleFastCashTender(note)}
                        className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:border-emerald-500 cursor-pointer"
                      >
                        ₹{note}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleFastCashTender(20, true)}
                      className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-600 dark:text-slate-300 hover:border-emerald-500 cursor-pointer"
                    >
                      +₹20
                    </button>
                  </div>
                  {paymentValidation.changeToReturn > 0 && (
                    <div className="flex items-center justify-between rounded-md bg-emerald-700 px-3 py-2 text-white">
                      <span className="text-xs font-medium">Change to Return</span>
                      <span className="font-mono text-lg font-bold tabular-nums">
                        {formatInr(paymentValidation.changeToReturn)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Inline Dynamic Scannable UPI QR Code */}
              {hasUpiPayment && calculatedBill.grandTotal > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      <QrCode className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Dynamic UPI QR</span>
                    </div>
                    <div className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatInr(upiSplitAmount || calculatedBill.grandTotal)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Mirrored live to Customer Display
                    </div>
                  </div>
                  <UpiQrCodeSvg
                    vpa={storeUpiVpa}
                    payeeName={activeCompany?.name || 'FreshMart Superstore'}
                    amount={upiSplitAmount || calculatedBill.grandTotal}
                    note={`POS ${selectedCounter}`}
                    size={96}
                  />
                </div>
              )}

              {/* Udhaar Credit Limit Notice */}
              {creditSplitAmount > 0 && (
                <div
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    udhaarCheck.allowed
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                      : 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200'
                  }`}
                >
                  {udhaarCheck.allowed
                    ? `Udhaar Approved · Available credit: ${formatInr(udhaarCheck.availableLimit)}`
                    : udhaarCheck.error}
                </div>
              )}

              {/* Family Prepaid Wallet Balance Notice */}
              {walletAddonEnabled && walletSplitAmount > 0 && (
                <div
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    walletCheck.allowed
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                      : 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200'
                  }`}
                >
                  {walletCheck.allowed
                    ? `Family Wallet Ready · Available: ${formatInr(walletCheck.availableBalance)}`
                    : walletCheck.error}
                </div>
              )}

              {/* Inline Collapsible Home Delivery Assignment Toggle */}
              {deliveryAddonEnabled && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-2.5 space-y-2">
                  <label className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                    <span className="inline-flex items-center gap-1.5">
                      <Bike className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                      <span>Assign Home Delivery Dispatch</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={assignDelivery}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAssignDelivery(checked);
                        if (checked && !deliveryAddress && selectedCustomer?.address) {
                          setDeliveryAddress(selectedCustomer.address);
                        }
                      }}
                      className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                    />
                  </label>
                  {assignDelivery && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                      <input
                        type="text"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder={selectedCustomer?.address || 'Flat / Street delivery address'}
                        className="sm:col-span-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      />
                      <select
                        value={deliverySlot}
                        onChange={(e) => setDeliverySlot(e.target.value)}
                        className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      >
                        <option value="Express (60 min)">Express (60 min)</option>
                        <option value="Evening (5–7 PM)">Evening (5–7 PM)</option>
                        <option value="Morning (9–11 AM)">Morning (9–11 AM)</option>
                      </select>
                      <select
                        value={deliveryRider}
                        onChange={(e) => setDeliveryRider(e.target.value)}
                        className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      >
                        <option value="Arjun Kumar">Rider: Arjun Kumar</option>
                        <option value="Ravi Shankar">Rider: Ravi Shankar</option>
                        <option value="Manoj V">Rider: Manoj V</option>
                        <option value="Unassigned">Unassigned</option>
                      </select>
                      <select
                        value={deliveryPaymentType}
                        onChange={(e) =>
                          setDeliveryPaymentType(e.target.value as DeliveryPaymentType)
                        }
                        className="sm:col-span-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      >
                        <option value="COD_UPI">COD — Pay via UPI at Doorstep</option>
                        <option value="COD_CASH">COD — Cash on Delivery</option>
                        <option value="PREPAID">Prepaid at Checkout Counter</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {checkoutError && (
                <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-3 py-2 text-xs font-medium text-red-800 dark:text-red-200">
                  {checkoutError}
                </div>
              )}

              {/* Primary Checkout Save & Print CTA */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCompleteCheckout()}
                  disabled={cart.length === 0}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 disabled:opacity-40 px-4 py-3 text-sm font-bold text-white cursor-pointer"
                >
                  {offlineAddonEnabled && !isOnline ? (
                    <WifiOff className="h-4 w-4" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  <span>
                    {offlineAddonEnabled && !isOnline
                      ? 'Queue Bill Offline (F12)'
                      : 'Save & Print Bill (F12)'}
                  </span>
                </button>
                <Link
                  href="/admin/sales"
                  title="Recent Bills History"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <History className="h-4 w-4" />
                </Link>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>F2 Scan · F4 Hold · F8 Cash · F9 UPI · F12 Print</span>
                <span className="inline-flex items-center gap-1">
                  <Wallet className="h-3 w-3" />
                  {selectedCounter}
                </span>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
