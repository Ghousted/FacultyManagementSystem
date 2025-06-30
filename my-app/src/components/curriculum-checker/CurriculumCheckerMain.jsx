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
  Tabs,
  Tab,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getStudents, getStudentCurriculumStatus, getCoursesByCurriculum } from '../../models/curriculumModels';
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
  const [tabValue, setTabValue] = useState(0);
  const [studentCourses, setStudentCourses] = useState([]);

  useEffect(() => {
    if (currentUser) {
      loadStudents();
    }
  }, [currentUser]);

  useEffect(() => {
    // Filter students based on search term and year level
    let filtered = students.filter(student => student.yearLevel === (tabValue + 1));
    
    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredStudents(filtered);
  }, [students, searchTerm, tabValue]);

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
      // Load courses for the first student to have course data available
      if (result.data.length > 0) {
        await loadStudentCourses(result.data[0].curriculumId);
      }
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
      case 'failed':
        return 'error';
      case 'incomplete':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status, course, student) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'blocked':
        // Check if any prerequisites are failed or incomplete
        const hasFailedOrIncompletePrereqs = course.prerequisites.some(prereq => 
          student.completedCourses?.includes(prereq) && 
          (isCourseFailed(student, prereq) || isCourseIncomplete(student, prereq))
        );
        return hasFailedOrIncompletePrereqs ? 'Blocked (Incomplete or Failed)' : 'Blocked (Prerequisite not met)';
      case 'available':
        return 'Available';
      case 'failed':
        return 'Failed';
      case 'incomplete':
        return 'Incomplete';
      default:
        return 'Not Taken';
    }
  };

  // Calculate Dean's Lister eligibility for a semester
  const calculateDeansListerEligibility = (student, semester, year) => {
    if (!student || !student.grades) return false;
    
    // Get courses for the specific semester and year
    const semesterCourses = studentCourses
      ?.filter(course => course.yearLevel === year && course.semester === semester)
      .map(course => course.courseCode) || [];
    
    // Get grades for those courses
    const semesterGrades = semesterCourses
      .map(courseCode => student.grades[courseCode])
      .filter(grade => grade !== undefined && grade !== null && grade !== '' && grade !== 'INC');
    
    if (semesterGrades.length === 0) return false;
    
    // Check if no grades are higher than 2.1 (excluding 5.0 and INC)
    return semesterGrades.every(grade => {
      const numGrade = parseFloat(grade);
      return numGrade <= 2.1;
    });
  };

  // Calculate Scholarship eligibility for both semesters
  const calculateScholarshipEligibility = (student, year) => {
    if (!student || !student.grades) return { eligible: false, percentage: 0 };
    
    // Get courses for the specific year
    const yearCourses = studentCourses
      ?.filter(course => course.yearLevel === year)
      .map(course => course.courseCode) || [];
    
    // Get grades for those courses
    const yearGrades = yearCourses
      .map(courseCode => student.grades[courseCode])
      .filter(grade => grade !== undefined && grade !== null && grade !== '' && grade !== 'INC');
    
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

  // Check if a course is failed (grade 5.0 or above)
  const isCourseFailed = (student, courseCode) => {
    if (!student || !student.grades) return false;
    const grade = student.grades[courseCode];
    return grade && parseFloat(grade) >= 5.0;
  };

  // Check if a course is incomplete
  const isCourseIncomplete = (student, courseCode) => {
    if (!student || !student.grades) return false;
    const grade = student.grades[courseCode];
    return grade === 'INC';
  };

  const renderStudentList = () => (
    <Box>
      <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
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
        sx={{ mb: 3 }}
        size="small"
      />

      <Box sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          {[1, 2, 3, 4].map(year => (
            <Tab key={year} label={`${year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year`} />
          ))}
        </Tabs>
      </Box>

      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: 3 
      }}>
        {filteredStudents.map((student) => {
          return (
            <Card 
              key={student.id}
              elevation={0}
              sx={{ 
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: '1px solid #e0e0e0',
                bgcolor: 'white',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                  border: '1px solid #1976d2',
                }
              }}
              onClick={() => handleStudentSelect(student)}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom color="primary">
                  {student.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {student.yearLevel === 1 ? '1st' : student.yearLevel === 2 ? '2nd' : student.yearLevel === 3 ? '3rd' : '4th'} Year
                </Typography>
                
                <Box mt={2}>
                  <Chip 
                    label={`${student.completedCourses?.length || 0} courses completed`} 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                  />
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
      
      {filteredStudents.length === 0 && searchTerm && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No students found matching "{searchTerm}" in {tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search terms
          </Typography>
        </Box>
      )}
      
      {filteredStudents.length === 0 && !searchTerm && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No students in {tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add students in Student Management to get started
          </Typography>
        </Box>
      )}
    </Box>
  );

  const renderCurriculumView = () => {
    if (!studentCurriculum) return null;

    const { student, courses } = studentCurriculum;

    return (
      <Box>
        <Typography variant="h4" fontWeight={700} gutterBottom color="primary">
          {student.name}'s Curriculum
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {student.yearLevel === 1 ? '1st' : student.yearLevel === 2 ? '2nd' : student.yearLevel === 3 ? '3rd' : '4th'} Year • {student.completedCourses?.length || 0} courses completed
        </Typography>
        
        <Box mt={3}>
          {[1, 2, 3, 4].map(year => {
            const scholarshipEligibility = calculateScholarshipEligibility(student, year);
            const deansLister1stSem = calculateDeansListerEligibility(student, 1, year);
            const deansLister2ndSem = calculateDeansListerEligibility(student, 2, year);
            
            return (
              <Accordion key={year} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" fontWeight={600}>{year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {/* Year-specific Eligibility Summary */}
                  <Box sx={{ mb: 3, p: 2, bgcolor: '#f8f9fa', borderRadius: 2, border: '1px solid #e0e0e0' }}>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      Academic Eligibility Summary - {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography variant="body2" fontWeight={500} color="text.secondary">
                          1st Semester Dean's Lister:
                        </Typography>
                        <Chip 
                          label={deansLister1stSem ? "Eligible" : "Not Eligible"}
                          color={deansLister1stSem ? "success" : "default"}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={500} color="text.secondary">
                          2nd Semester Dean's Lister:
                        </Typography>
                        <Chip 
                          label={deansLister2ndSem ? "Eligible" : "Not Eligible"}
                          color={deansLister2ndSem ? "success" : "default"}
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
                  
                  {[1, 2].map(semester => (
                    <Box key={semester} mb={4}>
                      <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600, mb: 2 }}>
                        {semester === 1 ? '1st' : '2nd'} Semester
                      </Typography>
                      <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: 1 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                              <TableCell sx={{ fontWeight: 600 }}>Course Code</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Course Title</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Units</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Prerequisites</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>Grade</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {courses
                              .filter(course => course.yearLevel === year && course.semester === semester)
                              .map((course) => (
                                <TableRow 
                                  key={course.id}
                                  sx={{
                                    backgroundColor: isCourseFailed(student, course.courseCode) ? '#ffebee' :
                                                   isCourseIncomplete(student, course.courseCode) ? '#fff3e0' :
                                                   course.status === 'completed' ? '#e8f5e9' : 
                                                   course.status === 'blocked' ? '#ffebee' : 'inherit',
                                    '&:hover': { 
                                      bgcolor: isCourseFailed(student, course.courseCode) ? '#ffcdd2' :
                                              isCourseIncomplete(student, course.courseCode) ? '#ffe0b2' :
                                              course.status === 'completed' ? '#c8e6c9' : 
                                              course.status === 'blocked' ? '#ffcdd2' : '#f5f5f5' 
                                    }
                                  }}
                                >
                                  <TableCell>
                                    <Typography variant="body2" fontWeight={600} color="primary">
                                      {course.courseCode}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>{course.courseTitle}</TableCell>
                                  <TableCell>{course.units}</TableCell>
                                  <TableCell>
                                    {course.prerequisites.length > 0 ? (
                                      course.prerequisites.map(prereq => {
                                        // Check if prerequisite is met (completed and not failed/incomplete)
                                        const isPrereqMet = student.completedCourses?.includes(prereq) && 
                                                           !isCourseFailed(student, prereq) && 
                                                           !isCourseIncomplete(student, prereq);
                                        return (
                                          <Chip 
                                            key={prereq} 
                                            label={prereq} 
                                            size="small" 
                                            color={isPrereqMet ? 'success' : 'error'}
                                            variant="outlined"
                                            sx={{ mr: 0.5, mb: 0.5 }}
                                          />
                                        );
                                      })
                                    ) : (
                                      <Typography variant="body2" color="text.secondary">
                                        None
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Box>
                                      <Chip 
                                        label={getStatusLabel(course.status, course, student)}
                                        color={getStatusColor(course.status)}
                                        size="small"
                                        variant="filled"
                                      />
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    {student.grades && student.grades[course.courseCode] ? (
                                      <Chip 
                                        label={student.grades[course.courseCode]}
                                        size="small"
                                        color={
                                          student.grades[course.courseCode] === 'INC' ? "warning" :
                                          parseFloat(student.grades[course.courseCode]) >= 5.0 ? "error" :
                                          parseFloat(student.grades[course.courseCode]) <= 2.1 ? "success" : 
                                          parseFloat(student.grades[course.courseCode]) <= 2.5 ? "primary" : "error"
                                        }
                                        variant="outlined"
                                      />
                                    ) : (
                                      <Typography variant="body2" color="text.secondary">
                                        Not Graded
                                      </Typography>
                                    )}
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
            );
          })}
        </Box>
        
        <Box mt={4} p={3} bgcolor="#f8f9fa" borderRadius={2} border="1px solid #e0e0e0">
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Legend
          </Typography>
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Box display="flex" alignItems="center">
              <Chip 
                label="Completed"
                size="small"
                color="success"
                variant="filled"
                sx={{ mr: 1 }}
              />
              <Typography variant="body2" fontWeight={500}>Completed</Typography>
            </Box>
            <Box display="flex" alignItems="center">
              <Chip 
                label="Available"
                size="small"
                color="primary"
                variant="filled"
                sx={{ mr: 1 }}
              />
              <Typography variant="body2" fontWeight={500}>Available</Typography>
            </Box>
            <Box display="flex" alignItems="center">
              <Chip 
                label="Failed"
                size="small"
                color="error"
                variant="filled"
                sx={{ mr: 1 }}
              />
              <Typography variant="body2" fontWeight={500}>Failed (Grade 5.0+)</Typography>
            </Box>
            <Box display="flex" alignItems="center">
              <Chip 
                label="Incomplete"
                size="small"
                color="warning"
                variant="filled"
                sx={{ mr: 1 }}
              />
              <Typography variant="body2" fontWeight={500}>Incomplete (Grade INC)</Typography>
            </Box>
            <Box display="flex" alignItems="center">
              <Chip 
                label="Blocked"
                size="small"
                color="error"
                variant="filled"
                sx={{ mr: 1 }}
              />
              <Typography variant="body2" fontWeight={500}>Blocked (Prerequisite not met)</Typography>
            </Box>
            <Box display="flex" alignItems="center">
              <Chip 
                label="Blocked"
                size="small"
                color="error"
                variant="filled"
                sx={{ mr: 1 }}
              />
              <Typography variant="body2" fontWeight={500}>Blocked (Incomplete or Failed)</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" fontWeight={700} gutterBottom sx={{ p: 3, pb: 1 }}>
        Curriculum Checker
      </Typography>
      
      {!currentUser && (
        <Alert severity="info" sx={{ mx: 3, mb: 2 }}>
          Please sign in to access the Curriculum Checker
        </Alert>
      )}
      
      {error && <Alert severity="error" sx={{ mx: 3, mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mx: 3, mb: 2 }}>{success}</Alert>}
      
      {currentUser ? (
        <Box sx={{ flex: 1, p: 3, pt: 0 }}>
          <Box sx={{ 
            p: 3, 
            border: '1px solid #e0e0e0', 
            borderRadius: 1, 
            bgcolor: '#fafafa', 
            height: '100%',
            overflow: 'auto'
          }}>
            {renderStudentList()}
          </Box>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ p: 4, textAlign: 'center', border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa' }}>
            <Typography variant="h6" color="text.secondary">
              Sign in to access curriculum checking features
            </Typography>
          </Box>
        </Box>
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