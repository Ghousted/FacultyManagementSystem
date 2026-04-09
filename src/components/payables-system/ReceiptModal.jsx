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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto z-10 overflow-hidden modal-dialog"
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
    otherPayables,
    totalOtherBalance,
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
  const isCash = modeNormalized === 'cash';
  const isGCash = modeNormalized === 'gcash';
  const isBankTransfer = modeNormalized === 'bank transfer' || modeNormalized === 'bank' || modeNormalized === 'bank_transfer';
  const showReference = isGCash || isBankTransfer;
  const otherPayablesList = Array.isArray(otherPayables) ? otherPayables : [];
  const otherBalanceTotalNum = toNumber(totalOtherBalance);

  return (
    <div className="p-3 border border-slate-300 bg-white text-[11px] relative receipt-copy rounded-xl shadow-sm">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        <img
          src={Logo}
          alt=""
          className="opacity-[0.08]"
          style={{ width: '35%', height: 'auto' }}
        />
      </div>

      <div className="relative z-10 space-y-2">
        {/* Header Section */}
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <span className="inline-block px-2 py-0.5 rounded-2xl text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {label}
              </span>
              <p className="text-[9px] text-slate-500 tracking-wide font-semibold">OFFICIAL RECEIPT</p>
            </div>
            <div className="text-center flex-1 ">
              <h2 className="text-sm font-bold text-blue-900 tracking-wide leading-tight">COLLEGE OF COMPUTER STUDIES</h2>
              
            </div>
            <div className="text-right whitespace-nowrap">
              
              <p className="text-[12px] font-bold text-slate-800"> 
                <span className="text-[11px] text-slate-500 font-semibold mr-1">RECEIPT NO.</span> {receiptNumber}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">{date}</p>
            </div>
          </div>
        </div>

        {/* Student Info Section */}
        <div className="grid grid-cols-3 pt-2  border-b border-slate-300 ">
          <div className="col-span-2 flex gap-2">
            <span className="text-xs uppercase tracking-wider text-slate-700 font-semibold min-w-fit">Name:</span>
            <span className="text-xs uppercase font-semibold text-slate-900 flex-1 wrap-break-word">
              {studentName}
            </span>
          </div>
          <div className="col-span-1 flex gap-2">
            <span className="text-xs uppercase tracking-wider text-slate-700 font-semibold min-w-fit">Course / Year:</span>
            <span className="text-xs uppercase font-semibold text-slate-900">
              {course || 'BSCS'} {yearLevel || ''}
            </span>
          </div>
        </div>

        <div className="border border-slate-200 rounded-sm overflow-hidden my-6">
          <table className="w-full text-[9px]">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-2 py-1 text-left font-semibold uppercase tracking-wide text-slate-600 text-xs">Description</th>
                <th className="px-2 py-1 text-right font-semibold uppercase tracking-wide text-slate-600 text-xs">Price</th>
                <th className="px-2 py-1 text-right font-semibold uppercase tracking-wide text-slate-600 text-xs">Prev. Bal.</th>
                <th className="px-2 py-1 text-right font-semibold uppercase tracking-wide text-slate-600 text-xs">Payment</th>
                <th className="px-2 py-1 text-right font-semibold uppercase tracking-wide text-slate-600 text-xs">Current Bal.</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-200">
                <td className="px-2 py-1.5 text-slate-800 text-xs">{description}</td>
                <td className="px-2 py-1.5 text-right text-slate-900 font-semibold text-xs">{formatPhp(priceNum)}</td>
                <td className="px-2 py-1.5 text-right text-slate-700 font-semibold text-xs">{formatPhp(previousBalanceNum)}</td>
                <td className="px-2 py-1.5 text-right text-emerald-700 font-semibold text-xs">{formatPhp(paymentAmountNum)}</td>
                <td className="px-2 py-1.5 text-right text-slate-900 font-bold text-xs">{formatPhp(updatedBalanceNum)}</td>
              </tr>
            </tbody>
          </table>
        </div>
 

        <div className="border border-slate-200 rounded-sm overflow-hidden">
          <div className="px-2 py-0.5 bg-slate-100 border-b border-slate-200">
            <p className="text-xs uppercase tracking-wide font-semibold text-slate-600">
              Other Outstanding Payables
            </p>
          </div>

          {otherPayablesList.length === 0 ? (
            <p className="text-xs text-slate-600 px-2 py-1">
              No other outstanding balance.
            </p>
          ) : (
            <>
              {/* GRID HERE */}
              <div className="grid grid-cols-2">
                {otherPayablesList.slice(0, 4).map((item) => (
                  <div
                    key={item.payableId}
                    className="flex items-center justify-between px-2 py-0.5 border-b border-r border-r-slate-300 border-slate-100"
                  >
                    <p className="text-xs text-slate-700 truncate pr-2">
                      {item.type}
                    </p>
                    <p className="text-xs font-semibold text-slate-700">
                      {formatPhp(item.remainingBalance)}
                    </p>
                  </div>
                ))}
              </div>

              {otherPayablesList.length > 4 && (
                <div className="px-2 py-0.5 bg-slate-50 border-t border-slate-200">
                  <p className="text-xs text-slate-500">
                    +{otherPayablesList.length - 4} more payable(s)
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between px-2 py-1 bg-slate-50 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-700">
                  Total Other Balance
                </p>
                <p className="text-xs font-bold text-rose-700">
                  {formatPhp(otherBalanceTotalNum)}
                </p>
              </div>
            </>
          )}
        </div>

        <div className='flex items-start justify-between'>
          {/* Mode of Payment Section */}
        <div className="space-y-1 mt-6">
          <div className='flex items-center gap-2'>
            <p className="text-xs tracking-wider text-slate-600 font-semibold">Mode of Payment:</p>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={isCash}
                readOnly
                className="h-3 w-3 accent-emerald-600"
              />
              <span>Cash</span>
            </label>
            <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={isGCash}
                readOnly
                className="h-3 w-3 accent-emerald-600"
              />
              <span>GCash</span>
            </label>
            <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={isBankTransfer}
                readOnly
                className="h-3 w-3 accent-emerald-600"
              />
              <span>Bank Transfer</span>
            </label>
          </div>
          </div>
          {showReference && (
            <p className="text-xs text-slate-600 mt-1">
              <span className="font-semibold">Reference No.:</span> <span className='uppercase font-mono'>{reference || '—'}</span>
            </p>
          )}
        </div>

        {/* Signature Section */}
        <div className="">
          <div className="w-46 text-center">
            <div className="h-8 border-b border-slate-400 mb-1" />
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Received By</p>
          </div>
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
      <div className="p-4 max-h-[90vh] overflow-y-auto bg-linear-to-b from-slate-50 to-white receipt-modal-content">
        <style>{`
          .receipt-preview-stack {
            width: 100%;
            max-width: 5.83in;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 7.2in;
            gap: 0;
          }

          .receipt-preview-stack .receipt-copy {
            min-height: 3.08in;
          }

          @media print {
            @page { 
              size: A5 portrait;
              margin: 0.22in;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
              background: #fff !important;
            }
            html, body { margin: 0; padding: 0; }
            body > *:not(.modal-container) { display: none !important; }
            .modal-backdrop { display: none !important; }
            .modal-container {
              position: static !important;
              display: block !important;
              padding: 0 !important;
              margin: 0 !important;
              visibility: visible !important;
            }
            .modal-dialog {
              position: static !important;
              max-width: none !important;
              width: 100% !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              overflow: visible !important;
              background: #fff !important;
            }
            .modal-actions { display: none !important; }
            .receipt-preview-title { display: none !important; }
            .receipt-header-row { display: none !important; }
            .receipt-modal-content {
              max-height: none !important;
              overflow: visible !important;
              padding: 0 !important;
              margin: 0 !important;
              background: #fff !important;
            }
            #receipt-preview {
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: space-between !important;
              padding: 0 !important;
              gap: 0 !important;
              margin: 0 auto !important;
              width: 100% !important;
              max-width: 5.43in !important;
              height: auto !important;
              min-height: calc(8.27in - 0.44in) !important;
              break-before: auto !important;
              page-break-before: auto !important;
            }
            .receipt-copy {
              break-inside: avoid;
              page-break-inside: avoid;
              page-break-after: avoid;
              box-shadow: none !important;
              border: 1px solid #cbd5e1 !important;
              border-radius: 0 !important;
              padding: 0.09in !important;
              width: 100% !important;
              max-width: 100% !important;
              min-height: 3.2in !important;
              height: 3.2in !important;
              flex: 0 0 auto !important;
              aspect-ratio: auto !important;
              overflow: hidden !important;
              font-size: 9px !important;
              line-height: 1.15 !important;
              margin: 0 !important;
            }
            .receipt-copy .text-\[8px\] { font-size: 7px !important; }
            .receipt-copy .text-\[9px\] { font-size: 7.5px !important; }
            .receipt-copy .text-\[10px\] { font-size: 8px !important; }
            .receipt-copy .text-\[11px\] { font-size: 8.5px !important; }
            .receipt-copy .text-\[12px\] { font-size: 9px !important; }
            .receipt-copy .text-xs { font-size: 8.5px !important; }
            .receipt-copy .text-sm { font-size: 9.5px !important; }
            .receipt-copy table { width: 100%; margin: 0; }
            .receipt-copy td, .receipt-copy th { padding: 0.032in 0.028in; }
            .receipt-copy + .receipt-copy { margin-top: 0 !important; }
          }
        `}</style>
        <div className="flex justify-between items-start mb-4 receipt-header-row">
          <div>
            <h2 className="text-lg font-bold text-slate-800 receipt-preview-title">Receipt Preview</h2>
          </div>
          <div className="flex gap-2 modal-actions">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg cursor-pointer hover:bg-emerald-700 transition text-xs font-semibold flex items-center gap-1.5"
              title="Print receipts"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-100 text-slate-700 rounded-lg cursor-pointer hover:bg-slate-200 transition"
              title="Close receipt preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div id="receipt-preview" className="receipt-preview-stack">
          <ReceiptLayout label="CCS COPY" receiptData={receiptData} />
          <ReceiptLayout label="STUDENT'S COPY" receiptData={receiptData} />
        </div>
      </div>
    </Modal>
  );
}