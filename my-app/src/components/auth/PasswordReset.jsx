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

const PasswordReset = ({ onSwitchToSignIn }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (!email) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    const result = await resetPassword(email);
    if (result.success) {
      setMessage('Password reset email sent! Check your inbox.');
      setEmail('');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="#f5f6fa">
      <Box maxWidth={400} width="100%" p={4} bgcolor="white" borderRadius={2} boxShadow={3}>
        <Typography variant="h4" align="center" fontWeight={700} mb={1}>
          Reset your password
        </Typography>
        <Typography align="center" variant="body2" color="text.secondary" mb={2}>
          Enter your email address and we'll send you a link to reset your password.
        </Typography>
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {message && <Alert severity="success">{message}</Alert>}
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              autoComplete="email"
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </Button>
            <Button
              onClick={onSwitchToSignIn}
              size="small"
              sx={{ textTransform: 'none' }}
            >
              Back to sign in
            </Button>
          </Stack>
        </form>
      </Box>
    </Box>
  );
};

export default PasswordReset; 