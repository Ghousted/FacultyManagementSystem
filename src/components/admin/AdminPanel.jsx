import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { ArrowBigLeft } from 'lucide-react';

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
      setError('Error fetching users');
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
      setToast({ type: 'success', message: 'Role updated successfully.' });
      setTimeout(() => setToast(null), 2200);
    } else {
      setToast({ type: 'error', message: 'Failed to update role.' });
      setTimeout(() => setToast(null), 2500);
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

  const roleBadgeClasses = (r) => {
    const roleName = (r || 'admin');
    if (roleName === 'admin') return 'bg-red-100 text-red-700 ring-red-200';
    if (roleName === 'payables') return 'bg-blue-100 text-blue-700 ring-blue-200';
    if (roleName === 'curriculum') return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
    return 'bg-gray-100 text-gray-700 ring-gray-200';
  };

  if (role !== 'admin') {
    return (
      <div className="">
        <div className="mb-4">
          <button onClick={goBack} className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700">Back</button>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-gray-300 shadow-lg">
          <h2 className="text-xl font-semibold text-red-600">Unauthorized</h2>
          <p className="text-gray-600">You do not have access to the Admin Panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      <div className="flex items-center justify-between gap-3 mb-6 border border-gray-300 rounded-2xl p-8 bg-white shadow-lg">
        <div className="flex items-center gap-6">
          <button
              onClick={goBack}
              className="group flex items-center gap-2 bg-blue-600 text-white p-2 cursor-pointer rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white transition-transform"
              aria-label="Back to dashboard"
              title="Back to dashboard"
            >
              <ArrowBigLeft className="w-5 h-5" />
            </button>          <div>
            <h1 className="text-2xl font-bold text-blue-600">Admin Panel</h1>
            <span className="text-sm text-gray-500">User Role Management</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-300 shadow-sm">

        {error && (
          <div className="px-4 pt-4">
            <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-4 py-2">
              {error}
            </div>
          </div>
        )}

        <div className="rounded-xl overflow-x-auto">
          {loading ? (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-blue-100 text-left">
                  <th className="px-6 py-3">Email / ID</th>
                  <th className="px-6 py-3">Username</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-6 py-4">
                      <div className="h-3 w-40 bg-gray-200 rounded animate-pulse mb-2" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-8 w-20 bg-gray-200 rounded animate-pulse ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <>
              {filteredUsers.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  <p className="font-medium">No users found</p>
                  <p className="text-sm">Try adjusting your search or refresh the list.</p>
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="px-6 py-3">Email / ID</th>
                      <th className="px-6 py-3">Username</th>
                      <th className="px-6 py-3">Role</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-t hover:bg-gray-50 transition">
                        <td className="px-6 py-4 max-w-[420px] truncate font-medium">
                          {user.email || user.id}
                        </td>
                        <td className="px-6 py-4 text-gray-500 max-w-[420px] truncate">
                          {user.userName}
                        </td>
                        <td className="px-6 py-4">
                          <div
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ring-1 ${roleBadgeClasses(
                              user.role
                            )}`}
                          >
                            {user.role || 'admin'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleEditRole(user)}
                            className="inline-flex items-center gap-2 px-4 py-1.5 text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {editingUser && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
          onClick={() => setEditingUser(null)}
        >
          <div className="fixed inset-0 z-50 grid place-items-center p-4" aria-modal="true" role="dialog">
            <div className="w-full max-w-md bg-white rounded-xl shadow-xl ring-1 ring-gray-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-gray-300 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Edit Role</h2>
              </div>
              <div className="px-5 py-4">
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 mb-1">User</label>
                  <div className="px-3 py-2 bg-gray-50 rounded border text-sm text-gray-700">
                    {editingUser.email || editingUser.id}
                  </div>
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select
                    className="w-full p-2.5 border rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                  >
                    <option value="admin">Admin (Full Access)</option>
                    <option value="payables">Payables System Only</option>
                    <option value="curriculum">Curriculum Checker Only</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRole}
                    className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`rounded-md px-4 py-2 shadow-lg ring-1 text-sm ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                : 'bg-red-50 text-red-800 ring-red-200'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
