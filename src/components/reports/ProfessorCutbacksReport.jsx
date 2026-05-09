import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowBigLeft, Download, UserRound, ChevronDown, ChevronRight, Search, RefreshCw, Settings2 } from 'lucide-react';
import {
  getProfessors,
  getActiveTerm,
  getStudentsForCourse
} from '../../models/facultyModels';
import { getCutbackRate, saveCutbackRate } from '../../models/payablesModels';
import {
  exportSingleProfessorCutbacksToExcel,
  exportAllProfessorCutbacksToExcel
} from '../../utils/excelExport';

const FilenameModal = ({ isOpen, onClose, onConfirm, defaultName }) => {
  const [name, setName] = useState(defaultName);

  useEffect(() => setName(defaultName), [defaultName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-3xl shadow-2xl w-96 max-w-full">
        <h3 className="text-lg font-bold text-blue-700">Export to Excel</h3>
        <p className="text-sm text-gray-600 mb-4">Enter a filename for the export.</p>
        <div className="flex items-center">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 border border-gray-300 rounded-l-lg px-3 py-1.5 text-sm focus:outline-none"
          />
          <span className="px-3 py-1.5 text-sm bg-gray-100 border border-gray-300 border-l-0 rounded-r-lg">.xlsx</span>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm((name || defaultName).trim())}
            className="px-6 py-1.5 rounded-full cursor-pointer text-sm bg-blue-600 text-white hover:bg-blue-700"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
};

const RateModal = ({ isOpen, onClose, currentRate, onSave, isSaving }) => {
  const [value, setValue] = useState(currentRate);

  useEffect(() => setValue(currentRate), [currentRate, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-3xl shadow-2xl w-96 max-w-full">
        <h3 className="text-xl font-bold text-blue-700 mb-2">Configure Cutback Rate</h3>
        <p className="text-sm text-gray-600 mb-4">Amount (PHP) paid to a professor per student per class.</p>
        <div className="flex items-center">
          <span className="px-3 py-1.5 text-sm bg-gray-100 border border-gray-300 border-r-0 rounded-l-lg">₱</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="flex-1 border border-gray-300 rounded-r-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-xl text-sm bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(value)}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-xl text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProfessorCutbacksReport = ({ onBackToReportsMain }) => {
  const [loading, setLoading] = useState(true);
  const [professors, setProfessors] = useState([]);
  const [activeTerm, setActiveTerm] = useState({ semester: 1, schoolYear: '' });
  const [rate, setRate] = useState(50);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [error, setError] = useState('');
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [filenameModal, setFilenameModal] = useState({ open: false, mode: 'all', target: null });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profsRes, termRes, rateRes] = await Promise.all([
        getProfessors(),
        getActiveTerm(),
        getCutbackRate()
      ]);
      if (!profsRes.success) throw new Error(profsRes.error || 'Failed to load professors.');
      const term = termRes.success ? termRes.data : { semester: 1, schoolYear: '' };
      const ratePerStudent = rateRes.success ? rateRes.data : 50;
      setActiveTerm(term);
      setRate(ratePerStudent);

      // Resolve student counts for each professor's assigned courses for the active term.
      const enriched = await Promise.all(
        profsRes.data.map(async (p) => {
          const assignments = p.assignedCourses || [];
          const classes = await Promise.all(
            assignments.map(async (c) => {
              const res = await getStudentsForCourse(c, term);
              const studentCount = res.success ? res.data.length : 0;
              return {
                courseId: c.courseId,
                courseCode: c.courseCode,
                courseTitle: c.courseTitle,
                yearLevel: c.yearLevel,
                blocks: c.blocks || [],
                source: c.source || 'ccs',
                studentCount
              };
            })
          );
          return { ...p, classes };
        })
      );
      setProfessors(enriched);
    } catch (e) {
      setError(e.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return professors;
    return professors.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.employeeId || '').toLowerCase().includes(q)
    );
  }, [professors, search]);

  const grandTotals = useMemo(() => {
    let totalStudents = 0;
    filtered.forEach(p => {
      (p.classes || []).forEach(c => { totalStudents += c.studentCount || 0; });
    });
    return {
      totalStudents,
      totalCutback: totalStudents * rate
    };
  }, [filtered, rate]);

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSaveRate = async (val) => {
    setSavingRate(true);
    const res = await saveCutbackRate(val);
    setSavingRate(false);
    if (res.success) {
      setRate(res.data);
      setRateModalOpen(false);
    } else {
      setError(res.error || 'Failed to save rate.');
    }
  };

  const openExportAll = () => setFilenameModal({ open: true, mode: 'all', target: null });
  const openExportSingle = (prof) => setFilenameModal({ open: true, mode: 'single', target: prof });

  const handleExportConfirm = (filename) => {
    const safeName = filename || 'professor_cutbacks';
    if (filenameModal.mode === 'all') {
      exportAllProfessorCutbacksToExcel(filtered, rate, `${safeName}.xlsx`);
    } else if (filenameModal.target) {
      exportSingleProfessorCutbacksToExcel(filenameModal.target, rate, `${safeName}.xlsx`);
    }
    setFilenameModal({ open: false, mode: 'all', target: null });
  };

  return (
    <div>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToReportsMain}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700"
            aria-label="Back"
            title="Back"
          >
            <ArrowBigLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-gray-900">Professor Cutbacks</h2>
            <p className="mt-1 text-sm text-gray-500">
              Cutback computed as {rate.toFixed(2)} PHP × number of students per handled class
              {activeTerm.schoolYear && ` (Sem ${activeTerm.semester}, SY ${activeTerm.schoolYear})`}.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-stretch sm:items-center justify-between">
        <div className="flex gap-2 flex-1">
          <button
            onClick={loadAll}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 p-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 cursor-pointer"
            title="Reload"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search professors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setRateModalOpen(true)}
            className="rounded-full text-sm px-4 py-2 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow flex items-center gap-2"
          >
            <Settings2 className="h-4 w-4" /> Rate: ₱{rate.toFixed(2)}
          </button>
          <button
            onClick={openExportAll}
            disabled={loading || filtered.length === 0}
            className="rounded-full text-sm px-4 py-2 cursor-pointer bg-green-600 hover:bg-green-700 text-white font-semibold shadow flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export All
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Professors</p>
            <p className="text-2xl font-semibold text-gray-800">{filtered.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Total Students Handled</p>
            <p className="text-2xl font-semibold text-gray-800">{grandTotals.totalStudents}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Total Cutbacks</p>
            <p className="text-2xl font-semibold text-emerald-700">₱{grandTotals.totalCutback.toFixed(2)}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-white border border-gray-200 rounded-xl">
          <UserRound className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            {professors.length === 0 ? 'No professors registered.' : 'No professors match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(prof => {
            const isOpen = !!expanded[prof.id];
            const totalStudents = (prof.classes || []).reduce((sum, c) => sum + (c.studentCount || 0), 0);
            const totalCutback = totalStudents * rate;
            return (
              <div key={prof.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand(prof.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer text-left"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 text-sm">{prof.name}</span>
                      {prof.employeeId && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {prof.employeeId}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        {(prof.classes || []).length} class{(prof.classes || []).length === 1 ? '' : 'es'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {totalStudents} student{totalStudents === 1 ? '' : 's'} · Total cutback: <span className="font-semibold text-emerald-700">₱{totalCutback.toFixed(2)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openExportSingle(prof); }}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                    title="Export this professor"
                  >
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
                    {(prof.classes || []).length === 0 ? (
                      <p className="text-sm text-gray-500 py-2">No assigned classes.</p>
                    ) : (
                      <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-blue-50 text-left">
                              <th className="px-3 py-1.5 text-blue-700 font-semibold">Code</th>
                              <th className="px-3 py-1.5 text-blue-700 font-semibold">Title</th>
                              <th className="px-3 py-1.5 text-blue-700 font-semibold w-20 text-center">Year</th>
                              <th className="px-3 py-1.5 text-blue-700 font-semibold w-32">Block(s)</th>
                              <th className="px-3 py-1.5 text-blue-700 font-semibold w-24 text-center">Students</th>
                              <th className="px-3 py-1.5 text-blue-700 font-semibold w-32 text-right">Cutback</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prof.classes.map(c => {
                              const cutback = (c.studentCount || 0) * rate;
                              return (
                                <tr key={c.courseId} className="border-t border-gray-100">
                                  <td className="px-3 py-1.5 font-medium text-gray-800">{c.courseCode}</td>
                                  <td className="px-3 py-1.5 text-gray-700">{c.courseTitle}</td>
                                  <td className="px-3 py-1.5 text-center text-gray-700">{c.yearLevel || '-'}</td>
                                  <td className="px-3 py-1.5 text-gray-700">{(c.blocks || []).join(', ') || '—'}</td>
                                  <td className="px-3 py-1.5 text-center text-gray-700">{c.studentCount || 0}</td>
                                  <td className="px-3 py-1.5 text-right font-semibold text-emerald-700">₱{cutback.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                            <tr className="border-t border-gray-200 bg-gray-50">
                              <td className="px-3 py-1.5 font-semibold text-gray-700" colSpan={4}>Total</td>
                              <td className="px-3 py-1.5 text-center font-semibold text-gray-800">{totalStudents}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-emerald-700">₱{totalCutback.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <RateModal
        isOpen={rateModalOpen}
        onClose={() => setRateModalOpen(false)}
        currentRate={rate}
        onSave={handleSaveRate}
        isSaving={savingRate}
      />

      <FilenameModal
        isOpen={filenameModal.open}
        onClose={() => setFilenameModal({ open: false, mode: 'all', target: null })}
        onConfirm={handleExportConfirm}
        defaultName={
          filenameModal.mode === 'single' && filenameModal.target
            ? `cutbacks_${(filenameModal.target.name || 'professor').replace(/\s+/g, '_')}`
            : 'all_professor_cutbacks'
        }
      />
    </div>
  );
};

export default ProfessorCutbacksReport;
