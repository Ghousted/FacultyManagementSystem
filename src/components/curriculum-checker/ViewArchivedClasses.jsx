import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

// ── helpers ───────────────────────────────────────────────────────────────────

const formatBatchLabel = (id) => id.replace('batch_', '').replace('_', '-');

const payableClass = (status) => {
  if (status === 'paid') return 'pay-paid';
  if (status === 'pending') return 'pay-pending';
  return 'pay-overdue';
};

const countPayables = (students = [], status) =>
  students.flatMap((s) => s.payables || []).filter((p) => p.status === status).length;

const uniqueSubjects = (students = []) =>
  [...new Set(students.flatMap((s) =>
    Object.values(s.grades || {}).flatMap((sem) =>
      typeof sem === 'object' ? Object.keys(sem) : []
    )
  ))].length;

/**
 * Normalizes student.grades into:
 *   { "Year 1": { "1st Semester": { CS101: "1.5" }, "2nd Semester": { ... } }, ... }
 *
 * Falls back gracefully if grades is a flat { code: grade } object (legacy).
 */
const normalizeGrades = (grades) => {
  if (!grades || typeof grades !== 'object') return {};
  const firstVal = Object.values(grades)[0];
  if (firstVal && typeof firstVal === 'object' && !Array.isArray(firstVal)) {
    const deepVal = Object.values(firstVal)[0];
    if (deepVal && typeof deepVal === 'object') return grades; // already nested
  }
  return { 'Year 1': { '1st Semester': grades } }; // legacy flat shape
};

const gradeColor = (val) => {
  const n = parseFloat(val);
  if (isNaN(n)) return s.gradeNeutral;
  if (n <= 1.5) return s.gradeExcellent;
  if (n <= 3.0) return s.gradePass;
  return s.gradeFail;
};

// ── GradesTable ───────────────────────────────────────────────────────────────

