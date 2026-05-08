import { useEffect, useMemo, useState } from 'react';
import { Search, UserCheck, UserX, AlertTriangle, Users } from 'lucide-react';
import {
  getEnrollmentRoster,
  setStudentEnrollment,
  setStudentNotEnrolled,
  bulkSetStudentEnrollment
} from '../../models/facultyModels';

const SEMESTER_LABELS = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };

const STATUS_META = {
  enrolled: {
    label: 'Enrolled',
    pill: 'bg-green-50 text-green-700 border-green-200'
  },
  'needs-update': {
    label: 'Needs re-enrollment',
    pill: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  'not-enrolled': {
    label: 'Not enrolled',
    pill: 'bg-gray-100 text-gray-600 border-gray-200'
  },
  unset: {
    label: 'Unset (legacy)',
    pill: 'bg-blue-50 text-blue-700 border-blue-200'
  }
};

const EnrollmentManager = ({ activeTerm }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyIds, setBusyIds] = useState(new Set());
  const [error, setError] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  const termIncomplete = !activeTerm?.semester || !activeTerm?.schoolYear;

  const refresh = async () => {
    setLoading(true);
    const res = await getEnrollmentRoster(activeTerm);
    if (res.success) setStudents(res.data);
    else setError(res.error || 'Failed to load students.');
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [activeTerm?.semester, activeTerm?.schoolYear]);

  const counts = useMemo(() => {
    const c = { enrolled: 0, 'needs-update': 0, 'not-enrolled': 0, unset: 0 };
    students.forEach(s => { c[s.enrollmentStatus] = (c[s.enrollmentStatus] || 0) + 1; });
    return c;
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(s => {
      if (statusFilter !== 'all' && s.enrollmentStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        (s.name || '').toLowerCase().includes(q) ||
        (s.studentNumber || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      );
    });
  }, [students, search, statusFilter]);

  const setBusy = (id, on) => {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };

  const handleEnroll = async (s) => {
    if (termIncomplete) return;
    setError('');
    setBusy(s.id, true);
    const res = await setStudentEnrollment(s.id, activeTerm);
    setBusy(s.id, false);
    if (!res.success) setError(res.error || 'Failed to enroll student.');
    else await refresh();
  };

  const handleUnenroll = async (s) => {
    setError('');
    setBusy(s.id, true);
    const res = await setStudentNotEnrolled(s.id);
    setBusy(s.id, false);
    if (!res.success) setError(res.error || 'Failed to unenroll student.');
    else await refresh();
  };

  const handleBulkEnrollVisible = async () => {
    if (termIncomplete) return;
    const ids = filtered
      .filter(s => s.enrollmentStatus !== 'enrolled')
      .map(s => s.id);
    if (ids.length === 0) return;
    setError('');
    setBulkSaving(true);
    const res = await bulkSetStudentEnrollment(ids, activeTerm);
    setBulkSaving(false);
    if (!res.success) setError(res.error || 'Failed to bulk enroll.');
    else await refresh();
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h6 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> Student Enrollment
          </h6>
          <p className="text-sm text-gray-500">
            Mark which students are enrolled for{' '}
            <span className="font-medium text-gray-700">
              {SEMESTER_LABELS[activeTerm?.semester] || '1st Sem'}
              {activeTerm?.schoolYear ? ` · S.Y. ${activeTerm.schoolYear}` : ''}
            </span>. Only enrolled students appear in subject rosters.
          </p>
        </div>
      </div>

      {termIncomplete && (
        <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Set the active term's school year above before managing enrollment.</span>
        </div>
      )}

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {['enrolled', 'needs-update', 'not-enrolled', 'unset'].map(key => {
          const meta = STATUS_META[key];
          const active = statusFilter === key;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(active ? 'all' : key)}
              className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                active ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-xs text-gray-500">{meta.label}</p>
              <p className="text-xl font-semibold text-gray-800 mt-0.5">{counts[key] || 0}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, student number, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <button
          onClick={() => setStatusFilter('all')}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
          disabled={statusFilter === 'all'}
        >
          All
        </button>
        <button
          onClick={handleBulkEnrollVisible}
          disabled={termIncomplete || bulkSaving || filtered.every(s => s.enrollmentStatus === 'enrolled')}
          className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
          title="Mark every visible student as enrolled for the active term"
        >
          {bulkSaving ? 'Working...' : 'Enroll all visible'}
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500 text-sm">Loading students...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">No students match the filter.</div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600 uppercase text-xs tracking-wide">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Year / Block</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Term on File</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const meta = STATUS_META[s.enrollmentStatus] || STATUS_META.unset;
                const block = (s.block || '').toString().trim().toUpperCase() || 'A';
                const term = s.enrolledTerm;
                const termText = term?.semester
                  ? `${SEMESTER_LABELS[term.semester] || `Sem ${term.semester}`}${term.schoolYear ? ` · ${term.schoolYear}` : ''}`
                  : '—';
                const busy = busyIds.has(s.id);
                const isEnrolledHere = s.enrollmentStatus === 'enrolled';
                return (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{s.name}</p>
                      <p className="text-xs text-gray-500">
                        {s.studentNumber || '—'}{s.isIrregular ? ' · Irregular' : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      Year {s.yearLevel || '—'} · Block {block}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${meta.pill}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{termText}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!isEnrolledHere && (
                          <button
                            onClick={() => handleEnroll(s)}
                            disabled={termIncomplete || busy}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Enroll
                          </button>
                        )}
                        {s.enrollmentStatus !== 'not-enrolled' && (
                          <button
                            onClick={() => handleUnenroll(s)}
                            disabled={busy}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 cursor-pointer"
                          >
                            <UserX className="w-3.5 h-3.5" /> Unenroll
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EnrollmentManager;
