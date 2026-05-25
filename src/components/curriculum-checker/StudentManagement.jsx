import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';

import { 
  addStudent, 
  getStudents, 
  updateStudentCourse,
  getCurriculums,
  getCoursesByCurriculum,
  getStudentCurriculumStatus,
  getAcademicConfig,
  saveAcademicConfig,
  getAllCourses,
  archiveAndPromoteStudents,
  normalizeDeanListCriteria,
  evaluateDeanListEligibility
} from '../../models/curriculumModels';
import { getActiveTerm } from '../../models/facultyModels';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, deleteDoc, getDoc, collection, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import OtherDepartmentManagement from './OtherDepartmentManagement';
import { BadgePlus, Pencil, Folder, Trash, Search, ChevronUp, ChevronDown, User, ChevronsUpDown, RefreshCcw, ChevronLeft, Plus, Funnel, X, FolderArchive, MoreVertical, Square, Calendar, GraduationCap, AlertCircle, CheckCircle2, Lock, Layers, BookOpen, Info, Link2 } from 'lucide-react';
import { logSystemAction } from '../../utils/auditLogger';
import { DeanListCriteriaFields } from '../common/DeanListCriteriaModal';

const SEMESTER_LABELS = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };
const STUDENT_MODAL_YEAR_TABS = [
  { key: 1, label: '1st Year' },
  { key: 2, label: '2nd Year' },
  { key: 3, label: '3rd Year' },
  { key: 4, label: '4th Year' },
  { key: 'irregular', label: 'Irregular' }
];

const getSurnameKey = (name = '') => {
  const raw = String(name).trim();
  if (!raw) return '';
  if (raw.includes(',')) {
    return raw.split(',')[0].trim().toLowerCase();
  }
  const parts = raw.split(/\s+/).filter(Boolean);
  return (parts[parts.length - 1] || '').toLowerCase();
};

const getBlockKey = (student) => {
  if (!student || student.isIrregular) return '';
  return String(student.block || 'A').trim().toUpperCase() || 'A';
};

const normalizeTerm = (activeTerm) => ({
  semester: activeTerm?.semester ?? activeTerm?.sem ?? activeTerm?.activeSemester,
  schoolYear: activeTerm?.schoolYear ?? activeTerm?.school_year ?? activeTerm?.academicYear
});

const getEnrollmentStatus = (student) => {
  if (student?.enrollmentStatus) return student.enrollmentStatus;
  if (student?.enrolled === true) return 'enrolled';
  if (student?.enrolled === false) return 'not-enrolled';
  return 'not-enrolled';
};

const FolderSkeleton = () => (
  <div className="relative rounded-lg border border-gray-300 bg-white p-4 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-blue-50" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="h-3 w-20 rounded bg-gray-100" />
      </div>
    </div>
  </div>
);

const RowSkeleton = () => (
  <tr className="border-t border-gray-300 animate-pulse">
    <td className="px-4 py-2 w-[3%]">
      <div className="h-4 w-3 rounded bg-gray-200" />
    </td>
    <td className="px-4 py-2 w-[12%]">
      <div className="h-4 w-full max-w-24 rounded bg-gray-200" />
    </td>
    <td className="px-4 py-2 w-[25%]">
      <div className="h-4 w-full max-w-56 rounded bg-gray-200" />
    </td>
    <td className="px-4 py-2 w-[18%]">
      <div className="h-4 w-full max-w-44 rounded bg-gray-200" />
    </td>
    <td className="px-4 py-2 w-[12%]">
      <div className="h-4 w-full max-w-32 rounded bg-gray-200" />
    </td>
    <td className="px-4 py-2 w-[15%]">
      <div className="h-4 w-full max-w-36 rounded bg-gray-200" />
    </td>
    <td className="px-4 py-2 w-[5%]">
      <div className="mx-auto h-5 w-9 rounded-full bg-gray-200" />
    </td>
    <td className="px-4 py-2 w-[10%]">
      <div className="flex gap-2">
        <div className="h-4 w-4 bg-gray-200 rounded-full" />
        <div className="h-4 w-4 bg-gray-200 rounded-full" />
        <div className="h-4 w-4 bg-gray-200 rounded-full" />
      </div>
    </td>
  </tr>
);