const GradesTable = ({ grades }) => {
  const normalized = normalizeGrades(grades);
  const years = Object.keys(normalized).sort();

  if (years.length === 0)
    return <p style={s.noData}>No grade records available.</p>;

  return (
    <div style={s.gradesWrap}>
      {years.map((year) => {
        const semesters = normalized[year];
        const semKeys = Object.keys(semesters).sort();
        return (
          <div key={year} style={s.yearBlock}>
            <div style={s.yearLabel}>{year}</div>
            <div style={s.semGrid}>
              {semKeys.map((sem) => {
                const subjects = semesters[sem];
                const entries = Object.entries(subjects || {});
                const validGrades = entries.filter(([, g]) => !isNaN(parseFloat(g)));
                const gwa = validGrades.length
                  ? (validGrades.reduce((acc, [, g]) => acc + parseFloat(g), 0) / validGrades.length).toFixed(2)
                  : '—';
                return (
                  <div key={sem} style={s.semBlock}>
                    <div style={s.semLabel}>{sem}</div>
                    {entries.length === 0 ? (
                      <p style={s.noData}>No subjects.</p>
                    ) : (
                      <table style={s.gradeTable}>
                        <thead>
                          <tr>
                            <th style={s.gth}>Subject</th>
                            <th style={{ ...s.gth, textAlign: 'right' }}>Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map(([code, grade]) => (
                            <tr key={code} style={s.gtr}>
                              <td style={s.gtd}>
                                <span style={s.subjectCode}>{code}</span>
                              </td>
                              <td style={{ ...s.gtd, textAlign: 'right' }}>
                                <span style={{ ...s.gradeBadge, ...gradeColor(grade) }}>
                                  {grade}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td style={s.gFooter} colSpan={2}>
                              {entries.length} subject{entries.length !== 1 ? 's' : ''} · GWA: <strong>{gwa}</strong>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── PayablesTable ─────────────────────────────────────────────────────────────

const PayablesTable = ({ payables }) => {
  if (!payables || payables.length === 0)
    return <p style={s.noData}>No payable records.</p>;

  return (
    <table style={{ ...s.gradeTable, marginTop: 4 }}>
      <thead>
        <tr>
          <th style={s.gth}>Description</th>
          <th style={s.gth}>Amount</th>
          <th style={s.gth}>Due date</th>
          <th style={{ ...s.gth, textAlign: 'right' }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {payables.map((p, i) => (
          <tr key={i} style={s.gtr}>
            <td style={s.gtd}>{p.description || '—'}</td>
            <td style={s.gtd}>{p.amount}</td>
            <td style={s.gtd}>{p.dueDate || '—'}</td>
            <td style={{ ...s.gtd, textAlign: 'right' }}>
              <span style={{ ...s.payBadge, ...s[payableClass(p.status)] }}>
                {p.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ── StudentRow ────────────────────────────────────────────────────────────────

const StudentRow = ({ student }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('grades');
  const payables = student.payables || [];
  const pendingCount = payables.filter((p) => p.status !== 'paid').length;

  return (
    <>
      {/* Summary row — always visible, clickable */}
      <tr
        style={{ ...s.tr, cursor: 'pointer', ...(open ? s.trOpen : {}) }}
        onClick={() => setOpen((v) => !v)}
      >
        <td style={s.td}>
          <div style={s.rowToggle}>
            <span style={{ ...s.chevron, transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              ›
            </span>
            <div>
              <div style={s.studentName}>{student.name}</div>
              <div style={s.studentEmail}>{student.email}</div>
            </div>
          </div>
        </td>
        <td style={s.td}>
          <span style={s.mono}>{student.studentNumber}</span>
        </td>
        <td style={s.td}>
          <span style={s.curriculumText}>{student.curriculumId}</span>
        </td>
        <td style={s.td}>
          {pendingCount > 0 ? (
            <span style={{ ...s.payBadge, ...s['pay-pending'] }}>
              {pendingCount} pending
            </span>
          ) : (
            <span style={{ ...s.payBadge, ...s['pay-paid'] }}>settled</span>
          )}
        </td>
        <td style={{ ...s.td, color: '#9ca3af', fontSize: 11, textAlign: 'right', whiteSpace: 'nowrap' }}>
          {open ? 'collapse ↑' : 'expand ↓'}
        </td>
      </tr>

      {/* Expanded detail row */}
      {open && (
        <tr style={{ background: '#f8fafc' }}>
          <td colSpan={5} style={{ padding: 0, borderBottom: '0.5px solid #e5e7eb' }}>
            <div style={s.expandedPanel}>
              {/* Tabs */}
              <div style={s.tabs}>
                {['grades', 'payables'].map((t) => (
                  <button
                    key={t}
                    onClick={(e) => { e.stopPropagation(); setTab(t); }}
                    style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}
                  >
                    {t === 'grades' ? 'Grades by year & semester' : 'Payables'}
                    {t === 'payables' && pendingCount > 0 && (
                      <span style={s.tabBadge}>{pendingCount}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={s.tabContent}>
                {tab === 'grades' && <GradesTable grades={student.grades} />}
                {tab === 'payables' && <PayablesTable payables={payables} />}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ── EmptyState ────────────────────────────────────────────────────────────────

const EmptyState = () => (
  <div style={s.emptyState}>
    <div style={s.emptyIcon}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="4" width="14" height="12" rx="2" stroke="#9ca3af" strokeWidth="1.25" />
        <path d="M7 8h6M7 11h4" stroke="#9ca3af" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    </div>
    <div style={s.emptyTitle}>Select a batch to view records</div>
    <div style={s.emptySubtitle}>Student data, grades, and payables will appear here</div>
  </div>
);

// ── BatchItem ─────────────────────────────────────────────────────────────────

const BatchItem = ({ batch, isActive, onClick }) => {
  const label = formatBatchLabel(batch.id);
  const count = (batch.students || []).length;
  return (
    <button
      onClick={onClick}
      style={{ ...s.batchItem, ...(isActive ? s.batchItemActive : {}) }}
    >
      <div>
        <div style={s.batchName}>{label}</div>
        <div style={s.batchMeta}>{count} student{count !== 1 ? 's' : ''} · archived</div>
      </div>
      <span style={{ ...s.countBadge, ...(isActive ? s.countBadgeActive : {}) }}>
        {count}
      </span>
    </button>
  );
};

// ── StatCard ──────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub }) => (
  <div style={s.stat}>
    <div style={s.statLabel}>{label}</div>
    <div style={s.statVal}>{value}</div>
    {sub && <div style={s.statSub}>{sub}</div>}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const ViewArchivedClasses = () => {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchBatches = async () => {
      setLoading(true);
      setError('');
      try {
        const snap = await getDocs(collection(db, 'archives'));
        setBatches(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch {
        setError('Failed to load archived classes. Please try again.');
      }
      setLoading(false);
    };
    fetchBatches();
  }, []);

  const filteredBatches = batches.filter((b) =>
    formatBatchLabel(b.id).toLowerCase().includes(search.toLowerCase())
  );

  const totalStudents = batches.reduce((acc, b) => acc + (b.students?.length || 0), 0);

  return (
    <div style={s.root}>
      {/* Page header */}
      <div style={s.pageHeader}>
        <div>
          <h2 style={s.pageTitle}>Archived Classes</h2>
          <p style={s.pageSubtitle}>Read-only historical records organised by batch</p>
        </div>
        {!loading && !error && (
          <div style={s.headerBadges}>
            <span style={s.badgeBlue}>{batches.length} batch{batches.length !== 1 ? 'es' : ''}</span>
            <span style={s.badgeGreen}>{totalStudents} students</span>
          </div>
        )}
      </div>

      {loading && (
        <div style={s.loadingWrap}>
          <div style={s.loadingDot} />
          <span>Loading archived classes…</span>
        </div>
      )}

      {error && (
        <div style={s.errorBanner}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="#b91c1c" strokeWidth="1.25" />
            <path d="M8 5v3.5M8 10.5v.5" stroke="#b91c1c" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div style={s.layout}>
          {/* Sidebar */}
          <aside style={s.sidebar}>
            <div style={s.sidebarHeader}>
              <div style={s.sidebarLabel}>Batches</div>
              <input
                style={s.searchInput}
                placeholder="Search batch…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={s.batchList}>
              {filteredBatches.length === 0 && (
                <p style={{ fontSize: 12, color: '#9ca3af', padding: '8px 4px' }}>No batches found.</p>
              )}
              {filteredBatches.map((b) => (
                <BatchItem
                  key={b.id}
                  batch={b}
                  isActive={selectedBatch?.id === b.id}
                  onClick={() => setSelectedBatch(b)}
                />
              ))}
            </div>
          </aside>

          {/* Detail panel */}
          <main style={s.main}>
            {!selectedBatch ? (
              <EmptyState />
            ) : (
              <>
                <div style={s.detailHeader}>
                  <div>
                    <div style={s.detailTitle}>Batch {formatBatchLabel(selectedBatch.id)}</div>
                    <div style={s.detailMeta}>
                      {(selectedBatch.students || []).length} students · archived record
                    </div>
                  </div>
                  <div style={s.actions}>
                    <button style={s.btnSecondary}>Export CSV</button>
                    <button style={s.btnPrimary}>Print</button>
                  </div>
                </div>

                <div style={s.statsRow}>
                  <StatCard
                    label="Students"
                    value={(selectedBatch.students || []).length}
                    sub="in this batch"
                  />
                  <StatCard
                    label="Payables settled"
                    value={countPayables(selectedBatch.students, 'paid')}
                    sub={`${countPayables(selectedBatch.students, 'pending') + countPayables(selectedBatch.students, 'overdue')} pending / overdue`}
                  />
                  <StatCard
                    label="Subjects tracked"
                    value={uniqueSubjects(selectedBatch.students)}
                    sub="unique subjects"
                  />
                </div>

                <div style={s.sectionBar}>
                  <span>Student records — click a row to expand</span>
                  <span style={{ color: '#9ca3af', fontSize: 11 }}>read-only</span>
                </div>

                <div style={s.tableWrap}>
                  {(selectedBatch.students || []).length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                      No students in this batch.
                    </div>
                  ) : (
                    <table style={s.table}>
                      <thead>
                        <tr>
                          {['Student', 'Student no.', 'Curriculum', 'Payable status', ''].map((h) => (
                            <th key={h} style={h === '' ? { ...s.th, width: 90 } : s.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedBatch.students || []).map((student, idx) => (
                          <StudentRow key={student.id || idx} student={student} />
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div style={s.legend}>
                  <span style={s.legendLabel}>Grade:</span>
                  <span style={{ ...s.gradeBadge, ...s.gradeExcellent }}>1.0–1.5 excellent</span>
                  <span style={{ ...s.gradeBadge, ...s.gradePass }}>1.75–3.0 passing</span>
                  <span style={{ ...s.gradeBadge, ...s.gradeFail }}>5.0 failing</span>
                  <span style={s.legendLabel}>Payable:</span>
                  <span style={{ ...s.payBadge, ...s['pay-paid'] }}>paid</span>
                  <span style={{ ...s.payBadge, ...s['pay-pending'] }}>pending</span>
                  <span style={{ ...s.payBadge, ...s['pay-overdue'] }}>overdue</span>
                </div>
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  root: { fontFamily: "'DM Sans', sans-serif", padding: '1.5rem', maxWidth: 1100, margin: '0 auto' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' },
  pageTitle: { fontSize: 22, fontWeight: 500, color: '#111827', margin: 0 },
  pageSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 3 },
  headerBadges: { display: 'flex', gap: 8 },
  badgeBlue: { fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '4px 10px', borderRadius: 20, fontWeight: 500 },
  badgeGreen: { fontSize: 11, background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: 20, fontWeight: 500 },

  loadingWrap: { display: 'flex', alignItems: 'center', gap: 10, padding: '2rem', color: '#6b7280', fontSize: 13 },
  loadingDot: { width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' },
  errorBanner: { display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#b91c1c' },

  layout: { display: 'grid', gridTemplateColumns: '220px 1fr', border: '0.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff', minHeight: 480 },

  sidebar: { borderRight: '0.5px solid #e5e7eb', background: '#f9fafb', display: 'flex', flexDirection: 'column' },
  sidebarHeader: { padding: '14px 14px 10px', borderBottom: '0.5px solid #e5e7eb' },
  sidebarLabel: { fontSize: 10, fontWeight: 500, color: '#9ca3af', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 8 },
  searchInput: { width: '100%', background: '#fff', border: '0.5px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#374151', outline: 'none' },
  batchList: { flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 3 },
  batchItem: { width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: '0.5px solid transparent' },
  batchItemActive: { background: '#fff', border: '0.5px solid #d1d5db' },
  batchName: { fontSize: 13, fontWeight: 500, color: '#111827' },
  batchMeta: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  countBadge: { fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '2px 7px', borderRadius: 20, fontWeight: 500 },
  countBadgeActive: { background: '#1d4ed8', color: '#dbeafe' },

  main: { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '60px 20px' },
  emptyIcon: { width: 44, height: 44, borderRadius: '50%', background: '#f3f4f6', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 13, fontWeight: 500, color: '#6b7280' },
  emptySubtitle: { fontSize: 12, color: '#9ca3af' },

  detailHeader: { padding: '16px 20px 12px', borderBottom: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  detailTitle: { fontSize: 14, fontWeight: 500, color: '#111827' },
  detailMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  actions: { display: 'flex', gap: 8 },
  btnSecondary: { fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '0.5px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer' },
  btnPrimary: { fontSize: 12, padding: '5px 12px', borderRadius: 6, border: 'none', background: '#1d4ed8', color: '#fff', cursor: 'pointer' },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '0.5px solid #e5e7eb' },
  stat: { padding: '12px 20px', borderRight: '0.5px solid #e5e7eb' },
  statLabel: { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 },
  statVal: { fontSize: 20, fontWeight: 500, color: '#111827' },
  statSub: { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  sectionBar: { padding: '8px 20px', background: '#f9fafb', borderBottom: '0.5px solid #e5e7eb', fontSize: 10, fontWeight: 500, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },

  tableWrap: { overflowX: 'auto', flex: 1 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', background: '#f9fafb', borderBottom: '0.5px solid #e5e7eb', whiteSpace: 'nowrap' },
  tr: { borderBottom: '0.5px solid #f3f4f6' },
  trOpen: { background: '#eff6ff', borderBottom: 'none' },
  td: { padding: '10px 14px', color: '#111827', verticalAlign: 'middle' },

  rowToggle: { display: 'flex', alignItems: 'center', gap: 8 },
  chevron: { fontSize: 18, color: '#9ca3af', display: 'inline-block', transition: 'transform 0.15s', lineHeight: 1, userSelect: 'none', minWidth: 12 },
  studentName: { fontSize: 13, fontWeight: 500, color: '#111827' },
  studentEmail: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  mono: { fontFamily: 'monospace', fontSize: 11, color: '#6b7280' },
  curriculumText: { fontSize: 12, color: '#6b7280' },

  expandedPanel: {},
  tabs: { display: 'flex', borderBottom: '0.5px solid #e5e7eb', paddingLeft: 20, background: '#fff' },
  tab: { fontSize: 12, padding: '10px 14px', background: 'none', border: 'none', borderBottom: '2px solid transparent', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1 },
  tabActive: { color: '#1d4ed8', borderBottomColor: '#1d4ed8', fontWeight: 500 },
  tabBadge: { fontSize: 10, background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: 20, fontWeight: 500 },
  tabContent: { padding: '16px 20px 20px' },

  gradesWrap: { display: 'flex', flexDirection: 'column', gap: 20 },
  yearBlock: {},
  yearLabel: { fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid #e5e7eb' },
  semGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  semBlock: { background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '12px 14px' },
  semLabel: { fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 },

  gradeTable: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  gth: { fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', paddingBottom: 6, textAlign: 'left', borderBottom: '0.5px solid #e5e7eb' },
  gtr: { borderBottom: '0.5px solid #f3f4f6' },
  gtd: { padding: '5px 0', color: '#374151', verticalAlign: 'middle' },
  gFooter: { fontSize: 10, color: '#9ca3af', paddingTop: 8, borderTop: '0.5px solid #e5e7eb' },
  subjectCode: { fontFamily: 'monospace', fontSize: 11, color: '#374151' },

  gradeBadge: { display: 'inline-block', fontSize: 11, padding: '1px 7px', borderRadius: 4, fontWeight: 500, fontFamily: 'monospace' },
  gradeExcellent: { background: '#dcfce7', color: '#15803d' },
  gradePass: { background: '#fef9c3', color: '#854d0e' },
  gradeFail: { background: '#fef2f2', color: '#b91c1c' },
  gradeNeutral: { background: '#f3f4f6', color: '#6b7280' },

  payBadge: { display: 'inline-block', fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 500, whiteSpace: 'nowrap' },
  'pay-paid': { background: '#dcfce7', color: '#15803d' },
  'pay-pending': { background: '#fef9c3', color: '#854d0e' },
  'pay-overdue': { background: '#fef2f2', color: '#b91c1c' },

  noData: { fontSize: 12, color: '#9ca3af', margin: 0 },
  legend: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '10px 20px', borderTop: '0.5px solid #e5e7eb', background: '#f9fafb' },
  legendLabel: { fontSize: 11, color: '#9ca3af', fontWeight: 500 },
};

export default ViewArchivedClasses;