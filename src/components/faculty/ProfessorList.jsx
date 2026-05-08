import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, BookOpen, ChevronRight, UserRound } from 'lucide-react';
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const refresh = async () => {
    setLoading(true);
    const res = await getProfessors();
    if (res.success) setProfessors(res.data);
    else setError(res.error || 'Failed to load professors.');
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return professors;
    return professors.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.employeeId || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    );
  }, [professors, search]);

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
      setError('Professor name is required.');
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
      setError(res.error || 'Failed to save professor.');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const res = await deleteProfessor(confirmDelete.id);
    if (res.success) {
      setConfirmDelete(null);
      await refresh();
    } else {
      setError(res.error || 'Failed to delete professor.');
    }
  };

  return (
    <div>
      <div className="bg-white border border-gray-300 rounded-2xl shadow-sm p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h6 className="text-lg font-semibold text-gray-800">Professors</h6>
            <p className="text-sm text-gray-500">
              {professors.length} {professors.length === 1 ? 'professor' : 'professors'} in the department
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search professors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <button
              onClick={openCreate}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Professor
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-gray-500 text-sm">Loading professors...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <UserRound className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">
              {search ? 'No professors match your search.' : 'No professors yet. Click "Add Professor" to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Employee ID</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 text-center">Subjects</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr
                    key={p.id}
                    className="border-t border-gray-100 hover:bg-blue-50/40 cursor-pointer"
                    onClick={() => onSelectProfessor(p)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.employeeId || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.email || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                        <BookOpen className="w-3 h-3" />
                        {(p.assignedCourses || []).length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-600 cursor-pointer"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(p)}
                          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-red-600 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onSelectProfessor(p)}
                          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-600 cursor-pointer"
                          title="Manage subjects"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h6 className="text-lg font-semibold text-gray-800 mb-4">
              {editingId ? 'Edit Professor' : 'Add Professor'}
            </h6>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="e.g. Juan Dela Cruz"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Employee ID</label>
                <input
                  type="text"
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Optional"
                />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setModalOpen(false); setError(''); }}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                disabled={saving}
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Professor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h6 className="text-lg font-semibold text-gray-800 mb-2">Delete Professor</h6>
            <p className="text-sm text-gray-600 mb-5">
              Remove <span className="font-medium text-gray-800">{confirmDelete.name}</span> from the department? This will also remove all subject assignments for this professor.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessorList;
