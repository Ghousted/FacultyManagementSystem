import { 
    collection, 
    addDoc, 
    getDocs, 
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
  