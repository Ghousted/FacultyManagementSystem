import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { logSystemAction } from '../utils/auditLogger';
import { passwordResetActionCodeSettings } from '../utils/authHelpers';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState({
    pendingActions: [],
    cachedUser: null,
    lastSync: null
  });

  // Network status detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('App is now online');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      console.log('App is now offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load cached data on app start
  useEffect(() => {
    const loadCachedData = () => {
      try {
        const cachedUser = localStorage.getItem('cachedUser');
        const cachedOfflineData = localStorage.getItem('offlineData');
        
        if (cachedUser) {
          const userData = JSON.parse(cachedUser);
          setCurrentUser(userData);
          if (userData.role) {
            setRole(userData.role);
          }
        }
        
        if (cachedOfflineData) {
          const offlineDataParsed = JSON.parse(cachedOfflineData);
          setOfflineData(offlineDataParsed);
        }
      } catch (error) {
        console.error('Error loading cached data:', error);
        // Clear corrupted cache
        localStorage.removeItem('cachedUser');
        localStorage.removeItem('offlineData');
      }
    };

    loadCachedData();
  }, []);

  // Cache user data
  const cacheUserData = (user) => {
    if (user) {
      let cachedRole = role;
      try {
        const cachedUser = localStorage.getItem('cachedUser');
        cachedRole = cachedUser ? JSON.parse(cachedUser).role : role;
      } catch (error) {
        console.error('Error reading cached user role:', error);
      }

      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        role: user.role || cachedRole || null,
        lastSignInTime: new Date().toISOString()
      };
      localStorage.setItem('cachedUser', JSON.stringify(userData));
      return userData;
    }
    return null;
  };

  // Cache offline data
  const cacheOfflineData = (data) => {
    const updatedData = { ...offlineData, ...data };
    setOfflineData(updatedData);
    localStorage.setItem('offlineData', JSON.stringify(updatedData));
  };

  // Fetch user role from Firestore
  const fetchRole = async (user) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      let resolvedRole = 'admin';

      if (userDoc.exists()) {
        resolvedRole = userDoc.data().role || 'admin'; // Default to admin if no role set
      } else {
        // Create user document with default admin role
        await setDoc(doc(db, 'users', user.uid), { 
          role: 'admin',
          email: user.email || null,
          createdAt: new Date().toISOString()
        });
      }

      setRole(resolvedRole);
      cacheUserData({ ...user, role: resolvedRole });
      return resolvedRole;
    } catch (error) {
      console.error('Error fetching role:', error);
      setRole('admin'); // Default to admin on error
      cacheUserData({ ...user, role: 'admin' });
      return 'admin';
    }
  };

  // Update user role in Firestore
  const updateRole = async (userId, newRole) => {
    try {
      await setDoc(doc(db, 'users', userId), { role: newRole }, { merge: true });
      if (userId === currentUser?.uid) {
        setRole(newRole);
      }
      await logSystemAction({
        action: 'Updated user role',
        module: 'User Management',
        entityType: 'user',
        entityId: userId,
        description: `Updated user role to ${newRole}`,
        details: { userId, newRole }
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating role:', error);
      return { success: false, error: error.message };
    }
  };

  // Add pending action for sync when online
  const addPendingAction = (action) => {
    const pendingActions = [...offlineData.pendingActions, {
      ...action,
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    }];
    cacheOfflineData({ pendingActions });
  };

  // Sign in function with offline support
  const signin = async (email, password) => {
    if (!isOnline) {
      // Try offline sign-in with cached credentials
      try {
        console.log('Attempting offline sign-in...');
        const cachedCredentials = localStorage.getItem('cachedCredentials');
        console.log('Cached credentials found:', !!cachedCredentials);
        
        if (cachedCredentials) {
          const credentials = JSON.parse(cachedCredentials);
          console.log('Cached email:', credentials.email, 'Input email:', email);
          console.log('Password match:', credentials.password === password);
          
          if (credentials.email === email && credentials.password === password) {
            const cachedUser = localStorage.getItem('cachedUser');
            console.log('Cached user found:', !!cachedUser);
            
            if (cachedUser) {
              const userData = JSON.parse(cachedUser);
              setCurrentUser(userData);
              console.log('Offline sign-in successful');
              return { 
                success: true, 
                user: userData, 
                offline: true,
                message: 'Signed in using cached credentials (offline mode)'
              };
            } else {
              console.log('No cached user data found');
            }
          } else {
            console.log('Credentials do not match');
          }
        } else {
          console.log('No cached credentials found');
        }
        
        return { 
          success: false, 
          error: 'Cannot sign in offline. Please check your internet connection or use previously cached credentials.',
          offline: true
        };
      } catch (error) {
        console.error('Error during offline sign-in:', error);
        return { 
          success: false, 
          error: 'Error during offline sign-in attempt.',
          offline: true
        };
      }
    }

    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedPassword = password || '';

    if (!normalizedEmail || !normalizedPassword) {
      return { success: false, error: 'Email and password are required.', offline: false };
    }

    try {
      const result = await signInWithEmailAndPassword(auth, normalizedEmail, normalizedPassword);
      
      // Cache user data and credentials for offline use
      const userData = cacheUserData(result.user);
      localStorage.setItem('cachedCredentials', JSON.stringify({ email: normalizedEmail, password: normalizedPassword }));
      console.log('Credentials cached for offline use:', { email: normalizedEmail, password: '***' });
      
      // Add to pending actions for sync
      addPendingAction({
        type: 'SIGN_IN',
        data: { email: normalizedEmail, timestamp: new Date().toISOString() }
      });
      await logSystemAction({
        action: 'Signed in',
        module: 'Authentication',
        entityType: 'user',
        entityId: result.user.uid,
        description: `Signed in ${normalizedEmail}`,
        actor: {
          userId: result.user.uid,
          userEmail: result.user.email,
          userName: result.user.displayName || result.user.email
        }
      });
      
      return { success: true, user: result.user, offline: false };
    } catch (error) {
      // If Firebase Auth fails, check if admin set a temporary password in Firestore
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        try {
          console.log('Checking Firestore for admin-set temporary password...');
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', normalizedEmail));
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            const userId = snapshot.docs[0].id;
            
            // Check if admin set a temporary password
            if (userData.tempPassword && userData.tempPassword === normalizedPassword) {
              console.log('Temporary password matched! Logging in with admin temp password.');
              const fallbackUser = {
                uid: userId,
                email: normalizedEmail,
                displayName: userData.fullName || normalizedEmail,
                role: userData.role || 'admin'
              };
              cacheUserData(fallbackUser);
              localStorage.setItem('cachedCredentials', JSON.stringify({ email: normalizedEmail, password: normalizedPassword }));
              await setDoc(doc(db, 'users', userId), {
                tempPassword: null,
                requiresPasswordReset: false
              }, { merge: true });
              return { success: true, user: fallbackUser, offline: false };
            }
          }
        } catch (firestoreError) {
          console.error('Error checking Firestore for temporary password:', firestoreError);
        }
      }
      
      // Handle specific Firebase auth errors
      if (error.code === 'auth/network-request-failed') {
        return { 
          success: false, 
          error: 'Network error. Please check your internet connection and try again.',
          offline: true
        };
      }
      return { success: false, error: error.message, offline: false };
    }
  };

  // Sign out function with offline support
  const signout = async () => {
    try {
      if (isOnline) {
        await signOut(auth);
      }
      
      // For offline functionality, we need to preserve both credentials AND user data
      // Only clear the current user state, but keep cached data for offline sign-in
      setCurrentUser(null);
      
      // Note: We preserve both cachedCredentials AND cachedUser for offline sign-in
      // This allows users to sign back in offline after signing out
      
      // Add to pending actions
      addPendingAction({
        type: 'SIGN_OUT',
        data: { timestamp: new Date().toISOString() }
      });
      await logSystemAction({
        action: 'Signed out',
        module: 'Authentication',
        entityType: 'user',
        entityId: currentUser?.uid || '',
        description: `Signed out ${currentUser?.email || ''}`.trim(),
        actor: {
          userId: currentUser?.uid,
          userEmail: currentUser?.email,
          userName: currentUser?.displayName || currentUser?.email,
          role
        }
      });
      
      return { success: true, offline: !isOnline };
    } catch (error) {
      // Allow sign out even if offline (local state change)
      if (error.code === 'auth/network-request-failed') {
        setCurrentUser(null);
        return { success: true, offline: true };
      }
      return { success: false, error: error.message, offline: !isOnline };
    }
  };

  // Password reset function with offline handling
  const resetPassword = async (email) => {
    if (!isOnline) {
      return { 
        success: false, 
        error: 'Cannot reset password while offline. Please check your internet connection.',
        offline: true
      };
    }

    try {
      await sendPasswordResetEmail(auth, email, passwordResetActionCodeSettings);
      
      // Add to pending actions
      addPendingAction({
        type: 'PASSWORD_RESET',
        data: { email, timestamp: new Date().toISOString() }
      });
      
      return { success: true, offline: false };
    } catch (error) {
      const code = error?.code || '';

      if (code === 'auth/invalid-email') {
        return {
          success: false,
          error: 'Invalid email address. Please check the email and try again.',
          offline: false
        };
      }

      if (code === 'auth/too-many-requests') {
        return {
          success: false,
          error: 'Too many reset attempts. Please wait a few minutes before trying again.',
          offline: false
        };
      }

      if (code === 'auth/invalid-continue-uri' || code === 'auth/missing-continue-uri') {
        return {
          success: false,
          error: 'Password reset link configuration is invalid. Please contact admin to verify Firebase Authorized Domains.',
          offline: false
        };
      }

      if (code === 'auth/unauthorized-continue-uri') {
        return {
          success: false,
          error: 'This domain is not authorized for password reset links. Please add it under Firebase Authentication > Settings > Authorized domains.',
          offline: false
        };
      }

      if (error.code === 'auth/network-request-failed') {
        return { 
          success: false, 
          error: 'Network error. Please check your internet connection and try again.',
          offline: true
        };
      }
      return { success: false, error: error.message, offline: false };
    }
  };

  // Update profile function with offline handling
  const updateUserProfile = async (updates) => {
    if (!isOnline) {
      // Cache profile updates for later sync
      const updatedUser = { ...currentUser, ...updates };
      cacheUserData(updatedUser);
      setCurrentUser(updatedUser);
      
      addPendingAction({
        type: 'PROFILE_UPDATE',
        data: { updates, timestamp: new Date().toISOString() }
      });
      
      return { 
        success: true, 
        message: 'Profile updated locally (will sync when online)',
        offline: true
      };
    }

    try {
      await updateProfile(currentUser, updates);
      
      // Update cached user data
      const updatedUser = { ...currentUser, ...updates };
      cacheUserData(updatedUser);
      setCurrentUser(updatedUser);
      
      addPendingAction({
        type: 'PROFILE_UPDATE',
        data: { updates, timestamp: new Date().toISOString() }
      });
      
      return { success: true, offline: false };
    } catch (error) {
      if (error.code === 'auth/network-request-failed') {
        return { 
          success: false, 
          error: 'Network error. Please check your internet connection and try again.',
          offline: true
        };
      }
      return { success: false, error: error.message, offline: false };
    }
  };

  // Clear cached credentials (for security purposes)
  const clearCachedCredentials = () => {
    localStorage.removeItem('cachedCredentials');
    localStorage.removeItem('cachedUser');
    return { success: true, message: 'Cached credentials and user data cleared' };
  };

  // Sync pending actions when coming back online
  useEffect(() => {
    if (isOnline && offlineData.pendingActions.length > 0) {
      console.log('Syncing pending actions:', offlineData.pendingActions);
      // Here you would implement the actual sync logic
      // For now, we'll just clear the pending actions
      cacheOfflineData({ 
        pendingActions: [],
        lastSync: new Date().toISOString()
      });
    }
  }, [isOnline, offlineData.pendingActions]);

  // Listen for auth state changes with offline handling
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Cache user data when online authentication succeeds
        const userData = cacheUserData(user);
        setCurrentUser(userData);
        // Fetch user role
        await fetchRole(user);
      } else {
        // For offline functionality, preserve cached user data
        // Only clear the current user state, not the cached data
        setCurrentUser(null);
        setRole(null);
        // Note: Both cachedCredentials AND cachedUser are preserved for offline functionality
      }
      setLoading(false);
    }, (error) => {
      // Handle auth state change errors (like network issues)
      if (error.code === 'auth/network-request-failed') {
        console.log('Auth state change failed due to network issue - continuing with cached state');
        setLoading(false);
      } else {
        console.error('Auth state change error:', error);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    role,
    signin,
    signout,
    resetPassword,
    updateUserProfile,
    updateRole,
    clearCachedCredentials,
    loading,
    isOnline,
    offlineData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 
