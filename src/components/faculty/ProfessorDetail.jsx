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
  ClipboardEdit
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
  { value: 4, label: '4th Year' },
  { value: 'irregular', label: 'Irregular' }
];

const IRREGULAR_MODAL_TAB = '__irregular_students__';

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
    <div className="flex flex-wrap gap-1.5">
      {blocksToShow.map(b => {
        const active = value.includes(b);
        const unavailable = unavailableSet.has(b) && !active;
        return (
          <button
            key={b}
            type="button"
            onClick={() => toggle(b)}
            className={`min-w-[34px] rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              active
                ? 'border-blue-600 bg-blue-600 text-white'
                : unavailable
                  ? 'border-gray-200 bg-white text-gray-500 opacity-40 cursor-not-allowed'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
            }`}
            title={unavailable ? 'Assigned to another professor' : undefined}
            disabled={unavailable}
          >
            {b}
          </button>
        );
      })}
    </div>
  );
};

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
  // ── NEW: year tab inside picker for CCS subjects ──
  const [pickerYearTab, setPickerYearTab] = useState(1);
  const [pickerCourseBlocks, setPickerCourseBlocks] = useState({});
  // ── NEW: sorting inside CCS picker table ──
  const [pickerSortBy, setPickerSortBy] = useState('courseCode');
  const [pickerSortOrder, setPickerSortOrder] = useState('asc');
  const [pickerError, setPickerError] = useState('');
  const [savingCourseIds, setSavingCourseIds] = useState(() => new Set());
  // ── blocks already assigned to OTHER professors: { [courseId]: string[] } ──
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
  const [otherBlockModalOpen, setOtherBlockModalOpen] = useState(false);
  const [otherModalCourse, setOtherModalCourse] = useState(null);
  const [otherModalBlocks, setOtherModalBlocks] = useState([]);
  const [ccsBlockModalOpen, setCcsBlockModalOpen] = useState(false);
  const [ccsModalCourse, setCcsModalCourse] = useState(null);
  const [ccsModalBlocks, setCcsModalBlocks] = useState([]);
  const [otherError, setOtherError] = useState('');
  const [otherSemesterFilter, setOtherSemesterFilter] = useState('all');
  // ── sort + year-tab state for Other Dept subject table ──
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
  // Active block tab in the students modal
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

  // Edit assignment modal state
  const [editAssignmentOpen, setEditAssignmentOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editForm, setEditForm] = useState({
    courseCode: '',
    courseTitle: '',
    units: '',
    yearLevel: '',
    semester: '',
    blocks: []
  });
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Ref to track previous term to detect changes
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

  // Determine the display course label for an assignment
  // CCS dept → BSCS; other dept → use their course code/name
  const getCourseLabel = (assignment) => {
    if (assignment?.source === 'other-department') {
      return assignment.classCourse || assignment.departmentName || 'Other';
    }
    return 'BSCS';
  };

  const getYearBlockLabel = (assignment) => {
    const blocks = assignment?.blocks || [];
    const blockText = blocks.length > 0 ? blocks.join(', ') : '-';
    return `${getCourseLabel(assignment)} ${getYearLabel(assignment?.yearLevel)} Blk. ${blockText}`;
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <ChevronsUpDown className="ml-1 inline-flex h-3.5 w-3.5 opacity-70" />;
    return sortOrder === 'asc'
      ? <ChevronUp className="ml-1 inline-flex h-3.5 w-3.5" />
      : <ChevronDown className="ml-1 inline-flex h-3.5 w-3.5" />;
  };

  const assignedSubjectsByYear = useMemo(() => {
    const list = assignedCourses.filter(c => Number(c.yearLevel) === assignedYearTab);
    return [...list].sort((a, b) => {
      let aValue = '', bValue = '';
      if (sortBy === 'units') {
        aValue = Number(a.units) || 0;
        bValue = Number(b.units) || 0;
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      if (sortBy === 'yearLevel') {
        aValue = Number(a.yearLevel) || 0;
        bValue = Number(b.yearLevel) || 0;
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

  const totalBlocksHandled = useMemo(() => {
    const blocks = new Set();
    assignedCourses.forEach(c => (c.blocks || []).forEach(b => blocks.add(`${c.courseId}-${b}`)));
    return blocks.size;
  }, [assignedCourses]);

  const getBlocksForYear = (year, isIrregular = false) => {
    const set = new Set();
    studentsSource.forEach(s => {
      if (Number(s.yearLevel) === Number(year) && (isIrregular ? s.isIrregular : !s.isIrregular)) {
        const block = s && s.block && String(s.block).trim() !== ''
          ? String(s.block).trim().toUpperCase()
          : 'A';
        set.add(block);
      }
    });
    const blocks = Array.from(set).sort((a, b) => a.localeCompare(b));
    if (blocks.length === 0) return ['A'];
    return blocks;
  };

  const normalizeBlockList = (blocks = []) =>
    Array.from(new Set(
      (blocks || [])
        .map(b => (b || '').toString().trim().toUpperCase())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));

  const getTakenBlocksForCourse = (courseId) =>
    assignedBlocksByOthers[courseId] || [];

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
    if (tableOnly) setTableLoading(true);
    else setLoading(true);
    setError('');
    try {
      const [professorSnap, studentsRes] = await Promise.all([
        getDoc(doc(db, 'professors', professorId)),
        getStudents()
      ]);
      if (professorSnap.exists()) {
        setProfessor({ id: professorSnap.id, ...professorSnap.data() });
      } else {
        toast.error('Professor not found.');
      }
      if (studentsRes.success) setStudentsSource(studentsRes.data);
    } catch (err) {
      toast.error(err.message || 'Failed to load professor.');
    }
    if (tableOnly) setTableLoading(false);
    else setLoading(false);
  };

  useEffect(() => { refreshProfessor(); }, [professorId]);

  useEffect(() => {
    if (viewMode === 'detail') setPickerOpen(false);
  }, [viewMode]);

  useEffect(() => {
    onViewModeChange?.(pickerOpen ? 'assign' : 'detail');
  }, [pickerOpen, onViewModeChange]);

  useEffect(() => {
    return () => onViewModeChange?.('detail');
  }, [onViewModeChange]);

  useEffect(() => {
    if (!selectedSubject) return;
    const onKey = (e) => { if (e.key === 'Escape') closeStudentsModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedSubject]);

  // Reset all assigned subjects when activeTerm changes
  useEffect(() => {
    const resetAssignmentsOnTermChange = async () => {
      // Create a string representation of the current term
      const currentTermStr = `${activeTerm?.semester}-${activeTerm?.schoolYear}`;
      const previousTermStr = previousTermRef.current;

      // Only reset if term actually changed and it's not the initial mount
      if (previousTermStr === null) {
        // First mount, just set the ref
        previousTermRef.current = currentTermStr;
        return;
      }

      if (previousTermStr === currentTermStr) {
        // Term hasn't changed
        return;
      }

      // Term has changed, reset assignments
      previousTermRef.current = currentTermStr;

      if (!professor?.assignedCourses || professor.assignedCourses.length === 0) return;

      try {
        // Unassign all courses immediately
        const coursesToUnassign = [...professor.assignedCourses];
        await Promise.all(
          coursesToUnassign.map(course =>
            unassignCourseFromProfessor(professorId, course.courseId, { suppressLog: true })
          )
        );
        // Refresh professor data
        await refreshProfessor({ tableOnly: true });
        
        // Refresh block occupancy to allow reassignment of free blocks
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
      } catch (err) {
        console.error('Failed to reset assignments:', err);
      }
    };

    resetAssignmentsOnTermChange();
  }, [activeTerm]);

  const closeStudentsModal = () => {
    setSelectedSubject(null);
    setStudents([]);
    setStudentSearch('');
    setActiveBlockTab(null);
  };

  const loadIrregularStudents = async () => {
    if (!professorId || !activeTerm?.semester || !activeTerm?.schoolYear) {
      setIrregularStudents([]);
      return;
    }
    setIrregularError('');
    setIrregularLoading(true);
    try {
      const res = await getIrregularStudentsForProfessor(professorId, activeTerm);
      if (res.success) {
        setIrregularStudents(res.data);
      } else {
        setIrregularStudents([]);
        toast.error(res.error || 'Failed to load irregular students.');
      }
    } catch (err) {
      setIrregularStudents([]);
      toast.error(err.message || 'Failed to load irregular students.');
    } finally {
      setIrregularLoading(false);
    }
  };

  useEffect(() => {
    if (assignedYearTab === 'irregular') {
      loadIrregularStudents();
    }
  }, [assignedYearTab, professorId, activeTerm]);

  const scheduleIrregularStudentAction = (student, action) => {
    setConfirmIrregularAction({ student, action });
  };

  const executeIrregularStudentAction = async () => {
    if (!confirmIrregularAction?.student || !confirmIrregularAction?.action) return;
    const { student, action } = confirmIrregularAction;

    if (!activeTerm?.semester || !activeTerm?.schoolYear) {
      toast.error('Please select an active term to update the student enrollment.');
      setConfirmIrregularAction(null);
      return;
    }

    setError('');
    setEnrollingStudentId(student.id);
    setConfirmIrregularAction(null);

    try {
      const res = action === 'unenroll'
        ? await setStudentNotEnrolled(student.id)
        : await setStudentEnrollment(student.id, activeTerm);

      if (!res.success) {
        throw new Error(res.error || 'Failed to update the student enrollment.');
      }

      setIrregularStudents(prev => prev.map(s => (
        s.id === student.id
          ? {
            ...s,
            enrolledTerm: action === 'unenroll' ? {} : { semester: Number(activeTerm.semester), schoolYear: activeTerm.schoolYear }
          }
          : s
      )));
    } catch (err) {
      toast.error(err.message || 'Failed to update the student enrollment.');
    } finally {
      setEnrollingStudentId(null);
    }
  };

  // Tabs are driven by assignment.blocks (what blocks the professor was assigned),
  // NOT by what blocks happen to appear in the fetched student list.
  // This ensures Block A and Block B tabs always appear when both were assigned,
  // even if the returned students all share the same block value in the DB.
  const availableBlocks = useMemo(() => {
    const regularStudents = students.filter(s => !s.isIrregular);
    const assigned = selectedSubject?.blocks;
    if (assigned && assigned.length > 0) {
      return [...assigned]
        .map(b => String(b).trim().toUpperCase())
        .sort((a, b) => a.localeCompare(b));
    }
    // Fallback: derive from actual student block fields
    const set = new Set();
    regularStudents.forEach(s => {
      const b = s.block && String(s.block).trim() !== ''
        ? String(s.block).trim().toUpperCase()
        : 'A';
      set.add(b);
    });
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return sorted.length > 0 ? sorted : ['A'];
  }, [selectedSubject, students]);

  const irregularStudentsForSubject = useMemo(
    () => students.filter(s => s.isIrregular),
    [students]
  );

  // Helper: get the joinedBlock for an irregular student for the currently selected subject.
  // Uses the stored joinedBlock field. If missing and the professor only has one block
  // assigned, falls back to that block. With multiple blocks, returns null (Irregular tab).
  const getIrregularJoinedBlock = useCallback((student) => {
    if (!student.isIrregular) return null;
    const activeSem = Number(activeTerm?.semester) || 1;
    const semKey = `sem${activeSem}`;
    const targetCode = (selectedSubject?.courseCode || '').toString().trim().toUpperCase();
    const items = ((student.irregularSubjects || {})[semKey]) || [];
    const match = items.find(
      item => (item.courseCode || '').toString().trim().toUpperCase() === targetCode
    );
    if (match?.joinedBlock) {
      return String(match.joinedBlock).trim().toUpperCase();
    }
    // Fallback: if only one block is assigned, place the student there.
    // If multiple blocks exist we can't guess, so return null (Irregular tab).
    const assigned = (selectedSubject?.blocks || [])
      .map(b => String(b).trim().toUpperCase())
      .filter(Boolean);
    if (assigned.length === 1) {
      return assigned[0];
    }
    return null;
  }, [activeTerm, selectedSubject]);

  const modalTabs = useMemo(() => {
    const activeSem = Number(activeTerm?.semester) || 1;
    const semKey = `sem${activeSem}`;
    const targetCode = (selectedSubject?.courseCode || '').toString().trim().toUpperCase();
    const assignedBlocks = (selectedSubject?.blocks || [])
      .map(b => String(b).trim().toUpperCase())
      .filter(Boolean);

    // Resolve which block tab each irregular student belongs to
    const resolveIrregularBlock = (s) => {
      const items = ((s.irregularSubjects || {})[semKey]) || [];
      const match = items.find(
        item => (item.courseCode || '').toString().trim().toUpperCase() === targetCode
      );
      if (match?.joinedBlock) {
        const jb = String(match.joinedBlock).trim().toUpperCase();
        if (availableBlocks.includes(jb)) return jb;
      }
      // Fallback: single assigned block
      if (assignedBlocks.length === 1) return assignedBlocks[0];
      return null; // goes to Irregular tab
    };

    const blockTabs = availableBlocks
      .map(block => {
        const count = students.filter(s => {
          if (s.isIrregular) return resolveIrregularBlock(s) === block;
          const b = s.block && String(s.block).trim() !== ''
            ? String(s.block).trim().toUpperCase()
            : 'A';
          return b === block;
        }).length;
        return { value: block, label: `Block ${block}`, count };
      })
      .filter(tab => tab.count > 0);

    // "Irregular" tab: irregular students whose resolved block is null
    const irregularsWithoutBlock = irregularStudentsForSubject.filter(
      s => resolveIrregularBlock(s) === null
    );
    if (irregularsWithoutBlock.length > 0) {
      blockTabs.push({
        value: IRREGULAR_MODAL_TAB,
        label: 'Irregular',
        count: irregularsWithoutBlock.length
      });
    }

    return blockTabs;
  }, [availableBlocks, students, irregularStudentsForSubject, selectedSubject, activeTerm]);

  // Auto-select first student tab when tabs change; preserve current tab if it still exists
  useEffect(() => {
    if (modalTabs.length > 0) {
      setActiveBlockTab(prev => {
        if (prev && modalTabs.some(tab => tab.value === prev)) return prev;
        return modalTabs[0].value;
      });
    }
  }, [modalTabs]);

  // Students shown in the table = those whose block field matches the active tab,
  // further narrowed by search. Blank block field defaults to 'A' (same as StudentManagement).
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const onIrregularTab = activeBlockTab === IRREGULAR_MODAL_TAB;
    const activeSem = Number(activeTerm?.semester) || 1;
    const semKey = `sem${activeSem}`;
    const targetCode = (selectedSubject?.courseCode || '').toString().trim().toUpperCase();
    const assignedBlocks = (selectedSubject?.blocks || [])
      .map(b => String(b).trim().toUpperCase())
      .filter(Boolean);

    const resolveIrregularBlock = (s) => {
      const items = ((s.irregularSubjects || {})[semKey]) || [];
      const match = items.find(
        item => (item.courseCode || '').toString().trim().toUpperCase() === targetCode
      );
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
        // Only show irregulars whose resolved block is null (can't be placed in a block tab)
        if (resolveIrregularBlock(s) !== null) return false;
        if (!q) return true;
        return (
          (s.name || '').toLowerCase().includes(q) ||
          (s.studentNumber || '').toLowerCase().includes(q)
        );
      }

      if (s.isIrregular) {
        // Show irregular student in the block tab matching their resolved block
        const resolvedBlock = resolveIrregularBlock(s);
        if (!resolvedBlock || resolvedBlock !== activeBlockTab) return false;
        if (!q) return true;
        return (
          (s.name || '').toLowerCase().includes(q) ||
          (s.studentNumber || '').toLowerCase().includes(q)
        );
      }

      // Regular student: filter by their block field
      const block = s.block && String(s.block).trim() !== ''
        ? String(s.block).trim().toUpperCase()
        : 'A';
      if (activeBlockTab && block !== activeBlockTab) return false;
      if (!q) return true;
      return (
        (s.name || '').toLowerCase().includes(q) ||
        (s.studentNumber || '').toLowerCase().includes(q)
      );
    });
  }, [students, studentSearch, activeBlockTab, availableBlocks, selectedSubject, activeTerm]);

  // Sort filtered students by name (default) or school ID
  const sortedStudents = useMemo(() => {
    if (!filteredStudents) return [];
    return [...filteredStudents].sort((a, b) => {
      const direction = studentSort.direction === 'asc' ? 1 : -1;
      if (studentSort.key === 'name') {
        return direction * (a.name || '').localeCompare(b.name || '');
      }
      if (studentSort.key === 'studentNumber') {
        return direction * ((a.studentNumber || '').localeCompare(b.studentNumber || ''));
      }
      return 0;
    });
  }, [filteredStudents, studentSort]);

  const addManualIrregularStudent = () => {
    const name = (manualIrregularName || '').trim();
    const studentNumber = (manualIrregularNumber || '').trim();
    const blockValue = (manualIrregularBlock || '').trim().toUpperCase() || 'A';

    if (!name) {
      toast.error('Enter the student name.');
      return;
    }
    if (!studentNumber) {
      toast.error('Enter the student number.');
      return;
    }

    const newStudent = {
      id: `manual-irregular-${Date.now()}`,
      name,
      studentNumber,
      block: blockValue,
      isIrregular: true,
      manualEntry: true
    };

    setStudents(prev => [...prev, newStudent]);
    setManualIrregularName('');
    setManualIrregularNumber('');
    setManualIrregularBlock('');
    setManualIrregularError('');
    setIsAddingIrregularStudent(false);
  };

  const resetOtherForm = () => {
    setOtherDeptId('');
    setOtherClasses([]);
    setOtherSelectedClass(null);
    setOtherSelectedCourse('');
    setOtherCurriculumId('');
    setOtherCurriculumCourses([]);
    setOtherSubjectSearch('');
    setOtherBlocks([]);
    setOtherError('');
    setOtherYearTab(1);
    setOtherSemesterFilter('all');
  };

  const openPicker = async () => {
    setPickerOpen(true);
    setSavingCourseIds(new Set());
    setPickerTab('ccs');
    setPickerSearch('');
    setPickerSemesterFilter('all');
    setPickerCurriculumId('');
    setPickerCourses([]);
    setPickerYearTab(1); // ── NEW: reset to 1st Year on open
    setPickerCourseBlocks({});
    setPickerError('');
    resetOtherForm();
    const [curRes, deptRes, studentsRes, allProfsSnap] = await Promise.all([
      getCurriculums(),
      getOtherDepartments(),
      getStudents(),
      getDocs(collection(db, 'professors'))
    ]);
    if (curRes.success) setCurriculums(curRes.data);
    if (deptRes.success) setOtherDepts(deptRes.data);
    if (studentsRes.success) setStudentsSource(studentsRes.data);
    // Build map of blocks assigned to OTHER professors per course
    const taken = {};
    allProfsSnap.forEach(snap => {
      if (snap.id === professorId) return; // skip current professor
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
      if (!otherDeptId) {
        setOtherClasses([]);
        setOtherSelectedClass(null);
        setOtherSelectedCourse('');
        return;
      }
      setOtherClassesLoading(true);
      const res = await getOtherDeptClasses(otherDeptId);
      if (res.success) setOtherClasses(res.data);
      setOtherClassesLoading(false);
      setOtherSelectedClass(null);
      setOtherSelectedCourse('');
      setOtherBlocks([]);
    };
    loadOtherClasses();
  }, [otherDeptId]);

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

  // ── NEW: filter picker courses by year tab AND search ──
  const filteredPickerCourses = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return pickerCourses.filter(c => {
      const matchesYear = Number(c.yearLevel) === pickerYearTab;
      if (!matchesYear) return false;
      if (forceActiveSemester && Number(c.semester) !== activeSemester) return false;
      if (!forceActiveSemester && pickerSemesterFilter !== 'all' && Number(c.semester) !== Number(pickerSemesterFilter)) return false;
      if (!q) return true;
      return (
        (c.courseCode || '').toLowerCase().includes(q) ||
        (c.courseTitle || '').toLowerCase().includes(q)
      );
    });
  }, [pickerCourses, pickerSearch, pickerYearTab, pickerSemesterFilter, forceActiveSemester, activeSemester]);

  const handlePickerSort = (col) => {
    if (pickerSortBy === col) {
      setPickerSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setPickerSortBy(col);
      setPickerSortOrder('asc');
    }
  };

  const PickerSortIcon = ({ col }) => {
    if (pickerSortBy !== col) return <ChevronsUpDown className="ml-1 inline-flex h-3 w-3 opacity-60" />;
    return pickerSortOrder === 'asc'
      ? <ChevronUp className="ml-1 inline-flex h-3 w-3" />
      : <ChevronDown className="ml-1 inline-flex h-3 w-3" />;
  };

  const sortedPickerCourses = useMemo(() => {
    const list = [...filteredPickerCourses];
    return list.sort((a, b) => {
      if (pickerSortBy === 'units') {
        const aVal = Number(a.units) || 0;
        const bVal = Number(b.units) || 0;
        return pickerSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (pickerSortBy === 'semester') {
        const aVal = Number(a.semester) || 0;
        const bVal = Number(b.semester) || 0;
        return pickerSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aVal = (a[pickerSortBy] || '').toString();
      const bVal = (b[pickerSortBy] || '').toString();
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
      return pickerSortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredPickerCourses, pickerSortBy, pickerSortOrder]);

  // ── NEW: count per year tab for badge display ──
  const pickerYearCounts = useMemo(() => {
    return YEAR_TABS.reduce((acc, year) => {
      const q = pickerSearch.trim().toLowerCase();
      acc[year.value] = pickerCourses.filter(c => {
        if (Number(c.yearLevel) !== year.value) return false;
        if (forceActiveSemester && Number(c.semester) !== activeSemester) return false;
        if (!forceActiveSemester && pickerSemesterFilter !== 'all' && Number(c.semester) !== Number(pickerSemesterFilter)) return false;
        if (!q) return true;
        return (
          (c.courseCode || '').toLowerCase().includes(q) ||
          (c.courseTitle || '').toLowerCase().includes(q)
        );
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
      return (
        (c.courseCode || '').toLowerCase().includes(q) ||
        (c.courseTitle || '').toLowerCase().includes(q)
      );
    });
  }, [otherCurriculumCourses, otherSubjectSearch, otherSemesterFilter, forceActiveSemester, activeSemester]);

  // ── NEW: sorted other dept courses ──
  const handleOtherSort = (col) => {
    if (otherSortBy === col) {
      setOtherSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOtherSortBy(col);
      setOtherSortOrder('asc');
    }
  };

  const sortedOtherCourses = useMemo(() => {
    const byYear = filteredOtherCourses.filter(c => Number(c.yearLevel) === otherYearTab);
    return [...byYear].sort((a, b) => {
      let aVal, bVal;
      if (otherSortBy === 'units') {
        aVal = Number(a.units) || 0;
        bVal = Number(b.units) || 0;
        return otherSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (otherSortBy === 'semester') {
        aVal = Number(a.semester) || 0;
        bVal = Number(b.semester) || 0;
        return otherSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      aVal = (a[otherSortBy] || '').toString().toUpperCase();
      bVal = (b[otherSortBy] || '').toString().toUpperCase();
      return otherSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [filteredOtherCourses, otherSortBy, otherSortOrder, otherYearTab]);

  // ── count per year tab for Other Dept badges ──
  const otherYearCounts = useMemo(() => {
    return YEAR_TABS.reduce((acc, year) => {
      acc[year.value] = filteredOtherCourses.filter(c => Number(c.yearLevel) === year.value).length;
      return acc;
    }, {});
  }, [filteredOtherCourses]);

  const otherCourseOptions = useMemo(() => {
    return Array.from(new Set(
      otherClasses
        .map(c => (c.course || '').toString().trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [otherClasses]);

  const otherYearOptions = useMemo(() => {
    if (!otherSelectedCourse) return [];
    return otherClasses
      .filter(c => (c.course || '').toString().trim().toLowerCase() === otherSelectedCourse.toLowerCase())
      .sort((a, b) => Number(a.yearLevel) - Number(b.yearLevel));
  }, [otherClasses, otherSelectedCourse]);

  const otherSelectionComplete = Boolean(
    otherDeptId &&
    otherCurriculumId &&
    otherSelectedCourse &&
    otherSelectedClass
  );

  const OtherSortIcon = ({ col }) => {
    if (otherSortBy !== col) return <ChevronsUpDown className="ml-1 inline-flex h-3 w-3 opacity-60" />;
    return otherSortOrder === 'asc'
      ? <ChevronUp className="ml-1 inline-flex h-3 w-3" />
      : <ChevronDown className="ml-1 inline-flex h-3 w-3" />;
  };

  const StudentSortIcon = ({ column }) => {
    if (studentSort.key !== column) return <ChevronsUpDown className="ml-1 inline-flex h-3 w-3 opacity-60" />;
    return studentSort.direction === 'asc'
      ? <ChevronUp className="ml-1 inline-flex h-3 w-3" />
      : <ChevronDown className="ml-1 inline-flex h-3 w-3" />;
  };

  const handleStudentSort = (key) => {
    setStudentSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const setCourseSaving = (courseId, isSaving) => {
    setSavingCourseIds(prev => {
      const next = new Set(prev);
      if (isSaving) next.add(courseId);
      else next.delete(courseId);
      return next;
    });
  };

  const getPickerBlocksForCourse = (course) => {
    if (!course?.id) return [];
    return pickerCourseBlocks[course.id] || [];
  };

  const setPickerBlocksForCourse = (courseId, blocks) => {
    setPickerCourseBlocks(prev => ({
      ...prev,
      [courseId]: blocks
    }));
  };

  const toggleCcsAssignment = async (course, nextChecked) => {
    if (!pickerCurriculumId) {
      toast.error('Select a curriculum first.');
      return;
    }
    if (!course?.id) return;
    const courseId = course.id;

    setPickerError('');
    setError('');
    setCourseSaving(courseId, true);
    try {
      if (nextChecked) {
        const curriculum = curriculums.find(c => c.id === pickerCurriculumId);
        const blocks = pickerCourseBlocks[course.id] || [];
        if (blocks.length === 0) {
          toast.error('Select blocks before assigning this subject.');
          return;
        }

        const freeBlocks = getFreeBlocksForCourse(courseId, blocks);
        if (freeBlocks.length === 0) {
          toast.error('Selected blocks are already assigned to other professors.');
          return;
        }

        const res = await assignCourseToProfessor(professorId, {
          courseId,
          courseCode: course.courseCode,
          courseTitle: course.courseTitle,
          curriculumId: pickerCurriculumId,
          curriculumName: curriculum?.name || '',
          yearLevel: course.yearLevel,
          semester: course.semester,
          units: course.units,
          blocks: freeBlocks
        });
        if (!res.success) toast.error(res.error || 'Failed to assign subject.');
        else toast.success('Subject assigned.');
      } else {
        const res = await unassignCourseFromProfessor(professorId, courseId);
        if (!res.success) toast.error(res.error || 'Failed to unassign subject.');
        else toast.success('Subject unassigned.');
      }
      await refreshProfessor({ tableOnly: true });
    } finally {
      setCourseSaving(courseId, false);
    }
  };

  const toggleOtherAssignment = async (subject, nextChecked) => {
    setOtherError('');
    setError('');
    if (!otherSelectedClass) { setOtherError('Select a class first.'); return; }
    if (!otherCurriculumId) { setOtherError('Select a curriculum first.'); return; }
    if (nextChecked && otherBlocks.length === 0) { setOtherError('Select at least one block.'); return; }
    if (!subject?.id) return;

    const courseId = `other::${otherDeptId}::${otherSelectedClass.course.toLowerCase()}::${otherSelectedClass.yearLevel}::${subject.id}`;

    setCourseSaving(courseId, true);
    try {
      if (nextChecked) {
        const freeBlocks = getFreeBlocksForCourse(courseId, otherBlocks);
        if (freeBlocks.length === 0) {
          toast.error('Selected blocks are already assigned to other professors.');
          return;
        }

        const dept = otherDepts.find(d => d.id === otherDeptId);
        const curriculum = curriculums.find(c => c.id === otherCurriculumId);
        const res = await assignCourseToProfessor(professorId, {
          source: 'other-department',
          courseId,
          subjectId: subject.id,
          courseCode: subject.courseCode,
          courseTitle: subject.courseTitle,
          curriculumId: otherCurriculumId,
          curriculumName: curriculum?.name || '',
          departmentId: otherDeptId,
          departmentName: dept?.name || '',
          classCourse: otherSelectedClass.course,
          yearLevel: otherSelectedClass.yearLevel,
          units: Number(subject.units) || 0,
          blocks: freeBlocks
        });
        if (!res.success) toast.error(res.error || 'Failed to assign class.');
        else toast.success('Class assigned.');
      } else {
        const res = await unassignCourseFromProfessor(professorId, courseId);
        if (!res.success) toast.error(res.error || 'Failed to unassign class.');
        else toast.success('Class unassigned.');
      }
      await refreshProfessor({ tableOnly: true });
    } finally {
      setCourseSaving(courseId, false);
    }
  };

  const getExistingAssignmentBlocks = (courseId) => {
    const assignment = assignedCourses.find(c => c.courseId === courseId);
    return assignment ? normalizeBlockList(assignment.blocks || []) : [];
  };

  const openOtherBlockModal = (course) => {
    const otherCourseId = getOtherCourseId(course);
    const initialBlocks = otherBlocks.length > 0
      ? normalizeBlockList(otherBlocks)
      : otherCourseId
        ? getExistingAssignmentBlocks(otherCourseId)
        : [];

    setOtherModalCourse(course);
    setOtherModalBlocks(initialBlocks);
    setOtherBlockModalOpen(true);
    setOtherError('');
  };

  const closeOtherBlockModal = () => {
    setOtherBlockModalOpen(false);
    setOtherModalCourse(null);
    setOtherModalBlocks([]);
  };

  const saveOtherBlockSelection = () => {
    if (otherModalBlocks.length === 0) {
      setOtherError('Select at least one block.');
      return;
    }
    setOtherBlocks(normalizeBlockList(otherModalBlocks));
    closeOtherBlockModal();
  };

  const openCcsBlockModal = (course) => {
    const initialBlocks = pickerCourseBlocks[course.id] || getExistingAssignmentBlocks(course.id);
    setCcsModalCourse(course);
    setCcsModalBlocks(normalizeBlockList(initialBlocks));
    setCcsBlockModalOpen(true);
    setPickerError('');
  };

  const closeCcsBlockModal = () => {
    setCcsBlockModalOpen(false);
    setCcsModalCourse(null);
    setCcsModalBlocks([]);
  };

  const saveCcsBlockSelection = () => {
    if (ccsModalBlocks.length === 0) {
      setPickerError('Select at least one block.');
      return;
    }
    setPickerCourseBlocks(prev => ({
      ...prev,
      [ccsModalCourse.id]: normalizeBlockList(ccsModalBlocks)
    }));
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
    return {
      availableBlocks: classBlocks,
      unavailableBlocks: unavailable
    };
  };

  const startEditBlocks = (assignment) => {
    setEditingBlocksFor(assignment.courseId);
    setEditingBlocksValue(normalizeBlockList(assignment.blocks || []));
    setBlockModalOpen(true);
  };

  const cancelEditBlocks = () => {
    setBlockModalOpen(false);
    setEditingBlocksFor(null);
    setEditingBlocksValue([]);
  };

  const saveEditBlocks = async () => {
    if (!editingBlocksFor) return;

    const assignment = assignedCourses.find(c => c.courseId === editingBlocksFor);
    const editableConfig = assignment
      ? getEditableBlocksForAssignment(assignment)
      : { allBlocks: [], blockedByOthers: [] };
    const normalizedSelection = normalizeBlockList(editingBlocksValue);

    if (normalizedSelection.length === 0) { toast.error('Select at least one block.'); return; }
    if (editableConfig.blockedByOthers.length > 0 && normalizedSelection.some(block => editableConfig.blockedByOthers.includes(block))) {
      toast.error('One or more selected blocks are already assigned to other professors.');
      return;
    }

    setError('');
    setSavingBlocks(true);
    const res = await updateAssignedCourseBlocks(professorId, editingBlocksFor, normalizedSelection);
    setSavingBlocks(false);
    if (res.success) {
      if (selectedSubject?.courseId === editingBlocksFor) {
        const updated = { ...selectedSubject, blocks: normalizedSelection };
        setSelectedSubject(updated);
        viewStudents(updated);
      }
      cancelEditBlocks();
      await refreshProfessor({ tableOnly: true });
      toast.success('Blocks updated successfully.');
    } else {
      toast.error(res.error || 'Failed to update blocks.');
    }
  };

  const handleUnassign = async () => {
    if (!confirmUnassign) return;
    const res = await unassignCourseFromProfessor(professorId, confirmUnassign.courseId);
    if (res.success) {
      if (selectedSubject?.courseId === confirmUnassign.courseId) {
        setSelectedSubject(null);
        setStudents([]);
      }
      setConfirmUnassign(null);
      await refreshProfessor({ tableOnly: true });
      toast.success('Subject unassigned.');
    } else {
      toast.error(res.error || 'Failed to unassign subject.');
    }
  };

  const openEditAssignment = (assignment) => {
    setEditingAssignment(assignment);
    setEditForm({
      courseCode: assignment.courseCode || '',
      courseTitle: assignment.courseTitle || '',
      units: assignment.units || '',
      yearLevel: assignment.yearLevel || '',
      semester: assignment.semester || '',
      blocks: assignment.blocks || []
    });
    setEditAssignmentOpen(true);
  };

  const closeEditAssignment = () => {
    setEditAssignmentOpen(false);
    setEditingAssignment(null);
    setEditForm({
      courseCode: '',
      courseTitle: '',
      units: '',
      yearLevel: '',
      semester: '',
      blocks: []
    });
  };

  const saveEditAssignment = async () => {
    if (!editingAssignment) return;
    
    setError('');
    setSavingAssignment(true);
    
    try {
      // Update the assignment in the professor's assignedCourses array
      const updatedCourses = professor.assignedCourses.map(c => {
        if (c.courseId === editingAssignment.courseId) {
          return {
            ...c,
            courseCode: editForm.courseCode,
            courseTitle: editForm.courseTitle,
            units: Number(editForm.units) || 0,
            yearLevel: Number(editForm.yearLevel) || 1,
            semester: Number(editForm.semester) || 1,
            blocks: editForm.blocks
          };
        }
        return c;
      });

      // Update the professor document
      const { updateDoc, doc: docRef } = await import('firebase/firestore');
      await updateDoc(docRef(db, 'professors', professorId), {
        assignedCourses: updatedCourses
      });

      // Refresh professor data
      await refreshProfessor({ tableOnly: true });
      
      // Update selected subject if it's the one being edited
      if (selectedSubject?.courseId === editingAssignment.courseId) {
        const updated = { ...selectedSubject, ...editForm };
        setSelectedSubject(updated);
      }

      closeEditAssignment();
      toast.success('Assignment updated.');
    } catch (err) {
      toast.error(err.message || 'Failed to update assignment.');
    } finally {
      setSavingAssignment(false);
    }
  };

  const viewStudents = async (subject) => {
    setSelectedSubject(subject);
    setStudentsLoading(true);
    setActiveBlockTab(null);
    setStudentSearch('');
    const res = await getStudentsForCourse(
      subject,
      activeTerm || { semester: 1, schoolYear: '' }
    );
    if (res.success) setStudents(res.data);
    else toast.error(res.error || 'Failed to load students.');
    setStudentsLoading(false);
  };

  // Derive the course label for a student row
  // CCS → BSCS; other dept → use the student's actual course field or the assignment's course label
  const getStudentCourseLabel = (student, assignment) => {
    if (assignment?.source === 'other-department') {
      // Use the student's own course if available, otherwise the assigned class course
      return student.course || assignment.classCourse || assignment.departmentName || 'Other';
    }
    // CCS is always BSCS
    return 'BSCS';
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-blue-50" />
          <div>
            <div className="mb-2 h-5 w-48 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-72 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[1, 2, 3].map(item => (
            <div key={item} className="h-20 animate-pulse rounded-xl bg-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  if (!professor) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="mb-3 text-sm text-gray-500">{error || 'Professor not found.'}</p>
        <button
          onClick={onBack}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Back to professor list
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!pickerOpen && (
        <>
     {/* ── Professor Header ── */}
<div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

    {/* Left */}
    <div className="min-w-0">
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-sm text-gray-600 cursor-pointer transition hover:text-blue-500"
      >
        <ArrowLeft className="h-4 w-4" />
        All professors
      </button>

      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
        {professor.name}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-500">
        <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5">
          <IdCard className="h-4 w-4" />
          <span>{professor.employeeId || 'No employee ID'}</span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5">
          <Mail className="h-4 w-4" />
          <span>{professor.email || 'No email'}</span>
        </div>
      </div>
    </div>

    {/* Right (Button + Stats stacked) */}
    <div className="flex flex-col items-end gap-3">

    
      {/* Stats (right aligned) */}
      <div className="flex flex-col items-end gap-2 text-right">

           <div className="text-sm text-gray-500">
         
          <span className="ml-2 font-semibold text-gray-900">
            {SEMESTER_LABELS[activeTerm?.semester] || '1st Sem'}
            {activeTerm?.schoolYear
              ? ` · S.Y. ${activeTerm.schoolYear}`
              : ''}
          </span>
        </div>

        <div className="text-sm text-gray-900">
          Assigned Subjects:
          <span className="ml-2 font-semibold text-gray-900">
            {assignedCourses.length}
          </span>
        </div>

       

      </div>

    </div>
  </div>
</div>

      {/* ── Subjects table ── */}
        <div className="">
          {/* errors are shown via toast notifications */}

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => refreshProfessor({ tableOnly: true })}
                disabled={tableLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white p-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${tableLoading ? 'animate-spin' : ''}`} />
              </button>
  <div className="flex gap-2 w-fit items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
                {YEAR_TABS.map(year => {
                  const active = assignedYearTab === year.value;
                  return (
                    <button
                      key={year.value}
                      type="button"
                      onClick={() => setAssignedYearTab(year.value)}
              className={`rounded-lg px-4 py-1 text-sm font-medium transition-all ${
                        active
                          ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer'
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
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500  cursor-pointer px-4 py-2 text-sm font-medium text-white transition hover:bg-green-600"
      >
        <Plus className="h-4 w-4" />
        Assign Subject
      </button>


          </div>

          {assignedYearTab === 'irregular' && (
            <div className="rounded-2xl border border-gray-200 bg-white">
            
              <div className="overflow-hidden rounded-2xl border border-gray-200">                <table className="w-full table-fixed text-sm">
                  <thead className="bg-blue-600 text-left text-xs uppercase tracking-wide text-white">
                    <tr>
                      <th className="w-[25%] px-4 py-2">Student Name</th>
                      <th className="w-[15%] px-4 py-2">Course</th>
                      <th className="w-[15%] px-4 py-2">Year & Block</th>
                      <th className="w-[30%] px-4 py-2">Irregular Subjects</th>
                      <th className="w-[15%] px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {irregularLoading ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index} className="border-t border-gray-100">
                          <td className="px-4 py-2"><div className="h-4 w-32 animate-pulse rounded bg-gray-100" /></td>
                          <td className="px-4 py-2"><div className="h-4 w-20 animate-pulse rounded bg-gray-100" /></td>
                          <td className="px-4 py-2"><div className="h-4 w-28 animate-pulse rounded bg-gray-100" /></td>
                          <td className="px-4 py-2"><div className="h-4 w-full animate-pulse rounded bg-gray-100" /></td>
                          <td className="px-4 py-2 text-right"><div className="ml-auto h-7 w-16 animate-pulse rounded bg-gray-100" /></td>
                        </tr>
                      ))
                    ) : irregularError ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-sm text-red-600">
                          {irregularError}
                        </td>
                      </tr>
                    ) : irregularStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-700">
                          No irregular students available for the active term.
                        </td>
                      </tr>
                    ) : (
                      irregularStudents.map((student) => {
                        // For irregular students, derive the joined block from their matching subjects
                        // (joinedBlock is stored per-subject when the student adds the subject)
                        const joinedBlocks = [...new Set(
                          (student.irregularSubjects || [])
                            .map(item => item.joinedBlock ? String(item.joinedBlock).trim().toUpperCase() : null)
                            .filter(Boolean)
                        )].sort();
                        const blockDisplay = joinedBlocks.length > 0 ? joinedBlocks.join(', ') : 'Irregular';
                        const enrolledInCurrentTerm = Number(student.enrolledTerm?.semester) === Number(activeTerm?.semester)
                          && student.enrolledTerm?.schoolYear === activeTerm?.schoolYear;
                        const irregularSubjectLabels = (student.irregularSubjects || [])
                          .map(item => item.courseCode || item.subjectCode || 'Unknown')
                          .join(', ');

                        return (
                          <tr key={student.id} className="border-t border-gray-100 ">
                            <td className="px-4 py-3 text-gray-700">{student.name}</td>
                            <td className="px-4 py-3 text-gray-700">{student.course || student.irregularSubjects?.[0]?.courseCode || '—'}</td>
                            <td className="px-4 py-3 text-gray-700">{getYearLabel(student.yearLevel)} · Blk. {blockDisplay}</td>
                            <td className="px-4 py-3 text-gray-700">{irregularSubjectLabels}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => scheduleIrregularStudentAction(student, enrolledInCurrentTerm ? 'unenroll' : 'enroll')}
                                disabled={enrollingStudentId === student.id}
                                title={enrolledInCurrentTerm ? 'Unassign student' : 'Assign student'}
                className={`p-2 rounded-xl transition ${
                                  enrolledInCurrentTerm
                                   ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
                                } disabled:opacity-60 disabled:cursor-not-allowed`}
                              >
                                {enrollingStudentId === student.id ? (
                                  <>
                                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                    {enrolledInCurrentTerm ? 'Removing…' : 'Adding…'}
                                  </>
                                ) : enrolledInCurrentTerm ? (
                                  <><UserX className="w-3.5 h-3.5" /></>
                                ) : (
                                  <><UserPlus className="w-3.5 h-3.5" /> </>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

      {assignedYearTab !== 'irregular' && (
  <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">

    <table className="w-full table-fixed text-sm border-separate border-spacing-0">

      {/* HEADER */}
      <thead className="bg-blue-600 text-left text-xs uppercase tracking-wide text-white">
        <tr>
          <th className="w-[15%] cursor-pointer select-none p-4"
            onClick={() => handleSort('courseCode')}>
            Subject Code <SortIcon column="courseCode" />
          </th>

          <th className="w-[30%] cursor-pointer select-none px-4 py-2"
            onClick={() => handleSort('courseTitle')}>
            Subject Description <SortIcon column="courseTitle" />
          </th>

          <th className="w-[15%] px-4 py-2">
            Course
          </th>

          <th className="w-[15%] cursor-pointer select-none px-4 py-2"
            onClick={() => handleSort('yearLevel')}>
            Block/s <SortIcon column="yearLevel" />
          </th>

          <th className="w-[15%] cursor-pointer select-none px-4 py-2"
            onClick={() => handleSort('curriculum')}>
            Curriculum <SortIcon column="curriculum" />
          </th>

          <th className="w-[10%] px-4 py-2 text-right">
            Actions
          </th>
        </tr>
      </thead>

      {/* BODY */}
      <tbody className="bg-white">

        {tableLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <tr key={index} className="border-t border-gray-100">
              <td className="px-4 py-2"><div className="h-4 w-20 animate-pulse rounded bg-gray-100" /></td>
              <td className="px-4 py-2"><div className="h-4 w-56 animate-pulse rounded bg-gray-100" /></td>
              <td className="px-4 py-2"><div className="h-4 w-32 animate-pulse rounded bg-gray-100" /></td>
              <td className="px-4 py-2"><div className="h-5 w-44 animate-pulse rounded bg-gray-100" /></td>
              <td className="px-4 py-2"><div className="h-4 w-32 animate-pulse rounded bg-gray-100" /></td>
              <td className="px-4 py-2"><div className="ml-auto h-7 w-12 animate-pulse rounded bg-gray-100" /></td>
            </tr>
          ))
        ) : assignedCourses.length === 0 ? (
          <tr>
            <td colSpan={6}>
              <div className="py-6 text-center">
                <p className="text-sm font-medium text-gray-700">
                  No subjects assigned yet
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Assign a subject to start managing blocks and students.
                </p>
              </div>
            </td>
          </tr>
        ) : assignedSubjectsByYear.length === 0 ? (
          <tr>
            <td colSpan={6}>
              <div className="py-6 text-center">
                <p className="text-sm font-medium text-gray-700">
                  No subjects for {YEAR_TABS.find(y => y.value === assignedYearTab)?.label}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Try another year level or assign a new subject.
                </p>
              </div>
            </td>
          </tr>
        ) : (
          assignedSubjectsByYear.map(c => {
            const isEditing = editingBlocksFor === c.courseId;

            return (
              <tr
                key={c.courseId}
                onClick={() => { if (!isEditing) viewStudents(c); }}
                className="cursor-pointer border-t border-gray-100 hover:bg-blue-50/30 transition"
              >
                <td className="px-4 py-2 font-semibold text-gray-900">{c.courseCode}</td>

                <td className="px-4 py-2 text-gray-700">
                  <div className="truncate" title={c.courseTitle}>
                    {c.courseTitle}
                  </div>
                </td>

                <td className="px-4 py-2 text-gray-600">
                  {getCourseLabel(c)}
                </td>

                <td className="px-4 py-2 text-gray-600">
                   Block: {" "}
                  {c.blocks?.length ? c.blocks.join(', ') : '-'}
                </td>

                <td className="px-4 py-2 text-gray-600">
                  <div className="truncate">
                    {c.source === 'other-department'
                      ? c.departmentName || 'Other Department'
                      : c.curriculumName || '-'}
                  </div>
                </td>

                <td className="px-4 py-2 text-right">
                  <div
                    className="flex items-center justify-end gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setConfirmUnassign(c)}
                      className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
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

      {/* ── Students modal ── */}
      {selectedSubject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeStudentsModal}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="border-b border-gray-200 px-6 pb-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
                    <Users className="h-3.5 w-3.5" /> Enrolled Students
                  </div>
                  <h6 className="truncate text-xl font-semibold text-gray-800">
                    {selectedSubject.courseCode} — {selectedSubject.courseTitle}
                  </h6>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {getYearBlockLabel(selectedSubject)}
                    </span>
                    {!studentsLoading && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {students.length} Student{students.length !== 1 ? 's' : ''} 
                      </span>
                    )}
                  </div>
                </div>
                
              </div>

              {/* Student tabs — block tabs plus Irregular tab when available */}
              {!studentsLoading && modalTabs.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
                  {modalTabs.map((tab) => {
                    const isActive = activeBlockTab === tab.value;
                    return (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => { setActiveBlockTab(tab.value); setStudentSearch(''); }}
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-1 text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                            : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer'
                        }`}
                      >
                        {tab.label}
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

            </div>

            {/* Modal body — per-block student table */}
              <div className="flex-1 overflow-y-auto px-2 rounded-2xl">
              {studentsLoading ? (
                <div className="py-12 text-center text-sm text-gray-500">Loading students...</div>
              ) : students.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-700">No students enrolled</p>
                  <p className="mt-1 text-sm text-gray-500">No students are taking this subject in the active term.</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">
                  {studentSearch ? 'No students match your search.' : activeBlockTab === IRREGULAR_MODAL_TAB ? 'No irregular students enrolled.' : `No students in Block ${activeBlockTab}.`}
                </div>
              ) : (
                <table className="min-w-full text-sm rounded-2xl">
                  <thead className="sticky top-0 bg-blue-700 text-left text-sm tracking-wide text-white">
                    <tr>
                      
                      <th className="px-4 py-2 cursor-pointer select-none" onClick={() => handleStudentSort('name')}>
                        Name <StudentSortIcon column="name" />
                      </th>
                      <th className="px-4 py-2">Course</th>
                      <th className="px-4 py-2">Year Level</th>
                      <th className="px-4 py-2">Block</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.map((s, i) => {
                      let block;
                      let displayYearLevel = s.yearLevel;
                      if (s.isIrregular) {
                        block = 'Irregular';
                        // Show the year level of the class they joined, not their own standing
                        const activeSem = Number(activeTerm?.semester) || 1;
                        const semKey = `sem${activeSem}`;
                        const targetCode = (selectedSubject?.courseCode || '').toString().trim().toUpperCase();
                        const irregItems = ((s.irregularSubjects || {})[semKey]) || [];
                        const matchedItem = irregItems.find(
                          item => (item.courseCode || '').toString().trim().toUpperCase() === targetCode
                        );
                        if (matchedItem?.joinedYearLevel) {
                          displayYearLevel = matchedItem.joinedYearLevel;
                        }
                      } else {
                        block = s.block && String(s.block).trim() !== ''
                          ? String(s.block).trim().toUpperCase()
                          : 'A';
                      }
                      const courseLabel = getStudentCourseLabel(s, selectedSubject);
                      return (
                        <tr
                          key={s.id}
                          className="border-t border-gray-200 hover:bg-gray-50"
                        >
                         
                          <td className="px-4 py-2">
                            <p className="font-semibold text-gray-800">{s.name}</p>
                           
                          </td>
                          <td className="px-4 py-2 text-gray-700">{courseLabel}</td>
                          <td className="px-4 py-2 text-gray-600">{getYearLabel(displayYearLevel)}</td>
                          <td className="px-4 py-2 text-gray-600">{block}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex justify-end border-t border-gray-200 px-6 py-6">
              <button
                onClick={closeStudentsModal}
                className="rounded-lg border cursor-pointer border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {blockModalOpen && editingBlocksFor && (() => {
        const editingAssignment = assignedCourses.find(c => c.courseId === editingBlocksFor);
        const editableConfig = getEditableBlocksForAssignment(editingAssignment);
        const selectedText = editingBlocksValue.length > 0 ? editingBlocksValue.join(', ') : 'None selected';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Choose blocks</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Select available blocks for <span className="font-semibold text-gray-800">{editingAssignment?.courseCode || 'this subject'}</span>.
                    </p>
                  </div>
                  <button
                    onClick={cancelEditBlocks}
                    className="text-gray-500 hover:text-gray-700"
                    aria-label="Close block chooser"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-5">
                <div className="mb-4 text-sm text-gray-700">
                  Available blocks are shown below. Tap a block to add or remove it.
                </div>

                <BlockToggle
                  value={editingBlocksValue}
                  onChange={setEditingBlocksValue}
                  availableBlocks={editableConfig.allBlocks}
                  unavailableBlocks={editableConfig.blockedByOthers}
                />

                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  <div className="font-semibold text-gray-800">Selected blocks</div>
                  <div className="mt-1">{selectedText}</div>
                </div>

                {/* blocked-by-others details shown via toast when needed */}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
                <button
                  onClick={cancelEditBlocks}
                  disabled={savingBlocks}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditBlocks}
                  disabled={savingBlocks}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {savingBlocks ? 'Saving…' : 'Save blocks'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {otherBlockModalOpen && otherModalCourse && (() => {
        const { availableBlocks, unavailableBlocks } = getOtherBlockAvailability(otherModalCourse);
        const selectedText = otherModalBlocks.length > 0 ? otherModalBlocks.join(', ') : 'None selected';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Choose blocks</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Select blocks for <span className="font-semibold text-gray-800">{otherModalCourse.courseCode}</span> ({getYearLabel(otherSelectedClass?.yearLevel)})
                    </p>
                  </div>
                  <button
                    onClick={closeOtherBlockModal}
                    className="text-gray-500 hover:text-gray-700"
                    aria-label="Close block chooser"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-5">
                <div className="mb-4 text-sm text-gray-700">
                  Available blocks are shown below. Tap a block to add or remove it.
                </div>

                <BlockToggle
                  value={otherModalBlocks}
                  onChange={setOtherModalBlocks}
                  availableBlocks={availableBlocks}
                  unavailableBlocks={unavailableBlocks}
                />

                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  <div className="font-semibold text-gray-800">Selected blocks</div>
                  <div className="mt-1">{selectedText}</div>
                </div>

                {/* unavailable blocks info shown via toast notifications when needed */}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
                <button
                  onClick={closeOtherBlockModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveOtherBlockSelection}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Save blocks
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {ccsBlockModalOpen && ccsModalCourse && (() => {
        const availableBlocks = getBlocksForYear(ccsModalCourse.yearLevel, false);
        const unavailableBlocks = getTakenBlocksForCourse(ccsModalCourse.id);
        const selectedText = ccsModalBlocks.length > 0 ? ccsModalBlocks.join(', ') : 'None selected';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Choose blocks</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Select blocks for <span className="font-semibold text-gray-800">{ccsModalCourse.courseCode}</span> ({getYearLabel(ccsModalCourse.yearLevel)})
                    </p>
                  </div>
                  <button
                    onClick={closeCcsBlockModal}
                    className="text-gray-500 hover:text-gray-700"
                    aria-label="Close block chooser"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-5">
                <div className="mb-4 text-sm text-gray-700">
                  Available blocks are shown below. Tap a block to add or remove it.
                </div>

                <BlockToggle
                  value={ccsModalBlocks}
                  onChange={setCcsModalBlocks}
                  availableBlocks={availableBlocks}
                  unavailableBlocks={unavailableBlocks}
                />

                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  <div className="font-semibold text-gray-800">Selected blocks</div>
                  <div className="mt-1">{selectedText}</div>
                </div>

                {/* unavailable blocks info shown via toast notifications when needed */}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
                <button
                  onClick={closeCcsBlockModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCcsBlockSelection}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Save blocks
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Assign picker (page view) ── */}
      {pickerOpen && (
        <div className="">
          

            {/* Content card */}
            <div className="">
              <div className="">
                

                {/* picker/other errors are displayed via toast notifications */}

                <div className="mb-4 ">
  <div className="flex gap-2 w-fit items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
  <button
    type="button"
    onClick={() => {
      setPickerTab('ccs');
      setPickerError('');
      setOtherError('');
    }}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-1 text-sm font-medium transition-all ${
      pickerTab === 'ccs'
       ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer'
    }`}
  >
    <Laptop className="h-4 w-4" />
    CCS Curriculum
  </button>

  <button
    type="button"
    onClick={() => {
      setPickerTab('other');
      setPickerError('');
      setOtherError('');
    }}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-1 text-sm font-medium transition-all ${
      pickerTab === 'other'
        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer'
    }`}
  >
    <Building2 className="h-4 w-4" />
    Other Department
  </button>
</div>
                </div>

                {/* Body (scroll area) */}
                <div className="w-full mt-4">
              {pickerTab === 'ccs' ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className='flex items-center gap-4 justify-between'>
                
               <div>
 <div className="flex gap-2 w-fit items-center border-b border-slate-200">
  {YEAR_TABS.map(year => {
    const isActive = pickerYearTab === year.value;
    const count = pickerYearCounts[year.value] || 0;

    return (
      <button
        key={year.value}
        type="button"
        onClick={() => setPickerYearTab(year.value)}
        className={`relative px-4 py-2 text-sm font-medium transition-all ${
          isActive
            ? 'text-blue-600 border-b-2 border-blue-600'
            : 'text-slate-600 hover:text-slate-900 border-b-2 border-transparent cursor-pointer'
        }`}
      >
        {year.label}
      </button>
    );
  })}
</div>
               </div>

                   <div className="flex items-center gap-2 mb-4">
                  <select
                    value={pickerCurriculumId}
                    onChange={(e) => {
                      setPickerCurriculumId(e.target.value);
                      setPickerYearTab(1);
                      setPickerError('');
                    }}
                    className={`rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1 ${
                      pickerCurriculumId
                        ? 'border-blue-300 bg-blue-50/30 ring-1 ring-inset ring-blue-200'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    <option value="">Select a curriculum...</option>
                    {curriculums.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                   
                    <div className="relative w-80">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search course code or title..."
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1"
                        disabled={!pickerCurriculumId}
                      />
                    </div>
                </div>

              
                </div>
                    
                    <div className=' text-sm mb-2 text-slate-500'>
  Please assign a block first before selecting a subject to assign to the professor.
                    </div>

                {/* ── Subject list as table ── */}
                  <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white">
                    {!pickerCurriculumId ? (
                      <p className="p-8 text-center text-sm text-gray-500">
                        Select a curriculum to view its subjects.
                      </p>
                    ) : pickerLoading ? (
                      <p className="p-8 text-center text-sm text-gray-500">
                        Loading subjects...
                      </p>
                    ) : sortedPickerCourses.length === 0 ? (
                      <p className="p-8 text-center text-sm text-gray-500">
                        {pickerSearch
                          ? 'No subjects match your search for this year level.'
                          : `No subjects found for ${YEAR_TABS.find(y => y.value === pickerYearTab)?.label}.`}
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full overflow-hidden rounded-xl text-sm">
                          <thead className="bg-blue-500 text-left text-xs uppercase text-white">
                            <tr>
                              <th className="px-4 py-3  font-semibold first:rounded-tl-xl w-[10%]">
                                Actions
                              </th>
                              <th className=" px-4 py-3 font-semibold w-[10%]">
                                Select
                              </th>
                              <th
                                className="cursor-pointer select-none px-4 py-3 font-semibold w-[20%]"
                                onClick={() => handlePickerSort('courseCode')}
                              >
                                Code <PickerSortIcon col="courseCode" />
                              </th>
                              <th
                                className="cursor-pointer select-none px-4 py-3 font-semibold w-[30%]"
                                onClick={() => handlePickerSort('courseTitle')}
                              >
                                Title <PickerSortIcon col="courseTitle" />
                              </th>
                              <th
                                className="cursor-pointer select-none px-4 py-3 font-semibold w-[10%]"
                                onClick={() => handlePickerSort('units')}
                              >
                                Units <PickerSortIcon col="units" />
                              </th>
                              <th className="px-4 py-3 font-semibold first:rounded-tr-2xl w-[20%]">
                                Blocks
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-gray-100 bg-white">
                            {sortedPickerCourses.map((course, index) => {
                              const assignedToThis = currentProfessorAssignedCourseIds.has(course.id);
                              const availableBlocks = getBlocksForYear(course.yearLevel, false);
                              const takenByOthers = getTakenBlocksForCourse(course.id);
                              const freeBlocks = getFreeBlocksForCourse(course.id, availableBlocks);
                              const noBlocksSelected =
                                !assignedToThis && getPickerBlocksForCourse(course).length === 0;
                              const assignedElsewhere =
                                !assignedToThis && freeBlocks.length === 0;
                              const isSaving = savingCourseIds.has(course.id);

                              const tooltip = assignedElsewhere
                                ? 'All blocks for this subject are already assigned to other professors'
                                : assignedToThis
                                  ? 'Already assigned to this professor'
                                  : 'Select this subject';

                              return (
                                <tr
                                  key={course.id}
                                  className={`transition ${
                                    assignedElsewhere
                                      ? 'opacity-60'
                                      : assignedToThis
                                        ? 'bg-green-50/70'
                                        : 'hover:bg-green-50/50'
                                  } ${
                                    index === sortedPickerCourses.length - 1
                                      ? '[&>td:first-child]:rounded-bl-2xl [&>td:last-child]:rounded-br-2xl'
                                      : ''
                                  }`}
                                >
                                  <td className="px-4 py-3">
                                    <button
                                      type="button"
                                      onClick={() => openCcsBlockModal(course)}
                                      title={assignedToThis ? 'Update blocks' : 'Assign blocks'}
                className={`p-2 rounded-xl transition ${
                                        assignedToThis
                                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
                                      } disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500`}
                                    >
                                      {assignedToThis ? (
                                        <>
                                          <ClipboardEdit className="h-3.5 w-3.5" />
                                        </>
                                      ) : (
                                        <>
                                          <UserPlus className="h-3.5 w-3.5" />
                                        </>
                                      )}
                                    </button>
                                  </td>

                                  <td className="px-4 py-3">
                                    <div
                                      className="inline-flex items-center gap-2"
                                      title={tooltip}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={assignedToThis}
                                        disabled={assignedElsewhere || isSaving}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          toggleCcsAssignment(course, checked);
                                        }}
                                        aria-label={`Select ${course.courseCode}`}
                                        className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 accent-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
                                      />
                                    </div>
                                  </td>

                                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">
                                    {course.courseCode}
                                  </td>

                                  <td className="px-4 py-3 text-gray-700">
                                    <div
                                      className="max-w-[260px] truncate"
                                      title={course.courseTitle}
                                    >
                                      {course.courseTitle}
                                    </div>
                                  </td>

                                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                                    {Number(course.units) > 0 ? course.units : '—'}
                                  </td>

                                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                                    {getPickerBlocksForCourse(course).length > 0
                                      ? getPickerBlocksForCourse(course).join(', ')
                                      : 'None selected'}
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
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-4">

                {/* ── Folders / Accordions: step-by-step flow ── */}

               <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                      {/* Department */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Department</label>
                        <select
                          value={otherDeptId}
                          onChange={(e) => {
                            setOtherDeptId(e.target.value);
                            setOtherYearTab(1);
                            setOtherSelectedClass(null);
                            setOtherSelectedCourse('');
                            setOtherCurriculumId('');
                            setOtherBlocks([]);
                          }}
                          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1 ${
                            otherDeptId
                              ? 'border-blue-300 bg-white ring-1 ring-inset ring-blue-200'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          <option value="">Select department...</option>
                          {otherDepts.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.name}{d.code ? ` (${d.code})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Class */}
                      <div className="order-3">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Course</label>
                        <select
                          value={otherSelectedCourse}
                          onChange={(e) => {
                            setOtherSelectedCourse(e.target.value);
                            setOtherSelectedClass(null);
                            setOtherBlocks([]);
                            setOtherSubjectSearch('');
                            setOtherError('');
                          }}
                          disabled={!otherCurriculumId || otherClassesLoading}
                          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1 disabled:bg-gray-50 ${
                            otherSelectedCourse
                              ? 'border-blue-300 bg-white ring-1 ring-inset ring-blue-200'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          <option value="">
                            {otherClassesLoading ? 'Loading...' : 'Select course...'}
                          </option>
                          {otherCourseOptions.map(course => (
                            <option key={course} value={course}>{course}</option>
                          ))}
                        </select>
                      </div>

                       {/* Curriculum */}
                      <div className="order-2">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Curriculum</label>
                        <select
                          value={otherCurriculumId}
                          onChange={(e) => {
                            setOtherCurriculumId(e.target.value);
                            setOtherSelectedCourse('');
                            setOtherSelectedClass(null);
                            setOtherBlocks([]);
                            setOtherSubjectSearch('');
                          }}
                          disabled={!otherDeptId}
                          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1 disabled:bg-gray-50 ${
                            otherCurriculumId
                              ? 'border-blue-300 bg-white ring-1 ring-inset ring-blue-200'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          <option value="">Select curriculum...</option>
                          {curriculums.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="order-4">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Year Level</label>
                        <select
                          value={otherSelectedClass
                            ? `${otherSelectedClass.course.toLowerCase()}::${otherSelectedClass.yearLevel}`
                            : ''}
                          onChange={(e) => {
                            const found = otherYearOptions.find(c =>
                              `${c.course.toLowerCase()}::${c.yearLevel}` === e.target.value
                            );
                            setOtherSelectedClass(found || null);
                            setOtherYearTab(Number(found?.yearLevel) || 1);
                            setOtherBlocks([]);
                            setOtherSubjectSearch('');
                            setOtherError('');
                          }}
                          disabled={!otherSelectedCourse}
                          className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1 disabled:bg-gray-50 ${
                            otherSelectedClass
                              ? 'border-blue-300 bg-white ring-1 ring-inset ring-blue-200'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          <option value="">Select year level...</option>
                          {otherYearOptions.map(c => {
                            const key = `${c.course.toLowerCase()}::${c.yearLevel}`;
                            return (
                              <option key={key} value={key}>
                                {getYearLabel(c.yearLevel)} - {c.studentCount} student{c.studentCount !== 1 ? 's' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>


                    </div>

                 
                  <div className="border-t border-gray-200 bg-gray-50/40 pt-2">
  {otherSelectionComplete && (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      
      {/* Year Tabs */}
      <div className="hidden">
        {YEAR_TABS.map(year => {
          const isActive = otherYearTab === year.value;
          const count = otherYearCounts[year.value] || 0;

          return (
            <button
              key={year.value}
              type="button"
              onClick={() => setOtherYearTab(year.value)}
              className={`rounded-lg px-4 py-1 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer'
              }`}
            >
              {year.label}

             
            </button>
          );
        })}
      </div>

      

      {/* Filters */}
<div className="">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
    


    {/* Search */}
    <div className="relative w-80">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

      <input
        type="text"
        placeholder="Search course code or title..."
        value={otherSubjectSearch}
        onChange={(e) => setOtherSubjectSearch(e.target.value)}
        disabled={!otherSelectionComplete}
        className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm transition focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50"
      />
    </div>
  </div>
</div>
    </div>
  )}
</div>

                <div className="border-t border-gray-200">
                    <div className="min-h-0">
                      {!otherDeptId ? (
                        <p className="p-8 text-center text-sm text-gray-500">Select a department first.</p>
                      ) : !otherCurriculumId ? (
                        <p className="p-8 text-center text-sm text-gray-500">Select a curriculum.</p>
                      ) : !otherSelectedCourse ? (
                        <p className="p-8 text-center text-sm text-gray-500">Select a course.</p>
                      ) : !otherSelectedClass ? (
                        <p className="p-8 text-center text-sm text-gray-500">Select a year level.</p>
                      ) : otherCurriculumLoading ? (
                        <p className="p-8 text-center text-sm text-gray-500">Loading subjects...</p>
                      ) : sortedOtherCourses.length === 0 ? (
                        <p className="p-8 text-center text-sm text-gray-500">
                          {otherSubjectSearch
                            ? 'No subjects match your search for this year level.'
                            : `No subjects found for ${YEAR_TABS.find(y => y.value === otherYearTab)?.label}.`}
                        </p>
                      ) : (
                        <div className="overflow-hidden rounded-2xl border bg-white border-slate-200">
                          <table className="w-full text-sm">
                            <thead className="sticky text-xs uppercase top-0 border-b border-slate-200 bg-blue-500 text-left text-xs uppercase tracking-wide text-white">
                              <tr>
                                <th className="w-[92px] px-4 py-2 font-semibold">Select</th>
                                <th
                                  className="cursor-pointer select-none px-4 py-2 font-semibold"
                                  onClick={() => handleOtherSort('courseCode')}
                                >
                                  Code <OtherSortIcon col="courseCode" />
                                </th>
                                <th
                                  className="cursor-pointer select-none px-4 py-2 font-semibold"
                                  onClick={() => handleOtherSort('courseTitle')}
                                >
                                  Title <OtherSortIcon col="courseTitle" />
                                </th>
                                <th
                                  className="cursor-pointer select-none px-4 py-2 font-semibold"
                                  onClick={() => handleOtherSort('units')}
                                >
                                  Units <OtherSortIcon col="units" />
                                </th>
                                <th className="px-4 py-2 font-semibold">
                                  Blocks
                                </th>
                                <th className="px-4 py-2 font-semibold text-right">
                                  Actions
                                </th>

                              </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-100 bg-white">
                              {sortedOtherCourses.map(course => {
                                const otherCourseId = otherSelectedClass
                                  ? `other::${otherDeptId}::${otherSelectedClass.course.toLowerCase()}::${otherSelectedClass.yearLevel}::${course.id}`
                                  : null;

                                const assignedToThis = otherCourseId
                                  ? currentProfessorAssignedCourseIds.has(otherCourseId)
                                  : false;

                                const classBlocks = normalizeBlockList(otherSelectedClass?.blocks || []);
                                const freeClassBlocks = otherCourseId
                                  ? getFreeBlocksForCourse(otherCourseId, classBlocks)
                                  : [];

                                const assignedElsewhere = otherCourseId
                                  ? (!assignedToThis && freeClassBlocks.length === 0)
                                  : false;

                                const isSaving = otherCourseId
                                  ? savingCourseIds.has(otherCourseId)
                                  : false;

                                const missingBlocksForAssign =
                                  !assignedToThis && normalizeBlockList(otherBlocks).length === 0;

                                const displayedBlocks = assignedToThis && otherCourseId
                                  ? getExistingAssignmentBlocks(otherCourseId)
                                  : normalizeBlockList(otherBlocks);

                                const tooltip = assignedElsewhere
                                  ? 'All class blocks for this subject are already assigned to other professors'
                                  : assignedToThis
                                    ? 'Already assigned to this professor'
                                    : 'Select this subject';

                                return (
                                  <tr
                                    key={course.id}
                                    className={`transition ${
                                      assignedElsewhere
                                        ? 'cursor-not-allowed opacity-50'
                                        : assignedToThis
                                          ? 'bg-green-50'
                                          : 'hover:bg-green-50/50'
                                    }`}
                                  >
                                    <td className="px-4 py-2">
                                      <div
                                        className="inline-flex items-center gap-2"
                                        title={tooltip}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={assignedToThis}
                                          disabled={
                                            !otherCourseId ||
                                            assignedElsewhere ||
                                            isSaving ||
                                            missingBlocksForAssign
                                          }
                                          onChange={(e) => {
                                            const checked = e.target.checked;
                                            toggleOtherAssignment(course, checked);
                                          }}
                                          aria-label={`Select ${course.courseCode}`}
                                          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 accent-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
                                        />
                                      </div>
                                    </td>

                                    <td className="whitespace-nowrap px-4 py-2 font-semibold text-gray-900">
                                      {course.courseCode}
                                    </td>

                                    <td className="px-4 py-2 text-gray-700">
                                      <div
                                        className="max-w-[320px] truncate"
                                        title={course.courseTitle}
                                      >
                                        {course.courseTitle}
                                      </div>
                                    </td>

                                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">
                                      {Number(course.units) > 0 ? course.units : '—'}
                                    </td>

                                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">
                                      {displayedBlocks.length > 0 ? displayedBlocks.join(', ') : 'None selected'}
                                    </td>

                                    <td className="px-4 py-2 text-right">
                                      <button
                                        type="button"
                                        onClick={() => openOtherBlockModal(course)}
                                        disabled={!otherCourseId || assignedElsewhere || isSaving}
                                        className="px-4 py-2 w-20 text-xs cursor-pointer rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                                      >
                                        {assignedToThis ? 'Update' : 'Assign'}
                                      </button>
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

              
              </div>
            )}
            </div>

              </div>
            </div>
        </div>
      )}

      {/* ── Confirm unassign modal ── */}
      {confirmIrregularAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmIrregularAction(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h6 className="mb-2 text-lg font-semibold text-gray-800">
              {confirmIrregularAction.action === 'unenroll' ? 'Confirm Unenroll' : 'Confirm Enroll'}
            </h6>
            <p className="mb-5 text-sm text-gray-600">
              Are you sure you want to {confirmIrregularAction.action === 'unenroll' ? 'unenroll' : 'enroll'} <span className="font-semibold text-gray-900">{confirmIrregularAction.student.name}</span> {confirmIrregularAction.action === 'unenroll' ? 'from their current term enrollment' : 'in the active term'}?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmIrregularAction(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeIrregularStudentAction}
                className={`rounded-lg px-4 py-2 text-sm text-white ${confirmIrregularAction.action === 'unenroll' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {confirmIrregularAction.action === 'unenroll' ? 'Unenroll' : 'Enroll'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmUnassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white  shadow-xl">
            <div className='px-8 py-4 border-b border-slate-300'>
              <h6 className="text-xl font-medium text-slate-800">Unassign Subject</h6>
              </div>
              <div className='px-8 py-4'>
                <p className="mb-8 text-sm text-justify text-gray-600">
                  Are you sure you want to unassign
                  <span className="font-semibold text-gray-900 ml-1">{confirmUnassign.courseCode}</span>
                  {confirmUnassign.courseTitle ? (
                    <span className="font-semibold text-gray-700"> — {confirmUnassign.courseTitle}</span>
                  ) : null}
                  {' '}from this professor?
                </p>

                <div className="mb-6">
                  <div className="font-semibold text-gray-900">{confirmUnassign.professorName}</div>
                  {confirmUnassign.professorEmployeeId && (
                    <div className="text-sm text-gray-600">{confirmUnassign.professorEmployeeId}</div>
                  )}
                  {confirmUnassign.professorEmail && (
                    <div className="text-sm text-gray-600">{confirmUnassign.professorEmail}</div>
                  )}
                </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmUnassign(null)}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnassign}
                className="px-4 py-1.5 w-28 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
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

