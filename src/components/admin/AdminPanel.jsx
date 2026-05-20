import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { archiveAndPromoteStudents } from '../../models/curriculumModels';
import TermEnrollmentPanel from '../curriculum-checker/TermEnrollmentPanel';
import UserAccountManagement from './UserAccountManagement';
import { Shield, Users, Search, X, Loader2, CheckCircle2, AlertCircle, UserPlus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Breadcrumbs from '../common/Breadcrumbs';

const AdminPanel = () => {
  const { role, updateRole } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  // Archive & Promote state
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList = usersSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (a.email || a.id).localeCompare(b.email || b.id));
      setUsers(usersList);
    } catch (err) {
      toast.error('Error fetching users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'admin') fetchUsers();
    else setLoading(false);
  }, [role]);

  const handleEditRole = (user) => {
    setEditingUser(user);
    setNewRole(user.role || 'admin');
  };

  const handleSaveRole = async () => {
    if (!editingUser || saving) return;
    setSaving(true);
    const result = await updateRole(editingUser.id, newRole);
    if (result?.success) {
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, role: newRole } : u)));
      setEditingUser(null);
      setNewRole('');
      toast.success('Role updated successfully.');
    } else {
      toast.error('Failed to update role.');
    }
    setSaving(false);
  };

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.hash = '';
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && editingUser) setEditingUser(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingUser]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.email || '').toLowerCase().includes(q) || (u.id || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const roleMeta = (r) => {
    const roleName = r || 'admin';
    if (roleName === 'admin') return { label: 'Admin', classes: 'bg-red-50 text-red-600 ring-red-200', dot: 'bg-red-500' };
    if (roleName === 'payables') return { label: 'Payables', classes: 'bg-blue-50 text-blue-600 ring-blue-200', dot: 'bg-blue-500' };
    if (roleName === 'curriculum') return { label: 'Curriculum', classes: 'bg-emerald-50 text-emerald-600 ring-emerald-200', dot: 'bg-emerald-500' };
    return { label: roleName, classes: 'bg-gray-100 text-gray-600 ring-gray-200', dot: 'bg-gray-400' };
  };

  // --- Unauthorized view ---
  if (role !== 'admin') {
    return (
      <div className="min-h-[60vh] flex flex-col">
        <Breadcrumbs items={[{ label: 'Settings' }]} className="mb-6" />

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm mx-auto">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Restricted</h2>
            <p className="text-gray-500 text-sm mb-6">You don't have permission to view User Management.</p>
            <button
              onClick={goBack}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Admin view ---
  return (
    <div className="space-y-6">

      <Breadcrumbs items={[{ label: 'Settings' }]} className="" />

      {/* Term Enrollment Panel */}
      <div className="w-full xl:w-auto">
        <TermEnrollmentPanel headerOnly />
      </div>

      {/* User Account Management - Create New Users */}
      <UserAccountManagement />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-500">
              {loading ? 'Loading...' : `${users.length} registered user${users.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or ID…"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* errors shown via toast notifications */}

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4">
                      <div className="h-3.5 w-48 bg-gray-100 rounded-full animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-3.5 w-28 bg-gray-100 rounded-full animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-8 w-16 bg-gray-100 rounded-lg animate-pulse ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Users size={22} className="text-gray-400" />
                    </div>
                    <p className="font-medium text-gray-600">No users found</p>
                    <p className="text-gray-400 text-xs mt-1">Try adjusting your search or refresh the list.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const meta = roleMeta(user.role);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-6 py-4 max-w-[320px] truncate">
                        <span className="font-medium text-gray-800">{user.email || user.id}</span>
                      </td>
                      <td className="px-6 py-4 max-w-[200px] truncate text-gray-500">
                        {user.userName || <span className="text-gray-300 italic">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ring-1 ${meta.classes}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleEditRole(user)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 hover:border-blue-200 transition-all"
                        >
                          Edit Role
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        {!loading && filteredUsers.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Showing <span className="font-medium text-gray-600">{filteredUsers.length}</span> of{' '}
              <span className="font-medium text-gray-600">{users.length}</span> users
            </p>
            <button
              onClick={fetchUsers}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              Refresh list
            </button>
          </div>
        )}
      </div>

      {/* Archive & Promote Modal */}
      {archiveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Archive &amp; Promote Students</h2>
              <p className="text-sm text-gray-500 mt-0.5">This action cannot be undone.</p>
            </div>
            <div className="px-6 py-5">
              <div className="flex gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl mb-4">
                <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  This will archive all 4th year students and promote others to the next year level. Continue?
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setArchiveModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  disabled={archiveLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setArchiveLoading(true);
                    const now = new Date();
                    const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
                    const endYear = startYear + 1;
                    const result = await archiveAndPromoteStudents(startYear, endYear);
                    setArchiveLoading(false);
                    setArchiveModalOpen(false);
                    setToast({
                      type: result.success ? 'success' : 'error',
                      message: result.message
                    });
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
                  disabled={archiveLoading}
                >
                  {archiveLoading && <Loader2 size={14} className="animate-spin" />}
                  {archiveLoading ? 'Processing…' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingUser && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setEditingUser(null)}
        >
          <div
            className="fixed inset-0 z-50 grid place-items-center p-4"
            aria-modal="true"
            role="dialog"
          >
            <div
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Edit User Role</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Assign a role to control access level.</p>
                </div>
                <button
                  onClick={() => setEditingUser(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-5 space-y-4">
                {/* User Info */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                    User
                  </label>
                  <div className="flex items-center gap-3 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-blue-600">
                        {(editingUser.email || editingUser.id || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {editingUser.email || editingUser.id}
                      </p>
                      {editingUser.userName && (
                        <p className="text-xs text-gray-400 truncate">{editingUser.userName}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Role Select */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                    Role
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition appearance-none cursor-pointer"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                  >
                    <option value="admin">Admin — Full Access</option>
                    <option value="payables">Payables — Payables System Only</option>
                    <option value="curriculum">Curriculum — Curriculum Checker Only</option>
                  </select>
                </div>

                {/* Role Description */}
                <div className={`text-xs px-3.5 py-2.5 rounded-lg border ${
                  newRole === 'admin' ? 'bg-red-50 text-red-600 border-red-100' :
                  newRole === 'payables' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                  'bg-emerald-50 text-emerald-600 border-emerald-100'
                }`}>
                  {newRole === 'admin' && 'Full access to all modules, user management, and system settings.'}
                  {newRole === 'payables' && 'Restricted to the Payables System only. Cannot access other modules.'}
                  {newRole === 'curriculum' && 'Restricted to the Curriculum Checker only. Cannot access other modules.'}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/60">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRole}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-2">
          <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg ring-1 text-sm font-medium min-w-[240px] ${
              toast.type === 'success'
                ? 'bg-white text-emerald-700 ring-emerald-200'
                : 'bg-white text-red-700 ring-red-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-500 shrink-0" />
            )}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
