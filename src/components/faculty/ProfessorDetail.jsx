import { useEffect, useMemo, useState } from 'react';
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
  ChevronsUpDown
} from 'lucide-react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCurriculums, getCoursesByCurriculum, getStudents } from '../../models/curriculumModels';
import {
  assignCourseToProfessor,
  unassignCourseFromProfessor,
  updateAssignedCourseBlocks,
  getStudentsForCourse,
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

const BlockToggle = ({ value, onChange, availableBlocks = [] }) => {
  const blocksToShow = availableBlocks.length > 0 ? availableBlocks : ['A'];

  const toggle = (b) => {
    const has = value.includes(b);
    onChange(has ? value.filter(x => x !== b) : [...value, b].sort());
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {blocksToShow.map(b => {
        const active = value.includes(b);
        return (
          <button
            key={b}
            type="button"
            onClick={() => toggle(b)}
            className={`min-w-[34px] rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              active
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            {b}
          </button>
        );
      })}
    </div>
  );
};

const ProfessorDetail = ({ professorId, activeTerm, onBack }) => {
  const [professor, setProfessor] = useState(null);
  const [studentsSource, setStudentsSource] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState('');
  const [assignedYearTab, setAssignedYearTab] = useState(1);

  const [sortBy, setSortBy] = useState('courseCode');
  const [sortOrder, setSortOrder] = useState('asc');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState('ccs');
  const [curriculums, setCurriculums] = useState([]);
  const [pickerCurriculumId, setPickerCurriculumId] = useState('');
  const [pickerCourses, setPickerCourses] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  // ── NEW: year tab inside picker for CCS subjects ──
  const [pickerYearTab, setPickerYearTab] = useState(1);
  const [pendingCourse, setPendingCourse] = useState(null);
  const [pendingBlocks, setPendingBlocks] = useState([]);
  const [pendingError, setPendingError] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);
  // ── course IDs already assigned to ANY other professor (system-wide) ──
  const [allAssignedCourseIds, setAllAssignedCourseIds] = useState(new Set());

  const [otherDepts, setOtherDepts] = useState([]);
  const [otherDeptId, setOtherDeptId] = useState('');
  const [otherClasses, setOtherClasses] = useState([]);
  const [otherClassesLoading, setOtherClassesLoading] = useState(false);
  const [otherSelectedClass, setOtherSelectedClass] = useState(null);
  const [otherCurriculumId, setOtherCurriculumId] = useState('');
  const [otherCurriculumCourses, setOtherCurriculumCourses] = useState([]);
  const [otherCurriculumLoading, setOtherCurriculumLoading] = useState(false);
  const [otherSubjectSearch, setOtherSubjectSearch] = useState('');
  const [otherSelectedCourse, setOtherSelectedCourse] = useState(null);
  const [otherBlocks, setOtherBlocks] = useState([]);
  const [otherError, setOtherError] = useState('');
  const [savingOther, setSavingOther] = useState(false);
  // ── sort + year-tab state for Other Dept subject table ──
  const [otherSortBy, setOtherSortBy] = useState('courseCode');
  const [otherSortOrder, setOtherSortOrder] = useState('asc');
  const [otherYearTab, setOtherYearTab] = useState(1);

  const [editingBlocksFor, setEditingBlocksFor] = useState(null);
  const [editingBlocksValue, setEditingBlocksValue] = useState([]);
  const [savingBlocks, setSavingBlocks] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  // Active block tab in the students modal
  const [activeBlockTab, setActiveBlockTab] = useState(null);

  const [confirmUnassign, setConfirmUnassign] = useState(null);

  const assignedCourses = professor?.assignedCourses || [];

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
      if (sortBy === 'yearBlock') {
        aValue = getYearBlockLabel(a).toUpperCase();
        bValue = getYearBlockLabel(b).toUpperCase();
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
    return YEAR_TABS.reduce((acc, year) => {
      acc[year.value] = assignedCourses.filter(c => Number(c.yearLevel) === year.value).length;
      return acc;
    }, {});
  }, [assignedCourses]);

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

  const getAvailableBlocksForAssignment = (assignment) => {
    if (assignment?.source === 'other-department') {
      return assignment.blocks?.length ? assignment.blocks : ['A'];
    }
    return getBlocksForYear(assignment?.yearLevel, false);
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
        setError('Professor not found.');
      }
      if (studentsRes.success) setStudentsSource(studentsRes.data);
    } catch (err) {
      setError(err.message);
    }
    if (tableOnly) setTableLoading(false);
    else setLoading(false);
  };

  useEffect(() => { refreshProfessor(); }, [professorId]);

  useEffect(() => {
    if (!selectedSubject) return;
    const onKey = (e) => { if (e.key === 'Escape') closeStudentsModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedSubject]);

  const closeStudentsModal = () => {
    setSelectedSubject(null);
    setStudents([]);
    setStudentSearch('');
    setActiveBlockTab(null);
  };

  // Tabs are driven by assignment.blocks (what blocks the professor was assigned),
  // NOT by what blocks happen to appear in the fetched student list.
  // This ensures Block A and Block B tabs always appear when both were assigned,
  // even if the returned students all share the same block value in the DB.
  const availableBlocks = useMemo(() => {
    const assigned = selectedSubject?.blocks;
    if (assigned && assigned.length > 0) {
      return [...assigned]
        .map(b => String(b).trim().toUpperCase())
        .sort((a, b) => a.localeCompare(b));
    }
    // Fallback: derive from actual student block fields
    const set = new Set();
    students.forEach(s => {
      const b = s.block && String(s.block).trim() !== ''
        ? String(s.block).trim().toUpperCase()
        : 'A';
      set.add(b);
    });
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return sorted.length > 0 ? sorted : ['A'];
  }, [selectedSubject, students]);

  // Auto-select first block when tabs change; preserve current tab if it still exists
  useEffect(() => {
    if (availableBlocks.length > 0) {
      setActiveBlockTab(prev => {
        if (prev && availableBlocks.includes(prev)) return prev;
        return availableBlocks[0];
      });
    }
  }, [availableBlocks]);

  // Students shown in the table = those whose block field matches the active tab,
  // further narrowed by search. Blank block field defaults to 'A' (same as StudentManagement).
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return students.filter(s => {
      const block = s.block && String(s.block).trim() !== ''
        ? String(s.block).trim().toUpperCase()
        : 'A';
      if (block !== activeBlockTab) return false;
      if (!q) return true;
      return (
        (s.name || '').toLowerCase().includes(q) ||
        (s.studentNumber || '').toLowerCase().includes(q)
      );
    });
  }, [students, studentSearch, activeBlockTab]);

  const resetOtherForm = () => {
    setOtherDeptId('');
    setOtherClasses([]);
    setOtherSelectedClass(null);
    setOtherCurriculumId('');
    setOtherCurriculumCourses([]);
    setOtherSubjectSearch('');
    setOtherSelectedCourse(null);
    setOtherBlocks([]);
    setOtherError('');
    setOtherYearTab(1);
  };

  const openPicker = async () => {
    setPickerOpen(true);
    setPickerTab('ccs');
    setPickerSearch('');
    setPickerCurriculumId('');
    setPickerCourses([]);
    setPickerYearTab(1); // ── NEW: reset to 1st Year on open
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
    // Build set of course IDs assigned to OTHER professors
    const taken = new Set();
    allProfsSnap.forEach(snap => {
      if (snap.id === professorId) return; // skip current professor
      const courses = snap.data()?.assignedCourses || [];
      courses.forEach(c => taken.add(c.courseId));
    });
    setAllAssignedCourseIds(taken);
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
      if (!otherDeptId) { setOtherClasses([]); setOtherSelectedClass(null); return; }
      setOtherClassesLoading(true);
      const res = await getOtherDeptClasses(otherDeptId);
      if (res.success) setOtherClasses(res.data);
      setOtherClassesLoading(false);
      setOtherSelectedClass(null);
      setOtherBlocks([]);
    };
    loadOtherClasses();
  }, [otherDeptId]);

  useEffect(() => {
    const loadOtherCurriculumCourses = async () => {
      if (!otherCurriculumId) { setOtherCurriculumCourses([]); setOtherSelectedCourse(null); return; }
      setOtherCurriculumLoading(true);
      const res = await getCoursesByCurriculum(otherCurriculumId);
      if (res.success) setOtherCurriculumCourses(res.data);
      setOtherCurriculumLoading(false);
      setOtherSelectedCourse(null);
    };
    loadOtherCurriculumCourses();
  }, [otherCurriculumId]);

  // ── NEW: filter picker courses by year tab AND search ──
  const filteredPickerCourses = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return pickerCourses.filter(c => {
      const matchesYear = Number(c.yearLevel) === pickerYearTab;
      if (!matchesYear) return false;
      if (!q) return true;
      return (
        (c.courseCode || '').toLowerCase().includes(q) ||
        (c.courseTitle || '').toLowerCase().includes(q)
      );
    });
  }, [pickerCourses, pickerSearch, pickerYearTab]);

  // ── NEW: count per year tab for badge display ──
  const pickerYearCounts = useMemo(() => {
    return YEAR_TABS.reduce((acc, year) => {
      const q = pickerSearch.trim().toLowerCase();
      acc[year.value] = pickerCourses.filter(c => {
        if (Number(c.yearLevel) !== year.value) return false;
        if (!q) return true;
        return (
          (c.courseCode || '').toLowerCase().includes(q) ||
          (c.courseTitle || '').toLowerCase().includes(q)
        );
      }).length;
      return acc;
    }, {});
  }, [pickerCourses, pickerSearch]);

  const filteredOtherCourses = useMemo(() => {
    const q = otherSubjectSearch.trim().toLowerCase();
    if (!q) return otherCurriculumCourses;
    return otherCurriculumCourses.filter(c =>
      (c.courseCode || '').toLowerCase().includes(q) ||
      (c.courseTitle || '').toLowerCase().includes(q)
    );
  }, [otherCurriculumCourses, otherSubjectSearch]);

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

  const OtherSortIcon = ({ col }) => {
    if (otherSortBy !== col) return <ChevronsUpDown className="ml-1 inline-flex h-3 w-3 opacity-60" />;
    return otherSortOrder === 'asc'
      ? <ChevronUp className="ml-1 inline-flex h-3 w-3" />
      : <ChevronDown className="ml-1 inline-flex h-3 w-3" />;
  };

  const assignedCourseIds = useMemo(
    () => new Set([
      ...assignedCourses.map(c => c.courseId),
      ...allAssignedCourseIds
    ]),
    [assignedCourses, allAssignedCourseIds]
  );

  const startAssign = (course) => {
    setPendingError('');
    setPendingCourse(course);
    setPendingBlocks([]);
  };

  const cancelAssign = () => {
    setPendingCourse(null);
    setPendingBlocks([]);
    setPendingError('');
  };

  const confirmAssign = async () => {
    if (!pendingCourse) return;
    setPendingError('');
    if (pendingBlocks.length === 0) { setPendingError('Select at least one block.'); return; }
    const curriculum = curriculums.find(c => c.id === pickerCurriculumId);
    setSavingAssignment(true);
    const res = await assignCourseToProfessor(professorId, {
      courseId: pendingCourse.id,
      courseCode: pendingCourse.courseCode,
      courseTitle: pendingCourse.courseTitle,
      curriculumId: pickerCurriculumId,
      curriculumName: curriculum?.name || '',
      yearLevel: pendingCourse.yearLevel,
      semester: pendingCourse.semester,
      units: pendingCourse.units,
      blocks: pendingBlocks
    });
    setSavingAssignment(false);
    if (res.success) {
      cancelAssign();
      setPickerOpen(false);
      await refreshProfessor({ tableOnly: true });
    } else {
      setPendingError(res.error || 'Failed to assign subject.');
    }
  };

  const handleAssignOther = async () => {
    setOtherError('');
    if (!otherSelectedClass) { setOtherError('Select a class.'); return; }
    if (!otherSelectedCourse) { setOtherError('Pick a subject from a curriculum.'); return; }
    if (otherBlocks.length === 0) { setOtherError('Select at least one block.'); return; }
    const dept = otherDepts.find(d => d.id === otherDeptId);
    const curriculum = curriculums.find(c => c.id === otherCurriculumId);
    const subject = otherSelectedCourse;
    const courseId = `other::${otherDeptId}::${otherSelectedClass.course.toLowerCase()}::${otherSelectedClass.yearLevel}::${subject.id}`;
    if (assignedCourseIds.has(courseId)) { setOtherError('This subject is already assigned to another professor.'); return; }
    setSavingOther(true);
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
      blocks: otherBlocks
    });
    setSavingOther(false);
    if (res.success) {
      resetOtherForm();
      setPickerOpen(false);
      await refreshProfessor({ tableOnly: true });
    } else {
      setOtherError(res.error || 'Failed to assign class.');
    }
  };

  const startEditBlocks = (assignment) => {
    setEditingBlocksFor(assignment.courseId);
    setEditingBlocksValue(assignment.blocks || []);
  };

  const cancelEditBlocks = () => {
    setEditingBlocksFor(null);
    setEditingBlocksValue([]);
  };

  const saveEditBlocks = async () => {
    if (!editingBlocksFor) return;
    if (editingBlocksValue.length === 0) { setError('Select at least one block.'); return; }
    setError('');
    setSavingBlocks(true);
    const res = await updateAssignedCourseBlocks(professorId, editingBlocksFor, editingBlocksValue);
    setSavingBlocks(false);
    if (res.success) {
      if (selectedSubject?.courseId === editingBlocksFor) {
        const updated = { ...selectedSubject, blocks: editingBlocksValue };
        setSelectedSubject(updated);
        viewStudents(updated);
      }
      cancelEditBlocks();
      await refreshProfessor({ tableOnly: true });
    } else {
      setError(res.error || 'Failed to update blocks.');
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
    } else {
      setError(res.error || 'Failed to unassign subject.');
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
    else setError(res.error || 'Failed to load students.');
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

      <button
        onClick={openPicker}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500  cursor-pointer px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
      >
        <Plus className="h-4 w-4" />
        Assign Subject
      </button>

      {/* Stats (right aligned) */}
      <div className="flex flex-col items-end gap-2 text-right">

        <div className="text-sm text-gray-500">
          Subjects assigned:
          <span className="ml-2 font-semibold text-gray-900">
            {assignedCourses.length}
          </span>
        </div>

        <div className="text-sm text-gray-500">
          Active Term:
          <span className="ml-2 font-semibold text-gray-900">
            {SEMESTER_LABELS[activeTerm?.semester] || '1st Sem'}
            {activeTerm?.schoolYear
              ? ` · S.Y. ${activeTerm.schoolYear}`
              : ''}
          </span>
        </div>

      </div>

    </div>
  </div>
</div>

      {/* ── Subjects table ── */}
        <div className="">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

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
              <div className="flex gap-2 bg-slate-200/50 p-1.5 rounded-xl w-fit">
                {YEAR_TABS.map(year => {
                  const active = assignedYearTab === year.value;
                  return (
                    <button
                      key={year.value}
                      type="button"
                      onClick={() => setAssignedYearTab(year.value)}
                      className={`rounded-lg px-3 py-1 text-sm font-semibold transition ${
                        active
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-blue-600 cursor-pointer'
                      }`}
                    >
                      {year.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">

  <table className="w-full table-fixed text-sm">

    {/* HEADER */}
    <thead className="bg-blue-600 text-left text-xs uppercase tracking-wide text-white">
      <tr>
        <th
          className="w-[15%] cursor-pointer select-none px-4 py-2  "
          onClick={() => handleSort('courseCode')}
        >
          Subject Code <SortIcon column="courseCode" />
        </th>

        <th
          className="w-[30%] cursor-pointer select-none px-4 py-2  "
          onClick={() => handleSort('courseTitle')}
        >
          Subject Title <SortIcon column="courseTitle" />
        </th>

        <th
          className="w-[10%] cursor-pointer select-none px-4 py-2  "
          onClick={() => handleSort('units')}
        >
          Units <SortIcon column="units" />
        </th>

        <th
          className="w-[20%] cursor-pointer select-none px-4 py-2  "
          onClick={() => handleSort('yearBlock')}
        >
          Course & Yr. Lvl. <SortIcon column="yearBlock" />
        </th>

        <th
          className="w-[15%] cursor-pointer select-none px-4 py-2  "
          onClick={() => handleSort('curriculum')}
        >
          Curriculum <SortIcon column="curriculum" />
        </th>

        <th className="w-[10%] px-4 py-2   text-right">
          Actions
        </th>
      </tr>
    </thead>

    {/* BODY */}
    <tbody className="bg-white">

      {tableLoading ? (
        Array.from({ length: 5 }).map((_, index) => (
          <tr key={index} className="border-t border-gray-100">
            <td className="px-4 py-2  "><div className="h-4 w-20 animate-pulse rounded bg-gray-100" /></td>
            <td className="px-4 py-2  "><div className="h-4 w-56 animate-pulse rounded bg-gray-100" /></td>
            <td className="px-4 py-2  "><div className="h-4 w-10 animate-pulse rounded bg-gray-100" /></td>
            <td className="px-4 py-2  "><div className="h-5 w-44 animate-pulse rounded bg-gray-100" /></td>
            <td className="px-4 py-2  "><div className="h-4 w-32 animate-pulse rounded bg-gray-100" /></td>
            <td className="px-4 py-2  "><div className="ml-auto h-7 w-12 animate-pulse rounded bg-gray-100" /></td>
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
              <td className="px-4 py-2   font-semibold text-gray-900">{c.courseCode}</td>

              <td className="px-4 py-2   text-gray-700">
                <div className="truncate" title={c.courseTitle}>
                  {c.courseTitle}
                </div>
              </td>

              <td className="px-4 py-2   text-gray-600">
                {Number(c.units) > 0 ? c.units : '-'}
              </td>

              <td className="px-4 py-2  " onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-gray-600">
                    {getYearBlockLabel(c)}
                  </span>

                  {isEditing && (
                    <BlockToggle
                      value={editingBlocksValue}
                      onChange={setEditingBlocksValue}
                      availableBlocks={getAvailableBlocksForAssignment(c)}
                    />
                  )}
                </div>
              </td>

              <td className="px-4 py-2   text-gray-600">
                <div className="truncate" title={c.source === 'other-department'
                  ? c.departmentName
                  : c.curriculumName}>
                  {c.source === 'other-department'
                    ? c.departmentName || 'Other Department'
                    : c.curriculumName || '-'}
                </div>
              </td>

              <td className="px-4 py-2   text-right">
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>

                  {isEditing ? (
                    <>
                      <button
                        onClick={saveEditBlocks}
                        disabled={savingBlocks}
                        className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                      </button>

                      <button
                        onClick={cancelEditBlocks}
                        disabled={savingBlocks}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEditBlocks(c)}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => setConfirmUnassign(c)}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}

                </div>
              </td>
            </tr>
          );
        })
      )}

    </tbody>
  </table>
</div>
        </div>

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
                        {students.length} student{students.length !== 1 ? 's' : ''} total
                      </span>
                    )}
                  </div>
                </div>
                
              </div>

              {/* Block tabs — one per distinct block derived from student data, same as StudentManagement */}
              {!studentsLoading && availableBlocks.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
                  {availableBlocks.map(block => {
                    // Count students whose block field matches this tab
                    const count = students.filter(s => {
                      const b = s.block && String(s.block).trim() !== ''
                        ? String(s.block).trim().toUpperCase()
                        : 'A';
                      return b === block;
                    }).length;
                    const isActive = activeBlockTab === block;
                    return (
                      <button
                        key={block}
                        type="button"
                        onClick={() => { setActiveBlockTab(block); setStudentSearch(''); }}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-white hover:text-blue-600'
                        }`}
                      >
                        Block {block}
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Search — scoped to the active block */}
              {!studentsLoading && students.length > 0 && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name or student number..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <span className="whitespace-nowrap text-sm text-gray-500">
                    <span className="font-semibold text-gray-800">{filteredStudents.length}</span>
                    {studentSearch ? (
                      <>
                        {' '}of{' '}
                        {students.filter(s => {
                          const b = s.block && String(s.block).trim() !== ''
                            ? String(s.block).trim().toUpperCase() : 'A';
                          return b === activeBlockTab;
                        }).length}{' '}
                        in Block {activeBlockTab}
                      </>
                    ) : (
                      <>{' '}student{filteredStudents.length !== 1 ? 's' : ''} in Block {activeBlockTab}</>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Modal body — per-block student table */}
            <div className="flex-1 overflow-y-auto">
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
                  {studentSearch ? 'No students match your search in this block.' : `No students in Block ${activeBlockTab}.`}
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-blue-700 text-left text-sm tracking-wide text-white">
                    <tr>
                      <th className="px-4 py-2  ">School ID</th>
                      <th className="px-4 py-2  ">Name</th>
                      <th className="px-4 py-2  ">Course</th>
                      <th className="px-4 py-2  ">Year Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s, i) => {
                      const block = s.block && String(s.block).trim() !== ''
                        ? String(s.block).trim().toUpperCase()
                        : 'A';
                      const courseLabel = getStudentCourseLabel(s, selectedSubject);
                      return (
                        <tr
                          key={s.id}
                          className="border-t border-gray-200 hover:bg-gray-50"
                        >
                          <td className="px-4 py-2   text-sm text-gray-700">
                            {s.studentNumber || <span className=" text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-2 ">
                            <p className="font-semibold text-gray-800">{s.name}</p>
                            {s.isIrregular && (
                              <span className="mt-0.5 inline-block rounded-full border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-700">
                                Irregular
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2  text-gray-700">{courseLabel}</td>
                          <td className="px-4 py-2  text-gray-600">{getYearLabel(s.yearLevel)} Blk. {block}</td>
                         
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex justify-end border-t border-gray-200 px-6 py-3">
              <button
                onClick={closeStudentsModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign picker modal ── */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[78vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h6 className="text-lg font-semibold text-gray-900">Assign Class</h6>
                <p className="text-sm text-gray-500">Choose a subject source, then select the class or block assignment.</p>
              </div>
              <button onClick={() => setPickerOpen(false)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-gray-200 px-6 py-3">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                <button
                  onClick={() => setPickerTab('ccs')}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    pickerTab === 'ccs' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Laptop className="h-4 w-4" /> CCS Curriculum
                </button>
                <button
                  onClick={() => setPickerTab('other')}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    pickerTab === 'other' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Building2 className="h-4 w-4" /> Other Department
                </button>
              </div>
            </div>

            {pickerTab === 'ccs' ? (
              <div className="flex min-h-0 flex-1 flex-col p-6">
                {/* ── Curriculum selector + search ── */}
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[280px_1fr]">
                  <select
                    value={pickerCurriculumId}
                    onChange={(e) => { setPickerCurriculumId(e.target.value); setPickerYearTab(1); }}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="">Select a curriculum...</option>
                    {curriculums.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search course code or title..."
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      disabled={!pickerCurriculumId}
                    />
                  </div>
                </div>

                {/* ── NEW: Year-level tabs inside picker ── */}
                {pickerCurriculumId && (
                  <div className="mb-3 flex gap-1.5 rounded-xl bg-slate-100 p-1.5 w-fit">
                    {YEAR_TABS.map(year => {
                      const isActive = pickerYearTab === year.value;
                      const count = pickerYearCounts[year.value] || 0;
                      return (
                        <button
                          key={year.value}
                          type="button"
                          onClick={() => setPickerYearTab(year.value)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-gray-600 hover:bg-white hover:text-blue-600'
                          }`}
                        >
                          {year.label}
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ── Subject list as table ── */}
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-gray-200">
                  {!pickerCurriculumId ? (
                    <p className="p-8 text-center text-sm text-gray-500">Select a curriculum to view its subjects.</p>
                  ) : pickerLoading ? (
                    <p className="p-8 text-center text-sm text-gray-500">Loading subjects...</p>
                  ) : filteredPickerCourses.length === 0 ? (
                    <p className="p-8 text-center text-sm text-gray-500">
                      {pickerSearch
                        ? 'No subjects match your search for this year level.'
                        : `No subjects found for ${YEAR_TABS.find(y => y.value === pickerYearTab)?.label}.`}
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2   font-semibold">Code</th>
                          <th className="px-4 py-2   font-semibold">Title</th>
                          <th className="px-4 py-2   font-semibold">Units</th>
                          <th className="px-4 py-2   font-semibold">Semester</th>
                          <th className="px-4 py-2   font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {filteredPickerCourses.map(course => {
                          const taken = assignedCourseIds.has(course.id);
                          return (
                            <tr
                              key={course.id}
                              className={`transition ${taken ? 'opacity-60' : 'hover:bg-blue-50/40'}`}
                            >
                              <td className="px-4 py-2   font-semibold text-gray-900 whitespace-nowrap">
                                {course.courseCode}
                              </td>
                              <td className="px-4 py-2   text-gray-700">
                                <div className="truncate max-w-[260px]" title={course.courseTitle}>
                                  {course.courseTitle}
                                </div>
                              </td>
                              <td className="px-4 py-2   text-gray-600 whitespace-nowrap">
                                {Number(course.units) > 0 ? course.units : '—'}
                              </td>
                              <td className="px-4 py-2   text-gray-600 whitespace-nowrap">
                                {SEMESTER_LABELS[course.semester] || `Sem ${course.semester}`}
                              </td>
                              <td className="px-4 py-2   text-right">
                                <button
                                  onClick={() => startAssign(course)}
                                  disabled={taken}
                                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                    taken
                                      ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                >
                                  {taken ? 'Assigned' : 'Assign'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col p-6 gap-4">

                {/* ── Row 1: Department + Class + Curriculum + Search + Blocks ── */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_220px_220px_1fr_auto]">

                  {/* Department */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Department</label>
                    <select
                      value={otherDeptId}
                      onChange={(e) => { setOtherDeptId(e.target.value); setOtherYearTab(1); }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
                    <select
                      value={otherSelectedClass
                        ? `${otherSelectedClass.course.toLowerCase()}::${otherSelectedClass.yearLevel}`
                        : ''}
                      onChange={(e) => {
                        const found = otherClasses.find(c =>
                          `${c.course.toLowerCase()}::${c.yearLevel}` === e.target.value
                        );
                        setOtherSelectedClass(found || null);
                        setOtherBlocks([]);
                      }}
                      disabled={!otherDeptId || otherClassesLoading}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50"
                    >
                      <option value="">
                        {otherClassesLoading ? 'Loading...' : 'Select class...'}
                      </option>
                      {otherClasses.map(c => {
                        const key = `${c.course.toLowerCase()}::${c.yearLevel}`;
                        return (
                          <option key={key} value={key}>
                            {c.course} · Year {c.yearLevel}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Curriculum */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Curriculum</label>
                    <select
                      value={otherCurriculumId}
                      onChange={(e) => { setOtherCurriculumId(e.target.value); setOtherYearTab(1); }}
                      disabled={!otherSelectedClass}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50"
                    >
                      <option value="">Select curriculum...</option>
                      {curriculums.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Search Subject */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Search Subject</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Course code or title..."
                        value={otherSubjectSearch}
                        onChange={(e) => setOtherSubjectSearch(e.target.value)}
                        disabled={!otherCurriculumId}
                        className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50"
                      />
                    </div>
                  </div>

                  {/* Block(s) */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Block(s)</label>
                    <BlockToggle
                      value={otherBlocks}
                      onChange={setOtherBlocks}
                      availableBlocks={otherSelectedClass?.blocks || []}
                    />
                  </div>

                </div>

                {/* ── Row 2: Year tabs ── */}
                {otherCurriculumId && (
                  <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1.5 w-fit">
                    {YEAR_TABS.map(year => {
                      const isActive = otherYearTab === year.value;
                      const count = otherYearCounts[year.value] || 0;
                      return (
                        <button
                          key={year.value}
                          type="button"
                          onClick={() => setOtherYearTab(year.value)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-gray-600 hover:bg-white hover:text-blue-600'
                          }`}
                        >
                          {year.label}
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ── Row 3: Subject table (full-width, flex-1) ── */}
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-gray-200">
                  {!otherSelectedClass ? (
                    <p className="p-8 text-center text-sm text-gray-500">Select a department and class first.</p>
                  ) : !otherCurriculumId ? (
                    <p className="p-8 text-center text-sm text-gray-500">Select a curriculum to see subjects.</p>
                  ) : otherCurriculumLoading ? (
                    <p className="p-8 text-center text-sm text-gray-500">Loading subjects...</p>
                  ) : sortedOtherCourses.length === 0 ? (
                    <p className="p-8 text-center text-sm text-gray-500">
                      {otherSubjectSearch
                        ? 'No subjects match your search for this year level.'
                        : `No subjects found for ${YEAR_TABS.find(y => y.value === otherYearTab)?.label}.`}
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                        <tr>
                          <th className="cursor-pointer select-none px-4 py-2   font-semibold" onClick={() => handleOtherSort('courseCode')}>
                            Code <OtherSortIcon col="courseCode" />
                          </th>
                          <th className="cursor-pointer select-none px-4 py-2   font-semibold" onClick={() => handleOtherSort('courseTitle')}>
                            Title <OtherSortIcon col="courseTitle" />
                          </th>
                          <th className="cursor-pointer select-none px-4 py-2   font-semibold" onClick={() => handleOtherSort('units')}>
                            Units <OtherSortIcon col="units" />
                          </th>
                          <th className="cursor-pointer select-none px-4 py-2   font-semibold" onClick={() => handleOtherSort('semester')}>
                            Semester <OtherSortIcon col="semester" />
                          </th>
                          <th className="px-4 py-2   font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {sortedOtherCourses.map(course => {
                          const isSelected = otherSelectedCourse?.id === course.id;
                          // Build the same courseId key used in handleAssignOther to check if already assigned
                          const otherCourseId = otherSelectedClass
                            ? `other::${otherDeptId}::${otherSelectedClass.course.toLowerCase()}::${otherSelectedClass.yearLevel}::${course.id}`
                            : null;
                          const takenByOther = otherCourseId ? assignedCourseIds.has(otherCourseId) : false;
                          return (
                            <tr
                              key={course.id}
                              onClick={() => { if (!takenByOther) setOtherSelectedCourse(course); }}
                              className={`transition ${
                                takenByOther
                                  ? 'cursor-not-allowed opacity-50'
                                  : isSelected
                                    ? 'cursor-pointer bg-blue-50 ring-1 ring-inset ring-blue-200'
                                    : 'cursor-pointer hover:bg-blue-50/40'
                              }`}
                            >
                              <td className="px-4 py-2   font-semibold text-gray-900 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  {isSelected && !takenByOther && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                                  {course.courseCode}
                                </div>
                              </td>
                              <td className="px-4 py-2   text-gray-700">
                                <div className="truncate max-w-[320px]" title={course.courseTitle}>
                                  {course.courseTitle}
                                </div>
                              </td>
                              <td className="px-4 py-2   text-gray-600 whitespace-nowrap">
                                {Number(course.units) > 0 ? course.units : '—'}
                              </td>
                              <td className="px-4 py-2   text-gray-600 whitespace-nowrap">
                                {SEMESTER_LABELS[course.semester] || `Sem ${course.semester}`}
                              </td>
                              <td className="px-4 py-2   text-right">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  takenByOther
                                    ? 'bg-gray-100 text-gray-400'
                                    : isSelected
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {takenByOther ? 'Assigned' : isSelected ? 'Selected' : 'Click to select'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* ── Footer: error + action buttons ── */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  {otherError
                    ? <p className="text-xs text-red-500">{otherError}</p>
                    : <span />
                  }
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPickerOpen(false)}
                      disabled={savingOther}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAssignOther}
                      disabled={savingOther || !otherSelectedClass}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {savingOther ? 'Assigning...' : 'Assign Class'}
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Block selection modal ── */}
      {pendingCourse && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h6 className="mb-1 text-lg font-semibold text-gray-800">Which blocks?</h6>
            <p className="mb-4 text-sm text-gray-500">
              Select from the current blocks available for Year {pendingCourse.yearLevel}.
            </p>
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-gray-800">{pendingCourse.courseCode}</span>
                <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600">
                  Year {pendingCourse.yearLevel} · {SEMESTER_LABELS[pendingCourse.semester] || `Sem ${pendingCourse.semester}`}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-gray-600">{pendingCourse.courseTitle}</p>
            </div>
            <p className="mb-2 text-sm font-medium text-gray-700">Block(s)</p>
            <BlockToggle
              value={pendingBlocks}
              onChange={setPendingBlocks}
              availableBlocks={getBlocksForYear(pendingCourse.yearLevel, false)}
            />
            {pendingError && <p className="mt-3 text-xs text-red-500">{pendingError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={cancelAssign}
                disabled={savingAssignment}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmAssign}
                disabled={savingAssignment || pendingBlocks.length === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {savingAssignment ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm unassign modal ── */}
      {confirmUnassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h6 className="mb-2 text-lg font-semibold text-gray-800">Unassign Subject</h6>
            <p className="mb-5 text-sm text-gray-600">
              Remove <span className="font-medium text-gray-800">{confirmUnassign.courseCode}</span> from this professor's assignments?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmUnassign(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUnassign}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                Unassign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessorDetail;