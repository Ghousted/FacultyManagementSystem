import { useState, useEffect, useCallback } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { BadgePlus, Pencil, MoreVertical, Trash, Search, ChevronLeft, RefreshCcw, Folder, Archive, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
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

const getArchiveGroupLabel = (department) => {
  const semester = Number(department?.archivedSemester || department?.semester || 0) || 0;
  const schoolYear = formatSchoolYear(department?.archivedSchoolYear || department?.schoolYear || department?.academicYear || '');
  const semesterLabel = SEMESTER_LABELS[semester] || (semester ? `${semester}th Semester` : 'Archived');
  return `${semesterLabel} • S.Y. ${schoolYear || 'Unknown'}`;
};

const getArchiveSortKey = (department) => {
  const semester = Number(department?.archivedSemester || department?.semester || 0) || 0;
  const schoolYear = (department?.archivedSchoolYear || department?.schoolYear || department?.academicYear || '').toString();
  return `${schoolYear}::${semester}`;
};

const getYearLevelLabel = (year) => {
  const normalizedYear = Number(year);
  if (normalizedYear === 1) return '1st Year';
  if (normalizedYear === 2) return '2nd Year';
  if (normalizedYear === 3) return '3rd Year';
  if (normalizedYear === 4) return '4th Year';
  return year ? `${year} Year` : '';
};

const OtherDepartmentManagement = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [otherDepartments, setOtherDepartments] = useState([]);
  const [departmentTab, setDepartmentTab] = useState('current');
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
      setError('Please sign in to access other department data');
      return;
    }

    setLoading(true);
    setError('');
    const result = await getOtherDepartments();
    if (result.success) {
      setOtherDepartments(result.data);
    } else {
      setError(result.error || 'Unable to load other departments');
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
      setError('Please sign in to access other department students');
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
      setError('Failed to load other department students: ' + err.message);
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
  }, [selectedOtherDeptId, loadOtherDeptStudents]);

  const selectedOtherDepartment = otherDepartments.find((dept) => dept.id === selectedOtherDeptId) || null;
  const currentDepartments = otherDepartments.filter((dept) => !dept.isArchived);
  const archivedDepartments = otherDepartments.filter((dept) => dept.isArchived);
  const filteredOtherDepartments = currentDepartments.filter((dept) => {
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
      setError('Please sign in to manage other departments');
      return;
    }
    if (!departmentForm.name.trim()) {
      setError('Department name is required.');
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
        isArchived: false,
        archivedAt: null,
        archivedSemester: null,
        archivedSchoolYear: '',
        updatedAt: new Date().toISOString()
      };

      if (editingDepartmentId) {
        await updateDoc(doc(db, 'otherDepartments', editingDepartmentId), payload);
        setSuccess('Department updated.');
      } else {
        await addDoc(collection(db, 'otherDepartments'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        setSuccess('Department added.');
      }

      setDepartmentModalOpen(false);
      setEditingDepartmentId('');
      setDepartmentForm({ name: '', code: '' });
      await loadOtherDepartments();
    } catch (err) {
      setError('Failed to save department: ' + err.message);
    }
    setLoading(false);
  };

  const handleArchiveDepartment = async (department) => {
    if (!activeTerm?.semester || !activeTerm?.schoolYear) {
      setError('Please set the active term before archiving a department.');
      return;
    }

    setConfirmDialog({
      open: true,
      title: 'Archive department?',
      message: 'This will move the department to the Archived tab using the current semester and school year.',
      confirmLabel: 'Archive',
      confirmTone: 'primary',
      onConfirm: async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
          await updateDoc(doc(db, 'otherDepartments', department.id), {
            isArchived: true,
            archivedAt: new Date().toISOString(),
            archivedSemester: Number(activeTerm.semester),
            archivedSchoolYear: activeTerm.schoolYear,
            archiveLabel: getArchiveGroupLabel({ archivedSemester: Number(activeTerm.semester), archivedSchoolYear: activeTerm.schoolYear }),
            updatedAt: new Date().toISOString()
          });
          setSuccess('Department archived.');
          await loadOtherDepartments();
          if (selectedOtherDeptId === department.id) {
            setSelectedOtherDeptId('');
            setOtherDeptStudents([]);
          }
        } catch (err) {
          setError('Failed to archive department: ' + err.message);
        }
        setLoading(false);
      }
    });
  };

  const handleDeleteDepartment = async (department) => {
    setConfirmDialog({
      open: true,
      title: 'Delete archived department?',
      message: 'This will permanently remove the archived department and all related students, payables, and payment records.',
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
          setSuccess('Archived department deleted permanently.');
          if (selectedOtherDeptId === department.id) {
            setSelectedOtherDeptId('');
          }
          await loadOtherDepartments();
          setOtherDeptStudents([]);
        } catch (err) {
          setError('Failed to delete department: ' + err.message);
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
      setError('Please sign in to manage other department students');
      return;
    }
    if (!selectedOtherDeptId) {
      setError('Select a department first.');
      return;
    }
    if (!otherStudentForm.name.trim() || !otherStudentForm.course.trim()) {
      setError('Student name and course are required.');
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
        setSuccess('Student updated.');
      } else {
        await addDoc(collection(db, 'otherDept-Students'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        setSuccess('Student added.');
      }

      setOtherStudentModalOpen(false);
      setEditingOtherStudentId('');
      setOtherStudentForm({ name: '', course: '', yearLevel: '1', block: '' });
      await loadOtherDeptStudents(selectedOtherDeptId);
    } catch (err) {
      setError('Failed to save student: ' + err.message);
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
          setSuccess('Student deleted.');
          await loadOtherDeptStudents(selectedOtherDeptId);
        } catch (err) {
          setError('Failed to delete student: ' + err.message);
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

  const archivedGroups = archivedDepartments
    .filter((department) => {
      const term = otherDeptSearch.trim().toLowerCase();
      return !term || (department.name || '').toLowerCase().includes(term) || (department.code || '').toLowerCase().includes(term) || getArchiveGroupLabel(department).toLowerCase().includes(term);
    })
    .reduce((groups, department) => {
      const key = getArchiveSortKey(department);
      if (!groups[key]) {
        groups[key] = {
          label: getArchiveGroupLabel(department),
          sortKey: key,
          departments: []
        };
      }
      groups[key].departments.push(department);
      return groups;
    }, {});

  const archivedGroupList = Object.values(archivedGroups).sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  return (
    <div>
      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {success && <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>}

     

      {!selectedOtherDeptId ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
           <div className="flex items-center gap-6 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setDepartmentTab('current')}
              className={`px-4 py-2 text-sm font-medium transition
                ${departmentTab === 'current'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 cursor-pointer hover:border-b-2 hover:border-blue-600 hover:text-blue-600'
                }`}
            >
              Current
            </button>

            <button
              type="button"
              onClick={() => setDepartmentTab('archived')}
              className={`px-4 py-2 text-sm font-medium transition
                ${departmentTab === 'archived'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 cursor-pointer hover:border-b-2 hover:border-blue-600 hover:text-blue-600'
                }`}
            >
              Archived
            </button>
          </div>

         
          </div>

          {departmentTab === 'current' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {filteredOtherDepartments.map((department) => (
                <div
                  key={department.id}
                  className="group relative cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-400 hover:shadow-sm"
                  onClick={() => setSelectedOtherDeptId(department.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    
                    {/* LEFT SIDE (ICON + TEXT) */}
                    <div className="flex items-start gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Folder className="h-5 w-5" />
                      </div>

                      <div className="space-y-1">
                        <p className="text-base font-semibold text-slate-900">
                          {department.name || 'Unnamed department'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Other Departments
                        </p>
                      </div>
                    </div>

                    {/* ACTION BUTTON */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenOtherDepartmentMenuId((prev) =>
                          prev === department.id ? '' : department.id
                        );
                      }}
                      className="rounded-lg bg-slate-50 p-1 text-slate-500 shadow-sm transition hover:bg-slate-100"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>

                  {/* DROPDOWN MENU */}
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
                          handleArchiveDepartment(department);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
                      >
                        <Archive className="h-3.5 w-3.5" /> Archive
                      </button>
                    </div>
                  )}
                </div>
))}
              {filteredOtherDepartments.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-slate-500">
                  No current departments found. Use the Add Department button to create one.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {archivedGroupList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-slate-500">
                  No archived departments found.
                </div>
              ) : (
                archivedGroupList.map((group) => (
                  <div key={group.sortKey} className="">
                   
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {group.departments.map((department) => (
                        <div
                          key={department.id}
                          className="group relative cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 hover:border-blue-400 hover:shadow-sm"
                          onClick={() => setSelectedOtherDeptId(department.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                           <div className='flex items-start gap-2'>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Folder className="h-5 w-5" />
                      </div>
                             <div className="space-y-1">
                              <p className="text-xs text-slate-500">{group.label}</p>
                              <p className="text-sm  text-slate-900">{department.name || 'Unnamed department'}</p>
                              
                            </div>
                           </div>
                            
                          </div>

                          <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenOtherDepartmentMenuId((prev) => (prev === department.id ? '' : department.id));
                              }}
                              className="absolute bottom-2 right-2 rounded-lg bg-slate-50 cursor-pointer p-1 text-slate-500 shadow-sm hover:bg-slate-100"
                              title="Open archived department actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                          {openOtherDepartmentMenuId === department.id && (
                            <div className="absolute right-4 top-14 z-10 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeleteDepartment(department);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                              >
                                <Trash className="w-3 h-3" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      ) : (
        <div>
        

    

          <div className='flex items-center justify-between gap-2'>

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
                onClick={() => loadOtherDeptStudents(selectedOtherDeptId)}
                disabled={loading}
                className="p-2.5 rounded-xl cursor-pointer bg-white border border-slate-200 hover:bg-slate-50 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
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
                className="w-full rounded-xl border bg-white border-slate-200 py-2 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

             <div className="w-fit">
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm  focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                  <th className="px-4 py-3 w-40%">{renderSortableHeader('name', 'Name')}</th>
                  <th className="px-4 py-3 w-15%">{renderSortableHeader('course', 'Course')}</th>
                  <th className="px-4 py-3 w-15%">{renderSortableHeader('yearLevel', 'Year')}</th>
                  <th className="px-4 py-3 w-15%">{renderSortableHeader('block', 'Block')}</th>
                  <th className="px-4 py-3 w-15%">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={`other-dept-student-skeleton-${index}`} className="animate-pulse border-t border-gray-200">
                      <td className="px-4 py-3 w-40%"><div className="h-4 w-40 rounded bg-gray-200" /></td>
                      <td className="px-4 py-3 w-15%"><div className="h-4 w-28 rounded bg-gray-200" /></td>
                      <td className="px-4 py-3 w-15%"><div className="h-4 w-16 rounded bg-gray-200" /></td>
                      <td className="px-4 py-3 w-15%"><div className="h-4 w-16 rounded bg-gray-200" /></td>
                      <td className="px-4 py-3 w-15% flex gap-2">
                        <div className="h-4 w-4 rounded bg-gray-200" />
                        <div className="h-4 w-4 rounded bg-gray-200" />
                        <div className="h-4 w-4 rounded bg-gray-200" />
                      </td>
                    </tr>
                  ))
                ) : sortedOtherDeptStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                      No students found for this year level.
                    </td>
                  </tr>
                ) : (
                  sortedOtherDeptStudents.map((student) => (
                    <tr key={student.id} className="border-t border-gray-200 hover:bg-slate-50">
                      <td className="px-4 py-3 w-40%">{student.name}</td>
                      <td className="px-4 py-3 w-15%">{student.course}</td>
                      <td className="px-4 py-3 w-15%">{getYearLevelLabel(student.yearLevel)}</td>
                      <td className="px-4 py-3 w-15%">{student.block}</td>
                      <td className="px-4 py-3 w-15%">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditOtherStudent(student)}
                            className="rounded-lg bg-gray-100 p-1.5 cursor-pointer hover:bg-gray-200 text-gray-500"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOtherStudent(student.id)}
                            className="rounded-lg bg-gray-100 p-1.5 cursor-pointer hover:bg-gray-200 text-gray-500"
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
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-300 bg-white p-6 shadow-xl">
            <div className="text-lg font-semibold text-slate-900">{confirmDialog.title}</div>
            <p className="mt-2 text-sm text-slate-600">{confirmDialog.message}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirmDialog}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCurrentDialog}
                className={`rounded-full px-4 py-2 text-sm font-medium text-white ${confirmDialog.confirmTone === 'primary' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-rose-600 hover:bg-rose-700'}`}
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={departmentForm.name}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Department Code</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={departmentForm.code}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, code: event.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDepartmentModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
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
                {editingOtherStudentId ? 'Edit Student' : 'Add Student'}
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={otherStudentForm.block}
                    onChange={(event) => setOtherStudentForm((prev) => ({ ...prev, block: event.target.value }))}
                    placeholder="A"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOtherStudentModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
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
