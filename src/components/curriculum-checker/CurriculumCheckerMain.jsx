import { useState, useEffect, useMemo } from 'react';
import { getStudents, getStudentCurriculumStatus, getCoursesByCurriculum, getAllCourses, getCurriculums } from '../../models/curriculumModels';
import { useAuth } from '../../contexts/AuthContext';
import { Printer, Search, ChevronUp, ChevronDown, ChevronsUpDown, X, ArrowLeft, RefreshCcw, Folder} from 'lucide-react';
import CurriculumPreview from './CurriculumPReview';
import ViewArchivedClasses from './ViewArchivedClasses';

const CurriculumCheckerMain = () => {
    const [showArchivedPanel, setShowArchivedPanel] = useState(false);
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
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [expandedYears, setExpandedYears] = useState({ 1: true, 2: true, 3: true, 4: true });
  const [showEquivalentCourses, setShowEquivalentCourses] = useState(false);
  const [showAvailableCourses, setShowAvailableCourses] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedFolder, setSelectedFolder] = useState(null); // { year, block, isIrregular }
  const [lastSelectedStudentId, setLastSelectedStudentId] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectedYear, setSelectedYear] = useState(1);

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
    const availableSummerCourses = summerCourses.filter(c => c.semester === 3);
    setPreviewTarget({
      student,
      studentCurriculum: {
        ...studentCurriculum,
        courses: firstYearCourses
      },
      summerCourses: availableSummerCourses
    });    setPrintPreviewOpen(true);
  };

  const handleConfirmPrint = () => {
    setPrintPreviewOpen(false);
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
      
      {/* Archived Classes Panel */}
      {showArchivedPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="relative w-full max-w-5xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-300 p-4 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-blue-700">Archived Classes</h2>
              <button
                className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
                onClick={() => setShowArchivedPanel(false)}
              >
                Close
              </button>
            </div>
            <ViewArchivedClasses />
          </div>
        </div>
      )}

      <div className="mb-6 w-full">
        <div className="">
          <div className="flex-1">
            {/* Folder grid or selected folder card (left column) */}
            {!selectedFolder ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4  gap-4">
                {[1, 2, 3, 4].flatMap(year =>
                  Array.from(new Set(students.filter(s => !s.isIrregular && s.yearLevel === year).map(s => s.block || 'Not Set'))).map(block => {
                    const yearLabel = year === 1 ? '1st Year' : year === 2 ? '2nd Year' : year === 3 ? '3rd Year' : '4th Year';
                    const count = students.filter(s => !s.isIrregular && s.yearLevel === year && (s.block || 'Not Set') === block).length;
                    return (
                      <button
                        key={`${year}-${block}`}
                        onClick={() => setSelectedFolder({ year, block: block === 'Not Set' ? null : block, isIrregular: false })}
                        className="group relative cursor-pointer rounded-xl border border-gray-300 bg-white p-4 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <Folder className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-blue-800">{yearLabel} Block {block}</p>
                            <p className="mt-1 text-xs text-gray-500">{count} student{count !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}

                <button onClick={() => setSelectedFolder({ isIrregular: true })} className="group relative cursor-pointer rounded-xl border border-gray-300 bg-white p-4 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md">
                  <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Folder className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-blue-800">Irregular Students</p>
                      <p className="mt-1 text-xs text-gray-500">{students.filter(s => s.isIrregular).length} students</p>
                    </div>
                  </div>
                </button>
              </div>
            ) : (
              <div />
            )}
          </div>

          <div className="w-80">
            {selectedFolder && (
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => { loadStudents(); }}
                  title="Reload students"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 mr-2"
                >
                  <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <label className="sr-only" htmlFor="student-search">
                  Search students
                </label>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    id="student-search"
                    type="text"
                    placeholder="Search students by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* If a folder is selected render the students in that folder, otherwise render the main student table */}
      {selectedFolder ? (
        <div className="overflow-hidden rounded-lg border border-gray-300 bg-white mb-4">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-300 w-[12%]">Student No.</th>
                <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-300 w-[20%]">Name</th>
                <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-300 w-[18%]">Email</th>
                <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-300 w-[10%]">Contact No.</th>
                <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-300 w-[20%]">Curriculum</th>
                <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-300 w-[15%]">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // show 6 skeleton rows while loading
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-200 last:border-b-0 animate-pulse">
                    <td className="px-3 py-2 w-[12%]"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                    <td className="px-3 py-2 w-[20%]"><div className="h-4 bg-gray-200 rounded w-40" /></td>
                    <td className="px-3 py-2 w-[18%]"><div className="h-4 bg-gray-200 rounded w-36" /></td>
                    <td className="px-3 py-2 w-[10%]"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                    <td className="px-3 py-2 w-[20%]"><div className="h-4 bg-gray-200 rounded w-48" /></td>
                    <td className="px-3 py-2 text-cente w-[15%]"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                  </tr>
                ))
              ) : (
                students
                  .filter(s => selectedFolder.isIrregular ? s.isIrregular : (s.yearLevel === selectedFolder.year && (selectedFolder.block ? (s.block === selectedFolder.block) : true) && !s.isIrregular))
                  .map(student => (
                    <tr key={student.id} id={`student-row-${student.id}`} onClick={() => handleStudentSelect(student)} className={`border-b border-gray-300 last:border-b-0 odd:bg-white even:bg-gray-50 hover:bg-gray-100 cursor-pointer transition`}>
                      <td className="px-3 py-2 w-[12%]">{student.studentNumber}</td>
                      <td className="px-3 py-2 w-[20%]">{student.name}</td>
                      <td className="px-3 py-2 w-[18%]">{student.email}</td>
                      <td className="px-3 py-2 w-[10%]">{student.contactNumber}</td>
                      <td className="px-3 py-2 w-[20%]"><span>{student.curriculumName || student.curriculumId || 'Not Set'}</span></td>
                      <td className="px-3 py-2 w-[15%]">
                       {student.enrolled ? (
                        <span className="inline-flex w-24 justify-center text-center px-2 py-1 rounded-full border border-green-300 bg-green-100 text-green-700 text-xs font-medium">
                          Enrolled
                        </span>
                      ) : (
                        <span className="inline-flex w-24 justify-center text-center px-2 py-1 rounded-full border border-red-300 bg-red-100 text-red-700 text-xs font-medium">
                          Not Enrolled
                        </span>
                      )}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <></>
      )}

      {filteredStudents.length === 0 && searchTerm && (
        <div className="text-center py-2">
          <h6 className="text-gray-600 mb-2">
            No students found matching "{searchTerm}" in {tabValue === 4 ? 'Irregular Students' : tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year
          </h6>
          <p className="text-gray-600 text-sm">Try adjusting your search terms</p>
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
       

        <div className='bg-white px-8 py-4 border border-slate-300 rounded-xl flex items-center justify-between'>
          <div className="text-gray-600">
            <div className="text-gray-900 text-lg font-semibold">{student.name}</div>
              <span className='text-sm text-gray-600'>{student.studentNumber}</span><br />
              <span className='text-sm text-gray-600'>{student.yearLevel === 1 ? '1st' : student.yearLevel === 2 ? '2nd' : student.yearLevel === 3 ? '3rd' : '4th'} Year{student.isIrregular ? ' - Irregular' : ''} {' '}
              <span> Block {student.block ? student.block : 'Not Set'}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePrintStudentPDF(
                  student,
                  studentCurriculum,
                  processedCourses.filter(c => c.semester === 3)
                )}
                className="inline-flex items-center text-sm gap-2 bg-green-600 cursor-pointer text-white px-4 py-2 rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300"
              >
                <Printer className="w-4 h-4" />
                <span>Print Curriculum</span>
              </button>
            </div>
        </div>

        {/* Year Tabs */}
        <div className="flex gap-2 bg-gray-200/50 p-1 rounded-xl w-full my-4">
  {[1, 2, 3, 4].map(year => {
    const yearLabel = year === 1 ? '1st Year' : year === 2 ? '2nd Year' : year === 3 ? '3rd Year' : '4th Year';
    return (
      <button
        key={year}
        type="button"
        onClick={() => setSelectedYear(year)}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition
          ${selectedYear === year
            ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 cursor-pointer'
          }`}
      >
        {yearLabel}
      </button>
    );
  })}
</div>

{/* Tab Content */}
<div className="border  border-gray-200 bg-white rounded-xl mb-4">
  {(() => {
    const year = selectedYear;
    const scholarshipEligibility = calculateScholarshipEligibility(student, year);
    const deansLister1stSem = calculateDeansListerEligibility(student, 1, year);
    const deansLister2ndSem = calculateDeansListerEligibility(student, 2, year);
    const hasSummer = processedCourses.some(c => c.yearLevel === year && c.semester === 3);

    return (
      <div className="py-6 px-10">
        <div className="mb-4">
          <h4 className="font-semibold text-sm">Academic Eligibility Summary</h4>
          <div className="flex flex-wrap gap-6 mt-2">
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
          <div key={semester} className="mb-6">
            <h5 className="text-blue-600 font-semibold mb-2">
              {semester === 1 ? '1st' : semester === 2 ? '2nd' : 'Summer'} Semester
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
                    .map(course => {
                      const failed = isCourseFailed(student, course.courseCode);
                      const incomplete = isCourseIncomplete(student, course.courseCode);
                      return (
                        <tr key={course.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition">
                          <td className="px-3 py-2 w-[10%]">
                            <span className="text-blue-700 font-semibold">{course.courseCode}</span>
                          </td>
                          <td className="px-3 py-2 w-[30%]">{course.courseTitle}</td>
                          <td className="px-3 py-2 w-[10%]">{course.units}</td>
                          <td className="px-3 py-2 w-[20%]">
                            {course.prerequisites.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {course.prerequisites.map(prereq => {
                                  const isPrereqMet =
                                    student.completedCourses?.includes(prereq) &&
                                    !isCourseFailed(student, prereq) &&
                                    !isCourseIncomplete(student, prereq);
                                  return (
                                    <span key={prereq} className={`px-2 py-0.5 text-xs rounded-full border ${isPrereqMet ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                      {prereq}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-gray-500">None</span>
                            )}
                          </td>
                          <td className="px-3 py-2 w-[15%]">
                            <span className={`inline-block px-2 py-0.5 text-xs rounded-full border ${getStatusColor(course.status)}`}>
                              {getStatusLabel(course.status, course, student)}
                            </span>
                          </td>
                          <td className="px-3 py-2 w-[15%]">
                            {student.grades && student.grades[course.courseCode] ? (() => {
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
                            })() : (
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
    );
  })()}
</div>

      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
        <span>Dashboard</span>
        <span className="text-gray-300">&gt;</span>
        <button
          type="button"
          onClick={() => { setSelectedFolder(null); setSelectedStudent(null); setTabValue(0); }}
          className={`text-left ${!selectedStudent && !selectedFolder ? 'font-medium text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
        >
          Curriculum Checker
        </button>
        {selectedFolder && (
          <>
            <span className="text-gray-300">&gt;</span>
            <button
              type="button"
              onClick={() => { setSelectedStudent(null); /* keep folder view */ }}
              className={`text-left ${selectedStudent ? 'text-gray-600 hover:text-blue-600' : 'font-medium text-blue-600'}`}     >
              {selectedFolder.isIrregular ? 'Irregular Students' : `${selectedFolder.year === 1 ? '1st' : selectedFolder.year === 2 ? '2nd' : selectedFolder.year === 3 ? '3rd' : '4th'} Year${selectedFolder.block ? ` Block ${selectedFolder.block}` : ''}`}
            </button>
          </>
        )}
        {selectedStudent && (
          <>
            <span className="text-gray-300">&gt;</span>
            <span className="font-medium text-blue-600">{selectedStudent.name}</span>
          </>
        )}
      </div>

        <div className='mb-4'>
          <h2 className='text-2xl font-bold text-gray-800'>Curriculum Checker</h2>
          <p className='text-gray-600 mt-1 max-w-3xl text-sm'>Check student curriculum status, view course details, and print curriculum reports.</p>
        </div>

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
      {printPreviewOpen && previewTarget && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold">Print Preview</h2>
              <button
                onClick={() => setPrintPreviewOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh]">
              <CurriculumPreview
                curriculumId={previewTarget.studentCurriculum?.curriculumId || previewTarget.student?.curriculumId}
                student={previewTarget.student}
                summerCourses={previewTarget.summerCourses || []}
              />
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setPrintPreviewOpen(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPrint}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
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
