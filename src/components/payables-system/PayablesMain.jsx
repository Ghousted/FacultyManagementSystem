import { useEffect, useState } from 'react';
import { ArrowBigLeft, Building2, Laptop } from 'lucide-react';
import PayablesSystem from './PayablesSystem';
import OtherDepartmentPayables from './OtherDepartmentPayables';
import { useAuth } from '../../contexts/AuthContext';

const PayablesMain = ({ onBackToDashboard, initialDepartment = 'ccs' }) => {
  const { currentUser } = useAuth();
  const [selectedDepartmentType, setSelectedDepartmentType] = useState(initialDepartment || 'ccs');

  useEffect(() => {
    setSelectedDepartmentType(initialDepartment || 'ccs');
  }, [initialDepartment]);

  // dispatch initial breadcrumb on mount
  useEffect(() => {
    const detail = selectedDepartmentType === 'ccs'
      ? { departmentType: 'ccs', selectedFolder: null }
      : { departmentType: 'other', departmentName: null, selectedFolder: null };
    window.dispatchEvent(new CustomEvent('payables-breadcrumb', { detail }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs = [
    { key: 'ccs', label: 'CCS Department', icon: Laptop },
    { key: 'other', label: 'Other Departments', icon: Building2 }
  ];

  return (
    <div>
      {currentUser?.role === 'admin' && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            Payables Management
          </h1>
          <p className="text-sm text-gray-600">
            Manage student payables, record payments, and generate receipts.
          </p>
        </div>
      )}

      <div className="flex gap-2 w-fit items-center rounded-xl border border-slate-200 bg-slate-100 p-1 mt-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = selectedDepartmentType === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    // If clicking the already-active tab, reset that department's selection
                    if (selectedDepartmentType === tab.key) {
                      if (tab.key === 'ccs') {
                        window.dispatchEvent(new CustomEvent('payables-reset', { detail: { departmentType: 'ccs' } }));
                        window.dispatchEvent(new CustomEvent('payables-breadcrumb', { detail: { departmentType: 'ccs', selectedFolder: null } }));
                      } else {
                        window.dispatchEvent(new CustomEvent('payables-reset', { detail: { departmentType: 'other' } }));
                        window.dispatchEvent(new CustomEvent('payables-breadcrumb', { detail: { departmentType: 'other', departmentName: null, selectedFolder: null } }));
                      }
                      return;
                    }

                    setSelectedDepartmentType(tab.key);
                    if (tab.key === 'ccs') {
                      window.dispatchEvent(new CustomEvent('payables-breadcrumb', { detail: { departmentType: 'ccs', selectedFolder: null } }));
                    } else {
                      window.dispatchEvent(new CustomEvent('payables-breadcrumb', { detail: { departmentType: 'other', departmentName: null, selectedFolder: null } }));
                    }
                  }}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-1 text-sm font-medium transition-all ${
                    active
                      ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>


      {selectedDepartmentType === 'ccs' ? (
        <PayablesSystem onBackToDashboard={onBackToDashboard} />
      ) : (
        <OtherDepartmentPayables onBackToPayablesMain={onBackToDashboard} />
      )}
    </div>
  );
};

export default PayablesMain;
