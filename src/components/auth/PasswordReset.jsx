import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';

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
      toast.error('Please enter your email address');
      setLoading(false);
      return;
    }

    const result = await resetPassword(email);
    if (result.success) {
      toast.success('Password reset email sent! Check your inbox.');
      setEmail('');
    } else {
      toast.error(result.error || 'Failed to send reset email');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
        <h4 className="text-left text-2xl font-bold mb-1">
          Reset your password
        </h4>
        <p className="text-left text-sm text-gray-600 mb-2">
          Enter your email address and we'll send you a link to reset your password.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 mt-6">
            {/* messages shown via toast notifications */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm  text-gray-700 mb-1"
              >
                Email Address
              </label>
              <input
                type="email"
                className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                placeholder="tcc.ccs.official@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
           </div>
            <button
              type="submit"
              className="w-full p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer "
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
           <div className='text-left'>
             <button
              type="button"
              onClick={onSwitchToSignIn}
              className="text-sm cursor-pointer text-blue-600 hover:underline"
            >
              Back to sign in
            </button>
           </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordReset; 