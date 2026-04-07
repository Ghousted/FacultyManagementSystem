import { useState, useEffect, useCallback } from 'react';

import { 
  addStudent, 
  getStudents, 
  updateStudentCourse,
  getCurriculums,
  getCoursesByCurriculum 
} from '../../models/curriculumModels';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { BadgePlus, Pencil, Trash, Search, ChevronUp, ChevronDown, ChevronsUpDown, ArrowBigLeft } from 'lucide-react';

const StudentManagement = ({ onBack }) => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentCourses, setStudentCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [studentListTab, setStudentListTab] = useState(1);
  const [courseTab, setCourseTab] = useState(0);
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
    isIrregular: false
  });
  
  // Dialog states
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [editingDialogOpen, setEditingDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingData, setEditingData] = useState({});
  
  // Grade management state
  const [studentGrades, setStudentGrades] = useState({});
  const [editingGrades, setEditingGrades] = useState({});

  // Sorting state for course tables
  const [sortBy, setSortBy] = useState('courseCode');
  const [sortOrder, setSortOrder] = useState('asc');

  // View mode state
  const [viewMode, setViewMode] = useState('list');

  // Dropdown state for grid view
  const [openDropdown, setOpenDropdown] = useState(null);

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState([]);
  const [lastSelectedStudentId, setLastSelectedStudentId] = useState(null);
  const [multiEditOpen, setMultiEditOpen] = useState(false);
  const [multiDeleteOpen, setMultiDeleteOpen] = useState(false);
  const [multiEditYear, setMultiEditYear] = useState(1);
  const [showScrollTop, setShowScrollTop] = useState(false);

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

    setLoading(true);
    setError('');
    try {
      const updates = selectedIds.map(async (id) => {
        const studentRef = doc(db, 'students', id);
        await updateDoc(studentRef, { yearLevel: multiEditYear, updatedAt: new Date() });
      });

      await Promise.all(updates);

      setStudents(prev => prev.map(s => selectedIds.includes(s.id) ? { ...s, yearLevel: multiEditYear } : s));
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

  useEffect(() => {
    if (currentUser) {
      loadStudents();
      loadCurriculums();
    }
  }, [currentUser, loadStudents, loadCurriculums]);

  useEffect(() => {
    if (selectedStudent) {
      loadStudentCourses(selectedStudent.curriculumId);
      loadStudentGrades(selectedStudent.id);
    }
  }, [selectedStudent]);

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
    
    setLoading(true);
    setError('');
    const result = await addStudent(studentForm);
    if (result.success) {
      setSuccess('Student added successfully!');
      setStudentForm({ name: '', email: '', contactNumber: '', studentNumber: '', yearLevel: 1, curriculumId: '', isIrregular: false });
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
      email: student.email,
      contactNumber: student.contactNumber || '',
      studentNumber: student.studentNumber,
      yearLevel: student.yearLevel,
      curriculumId: student.curriculumId,
      isIrregular: student.isIrregular || false
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
    
    setLoading(true);
    setError('');
    try {
      const studentRef = doc(db, 'students', studentId);
      await updateDoc(studentRef, {
        name: editingData.name,
        email: editingData.email,
        studentNumber: editingData.studentNumber,
        yearLevel: editingData.yearLevel,
        curriculumId: editingData.curriculumId,
        isIrregular: editingData.isIrregular,
        updatedAt: new Date()
      });
      setSuccess('Student updated successfully!');
      setEditingStudent(null);
      setEditingData({});
      setStudentListTab(editingData.isIrregular ? 5 : editingData.yearLevel);
      setEditingDialogOpen(false);
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

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;

    setLoading(true);
    setError('');
    
    try {
      await deleteDoc(doc(db, 'students', studentToDelete));
      
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

  const isCourseCompleted = (courseCode) => {
    // Check if course is marked as completed OR if it has a grade (except failed/incomplete)
    const hasGrade = studentGrades[courseCode] && studentGrades[courseCode] !== '';
    const isFailed = studentGrades[courseCode] === '5.0';
    const isIncomplete = studentGrades[courseCode] === 'INC';
    
    return selectedStudent?.completedCourses?.includes(courseCode) || 
           (hasGrade && !isFailed && !isIncomplete);
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
     
     <div className='flex-1 flex justify-between items-center  gap-4 mb-4'>
      <div className=" flex flex-wrap gap-2  border-gray-300 text-sm">
        {[1, 2, 3, 4].map((year, idx) => (
          <button
            key={year}
            onClick={() => setStudentListTab(idx + 1)}
            className={`px-3 py-1  rounded-full shadow-md border transition-all flex items-center gap-1 text-sm cursor-pointer
              ${studentListTab === idx + 1
                ? 'bg-blue-600 text-white border-blue-700 '
                : 'bg-white text-blue-700 hover:bg-blue-100 border-gray-300'
              }
            `}
          >
            {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year ({getStudentCountByYear(year)})
          </button>
        ))}

        <button
          onClick={() => setStudentListTab(5)}
          className={`px-3 py-1 rounded-full shadow-md border transition-all flex items-center gap-1 text-sm cursor-pointer
              ${studentListTab === 5
              ? 'bg-blue-600 text-white border-blue-700'
              : 'bg-white text-blue-700 hover:bg-blue-100 border-gray-300'
            }
          `}
        >
          Irregular ({getIrregularStudentCount()})
        </button>
      </div>


     <div className="flex items-center gap-4">
 
<div className="relative w-full sm:w-70">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
  
  <input
    className="w-full border text-sm border-gray-300 rounded-full pl-9 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
    placeholder="Search students name..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
  />
</div>

  {selectedIds.length > 0 && (
        <div className="flex items-center  gap-2">
          <div className="text-xs text-gray-700">{selectedIds.length} selected</div>
          <div className="flex items-center gap">
            <button
              onClick={() => {
                const first = students.find(s => s.id === selectedIds[0]);
                setMultiEditYear(first ? first.yearLevel : 1);
                setMultiEditOpen(true);
              }}
              className="p-1 rounded-full text-gray-700  hover:bg-gray-300 cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMultiDeleteOpen(true)}
              className="p-1 rounded-full text-gray-700  hover:bg-gray-300 cursor-pointer"
            >
              <Trash className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

</div>
     </div>


    
      {/* Multi-edit Year Modal */}
      {multiEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setMultiEditOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-2xl shadow p-6">
            <div className="text-lg mb-2 font-medium">Edit Year Level for Selected Students</div>
            
             

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

            {/* Info / Warning */}
              <div className="px-4 py-2 mb-8 text-sm mt-4  text-blue-800 bg-blue-50 border border-blue-200 rounded-lg">
                Updating the year level will affect all selected students.
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

          if (studentListTab === 0) {
            filteredStudents = students;
          } else if (studentListTab === 5) {
            filteredStudents = students.filter((student) => student.isIrregular);
          } else {
            filteredStudents = students.filter((student) => student.yearLevel === studentListTab && !student.isIrregular);
          }

          if (searchTerm) {
            filteredStudents = filteredStudents.filter(
              (student) =>
                student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                getCurriculumName(student.curriculumId).toLowerCase().includes(searchTerm.toLowerCase())
            );
          }

          // Create a sorted copy of filtered students for table display
          const sortedStudents = filteredStudents.slice().sort((a, b) => {
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

          if (filteredStudents.length === 0) {
            return (
              <div className="text-center py-8">
                <div className="text-gray-600 text-lg font-medium mb-1">
                  {searchTerm ? 'No students found' : studentListTab === 5 ? 'No irregular students' : `No students in Year ${studentListTab}`}
                </div>
                <div className="text-gray-500 mb-4">{searchTerm ? 'Try adjusting your search terms' : 'Add students to get started'}</div>
                {!searchTerm && (
                  <button
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    onClick={() => {
                      setStudentForm({
                        name: '',
                        email: '',
                        studentNumber: '',
                        yearLevel: studentListTab === 5 ? 1 : studentListTab,
                        curriculumId: '',
                        isIrregular: studentListTab === 5,
                      });
                      setStudentDialogOpen(true);
                    }}
                  >
                    <i className="bi bi-plus-lg"></i>
                    <span>Add {studentListTab === 5 ? 'Irregular ' : ''}Student</span>
                  </button>
                )}
              </div>
            );
          }

          if (viewMode === 'grid') {
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStudents.map((student) => (
                      <div
                          id={`student-row-${student.id}`}
                          key={student.id}
                          className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-md cursor-pointer transition-shadow relative"
                          onClick={() => handleSelectStudent(student)}
                        >
                          <div className="absolute top-2 left-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={selectedIds.includes(student.id)}
                              onClick={(e) => { e.stopPropagation(); toggleSelectId(student.id); }}
                              onChange={() => {}}
                            />
                          </div>
                    <div className="absolute bottom-2 right-2">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdown(openDropdown === student.id ? null : student.id);
                          }}
                          className="p-1 rounded-full hover:bg-gray-100"
                        >
                          <i className="bi bi-three-dots-vertical text-gray-600"></i>
                        </button>
                        {openDropdown === student.id && (
                          <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdown(null);
                                handleStartEdit(student);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                             Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdown(null);
                                handleDeleteStudent(student.id);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                             Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mb-2">
                      <div className="font-semibold text-blue-700 text-lg">{student.name}</div>
                      <div className="text-sm text-gray-600">{student.studentNumber || ''}</div>
                    </div>
                    <div className="text-sm text-gray-700 mb-1">
                      <i className="bi bi-envelope mr-1"></i>{student.email}
                    </div>
                    <div className="text-sm text-gray-700 mb-1">
                      <i className="bi bi-calendar mr-1"></i>
                      {student.yearLevel === 1 ? '1st' : student.yearLevel === 2 ? '2nd' : student.yearLevel === 3 ? '3rd' : '4th'} Year
                      {student.isIrregular ? ' - Irregular' : ''}
                    </div>
                    <div className="text-sm text-gray-700 mb-3">
                      <i className="bi bi-book mr-1"></i>{getCurriculumName(student.curriculumId)}
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          return (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-blue-700 text-white sticky top-0">
                  <tr>
                    <th className="px-2 py-1 w-[5%] text-left">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedIds.includes(s.id))}
                        onChange={() => {
                          if (filteredStudents.length > 0 && filteredStudents.every(s => selectedIds.includes(s.id))) {
                            setSelectedIds([]);
                          } else {
                            setSelectedIds(filteredStudents.map(s => s.id));
                          }
                        }}
                      />
                    </th>
                    <th
                      className="px-2 py-1 w-[20%] text-left cursor-pointer"
                      onClick={() => handleSort('studentNumber')}
                    >
                      Student No. {sortBy === 'studentNumber' ? (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 inline-flex mb-1" /> : <ChevronDown className="w-4 h-4 inline-flex mb-1" />) : <ChevronsUpDown className="w-4 h-4 inline-flex opacity-80 mb-1" />}
                    </th>
                    <th
                      className="px-2 py-1 w-[20%] text-left cursor-pointer"
                      onClick={() => handleSort('name')}
                    >
                      Name {sortBy === 'name' ? (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 inline-flex mb-1" /> : <ChevronDown className="w-4 h-4 inline-flex mb-1" />) : <ChevronsUpDown className="w-4 h-4 inline-flex opacity-80 mb-1" />}
                    </th>
                    <th
                      className="px-2 py-1 w-[20%] text-left cursor-pointer"
                      onClick={() => handleSort('email')}
                    >
                      Email {sortBy === 'email' ? (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 inline-flex mb-1" /> : <ChevronDown className="w-4 h-4 inline-flex mb-1" />) : <ChevronsUpDown className="w-4 h-4 inline-flex opacity-80 mb-1" />}
                    </th>
                    <th
                      className="px-2 py-1 w-[20%] text-left cursor-pointer"
                      onClick={() => handleSort('contactNumber')}
                    >
                      Contact No.
                    </th>
                    <th
                      className="px-2 py-1 w-[15%] text-left cursor-pointer"
                      onClick={() => handleSort('curriculum')}
                    >
                      Curriculum 
                    </th>
                    <th className="px-2 py-1 w-[10%] text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((student) => {
                    return (
                      <tr
                        id={`student-row-${student.id}`}
                        key={student.id}
                        className="border-t border-gray-300 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleSelectStudent(student)}
                      >
                        <td className="px-2 py-1">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={selectedIds.includes(student.id)}
                            onClick={(e) => { e.stopPropagation(); toggleSelectId(student.id); }}
                            onChange={() => {}}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <span className="font-semibold">{student.studentNumber || ''}</span>
                        </td>
                        <td className="px-2 py-1">
                          <span className="font-semibold">{student.name}</span>
                        </td>
                        <td className="px-2 py-1">
                          <span>{student.email}</span>
                        </td>
                    
                        <td className="px-2 py-1">
                          <span>{student.contactNumber || ''}</span>
                        </td>
                        <td className="px-2 py-1">
                          <span>{getCurriculumName(student.curriculumId)}</span>
                        </td>
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(student);
                              }}
                              className="p-1 rounded-full text-gray-700  hover:bg-gray-300 cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteStudent(student.id);
                              }}
                              className="p-1 rounded-full text-gray-700  hover:bg-gray-300 cursor-pointer"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </div>
  );

  const renderCourseTables = () => {
    if (!selectedStudent) return null;

    const currentYear = courseTab + 1;
    const scholarshipEligibility = calculateScholarshipEligibility(currentYear);
    const isThirdYearTab = courseTab === 2;

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


        <div className="flex-1 flex flex-col">
          {[1, 2, isThirdYearTab ? 3 : null].filter(Boolean).map((semester) => (
            <div key={semester} className="flex-1 flex flex-col mb-3">
              <div className="text-lg font-semibold text-blue-700 mb-2">
                {semester === 1 ? '1st' : semester === 2 ? '2nd' : 'Summer'} Semester
              </div>
             <div className="border border-gray-300 rounded-lg overflow-hidden">
  <table className="min-w-full text-sm">
    <thead className="bg-blue-700 text-white">
      <tr>
        <th className="px-2 py-1.5 w-[12%] text-left cursor-pointer" onClick={() => handleSort('courseCode')}>
          Course Code {sortBy === 'courseCode' && (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 inline-flex mb-1" /> : <ChevronDown className="w-4 h-4 inline-flex mb-1" />)}
        </th>
        <th className="px-2 py-1.5 w-[35%] text-left cursor-pointer" onClick={() => handleSort('courseTitle')}>
          Course Title {sortBy === 'courseTitle' && (sortOrder === 'asc' ? '↑' : '↓')}
        </th>
          <th className="px-2 py-1.5 w-[8%] text-center cursor-pointer" onClick={() => handleSort('units')}>
            Units {sortBy === 'units' && (sortOrder === 'asc' ? '↑' : '↓')}
        </th>
        <th className="px-2 py-1.5 w-[20%] text-left">Prerequisites</th>
        <th className="px-2 py-1.5 w-[10%] text-left">Grade</th>
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
            <td className="px-2 py-1.5">
              <span className="font-semibold text-blue-700">{course.courseCode}</span>
            </td>
            <td className="px-2 py-1.5">
              <span>{course.courseTitle}</span>
            </td>
            <td className="px-2 py-1.5 text-center">{course.units}</td>
            <td className="px-2 py-1.5">
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

            <td className="px-2 py-1.5">
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
      <div className="bg-white text-black p-6 rounded-2xl mb-6 flex items-center justify-between border border-gray-300 shadow-lg">
  
  {/* LEFT SIDE */}
  <div id="back-button-container" className="flex items-center gap-6">
    <button
      onClick={
        selectedStudent
          ? () => {
              setSelectedStudent(null);
              setStudentListTab(
                selectedStudent.isIrregular ? 5 : selectedStudent.yearLevel
              );
            }
          : onBack
      }
            className="group cursor-pointer flex items-center gap-2 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white transition-transform"
      aria-label="Back"
    >
            <ArrowBigLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
    </button>

    <div>
      {selectedStudent ? (
        <div className="flex  gap-40">
          <div>
          
            <div className="text-blue-600 font-medilum text-xl">{selectedStudent.name}</div>
            <div className="text-gray-600">
              {selectedStudent.yearLevel === 1
                ? "1st"
                : selectedStudent.yearLevel === 2
                ? "2nd"
                : selectedStudent.yearLevel === 3
                ? "3rd"
                : "4th"}{" "}
              Year
              {selectedStudent.isIrregular ? " - Irregular" : ""} Student
            </div>
          </div>

          {/* Academic Eligibility Summary */}
          <div>
            <div className="font-semibold uppercase text-sm text-gray-800">
              Academic Eligibility Summary
            </div>

            <div className="flex gap-6 flex-wrap">
              {/* 1st Sem */}
              <div>
                <div className="text-xs text-gray-600">
                  1st Semester Dean's Lister:
                </div>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs border ${
                    calculateDeansListerEligibility(1, headerYear)
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-gray-50 border-gray-200 text-gray-700"
                  }`}
                >
                  {calculateDeansListerEligibility(1, headerYear)
                    ? "Eligible"
                    : "Not Eligible"}
                </span>
              </div>

              {/* 2nd Sem */}
              <div>
                <div className="text-xs text-gray-600">
                  2nd Semester Dean's Lister:
                </div>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs border ${
                    calculateDeansListerEligibility(2, headerYear)
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-gray-50 border-gray-200 text-gray-700"
                  }`}
                >
                  {calculateDeansListerEligibility(2, headerYear)
                    ? "Eligible"
                    : "Not Eligible"}
                </span>
              </div>

              {/* Scholarship */}
              <div>
                <div className="text-xs text-gray-600">
                  Scholarship Eligibility:
                </div>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs border ${
                    headerScholarshipEligibility.eligible
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-gray-50 border-gray-200 text-gray-700"
                  }`}
                >
                  {headerScholarshipEligibility.eligible
                    ? `${headerScholarshipEligibility.percentage}% Scholarship`
                    : "Not Eligible"}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold text-blue-600">
            Student Management
          </div>
          <div className="text-gray-600">
            Manage students and track their curriculum progress
          </div>
        </>
      )}
    </div>
  </div>

  {/* RIGHT SIDE */}
  {!selectedStudent && (
    <button
      onClick={() => {
        setStudentForm({
          name: "",
          email: "",
          studentNumber: "",
          yearLevel:
            studentListTab === 0
              ? 1
              : studentListTab === 5
              ? 1
              : studentListTab,
          curriculumId: "",
          isIrregular: studentListTab === 5,
        });
        setStudentDialogOpen(true);
      }}
      className="inline-flex items-center text-sm gap-2 cursor-pointer bg-green-600 text-white px-3 py-2 rounded-full hover:bg-green-700"
    >
      <BadgePlus className="w-4 h-4" />
      <span>Add Student</span>
    </button>
  )}
</div>

      {!currentUser && (
        <div className="mb-2 rounded border border-blue-200 bg-blue-50 text-blue-800 px-4 py-2">
          Please sign in to access Student Management
        </div>
      )}

      {error && <div className="mb-2 rounded border border-red-200 bg-red-50 text-red-800 px-4 py-2">{error}</div>}
      {success && <div className="mb-2 rounded border border-green-200 bg-green-50 text-green-800 px-4 py-2">{success}</div>}

      {currentUser ? (
        <div className="flex-1 flex flex-col">
          {!selectedStudent ? (
            <div className="flex-1">
              <div>{renderStudentList()}</div>
            </div>
          ) : (
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
              <div>
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
              <div>
                <label className="block text-sm text-gray-600 mb-1">Curriculum</label>
                <select
                  className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm"
                  value={editingData.curriculumId}
                  onChange={(e) => setEditingData({ ...editingData, curriculumId: e.target.value })}
                >
                  {curriculums.map((curriculum) => (
                    <option key={curriculum.id} value={curriculum.id}>
                      {curriculum.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={editingData.isIrregular}
                  onChange={(e) => setEditingData({ ...editingData, isIrregular: e.target.checked })}
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
              <div>
                <label className="block text-sm text-gray-600 mb-1">Year Level</label>
                <select
                  className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm "
                  value={studentForm.yearLevel}
                  onChange={(e) => setStudentForm({ ...studentForm, yearLevel: parseInt(e.target.value, 10) })}
                >
                  {[1, 2, 3, 4].map((year) => (
                    <option key={year} value={year}>
                      {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Curriculum</label>
                <select
                  className="w-full border border-gray-300 rounded-lg cursor-pointer px-3 py-1.5 text-sm "
                  value={studentForm.curriculumId}
                  onChange={(e) => setStudentForm({ ...studentForm, curriculumId: e.target.value })}
                >
                  {curriculums.map((curriculum) => (
                    <option key={curriculum.id} value={curriculum.id}>
                      {curriculum.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={studentForm.isIrregular}
                  onChange={(e) => setStudentForm({ ...studentForm, isIrregular: e.target.checked })}
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