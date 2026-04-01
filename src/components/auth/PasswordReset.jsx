import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full p-4 bg-white rounded-lg shadow-lg">
        <h4 className="text-center text-2xl font-bold mb-1">
          Reset your password
        </h4>
        <p className="text-center text-sm text-gray-600 mb-2">
          Enter your email address and we'll send you a link to reset your password.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {error && <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800">{error}</div>}
            {message && <div className="p-4 bg-green-50 border border-green-200 rounded text-green-800">{message}</div>}
            <input
              type="email"
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <button
              type="submit"
              className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <button
              type="button"
              onClick={onSwitchToSignIn}
              className="text-sm text-blue-600 hover:underline"
            >
              Back to sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordReset; 