import { useState, useEffect, useCallback } from 'react';
import { getStudents } from '../../models/curriculumModels';
import { 
  createPayable, 
  getPayables, 
  updatePayable, 
  deletePayable,
  createStudentPayment,
  getStudentPayments,
  getAllStudentPayments
} from '../../models/payablesModels';
import { useAuth } from '../../contexts/AuthContext';
import { BadgePlus,  Search, ChevronUp, ChevronDown, ChevronsUpDown, Funnel, X, Printer, Pencil, Delete, History, ArrowBigLeft, Settings2, Download, Receipt, Trash } from 'lucide-react';
import Logo from '../../assets/logo.png';
import ReceiptModal from './ReceiptModal';
import { db } from '../../firebase';
import { generateReceiptNumber, createReceiptRecord } from '../../utils/receiptService';

const PayablesSystem = ({ onBackToDashboard }) => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState('name-asc'); // 'name-asc', 'name-desc', 'balance-asc', 'balance-desc'
  
  // Payment dialog states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentType: 'tuition',
    description: '',
    dueDate: '',
    status: 'pending'
  });

  // Student payment dialog states
  // 1. Remove all payment dialog/modal state and handlers (studentPaymentDialogOpen, selectedPayableForPayment, selectedStudentForPayment, studentPaymentForm, handleStudentPaymentClick, handleStudentPaymentFormChange, handleSaveStudentPayment, handleMarkAsFullyPaid, and their usages)
  // 2. In the payables table, always render the paid amount as a TextField (not just in edit mode)
  // 3. On change, update Firestore immediately
  // 4. Remove the Record Payment modal JSX
  // 5. Remove any references to the old modal-based payment workflow

  // Payable management states
  const [payables, setPayables] = useState({}); // {yearLevel: [payables]} - year-specific payables
  const [editingMode, setEditingMode] = useState(false);
  const [addPayableDialogOpen, setAddPayableDialogOpen] = useState(false);
  const [newPayableForm, setNewPayableForm] = useState({
    type: '',
    amount: '',
    status: 'unpaid',
    paidAmount: '0',
    yearLevel: 'all'
  });

  // Student modal states
  const [selectedStudentModal, setSelectedStudentModal] = useState(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  // Staged payment edits (not yet saved to Firestore)
  const [stagedPayments, setStagedPayments] = useState({}); // { payableId: paidAmount }
  const [confirmLoading, setConfirmLoading] = useState(false);
  // Per-payable payment mode and reference (not yet persisted)
  const [stagedPaymentModes, setStagedPaymentModes] = useState({}); // { payableId: 'cash'|'gcash'|'bank' }
  const [stagedPaymentReferences, setStagedPaymentReferences] = useState({}); // { payableId: reference }
  const [stagedVouchers, setStagedVouchers] = useState({}); // { payableId: { enabled, amount, description } }
  
  // Individual student payable states
  const [individualPayableDialogOpen, setIndividualPayableDialogOpen] = useState(false);
  const [individualPayableForm, setIndividualPayableForm] = useState({
    type: '',
    amount: '',
    yearLevel: ''
  });

  // Summary modal states
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryData, setSummaryData] = useState({ changes: [], totalCurrentBalance: 0, totalNewBalance: 0 });

  // Delete confirmation modal state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Transaction history modal state
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionPayable, setTransactionPayable] = useState(null);
  const [transactionPayments, setTransactionPayments] = useState([]);

  // Student transactions modal state
  const [studentTransactionsModalOpen, setStudentTransactionsModalOpen] = useState(false);
  const [selectedStudentForTransactions, setSelectedStudentForTransactions] = useState(null);
  const [studentTransactions, setStudentTransactions] = useState([]);

  // Receipt modal state
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // Payables view controls (inside Student modal)
  const [payablesFilter, setPayablesFilter] = useState('all'); // all | unpaid | partially_paid | fully_paid | individual
  const [payablesViewMode, setPayablesViewMode] = useState('list'); // list | grid
  const [payablesSearch, setPayablesSearch] = useState('');
  // Action menu state for per-payable dropdown in student modal
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const loadStudents = useCallback(async () => {
    if (!currentUser) {
      setError('Please sign in to access student data');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await getStudents();
      if (result.success) {
        setStudents(result.data);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to load students: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const loadPayables = useCallback(async () => {
    if (!currentUser) {
      setError('Please sign in to access payables data');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await getPayables(currentUser.uid);
      if (result.success) {
        const yearSpecificPayables = {};
        (result.data || []).forEach((payable) => {
          const yearLevel = payable.yearLevel;
          if (!yearSpecificPayables[yearLevel]) {
            yearSpecificPayables[yearLevel] = [];
          }
          // Ensure payable has required properties with default values
          const safePayable = {
            ...payable,
            amount: Number(payable.amount) || 0,
            studentPayments: payable.studentPayments || {},
            isIndividual: payable.isIndividual || false,
            studentId: payable.studentId || null,
            studentName: payable.studentName || null
          };
          yearSpecificPayables[yearLevel].push(safePayable);
        });
        setPayables(yearSpecificPayables);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to load payables: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadStudents();
      loadPayables();
    }
  }, [currentUser, loadStudents, loadPayables]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    const getCurrentScrollTop = () => {
      const rootElement = document.getElementById('root');
      const mainElement = document.querySelector('main');

      return Math.max(
        window.scrollY || 0,
        window.pageYOffset || 0,
        document.documentElement?.scrollTop || 0,
        document.body?.scrollTop || 0,
        rootElement?.scrollTop || 0,
        mainElement?.scrollTop || 0
      );
    };

    const handleScroll = () => {
      setShowScrollTop(getCurrentScrollTop() > 180);
    };

    const rootElement = document.getElementById('root');
    const mainElement = document.querySelector('main');

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });

    if (rootElement) {
      rootElement.addEventListener('scroll', handleScroll, { passive: true });
    }

    if (mainElement) {
      mainElement.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
      if (rootElement) {
        rootElement.removeEventListener('scroll', handleScroll);
      }
      if (mainElement) {
        mainElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const handlePaymentInputChange = (field, value) => {
    setPaymentForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNewPayableInputChange = (field, value) => {
    setNewPayableForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleIndividualPayableInputChange = (field, value) => {
    setIndividualPayableForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddPayable = () => {
    setNewPayableForm({
      type: '',
      amount: '',
      status: 'unpaid',
      paidAmount: '0',
      yearLevel: tabValue === 4 ? 'irregular' : (tabValue + 1).toString()
    });
    setAddPayableDialogOpen(true);
  };

  const handleAddIndividualPayable = () => {
    if (!selectedStudentModal) return;
    setIndividualPayableForm({
      type: '',
      amount: '',
      yearLevel: selectedStudentModal.yearLevel.toString()
    });
    setIndividualPayableDialogOpen(true);
  };

  const handleSaveNewPayable = async () => {
    if (!newPayableForm.type || !newPayableForm.amount) {
      setError('Please fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      const targetYear = newPayableForm.yearLevel;
      if (editingMode) {
        const result = await updatePayable(newPayableForm.id, {
          type: newPayableForm.type,
          amount: parseFloat(newPayableForm.amount),
          yearLevel: targetYear === 'irregular' || targetYear === 'all' ? targetYear : parseInt(targetYear)
        });
        if (result.success) {
          setSuccess('Payable updated successfully!');
          await loadPayables();
        } else {
          setError(result.error);
        }
      } else {
        let targetStudents;
        if (targetYear === 'irregular') {
          targetStudents = students.filter(s => s.isIrregular);
        } else if (targetYear === 'all') {
          targetStudents = students;
        } else {
          targetStudents = students.filter(s => s.yearLevel === parseInt(targetYear) && !s.isIrregular);
        }
        const studentPayments = {};
        targetStudents.forEach(student => {
          studentPayments[student.id] = {
            status: 'unpaid',
            paidAmount: 0
          };
        });
        const newPayableData = {
          type: newPayableForm.type,
          amount: parseFloat(newPayableForm.amount),
          yearLevel: targetYear === 'irregular' || targetYear === 'all' ? targetYear : parseInt(targetYear),
          studentPayments: studentPayments
        };
        const result = await createPayable(newPayableData, currentUser.uid);
        if (result.success) {
          setSuccess(`Payable added successfully for ${targetStudents.length} students!`);
          await loadPayables();
          setAddPayableDialogOpen(false);
        } else {
          setError(result.error);
        }
      }
      setEditingMode(false);
      setNewPayableForm({
        type: '',
        amount: '',
        status: 'unpaid',
        paidAmount: '0',
        yearLevel: 'all'
      });
    } catch (error) {
      setError('Failed to save payable: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIndividualPayable = async () => {
    if (!individualPayableForm.type || !individualPayableForm.amount || !individualPayableForm.yearLevel) {
      setError('Please fill in all required fields');
      return;
    }
    if (!selectedStudentModal) {
      setError('No student selected');
      return;
    }
    setLoading(true);
    try {
      const studentPayments = {
        [selectedStudentModal.id]: {
          status: 'unpaid',
          paidAmount: 0
        }
      };
      const newPayableData = {
        type: individualPayableForm.type,
        amount: parseFloat(individualPayableForm.amount),
        yearLevel: parseInt(individualPayableForm.yearLevel),
        studentPayments: studentPayments,
        isIndividual: true,
        studentId: selectedStudentModal.id,
        studentName: selectedStudentModal.name
      };
      const result = await createPayable(newPayableData, currentUser.uid);
      if (result.success) {
        setSuccess(`Previous balance added successfully for ${selectedStudentModal.name}!`);
        await loadPayables();
        setIndividualPayableDialogOpen(false);
        setIndividualPayableForm({
          type: '',
          amount: '',
          yearLevel: ''
        });
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to add previous balance: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePayment = async () => {
    if (!selectedStudentModal || !paymentForm.amount || !paymentForm.description) {
      setError('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      // TODO: Implement payment saving logic
      console.log('Saving payment for student:', selectedStudentModal.name, paymentForm);
      setSuccess('Payment created successfully!');
      setPaymentDialogOpen(false);
    } catch (error) {
      setError('Failed to create payment: ' + error.message);
    }
    setLoading(false);
  };

  const getVoucherData = useCallback((payable, studentId) => {
    if (!payable || !studentId) {
      return { enabled: false, amount: 0, description: '' };
    }

    const studentPayment = payable.studentPayments?.[studentId] || {};
    const persistedAmount = Math.max(0, Number(studentPayment.voucherAmount || 0));
    const persistedDescription = (studentPayment.voucherDescription || '').toString();
    const staged = stagedVouchers?.[payable.id];

    const hasStagedAmount = !!staged && Object.prototype.hasOwnProperty.call(staged, 'amount');
    const hasStagedDescription = !!staged && Object.prototype.hasOwnProperty.call(staged, 'description');
    const enabled = typeof staged?.enabled === 'boolean' ? staged.enabled : persistedAmount > 0;

    const rawAmount = hasStagedAmount ? staged.amount : (persistedAmount > 0 ? String(persistedAmount) : '');
    const parsedAmount = enabled ? Math.max(0, Number(rawAmount || 0)) : 0;
    const amount = Math.min(parsedAmount, Math.max(0, Number(payable.amount || 0)));
    const description = hasStagedDescription ? (staged.description || '') : persistedDescription;

    return { enabled, amount, description };
  }, [stagedVouchers]);

  const handleStartEditPayables = (payableId) => {
    const currentYear = tabValue + 1;
    const payable = payables[currentYear]?.find(p => p.id === payableId) || Object.values(payables).flat().find(p => p.id === payableId);
    if (payable) {
      setNewPayableForm({
        id: payable.id,
        type: payable.type,
        amount: payable.amount.toString(),
        status: 'unpaid',
        paidAmount: '0',
        yearLevel: payable.yearLevel.toString() === 'irregular' ? 'irregular' : payable.yearLevel.toString()
      });
      setEditingMode(true);
      setAddPayableDialogOpen(true);
    }
  };

  const handleDeletePayable = async (payableId) => {
    setLoading(true);
    try {
      const result = await deletePayable(payableId);
      if (result.success) {
        setSuccess('Payable deleted successfully!');
        await loadPayables();
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to delete payable: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Show summary of changes before confirming
  const handleShowSummary = () => {
    if (!selectedStudentModal) return;
    const studentId = selectedStudentModal.id;
    const changes = [];
    let totalCurrentBalance = 0;
    let totalNewBalance = 0;

    const voucherPayableIds = Object.entries(stagedVouchers)
      .filter(([, v]) => v && (v.enabled || Number(v.amount || 0) > 0 || (v.description || '').trim() !== ''))
      .map(([payableId]) => payableId);
    const payableIds = Array.from(new Set([...Object.keys(stagedPayments), ...voucherPayableIds]));

    for (const payableId of payableIds) {
      const rawPaymentAmount = Number(stagedPayments?.[payableId] || 0);
      const payable = Object.values(payables).flat().find(p => p.id === payableId);
      if (payable) {
        const currentPaid = payable.studentPayments?.[studentId]?.paidAmount || 0;
        const amount = Math.max(0, Number(payable.amount) || 0);

        const voucher = getVoucherData(payable, studentId);
        const voucherAmount = Math.min(voucher.amount, amount);
        const voucherDescription = (voucher.description || '').trim();

        if (voucherAmount > 0 && !voucherDescription) {
          setError(`Voucher description is required for ${payable.type}.`);
          return;
        }

        const effectiveAmount = Math.max(0, amount - voucherAmount);
        const maxAllowedPayment = Math.max(0, effectiveAmount - currentPaid);
        const newPaymentAmount = Math.min(Math.max(0, rawPaymentAmount), maxAllowedPayment);
        const newTotalPaid = currentPaid + newPaymentAmount;
        const currentBalance = Math.max(0, amount - currentPaid);
        const newBalance = Math.max(0, effectiveAmount - newTotalPaid);

        const persistedVoucherAmount = Math.max(0, Number(payable.studentPayments?.[studentId]?.voucherAmount || 0));
        const persistedVoucherDescription = (payable.studentPayments?.[studentId]?.voucherDescription || '').trim();
        const hasVoucherChange = voucherAmount !== persistedVoucherAmount || voucherDescription !== persistedVoucherDescription;
        const hasPaymentChange = newPaymentAmount > 0;

        if (!hasVoucherChange && !hasPaymentChange) {
          continue;
        }

        totalCurrentBalance += currentBalance;
        totalNewBalance += newBalance;
        changes.push({
          payableId,
          type: payable.type,
          amount: effectiveAmount,
          originalAmount: amount,
          voucherAmount,
          voucherDescription,
          currentPaid,
          newPayment: newPaymentAmount,
          newTotalPaid,
          mode: stagedPaymentModes?.[payableId] || 'cash',
          reference: stagedPaymentReferences?.[payableId] || ''
        });
      }
    }

    setSummaryData({ changes, totalCurrentBalance, totalNewBalance });
    setSummaryModalOpen(true);
  };

  // Final confirmation: persist all stagedPayments for the selected student
  const handleFinalConfirm = async () => {
    if (!selectedStudentModal) return;

    const studentSnapshot = selectedStudentModal;
    const studentId = selectedStudentModal.id;
    setConfirmLoading(true);
    setError('');
    try {
      let lastReceiptPreview = null;
      const updatedPaidByPayable = {};
      const paymentDate = new Date();
      const receiptLineItems = [];
      const paymentsToCreate = [];

      // For each change, compute status and send update
      for (const change of summaryData.changes) {
        const { payableId, newPayment, mode, reference, voucherAmount, voucherDescription } = change;
        // Find payable to get total amount
        const payable = Object.values(payables).flat().find(p => p.id === payableId);
        if (!payable) continue;
        const payableAmount = Math.max(0, Number(payable.amount) || 0);
        const effectivePayableAmount = Math.max(0, payableAmount - Math.max(0, Number(voucherAmount || 0)));
        const newTotalPaid = change.currentPaid + newPayment;
        updatedPaidByPayable[payableId] = Number(newTotalPaid || 0);
        const newStatus = newTotalPaid >= effectivePayableAmount ? 'fully_paid' : (newTotalPaid > 0 ? 'partially_paid' : 'unpaid');

        const updateObj = {
          [`studentPayments.${studentId}.paidAmount`]: newTotalPaid,
          [`studentPayments.${studentId}.status`]: newStatus,
          [`studentPayments.${studentId}.lastPaymentMode`]: mode || 'cash',
          [`studentPayments.${studentId}.lastPaymentReference`]: reference || '',
          [`studentPayments.${studentId}.voucherAmount`]: Math.max(0, Number(voucherAmount || 0)),
          [`studentPayments.${studentId}.voucherDescription`]: (voucherDescription || '').trim()
        };
        const result = await updatePayable(payableId, updateObj);
        if (!result.success) {
          throw new Error(result.error || 'Failed to update payable ' + payableId);
        }

        const previousPaid = Number(change.currentPaid || 0);
        const totalPaidAfter = Number(newTotalPaid || 0);
        const computedBalanceAfter = Math.max(0, effectivePayableAmount - totalPaidAfter);

        const { otherPayables, totalOtherBalance } = getOtherOutstandingPayables(
          studentSnapshot,
          payableId,
          updatedPaidByPayable
        );

        // Always prepare a printable preview so confirm action consistently opens the receipt modal.
        lastReceiptPreview = {
          receiptNumber: '—',
          studentName: studentSnapshot.name,
          date: formatDateFull(paymentDate),
          course: studentSnapshot.course || studentSnapshot.program || 'BSCS',
          yearLevel: studentSnapshot.yearLevel || '',
          description: payable.type || change.type,
          amount: Number(newPayment || 0),
          price: Number(effectivePayableAmount || 0),
          previousPaid,
          totalPaid: totalPaidAfter,
          balance: computedBalanceAfter,
          mode: mode || 'cash',
          reference: reference || '',
          otherPayables,
          totalOtherBalance,
          receivedBy:  ''
        };

        // Record the transaction
        if (newPayment > 0) {
          receiptLineItems.push({
            payableId,
            description: payable.type || change.type,
            price: Number(effectivePayableAmount || 0),
            previousBalance: Math.max(0, Number(effectivePayableAmount || 0) - previousPaid),
            payment: Number(newPayment || 0),
            balance: Math.max(0, effectivePayableAmount - totalPaidAfter),
            voucherAmount: Math.max(0, Number(voucherAmount || 0)),
            voucherDescription: (voucherDescription || '').trim(),
            mode: mode || 'cash',
            reference: reference || ''
          });

          paymentsToCreate.push({
            studentId,
            payableId,
            amount: newPayment,
            mode: mode || 'cash',
            reference: reference || '',
            description: `Payment for ${change.type}`,
            date: paymentDate.toISOString(),
            balanceAfter: Math.max(0, effectivePayableAmount - totalPaidAfter),
            totalPrice: Number(effectivePayableAmount || 0),
            voucherAmount: Math.max(0, Number(voucherAmount || 0)),
            voucherDescription: (voucherDescription || '').trim(),
            previousPaid,
            totalPaidAfter,
          });
        }
      }

      if (paymentsToCreate.length > 0) {
        let receiptNumber = null;
        let receiptId = null;

        const receiptModes = Array.from(new Set(receiptLineItems.map((item) => item.mode).filter(Boolean)));
        const receiptReferences = Array.from(new Set(receiptLineItems.map((item) => item.reference).filter(Boolean)));
        const payableIdsOnReceipt = new Set(receiptLineItems.map((item) => item.payableId));

        try {
          receiptNumber = await generateReceiptNumber(db, paymentDate);
          const receiptRecord = {
            receiptNumber,
            studentId,
            studentName: studentSnapshot.name,
            date: paymentDate.toISOString(),
            formattedDate: formatDateFull(paymentDate),
            course: studentSnapshot.course || studentSnapshot.program || 'BSCS',
            yearLevel: studentSnapshot.yearLevel || '',
            items: receiptLineItems.map((item) => ({ description: item.description, amount: item.payment })),
            amount: receiptLineItems.reduce((sum, item) => sum + Number(item.payment || 0), 0),
            mode: receiptModes.length === 1 ? receiptModes[0] : 'mixed',
            cashierId: currentUser?.uid || null
          };
          receiptId = await createReceiptRecord(db, receiptRecord);
        } catch (err) {
          console.warn('Failed to generate combined receipt for payment:', err);
        }

        for (const payment of paymentsToCreate) {
          await createStudentPayment({
            ...payment,
            receiptNumber,
            receiptId,
          });
        }

        const studentPayables = getStudentPayables(studentSnapshot);
        const otherPayables = studentPayables
          .filter((payable) => !payableIdsOnReceipt.has(payable.id))
          .map((payable) => {
            const defaultPaidAmount = Number(payable.studentPayments?.[studentId]?.paidAmount || 0);
            const overriddenPaidAmount = updatedPaidByPayable?.[payable.id];
            const paidAmount = typeof overriddenPaidAmount === 'number' ? overriddenPaidAmount : defaultPaidAmount;
            const voucherAmount = Math.max(0, Number(payable.studentPayments?.[studentId]?.voucherAmount || 0));
            const totalAmount = Math.max(0, Number(payable.amount || 0) - voucherAmount);
            const remainingBalance = Math.max(0, totalAmount - paidAmount);
            return {
              payableId: payable.id,
              type: payable.type || 'Payable',
              remainingBalance
            };
          })
          .filter((item) => item.remainingBalance > 0)
          .sort((a, b) => b.remainingBalance - a.remainingBalance);

        const totalOtherBalance = otherPayables.reduce((sum, item) => sum + item.remainingBalance, 0);

        lastReceiptPreview = {
          receiptNumber: receiptNumber || '—',
          studentName: studentSnapshot.name,
          date: formatDateFull(paymentDate),
          course: studentSnapshot.course || studentSnapshot.program || 'BSCS',
          yearLevel: studentSnapshot.yearLevel || '',
          description: receiptLineItems.length === 1 ? receiptLineItems[0].description : `${receiptLineItems.length} payables`,
          amount: receiptLineItems.reduce((sum, item) => sum + Number(item.payment || 0), 0),
          price: receiptLineItems.reduce((sum, item) => sum + Number(item.price || 0), 0),
          previousPaid: receiptLineItems.reduce((sum, item) => sum + Math.max(0, Number(item.previousBalance || 0)), 0),
          totalPaid: receiptLineItems.reduce((sum, item) => sum + Number(item.payment || 0), 0),
          balance: receiptLineItems.reduce((sum, item) => sum + Math.max(0, Number(item.balance || 0)), 0),
          mode: receiptModes.length === 1 ? receiptModes[0] : '',
          reference: receiptReferences.length === 1 ? receiptReferences[0] : '',
          items: receiptLineItems.map((item) => ({
            payableId: item.payableId,
            description: item.description,
            price: item.price,
            previousBalance: item.previousBalance,
            payment: item.payment,
            balance: item.balance,
            voucherAmount: item.voucherAmount,
            voucherDescription: item.voucherDescription,
          })),
          otherPayables,
          totalOtherBalance,
          receivedBy: ''
        };
      }

      setSuccess('Payments confirmed successfully');
      // Close all modals
      setSummaryModalOpen(false);
      setStudentModalOpen(false);
      setSelectedStudentModal(null);
      setStagedPayments({});
      setStagedPaymentModes({});
      setStagedPaymentReferences({});
      setStagedVouchers({});
      // reload payables to reflect persisted state
      await loadPayables();

      if (lastReceiptPreview) {
        setReceiptData(lastReceiptPreview);
        setReceiptModalOpen(true);
      }
    } catch (error) {
      setError('Failed to confirm payments: ' + error.message);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDiscardStagedPayments = () => {
    setStagedPayments({});
    setStagedPaymentModes({});
    setStagedPaymentReferences({});
    setStagedVouchers({});
  };

  // Collect a student's payables: all current-year payables plus any individual
  // previous balances across all years that belong to the student.
  const getStudentPayables = useCallback((student) => {
    if (!student || !payables) return [];
    let basePayables = [];
    if (student.isIrregular) {
      basePayables = (payables[student.yearLevel] || []).concat(payables['irregular'] || []).concat(payables['all'] || []);
    } else {
      basePayables = (payables[student.yearLevel] || []).concat(payables['all'] || []);
    }
    const individualAcrossYears = Object.values(payables)
      .flat()
      .filter(p => p.isIndividual && p.studentId === student.id);
    const merged = {};
    basePayables.forEach(p => {
      if (!p.isIndividual) {
        merged[p.id] = p;
      } else if (p.studentId === student.id) {
        merged[p.id] = p;
      }
    });
    individualAcrossYears.forEach(p => { merged[p.id] = p; });
    return Object.values(merged);
  }, [payables]);

  const getOtherOutstandingPayables = useCallback((student, currentPayableId, updatedPaidByPayable = {}) => {
    if (!student) return { otherPayables: [], totalOtherBalance: 0 };

    const studentPayables = getStudentPayables(student);
    const otherPayables = studentPayables
      .filter((payable) => payable.id !== currentPayableId)
      .map((payable) => {
        const defaultPaidAmount = Number(payable.studentPayments?.[student.id]?.paidAmount || 0);
        const voucherAmount = Math.max(0, Number(payable.studentPayments?.[student.id]?.voucherAmount || 0));
        const overriddenPaidAmount = updatedPaidByPayable?.[payable.id];
        const paidAmount = typeof overriddenPaidAmount === 'number' ? overriddenPaidAmount : defaultPaidAmount;
        const totalAmount = Math.max(0, Number(payable.amount || 0) - voucherAmount);
        const remainingBalance = Math.max(0, totalAmount - paidAmount);

        return {
          payableId: payable.id,
          type: payable.type || 'Payable',
          remainingBalance
        };
      })
      .filter((item) => item.remainingBalance > 0)
      .sort((a, b) => b.remainingBalance - a.remainingBalance);

    const totalOtherBalance = otherPayables.reduce((sum, item) => sum + item.remainingBalance, 0);
    return { otherPayables, totalOtherBalance };
  }, [getStudentPayables]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'fully_paid':
        return 'success';
      case 'partially_paid':
        return 'warning';
      case 'unpaid':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'fully_paid':
        return 'Fully Paid';
      case 'partially_paid':
        return 'Partially Paid';
      case 'unpaid':
        return 'Unpaid';
      default:
        return 'Unknown';
    }
  };

  const getFormattedDate = (dateValue) => {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return '';
    const month = d.toLocaleString('en-US', { month: 'short' });
    return `${month}. ${d.getDate()}, ${d.getFullYear()}`;
  };

  const formatDateFull = (date) => {
    const d = new Date(date);
    const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const openReceiptForPayment = useCallback(async (student, payable, payment) => {
    if (!payment) return;

    let transactionPayments = [payment];
    const receiptNumber = (payment.receiptNumber || '').toString().trim();

    if (student?.id && receiptNumber && receiptNumber !== '—') {
      try {
        const allPaymentsResult = await getAllStudentPayments(student.id);
        if (allPaymentsResult.success) {
          const matched = (allPaymentsResult.data || []).filter((p) => (p.receiptNumber || '').toString().trim() === receiptNumber);
          if (matched.length > 0) {
            transactionPayments = matched;
          }
        }
      } catch (err) {
        console.warn('Failed to load grouped receipt payments:', err);
      }
    }

    const payablesById = Object.values(payables)
      .flat()
      .reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

    const receiptPayableIds = new Set();
    const receiptItems = transactionPayments.map((entry, idx) => {
      const payableId = entry.payableId || payable?.id || `item-${idx}`;
      if (payableId) receiptPayableIds.add(payableId);

      const payableInfo = payablesById[payableId] || payable;
      const rowPrice = Number(entry.price ?? entry.totalPrice ?? payableInfo?.amount ?? 0);
      const rowPayment = Number(entry.amount || 0);
      const rowPreviousPaid = Number(entry.previousPaid ?? 0);
      const rowBalance = Number(entry.balanceAfter ?? entry.balance ?? Math.max(0, rowPrice - (rowPreviousPaid + rowPayment)));

      return {
        payableId,
        description: payableInfo?.type || entry.description || 'Payment',
        price: rowPrice,
        previousBalance: Math.max(0, rowPrice - rowPreviousPaid),
        payment: rowPayment,
        balance: Math.max(0, rowBalance),
        voucherAmount: Math.max(0, Number(entry.voucherAmount || 0)),
        voucherDescription: (entry.voucherDescription || '').trim(),
      };
    });

    const totalPrice = receiptItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
    const totalPreviousBalance = receiptItems.reduce((sum, item) => sum + Number(item.previousBalance || 0), 0);
    const totalPayment = receiptItems.reduce((sum, item) => sum + Number(item.payment || 0), 0);
    const totalBalance = receiptItems.reduce((sum, item) => sum + Number(item.balance || 0), 0);

    const modes = Array.from(new Set(transactionPayments.map((p) => p.mode || p.method || p.paymentMode).filter(Boolean)));
    const references = Array.from(new Set(transactionPayments.map((p) => p.reference).filter(Boolean)));

    const studentPayables = getStudentPayables(student || {});
    const otherPayables = studentPayables
      .filter((p) => !receiptPayableIds.has(p.id))
      .map((p) => {
        const paidAmount = Number(p.studentPayments?.[student?.id]?.paidAmount || 0);
        const voucherAmount = Math.max(0, Number(p.studentPayments?.[student?.id]?.voucherAmount || 0));
        const totalAmount = Math.max(0, Number(p.amount || 0) - voucherAmount);
        const remainingBalance = Math.max(0, totalAmount - paidAmount);
        return {
          payableId: p.id,
          type: p.type || 'Payable',
          remainingBalance,
        };
      })
      .filter((item) => item.remainingBalance > 0)
      .sort((a, b) => b.remainingBalance - a.remainingBalance);
    const totalOtherBalance = otherPayables.reduce((sum, item) => sum + item.remainingBalance, 0);

    const paymentDateRaw = transactionPayments[0]?.date || transactionPayments[0]?.createdAt || payment.date || new Date().toISOString();
    const paymentDate = new Date(paymentDateRaw);
    const safeDate = Number.isNaN(paymentDate.getTime()) ? new Date() : paymentDate;

    setReceiptData({
      receiptNumber: receiptNumber || '—',
      studentName: student?.name || '—',
      date: formatDateFull(safeDate),
      course: student?.course || student?.program || 'BSCS',
      yearLevel: student?.yearLevel || '',
      description: receiptItems.length === 1 ? receiptItems[0].description : `${receiptItems.length} payables`,
      amount: totalPayment,
      price: totalPrice,
      previousPaid: totalPreviousBalance,
      totalPaid: totalPayment,
      balance: totalBalance,
      items: receiptItems,
      mode: modes.length === 1 ? modes[0] : '',
      reference: references.length === 1 ? references[0] : '',
      otherPayables,
      totalOtherBalance,
      receivedBy:  ''
    });
    setReceiptModalOpen(true);
  }, [getStudentPayables, payables]);

  // Stage paid amount changes locally. Changes will not be saved until user clicks Confirm.
  const handleStagedPaidAmountChange = useCallback((payableId, newValue) => {
    if (newValue === '') {
      setStagedPayments(prev => ({
        ...prev,
        [payableId]: ''
      }));
      return;
    }

    const newPaymentAmount = Number(newValue);
    if (!Number.isFinite(newPaymentAmount) || newPaymentAmount < 0) return;

    // Keep input responsive while typing; overpayment cap is applied in summary/confirm.
    setStagedPayments(prev => ({
      ...prev,
      [payableId]: newValue
    }));
  }, []);

  const calculateTotalBalance = useCallback((studentId) => {
    if (!studentId || !payables) return 0;
    const student = students.find(s => s.id === studentId);
    if (!student) return 0;
    const studentPayables = getStudentPayables(student);
    return studentPayables.reduce((total, payable) => {
      const studentPayment = payable.studentPayments?.[studentId] || { status: 'unpaid', paidAmount: 0 };
      const stagedPaid = stagedPayments?.[payable.id];
      const voucher = getVoucherData(payable, studentId);
      const paidAmount = typeof stagedPaid !== 'undefined' ? Number(stagedPaid) : Number(studentPayment.paidAmount || 0);
      const payableAmount = Math.max(0, (Number(payable.amount) || 0) - voucher.amount);
      const status = typeof stagedPaid !== 'undefined'
        ? (paidAmount >= payableAmount ? 'fully_paid' : (paidAmount > 0 ? 'partially_paid' : 'unpaid'))
        : studentPayment.status;
      if (status === 'unpaid' || status === 'partially_paid') {
        return total + Math.max(0, payableAmount - paidAmount);
      }
      return total;
    }, 0);
  }, [payables, stagedPayments, students, getStudentPayables, getVoucherData]);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (document.documentElement) {
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (document.body) {
      document.body.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const rootElement = document.getElementById('root');
    if (rootElement && typeof rootElement.scrollTo === 'function') {
      rootElement.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const mainElement = document.querySelector('main');
    if (mainElement && typeof mainElement.scrollTo === 'function') {
      mainElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 1. Remove all payment dialog/modal state and handlers (studentPaymentDialogOpen, selectedPayableForPayment, selectedStudentForPayment, studentPaymentForm, handleStudentPaymentClick, handleStudentPaymentFormChange, handleSaveStudentPayment, handleMarkAsFullyPaid, and their usages)
  // 2. In the payables table, always render the paid amount as a TextField (not just in edit mode)
  // 3. On change, update Firestore immediately
  // 4. Remove the Record Payment modal JSX
  // 5. Remove any references to the old modal-based payment workflow

  const renderStudentList = () => (
    <div>

       <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map(year => (
            <button
              key={year}
              className={`
                px-3 py-1.5 font-semibold rounded-full shadow-md border transition-all flex items-center gap-1 text-sm cursor-pointer
                ${tabValue === year - 1 
                  ? 'bg-blue-600 text-white border-blue-700 scale-105'
                  : 'bg-white text-blue-700 hover:bg-blue-100 border-gray-300'
                }
                hover:border-blue-600
              `}
              onClick={() => setTabValue(year - 1)}
            >
              {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year
            </button>
          ))}

          <button
            className={`
              px-3 py-1.5 font-semibold rounded-full shadow-md border transition-all flex items-center gap-1 text-sm cursor-pointer
              ${tabValue === 4
                ? 'bg-blue-600 text-white border-blue-700 scale-105'
                : 'bg-white text-blue-700 hover:bg-blue-100 border-gray-300'
              }
              hover:border-blue-600
            `}
            onClick={() => setTabValue(4)}
          >
            Irregular Students
          </button>
        </div>

        {/* Search + Add */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search students by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
</div>
          <button
            className="px-3 py-1.5 bg-green-600 cursor-pointer  text-sm text-white rounded-full hover:bg-green-700 "
            onClick={handleAddPayable}
          >
            <BadgePlus className='w-4 h-4 inline-flex mr-1 mb-0.5' />
            Add Payables
          </button>
        </div>
      </div>

      {/* Student Display */}
      <div>
        {(() => {
          let filteredStudents;
          if (tabValue === 4) {
            // Show only irregular students
            filteredStudents = students.filter(student => student.isIrregular);
          } else {
            // Show students by year level, excluding irregular students
            filteredStudents = students.filter(student => student.yearLevel === (tabValue + 1) && !student.isIrregular);
          }
          if (searchTerm) {
            filteredStudents = filteredStudents.filter(student => 
              student.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
          }
          // Sort students (defensive for missing fields)
          filteredStudents.sort((a, b) => {
            const balanceA = calculateTotalBalance(a.id);
            const balanceB = calculateTotalBalance(b.id);
            const nameA = (a.name || '').toString();
            const nameB = (b.name || '').toString();
            const idA = (a.studentNumber || '').toString();
            const idB = (b.studentNumber || '').toString();
            switch (sortBy) {
              case 'name-asc':
                return nameA.localeCompare(nameB);
              case 'name-desc':
                return nameB.localeCompare(nameA);
              case 'balance-asc':
                return balanceA - balanceB;
              case 'balance-desc':
                return balanceB - balanceA;
              case 'id-asc':
                return idA.localeCompare(idB);
              case 'id-desc':
                return idB.localeCompare(idA);
              default:
                return 0;
            }
          });
          if (filteredStudents.length === 0) {
            return (
              <div className="text-center py-8">
                <h6 className="text-lg text-gray-600 mb-2">
                  {searchTerm ? 'No students found' : tabValue === 4 ? 'No irregular students' : `No students in Year ${tabValue + 1}`}
                </h6>
                <p className="text-sm text-gray-600">
                  {searchTerm ? 'Try adjusting your search terms' : 'No students available for payment management'}
                </p>
              </div>
            );
          }
          // For displaying payable counts, we need to be careful:
          // For irregular tab (4), we can't determine a single "year payables" set
          // since irregular students can be from different years.
          // For now, we'll compute payables per student in the rendering logic.
          if (viewMode === 'grid') {
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredStudents.map((student) => {
                  const totalBalance = calculateTotalBalance(student.id);
                  return (
                    <div 
                    key={student.id}
                    className={`p-4 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg border border-gray-300 bg-white rounded-lg`}
                    onClick={() => {
                      setSelectedStudentModal(student);
                      setStudentModalOpen(true);
                      // Clear any staged payments when opening a new student modal
                      setStagedPayments({});
                      setStagedVouchers({});
                      setPayablesFilter('all');
                      setPayablesViewMode('list');
                      setPayablesSearch('');
                    }}
                  >
                    <div className="flex flex-col gap-1">
                      <h6 className="text-lg font-bold">{student.name}</h6>
                    
                      <h5 className={`text-2xl font-bold text-center ${totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ₱{totalBalance.toLocaleString()}
                      </h5>
                      <p className="text-xs text-gray-600 text-center">
                        {totalBalance > 0 ? 'Outstanding Balance' : 'All Paid'}
                      </p>
                      <button
                        className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 mt-2"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setSelectedStudentForTransactions(student);
                          setStudentTransactionsModalOpen(true);
                          // Load all transactions for the student
                          const result = await getAllStudentPayments(student.id);
                          if (result.success) {
                            setStudentTransactions(result.data);
                          } else {
                            setError(result.error);
                          }
                        }}
                      >
                        View Transactions
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            );
          } else {
            // List view
            return (
              <div className="bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden">
                <table className="w-full table-auto">
                 <thead className="bg-blue-600 text-white text-sm">
  <tr>
    {/* Student ID */}
    <th
      className="p-3 text-left cursor-pointer hover:bg-blue-700 transition-colors select-none w-[20%]"
      onClick={() => setSortBy(sortBy === 'id-asc' ? 'id-desc' : 'id-asc')}
    >
      <div className="flex items-center gap-2">
        <span>Student ID</span>
        {sortBy === 'id-asc' ? (
          <ChevronUp className="w-4 h-4" />
        ) : sortBy === 'id-desc' ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronsUpDown className="w-4 h-4 opacity-70" />
        )}
      </div>
    </th>

    {/* Student Name */}
    <th
      className="p-3 text-left cursor-pointer hover:bg-blue-700 transition-colors select-none w-[40%]"
      onClick={() => setSortBy(sortBy === 'name-asc' ? 'name-desc' : 'name-asc')}
    >
      <div className="flex items-center gap-2">
        <span>Student Name</span>
        {sortBy === 'name-asc' ? (
          <ChevronUp className="w-4 h-4" />
        ) : sortBy === 'name-desc' ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronsUpDown className="w-4 h-4 opacity-70" />
        )}
      </div>
    </th>

    {/* Total Balance */}
    <th
      className="p-3 text-left cursor-pointer hover:bg-blue-700 transition-colors select-none w-[20%]"
      onClick={() => setSortBy(sortBy === 'balance-asc' ? 'balance-desc' : 'balance-asc')}
    >
      <div className="flex items-center gap-2">
        <span>Total Balance</span>
        {sortBy === 'balance-asc' ? (
          <ChevronUp className="w-4 h-4" />
        ) : sortBy === 'balance-desc' ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronsUpDown className="w-4 h-4 opacity-70" />
        )}
      </div>
    </th>

    {/* Status */}
    <th className="p-3 text-center w-[20%]">Status</th>
  </tr>
</thead>
                  <tbody className='text-sm'>
                    {filteredStudents.map((student, index) => {
                      const totalBalance = calculateTotalBalance(student.id);
                      return (
                        <tr 
                          key={student.id} 
                          className={`cursor-pointer transition-all duration-200 hover:bg-blue-50 hover:shadow-sm border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                          onClick={() => {
                            setSelectedStudentModal(student);
                            setStudentModalOpen(true);
                            setStagedPayments({});
                            setStagedVouchers({});
                            setPayablesFilter('all');
                            setPayablesViewMode('list');
                            setPayablesSearch('');
                          }}
                        >
                          <td className="p-2">{student.studentNumber}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              {student.name}
                            
                            </div>
                          </td>
                          <td className="p-2">
                            <span className={`font-bold ${totalBalance > 0 ? 'text-red-700  ' : 'text-green-700'}`}>
                              ₱{totalBalance.toLocaleString()}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${totalBalance > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                              {totalBalance > 0 ? 'Outstanding' : 'Paid'}
                            </span>
                          </td>
                          
                        </tr>
                      );
                    })}
                    <tr className="bg-blue-50 font-semibold text-blue-900 border-t-2 border-blue-200">
                      <td colSpan={2} className="py-1.5 x-3 text-right w-[60%]">Total Outstanding Balance</td>
                      <td className="px-2 py-3 text-left font-bold ">
                        ₱{filteredStudents.reduce((sum, student) => sum + calculateTotalBalance(student.id), 0).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          }
        })()}
      </div>
    </div>
  );

  // Global header handles sign out now

  return (
    <div className="p-4">
      {!currentUser && (
        <div className="mx-3 mb-2 p-4 bg-blue-50 border border-blue-200 rounded text-blue-800">
          Please sign in to access the Payables System
        </div>
      )}
      
      {error && <div className="mx-3 mb-2 p-4 bg-red-50 border border-red-200 rounded text-red-800">{error}</div>}
      {success && <div className="mx-3 mb-2 p-4 bg-green-50 border border-green-200 rounded text-green-800">{success}</div>}
      
      {currentUser ? (
        <div className=" max-w-7xl mx-auto">
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-300 mb-10">
            <div className="flex items-center gap-6">
              <button
                onClick={onBackToDashboard}
            className="group cursor-pointer flex items-center gap-2 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white transition-transform"
              >
            <ArrowBigLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              </button>
              <div className="flex flex-col ">
              <h5 className="text-2xl font-bold text-blue-600">
                  Payables Management System
                </h5>
                <p className=" text-gray-600">
                  Manage invoices, track payments, and handle financial transactions for the institution
                </p>
              </div>
            </div>
          </div>
          <div>
            {renderStudentList()}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="p-4 text-center border border-gray-200 rounded bg-gray-50">
            <p className="text-lg text-gray-600">
              Sign in to access payment management features
            </p>
          </div>
        </div>
      )}

      {/* Add Payable Dialog */}
      {addPayableDialogOpen && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] bg-opacity-50" onClick={() => {
            setAddPayableDialogOpen(false);
            setEditingMode(false);
            setNewPayableForm({
              type: '',
              amount: '',
              status: 'unpaid',
              paidAmount: '0',
              yearLevel: 'all'
            });
          }}></div>
          <div className="bg-white rounded-2xl  shadow-lg p-8 max-w-md w-full overflow-y-auto relative z-10">
            <h2 className="text-lg font-medium mb-4">
              {editingMode ? 'Edit Payable' : 'Add New Payable'}
             
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Target Year Level</label>
                <select
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  value={newPayableForm.yearLevel}
                  onChange={(e) => handleNewPayableInputChange('yearLevel', e.target.value)}
                  disabled={editingMode} // Disable changing target when editing
                >
                  <option value="all">All Students</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                  <option value="irregular">Irregular Students</option>
                  
                </select>
              </div>

              <label className="block text-sm font-medium mb-1">Payable Type</label>
              <input
                type="text"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                placeholder="Type (e.g., Tuition Fee, Miscellaneous)"
                value={newPayableForm.type}
                onChange={(e) => handleNewPayableInputChange('type', e.target.value)}
              />
              
             <label className="block text-sm font-medium mb-1">Amount</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., 1500.00"
                value={newPayableForm.amount}
                onChange={(e) => handleNewPayableInputChange('amount', e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button 
                onClick={() => {
                  setAddPayableDialogOpen(false);
                  setEditingMode(false);
                  setNewPayableForm({
                    type: '',
                    amount: '',
                    status: 'unpaid',
                    paidAmount: '0',
                    yearLevel: 'all'
                  });
                }} 
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveNewPayable} 
                className="px-6 py-1.5 rounded-full cursor-pointer text-sm bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!newPayableForm.type || !newPayableForm.amount || loading}
              >
                {loading ? (editingMode ? 'Updating...' : 'Adding...') : (editingMode ? 'Update Payable' : 'Add Payable')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Creation Dialog */}
      {paymentDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setPaymentDialogOpen(false)}></div>
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto relative z-10">
            <h2 className="text-xl font-bold mb-4">
              Create Payment Record
              {selectedStudentModal && (
                <p className="text-sm text-gray-600">
                  For: {selectedStudentModal.name}
                </p>
              )}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Payment Type</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded"
                  value={paymentForm.paymentType}
                  onChange={(e) => handlePaymentInputChange('paymentType', e.target.value)}
                >
                  <option value="tuition">Tuition Fee</option>
                  <option value="miscellaneous">Miscellaneous</option>
                  <option value="laboratory">Laboratory Fee</option>
                  <option value="library">Library Fee</option>
                </select>
              </div>
              
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="w-full p-2 border border-gray-300 rounded show-spinner"
                placeholder="Amount"
                value={paymentForm.amount}
                onChange={(e) => handlePaymentInputChange('amount', e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
              />
              
              <textarea
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="Description"
                value={paymentForm.description}
                onChange={(e) => handlePaymentInputChange('description', e.target.value)}
                rows={2}
              />
              
              <input
                type="date"
                className="w-full p-2 border border-gray-300 rounded"
                value={paymentForm.dueDate}
                onChange={(e) => handlePaymentInputChange('dueDate', e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPaymentDialogOpen(false)} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
                Cancel
              </button>
              <button 
                onClick={handleSavePayment} 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                disabled={!paymentForm.amount || !paymentForm.description || loading}
              >
                {loading ? 'Creating...' : 'Create Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Payment Dialog */}
      {/* 4. Remove the Record Payment modal JSX */}
      {/* 5. Remove any references to the old modal-based payment workflow */}

      {/* Student Details Modal */}
      {studentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] bg-opacity-50" onClick={() => {
            setStudentModalOpen(false);
            setSelectedStudentModal(null);
            setStagedPayments({});
          }}></div>
          <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full max-h-160 relative z-10 flex flex-col overflow-hidden">
            <div className="flex items-center px-6 py-4 justify-between shadow-b shadow-2xs  sticky top-0 z-20 bg-blue-100">
              <div>
                <h2 className="text-xl font-bold">
                  {selectedStudentModal?.name}
                  {selectedStudentModal?.isIrregular && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 ml-2">
                      Irregular
                    </span>
                  )}
                </h2>
                <p className="text-sm text-gray-600">
                  {selectedStudentModal?.isIrregular 
                    ? `Irregular Student (${selectedStudentModal.yearLevel === 1 ? '1st' : selectedStudentModal.yearLevel === 2 ? '2nd' : selectedStudentModal.yearLevel === 3 ? '3rd' : '4th'} Year Level) `
                    : `${tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year Student `
                  }
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  className="px-2 py-1.5 text-sm bg-green-600 cursor-pointer text-white rounded-full hover:bg-green-700 disabled:opacity-50"
                  onClick={handleAddIndividualPayable}
                >
                  <BadgePlus className='w-4 h-4 inline-flex mr-1 mb-0.5' />
                  Add Previous Balance
                </button>
               
              </div>
            </div>
            <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
              {/* Payables controls: search, filter, view mode */}
              <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
                <div className="flex-1 flex items-center gap-2">
                  <div className="relative w-full md:max-w-sm">
                    <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input
                      type="text"
                      className="w-full pl-9 pr-3 py-1.5 border text-sm border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Search payables by type..."
                      value={payablesSearch}
                      onChange={(e) => setPayablesSearch(e.target.value)}
                    />
                  </div>
                 
                </div>
               <div className="flex items-center gap-2">
                    <Funnel className="w-4 h-4 text-gray-600" />
                    <select
                      className="px-2 py-1.5 border border-gray-300 rounded-full focus-outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={payablesFilter}
                      onChange={(e) => setPayablesFilter(e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="partially_paid">Partially Paid</option>
                      <option value="fully_paid">Fully Paid</option>
                      <option value="individual">Individual Only</option>
                    </select>
                  </div>
              </div>

              {(() => {
                // Base set: current-year payables + any individual previous balances across all years
                const base = selectedStudentModal ? getStudentPayables(selectedStudentModal) : [];
                // Apply search
                let list = base.filter(p => (p.type || '').toLowerCase().includes((payablesSearch || '').toLowerCase()))
                  // Apply filter
                  .filter(p => {
                    if (payablesFilter === 'all') return true;
                    if (payablesFilter === 'individual') return !!p.isIndividual;
                    const st = p.studentPayments?.[selectedStudentModal?.id]?.status || 'unpaid';
                    return st === payablesFilter;
                  });

                if (list.length === 0) {
                  return (
                    <div className="text-center py-6">
                      <p className="text-gray-600">No payables match your filters.</p>
                    </div>
                  );
                }

                const renderCard = (payable) => {
                  const studentPayment = payable.studentPayments?.[selectedStudentModal?.id] || { status: 'unpaid', paidAmount: 0 };
                  const voucher = getVoucherData(payable, selectedStudentModal?.id);
                  const stagedVoucher = stagedVouchers?.[payable.id] || {};
                  const hasVoucherAmount = Object.prototype.hasOwnProperty.call(stagedVoucher, 'amount');
                  const hasVoucherDescription = Object.prototype.hasOwnProperty.call(stagedVoucher, 'description');
                  const voucherEnabled = voucher.enabled;
                  const voucherAmountInput = hasVoucherAmount
                    ? stagedVoucher.amount
                    : (Number(studentPayment.voucherAmount || 0) > 0 ? String(studentPayment.voucherAmount) : '');
                  const voucherDescriptionInput = hasVoucherDescription
                    ? (stagedVoucher.description || '')
                    : (studentPayment.voucherDescription || '');
                  const stagedPayment = stagedPayments?.[payable.id] || 0;
                  const totalPaid = studentPayment.paidAmount + stagedPayment;
                  const effectivePayableAmount = Math.max(0, Number(payable.amount || 0) - voucher.amount);
                  const remaining = Math.max(0, effectivePayableAmount - totalPaid);
                  return (
                    <div key={payable.id} className="border border-gray-200 rounded-xl shadow p-4 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-1 mb-1">
                            <h4 className="text-lg font-bold">{payable.type}</h4>
                            {payable.isIndividual && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Individual Charge
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            Total Amount: ₱{Number(payable.amount || 0).toLocaleString()}
                          </p>
                          {voucher.amount > 0 && (
                            <p className="text-xs text-emerald-700 font-medium">
                              Voucher: -₱{voucher.amount.toLocaleString()} | Net Amount: ₱{effectivePayableAmount.toLocaleString()}
                            </p>
                          )}
                        </div>
                        <span className={`inline-flex mr-1 items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(studentPayment.status) === 'success' ? 'bg-green-100 text-green-800 border border-green-300' : getStatusColor(studentPayment.status) === 'warning' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                          {getStatusLabel(studentPayment.status)}
                        </span>

                       

                      </div>
                      <div>
                       
                       <div className='flex items-center justify-between mb-1'>
                        <div className="flex items-center text-xs">
                        <span className='mr-2'>Mode of Payment:</span>

                        <div className="flex items-center ">
                          <input
                            id={`paymentMode-cash-${payable.id}`}
                            name={`paymentMode-${payable.id}`}
                            type="radio"
                            value="cash"
                            checked={(stagedPaymentModes?.[payable.id] || 'cash') === 'cash'}
                            onChange={() => setStagedPaymentModes(prev => ({ ...prev, [payable.id]: 'cash' }))}
                          />
                          <label
                            htmlFor={`paymentMode-cash-${payable.id}`}
                            className="text-xs cursor-pointer ml-1 mr-2"
                          >
                            Cash
                          </label>

                          <input
                            id={`paymentMode-gcash-${payable.id}`}
                            name={`paymentMode-${payable.id}`}
                            type="radio"
                            value="gcash"
                            checked={(stagedPaymentModes?.[payable.id] || 'cash') === 'gcash'}
                            onChange={() => setStagedPaymentModes(prev => ({ ...prev, [payable.id]: 'gcash' }))}
                          />
                          <label
                            htmlFor={`paymentMode-gcash-${payable.id}`}
                            className="text-xs cursor-pointer ml-1 mr-2"
                          >
                            GCash
                          </label>

                          <input
                            id={`paymentMode-bank-${payable.id}`}
                            name={`paymentMode-${payable.id}`}
                            type="radio"
                            value="bank"
                            checked={(stagedPaymentModes?.[payable.id] || 'cash') === 'bank'}
                            onChange={() => setStagedPaymentModes(prev => ({ ...prev, [payable.id]: 'bank' }))}
                          />
                          <label
                            htmlFor={`paymentMode-bank-${payable.id}`}
                            className="text-xs cursor-pointer ml-1"
                          >
                            Bank Transfer
                          </label>
                        </div>
                      </div>

                       <div className="flex items-center gap-0.5">
                        <button
                          className="p-1.5 cursor-pointer rounded-full text-gray-700 hover:bg-gray-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenuId(null);
                            handleStartEditPayables(payable.id);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 cursor-pointer rounded-full text-gray-700 hover:bg-gray-200"
                          onClick={async (e) => {
                            e.stopPropagation();
                            setOpenActionMenuId(null);
                            setTransactionPayable(payable);
                            setTransactionModalOpen(true);
                            const result = await getStudentPayments(selectedStudentModal.id, payable.id);
                            if (result.success) {
                              setTransactionPayments(result.data);
                            } else {
                              setError(result.error);
                            }
                          }}
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 cursor-pointer rounded-full text-gray-700 hover:bg-gray-200"
                          onClick={async (e) => {
                            e.stopPropagation();
                            setOpenActionMenuId(null);
                            const result = await getStudentPayments(selectedStudentModal.id, payable.id);
                            if (!result.success) {
                              setError(result.error);
                              return;
                            }
                            const latest = (result.data || [])[0];
                            if (!latest) {
                              setError('No transactions to print yet.');
                              return;
                            }
                            const totalPrice = Number(payable.amount) || 0;
                            const totalPaidAll = (result.data || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                            const balanceAfter = Math.max(0, totalPrice - totalPaidAll);
                            const previousPaid = Math.max(0, totalPaidAll - (Number(latest.amount) || 0));
                            openReceiptForPayment(selectedStudentModal, payable, {
                              ...latest,
                              price: totalPrice,
                              previousPaid,
                              totalPaid: totalPaidAll,
                              balanceAfter
                            });
                          }}
                          title="Print latest receipt"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 cursor-pointer rounded-full text-gray-700 hover:bg-gray-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenuId(null);
                            setDeleteTarget(payable);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                       </div>
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          className="w-1/3 flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg show-spinner"
                          placeholder="New Payment Amount"
                          value={stagedPayments?.[payable.id] ?? ''}
                          onChange={(e) => selectedStudentModal && handleStagedPaidAmountChange(payable.id, e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                        />
                        <input
                          type="text"
                          className={`w-2/3 px-2 py-1.5 text-sm border border-gray-300 rounded-lg ${((stagedPaymentModes?.[payable.id] || 'cash') === 'cash') ? 'opacity-50 cursor-not-allowed' : ''}`}
                          placeholder="Reference (e.g., receipt number)"
                          value={stagedPaymentReferences?.[payable.id] || ''}
                          onChange={(e) => setStagedPaymentReferences(prev => ({ ...prev, [payable.id]: e.target.value }))}
                          disabled={(stagedPaymentModes?.[payable.id] || 'cash') === 'cash'}
                        />
                     
                      </div>
                      
                      </div>
                      <div className="w-full mt-2">

                        <div className='flex items-center gap-2 mb-1'>
                          <span className='text-xs '>Apply Voucher:</span>
                          <input
                            type="checkbox"
                            checked={voucherEnabled}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              if (!checked) {
                                setStagedVouchers(prev => ({
                                  ...prev,
                                  [payable.id]: { enabled: false, amount: '', description: '' }
                                }));
                                return;
                              }
                              setStagedVouchers(prev => ({
                                ...prev,
                                [payable.id]: {
                                  enabled: true,
                                  amount: hasVoucherAmount ? stagedVoucher.amount : (studentPayment.voucherAmount ? String(studentPayment.voucherAmount) : ''),
                                  description: hasVoucherDescription ? (stagedVoucher.description || '') : (studentPayment.voucherDescription || '')
                                }
                              }));
                            }}
                          />
                        </div>

                        {/* Voucher Fields */}
                        <div className="flex gap-2 ">

                            {/* Amount */}
                          <input
                            type="number"
                            placeholder="Amount"
                            className={`w-1/3 px-2 py-1.5 text-sm border border-gray-300 rounded-lg show-spinner ${!voucherEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            value={voucherAmountInput}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setStagedVouchers(prev => ({
                                ...prev,
                                [payable.id]: {
                                  ...(prev[payable.id] || {}),
                                  enabled: true,
                                  amount: raw
                                }
                              }));
                            }}
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            disabled={!voucherEnabled}
                          />

                          {/* Description */}
                          <input
                            type="text"
                            placeholder="e.g. Scholarship, Promo"
                            className={`w-2/3 px-2 py-1.5 text-sm border rounded-lg show-spinner ${voucherEnabled && Number(voucherAmountInput || 0) > 0 && !(voucherDescriptionInput || '').trim() ? 'border-red-400' : 'border-gray-300'} ${!voucherEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            value={voucherDescriptionInput}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setStagedVouchers(prev => ({
                                ...prev,
                                [payable.id]: {
                                  ...(prev[payable.id] || {}),
                                  enabled: true,
                                  description: raw
                                }
                              }));
                            }}
                            required={voucherEnabled && Number(voucherAmountInput || 0) > 0}
                            disabled={!voucherEnabled}
                          />

                        

                        </div>

                      </div>
                      
                     
                      <div className="flex items-center justify-between gap-1 mt-4">
                        <p className="text-xs text-gray-600">
                          Remaining: ₱{remaining.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          Last updated: {getFormattedDate(new Date())}
                        </p>
                      </div>
                    </div>
                  );
                };

                if (payablesViewMode === 'grid') {
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {list.map((p) => renderCard(p))}
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col gap-3">
                    {list.map((p) => renderCard(p))}
                  </div>
                );
              })()}
            </div>
            <div className='sticky bottom-0 z-20  flex justify-between gap-4 px-6 py-3 border-t border-gray-300'>
               <h3 className={` font-semibold text-gray-800`}>
                  Total Balance: ₱{selectedStudentModal ? calculateTotalBalance(selectedStudentModal.id).toLocaleString() : '0'}
                </h3>
            <div className="flex items-center justify-end gap-2  ">
            
              <button 
                onClick={() => {
                  setStudentModalOpen(false);
                  setSelectedStudentModal(null);
                  setStagedPayments({});
                  setStagedVouchers({});
                }}
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
              <button 
                onClick={handleShowSummary} 
                className="px-4 py-1.5 rounded-full text-sm cursor-pointer bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={(Object.keys(stagedPayments).length === 0 && Object.keys(stagedVouchers).length === 0) || confirmLoading}
              >
                {confirmLoading ? 'Confirming...' : 'Confirm Changes'}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {summaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] bg-opacity-50" onClick={() => setSummaryModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-md p-8 max-w-2xl w-full max-h-140 overflow-y-auto relative z-10">
            <div className="flex items-center justify-between ">
              <h2 className="text-xl font-bold">Confirm Payment Changes</h2>
              <button
                onClick={() => setSummaryModalOpen(false)}
                className="text-gray-400 hover:text-red-600 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {selectedStudentModal && (
              <p className="text-sm text-gray-600 mb-4">
                For: {selectedStudentModal.name}
              </p>
            )}
            <div className="mb-4">
              {summaryData.changes.length === 0 ? (
                <p className="text-gray-600">
                  No changes to confirm.
                </p>
              ) : (
                <div>
  {summaryData.changes.map((change) => {
    const totalAmount = Number(change.amount || 0);
    const originalAmount = Number(change.originalAmount || change.amount || 0);
    const voucherAmount = Number(change.voucherAmount || 0);
    const prevPaid = Number(change.currentPaid || 0);
    const newPaid = Number(change.newTotalPaid || 0);
    const newPayment = Number(change.newPayment || 0);

    const prevBalance = totalAmount - prevPaid;
    const newBalance = totalAmount - newPaid;

    return (
      <div key={change.payableId} className="border border-gray-200 rounded-2xl p-4 mb-2 shadow-lg bg-white">
        {/* Header: description/type and status */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h4 className="text-lg font-semibold">{change.type}</h4>

          </div>
          <div className="text-right">
            <div
              className={`inline-flex items-center justify-center text-xs font-medium px-2 py-0.5 rounded-full border
              ${
                newPayment > 0
                  ? 'bg-green-100 text-green-700 border-green-300'
                  : 'bg-gray-100 text-gray-500 border-gray-200'
              }`}
            >
              {newPayment > 0 ? 'Paid' : 'No Payment'}
            </div>
          </div>
        </div>

        

        <div className='flex items-start justify-between'>
          {/* Payment Mode Checkboxes */}
        <div className=" flex items-center gap-4 text-xs">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" disabled checked={(change.mode || 'cash') === 'cash'} />
            <span className="ml-1">CASH</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" disabled checked={(change.mode || '') === 'gcash'} />
            <span className="ml-1">GCASH</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" disabled checked={(change.mode || '') === 'bank' || (change.mode || '').toLowerCase().includes('bank')} />
            <span className="ml-1">BANK TRANSFER</span>
          </label>
        </div>

        <div className="text-xs text-right">
          <div>
            Price: <span className="font-semibold">₱{originalAmount.toLocaleString()}</span>
          </div>
          {voucherAmount > 0 && (
            <div className="text-emerald-700">
              Voucher: -₱{voucherAmount.toLocaleString()}
            </div>
          )}
          <div>
            Net Price: <span className="font-semibold">₱{totalAmount.toLocaleString()}</span>
          </div>
        </div>

        </div>
        
        {(change.reference || change.voucherDescription) && (
          <div className="mt-1.5  space-y-0.5">
            {change.reference && <p className="text-xs text-gray-500">Ref #: <span className="font-mono">{change.reference}</span></p>}
            {change.voucherDescription && <p className="text-xs text-gray-500">Voucher: <span className="font-medium">{change.voucherDescription}</span></p>}
          </div>
        )}

        <div className="border-t border-gray-200 mt-0.5"></div>

        {/* Three-column financial snapshot: previous balance, amount paid now, current balance */}
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-gray-500 mb-1">Previous Balance</p>
            <p className={prevBalance > 0 ? 'text-red-700 font-semibold' : 'text-green-700 font-semibold'}>₱ {prevBalance.toLocaleString()}</p>
          </div>

          <div className="text-center">
            <p className="text-gray-500 mb-1">Current Payment</p>
            <p className="text-sm  text-blue-700 font-semibold">₱ {newPayment.toLocaleString()}</p>
          </div>

          <div className="text-right">
            <p className="text-gray-500 mb-1">Balance</p>
            <p className={newBalance > 0 ? 'text-red-700 font-semibold' : 'text-green-700 font-semibold'}>₱ {newBalance.toLocaleString()}</p>
          </div>
        </div>
      </div>
    );
  })}


</div>
              )}
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => setSummaryModalOpen(false)}
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalConfirm}
                className="px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                disabled={confirmLoading}
              >
                {confirmLoading ? 'Confirming...' : 'Confirm  Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Student Payable Dialog */}
      {individualPayableDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px]bg-opacity-50" onClick={() => {
            setIndividualPayableDialogOpen(false);
            setIndividualPayableForm({
              type: '',
              amount: '',
              yearLevel: ''
            });
          }}></div>
          <div className="bg-white rounded-lg px-8 py-6 max-w-md w-full  overflow-y-auto relative z-10">
            <h2 className="font-bold ">
              Add Previous Balance / Custom Charge
            </h2>
            {selectedStudentModal && (
              <p className="text-sm text-gray-600 mb-6">
                For: {selectedStudentModal.name}
              </p>
            )}
            <div className="space-y-4">
              <label className="block text-sm font-medium mb-1">Charge Type</label>
              <input
                type="text"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                placeholder="Payable Type (e.g., 2nd Year Balance, Laboratory Fee, etc.)"
                value={individualPayableForm.type}
                onChange={(e) => handleIndividualPayableInputChange('type', e.target.value)}
              />
              
              <label className="block text-sm font-medium mb-1">Amount</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                placeholder="Amount"
                value={individualPayableForm.amount}
                onChange={(e) => handleIndividualPayableInputChange('amount', e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
              />



              <div>
                <label className="block text-sm font-medium mb-1">Year Level (when the charge was incurred)</label>
                <select
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                  value={individualPayableForm.yearLevel}
                  onChange={(e) => handleIndividualPayableInputChange('yearLevel', e.target.value)}
                >
                  <option value="">Select Year Level</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs text-blue-800">
                  This will add a payable specifically for {selectedStudentModal?.name}.
                  Other students will not see this charge.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button 
                onClick={() => {
                  setIndividualPayableDialogOpen(false);
                  setIndividualPayableForm({
                    type: '',
                    amount: '',
                    yearLevel: ''
                  });
                }} 
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveIndividualPayable}
                className="px-4 py-1.5 rounded-full cursor-pointer text-sm bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!individualPayableForm.type || !individualPayableForm.amount || !individualPayableForm.yearLevel || loading}
              >
                {loading ? 'Adding...' : 'Add Previous Balance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Payable Confirmation Modal */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] bg-opacity-50"
            onClick={() => { setDeleteDialogOpen(false); setDeleteTarget(null); }}
          ></div>
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full relative z-10">
            <div className="flex items-start gap-3">
             
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-1">Delete Payable</h2>
                <p className="text-sm text-gray-700 mb-2">
                  Are you sure you want to delete
                  {` "${deleteTarget?.type || ''}"`} payable? This cannot be undone.
                </p>
                {typeof deleteTarget?.amount !== 'undefined' && (
                  <p className="text-sm text-gray-600 mb-2">
                    Amount: ₱{Number(deleteTarget.amount || 0).toLocaleString()}
                  </p>
                )}
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  {deleteTarget?.isIndividual ? (
                    <span>
                      This will permanently remove this charge for {selectedStudentModal?.name}.
                    </span>
                  ) : (
                    <span>
                      This will remove this payable for all {deleteTarget?.yearLevel === 'irregular' ? 'irregular students' : deleteTarget?.yearLevel === 'all' ? 'students' : `students in Year ${deleteTarget?.yearLevel}`}.
                      This action cannot be undone.
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => { setDeleteDialogOpen(false); setDeleteTarget(null); }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                onClick={() => deleteTarget && handleDeletePayable(deleteTarget.id)}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {transactionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] bg-opacity-50" onClick={() => setTransactionModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-xl w-full max-h-140 overflow-y-auto relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Transaction History</h2>
              <button 
                onClick={() => setTransactionModalOpen(false)} 
                className="text-gray-400 hover:text-red-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {transactionPayable && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold">{transactionPayable.type}</h3>
                <p className="text-sm text-gray-600">Total: ₱{Number(transactionPayable.amount || 0).toLocaleString()}</p>
              </div>
            )}

            <div className="space-y-2">
              {transactionPayments.length === 0 ? (
                <p className="text-gray-600 text-sm">No transactions yet.</p>
              ) : (
                transactionPayments.map((payment, idx) => {
                  const paidSoFar = transactionPayments.slice(0, idx + 1).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                  const totalAmount = Number(transactionPayable?.amount || 0);
                  const remainingAfter = Math.max(0, totalAmount - paidSoFar);
                  return (
                    <div>
                      <div key={payment.id || idx} className="border border-gray-200 rounded-xl shadow p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="font-bold text-lg">₱{Number(payment.amount || 0).toLocaleString()}</p>
                          {payment.description && <p className="text-sm text-gray-600">{payment.description}</p>}
                        </div>
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <p className="text-sm text-gray-500">{getFormattedDate(payment.date)}</p>
                            <button
                              type="button"
                              className="p-1 rounded-full text-gray-700 hover:bg-gray-100"
                              onClick={() => {
                                const totalPrice = Number(transactionPayable?.amount) || 0;
                                const currentPaymentAmount = Number(payment.amount) || 0;
                                const totalPaidSoFar = paidSoFar;
                                const previousPaid = Math.max(0, totalPaidSoFar - currentPaymentAmount);
                                openReceiptForPayment(selectedStudentModal, transactionPayable, {
                                  ...payment,
                                  price: totalPrice,
                                  previousPaid,
                                  totalPaid: totalPaidSoFar,
                                  balanceAfter: remainingAfter
                                });
                              }}
                              title="Print receipt"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-sm text-gray-600">Mode: <span className="font-semibold capitalize">{payment.mode || payment.method || payment.paymentMode || 'N/A'}</span></p>
                          {payment.reference && <p className="text-sm text-gray-500">Ref: <span className="font-mono">{payment.reference}</span></p>}
                          <p className="text-sm mt-2">Remaining: <span className={`font-semibold ${remainingAfter > 0 ? 'text-red-600' : 'text-green-600'}`}>₱{remainingAfter.toLocaleString()}</span></p>
                        </div>
                        
                      </div>
                      
                    </div>

                    {idx === transactionPayments.length - 1 && (
                      <div className='mt-2 text-end text-sm'>
                        Total Balance: 
                        <span className={`font-bold ml-1 ${remainingAfter > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ₱{remainingAfter.toLocaleString()}
                        </span>
                      </div>
                    )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Student Transactions Modal */}
      {studentTransactionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] bg-opacity-50" onClick={() => setStudentTransactionsModalOpen(false)}></div>
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-140 overflow-y-auto relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Transaction History</h2>
              <button onClick={() => setStudentTransactionsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {selectedStudentForTransactions && (
              <p className="text-sm text-gray-600 mb-4">For: {selectedStudentForTransactions.name}</p>
            )}
            <div className="space-y-2">
              {studentTransactions.length === 0 ? (
                <p className="text-gray-600">No transactions yet.</p>
              ) : (
                studentTransactions.map(payment => (
                  <div key={payment.id} className="border border-gray-200 rounded p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold">₱{Number(payment.amount || 0).toLocaleString()}</p>
                        <p className="text-sm text-gray-600">{payment.description}</p>
                        <p className="text-sm text-gray-600">Mode: <span className="font-semibold">{payment.mode || payment.method || payment.paymentMode || 'N/A'}</span></p>
                        {payment.reference && <p className="text-sm text-gray-500">Ref: <span className="font-mono">{payment.reference}</span></p>}
                      </div>
                      <p className="text-sm text-gray-500">{getFormattedDate(payment.date)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {receiptModalOpen && (
        <ReceiptModal open={receiptModalOpen} onClose={() => setReceiptModalOpen(false)} receiptData={receiptData} />
      )}

      {showScrollTop && (
        <button
          type="button"
          onClick={handleScrollToTop}
          className="fixed bottom-6 right-6 z-40 cursor-pointer rounded-full bg-blue-600 text-white p-3 shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
          aria-label="Scroll to top"
          title="Scroll to top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default PayablesSystem;