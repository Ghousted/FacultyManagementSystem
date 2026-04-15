import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-auto z-10 overflow-hidden modal-dialog"
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
    items,
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

  const receiptItems = Array.isArray(items) && items.length > 0
    ? items.map((item, idx) => {
        const rowPrice = toNumber(item?.price);
        const rowPayment = toNumber(item?.payment ?? item?.amount);
        const rowVoucherAmount = Math.max(0, toNumber(item?.voucherAmount));
        const rowVoucherDescription = String(item?.voucherDescription || '').trim();
        const rowPreviousBalance = typeof item?.previousBalance !== 'undefined'
          ? Math.max(0, toNumber(item.previousBalance))
          : Math.max(0, rowPrice - toNumber(item?.previousPaid));
        const rowCurrentBalance = typeof item?.balance !== 'undefined'
          ? Math.max(0, toNumber(item.balance))
          : Math.max(0, rowPrice - (toNumber(item?.previousPaid) + rowPayment));
        return {
          key: item?.payableId || item?.id || `${idx}-${item?.description || 'item'}`,
          description: item?.description || 'Payment',
          price: rowPrice,
          previousBalance: rowPreviousBalance,
          payment: rowPayment,
          balance: rowCurrentBalance,
          voucherAmount: rowVoucherAmount,
          voucherDescription: rowVoucherDescription,
        };
      })
    : [{
        key: 'default-item',
        description: description || 'Payment',
        price: priceNum,
        previousBalance: previousBalanceNum,
        payment: paymentAmountNum,
        balance: updatedBalanceNum,
        voucherAmount: Math.max(0, toNumber(receiptData?.voucherAmount)),
        voucherDescription: String(receiptData?.voucherDescription || '').trim(),
      }];

  const totalPriceNum = receiptItems.reduce((sum, item) => sum + item.price, 0);
  const totalPreviousBalanceNum = receiptItems.reduce((sum, item) => sum + item.previousBalance, 0);
  const totalPaymentAmountNum = receiptItems.reduce((sum, item) => sum + item.payment, 0);
  const totalCurrentBalanceNum = receiptItems.reduce((sum, item) => sum + item.balance, 0);
  const totalVoucherAmountNum = receiptItems.reduce((sum, item) => sum + item.voucherAmount, 0);

  const normalizeModeValue = (m) => {
    if (!m) return [];
    if (Array.isArray(m)) return m.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
    const str = String(m || '');
    return str
      .split(/[,|\/&;+]+|\s+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  };

  const modes = new Set(normalizeModeValue(mode));
  const isCash = modes.has('cash');
  const isGCash = modes.has('gcash') || modes.has('g-cash') || modes.has('g cash');
  const isBankTransfer =
    modes.has('bank transfer') || modes.has('bank') || modes.has('bank_transfer') || modes.has('bank-transfer') || modes.has('banktransfer');
  const showReference = isGCash || isBankTransfer;
  const otherPayablesList = Array.isArray(otherPayables) ? otherPayables : [];
  const otherBalanceTotalNum = toNumber(totalOtherBalance);

  return (
    <div className="p-4 border border-slate-300 bg-white text-[11px] relative receipt-copy rounded-xl shadow-sm">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        <img
          src={Logo}
          alt=""
          className="opacity-[0.1]"
          style={{ width: '60%', height: 'auto' }}
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
        <div className="grid grid-cols-3 pt-1  border-b border-slate-300 ">
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

        <div className="border border-slate-200 rounded-sm overflow-hidden my-2.5">
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
              {receiptItems.map((item) => (
                <tr key={item.key} className="border-t border-slate-200">
                  <td className="px-2 py-1.5 text-slate-800 text-xs">{item.description}</td>
                  <td className="px-2 py-1.5 text-right text-slate-900 font-semibold text-xs">{formatPhp(item.price)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-700 font-semibold text-xs">{formatPhp(item.previousBalance)}</td>
                  <td className="px-2 py-1.5 text-right text-emerald-700 font-semibold text-xs">{formatPhp(item.payment)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-900 font-bold text-xs">{formatPhp(item.balance)}</td>
                </tr>
              ))}
              {receiptItems.length > 1 && (
                <tr className="border-t border-slate-300 bg-slate-50">
                  <td className="px-2 py-1.5 text-slate-800 font-bold text-xs">TOTAL</td>
                  <td className="px-2 py-1.5 text-right text-slate-900 font-bold text-xs">{formatPhp(totalPriceNum)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-700 font-bold text-xs">{formatPhp(totalPreviousBalanceNum)}</td>
                  <td className="px-2 py-1.5 text-right text-emerald-700 font-bold text-xs">{formatPhp(totalPaymentAmountNum)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-900 font-bold text-xs">{formatPhp(totalCurrentBalanceNum)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalVoucherAmountNum > 0 && (
           
            <div className="flex items-center justify-between gap-2 text-xs">
              <p className="text-slate-700 truncate">
                Total voucher applied
              </p>
              <p className="font-semibold text-emerald-700">-{formatPhp(totalVoucherAmountNum)}</p>
            </div>
        )}
 

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
        <div className="space-y-1 ">
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
            <div className="h-4 border-b border-slate-400 mb-1" />
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Received By</p>
          </div>
        </div>
        </div>

      </div>
    </div>
  );
};

export default function ReceiptModal({ open, onClose, receiptData, autoPrint = false }) {
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

  // Auto-print when requested and close the modal afterwards
  React.useEffect(() => {
    if (!open || !autoPrint || !receiptData) return undefined;

    let mounted = true;
    (async () => {
      try {
        await handlePrint();
      } finally {
        if (mounted) onClose();
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, autoPrint, receiptData, onClose]);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-4 max-h-[60vh] overflow-y-auto bg-linear-to-b from-slate-50 to-white receipt-modal-content">
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
              size: 100mm 150mm;
              margin: 0;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
              background: #fff !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              width: 100mm;
              height: 150mm;
            }
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
              display: block !important;
              padding: 0 !important;
              margin: 0 auto !important;
              width: 100mm !important;
              max-width: 100mm !important;
              height: auto !important;
              min-height: 0 !important;
              break-before: auto !important;
              page-break-before: auto !important;
            }
            .receipt-copy {
              break-inside: avoid;
              page-break-inside: avoid;
              page-break-after: always;
              break-after: page;
              box-shadow: none !important;
              border: 1px solid #cbd5e1 !important;
              border-radius: 0 !important;
              padding: 4mm !important;
              width: 150mm !important;
              max-width: 150mm !important;
              height: 100mm !important;
              min-height: 100mm !important;
              box-sizing: border-box !important;
              flex: 0 0 auto !important;
              aspect-ratio: auto !important;
              overflow: hidden !important;
              font-size: 9px !important;
              line-height: 1.15 !important;
              margin: 0 !important;
              transform-origin: top left !important;
              transform: translateX(100mm) rotate(90deg) !important;
            }
            .receipt-copy:last-child {
              page-break-after: auto;
              break-after: auto;
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

// Print receipt directly without showing the modal UI.
// This creates an offscreen container, renders the receipt layout into it,
// waits for fonts and images, triggers the print dialog, then cleans up.
export async function printReceiptDirect(receiptData) {
  if (!receiptData) return;

  try {
    await document.fonts.ready;
  } catch (e) {
    // ignore
  }
  const container = document.createElement('div');
  container.className = 'modal-container';
  container.id = '__receipt-print-container';
  // keep it visually offscreen but present in DOM
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  // replicate the print styles used by the ReceiptModal so printing shows only this modal
  const style = document.createElement('style');
  style.setAttribute('data-generated-by', 'printReceiptDirect');
  style.textContent = `
    @media print {
      @page { size: 100mm 150mm; margin: 0; }
      body > *:not(.modal-container) { display: none !important; }
      .modal-backdrop { display: none !important; }
      .modal-container { position: static !important; display: block !important; padding: 0 !important; margin: 0 !important; visibility: visible !important; }
      .modal-dialog { position: static !important; max-width: none !important; width: 100% !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; background: #fff !important; }
      .receipt-modal-content { max-height: none !important; overflow: visible !important; padding: 0 !important; margin: 0 !important; background: #fff !important; }
      #receipt-preview { display: block !important; padding: 0 !important; margin: 0 auto !important; width: 100mm !important; max-width: 100mm !important; height: auto !important; min-height: 0 !important; }
      .receipt-copy { box-shadow: none !important; border: 1px solid #cbd5e1 !important; border-radius: 0 !important; padding: 4mm !important; width: 150mm !important; max-width: 150mm !important; height: 100mm !important; min-height: 100mm !important; box-sizing: border-box !important; font-size: 9px !important; line-height: 1.15 !important; margin: 0 !important; }
    }
  `;
  container.appendChild(style);

  // Use React 18 createRoot if available
  let root = null;
  try {
    root = createRoot(container);
    root.render(
      <div>
        <div className="modal-backdrop" />
        <div className="modal-dialog">
          <div className="receipt-modal-content">
            <div id="receipt-preview" className="receipt-preview-stack">
              <ReceiptLayout label="CCS COPY" receiptData={receiptData} />
              <ReceiptLayout label="STUDENT'S COPY" receiptData={receiptData} />
            </div>
          </div>
        </div>
      </div>
    );
  } catch (err) {
    // Fallback for older ReactDOM API
    const fallback = require('react-dom');
    fallback.render(
      React.createElement('div', null,
        React.createElement('div', { className: 'modal-backdrop' }),
        React.createElement('div', { className: 'modal-dialog' },
          React.createElement('div', { className: 'receipt-modal-content' },
            React.createElement('div', { id: 'receipt-preview', className: 'receipt-preview-stack' },
              React.createElement(ReceiptLayout, { label: 'CCS COPY', receiptData }),
              React.createElement(ReceiptLayout, { label: "STUDENT'S COPY", receiptData })
            )
          )
        )
      ),
      container
    );
  }

  // Wait a short tick for images to start loading
  await new Promise((r) => setTimeout(r, 150));

  const imgs = Array.from(container.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => { img.onload = res; img.onerror = res; }))));

  try {
    window.print();
  } catch (err) {
    console.error('Print failed:', err);
    throw err;
  } finally {
    if (root && root.unmount) root.unmount();
    else {
      try {
        const fallback = require('react-dom');
        fallback.unmountComponentAtNode(container);
      } catch (e) {
        // ignore
      }
    }
    container.remove();
  }
}