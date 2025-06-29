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
      loadStudents(); // Refresh to get updated data
      // Update selected student with new completed courses
      const updatedStudent = students.find(s => s.id === selectedStudent.id);
      if (updatedStudent) {
        setSelectedStudent(updatedStudent);
      }
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

  const renderStudentList = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Students</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setStudentDialogOpen(true)}
        >
          Add Student
        </Button>
      </Box>
      
      <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
        {[1, 2, 3, 4].map(year => (
          <Tab key={year} label={`Year ${year}`} />
        ))}
      </Tabs>
      
      <Box mt={2}>
        <Grid container spacing={2}>
          {getFilteredStudents().map((student) => (
            <Grid item xs={12} sm={6} md={4} key={student.id}>
              <Card 
                elevation={selectedStudent?.id === student.id ? 4 : 1}
                sx={{ 
                  cursor: 'pointer',
                  border: selectedStudent?.id === student.id ? 2 : 0,
                  borderColor: 'primary.main'
                }}
                onClick={() => setSelectedStudent(student)}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {student.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Year {student.yearLevel}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {getCurriculumName(student.curriculumId)}
                  </Typography>
                  <Box mt={1}>
                    <Chip 
                      label={`${student.completedCourses?.length || 0} courses completed`} 
                      size="small" 
                      color="primary" 
                    />
                  </Box>
                </CardContent>
                <CardActions>
                  <IconButton 
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStudent(student);
                      setCourseManagementDialogOpen(true);
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" color="error">
                    <DeleteIcon />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );

  const renderCourseManagement = () => (
    <Box>
      {selectedStudent ? (
        <>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Course Management - {selectedStudent.name}
            </Typography>
            <Button
              variant="outlined"
              onClick={() => setCourseManagementDialogOpen(true)}
            >
              Manage Courses
            </Button>
          </Box>
          
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Year {selectedStudent.yearLevel} • {getCurriculumName(selectedStudent.curriculumId)}
          </Typography>
          
          <Box mt={2}>
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
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Course Code</TableCell>
                              <TableCell>Course Title</TableCell>
                              <TableCell>Units</TableCell>
                              <TableCell>Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {studentCourses
                              .filter(course => course.yearLevel === year && course.semester === semester)
                              .map((course) => (
                                <TableRow key={course.id}>
                                  <TableCell>{course.courseCode}</TableCell>
                                  <TableCell>{course.courseTitle}</TableCell>
                                  <TableCell>{course.units}</TableCell>
                                  <TableCell>
                                    <Chip 
                                      label={isCourseCompleted(course.courseCode) ? 'Completed' : 'Not Taken'}
                                      color={isCourseCompleted(course.courseCode) ? 'success' : 'default'}
                                      size="small"
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  ))}
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </>
      ) : (
        <Typography variant="body1" color="text.secondary" align="center">
          Please select a student to manage their courses
        </Typography>
      )}
    </Box>
  );

  return (
    <Box p={3}>
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
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper elevation={2} sx={{ p: 2, height: 'fit-content' }}>
              {renderStudentList()}
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={8}>
            <Paper elevation={2} sx={{ p: 2 }}>
              {renderCourseManagement()}
            </Paper>
          </Grid>
        </Grid>
      ) : (
        <Paper elevation={2} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Sign in to access student management features
          </Typography>
        </Paper>
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
          <FormControl fullWidth margin="normal">
            <InputLabel>Year Level</InputLabel>
            <Select
              value={studentForm.yearLevel}
              onChange={(e) => setStudentForm({ ...studentForm, yearLevel: e.target.value })}
            >
              {[1, 2, 3, 4].map(year => (
                <MenuItem key={year} value={year}>Year {year}</MenuItem>
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