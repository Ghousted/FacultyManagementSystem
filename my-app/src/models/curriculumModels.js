import { 
  collection, 
  addDoc, 
  getDocs, 
  getDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  writeBatch
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
      
      // Check if course is marked as unavailable
      if (course.isAvailable === false) {
        status = 'unavailable';
      } else if (completedCourses.includes(course.courseCode)) {
        status = isCourseFailed(course.courseCode) ? 'failed' : 'completed';
      } else if (course.prerequisites && course.prerequisites.length > 0) {
        const prereqsMet = course.prerequisites.every(isPrerequisiteMet);
        if (prereqsMet) {
          status = 'available';
        } else {
          status = 'blocked';
        }
      } else {
        status = 'available';
      }
      
      // For irregular students, check if equivalent subjects are available
      if (studentData.isIrregular && course.equivalentSubjectId) {
        const equivalentCourses = allCourses.filter(c => 
          c.equivalentSubjectId === course.equivalentSubjectId && 
          c.id !== course.id
        );
        
        // Check if any equivalent course is available AND the student meets its prerequisites
        const anyEquivalentAvailable = equivalentCourses.some(eq => {
          // First check if the equivalent course itself is available
          if (eq.isAvailable === false) return false;
          
          // Then check if the student meets the prerequisites for this equivalent course
          if (eq.prerequisites && eq.prerequisites.length > 0) {
            const prereqsMet = eq.prerequisites.every(isPrerequisiteMet);
            return prereqsMet;
          }
          
          // If no prerequisites, the equivalent course is available
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
  try {
    const pendingActions = await OfflineStorage.getPendingActions();
    
    if (pendingActions.length === 0) {
      return { success: true, message: 'No pending actions to sync' };
    }
    
    const batch = writeBatch(db);
    let syncedCount = 0;
    
    for (const action of pendingActions) {
      try {
        switch (action.type) {
          case 'CREATE_CURRICULUM':
            const curriculumRef = doc(collection(db, 'curriculums'));
            batch.set(curriculumRef, action.data);
            syncedCount++;
            break;
            
          case 'UPDATE_CURRICULUM':
            const curriculumUpdateRef = doc(db, 'curriculums', action.data.id);
            batch.update(curriculumUpdateRef, action.data.updates);
            syncedCount++;
            break;
            
          case 'DELETE_CURRICULUM':
            const curriculumDeleteRef = doc(db, 'curriculums', action.data.id);
            batch.delete(curriculumDeleteRef);
            syncedCount++;
            break;
            
          case 'ADD_COURSE':
            const courseRef = doc(collection(db, 'courses'));
            batch.set(courseRef, action.data);
            syncedCount++;
            break;
            
          case 'ADD_STUDENT':
            const studentRef = doc(collection(db, 'students'));
            batch.set(studentRef, action.data);
            syncedCount++;
            break;
            
          case 'UPDATE_STUDENT_PROGRESS':
            // Handle student progress update
            syncedCount++;
            break;
            
          default:
            console.warn('Unknown action type:', action.type);
        }
      } catch (error) {
        console.error('Error syncing action:', action, error);
      }
    }
    
    await batch.commit();
    await OfflineStorage.clearPendingActions();
    await OfflineStorage.updateLastSync();
    
    return { 
      success: true, 
      message: `Successfully synced ${syncedCount} actions`,
      syncedCount 
    };
  } catch (error) {
    console.error('Error syncing offline data:', error);
    return { success: false, error: error.message };
  }
};

// Export the offline storage service
export { OfflineStorage }; 