import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  createPayable,
  getPayables,
  updatePayable,
  deletePayable,
  createStudentPayment,
  getStudentPayments,
  getAllStudentPayments,
  getOfferedModules
} from '../../models/payablesModels';
import { getActiveTerm } from '../../models/facultyModels';
import { useAuth } from '../../contexts/AuthContext';
import { BadgePlus,  Search, ChevronUp, ChevronDown, ChevronLeft, ChevronsUpDown, Funnel, X, Printer, Pencil, Delete, History, ArrowBigLeft, Settings2, Receipt, Trash, Package, Folder } from 'lucide-react';
import ModuleManagement from './ModuleManagement';
import Logo from '../../assets/logo.png';
import ReceiptModal, { printReceiptDirect } from './ReceiptModal';
import { db } from '../../firebase';
import { getCurriculums, getStudents  } from '../../models/curriculumModels';
import { exportCcsPayablesSpreadsheet } from '../../utils/ccsPayablesExport';

const formatPeso = (value) => {
  const numberValue = Number(value);
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(numberValue) ? numberValue : 0);
};

const sanitizeExportText = (value) => String(value || '').replace(/[\\/?*\[\]:]/g, '-').trim() || 'payables';

import { generateReceiptNumber, createReceiptRecord } from '../../utils/receiptService';
import toast from 'react-hot-toast';

const PayablesSystem = ({ onBackToDashboard, registerToolbarActions }) => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [sortBy, setSortBy] = useState('name-asc');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [activeTerm, setActiveTerm] = useState({ semester: null, schoolYear: '' });
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportFilenameModalOpen, setExportFilenameModalOpen] = useState(false);
  const [pendingExportMode, setPendingExportMode] = useState('xlsx-current-folder');
const formatTermDisplay = (term) => {
  if (!term?.semester || !term?.schoolYear) return 'Not set';
  const semesterLabel = Number(term.semester) === 1
    ? '1st Semester'
    : Number(term.semester) === 2
      ? '2nd Semester'
      : Number(term.semester) === 3
        ? 'Summer'
        : `Semester ${term.semester}`;
  return `${semesterLabel} · S.Y. ${term.schoolYear}`;
};

const isSameTerm = (left, right) => {
  if (!left?.semester || !left?.schoolYear || !right?.semester || !right?.schoolYear) return false;
  return Number(left.semester) === Number(right.semester) && String(left.schoolYear || '').trim() === String(right.schoolYear || '').trim();
};

  const [exportFilename, setExportFilename] = useState('');

  // Move `offeredModules` state before any dependent logic
  const [offeredModules, setOfferedModules] = useState([]);
  const [moduleSelectorOpen, setModuleSelectorOpen] = useState(false);
  const [moduleSelectorContext, setModuleSelectorContext] = useState('new');
  const [moduleSortConfig, setModuleSortConfig] = useState({ key: 'courseCode', direction: 'ascending' });
  const [moduleYearLevelFilter, setModuleYearLevelFilter] = useState('1');
  const [moduleCurriculumFilter, setModuleCurriculumFilter] = useState('all');
  const [moduleSemesterFilter, setModuleSemesterFilter] = useState('all');
  const [curriculums, setCurriculums] = useState([]);
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

  useEffect(() => {
    const loadActiveTerm = async () => {
      if (!currentUser) return;
      const result = await getActiveTerm();
      if (result.success && result.data) {
        setActiveTerm(result.data);
      }
    };

    loadActiveTerm();

    const handlePayablesBreadcrumb = (event) => {
      const { departmentType, selectedFolder } = event.detail || {};
      if (departmentType === 'ccs' && selectedFolder === null) {
        setSelectedFolder(null);
        setTabValue(0);
        setSearchTerm('');
      }
    };

    window.addEventListener('payables-breadcrumb', handlePayablesBreadcrumb);
    return () => {
      window.removeEventListener('payables-breadcrumb', handlePayablesBreadcrumb);
    };
  }, [currentUser]);

  useEffect(() => {
    const handler = (e) => {
      const dept = e?.detail?.departmentType;
      if (dept === 'ccs') {
        setSelectedFolder(null);
        setTabValue(0);
        setSearchTerm('');
        window.scrollTo?.(0, 0);
      }
    };
    window.addEventListener('payables-reset', handler);
    return () => window.removeEventListener('payables-reset', handler);
  }, []);

