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
import Logo from '../../assets/logo.png';

const CurriculumChecker = ({ onBackToDashboard, signout }) => {
  const [currentView, setCurrentView] = useState('main'); // 'main', 'curriculum-maker', 'student-management', 'curriculum-checker'
  const [tabValue, setTabValue] = useState(0);

  // Update sign out handler to use signout prop
  const handleSignOut = async () => {
    try {
      await signout();
      if (onBackToDashboard) onBackToDashboard();
    } catch (error) {
      alert("Sign out failed: " + error.message);
    }
  };

  const handleFeatureSelect = (feature) => {
    setCurrentView(feature);
  };

  const handleBackToMain = () => {
    setCurrentView('main');
  };

  // Render specific feature
  if (currentView === 'curriculum-maker') {
    return (
      <Box >
        <AppBar position="absolute" sx={{ bgcolor: '#f5f6fa' }}>
              <Toolbar>
                <Box
                  component="img"
                  src={Logo}
                  alt="Logo"
                  sx={{ width: 50, height: 50, marginRight: 2, cursor: 'pointer' }}
                  onClick={onBackToDashboard}
                />
                <Typography 
                  variant="h5" 
                  sx={{ flexGrow: 1, fontWeight: 700, color:'royalblue', cursor: 'pointer' }}
                  onClick={onBackToDashboard}
                >
                  College of Computer Studies
                </Typography>
                <Button color="error" sx={{ borderRadius: 5}} variant="contained" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </Toolbar>
            </AppBar>
        <CurriculumMaker onBack={handleBackToMain} />
      </Box>
    );
  }

  if (currentView === 'student-management') {
    return (
      <Box>
        <AppBar position="absolute" sx={{ bgcolor: '#f5f6fa' }}>
              <Toolbar>
                <Box
                  component="img"
                  src={Logo}
                  alt="Logo"
                  sx={{ width: 50, height: 50, marginRight: 2, cursor: 'pointer' }}
                  onClick={onBackToDashboard}
                />
                <Typography 
                  variant="h5" 
                  sx={{ flexGrow: 1, fontWeight: 700, color:'royalblue', cursor: 'pointer' }}
                  onClick={onBackToDashboard}
                >
                  College of Computer Studies
                </Typography>
                <Button color="error" sx={{ borderRadius: 5}} variant="contained" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </Toolbar>
            </AppBar>
        <StudentManagement />
      </Box>
    );
  }

  if (currentView === 'curriculum-checker') {
    return (
      <Box minHeight="100vh" bgcolor="#f5f6fa" p={3}>
        <AppBar position="absolute" sx={{ bgcolor: 'royalblue' }}>
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
            <Typography 
              variant="h6" 
              sx={{ flexGrow: 1, cursor: 'pointer' }}
              onClick={onBackToDashboard}
            >
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
    <Box>
      <AppBar position="absolute" sx={{ bgcolor: '#f5f6fa' }}>
              <Toolbar>
                <Box
                  component="img"
                  src={Logo}
                  alt="Logo"
                  sx={{ width: 50, height: 50, marginRight: 2, cursor: 'pointer' }}
                  onClick={onBackToDashboard}
                />
                <Typography 
                  variant="h5" 
                  sx={{ flexGrow: 1, fontWeight: 700, color:'royalblue', cursor: 'pointer' }}
                  onClick={onBackToDashboard}
                >
                  College of Computer Studies
                </Typography>
                <Button color="error" sx={{ borderRadius: 5}} variant="contained" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </Toolbar>
            </AppBar>
      
    <Box sx= {{ marginTop: 12}}>
        <Typography variant="h3" fontWeight={700} mb={2} align="center" mt={3} color="primary">
          Curriculum Management System
        </Typography>
        
        <Typography variant="h6" color="text.secondary" mb={4} align="center" sx={{ maxWidth: 600, mx: 'auto' }}>
          Review and validate curriculum requirements, course mappings, and academic compliance.
        </Typography>
        
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: 4, 
          flexWrap: 'wrap',
          maxWidth: 1200,
          mx: 'auto',
        }}>
          <Card 
            elevation={0}
            sx={{ 
              width: 320,
              height: 280,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid rgba(176, 176, 176, 1)',
              borderRadius: 4,
              bgcolor: 'white',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                border: '2px solid #1976d2',
              }
            }}
            onClick={() => handleFeatureSelect('curriculum-maker')}
          >
            <CardContent sx={{ 
              textAlign: 'center', 
              py: 4,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'

            }}>
              <Box>
                <AssignmentIcon sx={{ fontSize: 60, color: '#1976d2', mb: 3 }} />
                <Typography variant="h5" fontWeight={700} mb={2} color="primary">
                  Curriculum Maker
                </Typography>
                <Typography variant="body1" color="text.secondary" lineHeight={1.6}>
                  Create and manage curriculum templates with courses, prerequisites, and academic requirements.
                </Typography>
              </Box>
              <Typography variant="body2" color="primary" fontWeight={600} sx={{ mt: 2 }}>
                Click to access →
              </Typography>
            </CardContent>
          </Card>
          
          <Card 
            elevation={0}
            sx={{ 
              width: 320,
              height: 280,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid rgba(176, 176, 176, 1)',
              borderRadius: 4,
              bgcolor: 'white',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                border: '2px solid #2e7d32',
              }
            }}
            onClick={() => handleFeatureSelect('student-management')}
          >
            <CardContent sx={{ 
              textAlign: 'center', 
              py: 4,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <Box>
                <PeopleIcon sx={{ fontSize: 60, color: '#2e7d32', mb: 3 }} />
                <Typography variant="h5" fontWeight={700} mb={2} color="success.main">
                  Student Management
                </Typography>
                <Typography variant="body1" color="text.secondary" lineHeight={1.6}>
                  Add students, assign curriculums, and track their course completion progress.
                </Typography>
              </Box>
              <Typography variant="body2" color="success.main" fontWeight={600} sx={{ mt: 2 }}>
                Click to access →
              </Typography>
            </CardContent>
          </Card>
          
          <Card 
            elevation={0}
            sx={{ 
              width: 320,
              height: 280,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid rgba(176, 176, 176, 1)',
              borderRadius: 4,
              bgcolor: 'white',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                border: '2px solid #ed6c02',
              }
            }}
            onClick={() => handleFeatureSelect('curriculum-checker')}
          >
            <CardContent sx={{ 
              textAlign: 'center', 
              py: 4,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <Box>
                <AssessmentIcon sx={{ fontSize: 60, color: '#ed6c02', mb: 3 }} />
                <Typography variant="h5" fontWeight={700} mb={2} color="warning.main">
                  Curriculum Checker
                </Typography>
                <Typography variant="body1" color="text.secondary" lineHeight={1.6}>
                  Search students and view their curriculum status with color-coded course eligibility.
                </Typography>
              </Box>
              <Typography variant="body2" color="warning.main" fontWeight={600} sx={{ mt: 2 }}>
                Click to access →
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default CurriculumChecker;