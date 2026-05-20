import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  UserCheck,
  UserX,
  AlertTriangle,
  Folder,
  RefreshCw,
  Square,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X
} from 'lucide-react';
import {
  getEnrollmentRoster,
  setStudentEnrollment,
  setStudentNotEnrolled,
  bulkSetStudentEnrollment
} from '../../models/facultyModels';

// Filter students by status will be declared inside the component below

const SEMESTER_LABELS = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };

const STUDENT_MODAL_YEAR_TABS = [
  { key: 1, label: '1st Year' },
  { key: 2, label: '2nd Year' },
  { key: 3, label: '3rd Year' },
  { key: 4, label: '4th Year' },
  { key: 'irregular', label: 'All Irregular' }
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

const STATUS_META = {
  enrolled: {
    label: 'Enrolled',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  'not-enrolled': {
    label: 'Not enrolled',
    pill: 'bg-gray-100 text-gray-600 border-gray-200'
  }
};

const getYearLabel = (year) => {
  if (year === 1) return '1st';
  if (year === 2) return '2nd';
  if (year === 3) return '3rd';
  if (year === 4) return '4th';
  return `${year}th`;
};

const getBlock = (student) => {
  return (student.block || '').toString().trim().toUpperCase() || 'A';
};

const normalizeTerm = (activeTerm) => ({
  semester: activeTerm?.semester ?? activeTerm?.sem ?? activeTerm?.activeSemester,
  schoolYear: activeTerm?.schoolYear ?? activeTerm?.school_year ?? activeTerm?.academicYear
});

const FolderSkeleton = () => (
  <div className="relative rounded-lg border border-gray-300 bg-white p-4  animate-pulse">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-blue-50" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="h-3 w-20 rounded bg-gray-100" />
      </div>
    </div>
  </div>
);

const TableSkeleton = () => (
  <>
    {Array.from({ length: 5 }).map((_, index) => (
      <tr key={index} className="border-t border-gray-100 animate-pulse">
        <td className="px-4 py-2 ">
          <div className="h-4 w-4 rounded bg-gray-200" />
        </td>
        <td className="px-4 py-2 ">
          <div className="h-4 w-24 rounded bg-gray-200" />
        </td>
        <td className="px-4 py-2 ">
          <div className="mb-2 h-4 w-40 rounded bg-gray-200" />
        </td>
        <td className="px-4 py-2 ">
          <div className="h-4 w-28 rounded bg-gray-200" />
        </td>
        <td className="px-4 py-2 ">
          <div className="h-5 w-24 rounded-full bg-gray-200" />
        </td>
       
        <td className="px-4 py-2  flex items-center gap-2">
          <div className="h-4 w-4 rounded-md bg-gray-200" />
          <div className="h-4 w-4 rounded-md bg-gray-200" />
          <div className="h-4 w-4 rounded-md bg-gray-200" />
        </td>
      </tr>
    ))}
  </>
);


const EnrollmentManager = ({ activeTerm }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, _setStatusFilter] = useState('all');
  const [busyIds, setBusyIds] = useState(new Set());
  const [error, setError] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [modal, setModal] = useState({ show: false, type: '', student: null, bulkIds: [] });

  // Status modal (cards -> modal) state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusModalType, setStatusModalType] = useState('all');
  const [statusModalYearTab, setStatusModalYearTab] = useState(1);
  const [statusModalSort, setStatusModalSort] = useState({ key: 'surname', direction: 'asc' });

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
    return statusModalSort.direction === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />;
  };

  const statusFilteredStudents = useMemo(() => {
    const byType = students.filter((student) => {
      if (statusModalType === 'all') return true;
      if (statusModalType === 'active') return student.active !== false;
      if (statusModalType === 'inactive') return student.active === false;
      if (statusModalType === 'enrolled') return (student.enrollmentStatus || '') === 'enrolled';
      if (statusModalType === 'not-enrolled') return (student.enrollmentStatus || '') === 'not-enrolled';
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
          aValue = (a.block || '').toString();
          bValue = (b.block || '').toString();
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
          aValue = (a.enrollmentStatus || '').toString();
          bValue = (b.enrollmentStatus || '').toString();
          break;
        case 'surname':
        default:
          aValue = getSurnameKey(a.name);
          bValue = getSurnameKey(b.name);
          break;
      }

      const cmp = aValue.toString().localeCompare(bValue.toString(), undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return statusModalSort.direction === 'asc' ? cmp : -cmp;

      const tie = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      return statusModalSort.direction === 'asc' ? tie : -tie;
    });
  }, [students, statusModalType, statusModalYearTab, statusModalSort]);

  const statusModalTabCounts = useMemo(() => {
    const base = { 1: 0, 2: 0, 3: 0, 4: 0, irregular: 0 };
    const byType = students.filter((student) => {
      if (statusModalType === 'all') return true;
      if (statusModalType === 'active') return student.active !== false;
      if (statusModalType === 'inactive') return student.active === false;
      if (statusModalType === 'enrolled') return (student.enrollmentStatus || '') === 'enrolled';
      if (statusModalType === 'not-enrolled') return (student.enrollmentStatus || '') === 'not-enrolled';
      return true;
    });

    byType.forEach((student) => {
      if (student.isIrregular) {
        base.irregular += 1;
        return;
      }
      const year = Number(student.yearLevel);
      if ([1, 2, 3, 4].includes(year)) base[year] += 1;
    });

    return base;
  }, [students, statusModalType]);

  const term = normalizeTerm(activeTerm);

  // Emit breadcrumb info to top-level App so breadcrumb appears at page top
  useEffect(() => {
    try {
      window.dispatchEvent(
        new CustomEvent('student-breadcrumb', {
          detail: {
            mode: 'enrollment',
            selectedFolder: selectedFolder || null
          }
        })
      );
    } catch {
      // noop
    }
  }, [selectedFolder]);

  // Listen for reset events from top-level breadcrumb/button
  useEffect(() => {
    const onReset = () => {
      setSelectedFolder(null);
      setSelectedIds([]);
      setSelectMode(false);
    };

    window.addEventListener('reset-enrollment-manager', onReset);
    return () => window.removeEventListener('reset-enrollment-manager', onReset);
  }, []);

  // Filter students by status
  const statusFiltered = useMemo(() => {
    const activeStudents = students.filter((student) => student.active !== false);
    if (statusFilter === 'all') return activeStudents;
    return activeStudents.filter((student) => student.enrollmentStatus === statusFilter);
  }, [students, statusFilter]);
  const termIncomplete = !term.semester || !term.schoolYear;

  const refresh = async () => {
    setError('');
    setLoading(true);
    const minimumDelay = new Promise((resolve) => setTimeout(resolve, 200));
    try {
      const [res] = await Promise.all([
        getEnrollmentRoster({
          ...activeTerm,
          semester: term.semester,
          schoolYear: term.schoolYear
        }),
        minimumDelay
      ]);

      if (res.success) {
        setStudents(res.data || []);
      } else {
        setError(res.error || 'Failed to load students.');
      }
    } catch (err) {
      setError(err?.message || 'Failed to load students.');
    } finally {
      setLoading(false);
    }
  };

  // Load roster on mount and when term changes
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term.semester, term.schoolYear]);

  const folders = useMemo(() => {
    const map = new Map();

    statusFiltered.forEach((student) => {
      const block = getBlock(student);
      const isIrregular = !!student.isIrregular;
      const year = Number(student.yearLevel || 1);
      const key = isIrregular ? `irregular||${block}` : `${year}||${block}`;

      if (!map.has(key)) {
        map.set(key, {
          year,
          block,
          isIrregular,
          label: isIrregular ? `Irregular Block ${block}` : `${getYearLabel(year)} Year Block ${block}`,
          students: []
        });
      }

      map.get(key).students.push(student);
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.isIrregular && !b.isIrregular) return 1;
      if (!a.isIrregular && b.isIrregular) return -1;
      if (a.year !== b.year) return a.year - b.year;
      return a.block.localeCompare(b.block);
    });
  }, [statusFiltered]);

  const folderStudents = useMemo(() => {
    if (!selectedFolder) return statusFiltered;

    return statusFiltered.filter((student) => {
      const block = getBlock(student);

      if (selectedFolder.isIrregular) {
        return !!student.isIrregular && block === selectedFolder.block;
      }

      return (
        !student.isIrregular &&
        Number(student.yearLevel || 1) === selectedFolder.year &&
        block === selectedFolder.block
      );
    });
  }, [statusFiltered, selectedFolder]);

  const tableStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    const searched = folderStudents.filter((student) => {
      if (!query) return true;

      return (
        (student.name || '').toLowerCase().includes(query) ||
        (student.studentNumber || '').toLowerCase().includes(query) ||
        (student.email || '').toLowerCase().includes(query)
      );
    });

    return searched.slice().sort((a, b) => {
      let aValue = '';
      let bValue = '';

      if (sortBy === 'name') {
        aValue = a.name || '';
        bValue = b.name || '';
      } else if (sortBy === 'studentNumber') {
        aValue = a.studentNumber || '';
        bValue = b.studentNumber || '';
      } else if (sortBy === 'yearBlock') {
        aValue = `${a.isIrregular ? 'irregular' : 'regular'}-${a.yearLevel || 0}-${getBlock(a)}`;
        bValue = `${b.isIrregular ? 'irregular' : 'regular'}-${b.yearLevel || 0}-${getBlock(b)}`;
      } else if (sortBy === 'status') {
        aValue = a.enrollmentStatus || '';
        bValue = b.enrollmentStatus || '';
      } else if (sortBy === 'term') {
        aValue = `${a.enrolledTerm?.schoolYear || ''}-${a.enrolledTerm?.semester || ''}`;
        bValue = `${b.enrolledTerm?.schoolYear || ''}-${b.enrolledTerm?.semester || ''}`;
      }

      return sortOrder === 'asc'
        ? aValue.toString().localeCompare(bValue.toString())
        : bValue.toString().localeCompare(aValue.toString());
    });
  }, [folderStudents, search, sortBy, sortOrder]);

  const selectedStudents = useMemo(() => {
    return tableStudents.filter((student) => selectedIds.includes(student.id));
  }, [tableStudents, selectedIds]);

  const counts = useMemo(() => {
    return (students || []).reduce((acc, student) => {
      const status = student?.enrollmentStatus === 'enrolled' ? 'enrolled' : 'not-enrolled';
      acc[status] = (acc[status] || 0) + 1;
      if (student?.active === false) {
        acc.inactive += 1;
      } else {
        acc.active += 1;
      }
      return acc;
    }, { enrolled: 0, 'not-enrolled': 0, active: 0, inactive: 0 });
  }, [students]);

  const STATUS_CARD_META = {
    all: { label: 'All Students', count: students.length },
    enrolled: { label: 'Enrolled Students', count: counts.enrolled || 0 },
    active: { label: 'Active Students', count: counts.active || 0 },
    inactive: { label: 'Inactive Students', count: counts.inactive || 0 },
    'not-enrolled': { label: 'Not Enrolled Students', count: counts['not-enrolled'] || 0 }
  };

  const allVisibleSelected =
    tableStudents.length > 0 && tableStudents.every((student) => selectedIds.includes(student.id));

  const hasSelected = selectedIds.length > 0;
  const canEnrollSelected =
    hasSelected && selectedStudents.some((student) => student.enrollmentStatus !== 'enrolled');
  const canUnenrollSelected =
    hasSelected && selectedStudents.some((student) => student.enrollmentStatus !== 'not-enrolled');

  const setBusy = (id, on) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) {
      return <ChevronsUpDown className="ml-1 inline-block h-3.5 w-3.5 opacity-50" />;
    }

    if (sortOrder === 'asc') {
      return <ChevronUp className="ml-1 inline-block h-3.5 w-3.5" />;
    }

    return <ChevronDown className="ml-1 inline-block h-3.5 w-3.5" />;
  };

  const toggleSelectStudent = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((selectedId) => selectedId !== id);
      return [...prev, id];
    });
  };

  const toggleSelectAllVisible = () => {
    if (!selectMode) return;
    if (allVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tableStudents.map((student) => student.id));
    }
  };

  const enrollStudent = async (studentId) => {
    const normalizedActiveTerm = {
      ...activeTerm,
      semester: term.semester,
      schoolYear: term.schoolYear
    };

    let res = await setStudentEnrollment(studentId, normalizedActiveTerm);

    if (!res?.success) {
      res = await setStudentEnrollment(studentId, term.semester, term.schoolYear);
    }

    return res;
  };

  const bulkEnrollStudents = async (ids) => {
    const normalizedActiveTerm = {
      ...activeTerm,
      semester: term.semester,
      schoolYear: term.schoolYear
    };

    let res = await bulkSetStudentEnrollment(ids, normalizedActiveTerm);

    if (!res?.success) {
      res = await bulkSetStudentEnrollment(ids, term.semester, term.schoolYear);
    }

    return res;
  };

  const handleEnroll = (student) => {
    if (termIncomplete) {
      setError('Please set the active semester and school year before enrolling students.');
      return;
    }

    setModal({ show: true, type: 'enroll', student, bulkIds: [] });
  };

  const handleUnenroll = (student) => {
    setModal({ show: true, type: 'unenroll', student, bulkIds: [] });
  };

  const handleEnrollSelected = () => {
    if (termIncomplete) {
      setError('Please set the active semester and school year before enrolling students.');
      return;
    }

    const ids = selectedStudents
      .filter((student) => student.enrollmentStatus !== 'enrolled')
      .map((student) => student.id);

    if (ids.length === 0) return;

    setModal({ show: true, type: 'enroll', student: null, bulkIds: ids });
  };

  const handleUnenrollSelected = () => {
    const ids = selectedStudents
      .filter((student) => student.enrollmentStatus !== 'not-enrolled')
      .map((student) => student.id);

    if (ids.length === 0) return;

    setModal({ show: true, type: 'unenroll', student: null, bulkIds: ids });
  };

  const confirmModal = async () => {
    const { type, student, bulkIds } = modal;
    setModal({ show: false, type: '', student: null, bulkIds: [] });
    setError('');

    if (bulkIds.length > 0) {
      // bulk logic
      setBulkSaving(true);

      try {
        let res;
        if (type === 'enroll') {
          res = await bulkEnrollStudents(bulkIds);
        } else {
          const results = await Promise.all(bulkIds.map((id) => setStudentNotEnrolled(id)));
          res = { success: !results.some(r => !r?.success), error: results.find(r => !r?.success)?.error };
        }

        if (!res?.success) {
          setError(res?.error || `Failed to ${type} selected students.`);
          return;
        }

        setStudents((prev) =>
          prev.map((student) =>
            bulkIds.includes(student.id)
              ? {
                  ...student,
                  enrollmentStatus: type === 'enroll' ? 'enrolled' : 'not-enrolled',
                  enrolledTerm: type === 'enroll' ? { semester: term.semester, schoolYear: term.schoolYear } : null
                }
              : student
          )
        );

        setSelectedIds([]);
        await refresh();
      } catch (err) {
        setError(err?.message || `Failed to ${type} selected students.`);
      } finally {
        setBulkSaving(false);
      }
    } else {
      // individual logic
      setBusy(student.id, true);

      try {
        let res;
        if (type === 'enroll') {
          res = await enrollStudent(student.id);
        } else {
          res = await setStudentNotEnrolled(student.id);
        }

        if (!res?.success) {
          setError(res?.error || `Failed to ${type} student.`);
          return;
        }

        setStudents((prev) =>
          prev.map((item) =>
            item.id === student.id
              ? {
                  ...item,
                  enrollmentStatus: type === 'enroll' ? 'enrolled' : 'not-enrolled',
                  enrolledTerm: type === 'enroll' ? { semester: term.semester, schoolYear: term.schoolYear } : null
                }
              : item
          )
        );

        await refresh();
      } catch (err) {
        toast.error(err?.message || `Failed to ${type} student.`);
      } finally {
        setBusy(student.id, false);
      }
    }
  };

  return (
    <div className="space-y-5">
     

      {/* errors shown via toast notifications */}

      <div className="">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <button type="button" onClick={() => openStatusModal('all')} className="rounded-lg border cursor-pointer border-gray-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/30 transition">
            <span className="block text-xs text-gray-600">All</span>
            <span className="mt-1 block text-lg font-semibold text-gray-900">{students.length}</span>
          </button>

          <button type="button" onClick={() => openStatusModal('enrolled')} className="rounded-lg border cursor-pointer border-gray-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/30 transition">
            <span className="block text-xs text-gray-600">Enrolled</span>
            <span className="mt-1 block text-lg font-semibold text-gray-900">{counts.enrolled || 0}</span>
          </button>

          <button type="button" onClick={() => openStatusModal('active')} className="rounded-lg border cursor-pointer border-gray-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/30 transition">
            <span className="block text-xs text-gray-600">Active</span>
            <span className="mt-1 block text-lg font-semibold text-gray-900">{counts.active || 0}</span>
          </button>

          <button type="button" onClick={() => openStatusModal('inactive')} className="rounded-lg border cursor-pointer border-gray-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/30 transition">
            <span className="block text-xs text-gray-600">Inactive</span>
            <span className="mt-1 block text-lg font-semibold text-gray-900">{counts.inactive || 0}</span>
          </button>

          <button type="button" onClick={() => openStatusModal('not-enrolled')} className="rounded-lg border cursor-pointer border-gray-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/30 transition">
            <span className="block text-xs text-gray-600">Not enrolled</span>
            <span className="mt-1 block text-lg font-semibold text-gray-900">{counts['not-enrolled'] || 0}</span>
          </button>
        </div>
      </div>

      {!selectedFolder ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
             
            <p className=" font-medium text-gray-700">Students Folders</p>

           <p className="mt-1 text-sm text-gray-800">
            {term.semester ? SEMESTER_LABELS[term.semester] || `Sem ${term.semester}` : 'No semester'} ·{' '}
            {term.schoolYear || 'No school year'}
          </p>
           
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <FolderSkeleton key={index} />
              ))}
            </div>
          ) : folders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-12 text-center">
              <p className="text-sm font-medium text-gray-700">No sections found</p>
              <p className="mt-1 text-xs text-gray-500">Try another status filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {folders.map((folder) => (
                <button
                  key={`${folder.isIrregular ? 'irregular' : folder.year}-${folder.block}`}
                  type="button"
                  onClick={() => {
                    setSelectedFolder({
                      year: folder.year,
                      block: folder.block,
                      isIrregular: folder.isIrregular
                    });
                    setSearch('');
                    setSelectedIds([]);
                    setSelectMode(false);
                  }}
                  className="group relative cursor-pointer rounded-lg border border-gray-300 bg-white p-4 text-left transition  hover:border-blue-400 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Folder className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-blue-800">{folder.label}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {folder.students.length} student{folder.students.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
             
            <div className='flex items-center gap-2'>
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
                  <Square className="h-4 w-4" />
                  Select
                </button>

              

                <button
                type="button"
                onClick={handleEnrollSelected}
                disabled={!selectMode || termIncomplete || bulkSaving || loading || !canEnrollSelected}
                className={`p-2 rounded-xl transition
                    ${selectMode 
                      ? termIncomplete || bulkSaving || loading || !canEnrollSelected
                         ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
                        : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    }
                  `}
                title="Enroll selected"
                aria-label="Enroll selected"
              >
                <UserCheck className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={handleUnenrollSelected}
                disabled={!selectMode || bulkSaving || loading || !canUnenrollSelected}
                className={`p-2 rounded-xl transition
                    ${selectMode
                      ? bulkSaving || loading || !canUnenrollSelected
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
                      : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    }
                  `}
                aria-label="Unenroll selected"
              >
                <UserX className="h-4 w-4" />
              </button>

                {hasSelected && (
            <div className="text-xs text-slate-500">
              {selectedIds.length} selected
            </div>
          )}
            </div>
                        

            <div className="flex gap-2">
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <div className="relative min-w-0 flex-1 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                      className="w-full border text-sm border-slate-200 bg-white rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                />
              </div>

            
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
             

              

              <table className="w-full text-sm">
                <thead className="text-sm bg-blue-500 text-white text-left">
                  <tr>
                    <th className="w-10 px-4 py-2 ">
                      {selectMode ? (
                        <input
                          type="checkbox"
                          className="h-3 w-3 rounded accent-gray-900"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                        />
                      ) : (
                        <span className="font-medium">No.</span>
                      )}
                    </th>

                    <th className="px-4 py-2 ">
                      Student No.
                    </th>

                    <th className="px-4 py-2 ">
                      <button
                        type="button"
                        onClick={() => handleSort('name')}
                        className="inline-flex items-center cursor-pointer "
                      >
                        Student <SortIcon column="name" />
                      </button>
                    </th>

                    <th className="px-4 py-2 ">Contact No.</th>
                    <th className="px-4 py-2 ">Email</th>
                    <th className="px-4 py-2 ">
                      <button
                        type="button"
                        onClick={() => handleSort('status')}
                        className="inline-flex items-center cursor-pointer"
                      >
                        Status <SortIcon column="status" />
                      </button>
                    </th>

                  

                    <th className="px-4 py-2  text-left">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <TableSkeleton />
                  ) : tableStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    tableStudents.map((student, index) => {
                      const meta = STATUS_META[student.enrollmentStatus] || STATUS_META['not-enrolled'];
                      const busy = busyIds.has(student.id);
                      const isEnrolledHere = student.enrollmentStatus === 'enrolled';

                      return (
                        <tr key={student.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 ">
                            {selectMode ? (
                              <input
                                type="checkbox"
                                className="h-3 w-3 rounded accent-gray-900"
                                checked={selectedIds.includes(student.id)}
                                onChange={() => toggleSelectStudent(student.id)}
                              />
                            ) : (
                              <span className="text-sm text-gray-700">{index + 1}</span>
                            )}
                          </td>

                            <td className="px-4 py-2  whitespace-nowrap text-gray-600">
                              {student.studentNumber || ''}
                            </td>

                          <td className="px-4 py-2 ">
                            <p className=" text-gray-900">{student.name}</p>
                          </td>

                          <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                            {student.contactNumber || ''}
                          </td>

                          <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                            {student.email || ''}
                          </td>

                          <td className="px-4 py-2 ">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${meta.pill}`}>
                              {meta.label}
                            </span>
                          </td>


                          <td className="px-4 py-2  text-right">
                            <div className="flex items-center justify-start gap-2">
                              {isEnrolledHere ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleUnenroll(student);
                                  }}
                                  disabled={busy}
                                  title="Unenroll"
                                  className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleEnroll(student);
                                    }}
                                    disabled={busy || termIncomplete}
                                    title={termIncomplete ? 'Set active semester and school year first' : 'Enroll'}
                                    className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                                  >
                                    <UserCheck className="h-3.5 w-3.5" />
                                  </button>

                                  {student.enrollmentStatus !== 'not-enrolled' && (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        handleUnenroll(student);
                                      }}
                                      disabled={busy}
                                      title="Unenroll"
                                      className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                                    >
                                      <UserX className="h-3.5 w-3.5" />
                                    </button>
                                  )}
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
      )}

      {modal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] bg-opacity-50">
          <div className="rounded-2xl bg-white p-8 shadow-lg max-w-md w-full ">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirm {modal.type === 'enroll' ? 'Enrollment' : 'Unenrollment'}
            </h3>
            <p className="text-gray-600 mb-8">
              {modal.bulkIds.length > 0
                ? `Are you sure you want to ${modal.type} ${modal.bulkIds.length} student${modal.bulkIds.length > 1 ? 's' : ''}?`
                : `Are you sure you want to ${modal.type} ${modal.student?.name}?`
              }
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModal({ show: false, type: '', student: null, bulkIds: [] })}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal}
                className="px-4 py-1.5 W-28 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setStatusModalOpen(false)}></div>
          <div className="relative z-10 w-full max-w-6xl rounded-2xl border border-gray-300 bg-white shadow-lg h-[80vh] overflow-hidden">
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
              <div className="flex flex-wrap gap-2 items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
                {STUDENT_MODAL_YEAR_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusModalYearTab(tab.key)}
                    className={`rounded-lg px-4 py-1 text-sm font-medium transition-all ${
                      statusModalYearTab === tab.key
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer'
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${statusModalYearTab === tab.key ? 'bg-blue-100 text-blue-500' : 'bg-gray-200 text-gray-600'}`}>
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
                          <td className="px-4 py-2">{student.isIrregular ? 'Irregular' : getBlock(student)}</td>
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
    </div>
  );
};

export default EnrollmentManager;
