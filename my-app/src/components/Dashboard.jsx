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

const Dashboard = () => {
  const { currentUser, signout } = useAuth();

  const handleSignOut = async () => {
    try {
      await signout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSystemSelect = (system) => {
    // TODO: Implement navigation to specific system
    console.log(`Selected system: ${system}`);
    // You can implement routing here or pass this to a parent component
    alert(`Navigating to ${system} system...`);
  };

  return (
    <Box minHeight="100vh" bgcolor="#f5f6fa">
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            CCS Faculty Portal
          </Typography>
          <Button color="primary" variant="contained" onClick={handleSignOut}>
            Sign Out
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h5" fontWeight={600} mb={4} align="center">
            Welcome, {currentUser?.displayName || currentUser?.email}!
          </Typography>
          
          {/* System Selection Section */}
          <Typography variant="h6" fontWeight={500} mb={4} align="center">
            Select a System
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
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
                onClick={() => handleSystemSelect('Curriculum Checker')}
              >
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <SchoolIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h5" fontWeight={600} mb={2}>
                    Curriculum Checker
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Review and validate curriculum requirements, course mappings, and academic compliance.
                  </Typography>
                  <Typography variant="body2" color="primary.main" fontWeight={500}>
                    Click to access →
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
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
                onClick={() => handleSystemSelect('Payables System')}
              >
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <PaymentIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                  <Typography variant="h5" fontWeight={600} mb={2}>
                    Payables System
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Manage invoices, track payments, and handle financial transactions for the institution.
                  </Typography>
                  <Typography variant="body2" color="success.main" fontWeight={500}>
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

export default Dashboard; 