import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Download, Settings2, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react';
import {
  getDepartmentShareAmount,
  saveDepartmentShareAmount,
  getCutbackDeadline,
  saveCutbackDeadline,
  getOfferedModules,
  getAllModulePayablesIncludingOtherDept
} from '../../models/payablesModels';
import { getActiveTerm, getProfessors } from '../../models/facultyModels';
import { getCurriculums, getStudents } from '../../models/curriculumModels';
import {
  buildModulePaymentCourses,
  loadOtherDeptStudents
} from '../../utils/modulePaymentsReportUtils';
import {
  exportDepartmentDetailedCutbacksToExcel
} from '../../utils/excelExport';
import Breadcrumbs from '../common/Breadcrumbs';

const YEAR_LABELS = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
const DEPARTMENT_SCOPES = [
  { key: 'ccs', label: 'CCS Department' },
  { key: 'other', label: 'Other Departments' }
];

const matchesDepartmentScope = (item, scope) => (
  typeof item?.isCcs === 'boolean'
    ? (scope === 'ccs' ? item.isCcs : !item.isCcs)
    : scope === 'other'
      ? item?.source === 'other-department' || item?.source === 'other'
      : item?.source !== 'other-department' && item?.source !== 'other'
);

const formatDate = (rawValue) => {
  if (!rawValue) return '-';
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
};

