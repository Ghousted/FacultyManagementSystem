import { useState } from 'react';
import SignIn from './SignIn';
import PasswordReset from './PasswordReset';

const AuthContainer = () => {
  const [authMode, setAuthMode] = useState('signin'); // 'signin', 'reset'

  const switchToSignIn = () => setAuthMode('signin');
  const switchToResetPassword = () => setAuthMode('reset');

  return (
    <div>
      {authMode === 'signin' && (
        <SignIn 
          onSwitchToResetPassword={switchToResetPassword}
        />
      )}
      
      {authMode === 'reset' && (
        <PasswordReset 
          onSwitchToSignIn={switchToSignIn}
        />
      )}
    </div>
  );
};

export default AuthContainer; 