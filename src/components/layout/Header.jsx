import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Logo from '../../assets/logo.png';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { X, Pencil } from 'lucide-react';

const Header = () => {
  const { currentUser, role, signout, updateRole } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState('');
  const menuRef = useRef(null);

  const handleSignOut = async () => {
    try {
      await signout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleOpenAdminPanel = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersList);
      setAdminDialogOpen(true);
      setMenuOpen(false);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleEditRole = (user) => {
    setEditingUser(user);
    setNewRole(user.role || 'admin');
  };

  const handleSaveRole = async () => {
    if (editingUser) {
      const result = await updateRole(editingUser.id, newRole);
      if (result.success) {
        setUsers(
          users.map((user) =>
            user.id === editingUser.id ? { ...user, role: newRole } : user
          )
        );
        setEditingUser(null);
        setNewRole('');
      }
    }
  };

  const handleCloseAdminPanel = () => {
    setAdminDialogOpen(false);
    setEditingUser(null);
    setNewRole('');
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

  useEffect(() => {
    setMenuOpen(false);
  }, [currentUser]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 bg-white shadow-md border-b border-gray-200 z-40">
        <div className="max-w-7xl mx-auto flex items-center px-4 sm:px-6 lg:px-8 py-3">
          <img
            src={Logo}
            alt="Logo"
            className="w-12 h-12 mr-2 select-none cursor-pointer hover:opacity-90 active:scale-95 transition-all duration-200"
            onClick={handleGoDashboard}
          />
          <h5 className="text-lg sm:text-2xl font-bold text-gray-800 grow select-none">
            College of Computer Studies
          </h5>
          {currentUser && (
            <div className="ml-auto relative" ref={menuRef}>
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <i className="bi bi-person-circle text-gray-700 text-lg" aria-hidden="true"></i>
                <span className="max-w-[220px] truncate text-gray-800">{currentUser.email}</span>
                <i className={`bi ${menuOpen ? 'bi-chevron-up' : 'bi-chevron-down'} text-gray-600 text-sm`} aria-hidden="true"></i>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white border border-gray-300 rounded-lg shadow-lg z-50 overflow-hidden transition-all duration-200">
                  <div className="text-center pt-4">
                    <i className="bi bi-person-circle text-blue-800 text-2xl" aria-hidden="true"></i>
                  </div>
                  <div className="px-4 pb-2 pt-1 text-sm text-center border-gray-300 border-b">
                    {currentUser.email}
                  </div>
                  {role === 'admin' && (
                    <button
                      className="w-full border-b border-gray-300 text-left px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 flex items-center gap-2 transition-colors duration-200"
                      onClick={handleOpenAdminPanel}
                    >
                      <i className="bi bi-shield-lock" aria-hidden="true"></i>
                      <span>Admin Panel</span>
                    </button>
                  )}
                  <button
                    className="w-full text-left px-4 py-2 text-sm cursor-pointer text-red-700 hover:bg-gray-100 flex items-center gap-2 transition-colors duration-200"
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

      {/* Admin Panel Modal (Tailwind) */}
      {adminDialogOpen && (
        <div className="fixed inset-0  bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-800">User Role Management</h3>
              <button
                className="cursor-pointer text-gray-500 hover:text-red-700 transition-colors"
                onClick={handleCloseAdminPanel}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-800">{user.email || user.id}</p>
                      <p className="text-sm text-gray-500 capitalize">Role: {user.role || 'admin'}</p>
                    </div>
                    <button
                      className="p-2 text-gray-500 cursor-pointer bg-gray-200 rounded-full hover:text-blue-600 transition-colors"
                      onClick={() => handleEditRole(user)}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {editingUser && (
                <div className="mt-6 p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-semibold ">Edit Role for </h4>
                  <p className='text-sm mb-6'>{editingUser.email || editingUser.id}</p>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      className="w-full px-4 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                    >
                      <option value="admin">Admin (Full Access)</option>
                      <option value="payables">Payables System Only</option>
                      <option value="curriculum">Curriculum Checker Only</option>
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                       className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                      onClick={() => setEditingUser(null)}
                    >
                      Cancel
                    </button>
                    <button
                className="px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                      
                       onClick={handleSaveRole}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          
          </div>
        </div>
      )}
    </>
  );
};

export default Header;