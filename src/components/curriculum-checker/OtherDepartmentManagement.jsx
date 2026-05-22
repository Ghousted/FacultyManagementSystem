import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { BadgePlus, Pencil, MoreVertical, Trash, Search, ChevronLeft, RefreshCcw, Folder, ChevronUp, ChevronDown, ChevronsUpDown, Square } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getActiveTerm, getOtherDepartments } from '../../models/facultyModels';
import { db } from '../../firebase';

const SEMESTER_LABELS = {
  1: '1st Semester',
  2: '2nd Semester',
  3: 'Summer'
};

const formatSchoolYear = (schoolYear) => {
  const normalized = (schoolYear || '').toString().trim();
  if (!normalized) return '';
  return normalized.replace(/-/g, '–');
};

const getYearLevelLabel = (year) => {
  const normalizedYear = Number(year);
  if (normalizedYear === 1) return '1st Year';
  if (normalizedYear === 2) return '2nd Year';
  if (normalizedYear === 3) return '3rd Year';
  if (normalizedYear === 4) return '4th Year';
  return year ? `${year} Year` : '';
};

const getStudentTermKey = (student) => {
  const term = student?.createdTerm || {};
  if (!term.semester || !term.schoolYear) return 'legacy::';
  return `${Number(term.semester)}::${term.schoolYear}`;
};

const getTermLabelFromKey = (termKey) => {
  if (!termKey || termKey.startsWith('legacy')) {
    return 'Earlier Records (No Term)';
  }
  const [semester, schoolYear] = termKey.split('::');
  return `${SEMESTER_LABELS[Number(semester)] || `Sem ${semester}`} · S.Y. ${formatSchoolYear(schoolYear)}`;
};

const getActiveTermLabel = (term) => {
  if (!term?.semester || !term?.schoolYear) return '';
  return `${SEMESTER_LABELS[Number(term.semester)] || `Sem ${term.semester}`} · S.Y. ${formatSchoolYear(term.schoolYear)}`;
};

const DepartmentCardSkeleton = () => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100" />
        <div className="space-y-2">
          <div className="h-4 w-36 rounded bg-slate-200" />
          <div className="h-3 w-24 rounded bg-slate-100" />
        </div>
      </div>
      <div className="h-8 w-8 rounded-lg bg-slate-100" />
    </div>
  </div>
);

const OtherStudentRowSkeleton = () => (
  <tr className="border-t border-gray-200 animate-pulse">
    <td className="w-10 px-4 py-3"><div className="h-4 w-4 rounded bg-gray-200" /></td>
    <td className="px-4 py-3 w-40%"><div className="h-4 w-40 rounded bg-gray-200" /></td>
    <td className="px-4 py-3 w-15%"><div className="h-4 w-28 rounded bg-gray-200" /></td>
    <td className="px-4 py-3 w-15%"><div className="h-4 w-16 rounded bg-gray-200" /></td>
    <td className="px-4 py-3 w-15%"><div className="h-4 w-16 rounded bg-gray-200" /></td>
    <td className="px-4 py-3 w-15%">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-gray-200" />
        <div className="h-8 w-8 rounded-full bg-gray-200" />
      </div>
    </td>
  </tr>
);

