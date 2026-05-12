import { useState, useEffect, useCallback } from 'react';

import { 
  addStudent, 
  getStudents, 
  updateStudentCourse,
  getCurriculums,
  getCoursesByCurriculum,
  getAllCourses,
  archiveAndPromoteStudents
} from '../../models/curriculumModels';
import { getActiveTerm } from '../../models/facultyModels';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, deleteDoc, getDoc, collection, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import OtherDepartmentManagement from './OtherDepartmentManagement';
import { BadgePlus, Pencil, Folder, Trash, Search, ChevronUp, ChevronDown, ChevronsUpDown, RefreshCcw, ChevronLeft, Plus, Funnel, X, FolderArchive, MoreVertical, Square } from 'lucide-react';
import { logSystemAction } from '../../utils/auditLogger';

const SEMESTER_LABELS = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };

const normalizeTerm = (activeTerm) => ({
  semester: activeTerm?.semester ?? activeTerm?.sem ?? activeTerm?.activeSemester,
  schoolYear: activeTerm?.schoolYear ?? activeTerm?.school_year ?? activeTerm?.academicYear
});

const getEnrollmentStatus = (student) => {
  if (student?.enrollmentStatus) return student.enrollmentStatus;
  if (student?.enrolled === true) return 'enrolled';
  if (student?.enrolled === false) return 'not-enrolled';
  return 'unset';
};

const FolderSkeleton = () => (
  <div className="relative rounded-xl border border-gray-300 bg-white p-4 shadow-sm animate-pulse">
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
    <td className="px-4 py-2">
      <div className="h-4 w-4 bg-gray-200 rounded" />
    </td>
    <td className="px-4 py-2">
      <div className="h-4 w-24 bg-gray-200 rounded" />
    </td>
    <td className="px-4 py-2">
      <div className="h-4 w-32 bg-gray-200 rounded" />
    </td>
    <td className="px-4 py-2">
      <div className="h-4 w-40 bg-gray-200 rounded" />
    </td>
    <td className="px-4 py-2">
      <div className="h-4 w-28 bg-gray-200 rounded" />
    </td>
    <td className="px-4 py-2">
      <div className="h-4 w-32 bg-gray-200 rounded" />
    </td>
    <td className="px-4 py-2">
      <div className="flex gap-2">
        <div className="h-4 w-4 bg-gray-200 rounded-full" />
        <div className="h-4 w-4 bg-gray-200 rounded-full" />
        <div className="h-4 w-4 bg-gray-200 rounded-full" />
      </div>
    </td>
  </tr>
);

