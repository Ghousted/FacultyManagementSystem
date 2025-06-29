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
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
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
      createdAt: new Date()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getCoursesByCurriculum = async (curriculumId) => {
  try {
    const q = query(
      collection(db, 'courses'), 
      where('curriculumId', '==', curriculumId),
      orderBy('yearLevel'),
      orderBy('semester')
    );
    const querySnapshot = await getDocs(q);
    const courses = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return { success: true, data: courses };
  } catch (error) {
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
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
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
      updatedAt: new Date()
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
    
    // Get curriculum courses
    const coursesResult = await getCoursesByCurriculum(studentData.curriculumId);
    if (!coursesResult.success) {
      return coursesResult;
    }
    
    const courses = coursesResult.data;
    
    // Process each course to determine status
    const processedCourses = courses.map(course => {
      const isCompleted = completedCourses.includes(course.courseCode);
      const prerequisitesMet = course.prerequisites.every(prereq => 
        completedCourses.includes(prereq)
      );
      
      let status = 'not-taken';
      if (isCompleted) {
        status = 'completed';
      } else if (!prerequisitesMet && course.prerequisites.length > 0) {
        status = 'blocked';
      } else {
        status = 'available';
      }
      
      return {
        ...course,
        status,
        isCompleted,
        prerequisitesMet
      };
    });
    
    return { 
      success: true, 
      data: {
        student: studentData,
        courses: processedCourses
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}; 