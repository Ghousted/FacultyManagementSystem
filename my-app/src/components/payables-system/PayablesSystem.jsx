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
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PaymentIcon from '@mui/icons-material/Payment';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SettingsIcon from '@mui/icons-material/Settings';

const PayablesSystem = ({ onBackToDashboard }) => {
  const handleFeatureSelect = (feature) => {
    console.log(`Selected feature: ${feature}`);
    alert(`Opening ${feature}...`);
  };

  return (
    <Box minHeight="100vh" bgcolor="#f5f6fa">
      <AppBar position="static" color="success" elevation={1}>
        <Toolbar>
          <IconButton 
            edge="start" 
            color="inherit" 
            onClick={onBackToDashboard}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <PaymentIcon sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Payables System
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h4" fontWeight={600} mb={4} align="center">
            Financial Management System
          </Typography>
          
          <Typography variant="body1" color="text.secondary" mb={4} align="center">
            Manage invoices, track payments, and handle financial transactions for the institution.
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
                onClick={() => handleFeatureSelect('Invoice Management')}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <ReceiptIcon sx={{ fontSize: 50, color: 'primary.main', mb: 2 }} />
                  <Typography variant="h6" fontWeight={600} mb={2}>
                    Invoice Management
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Create, track, and manage invoices and payment requests.
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
                onClick={() => handleFeatureSelect('Payment Tracking')}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <AccountBalanceIcon sx={{ fontSize: 50, color: 'success.main', mb: 2 }} />
                  <Typography variant="h6" fontWeight={600} mb={2}>
                    Payment Tracking
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Monitor payment status, track transactions, and manage cash flow.
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
                onClick={() => handleFeatureSelect('Financial Reports')}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <AssessmentIcon sx={{ fontSize: 50, color: 'warning.main', mb: 2 }} />
                  <Typography variant="h6" fontWeight={600} mb={2}>
                    Financial Reports
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Generate financial reports, analytics, and budget summaries.
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
                onClick={() => handleFeatureSelect('Vendor Management')}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <PaymentIcon sx={{ fontSize: 50, color: 'info.main', mb: 2 }} />
                  <Typography variant="h6" fontWeight={600} mb={2}>
                    Vendor Management
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage vendor information, contracts, and payment terms.
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
                onClick={() => handleFeatureSelect('System Settings')}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <SettingsIcon sx={{ fontSize: 50, color: 'secondary.main', mb: 2 }} />
                  <Typography variant="h6" fontWeight={600} mb={2}>
                    System Settings
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configure payment rules, approval workflows, and system preferences.
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

export default PayablesSystem; 