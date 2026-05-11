import { useEffect, useMemo, useState } from 'react';
import { Search, X, Package, BookOpen, ToggleLeft, ToggleRight, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { getCurriculums, getAllCourses } from '../../models/curriculumModels';
import { setCourseOfferedStatus } from '../../models/payablesModels';

const SEMESTER_LABELS = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };
const YEAR_LABELS = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };

const ModuleManagement = ({ open, onClose, onChanged }) => {
  const [courses, setCourses] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [curriculumFilter, setCurriculumFilter] = useState('');
  const [yearLevelFilter, setYearLevelFilter] = useState('1');
  const [semesterFilter, setSemesterFilter] = useState('all');
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
    const [cur, crs] = await Promise.all([getCurriculums(), getAllCourses()]);
    if (cur.success) {
      setCurriculums(cur.data);
      if (cur.data.length > 0) {
        setCurriculumFilter(cur.data[0].id);
      }
    }
    if (crs.success) setCourses(crs.data);
    if (!cur.success) setError(cur.error || 'Failed to load curriculums.');
    if (!crs.success) setError(prev => prev || crs.error || 'Failed to load courses.');
    setLoading(false);
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const curriculumNameById = useMemo(() => {
    const map = new Map();
    curriculums.forEach(c => map.set(c.id, c.name));
    return map;
  }, [curriculums]);

  const counts = useMemo(() => {
    const offered = courses.filter(c => !!c.isOffered).length;
    return { total: courses.length, offered, notOffered: courses.length - offered };
  }, [courses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = courses.filter(c => {
      if (curriculumFilter && c.curriculumId !== curriculumFilter) return false;
      if (yearLevelFilter !== 'all' && c.yearLevel !== Number(yearLevelFilter)) return false;
      if (semesterFilter !== 'all' && c.semester !== Number(semesterFilter)) return false;
      if (!q) return true;
      return (
        (c.courseCode || '').toLowerCase().includes(q) ||
        (c.courseTitle || '').toLowerCase().includes(q)
      );
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
  }, [courses, search, curriculumFilter, yearLevelFilter, semesterFilter, sortConfig]);

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
        <div className="px-6 pt-5 pb-4 border-b border-gray-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h6 className="text-xl font-semibold text-gray-800">Offered Subjects</h6>
              <p className="text-sm text-gray-500 mt-0.5">
                Mark subjects from your curriculums as <span className="font-medium">offered</span> so they appear when adding Module payables.
              </p>
            </div>
          </div>

          {/* Stats Card */}
          <div className="flex gap-4 mt-4">
            <div className="flex-1 p-3 bg-slate-50 rounded-xl">
              <p className="text-2xl font-bold text-slate-800">{counts.total}</p>
              <p className="text-xs text-slate-500">Total Subjects</p>
            </div>
            <div className="flex-1 p-3 bg-green-50 rounded-xl">
              <p className="text-2xl font-bold text-green-700">{counts.offered}</p>
              <p className="text-xs text-green-600">Offered</p>
            </div>
            <div className="flex-1 p-3 bg-red-50 rounded-xl">
              <p className="text-2xl font-bold text-red-700">{counts.notOffered}</p>
              <p className="text-xs text-red-600">Not Offered</p>
            </div>
          </div>

          {/* Year Filter */}
          <div className="flex gap-2 bg-gray-200/50 p-1 rounded-xl w-full my-4">
            {[1, 2, 3, 4].map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYearLevelFilter(String(y))}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  yearLevelFilter === String(y)
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 cursor-pointer'
                }`}
              >
                {YEAR_LABELS[y]}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by code or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="
                  w-full rounded-xl border border-gray-200 bg-white
                  py-2.5 pl-10 pr-4 text-sm text-gray-700
                  shadow-sm transition-all
                  placeholder:text-gray-400
                  focus:border-blue-400 focus:outline-none
                  focus:ring-4 focus:ring-blue-100
                "
              />
            </div>

            {/* Curriculum and Semester Filters Side by Side */}
            <div className="flex gap-2 w-full md:w-auto">
              <select
                value={curriculumFilter}
                onChange={(e) => setCurriculumFilter(e.target.value)}
                className="
                  rounded-xl border border-gray-200 bg-white
                  px-4 py-2.5 text-sm text-gray-700
                  shadow-sm transition-all
                  focus:border-blue-400 focus:outline-none
                  focus:ring-4 focus:ring-blue-100
                "
              >
                {curriculums.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                className="
                  rounded-xl border border-gray-200 bg-white
                  px-4 py-2.5 text-sm text-gray-700
                  shadow-sm transition-all
                  focus:border-blue-400 focus:outline-none
                  focus:ring-4 focus:ring-blue-100
                "
              >
                <option value="all">All Semesters</option>
                {Object.entries(SEMESTER_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="py-12 text-center text-sm text-gray-500">Loading subjects...</p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No subjects match the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 w-12">&nbsp;</th>
                    <th className="px-3 py-2 cursor-pointer" onClick={() => handleSort('subject')}>
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
                    <th className="px-3 py-2">Year</th>
                    <th className="px-3 py-2">Units</th>
                    <th className="px-3 py-2">Offered</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className={`border-t border-slate-200 ${busyIds.has(c.id) ? 'opacity-80' : ''}`}>
                      <td className="px-3 py-3">&nbsp;</td>
                      <td className="px-3 py-3">
                        <div>
                          <div className="font-medium text-slate-900">{c.courseCode}</div>
                          <div className="text-slate-600">{c.courseTitle}</div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{YEAR_LABELS[c.yearLevel]}</td>
                      <td className="px-3 py-3 text-slate-600">{c.units || '—'}</td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => toggleOffered(c)}
                          disabled={busyIds.has(c.id)}
                          className={`p-1 rounded-full transition ${
                            c.isOffered
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                          }`}
                        >
                          {c.isOffered ? (
                            <ToggleRight className="h-4 w-4" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModuleManagement;