import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Stack,
} from '@mui/material';

const SignIn = ({ onSwitchToResetPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signin } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    const result = await signin(email, password);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="#f5f6fa">
      <Box maxWidth={400} width="100%" p={4} bgcolor="white" borderRadius={2} boxShadow={3}>
        <Typography variant="h4" align="center" fontWeight={700} mb={2}>
          Sign in to your account
        </Typography>
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
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </Stack>
        </form>
      </Box>
    </Box>
  );
};

export default SignIn; 