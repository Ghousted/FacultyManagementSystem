import { useState, useEffect } from 'react';
import { exportDeanListToExcel } from '../../utils/excelExport';
import { getStudents, getCoursesByCurriculum, getAllCourses } from '../../models/curriculumModels';
import { evaluateDeansListerEligibility, resolveSemesterCoursesForStudent } from '../../utils/deansListerUtils';


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


const ReportsModule = ({ onBackToDashboard }) => {
  // Customizable parameters for dean's list
  const [criteria, setCriteria] = useState({
    minGrade: 2.1,
    gwa: 2.0,
    minUnits: 15
  });
  const [tabYear, setTabYear] = useState(0);
  const [tabSem, setTabSem] = useState(0);
  const [selectedYear, setSelectedYear] = useState(1);
  const [selectedSem, setSelectedSem] = useState(1);
  const [deansList, setDeansList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState(null);

  // Sync selectedYear/selectedSem with tab
  useEffect(() => {
    setSelectedYear(yearTabs[tabYear].value);
  }, [tabYear]);
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
    };
    fetchDeanList();
  }, [selectedYear, selectedSem, criteria]);

  const handleDownload = () => {
    exportDeanListToExcel(deansList);
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-md mt-6">
      <div className="flex items-center mb-4">
        <button onClick={onBackToDashboard} className="mr-4 px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold shadow transition-all">
          <i className="bi bi-arrow-left mr-1"></i> Back
        </button>
        <h2 className="text-2xl font-bold text-blue-700">Dean's List Reports</h2>
      </div>
      <div className="mb-6">
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
            {yearTabs.map((tab, idx) => (
              <button
                key={tab.value}
                onClick={() => setTabYear(idx)}
                className={`px-4 py-2 font-semibold rounded-full shadow-md border transition-all flex items-center gap-1 text-base ${tabYear === idx ? 'bg-blue-600 text-white border-blue-700 scale-105' : 'bg-white text-blue-700 hover:bg-blue-100 border-gray-300'}`}
                style={{ boxShadow: '0 2px 12px 0 rgba(30, 64, 175, 0.10)' }}
                title={tab.label}
              >
                {tab.value === 'irregular' ? <i className="bi bi-people-fill"></i> : <i className="bi bi-person-badge"></i>}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3 justify-center items-center">
            <label htmlFor="semester-dropdown" className="text-base font-medium text-blue-700 flex items-center gap-2">
              <i className="bi bi-calendar-event"></i>Semester:
            </label>
            <select
              id="semester-dropdown"
              value={tabSem}
              onChange={e => setTabSem(Number(e.target.value))}
              className="border border-blue-300 rounded-full px-4 py-2 text-base shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              {semTabs.map((tab, idx) => (
                <option key={tab.value} value={idx}>{tab.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
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
    </div>
  );
};

export default ReportsModule;
