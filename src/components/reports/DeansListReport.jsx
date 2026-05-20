import { useState, useEffect, useRef, useCallback } from 'react';
import { exportDeanListToExcel } from '../../utils/excelExport';
import { getStudents, getCoursesByCurriculum, getDeanListCriteria, saveDeanListCriteria } from '../../models/curriculumModels';
import { Settings2, Download, CalendarCheck, X, ChevronDown, ChevronUp, ChevronsUpDown, ArrowBigLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Breadcrumbs from '../common/Breadcrumbs';

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
const irregularSemTabs = [
  { label: '1st Sem', value: 1 },
  { label: '2nd Sem', value: 2 },
];

const gwaComputationMethods = [
  { label: 'Weighted (Grade/Units)', value: 'weighted' },
  { label: 'Simple Average (Subjects)', value: 'simple' }
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
      <div className="bg-white  rounded-2xl shadow-2xl w-96 max-w-full transform transition-transform duration-200 scale-100 sm:scale-105">
        <div className='px-8 py-4 border-b border-slate-300'>
          <h3 className="text-xl font-medium text-slate-800 ">Configure Dean's List Criteria</h3>
        </div>

        <div className="space-y-5 px-8 py-4">
          <div>
            <label className="block text-xs  text-gray-700 mb-1">Major Grade Cutoff</label>
            <input
              type="number"
              step="0.01"
              value={localCriteria.major}
              onChange={e => setLocalCriteria(c => ({ ...c, major: parseFloat(e.target.value) }))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition"
            />
          </div>

          <div>
            <label className="block text-xs  text-gray-700 mb-1">Minor Grade Cutoff</label>
            <input
              type="number"
              step="0.01"
              value={localCriteria.minor}
              onChange={e => setLocalCriteria(c => ({ ...c, minor: parseFloat(e.target.value) }))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition"
            />
          </div>

          <div>
            <label className="block text-xs  text-gray-700 mb-1">GWA Cutoff</label>
            <input
              type="number"
              step="0.01"
              value={localCriteria.gwa}
              onChange={e => setLocalCriteria(c => ({ ...c, gwa: parseFloat(e.target.value) }))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition"
            />
          </div>

          <div>
            <label className="block text-xs  text-gray-700 mb-1">Minimum Units (Irregulars)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={localCriteria.minUnits}
              onChange={e => setLocalCriteria(c => ({ ...c, minUnits: parseInt(e.target.value, 10) || 0 }))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition"
            />
            <p className="text-[11px] text-gray-500 mt-1">Minimum units required for irregular students to be considered for dean's list</p>
          </div>

          <div>
            <label className="block text-xs  text-gray-700 mb-1">GWA Computation Method</label>
            <select
              value={localCriteria.gwaMethod || 'weighted'}
              onChange={e => setLocalCriteria(c => ({ ...c, gwaMethod: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition"
            >
              {gwaComputationMethods.map(method => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              Weighted: (sum of grade × units) / total units | Simple: sum of grades / number of subjects
            </p>
          </div>

           <div className="flex justify-end gap-2 mt-8">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 w-28 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>

        </div>

       
      </div>
    </div>
  );
};

const StudentDetailsModal = ({ isOpen, onClose, student }) => {
  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] px-4 py-6 animate-in fade-in duration-200">
  <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
    
    {/* Header */}
    <div className="relative  px-6 pt-6 text-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight">
            {student.name}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-blue-100">
            <span className="rounded-full bg-blue-100  text-blue-600 border border-blue-500 px-3 py-1 backdrop-blur">
              Student No:{" "}
              <span>
                {student.studentNumber || "-"}
              </span>
            </span>

            <span className="rounded-full bg-green-100  text-green-600 border border-green-500 px-3 py-1 backdrop-blur">
              GWA:{" "}
              <span>
                {parseFloat(student.gwa).toFixed(2)}
              </span>
            </span>
          </div>
        </div>

        <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-700 cursor-pointer transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
    </div>

    {/* Body */}
    <div className="p-6">
      <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-500 text-white">
              <tr>
                <th className="px-5 py-3 text-left font-semibold ">
                  Subject
                </th>
                <th className="px-5 py-3 text-center font-semibold ">
                  Grade
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {student.grades.map((grade, idx) => (
                <tr
                  key={idx}
                  className=""
                >
                  <td className="px-4 py-2 text-gray-700 font-medium">
                    {grade.subject}
                  </td>

                  <td className="px-4 py-2 text-center">
                    <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-700">
                      {parseFloat(grade.grade).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    
    </div>
  </div>
</div>
  );
};

const FilenameModal = ({ isOpen, onClose, onConfirm, defaultName = 'deans_list_all_years' }) => {
  const [name, setName] = useState(defaultName);
  const useExactLayout = false;

  useEffect(() => setName(defaultName), [defaultName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white  rounded-3xl shadow-2xl w-96 max-w-full">
        <div className='px-8 py-4 border-b border-slate-300'>
          <h3 className="text-xl font-medium text-slate-800 ">Export Dean's Lister</h3>
        </div>  
        <div className='px-8 py-4'>
          <p className="text-sm text-gray-600 mb-1">Enter a filename for the exported Excel file.</p>      
        <div className="flex items-center">
          
          <input
            value={name}
            onChange={e => setName(e.target.value)}
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
            placeholder="filename"
          />
          <span className="px-4 py-2 text-sm bg-gray-100 border border-gray-300 border-l-0 rounded-r-lg">.xlsx</span>
        </div>
        <div className="flex items-center justify-end gapx-6 py-2 mt-8">
        
          <div className="flex justify-end gap-2">
            <button 
              onClick={onClose} 
              className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm((name || defaultName).trim(), useExactLayout ? 'full' : 'compact')}
              className="px-4 py-1.5 w-28 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              Export
            </button>
          </div>
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
      <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center gapx-6 py-2">
        <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-blue-600"></div>
        <div className="text-sm text-gray-700">Processing export, please wait…</div>
      </div>
    </div>
  );
};

const ReportsModule = ({ onBackToDashboard, embedded = false }) => {
  const { role } = useAuth();
  const [criteria, setCriteria] = useState({
    major: 1.7,
    minor: 2.0,
    gwa: 1.7,
    minUnits: 15,
    gwaMethod: 'weighted'
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
    gwa: Number.isFinite(parseFloat(nextCriteria.gwa)) ? parseFloat(nextCriteria.gwa) : 1.7,
    minUnits: Number.isFinite(parseInt(nextCriteria.minUnits, 10)) ? parseInt(nextCriteria.minUnits, 10) : 15,
    gwaMethod: ['weighted', 'simple'].includes(nextCriteria.gwaMethod) ? nextCriteria.gwaMethod : 'weighted'
  }), []);

  const calculateGWA = useCallback((gradeDetails, method = 'weighted') => {
    if (gradeDetails.length === 0) return null;
    
    if (method === 'simple') {
      // Simple average: sum of grades / number of subjects
      const sum = gradeDetails.reduce((acc, g) => acc + g.grade, 0);
      return sum / gradeDetails.length;
    } else {
      // Weighted: sum of (grade × units) / total units
      let totalUnits = 0;
      let weightedSum = 0;
      for (const g of gradeDetails) {
        const units = g.units || 1;
        totalUnits += units;
        weightedSum += g.grade * units;
      }
      return totalUnits > 0 ? weightedSum / totalUnits : null;
    }
  }, []);

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
    // When switching to irregular students, use irregular semester tabs
    if (selectedYear === 'irregular') {
      if (tabSem >= irregularSemTabs.length) {
        setTabSem(0); // Reset to first option if current tab is out of range
      }
      setSelectedSem(irregularSemTabs[tabSem].value);
    } else {
      // For regular students, use normal semester tabs
      if (tabSem >= semTabs.length) {
        setTabSem(0); // Reset to first option if current tab is out of range
      }
      setSelectedSem(semTabs[tabSem].value);
    }
  }, [selectedYear, tabSem]);

  useEffect(() => {
    const fetchDeanList = async () => {
      setLoading(true);
      const studentsRes = await getStudents();
      if (!studentsRes.success) {
        setDeansList([]);
        setLoading(false);
        return;
      }
      const students = studentsRes.data;
      const yearVal = selectedYear;
      let semVal = selectedSem;
      
      // For irregular students with 'alt_1' (1st Sem Current Year), use semester 1
      // This is shown as an option when in 2nd sem view for irregulars
      const actualSem = semVal === 'alt_1' ? 1 : semVal;
      
      const filtered = students.filter(s => {
        if (yearVal === 'irregular') return s.isIrregular;
        return !s.isIrregular && s.yearLevel === yearVal;
      });
      const deanCandidates = [];
      for (const student of filtered) {
        let gradeDetails = [];
        let totalUnits = 0;
        let weightedSum = 0;
        let eligible = true;

        if (yearVal === 'irregular') {
          // Handle irregular students using irregularSubjects
          const irregularSubjects = student.irregularSubjects || {};
          const semKey = `sem${actualSem}`;
          const courses = irregularSubjects[semKey] || [];
          
          if (courses.length === 0) continue;
          
          const grades = student.grades || {};
          
          for (const course of courses) {
            const grade = parseFloat(grades[course.courseCode]);
            if (isNaN(grade)) continue;
            const units = parseFloat(course.units) || 0;
            gradeDetails.push({
              subject: course.courseTitle,
              grade,
              isMajor: course.isMajor || false,
              units
            });
            if (course.isMajor && grade > criteria.major) eligible = false;
            if (!course.isMajor && grade > criteria.minor) eligible = false;
          }
        } else {
          // Handle regular students using curriculum
          if (!student.curriculumId) continue;
          const coursesRes = await getCoursesByCurriculum(student.curriculumId);
          if (!coursesRes.success) continue;
          const courses = coursesRes.data.filter(c => c.semester === actualSem && c.yearLevel === yearVal);
          const grades = student.grades || {};
          
          for (const course of courses) {
            const grade = parseFloat(grades[course.courseCode]);
            if (isNaN(grade)) continue;
            const units = parseFloat(course.units) || 0;
            gradeDetails.push({
              subject: course.courseTitle,
              grade,
              isMajor: course.isMajor || false,
              units
            });
            if (course.isMajor && grade > criteria.major) eligible = false;
            if (!course.isMajor && grade > criteria.minor) eligible = false;
          }
        }

        // Calculate GWA using selected method
        const gwa = calculateGWA(gradeDetails, criteria.gwaMethod);
        if (gwa === null || gwa > criteria.gwa) eligible = false;
        
        // Calculate total units for irregular min units check
        const totalUnitsValue = gradeDetails.reduce((sum, g) => sum + (g.units || 0), 0);
        
        // Check minimum units for irregulars
        if (yearVal === 'irregular' && totalUnitsValue < criteria.minUnits) eligible = false;
        if (eligible && gradeDetails.length > 0) {
          deanCandidates.push({
            id: student.id,
            studentNumber: student.studentNumber || '',
            name: student.name,
            gwa: gwa ? gwa.toFixed(3) : '',
            grades: gradeDetails
          });
        }
      }
      setDeansList(deanCandidates);
      setLoading(false);
      setVisibleRows(4);
    };
    fetchDeanList();
  }, [selectedYear, selectedSem, criteria, calculateGWA]);

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
      let semVal = selectedSem;
      const actualSem = semVal === 'alt_1' ? 1 : semVal;
      const allCandidates = [];

      for (const tab of yearTabs) {
        const yearVal = tab.value;
        const filtered = students.filter(s => {
          if (yearVal === 'irregular') return s.isIrregular;
          return !s.isIrregular && s.yearLevel === yearVal;
        });

        for (const student of filtered) {
          let gradeDetails = [];
          let totalUnits = 0;
          let weightedSum = 0;
          let eligible = true;

          if (yearVal === 'irregular') {
            // Handle irregular students using irregularSubjects
            const irregularSubjects = student.irregularSubjects || {};
            const semKey = `sem${actualSem}`;
            const courses = irregularSubjects[semKey] || [];
            
            if (courses.length === 0) continue;
            
            const grades = student.grades || {};
            
            for (const course of courses) {
              const grade = parseFloat(grades[course.courseCode]);
              if (isNaN(grade)) continue;
              const units = parseFloat(course.units) || 0;
              gradeDetails.push({
                subject: course.courseTitle,
                grade,
                code: course.courseCode,
                units: units || 3,
                isMajor: course.isMajor || false
              });
              if (course.isMajor && grade > criteria.major) eligible = false;
              if (!course.isMajor && grade > criteria.minor) eligible = false;
            }
          } else {
            // Handle regular students using curriculum
            if (!student.curriculumId) continue;
            const coursesRes = await getCoursesByCurriculum(student.curriculumId);
            if (!coursesRes.success) continue;
            const courses = coursesRes.data.filter(c => c.semester === actualSem && c.yearLevel === yearVal);
            const grades = student.grades || {};

            for (const course of courses) {
              const grade = parseFloat(grades[course.courseCode]);
              if (isNaN(grade)) continue;
              const units = parseFloat(course.units) || 0;
              gradeDetails.push({
                subject: course.courseTitle,
                grade,
                code: course.courseCode,
                units: units || 3,
                isMajor: course.isMajor || false
              });
              if (course.isMajor && grade > criteria.major) eligible = false;
              if (!course.isMajor && grade > criteria.minor) eligible = false;
            }
          }

          // Calculate GWA using selected method
          const gwa = calculateGWA(gradeDetails, criteria.gwaMethod);
          if (gwa === null || gwa > criteria.gwa) eligible = false;
          
          // Calculate total units for irregular min units check
          const totalUnitsValue = gradeDetails.reduce((sum, g) => sum + (g.units || 0), 0);
          
          // Check minimum units for irregulars
          if (yearVal === 'irregular' && totalUnitsValue < criteria.minUnits) eligible = false;
          if (eligible && gradeDetails.length > 0) {
            allCandidates.push({
              id: student.id,
              studentNumber: student.studentNumber || '',
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
    <div className="">
      {!embedded && role === 'curriculum' && (
        <Breadcrumbs
          items={[
            { label: 'Deans List Reports' }
          ]}
        />
      )}
      {!embedded && (
        <div className=" mb-6">
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
              <h2 className="text-2xl font-medium text-blue-700">Reports</h2>
              <p className="text-gray-600 text-sm">
                View detailed reports of students who have achieved academic excellence this semester, including GPA breakdowns and honors.
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="mb-4 flex items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center justify-between gapx-6 py-2">
  <div className="flex gap-2 w-fit items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
            {yearTabs.map((tab, idx) => (
              <button
                key={tab.value}
                onClick={() => setTabYear(idx)}
              className={`rounded-lg px-2.5 py-1 text-sm font-medium transition-all 
                  ${ tabYear === idx
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer'
                }`}
                title={tab.label}
              >
                {tab.label}
              </button>
            ))}
          </div>

       

        </div>

        <div className='flex items-center gap-2 mb-'>
            
         
            <select
              id="semester-dropdown"
              value={tabSem}
              onChange={e => setTabSem(Number(e.target.value))}
              className='border w-fit px-4 py-2 text-xs rounded-lg border-slate-300 focus:ring focus:ring-blue-500'
            >
              {(selectedYear === 'irregular' ? irregularSemTabs : semTabs).map((tab, idx) => (
                <option key={tab.value} value={idx}>
                  {tab.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center text-xs gap-2 px-4 py-2 rounded-lg cursor-pointer text-white bg-blue-500 hover:bg-blue-600"
            >
              <Settings2 className="h-4 w-4" /> Configure
            </button>
            <button
              type="button"
              onClick={handleExportClick}
              className="inline-flex items-center text-xs gap-2 px-4 py-2 rounded-lg cursor-pointer text-white bg-green-500 hover:bg-green-600"
            >
              <Download className="h-4 w-4" /> Export
            </button>

          </div>
          
      </div>

      
          


      <div className="overflow-x-auto border-x border-gray-300 rounded-xl shadow-sm mb-4">
  <table className="min-w-full text-sm border-separate border-spacing-0 rounded-xl overflow-hidden shadow-sm">
    <thead>
      <tr className="bg-blue-500 text-white text-xs uppercase font-semibold">
       
        <th
          className="px-6 py-2 border-b font-semibold cursor-pointer"
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
          className="px-6 py-2 border-b font-semibold text-left cursor-pointer"
          onClick={() => toggleSort('gwa')}
          role="button"
          title="Sort by GWA"
        >
          <div className="flex items-start justify-start gap-2">
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
            
            <td className="px-4 py-2 border-b border-gray-300">
              <div className="bg-gray-200 rounded-md h-5 w-3/4"></div>
            </td>
            <td className="px-4 py-2 border-b border-gray-200 text-center w-1/4">
              <div className="bg-gray-200 rounded-md h-5 w-1/4 mx-auto"></div>
            </td>
          </tr>
        ))
      ) : deansList.length === 0 ? (
        <tr>
          <td className="px-6 py-2 border-b border-slate-300 text-center text-gray-500" colSpan={3}>
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
            <td className="px-6 py-2 border-b border-gray-300  ">{student.name}</td>
            <td className="px-6 py-2 border-b border-gray-300 ">{parseFloat(student.gwa).toFixed(2)}</td>
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
        className="px-4 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition"
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
          className="fixed bottom-6 right-6 z-40 cursor-pointer rounded-full bg-blue-600 text-white px-6 py-2 shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
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
    </div>
  );
};

export default ReportsModule;
