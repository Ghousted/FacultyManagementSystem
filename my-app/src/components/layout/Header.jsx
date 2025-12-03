import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Logo from '../../assets/logo.png';

const Header = () => {
  const { currentUser, role, signout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const handleSignOut = async () => {
    try {
      await signout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleOpenAdminPanel = () => {
    window.location.hash = '#/admin';
    setMenuOpen(false);
  };

  const handleGoDashboard = () => {
    window.location.hash = '';
  };

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

  return (
    <>
      <header className="fixed top-0 left-0 right-0 bg-gray-100 shadow z-40">
        <div className="max-w-7xl mx-auto flex items-center px-4 sm:px-6 lg:px-8 py-2">
          <img
            src={Logo}
            alt="Logo"
            className="w-12 h-12 mr-2 select-none cursor-pointer hover:opacity-90 active:scale-95"
            onClick={handleGoDashboard}
          />
          <h5 className="text-lg sm:text-2xl font-bold text-blue-600 grow select-none">
            College of Computer Studies
          </h5>
          {currentUser && (
            <div className="ml-auto relative" ref={menuRef}>
              <button
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-blue-100"
                onClick={() => setMenuOpen((v) => !v)}
              >
                  <i className="bi bi-person-circle text-gray-700 text-lg" aria-hidden="true"></i>
                  <span className="max-w-[220px] truncate text-gray-800">{currentUser.email}</span>
                  <i className={`bi ${menuOpen ? 'bi-chevron-up' : 'bi-chevron-down'} text-gray-600 text-sm`} aria-hidden="true"></i>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white border border-gray-300 rounded-lg shadow-lg z-50 overflow-hidden">
                    <div className='text-center pt-4'>
                                        <i className="bi bi-person-circle text-blue-800 text-2xl" aria-hidden="true"></i>

                    </div>
                  <div className="px-4 pb-2 pt-1 text-sm text-center border-gray-300 border-b ">
                    {currentUser.email}
                  </div>
                  {role === 'admin' && (
                    <button
                        className="w-full border-b border-gray-300 text-left px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 flex items-center gap-2"
                      onClick={handleOpenAdminPanel}
                    >
                        <i className="bi bi-shield-lock" aria-hidden="true"></i>
                        <span>Admin Panel</span>
                    </button>
                  )}
                  <button
                      className="w-full text-left px-4 py-2 text-sm cursor-pointer text-red-700 hover:bg-gray-100 flex items-center gap-2"
                    onClick={handleSignOut}
                  >
                      <i className="bi bi-box-arrow-right" aria-hidden="true"></i>
                      <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default Header;
