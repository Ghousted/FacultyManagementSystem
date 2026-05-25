import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    setDoc,
    doc,
    updateDoc,
    deleteDoc,
  writeBatch,
    query,
    where,
    orderBy
  } from 'firebase/firestore';
  import { db } from '../firebase';
  import { logSystemAction } from '../utils/auditLogger';

const normalizeModuleCode = (code) => {
  if (!code) return '';
  return code.toString().trim().toUpperCase().replace(/\s+/g, '');
};

const addPayableToMapList = (map, key, payable) => {
  if (!map || !key) return;
  const normalizedKey = normalizeModuleCode(key);
  if (!normalizedKey) return;
  const existing = map.get(normalizedKey) || [];
  existing.push(payable);
  map.set(normalizedKey, existing);
};

const mergeModuleStudentPayments = (payable, collectionPayments = {}) => {
  const payablePayments = payable && typeof payable.studentPayments === 'object' && payable.studentPayments !== null
    ? { ...payable.studentPayments }
    : {};

  const merged = { ...payablePayments };
  Object.entries(collectionPayments || {}).forEach(([studentId, entry]) => {
    const existing = merged[studentId] || {};
    const collectionPaid = Number(entry?.totalPaidAfter ?? entry?.paidAmount ?? entry?.amount ?? 0);
    const existingPaid = Number(existing?.paidAmount || 0);
    merged[studentId] = {
      ...existing,
      ...entry,
      paidAmount: Math.max(existingPaid, collectionPaid),
      voucherAmount: Math.max(Number(existing?.voucherAmount || 0), Number(entry?.voucherAmount || 0)),
      lastPaymentDate: entry?.lastPaymentDate || existing?.lastPaymentDate || null,
      status: entry?.status || existing?.status || 'unpaid'
    };
  });

  return merged;
};

