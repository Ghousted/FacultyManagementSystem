import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Search, Users, BookOpen, ArrowLeft, ChevronRight, X, Pencil, Check, Building2, Laptop } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCurriculums, getCoursesByCurriculum } from '../../models/curriculumModels';
import {
  assignCourseToProfessor,
  unassignCourseFromProfessor,
  updateAssignedCourseBlocks,
  getStudentsForCourse,
  getOtherDepartments,
  getOtherDeptClasses
} from '../../models/facultyModels';

const SEMESTER_LABELS = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };
const ALL_BLOCKS = ['A', 'B', 'C', 'D', 'E'];

const BlockToggle = ({ value, onChange }) => {
  const toggle = (b) => {
    const has = value.includes(b);
    onChange(has ? value.filter(x => x !== b) : [...value, b].sort());
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_BLOCKS.map(b => {
        const active = value.includes(b);
        return (
          <button
            key={b}
            type="button"
            onClick={() => toggle(b)}
            className={`min-w-[36px] px-2.5 py-1 text-xs font-semibold rounded-md border cursor-pointer transition-colors ${
              active
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {b}
          </button>
        );
      })}
    </div>
  );
};

const ProfessorDetail = ({ professorId, activeTerm, onBack }) => {
  const [professor, setProfessor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState('ccs'); // 'ccs' | 'other'
  const [curriculums, setCurriculums] = useState([]);
  const [pickerCurriculumId, setPickerCurriculumId] = useState('');
  const [pickerCourses, setPickerCourses] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pendingCourse, setPendingCourse] = useState(null);
  const [pendingBlocks, setPendingBlocks] = useState([]);
  const [pendingError, setPendingError] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);

  const [otherDepts, setOtherDepts] = useState([]);
  const [otherDeptId, setOtherDeptId] = useState('');
  const [otherClasses, setOtherClasses] = useState([]);
  const [otherClassesLoading, setOtherClassesLoading] = useState(false);
  const [otherSelectedClass, setOtherSelectedClass] = useState(null);
  const [otherCurriculumId, setOtherCurriculumId] = useState('');
  const [otherCurriculumCourses, setOtherCurriculumCourses] = useState([]);
  const [otherCurriculumLoading, setOtherCurriculumLoading] = useState(false);
  const [otherSubjectSearch, setOtherSubjectSearch] = useState('');
  const [otherSelectedCourse, setOtherSelectedCourse] = useState(null);
  const [otherBlocks, setOtherBlocks] = useState([]);
  const [otherError, setOtherError] = useState('');
  const [savingOther, setSavingOther] = useState(false);

  const [editingBlocksFor, setEditingBlocksFor] = useState(null);
  const [editingBlocksValue, setEditingBlocksValue] = useState([]);
  const [savingBlocks, setSavingBlocks] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const [confirmUnassign, setConfirmUnassign] = useState(null);

  useEffect(() => {
    if (!selectedSubject) return;
    const onKey = (e) => { if (e.key === 'Escape') closeStudentsModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedSubject]);

  const closeStudentsModal = () => {
    setSelectedSubject(null);
    setStudents([]);
    setStudentSearch('');
  };

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.studentNumber || '').toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const studentsByBlock = useMemo(() => {
    const groups = new Map();
    filteredStudents.forEach(s => {
      const block = (s.block || '').toString().trim().toUpperCase() || 'A';
      if (!groups.has(block)) groups.set(block, []);
      groups.get(block).push(s);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredStudents]);

  const refreshProfessor = async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'professors', professorId));
      if (snap.exists()) {
        setProfessor({ id: snap.id, ...snap.data() });
      } else {
        setError('Professor not found.');
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { refreshProfessor(); }, [professorId]);

  const resetOtherForm = () => {
    setOtherDeptId('');
    setOtherClasses([]);
    setOtherSelectedClass(null);
    setOtherCurriculumId('');
    setOtherCurriculumCourses([]);
    setOtherSubjectSearch('');
    setOtherSelectedCourse(null);
    setOtherBlocks([]);
    setOtherError('');
  };

  const openPicker = async () => {
    setPickerOpen(true);
    setPickerTab('ccs');
    setPickerSearch('');
    setPickerCurriculumId('');
    setPickerCourses([]);
    resetOtherForm();
    const [curRes, deptRes] = await Promise.all([
      getCurriculums(),
      getOtherDepartments()
    ]);
    if (curRes.success) setCurriculums(curRes.data);
    if (deptRes.success) setOtherDepts(deptRes.data);
  };

  useEffect(() => {
    const loadCourses = async () => {
      if (!pickerCurriculumId) { setPickerCourses([]); return; }
      setPickerLoading(true);
      const res = await getCoursesByCurriculum(pickerCurriculumId);
      if (res.success) setPickerCourses(res.data);
      setPickerLoading(false);
    };
    loadCourses();
  }, [pickerCurriculumId]);

  useEffect(() => {
    const loadOtherClasses = async () => {
      if (!otherDeptId) { setOtherClasses([]); setOtherSelectedClass(null); return; }
      setOtherClassesLoading(true);
      const res = await getOtherDeptClasses(otherDeptId);
      if (res.success) setOtherClasses(res.data);
      setOtherClassesLoading(false);
      setOtherSelectedClass(null);
      setOtherBlocks([]);
    };
    loadOtherClasses();
  }, [otherDeptId]);

  useEffect(() => {
    const loadOtherCurriculumCourses = async () => {
      if (!otherCurriculumId) { setOtherCurriculumCourses([]); setOtherSelectedCourse(null); return; }
      setOtherCurriculumLoading(true);
      const res = await getCoursesByCurriculum(otherCurriculumId);
      if (res.success) setOtherCurriculumCourses(res.data);
      setOtherCurriculumLoading(false);
      setOtherSelectedCourse(null);
    };
    loadOtherCurriculumCourses();
  }, [otherCurriculumId]);

  const filteredOtherCourses = useMemo(() => {
    const q = otherSubjectSearch.trim().toLowerCase();
    if (!q) return otherCurriculumCourses;
    return otherCurriculumCourses.filter(c =>
      (c.courseCode || '').toLowerCase().includes(q) ||
      (c.courseTitle || '').toLowerCase().includes(q)
    );
  }, [otherCurriculumCourses, otherSubjectSearch]);

  const assignedCourseIds = useMemo(
    () => new Set((professor?.assignedCourses || []).map(c => c.courseId)),
    [professor]
  );

  const filteredPickerCourses = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return pickerCourses;
    return pickerCourses.filter(c =>
      (c.courseCode || '').toLowerCase().includes(q) ||
      (c.courseTitle || '').toLowerCase().includes(q)
    );
  }, [pickerCourses, pickerSearch]);

  const startAssign = (course) => {
    setPendingError('');
    setPendingCourse(course);
    setPendingBlocks([]);
  };

  const cancelAssign = () => {
    setPendingCourse(null);
    setPendingBlocks([]);
    setPendingError('');
  };

  const confirmAssign = async () => {
    if (!pendingCourse) return;
    setPendingError('');
    if (pendingBlocks.length === 0) {
      setPendingError('Select at least one block.');
      return;
    }
    const curriculum = curriculums.find(c => c.id === pickerCurriculumId);
    setSavingAssignment(true);
    const res = await assignCourseToProfessor(professorId, {
      courseId: pendingCourse.id,
      courseCode: pendingCourse.courseCode,
      courseTitle: pendingCourse.courseTitle,
      curriculumId: pickerCurriculumId,
      curriculumName: curriculum?.name || '',
      yearLevel: pendingCourse.yearLevel,
      semester: pendingCourse.semester,
      units: pendingCourse.units,
      blocks: pendingBlocks
    });
    setSavingAssignment(false);
    if (res.success) {
      cancelAssign();
      setPickerOpen(false);
      await refreshProfessor();
    } else {
      setPendingError(res.error || 'Failed to assign subject.');
    }
  };

  const handleAssignOther = async () => {
    setOtherError('');
    if (!otherSelectedClass) {
      setOtherError('Select a class.');
      return;
    }
    if (!otherSelectedCourse) {
      setOtherError('Pick a subject from a curriculum.');
      return;
    }
    if (otherBlocks.length === 0) {
      setOtherError('Select at least one block.');
      return;
    }
    const dept = otherDepts.find(d => d.id === otherDeptId);
    const curriculum = curriculums.find(c => c.id === otherCurriculumId);
    const subject = otherSelectedCourse;
    const courseId = `other::${otherDeptId}::${otherSelectedClass.course.toLowerCase()}::${otherSelectedClass.yearLevel}::${subject.id}`;
    setSavingOther(true);
    const res = await assignCourseToProfessor(professorId, {
      source: 'other-department',
      courseId,
      subjectId: subject.id,
      courseCode: subject.courseCode,
      courseTitle: subject.courseTitle,
      curriculumId: otherCurriculumId,
      curriculumName: curriculum?.name || '',
      departmentId: otherDeptId,
      departmentName: dept?.name || '',
      classCourse: otherSelectedClass.course,
      yearLevel: otherSelectedClass.yearLevel,
      units: Number(subject.units) || 0,
      blocks: otherBlocks
    });
    setSavingOther(false);
    if (res.success) {
      resetOtherForm();
      setPickerOpen(false);
      await refreshProfessor();
    } else {
      setOtherError(res.error || 'Failed to assign class.');
    }
  };

  const startEditBlocks = (assignment) => {
    setEditingBlocksFor(assignment.courseId);
    setEditingBlocksValue(assignment.blocks || []);
  };

  const cancelEditBlocks = () => {
    setEditingBlocksFor(null);
    setEditingBlocksValue([]);
  };

  const saveEditBlocks = async () => {
    if (!editingBlocksFor) return;
    if (editingBlocksValue.length === 0) {
      setError('Select at least one block.');
      return;
    }
    setError('');
    setSavingBlocks(true);
    const res = await updateAssignedCourseBlocks(professorId, editingBlocksFor, editingBlocksValue);
    setSavingBlocks(false);
    if (res.success) {
      if (selectedSubject?.courseId === editingBlocksFor) {
        const updated = { ...selectedSubject, blocks: editingBlocksValue };
        setSelectedSubject(updated);
        viewStudents(updated);
      }
      cancelEditBlocks();
      await refreshProfessor();
    } else {
      setError(res.error || 'Failed to update blocks.');
    }
  };

  const handleUnassign = async () => {
    if (!confirmUnassign) return;
    const res = await unassignCourseFromProfessor(professorId, confirmUnassign.courseId);
    if (res.success) {
      if (selectedSubject?.courseId === confirmUnassign.courseId) {
        setSelectedSubject(null);
        setStudents([]);
      }
      setConfirmUnassign(null);
      await refreshProfessor();
    } else {
      setError(res.error || 'Failed to unassign subject.');
    }
  };

  const viewStudents = async (subject) => {
    setSelectedSubject(subject);
    setStudentsLoading(true);
    const res = await getStudentsForCourse(subject, activeTerm || { semester: 1, schoolYear: '' });
    if (res.success) setStudents(res.data);
    else setError(res.error || 'Failed to load students.');
    setStudentsLoading(false);
  };

  if (loading) {
    return <div className="bg-white border border-gray-300 rounded-2xl p-8 text-center text-gray-500 text-sm">Loading professor...</div>;
  }

  if (!professor) {
    return (
      <div className="bg-white border border-gray-300 rounded-2xl p-8 text-center">
        <p className="text-gray-500 text-sm mb-3">{error || 'Professor not found.'}</p>
        <button onClick={onBack} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer">
          Back to professor list
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="bg-white border border-gray-300 rounded-2xl shadow-sm p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> All professors
              </button>
              <h6 className="text-xl font-semibold text-gray-800">{professor.name}</h6>
              <p className="text-sm text-gray-500">
                {professor.employeeId ? `ID: ${professor.employeeId}` : 'No employee ID'}
                {professor.email ? ` · ${professor.email}` : ''}
              </p>
            </div>
            <button
              onClick={openPicker}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Assign Subject
            </button>
          </div>

          {error && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Assigned Subjects</p>
            {(professor.assignedCourses || []).length === 0 ? (
              <div className="py-10 text-center border border-dashed border-gray-300 rounded-lg">
                <BookOpen className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No subjects assigned yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {professor.assignedCourses.map(c => {
                  const isSelected = selectedSubject?.courseId === c.courseId;
                  const isEditing = editingBlocksFor === c.courseId;
                  const blocks = c.blocks || [];
                  return (
                    <li
                      key={c.courseId}
                      className={`px-4 py-3 hover:bg-blue-50/40 ${isSelected ? 'bg-blue-50' : ''} ${isEditing ? '' : 'cursor-pointer'}`}
                      onClick={() => { if (!isEditing) viewStudents(c); }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-800">{c.courseCode}</span>
                            {c.source === 'other-department' ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                                {c.classCourse} · Year {c.yearLevel}
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                Year {c.yearLevel} · {SEMESTER_LABELS[c.semester] || `Sem ${c.semester}`}
                              </span>
                            )}
                            {Number(c.units) > 0 && (
                              <span className="text-xs text-gray-500">{c.units} units</span>
                            )}
                            {c.source === 'other-department' && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-purple-600 text-white">
                                <Building2 className="w-3 h-3" /> Other Dept
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{c.courseTitle}</p>
                          {c.source === 'other-department' ? (
                            c.departmentName && (
                              <p className="text-xs text-gray-400 mt-0.5">{c.departmentName}</p>
                            )
                          ) : (
                            c.curriculumName && (
                              <p className="text-xs text-gray-400 mt-0.5">{c.curriculumName}</p>
                            )
                          )}
                          <div className="mt-2 flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-gray-500">Block{blocks.length === 1 ? '' : 's'}:</span>
                            {isEditing ? (
                              <BlockToggle value={editingBlocksValue} onChange={setEditingBlocksValue} />
                            ) : blocks.length === 0 ? (
                              <span className="text-xs text-amber-600">— not set —</span>
                            ) : (
                              blocks.map(b => (
                                <span key={b} className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                                  {b}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <>
                              <button
                                onClick={saveEditBlocks}
                                disabled={savingBlocks}
                                className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 cursor-pointer disabled:opacity-50"
                                title="Save blocks"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelEditBlocks}
                                disabled={savingBlocks}
                                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 cursor-pointer disabled:opacity-50"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => viewStudents(c)}
                                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-600 cursor-pointer"
                                title="View students"
                              >
                                <Users className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => startEditBlocks(c)}
                                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-600 cursor-pointer"
                                title="Edit blocks"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setConfirmUnassign(c)}
                                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-red-600 cursor-pointer"
                                title="Unassign"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {selectedSubject && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeStudentsModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 border-b border-gray-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-blue-600 text-xs font-semibold uppercase tracking-wide mb-1">
                    <Users className="w-3.5 h-3.5" /> Enrolled Students
                  </div>
                  <h6 className="text-xl font-semibold text-gray-800 truncate">
                    {selectedSubject.courseCode} — {selectedSubject.courseTitle}
                  </h6>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {selectedSubject.source === 'other-department' ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-600 text-white">
                          <Building2 className="w-3 h-3" /> {selectedSubject.departmentName || 'Other Department'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                          {selectedSubject.classCourse} · Year {selectedSubject.yearLevel}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          Year {selectedSubject.yearLevel} · {SEMESTER_LABELS[selectedSubject.semester] || `Sem ${selectedSubject.semester}`}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                          {SEMESTER_LABELS[activeTerm?.semester] || '1st Sem'}
                          {activeTerm?.schoolYear ? ` · S.Y. ${activeTerm.schoolYear}` : ''}
                        </span>
                      </>
                    )}
                    {(selectedSubject.blocks || []).map(b => (
                      <span key={b} className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                        Block {b}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={closeStudentsModal}
                  className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 cursor-pointer shrink-0"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or student number..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <span className="text-sm text-gray-600 whitespace-nowrap">
                  <span className="font-semibold text-gray-800">{filteredStudents.length}</span>
                  {' '}of {students.length} student{students.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {studentsLoading ? (
                <p className="py-12 text-center text-sm text-gray-500">Loading students...</p>
              ) : students.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No students are taking this subject in the active term.</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-500">No students match your search.</p>
              ) : (
                <div className="space-y-4">
                  {studentsByBlock.map(([block, list]) => (
                    <div key={block}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-600 text-white">
                          Block {block}
                        </span>
                        <span className="text-xs text-gray-500">{list.length} student{list.length === 1 ? '' : 's'}</span>
                      </div>
                      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                        {list.map((s, i) => (
                          <li key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-gray-50">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-6 text-right text-xs text-gray-400 shrink-0">{i + 1}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                                <p className="text-xs text-gray-500">
                                  {s.studentNumber || '—'} · Year {s.yearLevel}
                                  {s.isIrregular ? ' · Irregular' : ''}
                                </p>
                              </div>
                            </div>
                            {s.isIrregular && (
                              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100 shrink-0">
                                Irregular
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeStudentsModal}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {pickerOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h6 className="text-lg font-semibold text-gray-800">Assign a Class</h6>
              <button
                onClick={() => setPickerOpen(false)}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-4">
              <button
                onClick={() => setPickerTab('ccs')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors ${
                  pickerTab === 'ccs' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Laptop className="w-4 h-4" /> CCS Curriculum
              </button>
              <button
                onClick={() => setPickerTab('other')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors ${
                  pickerTab === 'other' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Building2 className="w-4 h-4" /> Other Department
              </button>
            </div>

            {pickerTab === 'ccs' ? (
              <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <select
                value={pickerCurriculumId}
                onChange={(e) => setPickerCurriculumId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Select a curriculum...</option>
                {curriculums.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search course code or title..."
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-300"
                  disabled={!pickerCurriculumId}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
              {!pickerCurriculumId ? (
                <p className="p-6 text-center text-sm text-gray-500">Select a curriculum to view its subjects.</p>
              ) : pickerLoading ? (
                <p className="p-6 text-center text-sm text-gray-500">Loading subjects...</p>
              ) : filteredPickerCourses.length === 0 ? (
                <p className="p-6 text-center text-sm text-gray-500">No subjects found.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredPickerCourses.map(course => {
                    const taken = assignedCourseIds.has(course.id);
                    return (
                      <li key={course.id} className="px-3 py-2.5 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">{course.courseCode}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              Year {course.yearLevel} · {SEMESTER_LABELS[course.semester] || `Sem ${course.semester}`}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{course.courseTitle}</p>
                        </div>
                        <button
                          onClick={() => startAssign(course)}
                          disabled={taken}
                          className={`px-3 py-1.5 text-xs rounded-lg cursor-pointer ${
                            taken
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {taken ? 'Assigned' : 'Assign'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setPickerOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Done
              </button>
            </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto -mx-6 px-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                    <select
                      value={otherDeptId}
                      onChange={(e) => setOtherDeptId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <option value="">Select a department...</option>
                      {otherDepts.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name}{d.code ? ` (${d.code})` : ''}
                        </option>
                      ))}
                    </select>
                    {otherDepts.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        No other departments registered. Add one in Payables → Other Departments first.
                      </p>
                    )}
                  </div>

                  {otherDeptId && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
                      {otherClassesLoading ? (
                        <p className="text-sm text-gray-500 py-3">Loading classes...</p>
                      ) : otherClasses.length === 0 ? (
                        <p className="text-sm text-gray-500 py-3">
                          No classes found for this department. Add students with course/year/block in Payables first.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                          {otherClasses.map((c) => {
                            const key = `${c.course.toLowerCase()}::${c.yearLevel}`;
                            const selectedKey = otherSelectedClass
                              ? `${otherSelectedClass.course.toLowerCase()}::${otherSelectedClass.yearLevel}`
                              : '';
                            const isSelected = key === selectedKey;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  setOtherSelectedClass(c);
                                  setOtherBlocks([]);
                                }}
                                className={`text-left p-3 rounded-lg border cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <p className="font-semibold text-gray-800 text-sm">{c.course}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Year {c.yearLevel} · {c.studentCount} student{c.studentCount === 1 ? '' : 's'}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {c.blocks.map(b => (
                                    <span key={b} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                                      {b}
                                    </span>
                                  ))}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {otherSelectedClass && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Curriculum (subject source)</label>
                          <select
                            value={otherCurriculumId}
                            onChange={(e) => setOtherCurriculumId(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                          >
                            <option value="">Select a curriculum...</option>
                            {curriculums.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Search subject</label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Course code or title..."
                              value={otherSubjectSearch}
                              onChange={(e) => setOtherSubjectSearch(e.target.value)}
                              disabled={!otherCurriculumId}
                              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Subject *</label>
                        {!otherCurriculumId ? (
                          <p className="text-sm text-gray-500 py-3 px-3 border border-gray-200 rounded-lg">
                            Select a curriculum to see its subjects.
                          </p>
                        ) : otherCurriculumLoading ? (
                          <p className="text-sm text-gray-500 py-3 px-3 border border-gray-200 rounded-lg">
                            Loading subjects...
                          </p>
                        ) : filteredOtherCourses.length === 0 ? (
                          <p className="text-sm text-gray-500 py-3 px-3 border border-gray-200 rounded-lg">
                            No subjects found in this curriculum.
                          </p>
                        ) : (
                          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg max-h-44 overflow-y-auto">
                            {filteredOtherCourses.map(course => {
                              const isSelected = otherSelectedCourse?.id === course.id;
                              return (
                                <li
                                  key={course.id}
                                  onClick={() => setOtherSelectedCourse(course)}
                                  className={`px-3 py-2 flex items-center justify-between cursor-pointer ${
                                    isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-gray-800 text-sm">{course.courseCode}</span>
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                        Year {course.yearLevel} · {SEMESTER_LABELS[course.semester] || `Sem ${course.semester}`}
                                      </span>
                                      {Number(course.units) > 0 && (
                                        <span className="text-xs text-gray-500">{course.units} units</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-600 truncate">{course.courseTitle}</p>
                                  </div>
                                  {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-2" />}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Block(s) *</label>
                        <div className="flex flex-wrap gap-1.5">
                          {(otherSelectedClass.blocks.length > 0 ? otherSelectedClass.blocks : ALL_BLOCKS).map(b => {
                            const active = otherBlocks.includes(b);
                            return (
                              <button
                                key={b}
                                type="button"
                                onClick={() => {
                                  setOtherBlocks(prev =>
                                    prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b].sort()
                                  );
                                }}
                                className={`min-w-[36px] px-2.5 py-1 text-xs font-semibold rounded-md border cursor-pointer transition-colors ${
                                  active
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {b}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Showing blocks present in this class.
                        </p>
                      </div>
                    </>
                  )}

                  {otherError && (
                    <p className="text-red-500 text-xs">{otherError}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-5 pb-1">
                  <button
                    onClick={() => setPickerOpen(false)}
                    disabled={savingOther}
                    className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignOther}
                    disabled={savingOther || !otherSelectedClass}
                    className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer disabled:opacity-60"
                  >
                    {savingOther ? 'Assigning...' : 'Assign Class'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {pendingCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h6 className="text-lg font-semibold text-gray-800 mb-1">Which blocks?</h6>
            <p className="text-sm text-gray-500 mb-4">
              Select the block(s) this professor handles for this subject. The year level is set by the curriculum.
            </p>

            <div className="border border-gray-200 rounded-lg p-3 mb-4 bg-gray-50">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-800">{pendingCourse.courseCode}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white text-gray-600 border border-gray-200">
                  Year {pendingCourse.yearLevel} · {SEMESTER_LABELS[pendingCourse.semester] || `Sem ${pendingCourse.semester}`}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{pendingCourse.courseTitle}</p>
            </div>

            <p className="text-sm font-medium text-gray-700 mb-2">Block(s)</p>
            <BlockToggle value={pendingBlocks} onChange={setPendingBlocks} />

            {pendingError && (
              <p className="text-red-500 text-xs mt-3">{pendingError}</p>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={cancelAssign}
                disabled={savingAssignment}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmAssign}
                disabled={savingAssignment}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer disabled:opacity-60"
              >
                {savingAssignment ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmUnassign && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h6 className="text-lg font-semibold text-gray-800 mb-2">Unassign Subject</h6>
            <p className="text-sm text-gray-600 mb-5">
              Remove <span className="font-medium text-gray-800">{confirmUnassign.courseCode}</span> from this professor's assignments?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmUnassign(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUnassign}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer"
              >
                Unassign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessorDetail;
