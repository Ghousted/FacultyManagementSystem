import { useState, useEffect, useMemo, useCallback } from 'react';
import { Download, BookOpen, Search, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react';
import { getOfferedModules, getAllModulePayables } from '../../models/payablesModels';
import { getStudents, getCurriculums } from '../../models/curriculumModels';
import Breadcrumbs from '../common/Breadcrumbs';
import {
  exportSingleModulePaymentsToExcel,
  exportAllModulePaymentsToExcel
} from '../../utils/excelExport';

const SEMESTER_LABELS = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };

const YEAR_LABELS = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };

const DEPARTMENT_TABS = [
  { key: 'all', label: 'All Departments' },
  { key: 'ccs', label: 'CCS' },
  { key: 'other', label: 'Other Departments' }
];

// ─── Filename Modal ────────────────────────────────────────────────────────────
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

// ─── Main Component ────────────────────────────────────────────────────────────
const ModulePaymentsReport = ({ onBackToReportsMain }) => {
  const [loading, setLoading] = useState(true);
  const [offeredModules, setOfferedModules] = useState([]);
  const [modulePayables, setModulePayables] = useState([]);
  const [students, setStudents] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'courseCode', direction: 'asc' });
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState('');
  const [error, setError] = useState('');
  const [filenameModal, setFilenameModal] = useState({ open: false, mode: 'all', target: null });
  const [activeDepartmentTab, setActiveDepartmentTab] = useState('all');
  const [activeBlockTab, setActiveBlockTab] = useState('all');

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [modulesRes, payablesRes, studentsRes, curriculumsRes] = await Promise.all([
        getOfferedModules(),
        getAllModulePayables(),
        getStudents(),
        getCurriculums()
      ]);
      if (!modulesRes.success) throw new Error(modulesRes.error || 'Failed to load offered modules.');
      if (!payablesRes.success) throw new Error(payablesRes.error || 'Failed to load module payables.');
      if (!studentsRes.success) throw new Error(studentsRes.error || 'Failed to load students.');
      if (!curriculumsRes.success) throw new Error(curriculumsRes.error || 'Failed to load curriculums.');
      setOfferedModules(modulesRes.data);
      setModulePayables(payablesRes.data);
      setStudents(studentsRes.data);
      setCurriculums(curriculumsRes.data);
    } catch (e) {
      setError(e.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Derived maps ────────────────────────────────────────────────────────────
  const studentMap = useMemo(() => {
    const m = new Map();
    students.forEach(s => m.set(s.id, s));
    return m;
  }, [students]);

  const curriculumMap = useMemo(() => {
    const m = new Map();
    curriculums.forEach(c => m.set(c.id, c));
    return m;
  }, [curriculums]);

  // ── Report data ─────────────────────────────────────────────────────────────
  const reportData = useMemo(() => {
    return offeredModules.map(mod => {
      const curriculum = curriculumMap.get(mod.curriculumId);
      const department = curriculum ? curriculum.name : (mod.departmentName || 'Other Department');
      const course = curriculum
        ? 'BSCS'
        : (mod.classCourse || mod.course || mod.departmentName || 'Other Department');

      const matchingPayables = modulePayables.filter((payable) => {
        const moduleIdMatches = payable.moduleId === mod.id;
        const moduleCodeMatches = (payable.moduleCode || '').toLowerCase() === (mod.courseCode || '').toLowerCase();
        return moduleIdMatches || moduleCodeMatches;
      });

      const payable = matchingPayables[0] || null;
      const amount = payable ? Number(payable.amount) || 0 : null;

      // professor: prefer payable field, fall back to module field
      const professor =
        (payable?.professor) ||
        (mod.professor) ||
        (mod.instructor) ||
        '';

      const blockMap = new Map();
      const studentRows = new Map();

      matchingPayables.forEach((matchedPayable) => {
        Object.entries(matchedPayable.studentPayments || {}).forEach(([studentId, payment]) => {
          const student = studentMap.get(studentId);
          if (!student) return;

          const rawBlock = (student.block || matchedPayable.block || '').toString().trim().toUpperCase();
          const block = rawBlock || 'IRREGULAR';
          const paidAmount = Number(payment?.paidAmount) || 0;
          const currentRow = studentRows.get(studentId) || {
            id: studentId,
            name: student.name || '(unnamed)',
            block,
            paidAmount: 0,
            isIrregular: !!student.isIrregular,
          };

          currentRow.paidAmount = Math.max(currentRow.paidAmount, paidAmount);
          currentRow.block = currentRow.block || block;
          studentRows.set(studentId, currentRow);
        });
      });

      studentRows.forEach((row) => {
        if (!blockMap.has(row.block)) blockMap.set(row.block, []);
        const status = amount !== null && row.paidAmount >= amount && amount > 0
          ? 'PAID'
          : (row.paidAmount > 0 ? 'PARTIAL' : 'UNPAID');

        blockMap.get(row.block).push({
          id: row.id,
          name: row.name,
          status,
          paidAmount: row.paidAmount,
          isIrregular: row.isIrregular,
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
        course,
        department,
        source: curriculum ? 'ccs' : 'other',
        yearLevel: mod.yearLevel,
        semester: mod.semester,
        professor,
        amount,
        hasPayable: matchingPayables.length > 0,
        blocks,
        totalStudents,
        paidCount
      };
    });
  }, [offeredModules, modulePayables, studentMap, curriculumMap]);

  // ── Filtering & sorting ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = q
      ? reportData.filter(m =>
          (m.course || '').toLowerCase().includes(q) ||
          (m.courseCode || '').toLowerCase().includes(q) ||
          (m.courseTitle || '').toLowerCase().includes(q) ||
          (m.professor || '').toLowerCase().includes(q) ||
          (m.department || '').toLowerCase().includes(q)
        )
      : reportData;

    // department filter (does NOT affect Export All)
    if (activeDepartmentTab === 'ccs') {
      list = list.filter(m => m.source === 'ccs');
    } else if (activeDepartmentTab === 'other') {
      list = list.filter(m => m.source === 'other');
    }

    if (activeBlockTab !== 'all') {
      list = list.filter(m => m.blocks.some(b => b.block === activeBlockTab));
    }

    return [...list].sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      if (['yearLevel', 'amount', 'totalStudents', 'paidCount'].includes(sortConfig.key)) {
        return ((Number(a[sortConfig.key]) || 0) - (Number(b[sortConfig.key]) || 0)) * dir;
      }
      return (a[sortConfig.key] || '').toString().localeCompare((b[sortConfig.key] || '').toString()) * dir;
    });
  }, [reportData, search, sortConfig, activeDepartmentTab, activeBlockTab]);

  // ── All records for export (ignores year tab) ───────────────────────────────
  const allForExport = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? reportData.filter(m =>
          (m.course || '').toLowerCase().includes(q) ||
          (m.courseCode || '').toLowerCase().includes(q) ||
          (m.courseTitle || '').toLowerCase().includes(q) ||
          (m.professor || '').toLowerCase().includes(q)
        )
      : reportData;

    return [...list].sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      if (['yearLevel', 'amount', 'totalStudents', 'paidCount'].includes(sortConfig.key)) {
        return ((Number(a[sortConfig.key]) || 0) - (Number(b[sortConfig.key]) || 0)) * dir;
      }
      return (a[sortConfig.key] || '').toString().localeCompare((b[sortConfig.key] || '').toString()) * dir;
    });
  }, [reportData, search, sortConfig]);

  // ── Sorting ─────────────────────────────────────────────────────────────────
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

  // ── Year/block label helper ─────────────────────────────────────────────────
  const yearBlockLabel = (mod) => {
    const year = YEAR_LABELS[Number(mod.yearLevel)];
    if (!year) return 'Irregular';
    return year;
  };

  // ── Modal helpers ───────────────────────────────────────────────────────────
  const openModuleModal = (mod) => {
    setSelectedModule(mod);
    setSelectedBlock(mod.blocks?.[0]?.block || 'IRREGULAR');
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
      exportAllModulePaymentsToExcel(allForExport, `${safeName}.xlsx`);
    } else if (filenameModal.target) {
      exportSingleModulePaymentsToExcel(filenameModal.target, `${safeName}.xlsx`);
    }
    setFilenameModal({ open: false, mode: 'all', target: null });
  };

  // ── Tab counts ──────────────────────────────────────────────────────────────
  const departmentCounts = useMemo(() => {
    const counts = { all: reportData.length, ccs: 0, other: 0 };
    reportData.forEach(m => {
      if (m.source === 'other') counts.other += 1;
      else counts.ccs += 1;
    });
    return counts;
  }, [reportData]);

  const blockTabs = useMemo(() => {
    const counts = { all: reportData.length };
    reportData.forEach(m => {
      m.blocks.forEach(b => {
        counts[b.block] = (counts[b.block] || 0) + 1;
      });
    });

    const blocks = Object.keys(counts)
      .filter(key => key !== 'all')
      .sort((a, b) => {
        if (a === 'IRREGULAR') return 1;
        if (b === 'IRREGULAR') return -1;
        return a.localeCompare(b, undefined, { numeric: true });
      });

    return [
      { key: 'all', label: 'All Blocks', count: counts.all },
      ...blocks.map(block => ({
        key: block,
        label: block === 'IRREGULAR' ? 'Irregular' : `Block ${block}`,
        count: counts[block]
      }))
    ];
  }, [reportData]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <Breadcrumbs items={[{ label: 'Module Payments' }]} />

      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-gray-900">Module Payments Report</h2>
        <p className="mt-1 text-sm text-gray-500">
          Overview of module payments for the currently offered modules.
        </p>
      </div>

      

      {/* Error */}
      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4'>
        {!loading && (
          <div className="flex flex-wrap gap-2 items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
            {DEPARTMENT_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveDepartmentTab(tab.key)}
                className={`rounded-lg px-4 py-1 text-sm font-medium transition-all ${
                  activeDepartmentTab === tab.key
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${activeDepartmentTab === tab.key ? 'bg-blue-100 text-blue-500' : 'bg-gray-200 text-gray-600'}`}>
                  {departmentCounts[tab.key] ?? 0}
                </span>
              </button>
            ))}
          </div>
        )}

        {!loading && (
          <div className="flex flex-wrap gap-2 items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
            {blockTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveBlockTab(tab.key)}
                className={`rounded-lg px-4 py-1 text-sm font-medium transition-all ${
                  activeBlockTab === tab.key
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${activeBlockTab === tab.key ? 'bg-blue-100 text-blue-500' : 'bg-gray-200 text-gray-600'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex gap-2 ">
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
              placeholder="Search by code, title, or professor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>
        <button
          onClick={openExportAll}
          disabled={loading || allForExport.length === 0}
          className="rounded-lg text-sm px-4 py-2 cursor-pointer bg-green-600 hover:bg-green-700 text-white font-semibold shadow flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Export All
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3 ">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center ">
          <p className="text-sm text-gray-500">
            {offeredModules.length === 0
              ? 'No offered modules. Mark subjects as "offered" in the Payables module manager first.'
              : 'No modules match your search or filter.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-t-0 border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-500 text-white">
              <tr>
                {/* Subject (Code + Title merged) */}
                <th className="px-4 py-2 text-left font-semibold">
                  <button type="button" onClick={() => handleSort('courseCode')} className="inline-flex items-center gap-1">
                    Subject
                    <SortIcon column="courseCode" />
                  </button>
                </th>
                <th className="px-4 py-2 text-left font-semibold">
                  <button type="button" onClick={() => handleSort('course')} className="inline-flex items-center gap-1">
                    Course
                    <SortIcon column="course" />
                  </button>
                </th>
                {/* Department */}
                <th className="px-4 py-2 text-left font-semibold">
                  <button type="button" onClick={() => handleSort('department')} className="inline-flex items-center gap-1">
                    Department
                    <SortIcon column="department" />
                  </button>
                </th>
                {/* Professor */}
                <th className="px-4 py-2 text-left font-semibold">
                  <button type="button" onClick={() => handleSort('professor')} className="inline-flex items-center gap-1">
                    Professor
                    <SortIcon column="professor" />
                  </button>
                </th>
                {/* Block */}
                <th className="px-4 py-2 text-left font-semibold">
                  <button type="button" onClick={() => handleSort('blocks')} className="inline-flex items-center gap-1">
                    Block
                    <SortIcon column="blocks" />
                  </button>
                </th>
                {/* Term */}
                <th className="px-4 py-2 text-left font-semibold">
                  <button type="button" onClick={() => handleSort('semester')} className="inline-flex items-center gap-1">
                    Term
                    <SortIcon column="semester" />
                  </button>
                </th>
                {/* Amount */}
                <th className="px-4 py-2 text-left font-semibold">
                  <button type="button" onClick={() => handleSort('amount')} className="inline-flex items-center gap-1">
                    Amount
                    <SortIcon column="amount" />
                  </button>
                </th>
                {/* Students */}
                <th className="px-4 py-2 text-left font-semibold">
                  <button type="button" onClick={() => handleSort('totalStudents')} className="inline-flex items-center gap-1">
                    Students
                    <SortIcon column="totalStudents" />
                  </button>
                </th>
                {/* Paid */}
                <th className="px-4 py-2 text-left font-semibold">
                  <button type="button" onClick={() => handleSort('paidCount')} className="inline-flex items-center gap-1">
                    Paid
                    <SortIcon column="paidCount" />
                  </button>
                </th>
                <th className="px-4 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(mod => {
                // Collect unique blocks from all students
                const blockList = mod.blocks.map(b => b.block).filter(b => b !== '-');
                const blockDisplay = blockList.length > 0 ? blockList.join(', ') : '';

                return (
                  <tr
                    key={mod.id}
                    onClick={() => openModuleModal(mod)}
                    className="cursor-pointer border-t border-gray-100 hover:bg-gray-50 align-top"
                  >
                    {/* Subject: code bold on top, title below */}
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-gray-800">{mod.courseCode}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">{mod.courseTitle}</span>
                    </td>
                    {/* Course */}
                    <td className="px-4 py-3 text-gray-700">
                      {mod.course || (mod.source === 'ccs' ? 'BSCS' : mod.department) || <span className="italic text-gray-500">-</span>}
                    </td>
                    {/* Department */}
                    <td className="px-4 py-3 text-gray-700">
                      {mod.department || <span className="italic text-gray-500">-</span>}
                    </td>
                    {/* Professor */}
                    <td className="px-4 py-3 text-gray-700">
                      {mod.professor || <span className="italic text-gray-500">-</span>}
                    </td>
                    {/* Block */}
                    <td className="px-4 py-3 text-gray-700">
                      {blockDisplay || <span className="italic text-gray-500">-</span>}
                    </td>
                    {/* Term */}
                    <td className="px-4 py-3 text-gray-700">
                      {SEMESTER_LABELS[mod.semester] || `Sem ${mod.semester}`}
                    </td>
                    {/* Amount */}
                    <td className="px-4 py-3 text-gray-700">
                      {mod.amount !== null ? `PHP ${mod.amount.toFixed(2)}` : (
                        <span className="text-gray-400 italic text-xs">No payable</span>
                      )}
                    </td>
                    {/* Students */}
                    <td className="px-4 py-3 text-gray-700">{mod.totalStudents}</td>
                    {/* Paid */}
                    <td className="px-4 py-3 text-gray-700">{mod.paidCount}</td>
                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openExportSingle(mod); }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
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

      {/* Module detail modal */}
      {selectedModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setSelectedModule(null)}
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-start justify-between border-b border-gray-200 p-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedModule.courseCode} — {selectedModule.courseTitle}
                </h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  {YEAR_LABELS[Number(selectedModule.yearLevel)] || 'Irregular'} &nbsp;·&nbsp;
                  {SEMESTER_LABELS[selectedModule.semester] || `Sem ${selectedModule.semester}`} &nbsp;·&nbsp;
                  {selectedModule.totalStudents} student{selectedModule.totalStudents === 1 ? '' : 's'}
                  {selectedModule.professor && (
                    <> &nbsp;·&nbsp; <span className="font-medium text-gray-700">{selectedModule.professor}</span></>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedModule(null)}
                className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Block tabs */}
            <div className="border-b border-gray-200 px-5 pt-3">
              <div className="flex flex-wrap gap-2">
                {selectedModule.blocks.length === 0 ? (
                  <span className="pb-3 text-sm text-gray-500">No blocks available</span>
                ) : selectedModule.blocks.map(group => (
                  <button
                    key={group.block}
                    type="button"
                    onClick={() => setSelectedBlock(group.block)}
                    className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
                      selectedBlock === group.block
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {group.block === 'IRREGULAR' ? 'Irregular' : `Block ${group.block}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Student table */}
            <div className="overflow-auto p-5">
              {(() => {
                const group =
                  selectedModule.blocks.find(b => b.block === selectedBlock) ||
                  selectedModule.blocks[0];
                if (!group) {
                  return (
                    <p className="text-sm text-gray-500">
                      {selectedModule.hasPayable
                        ? 'No students linked to this module payable.'
                        : 'No payable record exists yet for this module.'}
                    </p>
                  );
                }
                return (
                  <table className="min-w-full text-sm">
                    <thead className="bg-blue-500 text-white">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Name</th>
                        <th className="px-3 py-2 text-center font-semibold">Status</th>
                        <th className="px-3 py-2 text-right font-semibold">Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.students.map(s => (
                        <tr key={s.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-800">{s.name}</td>
                          
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              s.status === 'PAID'
                                ? 'bg-green-100 text-green-700'
                                : s.status === 'PARTIAL'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            PHP {s.paidAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Filename modal */}
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
