import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  BookOpen,
  UserRound,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  getProfessors,
  addProfessor,
  updateProfessor,
  deleteProfessor
} from '../../models/facultyModels';

const emptyForm = { name: '', employeeId: '', email: '' };

const ProfessorList = ({ onSelectProfessor }) => {
  const [professors, setProfessors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const refresh = async () => {
  setLoading(true);
  setError('');

  const startedAt = Date.now();
  const res = await getProfessors();
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, 1000 - elapsed);

  setTimeout(() => {
    if (res.success) setProfessors(res.data);
    else setError(res.error || 'Failed to load professors.');

    setLoading(false);
  }, remaining);
};

  useEffect(() => {
    refresh();
  }, []);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) {
      return <ChevronsUpDown className="ml-1 inline-flex h-3.5 w-3.5 opacity-70 text-white" />;
    }

    return sortOrder === 'asc'
      ? <ChevronUp className="ml-1 inline-flex h-3.5 w-3.5 text-white" />
      : <ChevronDown className="ml-1 inline-flex h-3.5 w-3.5 text-white" />;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const list = !q
      ? professors
      : professors.filter(p =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.employeeId || '').toLowerCase().includes(q) ||
          (p.email || '').toLowerCase().includes(q)
        );

    return [...list].sort((a, b) => {
      let aValue = '';
      let bValue = '';

      if (sortBy === 'subjects') {
        aValue = (a.assignedCourses || []).length;
        bValue = (b.assignedCourses || []).length;

        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      aValue = (a[sortBy] || '').toString().toLowerCase();
      bValue = (b[sortBy] || '').toString().toLowerCase();

      return sortOrder === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });
  }, [professors, search, sortBy, sortOrder]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name || '',
      employeeId: p.employeeId || '',
      email: p.email || ''
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setError('');

    if (!form.name.trim()) {
      toast.error('Professor name is required.');
      return;
    }

    setSaving(true);

    const res = editingId
      ? await updateProfessor(editingId, {
          name: form.name.trim(),
          employeeId: form.employeeId.trim(),
          email: form.email.trim()
        })
      : await addProfessor(form);

    setSaving(false);

    if (res.success) {
      setModalOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      await refresh();
    } else {
      toast.error(res.error || 'Failed to save professor.');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;

    const res = await deleteProfessor(confirmDelete.id);

    if (res.success) {
      setConfirmDelete(null);
      await refresh();
    } else {
      toast.error(res.error || 'Failed to delete professor.');
    }
  };

  return (
    <div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={refresh}
              disabled={loading}
              className="p-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
              title="Reload professors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search professors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border text-sm border-slate-200 bg-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
              />
            </div>
          </div>

          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Professor
          </button>
        </div>



      <div className="">
        
        
        <div className="overflow-x-auto bg-white border border-gray-300 rounded-xl ">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-blue-500 text-left text-white text-sm tracking-wide">
              <tr>
                <th
                  className="px-4 py-3 cursor-pointer select-none w-[15%]"
                  onClick={() => handleSort('employeeId')}
                >
                  Employee ID <SortIcon column="employeeId" />
                </th>

                <th
                  className="px-4 py-3 cursor-pointer select-none w-[30%]"
                  onClick={() => handleSort('name')}
                >
                  Name <SortIcon column="name" />
                </th>

                <th
                  className="px-4 py-3 cursor-pointer select-none w-[30%]"
                  onClick={() => handleSort('email')}
                >
                  Email <SortIcon column="email" />
                </th>

                <th
                  className="px-4 py-3 text-center cursor-pointer select-none w-[15%]"
                  onClick={() => handleSort('subjects')}
                >
                  Subjects <SortIcon column="subjects" />
                </th>

                <th className="px-4 py-3 text-right w-[10%]">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index} className="border-t border-gray-100">
                    <td className="px-4 py-3 w-[15%]">
                      <div className="h-4 w-20 rounded bg-gray-100 animate-pulse" />
                    </td>
                    <td className="px-4 py-3 w-[30%]">
                      <div className="h-4 w-40 rounded bg-gray-100 animate-pulse" />
                    </td>
                    <td className="px-4 py-3 w-[30%]">
                      <div className="h-4 w-48 rounded bg-gray-100 animate-pulse" />
                    </td>
                    <td className="px-4 py-3 text-center w-[15%]">
                      <div className="mx-auto h-5 w-14 rounded-full bg-gray-100 animate-pulse" />
                    </td>
                    <td className="px-4 py-3 w-[10%]">
                      <div className="ml-auto h-7 w-16 rounded bg-gray-100 animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="py-12 text-center">
                      <UserRound className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      <p className="text-gray-500 text-sm">
                        {search
                          ? 'No professors match your search.'
                          : 'No professors yet. Click "Add Professor" to get started.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr
                    key={p.id}
                    className="border-t border-gray-100 hover:bg-blue-50/40 cursor-pointer transition-colors"
                    onClick={() => onSelectProfessor(p)}
                    title="Click to view professor details"
                  >
                    <td className="px-4 py-3 text-gray-600 truncate w-[15%]">
                      {p.employeeId || '-'}
                    </td>

                    <td className="px-4 py-3 font-medium text-gray-800 truncate w-[30%]">
                      {p.name}
                    </td>

                    <td className="px-4 py-3 text-gray-600 truncate w-[30%]">
                      {p.email || '-'}
                    </td>

                    <td className="px-4 py-3 text-center w-[15%]">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                        <BookOpen className="w-3 h-3" />
                        {(p.assignedCourses || []).length}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right w-[10%]">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => openEdit(p)}
                        className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setConfirmDelete(p)}
                        className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md ">
           <div className="px-8 py-4 border-b border-slate-300">
             <h6 className="text-xl font-medium text-slate-800 ">
              {editingId ? 'Update Professor' : 'Add Professor'}
            </h6>
            </div>

            <div className="space-y-2 px-8 py-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  placeholder="Prof. John Doe"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Employee ID</label>
                <input
                  type="text"
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  placeholder="E12345"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  placeholder="professor@email.com"
                />
              </div>

              
            <div className="flex justify-end gap-2 mt-8">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setError('');
                }}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                disabled={saving}
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                className="px-4 py-1.5 w-24 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                disabled={saving}
              >
                {saving ? 'Updating...' : editingId ? 'Update' : 'Add'}
              </button>
            </div>
            </div>

          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div>
              <h6 className="text-xl font-medium text-slate-800 px-8 py-4 border-b border-slate-300">
              Delete Professor
            </h6>
            </div>

           <div className="px-8 py-4">
             <p className="text-gray-700 mb-8 text-justify">
              Remove <span className="font-medium text-gray-800">{confirmDelete.name}</span> from the department? This will also remove all subject assignments for this professor.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleDelete}
                className="px-4 py-1.5 W-28 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Delete
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessorList;
