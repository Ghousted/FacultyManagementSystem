import { useState, useEffect } from 'react';
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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { 
  addStudent, 
  getStudents, 
  getStudentsByYearLevel, 
  updateStudentCourse,
  getCurriculums,
  getCoursesByCurriculum 
} from '../../models/curriculumModels';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
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
  const [selectedYearLevel, setSelectedYearLevel] = useState(1);
  const [tabValue, setTabValue] = useState(0);
  
  // Student form state
  const [studentForm, setStudentForm] = useState({
    name: '',
    yearLevel: 1,
    curriculumId: ''
  });
  
  // Dialog states
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [courseManagementDialogOpen, setCourseManagementDialogOpen] = useState(false);
  const [selectedYearFilter, setSelectedYearFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [newStudentData, setNewStudentData] = useState({
    name: '',
    email: '',
    studentNumber: '',
    yearLevel: 1,
    curriculumId: ''
  });

  useEffect(() => {
    if (currentUser) {
      loadStudents();
      loadCurriculums();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedStudent) {
      loadStudentCourses(selectedStudent.curriculumId);
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

  useEffect(() => {
    // Update new student data year level when tab changes
    setNewStudentData(prev => ({ ...prev, yearLevel: tabValue + 1 }));
  }, [tabValue]);

  const loadStudents = async () => {
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
  };

  const loadCurriculums = async () => {
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
    
    setLoading(true);
    setError('');
    const result = await addStudent(studentForm);
    if (result.success) {
      setSuccess('Student added successfully!');
      setStudentForm({ name: '', yearLevel: 1, curriculumId: '' });
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
    setEditingData({ ...student });
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
        curriculumId: editingData.curriculumId,
        updatedAt: new Date()
      });
      
      setSuccess('Student updated successfully!');
      setEditingStudent(null);
      setEditingData({});
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
    setHasChanges(true);
  };

  const handleNewStudentInputChange = (field, value) => {
    setNewStudentData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddNewStudent = async () => {
    if (!currentUser) {
      setError('Please sign in to add a student');
      return;
    }
    
    setLoading(true);
    setError('');
    const result = await addStudent({
      ...newStudentData,
      yearLevel: tabValue + 1
    });
    if (result.success) {
      setSuccess('Student added successfully!');
      setNewStudentData({ name: '', email: '', studentNumber: '', yearLevel: tabValue + 1, curriculumId: '' });
      loadStudents();
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const getStudentsByYear = (year) => {
    return students.filter(student => student.yearLevel === year);
  };

  const getCurriculumName = (curriculumId) => {
    const curriculum = curriculums.find(c => c.id === curriculumId);
    return curriculum ? curriculum.name : 'Unknown';
  };

  const isCourseCompleted = (courseCode) => {
    return selectedStudent?.completedCourses?.includes(courseCode) || false;
  };

  const getFilteredStudents = () => {
    if (selectedYearFilter === 'all') {
      return students;
    }
    return students.filter(student => student.yearLevel === parseInt(selectedYearFilter));
  };

  const getFilteredAndGroupedStudents = () => {
    let filteredStudents = students;
    
    // Filter by search term
    if (searchTerm) {
      filteredStudents = students.filter(student => 
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCurriculumName(student.curriculumId).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Group by year level
    const grouped = {};
    filteredStudents.forEach(student => {
      const year = student.yearLevel;
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(student);
    });
    
    return grouped;
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
            <Tab key={year} label={`${year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year`} />
          ))}
        </Tabs>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Students in {tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year
        </Typography>
      </Box>
      
      <Box sx={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', overflowX: 'hidden' }}>
        {(() => {
          let filteredStudents = students.filter(student => student.yearLevel === (tabValue + 1));
          
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
                  {searchTerm ? 'No students found' : `No students in Year ${tabValue + 1}`}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {searchTerm ? 'Try adjusting your search terms' : 'Add students to get started'}
                </Typography>
                {!searchTerm && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setStudentDialogOpen(true)}
                  >
                    Add Student
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
                    <TableCell sx={{ width: '20%' }}>Student Number</TableCell>
                    <TableCell sx={{ width: '25%' }}>Name</TableCell>
                    <TableCell sx={{ width: '30%' }}>Email</TableCell>
                    <TableCell sx={{ width: '15%' }}>Curriculum</TableCell>
                    <TableCell sx={{ width: '10%' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredStudents.map((student) => {
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
                        <TableCell sx={{ width: '25%' }}>
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
                        <TableCell sx={{ width: '30%' }}>
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
                        <TableCell sx={{ width: '15%' }}>
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
                          <Box display="flex" gap={0.5} flexWrap="wrap">
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
                  
                  {/* New Student Row */}
                  <TableRow sx={{ bgcolor: '#f0f8ff', '&:hover': { bgcolor: '#e6f3ff' } }}>
                    <TableCell sx={{ width: '20%' }}>
                      <TextField
                        size="small"
                        placeholder="Student Number"
                        value={newStudentData.studentNumber}
                        onChange={(e) => handleNewStudentInputChange('studentNumber', e.target.value)}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell sx={{ width: '25%' }}>
                      <TextField
                        size="small"
                        placeholder="Student Name"
                        value={newStudentData.name}
                        onChange={(e) => handleNewStudentInputChange('name', e.target.value)}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell sx={{ width: '30%' }}>
                      <TextField
                        size="small"
                        placeholder="Email"
                        value={newStudentData.email}
                        onChange={(e) => handleNewStudentInputChange('email', e.target.value)}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell sx={{ width: '15%' }}>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={newStudentData.curriculumId}
                          onChange={(e) => handleNewStudentInputChange('curriculumId', e.target.value)}
                          displayEmpty
                        >
                          <MenuItem value="" disabled>
                            Select Curriculum
                          </MenuItem>
                          {curriculums.map(curriculum => (
                            <MenuItem key={curriculum.id} value={curriculum.id}>
                              {curriculum.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell sx={{ width: '10%' }}>
                      <Button
                        variant="contained"
                        size="small"
                        color="success"
                        onClick={handleAddNewStudent}
                        disabled={loading || !newStudentData.name || !newStudentData.curriculumId || !newStudentData.studentNumber || !newStudentData.email}
                        sx={{ minWidth: 60 }}
                      >
                        Add
                      </Button>
                    </TableCell>
                  </TableRow>
                  
                  {filteredStudents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No students in {selectedYear === 1 ? '1st' : selectedYear === 2 ? '2nd' : selectedYear === 3 ? '3rd' : '4th'} Year
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

    return (
      <Box>
        <Typography variant="h5" fontWeight="bold">
          {selectedStudent.name} - Course Management
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            {[1, 2, 3, 4].map(year => (
              <Tab key={year} label={`${year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year`} />
            ))}
          </Tabs>
        </Box>

        <Box sx={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
          {[1, 2].map(semester => (
            <Box key={semester} mb={4}>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                {semester === 1 ? '1st' : '2nd'} Semester
              </Typography>
              
              <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Course Code</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Course Title</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '10%' }}>Units</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Prerequisites</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '10%' }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {studentCourses
                      .filter(course => course.yearLevel === (tabValue + 1) && course.semester === semester)
                      .map((course) => (
                        <TableRow key={course.id} sx={{ '&:hover': { bgcolor: '#f9f9f9' } }}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold" color="primary">
                              {course.courseCode}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {course.courseTitle}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {course.units}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {course.prerequisites.length > 0 ? (
                              <Box>
                                {course.prerequisites.map(prereq => (
                                  <Chip 
                                    key={prereq} 
                                    label={prereq} 
                                    size="small" 
                                    color={isCourseCompleted(prereq) ? 'success' : 'error'}
                                    sx={{ mr: 0.5, mb: 0.5 }} 
                                  />
                                ))}
                              </Box>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                None
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                              <Select
                                value={isCourseCompleted(course.courseCode) ? 'completed' : 'not-completed'}
                                onChange={(e) => handleUpdateStudentCourse(course.courseCode, e.target.value === 'completed')}
                                sx={{ 
                                  bgcolor: isCourseCompleted(course.courseCode) ? '#e8f5e9' : '#fff3e0',
                                  '& .MuiSelect-select': {
                                    color: isCourseCompleted(course.courseCode) ? '#2e7d32' : '#f57c00'
                                  }
                                }}
                              >
                                <MenuItem value="completed" sx={{ color: '#2e7d32' }}>
                                  Completed
                                </MenuItem>
                                <MenuItem value="not-completed" sx={{ color: '#f57c00' }}>
                                  Not Completed
                                </MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>
                        </TableRow>
                      ))}
                    
                    {studentCourses.filter(course => course.yearLevel === (tabValue + 1) && course.semester === semester).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            No courses in Year {tabValue + 1}, Semester {semester}
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
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa' }}>
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
                </Box>
              </Box>
              
              <Box sx={{ flex: 1, p: 2, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa', overflow: 'hidden' }}>
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
        <DialogTitle>Add New Student</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Student Name"
            value={studentForm.name}
            onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
            margin="normal"
          />
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal" size="small">
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
          </Grid>
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
          <Button onClick={handleAddStudent} variant="contained" disabled={loading}>
            Add Student
          </Button>
        </DialogActions>
      </Dialog>

      {/* Course Management Dialog */}
      <Dialog 
        open={courseManagementDialogOpen} 
        onClose={() => setCourseManagementDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Manage Courses - {selectedStudent?.name}
        </DialogTitle>
        <DialogContent>
          {selectedStudent && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Check the courses that {selectedStudent.name} has completed:
              </Typography>
              
              {[1, 2, 3, 4].map(year => (
                <Accordion key={year}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6">Year {year}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {[1, 2].map(semester => (
                      <Box key={semester} mb={2}>
                        <Typography variant="subtitle1" gutterBottom>
                          Semester {semester}
                        </Typography>
                        <List>
                          {studentCourses
                            .filter(course => course.yearLevel === year && course.semester === semester)
                            .map((course) => (
                              <ListItem key={course.id} dense>
                                <Checkbox
                                  checked={isCourseCompleted(course.courseCode)}
                                  onChange={(e) => handleUpdateStudentCourse(course.courseCode, e.target.checked)}
                                />
                                <ListItemText
                                  primary={`${course.courseCode} - ${course.courseTitle}`}
                                  secondary={`${course.units} units`}
                                />
                              </ListItem>
                            ))}
                        </List>
                      </Box>
                    ))}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCourseManagementDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StudentManagement; 