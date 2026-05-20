import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../firebase';
import Breadcrumbs from './common/Breadcrumbs';

const getLogDateParts = (log) => {
  if (log.date && log.time) {
    return { date: log.date, time: log.time };
  }
  const date = log.createdAt ? new Date(log.createdAt) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return { date: 'Date unavailable', time: '' };
  }
  return {
    date: date.toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric'
    }),
    time: date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  };
};

const getDisplayAction = (log) => {
  const action = (log.action || '').toLowerCase();
  const details = log.details || {};
  if (action === 'full payment recorded') return 'Full Payment Recorded';
  if (action === 'paid payable') return 'Paid Payable';
  if (action.includes('payment') || action.includes('paid') || log.entityType?.toLowerCase().includes('payment')) {
    const remainingBalance = Number(details.remainingBalance ?? details.balanceAfter);
    const status = (details.status || '').toString().toLowerCase();
    if (status.includes('full') || remainingBalance === 0) return 'Paid (Full)';
    return 'Paid (Partial)';
  }
  if (action.includes('delete') || action.includes('removed')) return 'Deleted';
  if (action.includes('add') || action.includes('create')) return 'Created';
  return 'Updated';
};

const getSectionRoute = (log) => {
  const module = (log.module || '').toLowerCase();
  const entityType = (log.entityType || '').toLowerCase();
  if (entityType.includes('otherdepartment')) return '#/payables/other-departments';
  if (entityType.includes('archive')) return '#/archived-classes';
  if (module.includes('payables')) return '#/payables';
  if (module.includes('faculty')) return '#/faculty';
  if (module.includes('reports')) return '#/deans-list-report';
  if (module.includes('curriculum')) {
    if (entityType.includes('curriculum') || entityType.includes('course')) return '#/curriculum-maker';
    return '#/student-management';
  }
  if (module.includes('user')) return '#/settings';
  return '#/dashboard';
};

// ─── UID patterns used throughout the system ───────────────────────────────────
// Firebase UIDs are 28-char alphanumeric. Firestore auto-IDs are 20-char.
const UID_PATTERN = /\b([A-Za-z0-9]{20,28})\b/g;

/**
 * Replace any UID-like tokens in `text` with the resolved name from
 * `entityMap` (which covers both students and professors keyed by doc ID).
 */
const resolveUidsInText = (text, entityMap) => {
  if (!text || !entityMap || Object.keys(entityMap).length === 0) return text;
  return text.replace(UID_PATTERN, (match) => entityMap[match] || match);
};

/**
 * Strip generic "Untitled Payable" text and replace it with a meaningful label
 * derived from the log's own fields when possible.
 */
const cleanUntitledPayable = (text, log) => {
  if (!text || !text.toLowerCase().includes('untitled payable')) return text;

  // Try to build a meaningful replacement from the log's details/entityType
  const details  = log.details  || {};
  const fallback =
    details.courseCode  ||
    details.subjectCode ||
    details.title       ||
    details.name        ||
    (log.entityType && !log.entityType.toLowerCase().includes('payable')
      ? log.entityType
      : null) ||
    'Payable';

  return text.replace(/untitled payable/gi, fallback);
};

/**
 * Build the short detail string shown in the Details column.
 * Resolves UIDs → names and strips "Untitled Payable".
 */
const getShortDetails = (log, entityMap = {}) => {
  let text = (log.description || log.entityType || 'No details')
    .replace(/\s+/g, ' ')
    .trim();

  text = resolveUidsInText(text, entityMap);
  text = cleanUntitledPayable(text, log);

  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
};

// ─── Component ─────────────────────────────────────────────────────────────────

