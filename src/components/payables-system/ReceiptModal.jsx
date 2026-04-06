import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import Logo from '../../assets/logo.png';
import {Printer, X } from 'lucide-react';

const Modal = ({ open, onClose, children }) => {
  const modalRef = useRef();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 modal-container">
      <div
        className="fixed inset-0 bg-black/50 modal-backdrop"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div
        ref={modalRef}
        className="bg-white rounded-md shadow-lg w-full max-w-3xl mx-auto z-10 overflow-hidden modal-dialog"
        role="dialog"
        aria-modal="true"
        tabIndex="-1"
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

const ReceiptLayout = ({ label, receiptData }) => {
  const {
    receiptNumber,
    studentName,
    date,
    course,
    yearLevel,
    description,
    amount,
    price,
    previousPaid,
    totalPaid,
    balance,
    mode,
    reference,
    receivedBy,
  } = receiptData;

  const toNumber = (v) => {
    const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const formatPhp = (value) => {
    const n = toNumber(value);
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  };

  const priceNum = toNumber(price);
  const paymentAmountNum = toNumber(amount);
  const previousPaidNum = toNumber(previousPaid);
  const totalPaidNum = typeof totalPaid !== 'undefined' && totalPaid !== null
    ? toNumber(totalPaid)
    : previousPaidNum + paymentAmountNum;
  const previousBalanceNum = Math.max(0, priceNum - previousPaidNum);
  const updatedBalanceNum = typeof balance !== 'undefined' && balance !== null
    ? Math.max(0, toNumber(balance))
    : Math.max(0, priceNum - totalPaidNum);

  const modeNormalized = String(mode || '').trim().toLowerCase();
  const isGCash = modeNormalized === 'gcash';
  const isBankTransfer = modeNormalized === 'bank transfer' || modeNormalized === 'bank' || modeNormalized === 'bank_transfer';
  const showReference = isGCash || isBankTransfer;

  return (
    <div className="p-3 border border-gray-200 bg-white text-xs relative receipt-copy">
      {/* Centered Watermark Logo (use <img> so it prints reliably) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        <img
          src={Logo}
          alt=""
          className="opacity-10"
          style={{ width: '40%', height: 'auto' }}
        />
      </div>

      {/* Receipt Header */}
      <div className="flex justify-between items-start mb-2 relative z-10">
        <div className="text-xs font-semibold text-gray-500">{label}</div>
        <div className="text-center">
          <h2 className="text-sm font-bold text-blue-800">COLLEGE OF COMPUTER STUDIES</h2>
          <p className="text-[10px] text-gray-500">OFFICIAL RECEIPT</p>
        </div>
        <div className="text-xs text-gray-700">
          Receipt No. <span className="font-bold">{receiptNumber}</span>
        </div>
      </div>

      {/* Student Info */}
      <div className="grid grid-cols-1 sm:grid-cols-5  mb-2 relative z-10">
        <div className="sm:col-span-2 p-1 border flex gap-1 border-gray-200 rounded-l">
          <p className="text-[10px] font-semibold text-gray-500">NAME</p>
          <p className="text-[10px]">{studentName}</p>
        </div>
        <div className="sm:col-span-2 p-1 border flex gap-1 border-gray-200 rounded-l">
          <p className="text-[10px] font-semibold text-gray-500">COURSE-YR & SECTION</p>
          <p className="text-[10px]">{course || 'BSCS'} {yearLevel || ''}</p>
        </div>
        <div className="p-1 flex gap-1 border border-gray-200 rounded-r">
          <p className="text-[10px] font-semibold text-gray-500">DATE</p>
          <p className="text-[10px]">{date}</p>
        </div>
      </div>

      {/* Payment Details */}
      <div className="mb-2 relative z-10">
        <p className="text-[10px] font-semibold text-gray-500 mb-1">PAYMENT DETAILS</p>
        <div className="border border-gray-200 rounded overflow-hidden">
          <div className="grid grid-cols-2">
            <div className="p-1 border-b border-gray-200 bg-gray-50">
              <p className="text-[10px] font-semibold text-gray-500">DESCRIPTION</p>
              <p className="text-[10px]">{description}</p>
            </div>
            <div className="p-1 border-b border-gray-200 bg-gray-50">
              <p className="text-[10px] font-semibold text-gray-500">PRICE</p>
              <p className="text-[10px] font-semibold">{formatPhp(priceNum)}</p>
            </div>

            <div className="p-1 border-b border-gray-200">
              <p className="text-[10px] font-semibold text-gray-500">AMOUNT PAID</p>
              <p className="text-[10px] font-semibold">{formatPhp(totalPaidNum)}</p>
            </div>
            <div className="p-1 border-b border-gray-200">
              <p className="text-[10px] font-semibold text-gray-500">PAYMENT DATE</p>
              <p className="text-[10px]">{date}</p>
            </div>

            <div className="p-1 border-b border-gray-200">
              <p className="text-[10px] font-semibold text-gray-500">PREVIOUS AMOUNT PAID</p>
              <p className="text-[10px]">{formatPhp(previousPaidNum)}</p>
            </div>
            <div className="p-1 border-b border-gray-200">
              <p className="text-[10px] font-semibold text-gray-500">PREVIOUS BALANCE</p>
              <p className="text-[10px]">{formatPhp(previousBalanceNum)}</p>
            </div>

            <div className="p-1">
              <p className="text-[10px] font-semibold text-gray-500">CURRENT PAYMENT</p>
              <p className="text-[10px] font-semibold">{formatPhp(paymentAmountNum)}</p>
            </div>
            <div className="p-1">
              <p className="text-[10px] font-semibold text-gray-500">UPDATED CURRENT BALANCE</p>
              <p className="text-[10px] font-bold">{formatPhp(updatedBalanceNum)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mode of Payment */}
      <div className="mb-2 relative z-10">
        <p className="text-[10px] font-semibold text-gray-500 mb-1">MODE OF PAYMENT</p>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={isGCash}
              readOnly
              className="h-3 w-3 text-blue-600"
            />
            <span>GCash</span>
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={isBankTransfer}
              readOnly
              className="h-3 w-3 text-blue-600"
            />
            <span>Bank Transfer</span>
          </label>
        </div>

        {showReference && (
          <div className="mt-2">
            <p className="text-[10px] font-semibold text-gray-500 mb-1">REFERENCE NO. <span> {reference ? reference : '—'}</span></p>
             
          </div>
        )}
      </div>

      {/* Signature */}
      <div className="relative z-10">
        <div className="flex justify-end">
          <div className="w-1/3 text-center text-xs">
            <div className="h-6 border-b border-gray-200 mb-1" />
            <p className="font-semibold text-gray-500">RECEIVED BY</p>
            <p className="font-bold">{receivedBy}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ReceiptModal({ open, onClose, receiptData }) {
  if (!receiptData) return null;

  const handlePrint = async () => {
    try {
      await document.fonts.ready;

      // Ensure logo images are loaded before printing.
      const imgs = Array.from(document.querySelectorAll('#receipt-preview img'));
      await Promise.all(
        imgs.map(
          (img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((resolve) => {
                  img.onload = resolve;
                  img.onerror = resolve;
                })
        )
      );

      window.print();
    } catch (err) {
      console.error('Print failed:', err);
      alert('Failed to print receipt. Please try again.');
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-3">
        <style>{`
          @media print {
            @page { size: A4; margin: 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            /* Hide the main app page (PayablesSystem) and print only the modal */
            #root { display: none !important; }
            body * { visibility: hidden; }
            .modal-container, .modal-container * { visibility: visible; }
            .modal-dialog { position: absolute !important; left: 0 !important; top: 0 !important; }
            .modal-backdrop { display: none !important; }
            .modal-container { position: static !important; padding: 0 !important; }
            .modal-dialog { max-width: none !important; width: 100% !important; box-shadow: none !important; border-radius: 0 !important; }
            .modal-actions { display: none !important; }
            #receipt-preview { padding: 0 !important; }
            .receipt-copy { break-inside: avoid; page-break-inside: avoid; transform: scale(0.95); transform-origin: top left; }
            .receipt-copy + .receipt-copy { margin-top: 12mm; }
          }
        `}</style>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-gray-800">Receipt Preview</h2>
          <div className="flex gap-2 modal-actions">
            <button
              onClick={handlePrint}
              className="px-3 py-1 bg-green-600 text-white rounded-lg cursor-pointer hover:bg-green-700 transition text-sm"
            >
                <Printer className="inline-block mr-1 w-4 h-4"/>
              Print
            </button>
            <button
              onClick={onClose}
              className="p-1 bg-gray-100 text-gray-700 rounded-full cursor-pointer hover:text-red-600 transition"
            >
              <X className="w-4 h-4"/>
            </button>
          </div>
        </div>
        <div id="receipt-preview" className="space-y-6">
          <ReceiptLayout label="CCS COPY" receiptData={receiptData} />
          <ReceiptLayout label="STUDENT'S COPY" receiptData={receiptData} />
        </div>
      </div>
    </Modal>
  );
}