import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, writeBatch, doc } from 'firebase/firestore';
import { RefreshCw, Search, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
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
  text = text.replace(UID_PATTERN, 'record');

  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
};

// ─── Component ─────────────────────────────────────────────────────────────────

const LogsPlaceholder = () => {
  const [logs,        setLogs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [error,       setError]       = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resettingLogs, setResettingLogs] = useState(false);

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
        limit(50)
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

  const handleResetLogs = async () => {
    setResettingLogs(true);
    setError('');
    try {
      const snapshot = await getDocs(collection(db, 'systemLogs'));
      for (let index = 0; index < snapshot.docs.length; index += 450) {
        const batch = writeBatch(db);
        snapshot.docs.slice(index, index + 450).forEach((docSnap) => {
          batch.delete(doc(db, 'systemLogs', docSnap.id));
        });
        await batch.commit();
      }
      setLogs([]);
      setCurrentPage(1);
      setResetModalOpen(false);
    } catch (resetError) {
      console.error('Error resetting logs:', resetError);
      setError(resetError.message || 'Failed to reset logs.');
    } finally {
      setResettingLogs(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'System Logs' }]} className="" />

      {/* Header */}
      <div className="space-y-1">
        <h5 className="text-2xl font-medium text-gray-900">System Activity Logs</h5>
        <p className="text-sm text-gray-600 max-w-2xl">
          Review recent system activities, including actions taken by professors and administrators
          across various modules. Click on any log entry to view more details or navigate to the
          relevant section.
        </p>
      </div>

       {/* Toolbar */}
        <div className="">
          <div className="flex items-center justify-between">
           

           

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
               <button
                type="button"
                onClick={() => setResetModalOpen(true)}
                disabled={loading || logs.length === 0}
                              className="p-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

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

          </div>
        </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
       

        {/* Table Header */}
        <div className="hidden grid-cols-[1fr_1fr_0.8fr_1fr_1.5fr] gap-3 border-b border-gray-200 bg-blue-500  px-4 py-3 text-xs font-semibold uppercase text-white md:grid">
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

      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Reset System Logs?</h3>
              </div>
            
            </div>

            <div className="px-6 py-5">
              <div className="text-slate-500">
                This will permanently delete all saved activity logs. This action cannot be undone. All log history in `System Logs` will be removed.
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                disabled={resettingLogs}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-600 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetLogs}
                disabled={resettingLogs}
                className="px-4 py-1.5 w-24 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
              >
                {resettingLogs ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogsPlaceholder;
