import { useState, lazy, Suspense } from 'react';
import { ArrowBigLeft, Medal, GraduationCap } from 'lucide-react';

const ReportsModule = lazy(() => import('./ReportsModule'));
const ArchivedClasses = lazy(() => import('./ArchivedClasses'));

const ReportsMain = ({ onBackToDashboard }) => {
  const [selectedReport, setSelectedReport] = useState('');

  if (selectedReport === 'deans') {
    return (
      <Suspense fallback={<p className="p-4">Loading Dean's List Report...</p>}>
        <ReportsModule onBackToDashboard={() => setSelectedReport('')} />
      </Suspense>
    );
  }

  if (selectedReport === 'archived') {
    return (
      <Suspense fallback={<p className="p-4">Loading Archived Classes...</p>}>
        <ArchivedClasses onBackToReportsMain={() => setSelectedReport('')} />
      </Suspense>
    );
  }

  return (
    <div>
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
          <div>
            <h5 className="text-2xl font-medium text-blue-600">Academic Reports</h5>
            <p className="text-gray-500 text-sm">
              Access detailed reports on student performance, class records, and more to support academic decision-making.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div
          className="h-80 cursor-pointer transition-all duration-300 border border-gray-300 rounded-2xl bg-white hover:shadow-xl hover:border-purple-500 hover:-translate-y-2 focus-within:border-purple-500"
          onClick={() => setSelectedReport('deans')}
        >
          <div className="text-center py-8 px-4 h-full flex flex-col justify-between">
            <div>
              <div className="mx-auto w-20 h-20 mb-6 rounded-full bg-purple-50 flex items-center justify-center">
                <Medal className="w-10 h-10 text-purple-600" />
              </div>
              <h5 className="text-xl font-bold mb-4 text-purple-600">Dean's List Report</h5>
              <p className="text-gray-600 text-sm leading-relaxed">
                Generate comprehensive reports of students who made it to the Dean's List for each semester.
              </p>
            </div>

            <p className="text-purple-600 font-semibold mt-4 flex items-center justify-center gap-2">
              <span>Click to access</span>
              <i className="bi bi-chevron-right"></i>
            </p>
          </div>
        </div>

        <div
          className="h-80 cursor-pointer transition-all duration-300 border border-gray-300 rounded-2xl bg-white hover:shadow-xl hover:border-purple-500 hover:-translate-y-2 focus-within:border-purple-500"
          onClick={() => setSelectedReport('archived')}
        >
          <div className="text-center py-8 px-4 h-full flex flex-col justify-between">
            <div>
              <div className="mx-auto w-20 h-20 mb-6 rounded-full bg-emerald-50 flex items-center justify-center">
                <GraduationCap className="w-10 h-10 text-purple-600" />
              </div>
              <h5 className="text-xl font-bold mb-4 text-purple-600">Archived Classes</h5>
              <p className="text-gray-600 text-sm leading-relaxed">
                Browse and manage archived class batches and folders to keep your records organized.
              </p>
            </div>

            <p className="text-purple-600 font-semibold mt-4 flex items-center justify-center gap-2">
              <span>Click to access</span>
              <i className="bi bi-chevron-right"></i>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsMain;