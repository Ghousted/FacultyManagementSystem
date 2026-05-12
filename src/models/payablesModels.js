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
  import { logSystemAction } from '../utils/auditLogger';
  
  // Payables Model Functions
  export const createPayable = async (payableData, userId) => {
    try {
      const docRef = await addDoc(collection(db, 'payables'), {
        ...payableData,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      const payableName = payableData.title || payableData.name || payableData.type || payableData.moduleCode || 'Payable';
      await logSystemAction({
        action: 'Created payable',
        module: 'Payables System',
        entityType: 'payable',
        entityId: docRef.id,
        description: `created payable ${payableName}`,
        details: payableData
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
      // For payable role, show all payables (remove userId filter)
      // This allows payable role to see same data as admin in CCS and other departments
      const q = query(payablesRef, orderBy('createdAt', 'desc'));
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
      const studentPaymentKeys = Object.keys(updates || {}).filter((key) => key.startsWith('studentPayments.'));
      const isPaymentUpdate = studentPaymentKeys.length > 0;
      const statusKey = studentPaymentKeys.find((key) => key.endsWith('.status'));
      const status = statusKey ? updates[statusKey] : '';

      if (!isPaymentUpdate) {
        await logSystemAction({
          action: 'Updated payable',
          module: 'Payables System',
          entityType: 'payable',
          entityId: payableId,
          description: `Updated payable ${payableId}`,
          details: { ...updates, status }
        });
      }
      return { success: true };
    } catch (error) {
      console.error('Error updating payable:', error);
      return { success: false, error: error.message };
    }
  };
  
  export const deletePayable = async (payableId) => {
    try {
      const payableSnap = await getDoc(doc(db, 'payables', payableId));
      const payable = payableSnap.exists() ? payableSnap.data() : {};
      const payableName = payable.title || payable.name || payable.type || payable.moduleCode || payableId;
      await deleteDoc(doc(db, 'payables', payableId));
      await logSystemAction({
        action: 'Deleted payable',
        module: 'Payables System',
        entityType: 'payable',
        entityId: payableId,
        description: `deleted payable ${payableName} and related payment records`,
        details: { payableName }
      });
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
      const isFullPayment = Number(studentPaymentData.balanceAfter) === 0;
      const studentName = studentPaymentData.studentName || studentPaymentData.name || studentPaymentData.studentId || 'student';
      const payableType = studentPaymentData.payableType || studentPaymentData.type || studentPaymentData.description || 'payable';
      await logSystemAction({
        action: isFullPayment ? 'full payment recorded' : 'paid payable',
        module: 'Payables System',
        entityType: 'studentPayment',
        entityId: docRef.id,
        description: isFullPayment
          ? `full payment recorded for ${studentName}`
          : `paid payable ${payableType} for ${studentName}`,
        details: { ...studentPaymentData, studentName, payableType }
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
      await logSystemAction({
        action: 'Updated student payment',
        module: 'Payables System',
        entityType: 'studentPayment',
        entityId: paymentId,
        description: `Updated student payment ${paymentId}`,
        details: updates
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
  export const getOfferedModules = async (activeTerm = null) => {
    try {
      let q = query(collection(db, 'courses'), where('isOffered', '==', true));
      
      // If activeTerm is provided, filter by semester and schoolYear
      if (activeTerm && activeTerm.semester) {
        q = query(
          collection(db, 'courses'), 
          where('isOffered', '==', true),
          where('semester', '==', activeTerm.semester)
        );
      }
      
      const snap = await getDocs(q);
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Additional filtering for schoolYear if provided
      if (activeTerm && activeTerm.schoolYear) {
        data = data.filter(course => 
          (course.schoolYear || '') === activeTerm.schoolYear
        );
      }
      
      data = data.sort((a, b) =>
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
      await logSystemAction({
        action: 'Updated cutback rate',
        module: 'Payables System',
        entityType: 'setting',
        entityId: 'professor_cutback',
        description: `Set professor cutback rate to ${safe}`,
        details: { ratePerStudent: safe }
      });
      return { success: true, data: safe };
    } catch (error) {
      console.error('Error saving cutback rate:', error);
      return { success: false, error: error.message };
    }
  };

  // Returns every payable across all users where category === 'module'.
  // Used by reports that span the entire department, not just one user.
  export const getAllModulePayables = async (activeTerm = null) => {
    try {
      const snap = await getDocs(collection(db, 'payables'));
      let data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.category === 'module' && !p.deleted);
      
      // Filter by term if provided
      if (activeTerm && activeTerm.semester) {
        data = data.filter(p => {
          const matchesSemester = Number(p.semester) === Number(activeTerm.semester);
          const matchesSchoolYear = !activeTerm.schoolYear || (p.schoolYear || '') === activeTerm.schoolYear;
          return matchesSemester && matchesSchoolYear;
        });
      }
      
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
      await logSystemAction({
        action: 'Updated offered course',
        module: 'Payables System',
        entityType: 'course',
        entityId: courseId,
        description: `${isOffered ? 'Marked' : 'Unmarked'} course as offered`,
        details: { isOffered: !!isOffered }
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating offered status:', error);
      return { success: false, error: error.message };
    }
  };

  // Clear all offered modules when term changes
  export const clearAllOfferedModules = async () => {
    try {
      const q = query(collection(db, 'courses'), where('isOffered', '==', true));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        return { success: true, message: 'No offered modules to clear' };
      }

      // Batch update to clear all offered status
      const batch = writeBatch(db);
      snap.docs.forEach(docSnapshot => {
        batch.update(docSnapshot.ref, {
          isOffered: false,
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();
      
      await logSystemAction({
        action: 'Cleared all offered modules',
        module: 'Payables System',
        entityType: 'course',
        entityId: 'bulk_clear',
        description: `Cleared ${snap.size} offered modules due to term change`,
        details: { clearedCount: snap.size }
      });

      return { success: true, message: `Cleared ${snap.size} offered modules` };
    } catch (error) {
      console.error('Error clearing offered modules:', error);
      return { success: false, error: error.message };
    }
  };

  // Archived Payables Functions
  export const archiveStudentPayables = async (studentId, studentData, batchName) => {
    try {
      // Get all active payables for the student
      const payablesResult = await getPayablesByStudent(studentId);
      if (!payablesResult.success) {
        return { success: false, error: payablesResult.error };
      }

      const studentPayables = payablesResult.data;
      if (studentPayables.length === 0) {
        return { success: true, message: 'No payables to archive' };
      }

      // Archive payables
      const archiveRef = doc(db, 'archivedPayables', batchName);
      const archiveDoc = await getDoc(archiveRef);
      
      let archivedData = {};
      if (archiveDoc.exists()) {
        archivedData = archiveDoc.data();
      }

      // Initialize student's archived payables if not exists
      if (!archivedData.students) {
        archivedData.students = {};
      }

      archivedData.students[studentId] = {
        studentInfo: {
          name: studentData.name,
          studentNumber: studentData.studentNumber,
          yearLevel: studentData.yearLevel,
          block: studentData.block,
          isIrregular: studentData.isIrregular,
          department: studentData.department || 'CCS'
        },
        payables: studentPayables,
        archivedAt: new Date().toISOString(),
        batchName
      };

      // Save archived payables
      await setDoc(archiveRef, archivedData, { merge: true });

      // Log the action
      await logSystemAction({
        action: 'Archived student payables',
        module: 'Payables System',
        entityType: 'archivedPayables',
        entityId: studentId,
        description: `Archived ${studentPayables.length} payables for student ${studentData.name}`,
        details: { studentId, studentName: studentData.name, payableCount: studentPayables.length, batchName }
      });

      return { success: true, message: `Archived ${studentPayables.length} payables` };
    } catch (error) {
      console.error('Error archiving student payables:', error);
      return { success: false, error: error.message };
    }
  };

  export const getArchivedPayables = async (batchName = null) => {
    try {
      if (batchName) {
        // Get specific batch
        const archiveRef = doc(db, 'archivedPayables', batchName);
        const archiveDoc = await getDoc(archiveRef);
        if (!archiveDoc.exists()) {
          return { success: true, data: {} };
        }
        return { success: true, data: archiveDoc.data() };
      } else {
        // Get all archived payables
        const archivesRef = collection(db, 'archivedPayables');
        const querySnapshot = await getDocs(archivesRef);
        const allArchives = {};
        
        querySnapshot.forEach(doc => {
          allArchives[doc.id] = doc.data();
        });
        
        return { success: true, data: allArchives };
      }
    } catch (error) {
      console.error('Error getting archived payables:', error);
      return { success: false, error: error.message };
    }
  };

  export const getArchivedPayablesByStudent = async (studentId) => {
    try {
      const allArchivesResult = await getArchivedPayables();
      if (!allArchivesResult.success) {
        return { success: false, error: allArchivesResult.error };
      }

      const allArchives = allArchivesResult.data;
      const studentArchivedPayables = [];

      // Search through all batches for the student
      Object.entries(allArchives).forEach(([batchName, batchData]) => {
        if (batchData.students && batchData.students[studentId]) {
          studentArchivedPayables.push({
            batchName,
            ...batchData.students[studentId]
          });
        }
      });

      return { success: true, data: studentArchivedPayables };
    } catch (error) {
      console.error('Error getting archived payables by student:', error);
      return { success: false, error: error.message };
    }
  };

  export const createArchivedStudentPayment = async (paymentData) => {
    try {
      const docRef = await addDoc(collection(db, 'archivedStudentPayments'), {
        ...paymentData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const isFullPayment = Number(paymentData.balanceAfter) === 0;
      const studentName = paymentData.studentName || paymentData.name || 'student';
      const payableType = paymentData.payableType || paymentData.type || 'archived payable';

      await logSystemAction({
        action: isFullPayment ? 'full payment recorded for archived payable' : 'paid archived payable',
        module: 'Payables System',
        entityType: 'archivedStudentPayment',
        entityId: docRef.id,
        description: isFullPayment
          ? `full payment recorded for archived payable - ${studentName}`
          : `paid archived payable ${payableType} for ${studentName}`,
        details: { ...paymentData, studentName, payableType }
      });

      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creating archived student payment:', error);
      return { success: false, error: error.message };
    }
  };

  export const getArchivedStudentPayments = async (studentId, payableId) => {
    try {
      const archivedPaymentsRef = collection(db, 'archivedStudentPayments');
      const q = query(
        archivedPaymentsRef,
        where('studentId', '==', studentId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const archivedPayments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter(payment => payment.payableId === payableId);
      
      return { success: true, data: archivedPayments };
    } catch (error) {
      console.error('Error getting archived student payments:', error);
      return { success: false, error: error.message };
    }
  };

  export const getAllArchivedStudentPayments = async (studentId) => {
    try {
      const archivedPaymentsRef = collection(db, 'archivedStudentPayments');
      const q = query(
        archivedPaymentsRef,
        where('studentId', '==', studentId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const archivedPayments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return { success: true, data: archivedPayments };
    } catch (error) {
      console.error('Error getting all archived student payments:', error);
      return { success: false, error: error.message };
    }
  };

  // Helper function to get payables by student (needed for archiving)
  export const getPayablesByStudent = async (studentId) => {
    try {
      const payablesRef = collection(db, 'payables');
      const q = query(payablesRef, where('studentId', '==', studentId), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const payables = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter(payable => !payable.deleted);
      
      return { success: true, data: payables };
    } catch (error) {
      console.error('Error getting payables by student:', error);
      return { success: false, error: error.message };
    }
  };
