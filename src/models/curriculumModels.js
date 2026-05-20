import { writeBatch } from 'firebase/firestore';
import { archiveStudentPayables } from './payablesModels';
// Archive and promote students (batch archiving, promotion, payables logic)
export const archiveAndPromoteStudents = async (batchStartYear, batchEndYear) => {
  const batchName = `batch_${batchStartYear}_${batchEndYear}`;
  const studentsRef = collection(db, 'students');
  const archivesRef = doc(db, 'archives', batchName);

  // 1. Get all students
  const studentsSnapshot = await getDocs(studentsRef);
  const allStudents = studentsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

  // 2. Filter 4th year regular students
  const toArchive = allStudents.filter(s => s.yearLevel === 4 && !s.isIrregular);

  if (toArchive.length === 0) {
    return { success: false, message: 'No 4th year regular students to archive.' };
  }

  // 3. Check if batch already exists
  const archiveDoc = await getDoc(archivesRef);
  let archivedStudents = [];
  if (archiveDoc.exists()) {
    archivedStudents = archiveDoc.data().students || [];
    // Prevent duplicate student ids in archive
    const archivedIds = new Set(archivedStudents.map(s => s.id));
    toArchive.forEach(s => {
      if (!archivedIds.has(s.id)) archivedStudents.push(s);
    });
  } else {
    archivedStudents = [...toArchive];
  }

  // 4. Prepare batch write
  const batch = writeBatch(db);

  // 5. Archive students
  batch.set(archivesRef, { students: archivedStudents }, { merge: true });

  // 6. Remove archived students from active collection
  toArchive.forEach(s => {
    batch.delete(doc(db, 'students', s.id));
  });

  // 7. Promote eligible students and handle payables
  allStudents.forEach(s => {
    if (s.yearLevel < 4 && !s.isIrregular) {
      // Move unpaid payables to previousPayables
      const payables = Array.isArray(s.payables) ? s.payables : [];
      const unpaid = payables.filter(p => p.status !== 'paid');
      const paid = payables.filter(p => p.status === 'paid');
      const previousPayables = Array.isArray(s.previousPayables) ? s.previousPayables : [];
      const newPrevious = unpaid.map(p => ({ ...p, status: 'previous' }));
      batch.update(doc(db, 'students', s.id), {
        yearLevel: Math.min((s.yearLevel || 1) + 1, 4),
        payables: paid,
        previousPayables: [...previousPayables, ...newPrevious],
        updatedAt: new Date().toISOString()
      });
    }
  });

  // 8. Commit batch
  try {
    await batch.commit();
    
    // Archive payables for each archived student
    for (const student of toArchive) {
      await archiveStudentPayables(student.id, student, batchName);
    }
    
    await logSystemAction({
      action: 'Archived And Promoted Students To Next Year Level',
      module: 'Curriculum Checker',
      entityType: 'studentBatch',
      entityId: batchName,
      description: `Archived ${toArchive.length} 4th year students and promoted eligible students to next year level`,
      details: { batchStartYear, batchEndYear, archivedCount: toArchive.length }
    });
    return { success: true, message: `Archived ${toArchive.length} students and promoted others.` };
  } catch (error) {
    return { success: false, message: error.message };
  }
};
import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc,
  updateDoc, 
  query, 
  where, 
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { logSystemAction } from '../utils/auditLogger';

