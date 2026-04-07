import { useState, useEffect, useCallback } from 'react';
import { createCurriculum, getCurriculums, addCourse, getCoursesByCurriculum, getAllCourses } from '../../models/curriculumModels';
import { useAuth } from '../../contexts/AuthContext';
import { doc, deleteDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { FileText } from 'lucide-react';
import CurriculumPreview from './CurriculumPReview';
import { X, ChevronUp, ChevronDown, ChevronsUpDown, Pencil, Trash, Printer, BadgePlus, Check , Search, ArrowBigLeft } from 'lucide-react';

const CurriculumMaker = ({ onBack, initialCurriculumId }) => {
  const { currentUser, isOnline } = useAuth();
  const [curriculums, setCurriculums] = useState([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Curriculum form state
  const [curriculumForm, setCurriculumForm] = useState({
    name: '',
    description: '',
    yearLevels: [1, 2, 3, 4]
  });
  
  // Course form state
  const [courseForm, setCourseForm] = useState({
    courseCode: '',
    courseTitle: '',
    units: '',
    prerequisites: [],
    isAvailable: true,
    equivalentSubjectId: ''
  });
  
  // Dialog states
  const [curriculumDialogOpen, setCurriculumDialogOpen] = useState(false);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(1);
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [tabValue, setTabValue] = useState(0);

  // Menu and modal states
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedCurriculumForMenu, setSelectedCurriculumForMenu] = useState(null);
  const [editCurriculumDialogOpen, setEditCurriculumDialogOpen] = useState(false);
  const [deleteCurriculumDialogOpen, setDeleteCurriculumDialogOpen] = useState(false);
  const [editingCurriculumData, setEditingCurriculumData] = useState({ name: '', description: '', yearLevels: [1, 2, 3, 4] });
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [pdfOpen, setPdfOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCurriculumId, setPreviewCurriculumId] = useState(null);
  // Render a print-only preview element (hidden on screen, visible only during printing)
  const [printOnlyOpen, setPrintOnlyOpen] = useState(false);
  // Sorting state
  const [sortField, setSortField] = useState('courseCode');
  const [sortDirection, setSortDirection] = useState('asc');
  // Per-semester table filters (1,2,3)
  const [tableFilters, setTableFilters] = useState({ 1: '', 2: '', 3: '' });
  const handleFilterChange = (semester, value) => setTableFilters(prev => ({ ...prev, [semester]: value }));
  const getTotalUnitsByYearAndSemester = (year, semester) => {
    const list = getCoursesByYearAndSemester(year, semester);
    return list.reduce((sum, c) => sum + (parseFloat(c.units ?? 0) || 0), 0);
  };

  // Editing states
  const [editingCourse, setEditingCourse] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [editingEquivalents, setEditingEquivalents] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [newCourseData, setNewCourseData] = useState({
    1: { courseCode: '', courseTitle: '', units: '', prerequisites: [], isAvailable: true },
    2: { courseCode: '', courseTitle: '', units: '', prerequisites: [], isAvailable: true },
    3: { courseCode: '', courseTitle: '', units: '', prerequisites: [], isAvailable: true }
  });

  // Prerequisite selection modal state
  const [prereqModalOpen, setPrereqModalOpen] = useState(false);
  const [prereqTarget, setPrereqTarget] = useState({ type: null, courseId: null, year: null, semester: null });
  const [tempSelectedPrereqs, setTempSelectedPrereqs] = useState([]);
  const [prereqViewYear, setPrereqViewYear] = useState(1);
  const [prereqSearchTerm, setPrereqSearchTerm] = useState('');

  // Equivalent selection modal state
  const [equivModalOpen, setEquivModalOpen] = useState(false);
  const [equivTarget, setEquivTarget] = useState({ type: null, courseId: null, year: null, semester: null });
  const [tempSelectedEquivs, setTempSelectedEquivs] = useState([]);
  const [equivSelectedCurriculumId, setEquivSelectedCurriculumId] = useState(null);
  const [equivSearchTerm, setEquivSearchTerm] = useState('');
  // Equivalents modal sorting state
  const [equivSortField, setEquivSortField] = useState('courseCode');
  const [equivSortDirection, setEquivSortDirection] = useState('asc');

  // Equivalent subject selection state
  const [selectedEquivalent, setSelectedEquivalent] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const loadCurriculums = useCallback(async () => {
    if (!currentUser) {
      setError('Please sign in to access curriculum data');
      return;
    }
    
    setLoading(true);
    setError('');
    const result = await getCurriculums(isOnline);
    if (result.success) {
      setCurriculums(result.data);
      if (result.offline) {
        console.log('Loaded curricula from offline storage');
      }
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [currentUser, isOnline]);

  const loadCourses = useCallback(async (curriculumId) => {
    if (!currentUser) {
      setError('Please sign in to access course data');
      return;
    }
    
    setLoading(true);
    setError('');
    const result = await getCoursesByCurriculum(curriculumId, isOnline);
    if (result.success) {
      setCourses(result.data);
      if (result.offline) {
        console.log('Loaded courses from offline storage');
      }
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [currentUser, isOnline]);

  const loadAllCourses = useCallback(async () => {
    const result = await getAllCourses();
    if (result.success) setAllCourses(result.data);
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadCurriculums();
      loadAllCourses();
    }
  }, [currentUser, loadCurriculums, loadAllCourses]);

  useEffect(() => {
    if (initialCurriculumId && curriculums && curriculums.length > 0) {
      const found = curriculums.find((c) => c.id === initialCurriculumId);
      if (found) setSelectedCurriculum(found);
    }
  }, [initialCurriculumId, curriculums]);

  useEffect(() => {
    if (selectedCurriculum && currentUser) {
      loadCourses(selectedCurriculum.id);
    }
  }, [selectedCurriculum, currentUser, loadCourses]);

  useEffect(() => {
    setSelectedYear(tabValue + 1);
  }, [tabValue]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    const getCurrentScrollTop = () => {
      const rootElement = document.getElementById('root');
      const mainElement = document.querySelector('main');

      return Math.max(
        window.scrollY || 0,
        window.pageYOffset || 0,
        document.documentElement?.scrollTop || 0,
        document.body?.scrollTop || 0,
        rootElement?.scrollTop || 0,
        mainElement?.scrollTop || 0
      );
    };

    const handleScroll = () => {
      setShowScrollTop(getCurrentScrollTop() > 180);
    };

    const rootElement = document.getElementById('root');
    const mainElement = document.querySelector('main');

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });

    if (rootElement) {
      rootElement.addEventListener('scroll', handleScroll, { passive: true });
    }

    if (mainElement) {
      mainElement.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
      if (rootElement) {
        rootElement.removeEventListener('scroll', handleScroll);
      }
      if (mainElement) {
        mainElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Auto-hide snackbar to mimic previous MUI behavior
  useEffect(() => {
    if (snackbarOpen) {
      const t = setTimeout(() => setSnackbarOpen(false), 6000);
      return () => clearTimeout(t);
    }
  }, [snackbarOpen]);

  // When printOnlyOpen becomes true, wait briefly for the preview to render then trigger print
  useEffect(() => {
    if (!printOnlyOpen) return;
    const timer = setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        console.error('Print failed', e);
      }
      // close the print-only preview after print dialog
      setPrintOnlyOpen(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [printOnlyOpen]);

  // Helper function to show snackbar messages
  const showMessage = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleScrollToTop = () => {
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

    const mainElement = document.querySelector('main');
    if (mainElement && typeof mainElement.scrollTo === 'function') {
      mainElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Menu handlers
  const handleMenuOpen = (event, curriculum) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedCurriculumForMenu(curriculum);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedCurriculumForMenu(null);
  };

  const handleEditCurriculum = () => {
    setEditingCurriculumData({
      name: selectedCurriculumForMenu.name,
      description: selectedCurriculumForMenu.description,
      yearLevels: selectedCurriculumForMenu.yearLevels
    });
    setEditCurriculumDialogOpen(true);
    setMenuAnchorEl(null); // Only close the menu, don't clear selectedCurriculumForMenu
  };

  const handleDeleteCurriculumClick = () => {
    setDeleteCurriculumDialogOpen(true);
    setMenuAnchorEl(null); // Only close the menu, don't clear selectedCurriculumForMenu
  };

  const handleUpdateCurriculum = async () => {
    if (!currentUser) {
      showMessage('Please sign in to update curriculum', 'error');
      return;
    }
    if (!selectedCurriculumForMenu) {
      showMessage('No curriculum selected for update', 'error');
      return;
    }
    setLoading(true);
    try {
      const curriculumRef = doc(db, 'curriculums', selectedCurriculumForMenu.id);
      await updateDoc(curriculumRef, {
        ...editingCurriculumData,
        updatedAt: new Date()
      });
      
      showMessage('Curriculum updated successfully!');
      setEditCurriculumDialogOpen(false);
      // Clear the menu state after successful update
      setSelectedCurriculumForMenu(null);
      await loadCurriculums();
    } catch (error) {
      showMessage('Failed to update curriculum: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteCurriculum = async () => {
    if (!currentUser) {
      showMessage('Please sign in to delete a curriculum', 'error');
      return;
    }
    if (!selectedCurriculumForMenu) {
      showMessage('No curriculum selected for deletion', 'error');
      return;
    }
    setLoading(true);
    try {
      // Delete all courses associated with this curriculum first
      const coursesToDelete = courses.filter(course => course.curriculumId === selectedCurriculumForMenu.id);
      const batch = writeBatch(db);
      
      coursesToDelete.forEach(course => {
        const courseRef = doc(db, 'courses', course.id);
        batch.delete(courseRef);
      });
      
      // Delete the curriculum
      const curriculumRef = doc(db, 'curriculums', selectedCurriculumForMenu.id);
      batch.delete(curriculumRef);
      
      await batch.commit();
      showMessage('Curriculum and all associated courses deleted successfully!');
      
      // Clear selected curriculum if it was the one deleted
      if (selectedCurriculum?.id === selectedCurriculumForMenu.id) {
        setSelectedCurriculum(null);
      }
      
      setDeleteCurriculumDialogOpen(false);
      // Clear the menu state after successful deletion
      setSelectedCurriculumForMenu(null);
      await loadCurriculums();
      await loadAllCourses(); // Reload all courses since some may have been deleted
    } catch (error) {
      showMessage('Failed to delete curriculum: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCurriculum = async () => {
    if (!currentUser) {
      showMessage('Please sign in to create a curriculum', 'error');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await createCurriculum(curriculumForm);
      if (result.success) {
        showMessage('Curriculum created successfully!');
        setCurriculumForm({ name: '', description: '', yearLevels: [1, 2, 3, 4] });
        setCurriculumDialogOpen(false);
        await loadCurriculums();
      } else {
        showMessage(result.error, 'error');
      }
    } catch (error) {
      showMessage('Failed to create curriculum: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCourse = async () => {
    if (!currentUser) {
      showMessage('Please sign in to add a course', 'error');
      return;
    }
    if (!selectedCurriculum) {
      showMessage('Please select a curriculum first', 'error');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // If equivalentSubjectId is not set but equivalents are selected, generate a new id
      let eqId = courseForm.equivalentSubjectId;
      if (!eqId && selectedEquivalent && selectedEquivalent.length > 0) {
        eqId = 'EQ_' + Math.random().toString(36).substr(2, 9);
      }
      const result = await addCourse(
        selectedCurriculum.id,
        selectedYear,
        selectedSemester,
        { ...courseForm, equivalentSubjectId: eqId }
      );
      if (result.success) {
        showMessage('Course added successfully!');
        setCourseForm({ courseCode: '', courseTitle: '', units: '', prerequisites: [], isAvailable: true, equivalentSubjectId: '' });
        setSelectedEquivalent([]);
        setCourseDialogOpen(false);
        await loadCourses(selectedCurriculum.id);
      } else {
        showMessage(result.error, 'error');
      }
    } catch (error) {
      showMessage('Failed to add course: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditCourse = (course) => {
    setEditingCourse(course.id);
    setEditingData({
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
      units: course.units,
      prerequisites: course.prerequisites,
      isAvailable: course.isAvailable !== undefined ? course.isAvailable : true,
      equivalentSubjectId: course.equivalentSubjectId || ''
    });
    // Set the current equivalents for editing
    const currentEquivalents = allCourses.filter(c => 
      c.equivalentSubjectId && 
      c.equivalentSubjectId === course.equivalentSubjectId && 
      c.id !== course.id
    );
    setEditingEquivalents(currentEquivalents.map(eq => eq.courseCode));
    setHasChanges(false);
  };

  // Open prerequisites modal for editing an existing course
  const openPrereqModalForEditing = (course) => {
    setPrereqTarget({ type: 'editing', courseId: course.id, year: course.yearLevel, semester: course.semester });
    // If we are currently editing this course we should prefer the in-memory editingData so changes persist
    if (editingCourse === course.id && editingData && Array.isArray(editingData.prerequisites)) {
      setTempSelectedPrereqs(editingData.prerequisites || []);
    } else {
      setTempSelectedPrereqs(course.prerequisites || []);
    }
    setPrereqViewYear(1);
    setPrereqSearchTerm('');
    setPrereqModalOpen(true);
  };

  // Open prerequisites modal for the new-course row (table)
  const openPrereqModalForNewCourse = (year, semester) => {
    setPrereqTarget({ type: 'new', courseId: null, year, semester });
    setTempSelectedPrereqs(newCourseData[semester]?.prerequisites || []);
    setPrereqViewYear(1);
    setPrereqSearchTerm('');
    setPrereqModalOpen(true);
  };

  // Open prerequisites modal for the Add Course form modal
  const openPrereqModalForForm = () => {
    setPrereqTarget({ type: 'form', courseId: null, year: selectedYear, semester: selectedSemester });
    setTempSelectedPrereqs(courseForm.prerequisites || []);
    setPrereqViewYear(1);
    setPrereqSearchTerm('');
    setPrereqModalOpen(true);
  };

  const savePrereqsFromModal = () => {
    if (prereqTarget.type === 'editing') {
      setEditingData(prev => ({ ...prev, prerequisites: tempSelectedPrereqs }));
      setHasChanges(true);
    } else if (prereqTarget.type === 'new') {
      setNewCourseData(prev => ({
        ...prev,
        [prereqTarget.semester]: {
          ...(prev[prereqTarget.semester] || {}),
          prerequisites: tempSelectedPrereqs
        }
      }));
    } else if (prereqTarget.type === 'form') {
      setCourseForm(prev => ({ ...prev, prerequisites: tempSelectedPrereqs }));
    }
    setPrereqModalOpen(false);
  };

  // Equivalent modals
  const openEquivModalForEditing = (course) => {
    setEquivTarget({ type: 'editing', courseId: course.id, year: course.yearLevel, semester: course.semester });
    setTempSelectedEquivs(editingEquivalents || []);
    // prefer the course's curriculum or current selected curriculum
    setEquivSelectedCurriculumId(course.curriculumId || selectedCurriculum?.id || null);
    setEquivSearchTerm('');
    setEquivModalOpen(true);
  };

  const openEquivModalForNewCourse = (semester) => {
    setEquivTarget({ type: 'new', courseId: null, year: selectedYear, semester });
    setTempSelectedEquivs(selectedEquivalent || []);
    setEquivSelectedCurriculumId(selectedCurriculum?.id || null);
    setEquivSearchTerm('');
    setEquivModalOpen(true);
  };

  const saveEquivsFromModal = () => {
    if (equivTarget.type === 'editing') {
      setEditingEquivalents(tempSelectedEquivs);
      // ensure editingData has an equivalentSubjectId
      const eqId = editingData.equivalentSubjectId || (tempSelectedEquivs.length > 0 ? 'EQ_' + Math.random().toString(36).substr(2, 9) : '');
      setEditingData(prev => ({ ...prev, equivalentSubjectId: eqId }));
      setHasChanges(true);
    } else if (equivTarget.type === 'new') {
      setSelectedEquivalent(tempSelectedEquivs);
    }
    setEquivModalOpen(false);
  };

  const handleCancelEdit = () => {
    setEditingCourse(null);
    setEditingData({});
    setEditingEquivalents([]);
    setHasChanges(false);
  };

  const handleSaveCourse = async () => {
    if (!currentUser) {
      showMessage('Please sign in to save changes', 'error');
      return;
    }
    if (!editingCourse || !hasChanges) return;
    setLoading(true);
    setError('');
    try {
      const batch = writeBatch(db);
      
      // Update the main course
      const courseRef = doc(db, 'courses', editingCourse);
      batch.update(courseRef, {
        ...editingData,
        updatedAt: new Date()
      });
      
      // Update equivalent subjects if any are selected
      if (editingEquivalents.length > 0) {
        const selectedEquivalentCourses = allCourses.filter(c => 
          editingEquivalents.includes(c.courseCode) && c.id !== editingCourse
        );
        
        // Update all selected equivalent courses to have the same equivalentSubjectId
        selectedEquivalentCourses.forEach(equivalentCourse => {
          const equivalentRef = doc(db, 'courses', equivalentCourse.id);
          batch.update(equivalentRef, {
            equivalentSubjectId: editingData.equivalentSubjectId,
            updatedAt: new Date()
          });
        });
      }
      
      await batch.commit();
      showMessage('Course updated successfully!');
      setEditingCourse(null);
      setEditingData({});
      setEditingEquivalents([]);
      setHasChanges(false);
      await loadCourses(selectedCurriculum.id);
      await loadAllCourses(); // Reload all courses to update the equivalents display
    } catch (error) {
      showMessage('Failed to update course: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!currentUser) {
      showMessage('Please sign in to delete a course', 'error');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this course?')) return;
    setLoading(true);
    setError('');
    try {
      await deleteDoc(doc(db, 'courses', courseId));
      showMessage('Course deleted successfully!');
      await loadCourses(selectedCurriculum.id);
    } catch (error) {
      showMessage('Failed to delete course: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditingData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleNewCourseInputChange = (field, value, semester) => {
    setNewCourseData(prev => ({
      ...prev,
      [semester]: {
        ...(prev[semester] || { courseCode: '', courseTitle: '', units: '', prerequisites: [], isAvailable: true }),
        [field]: value
      }
    }));
  };

  const handleAddNewCourse = async (semester) => {
    if (!currentUser) {
      showMessage('Please sign in to add a course', 'error');
      return;
    }
    if (!selectedCurriculum) {
      showMessage('Please select a curriculum first', 'error');
      return;
    }
    if (!newCourseData[semester]?.courseCode || !newCourseData[semester]?.courseTitle || !newCourseData[semester]?.units) {
      showMessage('Please fill in all required fields (Course Code, Title, and Units)', 'error');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await addCourse(
        selectedCurriculum.id,
        selectedYear,
        semester,
        newCourseData[semester]
      );
      if (result.success) {
        showMessage('Course added successfully!');
        setNewCourseData(prev => ({
          ...prev,
          [semester]: { courseCode: '', courseTitle: '', units: '', prerequisites: [], isAvailable: true }
        }));
        await loadCourses(selectedCurriculum.id);
      } else {
        showMessage(result.error, 'error');
      }
    } catch (error) {
      showMessage('Failed to add course: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getCoursesByYearAndSemester = (year, semester) => {
    return courses.filter(course => course.yearLevel === year && course.semester === semester);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedCoursesByYearAndSemester = (year, semester) => {
    const list = [...getCoursesByYearAndSemester(year, semester)];
    const dir = sortDirection === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      let aVal;
      let bVal;
      if (sortField === 'units') {
        aVal = parseFloat(a.units ?? 0) || 0;
        bVal = parseFloat(b.units ?? 0) || 0;
        return (aVal - bVal) * dir;
      }
      if (sortField === 'courseTitle') {
        aVal = (a.courseTitle ?? '').toString().toLowerCase();
        bVal = (b.courseTitle ?? '').toString().toLowerCase();
      } else {
        // Default to courseCode
        aVal = (a.courseCode ?? '').toString().toLowerCase();
        bVal = (b.courseCode ?? '').toString().toLowerCase();
      }
      const cmp = aVal.localeCompare(bVal);
      return cmp * dir;
    });
  };

  const getAllCourseCodes = () => {
    if (!selectedCurriculum) return [];
    return courses.map(course => course.courseCode).filter(Boolean);
  };

  // Return true if every course in given year+semester is available
  const areAllAvailable = (year, semester) => {
    const list = getCoursesByYearAndSemester(year, semester);
    if (!list || list.length === 0) return false;
    return list.every(c => c.isAvailable !== false);
  };

  // Toggle availability for all courses in a specific year+semester (batch update)
  const handleSelectAllAvailable = async (year, semester, checked) => {
    if (!currentUser) {
      showMessage('Please sign in to update availability', 'error');
      return;
    }
    if (!selectedCurriculum) {
      showMessage('Please select a curriculum first', 'error');
      return;
    }
    const list = getCoursesByYearAndSemester(year, semester);
    if (!list || list.length === 0) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      list.forEach(course => {
        const courseRef = doc(db, 'courses', course.id);
        batch.update(courseRef, { isAvailable: checked, updatedAt: new Date() });
      });
      await batch.commit();
      showMessage(`Courses ${checked ? 'marked available' : 'marked unavailable'} for this semester.`);
      await loadCourses(selectedCurriculum.id);
      await loadAllCourses();
    } catch (error) {
      showMessage('Failed to update availability: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderCurriculumList = () => (
    <div className="max-w-7xl mx-auto">
      <div className=" bg-white text-black p-6 rounded-2xl mb-10 flex items-center justify-between border border-gray-300 shadow-lg">
        <div className="flex items-center gap-6">
          <button
            onClick={onBack}
            aria-label="Back to dashboard"
            title="Back to dashboard"
            className="group cursor-pointer flex items-center gap-2 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white transition-transform"
          >
            <ArrowBigLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>
            <div className="flex flex-col ">
              <h2 className="text-2xl font-bold text-blue-600">
              Curriculum Maker</h2>
          <p className="text-gray-600">Select a curriculum to manage courses</p></div>         
        </div>
        <button
          onClick={() => setCurriculumDialogOpen(true)}
          className="inline-flex  cursor-pointer items-center text-sm gap-2 bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-offset-2 focus:ring-offset-white"
        >
          <BadgePlus className="w-4 h-4" />
          <span>Add  Curriculum</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {curriculums.map((curriculum) => (
          <div
            key={curriculum.id}
            onClick={() => setSelectedCurriculum(curriculum)}
            className={`relative px-4 py-8 rounded-2xl border transition shadow-sm cursor-pointer hover:shadow-lg hover:-translate-y-0.5 ${
              selectedCurriculum?.id === curriculum.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-400'
            }`}
          >
           
           <div className='flex items-start justify-between'>
             <div>
              <p
              className="text-xs font-medium text-gray-500  uppercase tracking-wide"
            >
              Curriculum
            </p>
            <h3 className="text-lg font-bold mb-6 pr-8">{curriculum.name}</h3>
             </div>
             <div className='flex items-start gap-1'>
                <button
              className="p-1.5 rounded-full text-gray-700  hover:bg-gray-300 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setSelectedCurriculumForMenu(curriculum); handleEditCurriculum(); }}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
              className="p-1.5 rounded-full text-gray-700  hover:bg-gray-300 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setSelectedCurriculumForMenu(curriculum); handleDeleteCurriculumClick(); }}
                >
                  <Trash className="w-4 h-4" />
                </button>
             </div>
           </div>

            <div className="flex flex-wrap gap-2">
              {curriculum.yearLevels.map((year) => (
                <span
                  key={year}
                  className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs"
                >
                  Year {year}
                </span>
              ))}
            </div>
           
          </div>
        ))}
      </div>

      {curriculums.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-600 text-lg font-medium mb-1">No curriculums yet</div>
          <div className="text-gray-500 mb-4">Create your first curriculum to get started</div>
          <button
            onClick={() => setCurriculumDialogOpen(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <i className="bi bi-plus-lg"></i>
            <span>Create First Curriculum</span>
          </button>
        </div>
      )}

      {/* Print-only preview (hidden on screen, visible only when printing) */}
      {/* print-only preview moved to global scope so printing works from any view */}
      
    </div>
  );

  const renderCourseTables = () => {
    if (!selectedCurriculum) return null;

    const yearLabels = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
    const semLabel = (s) => (s === 1 ? '1st' : s === 2 ? '2nd' : 'Summer');

    return (
      <div>
    

      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        {[1, 2, 3, 4].map((year, idx) => (
          <button
            key={year}
            onClick={() => { setTabValue(idx); setSelectedYear(year); }}
                className={`px-3 py-1  rounded-full shadow-md border transition-all flex items-center gap-1 text-sm cursor-pointer 
                      ${tabValue === idx 
                        ? 'bg-blue-600 text-white border-blue-700 scale-105'
                        : 'bg-white text-blue-700 hover:bg-blue-100 border-gray-300'
                      }`}
          >
            {yearLabels[idx]}
          </button>
        ))}

        <button
          onClick={() => { setTabValue(4); setSelectedYear('irregular'); }}
          className={`px-3 py-1 rounded-full shadow-md border transition-all flex items-center gap-1 text-sm cursor-pointer 
                      ${tabValue === 4 
                        ? 'bg-blue-600 text-white border-blue-700 scale-105'
                    : 'bg-white text-blue-700 hover:bg-blue-100 border-gray-300'
                      }`}
        >
          Irregular Students
        </button>
      </div>

      <div>
          {([1, 2, selectedYear === 3 ? 3 : null].filter(Boolean)).map((semester) => (
            <div key={semester} className="mt-4 mb-8">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-blue-700">{semLabel(semester)} Semester</h3>
                <div className="relative w-full max-w-xs">
                  <input
                    className="w-full px-3 py-1.5 text-sm rounded-full border border-gray-300 focus:ring-2 focus:ring-blue-200 focus:border-blue-400 "
                    placeholder="Search code or title"
                    value={tableFilters[semester] || ''}
                    onChange={(e) => handleFilterChange(semester, e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="sticky top-0 z-10 bg-blue-700 text-white">
                       <th className="p-2 w-[15%] text-left" aria-sort={sortField === 'courseCode' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button 
                          title="Sort by Course Code" 
                          onClick={() => handleSort('courseCode')} 
                          className="inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Course Code</span>
                          {sortField === 'courseCode' ? (
                            <ChevronUp className={`w-4 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
                          ) : (
                            <ChevronsUpDown className="w-4 opacity-80" />
                          )}
                        </button>
                      </th>
                      <th className="p-2 w-[35%] text-left" aria-sort={sortField === 'courseTitle' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button title="Sort by Course Title" onClick={() => handleSort('courseTitle')} className="inline-flex items-center gap-1">
                          <span>Course Title</span>
                          {sortField === 'courseTitle' ? (
                            <ChevronUp className={`w-4 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
                          ) : (
                            <ChevronsUpDown className="w-4 opacity-80" />
                          )}
                        </button>
                      </th>
                      <th className="p-2 w-[5%] text-left" aria-sort={sortField === 'units' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button title="Sort by Units" onClick={() => handleSort('units')} className="inline-flex items-center gap-1">
                          <span>Units</span>
                          {sortField === 'units' ? (
                            <ChevronUp className={`w-4 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
                          ) : (
                            <ChevronsUpDown className="w-4 opacity-80" />
                          )}
                        </button>
                      </th>
                      <th className="p-2 w-[20%] text-left">Prerequisites</th>
                      <th className="p-2 w-[20%] text-left">Equivalent Subjects</th>
                      <th className="p-2 w-[10%] text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">Major</span>
                        </div>
                      </th>
                      <th className="p-2 w-[15%] text-left">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={areAllAvailable(selectedYear, semester)}
                            onChange={(e) => handleSelectAllAvailable(selectedYear, semester, e.target.checked)}
                            className="h-4 w-4 accent-blue-600"
                          />
                          <span className="font-semibold text-white text-sm">Available</span>
                        </div>
                      </th>
                      <th className="p-2 w-[15%] text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const list = getSortedCoursesByYearAndSemester(selectedYear, semester);
                      const q = (tableFilters[semester] || '').toLowerCase().trim();
                      const filtered = q
                        ? list.filter((c) =>
                            (c.courseCode || '').toLowerCase().includes(q) ||
                            (c.courseTitle || '').toLowerCase().includes(q)
                          )
                        : list;
                      return filtered.map((course) => {
                      const isEditing = editingCourse === course.id;
                      const data = isEditing ? editingData : course;
                      const equivalents = allCourses.filter(
                        (c) => c.equivalentSubjectId && c.equivalentSubjectId === data.equivalentSubjectId && c.id !== course.id
                      );

                      return (
                        <tr key={course.id} className={`${isEditing ? 'bg-amber-50' : 'hover:bg-gray-100'} odd:bg-white even:bg-gray-50 border-t border-gray-300`}> 
                          <td className="p-2 align-top">
                            {isEditing ? (
                              <input
                                className="w-28 border border-gray-300 rounded px-2 py-1"
                                value={data.courseCode}
                                onChange={(e) => handleInputChange('courseCode', e.target.value)}
                              />
                            ) : (
                              <span className="font-semibold text-blue-700">{course.courseCode}</span>
                            )}
                          </td>
                          <td className="p-2 align-top">
                            {isEditing ? (
                              <input
                                className="w-full border border-gray-300 rounded px-2 py-1"
                                value={data.courseTitle}
                                onChange={(e) => handleInputChange('courseTitle', e.target.value)}
                              />
                            ) : (
                              <span>{course.courseTitle}</span>
                            )}
                          </td>
                          <td className="p-2 align-top text-center">
                            {isEditing ? (
                              <input
                                type="number"
                                className="w-16 border border-gray-300 rounded px-2 py-1"
                                value={data.units}
                                onChange={(e) => handleInputChange('units', e.target.value)}
                              />
                            ) : (
                              <span className="font-medium text-gray-800">
                                {course.units}
                              </span>
                            )}
                          </td>
                          <td className="p-2 align-top">
                            {isEditing ? (
                              <div>
                                <button
                                  onClick={() => openPrereqModalForEditing(course)}
                                  className="p-1.5 rounded-full text-gray-700  hover:bg-gray-300 cursor-pointer"
                                >
                                  {(editingData.prerequisites || []).length > 0 ? (editingData.prerequisites || []).join(', ') : 'Select Prerequisites'}
                                </button>
                              </div>
                            ) : data.prerequisites.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {data.prerequisites.map((pr) => (
                                  <span key={pr} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-700">
                                    {pr}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-500">None</span>
                            )}
                          </td>
                          <td className="p-2 align-top">
                            {isEditing ? (
                              <div>
                                <button
                                  onClick={() => openEquivModalForEditing(course)}
                                  className="p-1.5 rounded-full text-gray-700  hover:bg-gray-300 cursor-pointer"
                                >
                                  {(editingEquivalents || []).length > 0 ? (editingEquivalents || []).join(', ') : 'Select Equivalent Subjects'}
                                </button>
                              </div>
                            ) : equivalents.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {equivalents.map((eq) => (
                                  <span key={eq.id} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-700">
                                    {eq.courseCode}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-500">None</span>
                            )}
                          </td>
                          <td className="p-2 align-top">
                            {isEditing ? (
                              <input
                                type="checkbox"
                                checked={data.isMajor || false}
                                onChange={(e) => handleInputChange('isMajor', e.target.checked)}
                                className="h-4 w-4 accent-purple-600"
                              />
                            ) : (
                              <input type="checkbox" checked={course.isMajor === true} disabled className="h-4 w-4 accent-purple-600" />
                            )}
                          </td>
                          <td className="p-2 align-top">
                            {isEditing ? (
                              <input
                                type="checkbox"
                                checked={data.isAvailable}
                                onChange={(e) => handleInputChange('isAvailable', e.target.checked)}
                                className="h-4 w-4 accent-blue-600"
                              />
                            ) : (
                              <input type="checkbox" checked={course.isAvailable !== false} disabled className="h-4 w-4 accent-blue-600" />
                            )}
                          </td>
                          <td className="p-2 align-top">
                            <div className="flex items-center gap-2">
                              {isEditing ? (
                                <button
                                  onClick={hasChanges ? handleSaveCourse : handleCancelEdit}
                                  disabled={loading}
                                  className={`p-1 rounded text-xs font-medium border ${
                                    hasChanges ? 'bg-green-600 text-white border-green-600 hover:bg-green-700' : 'bg-blue-500 hover:bg-blue-600 text-white border-blue-600'
                                  }`}
                                >
                                  {hasChanges ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleEditCourse(course)}
                                  className="p-1 rounded-full text-gray-700  hover:bg-gray-300 cursor-pointer"
                                  title="Edit course"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteCourse(course.id)}
                                disabled={loading}
                                className="p-1 rounded-full text-gray-700  hover:bg-gray-300 cursor-pointer"
                                title="Delete course"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });})()}

                    {/* New Course Row */}
                    <tr className="bg-blue-50">
                      <td className="p-2">
                        <input
                          className="w-28 border border-gray-300 rounded px-2 py-1"
                          placeholder="Course Code"
                          value={newCourseData[semester]?.courseCode || ''}
                          onChange={(e) => handleNewCourseInputChange('courseCode', e.target.value, semester)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-full border border-gray-300 rounded px-2 py-1"
                          placeholder="Course Title"
                          value={newCourseData[semester]?.courseTitle || ''}
                          onChange={(e) => handleNewCourseInputChange('courseTitle', e.target.value, semester)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="w-16 border border-gray-300 rounded px-2 py-1"
                          placeholder="Units"
                          value={newCourseData[semester]?.units || ''}
                          onChange={(e) => handleNewCourseInputChange('units', e.target.value, semester)}
                        />
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => openPrereqModalForNewCourse(selectedYear, semester)}
                          className="px-4 py-1 border rounded-lg border-blue-500 w-full text-xs cursor-pointer text-blue-600 hover:bg-blue-100"
                        >
                          {(newCourseData[semester]?.prerequisites || []).length > 0 ? (newCourseData[semester].prerequisites || []).join(', ') : 'Select Prerequisites'}
                        </button>
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => openEquivModalForNewCourse(semester)}
                          className="px-4 py-1 border rounded-lg border-blue-500 w-full text-xs cursor-pointer text-blue-600 hover:bg-blue-100"
                        >
                          {(selectedEquivalent || []).length > 0 ? (selectedEquivalent || []).join(', ') : 'Select Equivalent Subjects '}
                        </button>
                      </td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-purple-600"
                          checked={newCourseData[semester]?.isMajor ?? false}
                          onChange={(e) => handleNewCourseInputChange('isMajor', e.target.checked, semester)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-blue-600"
                          checked={newCourseData[semester]?.isAvailable ?? true}
                          onChange={(e) => handleNewCourseInputChange('isAvailable', e.target.checked, semester)}
                        />
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => handleAddNewCourse(semester)}
                          disabled={
                            loading ||
                            !newCourseData[semester]?.courseCode ||
                            !newCourseData[semester]?.courseTitle ||
                            !newCourseData[semester]?.units
                          }
                          
                          className="px-3 py-1 flex cursor-pointer items-center gap-1 rounded-lg text-xs font-medium bg-green-600 text-white border border-green-600 disabled:opacity-50"
                        >
                          <BadgePlus className="w-4 h-4 inline" />
                          Add
                        </button>
                      </td>
                    </tr>

                    {(() => {
                      const base = getCoursesByYearAndSemester(selectedYear, semester);
                      const q = (tableFilters[semester] || '').toLowerCase().trim();
                      const filtered = q
                        ? base.filter((c) =>
                            (c.courseCode || '').toLowerCase().includes(q) ||
                            (c.courseTitle || '').toLowerCase().includes(q)
                          )
                        : base;
                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="text-center text-gray-500 py-2">
                              {base.length === 0
                                ? `No courses in ${selectedYear === 1 ? '1st' : selectedYear === 2 ? '2nd' : selectedYear === 3 ? '3rd' : '4th'} Year, ${semLabel(semester)} Semester`
                                : `No matches for "${tableFilters[semester]}"`}
                            </td>
                          </tr>
                        );
                      }
                      return null;
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50">
                      <td className="p-2 text-right font-medium" colSpan={2}>Total Units</td>
                      <td className="p-2 font-semibold text-center text-blue-700">
                        {getTotalUnitsByYearAndSemester(selectedYear, semester)}
                      </td>
                      <td colSpan={5}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className=" max-w-7xl mx-auto flex flex-col">
      {!currentUser && (
        <div className="mb-2 rounded border border-blue-200 bg-blue-50 text-blue-800 px-4 py-2">
          Please sign in to access the Curriculum Maker
        </div>
      )}

      {error && (
        <div className="mb-2 rounded border border-red-200 bg-red-50 text-red-800 px-4 py-2">{error}</div>
      )}
      {success && (
        <div className="mb-2 rounded border border-green-200 bg-green-50 text-green-800 px-4 py-2">{success}</div>
      )}

      {currentUser ? (
        <div className=" w-full">
          {!selectedCurriculum ? (
            <div className="flex-1">{renderCurriculumList()}</div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-300 mb-4">
                <div className="flex items-center justify-between">
                  
                  <div className="flex items-center gap-6">
                    <button
                      onClick={() => setSelectedCurriculum(null)}
                      aria-label="Back to list"
                      title="Back to list"
                      className="group flex cursor-pointer items-center gap-2 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white transition-transform"
                    >
                      <ArrowBigLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    </button>

                    <div>
                      <div className="text-base text-gray-700">Curriculum</div>
                      <div className="text-2xl font-semibold text-blue-600">
                        {selectedCurriculum?.name}
                      </div>
                    </div>
                  </div>

                  {/* Right Side */}
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedCurriculum) return;
                        setPreviewCurriculumId(selectedCurriculum?.id || '');
                        setPrintOnlyOpen(true);
                      }}
                      className="inline-flex items-center text-sm gap-2 bg-green-600 text-white px-4 py-2 rounded-full cursor-pointer hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-offset-2 focus:ring-offset-white"
                    >
                      <Printer className="w-4 h-4" />
                      Print Curriculum 
                    </button>
                  </div>

                </div>
              </div>

              <div>{renderCourseTables()}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="p-6 text-center border border-gray-200 rounded bg-gray-50 text-gray-600">
            Sign in to access curriculum management features
          </div>
        </div>
      )}

      {/* Fullscreen click-catcher for open menu */}
      {menuAnchorEl && (
        <div className="fixed inset-0 z-40" onClick={handleMenuClose}></div>
      )}

      {/* Inline dropdown menus rendered inside cards (see renderCurriculumList) */}

      {/* Toast */}
      {snackbarOpen && (
        <div className="fixed bottom-4 left-4 z-50 max-w-sm">
          <div
            className={`flex items-start gap-2 rounded-md px-4 py-3 shadow border ${
              snackbarSeverity === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-green-50 border-green-200 text-green-800'
            }`}
          >
            <span className={`mt-0.5 bi ${snackbarSeverity === 'error' ? 'bi-x-circle' : 'bi-check-circle'}`}></span>
            <div className="flex-1 text-sm">{snackbarMessage}</div>
            <button onClick={() => setSnackbarOpen(false)} className="text-inherit/70 hover:text-inherit">
              <i className="bi bi-x"></i>
            </button>
          </div>
        </div>
      )}

      {/* Edit Curriculum Modal */}
      {editCurriculumDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditCurriculumDialogOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md bg-white rounded-lg shadow p-8">
            <div className="text-lg font-semibold mb-2">Edit Curriculum</div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Curriculum Name</label>
                <input
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-1.5"
                  value={editingCurriculumData.name}
                  onChange={(e) => setEditingCurriculumData({ ...editingCurriculumData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-1.5 resize-none"
                  value={editingCurriculumData.description}
                  onChange={(e) => setEditingCurriculumData({ ...editingCurriculumData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditCurriculumDialogOpen(false)}
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateCurriculum}
                disabled={loading}
                className="px-4 py-1.5 rounded-full text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCurriculumDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteCurriculumDialogOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md bg-white rounded-lg shadow p-8">
            <div className="text-lg font-semibold mb-2">Confirm Delete</div>
            <div className=" text-gray-700">
              Are you sure you want to delete "{selectedCurriculumForMenu?.name}"? This will also delete all associated courses and cannot be undone.
            </div>
            <div className="mt-8 flex justify-end gap-2">
              <button
                onClick={() => setDeleteCurriculumDialogOpen(false)}
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteCurriculum}
                disabled={loading}
                className="px-4 py-1.5 rounded-full text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Curriculum Modal */}
      {curriculumDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCurriculumDialogOpen(false)}></div>
          <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-lg p-8">
            <div className="text-lg font-semibold mb-4">Create New Curriculum</div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Curriculum Name</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  value={curriculumForm.name}
                  placeholder='e.g. "BS Computer Science 2024"'
                  onChange={(e) => setCurriculumForm({ ...curriculumForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm resize-none"
                  value={curriculumForm.description}
                  placeholder='Enter curriculum description...'
                  onChange={(e) => setCurriculumForm({ ...curriculumForm, description: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setCurriculumDialogOpen(false)}
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCurriculum}
                disabled={loading}
                className="px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Curriculum PDF Modal */}
      {pdfOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPdfOpen(false)}></div>
          <div className="relative z-10 w-full max-w-4xl bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold">Curriculum PDF{selectedCurriculum ? ` - ${selectedCurriculum.name}` : ''}</div>
              <button onClick={() => setPdfOpen(false)} className="text-gray-600 hover:text-gray-800">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="h-[80vh] overflow-auto">
              <CurriculumPDF curriculum={selectedCurriculum} />
            </div>
          </div>
        </div>
      )}

      {/* Curriculum Preview Modal (inline) */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewOpen(false)}></div>
          <div className="relative z-10 w-full max-w-5xl bg-white rounded-lg shadow p-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold">Curriculum Preview{selectedCurriculum ? ` - ${selectedCurriculum.name}` : ''}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { try { window.print(); } catch (e) { console.error(e); } }}
                  title="Print PDF"
                  className="inline-flex items-center gap-2 mr-3 text-sm text-white cursor-pointer bg-blue-500 px-3 py-1.5  rounded hover:bg-blue-600"
                >
                  <i className="bi bi-printer" aria-hidden></i>
                  <span className="hidden sm:inline">Print PDF</span>
                </button>
                <button onClick={() => setPreviewOpen(false)} className="cursor-pointer text-gray-600 hover:text-red-500">
                  <X className="h-7 w-7" />
                </button>
              </div>
            </div>
            <div className="h-[80vh] overflow-auto">
              <CurriculumPreview curriculumId={previewCurriculumId || selectedCurriculum?.id} onClose={() => setPreviewOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Add Course Modal */}
      {courseDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCourseDialogOpen(false)}></div>
          <div className="relative z-10 w-full max-w-lg bg-white rounded-lg shadow p-4">
            <div className="text-lg font-semibold mb-2">Add New Course</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Year Level</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                >
                  {[1, 2, 3, 4].map((y) => (
                    <option key={y} value={y}>{y === 1 ? '1st' : y === 2 ? '2nd' : y === 3 ? '3rd' : '4th'} Year</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Semester</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(parseInt(e.target.value, 10))}
                >
                  {[1, 2, (selectedYear === 3 ? 3 : null)].filter(Boolean).map((s) => (
                    <option key={s} value={s}>{s === 1 ? '1st' : s === 2 ? '2nd' : 'Summer'} Semester</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Course Code</label>
                <input
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={courseForm.courseCode}
                  onChange={(e) => setCourseForm({ ...courseForm, courseCode: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Course Title</label>
                <input
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={courseForm.courseTitle}
                  onChange={(e) => setCourseForm({ ...courseForm, courseTitle: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Units</label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={courseForm.units}
                  onChange={(e) => setCourseForm({ ...courseForm, units: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Prerequisites (comma-separated)</label>
                <button
                  onClick={openPrereqModalForForm}
                  className="w-full text-left border border-gray-300 rounded px-3 py-2 bg-white hover:bg-gray-50"
                >
                  {(courseForm.prerequisites || []).length > 0 ? (courseForm.prerequisites || []).join(', ') : 'Select Prerequisites'}
                </button>
                <div className="text-xs text-gray-500 mt-1">Select from existing course codes: {getAllCourseCodes().join(', ')}</div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setCourseDialogOpen(false)}
                className="px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCourse}
                disabled={loading}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Add Course
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print-only preview (hidden on screen, visible only when printing) */}
      {/* Prerequisites Selection Modal */}
      {prereqModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setPrereqModalOpen(false)}
          ></div>

          {/* Modal */}
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-lg shadow-xl max-h-[85vh] overflow-auto">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white flex items-center justify-between py-3 px-5 border-b border-gray-200 shadow-sm">
              <h3 className="text-xl font-semibold text-gray-800">Select Prerequisites</h3>
              <button
                onClick={() => setPrereqModalOpen(false)}
                className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 pb-20">
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Filter Year</label>
                  <select
                    value={prereqViewYear}
                    onChange={(e) => setPrereqViewYear(parseInt(e.target.value, 10))}
                    className="px-2 py-1.5 text-sm rounded-lg border border-gray-300 cursor-pointer focus-outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {/* build options dynamically from available years */}
                    {(() => {
                      const yrs = Array.from(new Set(courses.map(c => c.yearLevel).filter(Boolean))).sort((a,b)=>a-b);
                      if (yrs.length === 0) return <option value={1}>1</option>;
                        return yrs.map(y => (
                          <option key={y} value={y}>
                            {y === 1 ? '1st Year' : y === 2 ? '2nd Year' : y === 3 ? '3rd Year' : `${y}th Year`}
                          </option>
                        ));                    
                    })()}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">Search</label>
                  <input
                    value={prereqSearchTerm}
                    onChange={(e) => setPrereqSearchTerm(e.target.value)}
                    placeholder="Search across all years"
                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {(() => {
                const candidates = courses
                  .filter((c) => c.courseCode)
                  .filter((c) => {
                    if (!prereqTarget.year || !prereqTarget.semester) return false;
                    const y = c.yearLevel || 0;
                    const s = c.semester || 0;
                    if (y < prereqTarget.year) return true;
                    if (y === prereqTarget.year && s < prereqTarget.semester) return true;
                    return false;
                  })
                  .sort((a, b) => (a.yearLevel - b.yearLevel) || (a.semester - b.semester) || (a.courseCode || '').localeCompare(b.courseCode || ''));

                if (candidates.length === 0) {
                  return (
                    <div className="text-sm text-gray-500 text-center py-8">
                      No prior subjects available to select.
                    </div>
                  );
                }

                // If search term is provided, filter globally across all years
                const q = (prereqSearchTerm || '').toLowerCase().trim();
                const visible = q
                  ? candidates.filter(c => (c.courseCode || '').toLowerCase().includes(q) || (c.courseTitle || '').toLowerCase().includes(q))
                  : candidates.filter(c => (c.yearLevel || 0) === prereqViewYear);

                const maxYear = courses.reduce((m, c) => Math.max(m, c.yearLevel || 0), 0);
                // show helpful notices
                if (prereqViewYear > maxYear) {
                  return (
                    <div className="text-sm text-red-600 text-center py-4">Selected year is beyond available subjects.</div>
                  );
                }
                let warnMessage = '';
                if (prereqTarget.year) {
                  const targetY = prereqTarget.year || 0;
                  const targetS = prereqTarget.semester || 0;
                  if (prereqViewYear > targetY) {
                    warnMessage = 'Please choose prerequisites from previous years/semesters only.';
                  } else if (prereqViewYear === targetY && !q) {
                    warnMessage = 'Please choose prerequisites from earlier semesters only.';
                  }
                }

                const grouped = visible.reduce((acc, c) => {
                  const y = c.yearLevel || 0;
                  const s = c.semester || 0;
                  acc[y] = acc[y] || {};
                  acc[y][s] = acc[y][s] || [];
                  acc[y][s].push(c);
                  return acc;
                }, {});

                const years = Object.keys(grouped).map(Number).sort((a, b) => a - b);

                return (
                  <div className="space-y-6">
                    {warnMessage && (
                      <div className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                        {warnMessage}
                      </div>
                    )}
                    {years.map((year) => (
                      <div key={year} className="">
                        {([1, 2, 3]).filter((sem) => grouped[year] && grouped[year][sem]).map((sem) => {
                          const list = grouped[year][sem];
                          const codes = list.map(x => x.courseCode).filter(Boolean);
                          const allChecked = codes.length > 0 && codes.every(code => tempSelectedPrereqs.includes(code));
                          return (
                            <div key={sem} className="mb-5">
                              <div className='flex items-center justify-between'>
                                <h4 className="text-sm  text-gray-800">
                                  {year === 1 ? '1st Year' : year === 2 ? '2nd Year' : year === 3 ? '3rd Year' : `Year ${year}`}
                                </h4>
                                <h5 className="text-sm text-gray-700">
                                  {sem === 1 ? '1st' : sem === 2 ? '2nd' : 'Summer'} Semester
                                </h5>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-xs border border-gray-200 rounded-lg">
                                  <thead className="bg-blue-500 text-white">
                                    <tr>
                                      <th className="p-1.5 text-left w-12">
                                         <input
                                            type="checkbox"
                                            checked={allChecked}
                                            onChange={(e) => {
                                              if (e.target.checked) setTempSelectedPrereqs(prev => Array.from(new Set([...prev, ...codes])));
                                              else setTempSelectedPrereqs(prev => prev.filter(x => !codes.includes(x)));
                                            }}
                                            className="h-4 w-4 accent-blue-600 rounded focus:ring-blue-500"
                                          />
                                      </th>
                                      <th className="p-1.5 text-left">Code</th>
                                      <th className="p-1.5 text-left">Title</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                  {list.map((c) => (
                                    <tr
                                      key={c.id}
                                      className="border-b border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
                                      onClick={(e) => {
                                        if (e.target && e.target.closest && e.target.closest('input')) return;
                                        const code = c.courseCode;
                                        if (!code) return;
                                        setTempSelectedPrereqs(prev => prev.includes(code) ? prev.filter(x => x !== code) : Array.from(new Set([...prev, code])));
                                      }}
                                    >
                                      <td colSpan="3" className="p-0">
                                        <label htmlFor={`checkbox-${c.id}`} className="flex items-center p-1.5">
                                          <input
                                            type="checkbox"
                                            id={`checkbox-${c.id}`}
                                            checked={tempSelectedPrereqs.includes(c.courseCode)}
                                            onChange={(e) => {
                                              if (e.target.checked) setTempSelectedPrereqs(prev => Array.from(new Set([...prev, c.courseCode])));
                                              else setTempSelectedPrereqs(prev => prev.filter(x => x !== c.courseCode));
                                            }}
                                            className="h-4 w-4 accent-blue-600 rounded focus:ring-blue-500 mr-3"
                                          />
                                          <span className="font-medium text-blue-700 w-20">{c.courseCode}</span>
                                          <span className="text-gray-700">{c.courseTitle}</span>
                                        </label>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 z-10 bg-white flex justify-end gap-3 py-3 px-5 border-t border-gray-200">
              <button
                onClick={() => setPrereqModalOpen(false)}
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={savePrereqsFromModal}
                className="px-6 py-1.5 rounded-full text-sm bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Equivalent Subjects Selection Modal */}
      {equivModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 backdrop-blur-[2px] bg-black/40" onClick={() => setEquivModalOpen(false)}></div>
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-lg shadow p-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold">Select Equivalent Subjects</div>
              <button onClick={() => setEquivModalOpen(false)} className="text-gray-600 cursor-pointer hover:text-red-800 bg-gray-100 rounded-full p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
              <div className="space-y-3 pb-20">
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Curriculum</label>
                  <select
                    value={equivSelectedCurriculumId || ''}
                    onChange={(e) => setEquivSelectedCurriculumId(e.target.value || null)}
                    className="text-sm px-2 py-1.5 rounded-lg cursor-pointer border border-gray-300 focus:outline-none"
                  >
                    <option value="">All Curriculums</option>
                    {curriculums && curriculums.length > 0 && curriculums.map(cur => (
                      <option key={cur.id} value={cur.id}>{cur.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="block text-xs text-gray-600 mb-1">Search</label>
                  <input
                    value={equivSearchTerm}
                    onChange={(e) => setEquivSearchTerm(e.target.value)}
                    placeholder="Search codes or courses"
                    className="w-full text-sm px-2 py-1.5 rounded-lg cursor-pointer border border-gray-300 focus:outline-none"
                  />
                </div>
              </div>

              {(() => {
                if (!allCourses || allCourses.length === 0) return <div className="text-sm text-gray-500">No available courses.</div>;
                const q = (equivSearchTerm || '').toLowerCase().trim();
                const curr = curriculums && curriculums.find(c => c.id === equivSelectedCurriculumId);
                let candidates = allCourses.filter(c => c.courseCode);
                if (q) {
                  candidates = candidates.filter(c => (c.courseCode || '').toLowerCase().includes(q) || (c.courseTitle || '').toLowerCase().includes(q));
                } else if (equivSelectedCurriculumId) {
                  candidates = candidates.filter(c => (c.curriculumId && c.curriculumId === equivSelectedCurriculumId) || (c.curriculumName && curr && c.curriculumName === curr.name));
                }
                candidates = candidates.sort((a, b) => {
                  const fa = ((a[equivSortField] || '') + '').toLowerCase();
                  const fb = ((b[equivSortField] || '') + '').toLowerCase();
                  if (fa < fb) return equivSortDirection === 'asc' ? -1 : 1;
                  if (fa > fb) return equivSortDirection === 'asc' ? 1 : -1;
                  return 0;
                });

                const codes = candidates.map(c=>c.courseCode).filter(Boolean);
                const allChecked = codes.length > 0 && codes.every(code => tempSelectedEquivs.includes(code));

                return (
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="sticky top-0 z-10 bg-blue-500 text-white">
                        <tr>
                          <th className="p-1.5 w-12 text-left">
                            <input
                              type="checkbox"
                              checked={allChecked}
                              onChange={(e) => {
                                if (e.target.checked) setTempSelectedEquivs(prev => Array.from(new Set([...prev, ...codes])));
                                else setTempSelectedEquivs(prev => prev.filter(x => !codes.includes(x)));
                              }}
                              className="h-4 w-4 accent-blue-600"
                            />
                          </th>
                          <th className="p-1.5 text-left">
                            <button
                              type="button"
                              onClick={() => {
                                if (equivSortField === 'courseCode') setEquivSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                else { setEquivSortField('courseCode'); setEquivSortDirection('asc'); }
                              }}
                              className="inline-flex items-center gap-1"
                            >
                              <span>Code</span>
                              {equivSortField === 'courseCode' ? (
                                <ChevronUp className={`w-4 ${equivSortDirection === 'asc' ? '' : 'rotate-180'}`} />
                              ) : (
                                <ChevronsUpDown className="w-4 opacity-80" />
                              )}
                            </button>
                          </th>
                          <th className="p-1.5 text-left">
                            <button
                              type="button"
                              onClick={() => {
                                if (equivSortField === 'courseTitle') setEquivSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                else { setEquivSortField('courseTitle'); setEquivSortDirection('asc'); }
                              }}
                              className="inline-flex items-center gap-1"
                            >
                              <span>Courses</span>
                              {equivSortField === 'courseTitle' ? (
                                <ChevronUp className={`w-4 ${equivSortDirection === 'asc' ? '' : 'rotate-180'}`} />
                              ) : (
                                <ChevronsUpDown className="w-4 opacity-80" />
                              )}
                            </button>
                          </th>
                          <th className="p-1.5 text-left">Curriculum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map(c => (
                          <tr
                            key={c.id}
                            className={`border-b border-gray-300 hover:bg-gray-50 cursor-pointer ${tempSelectedEquivs.includes(c.courseCode) ? 'bg-amber-50' : ''}`}
                            onClick={(e) => {
                              if (e.target && e.target.closest && e.target.closest('input')) return;
                              const code = c.courseCode;
                              if (!code) return;
                              setTempSelectedEquivs(prev => prev.includes(code) ? prev.filter(x => x !== code) : Array.from(new Set([...prev, code])));
                            }}
                          >
                            <td className="p-1.5">
                              <input
                                type="checkbox"
                                checked={tempSelectedEquivs.includes(c.courseCode)}
                                onChange={(e) => {
                                  if (e.target.checked) setTempSelectedEquivs(prev => Array.from(new Set([...prev, c.courseCode])));
                                  else setTempSelectedEquivs(prev => prev.filter(x => x !== c.courseCode));
                                }}
                                className="h-4 w-4 accent-blue-600"
                              />
                            </td>
                            <td className="p-1.5 font-medium text-blue-700">{c.courseCode}</td>
                            <td className="p-1.5">{c.courseTitle}</td>
                            <td className="p-1.5 text-xs text-gray-600">
                              {c.curriculumName || (curriculums && curriculums.find(cur => cur.id === c.curriculumId)?.name) || (curr && curr.name) || ''}
                            </td>
                          </tr>
                        ))}
                        {candidates.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-gray-500">No subjects found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
            <div className="sticky bottom-0 z-10 bg-white flex justify-end gap-3 py-3 px-5 border-t border-gray-200">
              <button
                onClick={() => setEquivModalOpen(false)}
                className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveEquivsFromModal}
                className="px-6 py-1.5 rounded-full cursor-pointer text-sm bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {printOnlyOpen && previewCurriculumId && (
        <div className="print-only-preview" aria-hidden>
          <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
            <CurriculumPreview curriculumId={previewCurriculumId} />
          </div>
          <style>{`@media screen { .print-only-preview { display: none; } } @media print { body * { visibility: hidden !important; } .print-only-preview, .print-only-preview * { visibility: visible !important; } .print-only-preview { position: static !important; left: 0 !important; width: 100% !important; } }`}</style>
        </div>
      )}

      {showScrollTop && (
        <button
          type="button"
          onClick={handleScrollToTop}
          className="fixed bottom-6 right-6 z-40 cursor-pointer rounded-full bg-blue-600 text-white p-3 shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
          aria-label="Scroll to top"
          title="Scroll to top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default CurriculumMaker;