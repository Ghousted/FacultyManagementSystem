import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';

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
    setLoading(true);

    if (!email || !password) {
      toast.error('Please fill in all fields');
      setLoading(false);
      return;
    }

    const result = await signin(email, password);
    if (!result.success) {
      toast.error(result.error || 'Sign in failed');
    } else {
      if (result.offline && result.message) {
        toast.success(result.message);
      }
    }
    setLoading(false);
  };

  const handleCloseSuccess = () => {
    /* kept for compatibility */
  };

  return (
    <div className=" min-h-[90vh] flex items-center justify-center ">
      <div className="max-w-md w-full p-8 border border-gray-200 bg-white rounded-lg shadow-lg">
        <h4 className="text-center text-2xl font-bold mb-4">
          Sign in to your account
        </h4>
        
        {/* Network Status Indicator */}
        <div className="flex justify-center mb-4">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${isOnline ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            <span className="mr-1">{isOnline ? '📶' : '📵'}</span>
            {isOnline ? "Online Mode" : "Offline Mode"}
          </span>
        </div>
        
        {/* Offline Mode Info */}
        {!isOnline && (
          <div className="mb-2 p-4 bg-blue-50 border border-blue-200 rounded text-blue-800">
            <div className="flex items-center">
              <span className="mr-2">ℹ️</span>
              You are currently offline. You can sign in using previously cached credentials.
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* error messages are shown via toast notifications */}
            <input
              type="email"
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              type="password"
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={onSwitchToResetPassword}
              className="text-sm text-blue-600 hover:underline block ml-auto"
              disabled={!isOnline}
            >
              Forgot your password?
            </button>
            <button
              type="submit"
              className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              disabled={loading}
            >
              {loading ? 'Signing in...' : !isOnline ? 'Sign in (Offline)' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Success Message */}
      {!!successMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white p-4 rounded shadow-lg">
          {successMessage}
          <button onClick={handleCloseSuccess} className="ml-4 font-bold">×</button>
        </div>
      )}
    </div>
  );
};

export default SignIn; 