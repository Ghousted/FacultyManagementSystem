import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  doc, 
  updateDoc, 
  query, 
  where, 
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';

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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
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
    const docRef = await addDoc(collection(db, 'students'), {
      name: studentData.name,
      yearLevel: studentData.yearLevel,
      curriculumId: studentData.curriculumId,
      completedCourses: [], // Array of course codes
      isIrregular: studentData.isIrregular || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
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
      ...doc.data()
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
      ...doc.data()
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
      const equivalents = allCourses.filter(c => c.equivalentSubjectId === course.equivalentSubjectId);
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

// Sync function to handle pending actions when coming back online
export const syncOfflineData = async () => {
  // Note: OfflineStorage is not implemented yet
  // This function is a placeholder for future offline functionality
  return { success: true, message: 'No offline storage implemented yet' };
}; 