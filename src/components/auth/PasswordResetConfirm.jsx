import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../firebase';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { toast } from 'react-hot-toast';

const getPasswordResetParams = () => {
  const hash = window.location.hash || '';
  const queryIndex = hash.indexOf('?');
  const queryString = queryIndex >= 0 ? hash.substring(queryIndex) : window.location.search;
  return new URLSearchParams(queryString);
};

const PasswordResetConfirm = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { signout } = useAuth();

  useEffect(() => {
    const params = getPasswordResetParams();
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');

    if (mode !== 'resetPassword') {
      setError('Invalid password reset link.');
      setLoading(false);
      return;
    }

    if (!oobCode) {
      setError('Missing password reset code.');
      setLoading(false);
      return;
    }

    setCode(oobCode);
    verifyPasswordResetCode(auth, oobCode)
      .then((emailAddress) => {
        setEmail(emailAddress);
      })
      .catch((verifyError) => {
        console.error('Password reset verification failed:', verifyError);
        setError('This password reset link is invalid or expired. Please request a new link.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError('Please enter and confirm your new password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);

    try {
      await confirmPasswordReset(auth, code, password);
      toast.success('Your password has been updated.');
      setSuccess(true);
    } catch (resetError) {
      console.error('Password reset confirmation failed:', resetError);
      setError(resetError.message || 'Failed to complete password reset.');
    } finally {
      setSubmitting(false);
    }
  };

  const goToSignIn = async () => {
    try {
      await signout();
    } catch (error) {
      console.error('Error signing out before redirecting to sign in:', error);
    }
    window.location.replace(`${window.location.origin}/#/`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-left mb-4">Reset Password</h2>
        <p className="text-left text-sm text-gray-600 mb-4">
          {email ? `Reset the password for ${email}` : 'Verify your password reset link.'}
        </p>

        {loading ? (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Checking reset link...</p>
          </div>
        ) : success ? (
          <div className="space-y-4 text-left text-sm">
            <p className="text-slate-700">
                Your password has been successfully reset. You can now sign in with your new password.  Go to the sign in page to access your account.
            </p>
            <button
              type="button"
              onClick={goToSignIn}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700"
            >
              Return to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm mb-1 text-gray-700">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-700">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 "
            >
              {submitting ? 'Updating password...' : 'Update password'}
            </button>
           <div className='text-left'>
             <button
              type="button"
              onClick={goToSignIn}
              className="w-full px-4 py-2 text-sm text-blue-600 hover:underline"
            >
              Back to sign in
            </button>
           </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PasswordResetConfirm;