const StudentManagement = ({ onBack, initialSection = 'students' }) => {
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
  const [searchTerm, setSearchTerm] = useState('');
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
  const [subjectPickerCurriculumFilter, setSubjectPickerCurriculumFilter] = useState('all');
  const [subjectPickerYearFilter, setSubjectPickerYearFilter] = useState('all');
  const [subjectPickerSemesterFilter, setSubjectPickerSemesterFilter] = useState('all');
  const [subjectPickerSearch, setSubjectPickerSearch] = useState('');
  const [subjectPickerSortBy, setSubjectPickerSortBy] = useState('yearLevel');
  const [subjectPickerSortOrder, setSubjectPickerSortOrder] = useState('asc');
  const [irregularDeleteDialogOpen, setIrregularDeleteDialogOpen] = useState(false);
  const [irregularSubjectToDelete, setIrregularSubjectToDelete] = useState(null);

  // Sorting state for course tables
  const [sortBy, setSortBy] = useState('courseCode');
  const [sortOrder, setSortOrder] = useState('asc');

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

  const term = normalizeTerm(activeTerm);
  const statusCounts = students.reduce(
    (acc, student) => {
      const status = getEnrollmentStatus(student);
      if (!acc[status] && acc[status] !== 0) acc[status] = 0;
      acc[status] += 1;
      if (student.active === false) {
        acc.inactive += 1;
      } else {
        acc.active += 1;
      }
      return acc;
    },
    { enrolled: 0, 'needs-update': 0, 'not-enrolled': 0, unset: 0, active: 0, inactive: 0 }
  );

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

    const shouldUpdateBlock = !selectedFolder?.isIrregular;
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
            ? { yearLevel: multiEditYear, block: multiEditBlock, updatedAt: new Date() }
            : { yearLevel: multiEditYear, updatedAt: new Date() }
        );
      });

      await Promise.all(updates);
      await logSystemAction({
        action: 'Updated',
        module: 'Curriculum Checker',
        entityType: selectedCount === 1 ? 'student' : 'studentBatch',
        entityId: selectedCount === 1 ? selectedIds[0] : '',
        description: updateDescription,
        details: shouldUpdateBlock
          ? { studentIds: selectedIds, count: selectedCount, yearLevel: multiEditYear, block: multiEditBlock }
          : { studentIds: selectedIds, count: selectedCount, yearLevel: multiEditYear }
      });

      setStudents(prev => prev.map(s =>
        selectedIds.includes(s.id)
          ? { ...s, yearLevel: multiEditYear, ...(shouldUpdateBlock ? { block: multiEditBlock } : {}) }
          : s
      ));
      setSuccess('Students updated successfully!');
      setSelectedIds([]);
      setMultiEditOpen(false);
    } catch (err) {
      setError('Failed to update students: ' + err.message);
    }
    setLoading(false);
  };

  // Batch delete: confirm then delete selected studs
  const handleConfirmMultiDelete = async () => {
    if (!currentUser) {
      setError('Please sign in to delete students');
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
        action: 'Deleted students',
        module: 'Curriculum Checker',
        entityType: 'studentBatch',
        entityId: '',
        description: `deleted ${deletedLabel}`,
        details: { studentIds: selectedIds, count: selectedIds.length }
      });

      setStudents(prev => prev.filter(s => !selectedIds.includes(s.id)));
      if (selectedIds.includes(selectedStudent?.id)) setSelectedStudent(null);
      setSuccess('Selected students deleted successfully!');
      setSelectedIds([]);
      setMultiDeleteOpen(false);
    } catch (err) {
      setError('Failed to delete students: ' + err.message);
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
      setError('Please sign in to access student data');
      return;
    }
    
    setLoading(true);
    setError('');
    const result = await getStudents();
    if (result.success) {
      setStudents(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [currentUser]);

  const loadCurriculums = useCallback(async () => {
    if (!currentUser) {
      setError('Please sign in to access curriculum data');
      return;
    }
    
    setLoading(true);
    setError('');
    const result = await getCurriculums();
    if (result.success) {
      setCurriculums(result.data);
    } else {
      setError(result.error);
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
    return () => window.removeEventListener('open-add-student', handleOpenAddStudent);
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
    if (!folderName) return alert('Please choose or enter a folder name');
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
        alert(`Cannot archive students with existing payables:\n${studentsWithPayables.join('\n')}\n\nPlease settle all payables before archiving these students.`);
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
        action: 'Archived selected students',
        module: 'Curriculum Checker',
        entityType: 'archive',
        entityId: folderName,
        description: `Archived ${selectedIds.length} students to ${folderName}`,
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
      setSuccess('Students archived successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to archive students.');
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
    
    const result = await getCoursesByCurriculum(curriculumId);
    if (result.success) {
      setStudentCourses(result.data);
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
      setError('Please enter a valid student number in the format XXXX-XXXXX');
      return;
    }

    // Check for duplicate student number only if provided
    if (studentForm.studentNumber) {
      const existingStudent = students.find(student => student.studentNumber === studentForm.studentNumber);
      if (existingStudent) {
        setError('A student with this student number already exists');
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
    const result = await addStudent({
      ...studentForm,
      curriculumId: studentForm.curriculumId,
      block: studentForm.isIrregular ? '' : studentForm.block,
      irregularSubjects: studentForm.isIrregular ? { sem1: [], sem2: [], sem3: [] } : undefined
    });
    if (result.success) {
      setSuccess('Student added successfully!');
      setStudentForm({ name: '', email: '', contactNumber: '', studentNumber: '', yearLevel: 1, curriculumId: '', block: '', enrolled: true, isIrregular: false });
      setStudentDialogOpen(false);
      loadStudents();
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleUpdateStudentCourse = async (courseCode, isCompleted) => {
    if (!selectedStudent) return;
    
    setLoading(true);
    const result = await updateStudentCourse(selectedStudent.id, courseCode, isCompleted);
    if (result.success) {
      setSuccess('Course status updated!');
      
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
      setError(result.error);
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
      block: student.block || getFirstBlockForYear(student.yearLevel, student.isIrregular || false),
      // keep originals so UI can keep student visible in the folder where edit started
      originalYearLevel: student.yearLevel,
      originalBlock: student.block || getFirstBlockForYear(student.yearLevel, student.isIrregular || false)
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
      const updateDescription = yearOrBlockChanged
        ? payload.isIrregular
          ? `Updated ${payload.name || studentId} to year level ${payload.yearLevel}`
          : `Updated ${payload.name || studentId} to year level ${payload.yearLevel} and block ${payload.block || 'A'}`
        : `Updated student: ${payload.name || studentId}`;
      await logSystemAction({
        action: 'Updated',
        module: 'Curriculum Checker',
        entityType: 'student',
        entityId: studentId,
        description: updateDescription,
        details: payload
      });
      setSuccess('Student updated successfully!');
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
      setError('Failed to update student: ' + error.message);
    }
    setLoading(false);
  };

  const handleDeleteStudent = async (studentId) => {
    if (!currentUser) {
      setError('Please sign in to delete a student');
      return;
    }

    setStudentToDelete(studentId);
    setDeleteDialogOpen(true);
  };

  // Archive a single student: open the Archive Selected modal prefilled for this student
  const handleArchiveStudent = (e, student) => {
    e.stopPropagation();
    if (!currentUser) {
      setError('Please sign in to archive a student');
      return;
    }

    // Preselect this student and open the archive modal so user can choose/create folder
    setSelectedIds([student.id]);
    setSelectedArchiveFolder('');
    setNewArchiveFolderName('');
    setArchiveSelectedModalOpen(true);
  };

  // Toggle active/inactive for a single student. If reactivating, open modal to choose year/block.
  const handleToggleActive = async (e, student) => {
    e.stopPropagation();
    if (!currentUser) { setError('Please sign in to change student status'); return; }
    // If student is inactive, open reactivation modal to choose year/block
    if (student.active === false) {
      setReactivateTarget(student);
      setReactivateYear(student.yearLevel || 1);
      setReactivateBlock(student.block || 'A');
      setReactivateIsIrregular(!!student.isIrregular);
      setReactivateModalOpen(true);
      return;
    }

    // Otherwise, deactivate directly
    setLoading(true);
    try {
      const ref = doc(db, 'students', student.id);
      await updateDoc(ref, { active: false, inactiveAt: serverTimestamp(), inactiveYear: student.yearLevel, updatedAt: new Date() });
      await logSystemAction({
        action: 'updated student status',
        module: 'Curriculum Checker',
        entityType: 'student',
        entityId: student.id,
        description: `updated student status: ${student.name || student.id}`,
        details: { studentId: student.id, studentName: student.name || '', status: 'inactive' }
      });
      setStudents(prev => prev.map(s => s.id === student.id ? { ...s, active: false, inactiveAt: new Date(), inactiveYear: student.yearLevel } : s));
      setSuccess('Student marked inactive');
    } catch (err) {
      setError('Failed to update status: ' + err.message);
    }
    setLoading(false);
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;

    setLoading(true);
    setError('');
    
    try {
      const studentName = students.find(student => student.id === studentToDelete)?.name || studentToDelete;
      await deleteDoc(doc(db, 'students', studentToDelete));
      await logSystemAction({
        action: 'Deleted student',
        module: 'Curriculum Checker',
        entityType: 'student',
        entityId: studentToDelete,
        description: `deleted student ${studentName}`,
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

  const getFirstBlockForYear = (year, isIrregular = false) => {
    if (isIrregular) return '';

    const blocks = getBlocksForYear(year, isIrregular);
    return blocks && blocks.length > 0 ? blocks[0] : 'A';
  };

  const getIrregularSubjectCandidates = () => {
    let candidates = [...allCourses];

    if (subjectPickerCurriculumFilter !== 'all') {
      candidates = candidates.filter((course) => course.curriculumId === subjectPickerCurriculumFilter);
    }

    if (subjectPickerYearFilter !== 'all') {
      candidates = candidates.filter((course) => Number(course.yearLevel) === Number(subjectPickerYearFilter));
    }

    if (subjectPickerSemesterFilter !== 'all') {
      candidates = candidates.filter((course) => Number(course.semester) === Number(subjectPickerSemesterFilter));
    }

    const query = subjectPickerSearch.trim().toLowerCase();
    if (query) {
      candidates = candidates.filter((course) => {
        const curriculumName = getCurriculumName(course.curriculumId).toLowerCase();
        const classification = course.isMajor ? 'major' : 'available';
        return (
          (course.courseCode || '').toString().toLowerCase().includes(query) ||
          (course.courseTitle || '').toString().toLowerCase().includes(query) ||
          String(course.units ?? '').toLowerCase().includes(query) ||
          String(course.yearLevel ?? '').toLowerCase().includes(query) ||
          String(course.semester ?? '').toLowerCase().includes(query) ||
          curriculumName.includes(query) ||
          classification.includes(query)
        );
      });
    }

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

  const isCourseCompleted = (courseCode) => {
    // Check if course is marked as completed OR if it has a grade (except failed/incomplete)
    const hasGrade = studentGrades[courseCode] && studentGrades[courseCode] !== '';
    const isFailed = studentGrades[courseCode] === '5.0';
    const isIncomplete = studentGrades[courseCode] === 'INC';
    
    return selectedStudent?.completedCourses?.includes(courseCode) || 
           (hasGrade && !isFailed && !isIncomplete);
  };

  const handleAddIrregularSubject = async (semester, course) => {
    if (!selectedStudent) return;
    if (!course) {
      setError('Please select a subject to add');
      return;
    }

    const semKey = `sem${semester}`;
    const targetYear = courseTab + 1;
    const duplicate = (irregularSubjects[semKey] || []).some(
      (subject) =>
        (subject.courseCode || '').toString().trim().toUpperCase() === (course.courseCode || '').toString().trim().toUpperCase() &&
        Number(subject.yearLevel || targetYear) === targetYear
    );

    if (duplicate) {
      setError('This subject is already added for the selected year and semester');
      return;
    }

    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      courseCode: (course.courseCode || '').toString().trim().toUpperCase(),
      courseTitle: (course.courseTitle || '').toString().trim(),
      units: parseFloat(course.units) || 0,
      isMajor: !!course.isMajor,
      prerequisites: Array.isArray(course.prerequisites) ? course.prerequisites : [],
      curriculumId: course.curriculumId || null,
      curriculumName: getCurriculumName(course.curriculumId) || 'Unknown Curriculum',
      yearLevel: targetYear
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
        action: 'Created irregular subject',
        module: 'Curriculum Checker',
        entityType: 'student',
        entityId: selectedStudent.id,
        description: `created irregular subject for ${selectedStudent.name || selectedStudent.id}`,
        details: { subject: item }
      });
      setSelectedStudent(prev => (prev ? { ...prev, irregularSubjects: next } : prev));
      setSuccess('Subject added to irregular semester load');
    } catch (err) {
      setError('Failed to add subject: ' + err.message);
    }
  };

  const openSubjectPicker = (semester) => {
    setSubjectPickerSemester(semester);
    setSubjectPickerCurriculumFilter('all');
    setSubjectPickerYearFilter(String(courseTab + 1));
    setSubjectPickerSemesterFilter('all');
    setSubjectPickerSearch('');
    setSubjectPickerSortBy('yearLevel');
    setSubjectPickerSortOrder('asc');
    setSubjectPickerOpen(true);
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
        action: 'Removed irregular subject',
        module: 'Curriculum Checker',
        entityType: 'student',
        entityId: selectedStudent.id,
        description: `Removed irregular subject for ${selectedStudent.name || selectedStudent.id}`,
        details: { semesterKey, index }
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
    if (!selectedStudent || !studentGrades) return false;
    
    const semesterGrades = studentCourses
      .filter(course => course.yearLevel === year && course.semester === semester)
      .map(course => studentGrades[course.courseCode])
      .filter(grade => grade !== undefined && grade !== null && grade !== '' && grade !== 'INC' && grade !== 'CRED');
    
    if (semesterGrades.length === 0) return false;
    
    // Check if no grades are higher than 2.1 (excluding 5.0 and INC)
    return semesterGrades.every(grade => {
      const numGrade = parseFloat(grade);
      return numGrade <= 2.1;
    });
  };

  // Calculate Scholarship eligibility for both semesters
  const calculateScholarshipEligibility = (year) => {
    if (!selectedStudent || !studentGrades) return { eligible: false, percentage: 0 };
    
    const yearGrades = studentCourses
      .filter(course => course.yearLevel === year)
      .map(course => studentGrades[course.courseCode])
      .filter(grade => grade !== undefined && grade !== null && grade !== '' && grade !== 'INC' && grade !== 'CRED');
    
    if (yearGrades.length === 0) return { eligible: false, percentage: 0 };
    
    const maxGrade = Math.max(...yearGrades.map(grade => parseFloat(grade)));
    
    if (maxGrade <= 1.5) {
      return { eligible: true, percentage: 100 };
    } else if (maxGrade <= 1.7) {
      return { eligible: true, percentage: 50 };
    } else {
      return { eligible: false, percentage: 0 };
    }
  };

  // Handle grade input change and automatically save grades
  const handleGradeChange = async (courseCode, grade) => {
    // Update the local state immediately for UI responsiveness
    setEditingGrades(prev => ({
      ...prev,
      [courseCode]: grade
    }));
    
    // Automatically update completion status based on grade
    let isCompleted = false;
    
    if (grade && grade !== '') {
      if (grade === '5.0') {
        // Failed courses are not considered completed
        isCompleted = false;
      } else if (grade === 'INC') {
        // Incomplete courses are not considered completed
        isCompleted = false;
      } else {
        // All other grades (including CRED) are considered completed
        isCompleted = true;
      }
      
      // Save grades immediately to database
      try {
        const studentRef = doc(db, 'students', selectedStudent.id);
        const updatedGrades = { ...editingGrades, [courseCode]: grade };
        
        await updateDoc(studentRef, {
          grades: updatedGrades,
          updatedAt: new Date()
        });
        await logSystemAction({
          action: 'Updated student grade',
          module: 'Curriculum Checker',
          entityType: 'student',
          entityId: selectedStudent.id,
          description: `Updated grade for ${courseCode}`,
          details: { courseCode, grade }
        });
        
        // Update local state to reflect saved data
        setStudentGrades(updatedGrades);
        setEditingGrades(updatedGrades);
        
        // Update completion status
        await handleUpdateStudentCourse(courseCode, isCompleted);
        
        setSuccess('Grade saved successfully!');
      } catch (error) {
        setError('Failed to save grade: ' + error.message);
        // Revert the local state if save failed
        setEditingGrades(prev => ({
          ...prev,
          [courseCode]: studentGrades[courseCode] || ''
        }));
      }
    } else {
      // If grade is empty, remove it from the database
      try {
        const studentRef = doc(db, 'students', selectedStudent.id);
        const updatedGrades = { ...editingGrades };
        delete updatedGrades[courseCode];
        
        await updateDoc(studentRef, {
          grades: updatedGrades,
          updatedAt: new Date()
        });
        await logSystemAction({
          action: 'Deleted student grade',
          module: 'Curriculum Checker',
          entityType: 'student',
          entityId: selectedStudent.id,
          description: `Deleted grade for ${courseCode}`,
          details: { courseCode }
        });
        
        setStudentGrades(updatedGrades);
        setEditingGrades(updatedGrades);
        
        // Update completion status
        await handleUpdateStudentCourse(courseCode, false);
        
        setSuccess('Grade removed successfully!');
      } catch (error) {
        setError('Failed to remove grade: ' + error.message);
      }
    }
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
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-left">
          <span className="block text-xs text-gray-600">All</span>
          <span className="mt-1 block text-lg font-semibold text-gray-900">{students.length}</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-left">
          <span className="block text-xs text-gray-600">Enrolled</span>
          <span className="mt-1 block text-lg font-semibold text-gray-900">{statusCounts.enrolled || 0}</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-left">
          <span className="block text-xs text-gray-600">Active</span>
          <span className="mt-1 block text-lg font-semibold text-gray-900">{statusCounts.active || 0}</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-left">
          <span className="block text-xs text-gray-600">Inactive</span>
          <span className="mt-1 block text-lg font-semibold text-gray-900">{statusCounts.inactive || 0}</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-left">
          <span className="block text-xs text-gray-600">Not enrolled</span>
          <span className="mt-1 block text-lg font-semibold text-gray-900">{statusCounts['not-enrolled'] || 0}</span>
        </div>
      </div>

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
     </div>


       

          {/* Archive Selected Modal */}
          {archiveSelectedModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setArchiveSelectedModalOpen(false)}></div>
              <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-2xl shadow p-6">
                <div className="text-lg font-semibold mb-2">Archive Selected Students</div>
                <p className="text-sm text-gray-600 mb-4">Choose an existing folder or create a new one to group the selected students.</p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Existing folders</label>
                    <select className="w-full border border-slate-200 px-4 py-2 rounded-lg" value={selectedArchiveFolder} onChange={e => setSelectedArchiveFolder(e.target.value)} onClick={fetchArchiveFolders}>
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
                      className="w-full border border-slate-200 px-4 py-2 rounded-lg" 
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-8">
                  <button 
                    onClick={() => setArchiveSelectedModalOpen(false)} 
                    className="px-4 py-2 cursor-pointer rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50">Cancel</button>
                  <button
                    onClick={async () => {
                      const folder = newArchiveFolderName.trim() || selectedArchiveFolder;
                      if (!folder) return alert('Please select or enter a folder name');
                      await archiveSelectedStudentsToFolder(folder);
                    }}
                    disabled={archiving}
                    className="px-4 py-2 cursor-pointer rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {archiving ? 'Archiving...' : 'Archive Selected'}
                  </button>
                </div>
              </div>
            </div>
          )}
          

    
      {/* Multi-edit Year Modal */}
      {multiEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setMultiEditOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-2xl shadow p-6">
            <div className="text-lg mb-2 font-medium">
              {selectedFolder?.isIrregular ? 'Edit Year Level for Selected Students' : 'Edit Year Level and Block for Selected Students'}
            </div>
            
             

            <div>
              <label className="block text-sm text-gray-600 mb-1">Year Level</label>
              <select
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm cursor-pointer"
                value={multiEditYear}
                onChange={(e) => setMultiEditYear(parseInt(e.target.value, 10))}
              >
                {[1,2,3,4].map(y => (
                  <option key={y} value={y}>{y === 1 ? '1st' : y === 2 ? '2nd' : y === 3 ? '3rd' : '4th'} Year</option>
                ))}
              </select>
            </div>

            {!selectedFolder?.isIrregular && (
              <div className="mt-3">
                <label className="block text-sm text-gray-600 mb-1">Block</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm cursor-pointer"
                  value={multiEditBlock}
                  onChange={(e) => setMultiEditBlock(e.target.value)}
                >
                  {['A', 'B', 'C', 'D', 'E'].map((block) => (
                    <option key={block} value={block}>{block}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Info / Warning */}
              <div className="px-4 py-2 mb-8 text-sm mt-4  text-blue-800 bg-blue-50 border border-blue-200 rounded-lg">
                {selectedFolder?.isIrregular
                  ? 'Updating the year level will affect all selected students.'
                  : 'Updating the year level and block will affect all selected students.'}
              </div>

            <div className="mt-8 flex justify-end gap-2">
              <button 
                onClick={() => setMultiEditOpen(false)} 
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleMultiEditSave} 
                disabled={loading} 
                className="px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
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
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-2xl shadow p-8">
            <div className="text-xl font-semibold mb-4">Confirm Delete</div>
            <div className="text-gray-700 mb-8">
              Are you sure you want to delete the selected students? This action cannot be undone.
            </div>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setMultiDeleteOpen(false)} 
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmMultiDelete}
                 disabled={loading} 
                className="px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
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
      label: 'Archived Students'
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
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Folder className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">No students yet</h2>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Students will appear here once they are added to a folder.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ">
            {folders.map((f) => (
              <div
                key={`${f.isIrregular ? 'irr' : f.year}-${f.isIrregular ? 'all' : f.block}`}
                className={`p-4 border rounded-xl bg-white hover:shadow-lg transition-all duration-200 cursor-pointer ${
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

  // Show empty state if folder is selected but has no students
  if (selectedFolder && (folderStudents || []).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 flex items-center justify-center rounded-full bg-blue-50 mb-4">
          <i className="bi bi-people text-2xl text-blue-600"></i>
        </div>
        <h2 className="text-lg font-semibold text-gray-800 mb-1">No students in this folder</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-xs">
          Start adding students to this folder.
        </p>
      </div>
    );
  }

  // Show table with students from selected folder
  return (
            <>

            {selectedFolder && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                
                {/* Left side */}
                
                
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
                      className={`p-2 border border-gray-300 cursor-pointer rounded-xl transition 
                          ${selectMode 
                            ? 'bg-gray-100 text-gray-400 '
                          : 'hover:bg-gray-100 text-gray-700 bg-gray-200 '
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

                {/* Right side */}

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
                
              </div>
            )}


              {/* Reactivate modal: choose year & block when re-activating an inactive student */}
              {reactivateModalOpen && reactivateTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-white rounded-2xl p-8 max-w-md">
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
                            action: 'updated student status',
                            module: 'Curriculum Checker',
                            entityType: 'student',
                            entityId: reactivateTarget.id,
                            description: `updated student status: ${reactivateTarget.name || reactivateTarget.id}`,
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
                          // Navigate to the reactivated student's folder
                          setSelectedFolder({
                            year: reactivateIsIrregular ? null : reactivateYear,
                            block: reactivateIsIrregular ? null : reactivateBlock,
                            isIrregular: !!reactivateIsIrregular,
                            isInactiveFolder: false
                          });
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

              <div className="border border-slate-300 rounded-xl overflow-hidden">

            
           
              
              <table className="min-w-full text-sm">
                <thead className="bg-blue-500 text-white sticky top-0">
                  <tr>
                    <th className="px-4 py-2 w-[5%] text-left">
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
                        <span className="font-medium">#</span>
                      )}
                    </th>
                    <th
                      className="px-4 py-2 w-[15%] text-left cursor-pointer"
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
                      className="px-4 py-2 w-[20%] text-left cursor-pointer"
                      onClick={() => handleSort('email')}
                    >
                      Email {sortBy === 'email' ? (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 inline-flex mb-1" /> : <ChevronDown className="w-4 h-4 inline-flex mb-1" />) : <ChevronsUpDown className="w-4 h-4 inline-flex opacity-80 mb-1" />}
                    </th>
                    <th
                      className="px-4 py-2 w-[20%] text-left cursor-pointer"
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
                    <th className="px-4 py-2 w-[8%] text-left">Active</th>
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
                        className="border-t border-gray-300 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleSelectStudent(student)}
                      >
                        <td className="px-4 py-2">
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
                        <td className="px-4 py-2">
                          <span className="">{student.studentNumber || ''}</span>
                        </td>
                        <td className="px-4 py-2">
                          <span className="">{student.name}</span>
                        </td>
                        <td className="px-4 py-2">
                          <span>{student.email}</span>
                        </td>
                    
                        <td className="px-4 py-2">
                          <span>{student.contactNumber || ''}</span>
                        </td>
                        <td className="px-4 py-2">
                          <span>{getCurriculumName(student.curriculumId)}</span>
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleActive(e, student); }}
                            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${student.active === false ? 'bg-gray-200' : 'bg-teal-500'}`}
                            title={student.active === false ? 'Reactivate student' : 'Mark student inactive'}
                          >
                            <span className={`inline-block h-3 w-3 bg-white rounded-full transform transition ${student.active === false ? 'translate-x-0 ml-1' : 'translate-x-5 mr-1'}`}></span>
                          </button>
                        </td>
                        <td className="px-4 py-2">
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
    const scholarshipEligibility = calculateScholarshipEligibility(currentYear);
    const hasSummerInCurrentYear = studentCourses.some(
      (course) => Number(course.yearLevel) === currentYear && Number(course.semester) === 3
    );
    const semestersForCurrentYear = hasSummerInCurrentYear ? [1, 2, 3] : [1, 2];

    if (selectedStudent.isIrregular) {
      return (
        <div className="flex flex-col h-full">
         
          <div className="mt-2 mb-4 gap-2 flex">
            {[1, 2, 3, 4].map((year, idx) => (
              <button
                key={year}
                onClick={() => setCourseTab(idx)}
                className={`px-3 py-1 rounded-full shadow-md border transition-all flex items-center gap-1 text-sm cursor-pointer 

                  ${courseTab === idx
                    ? 'bg-blue-600 text-white border-blue-700 scale-105'
                    : 'bg-white text-blue-700 hover:bg-blue-100 border-gray-300'
                  }
                `}
              >
                {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year
              </button>
            ))}
          </div>

          {semestersForCurrentYear.map((semester) => {
            const semKey = `sem${semester}`;
            const semSubjects = (irregularSubjects[semKey] || []).filter(s => Number(s.yearLevel || currentYear) === currentYear);
            return (
              <div
  key={semester}
  className="mb-5 rounded-2xl overflow-hidden bg-white shadow-sm border border-gray-200"
>

  
  {/* Header */}
  <div className="flex items-center justify-between px-5 py-3 bg-linear-to-r from-blue-600 to-blue-700 text-white">
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold">
        {semester === 1 ? '1st' : semester === 2 ? '2nd' : 'Summer'} Semester
      </span>
      
    </div>

 
  </div>

  <div className='flex items-center justify-between py-0.5 border-b border-slate-300'>
    {/* Sub-header */}
  <div className="px-5 py-2 text-sm text-gray-500 ">
    Select subjects offered for this semester.
  </div>

     <button
      type="button"
      onClick={() => openSubjectPicker(semester)}

      className="mr-5 inline-flex items-center gap-1 rounded-lg cursor-pointer bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 transition">
      <Plus className="w-4 h-4" />
      Add Subject
    </button>
  </div>

  {/* Table */}
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead className="bg-blue-50 text-blue-800 text-xs uppercase border-b border-gray-300">
        <tr>
          <th className="px-2 py-1.5 text-left w-[10%]">Code</th>
          <th className="px-4 py-1.5 text-left w-[30%]">Title</th>
          <th className="px-4 py-1.5 text-left w-[10%]">Units</th>
          <th className="px-4 py-1.5 text-left w-[20%]">Prerequisites</th>
          <th className="px-4 py-1.5 text-left w-[20%]">Grade</th>
          <th className="px-4 py-1.5 text-right w-[10%]">Action</th>
        </tr>
      </thead>

      <tbody>
          {semSubjects.length === 0 ? (
            <tr>
            <td colSpan={6} className="py-8 text-center text-gray-400">
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm">No subjects yet</span>
                <span className="text-xs">
                  Click “Add Subject” to get started
                </span>
              </div>
            </td>
          </tr>
        ) : (
          semSubjects.map((subject, index) => {
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
                } text-xs`}
              >
                <td className="px-4 py-1.5 font-semibold text-blue-600 w-[10%]">
                  {subject.courseCode}
                </td>

                <td className="px-4 py-1.5 text-gray-700 w-[30%]">
                  {subject.courseTitle}
                </td>

                <td className="px-4 py-1.5 text-gray-600 w-[10%]">
                  {subject.units}
                </td>

                <td className="px-4 py-1.5 text-gray-600 text-xs w-[20%]">
                  {prerequisites.length > 0 ? prerequisites.join(', ') : 'None'}
                </td>

                <td className="px-4 py-1.5 w-[20%]">
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

                <td className="px-4 py-1.5 text-end w-[10%]">
                  <button
                    onClick={() => promptRemoveIrregularSubject(semester, subject)}
                    className="p-1 rounded-full cursor-pointer bg-gray-50 text-gray-600 hover:bg-gray-100 transition"
                  >
                    <Trash className="w-4 h-4" />
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
      { period: '1st semester', label: "Dean's lister", icon: 'calendar', eligible: calculateDeansListerEligibility(1, headerYear), badge: calculateDeansListerEligibility(1, headerYear) ? { text: 'Eligible', cls: 'bg-green-50 text-green-800', icon: 'check' } : { text: 'Not eligible', cls: 'bg-gray-100 text-gray-500', icon: 'minus' } },
      { period: '2nd semester', label: "Dean's lister", icon: 'calendar', eligible: calculateDeansListerEligibility(2, headerYear), badge: calculateDeansListerEligibility(2, headerYear) ? { text: 'Eligible', cls: 'bg-green-50 text-green-800', icon: 'check' } : { text: 'Not eligible', cls: 'bg-gray-100 text-gray-500', icon: 'minus' } },
      { period: 'Scholarship', label: 'Eligibility', icon: 'award', eligible: headerScholarshipEligibility.eligible, badge: headerScholarshipEligibility.eligible ? { text: `${headerScholarshipEligibility.percentage}%`, cls: 'bg-blue-50 text-blue-800', icon: 'percentage' } : { text: 'Not eligible', cls: 'bg-gray-100 text-gray-500', icon: 'minus' } },
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
       <div className="flex w-fit gap-12 border-b border-gray-200 mb-4">
  {[1, 2, 3, 4].map((year, idx) => (
    <button
      key={year}
      type="button"
      onClick={() => setCourseTab(idx)}
      className={` py-2 text-sm font-semibold transition cursor-pointer border-b-2 -mb-px
      
      ${
        courseTab === idx
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
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


        <div className="flex-1 flex flex-col">
          {semestersForCurrentYear.map((semester) => (
            <div key={semester} className="flex-1 flex flex-col mb-3">
              <div className="text-lg font-semibold text-blue-700 mb-2">
                {semester === 1 ? '1st' : semester === 2 ? '2nd' : 'Summer'} Semester
              </div>
             <div className="border border-gray-300 rounded-lg overflow-hidden">
  <table className="min-w-full text-sm">
    <thead className="bg-blue-500 text-white">
      <tr>
        <th className="px-4 py-1.5 w-[12%] text-left cursor-pointer" onClick={() => handleSort('courseCode')}>
           Code {sortBy === 'courseCode' && (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 inline-flex mb-1" /> : <ChevronDown className="w-4 h-4 inline-flex mb-1" />)}
        </th>
        <th className="px-4 py-1.5 w-[35%] text-left cursor-pointer" onClick={() => handleSort('courseTitle')}>
          Course Description {sortBy === 'courseTitle' && (sortOrder === 'asc' ? '↑' : '↓')}
        </th>
          <th className="px-4 py-1.5 w-[8%] text-center cursor-pointer" onClick={() => handleSort('units')}>
            Units {sortBy === 'units' && (sortOrder === 'asc' ? '↑' : '↓')}
        </th>
        <th className="px-4 py-1.5 w-[20%] text-left">Prerequisites</th>
        <th className="px-4 py-1.5 w-[10%] text-left">Grade</th>
      </tr>
    </thead>

    <tbody>
      {studentCourses
        .filter((course) => course.yearLevel === currentYear && course.semester === semester)
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
          <tr key={course.id} className="border-t border-gray-300 hover:bg-gray-50">
            <td className="px-4 py-1.5">
              <span className="font-semibold text-blue-700">{course.courseCode}</span>
            </td>
            <td className="px-4 py-1.5">
              <span>{course.courseTitle}</span>
            </td>
            <td className="px-4 py-1.5 text-center">{course.units}</td>
            <td className="px-4 py-1.5">
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
                <span className="text-gray-500">None</span>
              )}
            </td>

            <td className="px-4 py-1.5">
              <select
                className="border border-gray-300 rounded px-2 py-1 text-sm"
                value={editingGrades[course.courseCode] || ''}
                onChange={(e) => handleGradeChange(course.courseCode, e.target.value)}
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

      {studentCourses.filter((c) => c.yearLevel === currentYear && c.semester === semester).length === 0 && (
        <tr>
          <td colSpan={5} className="text-center text-gray-500 py-4">
            No courses in Year {currentYear}, {semester === 1 ? '1st' : semester === 2 ? '2nd' : 'Summer'} Semester
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>

            </div>
          ))}
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

      {error && <div className="mb-2 rounded border border-red-200 bg-red-50 text-red-800 px-4 py-2">{error}</div>}
      {success && <div className="mb-2 rounded border border-green-200 bg-green-50 text-green-800 px-4 py-2">{success}</div>}

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
          <div className="relative z-10 w-full max-w-lg border border-gray-300 bg-white rounded-2xl shadow p-8">
            <div className="text-xl font-semibold mb-4">Edit Student</div>
           
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Student Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm"
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
                  className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm"
                  placeholder="Last Name, First Name, Middle Name"
                  value={editingData.name}
                  onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm"
                  placeholder="name@example.com"
                  value={editingData.email || ''}
                  onChange={(e) => setEditingData({ ...editingData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Contact Number</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm"
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
                <select
                  className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm"
                  value={editingData.yearLevel}
                  onChange={(e) => setEditingData({ ...editingData, yearLevel: parseInt(e.target.value, 10) })}
                >
                  {[1, 2, 3, 4].map((year) => (
                    <option key={year} value={year}>
                      {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year
                    </option>
                  ))}
                </select>
              </div>

              {!editingData.isIrregular && (
                <div className='w-1/3'>
                  <label className="block text-sm text-gray-600 mb-1">Block</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm"
                    value={editingData.block || ''}
                    required
                    onChange={(e) => setEditingData({ ...editingData, block: e.target.value })}
                  >
                    <option value="" disabled>-- choose block --</option>
                    {['A','B','C','D','E'].map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              )}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Curriculum</label>
                <select
                  className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm"
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

              
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={editingData.isIrregular}
                  onChange={(e) => setEditingData({ ...editingData, isIrregular: e.target.checked, block: e.target.checked ? '' : editingData.block || '' })}
                />
                <label className="text-sm text-gray-700">Irregular student</label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveEdit(editingData.id)}
                disabled={loading || !editingData.name}
                className="px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Student Modal */}
      {studentDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setStudentDialogOpen(false)}></div>
          <div className="relative z-10 w-full max-w-lg border border-gray-300 bg-white rounded-2xl shadow p-8">
            <div className="text-xl font-semibold mb-4">{studentForm.isIrregular ? 'Add New Irregular Student' : 'Add New Student'}</div>
           
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Student Number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm "
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
                  className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm "
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
                className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm "
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
                  className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm "
                  placeholder="name@example.com"
                  value={studentForm.email || ''}
                  onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                />
              </div>
             <div className='flex items-center gap-4'>
               <div className={studentForm.isIrregular ? 'w-full' : 'w-2/3'}>
  <label className="block text-sm text-gray-600 mb-1">Year Level</label>
  <select
    className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm"
    value={studentForm.yearLevel || ""}
    required
    onChange={(e) => {
      setStudentForm({
        ...studentForm,
        yearLevel: e.target.value ? parseInt(e.target.value, 10) : ""
      });
      setStudentFormYearError('');
    }}
  >
    <option value="" disabled>
      Select Year Level
    </option>

    {[1, 2, 3, 4].map((year) => (
      <option key={year} value={year}>
        {year === 1
          ? "1st Year"
          : year === 2
          ? "2nd Year"
          : year === 3
          ? "3rd Year"
          : "4th Year"}
      </option>
    ))}
  </select>
  {studentFormYearError && <div className="text-sm text-red-600 mt-2">{studentFormYearError}</div>}
</div>


            {!studentForm.isIrregular && (
              <div className='w-1/3'>
                <label className="block text-sm text-gray-600 mb-1">Block</label>
                <select
                  className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm"
                  value={studentForm.block || ''}
                  required
                  onChange={(e) => setStudentForm({ ...studentForm, block: e.target.value })}
                >
                  <option value="" disabled>-- choose block --</option>
                  {['A','B','C','D','E'].map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}

             </div>
<div>
  <label className="block text-sm text-gray-600 mb-1">Curriculum</label>
  <select
    className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm"
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
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                    studentForm.enrolled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
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
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setStudentDialogOpen(false)}
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStudent}
                disabled={loading || !studentForm.name}
                className="px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Add Student
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setDeleteDialogOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-2xl shadow p-8">
            <div className="text-xl font-semibold mb-4">Confirm Delete</div>
            <div className="text-gray-700 mb-8">
              Are you sure you want to delete this student? This action cannot be undone.
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setStudentToDelete(null);
                }}
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={loading}
                className="px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {irregularDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setIrregularDeleteDialogOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-2xl shadow p-8">
            <div className="text-xl font-semibold mb-4">Remove Subject</div>
            <div className="text-gray-700 m text-justify text-sm">
              Are you sure you want to remove this subject to <span className='font-semibold'>{selectedStudent.name}</span>? This action cannot be undone.
              {irregularSubjectToDelete && (
                <div className="mt-4 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <div className="font-semibold text-blue-700">{irregularSubjectToDelete.courseCode}</div>
                  <div>{irregularSubjectToDelete.courseTitle}</div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-10">
              <button
                onClick={() => {
                  setIrregularDeleteDialogOpen(false);
                  setIrregularSubjectToDelete(null);
                }}
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmIrregularDelete}
                disabled={loading}
                className="px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {subjectPickerOpen && selectedStudent?.isIrregular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setSubjectPickerOpen(false)}></div>
          <div className="relative z-10 w-full max-w-5xl border border-gray-300 bg-white rounded-2xl shadow p-4 md:p-6 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-blue-700">Add Irregular Subject</h3>
               <p className="text-sm text-gray-600">
                    Showing all subjects from all curriculums. Sort by curriculum, year level, or semester.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubjectPickerOpen(false)}
                className="p-1 rounded-full cursor-pointer bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-red-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 mb-4">
              <div className='flex items-center gap-2'>
                <div className='flex items-center gap-2'>
                  <Funnel className="w-4 h-4 text-gray-500" />

                <select
                  value={subjectPickerYearFilter}
                  onChange={(e) => setSubjectPickerYearFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="all">All Year Levels</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>

              <div>
                <select
                  value={subjectPickerSemesterFilter}
                  onChange={(e) => setSubjectPickerSemesterFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="all">All Semesters</option>
                  <option value="1">1st Semester</option>
                  <option value="2">2nd Semester</option>
                  <option value="3">Summer</option>
                </select>
              </div>
                <div className="flex items-center gap-2">
                <select
                  value={subjectPickerCurriculumFilter}
                  onChange={(e) => setSubjectPickerCurriculumFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="all">All Curriculum</option>
                  {curriculums.map((curriculum) => (
                    <option key={curriculum.id} value={curriculum.id}>{curriculum.name}</option>
                  ))}
                </select>
              </div>
              </div>

            

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={subjectPickerSearch}
                  onChange={(e) => setSubjectPickerSearch(e.target.value)}
                  placeholder="Search code, description, curriculum, or classification"
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-[55vh] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-blue-50 text-blue-800 sticky top-0">
                    <tr>
                      <th
                        className="px-2 py-2 text-left cursor-pointer select-none"
                        onClick={() => {
                          if (subjectPickerSortBy === 'curriculum') {
                            setSubjectPickerSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setSubjectPickerSortBy('curriculum');
                            setSubjectPickerSortOrder('asc');
                          }
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          Curriculum
                          {subjectPickerSortBy === 'curriculum' && subjectPickerSortOrder === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : subjectPickerSortBy === 'curriculum' ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronsUpDown className="w-3.5 h-3.5" />
                          )}
                        </span>
                      </th>
                      
                    
                      <th
                        className="px-2 py-2 text-left cursor-pointer select-none"
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
                          Subject Code
                          {subjectPickerSortBy === 'courseCode' && subjectPickerSortOrder === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : subjectPickerSortBy === 'courseCode' ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronsUpDown className="w-3.5 h-3.5" />
                          )}
                        </span>
                      </th>
                      <th
                        className="px-2 py-2 text-left cursor-pointer select-none"
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
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : subjectPickerSortBy === 'courseTitle' ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronsUpDown className="w-3.5 h-3.5" />
                          )}
                        </span>
                      </th>
                      <th
                        className="px-2 py-2 text-left cursor-pointer select-none"
                        onClick={() => {
                          if (subjectPickerSortBy === 'units') {
                            setSubjectPickerSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                          } else {
                            setSubjectPickerSortBy('units');
                            setSubjectPickerSortOrder('asc');
                          }
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          Units
                          {subjectPickerSortBy === 'units' && subjectPickerSortOrder === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : subjectPickerSortBy === 'units' ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronsUpDown className="w-3.5 h-3.5" />
                          )}
                        </span>
                      </th>
                      <th className="px-2 py-2 text-left">Major</th>
                      <th className="px-2 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getIrregularSubjectCandidates().length === 0 ? (
                      <tr>
                        <td className="px-2 py-4 text-gray-500" colSpan={6}>No offered subjects found for this filter.</td>
                      </tr>
                    ) : (
                      getIrregularSubjectCandidates().map((course) => {
                        const semKey = `sem${subjectPickerSemester}`;
                        const alreadyAdded = (irregularSubjects[semKey] || []).some(
                          (subject) =>
                            (subject.courseCode || '').toString().trim().toUpperCase() === (course.courseCode || '').toString().trim().toUpperCase() &&
                            Number(subject.yearLevel || (courseTab + 1)) === (courseTab + 1)
                        );
                        return (
                          <tr key={course.id} className="border-t border-gray-200">
                            <td className="px-2 py-2">{getCurriculumName(course.curriculumId) || 'Unknown Curriculum'}</td>
                            <td className="px-2 py-2 font-semibold text-blue-700">{course.courseCode}</td>
                            <td className="px-2 py-2">{course.courseTitle}</td>
                            <td className="px-2 py-2">{course.units}</td>
                            <td className="px-2 py-2">
                              {course.isMajor ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-xs border bg-blue-50 border-blue-200 text-blue-700">
                                  Major
                                </span>
                              ) : (
                                 <span className="inline-block px-2 py-0.5 rounded-full text-xs border bg-yellow-50 border-yellow-200 text-yellow-700">
                                  Minor
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              {alreadyAdded ? (
                                <span className="w-15  text-center inline-block cursor-not-allowed px-2 py-1 rounded text-xs bg-gray-100 text-gray-600 border border-gray-200">
                                  Added
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAddIrregularSubject(subjectPickerSemester, course)}
                                  className="w-15 text-center px-2 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700"
                                >
                                  Add
                                </button>
                              )}
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
