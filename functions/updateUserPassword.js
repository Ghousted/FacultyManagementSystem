const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK only once
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.updateUserPassword = functions.https.onCall(async (data, context) => {
  try {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { uid, newPassword } = data;

    // Validate input
    if (!uid || typeof uid !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid user ID');
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters');
    }

    // Verify caller is admin
    const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    
    if (!callerDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Caller not found in database');
    }

    if (callerDoc.data().role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can update passwords');
    }

    // Update password in Firebase Auth
    await admin.auth().updateUser(uid, {
      password: newPassword
    });

    return { success: true, message: 'Password updated' };
  } catch (error) {
    console.error('updateUserPassword error:', error);
    
    // If already an HttpsError, rethrow it
    if (error.code && error.code.startsWith('functions/')) {
      throw error;
    }
    
    // Convert other errors to HttpsError
    throw new functions.https.HttpsError('internal', error.message || 'Failed to update password');
  }
});
