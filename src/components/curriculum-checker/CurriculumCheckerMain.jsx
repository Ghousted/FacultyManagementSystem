import { useState, useEffect, useMemo } from 'react';
import { getStudents, getStudentCurriculumStatus, getCoursesByCurriculum, getAllCourses, getCurriculums } from '../../models/curriculumModels';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, Search, ChevronUp, ChevronDown, ChevronsUpDown, ArrowBigLeft } from 'lucide-react';
import CurriculumPreview from './CurriculumPReview';

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [printOnlyOpen, setPrintOnlyOpen] = useState(false);
  const [expandedYears, setExpandedYears] = useState({ 1: true, 2: true, 3: true, 4: true });
  const [showEquivalentCourses, setShowEquivalentCourses] = useState(false);
  const [showAvailableCourses, setShowAvailableCourses] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [lastSelectedStudentId, setLastSelectedStudentId] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadStudents();
      loadAllCourses();
    }
  }, [currentUser]);

  useEffect(() => {
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

  // When returning to the student list, scroll the previously selected student into view
  useEffect(() => {
    if (!selectedStudent && lastSelectedStudentId) {
      setTimeout(() => {
        const el = document.getElementById(`student-row-${lastSelectedStudentId}`);
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  }, [selectedStudent, lastSelectedStudentId, tabValue]);

  useEffect(() => {
    const getCurrentScrollTop = () => {
      const rootElement = document.getElementById('root');
      const mainElement = document.querySelector('main');

      return Math.max(
        window.scrollY || 0,
        window.pageYOffset || 0,
        document.documentElement?.scrollTop || 0,
        document.body?.scrollTop || 0,
        rootElement?.scrollTop || 0,
        mainElement?.scrollTop || 0
      );
    };

    const handleScroll = () => {
      setShowScrollTop(getCurrentScrollTop() > 180);
    };

    const rootElement = document.getElementById('root');
    const mainElement = document.querySelector('main');

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });

    if (rootElement) {
      rootElement.addEventListener('scroll', handleScroll, { passive: true });
    }

    if (mainElement) {
      mainElement.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
      if (rootElement) {
        rootElement.removeEventListener('scroll', handleScroll);
      }
      if (mainElement) {
        mainElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedStudents = useMemo(() => {
    let sortableStudents = [...filteredStudents];
    if (sortConfig.key) {
      sortableStudents.sort((a, b) => {
        if (sortConfig.key === 'completedCourses') {
          const aValue = a.completedCourses?.length || 0;
          const bValue = b.completedCourses?.length || 0;
          if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        } else {
          if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        }
      });
    }
    return sortableStudents;
  }, [filteredStudents, sortConfig]);

  const loadStudents = async () => {
    if (!currentUser) {
      setError('Please sign in to access student data');
      return;
    }

    setLoading(true);
    setError('');
    const result = await getStudents();
    if (result.success) {
      let studentsWithCurriculum = result.data;

      try {
        const curResult = await getCurriculums();
        if (curResult.success) {
          const curMap = new Map(curResult.data.map(c => [c.id, c.name]));
          studentsWithCurriculum = result.data.map(s => ({
            ...s,
            curriculumName: curMap.get(s.curriculumId) || s.curriculumName || 'Not Set'
          }));
        }
      } catch (e) {
        // ignore curriculum name lookup failures
      }

      setStudents(studentsWithCurriculum);
      if (result.offline) {
        console.log('Loaded students from offline storage');
      }
      if (studentsWithCurriculum.length > 0) {
        await loadStudentCourses(studentsWithCurriculum[0].curriculumId);
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

  const handlePrintStudentPDF = (student, studentCurriculum, summerCourses = []) => {
    if (!student || !studentCurriculum) return;
    const firstYearCourses = studentCurriculum.courses.filter(c => c.yearLevel === 1);
    const firstYearSummerCourses = summerCourses.filter(c => c.yearLevel === 1 && c.semester === 3);
    setPreviewTarget({
      student,
      studentCurriculum: {
        ...studentCurriculum,
        courses: firstYearCourses
      },
      summerCourses: firstYearSummerCourses
    });
    setPrintOnlyOpen(true);
  };

  const printPreview = () => {
    if (!previewTarget) return;
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.error('Print failed', e);
      alert('Print failed. Your browser may block programmatic printing.');
    }
    setPreviewOpen(false);
    setPreviewTarget(null);
  };

  useEffect(() => {
    if (!printOnlyOpen) return;
    const t = setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        // ignore
      }
      setPrintOnlyOpen(false);
      setPreviewTarget(null);
    }, 300);
    return () => clearTimeout(t);
  }, [printOnlyOpen]);

  const handleStudentSelect = async (student) => {
    setSelectedStudent(student);
    setLastSelectedStudentId(student.id);
    setTabValue(student.isIrregular ? 4 : student.yearLevel - 1);
    setLoading(true);

    const result = await getStudentCurriculumStatus(student.id);
    if (result.success) {
      setStudentCurriculum(result.data);
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

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (document.documentElement) {
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (document.body) {
      document.body.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const rootElement = document.getElementById('root');
    if (rootElement && typeof rootElement.scrollTo === 'function') {
      rootElement.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const mainElement = document.querySelector('main');
    if (mainElement && typeof mainElement.scrollTo === 'function') {
      mainElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
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

  const calculateDeansListerEligibility = (student, semester, year) => {
    if (!student || !student.grades) return false;

    const semesterCourses = studentCourses
      ?.filter(course => course.yearLevel === year && course.semester === semester)
      ?.map(course => course.courseCode) || [];

    const semesterGrades = semesterCourses
      .map(courseCode => student.grades[courseCode])
      .filter(grade => grade !== undefined && grade !== null && grade !== '' && grade !== 'INC' && grade !== 'CRED');

    if (semesterGrades.length === 0) return false;

    return semesterGrades.every(grade => {
      const numGrade = parseFloat(grade);
      return numGrade <= 2.1;
    });
  };

  const calculateScholarshipEligibility = (student, year) => {
    if (!student || !student.grades) return { eligible: false, percentage: 0 };

    const yearCourses = studentCourses
      ?.filter(course => course.yearLevel === year)
      ?.map(course => course.courseCode) || [];

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

  const isCourseFailed = (student, courseCode) => {
    if (!student || !student.grades) return false;
    const grade = student.grades[courseCode];
    return grade && parseFloat(grade) >= 5.0;
  };

  const isCourseIncomplete = (student, courseCode) => {
    if (!student || !student.grades) return false;
    const grade = student.grades[courseCode];
    return grade === 'INC';
  };

  const isCourseCredited = (student, courseCode) => {
    if (!student || !student.grades) return false;
    const grade = student.grades[courseCode];
    return grade === 'CRED';
  };

  const getAvailableCoursesForIrregular = (student, curriculumCourses) => {
    if (!student?.isIrregular) return curriculumCourses;

    const equivMap = {};
    allCourses.forEach(course => {
      if (course.equivalentSubjectId) {
        if (!equivMap[course.equivalentSubjectId]) equivMap[course.equivalentSubjectId] = [];
        equivMap[course.equivalentSubjectId].push(course);
      }
    });

    return curriculumCourses.map(course => {
      if (!course.equivalentSubjectId) return course;
      const equivalents = equivMap[course.equivalentSubjectId] || [];
      const anyAvailable = equivalents.some(eq => eq.isAvailable !== false);
      if (course.status === 'completed' || course.status === 'failed') return course;
      return {
        ...course,
        status: anyAvailable ? 'available' : course.status
      };
    });
  };

  const getEquivalentCoursesFromOtherCurriculums = (student, curriculumCourses) => {
    if (!student?.isIrregular) return [];

    const equivalentCourses = [];
    const studentCurriculumIds = new Set([student.curriculumId]);

    const isPrerequisiteMet = (courseCode) => {
      return student.completedCourses?.includes(courseCode) &&
             !isCourseFailed(student, courseCode) &&
             !isCourseIncomplete(student, courseCode);
    };

    allCourses.forEach(course => {
      if (course.equivalentSubjectId && course.isAvailable !== false) {
        const isEquivalentToStudentCourse = curriculumCourses.some(studentCourse =>
          studentCourse.equivalentSubjectId === course.equivalentSubjectId
        );

        if (isEquivalentToStudentCourse && !studentCurriculumIds.has(course.curriculumId)) {
          let meetsPrerequisites = true;
          if (course.prerequisites && course.prerequisites.length > 0) {
            meetsPrerequisites = course.prerequisites.every(isPrerequisiteMet);
          }

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
      <div className="bg-white text-black p-6 rounded-2xl mb-6 flex items-center justify-between border border-gray-300 shadow-lg">
        <div className="flex items-center gap-6">
          <button
            onClick={onBack}
            className="group cursor-pointer flex items-center gap-2 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white transition-transform"
          >
            <ArrowBigLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <h5 className="text-2xl font-bold text-blue-600">Curriculum Checker</h5>
            <p className="text-gray-600">Select a student to check their curriculum status</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2 text-sm">
          {[1, 2, 3, 4].map(year => (
            <button
              key={year}
                className={`px-3 py-1 font-semibold rounded-full shadow-md border transition-all flex items-center gap-1 text-sm cursor-pointer 
                  ${tabValue === year - 1
                    ? 'bg-blue-600 text-white border-blue-700 scale-105'
                    : 'bg-white text-blue-700 hover:bg-blue-100 border-gray-300'
                  }`}
              onClick={() => setTabValue(year - 1)}
            >
              {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year
            </button>
          ))}
          <button
            className={`px-3 py-1 font-semibold rounded-full shadow-md border transition-all flex items-center gap-1 text-sm cursor-pointer 
              ${tabValue === 4 
                ? 'bg-blue-600 text-white border-blue-700 scale-105'
                : 'bg-white text-blue-700 hover:bg-blue-100 border-gray-300'
              }`}
            onClick={() => setTabValue(4)}
          >
            Irregular Students
          </button>
        </div>
        <div className="w-full sm:max-w-90">
          <label className="sr-only" htmlFor="student-search">
            Search students
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              id="student-search"
              type="text"
              placeholder="Search students by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-sm sm:w-90 border border-gray-300 rounded-full pl-9 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-300 bg-white mb-4">
        <table className="min-w-full text-sm">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th
                className="px-2 py-1.5 text-left font-semibold border-b border-gray-300 w-[12%] cursor-pointer"
                onClick={() => requestSort('studentNumber')}
              >
                <div className="flex items-center">
                  Student No.
                  {sortConfig.key === 'studentNumber' ? (
                    sortConfig.direction === 'asc' ? (
                      <ChevronUp className="w-4 h-4 ml-1" />
                    ) : (
                      <ChevronDown className="w-4 h-4 ml-1" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-4 h-4 ml-1" />
                  )}
                </div>
              </th>
              <th
                className="px-2 py-1.5 text-left font-semibold border-b border-gray-300 w-[20%] cursor-pointer"
                onClick={() => requestSort('name')}
              >
                <div className="flex items-center">
                  Name
                  {sortConfig.key === 'name' ? (
                    sortConfig.direction === 'asc' ? (
                      <ChevronUp className="w-4 h-4 ml-1" />
                    ) : (
                      <ChevronDown className="w-4 h-4 ml-1" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-4 h-4 ml-1" />
                  )}
                </div>
              </th>
              <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-300 w-[18%]">Email</th>
              <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-300 w-[10%]">Contact No.</th>
              <th
                className="px-2 py-1.5 text-left font-semibold border-b border-gray-300 w-[20%] cursor-pointer"
                onClick={() => requestSort('curriculumName')}
              >
                <div className="flex items-center">
                  Curriculum
                  {sortConfig.key === 'curriculumName' ? (
                    sortConfig.direction === 'asc' ? (
                      <ChevronUp className="w-4 h-4 ml-1" />
                    ) : (
                      <ChevronDown className="w-4 h-4 ml-1" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-4 h-4 ml-1" />
                  )}
                </div>
              </th>
              <th
                className="px-2 py-1.5 text-left font-semibold border-b border-gray-300 w-[15%] cursor-pointer"
                onClick={() => requestSort('completedCourses')}
              >
                <div className="flex items-center">
                  Completed Courses
                  {sortConfig.key === 'completedCourses' ? (
                    sortConfig.direction === 'asc' ? (
                      <ChevronUp className="w-4 h-4 ml-1" />
                    ) : (
                      <ChevronDown className="w-4 h-4 ml-1" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-4 h-4 ml-1" />
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedStudents.map((student) => (
             <tr
              id={`student-row-${student.id}`}
              key={student.id}
              onClick={() => handleStudentSelect(student)}
              className="odd:bg-white even:bg-gray-100 hover:bg-gray-200 cursor-pointer"
            >
                <td className="px-2 py-1.5 border-b border-gray-300 w-[12%]">{student.studentNumber}</td>
                <td className="px-2 py-1.5 border-b border-gray-300 w-[20%]">{student.name}</td>
                <td className="px-2 py-1.5 border-b border-gray-300 w-[18%]">{student.email}</td>
                <td className="px-2 py-1.5 border-b border-gray-300 w-[10%]">{student.contactNumber}</td>
                <td className="px-2 py-1.5 border-b border-gray-300 w-[20%]">
                  <span>{student.curriculumName || student.curriculumId || 'Not Set'}</span>
                </td>
                <td className="px-2 py-1.5 border-b border-gray-300 w-[15%]">{student.completedCourses?.length || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
    const processedCourses = getAvailableCoursesForIrregular(student, courses);

    return (
      <div>
        <div className="bg-white text-black p-6 rounded-2xl mb-6 flex items-center justify-between border border-gray-300 shadow-lg">
          <div className="flex items-center gap-6">
            <button
              onClick={() => {
                setSelectedStudent(null);
                setTabValue(selectedStudent.isIrregular ? 4 : selectedStudent.yearLevel - 1);
              }}
            className="group cursor-pointer flex items-center gap-2 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white transition-transform"
              aria-label="Back"
            >
              <ArrowBigLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="text-2xl font-bold text-blue-600">Curriculum Status</div>
              <div className="text-gray-600">{student.name}</div>
              <div className="text-gray-600">
                {student.yearLevel === 1 ? '1st' : student.yearLevel === 2 ? '2nd' : student.yearLevel === 3 ? '3rd' : '4th'} Year{student.isIrregular ? ' - Irregular' : ''} Student
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePrintStudentPDF(
                student,
                studentCurriculum,
                processedCourses.filter(c => c.yearLevel === 3 && c.semester === 3)
              )}
              className="inline-flex items-center text-sm gap-2 bg-green-600 cursor-pointer text-white px-2 py-1.5 rounded-full hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300"
            >
              <Printer className="w-4 h-4" />
              <span>Print Curriculum</span>
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2 mb-4">
          {[1, 2, 3, 4].map(year => {
            const scholarshipEligibility = calculateScholarshipEligibility(student, year);
            const deansLister1stSem = calculateDeansListerEligibility(student, 1, year);
            const deansLister2ndSem = calculateDeansListerEligibility(student, 2, year);
            const yearLabel = year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th';
            const hasSummer = processedCourses.some(
              (course) => course.yearLevel === year && course.semester === 3
            );

            return (
              <div key={year} className="border bg-white border-gray-300 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }))}
                  className="w-full flex items-center justify-between bg-blue-500 hover:bg-blue-600 cursor-pointer text-white px-3 py-1.5"
                >
                  <span className="text-lg font-semibold">{year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year</span>
                  <span className={`transition-transform text-lg ${expandedYears[year] ? 'rotate-180' : ''}`}>
                    <ChevronUp className="w-5 h-5" />
                  </span>
                </button>
                {expandedYears[year] && (
                  <div className="py-6 px-10">
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm">Academic Eligibility Summary</h4>
                      <div className="flex flex-wrap gap-6">
                        <div>
                          <p className="text-xs text-gray-600">1st Semester Dean's Lister:</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full border ${deansLister1stSem ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                            {deansLister1stSem ? 'Eligible' : 'Not Eligible'}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">2nd Semester Dean's Lister:</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full border ${deansLister2ndSem ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                            {deansLister2ndSem ? 'Eligible' : 'Not Eligible'}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Scholarship Eligibility:</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full border ${scholarshipEligibility.eligible ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                            {scholarshipEligibility.eligible ? `${scholarshipEligibility.percentage}% Scholarship` : 'Not Eligible'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {[1, 2, hasSummer ? 3 : null].filter(Boolean).map(semester => (
                      <div className='' key={semester}>
                        <div className="mb-3">
                          <h5 className="text-blue-600 font-semibold mb-2">
                            {semester === 1
                              ? '1st'
                              : semester === 2
                              ? '2nd'
                              : `Summer (${yearLabel} Year)`}{' '}
                            Semester
                          </h5>
                          <div className="border border-gray-300 rounded-lg overflow-hidden">
                            <table className="min-w-full text-xs">
                              <thead className="bg-blue-100 text-blue-800">
                                <tr>
                                  <th className="text-left font-semibold px-2 py-1.5 border-b border-gray-300 w-[10%]">Code</th>
                                  <th className="text-left font-semibold px-2 py-1.5 border-b border-gray-300 w-[30%]">Description</th>
                                  <th className="text-left font-semibold px-2 py-1.5 border-b border-gray-300 w-[10%]">Units</th>
                                  <th className="text-left font-semibold px-2 py-1.5 border-b border-gray-300 w-[20%]">Prerequisites</th>
                                  <th className="text-left font-semibold px-2 py-1.5 border-b border-gray-300 w-[15%]">Status</th>
                                  <th className="text-left font-semibold px-2 py-1.5 border-b border-gray-300 w-[15%]">Grade</th>
                                </tr>
                              </thead>
                              <tbody>
                                {processedCourses
                                  .filter(course => course.yearLevel === year && course.semester === semester)
                                  .map((course) => {
                                    const failed = isCourseFailed(student, course.courseCode);
                                    const incomplete = isCourseIncomplete(student, course.courseCode);
                                    return (
                                      <tr key={course.id} className="transition-colors">
                                        <td className="px-2 py-1.5 border-b border-gray-300 w-[10%]">
                                          <span className="text-blue-700 font-semibold">{course.courseCode}</span>
                                        </td>
                                        <td className="px-2 py-1.5 border-b border-gray-300 w-[30%]">{course.courseTitle}</td>
                                        <td className="px-2 py-1.5 border-b border-gray-300 w-[10%]">{course.units}</td>
                                        <td className="px-2 py-1.5 border-b border-gray-300 w-[20%]">
                                          {course.prerequisites.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                              {course.prerequisites.map(prereq => {
                                                const isPrereqMet = student.completedCourses?.includes(prereq) &&
                                                  !isCourseFailed(student, prereq) &&
                                                  !isCourseIncomplete(student, prereq);
                                                return (
                                                  <span
                                                    key={prereq}
                                                    className={`px-2 py-0.5 text-xs rounded-full border
                                                                ${isPrereqMet
                                                                  ? 'bg-green-50 text-green-700 border-green-200'
                                                                  : 'bg-red-50 text-red-700 border-red-200'
                                                                }`
                                                              }
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
                                        <td className="px-2 py-1.5 border-b border-gray-300 w-[15%]">
                                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full border ${getStatusColor(course.status)}`}>
                                            {getStatusLabel(course.status, course, student)}
                                          </span>
                                        </td>
                                        <td className="px-2 py-1.5 border-b border-gray-300 w-[15%]">
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col">
      {!currentUser && (
        <div className="mx-3 mb-2 rounded border border-blue-200 bg-blue-50 text-blue-800 px-2 py-1.5 text-sm">
          Please sign in to access the Curriculum Checker
        </div>
      )}

      {error && (
        <div className="mx-3 mb-2 rounded border border-red-200 bg-red-50 text-red-800 px-2 py-1.5 text-sm">{error}</div>
      )}
      {success && (
        <div className="mx-3 mb-2 rounded border border-green-200 bg-green-50 text-green-800 px-2 py-1.5 text-sm">{success}</div>
      )}

      {currentUser ? (
        <div className="flex-1 pt-0 mt-3">
          {selectedStudent ? renderCurriculumView() : renderStudentList()}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="p-4 text-center border border-gray-200">
            <p className="text-gray-600">Sign in to access curriculum checking features</p>
          </div>
        </div>
      )}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white max-w-4xl w-full max-h-[90vh] overflow-auto rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold">Print Preview - {previewTarget?.student?.name}</h3>
              <div className="flex gap-2">
                <button onClick={printPreview} className="bg-green-600 text-white px-3 py-1 rounded">Print</button>
                <button onClick={() => { setPreviewOpen(false); setPreviewTarget(null); }} className="bg-gray-200 px-3 py-1 rounded">Close</button>
              </div>
            </div>
            <div className="prose max-w-none">
              {previewTarget ? (
                <CurriculumPreview
                  curriculumId={previewTarget.studentCurriculum?.curriculumId || previewTarget.student?.curriculumId}
                  student={previewTarget.student}
                  summerCourses={previewTarget.summerCourses || []}
                />
              ) : (
                <div className="text-gray-600">No preview data available.</div>
              )}
            </div>
          </div>
        </div>
      )}
      {printOnlyOpen && previewTarget && (
        <div className="print-only-preview" aria-hidden>
          <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
            <CurriculumPreview
              curriculumId={previewTarget.studentCurriculum?.curriculumId || previewTarget.student?.curriculumId}
              student={previewTarget.student}
              summerCourses={previewTarget.summerCourses || []}
            />
          </div>
          <style>{`@media screen { .print-only-preview { display: none; } } @media print { body * { visibility: hidden !important; } .print-only-preview, .print-only-preview * { visibility: visible !important; } .print-only-preview { position: static !important; left: 0 !important; width: 100% !important; } }`}</style>
        </div>
      )}

      {showScrollTop && (
        <button
          type="button"
          onClick={handleScrollToTop}
          className="fixed bottom-6 right-6 cursor-pointer z-40 rounded-full bg-blue-600 text-white p-3 shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
          aria-label="Scroll to top"
          title="Scroll to top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default CurriculumCheckerMain;