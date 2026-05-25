import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  Search,
  Users,
  BookOpen,
  ArrowLeft,
  X,
  Pencil,
  Check,
  Building2,
  Laptop,
  Mail,
  IdCard,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  UserX,
  UserPlus,
  ClipboardEdit,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ChevronRight,
  GraduationCap,
  BookMarked,
  Layers,
  Hash
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCurriculums, getCoursesByCurriculum, getStudents } from '../../models/curriculumModels';
import {
  assignCourseToProfessor,
  unassignCourseFromProfessor,
  updateAssignedCourseBlocks,
  getStudentsForCourse,
  getIrregularStudentsForProfessor,
  setStudentEnrollment,
  setStudentNotEnrolled,
  getOtherDepartments,
  getOtherDeptClasses
} from '../../models/facultyModels';


const SEMESTER_LABELS = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };

const YEAR_TABS = [
  { value: 1, label: '1st Year' },
  { value: 2, label: '2nd Year' },
  { value: 3, label: '3rd Year' },
  { value: 4, label: '4th Year' }
];

const IRREGULAR_MODAL_TAB = '__irregular_students__';

/* ─────────────────────────────────────────────
   STATUS BADGE HELPERS
───────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const map = {
    assigned:    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Assigned' },
    unassigned:  { bg: 'bg-gray-50',    text: 'text-gray-500',    border: 'border-gray-200',    dot: 'bg-gray-400',    label: 'Unassigned' },
    conflict:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500',    label: 'Conflict' },
    available:   { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500',    label: 'Available' },
  };
  const s = map[status] || map.unassigned;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.bg} ${s.text} ${s.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};



/* ─────────────────────────────────────────────
   BLOCK TOGGLE
───────────────────────────────────────────── */
const BlockToggle = ({ value, onChange, availableBlocks = [], unavailableBlocks = [] }) => {
  const blocksToShow = availableBlocks.length > 0 ? availableBlocks : ['A'];
  const unavailableSet = new Set(
    (unavailableBlocks || [])
      .map(b => (b || '').toString().trim().toUpperCase())
      .filter(Boolean)
  );

  const toggle = (b) => {
    const has = value.includes(b);
    if (!has && unavailableSet.has(b)) return;
    onChange(has ? value.filter(x => x !== b) : [...value, b].sort());
  };

  return (
    <div className="flex flex-wrap gap-2">
      {blocksToShow.map(b => {
        const active      = value.includes(b);
        const unavailable = unavailableSet.has(b) && !active;
        return (
          <button
            key={b}
            type="button"
            onClick={() => toggle(b)}
            title={unavailable ? 'Assigned to another professor' : undefined}
            disabled={unavailable}
            className={`relative min-w-[40px] rounded-lg border cursor-pointer p-2 text-sm font-bold transition-all duration-150 ${
              active
                ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200 scale-105'
                : unavailable
                  ? 'border-rose-200 bg-rose-50 text-rose-300 opacity-50 cursor-not-allowed line-through'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 hover:scale-105'
            }`}
          >
            {b}
            {unavailable && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-rose-400 border border-white" title="Taken" />
            )}
          </button>
        );
      })}
    </div>
  );
};

