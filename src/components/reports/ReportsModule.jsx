import { useState, useEffect, useRef, useCallback } from 'react';
import { exportDeanListToExcel } from '../../utils/excelExport';
import { getStudents, getCoursesByCurriculum } from '../../models/curriculumModels';
import { Settings2, Download, CalendarCheck, X, ChevronDown, ChevronUp, ChevronsUpDown} from 'lucide-react';

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

const CriteriaModal = ({ isOpen, onClose, criteria, setCriteria }) => {
  const [localCriteria, setLocalCriteria] = useState({ ...criteria });

  useEffect(() => {
    setLocalCriteria({ ...criteria });
  }, [criteria]);

  const handleSave = () => {
    setCriteria(localCriteria);
    onClose();
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
            className="px-4 py-1.5 text-sm cursor-pointer rounded-xl bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold shadow-sm transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm cursor-pointer rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md transition"
          >
            Save
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
                <th className="p-2 border border-gray-300">Subject</th>
                <th className="p-2 border border-gray-300">Grade</th>
              </tr>
            </thead>
            <tbody>
              {student.grades.map((grade, idx) => (
                <tr key={idx} className="hover:bg-blue-50">
                  <td className="p-2 border border-gray-300">{grade.subject}</td>
                  <td className="p-2 border border-gray-300 font-semibold text-center text-gray-800">{parseFloat(grade.grade).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
       
      </div>
    </div>
  );
};

const ReportsModule = ({ onBackToDashboard }) => {
  const [criteria, setCriteria] = useState({
    major: 1.7,
    minor: 2.0,
    gwa: 2.0
  });
  const [tabYear, setTabYear] = useState(0);
  const [tabSem, setTabSem] = useState(0);
  const [selectedYear, setSelectedYear] = useState(1);
  const [selectedSem, setSelectedSem] = useState(1);
  const [deansList, setDeansList] = useState([]);
  const [sortBy, setSortBy] = useState(null); // 'name' | 'gwa'
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [visibleRows, setVisibleRows] = useState(4);
  const observer = useRef();
  const loadMoreRef = useRef();

  useEffect(() => {
    setSelectedYear(yearTabs[tabYear].value);
  }, [tabYear]);
  useEffect(() => {
    setSelectedSem(semTabs[tabSem].value);
  }, [tabSem]);

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
      const semVal = selectedSem;
      const filtered = students.filter(s => {
        if (yearVal === 'irregular') return s.isIrregular;
        return !s.isIrregular && s.yearLevel === yearVal;
      });
      const deanCandidates = [];
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
          deanCandidates.push({
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

  const handleDownload = () => {
    exportDeanListToExcel(deansList);
  };

  const toggleSort = field => {
    if (sortBy === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  return (
    <div className="mt-6">
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-300 mb-6">
        <div className="flex items-center gap-6">
          <button
            onClick={onBackToDashboard}
            className="group flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white transition-transform"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <span className="hidden sm:inline text-sm font-medium">Back</span>
          </button>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-blue-700">Dean's List Reports</h2>
            <p className="text-gray-600">
              View detailed reports of students who have achieved academic excellence this semester, including GPA breakdowns and honors.
            </p>
          </div>
        </div>
      </div>
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-3 flex-wrap">
            {yearTabs.map((tab, idx) => (
              <button
                key={tab.value}
                onClick={() => setTabYear(idx)}
                className={`px-3 py-1.5 font-semibold rounded-full shadow-md border transition-all flex items-center gap-1 text-sm cursor-pointer ${
                  tabYear === idx
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
              className="border border-blue-300 rounded-full px-3 py-1.5 text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
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
              className="rounded-lg text-sm px-3 py-1.5 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow flex items-center gap-1"
            >
              <Settings2 className="h-4 w-4" /> Configure
            </button>
            <button
              onClick={handleDownload}
              className="rounded-lg text-sm px-3 py-1.5 cursor-pointer bg-green-600 hover:bg-green-700 text-white font-semibold shadow flex items-center gap-1"
            >
              <Download className="h-4 w-4" /> Export Excel
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto border-x border-gray-300 rounded-xl shadow-sm mb-4">
  <table className="min-w-full text-sm border-separate border-spacing-0 rounded-xl overflow-hidden shadow-sm">
    <thead>
      <tr className="bg-blue-100 text-left">
        <th
          className="p-3 border-b font-semibold text-blue-700 cursor-pointer"
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
          className="p-3 border-b font-semibold text-blue-700 text-center cursor-pointer"
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
            <td className="p-3 border-b border-gray-300 w-3/4">
              <div className="bg-gray-200 rounded-md h-5 w-3/4"></div>
            </td>
            <td className="p-3 border-b border-gray-200 text-center w-1/4">
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
        setCriteria={setCriteria}
      />
      <StudentDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        student={selectedStudent}
      />
    </div>
  );
};

export default ReportsModule;