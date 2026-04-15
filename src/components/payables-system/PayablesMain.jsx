import { useState } from 'react';
import { ArrowLeft, Building2, Laptop, PhilippinePeso } from 'lucide-react';
import PayablesSystem from './PayablesSystem';
import OtherDepartmentPayables from './OtherDepartmentPayables';
import { ArrowBigLeft } from 'lucide-react';

const PayablesMain = ({ onBackToDashboard }) => {
  const [selectedDepartmentType, setSelectedDepartmentType] = useState('');

  if (selectedDepartmentType === 'ccs') {
    return <PayablesSystem onBackToDashboard={() => setSelectedDepartmentType('')} />;
  }

  if (selectedDepartmentType === 'other') {
    return <OtherDepartmentPayables onBackToPayablesMain={() => setSelectedDepartmentType('')} />;
  }

  return (
    <div className="">

      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-300 mb-6">
          <div className="flex items-center gap-6">
            <button
              onClick={onBackToDashboard}
              className="group flex items-center gap-2 bg-blue-600 text-white p-2 cursor-pointer rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white transition-transform"
              aria-label="Back to dashboard"
              title="Back to dashboard"
            >
              <ArrowBigLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
            <div className="">
              <h5 className="text-2xl font-medium text-blue-600">
                Payables Management System
              </h5>
              <p className="text-gray-500 text-sm">
                Manage invoices, track payments, and handle financial transactions for the institution.
              </p>
            </div>
          </div>
        </div>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CCS Department */}
        <div
        className="h-80 cursor-pointer transition-all duration-300 border border-gray-300 rounded-2xl bg-white hover:shadow-xl hover:border-green-500 hover:-translate-y-2 focus-within:border-green-500"
        onClick={() => setSelectedDepartmentType('ccs')}
        >
        <div className="text-center py-8 px-4 h-full flex flex-col justify-between">
            <div>
            <div className="mx-auto w-20 h-20 mb-6 rounded-full bg-green-50 flex items-center justify-center">
                <Laptop className="text-green-600 w-10 h-10" />
            </div>
            <h5 className="text-xl font-bold mb-4 text-green-600">
                CCS Department
            </h5>
            <p className="text-gray-600 text-sm leading-relaxed">
                Manage payables related to the College of Computer Studies.
            </p>
            </div>

            <p className="text-green-600 font-semibold mt-4 flex items-center justify-center gap-2">
            <span>Click to access</span>
            <i className="bi bi-chevron-right"></i>
            </p>
        </div>
        </div>

        {/* Other Departments */}
        <div
        className="h-80 cursor-pointer transition-all duration-300 border border-gray-300 rounded-2xl bg-white hover:shadow-xl hover:border-green-500 hover:-translate-y-2 focus-within:border-green-500"
        onClick={() => setSelectedDepartmentType('other')}
        >
        <div className="text-center py-8 px-4 h-full flex flex-col justify-between">
            <div>
            <div className="mx-auto w-20 h-20 mb-6 rounded-full bg-emerald-50 flex items-center justify-center">
                <Building2 className="text-green-600 w-10 h-10" />
            </div>
            <h5 className="text-xl font-bold mb-4 text-green-600">
                Other Departments
            </h5>
            <p className="text-gray-600 text-sm leading-relaxed">
                Create and manage independent payables from other department.
            </p>
            </div>

            <p className="text-green-600 font-semibold mt-4 flex items-center justify-center gap-2">
            <span>Click to access</span>
            <i className="bi bi-chevron-right"></i>
            </p>
        </div>
        </div>
      </div>
    </div>
  );
};

export default PayablesMain;
