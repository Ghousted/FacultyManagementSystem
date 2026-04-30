import { useEffect, useState, useRef } from 'react';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { ArrowBigLeft, BadgePlus, Folder, Layers, X  } from 'lucide-react';

const formatBatchLabel = (id) =>
  id.replace('batch_', '').replace('_', '-');

/* ---------------- ITEM CARD ---------------- */
const ItemCard = ({
  item,
  type,
  isSelected,
  onClick,
  studentCount,
}) => {
  const isBatch = type === 'batch';

  return (
 <button
  onClick={onClick}
  className={`border p-4 rounded-xl border-gray-300 ${
    isSelected
      ? ' ring bg-blue-50 ring-blue-500'
      : 'hover:bg-gray-50 cursor-pointer hover:border-gray-400 transition-colors'
  }`}
>
  {/* Top Row */}
  <div className="flex items-start justify-between">
    <div className="flex items-center gap-2">
      <Folder className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
      <div>
        <div className={`text-sm font-semibold ${
          isSelected ? 'text-blue-700' : 'text-gray-900'
        }`}>
          Batch {isBatch ? formatBatchLabel(item.id) : item.name || item.id}
        </div>
      </div>
    </div>
  </div>
</button>
  );
};

/* ---------------- STUDENT TABLE ---------------- */
const StudentList = ({ students, curriculums, itemName, isBatch }) => {
  if (!students || students.length === 0) {
    return (
      <div className="text-sm text-gray-500 p-6 text-center">
        No students in this {isBatch ? 'batch' : 'folder'}.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-300 mt-6">
      <table className="min-w-full text-sm ">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-300">
            <th className="p-4 w-20%">Student No.</th>
            <th className="p-4 w-30% ">Name</th>
            <th className="p-4 w-30%">Curriculum</th>
            <th className="p-4 w-20%">Status</th>
            <th className="p-4 w-12%">Actions</th>
          </tr>
        </thead>

        <tbody>
          {students.map((student) => {
            const pending = (student.payables || []).filter(
              (p) => p.status !== 'paid'
            ).length;

            return (
              <tr
                key={student.id}
                className="border-b border-gray-300 hover:bg-slate-50"
              >
                <td className="px-4 py-2 w-20% text-gray-700">{student.studentNumber || ''}</td>
                <td className="px-4 py-2 w-30%">{student.name}</td>

                <td className="px-4 py-2 w-30% text-gray-600">
                  {curriculums[student.curriculumId] || student.curriculumId || ''}
                </td>
                <td className="px-4 py-2 w-20% text-gray-700">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${pending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                    {pending > 0 ? 'Pending' : 'Settled'}
                  </span>
                </td>

                <td className="px-4 py-2 w-12% text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const ev = new CustomEvent('archived:viewStudent', { detail: { student } });
                      window.dispatchEvent(ev);
                    }}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded-lg"
                  >
                    View
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ---------------- STUDENT DETAIL MODAL (Grades & Payables) ---------------- */
const GradesTable = ({ grades, curriculumCourses = {}, student = {} }) => {
  if (!grades || Object.keys(grades).length === 0) return <p className="text-sm text-gray-500">No grade records available.</p>;

  // Normalize shape used in ViewArchivedClasses. If it's already nested, keep it.
  const normalized = (() => {
    if (!grades || typeof grades !== 'object') return {};
    const firstVal = Object.values(grades)[0];
    if (firstVal && typeof firstVal === 'object' && !Array.isArray(firstVal)) {
      const deepVal = Object.values(firstVal)[0];
      if (deepVal && typeof deepVal === 'object') return grades; // already nested
    }
    return { 'Year 1': { '1st Semester': grades } };
  })();

  // If curriculumCourses provided, render subjects according to curriculum structure
  if (curriculumCourses && Object.keys(curriculumCourses).length > 0) {
    // curriculumCourses expected shape: { [yearLevel]: { [semesterLabel]: [course, ...] } }
    const yearLevels = Object.keys(curriculumCourses).sort((a, b) => Number(a) - Number(b));

    const semesterOrder = ['1st Semester', '2nd Semester', 'Summer'];

    const getGradeForCode = (code) => {
      // grades may be nested or flat; try nested first
      if (!grades) return undefined;
      if (typeof grades !== 'object') return undefined;
      // flat map: code -> grade
      if (grades[code] !== undefined) return grades[code];
      // nested: Year -> Semester -> { code: grade }
      for (const y of Object.values(grades)) {
        if (y && typeof y === 'object') {
          for (const s of Object.values(y)) {
            if (s && typeof s === 'object' && s[code] !== undefined) return s[code];
          }
        }
      }
      return undefined;
    };

    return (
      <div className="space-y-6">
        {yearLevels.map((y) => {
          const semesters = curriculumCourses[y] || {};
          return (
            <div key={y}>
              <div className="text-sm font-semibold text-gray-700 mb-3">Year {y}</div>
              <div className="flex flex-col gap-2">
                {semesterOrder.map((semLabel) => {
                  const courses = semesters[semLabel] || [];
                  if (!courses || courses.length === 0) return null;
                  const entries = courses;
                  const validGrades = entries.map((c) => getGradeForCode(c.courseCode)).filter((g) => !isNaN(parseFloat(g)));
                  const gwa = validGrades.length ? (validGrades.reduce((acc, g) => acc + parseFloat(g), 0) / validGrades.length).toFixed(2) : '—';

                  return (
                    <div key={semLabel} className="bg-white border border-gray-300 rounded-lg p-3">
                      <div className="text-xs text-gray-500 font-medium mb-2">{semLabel}</div>
                      {entries.length === 0 ? (
                        <p className="text-sm text-gray-500">No subjects.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-500 uppercase">
                              <th className="py-2 text-left">Code</th>
                              <th className="py-2 text-left">Description</th>
                              <th className="py-2 text-left">Units</th>
                              <th className="py-2 text-left">Prerequisites</th>
                              <th className="py-2 text-center">Status</th>
                              <th className="py-2 text-right">Grade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map((course) => {
                              const code = course.courseCode;
                              const grade = getGradeForCode(code);
                              const units = course.units ?? '';
                              const prereqs = (course.prerequisites || []).join(', ');
                              const completed = Array.isArray(student.completedCourses) && student.completedCourses.includes(code);
                              const status = completed ? 'Completed' : (grade === 'INC' ? 'INC' : (grade !== undefined && !isNaN(parseFloat(grade)) && parseFloat(grade) >= 5 ? 'Failed' : 'Not taken'));

                              return (
                                <tr key={code} className="border-t border-gray-300">
                                  <td className="py-2 text-gray-700">{code}</td>
                                  <td className="py-2 text-gray-700">{course.courseTitle || ''}</td>
                                  <td className="py-2 text-gray-700">{units}</td>
                                  <td className="py-2 text-gray-700">{prereqs || ''}</td>
                                  <td className="py-2 text-center text-xs">
                                    <span className={`px-2 py-0.5 rounded-full ${status === 'Completed' ? 'bg-green-100 text-green-700' : status === 'INC' ? 'bg-yellow-100 text-yellow-700' : status === 'Failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                      {status}
                                    </span>
                                  </td>
                                  <td className="py-2 text-right text-gray-700">{grade ?? ''}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td className="pt-2 text-xs text-gray-500">{entries.length} subject{entries.length !== 1 ? 's' : ''}</td>
                              <td />
                              <td />
                              <td />
                              <td className="pt-2 text-right text-xs text-gray-500">GWA: <strong className="text-gray-700">{gwa}</strong></td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback: render from nested grades structure
  const years = Object.keys(normalized).sort();

  return (
    <div className="space-y-6">
      {years.map((year) => {
        const semesters = normalized[year] || {};
        const semKeys = Object.keys(semesters).sort();
        return (
          <div key={year}>
            <div className="text-sm font-semibold text-gray-700 mb-3">{year}</div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {semKeys.map((sem) => {
                const subjects = semesters[sem] || {};
                const entries = Object.entries(subjects || {});
                const validGrades = entries.filter(([, g]) => !isNaN(parseFloat(g)));
                const gwa = validGrades.length ? (validGrades.reduce((acc, [, g]) => acc + parseFloat(g), 0) / validGrades.length).toFixed(2) : '—';

                return (
                  <div key={sem} className="bg-white border border-gray-300 rounded-lg p-3">
                    <div className="text-xs text-gray-500 font-medium mb-2">{sem}</div>
                    {entries.length === 0 ? (
                      <p className="text-sm text-gray-500">No subjects.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500 uppercase">
                            <th className="py-2 text-left">Subject</th>
                            <th className="py-2 text-right">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map(([code, grade]) => (
                            <tr key={code} className="border-t">
                              <td className="py-2 text-gray-700">{code}</td>
                              <td className="py-2 text-right text-gray-700">{grade}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td className="pt-2 text-xs text-gray-500">{entries.length} subject{entries.length !== 1 ? 's' : ''}</td>
                            <td className="pt-2 text-right text-xs text-gray-500">GWA: <strong className="text-gray-700">{gwa}</strong></td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const PayablesTable = ({ payables }) => {
  if (!payables || payables.length === 0) return <p className="text-sm text-gray-500">No payable records.</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500 uppercase">
          <th className="p-2">Description</th>
          <th className="p-2">Amount</th>
          <th className="p-2">Due</th>
          <th className="p-2 text-right">Status</th>
        </tr>
      </thead>
      <tbody>
        {payables.map((p, i) => (
          <tr key={i} className="border-t">
            <td className="p-2 text-gray-700">{p.description || '—'}</td>
            <td className="p-2 text-gray-700">{p.amount}</td>
            <td className="p-2 text-gray-700">{p.dueDate || '—'}</td>
            <td className="p-2 text-right">
              <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'paid' ? 'bg-green-100 text-green-700' : p.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                {p.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const StudentDetailModal = ({ student, curriculums, curriculumCourses = {}, onClose }) => {
  const [tab, setTab] = useState('curriculum');
  if (!student) return null;

  return (
   <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" role="dialog" aria-modal="true">
  <div className="bg-white rounded-2xl p-6 w-full max-w-4xl shadow-lg min-h-[80vh] max-h-[80vh] overflow-hidden">
    <div className="flex items-start justify-between mb-4">
      <div>
        <div className="text-lg font-semibold">{student.name}</div>
        <div className="text-sm text-gray-500">
          {student.studentNumber} · {curriculums?.[student.curriculumId] || student.curriculumId}
        </div>
      </div>
      <div>
        <button
          onClick={onClose}
          className="text-gray-500 font-bold hover:text-red-600 cursor-pointer"
          aria-label="Close student details"
        >
          <X className="w-8 h-8" />
        </button>
      </div>
    </div>

    <div className="flex gap-2 mb-4">
      <button
        onClick={() => setTab('curriculum')}
        className={`px-3 py-1 ${tab === 'curriculum' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
      >
        Curriculum
      </button>
      <button
        onClick={() => setTab('payables')}
        className={`px-3 py-1 ${tab === 'payables' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
      >
        Payables
      </button>
    </div>

    <div className="overflow-y-auto max-h-[calc(80vh-140px)] pr-2">
      {tab === 'curriculum' && <GradesTable grades={student.grades} curriculumCourses={curriculumCourses} student={student} />}
      {tab === 'payables' && <PayablesTable payables={student.payables || []} />}
    </div>
  </div>
</div>
  );
};

/* ---------------- MODAL ---------------- */
const CreateFolderModal = ({
  isOpen,
  onClose,
  onCreate,
  newFolder,
  setNewFolder,
  creating,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
        <h3 className="text-lg font-semibold">
          Create New Folder
        </h3>

        <p className="text-sm text-gray-500 mb-5">
          Organize archived classes
        </p>

        <input
          value={newFolder}
          onChange={(e) => setNewFolder(e.target.value)}
          placeholder="Folder name (e.g., Batch 2026)"
          className="w-full border px-3 py-2 rounded-lg text-sm"
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm border rounded-lg"
          >
            Cancel
          </button>

          <button
            onClick={onCreate}
            disabled={!newFolder.trim() || creating}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------------- MAIN ---------------- */
const ArchivedClasses = ({ onBackToReportsMain }) => {
  const [archives, setArchives] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [search, setSearch] = useState('');
  const [curriculums, setCurriculums] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFolder, setNewFolder] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalStudent, setModalStudent] = useState(null);
  const [modalCurriculumCourses, setModalCurriculumCourses] = useState({});

  /* ---------------- FETCH ---------------- */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const snap = await getDocs(collection(db, 'archives'));
      setArchives(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const currSnap = await getDocs(
        collection(db, 'curriculums')
      );

      const map = {};
      currSnap.docs.forEach((d) => {
        map[d.id] = d.data().name || d.id;
      });
      setCurriculums(map);

      setLoading(false);
    };

    fetchData();

    const handleView = async (e) => {
      const student = e.detail.student || null;
      setModalStudent(student);

      // fetch curriculum courses for this student's curriculum
      try {
        if (student && student.curriculumId) {
          const q = query(
            collection(db, 'courses'),
            where('curriculumId', '==', student.curriculumId),
            orderBy('yearLevel'),
            orderBy('semester')
          );
          const snap = await getDocs(q);
          const courses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

          // group into { yearLevel: { '1st Semester': [], '2nd Semester': [], 'Summer': [] } }
          const grouped = {};
          courses.forEach((c) => {
            const y = String(c.yearLevel || '0');
            const semNum = c.semester;
            const semLabel = semNum === 1 ? '1st Semester' : semNum === 2 ? '2nd Semester' : semNum === 3 ? 'Summer' : `Semester ${semNum}`;
            if (!grouped[y]) grouped[y] = {};
            if (!grouped[y][semLabel]) grouped[y][semLabel] = [];
            grouped[y][semLabel].push(c);
          });

          setModalCurriculumCourses((prev) => ({ ...prev, [student.curriculumId]: grouped }));
        }
      } catch (err) {
        // ignore fetch errors; modal will fallback to grades-only rendering
        console.error('Failed to load curriculum courses', err);
      }
    };

    window.addEventListener('archived:viewStudent', handleView);
    return () => window.removeEventListener('archived:viewStudent', handleView);
  }, []);

  /* ---------------- FILTER ---------------- */
  const filtered = archives.filter((a) =>
    (a.name || a.id)
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const folders = filtered.filter(
    (d) => !d.id.startsWith('batch_')
  );

  const batches = filtered.filter((d) =>
    d.id.startsWith('batch_')
  );

  const allItems = [
    ...folders.map((f) => ({ ...f, type: 'folder' })),
    ...batches.map((b) => ({ ...b, type: 'batch' })),
  ];

  /* ---------------- CREATE ---------------- */
  const handleCreate = async () => {
    const name = newFolder.trim();
    if (!name) return;

    setCreating(true);

    await setDoc(doc(db, 'archives', name), {
      name,
      students: [],
      createdAt: serverTimestamp(),
    });

    const snap = await getDocs(collection(db, 'archives'));
    setArchives(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

    setNewFolder('');
    setIsModalOpen(false);
    setCreating(false);
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
    

        <div className="bg-white p-8 rounded-2xl  border border-gray-300 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={onBackToReportsMain}
            className="group flex items-center gap-2 bg-blue-600 text-white p-2 cursor-pointer rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white transition-transform"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowBigLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h5 className="text-2xl font-medium text-blue-600">Archivd Classes</h5>
            <p className="text-gray-500 text-sm">
              View and manage archived classes, organized by folders or batches, to keep track of past academic records.
            </p>
          </div>
        </div>
           <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm"
        >
          <BadgePlus className="w-4 h-4" />
          Create Batch / Folder
        </button>
      </div>

     

      {/* GRID */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {allItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              type={item.type}
              isSelected={
                selectedItem?.id === item.id &&
                selectedItem?.type === item.type
              }
              studentCount={(item.students || []).length}
              onClick={() =>
                setSelectedItem({
                  ...item,
                  name:
                    item.type === 'batch'
                      ? formatBatchLabel(item.id)
                      : item.name,
                })
              }
            />
          ))}
        </div>
      )}

      {/* STUDENTS */}
      {selectedItem && (
        <div >
          <StudentList
            students={selectedItem.students}
            curriculums={curriculums}
            itemName={selectedItem.name}
            isBatch={selectedItem.type === 'batch'}
          />
        </div>
      )}

      {/* MODAL */}
      <CreateFolderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreate}
        newFolder={newFolder}
        setNewFolder={setNewFolder}
        creating={creating}
      />

      <StudentDetailModal
        student={modalStudent}
        curriculums={curriculums}
        curriculumCourses={modalCurriculumCourses[modalStudent?.curriculumId] || {}}
        onClose={() => setModalStudent(null)}
      />
    </div>
  );
};

export default ArchivedClasses;