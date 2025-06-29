import { useState } from 'react';
import SignIn from './SignIn';
import SignUp from './SignUp';
import PasswordReset from './PasswordReset';

const AuthContainer = () => {
  const [authMode, setAuthMode] = useState('signin'); // 'signin', 'signup', 'reset'

  const switchToSignIn = () => setAuthMode('signin');
  const switchToSignUp = () => setAuthMode('signup');
  const switchToResetPassword = () => setAuthMode('reset');

  return (
    <div>
      {authMode === 'signin' && (
        <SignIn 
          onSwitchToSignUp={switchToSignUp}
          onSwitchToResetPassword={switchToResetPassword}
        />
      )}
      
      {authMode === 'signup' && (
        <SignUp 
          onSwitchToSignIn={switchToSignIn}
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