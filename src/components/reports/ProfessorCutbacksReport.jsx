import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowBigLeft, Download, UserRound, Search, RefreshCw, Settings2, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react';
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
          <span className="px-3 py-1.5 text-sm bg-gray-100 border border-gray-300 border-r-0 rounded-l-lg">PHP</span>
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
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [selectedProfessor, setSelectedProfessor] = useState(null);
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

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? professors.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.employeeId || '').toLowerCase().includes(q)
    ) : professors;

    return [...list].sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      const getTotalStudents = (prof) => (prof.classes || []).reduce((sum, c) => sum + (c.studentCount || 0), 0);
      if (sortConfig.key === 'classCount') return (((a.classes || []).length) - ((b.classes || []).length)) * dir;
      if (sortConfig.key === 'totalStudents') return (getTotalStudents(a) - getTotalStudents(b)) * dir;
      if (sortConfig.key === 'totalCutback') return ((getTotalStudents(a) * rate) - (getTotalStudents(b) * rate)) * dir;
      return (a[sortConfig.key] || '').toString().localeCompare((b[sortConfig.key] || '').toString()) * dir;
    });
  }, [professors, search, sortConfig, rate]);

  const grandTotals = useMemo(() => {
    let totalStudents = 0;
    rows.forEach(p => {
      (p.classes || []).forEach(c => { totalStudents += c.studentCount || 0; });
    });
    return {
      totalStudents,
      totalCutback: totalStudents * rate
    };
  }, [rows, rate]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <ChevronsUpDown className="h-3.5 w-3.5 opacity-70" />;
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5" />
      : <ChevronDown className="h-3.5 w-3.5" />;
  };

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
      exportAllProfessorCutbacksToExcel(rows, rate, `${safeName}.xlsx`);
    } else if (filenameModal.target) {
      exportSingleProfessorCutbacksToExcel(filenameModal.target, rate, `${safeName}.xlsx`);
    }
    setFilenameModal({ open: false, mode: 'all', target: null });
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
        <span>Dashboard</span>
        <span className="text-gray-300">&gt;</span>

        <span className="font-medium text-blue-600">Professor Cutbacks</span>
      </div>

      <div className="flex-1 mb-4">
            <h2 className="text-2xl font-semibold text-gray-900">Professor Cutbacks</h2>
            <p className="mt-1 text-sm text-gray-500">
              Cutback computed as {rate.toFixed(2)} PHP x number of students per handled class
              {activeTerm.schoolYear && ` (Sem ${activeTerm.semester}, SY ${activeTerm.schoolYear})`}.
            </p>
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
            <Settings2 className="h-4 w-4" /> Rate: PHP {rate.toFixed(2)}
          </button>
          <button
            onClick={openExportAll}
            disabled={loading || rows.length === 0}
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

      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Professors</p>
            <p className="text-2xl font-semibold text-gray-800">{rows.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Total Students Handled</p>
            <p className="text-2xl font-semibold text-gray-800">{grandTotals.totalStudents}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Total Cutbacks</p>
            <p className="text-2xl font-semibold text-emerald-700">PHP {grandTotals.totalCutback.toFixed(2)}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center bg-white border border-gray-200 rounded-xl">
          <UserRound className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            {professors.length === 0 ? 'No professors registered.' : 'No professors match your search.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-50 text-blue-800">
              <tr>
                {[
                  ['name', 'Professor'],
                  ['employeeId', 'Employee ID'],
                  ['classCount', 'Classes'],
                  ['totalStudents', 'Students'],
                  ['totalCutback', 'Cutback']
                ].map(([key, label]) => (
                  <th key={key} className="px-4 py-2 text-left font-semibold">
                    <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1">
                      {label}
                      <SortIcon column={key} />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(prof => {
                const totalStudents = (prof.classes || []).reduce((sum, c) => sum + (c.studentCount || 0), 0);
                const totalCutback = totalStudents * rate;
                return (
                  <tr
                    key={prof.id}
                    onClick={() => setSelectedProfessor(prof)}
                    className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-semibold text-gray-800">{prof.name}</td>
                    <td className="px-4 py-3 text-gray-700">{prof.employeeId || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{(prof.classes || []).length}</td>
                    <td className="px-4 py-3 text-gray-700">{totalStudents}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">PHP {totalCutback.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openExportSingle(prof); }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
                      >
                        <Download className="h-3.5 w-3.5" /> Export
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedProfessor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setSelectedProfessor(null)}></div>
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 p-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedProfessor.name}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedProfessor.employeeId || 'No employee ID'} / {(selectedProfessor.classes || []).length} class{(selectedProfessor.classes || []).length === 1 ? '' : 'es'}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedProfessor(null)} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-auto p-5">
              {(selectedProfessor.classes || []).length === 0 ? (
                <p className="text-sm text-gray-500">No assigned classes.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-blue-50 text-blue-800">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Code</th>
                      <th className="px-3 py-2 text-left font-semibold">Title</th>
                      <th className="px-3 py-2 text-center font-semibold">Year</th>
                      <th className="px-3 py-2 text-left font-semibold">Block(s)</th>
                      <th className="px-3 py-2 text-center font-semibold">Students</th>
                      <th className="px-3 py-2 text-right font-semibold">Cutback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProfessor.classes.map(c => {
                      const cutback = (c.studentCount || 0) * rate;
                      return (
                        <tr key={c.courseId} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-medium text-gray-800">{c.courseCode}</td>
                          <td className="px-3 py-2 text-gray-700">{c.courseTitle}</td>
                          <td className="px-3 py-2 text-center text-gray-700">{c.yearLevel || '-'}</td>
                          <td className="px-3 py-2 text-gray-700">{(c.blocks || []).join(', ') || '-'}</td>
                          <td className="px-3 py-2 text-center text-gray-700">{c.studentCount || 0}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-700">PHP {cutback.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
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
