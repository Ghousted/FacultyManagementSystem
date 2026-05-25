import { useCallback, useEffect, useState } from 'react';
import { ArrowBigLeft, BadgePlus, Building2, Laptop, Package } from 'lucide-react';
import PayablesSystem from './PayablesSystem';
import OtherDepartmentPayables from './OtherDepartmentPayables';
import { useAuth } from '../../contexts/AuthContext';

const PayablesMain = ({ onBackToDashboard, initialDepartment = 'ccs' }) => {
  const { currentUser } = useAuth();
  const [selectedDepartmentType, setSelectedDepartmentType] = useState(initialDepartment || 'ccs');
  const [headerActions, setHeaderActions] = useState({ ccs: null, other: null });

  const registerToolbarActions = useCallback((departmentType, actions) => {
    setHeaderActions((prev) => {
      if (prev[departmentType] === actions) {
        return prev;
      }
      return {
        ...prev,
        [departmentType]: actions
      };
    });
  }, []);

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

      <div className="mb-4 flex flex-nowrap justify-between items-center gap-3 overflow-x-auto">
        <div className="flex flex-nowrap gap-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = selectedDepartmentType === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
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
                className={`rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
                  active
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {selectedDepartmentType === 'ccs' && headerActions.ccs && (
          <div className="flex flex-nowrap items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 bg-blue-500 cursor-pointer text-sm text-white rounded-lg hover:bg-blue-600"
              onClick={headerActions.ccs.openModuleManagement}
              title="Manage subjects offered as modules"
            >
              <Package className="w-4 h-4 inline-flex mr-1 mb-0.5" />
              Modules
            </button>
            <button
              type="button"
              className="px-3 py-1.5 bg-green-500 cursor-pointer text-sm text-white rounded-lg hover:bg-green-600"
              onClick={headerActions.ccs.openAddPayable}
            >
              <BadgePlus className="w-4 h-4 inline-flex mr-1 mb-0.5" />
              Add Payables
            </button>
          </div>
        )}

        {selectedDepartmentType === 'other' && headerActions.other && (
          <div className="flex flex-nowrap items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 bg-blue-500 cursor-pointer text-sm text-white rounded-lg hover:bg-blue-600"
              onClick={headerActions.other.openModuleManagement}
              title="Manage subjects offered as modules"
            >
              <Package className="w-4 h-4 inline-flex mr-1 mb-0.5" />
              Modules
            </button>
            <button
              type="button"
              className="px-3 py-1.5 bg-green-500 cursor-pointer text-sm text-white rounded-lg hover:bg-green-600"
              onClick={headerActions.other.openAddPayable}
            >
              <BadgePlus className="w-4 h-4 inline-flex mr-1 mb-0.5" />
              Add Payables
            </button>
          </div>
        )}
      </div>

      {selectedDepartmentType === 'ccs' ? (
        <PayablesSystem
          onBackToDashboard={onBackToDashboard}
          registerToolbarActions={registerToolbarActions}
        />
      ) : (
        <OtherDepartmentPayables
          onBackToPayablesMain={onBackToDashboard}
          registerToolbarActions={registerToolbarActions}
        />
      )}
    </div>
  );
};

export default PayablesMain;
