import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Paper,
  Grid,
  Container,
  Card,
  CardContent,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import PaymentIcon from '@mui/icons-material/Payment';
import CurriculumChecker from './curriculum-checker/CurriculumChecker';
import PayablesSystem from './payables-system/PayablesSystem';
import Logo from '../assets/logo.png';

const Dashboard = () => {
  const { currentUser, signout } = useAuth();
  const [selectedSystem, setSelectedSystem] = useState(null);

  const handleSignOut = async () => {
    try {
      await signout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSystemSelect = (system) => {
    setSelectedSystem(system);
  };

  const handleBackToDashboard = () => {
    setSelectedSystem(null);
  };

  // Render the selected system
  if (selectedSystem === 'Curriculum Checker') {
    return <CurriculumChecker onBackToDashboard={handleBackToDashboard} />;
  }

  if (selectedSystem === 'Payables System') {
    return <PayablesSystem onBackToDashboard={handleBackToDashboard} />;
  }

  // Render the main dashboard
  return (
    <Box >
      <AppBar position="absolute" sx={{ bgcolor: '#f5f6fa' }}>
        <Toolbar>
          <Box
            component="img"
            src={Logo}
            alt="Logo"
            sx={{ width: 50, height: 50, marginRight: 2, cursor: 'pointer' }}
            onClick={handleBackToDashboard}
          />
          <Typography 
            variant="h5" 
            sx={{ flexGrow: 1, fontWeight: 700, color:'royalblue', cursor: 'pointer' }}
            onClick={handleBackToDashboard}
          >
            College of Computer Studies
          </Typography>
          <Button color="error" sx={{ borderRadius: 5}} variant="contained" onClick={handleSignOut}>
            Sign Out
          </Button>
        </Toolbar>
      </AppBar>
      
      <Box sx={{ p: 4, marginTop: '64px', textAlign: 'center' }}>
        <Typography variant="h3" fontWeight={700} mb={1} align="center" color="primary">
          Welcome, {currentUser?.displayName || currentUser?.email}!
        </Typography>
        
        <Typography variant="h6" color="text.secondary" mb={4} align="center" sx={{ maxWidth: 600, mx: 'auto' }}>
          Select a system to manage your institution's curriculum and financial operations.
        </Typography>
        
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: 4, 
          flexWrap: 'wrap',
          maxWidth: 1000,
          mx: 'auto'
        }}>
          <Card 
            elevation={0}
            sx={{ 
              width: 400,
              height: 300,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid rgba(176, 176, 176, 1)',
              bgcolor: 'white',
              borderRadius: 2,
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                border: '2px solid #1976d2',
              }
            }}
            onClick={() => handleSystemSelect('Curriculum Checker')}
          >
            <CardContent sx={{ 
              textAlign: 'center', 
              py: 4,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              <Box>
                <SchoolIcon sx={{ fontSize: 70, color: '#1976d2', mb: 3 }} />
                <Typography variant="h4" fontWeight={700} mb={2} color="primary">
                  Curriculum Checker
                </Typography>
                <Typography variant="body1" color="text.secondary" lineHeight={1.6}>
                  Review and validate curriculum requirements, course mappings, and academic compliance.
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
              width: 400,
              height: 300,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: '2px solid rgba(176, 176, 176, 1)',
              bgcolor: 'white',
              borderRadius: 2,
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                border: '2px solid #2e7d32',
              }
            }}
            onClick={() => handleSystemSelect('Payables System')}
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
                <PaymentIcon sx={{ fontSize: 70, color: '#2e7d32', mb: 3 }} />
                <Typography variant="h4" fontWeight={700} mb={2} color="success.main">
                  Payables System
                </Typography>
                <Typography variant="body1" color="text.secondary" lineHeight={1.6}>
                  Manage invoices, track payments, and handle financial transactions for the institution.
                </Typography>
              </Box>
              <Typography variant="body2" color="success.main" fontWeight={600} sx={{ mt: 2 }}>
                Click to access →
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;