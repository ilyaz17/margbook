'use client';

import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { buildUpiPaymentUri, encodeCode128B } from '../lib/barcode-utils';

export function Code128BarcodeSvg({
  value,
  height = 44,
  showText = true,
  className = '',
}: {
  value: string;
  height?: number;
  showText?: boolean;
  className?: string;
}) {
  const encoded = useMemo(() => encodeCode128B(value || '000000'), [value]);

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <svg
        role="img"
        aria-label={`Barcode ${encoded.encodedText}`}
        viewBox={`0 0 ${encoded.totalWidth} ${height}`}
        preserveAspectRatio="none"
        className="w-full max-w-full bg-white rounded-sm"
        style={{ height: `${height}px` }}
      >
        <rect x="0" y="0" width={encoded.totalWidth} height={height} fill="#FFFFFF" />
        {encoded.bars.map((bar, idx) => (
          <rect
            key={`${bar.x}-${idx}`}
            x={bar.x}
            y={2}
            width={bar.width}
            height={height - 4}
            fill="#0F172A"
          />
        ))}
      </svg>
      {showText && (
        <span className="mt-0.5 font-mono text-[10px] tracking-[0.14em] text-slate-800 dark:text-slate-200 tabular-nums">
          {encoded.encodedText}
        </span>
      )}
    </div>
  );
}

export function UpiQrCodeSvg({
  vpa,
  payeeName,
  amount,
  note,
  txnRef,
  size = 152,
  className = '',
}: {
  vpa: string;
  payeeName: string;
  amount: number;
  note?: string;
  txnRef?: string;
  size?: number;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string>('');

  const upiUri = useMemo(
    () => buildUpiPaymentUri({ vpa, payeeName, amount, note, txnRef }),
    [vpa, payeeName, amount, note, txnRef]
  );

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size * 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [upiUri, size]);

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-slate-200 bg-white text-[11px] font-mono text-slate-400 ${className}`}
        style={{ width: size, height: size }}
      >
        Generating QR…
      </div>
    );
  }

  return (
    <div
      className={`inline-flex flex-col items-center rounded-lg border border-slate-200 bg-white p-2 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`UPI QR code for ${payeeName} amount ₹${amount.toFixed(2)}`}
        width={size}
        height={size}
        className="block rounded-sm"
        style={{ width: size, height: size }}
      />
      <div className="mt-1.5 text-center font-mono text-[10px] text-slate-600 tabular-nums">
        {vpa}
      </div>
    </div>
  );
}