const StudentManagement = ({ onBack, initialSection = 'students', onBreadcrumbChange }) => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentCourses, setStudentCourses] = useState([]);
  // Folder selection state (year + block)
  const [selectedFolder, setSelectedFolder] = useState(null); // { year: number, block: string, isIrregular?: boolean }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [studentListTab, setStudentListTab] = useState(1);
  const [courseTab, setCourseTab] = useState(0);
  const [studentSection, setStudentSection] = useState(initialSection);

  useEffect(() => {
    setStudentSection(initialSection);
  }, [initialSection]);

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setCourseTab(student.yearLevel - 1);
    setLastSelectedStudentId(student.id);
  };
  
  // Student form state
  const [studentForm, setStudentForm] = useState({
    name: '',
    email: '',
    contactNumber: '',
    studentNumber: '',
    yearLevel: 1,
    curriculumId: '',
    block: '',
    enrolled: true,
    isIrregular: false
  });

  const [curriculumSelectError, setCurriculumSelectError] = useState('');
  const [studentFormYearError, setStudentFormYearError] = useState('');
  
  // Dialog states
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [editingDialogOpen, setEditingDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [inactiveConfirmOpen, setInactiveConfirmOpen] = useState(false);
  const [studentToInactivate, setStudentToInactivate] = useState(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [studentToArchive, setStudentToArchive] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const studentToDeleteName = students.find((student) => student.id === studentToDelete)?.name;
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingData, setEditingData] = useState({});
  // Temporary display overrides to keep recently-updated students visible in their original folder
  const [displayOverrides, setDisplayOverrides] = useState({});
  const [openYearView, setOpenYearView] = useState(null);
  
  // Grade management state
  const [studentGrades, setStudentGrades] = useState({});
  const [editingGrades, setEditingGrades] = useState({});
  const [irregularSubjects, setIrregularSubjects] = useState({ sem1: [], sem2: [], sem3: [] });
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [subjectPickerSemester, setSubjectPickerSemester] = useState(1);
  const [subjectPickerCurriculumFilter, setSubjectPickerCurriculumFilter] = useState('');
  const [subjectPickerYearFilter, setSubjectPickerYearFilter] = useState('all');
  const [subjectPickerSemesterFilter, setSubjectPickerSemesterFilter] = useState('all');
  const [irregularAddTermMode, setIrregularAddTermMode] = useState('current');
  const [subjectPickerSearch, setSubjectPickerSearch] = useState('');
  const [subjectPickerSortBy, setSubjectPickerSortBy] = useState('courseCode');
  const [subjectPickerSortOrder, setSubjectPickerSortOrder] = useState('asc');
  const [subjectPickerJoinYearLevel, setSubjectPickerJoinYearLevel] = useState('');
  const [subjectPickerJoinBlock, setSubjectPickerJoinBlock] = useState('');
  const [subjectPickerStatusFilter, setSubjectPickerStatusFilter] = useState('all');
  // Join-class confirmation modal (shown after clicking Add on a subject)
  const [joinClassModalOpen, setJoinClassModalOpen] = useState(false);
  const [joinClassPendingCourse, setJoinClassPendingCourse] = useState(null);
  const [joinClassYearLevel, setJoinClassYearLevel] = useState('');
  const [joinClassBlock, setJoinClassBlock] = useState('');
  const [irregularDeleteDialogOpen, setIrregularDeleteDialogOpen] = useState(false);
  const [irregularSubjectToDelete, setIrregularSubjectToDelete] = useState(null);

  // Sorting state for course tables
  const [sortBy, setSortBy] = useState('courseCode');
  const [sortOrder, setSortOrder] = useState('asc');
  const [subjectGradeSearchTerm, setSubjectGradeSearchTerm] = useState('');

  // View mode state
  const [viewMode, setViewMode] = useState('list');

  // Dropdown state for grid view
  const [openDropdown, setOpenDropdown] = useState(null);

  // UI: toggle between numbered rows and checkbox selection mode
  const [selectMode, setSelectMode] = useState(false);

  // Reactivate modal state (when turning inactive -> active)
  const [reactivateModalOpen, setReactivateModalOpen] = useState(false);
  const [reactivateTarget, setReactivateTarget] = useState(null);
  const [reactivateYear, setReactivateYear] = useState(1);
  const [reactivateBlock, setReactivateBlock] = useState('A');
  const [reactivateIsIrregular, setReactivateIsIrregular] = useState(false);

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState([]);
  const [lastSelectedStudentId, setLastSelectedStudentId] = useState(null);
  const [multiEditOpen, setMultiEditOpen] = useState(false);
  const [multiDeleteOpen, setMultiDeleteOpen] = useState(false);
  const [multiEditYear, setMultiEditYear] = useState(1);
  const [multiEditBlock, setMultiEditBlock] = useState('A');
  const [multiEditIsIrregular, setMultiEditIsIrregular] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  // Archive modal state
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  // Archive selected students into folder
  const [archiveSelectedModalOpen, setArchiveSelectedModalOpen] = useState(false);
  const [archiveFolders, setArchiveFolders] = useState([]);
  const [selectedArchiveFolder, setSelectedArchiveFolder] = useState('');
  const [newArchiveFolderName, setNewArchiveFolderName] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [activeTerm, setActiveTerm] = useState({ semester: null, schoolYear: '' });
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusModalType, setStatusModalType] = useState('all');
  const [statusModalYearTab, setStatusModalYearTab] = useState(1);
  const [statusModalSort, setStatusModalSort] = useState({ key: 'surname', direction: 'asc' });

  // Academic configuration modal
  const [academicModalOpen, setAcademicModalOpen] = useState(false);
  const [academicActiveTab, setAcademicActiveTab] = useState(0);
  const [academicConfig, setAcademicConfig] = useState(null);
  const [academicLoading, setAcademicLoading] = useState(false);
  const [scholarshipTierTab, setScholarshipTierTab] = useState(0); // 0 = 100%, 1 = 50%

  const loadAcademicConfig = async () => {
    setAcademicLoading(true);
    const res = await getAcademicConfig();
    if (res?.success) {
      setAcademicConfig({
        ...res.data,
        deanList: normalizeDeanListCriteria(res.data?.deanList || {})
      });
    }
    else setAcademicConfig(null);
    setAcademicLoading(false);
  };

  const getComputationFormulaGuide = (computation) => {
    const selectedMethod = computation === 'simple' ? 'Simple Average' : 'Weighted Average';

    return {
      weighted: 'Weighted: (sum of grade × units) / total units',
      simple: 'Simple: sum of grades / number of subjects',
      selectedMethod
    };
  };

  const term = normalizeTerm(activeTerm);
  const statusCounts = students.reduce(
    (acc, student) => {
      const status = getEnrollmentStatus(student) === 'enrolled' ? 'enrolled' : 'not-enrolled';
      if (!acc[status] && acc[status] !== 0) acc[status] = 0;
      acc[status] += 1;
      if (student.active === false) {
        acc.inactive += 1;
      } else {
        acc.active += 1;
      }
      return acc;
    },
    { enrolled: 0, 'not-enrolled': 0, active: 0, inactive: 0 }
  );

  const STATUS_CARD_META = {
    all: { label: 'All Students', count: students.length },
    enrolled: { label: 'Enrolled Students', count: statusCounts.enrolled || 0 },
    active: { label: 'Active Students', count: statusCounts.active || 0 },
    inactive: { label: 'Inactive Students', count: statusCounts.inactive || 0 },
    'not-enrolled': { label: 'Not Enrolled Students', count: statusCounts['not-enrolled'] || 0 },
  };

  const openStatusModal = (type) => {
    setStatusModalType(type);
    setStatusModalYearTab(1);
    setStatusModalSort({ key: 'surname', direction: 'asc' });
    setStatusModalOpen(true);
  };

  const handleStatusModalSort = (key) => {
    setStatusModalSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const StatusSortIcon = ({ column }) => {
    if (statusModalSort.key !== column) return <ChevronsUpDown className="h-3.5 w-3.5 opacity-80" />;
    return statusModalSort.direction === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5" />
      : <ChevronDown className="h-3.5 w-3.5" />;
  };

  const statusFilteredStudents = useMemo(() => {
    const byType = students.filter((student) => {
      if (statusModalType === 'all') return true;
      if (statusModalType === 'active') return student.active !== false;
      if (statusModalType === 'inactive') return student.active === false;
      if (statusModalType === 'enrolled') return getEnrollmentStatus(student) === 'enrolled';
      if (statusModalType === 'not-enrolled') return getEnrollmentStatus(student) === 'not-enrolled';
      return true;
    });

    const byYearTab = byType.filter((student) => {
      if (statusModalYearTab === 'irregular') return !!student.isIrregular;
      return !student.isIrregular && Number(student.yearLevel) === Number(statusModalYearTab);
    });

    return byYearTab.sort((a, b) => {
      let aValue = '';
      let bValue = '';

      switch (statusModalSort.key) {
        case 'block':
          aValue = getBlockKey(a);
          bValue = getBlockKey(b);
          break;
        case 'studentNumber':
          aValue = (a.studentNumber || '').toString();
          bValue = (b.studentNumber || '').toString();
          break;
        case 'name':
          aValue = (a.name || '').toString();
          bValue = (b.name || '').toString();
          break;
        case 'email':
          aValue = (a.email || '').toString();
          bValue = (b.email || '').toString();
          break;
        case 'contactNumber':
          aValue = (a.contactNumber || '').toString();
          bValue = (b.contactNumber || '').toString();
          break;
        case 'active':
          aValue = a.active === false ? 'inactive' : 'active';
          bValue = b.active === false ? 'inactive' : 'active';
          break;
        case 'enrollment':
          aValue = getEnrollmentStatus(a);
          bValue = getEnrollmentStatus(b);
          break;
        case 'surname':
        default:
          aValue = getSurnameKey(a.name);
          bValue = getSurnameKey(b.name);
          break;
      }

      const cmp = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return statusModalSort.direction === 'asc' ? cmp : -cmp;

      // deterministic tie-breaker
      const tie = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      return statusModalSort.direction === 'asc' ? tie : -tie;
    });
  }, [students, statusModalType, statusModalYearTab, statusModalSort]);

  const statusModalTabCounts = useMemo(() => {
    const base = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      irregular: 0
    };

    const byType = students.filter((student) => {
      if (statusModalType === 'all') return true;
      if (statusModalType === 'active') return student.active !== false;
      if (statusModalType === 'inactive') return student.active === false;
      if (statusModalType === 'enrolled') return getEnrollmentStatus(student) === 'enrolled';
      if (statusModalType === 'not-enrolled') return getEnrollmentStatus(student) === 'not-enrolled';
      return true;
    });

    byType.forEach((student) => {
      if (student.isIrregular) {
        base.irregular += 1;
        return;
      }
      const year = Number(student.yearLevel);
      if ([1, 2, 3, 4].includes(year)) {
        base[year] += 1;
      }
    });

    return base;
  }, [students, statusModalType]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Toggle a single student's selection
  const toggleSelectId = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      return [...prev, id];
    });
  };

  // Batch edit: update year level for selected students
  const handleMultiEditSave = async () => {
    if (!currentUser) {
      setError('Please sign in to update students');
      return;
    }

    const shouldUpdateBlock = !multiEditIsIrregular;
    const selectedCount = selectedIds.length;
    const selectedStudent = selectedCount === 1
      ? students.find((student) => student.id === selectedIds[0])
      : null;
    const updateDescription = selectedCount === 1
      ? shouldUpdateBlock
        ? `Updated ${selectedStudent?.name || selectedIds[0]} to year level ${multiEditYear} and block ${multiEditBlock}`
        : `Updated ${selectedStudent?.name || selectedIds[0]} to year level ${multiEditYear}`
      : `Updated ${selectedCount} students`;

    setLoading(true);
    setError('');
    try {
      const updates = selectedIds.map(async (id) => {
        const studentRef = doc(db, 'students', id);
        await updateDoc(
          studentRef,
          shouldUpdateBlock
            ? { yearLevel: multiEditYear, block: multiEditBlock, isIrregular: false, updatedAt: new Date() }
            : { yearLevel: multiEditYear, block: '', isIrregular: true, updatedAt: new Date() }
        );
      });

      await Promise.all(updates);
      await logSystemAction({
        action: selectedCount === 1 ? 'Updated Student Information' : 'Bulk Updated Student Information',
        module: 'Curriculum Checker',
        entityType: selectedCount === 1 ? 'student' : 'studentBatch',
        entityId: selectedCount === 1 ? selectedIds[0] : '',
        description: updateDescription,
        details: shouldUpdateBlock
          ? { studentIds: selectedIds, count: selectedCount, yearLevel: multiEditYear, block: multiEditBlock, isIrregular: false }
          : { studentIds: selectedIds, count: selectedCount, yearLevel: multiEditYear, isIrregular: true }
      });

      setStudents(prev => prev.map(s =>
        selectedIds.includes(s.id)
          ? {
              ...s,
              yearLevel: multiEditYear,
              isIrregular: !shouldUpdateBlock,
              ...(shouldUpdateBlock ? { block: multiEditBlock } : { block: '' })
            }
          : s
      ));
      toast.success('Students updated successfully!');
      setSelectedIds([]);
      setMultiEditOpen(false);
    } catch (err) {
      toast.error('Failed to update students: ' + err.message);
    }
    setLoading(false);
  };

  // Batch delete: confirm then delete selected studs
  const handleConfirmMultiDelete = async () => {
    if (!currentUser) {
      toast.error('Please sign in to delete students');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const deletes = selectedIds.map(async (id) => {
        await deleteDoc(doc(db, 'students', id));
      });
      await Promise.all(deletes);
      const deletedLabel = selectedIds.length === 1
        ? students.find(student => student.id === selectedIds[0])?.name || selectedIds[0]
        : '2 or more students';
      await logSystemAction({
        action: 'Deleted Student Records',
        module: 'Curriculum Checker',
        entityType: 'studentBatch',
        entityId: '',
        description: `Deleted ${deletedLabel} from the system`,
        details: { studentIds: selectedIds, count: selectedIds.length }
      });

      setStudents(prev => prev.filter(s => !selectedIds.includes(s.id)));
      if (selectedIds.includes(selectedStudent?.id)) setSelectedStudent(null);
      toast.success('Selected students deleted successfully!');
      setSelectedIds([]);
      setMultiDeleteOpen(false);
    } catch (err) {
      toast.error('Failed to delete students: ' + err.message);
    }
    setLoading(false);
  };

  // Helper: format student number as XXXX-XXXXX, limiting input
  const formatStudentNumber = (raw) => {
    const digits = (raw || '').replace(/\D/g, '');
    const first = digits.slice(0, 4);
    const second = digits.slice(4, 9);
    // Include dash once any first-part digits exist; cap total length to 10 chars
    const withDash = first ? `${first}-${second}` : '';
    return withDash.slice(0, 10);
  };

  const loadStudents = useCallback(async () => {
    if (!currentUser) {
      toast.error('Please sign in to access student data');
      return;
    }
    
    setLoading(true);
    setError('');
    const result = await getStudents();
    if (result.success) {
      setStudents(result.data);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }, [currentUser]);

  const loadCurriculums = useCallback(async () => {
    if (!currentUser) {
      toast.error('Please sign in to access curriculum data');
      return;
    }
    
    setLoading(true);
    setError('');
    const result = await getCurriculums();
    if (result.success) {
      setCurriculums(result.data);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }, [currentUser]);

  const loadAllCourses = useCallback(async () => {
    if (!currentUser) {
      setError('Please sign in to access course data');
      return;
    }

    const result = await getAllCourses();
    if (result.success) {
      setAllCourses(result.data);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadStudents();
      loadCurriculums();
      loadAllCourses();
      loadAcademicConfig();
    }
  }, [currentUser, loadStudents, loadCurriculums, loadAllCourses]);

  useEffect(() => {
    setStudentSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    const loadActiveTerm = async () => {
      if (!currentUser) return;

      const result = await getActiveTerm();
      if (result?.success && result?.data) {
        setActiveTerm(result.data);
      }
    };

    loadActiveTerm();
  }, [currentUser]);

  useEffect(() => {
    if (selectedStudent) {
      loadStudentCourses(selectedStudent.curriculumId);
      loadStudentGrades(selectedStudent.id);
      setIrregularSubjects({ sem1: [], sem2: [], sem3: [], ...(selectedStudent.irregularSubjects || {}) });
      setSubjectGradeSearchTerm('');
      setGradesDirty(false);
    }
  }, [selectedStudent]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('student-detail-state', { detail: { open: Boolean(selectedStudent) } }));
    return () => {
      window.dispatchEvent(new CustomEvent('student-detail-state', { detail: { open: false } }));
    };
  }, [selectedStudent]);

  useEffect(() => {
    const handleOpenAddStudent = () => {
      if (selectedStudent) return;
      setStudentForm({
        name: '',
        email: '',
        contactNumber: '',
        studentNumber: '',
        yearLevel: 1,
        curriculumId: '',
        block: getFirstBlockForYear(1, false),
        enrolled: true,
        isIrregular: false
      });
      setStudentDialogOpen(true);
    };

    window.addEventListener('open-add-student', handleOpenAddStudent);
    // allow external callers (e.g., App header) to open the academic configuration modal
    const handleOpenAcademicConfig = () => {
      if (!currentUser) return;
      setAcademicModalOpen(true);
      loadAcademicConfig();
    };
    window.addEventListener('open-academic-config', handleOpenAcademicConfig);
    return () => {
      window.removeEventListener('open-add-student', handleOpenAddStudent);
      window.removeEventListener('open-academic-config', handleOpenAcademicConfig);
    };
  }, [selectedStudent]);


  useEffect(() => {
    const handleResetStudentManagement = () => {
      setSelectedStudent(null);
      setSelectedFolder(null);
      setSelectedIds([]);
      setSearchTerm('');
      setStudentListTab(1);
    };

    window.addEventListener('reset-student-management', handleResetStudentManagement);
    const handleOpenStudentFolder = (e) => {
      const d = e.detail || {};
      if (d.selectedFolder) {
        setSelectedFolder(d.selectedFolder);
        setSelectedStudent(null);
      }
    };
    window.addEventListener('open-student-folder', handleOpenStudentFolder);
    return () => window.removeEventListener('reset-student-management', handleResetStudentManagement);
  }, []);

  // When returning to the student list, scroll the previously selected student into view
  useEffect(() => {
    if (!selectedStudent && lastSelectedStudentId) {
      // allow DOM to update
      setTimeout(() => {
        const el = document.getElementById(`student-row-${lastSelectedStudentId}`);
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  }, [selectedStudent, lastSelectedStudentId, studentListTab, viewMode]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Clear selected folder when switching tabs (but keep it when students update so edits don't close the folder view)
  useEffect(() => {
    setSelectedFolder(null);
  }, [studentListTab]);

  useEffect(() => {
    setSelectedFolder(null);
    setSelectedStudent(null);
    setSelectedIds([]);
    setSearchTerm('');
  }, [studentSection]);

  // Clear temporary display overrides when user navigates between folders
  useEffect(() => {
    setDisplayOverrides({});
  }, [selectedFolder]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 250);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToTop = () => {
    // Scroll every likely scroll container to ensure we reach the true page top.
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
  };

  // --- Archive folders helpers ---
  const fetchArchiveFolders = async () => {
    try {
      const snap = await getDocs(collection(db, 'archives'));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setArchiveFolders(docs);
    } catch (err) {
      console.error('Failed to load archive folders', err);
    }
  };

  const archiveSelectedStudentsToFolder = async (folderName) => {
    if (!folderName) {
      setAlertMessage('Please choose or enter a folder name');
      setAlertOpen(true);
      return;
    }
    setArchiving(true);
    try {
      // Load selected students
      const studentDocs = await Promise.all(selectedIds.map(id => getDoc(doc(db, 'students', id))));
      const selectedStudentsData = studentDocs.map(snap => ({ id: snap.id, ...(snap.exists() ? snap.data() : {}) }));
      
      // Check if any selected students have existing payables
      const studentsWithPayables = [];
      for (const student of selectedStudentsData) {
        const payables = student.payables || [];
        const hasUnpaidPayables = payables.some(p => p.status !== 'paid');
        if (hasUnpaidPayables) {
          studentsWithPayables.push(student.name || student.id);
        }
      }
      
      if (studentsWithPayables.length > 0) {
        setArchiving(false);
        setAlertMessage(`Cannot archive students with existing payables:\n${studentsWithPayables.join('\n')}\n\nPlease settle all payables before archiving these students.`);
        setAlertOpen(true);
        return;
      }

      const archiveRef = doc(db, 'archives', folderName);
      const existingSnap = await getDoc(archiveRef);
      const existing = existingSnap.exists() ? (existingSnap.data().students || []) : [];

      const existingIds = new Set(existing.map(s => s.id));
      const toAppend = selectedStudentsData.filter(s => !existingIds.has(s.id));
      const merged = [...existing, ...toAppend];

      await setDoc(archiveRef, { students: merged, name: folderName, updatedAt: serverTimestamp() }, { merge: true });
      await logSystemAction({
        action: 'Archived Student Records',
        module: 'Curriculum Checker',
        entityType: 'archive',
        entityId: folderName,
        description: `Archived ${selectedIds.length} student records to folder: ${folderName}`,
        details: { folderName, studentIds: selectedIds }
      });

      // refresh folder list
      await fetchArchiveFolders();
      // remove archived students from active collection
      try {
        await Promise.all(selectedIds.map(id => deleteDoc(doc(db, 'students', id))));
      } catch (err) {
        console.error('Failed to remove archived students from students collection', err);
      }

      // update local UI state
      setStudents(prev => prev.filter(s => !selectedIds.includes(s.id)));
      setSelectedIds([]);
      setArchiveSelectedModalOpen(false);
      setNewArchiveFolderName('');
      setSelectedArchiveFolder('');
      toast.success('Students archived successfully.');
    } catch (err) {
      console.error(err);
      setAlertMessage('Failed to archive students.');
      setAlertOpen(true);
    } finally {
      setArchiving(false);
    }
  };

  useEffect(() => {
    if (archiveSelectedModalOpen) {
      fetchArchiveFolders();
    }
  }, [archiveSelectedModalOpen]);

  const loadStudentCourses = async (curriculumId) => {
    if (!curriculumId) return;
    // Load courses and also attempt to fetch student-specific curriculum status (which includes availability)
    try {
      if (!selectedStudent) {
        const result = await getCoursesByCurriculum(curriculumId);
        if (result.success) setStudentCourses(result.data);
        return;
      }

      const statusRes = await getStudentCurriculumStatus(selectedStudent.id);
      if (statusRes?.success && statusRes?.data?.courses) {
        setStudentCourses(statusRes.data.courses);
      } else {
        const result = await getCoursesByCurriculum(curriculumId);
        if (result.success) setStudentCourses(result.data);
      }
    } catch (err) {
      // fallback
      const result = await getCoursesByCurriculum(curriculumId);
      if (result.success) setStudentCourses(result.data);
    }
  };

  const handleAddStudent = async () => {
    if (!currentUser) {
      setError('Please sign in to add a student');
      return;
    }
    // Clear previous year error
    setStudentFormYearError('');
    
    // Validate student number format only if provided
    const studentNumberPattern = /^\d{4}-\d{5}$/;
    if (studentForm.studentNumber && !studentNumberPattern.test(studentForm.studentNumber)) {
      toast.error('Please enter a valid student number in the format XXXX-XXXXX');
      return;
    }

    // Check for duplicate student number only if provided
    if (studentForm.studentNumber) {
      const existingStudent = students.find(student => student.studentNumber === studentForm.studentNumber);
      if (existingStudent) {
        toast.error('A student with this student number already exists');
        return;
      }
    }
    // Require curriculum selection for all students
    if (!studentForm.curriculumId || String(studentForm.curriculumId).trim() === '') {
      setCurriculumSelectError('Please choose curriculum first');
      return;
    }
    // Require year selection
    if (!studentForm.yearLevel) {
      setLoading(false);
      setStudentFormYearError('Please select a year level');
      return;
    }
    
    setLoading(true);
    setError('');
    const shouldEnroll = studentForm.enrolled === true;
    const result = await addStudent({
      ...studentForm,
      curriculumId: studentForm.curriculumId,
      block: studentForm.isIrregular ? '' : studentForm.block,
      enrolled: shouldEnroll,
      enrolledTerm: shouldEnroll && term.semester && term.schoolYear
        ? { semester: Number(term.semester), schoolYear: term.schoolYear }
        : null,
      irregularSubjects: studentForm.isIrregular ? { sem1: [], sem2: [], sem3: [] } : undefined
    });
    if (result.success) {
      toast.success('Student added successfully!');
      setStudentForm({ name: '', email: '', contactNumber: '', studentNumber: '', yearLevel: 1, curriculumId: '', block: '', enrolled: true, isIrregular: false });
      setStudentDialogOpen(false);
      loadStudents();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const handleUpdateStudentCourse = async (courseCode, isCompleted) => {
    if (!selectedStudent) return;
    
    setLoading(true);
    const result = await updateStudentCourse(selectedStudent.id, courseCode, isCompleted);
    if (result.success) {
      
      // Update the local selectedStudent state immediately
      setSelectedStudent(prev => {
        if (!prev) return prev;
        
        let completedCourses = prev.completedCourses || [];
        
        if (isCompleted) {
          if (!completedCourses.includes(courseCode)) {
            completedCourses = [...completedCourses, courseCode];
          }
        } else {
          completedCourses = completedCourses.filter(code => code !== courseCode);
        }
        
        return {
          ...prev,
          completedCourses
        };
      });
      
      // Also update the students list to keep it in sync
      setStudents(prevStudents => 
        prevStudents.map(student => 
          student.id === selectedStudent.id 
            ? { 
                ...student, 
                completedCourses: isCompleted 
                  ? [...(student.completedCourses || []), courseCode]
                  : (student.completedCourses || []).filter(code => code !== courseCode)
              }
            : student
        )
      );
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const handleStartEdit = (student) => {
    setEditingData({
      id: student.id,
      name: student.name,
      email: student.email || '',
      contactNumber: student.contactNumber || '',
      studentNumber: student.studentNumber || '',
      yearLevel: student.yearLevel,
      curriculumId: student.curriculumId,
      isIrregular: student.isIrregular || false,
      enrolled: student.enrolled ?? true,
      block: student.block || getFirstBlockForYear(student.yearLevel, student.isIrregular || false),
      // keep originals so UI can keep student visible in the folder where edit started
      originalYearLevel: student.yearLevel,
      originalBlock: student.block || getFirstBlockForYear(student.yearLevel, student.isIrregular || false),
      originalEnrolled: student.enrolled ?? true
    });
    setEditingDialogOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingStudent(null);
    setEditingData({});
    setEditingDialogOpen(false);
  };

  const handleSaveEdit = async (studentId) => {
    if (!currentUser) {
      setError('Please sign in to update student data');
      return;
    }
    
    // Validate student number format only if provided
    const studentNumberPattern = /^\d{4}-\d{5}$/;
    if (editingData.studentNumber && !studentNumberPattern.test(editingData.studentNumber)) {
      setError('Please enter a valid student number in the format XXXX-XXXXX');
      return;
    }

    // Check for duplicate student number (excluding current student) only if provided
    if (editingData.studentNumber) {
      const existingStudent = students.find(student => student.studentNumber === editingData.studentNumber && student.id !== studentId);
      if (existingStudent) {
        setError('A student with this student number already exists');
        return;
      }
    }
    // Require curriculum selection for all students
    if (!editingData.curriculumId || String(editingData.curriculumId).trim() === '') {
      setCurriculumSelectError('Please choose curriculum first');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const payload = {
        name: editingData.name || '',
        email: editingData.email || '',
        contactNumber: editingData.contactNumber || '',
        studentNumber: editingData.studentNumber || '',
        yearLevel: editingData.yearLevel,
        curriculumId: editingData.curriculumId || '',
        block: editingData.isIrregular ? '' : (editingData.block || ''),
        isIrregular: editingData.isIrregular,
        enrolled: editingData.enrolled === true,
        irregularSubjects: editingData.isIrregular
          ? { sem1: [], sem2: [], sem3: [], ...(selectedStudent?.irregularSubjects || {}) }
          : null,
        updatedAt: new Date()
      };

      const studentRef = doc(db, 'students', studentId);
      await updateDoc(studentRef, payload);
      const yearOrBlockChanged =
        Number(editingData.originalYearLevel) !== Number(payload.yearLevel) ||
        (!payload.isIrregular && (editingData.originalBlock || '') !== (payload.block || ''));
      const enrollmentChanged = editingData.originalEnrolled !== editingData.enrolled;
      
      let updateDescription = `Updated student: ${payload.name || studentId}`;
      if (enrollmentChanged) {
        updateDescription = `${editingData.enrolled ? 'Enrolled' : 'Not enrolled'} student ${payload.name || studentId}`;
      } else if (yearOrBlockChanged) {
        updateDescription = payload.isIrregular
          ? `Updated ${payload.name || studentId} to year level ${payload.yearLevel}`
          : `Updated ${payload.name || studentId} to year level ${payload.yearLevel} and block ${payload.block || 'A'}`;
      }
      
      await logSystemAction({
        action: enrollmentChanged ? (editingData.enrolled ? 'Enrolled Student In Classes' : 'Unenrolled Student From Classes') : 'Updated Student Information',
        module: enrollmentChanged ? 'Student Management' : 'Curriculum Checker',
        entityType: 'student',
        entityId: studentId,
        description: updateDescription,
        details: {
          studentName: payload.name,
          studentId: studentId,
          enrolled: payload.enrolled,
          enrollmentChanged: enrollmentChanged,
          ...payload
        }
      });
      toast.success('Student updated successfully!');
      // Keep the updated student visible in the folder where the edit started
      setDisplayOverrides(prev => ({
        ...prev,
        [studentId]: editingData.isIrregular
          ? { year: editingData.originalYearLevel ?? editingData.yearLevel, isIrregular: true }
          : { year: editingData.originalYearLevel ?? editingData.yearLevel, block: editingData.originalBlock ?? editingData.block }
      }));

      setEditingStudent(null);
      setEditingData({});
      setStudentListTab(editingData.isIrregular ? 5 : editingData.yearLevel);
      setEditingDialogOpen(false);
      // reload students from server to get canonical data
      loadStudents();
    } catch (error) {
      toast.error('Failed to update student: ' + error.message);
    }
    setLoading(false);
  };

  const handleDeleteStudent = async (studentId) => {
    if (!currentUser) {
      toast.error('Please sign in to delete a student');
      return;
    }

    setStudentToDelete(studentId);
    setDeleteDialogOpen(true);
  };

  // Archive a single student: first confirm, then open the Archive Selected modal prefilled for this student
  const handleArchiveStudent = (e, student) => {
    e.stopPropagation();
    if (!currentUser) {
      toast.error('Please sign in to archive a student');
      return;
    }

    // First, confirm archiving
    setStudentToArchive(student);
    setArchiveConfirmOpen(true);
  };

  // Toggle active/inactive for a single student. If reactivating, open modal to choose year/block.
  const handleToggleActive = async (e, student) => {
    e.stopPropagation();
    if (!currentUser) { toast.error('Please sign in to change student status'); return; }
    // If student is inactive, open reactivation modal to choose year/block
    if (student.active === false) {
      setReactivateTarget(student);
      setReactivateYear(student.yearLevel || 1);
      setReactivateBlock(student.block || 'A');
      setReactivateIsIrregular(!!student.isIrregular);
      setReactivateModalOpen(true);
      return;
    }

    // Otherwise, ask the user to confirm marking the student inactive
    setStudentToInactivate(student);
    setInactiveConfirmOpen(true);
  };

  const handleConfirmInactivate = async () => {
    if (!studentToInactivate) return;

    setLoading(true);
    setError('');
    try {
      const student = studentToInactivate;
      const ref = doc(db, 'students', student.id);
      await updateDoc(ref, { active: false, inactiveAt: serverTimestamp(), inactiveYear: student.yearLevel, updatedAt: new Date() });
      await logSystemAction({
        action: 'Marked Student As Inactive',
        module: 'Curriculum Checker',
        entityType: 'student',
        entityId: student.id,
        description: `Marked student ${student.name || student.id} as inactive`,
        details: { studentId: student.id, studentName: student.name || '', status: 'inactive' }
      });
      setStudents(prev => prev.map(s => s.id === student.id ? { ...s, active: false, inactiveAt: new Date(), inactiveYear: student.yearLevel } : s));
      toast.success('Student marked inactive');
      setInactiveConfirmOpen(false);
      setStudentToInactivate(null);
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    }
    setLoading(false);
  };

  const handleConfirmArchive = () => {
    if (!studentToArchive) return;

    // Preselect this student and open the archive modal so user can choose/create folder
    setSelectedIds([studentToArchive.id]);
    setSelectedArchiveFolder('');
    setNewArchiveFolderName('');
    setArchiveSelectedModalOpen(true);
    setArchiveConfirmOpen(false);
    setStudentToArchive(null);
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;

    setLoading(true);
    setError('');
    
    try {
      const studentName = students.find(student => student.id === studentToDelete)?.name || studentToDelete;
      await deleteDoc(doc(db, 'students', studentToDelete));
      await logSystemAction({
        action: 'Deleted Student Record',
        module: 'Curriculum Checker',
        entityType: 'student',
        entityId: studentToDelete,
        description: `Deleted student record for ${studentName}`,
        details: { studentId: studentToDelete, studentName }
      });
      
      setStudents(prevStudents => prevStudents.filter(student => student.id !== studentToDelete));
      
      // Clear selected student if it's the one being deleted
      if (selectedStudent && selectedStudent.id === studentToDelete) {
        setSelectedStudent(null);
      }
      
      setSuccess('Student deleted successfully!');
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
    } catch (error) {
      setError('Failed to delete student: ' + error.message);
    }
    
    setLoading(false);
  };

  const handleInputChange = (field, value) => {
    setEditingData(prev => ({ ...prev, [field]: value }));
  };

  const getStudentCountByYear = (year) => {
    return students.filter(student => student.yearLevel === year && !student.isIrregular).length;
  };

  const getIrregularStudentCount = () => {
    return students.filter(student => student.isIrregular).length;
  };

  const getTotalStudentCount = () => {
    return students.length;
  };

  const getCurriculumName = (curriculumId) => {
    const curriculum = curriculums.find(c => c.id === curriculumId);
    return curriculum ? curriculum.name : '';
  };

  const getYearLabel = (year) => {
    if (year === 1) return '1st';
    if (year === 2) return '2nd';
    if (year === 3) return '3rd';
    if (year === 4) return '4th';
    return `${year}th`;
  };

  // Emit breadcrumb info to parent App (top-level) so the breadcrumb
  // is rendered at the top of the page instead of inside this component.
  useEffect(() => {
    try {
      window.dispatchEvent(
        new CustomEvent('student-breadcrumb', {
          detail: {
            mode: studentSection,
            selectedFolder: selectedFolder || null,
            selectedStudent: selectedStudent || null
          }
        })
      );
    } catch (e) {
      // ignore in environments without window
    }
  }, [studentSection, selectedFolder, selectedStudent]);

  // Derive available blocks dynamically from existing students
  const getAvailableBlocks = () => {
    const set = new Set();
    students.forEach(s => {
      const block = s && s.block && String(s.block).trim() !== '' ? String(s.block).trim() : 'A';
      set.add(block);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  };

  const isStudentEnrolledInActiveTerm = (student) => {
    if (!term.semester || !term.schoolYear) return false;
    return (
      Number(student?.enrolledTerm?.semester) === Number(term.semester) &&
      (student?.enrolledTerm?.schoolYear || '') === (term.schoolYear || '')
    );
  };

  const getBlocksForYear = (year, isIrregular = false) => {
    if (isIrregular) return [];

    const set = new Set();
    students.forEach(s => {
      if ((s.yearLevel === year) && (isIrregular ? s.isIrregular : !s.isIrregular)) {
        const block = s && s.block && String(s.block).trim() !== '' ? String(s.block).trim() : 'A';
        set.add(block);
      }
    });
    const blocks = Array.from(set).sort((a, b) => a.localeCompare(b));
    if (blocks.length === 0) return ['A'];
    return blocks;
  };

  const getBlocksForYearInActiveTerm = (year) => {
    if (!term.semester || !term.schoolYear) {
      return getBlocksForYear(year, false);
    }

    const set = new Set();
    students.forEach((s) => {
      if (s.isIrregular || Number(s.yearLevel) !== Number(year)) return;
      if (!isStudentEnrolledInActiveTerm(s)) return;
      const block = s?.block && String(s.block).trim() !== '' ? String(s.block).trim().toUpperCase() : 'A';
      set.add(block);
    });
    const blocks = Array.from(set).sort((a, b) => a.localeCompare(b));
    return blocks.length > 0 ? blocks : getBlocksForYear(year, false);
  };

  const getIrregularSemesterDisplayRows = (currentYear, semester) => {
    const semKey = `sem${semester}`;
    const existingForSem = (irregularSubjects[semKey] || []).filter(
      (subject) =>
        Number(subject.yearLevel || currentYear) === currentYear &&
        Number(subject.enrolledSemester || subject.semester || semester) === Number(semester)
    );

    const gradedCourseCodes = Object.keys(studentGrades || {}).filter(
      (code) => studentGrades[code] !== undefined && studentGrades[code] !== ''
    );
    const gradedForSem = gradedCourseCodes.map((code) => {
      const norm = (code || '').toString().trim().toUpperCase();
      const course =
        allCourses.find((c) => (c.courseCode || '').toString().trim().toUpperCase() === norm) ||
        studentCourses.find((c) => (c.courseCode || '').toString().trim().toUpperCase() === norm) ||
        {};
      return {
        id: `graded-${norm}`,
        courseCode: norm,
        courseTitle: course?.courseTitle || '',
        units: course?.units || '',
        isMajor: course?.isMajor ?? false,
        yearLevel: course?.yearLevel || currentYear,
        prerequisites: course?.prerequisites || [],
        enrolledSemester: course?.semester || semester,
        enrolledSchoolYear: ''
      };
    }).filter(
      (subject) =>
        Number(subject.yearLevel || currentYear) === currentYear &&
        Number(subject.enrolledSemester || semester) === Number(semester)
    );

    const seen = new Set();
    const mergedSubjects = [];

    existingForSem.forEach((subject) => {
      const key = `${(subject.courseCode || '').toString().trim().toUpperCase()}::${Number(subject.yearLevel || currentYear)}`;
      seen.add(key);
      mergedSubjects.push(subject);
    });

    gradedForSem.forEach((subject) => {
      const key = `${(subject.courseCode || '').toString().trim().toUpperCase()}::${Number(subject.yearLevel || currentYear)}`;
      if (!seen.has(key)) {
        seen.add(key);
        mergedSubjects.push(subject);
      }
    });

    return mergedSubjects;
  };

  const getFirstBlockForYear = (year, isIrregular = false) => {
    if (isIrregular) return '';

    const blocks = getBlocksForYear(year, isIrregular);
    return blocks && blocks.length > 0 ? blocks[0] : 'A';
  };

  const getFolderLabel = (folder) => {
    if (!folder) return '';
    if (folder.isInactiveFolder) return 'Inactive Students';
    if (folder.isIrregular) return 'Irregular Students';
    const yearNum = Number(folder.year || 0);
    return `${getYearLabel(yearNum)} Year Block ${folder.block || 'A'}`;
  };

  const getIrregularTakenTermDisplay = (subject) => {
    const activeSem = Number(term.semester);
    const activeSy = (term.schoolYear || '').toString().trim();
    const semLabel = (sem) =>
      sem === 1 ? '1st' : sem === 2 ? '2nd' : sem === 3 ? 'Summer' : `Sem ${sem}`;

    if (subject.termMode === 'current') {
      return {
        label: 'Current Term',
        detail: activeSem && activeSy
          ? `${SEMESTER_LABELS[activeSem] || semLabel(activeSem)} · S.Y. ${activeSy}`
          : 'Active term not set',
        tone: 'current'
      };
    }

    if (subject.termMode === 'previous') {
      return {
        label: 'Previous Term',
        detail: '',
        tone: 'previous'
      };
    }

    const enrolledSem = Number(subject.enrolledSemester);
    const enrolledSy = (subject.enrolledSchoolYear || '').toString().trim();
    const matchesActiveTerm =
      activeSem &&
      activeSy &&
      enrolledSem === activeSem &&
      enrolledSy === activeSy;

    if (matchesActiveTerm) {
      return {
        label: 'Current Term',
        detail: `${SEMESTER_LABELS[activeSem] || semLabel(activeSem)} · S.Y. ${activeSy}`,
        tone: 'current'
      };
    }

    return {
      label: 'Previous Term',
      detail: '',
      tone: 'previous'
    };
  };

  // Notify parent (CurriculumChecker) of the current breadcrumb trail so it can
  // render the breadcrumb at the top of the page rather than inside this component.
  useEffect(() => {
    if (!onBreadcrumbChange) return;
    if (selectedStudent) {
      onBreadcrumbChange([
        ...(selectedFolder
          ? [{ label: getFolderLabel(selectedFolder), onClick: () => setSelectedStudent(null) }]
          : []),
        { label: selectedStudent.name || 'Student Detail' }
      ]);
    } else if (selectedFolder) {
      onBreadcrumbChange([{ label: getFolderLabel(selectedFolder) }]);
    } else {
      onBreadcrumbChange([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolder, selectedStudent, onBreadcrumbChange]);

  const getEquivalentCoursesForCourse = (course, { otherCurriculaOnly = false } = {}) => {
    const equivId = (course?.equivalentSubjectId || '').toString().trim();
    if (!equivId) return [];

    return allCourses.filter((candidate) => {
      if (!candidate.equivalentSubjectId || candidate.equivalentSubjectId !== equivId) return false;
      if (candidate.id === course.id) return false;
      if (otherCurriculaOnly && candidate.curriculumId === course.curriculumId) return false;
      return true;
    });
  };

  const getEquivalentCoursesFromOtherCurricula = (course) =>
    getEquivalentCoursesForCourse(course, { otherCurriculaOnly: true });

  const courseMatchesIrregularPickerSearch = (course, query) => {
    const curriculumName = getCurriculumName(course.curriculumId).toLowerCase();
    const classification = course.isMajor ? 'major' : 'available';
    const equivalentSearchText = getEquivalentCoursesForCourse(course)
      .map(
        (eq) =>
          `${eq.courseCode} ${eq.courseTitle} ${getCurriculumName(eq.curriculumId)}`
      )
      .join(' ')
      .toLowerCase();

    return (
      (course.courseCode || '').toString().toLowerCase().includes(query) ||
      (course.courseTitle || '').toString().toLowerCase().includes(query) ||
      String(course.units ?? '').toLowerCase().includes(query) ||
      String(course.yearLevel ?? '').toLowerCase().includes(query) ||
      String(course.semester ?? '').toLowerCase().includes(query) ||
      curriculumName.includes(query) ||
      classification.includes(query) ||
      getCoursePrerequisites(course).join(' ').toLowerCase().includes(query) ||
      equivalentSearchText.includes(query)
    );
  };

  const passesIrregularPickerFilters = (course) => {
    if (subjectPickerCurriculumFilter && course.curriculumId !== subjectPickerCurriculumFilter) {
      return false;
    }

    if (subjectPickerYearFilter !== 'all' && Number(course.yearLevel) !== Number(subjectPickerYearFilter)) {
      return false;
    }

    if (subjectPickerSemesterFilter !== 'all' && Number(course.semester) !== Number(subjectPickerSemesterFilter)) {
      return false;
    }

    const query = subjectPickerSearch.trim().toLowerCase();
    if (query && !courseMatchesIrregularPickerSearch(course, query)) {
      return false;
    }

    return true;
  };

  const getIrregularSubjectCandidates = () => {
    const candidates = allCourses.filter((course) => passesIrregularPickerFilters(course));

    return candidates.sort((a, b) => {
      let aValue = '';
      let bValue = '';

      switch (subjectPickerSortBy) {
        case 'courseCode':
          aValue = (a.courseCode || '').toString().toLowerCase();
          bValue = (b.courseCode || '').toString().toLowerCase();
          break;
        case 'courseTitle':
          aValue = (a.courseTitle || '').toString().toLowerCase();
          bValue = (b.courseTitle || '').toString().toLowerCase();
          break;
        case 'units':
          return subjectPickerSortOrder === 'asc'
            ? (parseFloat(a.units) || 0) - (parseFloat(b.units) || 0)
            : (parseFloat(b.units) || 0) - (parseFloat(a.units) || 0);
        case 'yearLevel':
          return subjectPickerSortOrder === 'asc'
            ? (parseFloat(a.yearLevel) || 0) - (parseFloat(b.yearLevel) || 0)
            : (parseFloat(b.yearLevel) || 0) - (parseFloat(a.yearLevel) || 0);
        case 'semester':
          return subjectPickerSortOrder === 'asc'
            ? (parseFloat(a.semester) || 0) - (parseFloat(b.semester) || 0)
            : (parseFloat(b.semester) || 0) - (parseFloat(a.semester) || 0);
        case 'curriculum':
        default:
          aValue = (getCurriculumName(a.curriculumId) || '').toLowerCase();
          bValue = (getCurriculumName(b.curriculumId) || '').toLowerCase();
          break;
      }

      const primaryCompare = subjectPickerSortOrder === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);

      if (primaryCompare !== 0) {
        return primaryCompare;
      }

      const aCode = (a.courseCode || '').toString().toLowerCase();
      const bCode = (b.courseCode || '').toString().toLowerCase();
      return aCode.localeCompare(bCode);
    });
  };

  const normalizeCourseCode = (code) => (code || '').toString().trim().toUpperCase();

  const getCoursePrerequisites = (course) => {
    if (Array.isArray(course?.prerequisites) && course.prerequisites.length > 0) {
      return course.prerequisites;
    }

    const norm = normalizeCourseCode(course?.courseCode);
    if (!norm) return [];

    const match =
      allCourses.find(
        (c) =>
          normalizeCourseCode(c.courseCode) === norm &&
          course?.curriculumId &&
          c.curriculumId === course.curriculumId
      ) ||
      allCourses.find((c) => normalizeCourseCode(c.courseCode) === norm);

    return Array.isArray(match?.prerequisites) ? match.prerequisites : [];
  };

  const getPrerequisiteCourseTitle = (courseCode) => {
    const norm = normalizeCourseCode(courseCode);
    const match = allCourses.find((c) => normalizeCourseCode(c.courseCode) === norm);
    return (match?.courseTitle || '').toString().trim();
  };

  const getPrerequisiteStatusLabel = (status) => {
    if (status === 'failed') return 'Failed';
    if (status === 'incomplete') return 'Incomplete';
    if (status === 'completed') return 'Passed';
    return 'Not completed';
  };

  const getGradeForCourseCode = (courseCode) => {
    const norm = normalizeCourseCode(courseCode);
    if (!norm || !studentGrades) return '';

    if (studentGrades[courseCode] !== undefined && studentGrades[courseCode] !== '') {
      return studentGrades[courseCode];
    }

    const matchedKey = Object.keys(studentGrades).find(
      (key) => normalizeCourseCode(key) === norm
    );
    return matchedKey ? (studentGrades[matchedKey] ?? '') : '';
  };

  const getPrerequisiteFulfillment = (courseCode) => {
    const norm = normalizeCourseCode(courseCode);
    const grade = getGradeForCourseCode(courseCode);
    const inCompletedList = (selectedStudent?.completedCourses || []).some(
      (completedCode) => normalizeCourseCode(completedCode) === norm
    );

    if (grade === '5.0') {
      return { courseCode: norm || courseCode, status: 'failed' };
    }
    if (grade === 'INC') {
      return { courseCode: norm || courseCode, status: 'incomplete' };
    }
    if (inCompletedList || (grade && grade !== '')) {
      return { courseCode: norm || courseCode, status: 'completed' };
    }

    return { courseCode: norm || courseCode, status: 'missing' };
  };

  const getUnmetPrerequisites = (prerequisites = []) => {
    const list = Array.isArray(prerequisites) ? prerequisites : [];
    return list
      .map((prerequisiteCode) => {
        const fulfillment = getPrerequisiteFulfillment(prerequisiteCode);
        return fulfillment.status === 'completed' ? null : fulfillment;
      })
      .filter(Boolean);
  };

  const formatUnmetPrerequisitesMessage = (unmet = []) => {
    if (unmet.length === 0) return '';

    const parts = unmet.map(({ courseCode, status }) => {
      if (status === 'failed') return `${courseCode} (failed)`;
      if (status === 'incomplete') return `${courseCode} (incomplete)`;
      return `${courseCode} (not yet completed or passed)`;
    });

  };

  const isCourseCompleted = (courseCode) =>
    getPrerequisiteFulfillment(courseCode).status === 'completed';

  const getIrregularUnitsLimit = () =>
    academicConfig?.unitsLimits?.default?.irregular ?? 15;

  const getIrregularUnitsScope = () =>
    academicConfig?.unitsLimits?.default?.irregularScope === 'year' ? 'year' : 'semester';

  const getIrregularUnitsScopeLabel = () =>
    getIrregularUnitsScope() === 'year' ? 'per year' : 'per semester';

  const sumIrregularSubjectUnits = (subjects = []) =>
    subjects.reduce((sum, subject) => sum + (parseFloat(subject.units) || 0), 0);

  const getIrregularUnitsUsed = ({ yearLevel, semester }) => {
    const year = Number(yearLevel);
    if (!year) return 0;

    if (getIrregularUnitsScope() === 'year') {
      return ['sem1', 'sem2', 'sem3'].reduce((total, semKey) => {
        const matched = (irregularSubjects[semKey] || []).filter(
          (subject) => Number(subject.yearLevel) === year
        );
        return total + sumIrregularSubjectUnits(matched);
      }, 0);
    }

    const semKey = `sem${semester}`;
    const matched = (irregularSubjects[semKey] || []).filter(
      (subject) => Number(subject.yearLevel) === year
    );
    return sumIrregularSubjectUnits(matched);
  };

  const getIrregularUnitsLimitContextLabel = ({ yearLevel, semester }) => {
    const yearLabel = getYearLabel(Number(yearLevel));
    if (getIrregularUnitsScope() === 'year') {
      return `${yearLabel} year`;
    }
    const semLabel =
      Number(semester) === 1 ? '1st' : Number(semester) === 2 ? '2nd' : Number(semester) === 3 ? 'Summer' : `Sem ${semester}`;
    return `${yearLabel} year, ${semLabel} semester`;
  };

  const handleAddIrregularSubject = async (semester, course, joinYearLevel, joinBlock, addTermMode = 'previous') => {
    if (!selectedStudent) return;
    if (!course) {
      setError('Please select a subject to add');
      return;
    }

    const isCurrentTerm = addTermMode === 'current';
    if (isCurrentTerm && (!term.semester || !term.schoolYear)) {
      setError('Active term is not configured. Set the current term in Admin Panel settings first.');
      return;
    }

    // Prevent adding a subject that already has a saved grade for this student
    const newCode = (course.courseCode || '').toString().trim().toUpperCase();
    if (studentGrades) {
      const alreadyGraded = Object.keys(studentGrades).some(k => (k || '').toString().trim().toUpperCase() === newCode && studentGrades[k] !== undefined && studentGrades[k] !== '');
      if (alreadyGraded) {
        setError('This subject already has a recorded grade and cannot be added as irregular');
        return;
      }
    }

    const resolveSubjectPickerTargetYear = (courseForYear) => {
      if (subjectPickerYearFilter !== 'all') {
        return Number(subjectPickerYearFilter);
      }
      return Number(courseForYear?.yearLevel) || courseTab + 1;
    };

    const targetYear = resolveSubjectPickerTargetYear(course);
    const enrolledSemester = isCurrentTerm
      ? Number(term.semester) || Number(semester) || 1
      : Number(semester) || 1;
    const semKey = `sem${enrolledSemester}`;
    const duplicate = (irregularSubjects[semKey] || []).some(
      (subject) =>
        (subject.courseCode || '').toString().trim().toUpperCase() === (course.courseCode || '').toString().trim().toUpperCase() &&
        Number(subject.yearLevel || targetYear) === targetYear
    );

    if (duplicate) {
      setError('This subject is already added for the selected year and semester');
      return;
    }

    const prerequisites = getCoursePrerequisites(course);
    const unmetPrerequisites = getUnmetPrerequisites(prerequisites);
    if (unmetPrerequisites.length > 0) {
      setError(formatUnmetPrerequisitesMessage(unmetPrerequisites));
      return;
    }

    const maxIrregularUnits = getIrregularUnitsLimit();
    const currentUnits = getIrregularUnitsUsed({
      yearLevel: targetYear,
      semester: enrolledSemester
    });
    const courseUnits = parseFloat(course.units) || 0;
    if (currentUnits + courseUnits > maxIrregularUnits) {
      setError(
        `Cannot add ${course.courseCode}: this would exceed the irregular unit limit of ${maxIrregularUnits} units ${getIrregularUnitsScopeLabel()} (${getIrregularUnitsLimitContextLabel({ yearLevel: targetYear, semester: enrolledSemester })}).`
      );
      return;
    }

    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      courseCode: (course.courseCode || '').toString().trim().toUpperCase(),
      courseTitle: (course.courseTitle || '').toString().trim(),
      units: parseFloat(course.units) || 0,
      isMajor: !!course.isMajor,
      prerequisites: getCoursePrerequisites(course),
      curriculumId: course.curriculumId || null,
      curriculumName: getCurriculumName(course.curriculumId) || 'Unknown Curriculum',
      yearLevel: targetYear,
      enrolledSemester: enrolledSemester,
      enrolledSchoolYear: isCurrentTerm ? (term.schoolYear || '') : '',
      termMode: addTermMode,
      joinedYearLevel: isCurrentTerm && joinYearLevel ? Number(joinYearLevel) : null,
      joinedBlock: isCurrentTerm && joinBlock ? joinBlock : null
    };

    const next = {
      ...irregularSubjects,
      [semKey]: [...(irregularSubjects[semKey] || []), item]
    };

    setIrregularSubjects(next);
    try {
      await updateDoc(doc(db, 'students', selectedStudent.id), {
        irregularSubjects: next,
        updatedAt: new Date()
      });
      await logSystemAction({
        action: 'Added Irregular Subject',
        module: 'Curriculum Checker',
        entityType: 'student',
        entityId: selectedStudent.id,
        description: `Added irregular subject ${item.courseCode} for student ${selectedStudent.name || selectedStudent.id}`,
        details: { subject: item }
      });
      setSelectedStudent(prev => (prev ? { ...prev, irregularSubjects: next } : prev));
      setSuccess('Subject added to irregular semester load');
      setJoinClassModalOpen(false);
      setJoinClassPendingCourse(null);
      setJoinClassBlock('');
    } catch (err) {
      setError('Failed to add subject: ' + err.message);
    }
  };

  const openSubjectPicker = (semester) => {
    setSubjectPickerSemester(semester);
    const studentCurriculumId = selectedStudent?.curriculumId || '';
    const defaultCurriculumId = curriculums.some((c) => c.id === studentCurriculumId)
      ? studentCurriculumId
      : (curriculums[0]?.id || '');
    setSubjectPickerCurriculumFilter(defaultCurriculumId);
    setSubjectPickerYearFilter(String(courseTab + 1));
    setSubjectPickerSemesterFilter(String(semester));
    // semester filter defaults to the section opened; user can broaden to "all"
    setSubjectPickerSearch('');
    setSubjectPickerSortBy('courseCode');
    setSubjectPickerSortOrder('asc');
    setSubjectPickerJoinYearLevel('');
    setSubjectPickerJoinBlock('');
    setIrregularAddTermMode('previous');
    setSubjectPickerStatusFilter('all');
    setSubjectPickerOpen(true);
  };

  const resolveIrregularPickerRowState = useCallback((course) => {
    const semKey = `sem${subjectPickerSemester}`;
    const pickerTargetYear =
      subjectPickerYearFilter !== 'all'
        ? Number(subjectPickerYearFilter)
        : Number(course.yearLevel) || courseTab + 1;
    const courseCodeNorm = (course.courseCode || '').toString().trim().toUpperCase();
    const alreadyAdded = (irregularSubjects[semKey] || []).some(
      (subject) =>
        (subject.courseCode || '').toString().trim().toUpperCase() === courseCodeNorm &&
        Number(subject.yearLevel || pickerTargetYear) === pickerTargetYear
    );
    const alreadyGraded = studentGrades && Object.keys(studentGrades).some(
      (key) =>
        (key || '').toString().trim().toUpperCase() === courseCodeNorm &&
        studentGrades[key] !== undefined &&
        studentGrades[key] !== ''
    );
    const maxIrregularUnits = getIrregularUnitsLimit();
    const currentPickerUnits = getIrregularUnitsUsed({
      yearLevel: pickerTargetYear,
      semester: subjectPickerSemester
    });
    const exceedsUnitLimit = currentPickerUnits + (parseFloat(course.units) || 0) > maxIrregularUnits;
    const prerequisites = getCoursePrerequisites(course);
    const unmetPrerequisites = getUnmetPrerequisites(prerequisites);
    const prerequisitesNotMet = unmetPrerequisites.length > 0;
    const canAdd = !alreadyGraded && !alreadyAdded && !exceedsUnitLimit && !prerequisitesNotMet;

    let status = 'addable';
    if (alreadyGraded) status = 'graded';
    else if (alreadyAdded) status = 'added';
    else if (prerequisitesNotMet) status = 'blocked';
    else if (exceedsUnitLimit) status = 'limit';

    return {
      alreadyGraded,
      alreadyAdded,
      exceedsUnitLimit,
      prerequisitesNotMet,
      unmetPrerequisites,
      prerequisiteValidationMessage: formatUnmetPrerequisitesMessage(unmetPrerequisites),
      canAdd,
      status,
      currentPickerUnits,
      maxIrregularUnits
    };
  }, [
    subjectPickerSemester,
    subjectPickerYearFilter,
    courseTab,
    irregularSubjects,
    studentGrades,
    academicConfig,
    allCourses,
    getUnmetPrerequisites,
    formatUnmetPrerequisitesMessage
  ]);

  const irregularSubjectPickerRows = useMemo(
    () =>
      getIrregularSubjectCandidates().map((course) => ({
        course,
        rowState: resolveIrregularPickerRowState(course)
      })),
    [
      subjectPickerCurriculumFilter,
      subjectPickerYearFilter,
      subjectPickerSemesterFilter,
      subjectPickerSearch,
      subjectPickerSortBy,
      subjectPickerSortOrder,
      allCourses,
      curriculums,
      selectedStudent,
      resolveIrregularPickerRowState
    ]
  );

  const filteredIrregularSubjectPickerRows = useMemo(() => {
    if (subjectPickerStatusFilter === 'addable') {
      return irregularSubjectPickerRows.filter(({ rowState }) => rowState.canAdd);
    }
    if (subjectPickerStatusFilter === 'blocked') {
      return irregularSubjectPickerRows.filter(
        ({ rowState }) => rowState.status === 'blocked' || rowState.status === 'limit'
      );
    }
    return irregularSubjectPickerRows;
  }, [irregularSubjectPickerRows, subjectPickerStatusFilter]);

  const irregularSubjectPickerStats = useMemo(() => {
    const total = irregularSubjectPickerRows.length;
    const addable = irregularSubjectPickerRows.filter(({ rowState }) => rowState.canAdd).length;
    const blocked = irregularSubjectPickerRows.filter(({ rowState }) => rowState.status === 'blocked').length;
    const added = irregularSubjectPickerRows.filter(({ rowState }) => rowState.status === 'added').length;
    const unitsUsed = getIrregularUnitsUsed({
      yearLevel: courseTab + 1,
      semester: subjectPickerSemester
    });
    const unitsLimit = getIrregularUnitsLimit();
    const unitsScopeLabel = getIrregularUnitsScopeLabel();
    const withEquivalentsInOther = irregularSubjectPickerRows.filter(
      ({ course }) => getEquivalentCoursesFromOtherCurricula(course).length > 0
    ).length;

    return {
      total,
      addable,
      blocked,
      added,
      unitsUsed,
      unitsLimit,
      unitsScopeLabel,
      withEquivalentsInOther
    };
  }, [irregularSubjectPickerRows, subjectPickerSemester, courseTab, irregularSubjects, academicConfig]);

  // Called when user clicks "Add" on a subject row
  const handleRequestAddIrregularSubject = async (course) => {
    if (irregularAddTermMode === 'previous') {
      await handleAddIrregularSubject(subjectPickerSemester, course, null, null, 'previous');
      return;
    }

    setJoinClassPendingCourse(course);
    setJoinClassYearLevel('');
    setJoinClassBlock('');
    setJoinClassModalOpen(true);
  };

  // Called when user confirms the join-class modal
  const handleConfirmJoinClass = async () => {
    if (!joinClassPendingCourse) return;
    const yearLevel = joinClassPendingCourse.yearLevel ? String(joinClassPendingCourse.yearLevel) : '';
    await handleAddIrregularSubject(subjectPickerSemester, joinClassPendingCourse, yearLevel, joinClassBlock, 'current');
    setJoinClassModalOpen(false);
    setJoinClassPendingCourse(null);
    setJoinClassYearLevel('');
    setJoinClassBlock('');
  };

  const handleRemoveIrregularSubject = async (semester, subjectId) => {
    if (!selectedStudent) return;
    const semKey = `sem${semester}`;
    const previous = irregularSubjects[semKey] || [];
    const next = {
      ...irregularSubjects,
      [semKey]: previous.filter(s => s.id !== subjectId)
    };
    setIrregularSubjects(next);
    try {
      await updateDoc(doc(db, 'students', selectedStudent.id), {
        irregularSubjects: next,
        updatedAt: new Date()
      });
      await logSystemAction({
        action: 'Removed Irregular Subject',
        module: 'Curriculum Checker',
        entityType: 'student',
        entityId: selectedStudent.id,
        description: `Removed irregular subject for student ${selectedStudent.name || selectedStudent.id}`,
        details: { semKey, subjectId }
      });
      setSelectedStudent(prev => (prev ? { ...prev, irregularSubjects: next } : prev));
      setSuccess('Subject removed');
    } catch (err) {
      setIrregularSubjects({ ...irregularSubjects, [semKey]: previous });
      setError('Failed to remove subject: ' + err.message);
    }
  };

  const promptRemoveIrregularSubject = (semester, subject) => {
    setIrregularSubjectToDelete({
      semester,
      subjectId: subject.id,
      courseCode: subject.courseCode,
      courseTitle: subject.courseTitle
    });
    setIrregularDeleteDialogOpen(true);
  };

  const handleConfirmIrregularDelete = async () => {
    if (!irregularSubjectToDelete) return;
    await handleRemoveIrregularSubject(irregularSubjectToDelete.semester, irregularSubjectToDelete.subjectId);
    setIrregularDeleteDialogOpen(false);
    setIrregularSubjectToDelete(null);
  };

  // Calculate Dean's Lister eligibility for a semester
  const calculateDeansListerEligibility = (semester, year) => {
    if (!selectedStudent || !studentGrades || !academicConfig) return false;
    const config = normalizeDeanListCriteria(academicConfig.deanList || {});

    const semesterCourses = studentCourses.filter(course => course.yearLevel === year && course.semester === semester);

    const graded = semesterCourses.map(course => ({
      course,
      grade: studentGrades[course.courseCode]
    })).filter(x => x.grade !== undefined && x.grade !== null && x.grade !== '' && x.grade !== 'INC' && x.grade !== 'CRED');

    if (graded.length === 0) return false;

    const evaluation = evaluateDeanListEligibility({
      entries: graded.map(item => ({
        grade: item.grade,
        units: item.course.units,
        isMajor: !!item.course.isMajor
      })),
      criteria: config,
      isIrregular: !!selectedStudent.isIrregular
    });

    return evaluation.eligible;
  };

  // Helper: check scholarship tier eligibility given a tier config and graded courses
  const checkScholarshipTier = (tierConfig, graded, totalUnits) => {
    if (!tierConfig) return false;
    const computation = tierConfig.computation || academicConfig?.scholarship?.computation || 'weighted';
    const gwaCutoff = parseFloat(tierConfig.gwa ?? 1.7);
    const majorCutoff = parseFloat(tierConfig.major ?? 1.7);
    const minorCutoff = parseFloat(tierConfig.minor ?? 2.0);
    const minUnits = Number(tierConfig.minUnits || 0);
    const applyMinFor = tierConfig.applyMinUnitsFor || 'both';

    if (minUnits > 0) {
      if (applyMinFor === 'regular' && selectedStudent.isIrregular) return false;
      if (applyMinFor === 'irregular' && !selectedStudent.isIrregular) return false;
      if (totalUnits < minUnits) return false;
    }

    let gwa = 0;
    if (computation === 'weighted') {
      const num = graded.reduce((s, g) => s + (parseFloat(g.grade) * (Number(g.course.units) || 0)), 0);
      const denom = graded.reduce((s, g) => s + (Number(g.course.units) || 0), 0) || graded.length;
      gwa = denom === 0 ? 0 : num / denom;
    } else {
      const sum = graded.reduce((s, g) => s + parseFloat(g.grade), 0);
      gwa = sum / graded.length;
    }

    if (isNaN(gwa) || gwa > gwaCutoff) return false;

    const majorBad = graded.some(g => g.course.isMajor && parseFloat(g.grade) > majorCutoff);
    const minorBad = graded.some(g => !g.course.isMajor && parseFloat(g.grade) > minorCutoff);
    return !majorBad && !minorBad;
  };

  // Calculate Scholarship eligibility — returns { eligible, percentage } based on two tiers
  const calculateScholarshipEligibility = (year) => {
    if (!selectedStudent || !studentGrades || !academicConfig) return { eligible: false, percentage: 0 };

    const yearCourses = studentCourses.filter(course => course.yearLevel === year);
    const graded = yearCourses.map(course => ({ course, grade: studentGrades[course.courseCode] }))
      .filter(x => x.grade !== undefined && x.grade !== null && x.grade !== '' && x.grade !== 'INC' && x.grade !== 'CRED');

    if (graded.length === 0) return { eligible: false, percentage: 0 };

    const totalUnits = graded.reduce((s, g) => s + (Number(g.course.units) || 0), 0);

    // Check 100% tier first (higher standard), then 50%
    const tier100Config = academicConfig?.scholarship?.tier100 || null;
    const tier50Config = academicConfig?.scholarship?.tier50 || null;

    if (tier100Config && checkScholarshipTier(tier100Config, graded, totalUnits)) {
      return { eligible: true, percentage: 100 };
    }
    if (tier50Config && checkScholarshipTier(tier50Config, graded, totalUnits)) {
      return { eligible: true, percentage: 50 };
    }
    return { eligible: false, percentage: 0 };
  };

  // Track whether there are unsaved grade changes
  const [gradesDirty, setGradesDirty] = useState(false);
  const [gradesSaving, setGradesSaving] = useState(false);

  // Handle grade input change — only updates local state, does NOT save to DB
  const handleGradeChange = (courseCode, grade) => {
    setEditingGrades(prev => ({ ...prev, [courseCode]: grade }));
    setGradesDirty(true);
  };

  // Save all pending grade changes to DB at once
  const handleSaveAllGrades = async () => {
    if (!selectedStudent || gradesSaving) return;
    setGradesSaving(true);
    try {
      const studentRef = doc(db, 'students', selectedStudent.id);

      // Build the final grades map — remove keys with empty value
      const updatedGrades = { ...editingGrades };
      Object.keys(updatedGrades).forEach(k => {
        if (updatedGrades[k] === '' || updatedGrades[k] === undefined) {
          delete updatedGrades[k];
        }
      });

      await updateDoc(studentRef, { grades: updatedGrades, updatedAt: new Date() });

      await logSystemAction({
        action: 'Updated Student Grades',
        module: 'Curriculum Checker',
        entityType: 'student',
        entityId: selectedStudent.id,
        description: `Saved all grades for student ${selectedStudent.name || selectedStudent.id}`,
        details: { grades: updatedGrades }
      });

      // Sync completion status for every graded course
      const allCourseCodes = [
        ...studentCourses.map(c => c.courseCode),
        ...Object.keys(irregularSubjects.sem1 || {}).map(s => irregularSubjects.sem1[s]?.courseCode),
        ...Object.keys(irregularSubjects.sem2 || {}).map(s => irregularSubjects.sem2[s]?.courseCode),
      ].filter(Boolean);

      const uniqueCodes = [...new Set([...Object.keys(updatedGrades), ...allCourseCodes])];
      await Promise.all(uniqueCodes.map(code => {
        const grade = updatedGrades[code];
        const isCompleted = grade && grade !== '' && grade !== '5.0' && grade !== 'INC';
        return handleUpdateStudentCourse(code, !!isCompleted);
      }));

      setStudentGrades(updatedGrades);
      setEditingGrades(updatedGrades);
      setGradesDirty(false);
      toast.success('Grades saved successfully!');
    } catch (error) {
      toast.error('Failed to save grades: ' + error.message);
    }
    setGradesSaving(false);
  };



  // Load student grades
  const loadStudentGrades = async (studentId) => {
    if (!studentId) return;
    
    try {
      const studentRef = doc(db, 'students', studentId);
      const studentDoc = await getDoc(studentRef);
      if (studentDoc.exists()) {
        const grades = studentDoc.data().grades || {};
        setStudentGrades(grades);
        setEditingGrades(grades);
      }
    } catch (error) {
      console.error('Error loading grades:', error);
    }
  };


  const renderStudentList = () => (
    <div>
      {/* Breadcrumb is rendered at the top-level App; child emits events */}

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => openStatusModal('all')}
          className="rounded-lg border cursor-pointer border-gray-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/30 transition"
        >
          <span className="block text-xs text-gray-600">All</span>
          <span className="mt-1 block text-lg font-semibold text-gray-900">{students.length}</span>
        </button>
        <button
          type="button"
          onClick={() => openStatusModal('enrolled')}
          className="rounded-lg border cursor-pointer border-gray-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/30 transition"
        >
          <span className="block text-xs text-gray-600">Enrolled</span>
          <span className="mt-1 block text-lg font-semibold text-gray-900">{statusCounts.enrolled || 0}</span>
        </button>
        <button
          type="button"
          onClick={() => openStatusModal('active')}
          className="rounded-lg border cursor-pointer border-gray-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/30 transition"
        >
          <span className="block text-xs text-gray-600">Active</span>
          <span className="mt-1 block text-lg font-semibold text-gray-900">{statusCounts.active || 0}</span>
        </button>
        <button
          type="button"
          onClick={() => openStatusModal('inactive')}
          className="rounded-lg border cursor-pointer border-gray-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/30 transition"
        >
          <span className="block text-xs text-gray-600">Inactive</span>
          <span className="mt-1 block text-lg font-semibold text-gray-900">{statusCounts.inactive || 0}</span>
        </button>
        <button
          type="button"
          onClick={() => openStatusModal('not-enrolled')}
          className="rounded-lg border cursor-pointer border-gray-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/30 transition"
        >
          <span className="block text-xs text-gray-600">Not enrolled</span>
          <span className="mt-1 block text-lg font-semibold text-gray-900">{statusCounts['not-enrolled'] || 0}</span>
        </button>
      </div>

      <div className="flex items-center justify-end gap-2 mb-4">
        {currentUser && currentUser.isAdmin && (
          <button
            type="button"
            onClick={() => setAcademicModalOpen(true)}
            className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            Academic Configuration
          </button>
        )}
      </div>

      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setStatusModalOpen(false)}></div>
          <div className="relative z-10 w-full max-w-6xl rounded-xl border border-gray-300 bg-white shadow-lg h-[80vh] overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{STATUS_CARD_META[statusModalType]?.label || 'Students'}</h3>
                <p className="text-sm text-gray-500">{STATUS_CARD_META[statusModalType]?.count || 0} student(s)</p>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="rounded-full p-1.5 cursor-pointer text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 pt-4">
  <div className="flex flex-wrap gap-1.5">
                {STUDENT_MODAL_YEAR_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusModalYearTab(tab.key)}
              className={`rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
                      statusModalYearTab === tab.key
                       ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
                    }`}
                  >
                    {tab.label}
                    <span 
                      className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${
                        statusModalYearTab === tab.key 
                          ? 'bg-blue-100 text-blue-500' 
                          : 'bg-slate-100 text-slate-600'
                        }
                      `}
                    >
                      {statusModalTabCounts[tab.key] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 overflow-auto max-h-[65vh]">
              {statusFilteredStudents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
                  No students found for this tab.
                </div>
              ) : (
                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead className="bg-blue-500 text-white sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left w-[5%]">No.</th>
                        <th className="px-4 py-2 text-left w-[5%]">
                          <button type="button" onClick={() => handleStatusModalSort('block')} className="inline-flex items-center gap-1">
                            Block
                            <StatusSortIcon column="block" />
                          </button>
                        </th>
                        <th className="px-4 py-2 text-left w-[15%]">
                          <button type="button" onClick={() => handleStatusModalSort('studentNumber')} className="inline-flex items-center gap-1">
                            Student No.
                            <StatusSortIcon column="studentNumber" />
                          </button>
                        </th>
                        <th className="px-4 py-2 text-left w-[25%]">
                          <button type="button" onClick={() => handleStatusModalSort('surname')} className="inline-flex items-center gap-1">
                            Name
                            <StatusSortIcon column="surname" />
                          </button>
                        </th>
                        <th className="px-4 py-2 text-left w-[25%]">
                          <button type="button" onClick={() => handleStatusModalSort('email')} className="inline-flex items-center gap-1">
                            Email
                            <StatusSortIcon column="email" />
                          </button>
                        </th>
                        <th className="px-4 py-2 text-left w-[25%]">
                          <button type="button" onClick={() => handleStatusModalSort('contactNumber')} className="inline-flex items-center gap-1">
                            Contact No.
                            <StatusSortIcon column="contactNumber" />
                          </button>
                        </th>
                       
                      </tr>
                    </thead>
                    <tbody>
                      {statusFilteredStudents.map((student, idx) => (
                        <tr key={student.id} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-2">{idx + 1}</td>
                          <td className="px-4 py-2">{student.isIrregular ? 'Irregular' : getBlockKey(student)}</td>
                          <td className="px-4 py-2">{student.studentNumber || ''}</td>
                          <td className="px-4 py-2">{student.name || ''}</td>
                          <td className="px-4 py-2">{student.email || ''}</td>
                          <td className="px-4 py-2">{student.contactNumber || ''}</td>
                         
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {academicModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setAcademicModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-300 bg-white shadow-lg overflow-hidden flex flex-col" style={{height: '90vh', maxHeight: '680px'}}>
            <div className="flex items-center justify-between px-8 py-4 border-b border-slate-300 shrink-0">
              <h3 className="text-xl font-medium text-slate-800">Academic Configuration</h3>
            </div>

            <div className="px-6 py-4 flex flex-col flex-1 min-h-0">
              <div className="flex gap-2 justify-between w-full mb-4 items-center rounded-xl border border-slate-200 bg-slate-100 p-1 shrink-0">
                <button 
                  onClick={() => setAcademicActiveTab(0)} 
                  className={`flex-1 rounded-lg px-4 py-1 text-sm font-medium transition-all ${
                    academicActiveTab===0
                      ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer'
                    }`}
                    >
                      Dean's List 
                    </button>
                <button 
                  onClick={() => { setAcademicActiveTab(1); setScholarshipTierTab(0); }} 
                  className={`flex-1 rounded-lg px-4 py-1 text-sm font-medium transition-all ${
                    academicActiveTab===1
                      ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer'
                      }`}
                    >
                      Scholarship 
                    </button>
                <button 
                  onClick={() => setAcademicActiveTab(2)} 
                  className={`flex-1 rounded-lg px-4 py-1 text-sm font-medium transition-all ${
                    academicActiveTab===2
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer'
                    }`}
                >
                      Units Limit 
                </button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
                {academicActiveTab === 0 && (
                  <div className="flex flex-col gap-3">
                 
                    <div className="">
                     
                      <DeanListCriteriaFields
                        criteria={academicConfig?.deanList || {}}
                        onChange={(nextCriteria) => setAcademicConfig(prev => ({
                          ...prev,
                          deanList: normalizeDeanListCriteria(nextCriteria)
                        }))}
                      />
                    </div>
                  </div>
                )}

                {academicActiveTab === 1 && (
                  <div className="flex flex-col gap-0">

                 

                      {/* ── Divider ── */}
                    <div className="flex items-center gap-3 mt-2 mb-4">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">100% Scholarship</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    {/* ── 100% Scholarship ── */}
                    <div className="flex flex-col gap-2">
                      
                    
                     <div className="flex items-center gap-2">
                       <div>
                        <label className="block text-xs text-gray-700 mb-1">Major cutoff</label>
                        <input type="number" step="0.01" value={academicConfig?.scholarship?.tier100?.major ?? ''} onChange={(e)=> setAcademicConfig(prev=> ({...prev, scholarship:{...prev.scholarship, tier100:{...(prev.scholarship?.tier100||{}), major: e.target.value}}}))} className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Minor cutoff</label>
                        <input type="number" step="0.01" value={academicConfig?.scholarship?.tier100?.minor ?? ''} onChange={(e)=> setAcademicConfig(prev=> ({...prev, scholarship:{...prev.scholarship, tier100:{...(prev.scholarship?.tier100||{}), minor: e.target.value}}}))} className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow" />
                      </div>
                      </div>
                        <div>
                        <label className="block text-xs text-gray-700 mb-1">GWA cutoff</label>
                        <input type="number" step="0.01" value={academicConfig?.scholarship?.tier100?.gwa ?? ''} onChange={(e)=> setAcademicConfig(prev=> ({...prev, scholarship:{...prev.scholarship, tier100:{...(prev.scholarship?.tier100||{}), gwa: e.target.value}}}))} className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Minimum units</label>
                        <input type="number" value={academicConfig?.scholarship?.tier100?.minUnits ?? ''} onChange={(e)=> setAcademicConfig(prev=> ({...prev, scholarship:{...prev.scholarship, tier100:{...(prev.scholarship?.tier100||{}), minUnits: e.target.value}}}))} className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Apply minimum units for</label>
                        <select value={academicConfig?.scholarship?.tier100?.applyMinUnitsFor || 'both'} onChange={(e)=> setAcademicConfig(prev=> ({...prev, scholarship:{...prev.scholarship, tier100:{...(prev.scholarship?.tier100||{}), applyMinUnitsFor: e.target.value}}}))} className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow">
                          <option value="regular">Regular students only</option>
                          <option value="irregular">Irregular students only</option>
                          <option value="both">Both</option>
                        </select>
                      </div>
                     <div className="flex items-center gap-4 mt-1">
                        <label className="text-sm whitespace-nowrap">Computation method</label>

                        <div className="flex items-center gap-3">
                          <label className="inline-flex text-sm items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="scholar100Comp"
                              checked={(academicConfig?.scholarship?.tier100?.computation || 'weighted') === 'weighted'}
                              onChange={() =>
                                setAcademicConfig(prev => ({
                                  ...prev,
                                  scholarship: {
                                    ...prev.scholarship,
                                    tier100: {
                                      ...(prev.scholarship?.tier100 || {}),
                                      computation: 'weighted'
                                    }
                                  }
                                }))
                              }
                            />
                            Weighted
                          </label>

                          <label className="inline-flex text-sm items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="scholar100Comp"
                              checked={(academicConfig?.scholarship?.tier100?.computation || 'weighted') === 'simple'}
                              onChange={() =>
                                setAcademicConfig(prev => ({
                                  ...prev,
                                  scholarship: {
                                    ...prev.scholarship,
                                    tier100: {
                                      ...(prev.scholarship?.tier100 || {}),
                                      computation: 'simple'
                                    }
                                  }
                                }))
                              }
                            />
                            Simple
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* ── Divider ── */}
                    <div className="flex items-center gap-3 mb-4 mt-6">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">50% Scholarship</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    {/* ── 50% Scholarship ── */}
                    <div className="flex flex-col gap-2">
                      
                    
                  <div className="flex items-center gap-2">
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Major cutoff</label>
                        <input type="number" step="0.01" value={academicConfig?.scholarship?.tier50?.major ?? ''} onChange={(e)=> setAcademicConfig(prev=> ({...prev, scholarship:{...prev.scholarship, tier50:{...(prev.scholarship?.tier50||{}), major: e.target.value}}}))} className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-500 transition-shadow" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Minor cutoff</label>
                        <input type="number" step="0.01" value={academicConfig?.scholarship?.tier50?.minor ?? ''} onChange={(e)=> setAcademicConfig(prev=> ({...prev, scholarship:{...prev.scholarship, tier50:{...(prev.scholarship?.tier50||{}), minor: e.target.value}}}))} className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-500 transition-shadow" />
                      </div>
                      </div>
                        <div>
                        <label className="block text-xs text-gray-700 mb-1">GWA cutoff</label>
                        <input type="number" step="0.01" value={academicConfig?.scholarship?.tier50?.gwa ?? ''} onChange={(e)=> setAcademicConfig(prev=> ({...prev, scholarship:{...prev.scholarship, tier50:{...(prev.scholarship?.tier50||{}), gwa: e.target.value}}}))} className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-500 transition-shadow" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Minimum units</label>
                        <input type="number" value={academicConfig?.scholarship?.tier50?.minUnits ?? ''} onChange={(e)=> setAcademicConfig(prev=> ({...prev, scholarship:{...prev.scholarship, tier50:{...(prev.scholarship?.tier50||{}), minUnits: e.target.value}}}))} className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-500 transition-shadow" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Apply minimum units for</label>
                        <select value={academicConfig?.scholarship?.tier50?.applyMinUnitsFor || 'both'} onChange={(e)=> setAcademicConfig(prev=> ({...prev, scholarship:{...prev.scholarship, tier50:{...(prev.scholarship?.tier50||{}), applyMinUnitsFor: e.target.value}}}))} className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-500 transition-shadow">
                          <option value="regular">Regular students only</option>
                          <option value="irregular">Irregular students only</option>
                          <option value="both">Both</option>
                        </select>
                      </div>
                     <div className="flex items-center gap-4 mt-1">
                      <label className="text-sm whitespace-nowrap">Computation Method:</label>

                      <div className="flex items-center gap-3">
                        <label className="inline-flex text-sm items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="scholar50Comp"
                            checked={(academicConfig?.scholarship?.tier50?.computation || 'weighted') === 'weighted'}
                            onChange={() =>
                              setAcademicConfig(prev => ({
                                ...prev,
                                scholarship: {
                                  ...prev.scholarship,
                                  tier50: {
                                    ...(prev.scholarship?.tier50 || {}),
                                    computation: 'weighted'
                                  }
                                }
                              }))
                            }
                          />
                          Weighted
                        </label>

                        <label className="inline-flex text-sm items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="scholar50Comp"
                            checked={(academicConfig?.scholarship?.tier50?.computation || 'weighted') === 'simple'}
                            onChange={() =>
                              setAcademicConfig(prev => ({
                                ...prev,
                                scholarship: {
                                  ...prev.scholarship,
                                  tier50: {
                                    ...(prev.scholarship?.tier50 || {}),
                                    computation: 'simple'
                                  }
                                }
                              }))
                            }
                          />
                          Simple
                        </label>
                      </div>
                    </div>
                    </div>

                       <div className="mt-2 text-xs border border-blue-300 bg-blue-50 text-slate-500 rounded-md px-4 py-2">
                      Weighted: (sum of grade × units) / total units <br/> Simple: sum of grades / number of subjects
                    </div>
                    
                  </div>
                )}

                {academicActiveTab === 2 && (
                  <div>
                    {/* Units limits */}
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="text-sm">Regular Students max units</label>
                        <input 
                          type="number" 
                          value={academicConfig?.unitsLimits?.default?.regular || 18} 
                          onChange={(e)=> setAcademicConfig(prev=> ({...prev, unitsLimits:{...prev.unitsLimits, default:{...prev.unitsLimits.default, regular: Number(e.target.value)}}}))} 
                            className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                          />
                          <p className="mt-1 text-xs text-slate-500">This is the default max units for regular students. </p>
                      </div>
                      <div>
                          <label className="text-sm">Default Irregular max units</label>
                        <input 
                          type="number" 
                          value={academicConfig?.unitsLimits?.default?.irregular || 15} 
                          onChange={(e)=> setAcademicConfig(prev=> ({...prev, unitsLimits:{...prev.unitsLimits, default:{...prev.unitsLimits.default, irregular: Number(e.target.value)}}}))} 
                          className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          Maximum units irregular students may take within the selected scope below.
                        </p>
                      </div>
                      <div>
                        <label className="text-sm">Irregular unit limit applies</label>
                        <select
                          value={academicConfig?.unitsLimits?.default?.irregularScope || 'semester'}
                          onChange={(e) =>
                            setAcademicConfig((prev) => ({
                              ...prev,
                              unitsLimits: {
                                ...prev.unitsLimits,
                                default: {
                                  ...prev.unitsLimits.default,
                                  irregularScope: e.target.value
                                }
                              }
                            }))
                          }
                          className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                          <option value="semester">Per semester (within each year level)</option>
                          <option value="year">Per year (all semesters in that year combined)</option>
                        </select>
                        <p className="mt-1 text-xs text-slate-500">
                          Per semester counts units only in the same year and semester. Per year counts all semesters in that year level together.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                <button 
                  onClick={() => setAcademicModalOpen(false)} 
                  className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => { const res = await saveAcademicConfig(academicConfig||{}); if (res.success) { toast.success('Saved'); setAcademicModalOpen(false); } else { toast.error(res.error || 'Failed to save'); } }} 
                  className="px-4 py-1.5 w-24 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedFolder && (
        <div className="mb-4 flex items-center justify-between gap-4">
          
            <p className="font-medium text-gray-700">Students Folders</p>
          <p className="mt-1 text-sm text-gray-800">
            {term.semester ? SEMESTER_LABELS[term.semester] || `Sem ${term.semester}` : 'No semester'} · {term.schoolYear || 'No school year'}
          </p>
        </div>
      )}

     <div className='flex-1 flex justify-between items-center  gap-4 mb-'>
   
      
          {/* Archive & Promote Modal */}
          {archiveModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
              <div className="bg-white rounded-xl p-6 shadow-xl max-w-md w-full">
                <h2 className="text-lg font-bold mb-2">Archive & Promote Students</h2>
                <p className="mb-4">This will archive all 4th year students and promote others. Continue?</p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setArchiveModalOpen(false)}
                    className="px-4 py-2 bg-gray-200 rounded"
                    disabled={archiveLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setArchiveLoading(true);
                      const now = new Date();
                      const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
                      const endYear = startYear + 1;
                      const result = await archiveAndPromoteStudents(startYear, endYear);
                      setArchiveLoading(false);
                      setArchiveModalOpen(false);
                      if (result.success) {
                        setSuccess(result.message);
                        // Reload students after archiving
                        loadStudents();
                      } else {
                        setError(result.message);
                      }
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                    disabled={archiveLoading}
                  >
                    {archiveLoading ? 'Processing...' : 'Continue'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {alertOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => setAlertOpen(false)}></div>
              <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-xl shadow p-6">
                <div className="text-lg font-semibold mb-2">Notice</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{alertMessage}</div>
                <div className="flex justify-end mt-4">
                  <button onClick={() => setAlertOpen(false)} className="px-4 py-2 rounded bg-blue-600 text-white">OK</button>
                </div>
              </div>
            </div>
          )}
     </div>


       

          {/* Archive Selected Modal */}
          {archiveSelectedModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setArchiveSelectedModalOpen(false)}></div>
              <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-xl shadow p-8">
                <div className="text-xl font-semibold mb-2">Archive  Students</div>
                <p className=" text-gray-70 mb-4 text-justify">Choose an existing folder or create a new one to group the selected students.</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Existing folders</label>
                    <select 
                      className="w-full border cursor-pointer text-sm border-slate-200 pr-12 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                      value={selectedArchiveFolder} 
                      onChange={e => setSelectedArchiveFolder(e.target.value)} 
                      onClick={fetchArchiveFolders}
                    >
                      <option value="" hidden diasbled>Choose Folder</option>
                      {archiveFolders.map(f => (
                        <option key={f.id} value={f.id}>{f.id}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Or create new folder</label>
                    <input 
                      value={newArchiveFolderName} 
                      onChange={e => setNewArchiveFolderName(e.target.value)} 
                      placeholder="Enter folder name" 
                      className="w-full border text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-8">
                  <button 
                    onClick={() => setArchiveSelectedModalOpen(false)} 
                    className="px-4 py-2 cursor-pointer rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50">Cancel</button>
                  <button
                    onClick={async () => {
                      const folder = newArchiveFolderName.trim() || selectedArchiveFolder;
                      if (!folder) {
                        setAlertMessage('Please select or enter a folder name');
                        setAlertOpen(true);
                        return;
                      }
                      await archiveSelectedStudentsToFolder(folder);
                    }}
                    disabled={archiving}
                    className="px-4 py-2 w-28 cursor-pointer rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {archiving ? 'Archiving...' : 'Archive'}
                  </button>
                </div>
              </div>
            </div>
          )}
          

    
      {/* Multi-edit Year Modal */}
      {multiEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setMultiEditOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-xl shadow p-8">
            <div className="text-lg mb-2 font-medium">
              {multiEditIsIrregular ? 'Update Year Level' : 'Update Year Level and Blocks'}
            </div>
            
             {/* Info / Warning */}
              <div className=" mb-4 text-gray-700 text-justify">
                {multiEditIsIrregular
                  ? 'Updating the year level will affect all selected students.'
                  : 'Updating the year level and block will affect all selected students.'}
              </div>
             

            <div className={`flex flex-col gap-3 ${!multiEditIsIrregular ? 'sm:flex-row' : ''}`}>
              <div className={multiEditIsIrregular ? 'w-full' : 'sm:w-2/3'}>
                <label className="block text-sm text-gray-600 mb-1">Year Level</label>
                <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-100 p-1">
                  {[1, 2, 3, 4].map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setMultiEditYear(y)}
                      className={`flex-1 rounded-md px-2 py-2 text-sm font-medium transition ${
                        Number(multiEditYear) === y
                          ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {y === 1 ? '1st' : y === 2 ? '2nd' : y === 3 ? '3rd' : '4th'} Year
                    </button>
                  ))}
                </div>
              </div>

           

              {!multiEditIsIrregular && (
                <div className="sm:w-1/3">
                  <label className="block text-sm text-gray-600 mb-1">Block</label>
                  <select
                      className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                    value={multiEditBlock}
                    onChange={(e) => setMultiEditBlock(e.target.value)}
                  >
                    {['A', 'B', 'C', 'D', 'E'].map((block) => (
                      <option key={block} value={block}>{block}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

               <div className="flex mt-4 items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-gray-700">Irregular Student</div>
                  <div className="text-xs text-gray-500">
                    {multiEditIsIrregular ? 'Selected students are marked irregular.' : 'Selected students will have a block assigned.'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={multiEditIsIrregular}
                  onClick={() => setMultiEditIsIrregular(prev => !prev)}
                  className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition ${
                    multiEditIsIrregular ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
                      multiEditIsIrregular ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

           

            <div className="mt-8 flex justify-end gap-2">
              <button 
                onClick={() => setMultiEditOpen(false)} 
                className="px-4 py-2 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleMultiEditSave} 
                disabled={loading} 
                className="px-4 py-2 rounded-lg w-28 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-delete Confirmation Modal */}
      {multiDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setMultiDeleteOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-xl shadow p-8">
            <div className="text-xl font-semibold mb-4">Confirm Delete</div>
            <div className="text-gray-700 mb-8">
              Are you sure you want to delete the selected students? This action cannot be undone.
            </div>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setMultiDeleteOpen(false)} 
                className="px-4 py-2 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmMultiDelete}
                 disabled={loading} 
                className="px-4 py-2 rounded-lg w-28 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
            </div>
          </div>
        </div>
      )}

      <div className="">
        {(() => {
          let filteredStudents;
          const activeStudents = students.filter(s => s.active !== false);
          const inactiveStudents = students.filter(s => s.active === false);

          // Show active students in the main folder grid; inactive students become a dedicated folder.
          filteredStudents = activeStudents;

          if (searchTerm) {
            filteredStudents = filteredStudents.filter(
              (student) =>
                student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                getCurriculumName(student.curriculumId).toLowerCase().includes(searchTerm.toLowerCase())
            );
          }

          // Create a sorted copy of filtered students for table display
          let sortedStudents = filteredStudents.slice().sort((a, b) => {
            let aValue = '';
            let bValue = '';
            switch (sortBy) {
              case 'studentNumber':
                aValue = a.studentNumber || '';
                bValue = b.studentNumber || '';
                return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
              case 'name':
                aValue = a.name || '';
                bValue = b.name || '';
                return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
              case 'email':
                aValue = a.email || '';
                bValue = b.email || '';
                return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
              case 'contactNumber':
                aValue = a.contactNumber || '';
                bValue = b.contactNumber || '';
                return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
              case 'curriculum':
                aValue = getCurriculumName(a.curriculumId) || '';
                bValue = getCurriculumName(b.curriculumId) || '';
                return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
              default:
                return 0;
            }
          });

  // Build folder groups from the currently filtered active students, plus an inactive folder when needed.
  const buildFolders = () => {
    const map = new Map();
    filteredStudents.forEach(s => {
      const isIrr = !!s.isIrregular;
      const block = isIrr ? '' : (s && s.block && String(s.block).trim() !== '' ? String(s.block).trim() : 'A');
      const yearForFolder = s.yearLevel;
      const yearKey = isIrr ? 'Irregular' : String(yearForFolder);
      const key = isIrr ? yearKey : `${yearKey}||${block}`;
      if (!map.has(key)) {
        const yearNum = isIrr ? null : Number(yearForFolder);
        const label = isIrr ? 'Irregular Students' : `${getYearLabel(yearNum)} Year Block ${block}`;
        map.set(key, { year: yearNum, isIrregular: isIrr, block: isIrr ? null : block, students: [], label });
      }
      map.get(key).students.push(s);
    });
    map.set('__inactive__', {
      year: null,
      block: null,
      isIrregular: false,
      isInactiveFolder: true,
      students: inactiveStudents,
      label: 'Inactive Students'
    });
    // Ensure we still show a default 1st Year Block A folder even if empty
   

    // Sort: years 1..4 (ascending), then Irregular, then Archived.
    return Array.from(map.values()).sort((a, b) => {
      const getRank = (folder) => {
        if (folder.isInactiveFolder) return 101;
        if (folder.isIrregular) return 100;
        return Number(folder.year || 0);
      };

      const rankDiff = getRank(a) - getRank(b);
      if (rankDiff !== 0) return rankDiff;

      // Both non-irregular: sort by year then block
      if (!a.isIrregular && !b.isIrregular && !a.isInactiveFolder && !b.isInactiveFolder) {
        if ((a.year || 0) !== (b.year || 0)) return (a.year || 0) - (b.year || 0);
        return (a.block || '').localeCompare(b.block || '');
      }

      // Irregular folder is a single bucket
      return 0;
    });
  };

  const folders = buildFolders();
  
  // Always render folders view when not inside a selected folder
  if (!selectedFolder) {
    return (
      <>
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <FolderSkeleton key={`student-folder-skeleton-${index}`} />
            ))}
          </div>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Folder className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">No students yet</h2>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Students will appear here once they are added to a folder.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 ">
            {folders.map((f) => (
              <div
                key={`${f.isIrregular ? 'irr' : f.year}-${f.isIrregular ? 'all' : f.block}`}
                className={`p-4 border rounded-lg bg-white hover:shadow-lg transition-all duration-200 cursor-pointer ${
                  f.isInactiveFolder
                    ? 'border-rose-200 hover:border-rose-400'
                    : 'border-gray-200 hover:border-blue-400'
                }`}
                onClick={() => setSelectedFolder({ year: f.year, block: f.block, isIrregular: f.isIrregular, isInactiveFolder: !!f.isInactiveFolder })}
              >
                <div className="flex  items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    f.isInactiveFolder ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    <Folder className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="w-full">
                      <div className={`text-sm font-medium ${f.isInactiveFolder ? 'text-rose-700' : 'text-gray-800'}`}>
                        {f.label}
                      </div>
                      <div className={`text-xs ${f.isInactiveFolder ? 'text-rose-500' : 'text-gray-500'}`}>
                        {f.students.length} student{f.students.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // If we have a selected folder, compute the students for that folder
  let folderStudents = null;
  if (selectedFolder) {
    const blockKey = selectedFolder.block || 'A';
    const folderSource = selectedFolder.isInactiveFolder ? inactiveStudents : filteredStudents;
    folderStudents = folderSource.filter(s => {
      const override = displayOverrides && displayOverrides[s.id] ? displayOverrides[s.id] : null;
      const sBlock = selectedFolder.isIrregular
        ? ''
        : (override?.block ?? (s.block && String(s.block).trim() !== '' ? String(s.block).trim() : 'A'));
      const sYear = selectedFolder.isInactiveFolder ? (override?.inactiveYear ?? s.inactiveYear ?? s.yearLevel) : (override?.year ?? s.yearLevel);
      if (selectedFolder.isInactiveFolder) {
        return s.active === false;
      }
      if (selectedFolder.isIrregular) {
        return s.isIrregular;
      }
      return !s.isIrregular && sYear === selectedFolder.year && sBlock === blockKey;
    });
  }

  // If a folder is selected, sort the students for that folder
  if (selectedFolder) {
    sortedStudents = (folderStudents || []).slice().sort((a, b) => {
      let aValue = '';
      let bValue = '';
      switch (sortBy) {
        case 'studentNumber':
          aValue = a.studentNumber || '';
          bValue = b.studentNumber || '';
          return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        case 'email':
          aValue = a.email || '';
          bValue = b.email || '';
          return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        case 'contactNumber':
          aValue = a.contactNumber || '';
          bValue = b.contactNumber || '';
          return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        case 'curriculum':
          aValue = getCurriculumName(a.curriculumId) || '';
          bValue = getCurriculumName(b.curriculumId) || '';
          return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        default:
          return 0;
      }
    });
  }

  // Show table with students from selected folder
  return (
            <>
            {selectedFolder && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      loadStudents();
                    }}
                    disabled={loading}
                    style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
                    title="Reload"
                    aria-label="Reload"
                  >
                    <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>

                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      className="w-full border text-sm border-slate-200 bg-white rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                      placeholder="Search student name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                
                
                <div className="flex items-center justify-end gap-2">
                  

                  <div className="flex items-center gap-1">
                    {/* Select mode toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        const next = !selectMode;
                        setSelectMode(next);
                        if (!next) setSelectedIds([]);
                      }}
                      title={selectMode ? 'Turn off selection' : 'Select students'}
                      className={`inline-flex items-center gap-2 rounded-lg border border-gray-300 p-2 text-sm transition cursor-pointer
                    ${
                      selectMode
                        ? 'bg-blue-50 text-blue-600 border-blue-300'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                    >
                      <div className="flex items-center gap-2">
                        <Square className="w-4 h-4" />
                        <span className="text-xs">Select</span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        const first = students.find(s => s.id === selectedIds[0]);

                        setMultiEditYear(first ? first.yearLevel : 1);
                        setMultiEditIsIrregular(first ? !!first.isIrregular : false);

                        setMultiEditBlock(
                          first && !first.isIrregular && first.block
                            ? String(first.block).trim().toUpperCase()
                            : 'A'
                        );

                        setMultiEditOpen(true);
                      }}
                      disabled={selectedIds.length === 0}
                      className={`p-2 rounded-xl transition ${
                        selectedIds.length === 0
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
                      }`}
                      title="Edit year level of selected students"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setMultiDeleteOpen(true)}
                      disabled={selectedIds.length === 0}
                      className={`p-2 rounded-xl transition ${
                        selectedIds.length === 0
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
                      }`}
                      title="Delete selected students"
                    >
                      <Trash className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setArchiveSelectedModalOpen(true)}
                      disabled={
                        selectedIds.length === 0 ||
                        !selectedIds.every(
                          id => ((students.find(s => s.id === id) || {}).yearLevel === 4)
                        )
                      }
                      className={`p-2 rounded-xl transition ${
                        selectedIds.length === 0 ||
                        !selectedIds.every(
                          id => ((students.find(s => s.id === id) || {}).yearLevel === 4)
                        )
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
                      }`}
                      title="Archive selected students"
                    >
                      <FolderArchive className="w-4 h-4" />
                    </button>

                    {selectedIds.length > 0 && (
                    <div className="text-xs ml-2 text-gray-700 whitespace-nowrap">
                      {selectedIds.length} selected
                    </div>
                  )}

                  </div>
                </div>

                
              </div>
            )}


              {/* Reactivate modal: choose year & block when re-activating an inactive student */}
              {reactivateModalOpen && reactivateTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-white rounded-xl p-8 max-w-md">
                    <h3 className="text-xl font-medium mb-4">Reactivate student</h3>
                    <div className="text-sm text-gray-800 mb-4">
                        Reactivating <strong>{reactivateTarget.name}</strong>. Choose new year level and block before reactivating.
                      </div>
                    <div className="flex gap-2 mb-3 items-center">
                      <select 
                        value={reactivateYear} 
                        onChange={(e) => setReactivateYear(Number(e.target.value))} 
                        className="flex-1 border border-slate-300 rounded-xl p-2 text-sm"
                      >
                        {[1,2,3,4].map(y => 
                          <option 
                            key={y} 
                            value={y}
                          >
                            {y === 1 ? '1st Year' 
                              : y === 2 ? '2nd Year' 
                              : y === 3 ? '3rd Year' 
                              : '4th Year'
                            }
                          </option>)}
                      </select>
                      <select 
                        value={reactivateBlock} 
                        onChange={(e) => setReactivateBlock(e.target.value)} 
                        className={`w-24 border border-slate-300 rounded-xl p-2 text-sm ${reactivateIsIrregular ? 'opacity-50 cursor-not-allowed' : ''}`} 
                        disabled={reactivateIsIrregular}
                      >
                        {getBlocksForYear(reactivateYear, reactivateIsIrregular).map((block) => (
                          <option key={block} value={block}>{block}</option>
                        ))}
                      </select>
                    
                    </div>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={reactivateIsIrregular} onChange={(e) => setReactivateIsIrregular(e.target.checked)} />
                        <span>Irregular</span>
                      </label>

                    <div className="flex justify-end gap-2 mt-8">
                      <button 
                        onClick={() => { setReactivateModalOpen(false); setReactivateTarget(null); setReactivateIsIrregular(false); }} 
                        className="px-4 py-2 text-sm rounded-full border cursor-pointer hover:bg-blue-50 text-blue-600"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={async () => {
                        if (!currentUser) { setError('Please sign in to reactivate students'); return; }
                        setLoading(true);
                        try {
                          const ref = doc(db, 'students', reactivateTarget.id);
                          const payload = {
                            active: true,
                            yearLevel: reactivateYear,
                            isIrregular: !!reactivateIsIrregular,
                            block: reactivateIsIrregular ? '' : reactivateBlock,
                            inactiveAt: null,
                            inactiveYear: null,
                            updatedAt: new Date()
                          };
                          await updateDoc(ref, payload);
                          await logSystemAction({
                            action: 'Reactivated Student Account',
                            module: 'Curriculum Checker',
                            entityType: 'student',
                            entityId: reactivateTarget.id,
                            description: `Reactivated student account for ${reactivateTarget.name || reactivateTarget.id}`,
                            details: {
                              studentId: reactivateTarget.id,
                              studentName: reactivateTarget.name || '',
                              status: 'active'
                            }
                          });
                          setStudents(prev => prev.map(s => s.id === reactivateTarget.id ? { ...s, ...payload } : s));
                          setReactivateModalOpen(false);
                          setReactivateTarget(null);
                          setReactivateIsIrregular(false);
                          setSuccess('Student reactivated');
                        } catch (err) {
                          setError('Failed to reactivate: ' + err.message);
                        }
                        setLoading(false);
                      }} 
                      className="px-4 py-2 text-sm rounded-full bg-blue-500 cursor-pointer hover:bg-blue-600 text-white">Reactivate</button>
                    </div>
                  </div>
                </div>
              )}

              {selectedFolder && (folderStudents || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-gray-300">
                <div className="w-14 h-14 flex items-center justify-center rounded-full bg-blue-50 mb-3">
                  <User className="h-6 w-6 text-blue-400" />
                </div>
                <h2 className="text-base font-semibold text-gray-700 mb-1">No students found</h2>
                <p className="text-sm text-gray-400 max-w-xs">
                  {searchTerm.trim() ? `No results for "${searchTerm}"` : 'This folder is empty.'}
                </p>
              </div>
              ) : (
              <div className="border border-slate-300 rounded-xl overflow-hidden">

            
           
              
              <table className="min-w-full ">
                <thead className="bg-blue-500 text-xs uppercase text-white sticky top-0">
                  <tr>
                    <th className="px-4 py-2 w-[3%] text-left">
                      {selectMode ? (
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={(selectedFolder ? (folderStudents || []) : filteredStudents).length > 0 && (selectedFolder ? (folderStudents || []).every(s => selectedIds.includes(s.id)) : filteredStudents.every(s => selectedIds.includes(s.id)))}
                          onChange={() => {
                            const pool = selectedFolder ? (folderStudents || []) : filteredStudents;
                            if (pool.length > 0 && pool.every(s => selectedIds.includes(s.id))) {
                              setSelectedIds([]);
                            } else {
                              setSelectedIds(pool.map(s => s.id));
                            }
                          }}
                        />
                      ) : (
                        <span className="">No.</span>
                      )}
                    </th>
                    <th
                      className="px-4 py-2 w-[12%] text-left cursor-pointer"
                      onClick={() => handleSort('studentNumber')}
                    >
                      Student No. {sortBy === 'studentNumber' ? (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 inline-flex mb-1" /> : <ChevronDown className="w-4 h-4 inline-flex mb-1" />) : <ChevronsUpDown className="w-4 h-4 inline-flex opacity-80 mb-1" />}
                    </th>
                    <th
                      className="px-4 py-2 w-[25%] text-left cursor-pointer"
                      onClick={() => handleSort('name')}
                    >
                      Name {sortBy === 'name' ? (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 inline-flex mb-1" /> : <ChevronDown className="w-4 h-4 inline-flex mb-1" />) : <ChevronsUpDown className="w-4 h-4 inline-flex opacity-80 mb-1" />}
                    </th>
                    <th
                      className="px-4 py-2 w-[18%] text-left cursor-pointer"
                      onClick={() => handleSort('email')}
                    >
                      Email {sortBy === 'email' ? (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 inline-flex mb-1" /> : <ChevronDown className="w-4 h-4 inline-flex mb-1" />) : <ChevronsUpDown className="w-4 h-4 inline-flex opacity-80 mb-1" />}
                    </th>
                    <th
                      className="px-4 py-2 w-[12%] text-left cursor-pointer"
                      onClick={() => handleSort('contactNumber')}
                    >
                      Contact No.
                    </th>
                    <th
                      className="px-4 py-2 w-[15%] text-left cursor-pointer"
                      onClick={() => handleSort('curriculum')}
                    >
                      Curriculum 
                    </th>
                    <th className="px-4 py-2 w-[5%] text-left">Active</th>
                    <th className="px-4 py-2 w-[10%] text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && selectedFolder ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <RowSkeleton key={`student-row-skeleton-${index}`} />
                    ))
                  ) : (
                    sortedStudents.map((student, rowIdx) => {
                    const displayIndex = (selectedFolder ? (folderStudents || []) : filteredStudents).indexOf(student) + 1;
                    return (
                      <tr
                        id={`student-row-${student.id}`}
                        key={student.id}
                        className="border-t text-sm border-gray-300 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleSelectStudent(student)}
                      >
                        <td className="px-4 py-2 w-[3%]">
                          {selectMode ? (
                            <input
                              type="checkbox"
                              className="h-3 w-3"
                              checked={selectedIds.includes(student.id)}
                              onClick={(e) => { e.stopPropagation(); toggleSelectId(student.id); }}
                              onChange={() => {}}
                            />
                          ) : (
                            <span className="text-sm text-gray-700">{displayIndex}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 w-[12%]">
                          <span className="">{student.studentNumber || ''}</span>
                        </td>
                        <td className="px-4 py-2 w-[25%]">
                          <span className="">{student.name}</span>
                        </td>
                        <td className="px-4 py-2 w-[18%">
                          <span>{student.email}</span>
                        </td>
                    
                        <td className="px-4 py-2 w-[12%]">
                          <span>{student.contactNumber || ''}</span>
                        </td>
                        <td className="px-4 py-2 w-[15%]">
                          <span>{getCurriculumName(student.curriculumId)}</span>
                        </td>
                        <td className="px-4 py-2 w-[5%]">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleToggleActive(e, student); }}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${student.active === false ? 'bg-gray-200' : 'bg-blue-500'}`}
                            title={student.active === false ? 'Reactivate student' : 'Mark student inactive'}
                          >
                            <span className={`inline-block h-3 w-3 bg-white rounded-full transform transition ${student.active === false ? 'translate-x-0 ml-1' : 'translate-x-5 mr-1'}`}></span>
                          </button>
                        </td>
                        <td className="px-4 py-2 w-[10%]">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(student);
                              }}
                              className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteStudent(student.id);
                              }}
                              className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (student.yearLevel === 4) {
                                  handleArchiveStudent(e, student);
                                }
                              }}
                              disabled={student.yearLevel !== 4}
                              className={`p-1.5 rounded-full ${
                                student.yearLevel === 4
                                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                              }`}
                              title="Archive student"
                            >
                              <FolderArchive className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
            )}
            </>
          );
        })()}
      </div>
    </div>
  );

  const switchStudentSection = (section) => {
    setStudentSection(section);
    setSelectedStudent(null);
    setSelectedFolder(null);
    setSelectedIds([]);
    setSearchTerm('');
  };

  const renderCourseTables = () => {
    if (!selectedStudent) return null;

    const currentYear = courseTab + 1;
    const normalizedSubjectSearch = subjectGradeSearchTerm.trim().toLowerCase();
    const matchesSubjectGradeSearch = (courseLike) => {
      if (!normalizedSubjectSearch) return true;

      const courseCode = (courseLike.courseCode || '').toString().toLowerCase();
      const courseTitle = (courseLike.courseTitle || '').toString().toLowerCase();
      const units = String(courseLike.units ?? '').toLowerCase();
      const prerequisites = Array.isArray(courseLike.prerequisites)
        ? courseLike.prerequisites.join(' ').toLowerCase()
        : '';
      const grade = (editingGrades[courseLike.courseCode] || studentGrades[courseLike.courseCode] || '').toString().toLowerCase();

      return (
        courseCode.includes(normalizedSubjectSearch) ||
        courseTitle.includes(normalizedSubjectSearch) ||
        units.includes(normalizedSubjectSearch) ||
        prerequisites.includes(normalizedSubjectSearch) ||
        grade.includes(normalizedSubjectSearch)
      );
    };

    const getSubjectTypeInfo = (subject, fallbackCourse) => {
      const isMajor = subject?.isMajor ?? fallbackCourse?.isMajor ?? false;

      return isMajor
        ? { label: 'Major', className: 'bg-purple-50 text-purple-700 border border-purple-200' }
        : { label: 'Minor', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
    };

    const scholarshipEligibility = calculateScholarshipEligibility(currentYear);
    const hasSummerInCurrentYear = studentCourses.some(
      (course) => Number(course.yearLevel) === currentYear && Number(course.semester) === 3
    );
    const semestersForCurrentYear = hasSummerInCurrentYear ? [1, 2, 3] : [1, 2];

    if (selectedStudent.isIrregular) {
      return (
        <div className="flex flex-col h-full">
         
       <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex w-fit gap-12 border-b border-gray-200">
              {[1, 2, 3, 4].map((year, idx) => (
                <button
                  key={year}
                  onClick={() => setCourseTab(idx)}
                  className={` py-2 text-sm font-semibold transition cursor-pointer border-b-2 -mb-px

                  ${courseTab === idx
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                  }
                `}
                >
                  {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year
                </button>
              ))}
            </div>

            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                className="w-full border text-sm border-slate-200 bg-white rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                placeholder="Search subjects or grades..."
                value={subjectGradeSearchTerm}
                onChange={(e) => setSubjectGradeSearchTerm(e.target.value)}
              />
            </div>
            </div>

              {semestersForCurrentYear.map((semester) => {

            const mergedSubjects = getIrregularSemesterDisplayRows(currentYear, semester);
            const filteredSemSubjects = mergedSubjects.filter((subject) => matchesSubjectGradeSearch(subject));
            const semesterUnitsUsed = getIrregularUnitsUsed({ yearLevel: currentYear, semester });
            const semesterUnitsLimit = getIrregularUnitsLimit();
            const unitsAtLimit = semesterUnitsUsed >= semesterUnitsLimit;

            return (
              <div key={semester}>

              <div className='flex items-center justify-between gap-4 mb-4 '>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-700">{semester === 1 ? '1st' : semester === 2 ? '2nd' : 'Summer'} Semester</span>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      unitsAtLimit
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-slate-200 bg-slate-100 text-slate-600'
                    }`}
                  >
                    {semesterUnitsUsed}/{semesterUnitsLimit} units {getIrregularUnitsScopeLabel()}
                  </span>
                </div>

                 <button
      type="button"
      onClick={() => openSubjectPicker(semester)}

      className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-green-500 text-white hover:bg-green-600 transition cursor-pointer">
      <Plus className="w-4 h-4" />
      Add Subject
    </button>
                </div>

                  <div
  key={semester}
  className="mb-5 rounded-xl overflow-hidden bg-white shadow-sm border border-gray-200"
>

  
  

  

  {/* Table */}
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead className="bg-blue-500 text-white">
        <tr>
          <th className="px-4 py-2 text-left w-[10%]">Code</th>
          <th className="px-4 py-2 text-left w-[25%]">Title</th>
          <th className="px-4 py-2 text-left w-[5%]">Units</th>
          <th className="px-4 py-2 text-left w-[10%]">Type</th>
          <th className="px-4 py-2 text-left w-[15%]">Prerequisites</th>
          <th className="px-4 py-2 text-left w-[12%]">Term Taken</th>
          <th className="px-4 py-2 text-left w-[15%]">Grade</th>
          <th className="px-4 py-2 text-right w-[10%]">Action</th>
        </tr>
      </thead>

      <tbody>
          {mergedSubjects.length === 0 ? (
            <tr>
            <td colSpan={8} className="py-8 text-center text-gray-400">
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm">No subjects yet</span>
                <span className="text-xs">
                  Click “Add Subject” to get started
                </span>
              </div>
            </td>
          </tr>
        ) : filteredSemSubjects.length === 0 ? (
          <tr>
            <td colSpan={8} className="py-6 text-center text-gray-400">
              No matching subjects found
            </td>
          </tr>
        ) : (
          filteredSemSubjects.map((subject, index) => {
            const fallbackCourse = allCourses.find((course) =>
              (course.courseCode || '').toString().trim().toUpperCase() === (subject.courseCode || '').toString().trim().toUpperCase()
            );
            const prerequisites = Array.isArray(subject.prerequisites)
              ? subject.prerequisites
              : (Array.isArray(fallbackCourse?.prerequisites) ? fallbackCourse.prerequisites : []);

            return (
              <tr
                key={subject.id}
                className={`transition ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                } text-sm`}
              >
                <td className="px-4 py-2 font-semibold text-blue-600 w-[10%]">
                  {subject.courseCode}
                </td>

                <td className="px-4 py-2 text-gray-700 w-[25%]">
                  {subject.courseTitle}
                </td>

                <td className="px-4 py-2 text-gray-600 w-[5%]">
                  {subject.units}
                </td>

                <td className="px-4 py-2 w-[10%]">
                  {(() => {
                    const fallbackCourse = allCourses.find((course) =>
                      (course.courseCode || '').toString().trim().toUpperCase() === (subject.courseCode || '').toString().trim().toUpperCase()
                    );
                    const typeInfo = getSubjectTypeInfo(subject, fallbackCourse);

                    return (
                      <span 
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        typeInfo.className}`}>
                        {typeInfo.label}
                      </span>
                    );
                  })()}
                </td>

                <td className="px-4 py-2 text-gray-600 w-[15%]">
                  {prerequisites.length > 0 ? prerequisites.join(', ') : 'None'}
                </td>

                <td className="px-4 py-2 text-gray-600 w-[12%]">
                  {(() => {
                    const takenTerm = getIrregularTakenTermDisplay(subject);
                    return (
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            takenTerm.tone === 'current'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {takenTerm.label}
                        </span>
                        {takenTerm.detail ? (
                          <span className="text-[11px] text-gray-500">{takenTerm.detail}</span>
                        ) : null}
                      </div>
                    );
                  })()}
                </td>

                <td className="px-4 py-2 w-[15%]">
                  <select
                    className="w-full border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none rounded-lg px-2 py-1 text-xs bg-white"
                    value={editingGrades[subject.courseCode] || ''}
                    onChange={(e) =>
                      handleGradeChange(subject.courseCode, e.target.value)
                    }
                  >
                    <option value="" disabled>
                      Select
                    </option>
                    {[
                      "1.0","1.1","1.2","1.3","1.4","1.5","1.6","1.7","1.8","1.9",
                      "2.0","2.1","2.2","2.3","2.4","2.5","2.6","2.7","2.8","2.9",
                      "3.0","5.0","INC","CRED",""
                    ].map((g, idx) => (
                      <option key={idx} value={g}>
                        {g === '' ? 'No Grade' : g}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs">
                    {editingGrades[subject.courseCode] === '5.0' && (
                      <span className="text-red-600">Failed</span>
                    )}
                    {editingGrades[subject.courseCode] === 'INC' && (
                      <span className="text-amber-600">Incomplete</span>
                    )}
                    {editingGrades[subject.courseCode] === 'CRED' && (
                      <span className="text-green-700">Credited</span>
                    )}
                    {editingGrades[subject.courseCode] &&
                      !['5.0', 'INC', 'CRED'].includes(editingGrades[subject.courseCode]) && (
                        <span className="text-green-700">Completed</span>
                      )}
                    {!editingGrades[subject.courseCode] && (
                      <span className="text-gray-500">Not Graded</span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-2 text-end w-[10%]">
                  {!String(subject.id || '').startsWith('graded-') && (
                    <button
                      onClick={() => promptRemoveIrregularSubject(semester, subject)}
                      className="p-1 rounded-full cursor-pointer bg-gray-50 text-gray-600 hover:bg-gray-100 transition"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })
        )}

        {mergedSubjects.length > 0 && (
          <tr className={`border-t border-gray-200 transition-all ${gradesDirty ? 'bg-blue-50/40' : 'bg-gray-50/60'}`}>
            <td colSpan={8} className="px-4 py-2.5 text-right">
              <button
                type="button"
                onClick={handleSaveAllGrades}
                disabled={!gradesDirty || gradesSaving}
                className={`inline-flex items-center gap-2 px-5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer
                  ${gradesDirty
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-blue-500 text-white opacity-30 cursor-not-allowed pointer-events-none'
                  } disabled:opacity-30`}
              >
                {gradesSaving ? (
                  <>
                    Saving…
                  </>
                ) : 'Save Grades'}
              </button>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>
</div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">

         <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">

  
      <div className='flex items-center gap-2 justify-between'><h2 className="text-lg font-medium text-gray-900 leading-tight">{selectedStudent.name}</h2>
      <p className="text-[11px] font-medium tracking-widest uppercase text-gray-400 ">
    Academic eligibility summary
  </p>
    </div>

  <hr className="border-slate-100 mb-4" />

  {/* Label */}
  

  {/* Cards */}
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">

    {[
      { period: '1st semester', 
        label: "Dean's Lister", 
        eligible: calculateDeansListerEligibility(1, headerYear), 
        badge: calculateDeansListerEligibility(1, headerYear) 
                ? { text: 'Eligible', cls: 'bg-green-50 text-green-600 border border-green-500' } 
                : { text: 'Not eligible', cls: 'bg-gray-100 text-gray-500 border border-gray-300' } 
      },
      { period: '2nd semester', 
        label: "Dean's Lister", 
        eligible: calculateDeansListerEligibility(2, headerYear), 
        badge: calculateDeansListerEligibility(2, headerYear) 
                ? { text: 'Eligible', cls: 'bg-green-50 text-green-600 border border-green-500' } 
                : { text: 'Not eligible', cls: 'bg-gray-100 text-gray-500 border border-gray-300' } 
      },
      { period: 'Scholarship', 
        label: 'Scholarship',
        eligible: headerScholarshipEligibility.eligible,
        badge: headerScholarshipEligibility.eligible
                ? { 
                    text: `Eligible — ${headerScholarshipEligibility.percentage}%`, 
                    cls: headerScholarshipEligibility.percentage === 100 
                      ? 'bg-blue-50 text-blue-700 border border-blue-500' 
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-500' 
                  }
                : { text: 'Not eligible', cls: 'bg-gray-100 text-gray-500 border border-gray-300' } 
      },
    ].map((item) => (
      <div key={item.period} className="bg-gray-50  border border-gray-200 rounded-lg p-3.5 flex flex-col gap-2.5">
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
          {item.period}
        </span>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-800">{item.label}</span>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${item.badge.cls}`}>
            {item.badge.text}
          </span>
        </div>
      </div>
    ))}

  </div>
</div>
       <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex w-fit gap-4 border-b border-gray-200">
          {[1, 2, 3, 4].map((year, idx) => (
            <button
              key={year}
              type="button"
              onClick={() => setCourseTab(idx)}
              className={` px-4 py-2 text-sm font-semibold transition cursor-pointer border-b-2 -mb-px
      
      ${
        courseTab === idx
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-slate-600 hover:text-blue-600 hover:border-blue-600'
      }
      `}
            >
              {year === 1
                ? '1st'
                : year === 2
                ? '2nd'
                : year === 3
                ? '3rd'
                : '4th'}{' '}
              Year
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            className="w-full border text-sm border-slate-200 bg-white rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
            placeholder="Search subjects or grades..."
            value={subjectGradeSearchTerm}
            onChange={(e) => setSubjectGradeSearchTerm(e.target.value)}
          />
        </div>
      </div>


        <div className="flex-1 flex flex-col">
          {semestersForCurrentYear.map((semester) => {
            const semesterCourses = studentCourses
              .filter((course) => course.yearLevel === currentYear && course.semester === semester)
              .filter((course) => matchesSubjectGradeSearch(course));

            return (
            <div key={semester} className="flex-1 flex flex-col mb-3">
              <div className="text-lg font-semibold text-blue-700 mb-2">
                {semester === 1 ? '1st' : semester === 2 ? '2nd' : 'Summer'} Semester
              </div>
             <div className="border border-gray-300 rounded-lg overflow-hidden">
  <table className="min-w-full ">
    <thead className="bg-blue-500 text-white text-xs uppercase">
      <tr>
        <th className="px-4 py-2 w-[12%] text-left cursor-pointer" onClick={() => handleSort('courseCode')}>
          <span className="inline-flex items-center gap-1">Subject Code {sortBy === 'courseCode' ? (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ChevronsUpDown className="w-3.5 h-3.5 opacity-60" />}</span>
        </th>
        <th className="px-4 py-2 w-[35%] text-left cursor-pointer" onClick={() => handleSort('courseTitle')}>
          <span className="inline-flex items-center gap-1">Subject Title {sortBy === 'courseTitle' ? (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ChevronsUpDown className="w-3.5 h-3.5 opacity-60" />}</span>
        </th>
        <th className="px-4 py-2 w-[8%] text-center cursor-pointer" onClick={() => handleSort('units')}>
          <span className="inline-flex items-center gap-1">Units {sortBy === 'units' ? (sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ChevronsUpDown className="w-3.5 h-3.5 opacity-60" />}</span>
        </th>
        <th className="px-4 py-2 w-[10%] text-left">Type</th>
        <th className="px-4 py-2 w-[20%] text-left">Prerequisites</th>
        <th className="px-4 py-2 w-[10%] text-left">Grade</th>
      </tr>
    </thead>

    <tbody>
      {semesterCourses
        .sort((a, b) => {
          let aValue, bValue;
          switch (sortBy) {
            case 'courseCode':
              aValue = a.courseCode;
              bValue = b.courseCode;
              return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            case 'courseTitle':
              aValue = a.courseTitle;
              bValue = b.courseTitle;
              return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            case 'units':
              aValue = parseFloat(a.units) || 0;
              bValue = parseFloat(b.units) || 0;
              return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
            default:
              return 0;
          }
        })
        .map((course) => (
          <tr key={course.id} className="border-t text-sm border-gray-300 hover:bg-gray-50">
            <td className="px-4 py-2 w-[12%]">
              <span className="font-semibold text-blue-700">{course.courseCode}</span>
            </td>
            <td className="px-4 py-2 w-[35%]">
              <span>{course.courseTitle}</span>
            </td>
            <td className="px-4 py-2 text-center w-[8%]">
              {course.units}
            </td>
            <td className="px-4 py-2 w-[10%]">
              {(() => {
                const fallbackCourse = allCourses.find((c) =>
                  (c.courseCode || '').toString().trim().toUpperCase() ===
                  (course.courseCode || '').toString().trim().toUpperCase()
                );
                const typeInfo = getSubjectTypeInfo(course, fallbackCourse);
                return (
                  <span 
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      typeInfo.className
                    }`}
                  >
                    {typeInfo.label}
                  </span>
                );
              })()}
            </td>
            <td className="px-4 py-2 w-[20%]">
              {course.prerequisites.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {course.prerequisites.slice(0, 2).map((prereq) => (
                    <span
                      key={prereq}
                      className={`px-2 py-0.5 rounded-full text-xs border ${
                        isCourseCompleted(prereq)
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}
                    >
                      {prereq}
                    </span>
                  ))}

                  {course.prerequisites.length > 2 && (
                    <span className="px-2 py-0.5 rounded-full text-xs border bg-gray-50 border-gray-200 text-gray-700">
                      +{course.prerequisites.length - 2}
                    </span>
                  )}
                </div>
              ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs border bg-gray-50 border-gray-200 text-gray-700">
                  None
                  </span>
              )}
            </td>

            <td className="px-4 py-2">
              {(() => {
                const fallbackCourse = allCourses.find((c) => (c.courseCode || '').toString().trim().toUpperCase() === (course.courseCode || '').toString().trim().toUpperCase());
                const prerequisites = Array.isArray(course.prerequisites) ? course.prerequisites : (Array.isArray(fallbackCourse?.prerequisites) ? fallbackCourse.prerequisites : []);
                const prereqsMet = prerequisites.length === 0 || prerequisites.every(pr => isCourseCompleted(pr));
                const disabled = !selectedStudent?.isIrregular && !prereqsMet;

                return (
                  <>
                    <select
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                      value={editingGrades[course.courseCode] || ''}
                      onChange={(e) => handleGradeChange(course.courseCode, e.target.value)}
                      disabled={disabled}
                    >
                <option value="" disabled>
                  Select Grade
                </option>
                {[
                  "1.0","1.1","1.2","1.3","1.4","1.5","1.6","1.7","1.8","1.9",
                  "2.0","2.1","2.2","2.3","2.4","2.5","2.6","2.7","2.8","2.9",
                  "3.0","5.0","INC","CRED",""
                ].map((g, idx) => (
                  <option key={idx} value={g}>
                    {g === '' ? 'No Grade' :
                     g === '5.0' ? '5.0 (Failed)' :
                     g === 'INC' ? 'INC (Incomplete)' :
                     g === 'CRED' ? 'CRED (Credited)' : g}
                  </option>
                ))}
                    </select>
                    {!prereqsMet && !selectedStudent?.isIrregular && (
                      <div className="mt-1 text-xs text-red-600">Prerequisites not met yet</div>
                    )}
                  </>
                );
              })()}

              {studentGrades[course.courseCode] && (
                <div className="mt-1 text-xs">
                  {studentGrades[course.courseCode] === '5.0' && (
                    <span className="text-red-600">Failed</span>
                  )}
                  {studentGrades[course.courseCode] === 'INC' && (
                    <span className="text-amber-600">Incomplete</span>
                  )}
                  {studentGrades[course.courseCode] === 'CRED' && (
                    <span className="text-green-700">Credited</span>
                  )}
                  {studentGrades[course.courseCode] &&
                    !['5.0','INC','CRED'].includes(studentGrades[course.courseCode]) && (
                      <span className="text-green-700">Completed</span>
                    )}
                </div>
              )}
            </td>
          </tr>
        ))}

      {semesterCourses.length === 0 && (
        <tr>
          <td colSpan={6} className="text-center text-gray-500 py-4">
            {subjectGradeSearchTerm.trim()
              ? 'No matching subjects found'
              : `No courses in Year ${currentYear}, ${semester === 1 ? '1st' : semester === 2 ? '2nd' : 'Summer'} Semester`}
          </td>
        </tr>
      )}

      {semesterCourses.length > 0 && (
        <tr className={`border-t border-gray-200 transition-all ${gradesDirty ? 'bg-blue-50/40' : 'bg-gray-50/60'}`}>
          <td colSpan={6} className="px-4 py-2.5 text-right">
            <button
              type="button"
              onClick={handleSaveAllGrades}
              disabled={!gradesDirty || gradesSaving}
              className={`inline-flex items-center gap-2 px-5 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer
                ${gradesDirty
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-600 text-white opacity-30 cursor-not-allowed pointer-events-none'
                } disabled:opacity-30`}
            >
              {gradesSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Saving…
                </>
              ) : 'Save Grades'}
            </button>
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>

            </div>
          );
          })}
        </div>
      </div>
    );
  };

  // Header summary values (displayed inside the Selected Student header)
  const headerYear = courseTab + 1;
  const headerScholarshipEligibility = calculateScholarshipEligibility(headerYear);

  return (
    <div id="student-management-root" className="">
      
      

      {!currentUser && (
        <div className="mb-2 rounded border border-blue-200 bg-blue-50 text-blue-800 px-4 py-2">
          Please sign in to access Student Management
        </div>
      )}

      {/* messages shown via toast notifications */}

      {currentUser ? (
        <div className="flex-1 flex flex-col">
          <div></div>
          {!selectedStudent && (
            <div className="flex-1">
              <div>{studentSection === 'other' ? <OtherDepartmentManagement /> : renderStudentList()}</div>
            </div>
          )}
          {selectedStudent && (
            <div className="flex-1 flex flex-col">
              <div className="w-full">
                {renderCourseTables()}
              </div>
            </div>
          )}
        </div>
      ) : (

        <div className="flex-1 flex items-center justify-center">
          <div className="p-6 text-center border border-gray-200 rounded bg-gray-50 text-gray-600">
            Sign in to access student management features
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setEditingDialogOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-xl shadow ">
            <div className="text-xl font-medium px-8 py-4 border-b border-slate-300 text-slate-800">Update Student</div>
           
            <div className="space-y-2 px-8 py-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Student Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  placeholder="Enter student number (e.g., 2024-00001)"
                  value={editingData.studentNumber || ''}
                  onChange={(e) => setEditingData({ ...editingData, studentNumber: formatStudentNumber(e.target.value) })}
                  pattern="^\\d{4}-\\d{5}$"
                  title="Format: 4 digits, dash, 5 digits"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Student Name</label>
                <input
                  className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  placeholder="Last Name, First Name, Middle Name"
                  value={editingData.name}
                  onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  placeholder="name@example.com"
                  value={editingData.email || ''}
                  onChange={(e) => setEditingData({ ...editingData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Contact Number</label>
                <input
                  type="text"
                  className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  placeholder="Enter contact number"
                  value={editingData.contactNumber || ''}
                  onChange ={(e) => {
                    let input = e.target.value.replace(/\D/g, ''); // remove non-numeric characters

                    // Handle international format starting with 63
                    if (input.startsWith('63')) {
                      input = '+' + input;
                    } else if (input.startsWith('0')) {
                      input = input; // local format
                    }
                    // Format local numbers as 0917 123 4567
                    if (input.startsWith('0') && input.length > 4) {
                      input = input.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3');
                    } else if (input.startsWith('+63') && input.length > 5) {
                      input = input.replace(/(\+\d{2})(\d{4})(\d{3})(\d{4})/, '$1 $2 $3 $4');
                    }
                    setEditingData({ ...editingData, contactNumber: input });
                  }}
                />
              </div>
              <div className='flex items-center gap-4'>
                <div className={editingData.isIrregular ? 'w-full' : 'w-2/3'}>
                <label className="block text-sm text-gray-600 mb-1">Year Level</label>
                <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-100 p-1">
                  {[1, 2, 3, 4].map((year) => (
                    <button
                      key={year}
                      type="button"
                      onClick={() => setEditingData({ ...editingData, yearLevel: year })}
                      className={`flex-1 rounded-md px-2 py-2 text-sm font-medium transition ${
                        Number(editingData.yearLevel) === year
                          ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year
                    </button>
                  ))}
                </div>
              </div>

              {!editingData.isIrregular && (
                <div className='w-1/3'>
                  <label className="block text-sm text-gray-600 mb-1">Block</label>
                  <input
                    type="text"
                    maxLength={1}
                    pattern="[A-Za-z]"
                    className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                    value={editingData.block || ''}
                    required
                    onChange={(e) => setEditingData({ ...editingData, block: e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase() })}
                    placeholder="A"
                  />
                </div>
              )}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Curriculum</label>
                <select
                  className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  value={editingData.curriculumId}
                  onChange={(e) => { setEditingData({ ...editingData, curriculumId: e.target.value }); if (curriculumSelectError) setCurriculumSelectError(''); }}
                >
                  {curriculums.map((curriculum) => (
                    <option key={curriculum.id} value={curriculum.id}>
                      {curriculum.name}
                    </option>
                  ))}
                </select>
                {curriculumSelectError && (
                  <div className="text-sm text-red-600 mt-2">{curriculumSelectError}</div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-gray-700">Enrollment Status</div>
                  <div className="text-xs text-gray-500">
                    {editingData.enrolled ?? true ? 'Student is currently enrolled.' : 'Student is not currently enrolled.'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editingData.enrolled ?? true}
                  onClick={() => setEditingData({ ...editingData, enrolled: !(editingData.enrolled ?? true) })}
                  className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition ${
                    (editingData.enrolled ?? true) ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
                      (editingData.enrolled ?? true) ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>

                
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={editingData.isIrregular}
                  onChange={(e) => setEditingData({ ...editingData, isIrregular: e.target.checked, block: e.target.checked ? '' : editingData.block || '' })}
                />
                <label className="text-sm text-gray-700">Irregular student</label>
              </div>

              

              <div className="mt-8 flex justify-end gap-2">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveEdit(editingData.id)}
                disabled={loading || !editingData.name}
                className="px-4 py-2 w-24 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Update
              </button>
            </div>

            </div>
            
          </div>
        </div>
      )}
      {/* Add Student Modal */}
      {studentDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setStudentDialogOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-xl shadow ">
            <div className="text-xl font-medium text-slate-800 px-8 py-4 border-b border-slate-300">Add New Student</div>
           
            <div className="space-y-2 px-8 py-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Student Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  placeholder="(e.g., 2024-00001)"
                  value={studentForm.studentNumber || ''}
                  onChange={(e) => setStudentForm({ ...studentForm, studentNumber: formatStudentNumber(e.target.value) })}
                  pattern="^\\d{4}-\\d{5}$"
                  title="Format: 4 digits, dash, 5 digits"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Student Name</label>
                <input
                  className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  placeholder="Last Name, First Name, Middle Name"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  required
                />
              </div>
             <div>
              <label className="block text-sm text-gray-600 mb-1">Contact Number</label>
              <input
                type="tel"
                className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                placeholder="(eg. 0917 123 4567)"
                value={studentForm.contactNumber || ''}
                onChange={(e) => {
                  let input = e.target.value.replace(/\D/g, ''); // remove non-numeric characters

                  // Handle international format starting with 63
                  if (input.startsWith('63')) {
                    input = '+' + input;
                  } else if (input.startsWith('0')) {
                    input = input; // local format
                  }

                  // Format local numbers as 0917 123 4567
                  if (input.startsWith('0')) {
                    if (input.length > 4 && input.length <= 7) {
                      input = input.slice(0, 4) + ' ' + input.slice(4);
                    } else if (input.length > 7) {
                      input = input.slice(0, 4) + ' ' + input.slice(4, 7) + ' ' + input.slice(7, 11);
                    }
                  }

                  // Format international +63 numbers as +63 917 123 4567
                  if (input.startsWith('+63')) {
                    let withoutPrefix = input.slice(3); // remove +63
                    if (withoutPrefix.length > 3 && withoutPrefix.length <= 6) {
                      withoutPrefix = withoutPrefix.slice(0, 3) + ' ' + withoutPrefix.slice(3);
                    } else if (withoutPrefix.length > 6) {
                      withoutPrefix =
                        withoutPrefix.slice(0, 3) +
                        ' ' +
                        withoutPrefix.slice(3, 6) +
                        ' ' +
                        withoutPrefix.slice(6, 10);
                    }
                    input = '+63 ' + withoutPrefix;
                  }

                  setStudentForm({ ...studentForm, contactNumber: input });
                }}
              />
            </div>
                  
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  placeholder="name@example.com"
                  value={studentForm.email || ''}
                  onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                />
              </div>
             <div className='flex items-center gap-4'>
               <div className={studentForm.isIrregular ? 'w-full' : 'w-2/3'}>
  <label className="block text-sm text-gray-600 mb-1">Year Level</label>
  <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-100 p-1">
    {[1, 2, 3, 4].map((year) => (
      <button
        key={year}
        type="button"
        onClick={() => {
          setStudentForm({ ...studentForm, yearLevel: year });
          setStudentFormYearError('');
        }}
        className={`flex-1 rounded-md px-2 py-2 text-sm font-medium transition ${
          Number(studentForm.yearLevel) === year
            ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year
      </button>
    ))}
  </div>
  {studentFormYearError && <div className="text-sm text-red-600 mt-2">{studentFormYearError}</div>}
</div>


            {!studentForm.isIrregular && (
              <div className='w-1/3'>
                <label className="block text-sm text-gray-600 mb-1">Block</label>
                <input
                  type="text"
                  maxLength={1}
                  pattern="[A-Za-z]"
                  className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  value={studentForm.block || ''}
                  required
                  onChange={(e) => setStudentForm({ ...studentForm, block: e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase() })}
                  placeholder="A"
                />
              </div>
            )}

             </div>
<div>
  <label className="block text-sm text-gray-600 mb-1">Curriculum</label>
  <select
    className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
    value={studentForm.curriculumId || ""}
    required
    onChange={(e) => {
      setStudentForm({
        ...studentForm,
        curriculumId: e.target.value
      });
      if (curriculumSelectError) setCurriculumSelectError('');
    }}
  >
    <option value="" disabled>
      Select Curriculum
    </option>

    {curriculums.map((curriculum) => (
      <option key={curriculum.id} value={curriculum.id}>
        {curriculum.name}
      </option>
    ))}
  </select>
  {curriculumSelectError && (
    <div className="text-sm text-red-600 mt-2">{curriculumSelectError}</div>
  )}
</div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-gray-700">Enrollment Status</div>
                  <div className="text-xs text-gray-500">
                    {studentForm.enrolled ? 'Student is currently enrolled.' : 'Student is not currently enrolled.'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={studentForm.enrolled}
                  onClick={() => setStudentForm({ ...studentForm, enrolled: !studentForm.enrolled })}
                  className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition ${
                    studentForm.enrolled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
                      studentForm.enrolled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={studentForm.isIrregular}
                  onChange={(e) => setStudentForm({ ...studentForm, isIrregular: e.target.checked, block: e.target.checked ? '' : studentForm.block || '' })}
                />
                <label className="text-sm text-gray-700">Irregular student</label>
              </div>
              <div className="mt-8 flex justify-end gap-2">
              <button
                onClick={() => setStudentDialogOpen(false)}
                className="px-4 py-2 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStudent}
                disabled={loading || !studentForm.name}
                className="px-4 py-2 w-24 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Add 
              </button>
            </div>
            </div>
            
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setDeleteDialogOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-xl shadow p-8">
            <div className="text-xl font-semibold mb-4">Confirm Delete</div>
            <div className="text-gray-700 mb-8 text-justify">
              Are you sure you want to delete student: <span className="font-semibold">{studentToDeleteName || 'this student'}</span>? 
              {" "} This action cannot be undone and all associated data will be permanently removed.
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setStudentToDelete(null);
                }}
                className="px-4 py-2 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={loading}
                className="px-4 py-2 w-28 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {inactiveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setInactiveConfirmOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-xl shadow p-8">
            <div className="text-xl font-semibold mb-4">Confirm Inactivate</div>
            <div className="text-gray-700 mb-8 text-justify">
              Are you sure you want to mark <span className="font-semibold">{studentToInactivate?.name || 'this student'}</span> as inactive? This will move the student to  Inactive folder.
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setInactiveConfirmOpen(false);
                  setStudentToInactivate(null);
                }}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmInactivate}
                disabled={loading}
                className="px-4 py-1.5 w-28 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Inactivating...' : 'Inactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {archiveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setArchiveConfirmOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-xl shadow p-8">
            <div className="text-xl font-semibold mb-4">Confirm Archive</div>
            <div className="text-gray-700 text-justify mb-8">
              Are you sure you want to archive  student: <span className="font-semibold">{studentToArchive?.name}</span>? This will move the student to an archive folder.
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setArchiveConfirmOpen(false);
                  setStudentToArchive(null);
                }}
                className="px-4 py-2 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                className="px-4 py-2 w-28 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {irregularDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setIrregularDeleteDialogOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-xl shadow p-8">
            <div className="text-xl font-semibold mb-4">Remove Subject</div>
            <div className="text-gray-700 text-justify ">
              Are you sure you want to remove this subject to <span className='font-semibold'>{selectedStudent.name}</span>? This action cannot be undone.
              {irregularSubjectToDelete && (
                <div className="mt-4 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <div className="font-semibold text-blue-700">{irregularSubjectToDelete.courseCode}</div>
                  <div>{irregularSubjectToDelete.courseTitle}</div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-9">
              <button
                onClick={() => {
                  setIrregularDeleteDialogOpen(false);
                  setIrregularSubjectToDelete(null);
                }}
                className="px-4 py-2 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmIrregularDelete}
                disabled={loading}
                className="px-4 py-2 W-28 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {subjectPickerOpen && selectedStudent?.isIrregular && (() => {
        const targetYearLabel = getYearLabel(courseTab + 1);
        const targetSemLabel = subjectPickerSemester === 1 ? '1st' : subjectPickerSemester === 2 ? '2nd' : 'Summer';
        const unitsProgress = irregularSubjectPickerStats.unitsLimit > 0
          ? Math.min(100, (irregularSubjectPickerStats.unitsUsed / irregularSubjectPickerStats.unitsLimit) * 100)
          : 0;

        const renderEquivalentOtherCurricula = (course) => {
          const equivalents = getEquivalentCoursesFromOtherCurricula(course);
          if (equivalents.length === 0) {
            return <span className="text-xs text-slate-400"> </span>;
          }

          return (
            <div className="flex flex-col gap-1.5">
              {equivalents.map((equivalent) => (
                <div
                  key={equivalent.id}
                  className="rounded-lg border border-violet-200 bg-violet-50/80 px-2 py-1.5"
                >
                  <p className="text-xs font-semibold text-violet-800">{equivalent.courseCode}</p>
                  <p className="text-[11px] font-medium text-violet-700">
                    {getCurriculumName(equivalent.curriculumId) || 'Other curriculum'}
                  </p>
                </div>
              ))}
            </div>
          );
        };

        const renderPrerequisiteChips = (course, rowState, compact = false) => {
          const prerequisites = getCoursePrerequisites(course);
          if (prerequisites.length === 0) {
            return <span className="text-xs text-slate-400">None required</span>;
          }

          return (
            <div className={`flex flex-col gap-1.5 ${compact ? '' : 'min-w-[12rem]'}`}>
              {prerequisites.map((prereq) => {
                const fulfillment = getPrerequisiteFulfillment(prereq);
                const met = fulfillment.status === 'completed';
                const title = getPrerequisiteCourseTitle(prereq);
                const statusLabel = getPrerequisiteStatusLabel(fulfillment.status);

                return (
                  <div
                    key={prereq}
                    className={`rounded-lg border px-2 py-1.5 ${
                      met
                        ? 'border-emerald-200 bg-emerald-50/80'
                        : 'border-red-200 bg-red-50/80'
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                     
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold ${met ? 'text-emerald-800' : 'text-red-800'}`}>
                          {fulfillment.courseCode}
                        </p>
                        {!compact && title ? (
                          <p className="truncate text-[11px] text-slate-600">{title}</p>
                        ) : null}
                        <p className={`text-[10px] font-medium ${met ? 'text-emerald-600' : 'text-red-600'}`}>
                          {statusLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {rowState.prerequisitesNotMet && !compact && (
                <p className="text-[11px] leading-snug text-red-600">
                  {rowState.prerequisiteValidationMessage}
                </p>
              )}
            </div>
          );
        };

        const renderRowStatus = (rowState) => {
          if (rowState.status === 'graded') {
            return (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Graded
              </span>
            );
          }
          if (rowState.status === 'added') {
            return (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                <Layers className="w-3.5 h-3.5" />
                Added
              </span>
            );
          }
          if (rowState.status === 'limit') {
            return (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                <AlertCircle className="w-3.5 h-3.5" />
                Limit
              </span>
            );
          }
          if (rowState.status === 'blocked') {
            return (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                <Lock className="w-3.5 h-3.5" />
                Blocked
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ready
            </span>
          );
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={() => setSubjectPickerOpen(false)} />
            <div className="relative z-10 flex h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
             <div className="border-b border-slate-200 px-8 py-4 bg-slate-100">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                
                {/* Left Content */}
                <div className="min-w-0 flex-1">
                  
                  {/* Title Section */}
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-medium text-slate-800">
                      Add Irregular Subject
                    </h3>
                  </div>

                  {/* Tags */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                      <User className="h-4 w-4 text-blue-600" />
                       {selectedStudent.name || 'Student'}
                    </span>


                    <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                      <GraduationCap className="h-4 w-4 text-blue-600" />
                      {targetYearLabel} Year · {targetSemLabel} Semester
                    </span>

                    {term.semester && term.schoolYear && (
                      <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        Active Term: {SEMESTER_LABELS[term.semester] || `Sem ${term.semester}`} · S.Y. {term.schoolYear}
                      </span>
                    )}
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setSubjectPickerOpen(false)}
                  className="rounded-full bg-white p-1 cursor-pointer text-slate-500 hover:text-red-600 transition"
                  aria-label="Close"
                >
                  <X className="h-5 w-5 " />
                </button>
              </div>
            </div>

              <div className="grid shrink-0 gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:grid-cols-2 sm:px-5">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Enrollment term</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIrregularAddTermMode('previous')}
                      className={`rounded-lg px-3 py-2 text-xs w-fit font-medium transition ${
                        irregularAddTermMode === 'previous'
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'
                      }`}  
                    >
                      <span className="font-semibold">Previous Term</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIrregularAddTermMode('current')}
                      className={`rounded-lg px-3 py-2 text-xs w-fit font-medium transition ${
                        irregularAddTermMode === 'current'
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'
                      }`}
                    >
                      <span className="font-semibold">Current Term</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Target year level</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['all', '1', '2', '3', '4'].map((yearKey) => (
                      <button
                        key={yearKey}
                        type="button"
                        onClick={() => setSubjectPickerYearFilter(yearKey)}
                        className={`rounded-lg px-3 py-2 text-xs flex-1 font-medium transition ${
                          subjectPickerYearFilter === yearKey
                            ? 'bg-blue-500 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'
                        }`}
                      >
                        {yearKey === 'all' ? 'All' : `${yearKey === '1' ? '1st' : yearKey === '2' ? '2nd' : yearKey === '3' ? '3rd' : '4th'} Year`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="shrink-0 space-y-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="">
                      <select
                        id="subject-picker-curriculum"
                        value={subjectPickerCurriculumFilter}
                        onChange={(e) => setSubjectPickerCurriculumFilter(e.target.value)}
                        className="w-fit border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                      >
                        {curriculums.map((curriculum) => (
                          <option key={curriculum.id} value={curriculum.id}>
                            {curriculum.name}
                            {curriculum.id === selectedStudent?.curriculumId ? '' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <select
                      id="subject-picker-semester"
                      value={subjectPickerSemesterFilter}
                      onChange={(e) => setSubjectPickerSemesterFilter(e.target.value)}
                      className="w-fit border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                    >
                      <option value="all">All semesters</option>
                      <option value="1">1st semester</option>
                      <option value="2">2nd semester</option>
                      <option value="3">Summer</option>
                    </select>
                    <div className="relative min-w-[14rem] flex-1 sm:min-w-[18rem]">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={subjectPickerSearch}
                        onChange={(e) => setSubjectPickerSearch(e.target.value)}
                        placeholder="Search code, title, or curriculum…"
                        className="w-full border text-sm border-slate-200 bg-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                      />
                    </div>
                  </div>

                  <div className="inline-flex gap-2 rounded-lg border border-slate-200 bg-white p-1">
                    {[
                      { key: 'all', label: `All (${irregularSubjectPickerStats.total})` },
                      { key: 'addable', label: `Ready (${irregularSubjectPickerStats.addable})` },
                      { key: 'blocked', label: `Blocked (${irregularSubjectPickerStats.blocked})` }
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setSubjectPickerStatusFilter(tab.key)}
                        className={`rounded-lg px-3 py-2 text-xs  font-medium transition ${
                          subjectPickerStatusFilter === tab.key
                            ? 'bg-blue-500 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {irregularSubjectPickerStats.addable} ready to add
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700">
                    <Lock className="h-3.5 w-3.5" />
                    {irregularSubjectPickerStats.blocked} blocked by prerequisites
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
                    <Layers className="h-3.5 w-3.5" />
                    {irregularSubjectPickerStats.added} already added
                  </span>
                  {irregularSubjectPickerStats.withEquivalentsInOther > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 font-medium text-violet-700">
                      <Link2 className="h-3.5 w-3.5" />
                      {irregularSubjectPickerStats.withEquivalentsInOther} equivalent subjects in other curriculum
                    </span>
                  )}
                  <span className="ml-auto flex min-w-[12rem] items-center gap-2">
                    <span className="font-medium text-slate-700">
                      Units {irregularSubjectPickerStats.unitsUsed}/{irregularSubjectPickerStats.unitsLimit}{' '}
                      {irregularSubjectPickerStats.unitsScopeLabel}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <span
                        className={`block h-full rounded-full transition-all ${
                          unitsProgress >= 100 ? 'bg-amber-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${unitsProgress}%` }}
                      />
                    </span>
                  </span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden px-4 pb-3 pt-2 sm:px-5">
                <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="h-full overflow-auto">
                   <table className="min-w-full table-fixed text-sm">
                    <thead className="sticky top-0 z-10 bg-blue-500 text-xs uppercase tracking-wide text-white">
                      <tr>
                        <th className="w-[10%] px-3 py-2.5 text-left">Status</th>

                        <th
                          className="w-[10%] cursor-pointer px-3 py-2.5 text-left select-none"
                          onClick={() => {
                            if (subjectPickerSortBy === 'courseCode') {
                              setSubjectPickerSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                            } else {
                              setSubjectPickerSortBy('courseCode');
                              setSubjectPickerSortOrder('asc');
                            }
                          }}
                        >
                          <span className="inline-flex items-center gap-1">
                            Code
                            {subjectPickerSortBy === 'courseCode' && subjectPickerSortOrder === 'asc' ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : subjectPickerSortBy === 'courseCode' ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
                            )}
                          </span>
                        </th>

                        <th
                          className="w-[24%] cursor-pointer px-3 py-2.5 text-left select-none"
                          onClick={() => {
                            if (subjectPickerSortBy === 'courseTitle') {
                              setSubjectPickerSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                            } else {
                              setSubjectPickerSortBy('courseTitle');
                              setSubjectPickerSortOrder('asc');
                            }
                          }}
                        >
                          <span className="inline-flex items-center gap-1">
                            Description
                            {subjectPickerSortBy === 'courseTitle' && subjectPickerSortOrder === 'asc' ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : subjectPickerSortBy === 'courseTitle' ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
                            )}
                          </span>
                        </th>

                        <th className="w-[6%] px-3 py-2.5 text-center">Units</th>

                        <th className="w-[7%] px-3 py-2.5 text-center">Type</th>

                        <th className="w-[23%] px-3 py-2.5 text-left">
                          Prerequisites
                        </th>

                        <th className="w-[15%] px-3 py-2.5 text-left">
                          Equivalent Subjects
                        </th>

                        <th className="w-[5%] px-3 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredIrregularSubjectPickerRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center">
                            <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-slate-500">
                              <Info className="h-8 w-8 text-slate-300" />
                              <p className="text-sm font-medium text-slate-700">
                                No subjects match your filters
                              </p>
                              <p className="text-xs">
                                Try another search term, semester, or switch to “All” subjects.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredIrregularSubjectPickerRows.map(({ course, rowState }, index) => (
                          <tr
                            key={course.id}
                            className={`border-t border-slate-100 transition hover:bg-blue-50/40 ${
                              index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            }`}
                          >
                            <td className="w-[10%] px-3 py-3 align-top">
                              {renderRowStatus(rowState)}
                            </td>

                            <td className="w-[10%] px-3 py-3 align-top">
                              <span className="font-semibold text-blue-700">
                                {course.courseCode}
                              </span>

                          
                            </td>

                            <td className="w-[24%] px-3 py-3 align-top text-slate-700">
                              <div className="break-words">
                                {course.courseTitle}
                              </div>
                            </td>

                            <td className="w-[6%] px-3 py-3 text-center align-top text-slate-600">
                              {course.units}
                            </td>

                            <td className="w-[7%] px-3 py-3 align-top">
                              {course.isMajor ? (
                                <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                  Major
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                  Minor
                                </span>
                              )}
                            </td>

                            <td className="w-[23%] px-3 py-3 align-top">
                              <div className="overflow-hidden">
                                {renderPrerequisiteChips(course, rowState)}
                              </div>
                            </td>

                            <td className="w-[15%] px-3 py-3 align-top">
                              <div className="overflow-hidden">
                                {renderEquivalentOtherCurricula(course)}
                              </div>
                            </td>

                            <button
                              type="button"
                              disabled={!rowState.canAdd}
                              onClick={() => {
                                if (rowState.canAdd) {
                                  handleRequestAddIrregularSubject(course);
                                }
                              }}
                              className={`inline-flex w-full  text-center  justify-center items-center mt-3 gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition
                                ${
                                  rowState.canAdd
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    : 'cursor-not-allowed bg-slate-100 text-slate-400'
                                }`}
                            >
                              Add
                            </button>
                                                      </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
                <p className="text-xs text-slate-500">
                  Prerequisites show completion status. Violet cards list equivalent subjects from other curricula.
                </p>
                <button
                  type="button"
                  onClick={() => setSubjectPickerOpen(false)}
                className="px-4 py-1.5 w-24 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Join Class Modal — shown after clicking Add on a subject */}
      {joinClassModalOpen && joinClassPendingCourse && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setJoinClassModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200 p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Join Class</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Choose which block this student will join for{' '}
                  <span className="font-semibold text-blue-700">{joinClassPendingCourse.courseCode}</span>
                  {term.semester && term.schoolYear ? (
                    <span>
                      {' '}under {SEMESTER_LABELS[term.semester] || `Sem ${term.semester}`} · S.Y. {term.schoolYear}
                    </span>
                  ) : null}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setJoinClassModalOpen(false)}
                className="p-1 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subject info pill */}
            <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <span className="font-semibold">{joinClassPendingCourse.courseCode}</span>
              {' — '}{joinClassPendingCourse.courseTitle}
              {joinClassPendingCourse.units ? ` · ${joinClassPendingCourse.units} units` : ''}
              {joinClassPendingCourse.yearLevel ? (
                <span className="ml-2 text-blue-600 font-medium">
                  · {joinClassPendingCourse.yearLevel === 1 || joinClassPendingCourse.yearLevel === '1' ? '1st' : joinClassPendingCourse.yearLevel === 2 || joinClassPendingCourse.yearLevel === '2' ? '2nd' : joinClassPendingCourse.yearLevel === 3 || joinClassPendingCourse.yearLevel === '3' ? '3rd' : '4th'} Year
                </span>
              ) : null}
            </div>

            {/* Block only */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Block</label>
              <select
                value={joinClassBlock}
                onChange={(e) => setJoinClassBlock(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">— Select Block —</option>
                {getBlocksForYearInActiveTerm(Number(joinClassPendingCourse.yearLevel)).map((block) => (
                  <option key={block} value={block}>Block {block}</option>
                ))}
              </select>
              {joinClassBlock && (
                <p className="mt-1.5 text-xs text-blue-700 font-medium">
                  Joining: {joinClassPendingCourse.yearLevel === 1 || joinClassPendingCourse.yearLevel === '1' ? '1st' : joinClassPendingCourse.yearLevel === 2 || joinClassPendingCourse.yearLevel === '2' ? '2nd' : joinClassPendingCourse.yearLevel === 3 || joinClassPendingCourse.yearLevel === '3' ? '3rd' : '4th'} Year — Block {joinClassBlock}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setJoinClassModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmJoinClass}
                disabled={!joinClassBlock}
                className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Confirm & Add
              </button>
            </div>
          </div>
        </div>
      )}

      {showScrollTop && (
        <button
          type="button"
          onClick={handleScrollToTop}
          className="fixed bottom-6 right-6 z-40 rounded-full bg-blue-600 text-white p-3 shadow-lg cursor-pointer hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
          aria-label="Scroll to top"
          title="Scroll to top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default StudentManagement;
