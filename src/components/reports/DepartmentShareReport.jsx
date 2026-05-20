import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Download, Settings2, X } from 'lucide-react';
import {
  getDepartmentShareAmount,
  saveDepartmentShareAmount,
  computeDepartmentShareReport
} from '../../models/payablesModels';
import { exportDepartmentShareToExcel } from '../../utils/excelExport';
import Breadcrumbs from '../common/Breadcrumbs';

const SettingsModal = ({ isOpen, onClose, currentAmount, onSave, isSaving }) => {
  const [value, setValue] = useState(currentAmount);
  useEffect(() => setValue(currentAmount), [currentAmount, isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-2xl shadow-lg w-96">
        <h3 className="text-lg font-semibold">Department Share Settings</h3>
        <p className="text-sm text-gray-600 mt-1 mb-4">Amount awarded to the department per paid student in CCS modules.</p>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-l-lg">PHP</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 border border-gray-300 rounded-r-lg px-3 py-1.5"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg border">Cancel</button>
          <button onClick={() => onSave(value)} disabled={isSaving} className="px-4 py-1.5 rounded-lg bg-blue-600 text-white">{isSaving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
};

const DepartmentShareReport = () => {
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(0);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [amtRes, repRes] = await Promise.all([getDepartmentShareAmount(), computeDepartmentShareReport()]);
      if (!amtRes.success) throw new Error(amtRes.error || 'Failed to load settings.');
      if (!repRes.success) throw new Error(repRes.error || 'Failed to compute department share.');
      setAmount(amtRes.data || 0);
      setReport(repRes.data || { amountPerPaidStudent: 0, totalPaidCount: 0, totalShare: 0, breakdown: [] });
    } catch (e) {
      setError(e.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (next) => {
    setSavingSettings(true);
    try {
      const res = await saveDepartmentShareAmount(next);
      if (!res.success) throw new Error(res.error || 'Failed to save');
      setAmount(res.data);
      setSettingsOpen(false);
      await load();
    } catch (e) {
      setError(e.message || 'Failed to save');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Department Share (CCS)' }]} />
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">Department Share — CCS Modules</h2>
        <p className="text-sm text-gray-500 mt-1">Totals for CCS-handled modules. Amount per paid student: PHP {Number(amount || 0).toFixed(2)}</p>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>}

      <div className="flex items-center gap-2 mb-4">
        <button onClick={load} disabled={loading} className="px-3 py-2 border rounded"> <RefreshCw className={loading ? 'animate-spin' : ''} /> </button>
        <div className="flex-1" />
        <button onClick={() => setSettingsOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded flex items-center gap-2"><Settings2 /> Settings</button>
        <button onClick={() => report && exportDepartmentShareToExcel(report)} disabled={!report} className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2"><Download /> Export</button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-12 bg-gray-100 animate-pulse rounded" />
          <div className="h-48 bg-gray-100 animate-pulse rounded" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border p-4 rounded"> <p className="text-xs text-gray-500">Paid Students (CCS)</p> <p className="text-2xl font-semibold">{report.totalPaidCount}</p> </div>
            <div className="bg-white border p-4 rounded"> <p className="text-xs text-gray-500">Amount Per Paid Student</p> <p className="text-2xl font-semibold">PHP {Number(report.amountPerPaidStudent || amount || 0).toFixed(2)}</p> </div>
            <div className="bg-white border p-4 rounded"> <p className="text-xs text-gray-500">Total Department Share</p> <p className="text-2xl font-semibold">PHP {Number(report.totalShare || 0).toFixed(2)}</p> </div>
          </div>

          <div className="overflow-x-auto rounded border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-blue-500 text-white">
                <tr>
                  <th className="px-4 py-2 text-left">Module Code</th>
                  <th className="px-4 py-2 text-left">Title</th>
                  <th className="px-4 py-2 text-right">Paid Students</th>
                  <th className="px-4 py-2 text-right">Share (PHP)</th>
                </tr>
              </thead>
              <tbody>
                {(report.breakdown || []).map(row => (
                  <tr key={row.moduleId} className="border-t">
                    <td className="px-4 py-2">{row.courseCode || '-'}</td>
                    <td className="px-4 py-2">{row.courseTitle || '-'}</td>
                    <td className="px-4 py-2 text-right">{row.paidCount || 0}</td>
                    <td className="px-4 py-2 text-right">PHP {Number(row.shareAmount || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} currentAmount={amount} onSave={handleSave} isSaving={savingSettings} />
    </div>
  );
};

export default DepartmentShareReport;
