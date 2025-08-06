import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';

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

const StudentManagement = () => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentCourses, setStudentCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tabValue, setTabValue] = useState(0);
  
  // Student form state
  const [studentForm, setStudentForm] = useState({
    name: '',
    email: '',
    studentNumber: '',
    yearLevel: 1,
    curriculumId: '',
    isIrregular: false
  });
  
  // Dialog states
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingData, setEditingData] = useState({});
  
  // Grade management state
  const [studentGrades, setStudentGrades] = useState({});
  const [editingGrades, setEditingGrades] = useState({});

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

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

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
    
    setLoading(true);
    setError('');
    const result = await addStudent(studentForm);
    if (result.success) {
      setSuccess('Student added successfully!');
      setStudentForm({ name: '', email: '', studentNumber: '', yearLevel: 1, curriculumId: '', isIrregular: false });
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
    setEditingStudent(student.id);
    setEditingData({
      name: student.name,
      email: student.email,
      studentNumber: student.studentNumber,
      yearLevel: student.yearLevel,
      curriculumId: student.curriculumId,
      isIrregular: student.isIrregular || false
    });
  };

  const handleCancelEdit = () => {
    setEditingStudent(null);
    setEditingData({});
  };

  const handleSaveEdit = async (studentId) => {
    if (!currentUser) {
      setError('Please sign in to update student data');
      return;
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
      setTabValue(editingData.yearLevel - 1);
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

    if (!window.confirm('Are you sure you want to delete this student?')) return;

    setLoading(true);
    setError('');
    
    try {
      await deleteDoc(doc(db, 'students', studentId));
      
      setStudents(prevStudents => prevStudents.filter(student => student.id !== studentId));
      
      // Clear selected student if it's the one being deleted
      if (selectedStudent && selectedStudent.id === studentId) {
        setSelectedStudent(null);
      }
      
      setSuccess('Student deleted successfully!');
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

  const getCurriculumName = (curriculumId) => {
    const curriculum = curriculums.find(c => c.id === curriculumId);
    return curriculum ? curriculum.name : 'Unknown';
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
    <Box>
      <TextField
        fullWidth
        placeholder="Search students by name or curriculum..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 3 }}
        size="small"
      />

      <Box sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          {[1, 2, 3, 4].map(year => (
            <Tab 
              key={year} 
              label={`${year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year (${getStudentCountByYear(year)})`} 
            />
          ))}
          <Tab label={`Irregular (${getIrregularStudentCount()})`} />
        </Tabs>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          {tabValue === 4 ? 'Irregular Students' : `Students in ${tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year`}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setStudentForm({ 
              name: '', 
              email: '', 
              studentNumber: '', 
              yearLevel: tabValue === 4 ? 1 : tabValue + 1, 
              curriculumId: '', 
              isIrregular: tabValue === 4 
            });
            setStudentDialogOpen(true);
          }}
          size="small"
        >
          Add {tabValue === 4 ? 'Irregular ' : ''}Student
        </Button>
      </Box>
      
      <Box sx={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', overflowX: 'hidden' }}>
        {(() => {
          let filteredStudents;
          
          if (tabValue === 4) {
            // Show irregular students from all years
            filteredStudents = students.filter(student => student.isIrregular);
          } else {
            // Show regular students by year level
            filteredStudents = students.filter(student => 
              student.yearLevel === (tabValue + 1) && !student.isIrregular
            );
          }
          
          // Filter by search term
          if (searchTerm) {
            filteredStudents = filteredStudents.filter(student => 
              student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              getCurriculumName(student.curriculumId).toLowerCase().includes(searchTerm.toLowerCase())
            );
          }
          
          if (filteredStudents.length === 0) {
            return (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {searchTerm ? 'No students found' : 
                   tabValue === 4 ? 'No irregular students' : 
                   `No students in Year ${tabValue + 1}`}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {searchTerm ? 'Try adjusting your search terms' : 'Add students to get started'}
                </Typography>
                {!searchTerm && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setStudentForm({ 
                        name: '', 
                        email: '', 
                        studentNumber: '', 
                        yearLevel: tabValue === 4 ? 1 : tabValue + 1, 
                        curriculumId: '', 
                        isIrregular: tabValue === 4 
                      });
                      setStudentDialogOpen(true);
                    }}
                  >
                    Add {tabValue === 4 ? 'Irregular ' : ''}Student
                  </Button>
                )}
              </Box>
            );
          }
          
          return (
            <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: 1, width: '100%' }}>
              <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '5%' }}>#</TableCell>
                    <TableCell sx={{ width: '20%' }}>Student Number</TableCell>
                    <TableCell sx={{ width: '20%' }}>Name</TableCell>
                    <TableCell sx={{ width: '20%' }}>Email</TableCell>
                    <TableCell sx={{ width: '10%' }}>Year Level</TableCell>
                    <TableCell sx={{ width: '15%' }}>Curriculum</TableCell>
                    <TableCell sx={{ width: '10%' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredStudents.map((student, index) => {
                    const isEditing = editingStudent === student.id;
                    const data = isEditing ? editingData : student;
                    
                    return (
                      <TableRow 
                        key={student.id}
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': { bgcolor: '#f5f5f5' }
                        }}
                        onClick={() => !isEditing && setSelectedStudent(student)}
                      >
                        <TableCell sx={{ width: '5%' }}>
                          <Typography variant="body2" color="text.secondary">
                            {index + 1}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ width: '20%' }}>
                          {isEditing ? (
                            <TextField
                              size="small"
                              value={data.studentNumber || ''}
                              onChange={(e) => handleInputChange('studentNumber', e.target.value)}
                              fullWidth
                            />
                          ) : (
                            <Typography variant="body2" fontWeight="bold" noWrap>
                              {student.studentNumber || 'N/A'}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ width: '20%' }}>
                          {isEditing ? (
                            <TextField
                              size="small"
                              value={data.name}
                              onChange={(e) => handleInputChange('name', e.target.value)}
                              fullWidth
                            />
                          ) : (
                            <Typography variant="body2" fontWeight="bold" noWrap>
                              {student.name}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ width: '20%' }}>
                          {isEditing ? (
                            <TextField
                              size="small"
                              value={data.email}
                              onChange={(e) => handleInputChange('email', e.target.value)}
                              fullWidth
                            />
                          ) : (
                            <Typography variant="body2" noWrap>
                              {student.email}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ width: '10%' }}>
                          {isEditing ? (
                            <FormControl size="small" fullWidth>
                              <Select
                                value={data.yearLevel}
                                onChange={(e) => handleInputChange('yearLevel', e.target.value)}
                              >
                                {[1, 2, 3, 4].map(year => (
                                  <MenuItem key={year} value={year}>{year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          ) : (
                            <Typography variant="body2" noWrap>
                              {student.yearLevel === 1 ? '1st' : student.yearLevel === 2 ? '2nd' : student.yearLevel === 3 ? '3rd' : '4th'} Year
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ width: '20%' }}>
                          {isEditing ? (
                            <FormControl size="small" fullWidth>
                              <Select
                                value={data.curriculumId}
                                onChange={(e) => handleInputChange('curriculumId', e.target.value)}
                              >
                                {curriculums.map(curriculum => (
                                  <MenuItem key={curriculum.id} value={curriculum.id}>
                                    {curriculum.name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          ) : (
                            <Typography variant="body2" noWrap>
                              {getCurriculumName(student.curriculumId)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ width: '10%' }}>
                          <Box display="flex" gap={0.5} flexWrap="wrap" alignItems="center">
                            {isEditing ? (
                              <>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  onClick={() => handleSaveEdit(student.id)}
                                  disabled={!data.name || !data.email || !data.curriculumId || !data.studentNumber}
                                  sx={{ minWidth: 'auto', px: 1 }}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleCancelEdit()}
                                  sx={{ minWidth: 'auto', px: 1 }}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEdit(student);
                                  }}
                                  sx={{ minWidth: 'auto', px: 1 }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteStudent(student.id);
                                  }}
                                  sx={{ minWidth: 'auto', px: 1 }}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  
                  {filteredStudents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          {tabValue === 4 ? 'No irregular students' : `No students in ${tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year`}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          );
        })()}
      </Box>
    </Box>
  );

  const renderCourseTables = () => {
    if (!selectedStudent) return null;

    const currentYear = tabValue + 1;
    const scholarshipEligibility = calculateScholarshipEligibility(currentYear);
    const isThirdYearTab = tabValue === 2;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography variant="h5" fontWeight="bold" sx={{ flexShrink: 0 }}>
          {selectedStudent.name} - Course Management
        </Typography>

        {/* Eligibility Summary */}
        <Box sx={{ mb: 3, p: 2, bgcolor: '#f8f9fa', borderRadius: 2, border: '1px solid #e0e0e0', flexShrink: 0 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Academic Eligibility Summary - {currentYear === 1 ? '1st' : currentYear === 2 ? '2nd' : currentYear === 3 ? '3rd' : '4th'} Year
          </Typography>
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="body2" fontWeight={500} color="text.secondary">
                1st Semester Dean's Lister:
              </Typography>
              <Chip 
                label={calculateDeansListerEligibility(1, currentYear) ? "Eligible" : "Not Eligible"}
                color={calculateDeansListerEligibility(1, currentYear) ? "success" : "default"}
                size="small"
                variant="outlined"
              />
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={500} color="text.secondary">
                2nd Semester Dean's Lister:
              </Typography>
              <Chip 
                label={calculateDeansListerEligibility(2, currentYear) ? "Eligible" : "Not Eligible"}
                color={calculateDeansListerEligibility(2, currentYear) ? "success" : "default"}
                size="small"
                variant="outlined"
              />
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={500} color="text.secondary">
                Scholarship Eligibility:
              </Typography>
              <Chip 
                label={scholarshipEligibility.eligible ? `${scholarshipEligibility.percentage}% Scholarship` : "Not Eligible"}
                color={scholarshipEligibility.eligible ? "primary" : "default"}
                size="small"
                variant="outlined"
              />
            </Box>
          </Box>
        </Box>

        <Box sx={{ mb: 2, flexShrink: 0 }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            {[1, 2, 3, 4].map(year => (
              <Tab key={year} label={`${year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year`} />
            ))}
          </Tabs>
        </Box>

        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {([1, 2, (isThirdYearTab ? 3 : null)].filter(Boolean)).map(semester => (
            <Box key={semester} sx={{ flex: 1, display: 'flex', flexDirection: 'column', mb: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold', flexShrink: 0 }}>
                {semester === 1 ? '1st' : semester === 2 ? '2nd' : 'Summer'} Semester
              </Typography>
              <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: 1, flex: 1 }}>
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 'bold', width: '12%' }}>Course Code</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '35%' }}>Course Title</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '8%' }}>Units</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Prerequisites</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '10%' }}>Grade</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {studentCourses
                      .filter(course => course.yearLevel === currentYear && course.semester === semester)
                      .map((course) => (
                        <TableRow key={course.id} sx={{ '&:hover': { bgcolor: '#f9f9f9' } }}>
                          <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Typography variant="body2" fontWeight="bold" color="primary" noWrap>
                              {course.courseCode}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <Typography variant="body2" noWrap>
                              {course.courseTitle}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {course.units}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ overflow: 'hidden' }}>
                            {course.prerequisites.length > 0 ? (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {course.prerequisites.slice(0, 2).map(prereq => (
                                  <Chip 
                                    key={prereq} 
                                    label={prereq} 
                                    size="small" 
                                    color={isCourseCompleted(prereq) ? 'success' : 'error'}
                                    sx={{ fontSize: '0.7rem', height: 20 }}
                                  />
                                ))}
                                {course.prerequisites.length > 2 && (
                                  <Chip 
                                    label={`+${course.prerequisites.length - 2}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem', height: 20 }}
                                  />
                                )}
                              </Box>
                            ) : (
                              <Typography variant="body2" color="text.secondary" noWrap>
                                None
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <FormControl size="small" sx={{ minWidth: 100, maxWidth: 120 }}>
                              <Select
                                value={editingGrades[course.courseCode] || ''}
                                onChange={(e) => handleGradeChange(course.courseCode, e.target.value)}
                                displayEmpty
                                sx={{ 
                                  '& .MuiSelect-select': {
                                    fontSize: '0.8rem',
                                    padding: '4px 8px'
                                  }
                                }}
                              >
                                <MenuItem value="" disabled>
                                  Select Grade
                                </MenuItem>
                                <MenuItem value="1.0">1.0</MenuItem>
                                <MenuItem value="1.1">1.1</MenuItem>
                                <MenuItem value="1.2">1.2</MenuItem>
                                <MenuItem value="1.3">1.3</MenuItem>
                                <MenuItem value="1.4">1.4</MenuItem>
                                <MenuItem value="1.5">1.5</MenuItem>
                                <MenuItem value="1.6">1.6</MenuItem>
                                <MenuItem value="1.7">1.7</MenuItem>
                                <MenuItem value="1.8">1.8</MenuItem>
                                <MenuItem value="1.9">1.9</MenuItem>
                                <MenuItem value="2.0">2.0</MenuItem>
                                <MenuItem value="2.1">2.1</MenuItem>
                                <MenuItem value="2.2">2.2</MenuItem>
                                <MenuItem value="2.3">2.3</MenuItem>
                                <MenuItem value="2.4">2.4</MenuItem>
                                <MenuItem value="2.5">2.5</MenuItem>
                                <MenuItem value="2.6">2.6</MenuItem>
                                <MenuItem value="2.7">2.7</MenuItem>
                                <MenuItem value="2.8">2.8</MenuItem>
                                <MenuItem value="2.9">2.9</MenuItem>
                                <MenuItem value="3.0">3.0</MenuItem>
                                <MenuItem value="5.0">5.0 (Failed)</MenuItem>
                                <MenuItem value="INC">INC (Incomplete)</MenuItem>
                                <MenuItem value="CRED">CRED (Credited)</MenuItem>
                                <MenuItem value="" sx={{ color: 'error.main', fontStyle: 'italic' }}>
                                  No Grade
                                </MenuItem>
                              </Select>
                            </FormControl>
                            {/* Status indicators based on grade */}
                            {studentGrades[course.courseCode] && (
                              <Box sx={{ mt: 0.5 }}>
                                {studentGrades[course.courseCode] === '5.0' && (
                                  <Typography variant="caption" color="error" display="block">
                                    Failed
                                  </Typography>
                                )}
                                {studentGrades[course.courseCode] === 'INC' && (
                                  <Typography variant="caption" color="warning.main" display="block">
                                    Incomplete
                                  </Typography>
                                )}
                                {studentGrades[course.courseCode] === 'CRED' && (
                                  <Typography variant="caption" color="success.main" display="block">
                                    Credited
                                  </Typography>
                                )}
                                {studentGrades[course.courseCode] && 
                                 studentGrades[course.courseCode] !== '5.0' && 
                                 studentGrades[course.courseCode] !== 'INC' && 
                                 studentGrades[course.courseCode] !== 'CRED' && (
                                  <Typography variant="caption" color="success.main" display="block">
                                    Completed
                                  </Typography>
                                )}
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    {studentCourses.filter(course => course.yearLevel === currentYear && course.semester === semester).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            No courses in Year {currentYear}, {semester === 1 ? '1st' : semester === 2 ? '2nd' : 'Summer'} Semester
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))}
        </Box>


      </Box>
    );
  };

  return (
    <Box p={3} sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" gutterBottom>
        Student Management
      </Typography>
      
      {!currentUser && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Please sign in to access Student Management
        </Alert>
      )}
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      
      {currentUser ? (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!selectedStudent ? (
            // Show student list when no student is selected
            <Box sx={{ flex: 1 }}>
              <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa', height: '100%' }}>
                {renderStudentList()}
              </Box>
            </Box>
          ) : (
            // Show full screen course tables when student is selected
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Box sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa', flexShrink: 0 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">Selected Student</Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setSelectedStudent(null)}
                  >
                    Back to Students
                  </Button>
                </Box>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {selectedStudent.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Year {selectedStudent.yearLevel} • {getCurriculumName(selectedStudent.curriculumId)} • {selectedStudent.completedCourses?.length || 0} courses completed
                  </Typography>
                  {selectedStudent.isIrregular && (
                    <Chip label="Irregular" color="warning" size="small" sx={{ ml: 1 }} />
                  )}
                </Box>
              </Box>
              
              <Box sx={{ flex: 1, p: 2, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {renderCourseTables()}
              </Box>
            </Box>
          )}
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ p: 4, textAlign: 'center', border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa' }}>
            <Typography variant="h6" color="text.secondary">
              Sign in to access student management features
            </Typography>
          </Box>
        </Box>
      )}

      {/* Student Dialog */}
      <Dialog open={studentDialogOpen} onClose={() => setStudentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {studentForm.isIrregular ? 'Add New Irregular Student' : 'Add New Student'}
        </DialogTitle>
        <DialogContent>
          {studentForm.isIrregular && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Irregular students can take courses from different curriculums and have access to equivalent subjects.
            </Alert>
          )}
          <TextField
            fullWidth
            label="Student Number"
            value={studentForm.studentNumber || ''}
            onChange={(e) => setStudentForm({ ...studentForm, studentNumber: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Student Name"
            value={studentForm.name}
            onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={studentForm.email || ''}
            onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Year Level</InputLabel>
            <Select
              value={studentForm.yearLevel}
              onChange={(e) => setStudentForm({ ...studentForm, yearLevel: e.target.value })}
            >
              {[1, 2, 3, 4].map(year => (
                <MenuItem key={year} value={year}>{year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Curriculum</InputLabel>
            <Select
              value={studentForm.curriculumId}
              onChange={(e) => setStudentForm({ ...studentForm, curriculumId: e.target.value })}
            >
              {curriculums.map(curriculum => (
                <MenuItem key={curriculum.id} value={curriculum.id}>
                  {curriculum.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStudentDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleAddStudent} 
            variant="contained" 
            disabled={loading || !studentForm.name || !studentForm.curriculumId}
          >
            Add {studentForm.isIrregular ? 'Irregular ' : ''}Student
          </Button>
        </DialogActions>
      </Dialog>


    </Box>
  );
};

export default StudentManagement;