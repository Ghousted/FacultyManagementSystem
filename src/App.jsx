import './App.css';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense, useEffect, useState } from 'react';
import { BadgePlus, BookMarked, FileSliders, Building2, UserPlus } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import AuthContainer from './components/auth/AuthContainer';
import PasswordReset from './components/auth/PasswordReset';
import PasswordResetConfirm from './components/auth/PasswordResetConfirm';
import Dashboard from './components/Dashboard';
import Layout from './components/layout/Layout';
import AdminPanel from './components/admin/AdminPanel';
import CurriculumChecker from './components/curriculum-checker/CurriculumChecker';
import CurriculumCheckerMain from './components/curriculum-checker/CurriculumCheckerMain';
import LogsPlaceholder from './components/LogsPlaceholder';
import Breadcrumbs, { goToRoleDashboard } from './components/common/Breadcrumbs';

const FacultyMain = lazy(() => import('./components/faculty/FacultyMain'));
const ReportsMain = lazy(() => import('./components/reports/ReportsMain'));
const PayablesMain = lazy(() => import('./components/payables-system/PayablesMain'));
const PaymentsModule = lazy(() => import('./components/payments/PaymentsModule'));
const StudentManagement = lazy(() => import('./components/curriculum-checker/StudentManagement'));
const TermEnrollmentPanel = lazy(() => import('./components/curriculum-checker/TermEnrollmentPanel'));

const LoadingPanel = ({ label = 'Loading module...' }) => (
  <div className="rounded-2xl border border-blue-100 bg-white p-6 text-sm text-gray-500 shadow-sm">
    {label}
  </div>
);

