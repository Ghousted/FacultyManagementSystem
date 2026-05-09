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
import { doc, getDoc } from 'firebase/firestore';
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
  const [pendingCourse, setPendingCourse] = useState(null);
  const [pendingBlocks, setPendingBlocks] = useState([]);
  const [pendingError, setPendingError] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);

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

  const [editingBlocksFor, setEditingBlocksFor] = useState(null);
  const [editingBlocksValue, setEditingBlocksValue] = useState([]);
  const [savingBlocks, setSavingBlocks] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

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
    if (sortBy !== column) {
      return <ChevronsUpDown className="ml-1 inline-flex h-3.5 w-3.5 opacity-70" />;
    }

    return sortOrder === 'asc'
      ? <ChevronUp className="ml-1 inline-flex h-3.5 w-3.5" />
      : <ChevronDown className="ml-1 inline-flex h-3.5 w-3.5" />;
  };

  const assignedSubjectsByYear = useMemo(() => {
    const list = assignedCourses.filter(c => Number(c.yearLevel) === assignedYearTab);

    return [...list].sort((a, b) => {
      let aValue = '';
      let bValue = '';

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

      return sortOrder === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
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

      if (studentsRes.success) {
        setStudentsSource(studentsRes.data);
      }
    } catch (err) {
      setError(err.message);
    }

    if (tableOnly) setTableLoading(false);
    else setLoading(false);
  };

  useEffect(() => {
    refreshProfessor();
  }, [professorId]);

  useEffect(() => {
    if (!selectedSubject) return;

    const onKey = (e) => {
      if (e.key === 'Escape') closeStudentsModal();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedSubject]);

  const closeStudentsModal = () => {
    setSelectedSubject(null);
    setStudents([]);
    setStudentSearch('');
  };

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();

    if (!q) return students;

    return students.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.studentNumber || '').toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const studentsByBlock = useMemo(() => {
    const groups = new Map();

    filteredStudents.forEach(s => {
      const block = (s.block || '').toString().trim().toUpperCase() || 'A';
      if (!groups.has(block)) groups.set(block, []);
      groups.get(block).push(s);
    });

    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredStudents]);

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
  };

  const openPicker = async () => {
    setPickerOpen(true);
    setPickerTab('ccs');
    setPickerSearch('');
    setPickerCurriculumId('');
    setPickerCourses([]);
    resetOtherForm();

    const [curRes, deptRes, studentsRes] = await Promise.all([
      getCurriculums(),
      getOtherDepartments(),
      getStudents()
    ]);

    if (curRes.success) setCurriculums(curRes.data);
    if (deptRes.success) setOtherDepts(deptRes.data);
    if (studentsRes.success) setStudentsSource(studentsRes.data);
  };

  useEffect(() => {
    const loadCourses = async () => {
      if (!pickerCurriculumId) {
        setPickerCourses([]);
        return;
      }

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
        return;
      }

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
      if (!otherCurriculumId) {
        setOtherCurriculumCourses([]);
        setOtherSelectedCourse(null);
        return;
      }

      setOtherCurriculumLoading(true);
      const res = await getCoursesByCurriculum(otherCurriculumId);
      if (res.success) setOtherCurriculumCourses(res.data);
      setOtherCurriculumLoading(false);
      setOtherSelectedCourse(null);
    };

    loadOtherCurriculumCourses();
  }, [otherCurriculumId]);

  const filteredPickerCourses = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();

    if (!q) return pickerCourses;

    return pickerCourses.filter(c =>
      (c.courseCode || '').toLowerCase().includes(q) ||
      (c.courseTitle || '').toLowerCase().includes(q)
    );
  }, [pickerCourses, pickerSearch]);

  const filteredOtherCourses = useMemo(() => {
    const q = otherSubjectSearch.trim().toLowerCase();

    if (!q) return otherCurriculumCourses;

    return otherCurriculumCourses.filter(c =>
      (c.courseCode || '').toLowerCase().includes(q) ||
      (c.courseTitle || '').toLowerCase().includes(q)
    );
  }, [otherCurriculumCourses, otherSubjectSearch]);

  const assignedCourseIds = useMemo(
    () => new Set(assignedCourses.map(c => c.courseId)),
    [assignedCourses]
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

    if (pendingBlocks.length === 0) {
      setPendingError('Select at least one block.');
      return;
    }

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

    if (!otherSelectedClass) {
      setOtherError('Select a class.');
      return;
    }

    if (!otherSelectedCourse) {
      setOtherError('Pick a subject from a curriculum.');
      return;
    }

    if (otherBlocks.length === 0) {
      setOtherError('Select at least one block.');
      return;
    }

    const dept = otherDepts.find(d => d.id === otherDeptId);
    const curriculum = curriculums.find(c => c.id === otherCurriculumId);
    const subject = otherSelectedCourse;
    const courseId = `other::${otherDeptId}::${otherSelectedClass.course.toLowerCase()}::${otherSelectedClass.yearLevel}::${subject.id}`;

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

    if (editingBlocksValue.length === 0) {
      setError('Select at least one block.');
      return;
    }

    setError('');
    setSavingBlocks(true);

    const res = await updateAssignedCourseBlocks(
      professorId,
      editingBlocksFor,
      editingBlocksValue
    );

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

    const res = await unassignCourseFromProfessor(
      professorId,
      confirmUnassign.courseId
    );

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

    const res = await getStudentsForCourse(
      subject,
      activeTerm || { semester: 1, schoolYear: '' }
    );

    if (res.success) setStudents(res.data);
    else setError(res.error || 'Failed to load students.');

    setStudentsLoading(false);
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
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button
                onClick={onBack}
                className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <ArrowLeft className="h-4 w-4" />
                All professors
              </button>

              <h6 className="text-2xl font-semibold text-gray-900">{professor.name}</h6>

              <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-500">
                <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1">
                  <IdCard className="h-4 w-4 text-blue-600" />
                  {professor.employeeId || 'No employee ID'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1">
                  <Mail className="h-4 w-4 text-blue-600" />
                  {professor.email || 'No email'}
                </span>
              </div>
            </div>

            <button
              onClick={openPicker}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Assign Subject
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Subjects</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{assignedCourses.length}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Blocks Handled</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{totalBlocksHandled}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Active Term</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {SEMESTER_LABELS[activeTerm?.semester] || '1st Sem'}
                {activeTerm?.schoolYear ? ` · S.Y. ${activeTerm.schoolYear}` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
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

              <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
                {YEAR_TABS.map(year => {
                  const active = assignedYearTab === year.value;

                  return (
                    <button
                      key={year.value}
                      type="button"
                      onClick={() => setAssignedYearTab(year.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-white hover:text-blue-600 cursor-pointer'
                      }`}
                    >
                      {year.label}
                   
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th
                    className="w-[15%] cursor-pointer select-none px-4 py-3"
                    onClick={() => handleSort('courseCode')}
                  >
                    Subject Code <SortIcon column="courseCode" />
                  </th>
                  <th
                    className="w-[30%] cursor-pointer select-none px-4 py-3"
                    onClick={() => handleSort('courseTitle')}
                  >
                    Subject Title <SortIcon column="courseTitle" />
                  </th>
                  <th
                    className="w-[10%] cursor-pointer select-none px-4 py-3"
                    onClick={() => handleSort('units')}
                  >
                    Units <SortIcon column="units" />
                  </th>
                  <th
                    className="w-[20%] cursor-pointer select-none px-4 py-3"
                    onClick={() => handleSort('yearBlock')}
                  >
                    Course & Yr. Lvl. <SortIcon column="yearBlock" />
                  </th>
                  <th
                    className="w-[15%] cursor-pointer select-none px-4 py-3"
                    onClick={() => handleSort('curriculum')}
                  >
                    Curriculum <SortIcon column="curriculum" />
                  </th>
                  <th className="w-[10%] px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {tableLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="border-t border-gray-100">
                      <td className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-gray-100" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-56 animate-pulse rounded bg-gray-100" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-10 animate-pulse rounded bg-gray-100" /></td>
                      <td className="px-4 py-3"><div className="h-5 w-44 animate-pulse rounded bg-gray-100" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-32 animate-pulse rounded bg-gray-100" /></td>
                      <td className="px-4 py-3"><div className="ml-auto h-7 w-12 animate-pulse rounded bg-gray-100" /></td>
                    </tr>
                  ))
                ) : assignedCourses.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="py-12 text-center">
                        <BookOpen className="mx-auto mb-2 h-9 w-9 text-gray-300" />
                        <p className="text-sm font-medium text-gray-700">No subjects assigned yet</p>
                        <p className="mt-1 text-sm text-gray-500">Assign a subject to start managing blocks and students.</p>
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
                        <p className="mt-1 text-sm text-gray-500">Try another year level or assign a new subject.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  assignedSubjectsByYear.map(c => {
                    const isEditing = editingBlocksFor === c.courseId;
                    const blocks = c.blocks || [];

                    return (
                      <tr
                        key={c.courseId}
                        onClick={() => {
                          if (!isEditing) viewStudents(c);
                        }}
                        className="cursor-pointer border-t border-gray-100 hover:bg-blue-50/40"
                      >
                        <td className="px-4 py-3 font-semibold text-gray-900 w-15%">{c.courseCode}</td>
                        <td className="px-4 py-3 text-gray-700 w-30%">
                          <div className="truncate" title={c.courseTitle}>
                            {c.courseTitle}
                          </div>
                        </td> 
                        <td className="px-4 py-3 text-gray-600 w-10%">{Number(c.units) > 0 ? c.units : '-'}</td>
                        <td className="px-4 py-3 w-20%" onClick={(e) => e.stopPropagation()}>
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
                        <td className="px-4 py-3 text-gray-600 w-15%">
                          <div className="truncate" title={c.source === 'other-department' ? c.departmentName : c.curriculumName}>
                            {c.source === 'other-department'
                              ? c.departmentName || 'Other Department'
                              : c.curriculumName || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right w-10%">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isEditing ? (
                              <>
                                <button
                                  onClick={saveEditBlocks}
                                  disabled={savingBlocks}
                                  className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                                  title="Save blocks"
                                >
                                  <Check className="h-4 w-4" />
                                </button>

                                <button
                                  onClick={cancelEditBlocks}
                                  disabled={savingBlocks}
                                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditBlocks(c)}
                                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                                  title="Edit blocks"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>

                                <button
                                  onClick={() => setConfirmUnassign(c)}
                                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                                  title="Unassign"
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
      </div>

      {selectedSubject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeStudentsModal}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 px-6 pb-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
                    <Users className="h-3.5 w-3.5" /> Enrolled Students
                  </div>

                  <h6 className="truncate text-xl font-semibold text-gray-800">
                    {selectedSubject.courseCode} - {selectedSubject.courseTitle}
                  </h6>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {getYearBlockLabel(selectedSubject)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={closeStudentsModal}
                  className="shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
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

                <span className="whitespace-nowrap text-sm text-gray-600">
                  <span className="font-semibold text-gray-800">{filteredStudents.length}</span>
                  {' '}of {students.length} student{students.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {studentsLoading ? (
                <p className="py-12 text-center text-sm text-gray-500">Loading students...</p>
              ) : students.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                  <p className="text-sm text-gray-500">No students are taking this subject in the active term.</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-500">No students match your search.</p>
              ) : (
                <div className="space-y-4">
                  {studentsByBlock.map(([block, list]) => (
                    <div key={block}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                          Block {block}
                        </span>
                        <span className="text-xs text-gray-500">
                          {list.length} student{list.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      <ul className="overflow-hidden rounded-lg border border-gray-200">
                        {list.map((s, i) => (
                          <li key={s.id} className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5 first:border-t-0 hover:bg-gray-50">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="w-6 shrink-0 text-right text-xs text-gray-400">{i + 1}</span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-gray-800">{s.name}</p>
                                <p className="text-xs text-gray-500">
                                  {s.studentNumber || '-'} · Year {s.yearLevel}
                                  {s.isIrregular ? ' · Irregular' : ''}
                                </p>
                              </div>
                            </div>

                            {s.isIrregular && (
                              <span className="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700">
                                Irregular
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

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

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[78vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h6 className="text-lg font-semibold text-gray-900">Assign Class</h6>
                <p className="text-sm text-gray-500">Choose a subject source, then select the class or block assignment.</p>
              </div>

              <button
                onClick={() => setPickerOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              >
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
                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[280px_1fr]">
                  <select
                    value={pickerCurriculumId}
                    onChange={(e) => setPickerCurriculumId(e.target.value)}
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

                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-gray-200">
                  {!pickerCurriculumId ? (
                    <p className="p-8 text-center text-sm text-gray-500">Select a curriculum to view its subjects.</p>
                  ) : pickerLoading ? (
                    <p className="p-8 text-center text-sm text-gray-500">Loading subjects...</p>
                  ) : filteredPickerCourses.length === 0 ? (
                    <p className="p-8 text-center text-sm text-gray-500">No subjects found.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                        <tr>
                          <th className="px-4 py-3">Code</th>
                          <th className="px-4 py-3">Title</th>
                          <th className="px-4 py-3">Year / Sem</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPickerCourses.map(course => {
                          const taken = assignedCourseIds.has(course.id);

                          return (
                            <tr key={course.id} className="border-t border-gray-100">
                              <td className="px-4 py-3 font-semibold text-gray-900">{course.courseCode}</td>
                              <td className="px-4 py-3 text-gray-700">{course.courseTitle}</td>
                              <td className="px-4 py-3 text-gray-600">
                                Year {course.yearLevel} · {SEMESTER_LABELS[course.semester] || `Sem ${course.semester}`}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => startAssign(course)}
                                  disabled={taken}
                                  className={`rounded-lg px-3 py-1.5 text-xs ${
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
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Department</label>
                      <select
                        value={otherDeptId}
                        onChange={(e) => setOtherDeptId(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        <option value="">Select a department...</option>
                        {otherDepts.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name}{d.code ? ` (${d.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Class</label>
                      <div className="max-h-[360px] overflow-y-auto rounded-xl border border-gray-200 p-2">
                        {!otherDeptId ? (
                          <p className="p-4 text-sm text-gray-500">Select a department first.</p>
                        ) : otherClassesLoading ? (
                          <p className="p-4 text-sm text-gray-500">Loading classes...</p>
                        ) : otherClasses.length === 0 ? (
                          <p className="p-4 text-sm text-gray-500">No classes found for this department.</p>
                        ) : (
                          <div className="space-y-2">
                            {otherClasses.map((c) => {
                              const key = `${c.course.toLowerCase()}::${c.yearLevel}`;
                              const selectedKey = otherSelectedClass
                                ? `${otherSelectedClass.course.toLowerCase()}::${otherSelectedClass.yearLevel}`
                                : '';
                              const isSelected = key === selectedKey;

                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => {
                                    setOtherSelectedClass(c);
                                    setOtherBlocks([]);
                                  }}
                                  className={`w-full rounded-lg border p-3 text-left ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                                      : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/40'
                                  }`}
                                >
                                  <p className="text-sm font-semibold text-gray-800">{c.course}</p>
                                  <p className="mt-0.5 text-xs text-gray-500">
                                    Year {c.yearLevel} · {c.studentCount} student{c.studentCount === 1 ? '' : 's'}
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {c.blocks.map(b => (
                                      <span key={b} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
                                        {b}
                                      </span>
                                    ))}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Curriculum</label>
                        <select
                          value={otherCurriculumId}
                          onChange={(e) => setOtherCurriculumId(e.target.value)}
                          disabled={!otherSelectedClass}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50"
                        >
                          <option value="">Select a curriculum...</option>
                          {curriculums.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

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
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Subject</label>
                      <div className="max-h-[260px] overflow-y-auto rounded-xl border border-gray-200">
                        {!otherSelectedClass ? (
                          <p className="p-4 text-sm text-gray-500">Select a class first.</p>
                        ) : !otherCurriculumId ? (
                          <p className="p-4 text-sm text-gray-500">Select a curriculum to see its subjects.</p>
                        ) : otherCurriculumLoading ? (
                          <p className="p-4 text-sm text-gray-500">Loading subjects...</p>
                        ) : filteredOtherCourses.length === 0 ? (
                          <p className="p-4 text-sm text-gray-500">No subjects found in this curriculum.</p>
                        ) : (
                          <ul className="divide-y divide-gray-100">
                            {filteredOtherCourses.map(course => {
                              const isSelected = otherSelectedCourse?.id === course.id;

                              return (
                                <li
                                  key={course.id}
                                  onClick={() => setOtherSelectedCourse(course)}
                                  className={`flex cursor-pointer items-center justify-between px-3 py-2 ${
                                    isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-semibold text-gray-800">{course.courseCode}</span>
                                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                                        Year {course.yearLevel} · {SEMESTER_LABELS[course.semester] || `Sem ${course.semester}`}
                                      </span>
                                    </div>
                                    <p className="truncate text-xs text-gray-600">{course.courseTitle}</p>
                                  </div>

                                  {isSelected && <Check className="ml-2 h-4 w-4 shrink-0 text-blue-600" />}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Block(s)</label>
                      <BlockToggle
                        value={otherBlocks}
                        onChange={setOtherBlocks}
                        availableBlocks={otherSelectedClass?.blocks || []}
                      />
                    </div>

                    {otherError && (
                      <p className="text-xs text-red-500">{otherError}</p>
                    )}

                    <div className="flex justify-end gap-2 mt-auto">
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
              </div>
            )}
          </div>
        </div>
      )}

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

            {pendingError && (
              <p className="mt-3 text-xs text-red-500">{pendingError}</p>
            )}

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
