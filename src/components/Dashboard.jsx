import { useEffect, useState, lazy, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BookCheck, PhilippinePeso, Archive, GraduationCap } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const CurriculumChecker = lazy(() => import('./curriculum-checker/CurriculumChecker'));
const PayablesMain = lazy(() => import('./payables-system/PayablesMain'));
const ReportsMain = lazy(() => import('./reports/ReportsMain'));
const FacultyMain = lazy(() => import('./faculty/FacultyMain'));

const Dashboard = () => {
  const { currentUser, role } = useAuth();
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

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

  const systemCards = [
    {
      name: 'Faculty Management',
      title: 'Faculty Management',
      description: 'Manage professors, subject assignments, and enrolled students per subject.',
      icon: GraduationCap
    },
    {
      name: 'Curriculum Checker',
      title: 'Curriculum Checker',
      description: 'Review curriculum requirements, course mappings, and academic compliance.',
      icon: BookCheck
    },
    {
      name: 'Reports',
      title: 'Academic Records',
      description: "Generate dean's lists, institutional reports, and archived class records.",
      icon: Archive,
      accessKey: 'Curriculum Checker'
    },
    {
      name: 'Payables System',
      title: 'Payables System',
      description: 'Manage invoices, track payments, and handle financial transactions.',
      icon: PhilippinePeso
    }
  ];

  if (loading) {
    return (
      <div>
        <div className="mb-6 rounded-2xl border border-blue-100 bg-white p-8 shadow-sm">
          <div className="mb-3 h-4 w-28 animate-pulse rounded bg-blue-100" />
          <div className="mb-3 h-8 w-80 max-w-full animate-pulse rounded bg-blue-100" />
          <div className="h-4 w-[520px] max-w-full animate-pulse rounded bg-blue-50" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-64 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-5 h-12 w-12 animate-pulse rounded-xl bg-blue-50" />
              <div className="mb-3 h-5 w-36 animate-pulse rounded bg-gray-100" />
              <div className="mb-2 h-4 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (selectedSystem === 'Curriculum Checker') {
    return (
      <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading Curriculum Checker...</p>}>
        <CurriculumChecker onBackToDashboard={handleBackToDashboard} />
      </Suspense>
    );
  }

  if (selectedSystem === 'Payables System') {
    return (
      <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading Payables...</p>}>
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


  

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {systemCards.map((system) => {
          const accessName = system.accessKey || system.name;
          const Icon = system.icon;

          if (!canAccessSystem(accessName)) return null;

          return (
            <button
              key={system.name}
              type="button"
              onClick={() => handleSystemSelect(system.name)}
              className="group h-64 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <div className="flex h-full flex-col justify-between">
                <div>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
                    <Icon className="h-6 w-6" />
                  </div>

                  <h4 className="text-lg font-semibold text-gray-900">
                    {system.title}
                  </h4>

                  <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    {system.description}
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

export default Dashboard;
