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
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { createCurriculum, getCurriculums, addCourse, getCoursesByCurriculum } from '../../models/curriculumModels';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const CurriculumMaker = () => {
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
    prerequisites: []
  });
  
  // Dialog states
  const [curriculumDialogOpen, setCurriculumDialogOpen] = useState(false);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(1);
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [tabValue, setTabValue] = useState(0);

  // Editing states
  const [editingCourse, setEditingCourse] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [newCourseData, setNewCourseData] = useState({
    1: { courseCode: '', courseTitle: '', units: '', prerequisites: [] },
    2: { courseCode: '', courseTitle: '', units: '', prerequisites: [] }
  });

  useEffect(() => {
    if (currentUser) {
      loadCurriculums();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedCurriculum && currentUser) {
      loadCourses(selectedCurriculum.id);
    }
  }, [selectedCurriculum, currentUser]);

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

  const loadCurriculums = async () => {
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
  };

  const loadCourses = async (curriculumId) => {
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
  };

  const handleCreateCurriculum = async () => {
    if (!currentUser) {
      setError('Please sign in to create a curriculum');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await createCurriculum(curriculumForm);
      if (result.success) {
        setSuccess('Curriculum created successfully!');
        setCurriculumForm({ name: '', description: '', yearLevels: [1, 2, 3, 4] });
        setCurriculumDialogOpen(false);
        await loadCurriculums();
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to create curriculum: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCourse = async () => {
    if (!currentUser) {
      setError('Please sign in to add a course');
      return;
    }
    if (!selectedCurriculum) {
      setError('Please select a curriculum first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await addCourse(
        selectedCurriculum.id,
        selectedYear,
        selectedSemester,
        courseForm
      );
      if (result.success) {
        setSuccess('Course added successfully!');
        setCourseForm({ courseCode: '', courseTitle: '', units: '', prerequisites: [] });
        setCourseDialogOpen(false);
        await loadCourses(selectedCurriculum.id);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to add course: ' + error.message);
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
      prerequisites: course.prerequisites
    });
    setHasChanges(false);
  };

  const handleCancelEdit = () => {
    setEditingCourse(null);
    setEditingData({});
    setHasChanges(false);
  };

  const handleSaveCourse = async () => {
    if (!currentUser) {
      setError('Please sign in to save changes');
      return;
    }
    if (!editingCourse || !hasChanges) return;
    setLoading(true);
    setError('');
    try {
      const courseRef = doc(db, 'courses', editingCourse);
      await updateDoc(courseRef, {
        ...editingData,
        updatedAt: new Date()
      });
      setSuccess('Course updated successfully!');
      setEditingCourse(null);
      setEditingData({});
      setHasChanges(false);
      await loadCourses(selectedCurriculum.id);
    } catch (error) {
      setError('Failed to update course: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!currentUser) {
      setError('Please sign in to delete a course');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this course?')) return;
    setLoading(true);
    setError('');
    try {
      await deleteDoc(doc(db, 'courses', courseId));
      setSuccess('Course deleted successfully!');
      await loadCourses(selectedCurriculum.id);
    } catch (error) {
      setError('Failed to delete course: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditingData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleNewCourseInputChange = (field, value, semester) => {
    setNewCourseData(prev => ({ ...prev, [semester]: { ...prev[semester], [field]: value } }));
  };

  const handleAddNewCourse = async (semester) => {
    if (!currentUser) {
      setError('Please sign in to add a course');
      return;
    }
    if (!selectedCurriculum) {
      setError('Please select a curriculum first');
      return;
    }
    if (!newCourseData[semester].courseCode || !newCourseData[semester].courseTitle || !newCourseData[semester].units) {
      setError('Please fill in all required fields (Course Code, Title, and Units)');
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
        setSuccess('Course added successfully!');
        setNewCourseData({ ...newCourseData, [semester]: { courseCode: '', courseTitle: '', units: '', prerequisites: [] } });
        await loadCourses(selectedCurriculum.id);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to add course: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getCoursesByYearAndSemester = (year, semester) => {
    return courses.filter(course => course.yearLevel === year && course.semester === semester);
  };

  const getAllCourseCodes = () => {
    if (!selectedCurriculum) return [];
    return courses.map(course => course.courseCode).filter(Boolean);
  };

  const renderCurriculumList = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">Select a Curriculum</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCurriculumDialogOpen(true)}
        >
          Create New Curriculum
        </Button>
      </Box>
      
      <Box sx={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <Grid container spacing={2}>
          {curriculums.map((curriculum) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={curriculum.id}>
              <Box 
                sx={{ 
                  p: 3, 
                  border: '1px solid #e0e0e0', 
                  borderRadius: 1,
                  cursor: 'pointer',
                  bgcolor: selectedCurriculum?.id === curriculum.id ? '#e3f2fd' : 'white',
                  '&:hover': { 
                    bgcolor: '#f5f5f5',
                    borderColor: 'primary.main',
                    transform: 'translateY(-2px)',
                    transition: 'all 0.2s ease-in-out'
                  }
                }}
                onClick={() => setSelectedCurriculum(curriculum)}
              >
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  {curriculum.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                  {curriculum.description}
                </Typography>
                <Box>
                  {curriculum.yearLevels.map(year => (
                    <Chip 
                      key={year} 
                      label={`Year ${year}`} 
                      size="small" 
                      sx={{ mr: 0.5, mb: 0.5 }} 
                    />
                  ))}
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
        
        {curriculums.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No curriculums yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first curriculum to get started
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCurriculumDialogOpen(true)}
            >
              Create First Curriculum
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );

  const renderCourseTables = () => {
    if (!selectedCurriculum) return null;

    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" fontWeight="bold">
            {selectedCurriculum.name} - Course Management
          </Typography>
          <Box display="flex" gap={1}>
            {hasChanges && (
              <Button
                variant="contained"
                color="success"
                onClick={handleSaveCourse}
                disabled={loading}
              >
                Save Changes
              </Button>
            )}
            {editingCourse && (
              <Button
                variant="outlined"
                onClick={handleCancelEdit}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
          </Box>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Tabs value={tabValue} onChange={(e, newValue) => {
            setTabValue(newValue);
            setSelectedYear(newValue + 1);
          }}>
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
                      <TableCell sx={{ fontWeight: 'bold', width: '15%' }}>Course Code</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '35%' }}>Course Title</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '10%' }}>Units</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Prerequisites</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '15%' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getCoursesByYearAndSemester(selectedYear, semester).map((course) => {
                      const isEditing = editingCourse === course.id;
                      const data = isEditing ? editingData : course;
                      
                      return (
                        <TableRow key={course.id} sx={{ 
                          '&:hover': { bgcolor: '#f9f9f9' },
                          bgcolor: isEditing ? '#fff3e0' : 'inherit'
                        }}>
                          <TableCell>
                            {isEditing ? (
                              <TextField
                                size="small"
                                value={data.courseCode}
                                onChange={(e) => handleInputChange('courseCode', e.target.value)}
                                sx={{ minWidth: 100 }}
                              />
                            ) : (
                              <Typography variant="body2" fontWeight="bold" color="primary">
                                {course.courseCode}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <TextField
                                size="small"
                                value={data.courseTitle}
                                onChange={(e) => handleInputChange('courseTitle', e.target.value)}
                                fullWidth
                              />
                            ) : (
                              <Typography variant="body2">
                                {course.courseTitle}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <TextField
                                size="small"
                                type="number"
                                value={data.units}
                                onChange={(e) => handleInputChange('units', e.target.value)}
                                sx={{ width: 60 }}
                              />
                            ) : (
                              <Typography variant="body2">
                                {course.units}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Autocomplete
                                multiple
                                size="small"
                                options={getAllCourseCodes()}
                                value={data.prerequisites}
                                onChange={(event, newValue) => {
                                  setEditingData(prev => ({ ...prev, prerequisites: newValue }));
                                  setHasChanges(true);
                                }}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    placeholder="Select prerequisites"
                                    size="small"
                                  />
                                )}
                                renderTags={(value, getTagProps) =>
                                  value.map((option, index) => (
                                    <Chip
                                      {...getTagProps({ index })}
                                      key={option}
                                      label={option}
                                      size="small"
                                    />
                                  ))
                                }
                                sx={{ minWidth: 150 }}
                              />
                            ) : (
                              data.prerequisites.length > 0 ? (
                                <Box>
                                  {data.prerequisites.map(prereq => (
                                    <Chip 
                                      key={prereq} 
                                      label={prereq} 
                                      size="small" 
                                      sx={{ mr: 0.5, mb: 0.5 }} 
                                    />
                                  ))}
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  None
                                </Typography>
                              )
                            )}
                          </TableCell>
                          <TableCell>
                            <Box display="flex" gap={1}>
                              {isEditing ? (
                                <IconButton 
                                  size="small" 
                                  color="success" 
                                  onClick={handleSaveCourse}
                                  disabled={!hasChanges || loading}
                                  sx={{ p: 0.5 }}
                                >
                                  <Typography variant="caption">Save</Typography>
                                </IconButton>
                              ) : (
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleEditCourse(course)}
                                  sx={{ p: 0.5 }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              )}
                              <IconButton 
                                size="small" 
                                color="error" 
                                onClick={() => handleDeleteCourse(course.id)}
                                disabled={loading}
                                sx={{ p: 0.5 }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    
                    {/* New Course Row */}
                    <TableRow sx={{ bgcolor: '#f0f8ff', '&:hover': { bgcolor: '#e6f3ff' } }}>
                      <TableCell>
                        <TextField
                          size="small"
                          placeholder="Course Code"
                          value={newCourseData[semester].courseCode}
                          onChange={(e) => handleNewCourseInputChange('courseCode', e.target.value, semester)}
                          sx={{ minWidth: 100 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          placeholder="Course Title"
                          value={newCourseData[semester].courseTitle}
                          onChange={(e) => handleNewCourseInputChange('courseTitle', e.target.value, semester)}
                          fullWidth
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          placeholder="Units"
                          value={newCourseData[semester].units}
                          onChange={(e) => handleNewCourseInputChange('units', e.target.value, semester)}
                          sx={{ width: 60 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Autocomplete
                          multiple
                          size="small"
                          options={getAllCourseCodes()}
                          value={newCourseData[semester].prerequisites}
                          onChange={(event, newValue) => {
                            setNewCourseData(prev => ({ 
                              ...prev, 
                              [semester]: { ...prev[semester], prerequisites: newValue } 
                            }));
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Select prerequisites"
                              size="small"
                            />
                          )}
                          renderTags={(value, getTagProps) =>
                            value.map((option, index) => (
                              <Chip
                                {...getTagProps({ index })}
                                key={option}
                                label={option}
                                size="small"
                              />
                            ))
                          }
                          sx={{ minWidth: 150 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="contained"
                          size="small"
                          color="success"
                          onClick={() => handleAddNewCourse(semester)}
                          disabled={loading || !newCourseData[semester].courseCode || !newCourseData[semester].courseTitle || !newCourseData[semester].units}
                          sx={{ minWidth: 60 }}
                        >
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    {getCoursesByYearAndSemester(selectedYear, semester).length === 0 && (
                      <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                        No courses in {selectedYear === 1 ? '1st' : selectedYear === 2 ? '2nd' : selectedYear === 3 ? '3rd' : '4th'} Year, {semester === 1 ? '1st' : '2nd'} Semester
                      </Typography>
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
        Curriculum Maker
      </Typography>
      
      {!currentUser && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Please sign in to access the Curriculum Maker
        </Alert>
      )}
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      
      {currentUser ? (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!selectedCurriculum ? (
            // Show curriculum list when no curriculum is selected
            <Box sx={{ flex: 1 }}>
              <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa', height: '100%' }}>
                {renderCurriculumList()}
              </Box>
            </Box>
          ) : (
            // Show full screen course tables when curriculum is selected
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">Selected Curriculum</Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setSelectedCurriculum(null)}
                  >
                    Back to Curriculums
                  </Button>
                </Box>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {selectedCurriculum.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedCurriculum.description}
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
              Sign in to access curriculum management features
            </Typography>
          </Box>
        </Box>
      )}

      {/* Curriculum Dialog */}
      <Dialog open={curriculumDialogOpen} onClose={() => setCurriculumDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Curriculum</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Curriculum Name"
            value={curriculumForm.name}
            onChange={(e) => setCurriculumForm({ ...curriculumForm, name: e.target.value })}
            margin="normal"
            size="small"
          />
          <TextField
            fullWidth
            label="Description"
            value={curriculumForm.description}
            onChange={(e) => setCurriculumForm({ ...curriculumForm, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCurriculumDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateCurriculum} variant="contained" disabled={loading}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Course Dialog */}
      <Dialog open={courseDialogOpen} onClose={() => setCourseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Course</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal" size="small">
                <InputLabel>Year Level</InputLabel>
                <Select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  {[1, 2, 3, 4].map(year => (
                    <MenuItem key={year} value={year}>{year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal" size="small">
                <InputLabel>Semester</InputLabel>
                <Select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                >
                  {[1, 2].map(sem => (
                    <MenuItem key={sem} value={sem}>{sem === 1 ? '1st' : '2nd'} Semester</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <TextField
            fullWidth
            label="Course Code"
            value={courseForm.courseCode}
            onChange={(e) => setCourseForm({ ...courseForm, courseCode: e.target.value })}
            margin="normal"
            size="small"
          />
          <TextField
            fullWidth
            label="Course Title"
            value={courseForm.courseTitle}
            onChange={(e) => setCourseForm({ ...courseForm, courseTitle: e.target.value })}
            margin="normal"
            size="small"
          />
          <TextField
            fullWidth
            label="Units"
            type="number"
            value={courseForm.units}
            onChange={(e) => setCourseForm({ ...courseForm, units: e.target.value })}
            margin="normal"
            size="small"
          />
          <Autocomplete
            multiple
            size="small"
            options={getAllCourseCodes()}
            value={courseForm.prerequisites}
            onChange={(event, newValue) => {
              setCourseForm({ ...courseForm, prerequisites: newValue });
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Prerequisites"
                margin="normal"
                size="small"
                helperText="Select from existing course codes"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option}
                  label={option}
                  size="small"
                />
              ))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCourseDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddCourse} variant="contained" disabled={loading}>
            Add Course
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CurriculumMaker; 