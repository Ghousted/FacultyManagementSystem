import { useEffect, useState, lazy, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BookCheck, PhilippinePeso, Archive, GraduationCap } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

// Lazy load modules
const CurriculumChecker = lazy(() => import('./curriculum-checker/CurriculumChecker'));
const PayablesMain = lazy(() => import('./payables-system/PayablesMain'));
const ReportsMain = lazy(() => import('./reports/ReportsMain'));
const FacultyMain = lazy(() => import('./faculty/FacultyMain'));

const Dashboard = () => {
  const { currentUser, role } = useAuth();
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

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
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setUserName(userSnap.data().userName);
        }
      } catch (error) {
        console.error("Error fetching username:", error);
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
      return 'You can manage users, monitor system activity, and keep the platform running smoothly.';
    }

    if (role === 'curriculum') {
      return 'You can review curriculum records, validate student requirements, and keep academic data organized.';
    }

    if (role === 'payables') {
      return 'You can track department payments, manage payables, and keep financial records accurate.';
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

  if (loading) {
    return (
      <div>
        <div className="">
          <div className="mb-8 p-8 rounded-2xl bg-linear-to-r from-blue-500 to-indigo-500 shadow-lg">
            <div className='w-20 px-4 py-2 rounded-lg mb-2 bg-white/30'></div>
            <div className='w-150 px-4 py-4 rounded-lg mb-2 bg-white/30'></div>
            <div className='w-200 px-4 py-2 rounded-lg mb-2 bg-white/30'></div>
            <div className='w-50 px-4 py-1.5 rounded-lg mb-2 bg-white/30'></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {[1, 2, 3].map((_, index) => (
              <div
                key={index}
                className="w-full h-72 transition-all duration-300 border border-gray-300 bg-white rounded-2xl flex items-center justify-center"
              >
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center"></div>
                  <div className="w-30 h-6 bg-gray-300 rounded"></div>
                  <div className="w-60 h-4 bg-gray-300 rounded"></div>
                  <div className="w-60 h-4 bg-gray-300 rounded"></div>
                  <div className="w-40 h-3 mt-10 bg-gray-300 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (selectedSystem === 'Curriculum Checker') {
    return (
      <Suspense fallback={<p className="p-4">Loading Curriculum Checker...</p>}>
        <CurriculumChecker onBackToDashboard={handleBackToDashboard} />
      </Suspense>
    );
  }

  if (selectedSystem === 'Payables System') {
    return (
      <Suspense fallback={<p className="p-4">Loading Payables...</p>}>
        <PayablesMain onBackToDashboard={handleBackToDashboard} />
      </Suspense>
    );
  }

  if (selectedSystem === 'Reports') {
    return (
      <Suspense fallback={<p className="p-4">Loading Reports Module...</p>}>
        <ReportsMain onBackToDashboard={handleBackToDashboard} />
      </Suspense>
    );
  }

  if (selectedSystem === 'Faculty Management') {
    return (
      <Suspense fallback={<p className="p-4">Loading Faculty Management...</p>}>
        <FacultyMain onBackToDashboard={handleBackToDashboard} />
      </Suspense>
    );
  }

  return (
    <div>

      <div className="relative mb-6 overflow-hidden rounded-2xl border border-blue-300/60 bg-linear-to-br from-sky-500 via-blue-600 to-indigo-700 px-15 py-5 shadow-[0_16px_36px_-18px_rgba(30,64,175,0.7)]">
        <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-white/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-52 w-52 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="relative z-10 grid gap-4 md:grid-cols-[1.35fr_0.65fr] md:items-center">
              <div>
                <p className="mb-2 inline-flex items-center rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-white/95 backdrop-blur-sm">
                  {getTimePeriod()}!
                </p>
                <h3 className="mb-1.5 text-2xl font-black tracking-tight text-white md:text-3xl">
                  Welcome, {userName || currentUser?.displayName || currentUser?.email}!
                </h3>
                 <p className=" text-sm leading-relaxed text-blue-50">
                    {getWelcomeMessage()}
                  </p>
                
                <div className='flex gap-2 mt-4'>
                    <p className='bg-gray-100/20 p-1.5 rounded-lg text-[11px] uppercase text-white'>
                    {formatDate(currentTime)}
                  </p>
                    <p className='bg-gray-100/20 p-1.5 rounded-lg text-[11px] uppercase text-white'>
                    {formatDay(currentTime)}
                  </p>
                    <p className='bg-gray-100/20 p-1.5 rounded-lg text-[11px] uppercase text-white'>
                    {formatTime(currentTime)}
                  </p>            
              </div>
                 
            </div>
        </div>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {canAccessSystem('Curriculum Checker') && (
            <div
              className="w-full h-72 cursor-pointer transition-all duration-300 border border-gray-300 bg-white rounded-2xl hover:-translate-y-1 hover:shadow-xl hover:border-blue-600 focus-within:border-blue-600"
              onClick={() => handleSystemSelect('Curriculum Checker')}
            >
              <div className="text-center p-4 h-full flex flex-col justify-between">
                <div>
                  <div className="mx-auto w-20 h-20 mb-4 rounded-full bg-blue-50 flex items-center justify-center">
                    <BookCheck className="text-blue-600 w-10 h-10" />
                  </div>
                  <h4 className="text-2xl font-bold mb-2 text-blue-600">Curriculum Checker</h4>
                  <p className="text-gray-600 leading-relaxed">
                    Review and validate curriculum requirements, course mappings, and academic compliance.
                  </p>
                </div>
                <p className="text-blue-600 font-semibold mt-2 flex items-center justify-center gap-2">
                  <span>Click to access</span>
                  <i className="bi bi-chevron-right"></i>
                </p>
              </div>
            </div>
          )}

           {canAccessSystem('Curriculum Checker') && (
            <div
              className="w-full h-72 cursor-pointer transition-all duration-300 border border-gray-300 bg-white rounded-2xl hover:-translate-y-1 hover:shadow-xl hover:border-purple-600 focus-within:border-purple-600"
              onClick={() => handleSystemSelect('Reports')}
            >
              <div className="text-center p-4 h-full flex flex-col justify-between">
                <div>
                  <div className="mx-auto w-20 h-20 mb-4 rounded-full bg-purple-50 flex items-center justify-center">
                    <Archive className="text-purple-700 w-10 h-10" />
                  </div>
                  <h4 className="text-2xl font-bold mb-2 text-purple-600">Academic Records</h4>
                  <p className="text-gray-600 leading-relaxed">
                    Generate and manage institutional reports, including dean's lists and archived class records.
                  </p>
                </div>
                <p className="text-purple-600 font-semibold mt-2 flex items-center justify-center gap-2">
                  <span>Click to access</span>
                  <i className="bi bi-chevron-right"></i>
                </p>
              </div>
            </div>
          )}

          {canAccessSystem('Faculty Management') && (
            <div
              className="w-full h-72 cursor-pointer transition-all duration-300 border border-gray-300 bg-white rounded-2xl hover:-translate-y-1 hover:shadow-xl hover:border-amber-600 focus-within:border-amber-600"
              onClick={() => handleSystemSelect('Faculty Management')}
            >
              <div className="text-center p-4 h-full flex flex-col justify-between">
                <div>
                  <div className="mx-auto w-20 h-20 mb-4 rounded-full bg-amber-50 flex items-center justify-center">
                    <GraduationCap className="text-amber-600 w-10 h-10" />
                  </div>
                  <h4 className="text-2xl font-bold mb-2 text-amber-600">Faculty Management</h4>
                  <p className="text-gray-600 leading-relaxed">
                    Manage department professors, assign subjects from existing curriculums, and view enrolled students per subject.
                  </p>
                </div>
                <p className="text-amber-600 font-semibold mt-2 flex items-center justify-center gap-2">
                  <span>Click to access</span>
                  <i className="bi bi-chevron-right"></i>
                </p>
              </div>
            </div>
          )}

          {canAccessSystem('Payables System') && (
            <div
              className="w-full h-72 cursor-pointer transition-all duration-300 border border-gray-300 bg-white rounded-2xl hover:-translate-y-1 hover:shadow-xl hover:border-green-600 focus-within:border-green-600"
              onClick={() => handleSystemSelect('Payables System')}
            >
              <div className="text-center p-4 h-full flex flex-col justify-between">
                <div>
                  <div className="mx-auto w-20 h-20 mb-4 rounded-full bg-green-50 flex items-center justify-center">
                    <PhilippinePeso className="text-green-700 w-10 h-10" />
                  </div>
                  <h4 className="text-2xl font-bold mb-2 text-green-600">Payables System</h4>
                  <p className="text-gray-600 leading-relaxed">
                    Manage invoices, track payments, and handle financial transactions for the institution.
                  </p>
                </div>
                <p className="text-green-600 font-semibold mt-2 flex items-center justify-center gap-2">
                  <span>Click to access</span>
                  <i className="bi bi-chevron-right"></i>
                </p>
              </div>
            </div>
          )}

         
        </div>
    </div>
  );
};

export default Dashboard;