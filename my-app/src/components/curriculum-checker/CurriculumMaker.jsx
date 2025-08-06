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
  Checkbox,
  Menu,
  ListItemIcon,
  Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { createCurriculum, getCurriculums, addCourse, getCoursesByCurriculum, getAllCourses } from '../../models/curriculumModels';
import { useAuth } from '../../contexts/AuthContext';
import { doc, deleteDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import Logo from '../../assets/logo.png';

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

  const getAllCourseCodes = () => {
    if (!selectedCurriculum) return [];
    return courses.map(course => course.courseCode).filter(Boolean);
  };

  const renderCurriculumList = () => (
    <Box sx={{ marginTop: 7}}>
      {/* Header Box with White Background */}
      <Box 
        sx={{ 
          bgcolor: 'white', 
          color: 'black', 
          p: 4, 
          borderRadius: 2, 
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 1000
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            edge="start" 
            onClick={onBack}
            sx={{ 
              mr: 3,
              borderRadius: '50%',
              backgroundColor: 'royalblue',
              color: 'white',
              '&:hover': {
                backgroundColor: '#4169e1'
              }
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" fontWeight="bold">
            Curriculum Maker
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCurriculumDialogOpen(true)}
          sx={{ 
            bgcolor: 'royalblue', 
            color: 'white',
            '&:hover': {
              bgcolor: '#4169e1'
            }
          }}
        >
          Create
        </Button>
      </Box>

      <Box>
        <Grid container spacing={2}>
          {curriculums.map((curriculum) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={curriculum.id}>
              <Box 
                sx={{ 
                  p: 3, 
                  border: '2px solid #e0e0e0', 
                  borderRadius: 2,
                  cursor: 'pointer',
                  bgcolor: selectedCurriculum?.id === curriculum.id ? '#e3f2fd' : 'white',
                  '&:hover': { 
                    borderColor: 'primary.main',
            
                  },
                  position: 'relative'
                }}
                onClick={() => setSelectedCurriculum(curriculum)}
              >
                {/* Three Dots Menu */}
                <IconButton
                  size="small"
                  onClick={(e) => handleMenuOpen(e, curriculum)}
                  disabled={loading}
                  sx={{
                    position: 'absolute',
                    top: 23,
                    right: 8,
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 1)',
                    }
                  }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
                
                <Typography variant="h6" fontWeight="bold" gutterBottom mb={7}>
                  {curriculum.name}
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

        <Box>
          {([1, 2, (selectedYear === 3 ? 3 : null)].filter(Boolean)).map(semester => (
            <Box key={semester} mb={4} mt={2}>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                {semester === 1 ? '1st' : semester === 2 ? '2nd' : 'Summer'} Semester
              </Typography>
              
              <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: 2}}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'royalblue' }}>
                      <TableCell sx={{ fontWeight: 'bold', width: '15%', color: 'white' }}>Course Code</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '35%', color: 'white' }}>Course Title</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '10%',  color: 'white' }}>Units</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '25%', color: 'white' }}>Prerequisites</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '15%',  color: 'white' }}>Equivalent Subjects</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '10%',  color: 'white' }}>Available</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '15%', color: 'white' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {getCoursesByYearAndSemester(selectedYear, semester).map((course) => {
                      const isEditing = editingCourse === course.id;
                      const data = isEditing ? editingData : course;
                      // Find all equivalent courses (by equivalentSubjectId, excluding self)
                      const equivalents = allCourses.filter(c => c.equivalentSubjectId && c.equivalentSubjectId === data.equivalentSubjectId && c.id !== course.id);
                      
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
                                value={editingData.prerequisites || []}
                                onChange={(event, newValue) => {
                                  setEditingData(prev => ({ ...prev, prerequisites: newValue }));
                                  setHasChanges(true);
                                }}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    label="Prerequisites"
                                    size="small"
                                    placeholder="Select prerequisites"
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
                                sx={{ minWidth: 120, mb: 1 }}
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
                            {isEditing ? (
                              <Autocomplete
                                multiple
                                size="small"
                                options={allCourses.filter(c => c.id !== course.id).map(c => c.courseCode)}
                                value={editingEquivalents}
                                onChange={(event, newValue) => {
                                  setEditingEquivalents(newValue);
                                  // If user selects equivalents, assign a shared equivalentSubjectId
                                  let eqId = data.equivalentSubjectId;
                                  if (!eqId && newValue.length > 0) {
                                    eqId = 'EQ_' + Math.random().toString(36).substr(2, 9);
                                  } else if (newValue.length === 0) {
                                    eqId = ''; // Clear equivalentSubjectId if no equivalents selected
                                  }
                                  setEditingData(prev => ({ ...prev, equivalentSubjectId: eqId }));
                                  setHasChanges(true);
                                }}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    label="Equivalent Subjects"
                                    size="small"
                                    placeholder="Select equivalents"
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
                                sx={{ minWidth: 120, mb: 1 }}
                              />
                            ) : (
                              equivalents.length > 0 ? (
                                <Box>
                                  {equivalents.map(eq => (
                                    <Chip key={eq.id} label={eq.courseCode} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                                  ))}
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary">None</Typography>
                              )
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Checkbox
                                checked={data.isAvailable}
                                onChange={e => handleInputChange('isAvailable', e.target.checked)}
                                color="primary"
                              />
                            ) : (
                              <Checkbox
                                checked={course.isAvailable !== false}
                                disabled
                                color="primary"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Box display="flex" gap={1}>
                              {isEditing ? (
                                <>
                                  <Button 
                                    size="small" 
                                    variant="contained"
                                    color={hasChanges ? "success" : "inherit"}
                                    onClick={hasChanges ? handleSaveCourse : handleCancelEdit}
                                    disabled={loading}
                                    sx={{ 
                                      minWidth: 60,
                                      textTransform: 'none',
                                      fontSize: '0.75rem'
                                    }}
                                  >
                                    {hasChanges ? "Save" : "Cancel"}
                                  </Button>
                                </>
                              ) : (
                                <Button 
                                  size="small" 
                                  variant="contained"
                                  color="success"
                                  onClick={() => handleEditCourse(course)}
                                  sx={{ 
                                    minWidth: 60,
                                    textTransform: 'none',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                              <Button 
                                size="small" 
                                variant="contained"
                                color="error" 
                                onClick={() => handleDeleteCourse(course.id)}
                                disabled={loading}
                                sx={{ 
                                  minWidth: 60,
                                  textTransform: 'none',
                                  fontSize: '0.75rem'
                                }}
                              >
                                Delete
                              </Button>
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
                          value={newCourseData[semester]?.courseCode || ''}
                          onChange={(e) => handleNewCourseInputChange('courseCode', e.target.value, semester)}
                          sx={{ minWidth: 100 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          placeholder="Course Title"
                          value={newCourseData[semester]?.courseTitle || ''}
                          onChange={(e) => handleNewCourseInputChange('courseTitle', e.target.value, semester)}
                          fullWidth
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          placeholder="Units"
                          value={newCourseData[semester]?.units || ''}
                          onChange={(e) => handleNewCourseInputChange('units', e.target.value, semester)}
                          sx={{ width: 60 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Autocomplete
                          multiple
                          size="small"
                          options={getAllCourseCodes()}
                          value={newCourseData[semester]?.prerequisites || []}
                          onChange={(event, newValue) => {
                            setNewCourseData(prev => ({ 
                              ...prev, 
                              [semester]: { 
                                ...(prev[semester] || { courseCode: '', courseTitle: '', units: '', prerequisites: [], isAvailable: true }), 
                                prerequisites: newValue 
                              } 
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
                        <Autocomplete
                          multiple
                          size="small"
                          options={allCourses.filter(c => c.id !== courseForm.id).map(c => c.courseCode)}
                          value={selectedEquivalent}
                          onChange={(event, newValue) => setSelectedEquivalent(newValue)}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Equivalent Subjects"
                              margin="normal"
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
                          sx={{ minWidth: 150, mb: 2 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={newCourseData[semester]?.isAvailable ?? true}
                          onChange={e => handleNewCourseInputChange('isAvailable', e.target.checked, semester)}
                          color="primary"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="contained"
                          size="small"
                          color="success"
                          onClick={() => handleAddNewCourse(semester)}
                          disabled={loading || !newCourseData[semester]?.courseCode || !newCourseData[semester]?.courseTitle || !newCourseData[semester]?.units}
                          sx={{ minWidth: 60 }}
                        >
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    {getCoursesByYearAndSemester(selectedYear, semester).length === 0 && (
                      <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                        No courses in {selectedYear === 1 ? '1st' : selectedYear === 2 ? '2nd' : selectedYear === 3 ? '3rd' : '4th'} Year, {semester === 1 ? '1st' : semester === 2 ? '2nd' : 'Summer'} Semester
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
    <Box p={3} sx={{ display: 'flex', flexDirection: 'column' }}>
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
              {renderCurriculumList()}
            </Box>
          ) : (
            // Show full screen course tables when curriculum is selected
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ mb: 2, mt:7, p: 3, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: 'white' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton 
                      onClick={() => setSelectedCurriculum(null)}
                      sx={{ 
                        mr: 4,
                        borderRadius: '50%',
                        backgroundColor: 'royalblue',
                        color: 'white',
                        '&:hover': {
                          backgroundColor: '#4169e1'
                        }
                      }}
                    >
                      <ArrowBackIcon />
                    </IconButton>
                    <Box>
                      <Typography variant="h6">Curriculum</Typography>
                    <Typography variant="subtitle1" fontWeight="bold">
                    {selectedCurriculum.name}
                  </Typography>
                    </Box>
                  </Box>
                </Box>

              </Box>
              
              <Box>
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

      {/* Three Dots Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleEditCurriculum}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteCurriculumClick}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* Edit Curriculum Dialog */}
      <Dialog open={editCurriculumDialogOpen} onClose={() => {
        setEditCurriculumDialogOpen(false);
        // Don't clear selectedCurriculumForMenu here - only clear it after successful update
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Curriculum</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Curriculum Name"
            value={editingCurriculumData.name}
            onChange={(e) => setEditingCurriculumData({ ...editingCurriculumData, name: e.target.value })}
            margin="normal"
            size="small"
          />
          <TextField
            fullWidth
            label="Description"
            value={editingCurriculumData.description}
            onChange={(e) => setEditingCurriculumData({ ...editingCurriculumData, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditCurriculumDialogOpen(false);
            // Don't clear selectedCurriculumForMenu here
          }}>Cancel</Button>
          <Button onClick={handleUpdateCurriculum} variant="contained" disabled={loading}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteCurriculumDialogOpen} onClose={() => {
        setDeleteCurriculumDialogOpen(false);
        // Don't clear selectedCurriculumForMenu here
      }} maxWidth="sm">
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedCurriculumForMenu?.name}"? This will also delete all associated courses and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteCurriculumDialogOpen(false);
            // Don't clear selectedCurriculumForMenu here
          }}>Cancel</Button>
          <Button onClick={handleConfirmDeleteCurriculum} variant="contained" color="error" disabled={loading}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

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
                  {[1, 2, (selectedYear === 3 ? 3 : null)].filter(Boolean).map(sem => (
                    <MenuItem key={sem} value={sem}>{sem === 1 ? '1st' : sem === 2 ? '2nd' : 'Summer'} Semester</MenuItem>
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
          {/* In the course dialog, place prerequisites and equivalents side by side */}
          <Grid container spacing={2}>
            <Grid item xs={6}>
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
                sx={{ minWidth: 150, mb: 2 }}
          />
            </Grid>
            {/* Removed the equivalent subjects Autocomplete from the add course dialog */}
          </Grid>
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