import { useEffect, useState, lazy, Suspense } from 'react';
import { ArrowBigLeft, Medal, GraduationCap, Wallet, HandCoins } from 'lucide-react';
import Breadcrumbs from '../common/Breadcrumbs';

const ReportsModule = lazy(() => import('./DeansListReport'));
const ArchivedClasses = lazy(() => import('./ArchivedClasses'));
const ModulePaymentsReport = lazy(() => import('./ModulePaymentsReport'));
const CutBackReports = lazy(() => import('./CutBackReports'));

const ReportsLoadingSkeleton = () => (
  <div>
    <div className="mb-6 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 animate-pulse rounded-full bg-blue-100" />
        <div className="flex-1">
          <div className="mb-3 h-7 w-56 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-[520px] max-w-full animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    </div>

    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 h-5 w-40 animate-pulse rounded bg-gray-100" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="flex items-center gap-4 rounded-xl border border-gray-100 p-4">
            <div className="h-10 w-10 animate-pulse rounded-lg bg-blue-50" />
            <div className="flex-1">
              <div className="mb-2 h-4 w-1/3 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded-lg bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ReportsMain = ({ onBackToDashboard, initialReport = '' }) => {
  const [selectedReport, setSelectedReport] = useState(initialReport);

  useEffect(() => {
    setSelectedReport(initialReport);
  }, [initialReport]);

  const reportCards = [
    {
      key: 'deans',
      title: 'Reports',
      description: "Generate reports of students who qualified for the Dean's List each semester.",
      icon: Medal
    },
    {
      key: 'archived',
      title: 'Archived Classes',
      description: 'Browse archived class batches and folders to keep academic records organized.',
      icon: GraduationCap
    },
    {
      key: 'modulePayments',
      title: 'Module Payments',
      description: 'See which students paid each offered module, grouped by year level and block.',
      icon: Wallet
    },
    {
      key: 'cutbacks',
      title: 'Professor Cutbacks',
      description: 'Open tabbed cutback reports for professors and CCS modules.',
      icon: HandCoins
    }
  ];

  if (selectedReport === 'deans') {
    return (
      <Suspense fallback={<ReportsLoadingSkeleton />}>
        <ReportsModule onBackToDashboard={() => setSelectedReport('')} />
      </Suspense>
    );
  }

  if (selectedReport === 'archived') {
    return (
      <Suspense fallback={<ReportsLoadingSkeleton />}>
        <ArchivedClasses onBackToReportsMain={() => setSelectedReport('')} />
      </Suspense>
    );
  }

  if (selectedReport === 'modulePayments') {
    return (
      <Suspense fallback={<ReportsLoadingSkeleton />}>
        <ModulePaymentsReport onBackToReportsMain={() => setSelectedReport('')} />
      </Suspense>
    );
  }

  if (selectedReport === 'cutbacks') {
    return (
      <Suspense fallback={<ReportsLoadingSkeleton />}>
        <CutBackReports />
      </Suspense>
    );
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Academic Reports' }]} />
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
              Academic Reports
            </h5>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              View student performance reports, academic recognitions, and archived class records.
            </p>
          </div>
        </div>
      </div>

   
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {reportCards.map((report) => {
          const Icon = report.icon;

          return (
            <button
              key={report.key}
              type="button"
              onClick={() => setSelectedReport(report.key)}
              className="group h-64 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <div className="flex h-full flex-col justify-between">
                <div>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
                    <Icon className="h-6 w-6" />
                  </div>

                  <h5 className="text-lg font-semibold text-gray-900">
                    {report.title}
                  </h5>

                  <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    {report.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center text-sm font-medium text-blue-600">
                  Open report
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

export default ReportsMain;
