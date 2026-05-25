import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import Logo from '../../assets/logo.png';
import { Printer, X } from 'lucide-react';
import toast from 'react-hot-toast';

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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-auto z-10 overflow-hidden modal-dialog"
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

  const normalizeDescription = (value) => {
    const text = String(value || '').trim();
    if (!text) return 'Payment';
    
    // Handle Module: prefix - extract clean module name
    if (/^Module:\s*/i.test(text)) {
      return text.replace(/^Module:\s*/i, '').split(' — ')[0].trim() || 'Payment';
    }
    
    // Handle other prefixed payable types
    const prefixes = [
      /^Tuition:\s*/i,
      /^Lab:\s*/i,
      /^Library:\s*/i,
      /^Misc:\s*/i,
      /^Other:\s*/i,
      /^Fee:\s*/i
    ];
    
    for (const prefix of prefixes) {
      if (prefix.test(text)) {
        return text.replace(prefix, '').split(' — ')[0].trim() || text;
      }
    }
    
    // Return text as-is for other cases
    return text;
  };

  // Combine all payable items: modules, general payables, and other payables
  const allPayables = [];
  
  // Add items from the items array (modules/general payables)
  if (Array.isArray(items) && items.length > 0) {
    allPayables.push(...items);
  }
  
  // Add other payables to the main list if they have payments
  if (Array.isArray(otherPayables) && otherPayables.length > 0) {
    otherPayables.forEach((payable, idx) => {
      if (payable.payment > 0 || payable.amount > 0) {
        allPayables.push({
          payableId: payable.payableId || `other-${idx}`,
          description: payable.type || payable.description || 'Other Payable',
          price: payable.price || payable.totalAmount || 0,
          payment: payable.payment || payable.amount || 0,
          previousPaid: payable.previousPaid || 0,
          balance: payable.remainingBalance || payable.balance || 0,
          voucherAmount: payable.voucherAmount || 0,
          voucherDescription: payable.voucherDescription || ''
        });
      }
    });
  }
  
  // If no items found, create a default item from the main receipt data
  if (allPayables.length === 0) {
    allPayables.push({
      payableId: 'default-item',
      description: description || 'Payment',
      price: priceNum,
      payment: paymentAmountNum,
      previousPaid: previousPaidNum,
      balance: updatedBalanceNum,
      voucherAmount: Math.max(0, toNumber(receiptData?.voucherAmount)),
      voucherDescription: String(receiptData?.voucherDescription || '').trim()
    });
  }

  const receiptItems = allPayables.map((item, idx) => {
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
      description: normalizeDescription(item?.description),
      price: rowPrice,
      previousBalance: rowPreviousBalance,
      payment: rowPayment,
      balance: rowCurrentBalance,
      voucherAmount: rowVoucherAmount,
      voucherDescription: rowVoucherDescription,
    };
  });

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
    <div className="p-3 border border-slate-300 bg-white text-[10px] relative receipt-copy">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
  <img
    src={Logo}
    alt=""
    className="w-[50%] h-auto opacity-10"
    style={{
      filter: "grayscale(100%) brightness(0) contrast(100%)"
    }}
  />