const SettingsModal = ({ isOpen, onClose, currentAmount, currentDeadline, onSave, isSaving }) => {
  const [value, setValue] = useState(currentAmount);
  const [deadlineValue, setDeadlineValue] = useState(currentDeadline || '');

  useEffect(() => {
    setValue(currentAmount);
    setDeadlineValue(currentDeadline || '');
  }, [currentAmount, currentDeadline, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-3xl shadow-2xl w-96 max-w-full">
        <h3 className="text-lg font-bold text-blue-700">Configure CS Department Share</h3>
        <p className="text-sm text-gray-600 mb-4">Set the amount per counted module payment for CCS cutback computation.</p>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Share amount per counted student</label>
        <div className="flex items-center">
          <span className="px-3 py-1.5 text-sm bg-gray-100 border border-gray-300 border-r-0 rounded-l-lg">PHP</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 border border-gray-300 rounded-r-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        <label className="block text-xs font-semibold text-gray-600 mt-4 mb-1">Payment deadline</label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={deadlineValue}
            onChange={(e) => setDeadlineValue(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          {deadlineValue && (
            <button
              type="button"
              onClick={() => setDeadlineValue('')}
              className="px-3 py-1.5 rounded-lg text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ amount: value, deadline: deadlineValue })}
            disabled={isSaving}
            className="px-6 py-1.5 rounded-full cursor-pointer text-sm bg-blue-600 text-white hover:bg-blue-700"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

const StudentDetailsModal = ({ row, blocks, amountRequired, onClose }) => {
  const [activeBlock, setActiveBlock] = useState('');

  useEffect(() => {
    setActiveBlock(blocks[0]?.block || '');
  }, [blocks, row]);

  if (!row) return null;

  const totalStudents = blocks.reduce((sum, block) => sum + (block.students || []).length, 0);
  const selectedBlock = blocks.find((block) => String(block.block || '') === String(activeBlock || '')) || blocks[0] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Department Cutback Students</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">{row.courseCode || '-'} - {row.courseTitle || '-'}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Blocks: {(row.blocks || []).join(', ') || '-'} · Students: {totalStudents}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label="Close student details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {blocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
              No students found for this module.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                {blocks.map((block) => {
                  const active = String(block.block || '') === String(selectedBlock?.block || '');
                  return (
                    <button
                      key={block.block}
                      type="button"
                      onClick={() => setActiveBlock(block.block || '')}
                      className={`rounded-xl px-4 py-2 text-left text-sm transition ${
                        active
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-slate-700 hover:bg-blue-50'
                      }`}
                    >
                      <span className="font-semibold">Block {block.block || '-'}</span>
                      <span className={`ml-2 text-xs ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                        {(block.students || []).length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedBlock && (
                <section className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Block {selectedBlock.block || '-'}</h4>
                      <p className="text-xs text-slate-500">Students: {(selectedBlock.students || []).length}</p>
                    </div>
                    <div className="text-xs font-medium text-slate-500">
                      Amount: PHP {Number(amountRequired || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-blue-500 text-white">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold">Student</th>
                          <th className="px-4 py-2 text-left font-semibold">Student No.</th>
                          <th className="px-4 py-2 text-left font-semibold">Status</th>
                          <th className="px-4 py-2 text-right font-semibold">Paid</th>
                          <th className="px-4 py-2 text-left font-semibold">Payment Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedBlock.students || []).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No students in this block.</td>
                          </tr>
                        ) : (selectedBlock.students || []).map((student) => (
                          <tr key={student.id || student.studentNumber || student.name} className="border-t border-slate-100">
                            <td className="px-4 py-2 font-medium text-slate-900">{student.name || '-'}</td>
                            <td className="px-4 py-2 text-slate-600">{student.studentNumber || student.studentNo || '-'}</td>
                            <td className="px-4 py-2 text-slate-600">{student.status || 'UNPAID'}</td>
                            <td className="px-4 py-2 text-right text-slate-700">PHP {Number(student.paidAmount || 0).toFixed(2)}</td>
                            <td className="px-4 py-2 text-slate-600">{formatDate(student.paymentDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CCSCutbackReports = ({ embedded = false }) => {
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(0);
  const [deadline, setDeadline] = useState('');
  const [report, setReport] = useState({
    amountPerPaidStudent: 0,
    totalPaidCount: 0,
    totalClaimableCount: 0,
    totalShare: 0,
    totalClaimableShare: 0,
    breakdown: []
  });
  const [moduleDetails, setModuleDetails] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');
  const [sortColumn, setSortColumn] = useState('courseCode');
  const [sortDirection, setSortDirection] = useState('asc');
  const [departmentScope, setDepartmentScope] = useState('ccs');
  const [selectedModuleRow, setSelectedModuleRow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [amountRes, reportRes] = await Promise.all([
        Promise.all([getDepartmentShareAmount(), getCutbackDeadline()]),
        Promise.all([
          getActiveTerm(),
          getProfessors(),
          getStudents(),
          getCurriculums()
        ])
      ]);

      const [shareRes, deadlineRes] = amountRes;
      if (!shareRes.success) throw new Error(shareRes.error || 'Failed to load share amount.');
      if (!deadlineRes.success) throw new Error(deadlineRes.error || 'Failed to load deadline.');
      const [termRes, professorsRes, studentsRes, curriculumsRes] = reportRes;
      if (!termRes.success) throw new Error(termRes.error || 'Failed to load active term.');
      if (!professorsRes.success) throw new Error(professorsRes.error || 'Failed to load professors.');
      if (!studentsRes.success) throw new Error(studentsRes.error || 'Failed to load students.');
      if (!curriculumsRes.success) throw new Error(curriculumsRes.error || 'Failed to load curriculums.');

      const term = termRes.data;
      const [offeredRes, payablesRes, otherStudents] = await Promise.all([
        getOfferedModules(term),
        getAllModulePayablesIncludingOtherDept(term),
        loadOtherDeptStudents()
      ]);
      if (!offeredRes.success) throw new Error(offeredRes.error || 'Failed to load offered modules.');
      if (!payablesRes.success) throw new Error(payablesRes.error || 'Failed to load module payables.');

      const shareAmount = Number(shareRes.data || 0);
      const deadlineValue = deadlineRes.data || '';
      const deadlineCutoff = deadlineValue ? new Date(`${deadlineValue}T23:59:59.999`).getTime() : null;
      const courses = buildModulePaymentCourses({
        offeredModules: offeredRes.data || [],
        modulePayables: payablesRes.data || [],
        professors: professorsRes.data || [],
        students: studentsRes.data || [],
        otherDeptStudents: otherStudents || [],
        curriculums: curriculumsRes.data || [],
        activeTerm: term
      });

      const breakdown = courses.flatMap((course) => (course.blocks || [])
        .filter((block) => (block.students || []).length > 0)
        .map((block) => {
        const students = block.students || [];
        const paidCount = students.filter((student) => {
          if (student.status !== 'PAID') return false;
          if (deadlineCutoff === null) return true;
          const paidAt = student.paymentDate ? new Date(student.paymentDate).getTime() : NaN;
          return Number.isFinite(paidAt) && paidAt <= deadlineCutoff;
        }).length;
        return {
          moduleId: `${course.reportKey || course.id || course.courseCode}-${block.block}`,
          courseCode: course.courseCode,
          courseTitle: course.courseTitle,
          yearLevel: block.yearLevel || course.yearLevel,
          blocks: [block.block],
          studentCount: students.length,
          paidCount,
          shareAmount: paidCount * shareAmount,
          totalCollected: students.reduce((sum, student) => sum + Number(student.paidAmount || 0), 0),
          source: course.source,
          department: course.department,
          isCcs: course.isCcs === true,
          reportKey: course.reportKey || course.id || course.courseCode
        };
      }));

      const totalPaidCount = breakdown.reduce((sum, row) => sum + Number(row.paidCount || 0), 0);
      const totalClaimableCount = breakdown.reduce((sum, row) => sum + Number(row.studentCount || 0), 0);

      setAmount(shareAmount);
      setDeadline(deadlineValue);
      setModuleDetails(courses);
      setReport({
        amountPerPaidStudent: shareAmount,
        totalPaidCount,
        totalClaimableCount,
        totalShare: totalPaidCount * shareAmount,
        totalClaimableShare: totalClaimableCount * shareAmount,
        breakdown
      });
    } catch (e) {
      setError(e.message || 'Failed to load CCS cutback report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveAmount = async (nextAmount) => {
    setSavingSettings(true);
    try {
      const res = await saveDepartmentShareAmount(nextAmount.amount);
      if (!res.success) throw new Error(res.error || 'Failed to save share amount.');
      const deadlineRes = await saveCutbackDeadline(nextAmount.deadline || '');
      if (!deadlineRes.success) throw new Error(deadlineRes.error || 'Failed to save deadline.');
      setAmount(res.data || 0);
      setDeadline(deadlineRes.data || '');
      setSettingsOpen(false);
      await load();
    } catch (e) {
      setError(e.message || 'Failed to save share amount.');
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredBreakdown = useMemo(
    () => (report.breakdown || []).filter((row) => matchesDepartmentScope(row, departmentScope)),
    [report.breakdown, departmentScope]
  );

  const filteredModuleDetails = useMemo(
    () => (moduleDetails || [])
      .filter((module) => matchesDepartmentScope(module, departmentScope))
      .map((module) => ({
        ...module,
        blocks: (module.blocks || []).filter((block) => (block.students || []).length > 0)
      }))
      .filter((module) => (module.blocks || []).length > 0),
    [moduleDetails, departmentScope]
  );

  const selectedModuleBlocks = useMemo(() => {
    if (!selectedModuleRow) return [];
    const selectedBlocks = new Set((selectedModuleRow.blocks || []).map((block) => String(block || '').trim().toUpperCase()));
    const selectedReportKeys = new Set((selectedModuleRow.sourceRows || [])
      .map((sourceRow) => String(sourceRow.reportKey || '').trim())
      .filter(Boolean));
    const matchedModules = filteredModuleDetails.filter((module) => (
      selectedReportKeys.size > 0
        ? selectedReportKeys.has(String(module.reportKey || module.id || module.courseCode || '').trim())
        : String(module.courseCode || '') === String(selectedModuleRow.courseCode || '') &&
          String(module.courseTitle || '') === String(selectedModuleRow.courseTitle || '') &&
          Number(module.yearLevel || 0) === Number(selectedModuleRow.yearLevel || 0) &&
          matchesDepartmentScope(module, departmentScope)
    ));

    return matchedModules.flatMap((module) => (module.blocks || [])
      .filter((block) => selectedBlocks.size === 0 || selectedBlocks.has(String(block.block || '').trim().toUpperCase()))
      .map((block) => ({
        ...block,
        students: [...(block.students || [])].sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base', numeric: true }))
      })));
  }, [selectedModuleRow, filteredModuleDetails, departmentScope]);

  const selectedModuleAmount = useMemo(() => {
    if (!selectedModuleRow) return 0;
    const selectedReportKeys = new Set((selectedModuleRow.sourceRows || [])
      .map((sourceRow) => String(sourceRow.reportKey || '').trim())
      .filter(Boolean));
    const matchedModule = filteredModuleDetails.find((module) => (
      selectedReportKeys.size > 0
        ? selectedReportKeys.has(String(module.reportKey || module.id || module.courseCode || '').trim())
        : String(module.courseCode || '') === String(selectedModuleRow.courseCode || '') &&
          String(module.courseTitle || '') === String(selectedModuleRow.courseTitle || '') &&
          Number(module.yearLevel || 0) === Number(selectedModuleRow.yearLevel || 0)
    ));
    return Number(matchedModule?.amount || matchedModule?.amountRequired || 0);
  }, [selectedModuleRow, filteredModuleDetails]);

  const scopedTotals = useMemo(() => filteredBreakdown.reduce((totals, row) => {
    totals.totalPaidCount += Number(row.paidCount || 0);
    totals.totalShare += Number(row.shareAmount || 0);
    totals.totalClaimableShare += Number(row.studentCount || 0) * (Number(amount) || 0);
    return totals;
  }, { totalPaidCount: 0, totalShare: 0, totalClaimableShare: 0 }), [filteredBreakdown, amount]);

  const subjectRows = useMemo(() => {
    const map = new Map();
    filteredBreakdown.forEach((row) => {
      const key = `${row.courseCode || ''}::${row.courseTitle || ''}::${row.yearLevel || ''}::${row.source || ''}`;
      if (!map.has(key)) {
        map.set(key, {
          ...row,
          sourceRows: [],
          blocks: [],
          blockDetails: [],
          studentCount: 0,
          paidCount: 0,
          shareAmount: 0,
          totalCollected: 0
        });
      }
      const current = map.get(key);
      current.sourceRows.push(row);
      const block = (row.blocks || [])[0] || '-';
      current.blocks.push(block);
      current.blockDetails.push({
        block,
        studentCount: row.studentCount || 0,
        paidCount: row.paidCount || 0
      });
      current.studentCount += Number(row.studentCount || 0);
      current.paidCount += Number(row.paidCount || 0);
      current.shareAmount += Number(row.shareAmount || 0);
      current.totalCollected += Number(row.totalCollected || 0);
    });
    return Array.from(map.values()).map((row) => ({
      ...row,
      blocks: Array.from(new Set(row.blocks)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    }));
  }, [filteredBreakdown]);

  const modulesByYear = useMemo(() => {
    const grouped = { 1: [], 2: [], 3: [], 4: [], other: [] };
    subjectRows.forEach((row) => {
      const year = Number(row.yearLevel);
      if ([1, 2, 3, 4].includes(year)) grouped[year].push(row);
      else grouped.other.push(row);
    });
    return grouped;
  }, [subjectRows]);

  const sortedModules = useMemo(() => {
    const allModules = [...subjectRows];
    
    allModules.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortColumn) {
        case 'courseCode':
          aVal = (a.courseCode || '').toLowerCase();
          bVal = (b.courseCode || '').toLowerCase();
          break;
        case 'courseTitle':
          aVal = (a.courseTitle || '').toLowerCase();
          bVal = (b.courseTitle || '').toLowerCase();
          break;
        case 'paidCount':
          aVal = a.paidCount || 0;
          bVal = b.paidCount || 0;
          break;
        case 'shareAmount':
          aVal = a.shareAmount || 0;
          bVal = b.shareAmount || 0;
          break;
        default:
          aVal = '';
          bVal = '';
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return allModules;
  }, [subjectRows, sortColumn, sortDirection]);

  const getSortIcon = (column) => {
    if (sortColumn !== column) {
      return <ChevronsUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-blue-600" />
      : <ChevronDown className="w-4 h-4 text-blue-600" />;
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  return (
    <div>
      {!embedded && (
        <Breadcrumbs items={[{ label: 'CCS Cutback Reports' }]} />
      )}

   

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

     
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              {DEPARTMENT_SCOPES.map((scope) => {
                const active = departmentScope === scope.key;
                return (
                  <button
                    key={scope.key}
                    type="button"
                    onClick={() => {
                      setDepartmentScope(scope.key);
                      setSelectedTab('all');
                      setSelectedModuleRow(null);
                    }}
                    className={`rounded-xl px-4 py-3 text-left transition ${
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{scope.label}</span>
                    <span className={`mt-1 block text-xs ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                      {scope.key === 'ccs' ? 'CCS module share report' : 'Other department module share report'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">Counted Paid Students</p>
              <p className="text-2xl font-semibold text-gray-800">{scopedTotals.totalPaidCount || 0}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">Accumulated Department Share</p>
              <p className="text-2xl font-semibold text-emerald-700">PHP {Number(scopedTotals.totalShare || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">Claimable Share</p>
              <p className="text-2xl font-semibold text-blue-700">PHP {Number(scopedTotals.totalClaimableShare || 0).toFixed(2)}</p>
              
            </div>
          </div>

 <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 p-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 cursor-pointer"
          title="Reload"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
         {/* Tab Navigation */}
          <div className="flex gap-2 w-fit items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              onClick={() => setSelectedTab('all')}
              className={`rounded-lg px-4 py-1 text-sm font-medium transition-all ${
                selectedTab === 'all'
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer  '
              }`}
            >
              All
            </button>
            {[1, 2, 3, 4].map((year) => (
              <button
                key={year}
                onClick={() => setSelectedTab(String(year))}
              className={`rounded-lg px-4 py-1 text-sm font-medium transition-all ${
                  selectedTab === String(year)
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer  '
                }`}
              >
                {YEAR_LABELS[year]}
              </button>
            ))}
          </div>
          
        <div className="flex-1" />

        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded-lg text-sm px-4 py-2 cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-semibold shadow flex items-center gap-2"
        >
          <Settings2 className="h-4 w-4" /> Share: PHP {Number(amount).toFixed(2)}
          {deadline && <span className="ml-1 border-l border-blue-300 pl-2 text-xs">{deadline}</span>}
        </button>

        <button
          onClick={() => {
            const exportModules = (moduleDetails || [])
              .map((module) => ({
                ...module,
                blocks: (module.blocks || []).filter((block) => (block.students || []).length > 0)
              }))
              .filter((module) => (module.blocks || []).length > 0);
            exportDepartmentDetailedCutbacksToExcel(exportModules, amount, 'department_cutback_reports.xlsx', { deadline });
          }}
          disabled={loading || moduleDetails.length === 0}
          className="rounded-lg text-sm px-4 py-2 cursor-pointer bg-green-500 hover:bg-green-600 text-white font-semibold shadow flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </div>


         

          {/* Tab Content */}
          {selectedTab === 'all' ? (
            // Show all modules in single sorted table
            <div className="rounded-xl border border-gray-200 bg-white  overflow-x-auto">
              
              {sortedModules.length === 0 ? (
                <div className="px-4 py-4 text-sm text-gray-500 text-center">No modules listed.</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-blue-500 text-white">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">
                        <button
                          onClick={() => handleSort('courseCode')}
                          className="flex items-center gap-2 hover:opacity-75 transition-opacity"
                        >
                          Module Code
                          {getSortIcon('courseCode')}
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left font-semibold">
                        <button
                          onClick={() => handleSort('courseTitle')}
                          className="flex items-center gap-2 hover:opacity-75 transition-opacity"
                        >
                          Module Title
                          {getSortIcon('courseTitle')}
                        </button>
                      </th>
                      <th className="px-4 py-2 text-left font-semibold">Blocks</th>
                      <th className="px-4 py-2 text-right font-semibold">Students</th>
                      <th className="px-4 py-2 text-right font-semibold">
                        <button
                          onClick={() => handleSort('paidCount')}
                          className="flex items-center gap-2 ml-auto hover:opacity-75 transition-opacity"
                        >
                          Paid Students
                          {getSortIcon('paidCount')}
                        </button>
                      </th>
                      <th className="px-4 py-2 text-right font-semibold">
                        <button
                          onClick={() => handleSort('shareAmount')}
                          className="flex items-center gap-2 ml-auto hover:opacity-75 transition-opacity"
                        >
                          Share (PHP)
                          {getSortIcon('shareAmount')}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedModules.map((row) => (
                      <tr
                        key={row.moduleId}
                        onClick={() => setSelectedModuleRow(row)}
                        className="cursor-pointer border-t border-gray-100 hover:bg-blue-50"
                      >
                        <td className="px-4 py-2 text-gray-800 font-medium">{row.courseCode || '-'}</td>
                        <td className="px-4 py-2 text-gray-700">{row.courseTitle || '-'}</td>
                        <td className="px-4 py-2 text-gray-700">{(row.blocks || []).length ? row.blocks.join(', ') : '-'}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{row.studentCount || 0}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{row.paidCount || 0}</td>
                        <td className="px-4 py-2 text-right text-gray-700">PHP {Number(row.shareAmount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            // Show selected year only
            <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
             
              {modulesByYear[selectedTab].length === 0 ? (
                <div className="px-4 py-4 text-sm text-gray-500 text-center">No modules listed for this year level.</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-blue-500 text-white">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Module Code</th>
                      <th className="px-4 py-2 text-left font-semibold">Module Title</th>
                      <th className="px-4 py-2 text-left font-semibold">Blocks</th>
                      <th className="px-4 py-2 text-right font-semibold">Students</th>
                      <th className="px-4 py-2 text-right font-semibold">Paid Students</th>
                      <th className="px-4 py-2 text-right font-semibold">Share (PHP)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modulesByYear[selectedTab].map((row) => (
                      <tr
                        key={row.moduleId}
                        onClick={() => setSelectedModuleRow(row)}
                        className="cursor-pointer border-t border-gray-100 hover:bg-blue-50"
                      >
                        <td className="px-4 py-2 text-gray-800 font-medium">{row.courseCode || '-'}</td>
                        <td className="px-4 py-2 text-gray-700">{row.courseTitle || '-'}</td>
                        <td className="px-4 py-2 text-gray-700">{(row.blocks || []).length ? row.blocks.join(', ') : '-'}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{row.studentCount || 0}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{row.paidCount || 0}</td>
                        <td className="px-4 py-2 text-right text-gray-700">PHP {Number(row.shareAmount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentAmount={amount}
        currentDeadline={deadline}
        onSave={handleSaveAmount}
        isSaving={savingSettings}
      />

      <StudentDetailsModal
        row={selectedModuleRow}
        blocks={selectedModuleBlocks}
        amountRequired={selectedModuleAmount}
        onClose={() => setSelectedModuleRow(null)}
      />
    </div>
  );
};

export default CCSCutbackReports;
