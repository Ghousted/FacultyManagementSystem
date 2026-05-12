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
  ChevronLeft,
  X,
  Folder,
  Package,
  ChevronsUpDown, ChevronUp, ChevronDown
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { getOtherDepartments } from '../../models/facultyModels';
import { getOfferedModules } from '../../models/payablesModels';
import { createReceiptRecord, generateReceiptNumber } from '../../utils/receiptService';
import { logSystemAction } from '../../utils/auditLogger';
import ReceiptModal from './ReceiptModal';

const emptyDepartmentForm = { name: '', code: '' };
const emptyStudentForm = { name: '', course: '', yearLevel: '1', block: '' };

const emptyPayableForm = {
  title: '',
  amount: '',
  category: 'general',
  moduleId: '',
  moduleCode: '',
  moduleTitle: '',
  moduleCurriculumId: '',
  selectedModuleIds: []
};

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

  // Add Previous Balance state and handler
  const [individualPayableDialogOpen, setIndividualPayableDialogOpen] = useState(false);
  const [individualPayableForm, setIndividualPayableForm] = useState({
    type: '',
    amount: '',
    yearLevel: '',
    category: 'general',
    moduleId: '',
    moduleCode: '',
    moduleTitle: '',
    moduleCurriculumId: '',
    selectedModuleIds: []
  });
  const [selectedStudentForIndividualPayable, setSelectedStudentForIndividualPayable] = useState(null);
  const [offeredModules, setOfferedModules] = useState([]);
  const [moduleSelectorOpen, setModuleSelectorOpen] = useState(false);
  const [moduleSelectorContext, setModuleSelectorContext] = useState('individual');

  const loadOfferedModules = useCallback(async () => {
    const res = await getOfferedModules();
    if (res.success) setOfferedModules(res.data);
  }, []);

  useEffect(() => {
    loadOfferedModules();
  }, [loadOfferedModules]);

  const individualSelectedModuleIds = individualPayableForm?.selectedModuleIds || [];
  const individualSelectedModules = useMemo(
    () => offeredModules.filter((module) => individualSelectedModuleIds.includes(module.id)),
    [offeredModules, individualSelectedModuleIds]
  );

  const openAddPreviousBalanceModal = (student) => {
    setSelectedStudentForIndividualPayable(student);
    setIndividualPayableForm({
      type: '',
      amount: '',
      yearLevel: student.yearLevel.toString(),
      category: 'general',
      moduleId: '',
      moduleCode: '',
      moduleTitle: '',
      moduleCurriculumId: '',
      selectedModuleIds: []
    });
    setIndividualPayableDialogOpen(true);
  };

  const handleIndividualPayableInputChange = (field, value) => {
    setIndividualPayableForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveIndividualPayable = async () => {
    const isModule = individualPayableForm.category === 'module';
    if (!individualPayableForm.amount || !individualPayableForm.yearLevel || (!isModule && !individualPayableForm.type) || (isModule && (!individualPayableForm.selectedModuleIds || individualPayableForm.selectedModuleIds.length === 0))) {
      setError('Please fill in all required fields');
      return;
    }
    if (!selectedStudentForIndividualPayable) {
      setError('No student selected');
      return;
    }
    setLoading(true);
    try {
      const studentPayments = {
        [selectedStudentForIndividualPayable.id]: {
          status: 'unpaid',
          paidAmount: 0
        }
      };
      if (individualPayableForm.category === 'module') {
        const amount = parseFloat(individualPayableForm.amount);
        const selected = individualPayableForm.selectedModuleIds || [];
        if (selected.length === 0) {
          setError('Please select at least one module');
          setLoading(false);
          return;
        }
        const results = await Promise.all(selected.map((mid) => {
          const module = offeredModules.find(m => m.id === mid);
          const modulePayableData = {
            title: module ? `Module: ${module.courseCode} — ${module.courseTitle}` : (individualPayableForm.type || 'Module'),
            amount,
            yearLevel: parseInt(individualPayableForm.yearLevel),
            studentPayments,
            isIndividual: true,
            studentId: selectedStudentForIndividualPayable.id,
            studentName: selectedStudentForIndividualPayable.name,
            category: 'module',
            moduleId: module?.id || '',
            moduleCode: module?.courseCode || '',
            moduleTitle: module?.courseTitle || '',
            moduleCurriculumId: module?.curriculumId || '',
            departmentId: selectedDepartmentId,
            userId: currentUser.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          return addDoc(collection(db, 'otherDept-payables'), modulePayableData);
        }));
        const failedCount = results.filter(r => !r).length;
        if (failedCount === 0) {
          showSuccess(`Previous balance(s) added successfully for ${selectedStudentForIndividualPayable.name}!`);
          setIndividualPayableDialogOpen(false);
          setIndividualPayableForm({
            type: '',
            amount: '',
            yearLevel: '',
            category: 'general',
            moduleId: '',
            moduleCode: '',
            moduleTitle: '',
            moduleCurriculumId: '',
            selectedModuleIds: []
          });
          await loadDepartmentData();
        } else {
          setError(`${failedCount} previous balance(s) failed to save. Please try again.`);
        }
      } else {
        const newPayableData = {
          title: individualPayableForm.type,
          amount: parseFloat(individualPayableForm.amount),
          yearLevel: parseInt(individualPayableForm.yearLevel),
          studentPayments: studentPayments,
          isIndividual: true,
          studentId: selectedStudentForIndividualPayable.id,
          studentName: selectedStudentForIndividualPayable.name,
          category: individualPayableForm.category,
          departmentId: selectedDepartmentId,
          userId: currentUser.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'otherDept-payables'), newPayableData);
        showSuccess(`Previous balance added successfully for ${selectedStudentForIndividualPayable.name}!`);
        setIndividualPayableDialogOpen(false);
        setIndividualPayableForm({
          type: '',
          amount: '',
          yearLevel: '',
          category: 'general',
          moduleId: '',
          moduleCode: '',
          moduleTitle: '',
          moduleCurriculumId: '',
          selectedModuleIds: []
        });
        await loadDepartmentData();
      }
    } catch (error) {
      showError('Failed to add previous balance: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  const handlePayablesBreadcrumb = (event) => {
    const { departmentType, departmentName, selectedFolder } = event.detail || {};

    // Reset to the list of folders if the department name is clicked
    if (departmentType === 'other' && departmentName && selectedFolder === null) {
      setSelectedFolder(null);
    }
    // Reset to the list of departments if "Other Department" is clicked
    else if (departmentType === 'other' && !departmentName) {
      setSelectedDepartmentId('');
    }
  };

  window.addEventListener('payables-breadcrumb', handlePayablesBreadcrumb);
  return () => {
    window.removeEventListener('payables-breadcrumb', handlePayablesBreadcrumb);
  };
}, []);


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
  const [selectedFolder, setSelectedFolder] = useState(null);
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

  // Add these state variables near your other state declarations
const [curriculums, setCurriculums] = useState([]);
const [moduleYearLevelFilter, setModuleYearLevelFilter] = useState('all');
const [moduleCurriculumFilter, setModuleCurriculumFilter] = useState('all');
const [moduleSemesterFilter, setModuleSemesterFilter] = useState('all');
const [moduleSortConfig, setModuleSortConfig] = useState({ key: null, direction: 'ascending' });

const loadCurriculums = useCallback(async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'curriculums'));
    const curriculumsData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setCurriculums(curriculumsData);
  } catch (error) {
    console.error("Error loading curriculums: ", error);
    showError('Failed to load curriculums');
  }
}, []);


