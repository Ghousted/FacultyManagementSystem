import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { logSystemAction } from '../utils/auditLogger';

const ACTIVE_TERM_DOC = doc(db, 'settings', 'active_term');
const DEFAULT_ACTIVE_TERM = { semester: 1, schoolYear: '' };

// Enrollment status reasons.
//   'enrolled'       — included in rosters for the active term.
//   'not-enrolled'   — admin explicitly marked as not enrolled.
//   'needs-update'   — was enrolled for a different term; needs re-enrollment.
//   'unset'          — no enrollment record yet (legacy data); treated as enrolled.
export const getStudentEnrollmentStatus = (student, activeTerm) => {
  if (student?.enrolled === false) return 'not-enrolled';
  const term = student?.enrolledTerm;
  if (!term || (!term.schoolYear && !term.semester)) return 'unset';
  const matches =
    Number(term.semester) === Number(activeTerm?.semester) &&
    (term.schoolYear || '') === (activeTerm?.schoolYear || '');
  return matches ? 'enrolled' : 'needs-update';
};

const isStudentVisibleForActiveTerm = (student, activeTerm) => {
  const status = getStudentEnrollmentStatus(student, activeTerm);
  return status === 'enrolled' || status === 'unset';
};

export const getActiveTerm = async () => {
  try {
    const snap = await getDoc(ACTIVE_TERM_DOC);
    if (!snap.exists()) {
      await setDoc(ACTIVE_TERM_DOC, {
        ...DEFAULT_ACTIVE_TERM,
        updatedAt: new Date().toISOString()
      });
      return { success: true, data: { ...DEFAULT_ACTIVE_TERM } };
    }
    const data = snap.data() || {};
    return {
      success: true,
      data: {
        semester: Number(data.semester) || 1,
        schoolYear: data.schoolYear || ''
      }
    };
  } catch (error) {
    console.error('Error getting active term:', error);
    return { success: false, error: error.message };
  }
};

export const saveActiveTerm = async ({ semester, schoolYear }) => {
  try {
    const payload = {
      semester: Number(semester) || 1,
      schoolYear: schoolYear || '',
      updatedAt: new Date().toISOString()
    };
    await setDoc(ACTIVE_TERM_DOC, payload, { merge: true });
    await logSystemAction({
      action: 'Updated active term',
      module: 'Faculty Management',
      entityType: 'setting',
      entityId: 'active_term',
      description: `Set active term to semester ${payload.semester}, ${payload.schoolYear}`,
      details: payload
    });
    return { success: true, data: payload };
  } catch (error) {
    console.error('Error saving active term:', error);
    return { success: false, error: error.message };
  }
};

export const getProfessors = async () => {
  try {
    const q = query(collection(db, 'professors'), orderBy('name'));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { success: true, data };
  } catch (error) {
    console.error('Error getting professors:', error);
    return { success: false, error: error.message };
  }
};