const StudentEnrollmentHub = ({ initialTab = 'students', onBackToDashboard }) => {
  const [tab, setTab] = useState(initialTab);
  const [studentDetailOpen, setStudentDetailOpen] = useState(false);
  const [openedStudentName, setOpenedStudentName] = useState('');
    const [breadcrumbState, setBreadcrumbState] = useState({ mode: initialTab, selectedFolder: null, selectedStudent: null });
  const { currentUser } = useAuth();

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const handleStudentDetailChange = (event) => {
      const open = Boolean(event.detail?.open);
      const name = event.detail?.name || '';
      setStudentDetailOpen(open);
      setOpenedStudentName(name);
      // reflect detail state in top-level breadcrumb
      setBreadcrumbState((prev) => ({ ...prev, mode: 'students', selectedStudent: open ? { name } : null }));
    };

    const handleBreadcrumb = (event) => {
      const d = event.detail || {};
      setBreadcrumbState((prev) => ({ ...prev, ...d }));
    };

    const handlePayablesBreadcrumb = (event) => {
      const d = event.detail || {};
      setBreadcrumbState((prev) => ({ ...prev, mode: 'payables', payables: d }));
    };

    window.addEventListener('student-detail-state', handleStudentDetailChange);
    window.addEventListener('student-breadcrumb', handleBreadcrumb);
    window.addEventListener('payables-breadcrumb', handlePayablesBreadcrumb);
    return () => {
      window.removeEventListener('student-detail-state', handleStudentDetailChange);
      window.removeEventListener('student-breadcrumb', handleBreadcrumb);
      window.removeEventListener('payables-breadcrumb', handlePayablesBreadcrumb);
    };
  }, []);

  useEffect(() => {
    if (tab !== 'students') {
      setStudentDetailOpen(false);
      setOpenedStudentName('');
      // clear selected student from breadcrumb when leaving students view
      setBreadcrumbState((prev) => ({ ...prev, mode: tab, selectedStudent: null }));
    } else {
      // ensure mode stays in sync
      setBreadcrumbState((prev) => ({ ...prev, mode: tab }));
    }
  }, [tab]);

  useEffect(() => {
    setBreadcrumbState((prev) => ({ ...prev, mode: tab }));
  }, [tab]);

  // Unified breadcrumb at top (receives state via `student-breadcrumb` events)
  const renderTopBreadcrumb = () => {
    const { mode, selectedFolder, selectedStudent, selectedDepartment, course, combo } = breadcrumbState || {};
    const activeMode = mode || (tab === 'enrollment' ? 'enrollment' : tab === 'other' ? 'other' : 'students');

    const mainLabel = activeMode === 'enrollment'
      ? 'Enrollment Management'
      : activeMode === 'other'
        ? 'Other Department'
        : 'Student Management';
    const crumbs = [{ label: mainLabel, onClick: null }];

    const openOtherDepartmentRoot = () => {
      window.dispatchEvent(new CustomEvent('open-other-department-root'));
    };

    const openOtherDepartmentCourse = (courseName) => {
      window.dispatchEvent(new CustomEvent('open-other-department-course', { detail: { course: courseName } }));
    };

    const openOtherDepartmentCombo = (courseName, yearValue, blockValue) => {
      window.dispatchEvent(new CustomEvent('open-other-department-combo', {
        detail: { course: courseName, year: yearValue, block: blockValue }
      }));
    };

    // show selected department when in Other mode
    if (activeMode === 'other' && selectedDepartment && (selectedDepartment.name || selectedDepartment)) {
      crumbs.push({ label: selectedDepartment.name || selectedDepartment, onClick: openOtherDepartmentRoot });
    }

    // show selected course + year/block as a single crumb when present
    const folder = selectedFolder || (combo ? { year: combo.year, block: combo.block } : null);
    if (activeMode === 'other' && (course || folder)) {
      if (folder && (folder.isInactiveFolder || folder.isIrregular)) {
        const label = folder.isInactiveFolder ? 'Archived Students' : 'Irregular students';
        crumbs.push({ label, onClick: () => window.dispatchEvent(new CustomEvent('open-student-folder', { detail: { selectedFolder: folder } })) });
      } else if (course || folder) {
        const y = Number(folder?.year);
        const block = folder?.block;
        const yearLabel = y === 1 ? '1st' : y === 2 ? '2nd' : y === 3 ? '3rd' : y === 4 ? '4th' : `${folder?.year}th`;
        const comboLabel = y
          ? `${course || ''} ${yearLabel} Year${block ? ` ${block}` : ''}`.trim()
          : `${course || ''}`.trim();
        crumbs.push({
          label: comboLabel || 'Other Department',
          onClick: course && folder ? () => openOtherDepartmentCombo(course, folder.year, folder.block) : course ? () => openOtherDepartmentCourse(course) : openOtherDepartmentRoot
        });
      }
    }

    // show selected folder for students or enrollment modes
    if ((activeMode === 'students' || activeMode === 'enrollment') && folder) {
      if (folder.isInactiveFolder) {
        const label = 'Archived Students';
        crumbs.push({ label, onClick: () => window.dispatchEvent(new CustomEvent('open-student-folder', { detail: { selectedFolder: folder } })) });
      } else if (folder.isIrregular) {
        const label = 'Irregular Students';
        crumbs.push({ label, onClick: () => window.dispatchEvent(new CustomEvent(activeMode === 'enrollment' ? 'open-enrollment-folder' : 'open-student-folder', { detail: { selectedFolder: folder } })) });
      } else {
        const y = Number(folder?.year);
        const block = folder?.block;
        const yearLabel = y === 1 ? '1st' : y === 2 ? '2nd' : y === 3 ? '3rd' : y === 4 ? '4th' : `${folder?.year}th`;
        const folderLabel = `${yearLabel} Year${block ? ` Block ${block}` : ''}`.trim();
        crumbs.push({ label: folderLabel || 'Folder', onClick: () => window.dispatchEvent(new CustomEvent(activeMode === 'enrollment' ? 'open-enrollment-folder' : 'open-student-folder', { detail: { selectedFolder: folder } })) });
      }
    }

    if (selectedStudent && selectedStudent.name) {
      crumbs.push({ label: selectedStudent.name, onClick: null });
    }

    return (
      <Breadcrumbs
        items={crumbs.map((c, i) => {
          // Make the second breadcrumb item a button to switch between Student/Enrollment
          if (i === 0) {
            const isEnrollment = activeMode === 'enrollment';
            const isOther = activeMode === 'other';
            const onClick = () => {
              if (isEnrollment) {
                setTab('enrollment');
                window.dispatchEvent(new CustomEvent('reset-enrollment-manager'));
              } else if (isOther) {
                setTab('other');
                window.dispatchEvent(new CustomEvent('reset-other-department'));
              } else {
                setTab('students');
                window.dispatchEvent(new CustomEvent('reset-student-management'));
              }
              setBreadcrumbState((prev) => ({
                ...prev,
                selectedDepartment: isOther ? null : prev.selectedDepartment,
                selectedStudent: null
              }));
              setStudentDetailOpen(false);
              setOpenedStudentName('');
            };

            return { ...c, onClick };
          }
          return c;
        })}
      />
    );
  };

  const otherDepartmentOpen = tab === 'other' && Boolean(breadcrumbState?.selectedDepartment);

  return (
    <div>
      {renderTopBreadcrumb()}

      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-gray-900">
          {tab === 'students' ? 'Student Management' : tab === 'enrollment' ? 'Enrollment Management' : 'Other Departments'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {tab === 'students'
            ? 'Manage student records, curriculum assignments, year levels, blocks, and their personal information.'
            : tab === 'enrollment'
              ? 'Manage students enrollment for the current term.'
              : 'Manage other department records and students in one place.'}
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
<div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setTab('students')}
              className={`rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
                tab === 'students'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
              }`}
            >
              Student Management
            </button>
            <button
              type="button"
              onClick={() => setTab('enrollment')}
              className={`rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
                tab === 'enrollment'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
              }`}
            >
              Enrollment Management
            </button>
            <button
              type="button"
              onClick={() => setTab('other')}
              className={`rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
                tab === 'other'
                    ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
              }`}
            >
              Other Departments
            </button>
          </div>

        
        </div>

        {tab === 'students' && !studentDetailOpen && (
          <>
           
           <div className='flex items-center gap-2'>
               <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-academic-config'))}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg cursor-pointer bg-blue-500 text-white hover:bg-blue-600 transition"
              >
                <FileSliders className="h-4 w-4" />
                Academic Eligibility
              </button>
         

            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-add-student'))}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg cursor-pointer bg-green-500 text-white hover:bg-green-600 transition"
            >
              <UserPlus className="h-4 w-4" />
              Add Student
            </button>
           </div>
          </>
        )}

          {tab === 'other' && !otherDepartmentOpen && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-add-department'))}
              className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-600"
            >
              <BadgePlus className="h-4 w-4" />
              Add Department
            </button>
          )}

          {tab === 'other' && otherDepartmentOpen && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-add-other-department-student'))}
              className="inline-flex items-center gap-2 rounded-xl cursor-pointer bg-green-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-600"
            >
              <UserPlus className="h-4 w-4" />
              Add Student
            </button>
          )}
          

      </div>

      <Suspense fallback={<LoadingPanel label="Loading student records..." />}>
        {tab === 'students' || tab === 'other' ? (
          <StudentManagement
            onBack={onBackToDashboard}
            initialSection={tab === 'other' ? 'other' : 'students'}
            onStudentDetailState={(open, name) => {
              setStudentDetailOpen(open);
              setOpenedStudentName(name || '');
            }}
          />
        ) : (
          <TermEnrollmentPanel onBack={onBackToDashboard} />
        )}
      </Suspense>
    </div>
  );
};

