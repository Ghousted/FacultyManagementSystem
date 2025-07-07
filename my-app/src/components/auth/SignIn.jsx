import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Stack,
  Chip,
  Snackbar,
} from '@mui/material';
import { WifiOff, Wifi, Info } from '@mui/icons-material';

const SignIn = ({ onSwitchToResetPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { signin, isOnline } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    const result = await signin(email, password);
    if (!result.success) {
      setError(result.error);
    } else {
      if (result.offline && result.message) {
        setSuccessMessage(result.message);
      }
    }
    setLoading(false);
  };

  const handleCloseSuccess = () => {
    setSuccessMessage('');
  };

  return (
    <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="#f5f6fa">
      <Box maxWidth={400} width="100%" p={4} bgcolor="white" borderRadius={2} boxShadow={3}>
        <Typography variant="h4" align="center" fontWeight={700} mb={2}>
          Sign in to your account
        </Typography>
        
        {/* Network Status Indicator */}
        <Box display="flex" justifyContent="center" mb={2}>
          <Chip
            icon={isOnline ? <Wifi /> : <WifiOff />}
            label={isOnline ? "Online Mode" : "Offline Mode"}
            color={isOnline ? "success" : "warning"}
            size="small"
          />
        </Box>
        
        {/* Offline Mode Info */}
        {!isOnline && (
          <Alert severity="info" sx={{ mb: 2 }} icon={<Info />}>
            You are currently offline. You can sign in using previously cached credentials.
          </Alert>
        )}
        
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              autoComplete="email"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              autoComplete="current-password"
            />
            <Button
              onClick={onSwitchToResetPassword}
              size="small"
              sx={{ alignSelf: 'flex-end', textTransform: 'none' }}
              disabled={!isOnline}
            >
              Forgot your password?
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading}
              sx={{ mt: 1 }}
            >
              {loading ? 'Signing in...' : !isOnline ? 'Sign in (Offline)' : 'Sign in'}
            </Button>
          </Stack>
        </form>
      </Box>
      
      {/* Success Message Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={handleCloseSuccess}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSuccess} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SignIn; 