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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getStudents, getStudentCurriculumStatus } from '../../models/curriculumModels';
import { useAuth } from '../../contexts/AuthContext';

const CurriculumCheckerMain = () => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentCurriculum, setStudentCurriculum] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [curriculumDialogOpen, setCurriculumDialogOpen] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadStudents();
    }
  }, [currentUser]);

  useEffect(() => {
    // Filter students based on search term
    const filtered = students.filter(student =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredStudents(filtered);
  }, [students, searchTerm]);

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

  const handleStudentSelect = async (student) => {
    setSelectedStudent(student);
    setLoading(true);
    
    const result = await getStudentCurriculumStatus(student.id);
    if (result.success) {
      setStudentCurriculum(result.data);
      setCurriculumDialogOpen(true);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleCheckCurriculum = async () => {
    if (!currentUser) {
      setError('Please sign in to check curriculum status');
      return;
    }
    
    if (!selectedStudent) {
      setError('Please select a student first');
      return;
    }

    setLoading(true);
    setError('');
    const result = await getStudentCurriculumStatus(selectedStudent.id);
    if (result.success) {
      setStudentCurriculum(result.data);
      setSuccess('Curriculum status loaded successfully!');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'blocked':
        return 'error';
      case 'available':
        return 'primary';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'blocked':
        return 'Blocked (Prerequisite not met)';
      case 'available':
        return 'Available';
      default:
        return 'Not Taken';
    }
  };

  const renderStudentList = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Search Students
      </Typography>
      
      <TextField
        fullWidth
        placeholder="Search by student name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />
      
      <Grid container spacing={2}>
        {filteredStudents.map((student) => (
          <Grid item xs={12} sm={6} md={4} key={student.id}>
            <Card 
              sx={{ cursor: 'pointer' }}
              onClick={() => handleStudentSelect(student)}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {student.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Year {student.yearLevel}
                </Typography>
                <Box mt={1}>
                  <Chip 
                    label={`${student.completedCourses?.length || 0} courses completed`} 
                    size="small" 
                    color="primary" 
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {filteredStudents.length === 0 && searchTerm && (
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mt: 4 }}>
          No students found matching "{searchTerm}"
        </Typography>
      )}
    </Box>
  );

  const renderCurriculumView = () => {
    if (!studentCurriculum) return null;

    const { student, courses } = studentCurriculum;

    return (
      <Box>
        <Typography variant="h5" gutterBottom>
          {student.name}'s Curriculum
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Year {student.yearLevel} • {student.completedCourses?.length || 0} courses completed
        </Typography>
        
        <Box mt={3}>
          {[1, 2, 3, 4].map(year => (
            <Accordion key={year}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Year {year}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {[1, 2].map(semester => (
                  <Box key={semester} mb={3}>
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
                            <TableCell>Prerequisites</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {courses
                            .filter(course => course.yearLevel === year && course.semester === semester)
                            .map((course) => (
                              <TableRow 
                                key={course.id}
                                sx={{
                                  backgroundColor: course.status === 'completed' ? '#e8f5e9' : 
                                                 course.status === 'blocked' ? '#ffebee' : 'inherit'
                                }}
                              >
                                <TableCell>
                                  <Typography variant="body2" fontWeight="bold">
                                    {course.courseCode}
                                  </Typography>
                                </TableCell>
                                <TableCell>{course.courseTitle}</TableCell>
                                <TableCell>{course.units}</TableCell>
                                <TableCell>
                                  {course.prerequisites.length > 0 ? (
                                    course.prerequisites.map(prereq => (
                                      <Chip 
                                        key={prereq} 
                                        label={prereq} 
                                        size="small" 
                                        color={student.completedCourses?.includes(prereq) ? 'success' : 'error'}
                                        sx={{ mr: 0.5, mb: 0.5 }}
                                      />
                                    ))
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">
                                      None
                                    </Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Chip 
                                    label={getStatusLabel(course.status)}
                                    color={getStatusColor(course.status)}
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
        
        <Box mt={3} p={2} bgcolor="#f5f5f5" borderRadius={1}>
          <Typography variant="h6" gutterBottom>
            Legend
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Box display="flex" alignItems="center">
                <Box width={20} height={20} bgcolor="#e8f5e9" borderRadius={1} mr={1}></Box>
                <Typography variant="body2">Completed</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box display="flex" alignItems="center">
                <Box width={20} height={20} bgcolor="inherit" borderRadius={1} mr={1}></Box>
                <Typography variant="body2">Available</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box display="flex" alignItems="center">
                <Box width={20} height={20} bgcolor="#ffebee" borderRadius={1} mr={1}></Box>
                <Typography variant="body2">Blocked (Prerequisite not met)</Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>
    );
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Curriculum Checker
      </Typography>
      
      {!currentUser && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Please sign in to access the Curriculum Checker
        </Alert>
      )}
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      
      {currentUser ? (
        <Paper elevation={2} sx={{ p: 3 }}>
          {renderStudentList()}
        </Paper>
      ) : (
        <Paper elevation={2} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Sign in to access curriculum checking features
          </Typography>
        </Paper>
      )}

      {/* Curriculum Dialog */}
      <Dialog 
        open={curriculumDialogOpen} 
        onClose={() => setCurriculumDialogOpen(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          Curriculum Status
        </DialogTitle>
        <DialogContent>
          {renderCurriculumView()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCurriculumDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CurriculumCheckerMain; 