export const addProfessor = async (professor) => {
  try {
    const ref = await addDoc(collection(db, 'professors'), {
      name: (professor.name || '').trim(),
      employeeId: (professor.employeeId || '').trim(),
      email: (professor.email || '').trim(),
      assignedCourses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await logSystemAction({
      action: 'Added professor',
      module: 'Faculty Management',
      entityType: 'professor',
      entityId: ref.id,
      description: `Added professor: ${professor.name || 'Unnamed professor'}`,
      details: professor
    });
    return { success: true, id: ref.id };
  } catch (error) {
    console.error('Error adding professor:', error);
    return { success: false, error: error.message };
  }
};

export const updateProfessor = async (id, updates) => {
  try {
    await updateDoc(doc(db, 'professors', id), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    await logSystemAction({
      action: 'Updated professor',
      module: 'Faculty Management',
      entityType: 'professor',
      entityId: id,
      description: `Updated professor ${id}`,
      details: updates
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating professor:', error);
    return { success: false, error: error.message };
  }
};

export const deleteProfessor = async (id) => {
  try {
    await deleteDoc(doc(db, 'professors', id));
    await logSystemAction({
      action: 'Deleted professor',
      module: 'Faculty Management',
      entityType: 'professor',
      entityId: id,
      description: `Deleted professor ${id}`
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting professor:', error);
    return { success: false, error: error.message };
  }
};

const normalizeBlocks = (blocks) =>
  Array.from(new Set((blocks || [])
    .map(b => (b || '').toString().trim().toUpperCase())
    .filter(Boolean)))
    .sort();

export const assignCourseToProfessor = async (professorId, course) => {
  try {
    const ref = doc(db, 'professors', professorId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Professor not found' };

    const blocks = normalizeBlocks(course.blocks);
    if (blocks.length === 0) {
      return { success: false, error: 'Select at least one block.' };
    }

    const existing = snap.data().assignedCourses || [];
    const alreadyAssigned = existing.some(c => c.courseId === course.courseId);
    if (alreadyAssigned) {
      return { success: false, error: 'Subject already assigned to this professor' };
    }

    const isOtherDept = course.source === 'other-department';
    const entry = {
      source: isOtherDept ? 'other-department' : 'ccs',
      courseId: course.courseId,
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
      yearLevel: Number(course.yearLevel) || 0,
      units: Number(course.units) || 0,
      blocks
    };

    if (isOtherDept) {
      entry.departmentId = course.departmentId || '';
      entry.departmentName = course.departmentName || '';
      entry.classCourse = (course.classCourse || '').toString().trim();
      entry.subjectId = course.subjectId || '';
      entry.curriculumId = course.curriculumId || '';
      entry.curriculumName = course.curriculumName || '';
    } else {
      entry.curriculumId = course.curriculumId;
      entry.curriculumName = course.curriculumName || '';
      entry.semester = Number(course.semester) || 0;
    }

    const next = [...existing, entry];

    await updateDoc(ref, {
      assignedCourses: next,
      updatedAt: new Date().toISOString()
    });
    await logSystemAction({
      action: 'Assigned course to professor',
      module: 'Faculty Management',
      entityType: 'professor',
      entityId: professorId,
      description: `Assigned ${entry.courseCode || 'course'} to professor ${professorId}`,
      details: entry
    });
    return { success: true };
  } catch (error) {
    console.error('Error assigning course:', error);
    return { success: false, error: error.message };
  }
};

export const updateAssignedCourseBlocks = async (professorId, courseId, blocks) => {
  try {
    const ref = doc(db, 'professors', professorId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Professor not found' };

    const normalized = normalizeBlocks(blocks);
    if (normalized.length === 0) {
      return { success: false, error: 'Select at least one block.' };
    }

    const next = (snap.data().assignedCourses || []).map(c =>
      c.courseId === courseId ? { ...c, blocks: normalized } : c
    );

    await updateDoc(ref, {
      assignedCourses: next,
      updatedAt: new Date().toISOString()
    });
    await logSystemAction({
      action: 'Updated assigned course blocks',
      module: 'Faculty Management',
      entityType: 'professor',
      entityId: professorId,
      description: `Updated blocks for assigned course ${courseId}`,
      details: { courseId, blocks: normalized }
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating assignment blocks:', error);
    return { success: false, error: error.message };
  }
};

export const unassignCourseFromProfessor = async (professorId, courseId) => {
  try {
    const ref = doc(db, 'professors', professorId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Professor not found' };

    const next = (snap.data().assignedCourses || []).filter(c => c.courseId !== courseId);
    await updateDoc(ref, {
      assignedCourses: next,
      updatedAt: new Date().toISOString()
    });
    await logSystemAction({
      action: 'Unassigned course from professor',
      module: 'Faculty Management',
      entityType: 'professor',
      entityId: professorId,
      description: `Unassigned course ${courseId} from professor ${professorId}`,
      details: { courseId }
    });
    return { success: true };
  } catch (error) {
    console.error('Error unassigning course:', error);
    return { success: false, error: error.message };
  }
};

// Returns students who are taking the given course in the active semester,
// restricted to the assigned blocks (if provided), and only those currently
// enrolled for the active term.
//  - Regulars: same curriculumId, yearLevel matches the course, AND course.semester === activeSemester,
//    AND the student has not completed it yet.
//  - Irregulars: irregularSubjects.sem{activeSemester} contains the course code.
//  - Both: student's block must be in the assigned blocks list (when blocks are specified),
//    and the student must be enrolled for the active term (or have no enrollment record yet).
export const getStudentsForCourse = async (course, activeTerm) => {
  try {
    const term = typeof activeTerm === 'object' && activeTerm !== null
      ? activeTerm
      : { semester: activeTerm, schoolYear: '' };
    const sem = Number(term.semester) || 1;
    const semKey = `sem${sem}`;
    const targetCode = (course.courseCode || '').toString().trim().toUpperCase();
    const allowedBlocks = normalizeBlocks(course.blocks);

    if (course.source === 'other-department') {
      const q = query(
        collection(db, 'otherDept-Students'),
        where('departmentId', '==', course.departmentId || '')
      );
      const snap = await getDocs(q);
      const classCourse = (course.classCourse || '').toString().trim().toLowerCase();
      const matched = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(student => {
          if ((student.course || '').toString().trim().toLowerCase() !== classCourse) return false;
          if (Number(student.yearLevel) !== Number(course.yearLevel)) return false;
          if (allowedBlocks.length > 0) {
            const block = (student.block || '').toString().trim().toUpperCase() || 'A';
            if (!allowedBlocks.includes(block)) return false;
          }
          return true;
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      return { success: true, data: matched };
    }

    const snap = await getDocs(collection(db, 'students'));
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const matched = all.filter(student => {
      if (!isStudentVisibleForActiveTerm(student, term)) return false;

      const completed = (student.completedCourses || []).map(c => (c || '').toString().trim().toUpperCase());
      if (completed.includes(targetCode)) return false;

      if (allowedBlocks.length > 0) {
        const studentBlock = (student.block || '').toString().trim().toUpperCase() || 'A';
        if (!allowedBlocks.includes(studentBlock)) return false;
      }

      if (student.isIrregular) {
        const items = ((student.irregularSubjects || {})[semKey]) || [];
        return items.some(item =>
          (item.courseCode || '').toString().trim().toUpperCase() === targetCode
        );
      }

      // Regular student: their current semester load is dictated by the curriculum.
      if (student.curriculumId !== course.curriculumId) return false;
      if (Number(student.yearLevel) !== Number(course.yearLevel)) return false;
      if (Number(course.semester) !== sem) return false;
      return true;
    });

    matched.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return { success: true, data: matched };
  } catch (error) {
    console.error('Error fetching students for course:', error);
    return { success: false, error: error.message };
  }
};

const sanitizeTerm = (term) => ({
  semester: Number(term?.semester) || 0,
  schoolYear: (term?.schoolYear || '').toString().trim()
});

export const setStudentEnrollment = async (studentId, activeTerm) => {
  try {
    const term = sanitizeTerm(activeTerm);
    if (!term.semester || !term.schoolYear) {
      return { success: false, error: 'Active term is incomplete.' };
    }
    await updateDoc(doc(db, 'students', studentId), {
      enrolled: true,
      enrolledTerm: term,
      updatedAt: new Date().toISOString()
    });
    await logSystemAction({
      action: 'Enrolled student',
      module: 'Faculty Management',
      entityType: 'student',
      entityId: studentId,
      description: `Enrolled student ${studentId}`,
      details: { activeTerm: term }
    });
    return { success: true };
  } catch (error) {
    console.error('Error enrolling student:', error);
    return { success: false, error: error.message };
  }
};

export const setStudentNotEnrolled = async (studentId) => {
  try {
    await updateDoc(doc(db, 'students', studentId), {
      enrolled: false,
      updatedAt: new Date().toISOString()
    });
    await logSystemAction({
      action: 'Marked student not enrolled',
      module: 'Faculty Management',
      entityType: 'student',
      entityId: studentId,
      description: `Marked student ${studentId} as not enrolled`
    });
    return { success: true };
  } catch (error) {
    console.error('Error unenrolling student:', error);
    return { success: false, error: error.message };
  }
};

export const bulkSetStudentEnrollment = async (studentIds, activeTerm) => {
  try {
    const term = sanitizeTerm(activeTerm);
    if (!term.semester || !term.schoolYear) {
      return { success: false, error: 'Active term is incomplete.' };
    }
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return { success: true, count: 0 };
    }

    const chunkSize = 500;
    const stamp = new Date().toISOString();
    let committed = 0;

    for (let i = 0; i < studentIds.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = studentIds.slice(i, i + chunkSize);
      chunk.forEach(id => {
        batch.update(doc(db, 'students', id), {
          enrolled: true,
          enrolledTerm: term,
          updatedAt: stamp
        });
      });
      await batch.commit();
      committed += chunk.length;
    }

    await logSystemAction({
      action: 'Bulk enrolled students',
      module: 'Faculty Management',
      entityType: 'studentBatch',
      entityId: '',
      description: `Enrolled ${studentIds.length} students`,
      details: { studentIds, activeTerm: term, count: studentIds.length }
    });
    return { success: true, count: studentIds.length };
  } catch (error) {
    console.error('Error bulk enrolling students:', error);
    return { success: false, error: error.message };
  }
};

export const bulkSetStudentNotEnrolled = async (studentIds) => {
  try {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return { success: true, count: 0 };
    }

    const chunkSize = 500;
    const stamp = new Date().toISOString();
    let committed = 0;

    for (let i = 0; i < studentIds.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = studentIds.slice(i, i + chunkSize);
      chunk.forEach(id => {
        batch.update(doc(db, 'students', id), {
          enrolled: false,
          enrolledTerm: null,
          updatedAt: stamp
        });
      });
      await batch.commit();
      committed += chunk.length;
    }

    await logSystemAction({
      action: 'Bulk marked students not enrolled',
      module: 'Faculty Management',
      entityType: 'studentBatch',
      entityId: '',
      description: `Marked ${studentIds.length} students not enrolled`,
      details: { studentIds, count: studentIds.length }
    });
    return { success: true, count: studentIds.length };
  } catch (error) {
    console.error('Error bulk unenrolling students:', error);
    return { success: false, error: error.message };
  }
};

export const bulkSetAllStudentsNotEnrolled = async () => {
  try {
    const snap = await getDocs(collection(db, 'students'));
    const ids = snap.docs.map(docSnapshot => docSnapshot.id);
    return await bulkSetStudentNotEnrolled(ids);
  } catch (error) {
    console.error('Error bulk unenrolling all students:', error);
    return { success: false, error: error.message };
  }
};

export const getOtherDepartments = async () => {
  try {
    const snap = await getDocs(collection(db, 'otherDepartments'));
    const data = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return { success: true, data };
  } catch (error) {
    console.error('Error loading other departments:', error);
    return { success: false, error: error.message };
  }
};

// Distills a list of "classes" from the student records of a department:
//   each unique (course, yearLevel) tuple becomes one class, with the set of
//   blocks present and a student count.
export const getOtherDeptClasses = async (departmentId) => {
  try {
    if (!departmentId) return { success: true, data: [] };
    const q = query(
      collection(db, 'otherDept-Students'),
      where('departmentId', '==', departmentId)
    );
    const snap = await getDocs(q);
    const classes = new Map();
    snap.docs.forEach(d => {
      const s = d.data();
      const courseName = (s.course || '').toString().trim();
      const year = Number(s.yearLevel) || 0;
      const block = (s.block || '').toString().trim().toUpperCase();
      const key = `${courseName.toLowerCase()}::${year}`;
      if (!classes.has(key)) {
        classes.set(key, {
          course: courseName,
          yearLevel: year,
          blocks: new Set(),
          studentCount: 0
        });
      }
      const entry = classes.get(key);
      if (block) entry.blocks.add(block);
      entry.studentCount += 1;
    });
    const data = Array.from(classes.values())
      .map(c => ({ ...c, blocks: Array.from(c.blocks).sort() }))
      .sort((a, b) =>
        (a.course || '').localeCompare(b.course || '') || a.yearLevel - b.yearLevel
      );
    return { success: true, data };
  } catch (error) {
    console.error('Error loading other-dept classes:', error);
    return { success: false, error: error.message };
  }
};

export const getEnrollmentRoster = async (activeTerm) => {
  try {
    const snap = await getDocs(collection(db, 'students'));
    const data = snap.docs.map(d => {
      const student = { id: d.id, ...d.data() };
      return {
        ...student,
        enrollmentStatus: getStudentEnrollmentStatus(student, activeTerm)
      };
    });
    data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return { success: true, data };
  } catch (error) {
    console.error('Error loading enrollment roster:', error);
    return { success: false, error: error.message };
  }
};
