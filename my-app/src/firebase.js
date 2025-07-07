import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAnC0toDcYZyT4xnwFZ7gzddFgka3hnWF8",
  authDomain: "ccs-faculty-8c171.firebaseapp.com",
  projectId: "ccs-faculty-8c171",
  storageBucket: "ccs-faculty-8c171.firebasestorage.app",
  messagingSenderId: "325465298920",
  appId: "1:325465298920:web:07bd5d49c5f55af8eef65d",
  measurementId: "G-Z2F76MVB4Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence failed: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence is not available in this browser');
  }
});
export const storage = getStorage(app);

export default app; 