const isModuleStudentFullyPaid = (payable, studentPaymentEntry) => {
  if (!studentPaymentEntry) return false;
  const amount = Number(payable?.amount) || 0;
  const paid = Number(studentPaymentEntry?.paidAmount) || 0;
  const voucher = Number(studentPaymentEntry?.voucherAmount) || 0;
  if (amount > 0) return (paid + voucher) >= amount;
  return studentPaymentEntry.status === 'fully_paid';
};
  
  // Payables Model Functions
  export const createPayable = async (payableData, userId) => {
    try {
      const createdTerm = payableData?.createdTerm || null;
      const docRef = await addDoc(collection(db, 'payables'), {
        ...payableData,
        ...(createdTerm ? { createdTerm } : {}),
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      const payableName = payableData.title || payableData.name || payableData.type || payableData.moduleCode || 'Payable';
      await logSystemAction({
        action: 'Created Payable Record',
        module: 'Payables System',
        entityType: 'payable',
        entityId: docRef.id,
        description: `Created new payable record: ${payableName}`,
        details: payableData
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creating payable:', error);
      return { success: false, error: error.message };
    }
  };

  // Fetch studentPayments for a specific payable and return a map keyed by studentId
  // Normalizes older records that used `amount` into `paidAmount` to keep callers stable.
  export const getPaymentsByPayableId = async (payableId) => {
    try {
      if (!payableId) return { success: true, data: {} };
      const studentPaymentsRef = collection(db, 'studentPayments');
      // Avoid server-side ordering to prevent composite index requirement; we'll sort locally
      const q = query(studentPaymentsRef, where('payableId', '==', payableId));
      const snap = await getDocs(q);
      // Sort docs by createdAt/updatedAt descending so latest payments win
      const docs = snap.docs.slice().sort((a, b) => {
        const da = (a.data()?.createdAt || a.data()?.updatedAt || '').toString();
        const dbt = (b.data()?.createdAt || b.data()?.updatedAt || '').toString();
        return new Date(dbt).getTime() - new Date(da).getTime();
      });
      const map = {};
      docs.forEach(d => {
        const p = d.data() || {};
        const sid = p.studentId || p.studentID || p.student || '';
        if (!sid) return;
        const paidAmount = Number(p.totalPaidAfter ?? p.paidAmount ?? p.amount ?? 0);
        const voucherAmount = Number(p.voucherAmount ?? 0);
        const lastPaymentDate = p.lastPaymentDate || p.paymentDate || p.date || p.createdAt || p.updatedAt || null;
        const totalPrice = Number(p.totalPrice ?? p.payableAmount ?? 0);
        const status = p.status || (
          totalPrice > 0
            ? (paidAmount + voucherAmount >= totalPrice ? 'fully_paid' : (paidAmount > 0 ? 'partially_paid' : 'unpaid'))
            : (Number(p.balanceAfter) === 0 ? 'fully_paid' : (paidAmount > 0 ? 'partially_paid' : 'unpaid'))
        );
        if (!map[sid]) {
          map[sid] = {
            ...p,
            id: d.id,
            studentId: sid,
            studentNumber: p.studentNumber || p.studentNo || p.studentId || '',
            paidAmount,
            voucherAmount,
            status,
            lastPaymentDate
          };
        }
      });
      return { success: true, data: map };
    } catch (error) {
      console.error('Error getting payments by payableId:', error);
      return { success: false, error: error.message };
    }
  };
  
  export const getPayables = async (userId, activeTerm = null) => {
    try {
      const payablesRef = collection(db, 'payables');
      // For payable role, show all payables (remove userId filter)
      // This allows payable role to see same data as admin in CCS and other departments
      const q = query(payablesRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      let payables = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (activeTerm?.semester) {
        payables = payables.filter((payable) => {
          const matchesSemester = !payable.semester || Number(payable.semester) === Number(activeTerm.semester);
          const matchesSchoolYear =
            !activeTerm.schoolYear ||
            !payable.schoolYear ||
            String(payable.schoolYear || '') === String(activeTerm.schoolYear || '');
          const createdTerm = payable.createdTerm || null;
          const matchesCreatedTerm = !createdTerm || (
            (!createdTerm.semester || Number(createdTerm.semester) === Number(activeTerm.semester)) &&
            (!activeTerm.schoolYear || !createdTerm.schoolYear || String(createdTerm.schoolYear || '') === String(activeTerm.schoolYear || ''))
          );
          return matchesSemester && matchesSchoolYear && matchesCreatedTerm;
        });
      }

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
          action: 'Updated Payable Record',
          module: 'Payables System',
          entityType: 'payable',
          entityId: payableId,
          description: `Updated payable record ${payableId}`,
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
        action: 'Deleted Payable Record',
        module: 'Payables System',
        entityType: 'payable',
        entityId: payableId,
        description: `Deleted payable record: ${payableName} and all related payment records`,
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
        action: isFullPayment ? 'Recorded Full Payment' : 'Recorded Partial Payment',
        module: 'Payables System',
        entityType: 'studentPayment',
        entityId: docRef.id,
        description: isFullPayment
          ? `Recorded full payment for student ${studentName} for ${payableType}`
          : `Recorded partial payment for student ${studentName} for ${payableType}`,
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
        action: 'Updated Student Payment Record',
        module: 'Payables System',
        entityType: 'studentPayment',
        entityId: paymentId,
        description: `Updated student payment record ${paymentId}`,
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
      
      // Older course records do not store schoolYear; keep those eligible and
      // rely on the offered flag plus semester as the authoritative module list.
      if (activeTerm && activeTerm.schoolYear) {
        data = data.filter(course => 
          !course.schoolYear || (course.schoolYear || '') === activeTerm.schoolYear
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
        action: 'Updated Professor Cutback Rate',
        module: 'Payables System',
        entityType: 'setting',
        entityId: 'professor_cutback',
        description: `Updated professor cutback rate to ${safe} per student`,
        details: { ratePerStudent: safe }
      });
      return { success: true, data: safe };
    } catch (error) {
      console.error('Error saving cutback rate:', error);
      return { success: false, error: error.message };
    }
  };

  // Assign existing payables to a newly created CCS student when the payable was
  // created for the same term the student is enrolled in.
  export const assignPayablesToStudent = async (student) => {
    try {
      if (!student || !student.id) return { success: false, error: 'Invalid student' };
      const term = student.enrolledTerm || student.createdTerm || null;
      if (!term || !term.semester || !term.schoolYear) {
        return { success: true, assigned: 0 };
      }

      const payablesRef = collection(db, 'payables');
      const snap = await getDocs(payablesRef);
      let assigned = 0;
      const updates = [];

      snap.docs.forEach((d) => {
        const p = { id: d.id, ...d.data() };
        if (p.isIndividual) return; // skip individual payables
        const created = p.createdTerm || null;
        if (!created || Number(created.semester) !== Number(term.semester) || (created.schoolYear || '') !== (term.schoolYear || '')) return;

        // Year match
        if (p.yearLevel !== 'all' && p.yearLevel !== 'irregular' && Number(p.yearLevel) !== Number(student.yearLevel)) return;
        if (p.yearLevel === 'irregular' && !student.isIrregular) return;

        // Block match
        if (p.block && p.block !== 'all') {
          const studBlock = (student.block || '').toString().trim().toUpperCase() || 'A';
          if (studBlock !== (p.block || '').toString().trim().toUpperCase()) return;
        }

        // If student already present, skip
        const existingPayments = p.studentPayments || {};
        if (existingPayments && existingPayments[student.id]) return;

        updates.push({ payableId: p.id });
      });

      // Apply updates
      for (const u of updates) {
        await updateDoc(doc(db, 'payables', u.payableId), {
          [`studentPayments.${student.id}`]: { status: 'unpaid', paidAmount: 0 },
          updatedAt: new Date().toISOString()
        });
        assigned += 1;
      }

      if (assigned > 0) {
        await logSystemAction({
          action: 'Assigned Payables To New Student',
          module: 'Payables System',
          entityType: 'student',
          entityId: student.id,
          description: `Assigned ${assigned} payable(s) to new student ${student.id}`,
          details: { studentId: student.id, assigned }
        });
      }

      return { success: true, assigned };
    } catch (error) {
      console.error('Error assigning payables to student:', error);
      return { success: false, error: error.message };
    }
  };

  // Assign existing other-department payables to a newly created other-department student
  export const assignOtherDeptPayablesToStudent = async (student) => {
    try {
      if (!student || !student.id || !student.departmentId) return { success: false, error: 'Invalid student' };
      const term = student.createdTerm || null;
      if (!term || !term.semester || !term.schoolYear) return { success: true, assigned: 0 };

      const payablesRef = collection(db, 'otherDept-payables');
      const snap = await getDocs(payablesRef);
      let assigned = 0;
      const updates = [];

      snap.docs.forEach((d) => {
        const p = { id: d.id, ...d.data() };
        if (p.isIndividual) return;
        if ((p.departmentId || '') !== (student.departmentId || '')) return;
        const created = p.createdTerm || null;
        if (!created || Number(created.semester) !== Number(term.semester) || (created.schoolYear || '') !== (term.schoolYear || '')) return;

        // Year / block matching similar rules
        if (p.yearLevel !== 'all' && p.yearLevel !== 'irregular' && Number(p.yearLevel) !== Number(student.yearLevel)) return;
        if (p.yearLevel === 'irregular' && !student.isIrregular) return;
        if (p.block && p.block !== 'all') {
          const studBlock = (student.block || '').toString().trim().toUpperCase() || 'A';
          if (studBlock !== (p.block || '').toString().trim().toUpperCase()) return;
        }

        const existingPayments = p.studentPayments || {};
        if (existingPayments && existingPayments[student.id]) return;

        updates.push({ payableId: p.id });
      });

      for (const u of updates) {
        await updateDoc(doc(db, 'otherDept-payables', u.payableId), {
          [`studentPayments.${student.id}`]: { status: 'unpaid', paidAmount: 0 },
          updatedAt: new Date().toISOString()
        });
        assigned += 1;
      }

      if (assigned > 0) {
        await logSystemAction({
          action: 'Assigned Other-Dept Payables To New Student',
          module: 'Payables System',
          entityType: 'otherDepartmentStudent',
          entityId: student.id,
          description: `Assigned ${assigned} other-dept payable(s) to new student ${student.id}`,
          details: { studentId: student.id, assigned }
        });
      }

      return { success: true, assigned };
    } catch (error) {
      console.error('Error assigning other-dept payables to student:', error);
      return { success: false, error: error.message };
    }
  };

   // Configurable deadline for module payments to count toward the professor cutback.
  // Stored as an ISO date string ('YYYY-MM-DD') in the same settings doc. Empty string
  // means no deadline (every fully-paid student counts).
  export const getCutbackDeadline = async () => {
    try {
      const snap = await getDoc(CUTBACK_SETTINGS_DOC);
      if (!snap.exists()) return { success: true, data: '' };
      const data = snap.data() || {};
      const deadline = typeof data.deadline === 'string' ? data.deadline : '';
      return { success: true, data: deadline };
    } catch (error) {
      console.error('Error getting cutback deadline:', error);
      return { success: false, error: error.message };
    }
  };

  export const saveCutbackDeadline = async (deadline) => {
    try {
      const safe = typeof deadline === 'string' ? deadline.trim() : '';
      await setDoc(CUTBACK_SETTINGS_DOC, {
        deadline: safe,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      await logSystemAction({
        action: 'Updated Professor Cutback Deadline',
        module: 'Payables System',
        entityType: 'setting',
        entityId: 'professor_cutback',
        description: safe ? `Updated professor cutback deadline to ${safe}` : 'Cleared professor cutback deadline (no deadline restriction)',
        details: { deadline: safe }
      });
      return { success: true, data: safe };
    } catch (error) {
      console.error('Error saving cutback deadline:', error);
      return { success: false, error: error.message };
    }
  };

  // Department share settings for CCS modules (adjustable amount per paid student/module as a simple default)
  const DEPT_SHARE_SETTINGS_DOC = doc(db, 'settings', 'department_share_ccs');
  const DEFAULT_DEPT_SHARE_AMOUNT = 0;

  export const getDepartmentShareAmount = async () => {
    try {
      const snap = await getDoc(DEPT_SHARE_SETTINGS_DOC);
      if (!snap.exists()) {
        await setDoc(DEPT_SHARE_SETTINGS_DOC, {
          amountPerPaidStudent: DEFAULT_DEPT_SHARE_AMOUNT,
          updatedAt: new Date().toISOString()
        });
        return { success: true, data: DEFAULT_DEPT_SHARE_AMOUNT };
      }
      const data = snap.data() || {};
      const parsed = parseFloat(data.amountPerPaidStudent);
      return {
        success: true,
        data: Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DEPT_SHARE_AMOUNT
      };
    } catch (error) {
      console.error('Error getting department share amount:', error);
      return { success: false, error: error.message };
    }
  };

  export const saveDepartmentShareAmount = async (amount) => {
    try {
      const parsed = parseFloat(amount);
      const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DEPT_SHARE_AMOUNT;
      await setDoc(DEPT_SHARE_SETTINGS_DOC, {
        amountPerPaidStudent: safe,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      await logSystemAction({
        action: 'Updated Department Share Amount',
        module: 'Payables System',
        entityType: 'setting',
        entityId: 'department_share_ccs',
        description: `Updated CCS department share amount to ${safe} per paid student`,
        details: { amountPerPaidStudent: safe }
      });
      return { success: true, data: safe };
    } catch (error) {
      console.error('Error saving department share amount:', error);
      return { success: false, error: error.message };
    }
  };

   // Compute department share totals for CCS-offered modules for a term.
  // Uses offered modules as the authoritative list of CCS modules (modules with curriculumId are CCS).
  // Count fully-paid students per module (paidAmount + voucherAmount >= payable.amount) and multiply by amountPerPaidStudent.
  export const computeDepartmentShareReport = async (activeTerm = null) => {
    try {
      const [modulesRes, payablesRes, shareRes] = await Promise.all([
        getOfferedModules(activeTerm),
        getAllModulePayables(activeTerm),
        getDepartmentShareAmount()
      ]);
      if (!modulesRes.success) throw new Error(modulesRes.error || 'Failed to load offered modules.');
      if (!payablesRes.success) throw new Error(payablesRes.error || 'Failed to load module payables.');
      if (!shareRes.success) throw new Error(shareRes.error || 'Failed to load department share settings.');

      const offered = modulesRes.data || [];
      const payables = payablesRes.data || [];
      const amountPer = Number(shareRes.data) || 0;

      // Build map of module id or code -> payables. A module can have multiple
      // payable records over time or by section, so count across all matches.
      const payableByModuleId = new Map();
      const payableByCode = new Map();
      payables.forEach(p => {
        addPayableToMapList(payableByModuleId, p.moduleId, p);
        addPayableToMapList(payableByCode, normalizeModuleCode(p.moduleCode), p);
      });

      const breakdown = [];
      let totalPaidCount = 0;
      let totalClaimableCount = 0;

      for (const mod of offered) {
        // Treat modules with a curriculumId as CCS modules
        if (!mod.curriculumId) continue;

        const matchingPayables = payableByModuleId.get(mod.id) || payableByCode.get(normalizeModuleCode(mod.courseCode)) || [];
        const yearLevel = Number(mod.yearLevel) || null;
        const blocks = Array.isArray(mod.blocks)
          ? mod.blocks.map((b) => String(b).trim().toUpperCase()).filter(Boolean)
          : [];

        if (matchingPayables.length === 0) {
          breakdown.push({
            moduleId: mod.id,
            courseCode: mod.courseCode,
            courseTitle: mod.courseTitle,
            yearLevel,
            blocks,
            claimableCount: 0,
            paidCount: 0,
            claimableShare: 0,
            shareAmount: 0
          });
          continue;
        }

        const claimableStudentIds = new Set();
        const paidStudentIds = new Set();

        await Promise.all(matchingPayables.map(async (payable) => {
          const paymentsRes = await getPaymentsByPayableId(payable.id);
          const collectionPayments = paymentsRes && paymentsRes.success ? paymentsRes.data : {};
          const payablePayments = payable.studentPayments || {};
          const studentPayments = mergeModuleStudentPayments(payable, collectionPayments);
          const assignedIds = Object.keys(payablePayments);
          const claimableIds = assignedIds.length ? assignedIds : Object.keys(studentPayments);

          claimableIds.forEach((studentId) => claimableStudentIds.add(studentId));
          Object.entries(studentPayments).forEach(([studentId, entry]) => {
            if (isModuleStudentFullyPaid(payable, entry)) paidStudentIds.add(studentId);
          });
        }));

        const claimableCount = claimableStudentIds.size;
        const paidCount = paidStudentIds.size;

        totalPaidCount += paidCount;
        totalClaimableCount += claimableCount;
        breakdown.push({
          moduleId: mod.id,
          courseCode: mod.courseCode,
          courseTitle: mod.courseTitle,
          yearLevel,
          blocks,
          claimableCount,
          paidCount,
          claimableShare: claimableCount * amountPer,
          shareAmount: paidCount * amountPer
        });
      }

      breakdown.sort((a, b) => {
        const yearA = Number(a.yearLevel) || 99;
        const yearB = Number(b.yearLevel) || 99;
        if (yearA !== yearB) return yearA - yearB;
        return (a.courseCode || '').localeCompare(b.courseCode || '');
      });

      return {
        success: true,
        data: {
          amountPerPaidStudent: amountPer,
          totalPaidCount,
          totalClaimableCount,
          totalShare: totalPaidCount * amountPer,
          totalClaimableShare: totalClaimableCount * amountPer,
          breakdown
        }
      };
    } catch (error) {
      console.error('Error computing department share report:', error);
      return { success: false, error: error.message };
    }
  };
  

  // Returns every payable across all users where category === 'module'.
  // Used by reports that span the entire department, not just one user.
  export const getAllModulePayables = async (activeTerm = null) => {
    try {
      const snap = await getDocs(collection(db, 'payables'));
      let data = snap.docs
        .map(d => ({ id: d.id, ...d.data(), source: 'ccs' }))
        .filter(p => p.category === 'module' && !p.deleted);
      
      // Filter by term if provided. Older module payables were created without
      // semester/schoolYear fields, so keep those and let callers match by the
      // offered module id/code.
      if (activeTerm && activeTerm.semester) {
        data = data.filter(p => {
          const matchesSemester = !p.semester || Number(p.semester) === Number(activeTerm.semester);
          const matchesSchoolYear = !activeTerm.schoolYear || !p.schoolYear || (p.schoolYear || '') === activeTerm.schoolYear;
          return matchesSemester && matchesSchoolYear;
        });
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Error getting module payables:', error);
      return { success: false, error: error.message };
    }
  };

  export const getAllModulePayablesIncludingOtherDept = async (activeTerm = null) => {
    try {
      const [ccsRes, otherSnap] = await Promise.all([
        getAllModulePayables(activeTerm),
        getDocs(collection(db, 'otherDept-payables'))
      ]);

      if (!ccsRes.success) return ccsRes;

      let otherData = otherSnap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data(), source: 'other-department' }))
        .filter((payable) => payable.category === 'module' && !payable.deleted);

      if (activeTerm?.semester) {
        otherData = otherData.filter((payable) => {
          const matchesSemester = !payable.semester || Number(payable.semester) === Number(activeTerm.semester);
          const matchesSchoolYear =
            !activeTerm.schoolYear ||
            !payable.schoolYear ||
            String(payable.schoolYear || '') === String(activeTerm.schoolYear || '');
          return matchesSemester && matchesSchoolYear;
        });
      }

      return {
        success: true,
        data: [...(ccsRes.data || []), ...otherData]
      };
    } catch (error) {
      console.error('Error getting combined module payables:', error);
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
        action: isOffered ? 'Marked Course As Offered' : 'Unmarked Course As Offered',
        module: 'Payables System',
        entityType: 'course',
        entityId: courseId,
        description: isOffered ? `Marked course ${courseId} as offered for payment collection` : `Unmarked course ${courseId} as offered for payment collection`,
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
        action: 'Cleared All Offered Modules',
        module: 'Payables System',
        entityType: 'course',
        entityId: 'bulk_clear',
        description: `Cleared offered status from ${snap.size} modules due to academic term change`,
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
        action: 'Archived Student Payables',
        module: 'Payables System',
        entityType: 'archivedPayables',
        entityId: studentId,
        description: `Archived ${studentPayables.length} payable records for student ${studentData.name} (Batch: ${batchName})`,
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
        action: isFullPayment ? 'Recorded Full Payment For Archived Payable' : 'Recorded Partial Payment For Archived Payable',
        module: 'Payables System',
        entityType: 'archivedStudentPayment',
        entityId: docRef.id,
        description: isFullPayment
          ? `Recorded full payment for archived payable for student ${studentName} (${payableType})`
          : `Recorded partial payment for archived payable for student ${studentName} (${payableType})`,
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
