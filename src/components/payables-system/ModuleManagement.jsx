import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ToggleLeft, ToggleRight, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react';
import { getCurriculums, getAllCourses } from '../../models/curriculumModels';
import { getActiveTerm } from '../../models/facultyModels';
import { setCourseOfferedStatus } from '../../models/payablesModels';

const SEMESTER_LABELS = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };
const YEAR_LABELS = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };

const ModuleManagement = ({ open, onClose, onChanged }) => {
  const [courses, setCourses] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [curriculumFilter, setCurriculumFilter] = useState('');
  const [yearLevelFilter, setYearLevelFilter] = useState('1');
  const [semesterFilter, setSemesterFilter] = useState('1');
  const [activeTerm, setActiveTerm] = useState({ semester: 1, schoolYear: '' });
  const [busyIds, setBusyIds] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: 'subject', direction: 'ascending' });

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const refresh = async () => {
    setLoading(true);
    setError('');
    const [cur, crs, term] = await Promise.all([getCurriculums(), getAllCourses(), getActiveTerm()]);
    if (term.success) {
      const nextTerm = term.data || { semester: 1, schoolYear: '' };
      setActiveTerm(nextTerm);
      setSemesterFilter(String(Number(nextTerm.semester) || 1));
    }
    if (cur.success) {
      setCurriculums(cur.data);
      if (cur.data.length > 0) {
        setCurriculumFilter(cur.data[0].id);
      }
    }
    if (crs.success) setCourses(crs.data);
    if (!cur.success) setError(cur.error || 'Failed to load curriculums.');
    if (!crs.success) setError(prev => prev || crs.error || 'Failed to load courses.');
    if (!term.success) setError(prev => prev || term.error || 'Failed to load active semester.');
    setLoading(false);
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const counts = useMemo(() => {
    const currentSemesterCourses = courses.filter(c => c.semester === Number(semesterFilter));
    const offered = currentSemesterCourses.filter(c => !!c.isOffered).length;
    return {
      total: currentSemesterCourses.length,
      offered,
      notOffered: currentSemesterCourses.length - offered
    };
  }, [courses, semesterFilter]);

  const filtered = useMemo(() => {
    let result = courses.filter(c => {
      if (curriculumFilter && c.curriculumId !== curriculumFilter) return false;
      if (yearLevelFilter !== 'all' && c.yearLevel !== Number(yearLevelFilter)) return false;
      if (c.semester !== Number(semesterFilter)) return false;
      return true;
    });

    result.sort((a, b) => {
      if (!!a.isOffered !== !!b.isOffered) {
        return a.isOffered ? -1 : 1;
      }
      if (sortConfig.key === 'subject') {
        const aValue = (a.courseCode || '').toLowerCase();
        const bValue = (b.courseCode || '').toLowerCase();
        return sortConfig.direction === 'ascending'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      return (a.courseCode || '').localeCompare(b.courseCode || '');
    });

    return result;
  }, [courses, curriculumFilter, yearLevelFilter, semesterFilter, sortConfig]);

  const toggleOffered = async (course) => {
    setError('');
    setBusyIds(prev => new Set(prev).add(course.id));
    const res = await setCourseOfferedStatus(course.id, !course.isOffered);
    setBusyIds(prev => {
      const next = new Set(prev);
      next.delete(course.id);
      return next;
    });
    if (res.success) {
      setCourses(prev => prev.map(c =>
        c.id === course.id ? { ...c, isOffered: !course.isOffered } : c
      ));
      if (onChanged) onChanged();
    } else {
      setError(res.error || 'Failed to update module.');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-gray-200 rounded-t-2xl bg-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h6 className="text-xl font-semibold text-gray-800">Offered Subjects</h6>
              <p className="text-sm text-gray-500 mt-0.5">
                Manage which subjects are offered as modules for the <strong>{SEMESTER_LABELS[activeTerm.semester]} {activeTerm.schoolYear}</strong> term. Toggle the offered status of each subject, and use the filters to find specific subjects.
              </p>
             
            </div>

             <button
                  type="button"
            onClick={onClose}
                  className="rounded-full bg-white p-1 cursor-pointer text-slate-500 hover:text-red-600 transition"
                  aria-label="Close"
                >
                  <X className="h-5 w-5 " />
                </button>
          </div>

       
          
         

          {error && (
            <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}
        </div>

         <div className="flex gap-2 justify-between px-6 py-4">
           {/* Year Filter */}
  <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4].map((y, index, arr) => (
              <button
                key={y}
                type="button"
                onClick={() => setYearLevelFilter(String(y))}
              className={`rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
                  yearLevelFilter === String(y)
                     ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
                }`}
              >
                {YEAR_LABELS[y]}
              </button>
            ))}
          </div>


            {/* Curriculum and active semester indicator side by side */}
            <div className="flex gap-2 w-full md:w-auto">
              <select
                value={curriculumFilter}
                onChange={(e) => setCurriculumFilter(e.target.value)}
               className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
              >
                {curriculums.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            
            </div>
          </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading ? (
            <p className="py-12 text-center text-sm text-gray-500">Loading subjects...</p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No subjects match the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm text-left bg-white">
                <thead className="bg-blue-500 text-white">
                  <tr>
                    <th className="px-3 py-2 cursor-pointer w-[80%]" onClick={() => handleSort('subject')}>
                      <div className="flex items-center gap-1">
                        Subject
                        {sortConfig.key === 'subject' ? (
                          sortConfig.direction === 'ascending' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-4 w-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-3 py-2 w-[10%]">Units</th>
                    <th className="px-3 py-2 w-[10%]">Offered</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className={`border-t border-slate-200 ${busyIds.has(c.id) ? 'opacity-80' : ''}`}>
                      <td className="px-3 py-3">
                        <div>
                          <div className="font-medium text-slate-900">{c.courseCode}</div>
                          <div className="text-slate-600">{c.courseTitle}</div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{c.units || '—'}</td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => toggleOffered(c)}
                          disabled={busyIds.has(c.id)}
                          className={`relative inline-flex h-6 w-10 items-center rounded-full transition-all duration-300 ${
                            c.isOffered
                              ? 'bg-green-500 shadow-sm shadow-green-200'
                              : 'bg-gray-300'
                          } ${
                            busyIds.has(c.id)
                              ? 'cursor-not-allowed opacity-60'
                              : 'cursor-pointer'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                              c.isOffered ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          >
                          
                          </span>
                        </button>
</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

     
      </div>
    </div>
  );
};

export default ModuleManagement;