/* ─────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────── */
const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 shadow-inner">
      <Icon className="h-8 w-8 text-gray-400" />
    </div>
    <p className="text-base font-semibold text-gray-700">{title}</p>
    {description && <p className="mt-1.5 max-w-xs text-sm text-gray-400">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
const ProfessorDetail = ({ professorId, activeTerm, onBack, onViewModeChange, viewMode }) => {
  const [professor, setProfessor] = useState(null);
  const [studentsSource, setStudentsSource] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState('');
  const [assignedYearTab, setAssignedYearTab] = useState(1);

  const activeSemester = Number(activeTerm?.semester);
  const forceActiveSemester = [1, 2, 3].includes(activeSemester);

  const [sortBy, setSortBy] = useState('courseCode');
  const [sortOrder, setSortOrder] = useState('asc');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState('ccs');
  const [curriculums, setCurriculums] = useState([]);
  const [pickerCurriculumId, setPickerCurriculumId] = useState('');
  const [pickerCourses, setPickerCourses] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSemesterFilter, setPickerSemesterFilter] = useState('all');
  const [pickerYearTab, setPickerYearTab] = useState(1);
  const [pickerCourseBlocks, setPickerCourseBlocks] = useState({});
  const [pickerSortBy, setPickerSortBy] = useState('courseCode');
  const [pickerSortOrder, setPickerSortOrder] = useState('asc');
  const [pickerError, setPickerError] = useState('');
  const [savingCourseIds, setSavingCourseIds] = useState(() => new Set());
  const [assignedBlocksByOthers, setAssignedBlocksByOthers] = useState({});

  const [otherDepts, setOtherDepts] = useState([]);
  const [otherDeptId, setOtherDeptId] = useState('');
  const [otherClasses, setOtherClasses] = useState([]);
  const [otherClassesLoading, setOtherClassesLoading] = useState(false);
  const [otherSelectedClass, setOtherSelectedClass] = useState(null);
  const [otherSelectedCourse, setOtherSelectedCourse] = useState('');
  const [otherCurriculumId, setOtherCurriculumId] = useState('');
  const [otherCurriculumCourses, setOtherCurriculumCourses] = useState([]);
  const [otherCurriculumLoading, setOtherCurriculumLoading] = useState(false);
  const [otherSubjectSearch, setOtherSubjectSearch] = useState('');
  const [otherBlocks, setOtherBlocks] = useState([]);
  const [otherCourseBlocks, setOtherCourseBlocks] = useState({});
  const [otherBlockModalOpen, setOtherBlockModalOpen] = useState(false);
  const [otherModalCourse, setOtherModalCourse] = useState(null);
  const [otherModalBlocks, setOtherModalBlocks] = useState([]);
  const [ccsBlockModalOpen, setCcsBlockModalOpen] = useState(false);
  const [ccsModalCourse, setCcsModalCourse] = useState(null);
  const [ccsModalBlocks, setCcsModalBlocks] = useState([]);
  const [otherError, setOtherError] = useState('');
  const [otherSemesterFilter, setOtherSemesterFilter] = useState('all');
  const [otherSortBy, setOtherSortBy] = useState('courseCode');
  const [otherSortOrder, setOtherSortOrder] = useState('asc');
  const [otherYearTab, setOtherYearTab] = useState(1);

  const [editingBlocksFor, setEditingBlocksFor] = useState(null);
  const [editingBlocksValue, setEditingBlocksValue] = useState([]);
  const [savingBlocks, setSavingBlocks] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [activeBlockTab, setActiveBlockTab] = useState(null);
  const [studentSort, setStudentSort] = useState({ key: 'name', direction: 'asc' });

  const [irregularStudents, setIrregularStudents] = useState([]);
  const [irregularLoading, setIrregularLoading] = useState(false);
  const [irregularError, setIrregularError] = useState('');
  const [enrollingStudentId, setEnrollingStudentId] = useState(null);

  const [isAddingIrregularStudent, setIsAddingIrregularStudent] = useState(false);
  const [manualIrregularName, setManualIrregularName] = useState('');
  const [manualIrregularNumber, setManualIrregularNumber] = useState('');
  const [manualIrregularBlock, setManualIrregularBlock] = useState('');
  const [manualIrregularError, setManualIrregularError] = useState('');

  const [confirmUnassign, setConfirmUnassign] = useState(null);
  const [confirmIrregularAction, setConfirmIrregularAction] = useState(null);

  const [editAssignmentOpen, setEditAssignmentOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editForm, setEditForm] = useState({
    courseCode: '', courseTitle: '', units: '', yearLevel: '', semester: '', blocks: []
  });
  const [savingAssignment, setSavingAssignment] = useState(false);

  const previousTermRef = useRef(null);
  const assignedCourses = professor?.assignedCourses || [];

  const currentProfessorAssignedCourseIds = useMemo(
    () => new Set(assignedCourses.map(c => c.courseId)),
    [assignedCourses]
  );

  const getYearLabel = (year) => {
    const n = Number(year);
    if (n === 1) return '1st Year';
    if (n === 2) return '2nd Year';
    if (n === 3) return '3rd Year';
    if (n === 4) return '4th Year';
    return `${year}th year`;
  };

  const getCourseLabel = (assignment) => {
    if (assignment?.source === 'other-department') {
      return assignment.classCourse || assignment.departmentName || 'Other';
    }
    return 'BSCS';
  };

  const getYearBlockLabel = (assignment) => {
    const blocks = assignment?.blocks || [];
    const blockText = blocks.length > 0 ? blocks.join(', ') : '-';
    return `${getCourseLabel(assignment)} ${getYearLabel(assignment?.yearLevel)} · Blk. ${blockText}`;
  };

  const handleSort = (column) => {
    if (sortBy === column) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(column); setSortOrder('asc'); }
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <ChevronsUpDown className="ml-1 inline-flex h-3.5 w-3.5 opacity-50" />;
    return sortOrder === 'asc'
      ? <ChevronUp className="ml-1 inline-flex h-3.5 w-3.5 text-blue-300" />
      : <ChevronDown className="ml-1 inline-flex h-3.5 w-3.5 text-blue-300" />;
  };

  const assignedSubjectsByYear = useMemo(() => {
    const list = assignedCourses.filter(c => Number(c.yearLevel) === assignedYearTab);
    return [...list].sort((a, b) => {
      let aValue = '', bValue = '';
      if (sortBy === 'units') {
        aValue = Number(a.units) || 0; bValue = Number(b.units) || 0;
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      if (sortBy === 'yearLevel') {
        aValue = Number(a.yearLevel) || 0; bValue = Number(b.yearLevel) || 0;
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      if (sortBy === 'blocks') {
        aValue = (a.blocks || []).join(', ').toUpperCase();
        bValue = (b.blocks || []).join(', ').toUpperCase();
      } else if (sortBy === 'curriculum') {
        aValue = (a.source === 'other-department' ? a.departmentName : a.curriculumName || '').toString().toUpperCase();
        bValue = (b.source === 'other-department' ? b.departmentName : b.curriculumName || '').toString().toUpperCase();
      } else {
        aValue = (a[sortBy] || '').toString().toUpperCase();
        bValue = (b[sortBy] || '').toString().toUpperCase();
      }
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });
  }, [assignedCourses, assignedYearTab, sortBy, sortOrder]);

  const assignedYearCounts = useMemo(() => {
    const counts = YEAR_TABS.reduce((acc, year) => {
      acc[year.value] = assignedCourses.filter(c => Number(c.yearLevel) === year.value).length;
      return acc;
    }, {});
    counts['irregular'] = irregularStudents.length;
    return counts;
  }, [assignedCourses, irregularStudents.length]);

  const getBlocksForYear = (year, isIrregular = false) => {
    const set = new Set();
    studentsSource.forEach(s => {
      if (Number(s.yearLevel) === Number(year) && (isIrregular ? s.isIrregular : !s.isIrregular)) {
        const block = s && s.block && String(s.block).trim() !== ''
          ? String(s.block).trim().toUpperCase() : 'A';
        set.add(block);
      }
    });
    const blocks = Array.from(set).sort((a, b) => a.localeCompare(b));
    if (blocks.length === 0) return ['A'];
    return blocks;
  };

  const normalizeBlockList = (blocks = []) =>
    Array.from(new Set(
      (blocks || []).map(b => (b || '').toString().trim().toUpperCase()).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));

  const getTakenBlocksForCourse = (courseId) => assignedBlocksByOthers[courseId] || [];

  const getFreeBlocksForCourse = (courseId, candidateBlocks = []) => {
    const taken = new Set(getTakenBlocksForCourse(courseId));
    return normalizeBlockList(candidateBlocks).filter(block => !taken.has(block));
  };

  const getAvailableBlocksForAssignment = (assignment) => {
    if (assignment?.source === 'other-department') {
      return assignment.blocks?.length ? assignment.blocks : ['A'];
    }
    return getBlocksForYear(assignment?.yearLevel, false);
  };

  const getEditableBlocksForAssignment = (assignment) => {
    if (!assignment?.courseId) return { allBlocks: [], blockedByOthers: [] };
    const ownBlocks = normalizeBlockList(assignment.blocks || []);
    const allBlocks = normalizeBlockList(getAvailableBlocksForAssignment(assignment));
    const blockedByOthers = normalizeBlockList(
      getTakenBlocksForCourse(assignment.courseId).filter(block => !ownBlocks.includes(block))
    );
    return { allBlocks, blockedByOthers };
  };

  const refreshProfessor = async ({ tableOnly = false } = {}) => {
    if (tableOnly) setTableLoading(true); else setLoading(true);
    setError('');
    try {
      const [professorSnap, studentsRes] = await Promise.all([
        getDoc(doc(db, 'professors', professorId)),
        getStudents()
      ]);
      if (professorSnap.exists()) setProfessor({ id: professorSnap.id, ...professorSnap.data() });
      else toast.error('Professor not found.');
      if (studentsRes.success) setStudentsSource(studentsRes.data);
    } catch (err) {
      toast.error(err.message || 'Failed to load professor.');
    }
    if (tableOnly) setTableLoading(false); else setLoading(false);
  };

  useEffect(() => { refreshProfessor(); }, [professorId]);
  useEffect(() => { if (viewMode === 'detail') setPickerOpen(false); }, [viewMode]);
  useEffect(() => { onViewModeChange?.(pickerOpen ? 'assign' : 'detail'); }, [pickerOpen, onViewModeChange]);
  useEffect(() => { return () => onViewModeChange?.('detail'); }, [onViewModeChange]);
  useEffect(() => {
    if (!selectedSubject) return;
    const onKey = (e) => { if (e.key === 'Escape') closeStudentsModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedSubject]);

  useEffect(() => {
    const resetAssignmentsOnTermChange = async () => {
      const currentTermStr = `${activeTerm?.semester}-${activeTerm?.schoolYear}`;
      const previousTermStr = previousTermRef.current;
      if (previousTermStr === null) { previousTermRef.current = currentTermStr; return; }
      if (previousTermStr === currentTermStr) return;
      previousTermRef.current = currentTermStr;
      if (!professor?.assignedCourses || professor.assignedCourses.length === 0) return;
      try {
        const coursesToUnassign = [...professor.assignedCourses];
        await Promise.all(coursesToUnassign.map(course =>
          unassignCourseFromProfessor(professorId, course.courseId, { suppressLog: true })
        ));
        await refreshProfessor({ tableOnly: true });
        const allProfsSnap = await getDocs(collection(db, 'professors'));
        const taken = {};
        allProfsSnap.forEach(snap => {
          if (snap.id === professorId) return;
          const courses = snap.data()?.assignedCourses || [];
          courses.forEach(c => {
            const key = c.courseId;
            const blocks = normalizeBlockList(c.blocks);
            const blockList = blocks.length > 0 ? blocks : ['A'];
            taken[key] = taken[key] || [];
            taken[key].push(...blockList);
            taken[key] = normalizeBlockList(taken[key]);
          });
        });
        setAssignedBlocksByOthers(taken);
      } catch (err) { console.error('Failed to reset assignments:', err); }
    };
    resetAssignmentsOnTermChange();
  }, [activeTerm]);

  const closeStudentsModal = () => {
    setSelectedSubject(null); setStudents([]); setStudentSearch(''); setActiveBlockTab(null);
  };

  const loadIrregularStudents = async () => {
    if (!professorId || !activeTerm?.semester || !activeTerm?.schoolYear) { setIrregularStudents([]); return; }
    setIrregularError(''); setIrregularLoading(true);
    try {
      const res = await getIrregularStudentsForProfessor(professorId, activeTerm);
      if (res.success) setIrregularStudents(res.data);
      else { setIrregularStudents([]); toast.error(res.error || 'Failed to load irregular students.'); }
    } catch (err) { setIrregularStudents([]); toast.error(err.message || 'Failed to load irregular students.'); }
    finally { setIrregularLoading(false); }
  };

  useEffect(() => {
    if (assignedYearTab === 'irregular') loadIrregularStudents();
  }, [assignedYearTab, professorId, activeTerm]);

  const scheduleIrregularStudentAction = (student, action) => setConfirmIrregularAction({ student, action });

  const executeIrregularStudentAction = async () => {
    if (!confirmIrregularAction?.student || !confirmIrregularAction?.action) return;
    const { student, action } = confirmIrregularAction;
    if (!activeTerm?.semester || !activeTerm?.schoolYear) {
      toast.error('Please select an active term to update the student enrollment.');
      setConfirmIrregularAction(null); return;
    }
    setError(''); setEnrollingStudentId(student.id); setConfirmIrregularAction(null);
    try {
      const res = action === 'unenroll'
        ? await setStudentNotEnrolled(student.id)
        : await setStudentEnrollment(student.id, activeTerm);
      if (!res.success) throw new Error(res.error || 'Failed to update the student enrollment.');
      setIrregularStudents(prev => prev.map(s => (
        s.id === student.id
          ? { ...s, enrolledTerm: action === 'unenroll' ? {} : { semester: Number(activeTerm.semester), schoolYear: activeTerm.schoolYear } }
          : s
      )));
    } catch (err) { toast.error(err.message || 'Failed to update the student enrollment.'); }
    finally { setEnrollingStudentId(null); }
  };

  const availableBlocks = useMemo(() => {
    const regularStudents = students.filter(s => !s.isIrregular);
    const assigned = selectedSubject?.blocks;
    if (assigned && assigned.length > 0) {
      return [...assigned].map(b => String(b).trim().toUpperCase()).sort((a, b) => a.localeCompare(b));
    }
    const set = new Set();
    regularStudents.forEach(s => {
      const b = s.block && String(s.block).trim() !== '' ? String(s.block).trim().toUpperCase() : 'A';
      set.add(b);
    });
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return sorted.length > 0 ? sorted : ['A'];
  }, [selectedSubject, students]);

  const irregularStudentsForSubject = useMemo(() => students.filter(s => s.isIrregular), [students]);

  const getIrregularJoinedBlock = useCallback((student) => {
    if (!student.isIrregular) return null;
    const activeSem = Number(activeTerm?.semester) || 1;
    const semKey = `sem${activeSem}`;
    const targetCode = (selectedSubject?.courseCode || '').toString().trim().toUpperCase();
    const items = ((student.irregularSubjects || {})[semKey]) || [];
    const match = items.find(item => (item.courseCode || '').toString().trim().toUpperCase() === targetCode);
    if (match?.joinedBlock) return String(match.joinedBlock).trim().toUpperCase();
    const assigned = (selectedSubject?.blocks || []).map(b => String(b).trim().toUpperCase()).filter(Boolean);
    if (assigned.length === 1) return assigned[0];
    return null;
  }, [activeTerm, selectedSubject]);

  const modalTabs = useMemo(() => {
    const activeSem = Number(activeTerm?.semester) || 1;
    const semKey = `sem${activeSem}`;
    const targetCode = (selectedSubject?.courseCode || '').toString().trim().toUpperCase();
    const assignedBlocks = (selectedSubject?.blocks || []).map(b => String(b).trim().toUpperCase()).filter(Boolean);

    const resolveIrregularBlock = (s) => {
      const items = ((s.irregularSubjects || {})[semKey]) || [];
      const match = items.find(item => (item.courseCode || '').toString().trim().toUpperCase() === targetCode);
      if (match?.joinedBlock) {
        const jb = String(match.joinedBlock).trim().toUpperCase();
        if (availableBlocks.includes(jb)) return jb;
      }
      if (assignedBlocks.length === 1) return assignedBlocks[0];
      return null;
    };

    const blockTabs = availableBlocks.map(block => {
      const count = students.filter(s => {
        if (s.isIrregular) return resolveIrregularBlock(s) === block;
        const b = s.block && String(s.block).trim() !== '' ? String(s.block).trim().toUpperCase() : 'A';
        return b === block;
      }).length;
      return { value: block, label: `Block ${block}`, count };
    }).filter(tab => tab.count > 0);

    const irregularsWithoutBlock = irregularStudentsForSubject.filter(s => resolveIrregularBlock(s) === null);
    if (irregularsWithoutBlock.length > 0) {
      blockTabs.push({ value: IRREGULAR_MODAL_TAB, label: 'Irregular', count: irregularsWithoutBlock.length });
    }
    return blockTabs;
  }, [availableBlocks, students, irregularStudentsForSubject, selectedSubject, activeTerm]);

  useEffect(() => {
    if (modalTabs.length > 0) {
      setActiveBlockTab(prev => {
        if (prev && modalTabs.some(tab => tab.value === prev)) return prev;
        return modalTabs[0].value;
      });
    }
  }, [modalTabs]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const onIrregularTab = activeBlockTab === IRREGULAR_MODAL_TAB;
    const activeSem = Number(activeTerm?.semester) || 1;
    const semKey = `sem${activeSem}`;
    const targetCode = (selectedSubject?.courseCode || '').toString().trim().toUpperCase();
    const assignedBlocks = (selectedSubject?.blocks || []).map(b => String(b).trim().toUpperCase()).filter(Boolean);

    const resolveIrregularBlock = (s) => {
      const items = ((s.irregularSubjects || {})[semKey]) || [];
      const match = items.find(item => (item.courseCode || '').toString().trim().toUpperCase() === targetCode);
      if (match?.joinedBlock) {
        const jb = String(match.joinedBlock).trim().toUpperCase();
        if (availableBlocks.includes(jb)) return jb;
      }
      if (assignedBlocks.length === 1) return assignedBlocks[0];
      return null;
    };

    return students.filter(s => {
      if (onIrregularTab) {
        if (!s.isIrregular) return false;
        if (resolveIrregularBlock(s) !== null) return false;
        if (!q) return true;
        return (s.name || '').toLowerCase().includes(q) || (s.studentNumber || '').toLowerCase().includes(q);
      }
      if (s.isIrregular) {
        const resolvedBlock = resolveIrregularBlock(s);
        if (!resolvedBlock || resolvedBlock !== activeBlockTab) return false;
        if (!q) return true;
        return (s.name || '').toLowerCase().includes(q) || (s.studentNumber || '').toLowerCase().includes(q);
      }
      const block = s.block && String(s.block).trim() !== '' ? String(s.block).trim().toUpperCase() : 'A';
      if (activeBlockTab && block !== activeBlockTab) return false;
      if (!q) return true;
      return (s.name || '').toLowerCase().includes(q) || (s.studentNumber || '').toLowerCase().includes(q);
    });
  }, [students, studentSearch, activeBlockTab, availableBlocks, selectedSubject, activeTerm]);

  const sortedStudents = useMemo(() => {
    if (!filteredStudents) return [];
    return [...filteredStudents].sort((a, b) => {
      const direction = studentSort.direction === 'asc' ? 1 : -1;
      if (studentSort.key === 'name') return direction * (a.name || '').localeCompare(b.name || '');
      if (studentSort.key === 'studentNumber') return direction * ((a.studentNumber || '').localeCompare(b.studentNumber || ''));
      return 0;
    });
  }, [filteredStudents, studentSort]);

  const resetOtherForm = () => {
    setOtherDeptId(''); setOtherClasses([]); setOtherSelectedClass(null);
    setOtherSelectedCourse(''); setOtherCurriculumId(''); setOtherCurriculumCourses([]);
    setOtherSubjectSearch(''); setOtherBlocks([]); setOtherError('');
    setOtherCourseBlocks({});
    setOtherYearTab(1); setOtherSemesterFilter('all');
  };

  const openPicker = async () => {
    setPickerOpen(true); setSavingCourseIds(new Set()); setPickerTab('ccs');
    setPickerSearch(''); setPickerSemesterFilter('all'); setPickerCurriculumId('');
    setPickerCourses([]); setPickerYearTab(1); setPickerCourseBlocks({});
    setPickerError(''); resetOtherForm();
    const [curRes, deptRes, studentsRes, allProfsSnap] = await Promise.all([
      getCurriculums(), getOtherDepartments(), getStudents(), getDocs(collection(db, 'professors'))
    ]);
    if (curRes.success) setCurriculums(curRes.data);
    if (deptRes.success) setOtherDepts(deptRes.data);
    if (studentsRes.success) setStudentsSource(studentsRes.data);
    const taken = {};
    allProfsSnap.forEach(snap => {
      if (snap.id === professorId) return;
      const courses = snap.data()?.assignedCourses || [];
      courses.forEach(c => {
        const key = c.courseId;
        const blocks = normalizeBlockList(c.blocks);
        const blockList = blocks.length > 0 ? blocks : ['A'];
        taken[key] = taken[key] || [];
        taken[key].push(...blockList);
        taken[key] = normalizeBlockList(taken[key]);
      });
    });
    setAssignedBlocksByOthers(taken);
  };

  useEffect(() => {
    const loadCourses = async () => {
      if (!pickerCurriculumId) { setPickerCourses([]); return; }
      setPickerLoading(true);
      const res = await getCoursesByCurriculum(pickerCurriculumId);
      if (res.success) setPickerCourses(res.data);
      setPickerLoading(false);
    };
    loadCourses();
  }, [pickerCurriculumId]);

  useEffect(() => {
    const loadOtherClasses = async () => {
      if (!otherDeptId) { setOtherClasses([]); setOtherSelectedClass(null); setOtherSelectedCourse(''); return; }
      setOtherClassesLoading(true);
      const res = await getOtherDeptClasses(otherDeptId, activeTerm);
      if (res.success) setOtherClasses(res.data);
      setOtherClassesLoading(false); setOtherSelectedClass(null); setOtherSelectedCourse(''); setOtherBlocks([]);
    };
    loadOtherClasses();
  }, [otherDeptId, activeTerm]);

  useEffect(() => {
    const loadOtherCurriculumCourses = async () => {
      if (!otherCurriculumId) { setOtherCurriculumCourses([]); return; }
      setOtherCurriculumLoading(true);
      const res = await getCoursesByCurriculum(otherCurriculumId);
      if (res.success) setOtherCurriculumCourses(res.data);
      setOtherCurriculumLoading(false);
    };
    loadOtherCurriculumCourses();
  }, [otherCurriculumId]);

  const filteredPickerCourses = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return pickerCourses.filter(c => {
      const matchesYear = Number(c.yearLevel) === pickerYearTab;
      if (!matchesYear) return false;
      if (forceActiveSemester && Number(c.semester) !== activeSemester) return false;
      if (!forceActiveSemester && pickerSemesterFilter !== 'all' && Number(c.semester) !== Number(pickerSemesterFilter)) return false;
      if (!q) return true;
      return (c.courseCode || '').toLowerCase().includes(q) || (c.courseTitle || '').toLowerCase().includes(q);
    });
  }, [pickerCourses, pickerSearch, pickerYearTab, pickerSemesterFilter, forceActiveSemester, activeSemester]);

  const handlePickerSort = (col) => {
    if (pickerSortBy === col) setPickerSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setPickerSortBy(col); setPickerSortOrder('asc'); }
  };

  const PickerSortIcon = ({ col }) => {
    if (pickerSortBy !== col) return <ChevronsUpDown className="ml-1 inline-flex h-3 w-3 opacity-50" />;
    return pickerSortOrder === 'asc'
      ? <ChevronUp className="ml-1 inline-flex h-3 w-3 text-blue-200" />
      : <ChevronDown className="ml-1 inline-flex h-3 w-3 text-blue-200" />;
  };

  const sortedPickerCourses = useMemo(() => {
    const list = [...filteredPickerCourses];
    return list.sort((a, b) => {
      if (pickerSortBy === 'units') {
        const aVal = Number(a.units) || 0, bVal = Number(b.units) || 0;
        return pickerSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (pickerSortBy === 'semester') {
        const aVal = Number(a.semester) || 0, bVal = Number(b.semester) || 0;
        return pickerSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aVal = (a[pickerSortBy] || '').toString();
      const bVal = (b[pickerSortBy] || '').toString();
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
      return pickerSortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredPickerCourses, pickerSortBy, pickerSortOrder]);

  const pickerYearCounts = useMemo(() => {
    return YEAR_TABS.reduce((acc, year) => {
      const q = pickerSearch.trim().toLowerCase();
      acc[year.value] = pickerCourses.filter(c => {
        if (Number(c.yearLevel) !== year.value) return false;
        if (forceActiveSemester && Number(c.semester) !== activeSemester) return false;
        if (!forceActiveSemester && pickerSemesterFilter !== 'all' && Number(c.semester) !== Number(pickerSemesterFilter)) return false;
        if (!q) return true;
        return (c.courseCode || '').toLowerCase().includes(q) || (c.courseTitle || '').toLowerCase().includes(q);
      }).length;
      return acc;
    }, {});
  }, [pickerCourses, pickerSearch, pickerSemesterFilter, forceActiveSemester, activeSemester]);

  const filteredOtherCourses = useMemo(() => {
    const q = otherSubjectSearch.trim().toLowerCase();
    return otherCurriculumCourses.filter(c => {
      if (forceActiveSemester && Number(c.semester) !== activeSemester) return false;
      if (!forceActiveSemester && otherSemesterFilter !== 'all' && Number(c.semester) !== Number(otherSemesterFilter)) return false;
      if (!q) return true;
      return (c.courseCode || '').toLowerCase().includes(q) || (c.courseTitle || '').toLowerCase().includes(q);
    });
  }, [otherCurriculumCourses, otherSubjectSearch, otherSemesterFilter, forceActiveSemester, activeSemester]);

  const handleOtherSort = (col) => {
    if (otherSortBy === col) setOtherSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setOtherSortBy(col); setOtherSortOrder('asc'); }
  };

  const sortedOtherCourses = useMemo(() => {
    const byYear = filteredOtherCourses.filter(c => Number(c.yearLevel) === otherYearTab);
    return [...byYear].sort((a, b) => {
      let aVal, bVal;
      if (otherSortBy === 'units') {
        aVal = Number(a.units) || 0; bVal = Number(b.units) || 0;
        return otherSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (otherSortBy === 'semester') {
        aVal = Number(a.semester) || 0; bVal = Number(b.semester) || 0;
        return otherSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      aVal = (a[otherSortBy] || '').toString().toUpperCase();
      bVal = (b[otherSortBy] || '').toString().toUpperCase();
      return otherSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [filteredOtherCourses, otherSortBy, otherSortOrder, otherYearTab]);

  const otherYearCounts = useMemo(() => {
    return YEAR_TABS.reduce((acc, year) => {
      acc[year.value] = filteredOtherCourses.filter(c => Number(c.yearLevel) === year.value).length;
      return acc;
    }, {});
  }, [filteredOtherCourses]);

  const otherCourseOptions = useMemo(() => {
    return Array.from(new Set(
      otherClasses.map(c => (c.course || '').toString().trim()).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [otherClasses]);

  const otherYearOptions = useMemo(() => {
    if (!otherSelectedCourse) return [];
    return otherClasses
      .filter(c => (c.course || '').toString().trim().toLowerCase() === otherSelectedCourse.toLowerCase())
      .sort((a, b) => Number(a.yearLevel) - Number(b.yearLevel));
  }, [otherClasses, otherSelectedCourse]);

  const otherSelectionComplete = Boolean(otherDeptId && otherCurriculumId && otherSelectedCourse && otherSelectedClass);

  /* Compute other dept step for progress indicator */
  const otherStep = !otherDeptId ? 0 : !otherCurriculumId ? 1 : !otherSelectedCourse ? 2 : !otherSelectedClass ? 3 : 4;

  const OtherSortIcon = ({ col }) => {
    if (otherSortBy !== col) return <ChevronsUpDown className="ml-1 inline-flex h-3 w-3 opacity-50" />;
    return otherSortOrder === 'asc'
      ? <ChevronUp className="ml-1 inline-flex h-3 w-3 text-blue-200" />
      : <ChevronDown className="ml-1 inline-flex h-3 w-3 text-blue-200" />;
  };

  const StudentSortIcon = ({ column }) => {
    if (studentSort.key !== column) return <ChevronsUpDown className="ml-1 inline-flex h-3 w-3 opacity-50" />;
    return studentSort.direction === 'asc'
      ? <ChevronUp className="ml-1 inline-flex h-3 w-3 text-blue-200" />
      : <ChevronDown className="ml-1 inline-flex h-3 w-3 text-blue-200" />;
  };

  const handleStudentSort = (key) => {
    setStudentSort(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const setCourseSaving = (courseId, isSaving) => {
    setSavingCourseIds(prev => {
      const next = new Set(prev);
      if (isSaving) next.add(courseId); else next.delete(courseId);
      return next;
    });
  };

  const getPickerBlocksForCourse = (course) => {
    if (!course?.id) return [];
    return pickerCourseBlocks[course.id] || [];
  };

  const toggleCcsAssignment = async (course, nextChecked) => {
    if (!pickerCurriculumId) { toast.error('Select a curriculum first.'); return; }
    if (!course?.id) return;
    const courseId = course.id;
    setPickerError(''); setError(''); setCourseSaving(courseId, true);
    try {
      if (nextChecked) {
        const curriculum = curriculums.find(c => c.id === pickerCurriculumId);
        const blocks = pickerCourseBlocks[course.id] || [];
        if (blocks.length === 0) { toast.error('Select blocks before assigning this subject.'); return; }
        const freeBlocks = getFreeBlocksForCourse(courseId, blocks);
        if (freeBlocks.length === 0) { toast.error('Selected blocks are already assigned to other professors.'); return; }
        const res = await assignCourseToProfessor(professorId, {
          courseId, courseCode: course.courseCode, courseTitle: course.courseTitle,
          curriculumId: pickerCurriculumId, curriculumName: curriculum?.name || '',
          yearLevel: course.yearLevel, semester: course.semester, units: course.units, blocks: freeBlocks
        });
        if (!res.success) toast.error(res.error || 'Failed to assign subject.');
        else toast.success('Subject assigned successfully!');
      } else {
        const res = await unassignCourseFromProfessor(professorId, courseId);
        if (!res.success) toast.error(res.error || 'Failed to unassign subject.');
        else toast.success('Subject unassigned.');
      }
      await refreshProfessor({ tableOnly: true });
    } finally { setCourseSaving(courseId, false); }
  };

  const toggleOtherAssignment = async (subject, nextChecked) => {
    setOtherError(''); setError('');
    if (!otherSelectedClass) { setOtherError('Select a class first.'); return; }
    if (!otherCurriculumId) { setOtherError('Select a curriculum first.'); return; }
    const courseId = `other::${otherDeptId}::${otherSelectedClass.course.toLowerCase()}::${otherSelectedClass.yearLevel}::${subject.id}`;
    const selectedBlocks = otherCourseBlocks[courseId] || otherBlocks || [];
    if (nextChecked && normalizeBlockList(selectedBlocks).length === 0) { setOtherError('Select at least one block.'); return; }
    if (!subject?.id) return;
    setCourseSaving(courseId, true);
    try {
      if (nextChecked) {
        const freeBlocks = getFreeBlocksForCourse(courseId, selectedBlocks);
        if (freeBlocks.length === 0) { toast.error('Selected blocks are already assigned to other professors.'); return; }
        const dept = otherDepts.find(d => d.id === otherDeptId);
        const curriculum = curriculums.find(c => c.id === otherCurriculumId);
        const res = await assignCourseToProfessor(professorId, {
          source: 'other-department', courseId, subjectId: subject.id,
          courseCode: subject.courseCode, courseTitle: subject.courseTitle,
          curriculumId: otherCurriculumId, curriculumName: curriculum?.name || '',
          departmentId: otherDeptId, departmentName: dept?.name || '',
          classCourse: otherSelectedClass.course, yearLevel: otherSelectedClass.yearLevel,
          units: Number(subject.units) || 0, blocks: freeBlocks
        });
        if (!res.success) toast.error(res.error || 'Failed to assign class.');
        else toast.success('Class assigned successfully!');
      } else {
        const res = await unassignCourseFromProfessor(professorId, courseId);
        if (!res.success) toast.error(res.error || 'Failed to unassign class.');
        else toast.success('Class unassigned.');
      }
      await refreshProfessor({ tableOnly: true });
    } finally { setCourseSaving(courseId, false); }
  };

  const getExistingAssignmentBlocks = (courseId) => {
    const assignment = assignedCourses.find(c => c.courseId === courseId);
    return assignment ? normalizeBlockList(assignment.blocks || []) : [];
  };

  const openOtherBlockModal = (course) => {
    const otherCourseId = getOtherCourseId(course);
    const initialBlocks = otherCourseId
      ? (otherCourseBlocks[otherCourseId] && otherCourseBlocks[otherCourseId].length > 0
          ? normalizeBlockList(otherCourseBlocks[otherCourseId])
          : getExistingAssignmentBlocks(otherCourseId))
      : (otherBlocks.length > 0 ? normalizeBlockList(otherBlocks) : []);
    setOtherModalCourse(course); setOtherModalBlocks(initialBlocks); setOtherBlockModalOpen(true); setOtherError('');
  };

  const closeOtherBlockModal = () => { setOtherBlockModalOpen(false); setOtherModalCourse(null); setOtherModalBlocks([]); };

  const saveOtherBlockSelection = () => {
    if (otherModalBlocks.length === 0) { setOtherError('Select at least one block.'); return; }
    const otherCourseId = getOtherCourseId(otherModalCourse);
    const normalized = normalizeBlockList(otherModalBlocks);
    if (otherCourseId) {
      setOtherCourseBlocks(prev => ({ ...prev, [otherCourseId]: normalized }));
    } else {
      setOtherBlocks(normalized);
    }
    closeOtherBlockModal();
  };

  const openCcsBlockModal = (course) => {
    const initialBlocks = pickerCourseBlocks[course.id] || getExistingAssignmentBlocks(course.id);
    setCcsModalCourse(course); setCcsModalBlocks(normalizeBlockList(initialBlocks)); setCcsBlockModalOpen(true); setPickerError('');
  };

  const closeCcsBlockModal = () => { setCcsBlockModalOpen(false); setCcsModalCourse(null); setCcsModalBlocks([]); };

  const saveCcsBlockSelection = () => {
    if (ccsModalBlocks.length === 0) { setPickerError('Select at least one block.'); return; }
    setPickerCourseBlocks(prev => ({ ...prev, [ccsModalCourse.id]: normalizeBlockList(ccsModalBlocks) }));
    closeCcsBlockModal();
  };

  const getOtherCourseId = (course) => {
    if (!otherSelectedClass || !otherDeptId || !course?.id) return null;
    return `other::${otherDeptId}::${otherSelectedClass.course.toLowerCase()}::${otherSelectedClass.yearLevel}::${course.id}`;
  };

  const getOtherBlockAvailability = (course) => {
    const classBlocks = normalizeBlockList(otherSelectedClass?.blocks || []);
    const courseId = getOtherCourseId(course);
    const unavailable = courseId ? getTakenBlocksForCourse(courseId) : [];
    return { availableBlocks: classBlocks, unavailableBlocks: unavailable };
  };

  const startEditBlocks = (assignment) => {
    setEditingBlocksFor(assignment.courseId);
    setEditingBlocksValue(normalizeBlockList(assignment.blocks || []));
    setBlockModalOpen(true);
  };

  const cancelEditBlocks = () => { setBlockModalOpen(false); setEditingBlocksFor(null); setEditingBlocksValue([]); };

  const saveEditBlocks = async () => {
    if (!editingBlocksFor) return;
    const assignment = assignedCourses.find(c => c.courseId === editingBlocksFor);
    const editableConfig = assignment ? getEditableBlocksForAssignment(assignment) : { allBlocks: [], blockedByOthers: [] };
    const normalizedSelection = normalizeBlockList(editingBlocksValue);
    if (normalizedSelection.length === 0) { toast.error('Select at least one block.'); return; }
    if (editableConfig.blockedByOthers.length > 0 && normalizedSelection.some(block => editableConfig.blockedByOthers.includes(block))) {
      toast.error('One or more selected blocks are already assigned to other professors.'); return;
    }
    setError(''); setSavingBlocks(true);
    const res = await updateAssignedCourseBlocks(professorId, editingBlocksFor, normalizedSelection);
    setSavingBlocks(false);
    if (res.success) {
      if (selectedSubject?.courseId === editingBlocksFor) {
        const updated = { ...selectedSubject, blocks: normalizedSelection };
        setSelectedSubject(updated); viewStudents(updated);
      }
      cancelEditBlocks(); await refreshProfessor({ tableOnly: true });
      toast.success('Blocks updated successfully.');
    } else toast.error(res.error || 'Failed to update blocks.');
  };

  const handleUnassign = async () => {
    if (!confirmUnassign) return;
    const res = await unassignCourseFromProfessor(professorId, confirmUnassign.courseId);
    if (res.success) {
      if (selectedSubject?.courseId === confirmUnassign.courseId) { setSelectedSubject(null); setStudents([]); }
      setConfirmUnassign(null); await refreshProfessor({ tableOnly: true });
      toast.success('Subject unassigned.');
    } else toast.error(res.error || 'Failed to unassign subject.');
  };

  const openEditAssignment = (assignment) => {
    setEditingAssignment(assignment);
    setEditForm({ courseCode: assignment.courseCode || '', courseTitle: assignment.courseTitle || '',
      units: assignment.units || '', yearLevel: assignment.yearLevel || '',
      semester: assignment.semester || '', blocks: assignment.blocks || [] });
    setEditAssignmentOpen(true);
  };

  const closeEditAssignment = () => {
    setEditAssignmentOpen(false); setEditingAssignment(null);
    setEditForm({ courseCode: '', courseTitle: '', units: '', yearLevel: '', semester: '', blocks: [] });
  };

  const saveEditAssignment = async () => {
    if (!editingAssignment) return;
    setError(''); setSavingAssignment(true);
    try {
      const updatedCourses = professor.assignedCourses.map(c => {
        if (c.courseId === editingAssignment.courseId) {
          return { ...c, courseCode: editForm.courseCode, courseTitle: editForm.courseTitle,
            units: Number(editForm.units) || 0, yearLevel: Number(editForm.yearLevel) || 1,
            semester: Number(editForm.semester) || 1, blocks: editForm.blocks };
        }
        return c;
      });
      const { updateDoc, doc: docRef } = await import('firebase/firestore');
      await updateDoc(docRef(db, 'professors', professorId), { assignedCourses: updatedCourses });
      await refreshProfessor({ tableOnly: true });
      if (selectedSubject?.courseId === editingAssignment.courseId) {
        const updated = { ...selectedSubject, ...editForm };
        setSelectedSubject(updated);
      }
      closeEditAssignment(); toast.success('Assignment updated.');
    } catch (err) { toast.error(err.message || 'Failed to update assignment.'); }
    finally { setSavingAssignment(false); }
  };

  const viewStudents = async (subject) => {
    setSelectedSubject(subject); setStudentsLoading(true); setActiveBlockTab(null); setStudentSearch('');
    const res = await getStudentsForCourse(subject, activeTerm || { semester: 1, schoolYear: '' });
    if (res.success) setStudents(res.data); else toast.error(res.error || 'Failed to load students.');
    setStudentsLoading(false);
  };

  const getStudentCourseLabel = (student, assignment) => {
    if (assignment?.source === 'other-department') return student.course || assignment.classCourse || assignment.departmentName || 'Other';
    return 'BSCS';
  };

  /* ─────────────── LOADING SKELETON ─────────────── */
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 animate-pulse rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200" />
            <div className="flex-1">
              <div className="mb-2 h-6 w-52 animate-pulse rounded-lg bg-gray-100" />
              <div className="h-4 w-80 animate-pulse rounded-lg bg-gray-100" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-50 border border-gray-100" />)}
        </div>
      </div>
    );
  }

  if (!professor) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
        <EmptyState icon={GraduationCap} title="Professor not found" description={error || 'This professor no longer exists.'} />
        <button onClick={onBack} className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition">
          Back to professor list
        </button>
      </div>
    );
  }

  /* ─────────────── MAIN RENDER ─────────────── */
  return (
    <div className="space-y-5">
      {!pickerOpen && (
        <>
          {/* ── Professor Header Card ── */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            {/* Top accent strip */}
            <div className="" />
            <div className="p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                {/* Left */}
                <div className="min-w-0">
                  <button
                    onClick={onBack}
                    className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    All professors
                  </button>
                  <div className="flex items-center gap-3">
                  
                    <div>
                      <h1 className="text-xl font-bold tracking-tight text-gray-900">{professor.name}</h1>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-1.5 text-xs text-gray-600">
                      <IdCard className="h-3.5 w-3.5 text-gray-400" />
                      {professor.employeeId || 'No employee ID'}
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-1.5 text-xs text-gray-600">
                      <Mail className="h-3.5 w-3.5 text-gray-400" />
                      {professor.email || 'No email'}
                    </div>
                  </div>
                </div>

                {/* Right — Stats */}
                <div className="flex  gap-4">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-center min-w-[110px]">
                    <div className="text-2xl font-bold text-blue-700">{assignedCourses.length}</div>
                    <div className="mt-0.5 text-xs font-medium text-blue-500">Subjects Assigned</div>
                  </div>
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4 text-center min-w-[110px]">
                    <div className="text-base font-bold text-indigo-700">{SEMESTER_LABELS[activeTerm?.semester] || '1st Sem'}</div>
                    <div className="mt-0.5 text-xs font-medium text-indigo-500">
                      {activeTerm?.schoolYear ? `S.Y. ${activeTerm.schoolYear}` : 'Active Term'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Subjects Table ── */}
          <div>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshProfessor({ tableOnly: true })}
                  disabled={tableLoading}
                  className="p-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${tableLoading ? 'animate-spin text-blue-500' : ''}`} />
                </button>

                {/* Year Tabs */}
                <div className="flex flex-wrap gap-1.5">
                  {YEAR_TABS.map(year => {
                    const active = assignedYearTab === year.value;
                    const count = assignedYearCounts[year.value] || 0;
                    return (
                      <button
                        key={year.value}
                        type="button"
                        onClick={() => setAssignedYearTab(year.value)}
                        className={`rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
                          active
                            ? 'bg-blue-500 text-white shadow-sm'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
                        }`}
                      >
                        {year.label}
                      
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={openPicker}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Assign Subject
              </button>
            </div>

            

            {/* ── Regular Subjects Table ── */}
            {assignedYearTab !== 'irregular' && (
              <div className="rounded-xl border border-gray-200 bg-white  overflow-hidden">
                <table className="w-full table-fixed text-sm border-separate border-spacing-0">
                  <thead className="bg-blue-500 text-left text-xs uppercase tracking-wider text-white">
                    <tr>
                      <th className="w-[15%] cursor-pointer select-none p-4 " onClick={() => handleSort('courseCode')}>
                        Subject Code <SortIcon column="courseCode" />
                      </th>
                      <th className="w-[28%] cursor-pointer select-none p-4 " onClick={() => handleSort('courseTitle')}>
                        Subject Description <SortIcon column="courseTitle" />
                      </th>
                      <th className="w-[12%] p-4 ">Course</th>
                      <th className="w-[15%] p-4 ">Block/s</th>
                      <th className="w-[18%] cursor-pointer select-none p-4 " onClick={() => handleSort('curriculum')}>
                        Curriculum <SortIcon column="curriculum" />
                      </th>
                      <th className="w-[12%] p-4  text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {tableLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          {[...Array(6)].map((_, j) => (
                            <td key={j} className="p-4">
                              <div className="h-4 animate-pulse rounded-lg bg-gray-100" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : assignedCourses.length === 0 ? (
                      <tr><td colSpan={6}>
                        <EmptyState
                          icon={BookOpen}
                          title="No subjects assigned yet"
                          description="Assign a subject to start managing blocks and students."
                          action={
                            <button onClick={openPicker} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">
                              <Plus className="h-4 w-4" /> Assign Subject
                            </button>
                          }
                        />
                      </td></tr>
                    ) : assignedSubjectsByYear.length === 0 ? (
                      <tr><td colSpan={6}>
                        <EmptyState
                          icon={Layers}
                          title={`No subjects for ${YEAR_TABS.find(y => y.value === assignedYearTab)?.label}`}
                          description="Try another year level or assign a new subject."
                        />
                      </td></tr>
                    ) : (
                      assignedSubjectsByYear.map((c, idx) => {
                        const isOther = c.source === 'other-department';
                        return (
                          <tr
                            key={c.courseId}
                            onClick={() => viewStudents(c)}
                            className={`cursor-pointer border-t border-gray-100 transition-all duration-100 ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                            } hover:bg-blue-50/50 group`}
                          >
                            <td className="p-4">
                              <span className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{c.courseCode}</span>
                            </td>
                            <td className="p-4 text-gray-700">
                              <div className="truncate text-sm" title={c.courseTitle}>{c.courseTitle}</div>
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold ${
                                isOther ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                {getCourseLabel(c)}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1">
                                {(c.blocks?.length ? c.blocks : ['-']).map(b => (
                                  <span key={b} className="rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-xs font-bold text-gray-700 shadow-sm">
                                    {b === '-' ? '—' : b}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="truncate text-xs text-gray-500">
                                {isOther ? c.departmentName || 'Other Department' : c.curriculumName || '—'}
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => setConfirmUnassign(c)}
                              className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                                  title="Unassign"
                                >
                                  <Trash2 className="h-4 w-4" />
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
          </div>
        </>
      )}

      {/* ── ASSIGN PICKER PANEL ── */}
      {pickerOpen && (
        <div>
         

          {/* Source Tabs */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {[
              { key: 'ccs', label: 'CCS Curriculum', icon: Laptop, color: 'blue' },
              { key: 'other', label: 'Other Department', icon: Building2, color: 'amber' }
            ].map(tab => {
              const active = pickerTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => { setPickerTab(tab.key); setPickerError(''); setOtherError(''); }}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
                    active
                      ? tab.key === 'ccs'
                        ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── CCS TAB ── */}
          {pickerTab === 'ccs' && (
            <div className="flex flex-col gap-4">
              {/* Controls Row */}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                {/* Year Tabs */}
                <div className="flex gap-0 border-b border-gray-200">
                  {YEAR_TABS.filter(y => y.value !== 'irregular').map(year => {
                    const isActive = pickerYearTab === year.value;
                    const count = pickerYearCounts[year.value] || 0;
                    return (
                      <button
                        key={year.value}
                        type="button"
                        onClick={() => setPickerYearTab(year.value)}
                        className={`relative px-4 py-2.5 text-sm font-semibold transition-all border-b-2 ${
                          isActive
                            ? 'text-blue-700 border-blue-600'
                            : 'text-gray-500 border-transparent hover:text-gray-800 cursor-pointer'
                        }`}
                      >
                        {year.label}
                        
                      </button>
                    );
                  })}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                  <select
                    value={pickerCurriculumId}
                    onChange={e => { setPickerCurriculumId(e.target.value); setPickerYearTab(1); setPickerError(''); }}
                    className={`rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition ${
                      pickerCurriculumId ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200 text-blue-800 font-medium' : 'border-gray-200 bg-white text-gray-700'
                    } `}
                  >
                    <option value="">Select a curriculum...</option>
                    {curriculums.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search subjects..."
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      disabled={!pickerCurriculumId}
                      className="w-80 border text-sm border-slate-200 bg-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                    />
                  </div>
                </div>
              </div>

              {/* Instruction hint */}
              {pickerCurriculumId && (
                <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700 font-medium">
                    Click <strong>Assign Blocks</strong> on a subject row to choose blocks first, then check the checkbox to assign it to this professor.
                  </p>
                </div>
              )}

              {/* CCS Subjects Table */}
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                {!pickerCurriculumId ? (
                  <EmptyState icon={BookMarked} title="Select a curriculum" description="Choose a curriculum above to see available subjects." />
                ) : pickerLoading ? (
                  <div className="py-10 text-center text-sm text-gray-500">
                    <div className="flex justify-center mb-2">
                      <svg className="animate-spin h-6 w-6 text-blue-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    </div>
                    Loading subjects...
                  </div>
                ) : sortedPickerCourses.length === 0 ? (
                  <EmptyState icon={Search} title="No subjects found" description={pickerSearch ? 'No subjects match your search for this year level.' : `No subjects found for ${YEAR_TABS.find(y => y.value === pickerYearTab)?.label}.`} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-500 text-left text-xs uppercase tracking-wider text-white sticky top-0">
                        <tr>
                          <th className=" p-4 w-[5%]">Assign</th>
                          <th className="p-4 w-[5%]">Select</th>
                          <th className="cursor-pointer select-none p-4   w-[15%]" onClick={() => handlePickerSort('courseCode')}>
                            Subject Code <PickerSortIcon col="courseCode" />
                          </th>
                          <th className="cursor-pointer select-none p-4  w-[30%]" onClick={() => handlePickerSort('courseTitle')}>
                            Subject Description <PickerSortIcon col="courseTitle" />
                          </th>
                          <th className="cursor-pointer select-none p-4  w-[10%]" onClick={() => handlePickerSort('units')}>
                            Units <PickerSortIcon col="units" />
                          </th>
                          <th className="p-4  w-[20%]">Blocks</th>
                          <th className="p-4  w-[15%] text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {sortedPickerCourses.map((course, idx) => {
                          const assignedToThis = currentProfessorAssignedCourseIds.has(course.id);
                          const availableBlocksForCourse = getBlocksForYear(course.yearLevel, false);
                          const freeBlocks = getFreeBlocksForCourse(course.id, availableBlocksForCourse);
                          const noBlocksSelected = !assignedToThis && getPickerBlocksForCourse(course).length === 0;
                          const assignedElsewhere = !assignedToThis && freeBlocks.length === 0;
                          const isSaving = savingCourseIds.has(course.id);
                          const selectedBlocks = getPickerBlocksForCourse(course);

                          return (
                            <tr
                              key={course.id}
                              className={`transition-all duration-100 ${
                                assignedElsewhere ? 'opacity-50 bg-rose-50/30' :
                                assignedToThis    ? 'bg-emerald-50/60' :
                                idx % 2 === 0     ? 'bg-white' : 'bg-gray-50/40'
                              } hover:bg-blue-50/50`}
                            >
                              {/* Assign Blocks Button */}
                              <td className="p-4">
                                <button
                                  type="button"
                                  onClick={() => openCcsBlockModal(course)}
                                  disabled={assignedToThis || assignedElsewhere}
                                  className={`inline-flex items-center gap-1.5 rounded-xl p-1.5 text-xs font-semibold transition-all ${
                                    assignedToThis || assignedElsewhere
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : selectedBlocks.length > 0
                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer'
                                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer'
                                  }`}
                                >
                                  {assignedToThis ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ClipboardEdit className="h-3.5 w-3.5" />}
                                </button>
                              </td>

                              {/* Checkbox */}
                              <td className="p-4">
                                {isSaving ? (
                                  <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={assignedToThis}
                                    disabled={assignedElsewhere || isSaving || noBlocksSelected}
                                    onChange={e => toggleCcsAssignment(course, e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                )}
                              </td>

                              <td className="p-4 font-bold text-gray-900">{course.courseCode}</td>
                              <td className="p-4 text-gray-700">
                                <div className="max-w-[260px] truncate text-sm" title={course.courseTitle}>{course.courseTitle}</div>
                              </td>
                              <td className="p-4 text-gray-600 text-left">
                                {Number(course.units) > 0 ? course.units : '—'}
                              </td>
                              <td className="p-4">
                                {selectedBlocks.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {selectedBlocks.map(b => (
                                      <span key={b} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{b}</span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">None selected</span>
                                )}
                              </td>
                              <td className="p-4 text-left">
                                <StatusBadge status={assignedElsewhere ? 'conflict' : assignedToThis ? 'assigned' : selectedBlocks.length > 0 ? 'available' : 'unassigned'} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── OTHER DEPT TAB ── */}
          {pickerTab === 'other' && (
            <div className="flex flex-col gap-5">
              

              {/* Dropdowns Grid */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                {/* Department */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">1</span>
                    Department
                  </label>
                  <select
                    value={otherDeptId}
                    onChange={e => { setOtherDeptId(e.target.value); setOtherYearTab(1); setOtherSelectedClass(null); setOtherSelectedCourse(''); setOtherCurriculumId(''); setOtherBlocks([]); }}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition shadow-sm ${
                      otherDeptId ? 'border-blue-300 bg-blue-50 text-blue-800 font-medium' : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <option value="">Select department...</option>
                    {otherDepts.map(d => <option key={d.id} value={d.id}>{d.name}{d.code ? ` ` : ''}</option>)}
                  </select>
                </div>

                {/* Curriculum */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${otherDeptId ? 'bg-blue-600' : 'bg-gray-300'}`}>2</span>
                    Curriculum
                  </label>
                  <select
                    value={otherCurriculumId}
                    onChange={e => { setOtherCurriculumId(e.target.value); setOtherSelectedCourse(''); setOtherSelectedClass(null); setOtherBlocks([]); setOtherSubjectSearch(''); }}
                    disabled={!otherDeptId}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition shadow-sm disabled:bg-gray-50 disabled:text-gray-400 ${
                      otherCurriculumId ? 'border-blue-300 bg-blue-50 text-blue-800 font-medium' : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <option value="">Select curriculum...</option>
                    {curriculums.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Course */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${otherCurriculumId ? 'bg-blue-600' : 'bg-gray-300'}`}>3</span>
                    Course
                  </label>
                  <select
                    value={otherSelectedCourse}
                    onChange={e => { setOtherSelectedCourse(e.target.value); setOtherSelectedClass(null); setOtherBlocks([]); setOtherSubjectSearch(''); setOtherError(''); }}
                    disabled={!otherCurriculumId || otherClassesLoading}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition shadow-sm disabled:bg-gray-50 disabled:text-gray-400 ${
                      otherSelectedCourse ? 'border-blue-300 bg-blue-50 text-blue-800 font-medium' : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <option value="">{otherClassesLoading ? 'Loading...' : 'Select course...'}</option>
                    {otherCourseOptions.map(course => <option key={course} value={course}>{course}</option>)}
                  </select>
                </div>

                {/* Year Level */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${otherSelectedCourse ? 'bg-blue-600' : 'bg-gray-300'}`}>4</span>
                    Year Level
                  </label>
                  <select
                    value={otherSelectedClass ? `${otherSelectedClass.course.toLowerCase()}::${otherSelectedClass.yearLevel}` : ''}
                    onChange={e => {
                      const found = otherYearOptions.find(c => `${c.course.toLowerCase()}::${c.yearLevel}` === e.target.value);
                      setOtherSelectedClass(found || null); setOtherYearTab(Number(found?.yearLevel) || 1);
                      setOtherBlocks([]); setOtherSubjectSearch(''); setOtherError('');
                    }}
                    disabled={!otherSelectedCourse}
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition shadow-sm disabled:bg-gray-50 disabled:text-gray-400 ${
                      otherSelectedClass ? 'border-blue-300 bg-blue-50 text-blue-800 font-medium' : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <option value="">Select year level...</option>
                    {otherYearOptions.map(c => {
                      const key = `${c.course.toLowerCase()}::${c.yearLevel}`;
                      return <option key={key} value={key}>{getYearLabel(c.yearLevel)} </option>;
                    })}
                  </select>
                </div>
              </div>

              {/* Search + Table */}
              {otherSelectionComplete && (
                <>
                  <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-1.5">
                      {YEAR_TABS.filter(y => y.value !== 'irregular').map(year => {
                        const active = otherYearTab === year.value;
                        return (
                          <button
                            key={year.value}
                            type="button"
                            onClick={() => setOtherYearTab(year.value)}
                            className={`rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
                              active
                                ? 'bg-blue-500 text-white shadow-sm'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
                            }`}
                          >
                            {year.label}
                          </button>
                        );
                      })}
                  </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search subjects..."
                        value={otherSubjectSearch}
                        onChange={e => setOtherSubjectSearch(e.target.value)}
                      className="w-80 border text-sm border-slate-200 bg-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                      />
                    </div>
                  </div>

                

                  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    {otherCurriculumLoading ? (
                      <div className="py-10 text-center text-sm text-gray-500">Loading subjects...</div>
                    ) : sortedOtherCourses.length === 0 ? (
                      <EmptyState icon={Search} title="No subjects found" description={otherSubjectSearch ? 'No subjects match your search.' : 'No subjects found for this selection.'} />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-blue-500 text-left text-xs uppercase tracking-wider text-white sticky top-0">
                            <tr>
                              <th className="p-4  w-[5%] text-right">Assign</th>

                              <th className="p-4 w-[5%] ">Select</th>
                              <th className="cursor-pointer select-none p-4 w-[15%] " onClick={() => handleOtherSort('courseCode')}>
                               Subject Code <OtherSortIcon col="courseCode" />
                              </th>
                              <th className="cursor-pointer select-none p-4 w-[30%] " onClick={() => handleOtherSort('courseTitle')}>
                               Subject Title <OtherSortIcon col="courseTitle" />
                              </th>
                              <th className="cursor-pointer select-none p-4  w-[10%] " onClick={() => handleOtherSort('units')}>
                                Units <OtherSortIcon col="units" />
                              </th>
                              <th className="p-4  w-[20%]">Blocks</th>
                              <th className="p-4  w-[15%] text-left">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {sortedOtherCourses.map((course, idx) => {
                              const otherCourseId = otherSelectedClass
                                ? `other::${otherDeptId}::${otherSelectedClass.course.toLowerCase()}::${otherSelectedClass.yearLevel}::${course.id}`
                                : null;
                              const assignedToThis = otherCourseId ? currentProfessorAssignedCourseIds.has(otherCourseId) : false;
                              const classBlocks = normalizeBlockList(otherSelectedClass?.blocks || []);
                              const freeClassBlocks = otherCourseId ? getFreeBlocksForCourse(otherCourseId, classBlocks) : [];
                              const assignedElsewhere = otherCourseId ? (!assignedToThis && freeClassBlocks.length === 0) : false;
                              const isSaving = otherCourseId ? savingCourseIds.has(otherCourseId) : false;
                              const selectedOtherBlocks = otherCourseId ? (otherCourseBlocks[otherCourseId] || []) : [];
                              const missingBlocksForAssign = !assignedToThis && normalizeBlockList(selectedOtherBlocks).length === 0;
                              const displayedBlocks = assignedToThis && otherCourseId
                                ? getExistingAssignmentBlocks(otherCourseId)
                                : normalizeBlockList(selectedOtherBlocks);

                              return (
                                <tr
                                  key={course.id}
                                  className={`transition-all duration-100 ${
                                    assignedElsewhere ? 'opacity-50 bg-rose-50/30' :
                                    assignedToThis    ? 'bg-emerald-50/60' :
                                    idx % 2 === 0     ? 'bg-white' : 'bg-gray-50/40'
                                  } hover:bg-amber-50/30`}
                                >
                                    <td className="p-4 text-right">
                                    <button
                                      type="button"
                                      onClick={() => openOtherBlockModal(course)}
                                      disabled={!otherCourseId || assignedElsewhere || assignedToThis || isSaving}
                                  className={`inline-flex items-center gap-1.5 rounded-xl p-1.5 text-xs font-semibold transition-all ${
                                        (assignedToThis || assignedElsewhere || isSaving || !otherCourseId)
                                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                          : (displayedBlocks.length > 0)
                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer'
                                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer'
                                      }`}
                                    >
                                      {assignedToThis ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ClipboardEdit className="h-3.5 w-3.5" /> }
                                    </button>
                                  </td>

                                  <td className="p-4">
                                    {isSaving ? (
                                      <svg className="animate-spin h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                    ) : (
                                      <input
                                        type="checkbox"
                                        checked={assignedToThis}
                                        disabled={!otherCourseId || assignedElsewhere || isSaving || missingBlocksForAssign}
                                        onChange={e => toggleOtherAssignment(course, e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-amber-600 accent-amber-600 cursor-pointer disabled:cursor-not-allowed"
                                      />
                                    )}
                                  </td>
                                  <td className="p-4 font-bold text-gray-900">{course.courseCode}</td>
                                  <td className="p-4 text-gray-700">
                                    <div className="max-w-[280px] truncate text-sm" title={course.courseTitle}>{course.courseTitle}</div>
                                  </td>
                                  <td className="p-4 text-gray-600 text-center">
                                    {Number(course.units) > 0 ? course.units : '—'}
                                  </td>
                                  <td className="p-4 text-left">
                                    <StatusBadge status={assignedElsewhere ? 'conflict' : assignedToThis ? 'assigned' : displayedBlocks.length > 0 ? 'available' : 'unassigned'} />
                                  </td>
                                  <td className="p-4 text-left">
                                    {displayedBlocks.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {displayedBlocks.map(b => (
                                          <span key={b} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">{b}</span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400 italic">None selected</span>
                                    )}
                                  </td>
                                
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}

              {!otherSelectionComplete && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                    <Layers className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-600">Complete all steps above to view subjects</p>
                  <p className="mt-1 text-xs text-gray-400">Select department → curriculum → course → year level</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── STUDENTS MODAL ── */}
      {selectedSubject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
          onClick={closeStudentsModal}
        >
          <div
            className="flex min-h-[90vh] max-h-[90vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            
           
            <div className="">

               {/* Modal Header */}
              <div className="flex items-start justify-between px-8 py-4 border-b border-slate-200 bg-slate-100 ">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-600">
                    <Users className="h-3.5 w-3.5" /> Enrolled Students
                  </div>
                  <h6 className="truncate text-xl font-bold text-gray-900">
                    {selectedSubject.courseCode}
                    <span className="ml-2 font-normal text-gray-500">—</span>
                    <span className="ml-2 text-lg text-gray-700">{selectedSubject.courseTitle}</span>
                  </h6>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      <GraduationCap className="h-3.5 w-3.5" />
                      {getYearBlockLabel(selectedSubject)}
                    </span>
                    {!studentsLoading && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        <Users className="h-3.5 w-3.5" />
                        {students.length} Student{students.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={closeStudentsModal}
                  className="rounded-full border border-gray-200 bg-gray-50 p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-8 py-4 flex items-center justify-between gap-4">
                {/* Block Tabs */}
              {!studentsLoading && modalTabs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                  {modalTabs.map(tab => {
                    const isActive = activeBlockTab === tab.value;
                    return (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => { setActiveBlockTab(tab.value); setStudentSearch(''); }}
                        className={`rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
                          isActive
                             ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
                        }`}
                      >
                        {tab.label}
                       
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Search */}
              {!studentsLoading && students.length > 0 && (
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or student number..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    className="w-full border text-sm border-slate-200 bg-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  />
                </div>
              )}
              </div>

            </div>

           {/* Modal Body */}
            <div className="flex-1 overflow-auto px-6 pt-2 pb-4">
              <div className="h-full relative overflow-y-auto rounded-xl border border-gray-200 bg-white ">
                
                {studentsLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <svg className="animate-spin h-8 w-8 text-blue-400 mb-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    <p className="text-sm text-gray-500">Loading students...</p>
                  </div>
                ) : students.length === 0 ? (
                  <EmptyState icon={Users} title="No students enrolled" description="No students are taking this subject in the active term." />
                ) : filteredStudents.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-500">
                    {studentSearch
                      ? 'No students match your search.'
                      : activeBlockTab === IRREGULAR_MODAL_TAB
                      ? 'No irregular students in this category.'
                      : `No students in Block ${activeBlockTab}.`}
                  </div>
                ) : (
                  <table className="min-w-full text-sm overflow-hidden rounded-xl">
                    
                    {/* Header */}
                    <thead className="sticky top-0 z-40 bg-blue-500 text-left text-xs uppercase tracking-wider text-white shadow-sm">
                      <tr>
                        <th className="p-4  text-left w-[10%]">No.</th>
                        <th className="p-4  cursor-pointer select-none w-[40%]" onClick={() => handleStudentSort('name')}>
                          Name <StudentSortIcon column="name" />
                        </th>
                        <th className="p-4 w-[10%] ">Course</th>
                        <th className="p-4 w-[15%] ">Year Level</th>
                        <th className="p-4 w-[15%] ">Block</th>
                      </tr>
                    </thead>

                    {/* Body */}
                    <tbody className="overflow-hidden">
                      {sortedStudents.map((s, i) => {
                        let block, displayYearLevel = s.yearLevel;

                        if (s.isIrregular) {
                          block = 'Irregular';
                          const activeSem = Number(activeTerm?.semester) || 1;
                          const semKey = `sem${activeSem}`;
                          const targetCode = (selectedSubject?.courseCode || '').toString().trim().toUpperCase();
                          const irregItems = ((s.irregularSubjects || {})[semKey]) || [];
                          const matchedItem = irregItems.find(item =>
                            (item.courseCode || '').toString().trim().toUpperCase() === targetCode
                          );
                          if (matchedItem?.joinedYearLevel) displayYearLevel = matchedItem.joinedYearLevel;
                        } else {
                          block = s.block && String(s.block).trim() !== '' ? String(s.block).trim().toUpperCase() : 'A';
                        }

                        const courseLabel = getStudentCourseLabel(s, selectedSubject);

                        return (
                          <tr
                            key={s.id}
                            className={`border-t border-gray-100 transition-colors ${
                              i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                            } hover:bg-blue-50/40`}
                          >
                            <td className="text-left p-4">
                                {i + 1}.
                            </td>

                            <td className="p-4 ">
                              <p className="font-semibold text-gray-800">{s.name}</p>
                              {s.studentNumber && (
                                <p className="text-xs text-gray-400">{s.studentNumber}</p>
                              )}
                            </td>

                            <td className="p-4  text-gray-600">{courseLabel}</td>
                            <td className="p-4  text-gray-600">{getYearLabel(displayYearLevel)}</td>

                            <td className="p-4 ">
                              <span
                                className={`rounded-lg border px-2.5 py-0.5 text-xs font-bold ${
                                  s.isIrregular
                                    ? 'border-violet-200 bg-violet-50 text-violet-700'
                                    : 'border-gray-200 bg-gray-50 text-gray-700'
                                }`}
                              >
                                {block}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            {/* Modal Footer */}
            <div className="p-4">
             
            </div>
          </div>
        </div>
      )}

      {/* ── BLOCK EDIT MODAL (assigned subjects) ── */}
      {blockModalOpen && editingBlocksFor && (() => {
        const editingAssignmentObj = assignedCourses.find(c => c.courseId === editingBlocksFor);
        const editableConfig = getEditableBlocksForAssignment(editingAssignmentObj);
        const selectedText = editingBlocksValue.length > 0 ? editingBlocksValue.join(', ') : 'None selected';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-600" />
              <div className="border-b border-gray-100 px-6 py-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Choose Blocks</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Assigning blocks for <span className="font-semibold text-gray-800">{editingAssignmentObj?.courseCode}</span>
                  </p>
                </div>
                <button onClick={cancelEditBlocks} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-5">
                <p className="mb-4 text-sm text-gray-600">Tap a block to toggle selection. Grayed-out blocks are taken by other professors.</p>
                <BlockToggle
                  value={editingBlocksValue}
                  onChange={setEditingBlocksValue}
                  availableBlocks={editableConfig.allBlocks}
                  unavailableBlocks={editableConfig.blockedByOthers}
                />
              
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 bg-gray-50/50">
                <button onClick={cancelEditBlocks} disabled={savingBlocks} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
                <button onClick={saveEditBlocks} disabled={savingBlocks} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-60">
                  {savingBlocks ? 'Saving…' : 'Save Blocks'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── OTHER DEPT BLOCK MODAL ── */}
      {otherBlockModalOpen && otherModalCourse && (() => {
        const { availableBlocks: avail, unavailableBlocks: unavail } = getOtherBlockAvailability(otherModalCourse);
        const selectedText = otherModalBlocks.length > 0 ? otherModalBlocks.join(', ') : 'None selected';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
              <div className="border-b border-gray-100 px-6 py-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Choose Blocks</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    For <span className="font-semibold text-gray-800">{otherModalCourse.courseCode}</span> · {getYearLabel(otherSelectedClass?.yearLevel)}
                  </p>
                </div>
                <button onClick={closeOtherBlockModal} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-5">
                <p className="mb-4 text-sm text-gray-600">Tap a block to toggle selection.</p>
                <BlockToggle value={otherModalBlocks} onChange={setOtherModalBlocks} availableBlocks={avail} unavailableBlocks={unavail} />
             
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 bg-gray-50/50">
                <button
                  onClick={closeOtherBlockModal} 
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-600 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveOtherBlockSelection} 
                className="px-4 py-1.5 w-24 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
                >
                  Save 
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── CCS BLOCK MODAL ── */}
      {ccsBlockModalOpen && ccsModalCourse && (() => {
        const avail = getBlocksForYear(ccsModalCourse.yearLevel, false);
        const unavail = getTakenBlocksForCourse(ccsModalCourse.id);
        const selectedText = ccsModalBlocks.length > 0 ? ccsModalBlocks.join(', ') : 'None selected';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
              <div className="border-b border-gray-100 px-8 py-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-medium text-gray-900">Choose Blocks</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    For <span className="font-semibold text-gray-800">{ccsModalCourse.courseCode}</span> · {getYearLabel(ccsModalCourse.yearLevel)}
                  </p>
                </div>
             
              </div>
              <div className="px-8 py-4">
                <p 
                  className="mb-4 text-sm text-gray-600"
                >
                  Tap a block to toggle selection. Crossed-out blocks are taken by other professors.
                </p>
                <BlockToggle 
                  value={ccsModalBlocks} 
                  onChange={setCcsModalBlocks} 
                  availableBlocks={avail} 
                  unavailableBlocks={unavail} 
                />
                {pickerError && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5">
                    <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                    <p className="text-xs font-medium text-rose-700">{pickerError}</p>
                  </div>
                )}

                   <div className="flex items-center justify-end gap-2 mt-8">
                <button 
                  onClick={closeCcsBlockModal} 
                  className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-600 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveCcsBlockSelection} 
                  className="px-4 py-1.5 w-24 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
                >
                  Save
                </button>
              </div>

              
              </div>
           
            </div>
          </div>
        );
      })()}

      {/* ── CONFIRM IRREGULAR ACTION ── */}
      {confirmIrregularAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setConfirmIrregularAction(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className={`h-1.5 w-full ${confirmIrregularAction.action === 'unenroll' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            <div className="px-6 py-5">
              <h6 className="text-lg font-bold text-gray-900 mb-2">
                {confirmIrregularAction.action === 'unenroll' ? 'Confirm Unenroll' : 'Confirm Enroll'}
              </h6>
              <p className="text-sm text-gray-600 mb-5">
                {confirmIrregularAction.action === 'unenroll' ? 'Remove' : 'Enroll'}{' '}
                <span className="font-semibold text-gray-900">{confirmIrregularAction.student.name}</span>
                {confirmIrregularAction.action === 'unenroll' ? ' from current term enrollment?' : ' in the active term?'}
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmIrregularAction(null)}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="button" onClick={executeIrregularStudentAction}
                  className={`rounded-xl px-5 py-2 text-sm font-semibold text-white transition shadow-sm ${
                    confirmIrregularAction.action === 'unenroll' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}>
                  {confirmIrregularAction.action === 'unenroll' ? 'Unenroll' : 'Enroll'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM UNASSIGN ── */}
      {confirmUnassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="h-1.5 w-full bg-rose-500" />
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                  <Trash2 className="h-5 w-5 text-rose-600" />
                </div>
                <h6 className="text-lg font-bold text-gray-900">Unassign Subject</h6>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="mb-5 text-sm text-gray-600">
                Are you sure you want to unassign{' '}
                <span className="font-bold text-gray-900">{confirmUnassign.courseCode}</span>
                {confirmUnassign.courseTitle ? (
                  <span className="text-gray-700"> — {confirmUnassign.courseTitle}</span>
                ) : null}{' '}from this professor? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmUnassign(null)}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button onClick={handleUnassign}
                  className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition shadow-sm">
                  Unassign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessorDetail;