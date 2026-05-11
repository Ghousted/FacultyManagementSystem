import { useEffect, useState } from 'react';
import { ArrowBigLeft, Building2, Laptop } from 'lucide-react';
import PayablesSystem from './PayablesSystem';
import OtherDepartmentPayables from './OtherDepartmentPayables';

const PayablesMain = ({ onBackToDashboard, initialDepartment = 'ccs' }) => {
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

    

       <div className="flex gap-2 bg-slate-200/90 p-1 rounded-xl w-fit mb-4">
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
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-white hover:text-gray-900 cursor-pointer'
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