// Curriculum Model
export const createCurriculum = async (curriculumData) => {
  try {
    const docRef = await addDoc(collection(db, 'curriculums'), {
      name: curriculumData.name,
      description: curriculumData.description,
      yearLevels: curriculumData.yearLevels, // Array of year levels (1-4)
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await logSystemAction({
      action: 'Created Curriculum Record',
      module: 'Curriculum Checker',
      entityType: 'curriculum',
      entityId: docRef.id,
      description: `Created new curriculum: ${curriculumData.name || 'Untitled curriculum'}`,
      details: curriculumData
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error creating curriculum:', error);
    return { success: false, error: error.message };
  }
};

export const getCurriculums = async () => {
  try {
    const q = query(collection(db, 'curriculums'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const curriculums = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return { success: true, data: curriculums };
  } catch (error) {
    console.error('Error getting curriculums:', error);
    return { success: false, error: error.message };
  }
};

// Course Model
export const addCourse = async (curriculumId, yearLevel, semester, courseData) => {
  try {
    const docRef = await addDoc(collection(db, 'courses'), {
      curriculumId,
      yearLevel,
      semester,
      courseCode: courseData.courseCode,
      courseTitle: courseData.courseTitle,
      units: courseData.units,
      prerequisites: courseData.prerequisites || [], // Array of course codes
      isAvailable: courseData.isAvailable !== undefined ? courseData.isAvailable : true, // Default to true
      isMajor: courseData.isMajor || false, // New field for major subject
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await logSystemAction({
      action: 'Created Course Record',
      module: 'Curriculum Checker',
      entityType: 'course',
      entityId: docRef.id,
      description: `Created course ${courseData.courseCode || ''} - ${courseData.courseTitle || ''}`.trim(),
      details: { curriculumId, yearLevel, semester, ...courseData }
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding course:', error);
    return { success: false, error: error.message };
  }
};

export const getCoursesByCurriculum = async (curriculumId) => {
  try {
    const q = query(collection(db, 'courses'), where('curriculumId', '==', curriculumId), orderBy('yearLevel'), orderBy('semester'));
    const querySnapshot = await getDocs(q);
    const courses = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return { success: true, data: courses };
  } catch (error) {
    console.error('Error getting courses:', error);
    return { success: false, error: error.message };
  }
};

export const getAllCourses = async () => {
  try {
    const q = query(collection(db, 'courses'));
    const querySnapshot = await getDocs(q);
    const courses = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return { success: true, data: courses };
  } catch (error) {
    console.error('Error getting all courses:', error);
    return { success: false, error: error.message };
  }
};

// Student Model
export const addStudent = async (studentData) => {
  try {
    const isIrregular = !!studentData.isIrregular;
    const normalizedStudentNumber = (studentData.studentNumber || studentData.studentNo || '').toString().trim();
    const normalizedEmail = (studentData.email || studentData.studentEmail || '').toString().trim();
    const normalizedContactNumber = (studentData.contactNumber || studentData.contact || studentData.phoneNumber || '').toString().trim();
    const isEnrolled = studentData.enrolled === true;
    const enrolledTerm = isEnrolled && studentData.enrolledTerm
      ? {
          semester: Number(studentData.enrolledTerm.semester) || 1,
          schoolYear: studentData.enrolledTerm.schoolYear || ''
        }
      : null;
    const docRef = await addDoc(collection(db, 'students'), {
      name: studentData.name,
      studentNumber: normalizedStudentNumber,
      email: normalizedEmail,
      contactNumber: normalizedContactNumber,
      yearLevel: studentData.yearLevel,
      curriculumId: isIrregular ? null : studentData.curriculumId,
      completedCourses: [], // Array of course codes
      isIrregular,
      enrolled: isEnrolled,
      enrolledTerm,
      semesterLoads: studentData.semesterLoads || { sem1: [], sem2: [] },
      irregularSubjects: studentData.irregularSubjects || { sem1: [], sem2: [] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await logSystemAction({
      action: 'Created Student Record',
      module: 'Student Management',
      entityType: 'student',
      entityId: docRef.id,
      description: `Created student record for ${studentData.name || 'Unnamed student'} ${studentData.enrolled ? '(enrolled)' : '(not enrolled)'}`,
      details: {
        studentName: studentData.name,
        enrolled: isEnrolled,
        enrolledTerm,
        ...studentData
      }
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding student:', error);
    return { success: false, error: error.message };
  }
};

export const getStudents = async () => {
  try {
    const q = query(collection(db, 'students'), orderBy('name'));
    const querySnapshot = await getDocs(q);
    const students = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Normalize legacy/alternate keys so UI always displays core fields.
      studentNumber: doc.data()?.studentNumber || doc.data()?.studentNo || '',
      email: doc.data()?.email || doc.data()?.studentEmail || '',
      contactNumber: doc.data()?.contactNumber || doc.data()?.contact || doc.data()?.phoneNumber || ''
    }));
    return { success: true, data: students };
  } catch (error) {
    console.error('Error getting students:', error);
    return { success: false, error: error.message };
  }
};

export const getStudentsByYearLevel = async (yearLevel) => {
  try {
    const q = query(
      collection(db, 'students'), 
      where('yearLevel', '==', yearLevel),
      orderBy('name')
    );
    const querySnapshot = await getDocs(q);
    const students = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      studentNumber: doc.data()?.studentNumber || doc.data()?.studentNo || '',
      email: doc.data()?.email || doc.data()?.studentEmail || '',
      contactNumber: doc.data()?.contactNumber || doc.data()?.contact || doc.data()?.phoneNumber || ''
    }));
    return { success: true, data: students };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateStudentCourse = async (studentId, courseCode, isCompleted) => {
  try {
    const studentRef = doc(db, 'students', studentId);
    const studentDoc = await getDoc(studentRef);
    
    if (!studentDoc.exists()) {
      return { success: false, error: 'Student not found' };
    }
    
    const studentData = studentDoc.data();
    let completedCourses = studentData.completedCourses || [];
    
    if (isCompleted) {
      if (!completedCourses.includes(courseCode)) {
        completedCourses.push(courseCode);
      }
    } else {
      completedCourses = completedCourses.filter(code => code !== courseCode);
    }
    
    await updateDoc(studentRef, {
      completedCourses,
      updatedAt: new Date().toISOString()
    });
    await logSystemAction({
      action: isCompleted ? 'Marked Course As Completed' : 'Unmarked Course As Completed',
      module: 'Curriculum Checker',
      entityType: 'student',
      entityId: studentId,
      description: `${isCompleted ? 'Marked' : 'Unmarked'} course ${courseCode} as completed for student ${studentId}`,
      details: { courseCode, isCompleted }
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Curriculum Checker Logic
export const getStudentCurriculumStatus = async (studentId) => {
  try {
    // Get student data
    const studentRef = doc(db, 'students', studentId);
    const studentDoc = await getDoc(studentRef);
    
    if (!studentDoc.exists()) {
      return { success: false, error: 'Student not found' };
    }
    
    const studentData = studentDoc.data();
    const completedCourses = studentData.completedCourses || [];
    const grades = studentData.grades || {};
    
    // Helper function to check if a course is failed (grade 5.0 or above)
    const isCourseFailed = (courseCode) => {
      const grade = grades[courseCode];
      return grade && parseFloat(grade) >= 5.0;
    };
    
    // Helper function to check if a course is incomplete
    const isCourseIncomplete = (courseCode) => {
      const grade = grades[courseCode];
      return grade === 'INC';
    };
    
    // Helper function to check if a course meets prerequisites (completed and not failed/incomplete)
    const isPrerequisiteMet = (courseCode) => {
      return completedCourses.includes(courseCode) && 
             !isCourseFailed(courseCode) && 
             !isCourseIncomplete(courseCode);
    };

    // Helper to get all prerequisites for a course and its equivalents
    const getAllEquivalentPrerequisites = (course) => {
      if (!course.equivalentSubjectId) return course.prerequisites || [];
      // Find all courses with the same equivalentSubjectId
      const equivalents = allCourses.filter(c => 
        c.equivalentSubjectId === course.equivalentSubjectId && 
        c.id !== course.id
      );
      
      // Union of all prerequisites
      const allPrereqs = new Set();
      equivalents.forEach(eq => {
        (eq.prerequisites || []).forEach(pr => allPrereqs.add(pr));
      });
      return Array.from(allPrereqs);
    };

    // Helper function to check if all first semester courses of a year level are completed
    const areFirstSemesterCoursesCompleted = (yearLevel) => {
      const firstSemCourses = courses.filter(c => 
        c.yearLevel === yearLevel && c.semester === 1
      );
      
      if (firstSemCourses.length === 0) return true; // No first semester courses
      
      return firstSemCourses.every(course => 
        completedCourses.includes(course.courseCode) && 
        !isCourseFailed(course.courseCode) && 
        !isCourseIncomplete(course.courseCode)
      );
    };
    
    // Get curriculum courses
    const coursesResult = await getCoursesByCurriculum(studentData.curriculumId);
    if (!coursesResult.success) return { success: false, error: coursesResult.error };
    const courses = coursesResult.data;
    
    // Get all courses for equivalent subject logic
    const allCoursesResult = await getAllCourses();
    const allCourses = allCoursesResult.success ? allCoursesResult.data : [];
      
    // Build course status list
    const courseStatuses = courses.map(course => {
      let status = 'not-taken';
      
      // FIRST: Check if course is completed/failed (highest priority)
      if (completedCourses.includes(course.courseCode)) {
        status = isCourseFailed(course.courseCode) ? 'failed' : 'completed';
      } 
      // SECOND: Check if course is marked as unavailable (only for non-completed courses)
      else if (course.isAvailable === false) {
        status = 'unavailable';
      } 
      // For regular students, check if course is from a higher year level AFTER checking completion
      else if (!studentData.isIrregular && course.yearLevel > studentData.yearLevel) {
        status = 'blocked';  // Higher year courses are blocked for regular students
      } 
      // For regular students, check semester progression: must complete 1st semester before 2nd semester
      else if (!studentData.isIrregular && course.semester === 2 && !areFirstSemesterCoursesCompleted(course.yearLevel)) {
        status = 'blocked';  // Second semester courses are blocked until first semester is completed
      }
      else {
        // Use all equivalent prerequisites
        const allPrereqs = getAllEquivalentPrerequisites(course);
        if (allPrereqs.length > 0) {
          const prereqsMet = allPrereqs.every(isPrerequisiteMet);
          if (prereqsMet) {
            status = 'available';
          } else {
            status = 'blocked';
          }
        } else {
          status = 'available';
        }
      }
      
      // For irregular students, check if equivalent subjects are available
      if (studentData.isIrregular && course.equivalentSubjectId) {
        const equivalentCourses = allCourses.filter(c => 
          c.equivalentSubjectId === course.equivalentSubjectId && 
          c.id !== course.id
        );
        
        // Check if any equivalent course is available AND the student meets all prerequisites for that equivalent
        const anyEquivalentAvailable = equivalentCourses.some(eq => {
          if (eq.isAvailable === false) return false;
          const eqAllPrereqs = getAllEquivalentPrerequisites(eq);
          if (eqAllPrereqs.length > 0) {
            return eqAllPrereqs.every(isPrerequisiteMet);
          }
          return true;
        });
        
        if (anyEquivalentAvailable && status !== 'completed' && status !== 'failed') {
          status = 'available';
        }
      }
      
      return {
        ...course,
        status
      };
    });
    
    return { success: true, data: { student: { ...studentData, id: studentId }, courses: courseStatuses } };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const DEAN_LIST_CRITERIA_DOC = doc(db, 'dean_list_criteria', 'default');
const LEGACY_DEAN_LIST_CRITERIA_DOC = doc(db, 'settings', 'dean_list_criteria');
const DEFAULT_DEAN_LIST_CRITERIA = {
  major: 1.7,
  minor: 2.0,
  gwa: 1.7,
  minUnits: 15
};

const toValidNumber = (value, fallback) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getDeanListCriteria = async () => {
  try {
    const criteriaDoc = await getDoc(DEAN_LIST_CRITERIA_DOC);

    // Backward compatibility for older data location.
    if (!criteriaDoc.exists()) {
      const legacyDoc = await getDoc(LEGACY_DEAN_LIST_CRITERIA_DOC);
      if (legacyDoc.exists()) {
        const legacyData = legacyDoc.data() || {};
        const migrated = {
          major: toValidNumber(legacyData.major, DEFAULT_DEAN_LIST_CRITERIA.major),
          minor: toValidNumber(legacyData.minor, DEFAULT_DEAN_LIST_CRITERIA.minor),
          gwa: toValidNumber(legacyData.gwa, DEFAULT_DEAN_LIST_CRITERIA.gwa),
          minUnits: toValidNumber(legacyData.minUnits, DEFAULT_DEAN_LIST_CRITERIA.minUnits),
          createdAt: legacyData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await setDoc(DEAN_LIST_CRITERIA_DOC, migrated, { merge: true });
        return { success: true, data: { major: migrated.major, minor: migrated.minor, gwa: migrated.gwa, minUnits: migrated.minUnits } };
      }
    }

    if (!criteriaDoc.exists()) {
      await setDoc(DEAN_LIST_CRITERIA_DOC, {
        ...DEFAULT_DEAN_LIST_CRITERIA,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return { success: true, data: DEFAULT_DEAN_LIST_CRITERIA };
    }

    const data = criteriaDoc.data() || {};
    return {
      success: true,
      data: {
        major: toValidNumber(data.major, DEFAULT_DEAN_LIST_CRITERIA.major),
        minor: toValidNumber(data.minor, DEFAULT_DEAN_LIST_CRITERIA.minor),
        gwa: toValidNumber(data.gwa, DEFAULT_DEAN_LIST_CRITERIA.gwa),
        minUnits: toValidNumber(data.minUnits, DEFAULT_DEAN_LIST_CRITERIA.minUnits)
      }
    };
  } catch (error) {
    console.error('Error getting dean list criteria:', error);
    return { success: false, error: error.message };
  }
};

export const saveDeanListCriteria = async (criteria = {}) => {
  try {
    const payload = {
      major: toValidNumber(criteria.major, DEFAULT_DEAN_LIST_CRITERIA.major),
      minor: toValidNumber(criteria.minor, DEFAULT_DEAN_LIST_CRITERIA.minor),
      gwa: toValidNumber(criteria.gwa, DEFAULT_DEAN_LIST_CRITERIA.gwa),
      minUnits: toValidNumber(criteria.minUnits, DEFAULT_DEAN_LIST_CRITERIA.minUnits),
      updatedAt: new Date().toISOString()
    };

    await setDoc(DEAN_LIST_CRITERIA_DOC, payload, { merge: true });
    // Keep legacy document updated for compatibility with existing dashboards/manual checks.
    await setDoc(LEGACY_DEAN_LIST_CRITERIA_DOC, payload, { merge: true });
    await logSystemAction({
      action: 'Updated Dean List Criteria',
      module: 'Reports',
      entityType: 'setting',
      entityId: 'dean_list_criteria',
      description: 'Updated Dean\'s List eligibility criteria',
      details: payload
    });
    return { success: true, data: payload };
  } catch (error) {
    console.error('Error saving dean list criteria:', error);
    return { success: false, error: error.message };
  }
};

// Sync function to handle pending actions when coming back online
export const syncOfflineData = async () => {
  // Note: OfflineStorage is not implemented yet
  // This function is a placeholder for future offline functionality
  return { success: true, message: 'No offline storage implemented yet' };
}; 

// Academic configuration (dean list, scholarships, units limits)
const ACADEMIC_CONFIG_DOC = doc(db, 'academic_config', 'settings');

export const getAcademicConfig = async () => {
  try {
    const snap = await getDoc(ACADEMIC_CONFIG_DOC);
    if (!snap.exists()) {
      // default config
      const defaultConfig = {
        deanList: {
          gwa: DEFAULT_DEAN_LIST_CRITERIA.gwa,
          major: DEFAULT_DEAN_LIST_CRITERIA.major,
          minor: DEFAULT_DEAN_LIST_CRITERIA.minor,
          minUnits: DEFAULT_DEAN_LIST_CRITERIA.minUnits,
          applyMinUnitsFor: 'both',
          computation: 'weighted'
        },
        scholarships: [],
        unitsLimits: {
          default: { regular: 18, irregular: 15, overload: 21 },
          byYear: {}
        },
        updatedAt: new Date().toISOString()
      };
      await setDoc(ACADEMIC_CONFIG_DOC, defaultConfig, { merge: true });
      return { success: true, data: defaultConfig };
    }
    return { success: true, data: snap.data() };
  } catch (error) {
    console.error('Error getting academic config:', error);
    return { success: false, error: error.message };
  }
};

export const saveAcademicConfig = async (config) => {
  try {
    const payload = { ...config, updatedAt: new Date().toISOString() };
    await setDoc(ACADEMIC_CONFIG_DOC, payload, { merge: true });
    await logSystemAction({
      action: 'Updated Academic Configuration',
      module: 'Administration',
      entityType: 'academic_config',
      entityId: 'settings',
      description: 'Updated academic eligibility and units limit configuration',
      details: payload
    });
    return { success: true, data: payload };
  } catch (error) {
    console.error('Error saving academic config:', error);
    return { success: false, error: error.message };
  }
};