const LogsPlaceholder = () => {
  const [logs,        setLogs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [error,       setError]       = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Unified entity map: both students and professors keyed by Firestore doc ID
  const [entityMap, setEntityMap] = useState({});

  const logsPerPage = 10;

  // ── Fetch professors and students, merge into one ID→name map ──────────────
  const fetchEntities = async () => {
    try {
      const [profSnap, stuSnap] = await Promise.all([
        getDocs(query(collection(db, 'professors'))),
        getDocs(query(collection(db, 'students'))),
      ]);

      const map = {};

      profSnap.forEach((docSnap) => {
        const d = docSnap.data();
        map[docSnap.id] = d.name || d.displayName || d.email || 'Unknown Professor';
      });

      stuSnap.forEach((docSnap) => {
        const d = docSnap.data();
        // Students may also be Firebase Auth users whose UID matches the doc ID
        map[docSnap.id] = d.name || d.displayName || d.email || 'Unknown Student';
      });

      setEntityMap(map);
    } catch (err) {
      console.error('Error fetching entity names:', err);
    }
  };

  // ── Fetch logs ─────────────────────────────────────────────────────────────
  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const logsQuery = query(
        collection(db, 'systemLogs'),
        orderBy('timestamp', 'desc'),
        limit(200)
      );
      const snapshot = await getDocs(logsQuery);
      setLogs(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    } catch (loadError) {
      console.error('Error loading system logs:', loadError);
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntities();
    loadLogs();
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) => [
      log.action,
      log.module,
      log.description,
      log.role,
      log.userName,
      log.userEmail,
      log.entityType,
      log.entityId,
      entityMap[log.userId] || '',
      entityMap[log.entityId] || '',
    ].some((value) => (value || '').toString().toLowerCase().includes(term)));
  }, [logs, search, entityMap]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages   = Math.ceil(filteredLogs.length / logsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * logsPerPage,
    currentPage * logsPerPage
  );

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const startLog = (currentPage - 1) * logsPerPage + 1;
  const endLog   = Math.min(currentPage * logsPerPage, filteredLogs.length);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'System Logs' }]} className="" />

      {/* Header */}
      <div className="space-y-1">
        <h5 className="text-2xl font-bold text-gray-900">System Activity Logs</h5>
        <p className="text-sm text-gray-600 max-w-2xl">
          Review recent system activities, including actions taken by professors and administrators
          across various modules. Click on any log entry to view more details or navigate to the
          relevant section.
        </p>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between">
           

            {/* Pagination */}
            <div className="flex items-center gap-2">
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1 rounded-full bg-gray-300 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-full bg-gray-300 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <span className="text-xs text-gray-500">
                Showing {startLog}–{endLog} out of {filteredLogs.length} logs
              </span>
            </div>

             {/* Search + refresh */}
            <div className="flex items-center gap-2">
              <button
                onClick={loadLogs}
                disabled={loading}
className="p-2.5 rounded-lg bg-white border cursor-pointer border-slate-200 hover:bg-slate-50 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search logs..."
className="w-full border text-sm border-slate-200 bg-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Table Header */}
        <div className="hidden grid-cols-[1fr_1fr_0.8fr_1fr_1.5fr] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-gray-500 md:grid">
          <span>Action</span>
          <span>Section</span>
          <span>User</span>
          <span>Date / Time</span>
          <span>Details</span>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_0.8fr_1fr_1.5fr]">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 animate-pulse rounded bg-gray-100" />
                ))}
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-red-600">
            Unable to load logs: {error}
          </div>
        ) : paginatedLogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No logs found.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {paginatedLogs.map((log) => {
              const dateParts = getLogDateParts(log);
              return (
                <button
                  key={log.id}
                  onClick={() => { window.location.hash = getSectionRoute(log); }}
                  className="grid w-full grid-cols-1 gap-3 px-4 py-4 text-left text-sm transition-all hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-200 md:grid-cols-[1fr_1fr_0.8fr_1fr_1.5fr]"
                >
                  <p className="font-semibold text-gray-900">{getDisplayAction(log)}</p>
                  <p className="text-gray-700">{log.module || 'System'}</p>
                  <p className="text-xs font-semibold uppercase text-blue-600">
                    {(log.role || 'Unknown Role').toString().toUpperCase()}
                  </p>
                  <div className="text-gray-600">
                    <p>{dateParts.date}</p>
                    <p className="mt-1 text-xs text-gray-400">{dateParts.time}</p>
                  </div>
                  {/* Details: UIDs resolved to names, "Untitled Payable" cleaned up */}
                  <p className="text-gray-600">{getShortDetails(log, entityMap)}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsPlaceholder;