const OtherDepartmentManagement = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [otherDepartments, setOtherDepartments] = useState([]);
  const [selectedOtherDeptId, setSelectedOtherDeptId] = useState('');
  const [otherDeptStudents, setOtherDeptStudents] = useState([]);
  const [otherDeptSearch, setOtherDeptSearch] = useState('');
  const [otherStudentSearch, setOtherStudentSearch] = useState('');
  const [otherStudentYearTab, setOtherStudentYearTab] = useState(1);
  const [openYearFolder, setOpenYearFolder] = useState(null);
  const [openCourse, setOpenCourse] = useState(null);
  const [openCombo, setOpenCombo] = useState(null);
  const [otherStudentCourseFilter, setOtherStudentCourseFilter] = useState('all');
  const [otherStudentBlockFilter, setOtherStudentBlockFilter] = useState('all');
  const [otherStudentSort, setOtherStudentSort] = useState({ key: 'name', direction: 'asc' });
  const [departmentForm, setDepartmentForm] = useState({ name: '', code: '' });
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [editingDepartmentId, setEditingDepartmentId] = useState('');
  const [openOtherDepartmentMenuId, setOpenOtherDepartmentMenuId] = useState('');
  const [otherStudentForm, setOtherStudentForm] = useState({ name: '', course: '', yearLevel: '1', block: '' });
  const [otherStudentModalOpen, setOtherStudentModalOpen] = useState(false);
  const [editingOtherStudentId, setEditingOtherStudentId] = useState('');
  const [activeTerm, setActiveTerm] = useState({ semester: null, schoolYear: '' });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    confirmTone: 'danger',
    onConfirm: null
  });

  const loadOtherDepartments = useCallback(async () => {
    if (!currentUser) {
      toast.error('Please sign in to access other department data');
      return;
    }

    setLoading(true);
    setError('');
    const result = await getOtherDepartments();
    if (result.success) {
      setOtherDepartments(result.data.filter(dept => !dept.isArchived));
    } else {
      toast.error(result.error || 'Unable to load other departments');
    }
    setLoading(false);
  }, [currentUser]);

  const loadActiveTerm = useCallback(async () => {
    if (!currentUser) return;

    const result = await getActiveTerm();
    if (result.success && result.data) {
      setActiveTerm(result.data);
    }
  }, [currentUser]);

  const loadOtherDeptStudents = useCallback(async (departmentId) => {
    if (!currentUser) {
      toast.error('Please sign in to access other department students');
      return;
    }
    if (!departmentId) {
      setOtherDeptStudents([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const studentQuery = query(
        collection(db, 'otherDept-Students'),
        where('departmentId', '==', departmentId)
      );
      const snap = await getDocs(studentQuery);
      const records = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setOtherDeptStudents(records);
    } catch (err) {
      toast.error('Failed to load other department students: ' + err.message);
    }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadOtherDepartments();
      loadActiveTerm();
    }
  }, [currentUser, loadActiveTerm, loadOtherDepartments]);

  useEffect(() => {
    if (selectedOtherDeptId) {
      loadOtherDeptStudents(selectedOtherDeptId);
    } else {
      setOtherDeptStudents([]);
    }
    setSelectMode(false);
    setSelectedIds([]);
  }, [selectedOtherDeptId, loadOtherDeptStudents]);

  const selectedOtherDepartment = otherDepartments.find((dept) => dept.id === selectedOtherDeptId) || null;
  const filteredOtherDepartments = otherDepartments.filter((dept) => {
    const term = otherDeptSearch.trim().toLowerCase();
    return !term || (dept.name || '').toLowerCase().includes(term) || (dept.code || '').toLowerCase().includes(term);
  });

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('student-breadcrumb', {
        detail: {
          mode: 'other',
          selectedDepartment: selectedOtherDepartment
            ? { name: selectedOtherDepartment.name || 'Unnamed department' }
            : null
        }
      })
    );
  }, [selectedOtherDepartment]);

  // Update breadcrumb when course or combo changes so UI can show full path
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('student-breadcrumb', {
        detail: {
          mode: 'other',
          selectedDepartment: selectedOtherDepartment
            ? { name: selectedOtherDepartment.name || 'Unnamed department' }
            : null,
          course: openCourse || (openCombo && openCombo.course) || null,
          combo: openCombo ? { year: openCombo.year, block: openCombo.block } : null
        }
      })
    );
  }, [selectedOtherDepartment, openCourse, openCombo]);

  useEffect(() => {
    if (!selectedOtherDeptId) return;

    setOtherStudentYearTab(1);
    setOtherStudentCourseFilter('all');
    setOtherStudentBlockFilter('all');
    setOtherStudentSearch('');
    setSelectMode(false);
    setSelectedIds([]);
  }, [selectedOtherDeptId]);

  const openCreateDepartmentModal = () => {
    setDepartmentForm({ name: '', code: '' });
    setEditingDepartmentId('');
    setDepartmentModalOpen(true);
  };

  useEffect(() => {
    window.addEventListener('open-add-department', openCreateDepartmentModal);
    return () => window.removeEventListener('open-add-department', openCreateDepartmentModal);
  }, []);

  useEffect(() => {
    const handleOpenOtherDepartmentRoot = () => {
      if (!selectedOtherDeptId) return;
      setOpenCourse(null);
      setOpenCombo(null);
      setOtherStudentSearch('');
      setSelectMode(false);
      setSelectedIds([]);
    };

    const handleOpenOtherDepartmentCourse = (event) => {
      const course = event.detail?.course;
      if (!course) return;
      setOpenCourse(course);
      setOpenCombo(null);
      setOtherStudentSearch('');
      setSelectMode(false);
      setSelectedIds([]);
    };

    const handleOpenOtherDepartmentCombo = (event) => {
      const course = event.detail?.course;
      const year = event.detail?.year;
      const block = event.detail?.block;
      if (!course || year === undefined || block === undefined) return;
      setOpenCourse(course);
      setOpenCombo({ course, year, block });
      setOtherStudentSearch('');
      setSelectMode(false);
      setSelectedIds([]);
    };

    window.addEventListener('open-other-department-root', handleOpenOtherDepartmentRoot);
    window.addEventListener('open-other-department-course', handleOpenOtherDepartmentCourse);
    window.addEventListener('open-other-department-combo', handleOpenOtherDepartmentCombo);
    return () => {
      window.removeEventListener('open-other-department-root', handleOpenOtherDepartmentRoot);
      window.removeEventListener('open-other-department-course', handleOpenOtherDepartmentCourse);
      window.removeEventListener('open-other-department-combo', handleOpenOtherDepartmentCombo);
    };
  }, [selectedOtherDeptId]);

  useEffect(() => {
    const handleResetOtherDepartment = () => {
      setSelectedOtherDeptId('');
    };
    window.addEventListener('reset-other-department', handleResetOtherDepartment);
    return () => window.removeEventListener('reset-other-department', handleResetOtherDepartment);
  }, []);

  const handleEditDepartment = (department) => {
    setDepartmentForm({
      name: department.name || '',
      code: department.code || ''
    });
    setEditingDepartmentId(department.id);
    setDepartmentModalOpen(true);
  };

  const handleSaveDepartment = async (event) => {
    event.preventDefault();
    if (!currentUser) {
      toast.error('Please sign in to manage other departments');
      return;
    }
    if (!departmentForm.name.trim()) {
      toast.error('Department name is required.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        name: departmentForm.name.trim(),
        code: departmentForm.code.trim(),
        userId: currentUser.uid,
        updatedAt: new Date().toISOString()
      };

      if (editingDepartmentId) {
        await updateDoc(doc(db, 'otherDepartments', editingDepartmentId), payload);
        toast.success('Department updated.');
      } else {
        await addDoc(collection(db, 'otherDepartments'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        toast.success('Department added.');
      }

      setDepartmentModalOpen(false);
      setEditingDepartmentId('');
      setDepartmentForm({ name: '', code: '' });
      await loadOtherDepartments();
    } catch (err) {
      toast.error('Failed to save department: ' + err.message);
    }
    setLoading(false);
  };

  const handleDeleteDepartment = async (department) => {
    setConfirmDialog({
      open: true,
      title: 'Delete department?',
      message: 'This will permanently remove the department and all related students, payables, and payment records.',
      confirmLabel: 'Delete',
      confirmTone: 'danger',
      onConfirm: async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
          const studentsRef = collection(db, 'otherDept-Students');
          const payablesRef = collection(db, 'otherDept-payables');
          const paymentsRef = collection(db, 'otherDept-payment');

          const [studentsSnap, payablesSnap, paymentsSnap] = await Promise.all([
            getDocs(query(studentsRef, where('departmentId', '==', department.id))),
            getDocs(query(payablesRef, where('departmentId', '==', department.id))),
            getDocs(query(paymentsRef, where('departmentId', '==', department.id)))
          ]);

          const deletePromises = [];
          studentsSnap.docs.forEach((docSnap) => deletePromises.push(deleteDoc(doc(db, 'otherDept-Students', docSnap.id))));
          payablesSnap.docs.forEach((docSnap) => deletePromises.push(deleteDoc(doc(db, 'otherDept-payables', docSnap.id))));
          paymentsSnap.docs.forEach((docSnap) => deletePromises.push(deleteDoc(doc(db, 'otherDept-payment', docSnap.id))));
          deletePromises.push(deleteDoc(doc(db, 'otherDepartments', department.id)));

          await Promise.all(deletePromises);
          toast.success('Department deleted permanently.');
          if (selectedOtherDeptId === department.id) {
            setSelectedOtherDeptId('');
          }
          await loadOtherDepartments();
          setOtherDeptStudents([]);
        } catch (err) {
          toast.error('Failed to delete department: ' + err.message);
        }
        setLoading(false);
      }
    });
  };

  const openCreateOtherStudentModal = () => {
    setOtherStudentForm({ name: '', course: '', yearLevel: '1', block: '' });
    setEditingOtherStudentId('');
    setOtherStudentModalOpen(true);
  };

  useEffect(() => {
    window.addEventListener('open-add-other-department-student', openCreateOtherStudentModal);
    return () => window.removeEventListener('open-add-other-department-student', openCreateOtherStudentModal);
  }, []);

  const handleEditOtherStudent = (student) => {
    setOtherStudentForm({
      name: student.name || '',
      course: student.course || '',
      yearLevel: String(student.yearLevel || 1),
      block: student.block || ''
    });
    setEditingOtherStudentId(student.id);
    setOtherStudentModalOpen(true);
  };

  const handleSaveOtherStudent = async (event) => {
    event.preventDefault();
    if (!currentUser) {
      toast.error('Please sign in to manage other department students');
      return;
    }
    if (!selectedOtherDeptId) {
      toast.error('Select a department first.');
      return;
    }
    if (!otherStudentForm.name.trim() || !otherStudentForm.course.trim()) {
      toast.error('Student name and course are required.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        userId: currentUser.uid,
        departmentId: selectedOtherDeptId,
        name: otherStudentForm.name.trim(),
        course: otherStudentForm.course.trim(),
        yearLevel: Number(otherStudentForm.yearLevel),
        block: otherStudentForm.block.trim(),
        updatedAt: new Date().toISOString()
      };

      if (editingOtherStudentId) {
        await updateDoc(doc(db, 'otherDept-Students', editingOtherStudentId), payload);
        toast.success('Student updated.');
      } else {
        await addDoc(collection(db, 'otherDept-Students'), {
          ...payload,
          createdAt: new Date().toISOString(),
          createdTerm: activeTerm?.semester && activeTerm?.schoolYear
            ? {
                semester: Number(activeTerm.semester),
                schoolYear: activeTerm.schoolYear
              }
            : null
        });
        toast.success('Student added.');
      }

      setOtherStudentModalOpen(false);
      setEditingOtherStudentId('');
      setOtherStudentForm({ name: '', course: '', yearLevel: '1', block: '' });
      await loadOtherDeptStudents(selectedOtherDeptId);
    } catch (err) {
      toast.error('Failed to save student: ' + err.message);
    }
    setLoading(false);
  };

  const handleDeleteOtherStudent = async (studentId) => {
    setConfirmDialog({
      open: true,
      title: 'Delete student?',
      message: 'This will permanently remove the student and their related payment records.',
      confirmLabel: 'Delete',
      confirmTone: 'danger',
      onConfirm: async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
          const paymentsRef = collection(db, 'otherDept-payment');
          const paymentSnapshot = await getDocs(query(paymentsRef, where('studentId', '==', studentId)));
          const deletePromises = paymentSnapshot.docs.map((paymentDoc) => deleteDoc(doc(db, 'otherDept-payment', paymentDoc.id)));
          deletePromises.push(deleteDoc(doc(db, 'otherDept-Students', studentId)));
          await Promise.all(deletePromises);
          toast.success('Student deleted.');
          await loadOtherDeptStudents(selectedOtherDeptId);
        } catch (err) {
          toast.error('Failed to delete student: ' + err.message);
        }
        setLoading(false);
      }
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog((prev) => ({ ...prev, open: false, onConfirm: null }));
  };

  const confirmCurrentDialog = async () => {
    const action = confirmDialog.onConfirm;
    closeConfirmDialog();
    if (action) {
      await action();
    }
  };

  const otherStudentCourses = Array.from(new Set(otherDeptStudents.map((student) => (student.course || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const otherStudentBlocks = Array.from(new Set(otherDeptStudents.map((student) => (student.block || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const filteredOtherDeptStudents = otherDeptStudents.filter((student) => {
    const term = otherStudentSearch.trim().toLowerCase();
    const matchesYear = Number(student.yearLevel || 0) === Number(otherStudentYearTab);
    const matchesCourse = otherStudentCourseFilter === 'all' || (student.course || '') === otherStudentCourseFilter;
    const matchesBlock = otherStudentBlockFilter === 'all' || (student.block || '') === otherStudentBlockFilter;
    const matchesSearch = !term || (student.name || '').toLowerCase().includes(term) || (student.course || '').toLowerCase().includes(term) || (student.block || '').toLowerCase().includes(term);
    return matchesYear && matchesCourse && matchesBlock && matchesSearch;
  });
  const sortedOtherDeptStudents = [...filteredOtherDeptStudents].sort((a, b) => {
    const direction = otherStudentSort.direction === 'desc' ? -1 : 1;
    const key = otherStudentSort.key;
    const aValue = key === 'yearLevel' ? Number(a.yearLevel || 0) : (a[key] || '').toString();
    const bValue = key === 'yearLevel' ? Number(b.yearLevel || 0) : (b[key] || '').toString();

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * direction;
    }

    return aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' }) * direction;
  });

  const handleOtherStudentSort = (key) => {
    setOtherStudentSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const renderSortIcon = (key) => {
    if (otherStudentSort.key !== key) return <ChevronsUpDown className="h-3.5 w-3.5" />;
    return otherStudentSort.direction === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5" />
      : <ChevronDown className="h-3.5 w-3.5" />;
  };

  const toggleSelectMode = () => {
    setSelectMode((prev) => !prev);
    setSelectedIds([]);
  };

  const toggleSelectStudent = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]
    );
  };

  const toggleSelectAllVisible = () => {
    if (sortedOtherDeptStudents.every((student) => selectedIds.includes(student.id))) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedOtherDeptStudents.map((student) => student.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      open: true,
      title: 'Delete selected students?',
      message: `This will permanently remove ${selectedIds.length} student${selectedIds.length > 1 ? 's' : ''} and their related payment records.`,
      confirmLabel: 'Delete',
      confirmTone: 'danger',
      onConfirm: async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
          const paymentsRef = collection(db, 'otherDept-payment');
          const deletePromises = [];
          for (const studentId of selectedIds) {
            const paymentSnapshot = await getDocs(query(paymentsRef, where('studentId', '==', studentId)));
            paymentSnapshot.docs.forEach((paymentDoc) => deletePromises.push(deleteDoc(doc(db, 'otherDept-payment', paymentDoc.id))));
            deletePromises.push(deleteDoc(doc(db, 'otherDept-Students', studentId)));
          }
          await Promise.all(deletePromises);
          toast.success(`${selectedIds.length} student${selectedIds.length > 1 ? 's' : ''} deleted.`);
          setSelectedIds([]);
          await loadOtherDeptStudents(selectedOtherDeptId);
        } catch (err) {
          toast.error('Failed to delete selected students: ' + err.message);
        }
        setLoading(false);
      }
    });
  };

  const renderSortableHeader = (key, label) => (
    <button
      type="button"
      onClick={() => handleOtherStudentSort(key)}
      className="inline-flex items-center gap-1.5 font-semibold"
    >
      {String(label).toUpperCase()}
      {renderSortIcon(key)}
    </button>
  );

  // Determine which columns have data for the currently selected year/tab
  const visibleStudentsForYear = openYearFolder
    ? sortedOtherDeptStudents.filter(s => Number(s.yearLevel) === Number(openYearFolder))
    : [];
  const hasCourse = visibleStudentsForYear.some(s => (s.course || '').toString().trim() !== '');
  const hasYear = visibleStudentsForYear.some(s => s.yearLevel !== undefined && s.yearLevel !== null && String(s.yearLevel).trim() !== '');
  const hasBlock = visibleStudentsForYear.some(s => (s.block || '').toString().trim() !== '');

  return (
    <div>
      {/* messages shown via toast notifications */}

      {!selectedOtherDeptId ? (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <DepartmentCardSkeleton key={`other-dept-skeleton-${index}`} />
                ))
              : filteredOtherDepartments.map((department) => (
              <div
                key={department.id}
                className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-400 hover:shadow-sm"
                onClick={() => setSelectedOtherDeptId(department.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-4">
                     <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Folder className="h-5 w-5" />
                    </div>

                    <div className="h-10">
                      <p className="text-sm font-semibold text-slate-900">
                        {department.name || 'Unnamed department'}
                      </p>
                     
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenOtherDepartmentMenuId((prev) =>
                        prev === department.id ? '' : department.id
                      );
                    }}
                    className="rounded-lg cursor-pointer bg-slate-50 p-1 text-slate-500 shadow-sm transition hover:bg-slate-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>

                {openOtherDepartmentMenuId === department.id && (
                  <div className="absolute right-4 top-14 z-10 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleEditDepartment(department);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteDepartment(department);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                    >
                      <Trash className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!loading && filteredOtherDepartments.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-slate-500">
                No departments found. Use the Add Department button to create one.
              </div>
            )}
          </div>
        </>
      ) : (
        <div>
          <div className="flex w-full flex-1 items-center justify-between gap-3">

            {!openCourse && !openCombo && (
            <div className="mb-4 flex-1 space-y-6">
           
              {(() => {
                const comboMap = new Map();
                (otherDeptStudents || []).forEach((student) => {
                  const course = (student.course || '').toString().trim();
                  const year = student.yearLevel || '';
                  const block = (student.block || '—').toString().trim() || '—';
                  const termKey = getStudentTermKey(student);
                  const comboKey = `${termKey}::${course}::${year}::${block}`;
                  if (!comboMap.has(comboKey)) {
                    comboMap.set(comboKey, { termKey, course, year, block, students: [] });
                  }
                  comboMap.get(comboKey).students.push(student);
                });

                const termGroups = new Map();
                Array.from(comboMap.values()).forEach((combo) => {
                  if (!termGroups.has(combo.termKey)) {
                    termGroups.set(combo.termKey, []);
                  }
                  termGroups.get(combo.termKey).push(combo);
                });

                const sortedTermKeys = Array.from(termGroups.keys()).sort((a, b) => {
                  if (a.startsWith('legacy')) return 1;
                  if (b.startsWith('legacy')) return -1;
                  const [semA, syA] = a.split('::');
                  const [semB, syB] = b.split('::');
                  const yearCompare = String(syB).localeCompare(String(syA));
                  if (yearCompare !== 0) return yearCompare;
                  return Number(semB) - Number(semA);
                });

                if (sortedTermKeys.length === 0) {
                  return (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-slate-500">
                      No students found for this department.
                    </div>
                  );
                }

                return sortedTermKeys.map((termKey) => {
                  const combos = termGroups.get(termKey).sort((a, b) => {
                    const courseCompare = (a.course || '').localeCompare(b.course || '', undefined, { sensitivity: 'base', numeric: true });
                    if (courseCompare !== 0) return courseCompare;
                    const yearCompare = Number(a.year || 0) - Number(b.year || 0);
                    if (yearCompare !== 0) return yearCompare;
                    return String(a.block || '').localeCompare(String(b.block || ''), undefined, { sensitivity: 'base', numeric: true });
                  });

                  return (
                    <section key={termKey}>
                      <div className="mb-3 flex items-center gap-3">
                        <h3 className="text-sm font-semibold text-slate-800">{getTermLabelFromKey(termKey)}</h3>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {combos.map((combo) => {
                          const { course, year, block, students } = combo;
                          const key = `${termKey}::${course}::${year}::${block}`;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => { setOpenCombo({ course, year, block }); setOpenCourse(null); }}
                              className="group relative cursor-pointer rounded-lg border border-gray-300 bg-white p-4 text-left transition hover:border-blue-400 hover:shadow-md"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                  <Folder className="h-5 w-5" />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">{`${course} ${getYearLevelLabel(year)} ${block}`}</div>
                                  <div className="text-xs text-slate-500">{students.length} student{students.length !== 1 ? 's' : ''}</div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                });
              })()}
            </div>
            )}

            {(openCourse || openCombo) && (
           <div className="flex items-center justify-between gap-2 mb-4 flex-1">

            <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadOtherDeptStudents(selectedOtherDeptId)}
                  disabled={loading}
                  title="Refresh table data"
                  className="p-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
                >
                  <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              <div className="relative flex-1 w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="text"
                  value={otherStudentSearch}
                  onChange={(event) => setOtherStudentSearch(event.target.value)}
                  placeholder="Search students..."
                  className="w-full border text-sm border-slate-200 bg-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                />
              </div>
              </div>
              
              {/* Left side */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={toggleSelectMode}
                  title={selectMode ? 'Turn off selection' : 'Select students'}
                  className={`inline-flex items-center gap-2 rounded-lg border border-gray-300 p-2 text-sm transition cursor-pointer
                    ${
                      selectMode
                        ? 'bg-blue-50 text-blue-600 border-blue-300'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  <Square className="h-4 w-4" />
                  {selectMode ? 'Selecting' : 'Select'}
                </button>

          
                <div className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={selectedIds.length === 0}
                    title={selectedIds.length === 0 ? 'Select students to delete' : 'Delete selected students'}
                    className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-100"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                  <span className='text-xs'>
                    {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'None selected'}
                  </span>
                </div>
               

            
              </div>

              {/* Right side */}  
              
            </div>
            )}

          </div>

          {/* Nested folder view: Course -> Year -> Block -> Students */}
          <div className="space-y-3">
            {/* Build nested structure */}
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">Loading students...</div>
            ) : (() => {
              // If a specific Course·Year·Block combo is opened, show its students
              if (openCombo) {
                const comboStudents = (otherDeptStudents || []).filter(s => (s.course || '').toString().trim() === (openCombo.course || '').toString().trim() && String(s.yearLevel) === String(openCombo.year) && ((s.block || '—').toString().trim() === (openCombo.block || '—').toString().trim()));
                const term = otherStudentSearch.trim().toLowerCase();
                const comboStudentsFiltered = comboStudents.filter((student) => {
                  return !term || (student.name || '').toLowerCase().includes(term) || (student.course || '').toLowerCase().includes(term) || String(student.yearLevel || '').toLowerCase().includes(term) || (student.block || '').toLowerCase().includes(term);
                });
                const comboStudentsSorted = [...comboStudentsFiltered].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                return (
                  <div>
                  
                    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-blue-500 text-white text-xs text-left uppercase">
                          <tr>
                            {selectMode ? (
                              <th className="w-10 px-4 py-2">
                                <input
                                  type="checkbox"
                                  aria-label={comboStudentsSorted.every((student) => selectedIds.includes(student.id)) ? 'Clear selection' : 'Select all'}
                                  checked={comboStudentsSorted.length > 0 && comboStudentsSorted.every((student) => selectedIds.includes(student.id))}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedIds(comboStudentsSorted.map((student) => student.id));
                                    else setSelectedIds([]);
                                  }}
                                  className="h-4 w-4 text-white"
                                />
                              </th>
                            ) : (
                              <th className="w-12 px-4 py-2">No.</th>
                            )}
                            <th className="px-4 py-2">{renderSortableHeader('name', 'Name')}</th>
                            <th className="px-4 py-2">{renderSortableHeader('course', 'Course')}</th>
                            <th className="px-4 py-2">{renderSortableHeader('yearLevel', 'Year Level')}</th>
                            <th className="px-4 py-2">{renderSortableHeader('block', 'Block')}</th>
                            <th className="px-4 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comboStudentsSorted.length === 0 ? (
                            <tr><td colSpan={selectMode ? 6 : 6} className="px-4 py-6 text-center text-sm text-slate-500">No students found.</td></tr>
                          ) : comboStudentsSorted.map((st, rowIndex) => (
                            <tr key={st.id} className="border-t border-gray-100">
                              {selectMode ? (
                                <td className="px-4 py-2 align-middle">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(st.id)}
                                    onChange={() => toggleSelectStudent(st.id)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                              ) : (
                                <td className="px-4 py-2 text-slate-500">{rowIndex + 1}</td>
                              )}
                              <td className="px-4 py-2">{st.name}</td>
                              <td className="px-4 py-2">{st.course}</td>
                              <td className="px-4 py-2">{getYearLevelLabel(st.yearLevel)}</td>
                              <td className="px-4 py-2">{st.block || '—'}</td>
                              <td className="px-4 py-2 text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  <button 
                                    onClick={() => handleEditOtherStudent(st)} 
                              className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteOtherStudent(st.id)} 
                              className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                                  >
                                    <Trash className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              // when a course is open, show a flat ascending table of students for that course
              if (openCourse) {
                const studentsInCourse = (otherDeptStudents || []).filter(s => (s.course || '').toString().trim() === openCourse);
                const filtered = studentsInCourse.filter(s => {
                  const term = otherStudentSearch.trim().toLowerCase();
                  return !term || (s.name || '').toLowerCase().includes(term) || (s.block || '').toLowerCase().includes(term) || (s.course || '').toLowerCase().includes(term) || String(s.yearLevel || '').toLowerCase().includes(term);
                });
                const courseStudents = [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                return (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setOpenCourse(null)} className="text-sm text-blue-600">← Back</button>
                        <Folder className="h-5 w-5 text-blue-600" />
                        <div className="text-sm font-semibold">{openCourse}</div>
                      </div>
                      <div className="relative w-80">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder={`Search students...`}
                          value={otherStudentSearch}
                          onChange={(e) => setOtherStudentSearch(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1"
                        />
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-blue-50 text-xs text-slate-500 text-left">
                          <tr>
                            {selectMode ? (
                              <th className="w-10 px-4 py-2">
                                <input
                                  type="checkbox"
                                  aria-label={courseStudents.every((student) => selectedIds.includes(student.id)) ? 'Clear selection' : 'Select all'}
                                  checked={courseStudents.length > 0 && courseStudents.every((student) => selectedIds.includes(student.id))}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedIds(courseStudents.map((student) => student.id));
                                    else setSelectedIds([]);
                                  }}
                                  className="h-4 w-4 text-slate-500"
                                />
                              </th>
                            ) : (
                              <th className="w-12 px-4 py-2">#</th>
                            )}
                            <th className="px-4 py-2">{renderSortableHeader('name', 'Name')}</th>
                            <th className="px-4 py-2">{renderSortableHeader('course', 'Course')}</th>
                            <th className="px-4 py-2">{renderSortableHeader('yearLevel', 'Year Level')}</th>
                            <th className="px-4 py-2">{renderSortableHeader('block', 'Block')}</th>
                            <th className="px-4 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {courseStudents.length === 0 ? (
                            <tr><td colSpan={selectMode ? 6 : 6} className="px-4 py-6 text-center text-sm text-slate-500">No students found.</td></tr>
                          ) : courseStudents.map((st, rowIndex) => (
                            <tr key={st.id} className="border-t border-gray-100">
                              {selectMode ? (
                                <td className="px-4 py-2 align-middle">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(st.id)}
                                    onChange={() => toggleSelectStudent(st.id)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </td>
                              ) : (
                                <td className="px-4 py-2 text-slate-500">{rowIndex + 1}</td>
                              )}
                              <td className="px-4 py-2">{st.name}</td>
                              <td className="px-4 py-2">{st.course}</td>
                              <td className="px-4 py-2">{getYearLevelLabel(st.yearLevel)}</td>
                              <td className="px-4 py-2">{st.block || '—'}</td>
                              <td className="px-4 py-2 text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  <button 
                                    onClick={() => handleEditOtherStudent(st)} 
                              className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteOtherStudent(st.id)} 
                              className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                                  >
                                    <Trash className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              const courses = Array.from(new Map((otherDeptStudents || []).map(s => [ (s.course || '—').toString().trim(), null])).keys());
              if (courses.length === 0) {
                return <div className="p-8 text-center text-sm text-slate-500">No students found for this department.</div>;
              }

             
            })()}
          </div>
        </div>
      )}

      {confirmDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeConfirmDialog}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-xl shadow">
            <div className="px-8 py-4 border-b border-slate-300">
              <div className="text-lg font-semibold text-slate-900">{confirmDialog.title}</div>
              {confirmDialog.subtitle && (
                <p className="text-xs text-slate-500">{confirmDialog.subtitle}</p>
              )}
            </div>

            <div className="px-8 py-4">
              <p className=" text-slate-700">{confirmDialog.message}</p>
            </div>

            <div className="px-8 py-4 flex justify-end gap-2 border-t border-transparent">
              <button
                type="button"
                onClick={closeConfirmDialog}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCurrentDialog}
                className="px-4 py-1.5 w-28 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {departmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setDepartmentModalOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-xl shadow">
            <div className="text-xl font-medium text-slate-800 border-b border-slate-300 px-8 py-4">{editingDepartmentId ? 'Edit Department' : 'Add Department'}</div>
            <form onSubmit={handleSaveDepartment} className="space-y-2 px-8 py-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Department Name</label>
                <input
                  type="text"
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  value={departmentForm.name}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                  placeholder='(e.g. College of Hospotality Management)'
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Department Code</label>
                <input
                  type="text"
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  value={departmentForm.code}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, code: event.target.value }))}
                    placeholder='(e.g. CHARM)'
                />
              </div>
              <div className="flex justify-end gap-2 mt-8">
                <button
                  type="button"
                  onClick={() => setDepartmentModalOpen(false)}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                className="px-4 py-1.5 w-28 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {editingDepartmentId ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {otherStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setOtherStudentModalOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-xl shadow ">
            <div className="px-8 py-4 border-b border-slate-300 ">
              <h1 className='text-xl font-semibold '>
                {editingOtherStudentId ? 'Update Student' : 'Add Student'}
              </h1>
              <p className="text-xs text-slate-500">
                {selectedOtherDepartment?.name || 'Department'}
              </p>
            </div>
            <form onSubmit={handleSaveOtherStudent} className="space-y-2 px-8 py-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Student Name</label>
                <input
                  type="text"
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  value={otherStudentForm.name}
                  onChange={(event) => setOtherStudentForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                  placeholder='Enter student name, (Dela Cruz, Ron M.)'
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Course</label>
                <input
                  type="text"
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  value={otherStudentForm.course}
                  onChange={(event) => setOtherStudentForm((prev) => ({ ...prev, course: event.target.value }))}
                  required
                  placeholder='Enter Course (BSBA-FM)'
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Year Level</label>
                  <select
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                    value={otherStudentForm.yearLevel}
                    onChange={(event) => setOtherStudentForm((prev) => ({ ...prev, yearLevel: event.target.value }))}
                  >
                    {[1, 2, 3, 4].map((year) => (
                      <option key={year} value={String(year)}>
                        {getYearLevelLabel(year)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Block</label>
                  <input
                    type="text"
                    maxLength={1}
                    pattern="[A-Za-z]"
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                    value={otherStudentForm.block}
                    onChange={(event) => setOtherStudentForm((prev) => ({ ...prev, block: (event.target.value || '').replace(/[^A-Za-z]/g, '').slice(0,1).toUpperCase() }))}
                    placeholder="A"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-8">
                <button
                  type="button"
                  onClick={() => setOtherStudentModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer "
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                className="px-4 py-1.5 w-28 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {editingOtherStudentId ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OtherDepartmentManagement;
