import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    setDoc,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy
  } from 'firebase/firestore';
  import { db } from '../firebase';
  
  // Payables Model Functions
  export const createPayable = async (payableData, userId) => {
    try {
      const docRef = await addDoc(collection(db, 'payables'), {
        ...payableData,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creating payable:', error);
      return { success: false, error: error.message };
    }
  };
  
  export const getPayables = async (userId) => {
    try {
      const payablesRef = collection(db, 'payables');
      const q = query(payablesRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const payables = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      return { success: true, data: payables };
    } catch (error) {
      console.error('Error getting payables:', error);
      return { success: false, error: error.message };
    }
  };
  
  export const updatePayable = async (payableId, updates) => {
    try {
      await updateDoc(doc(db, 'payables', payableId), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating payable:', error);
      return { success: false, error: error.message };
    }
  };
  
  export const deletePayable = async (payableId) => {
    try {
      await deleteDoc(doc(db, 'payables', payableId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting payable:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Student Payment Model Functions
  export const createStudentPayment = async (studentPaymentData) => {
    try {
      const docRef = await addDoc(collection(db, 'studentPayments'), {
        ...studentPaymentData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creating student payment:', error);
      return { success: false, error: error.message };
    }
  };
  
  export const getStudentPayments = async (studentId, payableId) => {
    try {
      const studentPaymentsRef = collection(db, 'studentPayments');
      const q = query(
        studentPaymentsRef, 
        where('studentId', '==', studentId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const studentPayments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter(payment => payment.payableId === payableId);
      return { success: true, data: studentPayments };
    } catch (error) {
      console.error('Error getting student payments:', error);
      return { success: false, error: error.message };
    }
  };
  
  export const updateStudentPayment = async (paymentId, updates) => {
    try {
      await updateDoc(doc(db, 'studentPayments', paymentId), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating student payment:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Get all payments for a student
  export const getAllStudentPayments = async (studentId) => {
    try {
      const studentPaymentsRef = collection(db, 'studentPayments');
      const q = query(
        studentPaymentsRef, 
        where('studentId', '==', studentId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const studentPayments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      return { success: true, data: studentPayments };
    } catch (error) {
      console.error('Error getting all student payments:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Helper function to get payables by year level
  export const getPayablesByYearLevel = async (userId, yearLevel) => {
    try {
      const result = await getPayables(userId);
      if (result.success) {
        const yearPayables = result.data.filter(p => p.yearLevel === yearLevel && !p.deleted);
        return { success: true, data: yearPayables };
      }
      return result;
    } catch (error) {
      console.error('Error getting payables by year level:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Helper function to calculate total balance for a student
  export const calculateStudentBalance = async (studentId, payableId) => {
    // Implement as needed, using Firestore only
  };

  // Module (Offered Subject) Helpers
  // A "module" is a course/subject the department itself is offering as a payable.
  // We mark this directly on the course doc with `isOffered: true`.
  export const getOfferedModules = async () => {
    try {
      const q = query(collection(db, 'courses'), where('isOffered', '==', true));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          (a.courseCode || '').localeCompare(b.courseCode || '') ||
          (a.courseTitle || '').localeCompare(b.courseTitle || '')
        );
      return { success: true, data };
    } catch (error) {
      console.error('Error getting offered modules:', error);
      return { success: false, error: error.message };
    }
  };

  // Professor cutback rate (single global value, customizable).
  const CUTBACK_SETTINGS_DOC = doc(db, 'settings', 'professor_cutback');
  const DEFAULT_CUTBACK_PER_STUDENT = 50;

  export const getCutbackRate = async () => {
    try {
      const snap = await getDoc(CUTBACK_SETTINGS_DOC);
      if (!snap.exists()) {
        await setDoc(CUTBACK_SETTINGS_DOC, {
          ratePerStudent: DEFAULT_CUTBACK_PER_STUDENT,
          updatedAt: new Date().toISOString()
        });
        return { success: true, data: DEFAULT_CUTBACK_PER_STUDENT };
      }
      const data = snap.data() || {};
      const parsed = parseFloat(data.ratePerStudent);
      return {
        success: true,
        data: Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_CUTBACK_PER_STUDENT
      };
    } catch (error) {
      console.error('Error getting cutback rate:', error);
      return { success: false, error: error.message };
    }
  };

  export const saveCutbackRate = async (ratePerStudent) => {
    try {
      const parsed = parseFloat(ratePerStudent);
      const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_CUTBACK_PER_STUDENT;
      await setDoc(CUTBACK_SETTINGS_DOC, {
        ratePerStudent: safe,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return { success: true, data: safe };
    } catch (error) {
      console.error('Error saving cutback rate:', error);
      return { success: false, error: error.message };
    }
  };

  // Returns every payable across all users where category === 'module'.
  // Used by reports that span the entire department, not just one user.
  export const getAllModulePayables = async () => {
    try {
      const snap = await getDocs(collection(db, 'payables'));
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.category === 'module' && !p.deleted);
      return { success: true, data };
    } catch (error) {
      console.error('Error getting module payables:', error);
      return { success: false, error: error.message };
    }
  };

  export const setCourseOfferedStatus = async (courseId, isOffered) => {
    try {
      await updateDoc(doc(db, 'courses', courseId), {
        isOffered: !!isOffered,
        updatedAt: new Date().toISOString()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating offered status:', error);
      return { success: false, error: error.message };
    }
  };
