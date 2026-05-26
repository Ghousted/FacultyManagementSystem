import { useState, useEffect } from 'react';
import { deleteApp, initializeApp } from 'firebase/app';
import { 
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendPasswordResetEmail,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDocs, collection, deleteDoc, query, serverTimestamp, where } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../../firebase';
import { toast } from 'react-hot-toast';
import { logSystemAction } from '../../utils/auditLogger';
import { passwordResetActionCodeSettings } from '../../utils/authHelpers';
import { 
  UserPlus, 
  Trash2, 
  Loader2, 
  RefreshCw, 
  Shield, 
  Search,
  CalendarRange,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  AlertTriangle,
  CheckCircle2,
  Pencil,
  X
} from 'lucide-react';

const EMAIL_LOCK_MESSAGE = 'This email address is permanent and cannot be changed after account creation.';

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const getFriendlyFirebaseError = (error) => {
  if (error?.code === 'auth/email-already-in-use') return 'An account with this email already exists.';
  if (error?.code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (error?.code === 'auth/weak-password') return 'Password must be at least 6 characters long.';
  if (error?.code === 'permission-denied') return 'You do not have permission to save this user record.';
  return error?.message || 'Something went wrong. Please try again.';
};

const UserAccountManagement = ({ onChangeTerm }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [originalEmail, setOriginalEmail] = useState('');
  const [updating, setUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'role', direction: 'asc' });
  const [formError, setFormError] = useState('');
  const [editError, setEditError] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'admin'
  });
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    email: '',
    role: 'admin',
    sendPasswordReset: false
  });

  const fetchUsers = async () => {
    setLoading(true);
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
    fetchUsers();
  }, []);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const fullName = (user.fullName || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const userName = (user.userName || '').toLowerCase();
    const role = (user.role || '').toLowerCase();
    return (
      fullName.includes(query) ||
      email.includes(query) ||
      userName.includes(query) ||
      role.includes(query)
    );
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const key = sortConfig.key;
    let aValue = '';
    let bValue = '';

    if (key === 'fullName') {
      aValue = (a.fullName || '').toLowerCase();
      bValue = (b.fullName || '').toLowerCase();
    } else if (key === 'email') {
      aValue = (a.email || '').toLowerCase();
      bValue = (b.email || '').toLowerCase();
    } else {
      aValue = (a.role || '').toLowerCase();
      bValue = (b.role || '').toLowerCase();
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormError('');
    setFormData({ ...formData, [name]: value });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();

    const fullName = formData.fullName.trim();
    const email = normalizeEmail(formData.email);
    const password = formData.password || '';
    const confirmPassword = formData.confirmPassword || '';
    const role = formData.role || 'admin';

    setFormError('');

    if (!fullName || !email || !password || !confirmPassword || !role) {
      const message = 'Please complete full name, email, password, confirmation, and role before creating the account.';
      setFormError(message);
      toast.error(message);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const message = 'Please enter a valid email address.';
      setFormError(message);
      toast.error(message);
      return;
    }

    if (password.length < 6) {
      const message = 'Password must be at least 6 characters long.';
      setFormError(message);
      toast.error(message);
      return;
    }

    if (password !== confirmPassword) {
      const message = 'Password and confirm password do not match.';
      setFormError(message);
      toast.error(message);
      return;
    }

    setCreating(true);
    let secondaryApp = null;
    let secondaryAuth = null;
    let createdAuthUser = null;

    try {
      const duplicateQuery = query(collection(db, 'users'), where('email', '==', email));
      const duplicateSnapshot = await getDocs(duplicateQuery);
      if (!duplicateSnapshot.empty) {
        throw { code: 'auth/email-already-in-use' };
      }

      secondaryApp = initializeApp(firebaseConfig, `create-user-${Date.now()}`);
      secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );
      createdAuthUser = userCredential.user;

      await updateProfile(createdAuthUser, { displayName: fullName });

      const uid = createdAuthUser.uid;
      const userRecord = {
        uid,
        fullName,
        email,
        role,
        createdAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'users', uid), userRecord);
      } catch (firestoreError) {
        await deleteUser(createdAuthUser).catch((rollbackError) => {
          console.error('Failed to roll back created auth user:', rollbackError);
        });
        throw firestoreError;
      }

      toast.success('User created successfully. The account can now sign in with the assigned password.');

      await logSystemAction({
        action: 'Created user account',
        module: 'Admin',
        entityType: 'user',
        entityId: uid,
        description: `Created ${role} account for ${email}`,
        details: { uid, email, role }
      });

      setFormData({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'admin'
      });
      setCreateModalOpen(false);
      await fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      const message = getFriendlyFirebaseError(error);
      setFormError(message);
      toast.error(message);
    } finally {
      if (secondaryAuth) await signOut(secondaryAuth).catch(() => {});
      if (secondaryApp) await deleteApp(secondaryApp).catch(() => {});
      setCreating(false);
    }
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleting(true);
    
    try {
      // Delete user document from Firestore
      await deleteDoc(doc(db, 'users', userToDelete.id));
      
      toast.success('User deleted successfully');
      setDeleteModalOpen(false);
      setUserToDelete(null);
      
      // Refresh user list
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setOriginalEmail(user.email || '');
    setEditError('');
    setEditFormData({
      fullName: user.fullName || '',
      email: user.email || '',
      role: user.role || 'admin',
      sendPasswordReset: false
    });
    setEditModalOpen(true);
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'email') return;
    setEditError('');
    setEditFormData({ ...editFormData, [name]: value });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    const { fullName, role, sendPasswordReset } = editFormData;
    const lockedEmail = normalizeEmail(originalEmail || selectedUser.email);
    setEditError('');

    if (!fullName.trim() || !lockedEmail || !role) {
      const message = 'Please complete name, email, and role before saving.';
      setEditError(message);
      toast.error(message);
      return;
    }

    setUpdating(true);
    try {
      const updateData = {
        uid: selectedUser.id,
        fullName: fullName.trim(),
        role,
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'users', selectedUser.id), updateData, { merge: true });

      if (sendPasswordReset) {
        try {
          await sendPasswordResetEmail(auth, lockedEmail, passwordResetActionCodeSettings);
          toast.success('User updated and password reset email sent!');
        } catch (emailError) {
          console.error('Password reset email failed:', emailError);
          toast.error('User updated, but sending reset email failed.');
        }
      } else {
        toast.success('User updated successfully!');
      }

      await logSystemAction({
        action: 'Updated user account',
        module: 'Admin',
        entityType: 'user',
        entityId: selectedUser.id,
        description: `Updated user account for ${lockedEmail}`,
        details: { uid: selectedUser.id, email: lockedEmail, role }
      });
      setEditModalOpen(false);
      setSelectedUser(null);
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      const message = getFriendlyFirebaseError(error);
      setEditError(message);
      toast.error(message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditModalOpen(false);
    setSelectedUser(null);
    setEditError('');
    setEditFormData({
      fullName: '',
      email: '',
      role: 'admin',
      sendPasswordReset: false
    });
  };

  const getRoleBadge = (role) => {
    const roleStyles = {
      admin: 'bg-red-50 text-red-600 border-red-200 w-38 inline-flex items-center justify-center',
      curriculum: 'bg-emerald-50 text-emerald-600 border-emerald-200 w-38 inline-flex items-center justify-center',
      payables: 'bg-blue-50 text-blue-600 border-blue-200 w-38 inline-flex items-center justify-center'
    };
    
    const roleLabels = {
      admin: 'System Admin',
      curriculum: 'Curriculum Checker',
      payables: 'Payables Coordinator'
    };

    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${roleStyles[role] || roleStyles.admin}`}>
        {roleLabels[role] || role}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Create User Button */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <div className="relative w-full sm:w-80">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="search"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by name, email, username, role"
              className="w-full border text-sm border-slate-200 bg-white rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button
            type="button"
            onClick={onChangeTerm}
            disabled={!onChangeTerm}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-500 cursor-pointer text-white rounded-xl hover:bg-blue-600 transition-colors"
          >
            <CalendarRange size={16} />
            Change Term
          </button>

          <button
            onClick={() => {
              setFormError('');
              setFormData({ fullName: '', email: '', password: '', confirmPassword: '', role: 'admin' });
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2   px-4 py-2 text-sm font-medium bg-green-500 cursor-pointer text-white rounded-xl hover:bg-green-600 transition-colors"
          >
            <UserPlus size={16} />
            Add User
          </button>
        </div>
      </div>

      {/* Create User Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 max-w-md w-full overflow-hidden">
            <div className="px-8 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Create User Account</h2>
              </div>
            
            </div>

            <div className="px-8 py-4">
              <form onSubmit={handleCreateUser} className="space-y-5">
                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                {/* Full Name */}
                <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="John Doe"
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="john@example.com"
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500">{EMAIL_LOCK_MESSAGE}</p>
                </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Password
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Set password"
                      className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <p className="mt-1 text-xs text-slate-500">Minimum 6 characters.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="Re-enter password"
                      className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Role
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition appearance-none cursor-pointer"
                  >
                    <option value="admin">Admin</option>
                    <option value="curriculum">Curriculum Checker</option>
                    <option value="payables">Payables</option>
                  </select>
                </div>

              

                {/* Submit Button */}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                  className="inline-flex items-center justify-center gap-2 px-4 py-1.5 min-w-32 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Create 
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 max-w-md w-full overflow-hidden">
            <div className="px-8 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Edit User Account</h2>
              </div>
           
            </div>

            <div className="px-8 py-4">
              <form onSubmit={handleUpdateUser} className="space-y-4">
                {editError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {editError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    name="fullName"
                    value={editFormData.fullName}
                    onChange={handleEditInputChange}
                    placeholder="John Doe"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
                    required
                    autoComplete='off'
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={editFormData.email}
                    placeholder="john@example.com"
                    disabled
                    readOnly
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                    required
                  />
                  <p className="mt-1.5 text-xs text-slate-500">{EMAIL_LOCK_MESSAGE}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 ">Role</label>
                  <select
                    name="role"
                    value={editFormData.role}
                    onChange={handleEditInputChange}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition appearance-none cursor-pointer"
                  >
                    <option value="admin">Admin — Full Access</option>
                    <option value="curriculum">Curriculum Checker — Curriculum Module Only</option>
                    <option value="payables">Payables — Payables Module Only</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="sendPasswordReset"
                    name="sendPasswordReset"
                    checked={editFormData.sendPasswordReset}
                    onChange={(e) => setEditFormData({ ...editFormData, sendPasswordReset: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                  />
                  <label htmlFor="sendPasswordReset" className="text-sm text-gray-700 cursor-pointer">
                    Send password reset email after saving
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-8">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                    disabled={updating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                className="inline-flex items-center justify-center gap-2 px-4 py-1.5 min-w-28 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    {updating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* User Management Section */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
       

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th
                  scope="col"
                  className="w-[30%] px-6 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('fullName')}
                >
                  <div className="inline-flex items-center gap-1">
                    User
                    {sortConfig.key === 'fullName' ? (
                      sortConfig.direction === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )
                    ) : (
                      <ChevronsUpDown className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                </th>
                <th
                  scope="col"
                  className="w-[30%] px-6 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('email')}
                >
                  <div className="inline-flex items-center gap-1">
                    Email
                    {sortConfig.key === 'email' ? (
                      sortConfig.direction === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )
                    ) : (
                      <ChevronsUpDown className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                </th>
                <th
                  scope="col"
                  className="w-[30%] px-6 py-3.5 text-left text-xs font-semibold text-white uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('role')}
                >
                  <div className="inline-flex items-center gap-1">
                    Role
                    {sortConfig.key === 'role' ? (
                      sortConfig.direction === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )
                    ) : (
                      <ChevronsUpDown className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                </th>
                <th className="w-[10%] px-6 py-3.5 text-right text-xs font-semibold text-white uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="p-4">
                      <div className="h-4 w-32 bg-gray-100 rounded-lg animate-pulse" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 w-40 bg-gray-100 rounded-lg animate-pulse" />
                    </td>
                    <td className="p-4">
                      <div className="h-6 w-24 bg-gray-100 rounded-lg animate-pulse" />
                    </td>
                    <td className="p-4 text-right">
                      <div className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Shield size={22} className="text-gray-400" />
                    </div>
                    <p className="font-medium text-gray-600">No users match your search</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Try a different name, email, username, or role.
                    </p>
                  </td>
                </tr>
              ) : (
                sortedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-gray-800">{user.fullName || '—'}</p>
                      </div>
                    </td>
                    <td className="p-4 text-gray-600">
                      {user.email || '—'}
                    </td>
                    <td className="p-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="p-4 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEditClick(user)}
                              className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                      title='Edit'
                      >
                        <Pencil className='w-4 h-4' />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(user)}
                              className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                      title='Delete'
                     
                     >
                        <Trash2 className='w-4 h-4' />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-medium text-slate-800">Delete User Account</h2>
            </div>
            <div className="px-8 py-4">
              <div  className='text-justify'>
                <p>
                  Are you sure you want to delete the user account for <span className="font-medium">{userToDelete.fullName || userToDelete.email}</span>? This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-end gap-2 mt-8">
                <button
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setUserToDelete(null);
                  }}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  className="px-4 py-1.5 w-28 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      Deleting...
                    </>
                  ) : (
                    <>
                      Delete 
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAccountManagement;
