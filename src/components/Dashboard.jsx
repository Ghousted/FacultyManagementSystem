import { useEffect, useState, lazy, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BookCheck, PhilippinePeso, Archive, GraduationCap, Medal, Users, WalletCards, Folder } from 'lucide-react';
import { db } from '../firebase';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { getStudents } from '../models/curriculumModels';

const CurriculumCheckerMain = lazy(() => import('./curriculum-checker/CurriculumCheckerMain'));
const PayablesMain = lazy(() => import('./payables-system/PayablesMain'));
const ReportsMain = lazy(() => import('./reports/ReportsMain'));
const ReportsModule = lazy(() => import('./reports/ReportsModule'));
const FacultyMain = lazy(() => import('./faculty/FacultyMain'));

const Dashboard = () => {
  const { currentUser, role } = useAuth();
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [adminStats, setAdminStats] = useState({
    latestStudents: [],
    weeklyPaid: 0,
    monthlyPaid: 0,
    totalPaid: 0,
    totalBalance: 0
  });

  const formatPeso = (value) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  };

  const toDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  useEffect(() => {
    const onGoDashboard = () => setSelectedSystem(null);
    window.addEventListener('go-dashboard', onGoDashboard);
    return () => window.removeEventListener('go-dashboard', onGoDashboard);
  }, []);

  const handleSystemSelect = (system) => {
    setSelectedSystem(system);
  };

  const handleBackToDashboard = () => {
    setSelectedSystem(null);
  };

  useEffect(() => {
    const fetchUserName = async () => {
      if (!currentUser?.uid) return;

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setUserName(userSnap.data().userName);
        }
      } catch (error) {
        console.error('Error fetching username:', error);
      }
    };

    fetchUserName();
  }, [currentUser]);

  useEffect(() => {
    const loadAdminStats = async () => {
      if (role !== 'admin') return;

      try {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [studentsResult, payablesSnapshot, studentPaymentsSnapshot] = await Promise.all([
          getStudents(),
          getDocs(collection(db, 'payables')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'studentPayments')).catch(() => ({ docs: [] }))
        ]);

        const students = studentsResult.success ? studentsResult.data : [];
        const latestStudents = [...students].sort((a, b) => {
          const aDate = toDate(a.enrolledAt || a.createdAt || a.updatedAt)?.getTime() || 0;
          const bDate = toDate(b.enrolledAt || b.createdAt || b.updatedAt)?.getTime() || 0;
          return bDate - aDate;
        });

        let totalPaid = 0;
        let totalBalance = 0;
        payablesSnapshot.docs.forEach((payableDoc) => {
          const payable = payableDoc.data();
          if (payable.deleted) return;

          const amount = Number(payable.amount) || 0;
          Object.values(payable.studentPayments || {}).forEach((payment) => {
            const paidAmount = Number(payment?.paidAmount) || 0;
            totalPaid += paidAmount;
            totalBalance += Math.max(0, amount - paidAmount);
          });
        });

        let weeklyPaid = 0;
        let monthlyPaid = 0;
        studentPaymentsSnapshot.docs.forEach((paymentDoc) => {
          const payment = paymentDoc.data();
          const paidAmount = Number(payment.amount || payment.paidAmount) || 0;
          const paidDate = toDate(payment.date || payment.createdAt || payment.updatedAt);
          if (!paidDate) return;
          if (paidDate >= weekStart) weeklyPaid += paidAmount;
          if (paidDate >= monthStart) monthlyPaid += paidAmount;
        });

        setAdminStats({
          latestStudents: latestStudents.slice(0, 5),
          weeklyPaid,
          monthlyPaid,
          totalPaid,
          totalBalance
        });
      } catch (error) {
        console.error('Error loading admin dashboard stats:', error);
      }
    };

    loadAdminStats();
  }, [role]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const formatDate = (date) => {
    const month = date.toLocaleString('en-US', { month: 'long' });
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const formatTime = (date) => {
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDay = (date) => {
    return date.toLocaleString('en-US', { weekday: 'long' });
  };

  const getStudentLevelBlockLabel = (student) => {
    const yearLevel = Number(student?.yearLevel) || 1;
    const suffix = yearLevel === 1 ? 'st' : yearLevel === 2 ? 'nd' : yearLevel === 3 ? 'rd' : 'th';
    const year = `${yearLevel}${suffix} Year`;

    if (student?.isIrregular) {
      return `${year} - Irregular`;
    }

    const block = (student?.block || 'A').toString().trim().toUpperCase();
    return `${year} - Blk ${block || 'A'}`;
  };

  const getStudentLevelBlock = (student) => {
    const year = student?.yearLevel
      ? `${student.yearLevel}${student.yearLevel === 1 ? 'st' : student.yearLevel === 2 ? 'nd' : student.yearLevel === 3 ? 'rd' : 'th'} Year`
      : 'Year not set';
    const block = student?.block ? `Block ${student.block}` : 'No block';
    return `${year} • ${block}`;
  };

  const getTimePeriod = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getWelcomeMessage = () => {
    if (role === 'admin') {
      return 'Manage users, monitor system activity, and keep the platform running smoothly.';
    }

    if (role === 'curriculum') {
      return 'Review curriculum records, validate student requirements, and keep academic data organized.';
    }

    if (role === 'payables') {
      return 'Track department payments, manage payables, and keep financial records accurate.';
    }

    return 'Welcome to the dashboard.';
  };

  const canAccessSystem = (system) => {
    if (!role) return false;
    if (role === 'admin') return true;
    if (role === 'payables' && system === 'Payables System') return true;
    if (role === 'curriculum' && system === 'Curriculum Checker') return true;
    return false;
  };

  // Skeleton Components
  const SkeletonLine = ({ className = '' }) => (
    <div className={`animate-pulse rounded bg-gray-100 ${className}`} />
  );

  const DashboardHeroSkeleton = () => (
    <div className="mb-6 rounded-2xl border border-blue-100 bg-white px-12 py-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full max-w-2xl">
          <SkeletonLine className="mb-3 h-4 w-28 bg-blue-100" />
          <SkeletonLine className="mb-3 h-8 w-80 max-w-full bg-blue-100" />
          <SkeletonLine className="h-4 w-full max-w-[520px] bg-blue-50" />
        </div>

        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((item) => (
            <SkeletonLine key={item} className="h-8 w-28 bg-blue-50" />
          ))}
        </div>
      </div>
    </div>
  );

  const ModuleCardSkeleton = ({ item }) => (
    <div
      key={item}
      className="h-64 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-5 h-12 w-12 animate-pulse rounded-xl bg-blue-50" />
      <SkeletonLine className="mb-3 h-5 w-36" />
      <SkeletonLine className="mb-2 h-4 w-full" />
      <SkeletonLine className="mb-8 h-4 w-3/4" />
      <SkeletonLine className="mt-auto h-4 w-24 bg-blue-50" />
    </div>
  );

  const PayablesSkeleton = () => (
    <div>
      <DashboardHeroSkeleton />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <SkeletonLine className="h-10 flex-1 max-w-md" />
          <SkeletonLine className="h-10 w-32" />
        </div>
        <SkeletonLine className="h-10 w-32 bg-blue-100" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div
            key={item}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <SkeletonLine className="h-8 w-8" />
              <div className="flex-1">
                <SkeletonLine className="mb-1 h-4 w-32" />
                <SkeletonLine className="h-3 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const AdminDashboardSkeleton = () => (
    <div>
      <DashboardHeroSkeleton />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            {item === 4 && <SkeletonLine className="mb-2 h-9 w-9 bg-amber-50" />}
            <SkeletonLine className="h-3 w-32" />
            <SkeletonLine className="mt-3 h-7 w-40" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <SkeletonLine className="h-10 w-10 bg-blue-50" />
            <div className="flex-1">
              <SkeletonLine className="mb-2 h-5 w-40" />
              <SkeletonLine className="h-4 w-56 max-w-full" />
            </div>
          </div>

          <div className="space-y-3">
            <SkeletonLine className="h-10 w-full" />
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="grid grid-cols-4 gap-3">
                <SkeletonLine className="h-8" />
                <SkeletonLine className="h-8" />
                <SkeletonLine className="h-8" />
                <SkeletonLine className="h-8" />
              </div>
            ))}
          </div>
        </section>

        <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <SkeletonLine className="h-10 w-10 bg-emerald-50" />
            <div className="flex-1">
              <SkeletonLine className="mb-2 h-5 w-36" />
              <SkeletonLine className="h-4 w-44" />
            </div>
          </div>

          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3"
              >
                <SkeletonLine className="mb-2 h-4 w-40" />
                <SkeletonLine className="h-3 w-24" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );

  const UserDashboardSkeleton = () => {
    if (role === 'payables') {
      return <PayablesSkeleton />;
    }

    return (
      <div>
        <DashboardHeroSkeleton />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <ModuleCardSkeleton key={0} item={0} />
        </div>
      </div>
    );
  };

  if (loading) {
    return role === 'admin' ? <AdminDashboardSkeleton /> : <UserDashboardSkeleton />;
  }

  // Directly render CurriculumCheckerMain for curriculum role
  if (role === 'curriculum' && !selectedSystem) {
    return (
      <div>
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-600 px-12 py-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-sm font-medium text-blue-100">
                {getTimePeriod()}
              </p>
              <h3 className="text-2xl font-semibold text-white md:text-3xl">
                Welcome, {userName || currentUser?.displayName || currentUser?.email}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-50">
                {getWelcomeMessage()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-medium text-white">
              <span className="rounded-lg bg-white/15 px-3 py-2">
                {formatDate(currentTime)}
              </span>
              <span className="rounded-lg bg-white/15 px-3 py-2">
                {formatDay(currentTime)}
              </span>
              <span className="rounded-lg bg-white/15 px-3 py-2">
                {formatTime(currentTime)}
              </span>
            </div>
          </div>
        </div>
        <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading Curriculum Checker...</p>}>
          <CurriculumCheckerMain />
        </Suspense>
      </div>
    );
  }

  if (selectedSystem === 'Curriculum Checker') {
    return (
      <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading Curriculum Checker...</p>}>
        <CurriculumCheckerMain onBackToDashboard={handleBackToDashboard} />
      </Suspense>
    );
  }

  if (selectedSystem === 'Payables System') {
    return (
      <Suspense fallback={<PayablesSkeleton />}>
        <PayablesMain onBackToDashboard={handleBackToDashboard} />
      </Suspense>
    );
  }

  if (selectedSystem === 'Reports') {
    return (
      <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading Reports Module...</p>}>
        <ReportsMain onBackToDashboard={handleBackToDashboard} />
      </Suspense>
    );
  }

  if (selectedSystem === "Dean's List Report") {
    return (
      <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading Dean's List Report...</p>}>
        <ReportsMain initialReport="deans" onBackToDashboard={handleBackToDashboard} />
      </Suspense>
    );
  }

  if (selectedSystem === 'Faculty Management') {
    return (
      <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading Faculty Management...</p>}>
        <FacultyMain onBackToDashboard={handleBackToDashboard} />
      </Suspense>
    );
  }

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-600 px-12 py-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-blue-100">
              {getTimePeriod()}
            </p>

            <h3 className="text-2xl font-semibold text-white md:text-3xl">
              Welcome, {userName || currentUser?.displayName || currentUser?.email}
            </h3>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-50">
              {getWelcomeMessage()}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-medium text-white">
            <span className="rounded-lg bg-white/15 px-3 py-2">
              {formatDate(currentTime)}
            </span>
            <span className="rounded-lg bg-white/15 px-3 py-2">
              {formatDay(currentTime)}
            </span>
            <span className="rounded-lg bg-white/15 px-3 py-2">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>
      </div>

      {role === 'admin' && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Payment This Week</p>
            <p className="mt-3 text-xl font-semibold text-gray-900">
              {formatPeso(adminStats.weeklyPaid)}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Payment This Month</p>
            <p className="mt-3 text-xl font-semibold text-gray-900">
              {formatPeso(adminStats.monthlyPaid)}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Total Paid</p>
            <p className="mt-3 text-xl font-semibold text-emerald-700">
              {formatPeso(adminStats.totalPaid)}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Student Balances</p>
            <p className="mt-3 text-xl font-semibold text-amber-700">
              {formatPeso(adminStats.totalBalance)}
            </p>
          </div>
        </div>
      )}

      {role === 'admin' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] items-start">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Medal className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Dean's List Report</h4>
                <p className="text-sm text-gray-500">Current academic excellence report.</p>
              </div>
            </div>
            <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading Dean's List Report...</p>}>
              <ReportsModule embedded />
            </Suspense>
          </section>

          <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Latest Enrollees</h4>
                <p className="text-sm text-gray-500">Newest 5 students enrolled.</p>
              </div>
            </div>

            <div className="space-y-2">
              {adminStats.latestStudents.length > 0 ? (
                adminStats.latestStudents.map((student) => (
                  <div
                    key={student.id}
                    className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3"
                  >
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {student.name || 'Unnamed student'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {getStudentLevelBlockLabel(student)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
                  No enrollees yet.
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : role === 'payables' ? (
        <Suspense fallback={<PayablesSkeleton />}>
          <PayablesMain onBackToDashboard={handleBackToDashboard} />
        </Suspense>
      ) : null}
    </div>
  );
};

export default Dashboard;