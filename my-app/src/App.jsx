import './App.css'
import { useAuth } from './contexts/AuthContext'
import AuthContainer from './components/auth/AuthContainer'
import Dashboard from './components/Dashboard'

function App() {
  const { currentUser, loading } = useAuth();

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
    <div className="">
      {currentUser ? <Dashboard /> : <AuthContainer />}
    </div>
  )
}

export default App
