import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  Paper,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SchoolIcon from '@mui/icons-material/School';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PeopleIcon from '@mui/icons-material/People';
import CurriculumMaker from './CurriculumMaker';
import StudentManagement from './StudentManagement';
import CurriculumCheckerMain from './CurriculumCheckerMain';

const CurriculumChecker = ({ onBackToDashboard }) => {
  const [currentView, setCurrentView] = useState('main'); // 'main', 'curriculum-maker', 'student-management', 'curriculum-checker'

  const handleFeatureSelect = (feature) => {
    setCurrentView(feature);
  };

  const handleBackToMain = () => {
    setCurrentView('main');
  };

  // Render specific feature
  if (currentView === 'curriculum-maker') {
    return (
      <Box minHeight="100vh" bgcolor="#f5f6fa">
        <AppBar position="static" color="primary" elevation={1}>
          <Toolbar>
            <IconButton 
              edge="start" 
              color="inherit" 
              onClick={handleBackToMain}
              sx={{ mr: 2 }}
            >
              <ArrowBackIcon />
            </IconButton>
            <AssignmentIcon sx={{ mr: 2 }} />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Curriculum Maker
            </Typography>
          </Toolbar>
        </AppBar>
        <CurriculumMaker />
      </Box>
    );
  }

  if (currentView === 'student-management') {
    return (
      <Box minHeight="100vh" bgcolor="#f5f6fa">
        <AppBar position="static" color="primary" elevation={1}>
          <Toolbar>
            <IconButton 
              edge="start" 
              color="inherit" 
              onClick={handleBackToMain}
              sx={{ mr: 2 }}
            >
              <ArrowBackIcon />
            </IconButton>
            <PeopleIcon sx={{ mr: 2 }} />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Student Management
            </Typography>
          </Toolbar>
        </AppBar>
        <StudentManagement />
      </Box>
    );
  }

  if (currentView === 'curriculum-checker') {
    return (
      <Box minHeight="100vh" bgcolor="#f5f6fa">
        <AppBar position="static" color="primary" elevation={1}>
          <Toolbar>
            <IconButton 
              edge="start" 
              color="inherit" 
              onClick={handleBackToMain}
              sx={{ mr: 2 }}
            >
              <ArrowBackIcon />
            </IconButton>
            <AssessmentIcon sx={{ mr: 2 }} />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Curriculum Checker
            </Typography>
          </Toolbar>
        </AppBar>
        <CurriculumCheckerMain />
      </Box>
    );
  }

  // Render main menu
  return (
    <Box minHeight="100vh" bgcolor="#f5f6fa">
      <AppBar position="static" color="primary" elevation={1}>
        <Toolbar>
          <IconButton 
            edge="start" 
            color="inherit" 
            onClick={onBackToDashboard}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <SchoolIcon sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Curriculum Checker System
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h4" fontWeight={600} mb={4} align="center">
            Curriculum Management System
          </Typography>
          
          <Typography variant="body1" color="text.secondary" mb={4} align="center">
            Review and validate curriculum requirements, course mappings, and academic compliance.
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={4}>
              <Card 
                elevation={2} 
                sx={{ 
                  height: '100%', 
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    elevation: 4,
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  }
                }}
                onClick={() => handleFeatureSelect('curriculum-maker')}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <AssignmentIcon sx={{ fontSize: 50, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h5" fontWeight={600} mb={2}>
                    Curriculum Maker
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Create and manage curriculum templates with courses, prerequisites, and academic requirements.
                  </Typography>
                  <Typography variant="body2" color="primary.main" fontWeight={500}>
                    Click to access →
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <Card 
                elevation={2} 
                sx={{ 
                  height: '100%', 
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    elevation: 4,
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  }
                }}
                onClick={() => handleFeatureSelect('student-management')}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <PeopleIcon sx={{ fontSize: 50, color: 'success.main', mb: 2 }} />
                  <Typography variant="h5" fontWeight={600} mb={2}>
                    Student Management
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Add students, assign curriculums, and track their course completion progress.
                  </Typography>
                  <Typography variant="body2" color="success.main" fontWeight={500}>
                    Click to access →
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <Card 
                elevation={2} 
                sx={{ 
                  height: '100%', 
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    elevation: 4,
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  }
                }}
                onClick={() => handleFeatureSelect('curriculum-checker')}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <AssessmentIcon sx={{ fontSize: 50, color: 'warning.main', mb: 2 }} />
                  <Typography variant="h5" fontWeight={600} mb={2}>
                    Curriculum Checker
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Search students and view their curriculum status with color-coded course eligibility.
                  </Typography>
                  <Typography variant="body2" color="warning.main" fontWeight={500}>
                    Click to access →
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
};

export default CurriculumChecker; 