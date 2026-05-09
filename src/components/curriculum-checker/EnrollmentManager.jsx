import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  UserCheck,
  UserX,
  AlertTriangle,
  Folder,
  RefreshCw,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown
} from 'lucide-react';
import {
  getEnrollmentRoster,
  setStudentEnrollment,
  setStudentNotEnrolled,
  bulkSetStudentEnrollment
} from '../../models/facultyModels';

const SEMESTER_LABELS = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };

const STATUS_META = {
  enrolled: {
    label: 'Enrolled',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  'needs-update': {
    label: 'Needs update',
    pill: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  'not-enrolled': {
    label: 'Not enrolled',
    pill: 'bg-gray-100 text-gray-600 border-gray-200'
  },
  unset: {
    label: 'Unset',
    pill: 'bg-sky-50 text-sky-700 border-sky-200'
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
  <div className="h-24 rounded-lg border border-gray-200 bg-white p-4 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-md bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="h-3 w-20 rounded bg-gray-100" />
      </div>
    </div>
  </div>
);

const TableSkeleton = () => (
  <>
    {Array.from({ length: 6 }).map((_, index) => (
      <tr key={index} className="border-t border-gray-100 animate-pulse">
        <td className="px-4 py-4">
          <div className="h-4 w-4 rounded bg-gray-200" />
        </td>
        <td className="px-4 py-4">
          <div className="mb-2 h-4 w-40 rounded bg-gray-200" />
          <div className="h-3 w-28 rounded bg-gray-100" />
        </td>
        <td className="px-4 py-4">
          <div className="h-4 w-28 rounded bg-gray-100" />
        </td>
        <td className="px-4 py-4">
          <div className="h-5 w-24 rounded-full bg-gray-100" />
        </td>
        <td className="px-4 py-4">
          <div className="h-4 w-24 rounded bg-gray-100" />
        </td>
        <td className="px-4 py-4">
          <div className="ml-auto h-8 w-28 rounded-md bg-gray-100" />
        </td>
      </tr>
    ))}
  </>
);

const EnrollmentManager = ({ activeTerm }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyIds, setBusyIds] = useState(new Set());
  const [error, setError] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const term = normalizeTerm(activeTerm);
  const termIncomplete = !term.semester || !term.schoolYear;

  const refresh = async () => {
    setError('');
    setLoading(true);

    try {
      const res = await getEnrollmentRoster({
        ...activeTerm,
        semester: term.semester,
        schoolYear: term.schoolYear
      });

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

  useEffect(() => {
    refresh();
  }, [term.semester, term.schoolYear]);

  useEffect(() => {
    setSelectedIds([]);
  }, [selectedFolder, statusFilter, search]);

  const counts = useMemo(() => {
    const next = { enrolled: 0, 'needs-update': 0, 'not-enrolled': 0, unset: 0 };

    students.forEach((student) => {
      next[student.enrollmentStatus] = (next[student.enrollmentStatus] || 0) + 1;
    });

    return next;
  }, [students]);

  const statusFiltered = useMemo(() => {
    return students.filter((student) => {
      if (statusFilter === 'all') return true;
      return student.enrollmentStatus === statusFilter;
    });
  }, [students, statusFilter]);

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

  const selectedFolderLabel = selectedFolder
    ? selectedFolder.isIrregular
      ? `Irregular Block ${selectedFolder.block}`
      : `${getYearLabel(selectedFolder.year)} Year Block ${selectedFolder.block}`
    : '';

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

  const handleEnroll = async (student) => {
    if (termIncomplete) {
      setError('Please set the active semester and school year before enrolling students.');
      return;
    }

    setError('');
    setBusy(student.id, true);

    try {
      const res = await enrollStudent(student.id);

      if (!res?.success) {
        setError(res?.error || 'Failed to enroll student.');
        return;
      }

      setStudents((prev) =>
        prev.map((item) =>
          item.id === student.id
            ? {
                ...item,
                enrollmentStatus: 'enrolled',
                enrolledTerm: { semester: term.semester, schoolYear: term.schoolYear }
              }
            : item
        )
      );

      await refresh();
    } catch (err) {
      setError(err?.message || 'Failed to enroll student.');
    } finally {
      setBusy(student.id, false);
    }
  };

  const handleUnenroll = async (student) => {
    setError('');
    setBusy(student.id, true);

    try {
      const res = await setStudentNotEnrolled(student.id);

      if (!res?.success) {
        setError(res?.error || 'Failed to unenroll student.');
        return;
      }

      setStudents((prev) =>
        prev.map((item) =>
          item.id === student.id
            ? { ...item, enrollmentStatus: 'not-enrolled', enrolledTerm: null }
            : item
        )
      );

      await refresh();
    } catch (err) {
      setError(err?.message || 'Failed to unenroll student.');
    } finally {
      setBusy(student.id, false);
    }
  };

  const handleEnrollSelected = async () => {
    if (termIncomplete) {
      setError('Please set the active semester and school year before enrolling students.');
      return;
    }

    const ids = selectedStudents
      .filter((student) => student.enrollmentStatus !== 'enrolled')
      .map((student) => student.id);

    if (ids.length === 0) return;

    setError('');
    setBulkSaving(true);

    try {
      const res = await bulkEnrollStudents(ids);

      if (!res?.success) {
        setError(res?.error || 'Failed to enroll selected students.');
        return;
      }

      setStudents((prev) =>
        prev.map((student) =>
          ids.includes(student.id)
            ? {
                ...student,
                enrollmentStatus: 'enrolled',
                enrolledTerm: { semester: term.semester, schoolYear: term.schoolYear }
              }
            : student
        )
      );

      setSelectedIds([]);
      await refresh();
    } catch (err) {
      setError(err?.message || 'Failed to enroll selected students.');
    } finally {
      setBulkSaving(false);
    }
  };

  const handleUnenrollSelected = async () => {
    const ids = selectedStudents
      .filter((student) => student.enrollmentStatus !== 'not-enrolled')
      .map((student) => student.id);

    if (ids.length === 0) return;

    setError('');
    setBulkSaving(true);

    ids.forEach((id) => setBusy(id, true));

    try {
      const results = await Promise.all(ids.map((id) => setStudentNotEnrolled(id)));
      const failed = results.find((res) => !res?.success);

      if (failed) {
        setError(failed.error || 'Failed to unenroll selected students.');
        return;
      }

      setStudents((prev) =>
        prev.map((student) =>
          ids.includes(student.id)
            ? { ...student, enrollmentStatus: 'not-enrolled', enrolledTerm: null }
            : student
        )
      );

      setSelectedIds([]);
      await refresh();
    } catch (err) {
      setError(err?.message || 'Failed to unenroll selected students.');
    } finally {
      ids.forEach((id) => setBusy(id, false));
      setBulkSaving(false);
    }
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setSelectedFolder(null);
    setSearch('');
    setSelectedIds([]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Enrollment</h2>
          <p className="mt-1 text-sm text-gray-500">
            {term.semester ? SEMESTER_LABELS[term.semester] || `Sem ${term.semester}` : 'No semester'} ·{' '}
            {term.schoolYear || 'No school year'}
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-60"
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {termIncomplete && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Set the active semester and school year before managing enrollment.</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setSelectedFolder(null);
              setSearch('');
            }}
            className={`rounded-lg p-4 text-left transition ${
              statusFilter === 'all' ? 'border-2 border-blue-300 bg-blue-50 text-blue-900' : 'border cursor-pointer border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="block text-xs">All</span>
            <span className="mt-1 block text-lg font-semibold">{students.length}</span>
          </button>

          {['enrolled', 'needs-update', 'not-enrolled', 'unset'].map((key) => {
            const meta = STATUS_META[key];
            const active = statusFilter === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setStatusFilter(active ? 'all' : key);
                  setSelectedFolder(null);
                  setSearch('');
                }}
              className={`rounded-lg p-4 text-left transition ${
                  active ? 'border-2 border-blue-300 bg-blue-50 text-blue-900' : 'border cursor-pointer border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="block text-xs">{meta.label}</span>
                <span className="mt-1 block text-lg font-semibold">{counts[key] || 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!selectedFolder ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-700">Sections</p>

            {(statusFilter !== 'all' || search) && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Clear
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <FolderSkeleton key={index} />
              ))}
            </div>
          ) : folders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-12 text-center">
              <p className="text-sm font-medium text-gray-700">No sections found</p>
              <p className="mt-1 text-xs text-gray-500">Try another status filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                  }}
                  className="group rounded-lg border border-gray-200 bg-white p-4 text-left transition hover:border-gray-300 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-500">
                      <Folder className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{folder.label}</p>
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
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedFolder(null);
                  setSearch('');
                  setSelectedIds([]);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                title="Back"
                aria-label="Back"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div>
                <p className="text-sm font-semibold text-gray-900">{selectedFolderLabel}</p>
                <p className="text-xs text-gray-500">
                  {tableStudents.length} student{tableStudents.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-gray-900"
                />
              </div>

              <button
                type="button"
                onClick={handleEnrollSelected}
                disabled={termIncomplete || bulkSaving || loading || !canEnrollSelected}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                title="Enroll selected"
                aria-label="Enroll selected"
              >
                <UserCheck className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={handleUnenrollSelected}
                disabled={bulkSaving || loading || !canUnenrollSelected}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Unenroll selected"
                aria-label="Unenroll selected"
              >
                <UserX className="h-4 w-4" />
              </button>
            </div>
          </div>

          {hasSelected && (
            <div className="text-xs text-slate-500">
              {selectedIds.length} selected
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded accent-gray-900"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                      />
                    </th>

                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort('name')}
                        className="inline-flex items-center hover:text-gray-900"
                      >
                        Student <SortIcon column="name" />
                      </button>
                    </th>

                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort('yearBlock')}
                        className="inline-flex items-center hover:text-gray-900"
                      >
                        Year / Block <SortIcon column="yearBlock" />
                      </button>
                    </th>

                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort('status')}
                        className="inline-flex items-center hover:text-gray-900"
                      >
                        Status <SortIcon column="status" />
                      </button>
                    </th>

                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort('term')}
                        className="inline-flex items-center hover:text-gray-900"
                      >
                        Term <SortIcon column="term" />
                      </button>
                    </th>

                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <TableSkeleton />
                  ) : tableStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    tableStudents.map((student) => {
                      const meta = STATUS_META[student.enrollmentStatus] || STATUS_META.unset;
                      const block = getBlock(student);
                      const studentTerm = student.enrolledTerm;
                      const termText = studentTerm?.semester
                        ? `${SEMESTER_LABELS[studentTerm.semester] || `Sem ${studentTerm.semester}`}${
                            studentTerm.schoolYear ? ` · ${studentTerm.schoolYear}` : ''
                          }`
                        : '-';
                      const busy = busyIds.has(student.id);
                      const isEnrolledHere = student.enrollmentStatus === 'enrolled';

                      return (
                        <tr key={student.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded accent-gray-900"
                              checked={selectedIds.includes(student.id)}
                              onChange={() => toggleSelectStudent(student.id)}
                            />
                          </td>

                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{student.name}</p>
                            <p className="mt-0.5 text-xs text-gray-500">{student.studentNumber || '-'}</p>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                            {student.isIrregular
                              ? `${getYearLabel(Number(student.yearLevel || 1))} Year · Irregular`
                              : `${getYearLabel(Number(student.yearLevel || 1))} Year · Block ${block}`}
                          </td>

                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${meta.pill}`}>
                              {meta.label}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{termText}</td>

                         <td className="px-4 py-3 text-right">
  <div className="flex items-center justify-end gap-2">
    {isEnrolledHere ? (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handleUnenroll(student);
        }}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
      >
        <UserX className="h-3.5 w-3.5" />
        {busy ? 'Saving' : 'Unenroll'}
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
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-500 px-3 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-40 cursor-pointer"
        >
          <UserCheck className="h-3.5 w-3.5" />
          {busy ? 'Saving' : 'Enroll'}
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
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
          >
            <UserX className="h-3.5 w-3.5" />
            {busy ? 'Saving' : 'Unenroll'}
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
    </div>
  );
};

export default EnrollmentManager;