const handleModuleSort = useCallback((key) => {
  let direction = 'ascending';
  if (moduleSortConfig.key === key && moduleSortConfig.direction === 'ascending') {
    direction = 'descending';
  }
  setModuleSortConfig({ key, direction });
}, [moduleSortConfig]);


const filteredAndSortedModules = useMemo(() => {
  let filtered = offeredModules;

  // Apply year level filter
  if (moduleYearLevelFilter !== 'all') {
    filtered = filtered.filter(m => m.yearLevel === parseInt(moduleYearLevelFilter));
  }

  // Apply curriculum filter
  if (moduleCurriculumFilter !== 'all') {
    filtered = filtered.filter(m => m.curriculumId === moduleCurriculumFilter);
  }

  // Apply semester filter
  if (moduleSemesterFilter !== 'all') {
    filtered = filtered.filter(m => m.semester === parseInt(moduleSemesterFilter));
  }

  // Apply sorting
  if (moduleSortConfig.key) {
    filtered.sort((a, b) => {
      let aValue = a[moduleSortConfig.key];
      let bValue = b[moduleSortConfig.key];

      // Handle numeric sorting for yearLevel
      if (moduleSortConfig.key === 'yearLevel') {
        aValue = parseInt(aValue) || 0;
        bValue = parseInt(bValue) || 0;
      }

      if (aValue < bValue) {
        return moduleSortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (aValue > bValue) {
        return moduleSortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
  }

  return filtered;
}, [offeredModules, moduleYearLevelFilter, moduleCurriculumFilter, moduleSemesterFilter, moduleSortConfig]);

const getOrdinalSuffix = (num) => {
  const j = num % 10, k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
};


useEffect(() => {
  loadCurriculums();
}, [loadCurriculums]);

  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === selectedDepartmentId) || null,
    [departments, selectedDepartmentId]
  );

  const selectedModules = useMemo(
    () => offeredModules.filter((module) => payableForm.selectedModuleIds.includes(module.id)),
    [offeredModules, payableForm.selectedModuleIds]
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

  const studentsInSelectedFolder = useMemo(() => {
    if (!selectedFolder) return departmentStudents;
    return departmentStudents.filter((student) => {
      const block = (student.block || 'A').toString().trim().toUpperCase() || 'A';
      if (selectedFolder.isIrregular) {
        return student.isIrregular && block === selectedFolder.block;
      }
      return !student.isIrregular && Number(student.yearLevel) === Number(selectedFolder.year) && block === selectedFolder.block;
    });
  }, [departmentStudents, selectedFolder]);

  useEffect(() => {
    setSelectedFolder(null);
  }, [selectedDepartmentId]);

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
    setLoading(true);
    clearStatus();
    try {
      const result = await getOtherDepartments();
      if (!result.success) {
        throw new Error(result.error || 'Unable to load other departments.');
      }
      const records = result.data
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
            where('departmentId', '==', selectedDepartmentId)
          )
        ),
        getDocs(
          query(
            payablesRef,
            where('departmentId', '==', selectedDepartmentId)
          )
        ),
        getDocs(
          query(
            paymentsRef,
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
        await logSystemAction({
          action: 'Updated other department',
          module: 'Payables System',
          entityType: 'otherDepartment',
          entityId: editingDepartmentId,
          description: `Updated department: ${payload.name}`,
          details: payload
        });
        showSuccess('Department updated.');
      } else {
        const ref = await addDoc(collection(db, 'otherDepartments'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        await logSystemAction({
          action: 'Created other department',
          module: 'Payables System',
          entityType: 'otherDepartment',
          entityId: ref.id,
          description: `Created department: ${payload.name}`,
          details: payload
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


  const [sortField, setSortField] = useState("student");
const [sortDirection, setSortDirection] = useState("asc");

const handleSort = (field) => {
  if (sortField === field) {
    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
  } else {
    setSortField(field);
    setSortDirection("asc");
  }
};

const sortedStudents = [...studentsInSelectedFolder].sort((a, b) => {
  let valueA;
  let valueB;

  switch (sortField) {
    case "student":
      valueA = a.name || "";
      valueB = b.name || "";
      break;

    case "course":
      valueA = a.course || "";
      valueB = b.course || "";
      break;

    case "year":
      valueA = a.yearLevel || "";
      valueB = b.yearLevel || "";
      break;

    case "block":
      valueA = a.block || "";
      valueB = b.block || "";
      break;

    case "balance":
      valueA = getStudentTotalBalance(a.id);
      valueB = getStudentTotalBalance(b.id);
      break;

    default:
      valueA = "";
      valueB = "";
  }

  if (typeof valueA === "string") {
    return sortDirection === "asc"
      ? valueA.localeCompare(valueB)
      : valueB.localeCompare(valueA);
  }

  return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
});

const renderSortIcon = (field) => {
  if (sortField !== field) {
    return <ChevronsUpDown className="w-4 h-4" />;
  }

  return sortDirection === "asc" ? (
    <ChevronUp className="w-4 h-4" />
  ) : (
    <ChevronDown className="w-4 h-4" />
  );
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
      await logSystemAction({
        action: 'Deleted other department',
        module: 'Payables System',
        entityType: 'otherDepartment',
        entityId: departmentId,
        description: `Deleted department and related records: ${departmentToDelete.name || departmentId}`,
        details: {
          studentsDeleted: studentsSnapshot.docs.length,
          payablesDeleted: payablesSnapshot.docs.length,
          paymentsDeleted: paymentsSnapshot.docs.length
        }
      });

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
        await logSystemAction({
          action: 'Updated other department student',
          module: 'Payables System',
          entityType: 'otherDepartmentStudent',
          entityId: editingStudentId,
          description: `Updated student: ${payload.name}`,
          details: payload
        });
        showSuccess('Student updated.');
      } else {
        const ref = await addDoc(collection(db, 'otherDept-Students'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        await logSystemAction({
          action: 'Added other department student',
          module: 'Payables System',
          entityType: 'otherDepartmentStudent',
          entityId: ref.id,
          description: `Added student: ${payload.name}`,
          details: payload
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
      await logSystemAction({
        action: 'Deleted other department student',
        module: 'Payables System',
        entityType: 'otherDepartmentStudent',
        entityId: studentId,
        description: `Deleted student ${studentId} and related payment records`,
        details: { paymentsDeleted: paymentSnapshot.docs.length }
      });
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

    if (payableForm.category === 'module' && (!Array.isArray(payableForm.selectedModuleIds) || payableForm.selectedModuleIds.length === 0)) {
      showError('Please select at least one module.');
      return;
    }

    if (payableForm.category === 'general' && !payableForm.title.trim()) {
      showError('Payable title is required.');
      return;
    }

    if (!payableForm.amount) {
      showError('Payable amount is required.');
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
      const isModule = payableForm.category === 'module';
      const commonPayload = {
        userId: currentUser.uid,
        departmentId: selectedDepartmentId,
        amount,
        category: payableForm.category || 'general',
        updatedAt: new Date().toISOString()
      };

      if (editingPayableId) {
        const payload = {
          ...commonPayload,
          title: isModule
            ? `Module: ${payableForm.moduleCode} — ${payableForm.moduleTitle}`
            : payableForm.title.trim(),
          ...(isModule
            ? {
                moduleId: payableForm.moduleId,
                moduleCode: payableForm.moduleCode,
                moduleTitle: payableForm.moduleTitle,
                moduleCurriculumId: payableForm.moduleCurriculumId
              }
            : {})
        };
        await updateDoc(doc(db, 'otherDept-payables', editingPayableId), payload);
        await logSystemAction({
          action: 'Updated other department payable',
          module: 'Payables System',
          entityType: 'otherDepartmentPayable',
          entityId: editingPayableId,
          description: `Updated payable: ${payload.title}`,
          details: payload
        });
        showSuccess('Payable updated.');
      } else if (isModule) {
        const modulesToCreate = offeredModules.filter((module) =>
          payableForm.selectedModuleIds.includes(module.id)
        );
        const refs = await Promise.all(
          modulesToCreate.map((module) =>
            addDoc(collection(db, 'otherDept-payables'), {
              ...commonPayload,
              title: `Module: ${module.courseCode} — ${module.courseTitle}`,
              moduleId: module.id,
              moduleCode: module.courseCode,
              moduleTitle: module.courseTitle,
              moduleCurriculumId: module.curriculumId,
              createdAt: new Date().toISOString()
            })
          )
        );
        await logSystemAction({
          action: 'Created other department module payables',
          module: 'Payables System',
          entityType: 'otherDepartmentPayable',
          entityId: refs.length === 1 ? refs[0].id : refs.map((r) => r.id).join(','),
          description: `Created ${refs.length} module payable${refs.length === 1 ? '' : 's'}`,
          details: {
            count: refs.length,
            amountPerModule: amount,
            moduleIds: payableForm.selectedModuleIds
          }
        });
        showSuccess(`Created ${refs.length} module payable${refs.length === 1 ? '' : 's'}.`);
      } else {
        const payload = {
          ...commonPayload,
          title: payableForm.title.trim(),
          updatedAt: new Date().toISOString()
        };
        const ref = await addDoc(collection(db, 'otherDept-payables'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        await logSystemAction({
          action: 'Created other department payable',
          module: 'Payables System',
          entityType: 'otherDepartmentPayable',
          entityId: ref.id,
          description: `Created payable: ${payload.title}`,
          details: payload
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
      amount: String(numberOrZero(payable.amount)),
      category: payable.category || 'general',
      moduleId: payable.moduleId || '',
      moduleCode: payable.moduleCode || '',
      moduleTitle: payable.moduleTitle || '',
      moduleCurriculumId: payable.moduleCurriculumId || '',
      selectedModuleIds: payable.moduleId ? [payable.moduleId] : []
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
      await logSystemAction({
        action: 'Deleted other department payable',
        module: 'Payables System',
        entityType: 'otherDepartmentPayable',
        entityId: payableId,
        description: `Deleted payable ${payableId} and related payment records`,
        details: { paymentsDeleted: paymentSnapshot.docs.length }
      });
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

    const batchDrafts = getBatchPaymentConfirmationDrafts();
    if (batchDrafts) {
      setPendingPaymentConfirmation(batchDrafts);
      setPaymentConfirmModalOpen(true);
      return;
    }

    const singleDraft = getPaymentConfirmationDraft();
    if (singleDraft) {
      setPendingPaymentConfirmation([singleDraft]);
      setPaymentConfirmModalOpen(true);
      return;
    }
  };

  const handleConfirmPayment = async () => {
    if (!pendingPaymentConfirmation || !pendingPaymentConfirmation.length) return;

    setLoading(true);
    clearStatus();
    try {
      const paymentDate = new Date();
      const receiptNumber = await generateReceiptNumber(db, paymentDate);
      let receiptId = null;

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
          await logSystemAction({
            action: draft.remainingBalance === 0 ? 'Paid full' : 'Paid partial',
            module: 'Payables System',
            entityType: 'otherDepartmentPayment',
            entityId: editingPaymentId,
            description: `Paid ${draft.payable.title || 'payable'}`,
            details: {
              ...payloadWithReceipt,
              remainingBalance: draft.remainingBalance,
              status: draft.remainingBalance === 0 ? 'fully_paid' : 'partially_paid'
            }
          });
        } else {
          const ref = await addDoc(collection(db, 'otherDept-payment'), {
            ...payloadWithReceipt,
            createdAt: new Date().toISOString()
          });
          createdPaymentIds.push(ref.id);
          await logSystemAction({
            action: draft.remainingBalance === 0 ? 'Paid full' : 'Paid partial',
            module: 'Payables System',
            entityType: 'otherDepartmentPayment',
            entityId: ref.id,
            description: `Paid ${draft.payable.title || 'payable'}`,
            details: {
              ...payloadWithReceipt,
              remainingBalance: draft.remainingBalance,
              status: draft.remainingBalance === 0 ? 'fully_paid' : 'partially_paid'
            }
          });
        }
      }

      showSuccess('Payments recorded.');

      const receiptPreview = buildCombinedReceiptPreview(pendingPaymentConfirmation, receiptNumber);

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
      await logSystemAction({
        action: 'Deleted other department payment',
        module: 'Payables System',
        entityType: 'otherDepartmentPayment',
        entityId: paymentId,
        description: `Deleted payment ${paymentId}`
      });
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

  const getStudentPayables = (studentId) => {
    return payables.filter((p) => !p.studentId || p.studentId === studentId);
  };

  const getStudentTotalBalance = (studentId) => {
    const studentPayables = getStudentPayables(studentId);
    return studentPayables.reduce((sum, payable) => {
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
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-4 py-2 text-sm">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-2 text-sm">{success}</div>}

      {!selectedDepartment && (
        <>
          <div />
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="text-lg font-semibold text-slate-800">Departments</h3>
            <button
              type="button"
              onClick={openCreateDepartmentModal}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer bg-blue-500 text-white hover:bg-blue-600"
            >
              <BadgePlus className="w-4 h-4" />
              Add Department
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {departments.map((department) => (
              <div
                key={department.id}
                className="relative  rounded-xl border p-4 cursor-pointer bg-white shadow-md border-gray-300 hover:border-blue-500"
                onClick={() => {
                  setSelectedDepartmentId(department.id);
                  window.dispatchEvent(new CustomEvent('payables-breadcrumb', { detail: { departmentType: 'other', departmentName: department.name } }));
                }}
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

                <div className='flex items-start gap-4'>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-500">
                    <Folder className="h-5 w-5" />
                  </div>
                    <div className="text-left w-full pr-10">
                    <p className="text-xs text-slate-600 mt-1">{department.code || 'No code'}</p>
                    <p className="font-semibold text-sm h-12 text-slate-900">{department.name}</p>
                </div>
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
        <div className="flex flex-wrap items-center gap-2">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => {
              setSelectedDepartmentId('');
              window.dispatchEvent(
                new CustomEvent('payables-breadcrumb', {
                  detail: { departmentType: 'other' }
                })
              );
            }}
            className="p-2 cursor-pointer bg-blue-500 hover:bg-blue-600 text-white rounded-xl"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Conditionally Render Search Bar (only when inside a folder) */}
          {selectedFolder && (
            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search students"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                className="w-full border border-slate-300 rounded-lg text-sm pl-9 pr-3 py-1.5"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            Student management for other departments has been moved to Student Management → Other Departments.
          </div>
          <button
            type="button"
            onClick={openCreatePayableModal}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer bg-blue-500 text-white hover:bg-blue-600"
          >
            <BadgePlus className="w-4 h-4" />
            Add Payable
          </button>
        </div>
      </div>

            <div className="">
              {!selectedFolder ? (
                (() => {
                  const searchLower = studentSearch.trim().toLowerCase();
                  const filteredStudents = departmentStudents.filter((student) => {
                    if (!searchLower) return true;
                    const searchable = `${student.name || ''} ${student.course || ''} ${student.yearLevel || ''} ${student.block || ''}`.toLowerCase();
                    return searchable.includes(searchLower);
                  });
                  const folders = Array.from(filteredStudents.reduce((map, student) => {
                    const isIrregular = Boolean(student.isIrregular);
                    const year = isIrregular ? null : Number(student.yearLevel) || 1;
                    const block = (student.block || 'A').toString().trim().toUpperCase() || 'A';
                    const key = `${isIrregular ? 'irregular' : year}-${block}`;

                    if (!map.has(key)) {
                      map.set(key, {
                        key,
                        year,
                        block,
                        isIrregular,
                        label: isIrregular ? `Irregular Block ${block}` : `${year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year Block ${block}`,
                        students: []
                      });
                    }
                    map.get(key).students.push(student);
                    return map;
                  }, new Map()).values()).sort((a, b) => {
                    if (a.isIrregular && !b.isIrregular) return 1;
                    if (!a.isIrregular && b.isIrregular) return -1;
                    if (!a.isIrregular && !b.isIrregular && a.year !== b.year) return a.year - b.year;
                    return a.block.localeCompare(b.block);
                  });

                  if (folders.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <h6 className="text-lg text-gray-600 mb-2">{studentSearch ? 'No folders found' : 'No student folders yet'}</h6>
                        <p className="text-sm text-gray-600">
                          {studentSearch ? 'Try adjusting your search terms' : 'Students will appear here grouped by year level and block.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
                        {folders.map((folder) => (
                        <button
                          key={folder.key}
                          type="button"
                          onClick={() => {
                            setSelectedFolder(folder);
                            window.dispatchEvent(new CustomEvent('payables-breadcrumb', { detail: { departmentType: 'other', departmentName: selectedDepartment?.name || '', selectedFolder: folder } }));
                          }}
                          className="rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-lg"
                        >
                          <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-500">
                              <Folder className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{folder.label}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {folder.students.length} student{folder.students.length === 1 ? '' : 's'}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
  <table className="w-full text-sm">
    <thead className="bg-blue-500 text-white">
      <tr>
        <th
          onClick={() => handleSort("student")}
          className="px-3 py-1.5 w-[30%] cursor-pointer"
        >
          <div className="flex items-center gap-1">
            Student
            {renderSortIcon("student")}
          </div>
        </th>

        <th
          onClick={() => handleSort("course")}
          className="px-3 py-1.5 w-[15%] cursor-pointer"
        >
          <div className="flex items-center gap-1">
            Course
            {renderSortIcon("course")}
          </div>
        </th>

        <th
          onClick={() => handleSort("year")}
          className="px-3 py-1.5 w-[10%] cursor-pointer"
        >
          <div className="flex items-center gap-1">
            Year
            {renderSortIcon("year")}
          </div>
        </th>

        <th
          onClick={() => handleSort("block")}
          className="px-3 py-1.5 w-[10%] cursor-pointer"
        >
          <div className="flex items-center gap-1">
            Block
            {renderSortIcon("block")}
          </div>
        </th>

        <th
          onClick={() => handleSort("balance")}
          className="px-3 py-1.5 w-[20%] cursor-pointer text-right"
        >
          <div className="flex items-center justify-end gap-1">
            Total Balance
            {renderSortIcon("balance")}
          </div>
        </th>

        <th className="text-right px-3 py-1.5 w-[15%]">
          Actions
        </th>
      </tr>
    </thead>

    <tbody>
      {sortedStudents.length === 0 && (
        <tr className="border-t border-slate-200">
          <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
            No students in {selectedFolder.label}.
          </td>
        </tr>
      )}

      {sortedStudents.map((student) => (
        <tr
          key={student.id}
          className="border-t border-slate-200 cursor-pointer hover:bg-slate-50"
          onClick={() => openStudentPaymentModal(student)}
        >
          <td className="px-3 py-1.5 w-[30%]">{student.name}</td>
          <td className="px-3 py-1.5 w-[15%]">
            {student.course || "-"}
          </td>
          <td className="px-3 py-1.5 w-[10%]">
            {student.yearLevel}
          </td>
          <td className="px-3 py-1.5 w-[10%]">
            {student.block}
          </td>

          <td className="px-3 py-1.5 w-[20%] text-right font-semibold">
            {formatPeso(getStudentTotalBalance(student.id))}
          </td>

          <td className="px-3 py-2 w-[15%] text-right">
            <div className="flex justify-end items-center gap-1" onClick={(event) => event.stopPropagation()}>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                Managed in Student Management
              </span>
            </div>
          </td>
        </tr>
      ))}
    </tbody>

    {(selectedFolder ? sortedStudents : departmentStudents).length > 0 &&
      payables.length > 0 && (
        <tfoot className="bg-slate-50 border-t border-slate-200">
          <tr>
            <td
              colSpan={4}
              className="px-3 py-2 text-right font-semibold text-slate-700"
            >
              Total Balance
            </td>

            <td className="px-3 py-2 text-right font-bold text-slate-900">
              {formatPeso(
                (selectedFolder
                  ? sortedStudents
                  : departmentStudents
                ).reduce(
                  (sum, student) =>
                    sum + getStudentTotalBalance(student.id),
                  0
                )
              )}
            </td>

            <td className="px-3 py-2" />
          </tr>
        </tfoot>
      )}
  </table>
</div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Department Modal */}
      {departmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeDepartmentModal} aria-hidden="true" />
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
            <h4 className="text-lg font-semibold text-slate-800 mb-4">
              {editingDepartmentId ? 'Edit Department' : 'Create Department'}
            </h4>
            <form onSubmit={handleSaveDepartment} className="space-y-3">
              <label htmlFor="dept-name" className="block text-sm font-medium text-slate-700">
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
              <label htmlFor="dept-code" className="block text-sm font-medium text-slate-700">
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

      {/* Student Modal */}
      {studentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeStudentModal} aria-hidden="true" />
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
            <h4 className="text-lg font-semibold text-slate-800">
              {editingStudentId ? 'Edit Student' : 'Create Student'}
            </h4>
            <p className="text-sm text-slate-600 mb-6">
              Add a student to <strong>{selectedDepartment?.name || 'the department'}</strong> and manage their payables after.
            </p>
            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div>
                <label htmlFor="student-name" className="block text-xs font-medium text-slate-600 mb-1">
                  Student Name
                </label>
                <input
                  id="student-name"
                  type="text"
                  placeholder="e.g. Dela Cruz, Juan"
                  value={studentForm.name}
                  onChange={(event) => setStudentForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-none"
                />
              </div>
              <div className="flex gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Course</label>
                  <input
                    type="text"
                    placeholder="Course (e.g. BSIT)"
                    value={studentForm.course}
                    onChange={(event) => setStudentForm((prev) => ({ ...prev, course: event.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Year</label>
                  <select
                    value={studentForm.yearLevel}
                    onChange={(event) => setStudentForm((prev) => ({ ...prev, yearLevel: event.target.value }))}
                    className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-none"
                  >
                    <option value="">Select</option>
                    <option value="1">1st</option>
                    <option value="2">2nd</option>
                    <option value="3">3rd</option>
                    <option value="4">4th</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Block</label>
                  <input
                    type="text"
                    placeholder="Block (e.g. A)"
                    value={studentForm.block}
                    onChange={(event) => setStudentForm((prev) => ({ ...prev, block: event.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-none"
                  />
                </div>
              </div>
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
  <div className="fixed inset-0 z-1000 flex items-center justify-center p-4">
    <div
      className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      onClick={closePayableModal}
      aria-hidden="true"
    />
    <div className="relative w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
      <h4 className="text-lg font-semibold text-slate-800 mb-1">
        {editingPayableId ? 'Edit Payable' : 'Add Payable'}
      </h4>
      <p className="text-sm text-slate-600 mb-6">
        This payable applies to all students in <strong>{selectedDepartment?.name || 'this department'}</strong>, including newly added students.
      </p>

      <form onSubmit={handleSavePayable} className="space-y-4">
        {/* Category Selection */}
       <div className='flex items-center gap-4'>
  <label className="block text-sm font-medium text-slate-700">
    Category: 
  </label>

  <div className="flex items-center gap-4">
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
      <input
        type="radio"
        name="category"
        checked={payableForm.category === 'general'}
        onChange={() =>
          setPayableForm((prev) => ({
            ...prev,
            category: 'general',
            selectedModuleIds: [],
          }))
        }
        className="cursor-pointer"
      />
      General
    </label>

    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
      <input
        type="radio"
        name="category"
        checked={payableForm.category === 'module'}
        onChange={() => {
          setPayableForm((prev) => ({
            ...prev,
            category: 'module',
          }));
          setModuleSelectorOpen(true);
        }}
        className="cursor-pointer"
      />
      Module
    </label>
  </div>
</div>

        {/* Module Selection */}
        {payableForm.category === 'module' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Selected Modules</label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <label className="text-sm font-semibold text-slate-800">Selected Modules</label>
                    <p className="text-xs text-slate-500">Manage the modules assigned to this entry</p>
                  </div>
                  {selectedModules.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setModuleSelectorContext('new');
                        setModuleSelectorOpen(true);
                      }}
                      className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 cursor-pointer transition"
                    >
                      Change
                    </button>
                  )}
                </div>
                {selectedModules.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedModules.map((module) => (
                      <div
                        key={module.id}
                        className="rounded-lg border text-center border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-800 hover:bg-slate-100 transition"
                      >
                        <span className="font-medium">{module.courseCode}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setModuleSelectorContext('new');
                      setModuleSelectorOpen(true);
                    }}
                    className="inline-flex items-center rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 cursor-pointer transition"
                  >
                    Select Modules
                  </button>
                )}
              </div>
              {offeredModules.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No subjects are marked as offered yet. Click <span className="font-medium">Modules</span> in the toolbar to mark some.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount per module</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., 1500.00"
                value={payableForm.amount}
                onChange={(e) => setPayableForm((prev) => ({ ...prev, amount: e.target.value }))}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
              />
            </div>
            {selectedModules.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Amount per module</span>
                  <span className="font-semibold">{formatPeso(payableForm.amount)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 mt-2 font-semibold">
                  <span>Total</span>
                  <span>{formatPeso((Number(payableForm.amount) || 0) * selectedModules.length)}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payable Name</label>
              <input
                type="text"
                placeholder="e.g. Laboratory Fee"
                value={payableForm.title}
                onChange={(event) => setPayableForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., 1500.00"
                value={payableForm.amount}
                onChange={(e) => setPayableForm((prev) => ({ ...prev, amount: e.target.value }))}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
              />
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 mt-6">
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
            className="px-6 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {editingPayableId ? 'Update Payable' : 'Add Payable'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
      {/* Module Selector Modal */}
      {moduleSelectorOpen && (
  <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 px-4 py-6">
    <div
      className="absolute inset-0"
      onClick={() => setModuleSelectorOpen(false)}
    ></div>

    <div className="relative z-10 w-full max-w-3xl rounded-3xl border h-[90vh] border-slate-200 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Select Modules
          </h2>
          <p className="text-sm text-slate-500">
            Choose modules to include.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModuleSelectorOpen(false)}
          className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
        {/* Year Level Filters */}
        <div className="mb-5 flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
          {['1', '2', '3', '4'].map((y) => {
            // Determine if this year is active
            const isActive = moduleSelectorContext === 'new'
              ? moduleYearLevelFilter === y
              : individualPayableForm.yearLevel === y;

            return (
              <button
                key={y}
                type="button"
                onClick={() => {
                  if (moduleSelectorContext === 'new') {
                    setModuleYearLevelFilter(y);
                  } else {
                    handleIndividualPayableInputChange('yearLevel', y);
                  }
                }}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                {y}th Year
              </button>
            );
          })}
        </div>

        {/* Curriculum and Semester Filters */}
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            value={moduleSelectorContext === 'new' ? moduleCurriculumFilter : 'all'}
            onChange={(e) => {
              if (moduleSelectorContext === 'new') {
                setModuleCurriculumFilter(e.target.value);
              }
              // For individual context, you might want to handle curriculum filtering differently
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            <option value="all">All Curriculums</option>
            {curriculums?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={moduleSelectorContext === 'new' ? moduleSemesterFilter : 'all'}
            onChange={(e) => {
              if (moduleSelectorContext === 'new') {
                setModuleSemesterFilter(e.target.value);
              }
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            <option value="all">All Semesters</option>
            <option value="1">1st Semester</option>
            <option value="2">2nd Semester</option>
            <option value="3">Summer</option>
          </select>
        </div>

        {/* Modules Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-slate-600">
                <tr>
                  <th className="w-[70px] px-4 py-3 font-semibold">
                    Select
                  </th>
                  <th className="px-4 py-3 font-semibold cursor-pointer">
                    <div className="flex items-center gap-1">
                      Code
                      <ChevronsUpDown className="h-4 w-4" />
                    </div>
                  </th>
                  <th className="px-4 py-3 font-semibold cursor-pointer">
                    <div className="flex items-center gap-1">
                      Title
                      <ChevronsUpDown className="h-4 w-4" />
                    </div>
                  </th>
                  <th className="px-4 py-3 font-semibold cursor-pointer">
                    <div className="flex items-center gap-1">
                      Year Level
                      <ChevronsUpDown className="h-4 w-4" />
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {(() => {
                  // Filter modules based on context
                  let filteredModules = offeredModules;

                  // Apply year level filter
                  if (moduleSelectorContext === 'new' && moduleYearLevelFilter !== 'all') {
                    filteredModules = filteredModules.filter(
                      m => m.yearLevel === parseInt(moduleYearLevelFilter)
                    );
                  } else if (moduleSelectorContext === 'individual' && individualPayableForm.yearLevel) {
                    filteredModules = filteredModules.filter(
                      m => m.yearLevel === parseInt(individualPayableForm.yearLevel)
                    );
                  }

                  // Apply curriculum filter for new context
                  if (moduleSelectorContext === 'new' && moduleCurriculumFilter !== 'all') {
                    filteredModules = filteredModules.filter(
                      m => m.curriculumId === moduleCurriculumFilter
                    );
                  }

                  // Apply semester filter for new context
                  if (moduleSelectorContext === 'new' && moduleSemesterFilter !== 'all') {
                    filteredModules = filteredModules.filter(
                      m => m.semester === parseInt(moduleSemesterFilter)
                    );
                  }

                  return filteredModules.map((module, index) => {
                    const isNewContext = moduleSelectorContext === 'new';
                    const checked = isNewContext
                      ? (payableForm.selectedModuleIds || []).includes(module.id)
                      : (individualPayableForm.selectedModuleIds || []).includes(module.id);

                    return (
                      <tr
                        key={module.id ?? module.courseCode ?? `offered-module-${index}`}
                        className="border-t border-slate-200 bg-white transition hover:bg-slate-50"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (isNewContext) {
                                setPayableForm((prev) => {
                                  const selected = new Set(prev.selectedModuleIds || []);
                                  if (selected.has(module.id)) {
                                    selected.delete(module.id);
                                  } else {
                                    selected.add(module.id);
                                  }
                                  return {
                                    ...prev,
                                    selectedModuleIds: Array.from(selected),
                                  };
                                });
                              } else {
                                setIndividualPayableForm((prev) => {
                                  const selected = new Set(prev.selectedModuleIds || []);
                                  if (selected.has(module.id)) {
                                    selected.delete(module.id);
                                  } else {
                                    selected.add(module.id);
                                  }
                                  const arr = Array.from(selected);
                                  // If only one module is selected, auto-fill module details
                                  if (arr.length === 1) {
                                    const m = offeredModules.find((mm) => mm.id === arr[0]);
                                    return {
                                      ...prev,
                                      selectedModuleIds: arr,
                                      moduleId: m?.id || '',
                                      moduleCode: m?.courseCode || '',
                                      moduleTitle: m?.courseTitle || '',
                                      moduleCurriculumId: m?.curriculumId || '',
                                      type: m ? m.courseCode : prev.type,
                                    };
                                  }
                                  return {
                                    ...prev,
                                    selectedModuleIds: arr,
                                  };
                                });
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {module.courseCode}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {module.courseTitle}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {module.yearLevel ? `${module.yearLevel}${getOrdinalSuffix(module.yearLevel)} Year` : 'N/A'}
                        </td>
                      </tr>
                    );
                  });
                })()}

                {offeredModules.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-4 py-12 text-center text-sm text-slate-500">
                      No modules match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

      {/* Student Payment Modal */}
      {studentPaymentModalOpen && selectedStudentForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeStudentPaymentModal} aria-hidden="true" />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-lg max-h-[90vh] z-10 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-20 bg-blue-50 border-b border-gray-200">
              <div>
                <h4 className="text-lg font-bold">{selectedStudentForPayment.name}</h4>
                <p className="text-xs text-slate-600">
                  {selectedStudentForPayment.course || '-'} {selectedStudentForPayment.yearLevel}
                  {selectedStudentForPayment.yearLevel === '1' && 'ST'}
                  {selectedStudentForPayment.yearLevel === '2' && 'ND'}
                  {selectedStudentForPayment.yearLevel === '3' && 'RD'}
                  {selectedStudentForPayment.yearLevel === '4' && 'TH'} Year - Block {selectedStudentForPayment.block}
                </p>
              </div>
              <button
                className="ml-4 px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-blue-50 font-medium shadow-sm"
                onClick={() => openAddPreviousBalanceModal(selectedStudentForPayment)}
              >
                + Add Prev. Balance
              </button>
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
                const studentPayables = getStudentPayables(selectedStudentForPayment.id);
                const visiblePayables = studentPayables
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
                          className="border rounded-xl shadow p-4 bg-white border-gray-300"
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
                              <p className="text-sm text-gray-600">Total Amount: {formatPeso(payableAmount)}</p>
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
                                  const confirmed = window.confirm('Delete this payable and all related payments? This cannot be undone.');
                                  if (!confirmed) return;
                                  handleDeletePayable(payable.id);
                                }}
                                className="p-1.5 cursor-pointer rounded-full text-red-600 hover:bg-red-100"
                                title="Delete this payable"
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

     {individualPayableDialogOpen && (
  <div className="fixed inset-0 z-1000 flex items-center justify-center p-4">
    <div
      className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      onClick={() => {
        setIndividualPayableDialogOpen(false);
        setIndividualPayableForm({
          type: '',
          amount: '',
          yearLevel: '',
          category: 'general',
          moduleId: '',
          moduleCode: '',
          moduleTitle: '',
          moduleCurriculumId: '',
          selectedModuleIds: []
        });
        setSelectedStudentForIndividualPayable(null);
      }}
      aria-hidden="true"
    />
    <div className="relative w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
      <h4 className="text-lg font-semibold text-slate-800 mb-1">
        Add Previous Balance / Custom Charge
      </h4>
      {selectedStudentForIndividualPayable && (
        <p className="text-sm text-slate-600 mb-6">
          For: <strong>{selectedStudentForIndividualPayable.name}</strong>
        </p>
      )}

      <form onSubmit={(e) => { e.preventDefault(); handleSaveIndividualPayable(); }} className="space-y-4">
        {/* Category Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => handleIndividualPayableInputChange('category', 'general')}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition ${
                individualPayableForm.category === 'general'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              General
            </button>
            <button
              type="button"
              onClick={() => {
                handleIndividualPayableInputChange('category', 'module');
                setModuleSelectorContext('individual');
                setModuleSelectorOpen(true);
              }}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition ${
                individualPayableForm.category === 'module'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Module
            </button>
          </div>
        </div>

        {/* Module Selection */}
        {individualPayableForm.category === 'module' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Selected Modules</label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <label className="text-sm font-semibold text-slate-800">Selected Modules</label>
                    <p className="text-xs text-slate-500">Manage the modules assigned to this charge</p>
                  </div>
                  {individualSelectedModules.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setModuleSelectorContext('individual');
                        setModuleSelectorOpen(true);
                      }}
                      className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 cursor-pointer transition"
                    >
                      Change
                    </button>
                  )}
                </div>
                {individualSelectedModules.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {individualSelectedModules.map((module) => (
                      <div
                        key={module.id}
                        className="rounded-lg border text-center border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-800 hover:bg-slate-100 transition"
                      >
                        <span className="font-medium">{module.courseCode}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setModuleSelectorContext('individual');
                      setModuleSelectorOpen(true);
                    }}
                    className="inline-flex items-center rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 cursor-pointer transition"
                  >
                    Select Modules
                  </button>
                )}
              </div>
              {offeredModules.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No subjects are marked as offered yet. Click <span className="font-medium">Modules</span> in the toolbar to mark some.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount per module</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., 1500.00"
                value={individualPayableForm.amount}
                onChange={(e) => handleIndividualPayableInputChange('amount', e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
              />
            </div>
            {individualSelectedModules.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Amount per module</span>
                  <span className="font-semibold">{formatPeso(individualPayableForm.amount)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 mt-2 font-semibold">
                  <span>Total</span>
                  <span>{formatPeso((Number(individualPayableForm.amount) || 0) * individualSelectedModules.length)}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Charge Type</label>
              <input
                type="text"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                placeholder="Payable Type (e.g., 2nd Year Balance, Laboratory Fee, etc.)"
                value={individualPayableForm.type}
                onChange={(e) => handleIndividualPayableInputChange('type', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., 1500.00"
                value={individualPayableForm.amount}
                onChange={(e) => handleIndividualPayableInputChange('amount', e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
              />
            </div>
          </>
        )}

        {/* Year Level Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Year Level (when the charge was incurred)</label>
          <select
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
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

        {/* Info Box */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-xs text-blue-800">
            This will add a payable specifically for <strong>{selectedStudentForIndividualPayable?.name}</strong>.
            Other students will not see this charge.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={() => {
              setIndividualPayableDialogOpen(false);
              setIndividualPayableForm({
                type: '',
                amount: '',
                yearLevel: '',
                category: 'general',
                moduleId: '',
                moduleCode: '',
                moduleTitle: '',
                moduleCurriculumId: '',
                selectedModuleIds: []
              });
              setSelectedStudentForIndividualPayable(null);
            }}
            className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              (!individualPayableForm.amount || !individualPayableForm.yearLevel || loading) ||
              (individualPayableForm.category === 'module'
                ? !(individualPayableForm.selectedModuleIds && individualPayableForm.selectedModuleIds.length > 0)
                : !individualPayableForm.type)
            }
            className="px-6 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Adding...' : 'Add Previous Balance'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
      {/* Edit Payables Modal */}
      {editPayablesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeEditPayablesModal} aria-hidden="true" />
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
            {!payables.length && <p className="text-sm text-slate-500">No payables available for this department yet.</p>}
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

      {/* Payment Confirmation Modal */}
      {paymentConfirmModalOpen && pendingPaymentConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] bg-opacity-50" onClick={() => !loading && setPaymentConfirmModalOpen(false)} />
          <div className="relative z-10 w-full max-w-lg max-h-[60vh] flex flex-col bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-white">
              <h2 className="text-xl font-bold">Confirm Payment Changes</h2>
              <p className="text-sm text-gray-600">
                For: {Array.isArray(pendingPaymentConfirmation) && pendingPaymentConfirmation[0] ? pendingPaymentConfirmation[0].student.name : ''}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {Array.isArray(pendingPaymentConfirmation) &&
                pendingPaymentConfirmation.map((change) => {
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
                        <div className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${
                          newPayment > 0 ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>
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
                          {voucherAmount > 0 && <div className="text-emerald-700">Voucher: -{formatPeso(voucherAmount)}</div>}
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
                })}
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

      {/* Transaction History Modal */}
      {transactionModalOpen && transactionPayable && selectedStudentForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setTransactionModalOpen(false)} aria-hidden="true" />
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
            {transactionPayments.length === 0 && <p className="text-sm text-slate-500">No payment history for this payable yet.</p>}
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

      {/* Delete Department Modal */}
      {deleteDepartmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeDeleteDepartmentModal} aria-hidden="true" />
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