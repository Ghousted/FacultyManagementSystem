import { useState, useEffect } from 'react';
import { getStudents, getStudentCurriculumStatus, getCoursesByCurriculum, getAllCourses } from '../../models/curriculumModels';
import { useAuth } from '../../contexts/AuthContext';

const CurriculumCheckerMain = ({ onBack }) => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentCurriculum, setStudentCurriculum] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [studentCourses, setStudentCourses] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [expandedYears, setExpandedYears] = useState({ 1: true, 2: true, 3: true, 4: true });
  const [showEquivalentCourses, setShowEquivalentCourses] = useState(false);
  const [studentView, setStudentView] = useState('grid'); // 'grid' | 'list'

  useEffect(() => {
    if (currentUser) {
      loadStudents();
      loadAllCourses();
    }
  }, [currentUser]);

  useEffect(() => {
    // Filter students based on search term and year level or irregular status
    let filtered;
    if (tabValue === 4) {
      filtered = students.filter(student => student.isIrregular);
    } else {
      filtered = students.filter(student => student.yearLevel === (tabValue + 1) && !student.isIrregular);
    }
    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredStudents(filtered);
  }, [students, searchTerm, tabValue]);

  const loadStudents = async () => {
    if (!currentUser) {
      setError('Please sign in to access student data');
      return;
    }
    
    setLoading(true);
    setError('');
    const result = await getStudents();
    if (result.success) {
      setStudents(result.data);
      if (result.offline) {
        console.log('Loaded students from offline storage');
      }
      // Load courses for the first student to have course data available
      if (result.data.length > 0) {
        await loadStudentCourses(result.data[0].curriculumId);
      }
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const loadStudentCourses = async (curriculumId) => {
    if (!curriculumId) return;
    
    const result = await getCoursesByCurriculum(curriculumId);
    if (result.success) {
      setStudentCourses(result.data);
      if (result.offline) {
        console.log('Loaded student courses from offline storage');
      }
    }
  };

  const loadAllCourses = async () => {
    const result = await getAllCourses();
    if (result.success) setAllCourses(result.data);
  };

  const handleStudentSelect = async (student) => {
    setSelectedStudent(student);
    setTabValue(student.isIrregular ? 4 : student.yearLevel - 1);
    setLoading(true);
    
    const result = await getStudentCurriculumStatus(student.id);
    if (result.success) {
      setStudentCurriculum(result.data);
      // Load courses for the selected student's curriculum
      loadStudentCourses(student.curriculumId);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleCheckCurriculum = async () => {
    if (!currentUser) {
      setError('Please sign in to check curriculum status');
      return;
    }
    
    if (!selectedStudent) {
      setError('Please select a student first');
      return;
    }

    setLoading(true);
    setError('');
    const result = await getStudentCurriculumStatus(selectedStudent.id);
    if (result.success) {
      setStudentCurriculum(result.data);
      setSuccess('Curriculum status loaded successfully!');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'blocked':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'available':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'incomplete':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status, course, student) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'blocked':
        // Check if any prerequisites are failed or incomplete
        const hasFailedOrIncompletePrereqs = course.prerequisites.some(prereq => 
          student.completedCourses?.includes(prereq) && 
          (isCourseFailed(student, prereq) || isCourseIncomplete(student, prereq))
        );
        return hasFailedOrIncompletePrereqs ? 'Blocked (Incomplete or Failed)' : 'Blocked (Prerequisite not met)';
      case 'available':
        return 'Available';
      case 'failed':
        return 'Failed';
      case 'incomplete':
        return 'Incomplete';
      case 'unavailable':
        return 'Not Available';
      default:
        return 'Not Available';
    }
  };

  // Calculate Dean's Lister eligibility for a semester
  const calculateDeansListerEligibility = (student, semester, year) => {
    if (!student || !student.grades) return false;
    
    // Get courses for the specific semester and year
    const semesterCourses = studentCourses
      ?.filter(course => course.yearLevel === year && course.semester === semester)
      .map(course => course.courseCode) || [];
    
    // Get grades for those courses
    const semesterGrades = semesterCourses
      .map(courseCode => student.grades[courseCode])
      .filter(grade => grade !== undefined && grade !== null && grade !== '' && grade !== 'INC' && grade !== 'CRED');
    
    if (semesterGrades.length === 0) return false;
    
    // Check if no grades are higher than 2.1 (excluding 5.0 and INC)
    return semesterGrades.every(grade => {
      const numGrade = parseFloat(grade);
      return numGrade <= 2.1;
    });
  };

  // Calculate Scholarship eligibility for both semesters
  const calculateScholarshipEligibility = (student, year) => {
    if (!student || !student.grades) return { eligible: false, percentage: 0 };
    
    // Get courses for the specific year
    const yearCourses = studentCourses
      ?.filter(course => course.yearLevel === year)
      .map(course => course.courseCode) || [];
    
    // Get grades for those courses
    const yearGrades = yearCourses
      .map(courseCode => student.grades[courseCode])
      .filter(grade => grade !== undefined && grade !== null && grade !== '' && grade !== 'INC' && grade !== 'CRED');
    
    if (yearGrades.length === 0) return { eligible: false, percentage: 0 };
    
    const maxGrade = Math.max(...yearGrades.map(grade => parseFloat(grade)));
    
    if (maxGrade <= 1.5) {
      return { eligible: true, percentage: 100 };
    } else if (maxGrade <= 1.7) {
      return { eligible: true, percentage: 50 };
    } else {
      return { eligible: false, percentage: 0 };
    }
  };

  // Check if a course is failed (grade 5.0 or above)
  const isCourseFailed = (student, courseCode) => {
    if (!student || !student.grades) return false;
    const grade = student.grades[courseCode];
    return grade && parseFloat(grade) >= 5.0;
  };

  // Check if a course is incomplete
  const isCourseIncomplete = (student, courseCode) => {
    if (!student || !student.grades) return false;
    const grade = student.grades[courseCode];
    return grade === 'INC';
  };

  // Check if a course is credited
  const isCourseCredited = (student, courseCode) => {
    if (!student || !student.grades) return false;
    const grade = student.grades[courseCode];
    return grade === 'CRED';
  };

  // Helper: For irregular students, process equivalents
  const getAvailableCoursesForIrregular = (student, curriculumCourses) => {
    if (!student?.isIrregular) return curriculumCourses;
    
    // Map: equivalentSubjectId -> all courses with that id
    const equivMap = {};
    allCourses.forEach(course => {
      if (course.equivalentSubjectId) {
        if (!equivMap[course.equivalentSubjectId]) equivMap[course.equivalentSubjectId] = [];
        equivMap[course.equivalentSubjectId].push(course);
      }
    });
    
    // For each course in the student's curriculum, check equivalents
    return curriculumCourses.map(course => {
      if (!course.equivalentSubjectId) return course;
      const equivalents = equivMap[course.equivalentSubjectId] || [];
      // If any equivalent is available, mark as available
      const anyAvailable = equivalents.some(eq => eq.isAvailable !== false);
      // If the course is already completed/failed, keep its status
      if (course.status === 'completed' || course.status === 'failed') return course;
      return {
        ...course,
        status: anyAvailable ? 'available' : course.status
      };
    });
  };

  // Helper: Get equivalent courses from other curriculums for irregular students
  const getEquivalentCoursesFromOtherCurriculums = (student, curriculumCourses) => {
    if (!student?.isIrregular) return [];
    
    const equivalentCourses = [];
    const studentCurriculumIds = new Set([student.curriculumId]);
    
    // Helper function to check if a course meets prerequisites
    const isPrerequisiteMet = (courseCode) => {
      return student.completedCourses?.includes(courseCode) && 
             !isCourseFailed(student, courseCode) && 
             !isCourseIncomplete(student, courseCode);
    };
    
    // Get all courses that have equivalentSubjectId and are available
    allCourses.forEach(course => {
      if (course.equivalentSubjectId && course.isAvailable !== false) {
        // Check if this course is equivalent to any course in the student's curriculum
        const isEquivalentToStudentCourse = curriculumCourses.some(studentCourse => 
          studentCourse.equivalentSubjectId === course.equivalentSubjectId
        );
        
        // Only include courses from different curriculums that are equivalent to student's courses
        if (isEquivalentToStudentCourse && !studentCurriculumIds.has(course.curriculumId)) {
          // Check if the student meets the prerequisites for this equivalent course
          let meetsPrerequisites = true;
          if (course.prerequisites && course.prerequisites.length > 0) {
            meetsPrerequisites = course.prerequisites.every(isPrerequisiteMet);
          }
          
          // Only include if prerequisites are met
          if (meetsPrerequisites) {
            equivalentCourses.push({
              ...course,
              isEquivalentCourse: true,
              originalCourseCode: curriculumCourses.find(sc => 
                sc.equivalentSubjectId === course.equivalentSubjectId
              )?.courseCode
            });
          }
        }
      }
    });
    
    return equivalentCourses;
  };

  const renderStudentList = () => (
    <div className="">
      <div className=" bg-white text-black p-6 rounded-2xl mb-10 flex items-center justify-between border border-gray-300 shadow-lg">
        <div className="flex items-center gap-6">
          <button
            onClick={onBack}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-700"
          >
            Back
          </button>
         <div>
           <h5 className="text-2xl font-bold text-blue-600">Curriculum Checker</h5>
            <p className="text-gray-600">Select a student to check their curriculum status</p>
         </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex border-b border-gray-200">
          {[1, 2, 3, 4].map(year => (
            <button
              key={year}
              className={`px-4 py-2 ${tabValue === year - 1 ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
              onClick={() => setTabValue(year - 1)}
            >
              {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year
            </button>
          ))}
          <button
            className={`px-4 py-2 ${tabValue === 4 ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
            onClick={() => setTabValue(4)}
          >
            Irregular Students
          </button>
        </div>
      </div>

      {/* Search + View Toggle */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="w-full sm:max-w-90">
          <label className="sr-only" htmlFor="student-search">Search students</label>
          <div className="relative">
            <input
              id="student-search"
              type="text"
              placeholder="Search students by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full sm:w-90 border border-gray-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={() => setStudentView('grid')}
            className={`px-3 py-1.5 rounded-lg border text-sm flex items-center justify-center ${studentView === 'grid' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            aria-pressed={studentView === 'grid'}
            aria-label="Grid view"
            title="Grid view"
          >
            <i className="bi bi-grid text-base"></i>
          </button>
          <button
            type="button"
            onClick={() => setStudentView('list')}
            className={`px-3 py-1.5 rounded-lg border text-sm flex items-center justify-center ${studentView === 'list' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            aria-pressed={studentView === 'list'}
            aria-label="List view"
            title="List view"
          >
            <i className="bi bi-list text-lg"></i>
          </button>
        </div>
      </div>

      {studentView === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {filteredStudents.map((student) => (
            <div
              key={student.id}
              className="cursor-pointer transition-all duration-300 border border-gray-300 rounded-xl bg-white hover:shadow-lg hover:border-blue-500 p-6"
              onClick={() => handleStudentSelect(student)}
            >
              <div className="flex items-center gap-2 mb-2">
                <h6 className="text-lg font-bold text-blue-600">{student.name}</h6>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                {student.yearLevel === 1 ? '1st' : student.yearLevel === 2 ? '2nd' : student.yearLevel === 3 ? '3rd' : '4th'} Year
                {' • '}{student.completedCourses?.length || 0} courses completed
              </p>
              <div className="flex gap-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  {student.completedCourses?.length || 0} courses completed
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-300 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-300">Name</th>
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-300">Year</th>
                <th className="px-4 py-2 text-left font-semibold border-b border-gray-300">Completed</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr
                  key={student.id}
                  onClick={() => handleStudentSelect(student)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-2 border-b border-gray-300 text-blue-700 font-medium">{student.name}</td>
                  <td className="px-4 py-2 border-b border-gray-300">
                    {student.yearLevel === 1 ? '1st' : student.yearLevel === 2 ? '2nd' : student.yearLevel === 3 ? '3rd' : '4th'} Year
                  </td>
                  <td className="px-4 py-2 border-b border-gray-300">{student.completedCourses?.length || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredStudents.length === 0 && searchTerm && (
        <div className="text-center py-16">
          <h6 className="text-gray-600 mb-2">
            No students found matching "{searchTerm}" in {tabValue === 4 ? 'Irregular Students' : tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year
          </h6>
          <p className="text-gray-600 text-sm">Try adjusting your search terms</p>
        </div>
      )}

      {filteredStudents.length === 0 && !searchTerm && (
        <div className="text-center py-16">
          <h6 className="text-gray-600 mb-2">
            {tabValue === 4 ? 'No irregular students' : `No students in ${tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year`}
          </h6>
          <p className="text-gray-600 text-sm">Add students in Student Management to get started</p>
        </div>
      )}
    </div>
  );

  const renderCurriculumView = () => {
    if (!studentCurriculum) return null;

    const { student, courses } = studentCurriculum;
    // Use processed courses for irregulars
    const processedCourses = getAvailableCoursesForIrregular(student, courses);

    return (
      <div>
        <div className=" bg-white text-black p-6 rounded-2xl mb-10 flex items-center justify-between border border-gray-300 shadow-lg">
          <div className="flex items-center gap-6">
            <button
              onClick={() => {
                setSelectedStudent(null);
                setTabValue(selectedStudent.isIrregular ? 4 : selectedStudent.yearLevel - 1);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              aria-label="Back"
            >
              <span className="hidden sm:inline text-sm font-medium">Back</span>
            </button>
            <div>
              <div className="text-2xl font-bold text-blue-600">Curriculum Status</div>
              <div className="text-gray-600">{student.name}</div>
              <div className="text-gray-600">
                {student.yearLevel === 1 ? '1st' : student.yearLevel === 2 ? '2nd' : student.yearLevel === 3 ? '3rd' : '4th'} Year{student.isIrregular ? ' - Irregular' : ''} Student
              </div>
            </div>
          </div>
        </div>

        
        <p className="text-gray-600 mt-1">
          {student.yearLevel === 1 ? '1st' : student.yearLevel === 2 ? '2nd' : student.yearLevel === 3 ? '3rd' : '4th'} Year • {student.completedCourses?.length || 0} courses completed
        </p>

              <div className="mt-6 px-8 py-4 bg-white border border-gray-300 rounded-xl">
          <h4 className="font-semibold mb-3">Legend</h4>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center">
              <span className="px-2 py-0.5 text-xs rounded-full border bg-green-100 text-green-800 border-green-300 mr-2">Completed</span>
              <span className="text-sm font-medium">Completed</span>
            </div>
            <div className="flex items-center">
              <span className="px-2 py-0.5 text-xs rounded-full border bg-blue-100 text-blue-800 border-blue-300 mr-2">Available</span>
              <span className="text-sm font-medium">Available</span>
            </div>
            <div className="flex items-center">
              <span className="px-2 py-0.5 text-xs rounded-full border bg-red-100 text-red-800 border-red-300 mr-2">Failed</span>
              <span className="text-sm font-medium">Failed (Grade 5.0+)</span>
            </div>
            <div className="flex items-center">
              <span className="px-2 py-0.5 text-xs rounded-full border bg-amber-100 text-amber-800 border-amber-300 mr-2">Incomplete</span>
              <span className="text-sm font-medium">Incomplete (Grade INC)</span>
            </div>
            <div className="flex items-center">
              <span className="px-2 py-0.5 text-xs rounded-full border bg-red-100 text-red-800 border-red-300 mr-2">Blocked</span>
              <span className="text-sm font-medium">Blocked (Prerequisite not met)</span>
            </div>
            <div className="flex items-center">
              <span className="px-2 py-0.5 text-xs rounded-full border bg-red-100 text-red-800 border-red-300 mr-2">Blocked</span>
              <span className="text-sm font-medium">Blocked (Incomplete or Failed)</span>
            </div>
            {student?.isIrregular && (
              <div className="flex items-center">
                <span className="px-2 py-0.5 text-xs rounded-full border border-amber-300 text-amber-700 bg-amber-50 mr-2">Equivalent</span>
                <span className="text-sm font-medium">Equivalent Course from Other Curriculum</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-6 space-y-4">
          {[1, 2, 3, 4].map(year => {
            const scholarshipEligibility = calculateScholarshipEligibility(student, year);
            const deansLister1stSem = calculateDeansListerEligibility(student, 1, year);
            const deansLister2ndSem = calculateDeansListerEligibility(student, 2, year);
            
            return (
              <div key={year} className="border bg-white border-gray-300 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }))}
                  className="w-full flex items-center justify-between bg-blue-500 hover:bg-blue-600 text-white px-4 py-3"
                >
                  <span className="text-lg font-semibold">{year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year</span>
                    <span className={`transition-transform text-lg ${expandedYears[year] ? 'rotate-180' : ''}`}>
                      <i className="bi bi-chevron-up"></i>
                    </span>
                </button>
                {expandedYears[year] && (
                  <div className="p-4">
                    <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <h4 className="font-semibold mb-2">Academic Eligibility Summary - {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year</h4>
                      <div className="flex flex-wrap gap-6">
                        <div>
                          <p className="text-sm text-gray-600">1st Semester Dean's Lister:</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full border ${deansLister1stSem ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                            {deansLister1stSem ? 'Eligible' : 'Not Eligible'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">2nd Semester Dean's Lister:</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full border ${deansLister2ndSem ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                            {deansLister2ndSem ? 'Eligible' : 'Not Eligible'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Scholarship Eligibility:</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full border ${scholarshipEligibility.eligible ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                            {scholarshipEligibility.eligible ? `${scholarshipEligibility.percentage}% Scholarship` : 'Not Eligible'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {[1, 2].map(semester => (
                      <div key={semester} className="mb-6">
                        <h5 className="text-blue-600 font-semibold mb-2">{semester === 1 ? '1st' : '2nd'} Semester</h5>
                        <div className="border border-gray-300 rounded-lg overflow-hidden">
                          <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left font-semibold px-4 py-2 border-b border-gray-300">Course Code</th>
                                <th className="text-left font-semibold px-4 py-2 border-b border-gray-300">Course Title</th>
                                <th className="text-left font-semibold px-4 py-2 border-b border-gray-300">Units</th>
                                <th className="text-left font-semibold px-4 py-2 border-b border-gray-300">Prerequisites</th>
                                <th className="text-left font-semibold px-4 py-2 border-b border-gray-300">Status</th>
                                <th className="text-left font-semibold px-4 py-2 border-b border-gray-300">Grade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {processedCourses
                                .filter(course => course.yearLevel === year && course.semester === semester)
                                .map((course) => {
                                  const failed = isCourseFailed(student, course.courseCode);
                                  const incomplete = isCourseIncomplete(student, course.courseCode);
                                  const rowBg = failed
                                    ? 'bg-red-50 hover:bg-red-100'
                                    : incomplete
                                    ? 'bg-amber-50 hover:bg-amber-100'
                                    : course.status === 'completed'
                                    ? 'bg-green-50 hover:bg-green-100'
                                    : course.status === 'blocked'
                                    ? 'bg-red-50 hover:bg-red-100'
                                    : 'hover:bg-gray-50';
                                  return (
                                    <tr key={course.id} className={`${rowBg} transition-colors`}>
                                      <td className="px-4 py-2 border-b border-gray-300">
                                        <span className="text-blue-700 font-semibold">{course.courseCode}</span>
                                      </td>
                                      <td className="px-4 py-2 border-b border-gray-300">{course.courseTitle}</td>
                                      <td className="px-4 py-2 border-b border-gray-300">{course.units}</td>
                                      <td className="px-4 py-2 border-b border-gray-300">
                                        {course.prerequisites.length > 0 ? (
                                          <div className="flex flex-wrap gap-1">
                                            {course.prerequisites.map(prereq => {
                                              const isPrereqMet = student.completedCourses?.includes(prereq) &&
                                                !isCourseFailed(student, prereq) &&
                                                !isCourseIncomplete(student, prereq);
                                              return (
                                                <span
                                                  key={prereq}
                                                  className={`px-2 py-0.5 text-xs rounded-full border ${isPrereqMet ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                                                >
                                                  {prereq}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <span className="text-gray-500">None</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 border-b border-gray-300">
                                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full border ${getStatusColor(course.status)}`}>
                                          {getStatusLabel(course.status, course, student)}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 border-b border-gray-300">
                                        {student.grades && student.grades[course.courseCode] ? (
                                          (() => {
                                            const val = student.grades[course.courseCode];
                                            const cls =
                                              val === 'INC' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                              val === 'CRED' ? 'bg-green-50 text-green-700 border-green-200' :
                                              parseFloat(val) >= 5.0 ? 'bg-red-50 text-red-700 border-red-200' :
                                              parseFloat(val) <= 2.1 ? 'bg-green-50 text-green-700 border-green-200' :
                                              parseFloat(val) <= 2.5 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                              'bg-red-50 text-red-700 border-red-200';
                                            return (
                                              <span className={`inline-block px-2 py-0.5 text-xs rounded-full border ${cls}`}>
                                                {val}
                                              </span>
                                            );
                                          })()
                                        ) : (
                                          <span className="text-gray-500">Not Graded</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {/* Available Courses */}
          <div className="border border-blue-500 rounded-xl mb-4">
            <div className="px-4 py-3 bg-blue-50 rounded-t-xl">
              <span className="text-lg font-bold text-blue-700">Available Courses This Term</span>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {processedCourses.filter(c => c.status === 'available').length === 0 ? (
                  <span className="text-gray-500 text-sm">No available courses for this term.</span>
                ) : (
                  processedCourses.filter(c => c.status === 'available').map(course => (
                    <span key={course.id} className="px-3 py-1 text-sm rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                      {course.courseCode} - {course.courseTitle}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Equivalent Courses from Other Curriculums (for irregular students only) */}
          {student.isIrregular && (
            <div className="border border-amber-500 rounded-lg">
              <button
                type="button"
                onClick={() => setShowEquivalentCourses(s => !s)}
                className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 hover:bg-amber-100"
              >
                <span className="text-lg font-bold text-amber-700">Equivalent Courses from Other Curriculums</span>
                <span className={`text-amber-700 transition-transform ${showEquivalentCourses ? 'rotate-180' : ''}`}>⌄</span>
              </button>
              {showEquivalentCourses && (
                <div className="p-4">
                  <p className="text-sm text-gray-600 mb-2">
                    As an irregular student, you can enroll in these equivalent courses from other curriculums:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const equivalentCourses = getEquivalentCoursesFromOtherCurriculums(student, processedCourses);
                      if (equivalentCourses.length === 0) {
                        return (
                          <span className="text-gray-500 text-sm">No equivalent courses available from other curriculums.</span>
                        );
                      }
                      return equivalentCourses.map(course => (
                        <span
                          key={course.id}
                          className="px-3 py-1 text-sm rounded-full border border-amber-300 text-amber-700 bg-amber-50"
                        >
                          {course.courseCode} - {course.courseTitle} (Equivalent to {course.originalCourseCode})
                        </span>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
  
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col">
      {!currentUser && (
        <div className="mx-3 mb-2 rounded border border-blue-200 bg-blue-50 text-blue-800 px-4 py-2 text-sm">
          Please sign in to access the Curriculum Checker
        </div>
      )}

      {error && (
        <div className="mx-3 mb-2 rounded border border-red-200 bg-red-50 text-red-800 px-4 py-2 text-sm">{error}</div>
      )}
      {success && (
        <div className="mx-3 mb-2 rounded border border-green-200 bg-green-50 text-green-800 px-4 py-2 text-sm">{success}</div>
      )}

      {currentUser ? (
        <div className="flex-1 pt-0 mt-3">
          {selectedStudent ? renderCurriculumView() : renderStudentList()}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="p-4 text-center border border-gray-200 ">
            <p className="text-gray-600">Sign in to access curriculum checking features</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CurriculumCheckerMain;