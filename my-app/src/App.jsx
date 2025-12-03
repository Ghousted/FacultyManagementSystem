import './App.css'
import { useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext'
import AuthContainer from './components/auth/AuthContainer'
import Dashboard from './components/Dashboard'
import Layout from './components/layout/Layout'
import AdminPanel from './components/admin/AdminPanel';

function App() {
  const { currentUser, loading, role } = useAuth();
  const [route, setRoute] = useState(window.location.hash || '');

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || '');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

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

  return (
    <Layout>
      {currentUser ? (
        route === '#/admin' ? <AdminPanel /> : <Dashboard />
      ) : (
        <AuthContainer />
      )}
    </Layout>
  )
}

export default App
