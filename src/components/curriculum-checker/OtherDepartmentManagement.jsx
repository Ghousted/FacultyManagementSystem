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

const DepartmentCardSkeleton = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 animate-pulse">
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
          createdAt: new Date().toISOString()
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
      {label}
      {renderSortIcon(key)}
    </button>
  );

  return (
    <div>
      {/* messages shown via toast notifications */}

      {!selectedOtherDeptId ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <DepartmentCardSkeleton key={`other-dept-skeleton-${index}`} />
                ))
              : filteredOtherDepartments.map((department) => (
              <div
                key={department.id}
                className="group relative cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-400 hover:shadow-sm"
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
              <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-slate-500">
                No departments found. Use the Add Department button to create one.
              </div>
            )}
          </div>
        </>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-2">

            <div className="mb-4 flex w-fit items-center gap-4 border-b border-slate-200">
              {[1, 2, 3, 4].map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setOtherStudentYearTab(year)}
                  className={`px-2 relative py-2 text-sm font-medium transition-colors
                    border-b-2
                    ${
                      otherStudentYearTab === year
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-600 hover:text-blue-600 hover:border-blue-600 cursor-pointer'
                    }`}
                >
                  {year === 1
                    ? '1st Year'
                    : year === 2
                      ? '2nd Year'
                      : year === 3
                        ? '3rd Year'
                        : '4th Year'}
                </button>
              ))}
            </div>

            <div className="mb-4 flex flex-wrap items-center  gap-2">
              <div className="flex flex-wrap items-center gap-2">
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
                  Select
                </button>

                {selectMode && selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDelete}
className="rounded-lg bg-gray-100 p-1.5 cursor-pointer hover:bg-gray-200 text-gray-500"
                  >
                    <Trash className="h-4 w-4" />
                  
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => loadOtherDeptStudents(selectedOtherDeptId)}
                  disabled={loading}
className="p-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
                  title="Refresh table data"
                >
                  <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="relative  w-72">
                <Search className="absolute w-4 h-4 left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={otherStudentSearch}
                  onChange={(event) => setOtherStudentSearch(event.target.value)}
                  placeholder="Search students..."
className="w-full border text-sm border-slate-200 bg-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                />
              </div>

              <div className="w-fit">
                <select
                      className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  value={otherStudentCourseFilter}
                  onChange={(event) => setOtherStudentCourseFilter(event.target.value)}
                >
                  <option value="all">All courses</option>
                  {otherStudentCourses.map((course) => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
              </div>

              <div className="w-fit">
                <select
                      className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  value={otherStudentBlockFilter}
                  onChange={(event) => setOtherStudentBlockFilter(event.target.value)}
                >
                  <option value="all">All blocks</option>
                  {otherStudentBlocks.map((block) => (
                    <option key={block} value={block}>Block {block}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white ">
            <table className="min-w-full text-sm">
              <thead className="bg-blue-500 text-left text-white">
                <tr>
                  <th className="px-4 py-3 w-[5%]">
                    {selectMode ? (
                      <input
                        type="checkbox"
                        className="h-3 w-3 rounded accent-gray-900"
                        checked={sortedOtherDeptStudents.length > 0 && sortedOtherDeptStudents.every((student) => selectedIds.includes(student.id))}
                        onChange={toggleSelectAllVisible}
                      />
                    ) : (
                      <span className="font-medium">No.</span>
                    )}
                  </th>
                  <th className="px-4 py-3 w-40%">{renderSortableHeader('name', 'Name')}</th>
                  <th className="px-4 py-3 w-15%">{renderSortableHeader('course', 'Course')}</th>
                  <th className="px-4 py-3 w-15%">{renderSortableHeader('yearLevel', 'Year')}</th>
                  <th className="px-4 py-3 w-10%">{renderSortableHeader('block', 'Block')}</th>
                  <th className="px-4 py-3 w-15%">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <OtherStudentRowSkeleton key={`other-dept-student-skeleton-${index}`} index={index} />
                  ))
                ) : sortedOtherDeptStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-slate-500">
                      No students found for this year level.
                    </td>
                  </tr>
                ) : (
                  sortedOtherDeptStudents.map((student, index) => (
                    <tr key={student.id} className="border-t border-gray-200 hover:bg-slate-50">
                      <td className="w-10 px-4 py-3">
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
                      <td className="px-4 py-3 w-40%">{student.name}</td>
                      <td className="px-4 py-3 w-15%">{student.course}</td>
                      <td className="px-4 py-3 w-15%">{getYearLevelLabel(student.yearLevel)}</td>
                      <td className="px-4 py-3 w-15%">{student.block}</td>
                      <td className="px-4 py-3 w-15%">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditOtherStudent(student)}
                                  className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOtherStudent(student.id)}
                                  className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={closeConfirmDialog}></div>
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-300 bg-white p-8 shadow-xl">
            <div className="text-lg font-semibold text-slate-900">{confirmDialog.title}</div>
            <p className="mt-2  text-slate-700">{confirmDialog.message}</p>
            <div className="mt-8 flex justify-end gap-2">
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
                className="px-4 py-1.5 W-28 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
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
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-2xl shadow p-8">
            <div className="text-xl font-semibold mb-4">{editingDepartmentId ? 'Edit Department' : 'Add Department'}</div>
            <form onSubmit={handleSaveDepartment} className="space-y-4">
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
                className="px-4 py-1.5 W-28 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
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
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-2xl shadow p-8">
            <div className=" mb-4">
              <h1 className='text-xl font-semibold mb-1'>
                {editingOtherStudentId ? 'Update Student' : 'Add Student'}
              </h1>
              <p className="text-sm text-slate-500">
                {selectedOtherDepartment?.name || 'Department'}
              </p>
            </div>
            <form onSubmit={handleSaveOtherStudent} className="space-y-4">
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
                className="px-4 py-1.5 W-28 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
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
