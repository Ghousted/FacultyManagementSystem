import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where
} from 'firebase/firestore';
import {
  BadgePlus,
  Pencil,
  Search,
  Funnel,
  Printer,
  History,
  Trash2,
  MoreVertical,
  ArrowBigLeft,
  X
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { createReceiptRecord, generateReceiptNumber } from '../../utils/receiptService';
import ReceiptModal from './ReceiptModal';

const emptyDepartmentForm = { name: '', code: '' };
const emptyStudentForm = { name: '', course: '', yearLevel: '1', block: '' };
const emptyPayableForm = { title: '', amount: '' };
const emptyPaymentForm = {
  studentId: '',
  payableId: '',
  amount: '',
  mode: 'cash',
  voucherAmount: '',
  voucherDescription: '',
  reference: ''
};

const numberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPeso = (value) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numberOrZero(value));
};

const toDateLabel = (rawValue) => {
  if (!rawValue) return '';
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const OtherDepartmentPayables = ({ onBackToPayablesMain }) => {
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [departments, setDepartments] = useState([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [departmentForm, setDepartmentForm] = useState(emptyDepartmentForm);
  const [editingDepartmentId, setEditingDepartmentId] = useState('');
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [openDepartmentMenuId, setOpenDepartmentMenuId] = useState('');
  const [deleteDepartmentModalOpen, setDeleteDepartmentModalOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState(null);

  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [editingStudentId, setEditingStudentId] = useState('');
  const [studentModalOpen, setStudentModalOpen] = useState(false);

  const [payables, setPayables] = useState([]);
  const [payableForm, setPayableForm] = useState(emptyPayableForm);
  const [editingPayableId, setEditingPayableId] = useState('');
  const [payableModalOpen, setPayableModalOpen] = useState(false);
  const [editPayablesModalOpen, setEditPayablesModalOpen] = useState(false);

  const [payments, setPayments] = useState([]);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [paymentFormByPayable, setPaymentFormByPayable] = useState({});
  const [editingPaymentId, setEditingPaymentId] = useState('');
  const [studentHistoryId, setStudentHistoryId] = useState('');
  const [payableHistoryId, setPayableHistoryId] = useState('');
  const [studentPaymentModalOpen, setStudentPaymentModalOpen] = useState(false);
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState(null);
  const [payablesSearch, setPayablesSearch] = useState('');
  const [payablesFilter, setPayablesFilter] = useState('all');
  const [paymentConfirmModalOpen, setPaymentConfirmModalOpen] = useState(false);
  const [pendingPaymentConfirmation, setPendingPaymentConfirmation] = useState(null);
  const [editingPaymentReceiptNumber, setEditingPaymentReceiptNumber] = useState('');
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [receiptAutoPrint, setReceiptAutoPrint] = useState(false);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionPayable, setTransactionPayable] = useState(null);
  const [transactionPayments, setTransactionPayments] = useState([]);

  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === selectedDepartmentId) || null,
    [departments, selectedDepartmentId]
  );

  const studentsById = useMemo(() => {
    return students.reduce((acc, student) => {
      acc[student.id] = student;
      return acc;
    }, {});
  }, [students]);

  const payablesById = useMemo(() => {
    return payables.reduce((acc, payable) => {
      acc[payable.id] = payable;
      return acc;
    }, {});
  }, [payables]);

  const paymentTotalsByStudentPayable = useMemo(() => {
    const totals = {};
    payments.forEach((payment) => {
      const key = `${payment.studentId}::${payment.payableId}`;
      const settledAmount = numberOrZero(payment.amount) + numberOrZero(payment.voucherAmount);
      totals[key] = (totals[key] || 0) + settledAmount;
    });
    return totals;
  }, [payments]);

  const departmentStudents = useMemo(() => {
    const normalizedSearch = studentSearch.trim().toLowerCase();
    if (!normalizedSearch) return students;
    return students.filter((student) => {
      const haystack = `${student.name} ${student.course || ''} ${student.yearLevel} ${student.block}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [studentSearch, students]);

  const paymentHistory = useMemo(() => {
    return payments
      .filter((payment) => {
        if (studentHistoryId && payment.studentId !== studentHistoryId) {
          return false;
        }
        if (payableHistoryId && payment.payableId !== payableHistoryId) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime());
  }, [payableHistoryId, payments, studentHistoryId]);

  const clearStatus = () => {
    setError('');
    setSuccess('');
  };

  const showError = (message) => {
    setSuccess('');
    setError(message);
  };

  const showSuccess = (message) => {
    setError('');
    setSuccess(message);
  };

  const loadDepartments = useCallback(async () => {
    if (!currentUser?.uid) return;

    setLoading(true);
    clearStatus();
    try {
      const departmentsRef = collection(db, 'otherDepartments');
      const departmentsQuery = query(
        departmentsRef,
        where('userId', '==', currentUser.uid)
      );
      const snapshot = await getDocs(departmentsQuery);
      const records = snapshot.docs.map((departmentDoc) => ({
        id: departmentDoc.id,
        ...departmentDoc.data()
      }))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setDepartments(records);

      if (!records.length) {
        setSelectedDepartmentId('');
      } else if (selectedDepartmentId && !records.some((item) => item.id === selectedDepartmentId)) {
        setSelectedDepartmentId('');
      }
    } catch (loadError) {
      showError(`Failed to load departments: ${loadError.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid, selectedDepartmentId]);

  const loadDepartmentData = useCallback(async () => {
    if (!currentUser?.uid || !selectedDepartmentId) {
      setStudents([]);
      setPayables([]);
      setPayments([]);
      return;
    }

    setLoading(true);
    clearStatus();
    try {
      const studentsRef = collection(db, 'otherDept-Students');
      const payablesRef = collection(db, 'otherDept-payables');
      const paymentsRef = collection(db, 'otherDept-payment');

      const [studentsSnapshot, payablesSnapshot, paymentsSnapshot] = await Promise.all([
        getDocs(
          query(
            studentsRef,
            where('userId', '==', currentUser.uid),
            where('departmentId', '==', selectedDepartmentId)
          )
        ),
        getDocs(
          query(
            payablesRef,
            where('userId', '==', currentUser.uid),
            where('departmentId', '==', selectedDepartmentId)
          )
        ),
        getDocs(
          query(
            paymentsRef,
            where('userId', '==', currentUser.uid),
            where('departmentId', '==', selectedDepartmentId)
          )
        )
      ]);

      setStudents(
        studentsSnapshot.docs.map((studentDoc) => ({
          id: studentDoc.id,
          ...studentDoc.data()
        }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      );

      setPayables(
        payablesSnapshot.docs.map((payableDoc) => ({
          id: payableDoc.id,
          ...payableDoc.data()
        }))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      );

      setPayments(
        paymentsSnapshot.docs.map((paymentDoc) => ({
          id: paymentDoc.id,
          ...paymentDoc.data()
        }))
        .sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime())
      );
    } catch (loadError) {
      showError(`Failed to load department records: ${loadError.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid, selectedDepartmentId]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    loadDepartmentData();
  }, [loadDepartmentData]);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(''), 2500);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    const handleOutsideMenuClick = () => {
      setOpenDepartmentMenuId('');
    };

    document.addEventListener('click', handleOutsideMenuClick);
    return () => document.removeEventListener('click', handleOutsideMenuClick);
  }, []);

  useEffect(() => {
    if (!receiptModalOpen || !receiptData) return undefined;

    const timer = setTimeout(() => {
      window.print();
    }, 250);

    return () => clearTimeout(timer);
  }, [receiptData, receiptModalOpen]);

  const handleSaveDepartment = async (event) => {
    event.preventDefault();

    if (!currentUser?.uid) {
      showError('Please sign in first.');
      return;
    }

    if (!departmentForm.name.trim()) {
      showError('Department name is required.');
      return;
    }

    setLoading(true);
    clearStatus();
    try {
      const payload = {
        userId: currentUser.uid,
        name: departmentForm.name.trim(),
        code: departmentForm.code.trim(),
        updatedAt: new Date().toISOString()
      };

      if (editingDepartmentId) {
        await updateDoc(doc(db, 'otherDepartments', editingDepartmentId), payload);
        showSuccess('Department updated.');
      } else {
        await addDoc(collection(db, 'otherDepartments'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        showSuccess('Department created.');
      }

      setDepartmentForm(emptyDepartmentForm);
      setEditingDepartmentId('');
      setDepartmentModalOpen(false);
      await loadDepartments();
    } catch (saveError) {
      showError(`Failed to save department: ${saveError.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditDepartment = (department) => {
    setDepartmentForm({
      name: department.name || '',
      code: department.code || ''
    });
    setEditingDepartmentId(department.id);
    setDepartmentModalOpen(true);
  };

  const openCreateDepartmentModal = () => {
    setDepartmentForm(emptyDepartmentForm);
    setEditingDepartmentId('');
    setDepartmentModalOpen(true);
  };

  const closeDepartmentModal = () => {
    setDepartmentModalOpen(false);
    setDepartmentForm(emptyDepartmentForm);
    setEditingDepartmentId('');
  };

  const confirmDeleteDepartment = async () => {
    if (!departmentToDelete?.id) return;

    const departmentId = departmentToDelete.id;
    setLoading(true);
    clearStatus();
    try {
      const studentsRef = collection(db, 'otherDept-Students');
      const payablesRef = collection(db, 'otherDept-payables');
      const paymentsRef = collection(db, 'otherDept-payment');

      const [studentsSnapshot, payablesSnapshot, paymentsSnapshot] = await Promise.all([
        getDocs(query(studentsRef, where('departmentId', '==', departmentId))),
        getDocs(query(payablesRef, where('departmentId', '==', departmentId))),
        getDocs(query(paymentsRef, where('departmentId', '==', departmentId)))
      ]);

      const deletePromises = [];
      studentsSnapshot.docs.forEach((studentDoc) => deletePromises.push(deleteDoc(doc(db, 'otherDept-Students', studentDoc.id))));
      payablesSnapshot.docs.forEach((payableDoc) => deletePromises.push(deleteDoc(doc(db, 'otherDept-payables', payableDoc.id))));
      paymentsSnapshot.docs.forEach((paymentDoc) => deletePromises.push(deleteDoc(doc(db, 'otherDept-payment', paymentDoc.id))));
      deletePromises.push(deleteDoc(doc(db, 'otherDepartments', departmentId)));

      await Promise.all(deletePromises);

      if (selectedDepartmentId === departmentId) {
        setSelectedDepartmentId('');
      }
      setDeleteDepartmentModalOpen(false);
      setDepartmentToDelete(null);
      showSuccess('Department and related records deleted.');
      await loadDepartments();
      await loadDepartmentData();
    } catch (deleteError) {
      showError(`Failed to delete department: ${deleteError.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDepartmentModal = (department) => {
    setOpenDepartmentMenuId('');
    setDepartmentToDelete(department);
    setDeleteDepartmentModalOpen(true);
  };

  const closeDeleteDepartmentModal = () => {
    setDeleteDepartmentModalOpen(false);
    setDepartmentToDelete(null);
  };

  const handleSaveStudent = async (event) => {
    event.preventDefault();

    if (!currentUser?.uid || !selectedDepartmentId) {
      showError('Select a department first.');
      return;
    }

    if (!studentForm.name.trim() || !studentForm.course.trim() || !studentForm.yearLevel || !studentForm.block.trim()) {
      showError('Student name, course, year level, and block are required.');
      return;
    }

    setLoading(true);
    clearStatus();
    try {
      const payload = {
        userId: currentUser.uid,
        departmentId: selectedDepartmentId,
        name: studentForm.name.trim(),
        course: studentForm.course.trim(),
        yearLevel: Number(studentForm.yearLevel),
        block: studentForm.block.trim(),
        updatedAt: new Date().toISOString()
      };

      if (editingStudentId) {
        await updateDoc(doc(db, 'otherDept-Students', editingStudentId), payload);
        showSuccess('Student updated.');
      } else {
        await addDoc(collection(db, 'otherDept-Students'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        showSuccess('Student added.');
      }

      setStudentForm(emptyStudentForm);
      setEditingStudentId('');
      setStudentModalOpen(false);
      await loadDepartmentData();
    } catch (saveError) {
      showError(`Failed to save student: ${saveError.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStudent = (student) => {
    setStudentForm({
      name: student.name || '',
      course: student.course || '',
      yearLevel: String(student.yearLevel || 1),
      block: student.block || ''
    });
    setEditingStudentId(student.id);
    setStudentModalOpen(true);
  };

  const openCreateStudentModal = () => {
    setStudentForm(emptyStudentForm);
    setEditingStudentId('');
    setStudentModalOpen(true);
  };

  const closeStudentModal = () => {
    setStudentModalOpen(false);
    setStudentForm(emptyStudentForm);
    setEditingStudentId('');
  };

  const handleDeleteStudent = async (studentId) => {
    const confirmed = window.confirm('Delete this student and related payment records?');
    if (!confirmed) return;

    setLoading(true);
    clearStatus();
    try {
      const paymentsRef = collection(db, 'otherDept-payment');
      const paymentSnapshot = await getDocs(query(paymentsRef, where('studentId', '==', studentId)));

      const deletePromises = paymentSnapshot.docs.map((paymentDoc) => deleteDoc(doc(db, 'otherDept-payment', paymentDoc.id)));
      deletePromises.push(deleteDoc(doc(db, 'otherDept-Students', studentId)));

      await Promise.all(deletePromises);
      showSuccess('Student deleted.');
      await loadDepartmentData();
    } catch (deleteError) {
      showError(`Failed to delete student: ${deleteError.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openStudentPaymentModal = (student) => {
    setSelectedStudentForPayment(student);
    setPayablesSearch('');
    setPayablesFilter('all');
    setPaymentForm({
      ...emptyPaymentForm,
      studentId: student.id
    });
    setEditingPaymentId('');
    setEditingPaymentReceiptNumber('');
    setTransactionModalOpen(false);
    setTransactionPayable(null);
    setTransactionPayments([]);
    setStudentPaymentModalOpen(true);
  };

  const closeStudentPaymentModal = () => {
    setStudentPaymentModalOpen(false);
    setSelectedStudentForPayment(null);
    setPayablesSearch('');
    setPayablesFilter('all');
    setPaymentForm(emptyPaymentForm);
    setEditingPaymentId('');
    setEditingPaymentReceiptNumber('');
    setPaymentConfirmModalOpen(false);
    setPendingPaymentConfirmation(null);
    setTransactionModalOpen(false);
    setTransactionPayable(null);
    setTransactionPayments([]);
  };

  const handleSavePayable = async (event) => {
    event.preventDefault();

    if (!currentUser?.uid || !selectedDepartmentId) {
      showError('Select a department first.');
      return;
    }

    if (!payableForm.title.trim() || !payableForm.amount) {
      showError('Payable title and amount are required.');
      return;
    }

    const amount = numberOrZero(payableForm.amount);
    if (amount <= 0) {
      showError('Payable amount must be greater than zero.');
      return;
    }

    setLoading(true);
    clearStatus();
    try {
      const payload = {
        userId: currentUser.uid,
        departmentId: selectedDepartmentId,
        title: payableForm.title.trim(),
        amount,
        updatedAt: new Date().toISOString()
      };

      if (editingPayableId) {
        await updateDoc(doc(db, 'otherDept-payables', editingPayableId), payload);
        showSuccess('Payable updated.');
      } else {
        await addDoc(collection(db, 'otherDept-payables'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        showSuccess('Payable created.');
      }

      setPayableForm(emptyPayableForm);
      setEditingPayableId('');
      setPayableModalOpen(false);
      await loadDepartmentData();
    } catch (saveError) {
      showError(`Failed to save payable: ${saveError.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPayable = (payable) => {
    setPayableForm({
      title: payable.title || '',
      amount: String(numberOrZero(payable.amount))
    });
    setEditingPayableId(payable.id);
    setPayableModalOpen(true);
  };

  const openCreatePayableModal = () => {
    setPayableForm(emptyPayableForm);
    setEditingPayableId('');
    setPayableModalOpen(true);
  };

  const closePayableModal = () => {
    setPayableModalOpen(false);
    setPayableForm(emptyPayableForm);
    setEditingPayableId('');
  };

  const openEditPayablesModal = () => {
    setEditPayablesModalOpen(true);
  };

  const closeEditPayablesModal = () => {
    setEditPayablesModalOpen(false);
  };

  const handleDeletePayable = async (payableId) => {
    const confirmed = window.confirm('Delete this payable and related payment records?');
    if (!confirmed) return;

    setLoading(true);
    clearStatus();
    try {
      const paymentSnapshot = await getDocs(
        query(collection(db, 'otherDept-payment'), where('payableId', '==', payableId))
      );

      const deletePromises = paymentSnapshot.docs.map((paymentDoc) => deleteDoc(doc(db, 'otherDept-payment', paymentDoc.id)));
      deletePromises.push(deleteDoc(doc(db, 'otherDept-payables', payableId)));

      await Promise.all(deletePromises);
      showSuccess('Payable deleted.');
      await loadDepartmentData();
    } catch (deleteError) {
      showError(`Failed to delete payable: ${deleteError.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getPaymentConfirmationDraft = () => {
    if (!currentUser?.uid || !selectedDepartmentId) {
      showError('Select a department first.');
      return null;
    }

    if (!paymentForm.studentId || !paymentForm.payableId || !paymentForm.amount) {
      showError('Student, payable, and payment amount are required.');
      return null;
    }

    const amount = numberOrZero(paymentForm.amount);
    const voucherAmount = numberOrZero(paymentForm.voucherAmount);

    if (amount <= 0) {
      showError('Payment amount must be greater than zero.');
      return null;
    }

    if (voucherAmount > 0 && !paymentForm.voucherDescription.trim()) {
      showError('Voucher description is required when voucher amount is provided.');
      return null;
    }

    const payable = payablesById[paymentForm.payableId];
    if (!payable) {
      showError('Selected payable does not exist.');
      return null;
    }

    const student = studentsById[paymentForm.studentId];
    if (!student) {
      showError('Selected student does not exist.');
      return null;
    }

    const totalPayableAmount = numberOrZero(payable.amount);
    const previousSettled = payments
      .filter((payment) => payment.studentId === paymentForm.studentId && payment.payableId === paymentForm.payableId && payment.id !== editingPaymentId)
      .reduce((sum, payment) => sum + numberOrZero(payment.amount) + numberOrZero(payment.voucherAmount), 0);

    const newSettled = amount + voucherAmount;
    if (previousSettled + newSettled > totalPayableAmount + 0.0001) {
      showError('Payment plus voucher exceeds remaining balance.');
      return null;
    }

    const remainingBalance = Math.max(0, totalPayableAmount - (previousSettled + newSettled));
    const nowIso = new Date().toISOString();

    return {
      payload: {
        userId: currentUser.uid,
        departmentId: selectedDepartmentId,
        studentId: paymentForm.studentId,
        payableId: paymentForm.payableId,
        amount,
        mode: paymentForm.mode,
        voucherAmount,
        voucherDescription: paymentForm.voucherDescription.trim(),
        reference: paymentForm.reference.trim(),
        date: nowIso,
        updatedAt: nowIso
      },
      student,
      payable,
      totalPayableAmount,
      previousSettled,
      remainingBalance,
      settledAmount: newSettled
    };
  };

  const getBatchPaymentConfirmationDrafts = () => {
    if (!currentUser?.uid || !selectedDepartmentId) {
      showError('Select a department first.');
      return null;
    }

    // Collect drafts from paymentFormByPayable for the selected student
    if (!selectedStudentForPayment) {
      showError('Select a student first.');
      return null;
    }

    const drafts = Object.keys(paymentFormByPayable || {})
      .map((payableId) => {
        const per = paymentFormByPayable[payableId] || {};
        if (!per.amount) return null;
        const amount = numberOrZero(per.amount);
        const voucherAmount = numberOrZero(per.voucherAmount);
        if (amount <= 0) return null;

        const payable = payablesById[payableId];
        if (!payable) return null;

        const previousSettled = payments
          .filter((payment) => payment.studentId === selectedStudentForPayment.id && payment.payableId === payableId && payment.id !== editingPaymentId)
          .reduce((sum, payment) => sum + numberOrZero(payment.amount) + numberOrZero(payment.voucherAmount), 0);

        const totalPayableAmount = numberOrZero(payable.amount);
        const newSettled = amount + voucherAmount;
        if (previousSettled + newSettled > totalPayableAmount + 0.0001) {
          // Skip invalid overpayments; caller may show error
          return { error: `Payment for ${payable.title} exceeds remaining balance.` };
        }

        const remainingBalance = Math.max(0, totalPayableAmount - (previousSettled + newSettled));

        return {
          payload: {
            userId: currentUser.uid,
            departmentId: selectedDepartmentId,
            studentId: selectedStudentForPayment.id,
            payableId,
            amount,
            mode: per.mode || 'cash',
            voucherAmount,
            voucherDescription: (per.voucherDescription || '').trim(),
            reference: (per.reference || '').trim(),
            date: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          student: selectedStudentForPayment,
          payable,
          totalPayableAmount,
          previousSettled,
          remainingBalance,
          settledAmount: newSettled
        };
      })
      .filter(Boolean);

    if (!drafts || drafts.length === 0) {
      showError('Enter payment amounts for one or more payables before confirming.');
      return null;
    }

    // Check for any drafts with error
    const draftWithError = drafts.find((d) => d && d.error);
    if (draftWithError) {
      showError(draftWithError.error);
      return null;
    }

    return drafts;
  };

  const buildOtherPayablesForReceipt = (studentId, excludedPayableId) => {
    const otherPayables = payables
      .filter((payable) => payable.id !== excludedPayableId)
      .map((payable) => ({
        payableId: payable.id,
        type: payable.title || 'Payable',
        remainingBalance: getStudentPayableBalance(studentId, payable.id)
      }))
      .filter((payable) => payable.remainingBalance > 0)
      .sort((a, b) => b.remainingBalance - a.remainingBalance);

    return {
      otherPayables,
      totalOtherBalance: otherPayables.reduce((sum, payable) => sum + payable.remainingBalance, 0)
    };
  };

  const buildReceiptPreview = (draft) => {
    const { otherPayables, totalOtherBalance } = buildOtherPayablesForReceipt(draft.student.id, draft.payable.id);
    const paymentDate = draft.payload.date || new Date().toISOString();

    return {
      receiptNumber: draft.receiptNumber || '—',
      studentName: draft.student.name || '—',
      date: toDateLabel(paymentDate),
      course: draft.student.course || '',
      yearLevel: draft.student.yearLevel || '',
      description: draft.payable.title || 'Payment',
      amount: draft.payload.amount,
      price: draft.totalPayableAmount,
      previousPaid: draft.previousSettled,
      totalPaid: draft.payload.amount,
      balance: draft.remainingBalance,
      mode: draft.payload.mode,
      reference: draft.payload.reference,
      items: [
        {
          payableId: draft.payable.id,
          description: draft.payable.title || 'Payment',
          price: draft.totalPayableAmount,
          previousBalance: Math.max(0, draft.totalPayableAmount - draft.previousSettled),
          payment: draft.payload.amount,
          balance: draft.remainingBalance,
          voucherAmount: draft.payload.voucherAmount,
          voucherDescription: draft.payload.voucherDescription
        }
      ],
      otherPayables,
      totalOtherBalance,
      receivedBy: ''
    };
  };

  const buildCombinedReceiptPreview = (drafts, receiptNumber) => {
    if (!drafts || !drafts.length) return null;
    const student = drafts[0].student;
    const paymentDate = drafts[0].payload.date || new Date().toISOString();

    const items = drafts.map((d) => ({
      payableId: d.payable.id,
      description: d.payable.title || 'Payment',
      price: d.totalPayableAmount,
      previousBalance: Math.max(0, d.totalPayableAmount - d.previousSettled),
      payment: d.payload.amount,
      balance: d.remainingBalance,
      voucherAmount: d.payload.voucherAmount,
      voucherDescription: d.payload.voucherDescription || ''
    }));

    const totalAmount = drafts.reduce((sum, d) => sum + numberOrZero(d.payload.amount), 0);
    return {
      receiptNumber: receiptNumber || '—',
      studentName: student.name || '—',
      date: toDateLabel(paymentDate),
      course: student.course || '',
      yearLevel: student.yearLevel || '',
      description: items.map(i => i.description).join(', '),
      amount: totalAmount,
      price: drafts.reduce((sum, d) => sum + d.totalPayableAmount, 0),
      previousPaid: drafts.reduce((sum, d) => sum + d.previousSettled, 0),
      totalPaid: totalAmount,
      balance: drafts.reduce((sum, d) => sum + d.remainingBalance, 0),
      mode: drafts.map((d) => d.payload.mode).join(', '),
      reference: drafts.map((d) => d.payload.reference).filter(Boolean).join(', '),
      items,
      otherPayables: [],
      totalOtherBalance: 0,
      receivedBy: ''
    };
  };

  const buildReceiptFromExistingPayment = useCallback(async (paymentRecord) => {
    const student = studentsById[paymentRecord.studentId];
    const payable = payablesById[paymentRecord.payableId];
    if (!student || !payable) return null;

    let receiptNumber = (paymentRecord.receiptNumber || '').toString().trim();
    if (!receiptNumber && paymentRecord.receiptId) {
      try {
        const receiptSnapshot = await getDoc(doc(db, 'receipts', paymentRecord.receiptId));
        if (receiptSnapshot.exists()) {
          receiptNumber = (receiptSnapshot.data()?.receiptNumber || '').toString().trim();
        }
      } catch (receiptLookupError) {
        console.warn('Failed to load receipt number for existing payment:', receiptLookupError);
      }
    }

    const timeline = payments
      .filter((payment) => payment.studentId === paymentRecord.studentId && payment.payableId === paymentRecord.payableId)
      .sort((a, b) => new Date(a.createdAt || a.date || 0).getTime() - new Date(b.createdAt || b.date || 0).getTime());

    let previousSettled = 0;
    for (const row of timeline) {
      if (row.id === paymentRecord.id) break;
      previousSettled += numberOrZero(row.amount) + numberOrZero(row.voucherAmount);
    }

    const paymentAmount = numberOrZero(paymentRecord.amount);
    const voucherAmount = numberOrZero(paymentRecord.voucherAmount);
    const payableAmount = numberOrZero(payable.amount);
    const settledThisTransaction = paymentAmount + voucherAmount;
    const remainingBalance = Math.max(0, payableAmount - (previousSettled + settledThisTransaction));

    const { otherPayables, totalOtherBalance } = buildOtherPayablesForReceipt(student.id, payable.id);

    return {
      receiptNumber: receiptNumber || '—',
      studentName: student.name || '—',
      date: toDateLabel(paymentRecord.date || paymentRecord.createdAt || new Date().toISOString()),
      course: student.course || '',
      yearLevel: student.yearLevel || '',
      description: payable.title || 'Payment',
      amount: paymentAmount,
      price: payableAmount,
      previousPaid: previousSettled,
      totalPaid: paymentAmount,
      balance: remainingBalance,
      mode: paymentRecord.mode || 'cash',
      reference: paymentRecord.reference || '',
      items: [
        {
          payableId: payable.id,
          description: payable.title || 'Payment',
          price: payableAmount,
          previousBalance: Math.max(0, payableAmount - previousSettled),
          payment: paymentAmount,
          balance: remainingBalance,
          voucherAmount,
          voucherDescription: paymentRecord.voucherDescription || ''
        }
      ],
      otherPayables,
      totalOtherBalance,
      receivedBy: ''
    };
  }, [buildOtherPayablesForReceipt, payablesById, payments, studentsById]);

  const handlePrintExistingPayment = useCallback(async (paymentRecord) => {
    const preview = await buildReceiptFromExistingPayment(paymentRecord);
    if (!preview) {
      showError('Unable to prepare receipt preview for this transaction.');
      return;
    }
    setReceiptData(preview);
    setReceiptModalOpen(true);
  }, [buildReceiptFromExistingPayment]);

  const handleOpenPaymentConfirmation = (event) => {
    event.preventDefault();
    clearStatus();

    // Prefer batch drafts (multiple staged payables)
    const batchDrafts = getBatchPaymentConfirmationDrafts();
    if (batchDrafts) {
      setPendingPaymentConfirmation(batchDrafts);
      setPaymentConfirmModalOpen(true);
      return;
    }

    // Fallback to a single-payment draft created from the active payment form
    const singleDraft = getPaymentConfirmationDraft();
    if (singleDraft) {
      setPendingPaymentConfirmation([singleDraft]);
      setPaymentConfirmModalOpen(true);
      return;
    }

    // If neither produced a draft, getBatch/getPayment already called showError
  };

  const handleConfirmPayment = async () => {
    if (!pendingPaymentConfirmation || !pendingPaymentConfirmation.length) return;

    setLoading(true);
    clearStatus();
    try {
      const paymentDate = new Date();
      const receiptNumber = await generateReceiptNumber(db, paymentDate);
      let receiptId = null;

      // Create combined receipt record (items from all drafts)
      try {
        const receiptItems = pendingPaymentConfirmation.map((d) => ({
          description: d.payable.title || 'Payment',
          amount: d.payload.amount
        }));

        receiptId = await createReceiptRecord(db, {
          receiptNumber,
          studentId: pendingPaymentConfirmation[0].student.id,
          studentName: pendingPaymentConfirmation[0].student.name,
          date: paymentDate.toISOString(),
          formattedDate: toDateLabel(paymentDate),
          course: pendingPaymentConfirmation[0].student.course || '',
          yearLevel: pendingPaymentConfirmation[0].student.yearLevel || '',
          items: receiptItems,
          amount: receiptItems.reduce((s, it) => s + numberOrZero(it.amount), 0),
          mode: pendingPaymentConfirmation.map((d) => d.payload.mode).join(', '),
          cashierId: currentUser?.uid || null
        });
      } catch (receiptError) {
        console.warn('Failed to create receipt record for other department payment:', receiptError);
      }

      // Persist each payment record and collect created ids
      const createdPaymentIds = [];
      for (const draft of pendingPaymentConfirmation) {
        const payloadWithReceipt = {
          ...draft.payload,
          receiptNumber,
          receiptId,
          updatedAt: new Date().toISOString()
        };

        if (editingPaymentId && pendingPaymentConfirmation.length === 1) {
          await updateDoc(doc(db, 'otherDept-payment', editingPaymentId), payloadWithReceipt);
          createdPaymentIds.push(editingPaymentId);
        } else {
          const ref = await addDoc(collection(db, 'otherDept-payment'), {
            ...payloadWithReceipt,
            createdAt: new Date().toISOString()
          });
          createdPaymentIds.push(ref.id);
        }
      }

      showSuccess('Payments recorded.');

      const receiptPreview = buildCombinedReceiptPreview(pendingPaymentConfirmation, receiptNumber);

      // Clear staged payment entries for the processed payables
      setPaymentFormByPayable((prev) => {
        const copy = { ...prev };
        for (const d of pendingPaymentConfirmation) {
          delete copy[d.payable.id];
        }
        return copy;
      });

      setPaymentConfirmModalOpen(false);
      setPendingPaymentConfirmation(null);
      setPaymentForm({ ...emptyPaymentForm, studentId: selectedStudentForPayment?.id || '' });
      setEditingPaymentId('');
      setEditingPaymentReceiptNumber('');
      await loadDepartmentData();

      setStudentPaymentModalOpen(false);
      setSelectedStudentForPayment(null);

      setReceiptData(receiptPreview);
      setReceiptAutoPrint(true);
      setReceiptModalOpen(true);
    } catch (saveError) {
      showError(`Failed to save payment(s): ${saveError.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPayment = (payment) => {
    setPaymentForm({
      studentId: payment.studentId || '',
      payableId: payment.payableId || '',
      amount: String(numberOrZero(payment.amount)),
      mode: payment.mode || 'cash',
      voucherAmount: String(numberOrZero(payment.voucherAmount) || ''),
      voucherDescription: payment.voucherDescription || '',
      reference: payment.reference || ''
    });
    setEditingPaymentId(payment.id);
    setEditingPaymentReceiptNumber(payment.receiptNumber || '');
  };

  const handleDeletePayment = useCallback(async (paymentId) => {
    const confirmed = window.confirm('Delete this payment record?');
    if (!confirmed) return;

    setLoading(true);
    clearStatus();
    try {
      await deleteDoc(doc(db, 'otherDept-payment', paymentId));
      showSuccess('Payment deleted.');
      await loadDepartmentData();

      if (selectedStudentForPayment && transactionPayable) {
        const refreshedTransactions = payments
          .filter((payment) => payment.id !== paymentId && payment.studentId === selectedStudentForPayment.id && payment.payableId === transactionPayable.id)
          .sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime());
        setTransactionPayments(refreshedTransactions);
      }

      if (editingPaymentId === paymentId) {
        setEditingPaymentId('');
        setEditingPaymentReceiptNumber('');
        setPaymentForm({
          ...emptyPaymentForm,
          studentId: selectedStudentForPayment?.id || ''
        });
      }
    } catch (deleteError) {
      showError(`Failed to delete payment: ${deleteError.message}`);
    } finally {
      setLoading(false);
    }
  }, [editingPaymentId, loadDepartmentData, payments, selectedStudentForPayment, transactionPayable]);

  const handleEditExistingPayment = (paymentRecord) => {
    handleEditPayment(paymentRecord);
    setTransactionModalOpen(false);
  };

  const getStudentPayableBalance = (studentId, payableId) => {
    const payable = payablesById[payableId];
    if (!payable) return 0;
    const payableAmount = numberOrZero(payable.amount);
    const settled = paymentTotalsByStudentPayable[`${studentId}::${payableId}`] || 0;
    return Math.max(0, payableAmount - settled);
  };

  const getStudentPayablePayments = useCallback((studentId, payableId) => {
    return payments
      .filter((payment) => payment.studentId === studentId && payment.payableId === payableId)
      .sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime());
  }, [payments]);

  const openPayableTransactionHistory = useCallback((payable) => {
    if (!selectedStudentForPayment) return;
    setTransactionPayable(payable);
    setTransactionPayments(getStudentPayablePayments(selectedStudentForPayment.id, payable.id));
    setTransactionModalOpen(true);
  }, [getStudentPayablePayments, selectedStudentForPayment]);

  const getStudentTotalBalance = (studentId) => {
    return payables.reduce((sum, payable) => {
      return sum + getStudentPayableBalance(studentId, payable.id);
    }, 0);
  };

  const getPayablePaymentStatus = (studentId, payableId) => {
    const payable = payablesById[payableId];
    if (!payable) return 'unpaid';

    const payableAmount = numberOrZero(payable.amount);
    if (payableAmount <= 0) return 'fully_paid';

    const balance = getStudentPayableBalance(studentId, payableId);
    if (balance <= 0.0001) return 'fully_paid';
    if (balance < payableAmount) return 'partially_paid';
    return 'unpaid';
  };

  const getPayableStatusClasses = (status) => {
    if (status === 'fully_paid') return 'bg-green-100 text-green-800 border border-green-300';
    if (status === 'partially_paid') return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    return 'bg-red-100 text-red-800 border border-red-300';
  };

  const getPayableStatusLabel = (status) => {
    if (status === 'fully_paid') return 'Fully Paid';
    if (status === 'partially_paid') return 'Partially Paid';
    return 'Unpaid';
  };


  return (
    <div className="">

      <div className="bg-white text-black p-8 rounded-2xl mb-6 border border-gray-300 shadow-md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <button
              onClick={() => {
                if (selectedDepartment) {
                  setSelectedDepartmentId('');
                  return;
                }
                onBackToPayablesMain();
              }}
              className="group flex items-center justify-center w-10 h-10 cursor-pointer rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <ArrowBigLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div>
              <h5 className="text-2xl font-medium text-blue-600 leading-tight">
                {selectedDepartment ? selectedDepartment.name : 'Other Department Payables'}
              </h5>
              <p className="text-sm text-gray-500 ">
                {selectedDepartment
                  ? `Manage payables for ${selectedDepartment.name} department.`
                  : 'Each department has isolated students, payables, and payment history.'}
              </p>
            </div>
          </div>
          {selectedDepartment && (
            <button
              type="button"
              onClick={openCreateStudentModal}
              className="inline-flex items-center cursor-pointer gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
            >
              <BadgePlus className="w-4 h-4" />
              Add Student
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-4 py-2 text-sm">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-2 text-sm">{success}</div>}

      
        {!selectedDepartment && (
          <>
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 className="text-lg font-semibold text-slate-800">Departments</h3>
              <button
                type="button"
                onClick={openCreateDepartmentModal}
                className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-lg cursor-pointer bg-blue-600 text-white hover:bg-blue-700"
              >
                <BadgePlus className="w-4 h-4" />
                Add Department
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {departments.map((department) => (
                <div
                  key={department.id}
                  className={`relative h-40 rounded-2xl border p-5 cursor-pointer bg-white shadow-md border-gray-300 h
                              hover:border-green-600
                            `}      
                  onClick={() => setSelectedDepartmentId(department.id)}
                >
                  <div className="absolute top-4 right-4" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setOpenDepartmentMenuId((prev) => (prev === department.id ? '' : department.id))}
                      className="cursor-pointer rounded-full p-1 text-gray-400 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 focus:ring-offset-white"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openDepartmentMenuId === department.id && (
                      <div className="absolute right-0 mt-1 w-36 rounded-lg border border-slate-200 bg-white shadow-lg z-10">
                        <button
                          type="button"
                          onClick={() => handleEditDepartment(department)}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteDepartmentModal(department)}
                          className="w-full text-left px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="text-left w-full pr-10">
                    <p className="font-semibold text-slate-900">{department.name}</p>
                    <p className="text-xs text-slate-600 mt-1">{department.code || 'No code'}</p>
                  </div>
                  
                </div>
              ))}
            </div>
          </>
        )}

      {selectedDepartment && (
        <>
          <section className="">
            <div className="flex flex-wrap items-center justify-between mb-3 gap-3">
                
                
              <div className="relative w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search students"
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  className="w-full border border-slate-300 rounded-lg text-sm pl-9 pr-3 py-1.5 "
                />
              </div>

              <div className='flex items-center gap-2'>
                <button
                  type="button"
                  onClick={openCreatePayableModal}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer border border-blue-600 text-blue-600 hover:bg-blue-100"
                >
                  <BadgePlus className="w-4 h-4" />
                  Add Payable
                </button>

              
            
              </div>
            </div>

            <div className="overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-blue-100 text-slate-700">
                  <tr>
                    <th className="text-left px-3 py-1.5 w-[30%]">Student</th>
                    <th className="text-left px-3 py-1.5 w-[15%]">Course</th>
                    <th className="text-left px-3 py-1.5 w-[10%]">Year</th>
                    <th className="text-left px-3 py-1.5 w-[10%]">Block</th>
                    <th className="text-right px-3 py-1.5 w-[20%]">Total Balance</th>
                    <th className="text-right px-3 py-1.5 w-[15%]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentStudents.length === 0 && (
                    <tr className="border-t border-slate-200">
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                        No students for this department.
                      </td>
                    </tr>
                  )}

                  {departmentStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="border-t border-slate-200 cursor-pointer hover:bg-slate-50"
                      onClick={() => openStudentPaymentModal(student)}
                    >
                      <td className="px-3 py-1.5 w-[30%]">{student.name}</td>
                      <td className="px-3 py-1.5 w-[15%]">{student.course || '-'}</td>
                      <td className="px-3 py-1.5 w-[10%]">{student.yearLevel}</td>
                      <td className="px-3 py-1.5 w-[10%]">{student.block}</td>
                      <td className="px-3 py-1.5 w-[20%] text-right font-semibold">{formatPeso(getStudentTotalBalance(student.id))}</td>
                      <td className="px-3 py-2 w-[15%] text-right">
              <div
                className="flex justify-end items-center gap-1"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                            type="button"
                            onClick={() => handleEditStudent(student)}
                            className="p-1 rounded-full text-gray-700  hover:bg-gray-300 cursor-pointer"
                        >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStudent(student.id)}
                            className="p-1 rounded-full text-gray-700  hover:bg-gray-300 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" /> 
                          </button>
  </div>
</td>
                    </tr>
                  ))}
                </tbody>

                {departmentStudents.length > 0 && payables.length > 0 && (
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right font-semibold text-slate-700">
                        Total Balance
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900">
                        {formatPeso(
                          departmentStudents.reduce((sum, student) => sum + getStudentTotalBalance(student.id), 0)
                        )}
                      </td>
                      <td className="px-3 py-2" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        </>
      )}

      {departmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] "
            onClick={closeDepartmentModal}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
            <h4 className="text-lg font-semibold text-slate-800 mb-4">
              {editingDepartmentId ? 'Edit Department' : 'Create Department'}
            </h4>
            <form onSubmit={handleSaveDepartment} className="space-y-3">

               <label 
                htmlFor="dept-name"
                className="block text-sm font-medium text-slate-700"
              >
                Department Name 
              </label> 
              <input
                type="text"
                placeholder="Department Name (e.g. College of Computer Studies)"
                value={departmentForm.name}
                onChange={(event) => setDepartmentForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              />

                <label
                htmlFor="dept-code"
                className="block text-sm font-medium text-slate-700"
                >
                Department Code
                </label>
              <input
                type="text"
                placeholder="Code (e.g. CCS)"
                value={departmentForm.code}
                onChange={(event) => setDepartmentForm((prev) => ({ ...prev, code: event.target.value }))}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <div className="flex justify-end gap-2 mt-8">
                <button
                  type="button"
                  onClick={closeDepartmentModal}
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                className="px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {editingDepartmentId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {studentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={closeStudentModal}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
            <h4 className="text-lg font-semibold text-slate-800 ">
              {editingStudentId ? 'Edit Student' : 'Create Student'}
            </h4>
           <p className="text-sm text-slate-600 mb-6">
                Add a student to <strong>{selectedDepartment?.name || 'the department'}</strong> and manage their payables after.
                </p>
            <form onSubmit={handleSaveStudent} className="space-y-4">

                {/* Student Name */}
                <div>
                    <label
                    htmlFor="student-name"
                    className="block text-xs font-medium text-slate-600 mb-1"
                    >
                    Student Name
                    </label>
                    <input
                    id="student-name"
                    type="text"
                    placeholder="e.g. Dela Cruz, Juan "
                    value={studentForm.name}
                    onChange={(event) =>
                        setStudentForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-none"
                    />
                </div>

                {/* Course, Year, Block */}
                <div className="flex gap-2">

                    {/* Course */}
                    <div className="">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                        Course
                    </label>
                    <input
                        type="text"
                        placeholder="Course (e.g. BSIT)"
                        value={studentForm.course}
                        onChange={(event) =>
                        setStudentForm((prev) => ({ ...prev, course: event.target.value }))
                        }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-none"
                    />
                    </div>

                    {/* Year Level */}
                    <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                        Year
                    </label>
                    <select
                        value={studentForm.yearLevel}
                        onChange={(event) =>
                        setStudentForm((prev) => ({ ...prev, yearLevel: event.target.value }))
                        }
                    className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-none"
                    >
                        <option value="">Select</option>
                        <option value="1">1st</option>
                        <option value="2">2nd</option>
                        <option value="3">3rd</option>
                        <option value="4">4th</option>
                    </select>
                    </div>

                    {/* Block */}
                    <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                        Block
                    </label>
                    <input
                        type="text"
                        placeholder="Block (e.g. A)"
                        value={studentForm.block}
                        onChange={(event) =>
                        setStudentForm((prev) => ({ ...prev, block: event.target.value }))
                        }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-none"
                    />
                    </div>

                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-2 mt-8">
                    <button
                    type="button"
                    onClick={closeStudentModal}
                    className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                    >
                    Cancel
                    </button>

                    <button
                    type="submit"
                    disabled={loading}
                     className="px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                    >
                    {editingStudentId ? 'Update Student' : 'Add Student'}
                    </button>
                </div>

                </form>
          </div>
        </div>
      )}

      {payableModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={closePayableModal}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
            <h4 className="text-lg font-semibold text-slate-800 mb-1">
              {editingPayableId ? 'Edit Payable' : 'Add Payable'}
            </h4>
            <p className="text-sm text-slate-600 mb-6">
              This payable applies to all students in <strong>{selectedDepartment?.name || 'this department'}</strong>, including newly added students.
            </p>

            <form onSubmit={handleSavePayable} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Payable Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Laboratory Fee"
                  value={payableForm.title}
                  onChange={(event) => setPayableForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 1500"
                  value={payableForm.amount}
                  onChange={(event) => setPayableForm((prev) => ({ ...prev, amount: event.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 mt-8">
                <button
                  type="button"
                  onClick={closePayableModal}
                  className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {editingPayableId ? 'Update Payable' : 'Add Payable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {studentPaymentModalOpen && selectedStudentForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={closeStudentPaymentModal}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-lg max-h-[90vh] z-10 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-20 bg-blue-50 border-b border-gray-200">
              <div>
                <h4 className="text-lg font-bold text-slate-800">{selectedStudentForPayment.name}</h4>
                <p className="text-xs text-slate-600">
                    {selectedStudentForPayment.course || '-'} {selectedStudentForPayment.yearLevel}
                    {selectedStudentForPayment.yearLevel === '1' && 'ST'}
                    {selectedStudentForPayment.yearLevel === '2' && 'ND'}
                    {selectedStudentForPayment.yearLevel === '3' && 'RD'}
                    {selectedStudentForPayment.yearLevel === '4' && 'TH'} Year - Block {selectedStudentForPayment.block}
                    </p>
              </div>
            </div>

            <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
              <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
                <div className="relative w-full md:max-w-sm">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    className="w-full pl-9 pr-3 py-1.5 border text-sm border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Search payables by type..."
                    value={payablesSearch}
                    onChange={(event) => setPayablesSearch(event.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Funnel className="w-4 h-4 text-gray-600" />
                  <select
                    className="px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={payablesFilter}
                    onChange={(event) => setPayablesFilter(event.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="partially_paid">Partially Paid</option>
                    <option value="fully_paid">Fully Paid</option>
                  </select>
                </div>
              </div>

              {(() => {
                const visiblePayables = payables
                  .filter((payable) => {
                    const normalizedSearch = payablesSearch.trim().toLowerCase();
                    if (!normalizedSearch) return true;
                    return (payable.title || '').toLowerCase().includes(normalizedSearch);
                  })
                  .filter((payable) => {
                    if (payablesFilter === 'all') return true;
                    return getPayablePaymentStatus(selectedStudentForPayment.id, payable.id) === payablesFilter;
                  });

                if (!visiblePayables.length) {
                  return (
                    <div className="text-center py-6">
                      <p className="text-gray-600">No payables match your filters.</p>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col gap-3">
                    {visiblePayables.map((payable) => {
                      const status = getPayablePaymentStatus(selectedStudentForPayment.id, payable.id);
                      const payableAmount = numberOrZero(payable.amount);
                      const remaining = getStudentPayableBalance(selectedStudentForPayment.id, payable.id);
                      const payableTransactions = getStudentPayablePayments(selectedStudentForPayment.id, payable.id);
                      const latestTransaction = payableTransactions[0] || null;
                      const isSelected = paymentForm.payableId === payable.id;
                      const per = paymentFormByPayable[payable.id] || {};
                      const selectedMode = per.mode || (isSelected ? paymentForm.mode : 'cash');
                      const voucherEnabled = numberOrZero(per.voucherAmount || (isSelected ? paymentForm.voucherAmount : '')) > 0;
                      const enteredAmount = numberOrZero(per.amount || (isSelected ? paymentForm.amount : ''));
                      const enteredVoucher = numberOrZero(per.voucherAmount || (isSelected ? paymentForm.voucherAmount : ''));
                      const displayedRemaining = Math.max(0, remaining - enteredAmount - enteredVoucher);

                      return (
                        <div
                          key={payable.id}
                          className={`border rounded-xl shadow p-4 bg-white border-gray-300`}
                          onClick={() => {
                            const per = paymentFormByPayable[payable.id] || {};
                            setPaymentForm((prev) => ({
                              ...prev,
                              studentId: selectedStudentForPayment.id,
                              payableId: payable.id,
                              amount: per.amount || '',
                              mode: per.mode || 'cash',
                              voucherAmount: per.voucherAmount || '',
                              voucherDescription: per.voucherDescription || '',
                              reference: per.reference || ''
                            }));
                          }}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex-1">
                              <h4 className="text-lg font-bold">{payable.title}</h4>
                              <p className="text-sm text-gray-600">
                                Total Amount: {formatPeso(payableAmount)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`inline-flex mr-1 items-center px-3 py-1 rounded-full text-xs font-medium ${getPayableStatusClasses(status)}`}>
                                {getPayableStatusLabel(status)}
                              </span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleEditPayable(payable);
                                }}
                                className="p-1.5 cursor-pointer rounded-full text-gray-700 hover:bg-gray-200"
                                title="Edit payable type"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openPayableTransactionHistory(payable);
                                }}
                                className="p-1.5 cursor-pointer rounded-full text-gray-700 hover:bg-gray-200"
                                title="View payment history"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!latestTransaction) {
                                    showError('No transactions to print yet.');
                                    return;
                                  }
                                  handlePrintExistingPayment(latestTransaction);
                                }}
                                className="p-1.5 cursor-pointer rounded-full text-gray-700 hover:bg-gray-200"
                                title="Print latest receipt"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!latestTransaction) {
                                    showError('No transactions to delete yet.');
                                    return;
                                  }
                                  handleDeletePayment(latestTransaction.id);
                                }}
                                className="p-1.5 cursor-pointer rounded-full text-gray-700 hover:bg-gray-200"
                                title="Delete latest transaction"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="text-xs mb-1">
                            <span className="mr-2">Mode of Payment:</span>
                            <label className="mr-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`paymentMode-${payable.id}`}
                                value="cash"
                                checked={selectedMode === 'cash'}
                                onChange={() => {
                                  setPaymentFormByPayable((prev) => ({
                                    ...prev,
                                    [payable.id]: { ...(prev[payable.id] || {}), mode: 'cash' }
                                  }));
                                  if (isSelected) {
                                    setPaymentForm((prev) => ({ ...prev, mode: 'cash' }));
                                  }
                                }}
                              /> Cash
                            </label>
                            <label className="mr-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`paymentMode-${payable.id}`}
                                value="gcash"
                                checked={selectedMode === 'gcash'}
                                onChange={() => {
                                  setPaymentFormByPayable((prev) => ({
                                    ...prev,
                                    [payable.id]: { ...(prev[payable.id] || {}), mode: 'gcash' }
                                  }));
                                  if (isSelected) {
                                    setPaymentForm((prev) => ({ ...prev, mode: 'gcash' }));
                                  }
                                }}
                              /> GCash
                            </label>
                            <label className="mr-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`paymentMode-${payable.id}`}
                                value="bank transfer"
                                checked={selectedMode === 'bank transfer'}
                                onChange={() => {
                                  setPaymentFormByPayable((prev) => ({
                                    ...prev,
                                    [payable.id]: { ...(prev[payable.id] || {}), mode: 'bank transfer' }
                                  }));
                                  if (isSelected) {
                                    setPaymentForm((prev) => ({ ...prev, mode: 'bank transfer' }));
                                  }
                                }}
                              /> Bank Transfer
                            </label>
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="New Payment Amount"
                              value={(paymentFormByPayable[payable.id] && paymentFormByPayable[payable.id].amount) || (isSelected ? paymentForm.amount : '')}
                              onChange={(event) => {
                                const value = event.target.value;
                                setPaymentFormByPayable((prev) => ({
                                  ...prev,
                                  [payable.id]: { ...(prev[payable.id] || {}), amount: value }
                                }));
                                if (isSelected) {
                                  setPaymentForm((prev) => ({ ...prev, amount: value }));
                                }
                              }}
                              className="w-1/3 flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                            />

                            <input
                              type="text"
                              placeholder="Reference (e.g., receipt number)"
                              value={(paymentFormByPayable[payable.id] && paymentFormByPayable[payable.id].reference) || (isSelected ? paymentForm.reference : '')}
                              onChange={(event) => {
                                const value = event.target.value;
                                setPaymentFormByPayable((prev) => ({
                                  ...prev,
                                  [payable.id]: { ...(prev[payable.id] || {}), reference: value }
                                }));
                                if (isSelected) {
                                  setPaymentForm((prev) => ({ ...prev, reference: value }));
                                }
                              }}
                              disabled={selectedMode === 'cash'}
                              className={`w-2/3 px-2 py-1.5 text-sm border border-gray-300 rounded-lg ${selectedMode === 'cash' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                          </div>

                          <div className="w-full mt-2">
                            <div className="flex items-center gap-2 mb-1 text-xs">
                              <span>Apply Voucher:</span>
                              <input
                                type="checkbox"
                                checked={voucherEnabled}
                                onChange={(event) => {
                                  if (event.target.checked) {
                                    setPaymentFormByPayable((prev) => ({
                                      ...prev,
                                      [payable.id]: { ...(prev[payable.id] || {}), voucherAmount: (prev[payable.id] && prev[payable.id].voucherAmount) || '0' }
                                    }));
                                    if (isSelected) {
                                      setPaymentForm((prev) => ({ ...prev, voucherAmount: (prev.voucherAmount || '0') }));
                                    }
                                    return;
                                  }

                                  setPaymentFormByPayable((prev) => ({
                                    ...prev,
                                    [payable.id]: { ...(prev[payable.id] || {}), voucherAmount: '', voucherDescription: '' }
                                  }));
                                  if (isSelected) {
                                    setPaymentForm((prev) => ({ ...prev, voucherAmount: '', voucherDescription: '' }));
                                  }
                                }}
                              />
                            </div>

                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Amount"
                                value={(paymentFormByPayable[payable.id] && paymentFormByPayable[payable.id].voucherAmount) || (isSelected ? paymentForm.voucherAmount : '')}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setPaymentFormByPayable((prev) => ({
                                    ...prev,
                                    [payable.id]: { ...(prev[payable.id] || {}), voucherAmount: value }
                                  }));
                                  if (isSelected) {
                                    setPaymentForm((prev) => ({ ...prev, voucherAmount: value }));
                                  }
                                }}
                                disabled={!voucherEnabled}
                                className={`w-1/3 px-2 py-1.5 text-sm border border-gray-300 rounded-lg ${!voucherEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                              />

                              <input
                                type="text"
                                placeholder="e.g. Scholarship, Promo"
                                value={(paymentFormByPayable[payable.id] && paymentFormByPayable[payable.id].voucherDescription) || (isSelected ? paymentForm.voucherDescription : '')}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setPaymentFormByPayable((prev) => ({
                                    ...prev,
                                    [payable.id]: { ...(prev[payable.id] || {}), voucherDescription: value }
                                  }));
                                  if (isSelected) {
                                    setPaymentForm((prev) => ({ ...prev, voucherDescription: value }));
                                  }
                                }}
                                disabled={!voucherEnabled}
                                className={`w-2/3 px-2 py-1.5 text-sm border rounded-lg ${!voucherEnabled ? 'opacity-50 cursor-not-allowed border-gray-300' : 'border-gray-300'}`}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-1 mt-4">
                            <p className="text-xs text-gray-600">Remaining: {formatPeso(displayedRemaining)}</p>
                            <p className="text-xs text-gray-500">Last payment: {latestTransaction ? toDateLabel(latestTransaction.date || latestTransaction.createdAt) : '---'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <form onSubmit={handleOpenPaymentConfirmation} className="sticky bottom-0 z-20 flex items-center justify-between gap-4 px-6 py-3 border-t border-gray-300 bg-white">
              <h3 className="font-semibold text-gray-800">
                Total Balance: {formatPeso(getStudentTotalBalance(selectedStudentForPayment.id))}
              </h3>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeStudentPaymentModal}
                  className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {editingPaymentId ? 'Update Payment' : 'Confirm Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editPayablesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={closeEditPayablesModal}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-slate-800">Edit Payables</h4>
              <button
                type="button"
                onClick={closeEditPayablesModal}
                className="px-3 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
            </div>

            {!payables.length && (
              <p className="text-sm text-slate-500">No payables available for this department yet.</p>
            )}

            {!!payables.length && (
              <div className="space-y-3">
                {payables.map((payable) => (
                  <div key={payable.id} className="rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{payable.title || 'Untitled Payable'}</p>
                      <p className="text-sm text-slate-600">Amount: {formatPeso(payable.amount)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          closeEditPayablesModal();
                          handleEditPayable(payable);
                        }}
                        className="px-3 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePayable(payable.id)}
                        className="px-3 py-1.5 rounded-full text-sm border text-rose-600 border-rose-500 bg-white hover:bg-rose-50 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {paymentConfirmModalOpen && pendingPaymentConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] bg-opacity-50"
            onClick={() => {
              if (loading) return;
              setPaymentConfirmModalOpen(false);
              setPendingPaymentConfirmation(null);
            }}
          />

          <div className="relative z-10 w-full max-w-lg max-h-[60vh] flex flex-col bg-white rounded-2xl shadow-md overflow-hidden">

            <div className="p-4 border-b border-gray-200 bg-white">
              <h2 className="text-xl font-bold">Confirm Payment Changes</h2>
              <p className="text-sm text-gray-600">For: {Array.isArray(pendingPaymentConfirmation) && pendingPaymentConfirmation[0] ? pendingPaymentConfirmation[0].student.name : ''}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {Array.isArray(pendingPaymentConfirmation)
                ? pendingPaymentConfirmation.map((change) => {
                    const totalAmount = numberOrZero(change.payable.amount);
                    const voucherAmount = numberOrZero(change.payload.voucherAmount);
                    const newPayment = numberOrZero(change.payload.amount);
                    const newBalance = numberOrZero(change.remainingBalance);
                    const prevBalance = Math.max(0, newBalance + newPayment + voucherAmount);
                    const changeModes = (String(change.payload.mode || 'cash')).toLowerCase().split(',').map(s => s.trim());

                    return (
                      <div className="border border-gray-200 rounded-lg p-4 shadow bg-white" key={change.payable.id}>
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="text-lg font-semibold">{change.payable.title}</h4>
                          <div className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${newPayment > 0 ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                            {newPayment > 0 ? 'Paid' : 'No Payment'}
                          </div>
                        </div>

                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4 text-xs">
                            <label className="inline-flex items-center gap-2"><input type="checkbox" disabled checked={changeModes.includes('cash')} /> CASH</label>
                            <label className="inline-flex items-center gap-2"><input type="checkbox" disabled checked={changeModes.includes('gcash')} /> GCASH</label>
                            <label className="inline-flex items-center gap-2"><input type="checkbox" disabled checked={changeModes.some(m => m.includes('bank'))} /> BANK TRANSFER</label>
                          </div>

                          <div className="text-xs text-right">
                            <div>Price: <b>{formatPeso(totalAmount)}</b></div>
                            {voucherAmount > 0 && (<div className="text-emerald-700">Voucher: -{formatPeso(voucherAmount)}</div>)}
                          </div>
                        </div>

                        <div className="border-t border-gray-200 my-2" />

                        <div className="grid grid-cols-3 gap-4 text-xs">
                          <div>
                            <p className="text-gray-500">Previous</p>
                            <p className={prevBalance > 0 ? 'text-red-700 font-semibold' : 'text-green-700 font-semibold'}>{formatPeso(prevBalance)}</p>
                          </div>

                          <div className="text-center">
                            <p className="text-gray-500">Payment</p>
                            <p className="text-blue-700 font-semibold">{formatPeso(newPayment)}</p>
                          </div>

                          <div className="text-right">
                            <p className="text-gray-500">Balance</p>
                            <p className={newBalance > 0 ? 'text-red-700 font-semibold' : 'text-green-700 font-semibold'}>{formatPeso(newBalance)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                : null}
            </div>

            <div className="flex gap-2 justify-end p-4 border-t border-gray-200 bg-white">
              <button
                onClick={() => { setPaymentConfirmModalOpen(false); setPendingPaymentConfirmation(null); }}
                disabled={loading}
                className="px-4 py-1.5 rounded-lg cursor-pointer text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmPayment}
                disabled={loading}
                className="px-4 py-1.5 rounded-lg cursor-pointer text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Confirm Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {transactionModalOpen && transactionPayable && selectedStudentForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setTransactionModalOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-slate-800">Payment History</h4>
                <p className="text-sm text-slate-600">
                  {selectedStudentForPayment.name} - {transactionPayable.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransactionModalOpen(false)}
                className="px-3 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
            </div>

            {transactionPayments.length === 0 && (
              <p className="text-sm text-slate-500">No payment history for this payable yet.</p>
            )}

            {transactionPayments.length > 0 && (
              <div className="space-y-3">
                {transactionPayments.map((payment) => {
                  const paidAmount = numberOrZero(payment.amount);
                  const voucherAmount = numberOrZero(payment.voucherAmount);
                  return (
                    <div key={payment.id} className="rounded-xl border border-slate-200 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">
                            Paid: {formatPeso(paidAmount)}
                            {voucherAmount > 0 ? ` + Voucher ${formatPeso(voucherAmount)}` : ''}
                          </p>
                          <p className="text-xs text-slate-600">
                            {toDateLabel(payment.date || payment.createdAt)} | {payment.mode || 'cash'}
                            {payment.reference ? ` | Ref: ${payment.reference}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditExistingPayment(payment)}
                            className="px-3 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                          >
                            <Pencil className="inline-block w-4 h-4 mr-1 align-[-2px]" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintExistingPayment(payment)}
                            className="px-3 py-1.5 rounded-full text-sm border text-emerald-600 border-emerald-500 bg-white hover:bg-emerald-50 cursor-pointer"
                          >
                            Print
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(payment.id)}
                            className="px-3 py-1.5 rounded-full text-sm border text-rose-600 border-rose-500 bg-white hover:bg-rose-50 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {deleteDepartmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={closeDeleteDepartmentModal}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
            <h4 className="text-lg font-semibold text-slate-800 mb-2">Delete Department</h4>
            <p className="text-sm text-slate-600 mt-4">
              Delete <strong>{departmentToDelete?.name || 'this department'}</strong> and all related records? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-8">
              <button
                type="button"
                onClick={closeDeleteDepartmentModal}
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteDepartment}
                disabled={loading}
                className="px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <ReceiptModal
        open={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          setReceiptData(null);
          setReceiptAutoPrint(false);
        }}
        receiptData={receiptData}
        autoPrint={receiptAutoPrint}
      />
    </div>
  );
};

export default OtherDepartmentPayables;
