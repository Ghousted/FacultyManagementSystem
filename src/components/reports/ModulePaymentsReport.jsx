import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowBigLeft, Download, BookOpen, ChevronDown, ChevronRight, Search, RefreshCw } from 'lucide-react';
import { getOfferedModules, getAllModulePayables } from '../../models/payablesModels';
import { getStudents } from '../../models/curriculumModels';
import {
  exportSingleModulePaymentsToExcel,
  exportAllModulePaymentsToExcel
} from '../../utils/excelExport';

const SEMESTER_LABELS = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };

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
            placeholder="filename"
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

const ModulePaymentsReport = ({ onBackToReportsMain }) => {
  const [loading, setLoading] = useState(true);
  const [offeredModules, setOfferedModules] = useState([]);
  const [modulePayables, setModulePayables] = useState([]);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [error, setError] = useState('');
  const [filenameModal, setFilenameModal] = useState({ open: false, mode: 'all', target: null });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [modulesRes, payablesRes, studentsRes] = await Promise.all([
        getOfferedModules(),
        getAllModulePayables(),
        getStudents()
      ]);
      if (!modulesRes.success) throw new Error(modulesRes.error || 'Failed to load offered modules.');
      if (!payablesRes.success) throw new Error(payablesRes.error || 'Failed to load module payables.');
      if (!studentsRes.success) throw new Error(studentsRes.error || 'Failed to load students.');
      setOfferedModules(modulesRes.data);
      setModulePayables(payablesRes.data);
      setStudents(studentsRes.data);
    } catch (e) {
      setError(e.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const studentMap = useMemo(() => {
    const m = new Map();
    students.forEach(s => m.set(s.id, s));
    return m;
  }, [students]);

  const reportData = useMemo(() => {
    return offeredModules.map(mod => {
      // Try to find a matching module payable for this offered course.
      const payable = modulePayables.find(p => p.moduleId === mod.id)
        || modulePayables.find(p => (p.moduleCode || '').toLowerCase() === (mod.courseCode || '').toLowerCase());

      const amount = payable ? Number(payable.amount) || 0 : null;
      const studentPayments = payable?.studentPayments || {};

      // Group students by block.
      const blockMap = new Map();
      Object.entries(studentPayments).forEach(([studentId, payment]) => {
        const student = studentMap.get(studentId);
        if (!student) return;
        const block = (student.block || '').toString().trim().toUpperCase() || '—';
        if (!blockMap.has(block)) blockMap.set(block, []);
        const paidAmount = Number(payment?.paidAmount) || 0;
        const status = amount !== null && paidAmount >= amount && amount > 0
          ? 'PAID'
          : (paidAmount > 0 ? 'PARTIAL' : 'UNPAID');
        blockMap.get(block).push({
          id: studentId,
          name: student.name || '(unnamed)',
          status,
          paidAmount
        });
      });

      const blocks = Array.from(blockMap.entries())
        .map(([block, list]) => ({
          block,
          students: list.sort((a, b) => a.name.localeCompare(b.name))
        }))
        .sort((a, b) => a.block.localeCompare(b.block));

      const totalStudents = blocks.reduce((sum, b) => sum + b.students.length, 0);
      const paidCount = blocks.reduce(
        (sum, b) => sum + b.students.filter(s => s.status === 'PAID').length,
        0
      );

      return {
        id: mod.id,
        courseCode: mod.courseCode,
        courseTitle: mod.courseTitle,
        yearLevel: mod.yearLevel,
        semester: mod.semester,
        amount,
        hasPayable: !!payable,
        blocks,
        totalStudents,
        paidCount
      };
    });
  }, [offeredModules, modulePayables, studentMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reportData;
    return reportData.filter(m =>
      (m.courseCode || '').toLowerCase().includes(q) ||
      (m.courseTitle || '').toLowerCase().includes(q)
    );
  }, [reportData, search]);

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const openExportAll = () => {
    setFilenameModal({ open: true, mode: 'all', target: null });
  };

  const openExportSingle = (mod) => {
    setFilenameModal({ open: true, mode: 'single', target: mod });
  };

  const handleExportConfirm = (filename) => {
    const safeName = filename || 'module_payments';
    if (filenameModal.mode === 'all') {
      exportAllModulePaymentsToExcel(filtered, `${safeName}.xlsx`);
    } else if (filenameModal.target) {
      exportSingleModulePaymentsToExcel(filenameModal.target, `${safeName}.xlsx`);
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
            <h2 className="text-2xl font-semibold text-gray-900">Module Payments</h2>
            <p className="mt-1 text-sm text-gray-500">
              Per offered subject: year level, blocks, and which students have paid.
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
              placeholder="Search by code or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>
        <button
          onClick={openExportAll}
          disabled={loading || filtered.length === 0}
          className="rounded-full text-sm px-4 py-2 cursor-pointer bg-green-600 hover:bg-green-700 text-white font-semibold shadow flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Export All
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {error}
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
          <BookOpen className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            {offeredModules.length === 0
              ? 'No offered modules. Mark subjects as "offered" in the Payables module manager first.'
              : 'No modules match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(mod => {
            const isOpen = !!expanded[mod.id];
            return (
              <div key={mod.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand(mod.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer text-left"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 text-sm">{mod.courseCode}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        Year {mod.yearLevel} · {SEMESTER_LABELS[mod.semester] || `Sem ${mod.semester}`}
                      </span>
                      {mod.amount !== null ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          ₱{mod.amount.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                          No payable yet
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate mt-0.5">{mod.courseTitle}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {mod.totalStudents} student{mod.totalStudents === 1 ? '' : 's'} · {mod.paidCount} paid · {mod.totalStudents - mod.paidCount} unpaid
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openExportSingle(mod); }}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                    title="Export this module"
                  >
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50">
                    {mod.blocks.length === 0 ? (
                      <p className="text-sm text-gray-500 py-2">
                        {mod.hasPayable
                          ? 'No students linked to this module payable.'
                          : 'No payable record exists yet for this module.'}
                      </p>
                    ) : (
                      mod.blocks.map(group => (
                        <div key={group.block} className="mb-3 last:mb-0">
                          <p className="text-xs font-semibold text-gray-700 mb-1.5">
                            Block {group.block}
                            <span className="ml-2 font-normal text-gray-500">
                              ({group.students.length} student{group.students.length === 1 ? '' : 's'})
                            </span>
                          </p>
                          <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="bg-blue-50 text-left">
                                  <th className="px-3 py-1.5 text-blue-700 font-semibold">Name</th>
                                  <th className="px-3 py-1.5 text-blue-700 font-semibold w-32 text-center">Status</th>
                                  <th className="px-3 py-1.5 text-blue-700 font-semibold w-32 text-right">Paid</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.students.map(s => (
                                  <tr key={s.id} className="border-t border-gray-100">
                                    <td className="px-3 py-1.5 text-gray-800">{s.name}</td>
                                    <td className="px-3 py-1.5 text-center">
                                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                        s.status === 'PAID'
                                          ? 'bg-green-100 text-green-700'
                                          : s.status === 'PARTIAL'
                                            ? 'bg-yellow-100 text-yellow-700'
                                            : 'bg-red-100 text-red-700'
                                      }`}>
                                        {s.status}
                                      </span>
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-gray-700">
                                      ₱{s.paidAmount.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <FilenameModal
        isOpen={filenameModal.open}
        onClose={() => setFilenameModal({ open: false, mode: 'all', target: null })}
        onConfirm={handleExportConfirm}
        defaultName={
          filenameModal.mode === 'single' && filenameModal.target
            ? `module_${(filenameModal.target.courseCode || 'module').replace(/\s+/g, '_')}_payments`
            : 'all_module_payments'
        }
      />
    </div>
  );
};

export default ModulePaymentsReport;
