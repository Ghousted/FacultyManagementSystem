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
import { getStudents, getStudentCurriculumStatus, getCoursesByCurriculum, getAllCourses } from '../../models/curriculumModels';
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
  const [allCourses, setAllCourses] = useState([]);

  useEffect(() => {
    if (currentUser) {
      loadStudents();
      loadAllCourses();
    }
  }, [currentUser]);

  useEffect(() => {
    // Filter students based on search term and year level or irregular status
    let filtered;
    if (tabValue === 4) {
      filtered = students.filter(student => student.isIrregular);
    } else {
      filtered = students.filter(student => student.yearLevel === (tabValue + 1) && !student.isIrregular);
    }
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
      if (result.offline) {
        console.log('Loaded students from offline storage');
      }
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
      if (result.offline) {
        console.log('Loaded student courses from offline storage');
      }
    }
  };

  const loadAllCourses = async () => {
    const result = await getAllCourses();
    if (result.success) setAllCourses(result.data);
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
      case 'unavailable':
        return 'Not Available';
      default:
        return 'Not Available';
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
      .filter(grade => grade !== undefined && grade !== null && grade !== '' && grade !== 'INC' && grade !== 'CRED');
    
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

  // Check if a course is credited
  const isCourseCredited = (student, courseCode) => {
    if (!student || !student.grades) return false;
    const grade = student.grades[courseCode];
    return grade === 'CRED';
  };

  // Helper: For irregular students, process equivalents
  const getAvailableCoursesForIrregular = (student, curriculumCourses) => {
    if (!student?.isIrregular) return curriculumCourses;
    
    // Map: equivalentSubjectId -> all courses with that id
    const equivMap = {};
    allCourses.forEach(course => {
      if (course.equivalentSubjectId) {
        if (!equivMap[course.equivalentSubjectId]) equivMap[course.equivalentSubjectId] = [];
        equivMap[course.equivalentSubjectId].push(course);
      }
    });
    
    // For each course in the student's curriculum, check equivalents
    return curriculumCourses.map(course => {
      if (!course.equivalentSubjectId) return course;
      const equivalents = equivMap[course.equivalentSubjectId] || [];
      // If any equivalent is available, mark as available
      const anyAvailable = equivalents.some(eq => eq.isAvailable !== false);
      // If the course is already completed/failed, keep its status
      if (course.status === 'completed' || course.status === 'failed') return course;
      return {
        ...course,
        status: anyAvailable ? 'available' : course.status
      };
    });
  };

  // Helper: Get equivalent courses from other curriculums for irregular students
  const getEquivalentCoursesFromOtherCurriculums = (student, curriculumCourses) => {
    if (!student?.isIrregular) return [];
    
    const equivalentCourses = [];
    const studentCurriculumIds = new Set([student.curriculumId]);
    
    // Helper function to check if a course meets prerequisites
    const isPrerequisiteMet = (courseCode) => {
      return student.completedCourses?.includes(courseCode) && 
             !isCourseFailed(student, courseCode) && 
             !isCourseIncomplete(student, courseCode);
    };
    
    // Get all courses that have equivalentSubjectId and are available
    allCourses.forEach(course => {
      if (course.equivalentSubjectId && course.isAvailable !== false) {
        // Check if this course is equivalent to any course in the student's curriculum
        const isEquivalentToStudentCourse = curriculumCourses.some(studentCourse => 
          studentCourse.equivalentSubjectId === course.equivalentSubjectId
        );
        
        // Only include courses from different curriculums that are equivalent to student's courses
        if (isEquivalentToStudentCourse && !studentCurriculumIds.has(course.curriculumId)) {
          // Check if the student meets the prerequisites for this equivalent course
          let meetsPrerequisites = true;
          if (course.prerequisites && course.prerequisites.length > 0) {
            meetsPrerequisites = course.prerequisites.every(isPrerequisiteMet);
          }
          
          // Only include if prerequisites are met
          if (meetsPrerequisites) {
            equivalentCourses.push({
              ...course,
              isEquivalentCourse: true,
              originalCourseCode: curriculumCourses.find(sc => 
                sc.equivalentSubjectId === course.equivalentSubjectId
              )?.courseCode
            });
          }
        }
      }
    });
    
    return equivalentCourses;
  };

  const renderStudentList = () => (
    <Box>

      
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
        size="small"
      />

      <Box sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          {[1, 2, 3, 4].map(year => (
            <Tab key={year} label={`${year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year`} />
          ))}
          <Tab label="Irregular Students" />
        </Tabs>
      </Box>

      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
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
             
                '&:hover': {
                  boxShadow: '0 8px 24px rgba(25, 118, 210, 0.10)',
                  border: '1px solid #1976d2',
                }
              }}
              onClick={() => handleStudentSelect(student)}
            >
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Typography variant="h6" fontWeight={700} color="primary">
                    {student.name}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {student.yearLevel === 1 ? '1st' : student.yearLevel === 2 ? '2nd' : student.yearLevel === 3 ? '3rd' : '4th'} Year
                  {' • '}{student.completedCourses?.length || 0} courses completed
                </Typography>
                <Box mt={2} display="flex" gap={1}>
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
            No students found matching "{searchTerm}" in {tabValue === 4 ? 'Irregular Students' : tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search terms
          </Typography>
        </Box>
      )}
      
      {filteredStudents.length === 0 && !searchTerm && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {tabValue === 4 ? 'No irregular students' : `No students in ${tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year`}
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
    // Use processed courses for irregulars
    const processedCourses = getAvailableCoursesForIrregular(student, courses);

    return (
      <Box>
        <Typography variant="h5" fontWeight={700} gutterBottom color="primary">
          {student.name}
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
              <Accordion key={year} sx={{ border: '1px solid #e0e0e0', borderRadius: 0 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" fontWeight={600}>{year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {/* Year-specific Eligibility Summary */}
                  <Box sx={{ mb:2,  p: 2, bgcolor: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 2 }}>
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
                      <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
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
                          <TableBody sx={{ cursor: 'pointer' }}>
                            {processedCourses
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
                                              course.status === 'completed' ? '#d6fcd8ff' : 
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
                                          student.grades[course.courseCode] === 'CRED' ? "success" :
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
          {/* Place the available courses accordion here, outside the year accordions */}
          <Accordion sx={{ mb: 2, border: '1px solid #1976d2', borderRadius: 0 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" fontWeight={700} color="primary">
                Available Courses This Term
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {processedCourses.filter(c => c.status === 'available').length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No available courses for this term.</Typography>
                ) : (
                  processedCourses.filter(c => c.status === 'available').map(course => (
                    <Chip key={course.id} label={`${course.courseCode} - ${course.courseTitle}`} color="primary" variant="outlined" />
                  ))
                )}
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Equivalent Courses from Other Curriculums (for irregular students only) */}
          {student.isIrregular && (
            <Accordion sx={{ mb: 2, border: '1px solid #ff9800', borderRadius: 0 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" fontWeight={700} color="warning">
                  Equivalent Courses from Other Curriculums
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    As an irregular student, you can enroll in these equivalent courses from other curriculums:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {(() => {
                      const equivalentCourses = getEquivalentCoursesFromOtherCurriculums(student, processedCourses);
                      if (equivalentCourses.length === 0) {
                        return (
                          <Typography variant="body2" color="text.secondary">
                            No equivalent courses available from other curriculums.
                          </Typography>
                        );
                      }
                      return equivalentCourses.map(course => (
                        <Chip 
                          key={course.id} 
                          label={`${course.courseCode} - ${course.courseTitle} (Equivalent to ${course.originalCourseCode})`} 
                          color="warning" 
                          variant="outlined"
                          sx={{ borderColor: '#ff9800' }}
                        />
                      ));
                    })()}
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>
          )}
        </Box>
        
        <Box mt={4} p={3} bgcolor="#f8f9fa" border="1px solid #e0e0e0">
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
            {student?.isIrregular && (
              <Box display="flex" alignItems="center">
                <Chip 
                  label="Equivalent"
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ mr: 1, borderColor: '#ff9800' }}
                />
                <Typography variant="body2" fontWeight={500}>Equivalent Course from Other Curriculum</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
    
      
      {!currentUser && (
        <Alert severity="info" sx={{ mx: 3, mb: 2 }}>
          Please sign in to access the Curriculum Checker
        </Alert>
      )}
      
      {error && <Alert severity="error" sx={{ mx: 3, mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mx: 3, mb: 2 }}>{success}</Alert>}
      
      {currentUser ? (
        <Box sx={{ flex: 1,  pt: 0 }}>
          <Box sx={{ 
            overflow: 'auto',
            marginTop: 3,
          }}>
            {renderStudentList()}
          </Box>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ p: 4, textAlign: 'center', border: '1px solid #e0e0e0',  bgcolor: '#fafafa' }}>
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
        PaperProps={{
          sx: {
            
            boxShadow: 8,    // Optional: adds a modern shadow
          }
        }}
      >
        <DialogTitle 
          variant='h5' 
          sx={{ 
            fontWeight: 600, 
            color: 'white', 
            backgroundColor: 'royalblue',
            borderBottom: '1px solid #e0e0e0',
          
            px: 4, // Padding for better look
            py: 2
          }}
        >
          Curriculum Status
        </DialogTitle>
        <DialogContent 
          sx={{ 
            marginTop: 2,
          
            px: 4, // Consistent padding
            py: 2,
            background: '#fff'
          }}
        >
          {renderCurriculumView()}
        </DialogContent>
       
      </Dialog>
    </Box>
  );
};

export default CurriculumCheckerMain;