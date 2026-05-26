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
import { getActiveTerm, getProfessors, getOtherDepartments } from '../../models/facultyModels';
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

const getCourseGroupLabel = (item) => (
  item?.course ||
  item?.classCourse ||
  item?.curriculumName ||
  item?.department ||
  (item?.isCcs ? 'CCS Department' : 'Other Department')
);

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
      <div className="bg-white  rounded-3xl shadow-2xl w-md max-w-full">
        <h3 className="text-lg font-medium px-8 py-4 border-b border-slate-200 bg-slate-100 rounded-t-3xl">Configure CS Department Share</h3>
       <div className="px-8 py-4">
           <p className="text-sm text-gray-600 mb-4">Set the amount per counted module payment for CCS cutback computation.</p>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Share amount per counted student</label>
        <div className="flex items-center">
          <span className="px-3 py-1.5 text-sm bg-gray-100 border border-gray-300 border-r-0 rounded-l-lg">₱</span>
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

        <div className="flex justify-end gap-2 mt-8">
          <button
            onClick={onClose}
            disabled={isSaving}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-600 bg-white hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ amount: value, deadline: deadlineValue })}
            disabled={isSaving}
                className="px-4 py-1.5 w-24 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
       </div>
      </div>
    </div>
  );
};

const FilenameModal = ({ isOpen, onClose, onConfirm, defaultName }) => {
  const [name, setName] = useState(defaultName);

  useEffect(() => setName(defaultName), [defaultName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white  rounded-3xl shadow-2xl w-sm max-w-full">
        <h3 className="text-lg font-medium border-b border-slate-200 px-6 py-4 bg-slate-100 rounded-t-3xl">Export to Excel</h3>
          <div className="px-8 py-4">
                <p className="text-sm text-gray-600 mb-4">Enter a filename for the department cutback export.</p>
        <div className="flex items-center">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="flex-1 border border-gray-300 rounded-l-lg px-3 py-1.5 text-sm focus:outline-none"
          />
          <span className="px-3 py-1.5 text-sm bg-gray-100 border border-gray-300 border-l-0 rounded-r-lg">.xlsx</span>
        </div>
        <div className="flex justify-end gap-2 mt-8">
          <button
            onClick={onClose}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-600 bg-white hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm((name || defaultName).trim())}
                className="px-4 py-1.5 w-24 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
          >
            Export
          </button>
        </div>
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
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-8 py-4 bg-slate-100">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Department Cutback Students</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">{row.courseCode || '-'} - {row.courseTitle || '-'}</h3>
           
          </div>
          <button
            type="button"
            onClick={onClose}
                  className="rounded-full bg-white p-1 cursor-pointer text-slate-500 hover:text-red-600 transition"
            aria-label="Close student details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {blocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
              No students found for this module.
            </div>
          ) : (
            <div className="space-y-4">
  <div className="flex flex-wrap gap-1.5">
                {blocks.map((block) => {
                  const active = String(block.block || '') === String(selectedBlock?.block || '');
                  return (
                    <button
                      key={block.block}
                      type="button"
                      onClick={() => setActiveBlock(block.block || '')}
              className={`rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
                        active
                          ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
                      }`}
                    >
                      Block {block.block || '-'}
                      
                    </button>
                  );
                })}
              </div>

              {selectedBlock && (
                <section className="overflow-hidden rounded-lg border border-slate-200">
                
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-blue-500 text-white text-xs uppercase tracking-wide">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold w-[5%]"> No. </th>
                          <th className="px-4 py-2 text-left font-semibold w-[30%]">Student Name</th>
                          <th className="px-4 py-2 text-left font-semibold w-[20%]">Student No.</th>
                          <th className="px-4 py-2 text-left font-semibold w-[15%]">Status</th>
                          <th className="px-4 py-2 text-left font-semibold w-[15%]">Paid</th>
                          <th className="px-4 py-2 text-left font-semibold w-[15%]">Payment Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedBlock.students || []).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-6 text-center text-slate-500">No students in this block.</td>
                          </tr>
                        ) : (selectedBlock.students || []).map((student, index) => (
                          <tr key={student.id || student.studentNumber || student.name} className="border-t border-slate-100">
                            <td className="px-4 py-2 font-medium text-slate-900">{index + 1}</td>
                            <td className="px-4 py-2 text-slate-600">{student.name || ''}</td>
                            <td className="px-4 py-2 text-slate-600">{student.studentNumber || student.studentNo || ''}</td>
                            <td className="px-4 py-2 text-slate-600">{student.status || 'UNPAID'}</td>
                            <td className="px-4 py-2 text-left text-slate-700">₱ {Number(student.paidAmount || 0).toFixed(2)}</td>
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

const CCSCutbackReports = ({ embedded = false, onBreadcrumbChange }) => {
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
  const [filenameModalOpen, setFilenameModalOpen] = useState(false);
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
          getCurriculums(),
          getOtherDepartments()
        ])
      ]);

      const [shareRes, deadlineRes] = amountRes;
      if (!shareRes.success) throw new Error(shareRes.error || 'Failed to load share amount.');
      if (!deadlineRes.success) throw new Error(deadlineRes.error || 'Failed to load deadline.');
      const [termRes, professorsRes, studentsRes, curriculumsRes, departmentsRes] = reportRes;
      if (!termRes.success) throw new Error(termRes.error || 'Failed to load active term.');
      if (!professorsRes.success) throw new Error(professorsRes.error || 'Failed to load professors.');
      if (!studentsRes.success) throw new Error(studentsRes.error || 'Failed to load students.');
      if (!curriculumsRes.success) throw new Error(curriculumsRes.error || 'Failed to load curriculums.');
      if (!departmentsRes.success) throw new Error(departmentsRes.error || 'Failed to load other departments.');

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
      }).map((course) => {
        if (course.isCcs) return course;
        const department = (departmentsRes.data || []).find((dept) => dept.id === course.departmentId);
        return {
          ...course,
          departmentCode: course.departmentCode || department?.code || department?.name || course.departmentName || course.department || 'OTHER',
          departmentName: course.departmentName || department?.name || course.department || 'Other Department'
        };
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
          course: getCourseGroupLabel(course),
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

  const breadcrumbItems = useMemo(() => {
    const scopeLabel = DEPARTMENT_SCOPES.find((scope) => scope.key === departmentScope)?.label || 'Department';
    const items = [
      { label: 'Department Cutback' },
      {
        label: scopeLabel,
        onClick: selectedTab !== 'all' || selectedModuleRow
          ? () => {
              setSelectedTab('all');
              setSelectedModuleRow(null);
            }
          : null
      }
    ];

    if (selectedTab !== 'all') {
      items.push({
        label: YEAR_LABELS[selectedTab] || `Year ${selectedTab}`,
        onClick: selectedModuleRow ? () => setSelectedModuleRow(null) : null
      });
    }

    if (selectedModuleRow) {
      items.push({
        label: selectedModuleRow.courseCode || 'Module Details'
      });
    }

    return items;
  }, [departmentScope, selectedTab, selectedModuleRow]);

  useEffect(() => {
    if (!onBreadcrumbChange) return;
    onBreadcrumbChange(breadcrumbItems);
  }, [onBreadcrumbChange, breadcrumbItems]);

  const subjectRows = useMemo(() => {
    const map = new Map();
    filteredBreakdown
      .filter((row) => Number(row.studentCount || 0) > 0)
      .forEach((row) => {
      const key = `${row.course || ''}::${row.courseCode || ''}::${row.courseTitle || ''}::${row.yearLevel || ''}::${row.source || ''}`;
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
    })).filter((row) => Number(row.studentCount || 0) > 0);
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

  const groupedSortedModules = useMemo(() => {
    const map = new Map();
    sortedModules.forEach((row) => {
      const label = getCourseGroupLabel(row);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(row);
    });
    return Array.from(map.entries())
      .map(([course, rows]) => ({ course, rows }))
      .sort((left, right) => left.course.localeCompare(right.course, undefined, { sensitivity: 'base', numeric: true }));
  }, [sortedModules]);

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

  const handleExportConfirm = (filename) => {
    const safeName = (filename || 'department_cutback_reports').replace(/\.xlsx$/i, '').trim() || 'department_cutback_reports';
    const exportModules = (moduleDetails || [])
      .map((module) => ({
        ...module,
        blocks: (module.blocks || []).filter((block) => (block.students || []).length > 0)
      }))
      .filter((module) => (module.blocks || []).length > 0);
    exportDepartmentDetailedCutbacksToExcel(exportModules, amount, `${safeName}.xlsx`, { deadline });
    setFilenameModalOpen(false);
  };

  const renderModulesTable = (rows, sortable = true) => (
    <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-blue-500 text-white text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-2 text-left font-semibold">
              {sortable ? (
                <button
                  onClick={() => handleSort('courseCode')}
                  className="flex items-center gap-2 hover:opacity-75 transition-opacity"
                >
                  MODULE CODE
                  {getSortIcon('courseCode')}
                </button>
              ) : 'Module Code'}
            </th>
            <th className="px-4 py-2 text-left font-semibold">
              {sortable ? (
                <button
                  onClick={() => handleSort('courseTitle')}
                  className="flex items-center gap-2 hover:opacity-75 transition-opacity"
                >
                  MODULE TITLE
                  {getSortIcon('courseTitle')}
                </button>
              ) : 'Module Title'}
            </th>
            <th className="px-4 py-2 text-left font-semibold">BLOCKS</th>
            <th className="px-4 py-2 text-right font-semibold">STUDENTS</th>
            <th className="px-4 py-2 text-right font-semibold">
              {sortable ? (
                <button
                  onClick={() => handleSort('paidCount')}
                  className="flex items-center gap-2 ml-auto hover:opacity-75 transition-opacity"
                >
                  PAID STUDENTS
                  {getSortIcon('paidCount')}
                </button>
              ) : 'Paid Students'}
            </th>
            <th className="px-4 py-2 text-right font-semibold">
              {sortable ? (
                <button
                  onClick={() => handleSort('shareAmount')}
                  className="flex items-center gap-2 ml-auto hover:opacity-75 transition-opacity"
                >
                  SHARE (₱)
                  {getSortIcon('shareAmount')}
                </button>
              ) : 'Share (₱)'}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.course || ''}-${row.moduleId}`}
              onClick={() => setSelectedModuleRow(row)}
              className="cursor-pointer border-t border-gray-100 hover:bg-blue-50"
            >
              <td className="px-4 py-2 text-gray-800 font-medium">{row.courseCode || '-'}</td>
              <td className="px-4 py-2 text-gray-700">{row.courseTitle || '-'}</td>
              <td className="px-4 py-2 text-gray-700">{(row.blocks || []).length ? row.blocks.join(', ') : '-'}</td>
              <td className="px-4 py-2 text-right text-gray-700">{row.studentCount || 0}</td>
              <td className="px-4 py-2 text-right text-gray-700">{row.paidCount || 0}</td>
              <td className="px-4 py-2 text-right text-gray-700">₱ {Number(row.shareAmount || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCourseSections = (groups, sortable = true) => (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.course} className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">{group.course}</h3>
            <span className="text-xs text-slate-500">{group.rows.length} module{group.rows.length === 1 ? '' : 's'}</span>
          </div>
          {renderModulesTable(group.rows, sortable)}
        </section>
      ))}
    </div>
  );

  return (
    <div>
      {!embedded && (
        <Breadcrumbs items={breadcrumbItems} />
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
        <div className="space-y-4">
         

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">Counted Paid Students</p>
              <p className="text-2xl font-semibold text-gray-800">{scopedTotals.totalPaidCount || 0}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">Accumulated Department Share</p>
              <p className="text-2xl font-semibold text-emerald-700">₱ {Number(scopedTotals.totalShare || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">Claimable Share</p>
              <p className="text-2xl font-semibold text-blue-700">₱ {Number(scopedTotals.totalClaimableShare || 0).toFixed(2)}</p>
              
            </div>
          </div>

           <div className="flex items-center justify-between gap-4">
  <div className="flex flex-wrap gap-1.5">
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
              className={`rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
                      active
                         ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
                    }`}
                  >
                    {scope.label}
                   
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
               <button
          onClick={() => setSettingsOpen(true)}
          className="rounded-lg text-sm px-4 py-2 cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-semibold shadow flex items-center gap-2"
        >
          <Settings2 className="h-4 w-4" /> Share
        </button>

        <button
          onClick={() => setFilenameModalOpen(true)}
          disabled={loading || moduleDetails.length === 0}
          className="rounded-lg text-sm px-4 py-2 cursor-pointer bg-green-500 hover:bg-green-600 text-white font-semibold shadow flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Export
        </button>
        </div>

          </div>


       
          
      

         

          {/* Tab Content */}
          {selectedTab === 'all' ? (
            // Show all modules separated by course/program
            <div>
              {sortedModules.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-sm text-gray-500 text-center">No modules listed.</div>
              ) : (
                renderCourseSections(groupedSortedModules)
              )}
            </div>
          ) : (
            // Show selected year only
            <div>
             
              {modulesByYear[selectedTab].length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-sm text-gray-500 text-center">No modules listed for this year level.</div>
              ) : (
                renderCourseSections(
                  Array.from(modulesByYear[selectedTab].reduce((map, row) => {
                    const label = getCourseGroupLabel(row);
                    if (!map.has(label)) map.set(label, []);
                    map.get(label).push(row);
                    return map;
                  }, new Map()).entries()).map(([course, rows]) => ({ course, rows })),
                  false
                )
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

      <FilenameModal
        isOpen={filenameModalOpen}
        onClose={() => setFilenameModalOpen(false)}
        onConfirm={handleExportConfirm}
        defaultName="department_cutback_reports"
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