function App() {
  const { currentUser, loading } = useAuth();
  const [route, setRoute] = useState(window.location.hash || '');
  const [payablesBreadcrumb, setPayablesBreadcrumb] = useState(null);

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || '');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Redirect to dashboard after login, but preserve password reset flows
  useEffect(() => {
    if (!currentUser) return;

    const currentHash = window.location.hash || '';
    const currentHashPath = currentHash.split('?')[0];
    const preserveHash =
      currentHashPath === '#/forgot-password' ||
      currentHash.startsWith('#/forgot-password?') ||
      currentHashPath === '#/reset-password' ||
      currentHash.startsWith('#/reset-password?') ||
      window.location.search.includes('mode=resetPassword') ||
      currentHash.includes('mode=resetPassword');

    if (!preserveHash) {
      window.location.hash = '';
    }
  }, [currentUser]);

  useEffect(() => {
    const handler = (event) => {
      setPayablesBreadcrumb(event.detail || null);
    };
    window.addEventListener('payables-breadcrumb', handler);
    return () => window.removeEventListener('payables-breadcrumb', handler);
  }, []);

  const renderAppBreadcrumbs = () => {
  if (!route.startsWith('#/payables')) return null;
  if (!currentUser || currentUser.role !== 'admin') return null;

  const d = payablesBreadcrumb || {};
  const crumbs = [{ label: 'Payables', onClick: null }];

  if (d.departmentType === 'ccs') {
    crumbs.push({
      label: 'CCS Department',
      onClick: () => {
        setPayablesBreadcrumb({ departmentType: 'ccs', selectedFolder: null });
        window.dispatchEvent(
          new CustomEvent('payables-breadcrumb', {
            detail: { departmentType: 'ccs', selectedFolder: null }
          })
        );
      }
    });

    const f = d.selectedFolder || null;
    if (f) {
      if (f.isIrregular) {
        crumbs.push({ label: 'Irregular', onClick: null });
      } else {
        const y = f.year;
        const block = f.block;
        const yearLabel = y === 1 ? '1st' : y === 2 ? '2nd' : y === 3 ? '3rd' : '4th';
        crumbs.push({
          label: `${yearLabel} Year${block ? ` Block ${block}` : ''}`,
          onClick: null
        });
      }
    }
  } else if (d.departmentType === 'other') {
    // Make "Other Department" clickable to reset to the list of departments
    crumbs.push({
      label: 'Other Department',
      onClick: () => {
        setPayablesBreadcrumb({ departmentType: 'other' });
        window.dispatchEvent(
          new CustomEvent('payables-breadcrumb', {
            detail: { departmentType: 'other' }
          })
        );
      }
    });

    // Make the department name clickable to reset to the list of folders
    if (d.departmentName) {
      crumbs.push({
        label: d.departmentName,
        onClick: () => {
          setPayablesBreadcrumb({ departmentType: 'other', departmentName: d.departmentName, selectedFolder: null });
          window.dispatchEvent(
            new CustomEvent('payables-breadcrumb', {
              detail: { departmentType: 'other', departmentName: d.departmentName, selectedFolder: null }
            })
          );
        }
      });
    }

    // Add year level and block breadcrumb if a folder is selected
    const f = d.selectedFolder || null;
    if (f) {
      if (f.isIrregular) {
        crumbs.push({ label: 'Irregular', onClick: null });
      } else {
        const y = f.year;
        const block = f.block;
        const yearLabel = y === 1 ? '1st' : y === 2 ? '2nd' : y === 3 ? '3rd' : '4th';
        crumbs.push({
          label: `${yearLabel} Year${block ? ` Block ${block}` : ''}`,
          onClick: null
        });
      }
    }
  }

  return <Breadcrumbs items={crumbs} />;
};
  const curriculumMakerMatch = route.match(/^#\/curriculum-maker\/?(.*)/);
  const curriculumMakerId = curriculumMakerMatch ? (curriculumMakerMatch[1] || '') : '';
  const goDashboard = () => {
    goToRoleDashboard(currentUser?.role);
  };

  const renderAuthenticatedRoute = () => {
    if (route === '' || route === '#/dashboard') {
      return <Dashboard />;
    }

    if (route === '#/settings') {
      return <AdminPanel />;
    }

    if (route === '#/logs' || route === '#/history-log') {
      return <LogsPlaceholder />;
    }

    if (route.startsWith('#/curriculum-preview')) {
      return <CurriculumPreview />;
    }

    if (route.startsWith('#/faculty')) {
      return (
        <Suspense fallback={<LoadingPanel label="Loading faculty management..." />}>
          <FacultyMain onBackToDashboard={goDashboard} />
        </Suspense>
      );
    }

    if (route.startsWith('#/curriculum-maker')) {
      return (
        <CurriculumChecker
          initialView="curriculum-maker"
          initialCurriculumId={curriculumMakerId}
          onBackToDashboard={goDashboard}
        />
      );
    }

    if (route === '#/curriculum-checker') {
      return (
        <CurriculumCheckerMain
          initialView="curriculum-checker"
          onBackToDashboard={goDashboard}
        />
      );
    }

    if (route === '#/student-management') {
      return <StudentEnrollmentHub initialTab="students" onBackToDashboard={goDashboard} />;
    }

    if (route === '#/enrollment-management') {
      return <StudentEnrollmentHub initialTab="enrollment" onBackToDashboard={goDashboard} />;
    }

    if (route === '#/deans-list-report') {
      return (
        <Suspense fallback={<LoadingPanel label="Loading reports..." />}>
          <ReportsMain initialReport="deans" onBackToDashboard={goDashboard} />
        </Suspense>
      );
    }

    if (route === '#/archived-classes' || route === '#/academic-records') {
      return (
        <Suspense fallback={<LoadingPanel label="Loading archived classes..." />}>
          <ReportsMain initialReport="archived" onBackToDashboard={goDashboard} />
        </Suspense>
      );
    }

    if (route === '#/module-payments' || route === '#/reports/module-payments') {
      return (
        <Suspense fallback={<LoadingPanel label="Loading module payments..." />}>
          <ReportsMain initialReport="modulePayments" onBackToDashboard={goDashboard} />
        </Suspense>
      );
    }

    if (route === '#/professor-cutbacks' || route === '#/reports/professor-cutbacks') {
      return (
        <Suspense fallback={<LoadingPanel label="Loading professor cutbacks..." />}>
          <ReportsMain initialReport="cutbacks" onBackToDashboard={goDashboard} />
        </Suspense>
      );
    }

    if (route === '#/payables/ccs') {
      return (
        <Suspense fallback={<LoadingPanel label="Loading CCS payables..." />}>
          <PayablesMain initialDepartment="ccs" onBackToDashboard={goDashboard} />
        </Suspense>
      );
    }

    if (route === '#/payables/other-departments') {
      return (
        <Suspense fallback={<LoadingPanel label="Loading other department payables..." />}>
          <PayablesMain initialDepartment="other" onBackToDashboard={goDashboard} />
        </Suspense>
      );
    }

    if (route === '#/payables') {
      return (
        <Suspense fallback={<LoadingPanel label="Loading payables..." />}>
          <PayablesMain onBackToDashboard={goDashboard} />
        </Suspense>
      );
    }

    if (route === '#/payments') {
      return (
        <Suspense fallback={<LoadingPanel label="Loading payments..." />}>
          <PaymentsModule onBackToDashboard={goDashboard} />
        </Suspense>
      );
    }

    return <Dashboard />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const currentHash = window.location.hash || '';
  const currentHashPath = currentHash.split('?')[0];

  const isPasswordResetAction =
    currentHashPath === '#/reset-password' ||
    window.location.search.includes('mode=resetPassword') ||
    currentHash.includes('mode=resetPassword');

  const isPasswordResetRequestRoute =
    currentHashPath === '#/forgot-password' ||
    currentHash.startsWith('#/forgot-password?');

  if (isPasswordResetAction || isPasswordResetRequestRoute) {
    return (
      <>
        <Toaster position="top-right" />
        {isPasswordResetAction ? (
          <PasswordResetConfirm />
        ) : (
          <PasswordReset onSwitchToSignIn={() => (window.location.hash = '')} />
        )}
      </>
    );
  }

  return (
    <Layout>
      <Toaster position="top-right" />
      {currentUser && renderAppBreadcrumbs && renderAppBreadcrumbs()}
      {currentUser ? renderAuthenticatedRoute() : <AuthContainer />}
    </Layout>
  );
}

export default App;
