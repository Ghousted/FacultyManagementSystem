import { useState, useEffect, useRef, useCallback } from 'react';
import { exportDeanListToExcel } from '../../utils/excelExport';
<<<<<<< HEAD
import { getStudents, getCoursesByCurriculum, getAllCourses } from '../../models/curriculumModels';
import { evaluateDeansListerEligibility, resolveSemesterCoursesForStudent } from '../../utils/deansListerUtils';

=======
import { getStudents, getCoursesByCurriculum, getDeanListCriteria, saveDeanListCriteria } from '../../models/curriculumModels';
import { Settings2, Download, CalendarCheck, X, ChevronDown, ChevronUp, ChevronsUpDown, ArrowBigLeft } from 'lucide-react';
>>>>>>> ac98f3daa47094dbd423acea372c3dfcf4ab05e5

const yearTabs = [
  { label: '1st Year', value: 1 },
  { label: '2nd Year', value: 2 },
  { label: '3rd Year', value: 3 },
  { label: '4th Year', value: 4 },
  { label: 'Irregulars', value: 'irregular' }
];
const semTabs = [
  { label: '1st Sem', value: 1 },
  { label: '2nd Sem', value: 2 }
];

const CriteriaModal = ({ isOpen, onClose, criteria, onSave, isSaving }) => {
  const [localCriteria, setLocalCriteria] = useState({ ...criteria });

  useEffect(() => {
    setLocalCriteria({ ...criteria });
  }, [criteria]);

  const handleSave = async () => {
    const result = await onSave(localCriteria);
    if (result?.success) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-3xl shadow-2xl w-96 max-w-full transform transition-transform duration-200 scale-100 sm:scale-105">
        <h3 className="text-xl font-bold text-blue-700 mb-6">Configure Dean's List Criteria</h3>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Major Grade Cutoff</label>
            <input
              type="number"
              step="0.01"
              value={localCriteria.major}
              onChange={e => setLocalCriteria(c => ({ ...c, major: parseFloat(e.target.value) }))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minor Grade Cutoff</label>
            <input
              type="number"
              step="0.01"
              value={localCriteria.minor}
              onChange={e => setLocalCriteria(c => ({ ...c, minor: parseFloat(e.target.value) }))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GWA Cutoff</label>
            <input
              type="number"
              step="0.01"
              value={localCriteria.gwa}
              onChange={e => setLocalCriteria(c => ({ ...c, gwa: parseFloat(e.target.value) }))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-1.5 text-sm cursor-pointer rounded-xl bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold shadow-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 text-sm cursor-pointer rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md transition"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

const StudentDetailsModal = ({ isOpen, onClose, student }) => {
  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-2xl">
        <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-blue-700">{student.name}</h3>
         
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-700 cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mb-4">
          <p className="text-sm font-semibold">
              GWA: <span className="text-green-700">{parseFloat(student.gwa).toFixed(2)}</span>
          </p>
        </div>
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
          <table className="min-w-full text-sm border rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-blue-100">
                <th className="px-2 py-1.5 border border-gray-300">Subject</th>
                <th className="px-2 py-1.5 border border-gray-300">Grade</th>
              </tr>
            </thead>
            <tbody>
              {student.grades.map((grade, idx) => (
                <tr key={idx} className="hover:bg-blue-50">
                  <td className="px-2 py-1.5 border border-gray-300">{grade.subject}</td>
                  <td className="px-2 py-1.5 border border-gray-300 font-semibold text-center text-gray-800">{parseFloat(grade.grade).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
       
      </div>
    </div>
  );
};

const FilenameModal = ({ isOpen, onClose, onConfirm, defaultName = 'deans_list_all_years' }) => {
  const [name, setName] = useState(defaultName);
  const [useExactLayout, setUseExactLayout] = useState(false);

  useEffect(() => setName(defaultName), [defaultName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-3xl shadow-2xl w-96 max-w-full">
        <h3 className="text-lg font-bold text-blue-700">Export File</h3>
        <p className="text-sm text-gray-600 mb-4">Enter a filename for the exported Excel file.</p>
        <div className="flex items-center">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 border border-gray-300 rounded-l-lg px-3 py-1.5 text-sm focus:outline-none"
            placeholder="filename"
          />
          <span className="px-3 py-1.5 text-sm bg-gray-100 border border-gray-300 border-l-0 rounded-r-lg">.xlsx</span>
        </div>
        <div className="flex items-center justify-end gap-4 mt-8">
        
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer">Cancel</button>
            <button
              onClick={() => onConfirm((name || defaultName).trim(), useExactLayout ? 'full' : 'compact')}
              className="px-6 py-1.5 rounded-full cursor-pointer text-sm bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadingModal = ({ isOpen }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-blue-600"></div>
        <div className="text-sm text-gray-700">Processing export, please wait…</div>
      </div>
    </div>
  );
};

const ReportsModule = ({ onBackToDashboard }) => {
  const [criteria, setCriteria] = useState({
<<<<<<< HEAD
    minGrade: 2.1,
    gwa: 2.0,
    minUnits: 15
=======
    major: 1.7,
    minor: 2.0,
    gwa: 1.7
>>>>>>> ac98f3daa47094dbd423acea372c3dfcf4ab05e5
  });
  const [criteriaSaving, setCriteriaSaving] = useState(false);
  const [tabYear, setTabYear] = useState(0);
  const [tabSem, setTabSem] = useState(0);
  const [selectedYear, setSelectedYear] = useState(1);
  const [selectedSem, setSelectedSem] = useState(1);
  const [deansList, setDeansList] = useState([]);
  const [sortBy, setSortBy] = useState(null); // 'name' | 'gwa'
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isFilenameModalOpen, setIsFilenameModalOpen] = useState(false);
  const [visibleRows, setVisibleRows] = useState(4);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [toast, setToast] = useState(null);
  const observer = useRef();
  const loadMoreRef = useRef();
  const toastTimeoutRef = useRef(null);

  const normalizeCriteria = useCallback((nextCriteria = {}) => ({
    major: Number.isFinite(parseFloat(nextCriteria.major)) ? parseFloat(nextCriteria.major) : 1.7,
    minor: Number.isFinite(parseFloat(nextCriteria.minor)) ? parseFloat(nextCriteria.minor) : 2.0,
    gwa: Number.isFinite(parseFloat(nextCriteria.gwa)) ? parseFloat(nextCriteria.gwa) : 1.7
  }), []);

  const getCurrentScrollTop = useCallback(() => {
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
  }, []);

  useEffect(() => {
    setSelectedYear(yearTabs[tabYear].value);
  }, [tabYear]);

  useEffect(() => {
    let isMounted = true;

    const loadCriteria = async () => {
      const result = await getDeanListCriteria();
      if (isMounted && result.success) {
        setCriteria(normalizeCriteria(result.data));
      }
    };

    loadCriteria();

    return () => {
      isMounted = false;
    };
  }, [normalizeCriteria]);

  useEffect(() => {
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
  }, [getCurrentScrollTop]);

  useEffect(() => {
    setSelectedSem(semTabs[tabSem].value);
  }, [tabSem]);

  useEffect(() => {
    const fetchDeanList = async () => {
      setLoading(true);
      const [studentsRes, allCoursesRes] = await Promise.all([getStudents(), getAllCourses()]);
      if (!studentsRes.success || !allCoursesRes.success) {
        setDeansList([]);
        setLoading(false);
        return;
      }
      const students = studentsRes.data;
      const allCourses = allCoursesRes.data || [];
      const yearVal = selectedYear;
      const semVal = selectedSem;
      const filtered = students.filter(s => {
        if (yearVal === 'irregular') return s.isIrregular;
        return !s.isIrregular && s.yearLevel === yearVal;
      });
      const deanCandidates = [];
      for (const student of filtered) {
        let curriculumCourses = [];
        if (student.curriculumId) {
          const coursesRes = await getCoursesByCurriculum(student.curriculumId);
          if (!coursesRes.success) continue;
          curriculumCourses = coursesRes.data || [];
        }

        if (!student.curriculumId && !student.isIrregular) {
          continue;
        }

        const semesterCourses = resolveSemesterCoursesForStudent({
          student,
          semester: semVal,
          year: yearVal === 'irregular' ? null : yearVal,
          curriculumCourses,
          allCourses
        });
        const result = evaluateDeansListerEligibility({
          student,
          courses: semesterCourses,
          criteria
        });
        if (result.eligible) {
          deanCandidates.push({
            name: student.name,
            gwa: result.gwa ? result.gwa.toFixed(3) : '',
            totalUnits: result.totalUnits,
            grades: result.gradeDetails
          });
        }
      }
      setDeansList(deanCandidates);
      setLoading(false);
      setVisibleRows(4);
    };
    fetchDeanList();
  }, [selectedYear, selectedSem, criteria]);

  const lastRowRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleRows < deansList.length) {
        setVisibleRows(prev => Math.min(prev + 4, deansList.length));
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, visibleRows, deansList.length]);

  const handleLoadMore = () => {
    setVisibleRows(prev => Math.min(prev + 4, deansList.length));
  };

  const prepareAndExport = async (filename, styleLevel = 'compact') => {
    try {
      const studentsRes = await getStudents();
      if (!studentsRes.success) {
        return;
      }
      const students = studentsRes.data;
      const semVal = selectedSem;
      const allCandidates = [];

      for (const tab of yearTabs) {
        const yearVal = tab.value;
        const filtered = students.filter(s => {
          if (yearVal === 'irregular') return s.isIrregular;
          return !s.isIrregular && s.yearLevel === yearVal;
        });

        for (const student of filtered) {
          if (!student.curriculumId) continue;
          const coursesRes = await getCoursesByCurriculum(student.curriculumId);
          if (!coursesRes.success) continue;
          const courses = coursesRes.data.filter(c => c.semester === semVal && (yearVal === 'irregular' || c.yearLevel === yearVal));
          const grades = student.grades || {};
          let totalUnits = 0;
          let weightedSum = 0;
          let eligible = true;
          const gradeDetails = [];

          for (const course of courses) {
            const grade = parseFloat(grades[course.courseCode]);
            if (isNaN(grade)) continue;
            gradeDetails.push({
              subject: course.courseTitle,
              grade,
              code: course.courseCode,
              units: course.units || 3,
              isMajor: course.isMajor || false
            });
            totalUnits += parseFloat(course.units) || 0;
            weightedSum += grade * (parseFloat(course.units) || 1);
            if (course.isMajor && grade > criteria.major) eligible = false;
            if (!course.isMajor && grade > criteria.minor) eligible = false;
          }

          const gwa = totalUnits > 0 ? weightedSum / totalUnits : null;
          if (gwa === null || gwa > criteria.gwa) eligible = false;
          if (eligible && gradeDetails.length > 0) {
            allCandidates.push({
              name: student.name,
              gwa: gwa ? gwa.toFixed(3) : '',
              grades: gradeDetails,
              yearLevel: yearVal
            });
          }
        }
      }

      // Choose export options based on requested styleLevel
      try {
        setExporting(true);
        // allow modal to render before heavy work
        await new Promise(resolve => setTimeout(resolve, 50));
        if (styleLevel === 'compact') {
          // compact styled output (faster)
          exportDeanListToExcel(allCandidates, `${filename}.xlsx`, { useStyles: true, styleLevel: 'compact' });
        } else if (styleLevel === 'full') {
          // full styled output (slower but more exact)
          exportDeanListToExcel(allCandidates, `${filename}.xlsx`, { useStyles: true, styleLevel: 'full' });
        } else {
          // none or unknown: pure fast no-style export
          exportDeanListToExcel(allCandidates, `${filename}.xlsx`, { useStyles: false });
        }
      } finally {
        setExporting(false);
      }
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const handleExportClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsFilenameModalOpen(true);
  };

  const showToastMessage = useCallback((type, message) => {
    setToast({ type, message });
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, type === 'success' ? 2200 : 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleSaveCriteria = async (nextCriteria) => {
    const normalized = normalizeCriteria(nextCriteria);
    setCriteriaSaving(true);
    try {
      const saveResult = await saveDeanListCriteria(normalized);
      if (saveResult.success) {
        setCriteria(normalized);
        showToastMessage('success', 'Dean\'s List criteria updated successfully.');
        return { success: true };
      }
      showToastMessage('error', saveResult.error || 'Failed to update criteria.');
      return { success: false };
    } catch (error) {
      showToastMessage('error', error?.message || 'Failed to update criteria.');
      return { success: false };
    } finally {
      setCriteriaSaving(false);
    }
  };

  const toggleSort = field => {
    if (sortBy === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
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
  };

  return (
    <div className="mt-6">
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-300 mb-6">
        <div className="flex items-center gap-6">
          <button
            onClick={onBackToDashboard}
                      className="group flex cursor-pointer items-center gap-2 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white transition-transform"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
                      <ArrowBigLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-blue-700">Dean's List Reports</h2>
            <p className="text-gray-600">
              View detailed reports of students who have achieved academic excellence this semester, including GPA breakdowns and honors.
            </p>
          </div>
        </div>
      </div>
      <div className="mb-6">
<<<<<<< HEAD
        {/* Parameters Section */}
        <div className="flex gap-6 flex-wrap items-center bg-blue-50 p-4 rounded-2xl shadow-sm mb-6">
          <div className="flex flex-col items-start">
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1" title="Highest allowed numeric grade per subject">
              <i className="bi bi-star-fill text-yellow-500"></i>Minimum Grade
            </label>
            <input type="number" step="0.01" value={criteria.minGrade} onChange={e => setCriteria(c => ({ ...c, minGrade: parseFloat(e.target.value) }))} className="border rounded px-2 py-1 w-24 focus:ring-2 focus:ring-blue-300" />
          </div>
          <div className="flex flex-col items-start">
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1" title="Dean's List GWA Cutoff">
              <i className="bi bi-graph-up"></i>GWA
            </label>
            <input type="number" step="0.01" value={criteria.gwa} onChange={e => setCriteria(c => ({ ...c, gwa: parseFloat(e.target.value) }))} className="border rounded px-2 py-1 w-24 focus:ring-2 focus:ring-blue-300" />
          </div>
          <div className="flex flex-col items-start">
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1" title="Minimum enrolled and graded units required">
              <i className="bi bi-stack"></i>Minimum Units
            </label>
            <input type="number" min="1" step="1" value={criteria.minUnits} onChange={e => setCriteria(c => ({ ...c, minUnits: parseInt(e.target.value, 10) || 0 }))} className="border rounded px-2 py-1 w-24 focus:ring-2 focus:ring-blue-300" />
          </div>
          <button onClick={handleDownload} className="ml-auto bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold shadow flex items-center gap-2 mt-2 sm:mt-0" title="Download Excel">
            <i className="bi bi-file-earmark-excel"></i> Download Excel
          </button>
        </div>

        {/* Floating Filtering Section */}
        <div className="flex flex-col gap-4 items-center mb-6">
          <div className="flex gap-3 justify-center">
=======
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-3 flex-wrap">
>>>>>>> ac98f3daa47094dbd423acea372c3dfcf4ab05e5
            {yearTabs.map((tab, idx) => (
              <button
                key={tab.value}
                onClick={() => setTabYear(idx)}
                className={`px-3 py-1 font-semibold rounded-full shadow-md border transition-all flex items-center gap-1 text-sm cursor-pointer 
                  ${ tabYear === idx
                    ? 'bg-blue-600 text-white border-blue-700 scale-105'
                    : 'bg-white text-blue-700 hover:bg-blue-100 border-gray-300'
                }`}
                style={{ boxShadow: '0 2px 12px 0 rgba(30, 64, 175, 0.10)' }}
                title={tab.label}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="semester-dropdown"
              className="text-base font-medium text-blue-700 flex items-center gap-1"
            >
              <CalendarCheck className="h-4 w-4" /> Semester:
            </label>
            <select
              id="semester-dropdown"
              value={tabSem}
              onChange={e => setTabSem(Number(e.target.value))}
              className="border border-blue-300 rounded-full px-3 py-1 text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              {semTabs.map((tab, idx) => (
                <option key={tab.value} value={idx}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setIsModalOpen(true)}
              className="rounded-full text-sm px-3 py-1.5 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow flex items-center gap-1"
            >
              <Settings2 className="h-4 w-4" /> Configure
            </button>
            <button
              type="button"
              onClick={handleExportClick}
              className="rounded-full text-sm px-3 py-1.5 cursor-pointer bg-green-600 hover:bg-green-700 text-white font-semibold shadow flex items-center gap-1"
            >
              <Download className="h-4 w-4" /> Export Excel
            </button>
          </div>
        </div>
      </div>
<<<<<<< HEAD
      {/* Table placeholder */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-blue-100">
              <th className="p-2 border">Name</th>
              <th className="p-2 border">GWA</th>
              <th className="p-2 border">Units</th>
              <th className="p-2 border">Show Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-2 border text-center" colSpan={4}>Loading...</td></tr>
            ) : deansList.length === 0 ? (
              <tr><td className="p-2 border text-center" colSpan={4}>No data found.</td></tr>
            ) : (
              deansList.map((student, idx) => (
                <>
                  <tr key={idx} className="hover:bg-blue-50 transition cursor-pointer" onClick={() => setExpandedStudent(expandedStudent === idx ? null : idx)}>
                    <td className="p-2 border font-semibold text-blue-700 flex items-center gap-2">
                      <i className="bi bi-person-circle text-lg text-blue-400"></i> {student.name}
                    </td>
                    <td className="p-2 border font-bold text-green-700">{student.gwa}</td>
                    <td className="p-2 border text-center font-semibold text-blue-700">{student.totalUnits}</td>
                    <td className="p-2 border text-center">
                      <button className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow" onClick={e => { e.stopPropagation(); setExpandedStudent(expandedStudent === idx ? null : idx); }}>
                        {expandedStudent === idx ? 'Hide' : 'Show'}
                      </button>
                    </td>
                  </tr>
                  {expandedStudent === idx && (
                    <tr>
                      <td colSpan={4} className="bg-blue-50 p-0">
                        <div className="p-4">
                          <h4 className="font-semibold text-blue-700 mb-2">Subject Grades</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs border">
                              <thead>
                                <tr className="bg-blue-200">
                                  <th className="p-2 border">Subject</th>
                                  <th className="p-2 border">Grade</th>
                                  <th className="p-2 border">Code</th>
                                  <th className="p-2 border">Units</th>
                                </tr>
                              </thead>
                              <tbody>
                                {student.grades.map((grade, gidx) => (
                                  <tr key={gidx}>
                                    <td className="p-2 border">{grade.subject}</td>
                                    <td className="p-2 border font-semibold text-gray-800">{grade.grade}</td>
                                    <td className="p-2 border">{grade.code}</td>
                                    <td className="p-2 border">{grade.units}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
=======
      <div className="overflow-x-auto border-x border-gray-300 rounded-xl shadow-sm mb-4">
  <table className="min-w-full text-sm border-separate border-spacing-0 rounded-xl overflow-hidden shadow-sm">
    <thead>
      <tr className="bg-blue-100 text-left">
        <th
          className="px-2 py-1.5 border-b font-semibold text-blue-700 cursor-pointer"
          onClick={() => toggleSort('name')}
          role="button"
          title="Sort by name"
        >
          <div className="flex items-center gap-2">
            <span>Name</span>
            <span className="text-blue-500">
              {sortBy === 'name' ? (sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronsUpDown className="w-4 h-4" />}
            </span>
          </div>
        </th>
        <th
          className="px-2 py-1.5 border-b font-semibold text-blue-700 text-center cursor-pointer"
          onClick={() => toggleSort('gwa')}
          role="button"
          title="Sort by GWA"
        >
          <div className="flex items-center justify-center gap-2">
            <span>GWA</span>
            <span className="text-blue-500">
              {sortBy === 'gwa' ? (sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ChevronsUpDown className="w-4 h-4" />}
            </span>
          </div>
        </th>
      </tr>
    </thead>
    <tbody>
      {loading ? (
        Array.from({ length: 5 }).map((_, idx) => (
          <tr key={idx} className="animate-pulse bg-white">
            <td className="px-2 py-1.5 border-b border-gray-300 w-3/4">
              <div className="bg-gray-200 rounded-md h-5 w-3/4"></div>
            </td>
            <td className="px-2 py-1.5 border-b border-gray-200 text-center w-1/4">
              <div className="bg-gray-200 rounded-md h-5 w-1/4 mx-auto"></div>
            </td>
          </tr>
        ))
      ) : deansList.length === 0 ? (
        <tr>
          <td className="p-3 border-b text-center text-gray-500" colSpan={2}>
            No data found.
          </td>
        </tr>
      ) : (
        // apply sorting to a copy of the list
        [...deansList]
          .sort((a, b) => {
            if (!sortBy) return 0;
            if (sortBy === 'name') {
              return sortDir === 'asc'
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name);
            }
            if (sortBy === 'gwa') {
              const ag = parseFloat(a.gwa) || 0;
              const bg = parseFloat(b.gwa) || 0;
              return sortDir === 'asc' ? ag - bg : bg - ag;
            }
            return 0;
          })
          .slice(0, visibleRows)
          .map((student, idx) => (
          <tr
            key={student.id || idx}
            ref={idx === visibleRows - 1 ? lastRowRef : null}
            className="bg-white hover:bg-blue-50 transition cursor-pointer"
            onClick={() => {
              setSelectedStudent(student);
              setIsDetailsModalOpen(true);
            }}
          >
            <td className="p-3 border-b border-gray-300 font-semibold text-blue-700 w-3/4">{student.name}</td>
            <td className="p-3 border-b border-gray-300 font-bold text-green-700 text-center w-1/4">{parseFloat(student.gwa).toFixed(2)}</td>
          </tr>
        ))
      )}
    </tbody>
  </table>

  {/* Load More Button */}
  {!loading && visibleRows < deansList.length && (
    <div className="flex justify-center mt-4">
      <button
        ref={loadMoreRef}
        onClick={handleLoadMore}
        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition"
      >
        Load more
      </button>
    </div>
  )}
</div>
      <CriteriaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        criteria={criteria}
        onSave={handleSaveCriteria}
        isSaving={criteriaSaving}
      />
      <FilenameModal
        isOpen={isFilenameModalOpen}
        onClose={() => setIsFilenameModalOpen(false)}
        onConfirm={(name, styleLevel) => { setIsFilenameModalOpen(false); prepareAndExport(name || 'deans_list_all_years', styleLevel || 'compact'); }}
        defaultName={'deans_list_all_years'}
      />
      <StudentDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        student={selectedStudent}
      />
      <LoadingModal isOpen={exporting} />

      {showScrollTop && (
        <button
          type="button"
          onClick={handleScrollToTop}
          className="fixed bottom-6 right-6 z-40 cursor-pointer rounded-full bg-blue-600 text-white p-3 shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
          aria-label="Scroll to top"
          title="Scroll to top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`rounded-md px-4 py-2 shadow-lg ring-1 text-sm ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                : 'bg-red-50 text-red-800 ring-red-200'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
>>>>>>> ac98f3daa47094dbd423acea372c3dfcf4ab05e5
    </div>
  );
};

export default ReportsModule;