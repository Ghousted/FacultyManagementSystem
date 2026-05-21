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

const getStudentStatusLogLabel = async (studentIds = []) => {
  const ids = Array.isArray(studentIds) ? studentIds.filter(Boolean) : [];
  if (ids.length === 1) {
    try {
      const snap = await getDoc(doc(db, 'students', ids[0]));
      if (snap.exists()) return snap.data()?.name || ids[0];
    } catch {
      return ids[0];
    }
    return ids[0];
  }
  return `${ids.length} students`;
};

// Enrollment status reasons.
//   'enrolled'       — included in rosters for the active term.
//   'not-enrolled'   — not currently enrolled for the active term.
export const getStudentEnrollmentStatus = (student, activeTerm) => {
  if (student?.enrolled === false) return 'not-enrolled';
  const term = student?.enrolledTerm;
  if (!term || (!term.schoolYear && !term.semester)) {
    return student?.enrolled === true ? 'enrolled' : 'not-enrolled';
  }
  const matches =
    Number(term.semester) === Number(activeTerm?.semester) &&
    (term.schoolYear || '') === (activeTerm?.schoolYear || '');
  return matches ? 'enrolled' : 'not-enrolled';
};

const isStudentVisibleForActiveTerm = (student, activeTerm) => {
  const status = getStudentEnrollmentStatus(student, activeTerm);
  return status === 'enrolled';
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
      action: 'Updated Academic Term',
      module: 'Faculty Management',
      entityType: 'setting',
      entityId: 'active_term',
      description: `Updated active academic term to Semester ${payload.semester}, School Year ${payload.schoolYear}`,
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
      action: 'Created Professor Account',
      module: 'Faculty Management',
      entityType: 'professor',
      entityId: ref.id,
      description: `Created new professor account for ${professor.name || 'Unnamed professor'} (Employee ID: ${professor.employeeId || 'N/A'})`,
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
      action: 'Updated Professor Information',
      module: 'Faculty Management',
      entityType: 'professor',
      entityId: id,
      description: `Updated professor information for ID ${id}`,
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
      action: 'Deleted Professor Account',
      module: 'Faculty Management',
      entityType: 'professor',
      entityId: id,
      description: `Deleted professor account with ID ${id}`
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

const isCourseBlockTakenByOthers = async (professorId, courseId, blocks) => {
  const desiredBlocks = normalizeBlocks(blocks);
  if (!desiredBlocks.length || !courseId) return false;

  const allProfsSnap = await getDocs(collection(db, 'professors'));
  for (const snap of allProfsSnap.docs) {
    if (snap.id === professorId) continue;
    const courses = snap.data()?.assignedCourses || [];
    for (const c of courses) {
      if (c.courseId !== courseId) continue;
      const takenBlocks = normalizeBlocks(c.blocks);
      if (takenBlocks.some(block => desiredBlocks.includes(block))) {
        return true;
      }
    }
  }
  return false;
};

export const assignCourseToProfessor = async (professorId, course) => {
  try {
    const ref = doc(db, 'professors', professorId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Professor not found' };

    const blocks = normalizeBlocks(course.blocks);
    if (blocks.length === 0) {
      return { success: false, error: 'Select at least one block.' };
    }

    const conflict = await isCourseBlockTakenByOthers(professorId, course.courseId, blocks);
    if (conflict) {
      return { success: false, error: 'Selected blocks are already assigned to another professor.' };
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
      action: 'Assigned Course To Professor',
      module: 'Faculty Management',
      entityType: 'professor',
      entityId: professorId,
      description: `Assigned course ${entry.courseCode || entry.courseTitle || 'Unknown Course'} to professor ${professorId} for Year Level ${entry.yearLevel}, Blocks: ${entry.blocks.join(', ')}`,
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

    const conflict = await isCourseBlockTakenByOthers(professorId, courseId, normalized);
    if (conflict) {
      return { success: false, error: 'Selected blocks are already assigned to another professor.' };
    }

    const next = (snap.data().assignedCourses || []).map(c =>
      c.courseId === courseId ? { ...c, blocks: normalized } : c
    );

    await updateDoc(ref, {
      assignedCourses: next,
      updatedAt: new Date().toISOString()
    });
    await logSystemAction({
      action: 'Updated Assigned Course Blocks',
      module: 'Faculty Management',
      entityType: 'professor',
      entityId: professorId,
      description: `Updated block assignment for course ${courseId} to Blocks: ${normalized.join(', ')}`,
      details: { courseId, blocks: normalized }
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating assignment blocks:', error);
    return { success: false, error: error.message };
  }
};

export const unassignCourseFromProfessor = async (professorId, courseId, options = {}) => {
  try {
    const ref = doc(db, 'professors', professorId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Professor not found' };

    const professorData = snap.data() || {};
    const professorName = professorData.name || professorId;
    const next = (professorData.assignedCourses || []).filter(c => c.courseId !== courseId);
    await updateDoc(ref, {
      assignedCourses: next,
      updatedAt: new Date().toISOString()
    });
    if (!options.suppressLog) {
      await logSystemAction({
        action: 'Unassigned Course From Professor',
        module: 'Faculty Management',
        entityType: 'professor',
        entityId: professorId,
        description: `Unassigned course ${courseId} from professor ${professorName}`,
        details: { courseId, professorName }
      });
    }
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
        .sort((a, b) =>
          (a.name || '').localeCompare(b.name || '')
        );
      return { success: true, data: matched };
    }

    const snap = await getDocs(collection(db, 'students'));
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const matched = all.filter(student => {
      // For irregular students, visibility is determined by their irregularSubjects entries
      // for the active term (enrolledSemester / enrolledSchoolYear). Skip the global
      // enrolledTerm check so irregular students aren't incorrectly excluded.
      if (!student.isIrregular) {
        if (!isStudentVisibleForActiveTerm(student, term)) return false;
      }

      const completed = (student.completedCourses || []).map(c => (c || '').toString().trim().toUpperCase());
      if (completed.includes(targetCode)) return false;

      if (student.isIrregular) {
        const items = ((student.irregularSubjects || {})[semKey]) || [];
        return items.some(item => {
          const matchesCourse = (item.courseCode || '').toString().trim().toUpperCase() === targetCode;
          if (!matchesCourse) return false;
          // Verify the school year matches the active term — only filter if BOTH sides are non-empty
          const itemSchoolYear = (item.enrolledSchoolYear || '').toString().trim();
          const termSchoolYear = (term.schoolYear || '').toString().trim();
          if (itemSchoolYear && termSchoolYear && itemSchoolYear !== termSchoolYear) return false;
          // Also check joinedBlock is in allowedBlocks when blocks are specified
          if (allowedBlocks.length > 0) {
            const joinedBlock = item.joinedBlock
              ? String(item.joinedBlock).trim().toUpperCase()
              : null;
            // Include if joinedBlock matches an allowed block, OR if no joinedBlock is set
            if (joinedBlock && !allowedBlocks.includes(joinedBlock)) return false;
          }
          return true;
        });
      }

      // Regular student: their current semester load is dictated by the curriculum.
      if (allowedBlocks.length > 0) {
        const studentBlock = (student.block || '').toString().trim().toUpperCase() || 'A';
        if (!allowedBlocks.includes(studentBlock)) return false;
      }
      if (student.curriculumId !== course.curriculumId) return false;
      if (Number(student.yearLevel) !== Number(course.yearLevel)) return false;
      if (Number(course.semester) !== sem) return false;
      return true;
    });

    matched.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
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
    const stamp = new Date().toISOString();
    await updateDoc(doc(db, 'students', studentId), {
      enrolled: true,
      enrolledTerm: term,
      enrolledAt: stamp,
      updatedAt: stamp
    });

    let studentName = 'Student';
    try {
      const snap = await getDoc(doc(db, 'students', studentId));
      if (snap.exists()) studentName = snap.data()?.name || studentName;
    } catch {
      // ignore name resolution failures
    }

    await logSystemAction({
      action: 'Enrolled Student In Classes',
      module: 'Student Management',
      entityType: 'student',
      entityId: studentId,
      description: `Enrolled student ${studentName} for Semester ${term.semester}, School Year ${term.schoolYear}`,
      details: { studentName, studentCount: 1, activeTerm: term, status: 'active' }
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
      action: 'Unenrolled Student From Classes',
      module: 'Faculty Management',
      entityType: 'student',
      entityId: studentId,
      description: `Unenrolled student ${await getStudentStatusLogLabel([studentId])} from active term enrollment`,
      details: { status: 'inactive' }
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

    for (let i = 0; i < studentIds.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = studentIds.slice(i, i + chunkSize);
      chunk.forEach(id => {
        batch.update(doc(db, 'students', id), {
          enrolled: true,
          enrolledTerm: term,
          enrolledAt: stamp,
          updatedAt: stamp
        });
      });
      await batch.commit();
    }

    await logSystemAction({
      action: 'Bulk Enrolled Students In Classes',
      module: 'Student Management',
      entityType: 'studentBatch',
      entityId: '',
      description: `Bulk enrolled ${studentIds.length} students for Semester ${term.semester}, School Year ${term.schoolYear}`,
      details: { studentCount: studentIds.length, studentIds, activeTerm: term }
    });
    return { success: true, count: studentIds.length };
  } catch (error) {
    console.error('Error bulk enrolling students:', error);
    return { success: false, error: error.message };
  }
};

export const bulkSetStudentNotEnrolled = async (studentIds, options = {}) => {
  try {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return { success: true, count: 0 };
    }

    const chunkSize = 500;
    const stamp = new Date().toISOString();

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
    }

    if (!options.suppressLog) {
      await logSystemAction({
        action: 'Bulk Unenrolled Students From Classes',
        module: 'Faculty Management',
        entityType: 'studentBatch',
        entityId: '',
        description: `Bulk unenrolled ${studentIds.length} students from active term enrollment`,
        details: { studentIds, count: studentIds.length, status: 'inactive' }
      });
    }
    return { success: true, count: studentIds.length };
  } catch (error) {
    console.error('Error bulk unenrolling students:', error);
    return { success: false, error: error.message };
  }
};

export const bulkSetAllStudentsNotEnrolled = async (options = {}) => {
  try {
    const snap = await getDocs(collection(db, 'students'));
    const ids = snap.docs.map(docSnapshot => docSnapshot.id);
    return await bulkSetStudentNotEnrolled(ids, options);
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

// Unassign all professor classes when term changes
export const unassignAllProfessorClasses = async () => {
  try {
    const snap = await getDocs(collection(db, 'professors'));
    
    if (snap.empty) {
      return { success: true, message: 'No professors found' };
    }

    // Batch update to clear all assigned courses
    const batch = writeBatch(db);
    snap.docs.forEach(docSnapshot => {
      batch.update(docSnapshot.ref, {
        assignedCourses: [],
        updatedAt: new Date().toISOString()
      });
    });

    await batch.commit();
    
    await logSystemAction({
      action: 'Unassigned All Classes From Professors',
      module: 'Faculty Management',
      entityType: 'professor',
      entityId: 'bulk_unassign',
      description: `Unassigned all course assignments from ${snap.size} professors due to academic term change`,
      details: { unassignedCount: snap.size }
    });

    return { success: true, message: `Unassigned classes from ${snap.size} professors` };
  } catch (error) {
    console.error('Error unassigning professor classes:', error);
    return { success: false, error: error.message };
  }
};

// Get all irregular students who have taken courses taught by the professor for the active term
// Returns a list of unique irregular students with their assigned irregular subjects
export const getIrregularStudentsForProfessor = async (professorId, activeTerm) => {
  try {
    // Get the professor and their assigned courses
    const profSnap = await getDoc(doc(db, 'professors', professorId));
    if (!profSnap.exists()) {
      return { success: false, error: 'Professor not found' };
    }

    const professor = { id: profSnap.id, ...profSnap.data() };
    const assignedCourses = professor.assignedCourses || [];

    if (assignedCourses.length === 0) {
      return { success: true, data: [] };
    }

    // Build maps of the courses the professor teaches for quick lookup by course code
    const professorCourseIds = new Set(assignedCourses.map(c => c.courseId));
    const professorCourseCodes = new Set(assignedCourses.map(c => (c.courseCode || '').toUpperCase()));
    const professorCourseByCode = (assignedCourses || []).reduce((acc, c) => {
      const key = (c.courseCode || '').toString().trim().toUpperCase();
      if (key) acc[key] = c;
      return acc;
    }, {});

    // Get all students
    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter for irregular students
    const irregularStudents = allStudents.filter(s => s.isIrregular);

    if (irregularStudents.length === 0) {
      return { success: true, data: [] };
    }

    const sem = Number(activeTerm?.semester) || 1;
    const semKey = `sem${sem}`;
    const termSchoolYear = (activeTerm?.schoolYear || '').toString().trim();

    // For each irregular student, find their irregular subjects that match the professor's courses
    const enrolledIrregularStudents = [];

    irregularStudents.forEach(student => {
      const irregularSubjects = student.irregularSubjects || {};
      const semesterSubjects = irregularSubjects[semKey] || [];

      // Find subjects that match the professor's courses AND are from the active term
      const matchingSubjects = semesterSubjects.filter(subject => {
        const courseCode = (subject.courseCode || '').toUpperCase();
        const enrolledSchoolYear = (subject.enrolledSchoolYear || '').toString().trim();

        // Check if the course code is in the professor's list
        const matchesProfCourse = professorCourseCodes.has(courseCode);

        // Check if the school year matches (or is empty, treating it as matching current term)
        const schoolYearMatches = !enrolledSchoolYear || enrolledSchoolYear === termSchoolYear;

        return matchesProfCourse && schoolYearMatches;
      });

      if (matchingSubjects.length > 0) {
        // Determine a sensible course label for display: if the matching professor course
        // comes from CCS (the school's own dept), show "BSCS". Otherwise leave
        // the student's own `course` or fallback to the subject code.
        const firstMatchCode = (matchingSubjects[0].courseCode || '').toString().trim().toUpperCase();
        const matchedAssignment = professorCourseByCode[firstMatchCode];
        const displayCourse = matchedAssignment && matchedAssignment.source !== 'other-department'
          ? 'BSCS'
          : (student.course || matchingSubjects[0].courseCode || '—');

        enrolledIrregularStudents.push({
          id: student.id,
          name: student.name,
          studentNumber: student.studentNumber,
          yearLevel: student.yearLevel,
          block: student.block,
          email: student.email || '',
          contactNumber: student.contactNumber || '',
          irregularSubjects: matchingSubjects,
          enrolledTerm: student.enrolledTerm || {},
          course: displayCourse
        });
      }
    });

    // Sort by name
    enrolledIrregularStudents.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return { success: true, data: enrolledIrregularStudents };
  } catch (error) {
    console.error('Error getting irregular students for professor:', error);
    return { success: false, error: error.message };
  }
};
