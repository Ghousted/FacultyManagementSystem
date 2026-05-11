import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Logo from '../../assets/logo.png';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { ChevronDown, ChevronUp, UserCircle, Cog, LogOut } from 'lucide-react';

const Header = () => {
  const { currentUser, role, signout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const menuRef = useRef(null);

  // Fetch the username from Firestore
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

  const handleSignOut = async () => {
    try {
      await signout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Navigation handlers
  const handleGoAdminPanel = () => {
    window.location.hash = '#/settings';
    setMenuOpen(false);
  };



  const handleGoDashboard = () => {
    window.location.hash = '';
    window.dispatchEvent(new CustomEvent('go-dashboard'));
  };

  // Close menu on outside click
  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', onClickOutside);
    }
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [currentUser]);

  return (
    <header className="fixed top-0 left-0 right-0 bg-white shadow-md border-b border-gray-200 z-40">
      <div className="max-w-7xl mx-auto flex items-center px-4 sm:px-6 lg:px-8 py-3">
        <img
          src={Logo}
          alt="Logo"
          className="w-10 h-10 mr-2 select-none cursor-pointer hover:opacity-90 active:scale-95 transition-all duration-200"
          onClick={handleGoDashboard}
        />
        <h5 className="text-lg sm:text-xl font-bold text-gray-800 grow select-none">
          College of Computer Studies
        </h5>
        {currentUser && (
          <div className="ml-auto relative" ref={menuRef}>
            <button
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-full cursor-pointer hover:bg-blue-50"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <UserCircle className="text-blue-800" aria-hidden="true" />
              <span className="max-w-[220px] truncate text-gray-800">
                {userName || currentUser.email}
              </span>
              {menuOpen ? (
                <ChevronUp className="text-gray-600 w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="text-gray-600 w-4 h-4" aria-hidden="true" />
              )}
            </button>
            {menuOpen && (
              <div className="absolute -left-6 mt-2 w-56 bg-white border border-gray-300 rounded-lg shadow-lg z-50 overflow-hidden transition-all duration-200">
                <div className="text-center pt-2 text-sm uppercase text-slate-600">
                  {userName}
                </div>
                <div className="px-4 pb-2 text-xs text-center text-gray-500 border-b border-gray-300">
                  {currentUser.email}
                </div>
                {role === 'admin' && (
                  <div>
                    <button
                      className="w-full border-b border-gray-300 text-left px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 flex items-center gap-2 transition-colors duration-200"
                      onClick={handleGoAdminPanel}
                    >
                      <Cog className="w-4 h-4" />
                      <span>Settings</span>
                    </button>
                    
                  </div>
                )}
                <button
                  className="w-full text-left px-4 py-2 text-sm cursor-pointer text-red-700 hover:bg-gray-100 flex items-center gap-2 transition-colors duration-200"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;