</div>

      <div className="relative z-10 space-y-1">
        {/* Header Section */}
        <div className="text-center border-b pb-1">
          <p className="text-[11px] font-bold text-slate-700">{label}</p>
          <h2 className="text-[11px] font-bold text-blue-900">COLLEGE OF COMPUTER STUDIES</h2>
          <p className="text-[11px] text-slate-600">OFFICIAL RECEIPT</p>
          <div className="flex justify-between items-center mt-1">
            <p className="text-[11px] text-slate-600">No: {receiptNumber}</p>
            <p className="text-[11px] text-slate-600">{date}</p>
          </div>
        </div>

        {/* Student Info Section */}
        <div className="border-b pb-1 mb-4">
          <div className="flex justify-between items-center">
            <p className="text-[11px] text-slate-700"><span className="font-semibold">Name:</span> {studentName}</p>
            <p className="text-[11px] text-slate-700"><span className="font-semibold">Course:</span> {course || 'BSCS'} {yearLevel || ''}</p>
          </div>
        </div>

        {/* Payment Details and Balance - Side by Side */}
        <div className="border-b pb-1">
          <div className="flex gap-4">
            {/* Left Side - Payments (Mga Binayaran) */}
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-slate-700 mb-1">Payments made</p>
              <div className="space-y-0.5">
                {receiptItems.map((item) => (
                  <div key={item.key} className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-700 flex-1 truncate">{item.description}</span>
                    <span className="text-slate-900 font-semibold ml-2">{formatPhp(item.payment)}</span>
                  </div>
                ))}
                {receiptItems.length > 1 && (
                  <div className="flex justify-between items-center text-[11px] font-semibold border-t pt-0.5">
                    <span className="text-slate-800">TOTAL</span>
                    <span className="text-slate-900">{formatPhp(totalPaymentAmountNum)}</span>
                  </div>
                )}
                {totalVoucherAmountNum > 0 && (
                  <div className="flex justify-between items-center text-[11px] text-emerald-700">
                    <span>Voucher Applied</span>
                    <span>-{formatPhp(totalVoucherAmountNum)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Balances (Mga Balance) */}
            {(() => {
              const nonZeroOtherPayables = otherPayablesList.filter(item => item.remainingBalance > 0);
              const nonZeroOtherBalanceTotal = nonZeroOtherPayables.reduce((sum, item) => sum + item.remainingBalance, 0);
              const nonZeroCurrentBalanceTotal = receiptItems.filter(item => item.balance > 0).reduce((sum, item) => sum + item.balance, 0);
              const hasAnyBalance = nonZeroOtherPayables.length > 0 || receiptItems.some(item => item.balance > 0);
              
              return hasAnyBalance ? (
                <div className="flex-1 border-l pl-4">
                  <p className="text-[11px] font-semibold text-slate-700 mb-1">Remaining Balance</p>
                  <div className="space-y-0.5">
                    {receiptItems.filter(item => item.balance > 0).map((item) => (
                      <div key={item.key} className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-700">{item.description}</span>
                        <span className="text-slate-900 font-semibold">{formatPhp(item.balance)}</span>
                      </div>
                    ))}
                    {nonZeroOtherPayables.map((item) => (
                      <div key={item.payableId} className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-700 truncate">{item.type}</span>
                        <span className="text-slate-900 font-semibold">{formatPhp(item.remainingBalance)}</span>
                      </div>
                    ))}
                    {(nonZeroCurrentBalanceTotal > 0 || nonZeroOtherBalanceTotal > 0) && (
                      <div className="flex justify-between items-center text-[11px] font-semibold border-t pt-0.5">
                        <span className="text-slate-800">Total Balance</span>
                        <span className="text-rose-700">{formatPhp(nonZeroCurrentBalanceTotal + nonZeroOtherBalanceTotal)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>

        {/* Payment Info */}
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <div className='flex items-center gap-1'>
              <p className="text-[11px] font-semibold text-slate-700">Payment Mode:</p>
            <p className="text-[11px] text-slate-600">
              {isCash && 'Cash'}
              {isGCash && (isCash ? ', GCash' : 'GCash')}
              {isBankTransfer && ((isCash || isGCash) ? ', Bank Transfer' : 'Bank Transfer')}
            </p>
            </div>
            {showReference && (
              <p className="text-[11px] text-slate-600">
                <span className="font-semibold">Ref:</span> {reference || 'N/A'}
              </p>
            )}
          </div>
          <div className="text-center mt-8">
            <div className="border-b w-32 mb-1" />
            <p className="text-[11px] text-slate-600">{receivedBy || 'Received By'}</p>
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
      toast.success('Receipt printed successfully!');
    } catch (err) {
      console.error('Print failed:', err);
      toast.error('Failed to print receipt. Please try again.');
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
      <div className="p-4 max-h-[60vh] overflow-y-auto bg-gradient-to-b from-slate-50 to-white receipt-modal-content">
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
              font-size: 11px !important;
              line-height: 1.15 !important;
              margin: 0 !important;
              transform-origin: top left !important;
              transform: translateX(100mm) rotate(90deg) !important;
            }
            .receipt-copy:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            .receipt-copy .text-[8px] { font-size: 7px !important; }
            .receipt-copy .text-[10px] { font-size: 8px !important; }
            .receipt-copy .text-[11px] { font-size: 8.5px !important; }
            .receipt-copy .text-[12px] { font-size: 11px !important; }
            .receipt-copy .text-xs { font-size: 8px !important; }
            .receipt-copy .text-sm { font-size: 11px !important; }
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
  container.style.left = '-99911px';
  container.style.top = '0';
  document.body.appendChild(container);

  // replicate the print styles used by the ReceiptModal so printing shows only this modal
  const style = document.createElement('style');
  style.setAttribute('data-generated-by', 'printReceiptDirect');
  style.textContent = `
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
      body > *:not(#__receipt-print-container) { display: none !important; }
      #__receipt-print-container {
        position: static !important;
        left: auto !important;
        top: auto !important;
        display: block !important;
        padding: 0 !important;
        margin: 0 !important;
        visibility: visible !important;
        background: #fff !important;
      }
      .modal-backdrop { display: none !important; }
      .modal-dialog { position: static !important; max-width: none !important; width: 100% !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; background: #fff !important; }
      .receipt-modal-content { max-height: none !important; overflow: visible !important; padding: 0 !important; margin: 0 !important; background: #fff !important; }
      #receipt-preview { display: block !important; padding: 0 !important; margin: 0 auto !important; width: 100mm !important; max-width: 100mm !important; height: auto !important; min-height: 0 !important; break-before: auto !important; page-break-before: auto !important; }
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
        font-size: 11px !important;
        line-height: 1.15 !important;
        margin: 0 !important;
        transform-origin: top left !important;
        transform: translateX(100mm) rotate(90deg) !important;
      }
      .receipt-copy:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .receipt-copy .text-[8px] { font-size: 7px !important; }
      .receipt-copy .text-[10px] { font-size: 8px !important; }
      .receipt-copy .text-[11px] { font-size: 8.5px !important; }
      .receipt-copy .text-[12px] { font-size: 11px !important; }
      .receipt-copy .text-xs { font-size: 8px !important; }
      .receipt-copy .text-sm { font-size: 11px !important; }
      .receipt-copy table { width: 100%; margin: 0; }
      .receipt-copy td, .receipt-copy th { padding: 0.032in 0.028in; }
      .receipt-copy + .receipt-copy { margin-top: 0 !important; }
    }
  `;
  document.head.appendChild(style);

  const cleanup = () => {
    if (root && root.unmount) root.unmount();
    else {
      try {
        const fallback = require('react-dom');
        fallback.unmountComponentAtNode(container);
      } catch (e) {
        // ignore
      }
    }
    style.remove();
    container.remove();
  };

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
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    const afterPrint = new Promise((resolve) => {
      const done = () => {
        window.removeEventListener('afterprint', done);
        resolve();
      };
      window.addEventListener('afterprint', done, { once: true });
      setTimeout(done, 30000);
    });
    window.print();
    toast.success('Receipt printed successfully!');
    await afterPrint;
  } catch (err) {
    console.error('Print failed:', err);
    toast.error('Failed to print receipt. Please try again.');
    throw err;
  } finally {
    cleanup();
  }
}
