import { useState, useEffect, useCallback } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { BadgePlus, Pencil, MoreVertical, Trash, Search, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getOtherDepartments } from '../../models/facultyModels';
import { db } from '../../firebase';

const OtherDepartmentManagement = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [otherDepartments, setOtherDepartments] = useState([]);
  const [selectedOtherDeptId, setSelectedOtherDeptId] = useState('');
  const [otherDeptStudents, setOtherDeptStudents] = useState([]);
  const [otherDeptSearch, setOtherDeptSearch] = useState('');
  const [otherStudentSearch, setOtherStudentSearch] = useState('');
  const [departmentForm, setDepartmentForm] = useState({ name: '', code: '' });
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [editingDepartmentId, setEditingDepartmentId] = useState('');
  const [openOtherDepartmentMenuId, setOpenOtherDepartmentMenuId] = useState('');
  const [otherStudentForm, setOtherStudentForm] = useState({ name: '', course: '', yearLevel: '1', block: '' });
  const [otherStudentModalOpen, setOtherStudentModalOpen] = useState(false);
  const [editingOtherStudentId, setEditingOtherStudentId] = useState('');

  const loadOtherDepartments = useCallback(async () => {
    if (!currentUser) {
      setError('Please sign in to access other department data');
      return;
    }

    setLoading(true);
    setError('');
    const result = await getOtherDepartments();
    if (result.success) {
      setOtherDepartments(result.data);
    } else {
      setError(result.error || 'Unable to load other departments');
    }
    setLoading(false);
  }, [currentUser]);

  const loadOtherDeptStudents = useCallback(async (departmentId) => {
    if (!currentUser) {
      setError('Please sign in to access other department students');
      return;
    }
    if (!departmentId) {
      setOtherDeptStudents([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const studentQuery = query(
        collection(db, 'otherDept-Students'),
        where('departmentId', '==', departmentId)
      );
      const snap = await getDocs(studentQuery);
      const records = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setOtherDeptStudents(records);
    } catch (err) {
      setError('Failed to load other department students: ' + err.message);
    }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadOtherDepartments();
    }
  }, [currentUser, loadOtherDepartments]);

  useEffect(() => {
    if (selectedOtherDeptId) {
      loadOtherDeptStudents(selectedOtherDeptId);
    } else {
      setOtherDeptStudents([]);
    }
  }, [selectedOtherDeptId, loadOtherDeptStudents]);

  const selectedOtherDepartment = otherDepartments.find((dept) => dept.id === selectedOtherDeptId) || null;
  const filteredOtherDepartments = otherDepartments.filter((dept) => {
    const term = otherDeptSearch.trim().toLowerCase();
    return (
      !term ||
      (dept.name || '').toLowerCase().includes(term) ||
      (dept.code || '').toLowerCase().includes(term)
    );
  });
  const filteredOtherDeptStudents = otherDeptStudents.filter((student) => {
    const term = otherStudentSearch.trim().toLowerCase();
    return (
      !term ||
      (student.name || '').toLowerCase().includes(term) ||
      (student.course || '').toLowerCase().includes(term) ||
      (student.block || '').toLowerCase().includes(term)
    );
  });

  const openCreateDepartmentModal = () => {
    setDepartmentForm({ name: '', code: '' });
    setEditingDepartmentId('');
    setDepartmentModalOpen(true);
  };

  const handleEditDepartment = (department) => {
    setDepartmentForm({
      name: department.name || '',
      code: department.code || ''
    });
    setEditingDepartmentId(department.id);
    setDepartmentModalOpen(true);
  };

  const handleSaveDepartment = async (event) => {
    event.preventDefault();
    if (!currentUser) {
      setError('Please sign in to manage other departments');
      return;
    }
    if (!departmentForm.name.trim()) {
      setError('Department name is required.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        name: departmentForm.name.trim(),
        code: departmentForm.code.trim(),
        userId: currentUser.uid,
        updatedAt: new Date().toISOString()
      };

      if (editingDepartmentId) {
        await updateDoc(doc(db, 'otherDepartments', editingDepartmentId), payload);
        setSuccess('Department updated.');
      } else {
        await addDoc(collection(db, 'otherDepartments'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        setSuccess('Department added.');
      }

      setDepartmentModalOpen(false);
      setEditingDepartmentId('');
      setDepartmentForm({ name: '', code: '' });
      await loadOtherDepartments();
    } catch (err) {
      setError('Failed to save department: ' + err.message);
    }
    setLoading(false);
  };

  const handleDeleteDepartment = async (department) => {
    const confirmed = window.confirm('Delete this department and all related data?');
    if (!confirmed) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const studentsRef = collection(db, 'otherDept-Students');
      const payablesRef = collection(db, 'otherDept-payables');
      const paymentsRef = collection(db, 'otherDept-payment');

      const [studentsSnap, payablesSnap, paymentsSnap] = await Promise.all([
        getDocs(query(studentsRef, where('departmentId', '==', department.id))),
        getDocs(query(payablesRef, where('departmentId', '==', department.id))),
        getDocs(query(paymentsRef, where('departmentId', '==', department.id)))
      ]);

      const deletePromises = [];
      studentsSnap.docs.forEach((docSnap) => deletePromises.push(deleteDoc(doc(db, 'otherDept-Students', docSnap.id))));
      payablesSnap.docs.forEach((docSnap) => deletePromises.push(deleteDoc(doc(db, 'otherDept-payables', docSnap.id))));
      paymentsSnap.docs.forEach((docSnap) => deletePromises.push(deleteDoc(doc(db, 'otherDept-payment', docSnap.id))));
      deletePromises.push(deleteDoc(doc(db, 'otherDepartments', department.id)));

      await Promise.all(deletePromises);
      setSuccess('Department deleted.');
      if (selectedOtherDeptId === department.id) {
        setSelectedOtherDeptId('');
      }
      await loadOtherDepartments();
      setOtherDeptStudents([]);
    } catch (err) {
      setError('Failed to delete department: ' + err.message);
    }
    setLoading(false);
  };

  const openCreateOtherStudentModal = () => {
    setOtherStudentForm({ name: '', course: '', yearLevel: '1', block: '' });
    setEditingOtherStudentId('');
    setOtherStudentModalOpen(true);
  };

  const handleEditOtherStudent = (student) => {
    setOtherStudentForm({
      name: student.name || '',
      course: student.course || '',
      yearLevel: String(student.yearLevel || 1),
      block: student.block || ''
    });
    setEditingOtherStudentId(student.id);
    setOtherStudentModalOpen(true);
  };

  const handleSaveOtherStudent = async (event) => {
    event.preventDefault();
    if (!currentUser) {
      setError('Please sign in to manage other department students');
      return;
    }
    if (!selectedOtherDeptId) {
      setError('Select a department first.');
      return;
    }
    if (!otherStudentForm.name.trim() || !otherStudentForm.course.trim()) {
      setError('Student name and course are required.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        userId: currentUser.uid,
        departmentId: selectedOtherDeptId,
        name: otherStudentForm.name.trim(),
        course: otherStudentForm.course.trim(),
        yearLevel: Number(otherStudentForm.yearLevel),
        block: otherStudentForm.block.trim(),
        updatedAt: new Date().toISOString()
      };

      if (editingOtherStudentId) {
        await updateDoc(doc(db, 'otherDept-Students', editingOtherStudentId), payload);
        setSuccess('Student updated.');
      } else {
        await addDoc(collection(db, 'otherDept-Students'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
        setSuccess('Student added.');
      }

      setOtherStudentModalOpen(false);
      setEditingOtherStudentId('');
      setOtherStudentForm({ name: '', course: '', yearLevel: '1', block: '' });
      await loadOtherDeptStudents(selectedOtherDeptId);
    } catch (err) {
      setError('Failed to save student: ' + err.message);
    }
    setLoading(false);
  };

  const handleDeleteOtherStudent = async (studentId) => {
    const confirmed = window.confirm('Delete this student and related payment records?');
    if (!confirmed) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const paymentsRef = collection(db, 'otherDept-payment');
      const paymentSnapshot = await getDocs(query(paymentsRef, where('studentId', '==', studentId)));
      const deletePromises = paymentSnapshot.docs.map((paymentDoc) => deleteDoc(doc(db, 'otherDept-payment', paymentDoc.id)));
      deletePromises.push(deleteDoc(doc(db, 'otherDept-Students', studentId)));
      await Promise.all(deletePromises);
      setSuccess('Student deleted.');
      await loadOtherDeptStudents(selectedOtherDeptId);
    } catch (err) {
      setError('Failed to delete student: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div>
      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {success && <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>}

      {!selectedOtherDeptId ? (
        <>
         <div className='flex items-center justify-between mb-4'>
             <div className="w-80">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={otherDeptSearch}
                onChange={(event) => setOtherDeptSearch(event.target.value)}
                placeholder="Search departments..."
                className="w-full rounded-xl border border-gray-300 py-2 pl-10 pr-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

            <button
          type="button"
          onClick={openCreateDepartmentModal}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <BadgePlus className="w-4 h-4" />
          Add Department
        </button>

         </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filteredOtherDepartments.map((department) => (
              <div
                key={department.id}
                className="group relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-400 hover:shadow-lg cursor-pointer"
                onClick={() => setSelectedOtherDeptId(department.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{department.code || 'OTHER'}</p>
                    <h4 className="mt-2 text-base font-semibold text-slate-900">{department.name || 'Unnamed department'}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenOtherDepartmentMenuId((prev) => (prev === department.id ? '' : department.id));
                    }}
                    className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
                {openOtherDepartmentMenuId === department.id && (
                  <div className="absolute right-4 top-14 z-10 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    <button
                      type="button"
                      onClick={() => handleEditDepartment(department)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDepartment(department)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                    >
                      <Trash className="w-3 h-3" /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
            {filteredOtherDepartments.length === 0 && (
              <div className="col-span-full rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-slate-500">
                No departments found. Use the Add Department button to create one.
              </div>
            )}
          </div>
        </>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedOtherDeptId('')}
                className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div>
                <p className="text-sm text-slate-500">Selected department</p>
                <h4 className="text-lg font-semibold text-slate-900">{selectedOtherDepartment?.name || 'Department'}</h4>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openCreateOtherStudentModal}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <BadgePlus className="w-4 h-4" /> Add Student
              </button>
              <button
                type="button"
                onClick={openCreateDepartmentModal}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <BadgePlus className="w-4 h-4" /> Add Department
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Department code</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{selectedOtherDepartment?.code || 'No code'}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Students</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{otherDeptStudents.length}</p>
            </div>
          </div>

          <div className="mb-4 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={otherStudentSearch}
                onChange={(event) => setOtherStudentSearch(event.target.value)}
                placeholder="Search students..."
                className="w-full rounded-xl border border-gray-300 py-2 pl-10 pr-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Block</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOtherDeptStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                      No students in this department yet. Add a student to get started.
                    </td>
                  </tr>
                ) : (
                  filteredOtherDeptStudents.map((student) => (
                    <tr key={student.id} className="border-t border-gray-200 hover:bg-slate-50">
                      <td className="px-4 py-3">{student.name}</td>
                      <td className="px-4 py-3">{student.course}</td>
                      <td className="px-4 py-3">{student.yearLevel}</td>
                      <td className="px-4 py-3">{student.block}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditOtherStudent(student)}
                            className="rounded-lg bg-gray-100 p-2 text-slate-600 hover:bg-gray-200"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOtherStudent(student.id)}
                            className="rounded-lg bg-gray-100 p-2 text-rose-600 hover:bg-rose-100"
                          >
                            <Trash className="w-4 h-4" />
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
      )}

      {departmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setDepartmentModalOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-2xl shadow p-8">
            <div className="text-xl font-semibold mb-4">{editingDepartmentId ? 'Edit Department' : 'Add Department'}</div>
            <form onSubmit={handleSaveDepartment} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Department Name</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={departmentForm.name}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Department Code</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={departmentForm.code}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, code: event.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDepartmentModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {editingDepartmentId ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {otherStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setOtherStudentModalOpen(false)}></div>
          <div className="relative z-10 w-full max-w-md border border-gray-300 bg-white rounded-2xl shadow p-8">
            <div className="text-xl font-semibold mb-4">{editingOtherStudentId ? 'Edit Other Dept Student' : 'Add Other Dept Student'}</div>
            <form onSubmit={handleSaveOtherStudent} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Student Name</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={otherStudentForm.name}
                  onChange={(event) => setOtherStudentForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Course</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={otherStudentForm.course}
                  onChange={(event) => setOtherStudentForm((prev) => ({ ...prev, course: event.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Year Level</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={otherStudentForm.yearLevel}
                    onChange={(event) => setOtherStudentForm((prev) => ({ ...prev, yearLevel: event.target.value }))}
                  >
                    {[1, 2, 3, 4].map((year) => (
                      <option key={year} value={String(year)}>
                        {year} Year
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Block</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={otherStudentForm.block}
                    onChange={(event) => setOtherStudentForm((prev) => ({ ...prev, block: event.target.value }))}
                    placeholder="A"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOtherStudentModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {editingOtherStudentId ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OtherDepartmentManagement;
