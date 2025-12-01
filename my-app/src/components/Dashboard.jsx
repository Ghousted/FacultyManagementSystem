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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import PaymentIcon from '@mui/icons-material/Payment';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import EditIcon from '@mui/icons-material/Edit';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import CurriculumChecker from './curriculum-checker/CurriculumChecker';
import PayablesSystem from './payables-system/PayablesSystem';
import Logo from '../assets/logo.png';

const Dashboard = () => {
  const { currentUser, role, signout, updateRole } = useAuth();
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState('');

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

  // Check if user can access a system based on role
  const canAccessSystem = (system) => {
    if (!role) return false;
    if (role === 'admin') return true;
    if (role === 'payables' && system === 'Payables System') return true;
    if (role === 'curriculum' && system === 'Curriculum Checker') return true;
    return false;
  };

  // Admin functions
  const handleOpenAdminPanel = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
      setAdminDialogOpen(true);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleEditRole = (user) => {
    setEditingUser(user);
    setNewRole(user.role || 'admin');
  };

  const handleSaveRole = async () => {
    if (editingUser) {
      const result = await updateRole(editingUser.id, newRole);
      if (result.success) {
        setUsers(users.map(user => 
          user.id === editingUser.id ? { ...user, role: newRole } : user
        ));
        setEditingUser(null);
        setNewRole('');
      }
    }
  };

  const handleCloseAdminPanel = () => {
    setAdminDialogOpen(false);
    setEditingUser(null);
    setNewRole('');
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
          {role === 'admin' && (
            <Button 
              startIcon={<AdminPanelSettingsIcon />}
              sx={{ mr: 2, borderRadius: 5 }} 
              variant="outlined" 
              onClick={handleOpenAdminPanel}
            >
              Admin Panel
            </Button>
          )}
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
          {canAccessSystem('Curriculum Checker') && (
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
          )}
          
          {canAccessSystem('Payables System') && (
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
          )}
        </Box>
      </Box>

      {/* Admin Panel Dialog */}
      <Dialog open={adminDialogOpen} onClose={handleCloseAdminPanel} maxWidth="md" fullWidth>
        <DialogTitle>User Role Management</DialogTitle>
        <DialogContent>
          <List>
            {users.map((user) => (
              <ListItem key={user.id}>
                <ListItemText 
                  primary={user.email || user.id}
                  secondary={`Role: ${user.role || 'admin'}`}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" onClick={() => handleEditRole(user)}>
                    <EditIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
          
          {editingUser && (
            <Box sx={{ mt: 2, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>
                Edit Role for {editingUser.email || editingUser.id}
              </Typography>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Role</InputLabel>
                <Select
                  value={newRole}
                  label="Role"
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  <MenuItem value="admin">Admin (Full Access)</MenuItem>
                  <MenuItem value="payables">Payables System Only</MenuItem>
                  <MenuItem value="curriculum">Curriculum Checker Only</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button onClick={handleSaveRole} variant="contained">
                  Save
                </Button>
                <Button onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAdminPanel}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;