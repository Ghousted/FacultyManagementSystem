import { useState } from 'react';
import { ArrowBigLeft, Building2, Laptop } from 'lucide-react';
import PayablesSystem from './PayablesSystem';
import OtherDepartmentPayables from './OtherDepartmentPayables';

const PayablesMain = ({ onBackToDashboard }) => {
  const [selectedDepartmentType, setSelectedDepartmentType] = useState('');

  const departmentCards = [
    {
      key: 'ccs',
      title: 'CCS Department',
      description: 'Manage payables related to the College of Computer Studies.',
      icon: Laptop
    },
    {
      key: 'other',
      title: 'Other Departments',
      description: 'Create and manage independent payables from other departments.',
      icon: Building2
    }
  ];

  if (selectedDepartmentType === 'ccs') {
    return <PayablesSystem onBackToDashboard={() => setSelectedDepartmentType('')} />;
  }

  if (selectedDepartmentType === 'other') {
    return <OtherDepartmentPayables onBackToPayablesMain={() => setSelectedDepartmentType('')} />;
  }

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            onClick={onBackToDashboard}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowBigLeft className="h-5 w-5" />
          </button>

          <div>
            <h5 className="text-2xl font-semibold text-gray-900">
              Payables Management System
            </h5>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              Manage invoices, track payments, and handle institutional financial records.
            </p>
          </div>
        </div>
      </div>

    

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {departmentCards.map((department) => {
          const Icon = department.icon;

          return (
            <button
              key={department.key}
              type="button"
              onClick={() => setSelectedDepartmentType(department.key)}
              className="group h-64 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <div className="flex h-full flex-col justify-between">
                <div>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
                    <Icon className="h-6 w-6" />
                  </div>

                  <h5 className="text-lg font-semibold text-gray-900">
                    {department.title}
                  </h5>

                  <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    {department.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center text-sm font-medium text-blue-600">
                  Open module
                  <i className="bi bi-chevron-right ml-2 text-xs transition group-hover:translate-x-0.5"></i>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PayablesMain;
