import { useState, useEffect, useCallback } from 'react';
import { createCurriculum, getCurriculums, addCourse, getCoursesByCurriculum, getAllCourses } from '../../models/curriculumModels';
import { useAuth } from '../../contexts/AuthContext';
import { doc, deleteDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
// Using Tailwind + Bootstrap Icons for UI; all logic remains intact.

const CurriculumMaker = ({ onBack }) => {
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

  // Equivalent subject selection state
  const [selectedEquivalent, setSelectedEquivalent] = useState([]);
  const [allCourses, setAllCourses] = useState([]);

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

  // Auto-hide snackbar to mimic previous MUI behavior
  useEffect(() => {
    if (snackbarOpen) {
      const t = setTimeout(() => setSnackbarOpen(false), 6000);
      return () => clearTimeout(t);
    }
  }, [snackbarOpen]);

  // Helper function to show snackbar messages
  const showMessage = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
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
              className="group flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white transition-transform"
          >
            <span className="hidden sm:inline text-sm font-medium">Back</span>
          </button>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-bold text-blue-600">
              Curriculum Maker</h2>
          <p className="text-gray-600">Select a curriculum to manage courses</p></div>         
        </div>
        <button
          onClick={() => setCurriculumDialogOpen(true)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white"
        >
          <i className="bi bi-plus-lg"></i>
          <span>Create</span>
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
            <button
              type="button"
              aria-label="More options"
              onClick={(e) => handleMenuOpen(e, curriculum)}
              disabled={loading}
              className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <i className="bi bi-three-dots-vertical"></i>
            </button>

            {menuAnchorEl && selectedCurriculumForMenu?.id === curriculum.id && (
              <div className="absolute right-4 top-12 z-50 w-40 bg-white border border-gray-200 rounded-md shadow-md overflow-hidden">
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                  onClick={(e) => { e.stopPropagation(); handleEditCurriculum(); }}
                >
                  <span>Edit</span>
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2"
                  onClick={(e) => { e.stopPropagation(); handleDeleteCurriculumClick(); }}
                >
                  <span>Delete</span>
                </button>
              </div>
            )}

            <h3 className="text-lg font-bold mb-6 pr-8">{curriculum.name}</h3>

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
      
    </div>
  );

  const renderCourseTables = () => {
    if (!selectedCurriculum) return null;

    const yearLabels = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
    const semLabel = (s) => (s === 1 ? '1st' : s === 2 ? '2nd' : 'Summer');

    return (
      <div>
        <div className="mb-3 flex flex-wrap gap-2 border-b border-gray-300">
  {[1, 2, 3, 4].map((year, idx) => (
    <button
      key={year}
      onClick={() => { setTabValue(idx); setSelectedYear(idx + 1); }}
      className={`
            px-2 py-1 cursor-pointer
        ${tabValue === idx 
          ? 'border-b-2 border-blue-600 text-blue-600 ' 
              : 'border-b-2 border-transparent hover:text-blue-600 hover:border-blue-600'
        }
      `}
    >
      {yearLabels[idx]}
    </button>
  ))}

  <button
    onClick={() => { setTabValue(4); setSelectedYear('irregular'); }}
    className={`
            px-2 py-1 cursor-pointer
      ${tabValue === 4
        ? 'border-b-2 border-blue-600 text-blue-600' 
              : 'border-b-2 border-transparent hover:text-blue-600 hover:border-blue-600'
      }
    `}
  >
    Irregular Students
  </button>
</div>


        <div>
          {([1, 2, selectedYear === 3 ? 3 : null].filter(Boolean)).map((semester) => (
            <div key={semester} className="mt-4 mb-8">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-blue-700">{semLabel(semester)} Semester</h3>
                <div className="relative w-full max-w-xs">
                  <input
                    className="w-full px-3 py-1.5 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-200 focus:border-blue-400 "
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
                        <button title="Sort by Course Code" onClick={() => handleSort('courseCode')} className="inline-flex items-center gap-1">
                          <span>Course Code</span>
                          {sortField === 'courseCode' ? (
                            <i className={`bi ${sortDirection === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill'} text-xs`}></i>
                          ) : (
                            <i className="bi bi-arrow-down-up text-xs opacity-80"></i>
                          )}
                        </button>
                      </th>
                      <th className="p-2 w-[35%] text-left" aria-sort={sortField === 'courseTitle' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button title="Sort by Course Title" onClick={() => handleSort('courseTitle')} className="inline-flex items-center gap-1">
                          <span>Course Title</span>
                          {sortField === 'courseTitle' ? (
                            <i className={`bi ${sortDirection === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill'} text-xs`}></i>
                          ) : (
                            <i className="bi bi-arrow-down-up text-xs opacity-80"></i>
                          )}
                        </button>
                      </th>
                      <th className="p-2 w-[10%] text-left" aria-sort={sortField === 'units' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button title="Sort by Units" onClick={() => handleSort('units')} className="inline-flex items-center gap-1">
                          <span>Units</span>
                          {sortField === 'units' ? (
                            <i className={`bi ${sortDirection === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill'} text-xs`}></i>
                          ) : (
                            <i className="bi bi-arrow-down-up text-xs opacity-80"></i>
                          )}
                        </button>
                      </th>
                      <th className="p-2 w-[25%] text-left">Prerequisites</th>
                      <th className="p-2 w-[15%] text-left">Equivalent Subjects</th>
                      <th className="p-2 w-[10%] text-left">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={areAllAvailable(selectedYear, semester)}
                            onChange={(e) => handleSelectAllAvailable(selectedYear, semester, e.target.checked)}
                            className="h-4 w-4 accent-blue-600"
                          />
                          <span className="font-semibold text-white text-xs">Available</span>
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
                        <tr key={course.id} className={`${isEditing ? 'bg-amber-50' : 'hover:bg-gray-100'} odd:bg-white even:bg-gray-50 border-t`}> 
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
                          <td className="p-2 align-top">
                            {isEditing ? (
                              <input
                                type="number"
                                className="w-16 border border-gray-300 rounded px-2 py-1"
                                value={data.units}
                                onChange={(e) => handleInputChange('units', e.target.value)}
                              />
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
                                <i className="bi bi-stack me-1"></i>{course.units}
                              </span>
                            )}
                          </td>
                          <td className="p-2 align-top">
                            {isEditing ? (
                              <input
                                className="w-full border border-gray-300 rounded px-2 py-1"
                                placeholder="Comma-separated codes"
                                value={(editingData.prerequisites || []).join(', ')}
                                onChange={(e) => {
                                  const arr = e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                  setEditingData((prev) => ({ ...prev, prerequisites: arr }));
                                  setHasChanges(true);
                                }}
                              />
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
                              <input
                                className="w-full border border-gray-300 rounded px-2 py-1"
                                placeholder="Comma-separated codes"
                                value={(editingEquivalents || []).join(', ')}
                                onChange={(e) => {
                                  const arr = e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                  setEditingEquivalents(arr);
                                  let eqId = data.equivalentSubjectId;
                                  if (!eqId && arr.length > 0) {
                                    eqId = 'EQ_' + Math.random().toString(36).substr(2, 9);
                                  } else if (arr.length === 0) {
                                    eqId = '';
                                  }
                                  setEditingData((prev) => ({ ...prev, equivalentSubjectId: eqId }));
                                  setHasChanges(true);
                                }}
                              />
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
                                  className={`px-3 py-1 rounded text-xs font-medium border ${
                                    hasChanges ? 'bg-green-600 text-white border-green-600 hover:bg-green-700' : 'bg-blue-500 hover:bg-blue-600 text-white border-blue-600'
                                  }`}
                                >
                                  {hasChanges ? 'Save' : 'Cancel'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleEditCourse(course)}
                                  className="px-3 py-1 rounded text-xs font-medium bg-green-600 text-white border border-green-600 hover:bg-green-700"
                                  title="Edit course"
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteCourse(course.id)}
                                disabled={loading}
                                className="px-3 py-1 rounded text-xs font-medium bg-red-600 text-white border border-red-600 hover:bg-red-700"
                                title="Delete course"
                              >
                                Delete
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
                        <input
                          className="w-full border border-gray-300 rounded px-2 py-1"
                          placeholder="Prerequisites (comma-separated)"
                          value={(newCourseData[semester]?.prerequisites || []).join(', ')}
                          onChange={(e) => {
                            const arr = e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean);
                            setNewCourseData((prev) => ({
                              ...prev,
                              [semester]: {
                                ...(prev[semester] || { courseCode: '', courseTitle: '', units: '', prerequisites: [], isAvailable: true }),
                                prerequisites: arr,
                              },
                            }));
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-full border border-gray-300 rounded px-2 py-1"
                          placeholder="Equivalent Codes (optional)"
                          value={(selectedEquivalent || []).join(', ')}
                          onChange={(e) => {
                            const arr = e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean);
                            setSelectedEquivalent(arr);
                          }}
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
                          className="px-3 py-1 rounded text-xs font-medium bg-green-600 text-white border border-green-600 disabled:opacity-50"
                        >
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
                      <td className="p-2 font-semibold text-blue-700">
                        {getTotalUnitsByYearAndSemester(selectedYear, semester)}
                      </td>
                      <td colSpan={4}></td>
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
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-300 mb-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <button
                      onClick={() => setSelectedCurriculum(null)}
                      aria-label="Back to list"
                      title="Back to list"
              className="group flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white transition-transform"
                    >
                      <span className="hidden sm:inline text-sm font-medium">Back</span>
                    </button>
                    <div>
                      <div className="text-base text-gray-700">Curriculum</div>
                      <div className="text-2xl font-semibold text-blue-600">{selectedCurriculum.name}</div>
                    </div>
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
          <div className="relative z-10 w-full max-w-lg bg-white rounded-lg shadow p-4">
            <div className="text-lg font-semibold mb-2">Edit Curriculum</div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Curriculum Name</label>
                <input
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={editingCurriculumData.name}
                  onChange={(e) => setEditingCurriculumData({ ...editingCurriculumData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={editingCurriculumData.description}
                  onChange={(e) => setEditingCurriculumData({ ...editingCurriculumData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditCurriculumDialogOpen(false)}
                className="px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateCurriculum}
                disabled={loading}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
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
          <div className="relative z-10 w-full max-w-md bg-white rounded-lg shadow p-4">
            <div className="text-lg font-semibold mb-2">Confirm Delete</div>
            <div className="text-sm text-gray-700">
              Are you sure you want to delete "{selectedCurriculumForMenu?.name}"? This will also delete all associated courses and cannot be undone.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteCurriculumDialogOpen(false)}
                className="px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteCurriculum}
                disabled={loading}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
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
          <div className="relative z-10 w-full max-w-lg bg-white rounded-lg shadow p-4">
            <div className="text-lg font-semibold mb-2">Create New Curriculum</div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Curriculum Name</label>
                <input
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={curriculumForm.name}
                  onChange={(e) => setCurriculumForm({ ...curriculumForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={curriculumForm.description}
                  onChange={(e) => setCurriculumForm({ ...curriculumForm, description: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setCurriculumDialogOpen(false)}
                className="px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCurriculum}
                disabled={loading}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Create
              </button>
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
                <input
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  value={(courseForm.prerequisites || []).join(', ')}
                  onChange={(e) => {
                    const arr = e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    setCourseForm({ ...courseForm, prerequisites: arr });
                  }}
                />
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
    </div>
  );
};

export default CurriculumMaker;