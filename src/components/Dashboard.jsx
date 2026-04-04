import { useEffect, useState, lazy, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Lazy load modules
const CurriculumChecker = lazy(() => import('./curriculum-checker/CurriculumChecker'));
const PayablesSystem = lazy(() => import('./payables-system/PayablesSystem'));
const ReportsModule = lazy(() => import('./reports/ReportsModule'));

const Dashboard = () => {
  const { currentUser, role } = useAuth();
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true); // New loading state

  const handleSystemSelect = (system) => {
    setSelectedSystem(system);
  };

  const handleBackToDashboard = () => {
    setSelectedSystem(null);
  };

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Show initial loading for 2 seconds
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

  const getWelcomeMessage = () => {
    if (role === 'admin') {
      return "\"The best way to predict the future is to create it.\" - Peter Drucker";
    } else if (role === 'curriculum') {
      return "\"Education is the most powerful weapon which you can use to change the world.\" - Nelson Mandela";
    } else if (role === 'payables') {
      return "\"A penny saved is a penny earned.\" - Benjamin Franklin";
    }
    return "Welcome to the dashboard.";
  };

  const canAccessSystem = (system) => {
    if (!role) return false;
    if (role === 'admin') return true;
    if (role === 'payables' && system === 'Payables System') return true;
    if (role === 'curriculum' && system === 'Curriculum Checker') return true;
    return false;
  };

  // Show loader if loading
  if (loading) {
    return (
      <div>
      <div className="p-4 max-w-7xl mx-auto">
        <div className="mb-8 p-8 rounded-2xl bg-linear-to-r from-blue-500 to-indigo-500 shadow-lg">
          <div className='w-150 px-4 py-4 rounded-lg mb-2 bg-indigo-700'></div>
          <div className='w-200 px-4 py-2 rounded-lg mb-2 bg-indigo-700'></div>
          <div className='w-200 px-4 py-1.5 rounded-lg mb-2 bg-indigo-700'></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {/* Reports Module Card */}
        {[1, 2, 3].map((_, index) => (
  <div
    key={index}
    className="w-full h-72 transition-all duration-300 border border-gray-300 bg-white rounded-2xl 
               h
               flex items-center justify-center"
  >
    <div className="flex flex-col items-center justify-center text-center space-y-4">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
        {/* Icon or content can go here */}
      </div>

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

  // Show selected system using lazy loading and Suspense
  if (selectedSystem === 'Curriculum Checker') {
    return (
      <Suspense fallback={<p className="p-4">Loading Curriculum Checker...</p>}>
        <CurriculumChecker onBackToDashboard={handleBackToDashboard} />
      </Suspense>
    );
  }

  if (selectedSystem === 'Payables System') {
    return (
      <Suspense fallback={<p className="p-4">Loading Payables System...</p>}>
        <PayablesSystem onBackToDashboard={handleBackToDashboard} />
      </Suspense>
    );
  }

  if (selectedSystem === 'Reports') {
    return (
      <Suspense fallback={<p className="p-4">Loading Reports Module...</p>}>
        <ReportsModule onBackToDashboard={handleBackToDashboard} />
      </Suspense>
    );
  }

  // Main dashboard content
  return (
    <div>
      <div className="p-4 max-w-7xl mx-auto">
        <div className="mb-8 p-8 rounded-2xl bg-linear-to-r from-blue-500 to-indigo-500 shadow-lg">
          <h3 className="text-3xl font-bold mb-1 text-white">
            Welcome, {currentUser?.displayName || currentUser?.email}!
          </h3>
          <p className="text-lg text-white">{getWelcomeMessage()}</p>
          <div className="mt-4 text-white">
            <div className="text-base">
              {formatDate(currentTime)} | {formatTime(currentTime)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {/* Reports Module Card */}
          <div
            className="w-full h-72 cursor-pointer transition-all duration-300 border border-gray-300 bg-white rounded-2xl hover:-translate-y-1 hover:shadow-xl hover:border-purple-600 focus-within:border-purple-600"
            onClick={() => handleSystemSelect('Reports')}
          >
            <div className="text-center p-4 h-full flex flex-col justify-between">
              <div>
                <div className="mx-auto w-20 h-20 mb-4 rounded-full bg-purple-50 flex items-center justify-center">
                  <i className="bi bi-bar-chart-line text-purple-700 text-4xl"></i>
                </div>
                <h4 className="text-2xl font-bold mb-2 text-purple-600">Reports</h4>
                <p className="text-gray-600 leading-relaxed">
                  View dean's list summaries, filter by year/semester, and download reports.
                </p>
              </div>
              <p className="text-purple-600 font-semibold mt-2 flex items-center justify-center gap-2">
                <span>Click to access</span>
                <i className="bi bi-chevron-right"></i>
              </p>
            </div>
          </div>

          {canAccessSystem('Curriculum Checker') && (
            <div
              className="w-full h-72 cursor-pointer transition-all duration-300 border border-gray-300 bg-white rounded-2xl hover:-translate-y-1 hover:shadow-xl hover:border-blue-600 focus-within:border-blue-600"
              onClick={() => handleSystemSelect('Curriculum Checker')}
            >
              <div className="text-center p-4 h-full flex flex-col justify-between">
                <div>
                  <div className="mx-auto w-20 h-20 mb-4 rounded-full bg-blue-50 flex items-center justify-center">
                    <i className="bi bi-book text-blue-700 text-4xl"></i>
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

          {canAccessSystem('Payables System') && (
            <div
              className="w-full h-72 cursor-pointer transition-all duration-300 border border-gray-300 bg-white rounded-2xl hover:-translate-y-1 hover:shadow-xl hover:border-green-600 focus-within:border-green-600"
              onClick={() => handleSystemSelect('Payables System')}
            >
              <div className="text-center p-4 h-full flex flex-col justify-between">
                <div>
                  <div className="mx-auto w-20 h-20 mb-4 rounded-full bg-green-50 flex items-center justify-center">
                    <i className="bi bi-receipt text-green-700 text-4xl"></i>
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
    </div>
  );
};

export default Dashboard;