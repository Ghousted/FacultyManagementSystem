# Firebase Connection Issue Fix

## Problem
You're getting a 400 Bad Request error when trying to access the Curriculum Maker. This is because Firebase Firestore requires authentication, but the app is trying to access it without being signed in.

## Solution

### 1. Sign In First
Make sure you're signed in to the app before accessing any curriculum features. The app now requires authentication for all Firestore operations.

### 2. Update Firestore Rules (Recommended)
Go to your Firebase Console and update your Firestore rules to match the ones in `firestore.rules`:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`ccs-faculty-8c171`)
3. Go to Firestore Database → Rules
4. Replace the current rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read and write all documents
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

5. Click "Publish"

### 3. Alternative: Allow Public Access (Less Secure)
If you want to allow public access without authentication, use these rules instead:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Warning**: This allows anyone to read and write to your database.

### 4. Check Firebase Project Settings
Make sure your Firebase project is properly configured:

1. Verify the project ID in `src/firebase.js` matches your Firebase project
2. Ensure Firestore Database is enabled in your Firebase project
3. Check that your API key and other credentials are correct

### 5. Test the Fix
1. Sign in to the app using the authentication system
2. Try accessing the Curriculum Maker again
3. The error should be resolved

## Current App Behavior
- All curriculum features now require authentication
- Users must sign in before accessing any data
- Clear error messages guide users to sign in
- The app gracefully handles unauthenticated states

## If Issues Persist
1. Check the browser console for additional error messages
2. Verify your Firebase project is in the correct region
3. Ensure you have the latest version of Firebase SDK
4. Try clearing browser cache and cookies 