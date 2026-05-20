import { useState } from 'react';
import SignIn from './SignIn';
import PasswordReset from './PasswordReset';

const AuthContainer = () => {
  const [authMode, setAuthMode] = useState('signin'); // 'signin', 'reset'

  const switchToSignIn = () => {
    window.location.hash = '';
    setAuthMode('signin');
  };
  const switchToResetPassword = () => {
    window.location.hash = '#/forgot-password';
    setAuthMode('reset');
  };

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