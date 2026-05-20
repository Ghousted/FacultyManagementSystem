import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Download, Settings2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import {
  getDepartmentShareAmount,
  saveDepartmentShareAmount,
  computeDepartmentShareReport
} from '../../models/payablesModels';
import { exportDepartmentShareToExcel } from '../../utils/excelExport';
import Breadcrumbs from '../common/Breadcrumbs';

const YEAR_LABELS = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };

const SettingsModal = ({ isOpen, onClose, currentAmount, onSave, isSaving }) => {
  const [value, setValue] = useState(currentAmount);

  useEffect(() => {
    setValue(currentAmount);
  }, [currentAmount, isOpen]);

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

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(value)}
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

const CCSCutbackReports = ({ embedded = false }) => {
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(0);
  const [report, setReport] = useState({
    amountPerPaidStudent: 0,
    totalPaidCount: 0,
    totalClaimableCount: 0,
    totalShare: 0,
    totalClaimableShare: 0,
    breakdown: []
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');
  const [sortColumn, setSortColumn] = useState('courseCode');
  const [sortDirection, setSortDirection] = useState('asc');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [amountRes, reportRes] = await Promise.all([
        getDepartmentShareAmount(),
        computeDepartmentShareReport()
      ]);

      if (!amountRes.success) throw new Error(amountRes.error || 'Failed to load share amount.');
      if (!reportRes.success) throw new Error(reportRes.error || 'Failed to load CCS cutback report.');

      setAmount(amountRes.data || 0);
      setReport(reportRes.data || {
        amountPerPaidStudent: 0,
        totalPaidCount: 0,
        totalClaimableCount: 0,
        totalShare: 0,
        totalClaimableShare: 0,
        breakdown: []
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
      const res = await saveDepartmentShareAmount(nextAmount);
      if (!res.success) throw new Error(res.error || 'Failed to save share amount.');
      setAmount(res.data || 0);
      setSettingsOpen(false);
      await load();
    } catch (e) {
      setError(e.message || 'Failed to save share amount.');
    } finally {
      setSavingSettings(false);
    }
  };

  const modulesByYear = useMemo(() => {
    const grouped = { 1: [], 2: [], 3: [], 4: [], other: [] };
    (report.breakdown || []).forEach((row) => {
      const year = Number(row.yearLevel);
      if ([1, 2, 3, 4].includes(year)) grouped[year].push(row);
      else grouped.other.push(row);
    });
    return grouped;
  }, [report]);

  const sortedModules = useMemo(() => {
    const allModules = [...(report.breakdown || [])];
    
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
  }, [report, sortColumn, sortDirection]);

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">Counted Paid Students</p>
              <p className="text-2xl font-semibold text-gray-800">{report.totalPaidCount || 0}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">Accumulated CCS Share</p>
              <p className="text-2xl font-semibold text-emerald-700">PHP {Number(report.totalShare || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">Claimable Share</p>
              <p className="text-2xl font-semibold text-blue-700">PHP {Number(report.totalClaimableShare || 0).toFixed(2)}</p>
              
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
        </button>

        <button
          onClick={() => exportDepartmentShareToExcel(report, 'ccs_cutback_reports.xlsx')}
          disabled={loading || !report}
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
                      <tr key={row.moduleId} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-800 font-medium">{row.courseCode || '-'}</td>
                        <td className="px-4 py-2 text-gray-700">{row.courseTitle || '-'}</td>
                        <td className="px-4 py-2 text-gray-700">{(row.blocks || []).length ? row.blocks.join(', ') : '-'}</td>
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
                      <th className="px-4 py-2 text-right font-semibold">Paid Students</th>
                      <th className="px-4 py-2 text-right font-semibold">Share (PHP)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modulesByYear[selectedTab].map((row) => (
                      <tr key={row.moduleId} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-gray-800 font-medium">{row.courseCode || '-'}</td>
                        <td className="px-4 py-2 text-gray-700">{row.courseTitle || '-'}</td>
                        <td className="px-4 py-2 text-gray-700">{(row.blocks || []).length ? row.blocks.join(', ') : '-'}</td>
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
        onSave={handleSaveAmount}
        isSaving={savingSettings}
      />
    </div>
  );
};

export default CCSCutbackReports;