useEffect(() => {
  const loadCurriculums = async () => {
    try {
      const res = await getCurriculums(); // Ensure this matches the exported function
      if (res.success) setCurriculums(res.data);
    } catch (error) {
      console.error("Failed to load curriculums:", error);
    }
  };
  loadCurriculums();
}, []);

  useEffect(() => {
    if (!exportMenuOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (event.target.closest('.export-dropdown-container')) {
        return;
      }

      setExportMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportMenuOpen]);

  const handleModuleSort = (key) => {
    let direction = 'ascending';
    if (moduleSortConfig.key === key && moduleSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setModuleSortConfig({ key, direction });
  };

  const openModuleManagement = useCallback(() => {
    setModuleManagementOpen(true);
  }, []);

  // Now `filteredAndSortedModules` can safely use `offeredModules`
  const filteredAndSortedModules = useMemo(() => {
    let result = offeredModules.filter((module) => {
      const yearFilter = moduleSelectorContext === 'individual'
        ? individualPayableForm.yearLevel
        : moduleYearLevelFilter;
      const curriculumFilter = moduleSelectorContext === 'individual'
        ? 'all'
        : moduleCurriculumFilter;
      const semesterFilter = moduleSelectorContext === 'individual'
        ? 'all'
        : moduleSemesterFilter;

      if (yearFilter && yearFilter !== 'all' && module.yearLevel !== Number(yearFilter)) return false;
      if (curriculumFilter !== 'all' && module.curriculumId !== curriculumFilter) return false;
      if (semesterFilter !== 'all' && module.semester !== Number(semesterFilter)) return false;
      return true;
    });

    result.sort((a, b) => {
      if (moduleSortConfig.key === 'courseCode') {
        const aValue = (a.courseCode || '').toLowerCase();
        const bValue = (b.courseCode || '').toLowerCase();
        return moduleSortConfig.direction === 'ascending'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      if (moduleSortConfig.key === 'courseTitle') {
        const aValue = (a.courseTitle || '').toLowerCase();
        const bValue = (b.courseTitle || '').toLowerCase();
        return moduleSortConfig.direction === 'ascending'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      if (moduleSortConfig.key === 'yearLevel') {
        const aValue = a.yearLevel || 0;
        const bValue = b.yearLevel || 0;
        return moduleSortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
      }
      return 0;
    });

    return result;
  }, [
    offeredModules,
    moduleSortConfig,
    moduleSelectorContext,
    moduleYearLevelFilter,
    moduleCurriculumFilter,
    moduleSemesterFilter,
    individualPayableForm.yearLevel
  ]);

  const getOrdinalSuffix = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  // Derive available blocks dynamically from loaded students
  const getAvailableBlocks = useCallback(() => {
    const set = new Set();
    students.forEach(s => {
      const block = s && s.block && String(s.block).trim() !== '' ? String(s.block).trim().toUpperCase() : 'A';
      set.add(block);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const getBlocksForYear = useCallback((year, isIrregular = false) => {
    if (isIrregular) return [];
    const set = new Set();
    students.forEach(s => {
      if ((Number(s.yearLevel) === Number(year)) && !s.isIrregular) {
        const block = s && s.block && String(s.block).trim() !== '' ? String(s.block).trim().toUpperCase() : 'A';
        set.add(block);
      }
    });
    const blocks = Array.from(set).sort((a, b) => a.localeCompare(b));
    if (blocks.length === 0) return ['A'];
    return blocks;
  }, [students]);

  const [moduleManagementOpen, setModuleManagementOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentType: 'tuition',
    description: '',
    dueDate: '',
    status: 'pending'
  });

  const [payables, setPayables] = useState({});
  const [editingMode, setEditingMode] = useState(false);
  const [addPayableDialogOpen, setAddPayableDialogOpen] = useState(false);
  const [newPayableForm, setNewPayableForm] = useState({
    type: '',
    amount: '',
    status: 'unpaid',
    paidAmount: '0',
    yearLevel: 'all',
    block: 'all',
    category: 'general',
    moduleId: '',
    moduleCode: '',
    moduleTitle: '',
    moduleCurriculumId: '',
    selectedModuleIds: []
  });

  const selectedModuleIds = newPayableForm?.selectedModuleIds || [];
  const selectedModules = useMemo(
    () => offeredModules.filter((module) => selectedModuleIds.includes(module.id)),
    [offeredModules, selectedModuleIds]
  );

  const loadOfferedModules = useCallback(async () => {
    const res = await getOfferedModules(activeTerm);
    if (res.success) setOfferedModules(res.data);
  }, [activeTerm]);

  useEffect(() => { loadOfferedModules(); }, [loadOfferedModules]);

  const [selectedStudentModal, setSelectedStudentModal] = useState(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [stagedPayments, setStagedPayments] = useState({});
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [stagedPaymentModes, setStagedPaymentModes] = useState({});
  const [stagedPaymentReferences, setStagedPaymentReferences] = useState({});
  const [stagedVouchers, setStagedVouchers] = useState({});

  const normalizeModesValue = (v) => {
    if (!v) return ['cash'];
    if (Array.isArray(v)) return v.map(s => String(s).trim().toLowerCase()).filter(Boolean);
    return String(v).split(/[,|\\/&;+]+|\s+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  };

  const getModesFor = (payableId) => normalizeModesValue(stagedPaymentModes?.[payableId]);

  const hasMode = (payableId, mode) => getModesFor(payableId).includes(String(mode).toLowerCase());

  const toggleMode = (payableId, mode) => {
    setStagedPaymentModes(prev => {
      const current = normalizeModesValue(prev?.[payableId]);
      const m = String(mode).toLowerCase();
      const exists = current.includes(m);
      const next = exists ? current.filter(x => x !== m) : [...current, m];
      return { ...prev, [payableId]: next };
    });
  };

  const normalizeModeForStore = (mode) => {
    if (!mode) return 'cash';
    if (Array.isArray(mode)) return mode.length === 1 ? mode[0] : mode.join(',');
    return String(mode);
  };

  const individualSelectedModuleIds = individualPayableForm?.selectedModuleIds || [];
  const individualSelectedModules = useMemo(
    () => offeredModules.filter((module) => individualSelectedModuleIds.includes(module.id)),
    [offeredModules, individualSelectedModuleIds]
  );

  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryData, setSummaryData] = useState({ changes: [], totalCurrentBalance: 0, totalNewBalance: 0 });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionPayable, setTransactionPayable] = useState(null);
  const [transactionPayments, setTransactionPayments] = useState([]);

  const [studentTransactionsModalOpen, setStudentTransactionsModalOpen] = useState(false);
  const [selectedStudentForTransactions, setSelectedStudentForTransactions] = useState(null);
  const [studentTransactions, setStudentTransactions] = useState([]);

  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [receiptAutoPrint, setReceiptAutoPrint] = useState(false);

  const [payablesFilter, setPayablesFilter] = useState('all');
  const [payablesViewMode, setPayablesViewMode] = useState('list');
  const [payablesSearch, setPayablesSearch] = useState('');
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
        setStudents((result.data || []).filter((student) => {
          if (!student || student.enrolled === false) return false;
          if (!activeTerm?.semester || !activeTerm?.schoolYear) return student.enrolled !== false;
          const studentTerm = student.enrolledTerm || student.createdTerm || null;
          if (!studentTerm || (!studentTerm.semester && !studentTerm.schoolYear)) return student.enrolled === true;
          return isSameTerm(studentTerm, activeTerm);
        }));
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to load students: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [activeTerm, currentUser]);

  const loadPayables = useCallback(async () => {
    if (!currentUser) {
      setError('Please sign in to access payables data');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await getPayables(currentUser.uid, activeTerm);
      if (result.success) {
        const yearSpecificPayables = {};
        (result.data || []).forEach((payable) => {
          const yearLevel = payable.yearLevel;
          if (!yearSpecificPayables[yearLevel]) {
            yearSpecificPayables[yearLevel] = [];
          }
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
  }, [currentUser, activeTerm]);

  useEffect(() => {
    if (currentUser) {
      loadStudents();
      loadPayables();
    }
  }, [currentUser, loadStudents, loadPayables, activeTerm]);

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

  const handleAddPayable = useCallback(() => {
    let defaultYearLevel = tabValue === 4 ? 'irregular' : (tabValue + 1).toString();
    let defaultBlock = 'all';
    if (selectedFolder) {
      defaultBlock = selectedFolder.block || 'all';
      defaultYearLevel = selectedFolder.isIrregular ? 'irregular' : (selectedFolder.year ? String(selectedFolder.year) : defaultYearLevel);
    }

    setNewPayableForm({
      type: '',
      amount: '',
      status: 'unpaid',
      paidAmount: '0',
      yearLevel: defaultYearLevel,
      block: defaultBlock,
      category: 'general',
      moduleId: '',
      moduleCode: '',
      moduleTitle: '',
      moduleCurriculumId: '',
      selectedModuleIds: []
    });
    loadOfferedModules();
    setAddPayableDialogOpen(true);
  }, [loadOfferedModules, selectedFolder, tabValue]);

  const openAddPayable = useCallback(() => {
    handleAddPayable();
  }, [handleAddPayable]);

const handleAddIndividualPayable = () => {
  if (!selectedStudentModal) return;
  loadOfferedModules();
  setIndividualPayableForm({
    type: '',
    amount: '',
    yearLevel: selectedStudentModal.yearLevel.toString(), // Ensure year level is set
    category: 'general',
    moduleId: '',
    moduleCode: '',
    moduleTitle: '',
    moduleCurriculumId: '',
    selectedModuleIds: [] // Initialize as empty array
  });
  setIndividualPayableDialogOpen(true);
};

  const hasDuplicateModulePayable = useCallback((module, targetYear, targetBlock, studentId = '') => {
    if (!module) return false;

    const allPayables = Object.values(payables).flat();
    const targetModuleId = String(module.id || '').trim();
    const targetModuleCode = String(module.courseCode || module.moduleCode || '').trim().toUpperCase();
    const normalizedTargetBlock = String(targetBlock || 'all').trim().toUpperCase() || 'ALL';
    const normalizedTargetYear = targetYear === 'irregular' || targetYear === 'all'
      ? String(targetYear)
      : String(Number(targetYear) || targetYear);

    return allPayables.some((payable) => {
      if (String(payable.category || '').toLowerCase() !== 'module') return false;

      const payableModuleId = String(payable.moduleId || '').trim();
      const payableModuleCode = String(payable.moduleCode || payable.type || '').trim().toUpperCase();
      const sameModule = targetModuleId
        ? payableModuleId === targetModuleId
        : Boolean(targetModuleCode && payableModuleCode && payableModuleCode === targetModuleCode);

      if (!sameModule) return false;

      const payableYear = payable.yearLevel === 'irregular' || payable.yearLevel === 'all'
        ? String(payable.yearLevel)
        : String(Number(payable.yearLevel) || payable.yearLevel);
      const payableBlock = String(payable.block || 'all').trim().toUpperCase() || 'ALL';

      if (normalizedTargetYear === 'all') {
        if (normalizedTargetBlock !== 'ALL' && payableBlock !== normalizedTargetBlock) return false;
      } else if (normalizedTargetYear === 'irregular') {
        if (payableYear !== 'irregular') return false;
        if (normalizedTargetBlock !== 'ALL' && payableBlock !== normalizedTargetBlock) return false;
      } else {
        if (payableYear !== normalizedTargetYear) return false;
        if (normalizedTargetBlock !== 'ALL' && payableBlock !== normalizedTargetBlock) return false;
      }

      if (studentId && payable.studentId && payable.studentId !== studentId) {
        return false;
      }

      return true;
    });
  }, [payables]);

  const handleSaveNewPayable = async () => {
    const isModule = newPayableForm.category === 'module';
    if (!newPayableForm.amount) {
      setError('Please fill in all required fields');
      return;
    }
    if (isModule && newPayableForm.selectedModuleIds.length === 0) {
      setError('Please select at least one module to create module payables.');
      return;
    }
    if (!isModule && !newPayableForm.type) {
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
          yearLevel: targetYear === 'irregular' || targetYear === 'all' ? targetYear : parseInt(targetYear),
          block: newPayableForm.block || 'all'
        });
        if (result.success) {
          setSuccess('Payable updated successfully!');
          await loadPayables();
        } else {
          setError(result.error);
        }
      } else {
        let targetStudents;
        const targetBlock = newPayableForm.block;
        
        if (targetYear === 'irregular') {
          targetStudents = students.filter(s => s.isIrregular);
        } else if (targetYear === 'all') {
          if (targetBlock === 'all') {
            targetStudents = students;
          } else {
            // All year levels but specific block
            targetStudents = students.filter(s => {
              const studentBlock = (s.block || '').toUpperCase() || 'A';
              return studentBlock === targetBlock.toUpperCase() && !s.isIrregular;
            });
          }
        } else {
          // Specific year level
          if (targetBlock === 'all') {
            targetStudents = students.filter(s => s.yearLevel === parseInt(targetYear) && !s.isIrregular);
          } else {
            // Specific year level and specific block
            targetStudents = students.filter(s => {
              const studentBlock = (s.block || '').toUpperCase() || 'A';
              return s.yearLevel === parseInt(targetYear) && !s.isIrregular && studentBlock === targetBlock.toUpperCase();
            });
          }
        }
        const studentPayments = {};
        targetStudents.forEach(student => {
          studentPayments[student.id] = {
            status: 'unpaid',
            paidAmount: 0
          };
        });
        const amount = parseFloat(newPayableForm.amount);
        if (isModule) {
          const selectedModules = offeredModules.filter((module) => newPayableForm.selectedModuleIds.includes(module.id));
          if (selectedModules.length === 0) {
            setError('Please select at least one module to create module payables.');
            setLoading(false);
            return;
          }

          const duplicateModule = selectedModules.find((module) => hasDuplicateModulePayable(module, targetYear, targetBlock));
          if (duplicateModule) {
            setError(`Module ${duplicateModule.courseCode || duplicateModule.courseTitle || duplicateModule.id} already exists for the selected target block.`);
            setLoading(false);
            return;
          }

          const results = await Promise.all(selectedModules.map((module) => {
            const modulePayableData = {
              type: module.courseCode,
              amount,
              yearLevel: targetYear === 'irregular' || targetYear === 'all' ? targetYear : parseInt(targetYear),
              block: targetBlock || 'all',
              studentPayments,
              createdTerm: activeTerm,
              category: 'module',
              moduleId: module.id,
              moduleCode: module.courseCode,
              moduleTitle: module.courseTitle,
              moduleCurriculumId: module.curriculumId
            };
            return createPayable(modulePayableData, currentUser.uid);
          }));
          const failedCount = results.filter((result) => !result.success).length;
          if (failedCount === 0) {
            setSuccess(`Payables added successfully for ${selectedModules.length} module(s) and ${targetStudents.length} students.`);
            await loadPayables();
            setAddPayableDialogOpen(false);
          } else {
            setError(`${failedCount} module payable(s) failed to save. Please try again.`);
          }
        } else {
          const newPayableData = {
            type: newPayableForm.type,
            amount,
            yearLevel: targetYear === 'irregular' || targetYear === 'all' ? targetYear : parseInt(targetYear),
            block: targetBlock || 'all',
            studentPayments: studentPayments,
            createdTerm: activeTerm,
            category: 'general'
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
      }
      setEditingMode(false);
      setNewPayableForm({
        type: '',
        amount: '',
        status: 'unpaid',
        paidAmount: '0',
        yearLevel: 'all',
        category: 'general',
        moduleId: '',
        moduleCode: '',
        moduleTitle: '',
        moduleCurriculumId: '',
        selectedModuleIds: []
      });
      setModuleSelectorOpen(false);
    } catch (error) {
      setError('Failed to save payable: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIndividualPayable = async () => {
    const isModule = individualPayableForm.category === 'module';
    if (!individualPayableForm.amount || !individualPayableForm.yearLevel || (!isModule && !individualPayableForm.type) || (isModule && (!individualPayableForm.selectedModuleIds || individualPayableForm.selectedModuleIds.length === 0))) {
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
      if (individualPayableForm.category === 'module') {
        const amount = parseFloat(individualPayableForm.amount);
        const selected = individualPayableForm.selectedModuleIds || [];
        if (selected.length === 0) {
          setError('Please select at least one module');
          setLoading(false);
          return;
        }

        const duplicateModule = offeredModules.find((module) => selected.includes(module.id) && hasDuplicateModulePayable(module, individualPayableForm.yearLevel, selectedStudentModal?.block || 'all', selectedStudentModal?.id || ''));
        if (duplicateModule) {
          setError(`Module ${duplicateModule.courseCode || duplicateModule.courseTitle || duplicateModule.id} already exists for this student or target block.`);
          setLoading(false);
          return;
        }

        const results = await Promise.all(selected.map((mid) => {
          const module = offeredModules.find(m => m.id === mid);
          const modulePayableData = {
            type: module ? module.courseCode : (individualPayableForm.type || 'Module'),
            amount,
            yearLevel: parseInt(individualPayableForm.yearLevel),
            studentPayments,
            createdTerm: activeTerm,
            isIndividual: true,
            studentId: selectedStudentModal.id,
            studentName: selectedStudentModal.name,
            category: 'module',
            moduleId: module?.id || '',
            moduleCode: module?.courseCode || '',
            moduleTitle: module?.courseTitle || '',
            moduleCurriculumId: module?.curriculumId || ''
          };
          return createPayable(modulePayableData, currentUser.uid);
        }));
        const failedCount = results.filter(r => !r.success).length;
        if (failedCount === 0) {
          setSuccess(`Previous balance(s) added successfully for ${selectedStudentModal.name}!`);
          await loadPayables();
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
        } else {
          setError(`${failedCount} previous balance(s) failed to save. Please try again.`);
        }
      } else {
        const newPayableData = {
          type: individualPayableForm.type,
          amount: parseFloat(individualPayableForm.amount),
          yearLevel: parseInt(individualPayableForm.yearLevel),
          studentPayments: studentPayments,
          createdTerm: activeTerm,
          isIndividual: true,
          studentId: selectedStudentModal.id,
          studentName: selectedStudentModal.name,
          category: individualPayableForm.category
        };
        const result = await createPayable(newPayableData, currentUser.uid);
        if (result.success) {
          setSuccess(`Previous balance added successfully for ${selectedStudentModal.name}!`);
          await loadPayables();
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
        } else {
          setError(result.error);
        }
      }
    } catch (error) {
      setError('Failed to add previous balance: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePayment = async () => {
      const currentTermLabel = formatTermDisplay(activeTerm);
      const previousTermSource = selectedStudentModal?.createdTerm || selectedStudentModal?.enrolledTerm || null;
      const previousTermLabel = previousTermSource && !isSameTerm(previousTermSource, activeTerm)
        ? formatTermDisplay(previousTermSource)
        : 'None';
    if (!selectedStudentModal || !paymentForm.amount || !paymentForm.description) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
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
        yearLevel: payable.yearLevel.toString() === 'irregular' ? 'irregular' : payable.yearLevel.toString(),
        block: payable.block || 'all',
        category: payable.category || 'general',
        moduleId: payable.moduleId || '',
        moduleCode: payable.moduleCode || '',
        moduleTitle: payable.moduleTitle || '',
        moduleCurriculumId: payable.moduleCurriculumId || '',
        selectedModuleIds: payable.moduleId ? [payable.moduleId] : []
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
          mode: stagedPaymentModes?.[payableId] || ['cash'],
          reference: stagedPaymentReferences?.[payableId] || ''
        });
      }
    }

    setSummaryData({ changes, totalCurrentBalance, totalNewBalance });
    setSummaryModalOpen(true);
  };

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

      for (const change of summaryData.changes) {
        const { payableId, newPayment, mode, reference, voucherAmount, voucherDescription } = change;
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
          [`studentPayments.${studentId}.lastPaymentMode`]: normalizeModeForStore(mode) || 'cash',
          [`studentPayments.${studentId}.lastPaymentReference`]: reference || '',
          [`studentPayments.${studentId}.lastPaymentDate`]: paymentDate.toISOString(),
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
          mode: normalizeModeForStore(mode) || 'cash',
          reference: reference || '',
          otherPayables,
          totalOtherBalance,
          receivedBy:  ''
        };

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
            mode: normalizeModeForStore(mode) || 'cash',
            reference: reference || ''
          });

          paymentsToCreate.push({
            studentId,
            payableId,
            amount: newPayment,
            mode: normalizeModeForStore(mode) || 'cash',
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
          mode: receiptModes.length === 1 ? receiptModes[0] : receiptModes,
          reference: receiptReferences.length === 1 ? receiptReferences[0] : receiptReferences.join(', '),
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
      setSummaryModalOpen(false);
      setStudentModalOpen(false);
      setSelectedStudentModal(null);
      setStagedPayments({});
      setStagedPaymentModes({});
      setStagedPaymentReferences({});
      setStagedVouchers({});
      await loadPayables();

      if (lastReceiptPreview) {
        setReceiptData(lastReceiptPreview);
        setReceiptAutoPrint(true);
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

  const getStudentPayables = useCallback((student) => {
    if (!student || !payables) return [];
    const studentBlock = (student.block || 'A').toString().trim().toUpperCase() || 'A';
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
      const payableBlock = (p.block || 'all').toString().trim().toUpperCase() || 'ALL';
      if (payableBlock !== 'ALL' && payableBlock !== studentBlock) {
        return;
      }
      if (!p.isIndividual) {
        merged[p.id] = p;
      } else if (p.studentId === student.id) {
        merged[p.id] = p;
      }
    });
    individualAcrossYears.forEach(p => {
      const payableBlock = (p.block || 'all').toString().trim().toUpperCase() || 'ALL';
      if (payableBlock !== 'ALL' && payableBlock !== studentBlock) {
        return;
      }
      merged[p.id] = p;
    });
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

  const getDefaultExportFilename = useCallback((mode) => {
    const scopeLabel = mode.includes('all-blocks') ? 'all-blocks' : 'current-folder';
    const baseName = scopeLabel === 'all-blocks'
      ? 'ccs-payables-all-blocks'
      : (selectedFolder?.label || 'ccs-payables-current-folder');
    return sanitizeExportText(`${baseName}-${scopeLabel}`);
  }, [selectedFolder]);

  const handleExportAction = useCallback((mode) => {
    setPendingExportMode(mode);
    setExportFilename(getDefaultExportFilename(mode));
    setExportMenuOpen(false);
    setExportFilenameModalOpen(true);
  }, [getDefaultExportFilename, selectedFolder]);

  const openExportPayables = useCallback(() => {
    handleExportAction('xlsx-all-blocks');
  }, [handleExportAction]);

  const toolbarActions = useMemo(() => ({
    openModuleManagement,
    openAddPayable,
    openExportPayables,
    canExport: true
  }), [openAddPayable, openExportPayables, openModuleManagement]);

  useEffect(() => {
    registerToolbarActions?.('ccs', toolbarActions);
    return () => registerToolbarActions?.('ccs', null);
  }, [registerToolbarActions, toolbarActions]);

  const handleExportConfirm = useCallback(() => {
    const scope = pendingExportMode.includes('all-blocks') ? 'all-blocks' : 'current-folder';
    const format = pendingExportMode.startsWith('csv') ? 'csv' : 'xlsx';

    exportCcsPayablesSpreadsheet({
      students,
      payablesByYear: payables,
      selectedFolder,
      activeTerm,
      scope,
      format,
      filename: sanitizeExportText(exportFilename)
    });

    setExportFilenameModalOpen(false);
  }, [activeTerm, exportFilename, pendingExportMode, payables, selectedFolder, students]);

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

    const nextReceiptData = {
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
      mode: modes.length === 1 ? modes[0] : modes,
      reference: references.length === 1 ? references[0] : references.join(', '),
      otherPayables,
      totalOtherBalance,
      receivedBy:  ''
    };

    await printReceiptDirect(nextReceiptData);
  }, [getStudentPayables, payables]);

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

  const renderStudentList = () => (
    <div>
      <div className="mb-4">
        {selectedFolder && (
       <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border text-sm border-slate-200 bg-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
            />
          </div>
        </div>
        )}
      </div>
      <div>
        {(() => {
          const getYearLabel = (year) => {
            if (year === 1) return '1st';
            if (year === 2) return '2nd';
            if (year === 3) return '3rd';
            if (year === 4) return '4th';
            return `${year}th`;
          };

          const getTermLabel = (term) => {
            if (!term) return 'Unspecified Term';
            if (term.semester && term.schoolYear) {
              return `Semester ${term.semester} · S.Y. ${term.schoolYear}`;
            }
            if (term.semester) return `Semester ${term.semester}`;
            if (term.schoolYear) return `S.Y. ${term.schoolYear}`;
            return 'Unspecified Term';
          };

          const getStudentTerm = (student) => {
            const term = student?.enrolledTerm || student?.createdTerm || null;
            if (term && (term.semester || term.schoolYear)) {
              return {
                semester: Number(term.semester) || activeTerm.semester || null,
                schoolYear: term.schoolYear || activeTerm.schoolYear || '',
              };
            }
            return {
              semester: activeTerm.semester || null,
              schoolYear: activeTerm.schoolYear || ''
            };
          };

          const getTermKey = (term) => `${term.semester || 'na'}|${term.schoolYear || ''}`;

          const buildFolderGroups = (studentsInTerm) => {
            const activeStudents = studentsInTerm.filter((student) => student?.active !== false);
            const inactiveStudents = studentsInTerm.filter((student) => student?.active === false);

            const foldersMap = activeStudents.reduce((map, student) => {
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
                  isInactiveFolder: false,
                  label: isIrregular ? 'Irregular Students' : `${getYearLabel(year)} Year Block ${block}`,
                  students: []
                });
              }
              map.get(key).students.push(student);
              return map;
            }, new Map());

            if (inactiveStudents.length > 0) {
              foldersMap.set('__inactive__', {
                key: '__inactive__',
                year: null,
                block: null,
                isIrregular: false,
                isInactiveFolder: true,
                label: 'Inactive Students',
                students: inactiveStudents
              });
            }

            return Array.from(foldersMap.values()).sort((a, b) => {
              if (a.isInactiveFolder && !b.isInactiveFolder) return 1;
              if (!a.isInactiveFolder && b.isInactiveFolder) return -1;
              if (a.isIrregular && !b.isIrregular) return 1;
              if (!a.isIrregular && b.isIrregular) return -1;
              if (!a.isIrregular && !b.isIrregular && a.year !== b.year) return a.year - b.year;
              return (a.block || '').localeCompare(b.block || '');
            });
          };

          const termGroups = Array.from(students.reduce((map, student) => {
            const term = getStudentTerm(student);
            const key = getTermKey(term);
            if (!map.has(key)) {
              map.set(key, { key, term, label: getTermLabel(term), students: [] });
            }
            map.get(key).students.push(student);
            return map;
          }, new Map()).values()).sort((a, b) => {
            if (a.key === getTermKey(activeTerm)) return -1;
            if (b.key === getTermKey(activeTerm)) return 1;
            return a.label.localeCompare(b.label);
          });

          const selectedTermKey = selectedFolder?.termKey || '';
          const selectedTermGroup = selectedTermKey ? termGroups.find((group) => group.key === selectedTermKey) : null;
          const visibleTermGroups = selectedFolder && selectedTermGroup ? [selectedTermGroup] : termGroups;

          if (!selectedFolder) {
            if (visibleTermGroups.length === 0) {
              return (
                <div className="text-center py-8">
                  <h6 className="text-lg text-gray-600 mb-2">{searchTerm ? 'No folders found' : 'No student folders yet'}</h6>
                  <p className="text-sm text-gray-600">
                    {searchTerm ? 'Try adjusting your search terms' : 'Students will appear here grouped by term, year level, block, and inactive status.'}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {visibleTermGroups.map((group) => {
                  const folders = buildFolderGroups(group.students);
                  return (
                    <section key={group.key} className="space-y-3">
                     
                      {folders.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-slate-500">
                          No students found for this term.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                          {folders.map((folder) => (
                            <button
                              key={`${group.key}-${folder.key}`}
                              type="button"
                              onClick={() => {
                                setSelectedFolder({ ...folder, termKey: group.key, termLabel: group.label });
                                setTabValue(folder.isIrregular ? 4 : Math.max(0, folder.year - 1));
                                window.dispatchEvent(new CustomEvent('payables-breadcrumb', { detail: { departmentType: 'ccs', selectedFolder: { ...folder, termKey: group.key, termLabel: group.label } } }));
                              }}
                              className={`rounded-lg cursor-pointer border bg-white p-4 text-left transition hover:shadow-lg ${folder.isInactiveFolder ? 'border-rose-200 hover:border-rose-400' : 'border-slate-200 hover:border-blue-300'}`}
                            >
                              <div className="flex items-start gap-4">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${folder.isInactiveFolder ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                                  <Folder className="h-5 w-5" />
                                </div>
                                <div>
                                  <div className={`text-sm font-medium ${folder.isInactiveFolder ? 'text-rose-700' : 'text-gray-800'}`}>{folder.label}</div>
                                  <div className={`text-xs ${folder.isInactiveFolder ? 'text-rose-500' : 'text-gray-500'}`}>
                                    {folder.students.length} student{folder.students.length === 1 ? '' : 's'}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            );
          }

          let filteredStudents = selectedTermGroup ? selectedTermGroup.students.slice() : students.slice();
          if (searchTerm) {
            filteredStudents = filteredStudents.filter(student =>
              (student.name || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
          }

          filteredStudents = filteredStudents.filter((student) => {
            const block = (student.block || 'A').toString().trim().toUpperCase() || 'A';
            if (selectedFolder.isInactiveFolder) {
              return student.active === false;
            }
            if (selectedFolder.isIrregular) {
              return student.isIrregular && block === selectedFolder.block;
            }
            return student.active !== false && !student.isIrregular && Number(student.yearLevel) === Number(selectedFolder.year) && block === selectedFolder.block;
          });

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
                  {searchTerm ? 'No students found' : `No students in ${selectedFolder.label}`}
                </h6>
                <p className="text-sm text-gray-600">
                  {searchTerm ? 'Try adjusting your search terms' : 'No students available for payment management'}
                </p>
              </div>
            );
          }

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
            return (
              <div className="bg-white border border-gray-300 rounded-xl shadow-lg overflow-hidden">
                <table className="w-full table-auto">
                  <thead className="bg-blue-500 text-xs uppercase text-white text-sm">
                    <tr>
                      <th 
                        className="p-4 text-left cursor-pointer  transition-colors select-none w-[5%]"
                        >
                          No.
                        </th>
                      <th
                        className="p-4 text-left cursor-pointer  transition-colors select-none w-[20%]"
                        onClick={() => setSortBy(sortBy === 'id-asc' ? 'id-desc' : 'id-asc')}
                      >
                        <div className="flex items-center gap-2">
                          <span>Student No.</span>
                          {sortBy === 'id-asc' ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : sortBy === 'id-desc' ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronsUpDown className="w-4 h-4 opacity-70" />
                          )}
                        </div>
                      </th>
                      <th
                        className="p-4 text-left cursor-pointer  transition-colors select-none w-[35%]"
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
                      <th
                        className="p-4 text-left cursor-pointer  transition-colors select-none w-[20%]"
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
                      <th className="p-4 text-center w-[20%]">Status</th>
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
                          <td className="p-4 text-center">{index + 1}.</td>
                          <td className="p-4">{student.studentNumber}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              {student.name}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`font-bold ${totalBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                              ₱{totalBalance.toLocaleString()}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${totalBalance > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                              {totalBalance > 0 ? 'Outstanding' : 'Paid'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-blue-50 font-semibold text-blue-900 border-t border-blue-200">
                      <td colSpan={3} className="py-1.5 x-3 text-right w-[60%]">Total Outstanding Balance</td>
                      <td className="px-2 py-3 text-left font-bold">
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

  return (
    <div className="">

     

      {!currentUser && (
        <div className="mx-3 mb-2 p-4 bg-blue-50 border border-blue-200 rounded text-blue-800">
          Please sign in to access the Payables System
        </div>
      )}

      {error && <div className="mx-3 mb-2 p-4 bg-red-50 border border-red-200 rounded text-red-800">{error}</div>}
      {success && <div className="mx-3 mb-2 p-4 bg-green-50 border border-green-200 rounded text-green-800">{success}</div>}

      {currentUser ? (
        <div className="max-w-7xl mx-auto">
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
        <div className="fixed inset-0 z-1000 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => {
            setAddPayableDialogOpen(false);
            setEditingMode(false);
            setNewPayableForm({
              type: '',
              amount: '',
              status: 'unpaid',
              paidAmount: '0',
              yearLevel: 'all',
              block: 'all',
              category: 'general',
              moduleId: '',
              moduleCode: '',
              moduleTitle: '',
              moduleCurriculumId: '',
              selectedModuleIds: []
            });
          }}></div>
          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
              {editingMode ? 'Edit Payable' : 'Add New Payable'}
            </h2>
          <p className="mt-1 text-sm text-slate-500">
            {editingMode
              ? 'Update the payable details and review the information before saving changes'
              : 'Enter the payable details and complete the required information to create a new entry'}
          </p>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">

              <div className='flex items-start gap-4'>
                <div className='flex-1'>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Target Year Level</label>
                <select
                  className="w-full border text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow disabled:cursor-not-allowed disabled:bg-slate-100"
                  value={newPayableForm.yearLevel}
                  onChange={(e) => {
                    handleNewPayableInputChange('yearLevel', e.target.value);
                    if (e.target.value === 'irregular') {
                      handleNewPayableInputChange('block', 'all');
                    }
                  }}
                  disabled={editingMode}
                >
                  <option value="all">All Students</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                  <option value="irregular">Irregular Students</option>
                </select>
              </div>

              {/* Block selector - only show for non-irregular year levels */}
              {newPayableForm.yearLevel !== 'irregular' && (
                <div className='flex-1'>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Target Block</label>
                  <select
                    className="w-full border text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow disabled:cursor-not-allowed disabled:bg-slate-100"
                    value={newPayableForm.block}
                    onChange={(e) => handleNewPayableInputChange('block', e.target.value)}
                    disabled={editingMode}
                  >
                    <option value="all">All Blocks</option>
                    {(() => {
                      // Determine block options from current students
                      const isIrregular = newPayableForm.yearLevel === 'irregular';
                      let blocks = [];
                      if (!isIrregular) {
                        if (newPayableForm.yearLevel === 'all') {
                          blocks = getAvailableBlocks();
                        } else {
                          const y = Number(newPayableForm.yearLevel);
                          blocks = getBlocksForYear(y);
                        }
                      }
                      return blocks.map((b) => (
                        <option key={b} value={b}>{`Block ${b}`}</option>
                      ));
                    })()}
                  </select>
                
                </div>
              )}
              </div>

              <div className='flex items-center gap-4'>
                <label className="block font-semibold text-sm text-slate-700">Payable Category:</label>
                <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-1">
                  <label className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${newPayableForm.category === 'general' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                    <input
                      type="radio"
                      name="newPayableCategory"
                      value="general"
                      checked={newPayableForm.category === 'general'}
                      disabled={editingMode}
                      onChange={(e) => {
                        handleNewPayableInputChange('category', e.target.value);
                        setModuleSelectorOpen(false);
                      }}
                      className="h-3 w-3 text-blue-600"
                    />
                    <span>General</span>
                  </label>
                  <label className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${newPayableForm.category === 'module' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                    <input
                      type="radio"
                      name="newPayableCategory"
                      value="module"
                      checked={newPayableForm.category === 'module'}
                      disabled={editingMode}
                      onChange={(e) => {
                        handleNewPayableInputChange('category', e.target.value);
                        setModuleSelectorContext('new');
                        setModuleSelectorOpen(true);
                      }}
                      className="h-3 w-3 text-blue-600"
                    />
                    <span className="font-medium text-gray-700">Module</span>
                  </label>
                </div>
              </div>

              {newPayableForm.category === 'module' ? (
                <>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Amount per module</label>
                </>
              ) : (
                <>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Payable Type</label>
                  <input
                    type="text"
                    className="w-full border text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                    placeholder="Type (e.g., Tuition Fee, Miscellaneous)"
                    value={newPayableForm.type}
                    onChange={(e) => handleNewPayableInputChange('type', e.target.value)}
                  />
                  <label className="block text-sm font-semibold text-slate-700 mb-1 mt-4">Amount</label>
                </>
              )}
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="w-full border text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                placeholder="e.g., 1500.00"
                value={newPayableForm.amount}
                onChange={(e) => handleNewPayableInputChange('amount', e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
              />
              {newPayableForm.category === 'module' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>Amount per module</span>
                    <span className="font-semibold">{formatPeso(newPayableForm.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 mt-2 font-semibold">
                    <span>Total</span>
                    <span>{formatPeso((Number(newPayableForm.amount) || 0) * selectedModules.length)}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
              <button
                onClick={() => {
                  setAddPayableDialogOpen(false);
                  setEditingMode(false);
                  setNewPayableForm({
                    type: '',
                    amount: '',
                    status: 'unpaid',
                    paidAmount: '0',
                    yearLevel: 'all',
                    block: 'all',
                    category: 'general',
                    moduleId: '',
                    moduleCode: '',
                    moduleTitle: '',
                    moduleCurriculumId: '',
                    selectedModuleIds: []
                  });
                  setModuleSelectorOpen(false);
                }}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewPayable}
                className="px-4 py-1.5 w-24 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                disabled={
                  !newPayableForm.amount ||
                  loading ||
                  (newPayableForm.category === 'module'
                    ? newPayableForm.selectedModuleIds.length === 0
                    : !newPayableForm.type)
                }
              >
                {loading ? (editingMode ? 'Updating...' : 'Adding...') : (editingMode ? 'Update' : 'Add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Module Selector Modal */}
     {moduleSelectorOpen && (
  <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/30 px-4 py-6">
    <div
      className="absolute inset-0"
      onClick={() => setModuleSelectorOpen(false)}
    ></div>

    <div className="relative z-10 w-full max-w-3xl rounded-3xl border h-[70vh] border-slate-200 bg-white shadow-2xl">
      
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

      <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
      <div className='flex items-center justify-between gap-2 mb-4'>
          {/* Year Level Filters */}
  <div className="flex gap-2 w-fit items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
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
                 className={`rounded-lg px-4 py-1 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer'
              }`}
              >
                {y}{getOrdinalSuffix(parseInt(y))} Year
              </button>
            );
          })}
        </div>

        {/* Curriculum and Semester Filters */}
        <div className="flex items-center gap-2">
          <select
            value={moduleSelectorContext === 'new' ? moduleCurriculumFilter : 'all'}
            onChange={(e) => {
              if (moduleSelectorContext === 'new') {
                setModuleCurriculumFilter(e.target.value);
              }
              // For individual context, you might want to handle curriculum filtering differently
            }}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
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
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            <option value="all">All Semesters</option>
            <option value="1">1st Semester</option>
            <option value="2">2nd Semester</option>
            <option value="3">Summer</option>
          </select>
        </div>
      </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-slate-600">
                <tr>
                  <th className="w-[70px] px-4 py-3 font-semibold">
                    Select
                  </th>

                  <th
                    className="px-4 py-3 font-semibold cursor-pointer"
                    onClick={() => handleModuleSort('courseCode')}
                  >
                    <div className="flex items-center gap-1">
                      Code
                      {moduleSortConfig.key === 'courseCode' ? (
                        moduleSortConfig.direction === 'ascending' ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>

                  <th
                    className="px-4 py-3 font-semibold cursor-pointer"
                    onClick={() => handleModuleSort('courseTitle')}
                  >
                    <div className="flex items-center gap-1">
                      Title
                      {moduleSortConfig.key === 'courseTitle' ? (
                        moduleSortConfig.direction === 'ascending' ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>

                  <th
                    className="px-4 py-3 font-semibold cursor-pointer"
                    onClick={() => handleModuleSort('yearLevel')}
                  >
                    <div className="flex items-center gap-1">
                      Year Level
                      {moduleSortConfig.key === 'yearLevel' ? (
                        moduleSortConfig.direction === 'ascending' ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredAndSortedModules.map((module, index) => {
                  const newChecked = (newPayableForm.selectedModuleIds || []).includes(module.id);
                  const indChecked = (individualPayableForm.selectedModuleIds || []).includes(module.id);

                  const checked =
                    moduleSelectorContext === 'new'
                      ? newChecked
                      : indChecked;

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
    if (moduleSelectorContext === 'new') {
      setNewPayableForm((prev) => {
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
      // Updated logic for individual payables
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
                        {module.yearLevel
                          ? `${module.yearLevel}${getOrdinalSuffix(module.yearLevel)} Year`
                          : 'N/A'}
                      </td>
                    </tr>
                  );
                })}

                {filteredAndSortedModules.length === 0 && (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
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
      <ModuleManagement
        open={moduleManagementOpen}
        onClose={() => setModuleManagementOpen(false)}
        onChanged={loadOfferedModules}
      />

      {/* Payment Creation Dialog */}
      {paymentDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setPaymentDialogOpen(false)}></div>
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto relative z-10">
                        {selectedStudentModal && (
                          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                              <span className="font-medium text-slate-600">Current Term</span>
                              <span className="text-right font-semibold text-slate-900">{currentTermLabel}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 pt-2">
                              <span className="font-medium text-slate-600">Previous Term</span>
                              <span className="text-right font-semibold text-slate-900">{previousTermLabel}</span>
                            </div>
                          </div>
                        )}
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

      {/* Student Details Modal */}
      {studentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px]" onClick={() => {
            setStudentModalOpen(false);
            setSelectedStudentModal(null);
            setStagedPayments({});
          }}></div>
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_-20px_rgba(15,23,42,0.35)]">
            <div className="bg-slate-100 border-b border-slate-200 px-8 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-blue-700">Payment Center</p>
                  <h2 className=" text-lg font-semibold">
                    {selectedStudentModal?.name}
                  
                  </h2>
                  <p className="mt-1 text-sm text-blue-700">
                    {selectedStudentModal?.isIrregular
                      ? `Irregular Student (${selectedStudentModal.yearLevel === 1 ? '1st' : selectedStudentModal.yearLevel === 2 ? '2nd' : selectedStudentModal.yearLevel === 3 ? '3rd' : '4th'} Year Level)`
                      : `${tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year`}
                  </p>
                </div>
              
              </div>
            </div>
            <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
              <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
                <div className="w-72 flex items-center gap-2">
                  <div className="relative w-full ">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
className="w-full border text-sm border-slate-200 bg-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                      placeholder="Search payables by type..."
                      value={payablesSearch}
                      onChange={(e) => setPayablesSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
className="w-fit border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                    value={payablesFilter}
                    onChange={(e) => setPayablesFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="partially_paid">Partially Paid</option>
                    <option value="fully_paid">Fully Paid</option>
                    <option value="individual">Individual Only</option>
                  </select>

                    <button
                  className="px-4 py-2 rounded-lg text-sm bg-blue-500 cursor-pointer text-white hover:bg-blue-600 transition"
                  onClick={handleAddIndividualPayable}
                >
                  Add Individual Charge
                </button>
                </div>
              </div>

              {(() => {
                const base = selectedStudentModal ? getStudentPayables(selectedStudentModal) : [];
                let list = base.filter(p => (p.type || '').toLowerCase().includes((payablesSearch || '').toLowerCase()))
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
                  const stagedPayment = Number(stagedPayments?.[payable.id] || 0);
                  const currentPaid = Number(studentPayment.paidAmount || 0);
                  const originalAmount = Number(payable.amount || 0);
                  const currentVoucherAmount = Number(voucher.amount || 0);
                  const effectivePayableAmount = Math.max(0, originalAmount - currentVoucherAmount);
                  const totalPaid = currentPaid + stagedPayment;
                  const remaining = Math.max(0, effectivePayableAmount - totalPaid);
                  const isFullyPaid = remaining <= 0 || studentPayment.status === 'fully_paid';
                  const maxPayment = Math.max(0, effectivePayableAmount - currentPaid - stagedPayment);
                  const maxVoucher = Math.max(0, originalAmount - currentPaid - stagedPayment);
                  const selectedMode = String(stagedPaymentModes?.[payable.id] || 'cash').toLowerCase();
                  const requiresReference = selectedMode === 'gcash' || selectedMode.includes('bank');
                  const payableTerm = payable.createdTerm || (payable.semester || payable.schoolYear ? {
                    semester: payable.semester,
                    schoolYear: payable.schoolYear
                  } : null);
                  const payableTermLabel = payableTerm ? formatTermDisplay(payableTerm) : 'Not set';
                  const payableTermTag = payableTerm
                    ? (isSameTerm(payableTerm, activeTerm) ? 'Current Term' : 'Previous Term')
                    : 'Previous Term';

                  return (
                    <div
                      key={payable.id}
                      className={`rounded-lg border p-4 shadow-sm transition ${
                        isFullyPaid
                          ? 'border-emerald-200 bg-emerald-50/40'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="min-w-0 text-base font-semibold text-slate-900">{payable.type}</h4>
                            {payable.isIndividual && (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                                Individual Charge
                              </span>
                            )}
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              isFullyPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : studentPayment.status === 'partially_paid'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                            }`}>
                              {isFullyPaid ? 'Fully Paid' : studentPayment.status === 'partially_paid' ? 'Partially Paid' : 'Unpaid'}
                            </span>
                          </div>
                          
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            <span className="font-medium text-slate-700">Term:</span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-800">
                              {payableTermTag}
                            </span>
                            <span className="text-slate-500">{payableTermLabel}</span>
                          </div>

                     
                        </div>
                        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                          <button
                            className="rounded-md p-1.5 text-slate-600 transition hover:bg-slate-100"
                            title="Edit payable"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenuId(null);
                              handleStartEditPayables(payable.id);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            className="rounded-md p-1.5 text-slate-600 transition hover:bg-slate-100"
                            title="View transactions"
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
                            className="rounded-md p-1.5 text-slate-600 transition hover:bg-slate-100"
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
                              const totalPaidSoFar = (result.data || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                              const balanceAfter = Math.max(0, totalPrice - totalPaidSoFar);
                              const previousPaid = Math.max(0, totalPaidSoFar - (Number(latest.amount) || 0));
                              openReceiptForPayment(selectedStudentModal, payable, {
                                ...latest,
                                price: totalPrice,
                                previousPaid,
                                totalPaid: totalPaidSoFar,
                                balanceAfter
                              });
                            }}
                            title="Print latest receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            className="rounded-md p-1.5 text-rose-600 transition hover:bg-rose-50"
                            title="Delete payable"
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

                      <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-slate-500">Total</p>
                          <p className="mt-1 font-semibold text-slate-900">₱{originalAmount.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-slate-500">Paid</p>
                          <p className="mt-1 font-semibold text-emerald-700">₱{Math.max(0, currentPaid).toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-slate-500">Remaining</p>
                          <p className="mt-1 font-semibold text-rose-700">₱{remaining.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-medium text-slate-700">Mode of Payment</span>
                            <label className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition ${
                              selectedMode === 'cash' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700'
                            }`}>
                              <input
                                id={`paymentMode-cash-${payable.id}`}
                                name={`paymentMode-${payable.id}`}
                                type="radio"
                                value="cash"
                                checked={selectedMode === 'cash'}
                                onChange={() => setStagedPaymentModes(prev => ({ ...prev, [payable.id]: 'cash' }))}
                                disabled={isFullyPaid}
                              />
                              Cash
                            </label>
                            <label className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition ${
                              selectedMode === 'gcash' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700'
                            }`}>
                              <input
                                id={`paymentMode-gcash-${payable.id}`}
                                name={`paymentMode-${payable.id}`}
                                type="radio"
                                value="gcash"
                                checked={selectedMode === 'gcash'}
                                onChange={() => setStagedPaymentModes(prev => ({ ...prev, [payable.id]: 'gcash' }))}
                                disabled={isFullyPaid}
                              />
                              GCash
                            </label>
                            <label className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition ${
                              selectedMode === 'bank' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700'
                            }`}>
                              <input
                                id={`paymentMode-bank-${payable.id}`}
                                name={`paymentMode-${payable.id}`}
                                type="radio"
                                value="bank"
                                checked={selectedMode === 'bank'}
                                onChange={() => setStagedPaymentModes(prev => ({ ...prev, [payable.id]: 'bank' }))}
                                disabled={isFullyPaid}
                              />
                              Bank Transfer
                            </label>
                          </div>
                          {isFullyPaid && (
                            <span className="text-[11px] font-semibold text-emerald-700">No additional payment is required for this item.</span>
                          )}
                        </div>

                        <div className="mt-3 border-t border-slate-200 pt-3">
                          <div className="grid gap-2 md:grid-cols-[1.1fr_1fr]">
                          <div className="space-y-2">
                            <label className="block text-xs font-semibold text-slate-700">Payment Amount</label>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              max={maxPayment.toString()}
                              className={`w-full rounded-lg border px-3 py-2 text-sm transition-shadow focus:outline-none ${
                                isFullyPaid
                                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                                  : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-300'
                              }`}
                              placeholder="Enter payment"
                              value={stagedPayments?.[payable.id] ?? ''}
                              onChange={(e) => selectedStudentModal && handleStagedPaidAmountChange(payable.id, e.target.value)}
                              onWheel={(e) => e.currentTarget.blur()}
                              onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                              disabled={isFullyPaid}
                            />
                         
                          </div>
                          <div className="space-y-2">
                              <label className="block text-xs font-semibold text-slate-700">Reference</label>
                            <input
                              type="text"
                              className={`w-full rounded-lg border px-3 py-2 text-sm transition-shadow focus:outline-none ${
                                !requiresReference
                                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                                  : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-300'
                              }`}
                              placeholder="Receipt or reference number"
                              value={stagedPaymentReferences?.[payable.id] || ''}
                              onChange={(e) => setStagedPaymentReferences(prev => ({ ...prev, [payable.id]: e.target.value }))}
                              disabled={!requiresReference || isFullyPaid}
                            />
                          </div>
                        </div>

                        <div className="mt-3 border-t border-slate-200 pt-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs font-semibold text-slate-700">Voucher</p>
                              <p className="text-[11px] text-slate-500">Apply or update a voucher without exceeding the remaining balance.</p>
                            </div>
                            <label className={`inline-flex w-fit items-center gap-2 rounded-lg border px-3 py-1.5 text-xs capitalize  transition ${
                              voucherEnabled ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700'
                            }`}>
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
                                disabled={isFullyPaid}
                              />
                              Apply voucher
                            </label>
                          </div>
                          <div className="mt-3 grid gap-2 md:grid-cols-[0.8fr_1.2fr]">
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Voucher Amount</label>
                              <input
                                type="number"
                                placeholder="Amount"
                                className={`w-full rounded-lg border px-3 py-2 text-sm transition-shadow focus:outline-none ${
                                  !voucherEnabled || isFullyPaid
                                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                                    : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-300'
                                }`}
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
                                max={maxVoucher.toString()}
                                disabled={!voucherEnabled || isFullyPaid}
                              />
                            
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold text-slate-700">Voucher Description</label>
                              <input
                                type="text"
                                placeholder="e.g. Scholarship, Promo"
                                className={`w-full rounded-lg border px-3 py-2 text-sm transition-shadow focus:outline-none ${
                                  !voucherEnabled || isFullyPaid
                                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                                    : voucherEnabled && Number(voucherAmountInput || 0) > 0 && !(voucherDescriptionInput || '').trim()
                                      ? 'border-rose-300 bg-white focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
                                      : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-300'
                                }`}
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
                                disabled={!voucherEnabled || isFullyPaid}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
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
            <div className='sticky bottom-0 z-20 flex justify-between gap-4 px-6 py-3 border-t border-gray-300'>
              <h3 className={`font-semibold text-gray-800`}>
                Total Balance: ₱{selectedStudentModal ? calculateTotalBalance(selectedStudentModal.id).toLocaleString() : '0'}
              </h3>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setStudentModalOpen(false);
                    setSelectedStudentModal(null);
                    setStagedPayments({});
                    setStagedVouchers({});
                  }}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-600 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleShowSummary}
                className="px-4 py-1.5 w-24 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
                  disabled={(Object.keys(stagedPayments).length === 0 && Object.keys(stagedVouchers).length === 0) || confirmLoading}
                >
                  {confirmLoading ? 'Confirming...' : 'Confirm '}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {summaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] bg-opacity-50" onClick={() => setSummaryModalOpen(false)} />
          <div className="relative z-10 w-full max-w-lg max-h-[60vh] flex flex-col bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-white">
              <h2 className="text-xl font-bold">Confirm Payment Changes</h2>
              {selectedStudentModal && (
                <p className="text-sm text-gray-600">
                  For: {selectedStudentModal.name}
                </p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {summaryData.changes.length === 0 ? (
                <p className="text-gray-600">No changes to confirm.</p>
              ) : (
                summaryData.changes.map((change) => {
                  const totalAmount = Number(change.amount || 0);
                  const originalAmount = Number(change.originalAmount || change.amount || 0);
                  const voucherAmount = Number(change.voucherAmount || 0);
                  const prevPaid = Number(change.currentPaid || 0);
                  const newPaid = Number(change.newTotalPaid || 0);
                  const newPayment = Number(change.newPayment || 0);
                  const prevBalance = totalAmount - prevPaid;
                  const newBalance = totalAmount - newPaid;

                  return (
                    <div key={change.payableId} className="border border-gray-200 rounded-lg p-4 shadow bg-white">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-lg font-semibold">{change.type}</h4>
                        <div className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${
                          newPayment > 0 ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-100 text-gray-500 border-gray-200"
                        }`}>
                          {newPayment > 0 ? "Paid" : "No Payment"}
                        </div>
                      </div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4 text-xs">
                          {(() => {
                            const changeModes = normalizeModesValue(change.mode);
                            return (
                              <>
                                <label className="inline-flex items-center gap-2">
                                  <input type="checkbox" disabled checked={changeModes.includes('cash')} />
                                  CASH
                                </label>
                                <label className="inline-flex items-center gap-2">
                                  <input type="checkbox" disabled checked={changeModes.includes('gcash')} />
                                  GCASH
                                </label>
                                <label className="inline-flex items-center gap-2">
                                  <input type="checkbox" disabled checked={changeModes.some(m => m.includes('bank'))} />
                                  BANK TRANSFER
                                </label>
                              </>
                            );
                          })()}
                        </div>
                        <div className="text-xs text-right">
                          <div>
                            Price: <b>₱{originalAmount.toLocaleString()}</b>
                          </div>
                          {voucherAmount > 0 && (
                            <div className="text-emerald-700">
                              Voucher: -₱{voucherAmount.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="border-t border-gray-200 my-2" />
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <p className="text-gray-500">Previous</p>
                          <p className={prevBalance > 0 ? "text-red-700 font-semibold" : "text-green-700 font-semibold"}>
                            ₱{prevBalance.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500">Payment</p>
                          <p className="text-blue-700 font-semibold">
                            ₱{newPayment.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-500">Balance</p>
                          <p className={newBalance > 0 ? "text-red-700 font-semibold" : "text-green-700 font-semibold"}>
                            ₱{newBalance.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex gap-2 justify-end p-4 border-t border-gray-200 bg-white">
              <button
                onClick={() => setSummaryModalOpen(false)}
                className="px-4 py-1.5 rounded-lg cursor-pointer text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalConfirm}
                disabled={confirmLoading}
                className="px-4 py-1.5 rounded-lg cursor-pointer text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {confirmLoading ? "Confirming..." : "Confirm Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Student Payable Dialog */}
     {individualPayableDialogOpen && (
  <div className="fixed inset-0 z-1000 flex items-center justify-center p-4">
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-[2px]"
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
      }}
    ></div>
    <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      
      <div className='border-b border-slate-200 bg-slate-50 px-6 py-4'>
          <h2 className="text-lg font-semibold text-slate-900">
        Add Individual Charge
      </h2>
      {selectedStudentModal && (
        <p className="mt-1 text-sm text-slate-500">
          For: <span className="font-medium">{selectedStudentModal.name}</span>
        </p>
      )}
      </div>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
        {/* Category Selection */}
        <div className="flex items-center gap-4">
          <label className="block text-sm font-semibold text-slate-700">Category:</label>
          <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-1">
            <label className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${individualPayableForm.category === 'general' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              <input
                type="radio"
                name="individualPayableCategory"
                value="general"
                checked={individualPayableForm.category === 'general'}
                onChange={(e) => handleIndividualPayableInputChange('category', e.target.value)}
                className="h-4 w-4 text-blue-600"
              />
              <span>General</span>
            </label>
            <label className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${individualPayableForm.category === 'module' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              <input
                type="radio"
                name="individualPayableCategory"
                value="module"
                checked={individualPayableForm.category === 'module'}
                onChange={(e) => handleIndividualPayableInputChange('category', e.target.value)}
                className="h-4 w-4 text-blue-600"
              />
              <span className="font-medium text-gray-700">Module</span>
            </label>
          </div>
        </div>

        {/* Module Selection */}
        {individualPayableForm.category === 'module' ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
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
                  {individualSelectedModules.map((module, index) => (
                    <div
                      key={module.id ?? module.courseCode ?? `individual-module-${index}`}
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
          </>
        ) : (
          <>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Charge Type</label>
            <input
              type="text"
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
              placeholder="Payable Type (e.g., 2nd Year Balance, Laboratory Fee, etc.)"
              value={individualPayableForm.type}
              onChange={(e) => handleIndividualPayableInputChange('type', e.target.value)}
            />
          </>
        )}

        {/* Amount Input */}
        <label className="block text-sm font-semibold text-slate-700 mb-1">Amount</label>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
          placeholder="e.g., 1500.00"
          value={individualPayableForm.amount}
          onChange={(e) => handleIndividualPayableInputChange('amount', e.target.value)}
          onWheel={(e) => e.currentTarget.blur()}
          onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
        />

        {/* Year Level Selection */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Year Level (when the charge was incurred)</label>
          <select
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
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
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs text-blue-800">
            This will add a payable specifically for {selectedStudentModal?.name}.
            Other students will not see this charge.
          </p>
        </div>

        {/* Action Buttons */}
      <div className="flex justify-end gap-2 border-t border-slate-200 bg-white pt-4 mt-8">
        <button
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
          }}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-600 bg-white hover:bg-gray-50 cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveIndividualPayable}
                className="px-4 py-1.5 w-24 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
          disabled={
            (!individualPayableForm.amount || !individualPayableForm.yearLevel || loading) ||
            (individualPayableForm.category === 'module'
              ? !(individualPayableForm.selectedModuleIds && individualPayableForm.selectedModuleIds.length > 0)
              : !individualPayableForm.type)
          }
        >
          {loading ? 'Adding...' : 'Add '}
        </button>
      </div>

      </div>

      
    </div>
  </div>
)}

      {/* Export Filename Modal */}
      {exportFilenameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] bg-opacity-50"
            onClick={() => setExportFilenameModalOpen(false)}
          ></div>
          <div className="bg-white rounded-2xl shadow-lg  max-w-md w-full relative z-10">
            <div className='px-8 py-4 border-b border-slate-200 bg-slate-100 rounded-t-2xl'>
              <h2 className="text-lg font-medium">Export File Name</h2>
            </div>
            <div className="px-8 py-4">
                <p className="text-sm text-gray-600 mb-4">Enter the file name before exporting.</p>
                  <div className="flex w-full items-center rounded-lg border border-slate-200 bg-white  focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition">
            <input
              type="text"
              value={exportFilename}
              onChange={(event) => setExportFilename(event.target.value)}
              placeholder="payables-export"
              autoFocus
              className="flex-1 rounded-l-lg bg-transparent px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />

            <span className="flex items-center rounded-r-lg border-l border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500">
              .xlsx
            </span>
          </div>
            <div className="flex justify-end gap-2 mt-8">
              <button
                type="button"
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                onClick={() => setExportFilenameModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-1.5 text-sm w-24 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                onClick={handleExportConfirm}
              >
                Export
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Payable Confirmation Modal */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] bg-opacity-50" onClick={() => { setDeleteDialogOpen(false); setDeleteTarget(null); }}></div>
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full relative z-10">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2">Delete Payable</h2>
                <p className=" text-gray-700 ">
                  Are you sure you want to delete
                  {` "${deleteTarget?.type || ''}"`} payable? This cannot be undone.
                </p>
              
                
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-8">
              <button
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                onClick={() => { setDeleteDialogOpen(false); setDeleteTarget(null); }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="px-4 py-1.5 w-28 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
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
              <button onClick={() => setTransactionModalOpen(false)} className="text-gray-400 hover:text-red-600 cursor-pointer">
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
                    <div key={payment.id || idx}>
                      <div className="border border-gray-200 rounded-xl shadow p-4">
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
                studentTransactions.map((payment, index) => (
                  <div key={payment.id ?? `student-transaction-${index}`} className="border border-gray-200 rounded p-4">
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
