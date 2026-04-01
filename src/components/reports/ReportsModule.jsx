import { useState, useEffect } from 'react';
import { exportDeanListToExcel } from '../../utils/excelExport';
import { getStudents, getCoursesByCurriculum } from '../../models/curriculumModels';


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
    major: 1.7,
    minor: 2.0,
    gwa: 2.0
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
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1" title="Dean's List Major Subject Grade Cutoff">
              <i className="bi bi-star-fill text-yellow-500"></i>Major Grade
            </label>
            <input type="number" step="0.01" value={criteria.major} onChange={e => setCriteria(c => ({ ...c, major: parseFloat(e.target.value) }))} className="border rounded px-2 py-1 w-24 focus:ring-2 focus:ring-blue-300" />
          </div>
          <div className="flex flex-col items-start">
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1" title="Dean's List Minor Subject Grade Cutoff">
              <i className="bi bi-star"></i>Minor Grade
            </label>
            <input type="number" step="0.01" value={criteria.minor} onChange={e => setCriteria(c => ({ ...c, minor: parseFloat(e.target.value) }))} className="border rounded px-2 py-1 w-24 focus:ring-2 focus:ring-blue-300" />
          </div>
          <div className="flex flex-col items-start">
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1" title="Dean's List GWA Cutoff">
              <i className="bi bi-graph-up"></i>GWA
            </label>
            <input type="number" step="0.01" value={criteria.gwa} onChange={e => setCriteria(c => ({ ...c, gwa: parseFloat(e.target.value) }))} className="border rounded px-2 py-1 w-24 focus:ring-2 focus:ring-blue-300" />
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
              <th className="p-2 border">Show Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-2 border text-center" colSpan={5}>Loading...</td></tr>
            ) : deansList.length === 0 ? (
              <tr><td className="p-2 border text-center" colSpan={5}>No data found.</td></tr>
            ) : (
              deansList.map((student, idx) => (
                <>
                  <tr key={idx} className="hover:bg-blue-50 transition cursor-pointer" onClick={() => setExpandedStudent(expandedStudent === idx ? null : idx)}>
                    <td className="p-2 border font-semibold text-blue-700 flex items-center gap-2">
                      <i className="bi bi-person-circle text-lg text-blue-400"></i> {student.name}
                    </td>
                    <td className="p-2 border font-bold text-green-700">{student.gwa}</td>
                    <td className="p-2 border text-center">
                      <button className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow" onClick={e => { e.stopPropagation(); setExpandedStudent(expandedStudent === idx ? null : idx); }}>
                        {expandedStudent === idx ? 'Hide' : 'Show'}
                      </button>
                    </td>
                  </tr>
                  {expandedStudent === idx && (
                    <tr>
                      <td colSpan={5} className="bg-blue-50 p-0">
                        <div className="p-4">
                          <h4 className="font-semibold text-blue-700 mb-2">Subject Grades</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs border">
                              <thead>
                                <tr className="bg-blue-200">
                                  <th className="p-2 border">Subject</th>
                                  <th className="p-2 border">Grade</th>
                                  <th className="p-2 border">Major</th>
                                </tr>
                              </thead>
                              <tbody>
                                {student.grades.map((grade, gidx) => (
                                  <tr key={gidx}>
                                    <td className="p-2 border">{grade.subject}</td>
                                    <td className="p-2 border font-semibold text-gray-800">{grade.grade}</td>
                                    <td className="p-2 border">{grade.isMajor ? 'Yes' : 'No'}</td>
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
