import { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut 
} from 'firebase/auth';
import { doc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { toast } from 'react-hot-toast';
import { 
  UserPlus, 
  Trash2, 
  Loader2, 
  RefreshCw, 
  Shield, 
  Key,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  X
} from 'lucide-react';

const UserAccountManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'admin'
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

  const generateSecurePassword = () => {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const nameParts = (formData.fullName || '')
      .split(/\s+/)
      .map((part) => part.toLowerCase().replace(/[^a-z]/g, ''))
      .filter(Boolean);
    const baseWords = ['tcc', 'ccs', 'currchecker', 'payables', 'curr', 'checker'];
    const nameWord = nameParts.length ? nameParts[0] : '';
    const chosenWords = [nameWord, baseWords[Math.floor(Math.random() * baseWords.length)], baseWords[Math.floor(Math.random() * baseWords.length)]].filter(Boolean);
    let password = chosenWords.join('') + Math.floor(100 + Math.random() * 900);

    const remaining = Math.max(0, length - password.length);
    if (remaining > 0) {
      const array = new Uint32Array(remaining);
      crypto.getRandomValues(array);
      for (let i = 0; i < remaining; i++) {
        password += charset[array[i] % charset.length];
      }
    }

    setFormData({ ...formData, password: password.slice(0, length) });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.email || !formData.password || !formData.confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!formData.email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setCreating(true);
    
    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );

      // Create user document in Firestore with role and additional info
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: formData.email,
        fullName: formData.fullName,
        userName: formData.email.split('@')[0], // Use email prefix as username
        role: formData.role,
        createdAt: new Date().toISOString(),
        emailVerified: true, // Mark as verified since admin created it
        createdBy: auth.currentUser?.uid || 'system'
      });

      // Sign out the newly created user (admin is still signed in)
      await signOut(auth);

      // Sign back in as admin
      const adminEmail = localStorage.getItem('cachedCredentials') 
        ? JSON.parse(localStorage.getItem('cachedCredentials')).email 
        : null;
      const adminPassword = localStorage.getItem('cachedCredentials') 
        ? JSON.parse(localStorage.getItem('cachedCredentials')).password 
        : null;

      if (adminEmail && adminPassword) {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      }

      toast.success('User account created successfully!');
      
      // Reset form and close modal
      setFormData({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'admin'
      });
      setCreateModalOpen(false);

      // Refresh user list
      await fetchUsers();

    } catch (error) {
      console.error('Error creating user:', error);
      
      // Sign back in as admin if there was an error
      const adminEmail = localStorage.getItem('cachedCredentials') 
        ? JSON.parse(localStorage.getItem('cachedCredentials')).email 
        : null;
      const adminPassword = localStorage.getItem('cachedCredentials') 
        ? JSON.parse(localStorage.getItem('cachedCredentials')).password 
        : null;

      if (adminEmail && adminPassword) {
        try {
          await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        } catch (signInError) {
          console.error('Error signing back in as admin:', signInError);
        }
      }

      if (error.code === 'auth/email-already-in-use') {
        toast.error('An account with this email already exists');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password is too weak');
      } else {
        toast.error('Failed to create user account');
      }
    } finally {
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

  const getRoleBadge = (role) => {
    const roleStyles = {
      admin: 'bg-red-50 text-red-600 border-red-200',
      curriculum: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      payables: 'bg-blue-50 text-blue-600 border-blue-200'
    };
    
    const roleLabels = {
      admin: 'Admin',
      curriculum: 'Curriculum Checker',
      payables: 'Payables'
    };

    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${roleStyles[role] || roleStyles.admin}`}>
        <Shield size={12} />
        {roleLabels[role] || role}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Create User Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
        >
          <UserPlus size={16} />
          Add  User
        </button>
      </div>

      {/* Create User Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Create New User Account</h2>
                <p className="text-xs text-gray-400 mt-0.5">Add a new user to the system</p>
              </div>
             
            </div>

            <div className="px-6 py-5">
              <form onSubmit={handleCreateUser} className="space-y-4">
                {/* Full Name */}
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
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
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
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
                    required
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter password"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition pr-20"
                      required
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={generateSecurePassword}
                        className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                        title="Generate secure password"
                      >
                        <Key size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm password"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
                    required
                  />
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
                    <option value="admin">Admin — Full Access</option>
                    <option value="curriculum">Curriculum Checker — Curriculum Module Only</option>
                    <option value="payables">Payables — Payables Module Only</option>
                  </select>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-2 pt-8">
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
                  className="px-4 py-1.5 w-28 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    {creating ? (
                      <>
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

      {/* User Management Section */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
                <Shield size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
                <p className="text-sm text-gray-500">
                  {loading ? 'Loading...' : `${users.length} user${users.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 bg-gray-100 rounded-full animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-40 bg-gray-100 rounded-full animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 w-24 bg-gray-100 rounded-full animate-pulse" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse ml-auto" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Shield size={22} className="text-gray-400" />
                    </div>
                    <p className="font-medium text-gray-600">No users found</p>
                    <p className="text-gray-400 text-xs mt-1">Create a user account to get started.</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-800">{user.fullName || '—'}</p>
                        <p className="text-xs text-gray-400">@{user.userName || '—'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {user.email || '—'}
                    </td>
                    <td className="px-6 py-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteClick(user)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 hover:border-red-200 transition-all"
                      >
                        <Trash2 size={14} />
                        Delete
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Delete User Account</h2>
              <p className="text-sm text-gray-500 mt-0.5">This action cannot be undone.</p>
            </div>
            <div className="px-6 py-5">
              <div className="flex gap-3 p-4 bg-red-50 border border-red-100 rounded-xl mb-4">
                <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-700 font-medium">
                    Are you sure you want to delete this user?
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {userToDelete.fullName} ({userToDelete.email})
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setUserToDelete(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Delete User
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
