import { useEffect, useMemo, useState } from 'react';
import { Search, X, Package, BookOpen, ToggleLeft, ToggleRight } from 'lucide-react';
import { getCurriculums, getAllCourses } from '../../models/curriculumModels';
import { setCourseOfferedStatus } from '../../models/payablesModels';

const SEMESTER_LABELS = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };

const ModuleManagement = ({ open, onClose, onChanged }) => {
  const [courses, setCourses] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [curriculumFilter, setCurriculumFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'offered' | 'not-offered'
  const [busyIds, setBusyIds] = useState(new Set());

  const refresh = async () => {
    setLoading(true);
    setError('');
    const [cur, crs] = await Promise.all([getCurriculums(), getAllCourses()]);
    if (cur.success) setCurriculums(cur.data);
    if (crs.success) setCourses(crs.data);
    if (!cur.success) setError(cur.error || 'Failed to load curriculums.');
    if (!crs.success) setError(prev => prev || crs.error || 'Failed to load courses.');
    setLoading(false);
  };

  useEffect(() => { if (open) refresh(); }, [open]);

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
    return courses.filter(c => {
      if (curriculumFilter !== 'all' && c.curriculumId !== curriculumFilter) return false;
      if (statusFilter === 'offered' && !c.isOffered) return false;
      if (statusFilter === 'not-offered' && c.isOffered) return false;
      if (!q) return true;
      return (
        (c.courseCode || '').toLowerCase().includes(q) ||
        (c.courseTitle || '').toLowerCase().includes(q)
      );
    }).sort((a, b) => {
      // Offered first, then by code
      if (!!a.isOffered !== !!b.isOffered) return a.isOffered ? -1 : 1;
      return (a.courseCode || '').localeCompare(b.courseCode || '');
    });
  }, [courses, search, curriculumFilter, statusFilter]);

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-4 border-b border-gray-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-blue-600 text-xs font-semibold uppercase tracking-wide mb-1">
                <Package className="w-3.5 h-3.5" /> Module Management
              </div>
              <h6 className="text-xl font-semibold text-gray-800">Offered Subjects</h6>
              <p className="text-sm text-gray-500 mt-0.5">
                Mark subjects from your curriculums as <span className="font-medium">offered</span> so they appear when adding Module payables.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 cursor-pointer shrink-0"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { key: 'all', label: 'All Subjects', count: counts.total, color: 'border-gray-200' },
              { key: 'offered', label: 'Offered', count: counts.offered, color: 'border-green-200' },
              { key: 'not-offered', label: 'Not Offered', count: counts.notOffered, color: 'border-gray-200' }
            ].map(c => {
              const active = statusFilter === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setStatusFilter(c.key)}
                  className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                    active ? 'border-blue-500 ring-2 ring-blue-100' : c.color + ' hover:border-gray-300'
                  }`}
                >
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className="text-lg font-semibold text-gray-800">{c.count}</p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by code or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <select
              value={curriculumFilter}
              onChange={(e) => setCurriculumFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">All Curriculums</option>
              {curriculums.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
              {filtered.map(c => {
                const busy = busyIds.has(c.id);
                const offered = !!c.isOffered;
                return (
                  <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800 text-sm">{c.courseCode}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          Year {c.yearLevel} · {SEMESTER_LABELS[c.semester] || `Sem ${c.semester}`}
                        </span>
                        {Number(c.units) > 0 && (
                          <span className="text-xs text-gray-500">{c.units} units</span>
                        )}
                        {offered && (
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">
                            Offered
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 truncate">{c.courseTitle}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {curriculumNameById.get(c.curriculumId) || 'Unknown curriculum'}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleOffered(c)}
                      disabled={busy}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer disabled:opacity-60 ${
                        offered
                          ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                      title={offered ? 'Mark as not offered' : 'Mark as offered'}
                    >
                      {offered ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      {offered ? 'Offered' : 'Not Offered'}
                    </button>
                  </li>
                );
              })}
            </ul>
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
