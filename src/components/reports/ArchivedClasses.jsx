import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  getDoc,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  query,
  writeBatch,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  ArrowBigLeft,
  BadgePlus,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Folder,
  ArchiveRestore,
  X,
  Square,
  Search,
  RefreshCcw,
  Trash2,
} from 'lucide-react';
import { logSystemAction } from '../../utils/auditLogger';
import Breadcrumbs from '../common/Breadcrumbs';

const formatBatchLabel = (id) =>
  id.replace('batch_', '').replace('_', '-');

/* ---------------- SKELETON LOADING ---------------- */
const StudentRowSkeleton = ({ selectMode }) => (
  <tr className="border-t border-gray-300 animate-pulse">
    <td className="px-4 py-2">
      {selectMode ? (
        <div className="h-3 w-3 bg-gray-200 rounded" />
      ) : (
        <div className="h-4 w-6 bg-gray-200 rounded" />
      )}
    </td>
    <td className="px-4 py-2">
      <div className="h-4 w-24 bg-gray-200 rounded" />
    </td>
    <td className="px-4 py-2">
      <div className="h-4 w-32 bg-gray-200 rounded" />
    </td>
    <td className="px-4 py-2">
      <div className="h-4 w-28 bg-gray-200 rounded" />
    </td>
    <td className="px-4 py-2">
      <div className="h-4 w-32 bg-gray-200 rounded" />
    </td>
    <td className="px-4 py-2">
      <div className="flex gap-2">
        <div className="h-6 w-16 bg-gray-200 rounded" />
      </div>
    </td>
  </tr>
);

/* ---------------- ITEM CARD ---------------- */
const ItemCard = ({
  item,
  type,
  isSelected,
  onClick,
  onDelete,
}) => {
  const isBatch = type === 'batch';

  return (
 <div
  role="button"
  tabIndex={0}
  onClick={onClick}
  onKeyDown={(event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') onClick();
  }}
  className="group relative cursor-pointer rounded-lg border border-gray-300 bg-white p-4 text-left shadow-sm transition  hover:border-blue-400 hover:shadow-md"

>
  <div className="flex items-center gap-3 pr-8">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
<Folder className="h-5 w-5" />
</div>


    <div className="min-w-0">
      <p
        className={`truncate text-sm font-semibold ${
          isSelected ? 'text-blue-800' : 'text-gray-900'
        }`}
      >
         {isBatch ? formatBatchLabel(item.id) : item.name || item.id}
      </p>

     
    </div>
  </div>
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      onDelete(item);
    }}
    className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
    title={`Delete ${isBatch ? 'batch' : 'folder'}`}
  >
    <Trash2 className="h-4 w-4" />
  </button>
</div>
  );
};

const SortIcon = ({ active, direction }) => {
  if (!active) return <ChevronsUpDown className="ml-1 inline-block h-3.5 w-3.5 opacity-60" />;
  return direction === 'asc'
    ? <ChevronUp className="ml-1 inline-block h-3.5 w-3.5" />
    : <ChevronDown className="ml-1 inline-block h-3.5 w-3.5" />;
};

/* ---------------- STUDENT TABLE ---------------- */
const StudentList = ({
  students,
  curriculums,
  isBatch,
  sortBy,
  sortDir,
  onSort,
  onViewStudent,
  onUnarchiveStudent,
  onDeleteStudent,
  selectMode,
  selectedIds,
  onToggleSelect,
  loading,
}) => {
  if (loading) {
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-300 mt-6">
        <table className="min-w-full text-sm">
          <thead className='bg-blue-500 text-white'>
            <tr className="text-left text-sm border-b border-gray-300">
              {selectMode ? <th className="p-4 w-12"></th> : <th className="p-4 w-12">#</th>}
              <th className="p-4 ">Student No.</th>
              <th className="p-4">Name</th>
              <th className="p-4">Curriculum</th>
              <th className="p-4">Status</th>
              <th className="p-4 w-12%">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, index) => (
              <StudentRowSkeleton key={index} selectMode={selectMode} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

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
        <thead className='bg-blue-500 text-white'>
          <tr className="text-left text-sm  border-b border-gray-300">
            {selectMode ? (
              <th className="p-4 w-12">
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={students.length > 0 && students.every(s => selectedIds.includes(s.id))}
                  onChange={() => {
                    if (students.length > 0 && students.every(s => selectedIds.includes(s.id))) {
                      onToggleSelect([]);
                    } else {
                      onToggleSelect(students.map(s => s.id));
                    }
                  }}
                />
              </th>
            ) : (
              <th className="p-4 w-12">#</th>
            )}
            {[
              ['studentNumber', 'Student No.'],
              ['name', 'Name'],
              ['curriculum', 'Curriculum'],
            ].map(([key, label]) => (
              <th key={key} className="p-4">
                <button
                  type="button"
                  onClick={() => onSort(key)}
                  className="inline-flex items-center"
                >
                  {label}
                  <SortIcon active={sortBy === key} direction={sortDir} />
                </button>
              </th>
            ))}
            <th className="p-4 w-12%">Actions</th>
          </tr>
        </thead>

        <tbody>
          {students.map((student, index) => {
            const pending = (student.payables || []).filter(
              (p) => p.status !== 'paid'
            ).length;
            
            // Calculate total balance from all unpaid payables
            const totalBalance = (student.payables || [])
              .filter(p => p.status !== 'paid')
              .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            return (
              <tr
                key={student.id}
                className="cursor-pointer border-b border-gray-300 hover:bg-slate-50"
                onClick={() => onViewStudent(student)}
              >
                {selectMode ? (
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-3 w-3"
                      checked={selectedIds.includes(student.id)}
                      onChange={() => onToggleSelect(student.id)}
                    />
                  </td>
                ) : (
                  <td className="px-4 py-2 text-gray-700 text-center">{index + 1}</td>
                )}
                <td className="px-4 py-2 text-gray-700">{student.studentNumber || ''}</td>
                <td className="px-4 py-2">{student.name}</td>

                <td className="px-4 py-2 text-gray-600">
                  {curriculums[student.curriculumId] || student.curriculumId || ''}
                </td>
               

                <td className="px-4 py-2 w-12% text-left">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnarchiveStudent(student);
                    }}
className="rounded-lg bg-gray-100 p-1.5 cursor-pointer hover:bg-gray-200 text-gray-500"
                    title="Unarchive student"
                  >
                    <ArchiveRestore className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteStudent(student);
                    }}
                    className="ml-2 rounded-lg bg-gray-100 p-1.5 cursor-pointer hover:bg-red-50 text-gray-500 hover:text-red-600"
                    title="Delete archived record"
                  >
                    <Trash2 className="h-4 w-4" />
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
const GradesTable = ({ grades, curriculumCourses = {}, student = {}, yearFilter = null }) => {
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
    const yearLevels = Object.keys(curriculumCourses)
      .filter((year) => !yearFilter || Number(year) === Number(yearFilter))
      .sort((a, b) => Number(a) - Number(b));

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
  const years = Object.keys(normalized)
    .filter((year) => {
      if (!yearFilter) return true;
      const match = year.match(/\d+/);
      return match ? Number(match[0]) === Number(yearFilter) : false;
    })
    .sort();

  return (
    <div className="space-y-6">
      {years.map((year) => {
        const semesters = normalized[year] || {};
        const semKeys = Object.keys(semesters).sort();
        return (
          <div key={year}>
            <div className="text-sm font-semibold text-gray-700 mb-3">{year}</div>
            <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
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
  const [tab, setTab] = useState('1');
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

    <div className="flex flex-wrap gap-2 mb-4">
      {[1, 2, 3, 4].map((year) => (
        <button
          key={year}
          onClick={() => setTab(String(year))}
          className={`px-3 py-1 ${tab === String(year) ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
        >
          {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year
        </button>
      ))}
     
    </div>

    <div className="overflow-y-auto max-h-[calc(80vh-140px)] pr-2">
      {['1', '2', '3', '4'].includes(tab) && (
        <GradesTable
          grades={student.grades}
          curriculumCourses={curriculumCourses}
          student={student}
          yearFilter={Number(tab)}
        />
      )}
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

const UnarchiveModal = ({
  student,
  year,
  block,
  setYear,
  setBlock,
  onClose,
  onConfirm,
  saving,
}) => {
  if (!student) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
        <h3 className="text-lg font-semibold">Unarchive Student</h3>
        <p className="text-sm text-gray-500 mb-5">
          Choose where {student.name || 'this student'} should appear in Student Management.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Year Level</label>
            <select
              value={year || 1}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  {value === 1 ? '1st' : value === 2 ? '2nd' : value === 3 ? '3rd' : '4th'} Year
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Block</label>
            <select
              value={block || 'A'}
              onChange={(e) => setBlock(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {['A', 'B', 'C', 'D', 'E'].map((value) => (
                <option key={value} value={value}>Block {value}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm border rounded-lg"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={saving}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'Restoring...' : 'Unarchive'}
          </button>
        </div>
      </div>
    </div>
  );
};

const DeleteArchiveModal = ({ target, saving, onClose, onConfirm }) => {
  if (!target) return null;

  const isStudents = target.type === 'students';
  const count = target.students?.length || 0;
  const title = isStudents
    ? `Delete ${count} archived record${count === 1 ? '' : 's'}?`
    : `Delete archived ${target.item?.type === 'batch' ? 'batch' : 'folder'}?`;
  const name = isStudents
    ? target.students.map((student) => student.name || student.studentNumber || 'Archived student').join(', ')
    : target.item?.name || target.item?.id || 'this archive';

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">
          This will permanently remove <span className="font-medium text-gray-900">{name}</span> from archived classes. This action cannot be undone.
        </p>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-2 text-sm border rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={saving}
            className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
};

const commitBatchedDeletes = async (refs) => {
  for (let index = 0; index < refs.length; index += 450) {
    const batch = writeBatch(db);
    refs.slice(index, index + 450).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
};

const deleteArchivedPaymentsForStudents = async (studentIds) => {
  const paymentRefs = [];

  for (const studentId of studentIds) {
    const paymentsQuery = query(
      collection(db, 'archivedStudentPayments'),
      where('studentId', '==', studentId)
    );
    const snapshot = await getDocs(paymentsQuery);
    snapshot.docs.forEach((docSnap) => {
      paymentRefs.push(doc(db, 'archivedStudentPayments', docSnap.id));
    });
  }

  await commitBatchedDeletes(paymentRefs);
};

const removeStudentsFromArchivedPayables = async (archiveId, studentIds) => {
  const payablesRef = doc(db, 'archivedPayables', archiveId);
  const payablesSnap = await getDoc(payablesRef);

  if (!payablesSnap.exists()) return;

  const data = payablesSnap.data();
  const nextStudents = { ...(data.students || {}) };
  studentIds.forEach((studentId) => {
    delete nextStudents[studentId];
  });

  if (Object.keys(nextStudents).length === 0) {
    await deleteDoc(payablesRef);
    return;
  }

  await setDoc(payablesRef, { ...data, students: nextStudents }, { merge: false });
};

/* ---------------- MAIN ---------------- */
const ArchivedClasses = ({ onBackToReportsMain }) => {
  const [archives, setArchives] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [search] = useState('');
  const [curriculums, setCurriculums] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFolder, setNewFolder] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalStudent, setModalStudent] = useState(null);
  const [modalCurriculumCourses, setModalCurriculumCourses] = useState({});
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [unarchiveTarget, setUnarchiveTarget] = useState(null);
  const [unarchiveYear, setUnarchiveYear] = useState(1);
  const [unarchiveBlock, setUnarchiveBlock] = useState('A');
  const [unarchiving, setUnarchiving] = useState(false);
  
  // Selection state for bulk actions
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Search and refresh state
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [success, setSuccess] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  /* ---------------- FETCH ---------------- */
  const fetchData = async (showRefreshLoading = false) => {
    if (showRefreshLoading) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
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
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleRefresh = () => {
    fetchData(true);
  };

  const openStudentModal = async (student) => {
    setModalStudent(student);

    try {
      if (student && student.curriculumId && !modalCurriculumCourses[student.curriculumId]) {
        const q = query(
          collection(db, 'courses'),
          where('curriculumId', '==', student.curriculumId),
          orderBy('yearLevel'),
          orderBy('semester')
        );
        const snap = await getDocs(q);
        const courses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

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
      console.error('Failed to load curriculum courses', err);
    }
  };

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

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const sortedSelectedStudents = useMemo(() => {
    const list = (selectedItem?.students || []).slice();
    return list.sort((a, b) => {
      const pendingA = (a.payables || []).some((p) => p.status !== 'paid') ? 'pending' : 'settled';
      const pendingB = (b.payables || []).some((p) => p.status !== 'paid') ? 'pending' : 'settled';
      const values = {
        studentNumber: [(a.studentNumber || '').toString(), (b.studentNumber || '').toString()],
        name: [(a.name || '').toString(), (b.name || '').toString()],
        curriculum: [
          (curriculums[a.curriculumId] || a.curriculumId || '').toString(),
          (curriculums[b.curriculumId] || b.curriculumId || '').toString()
        ],
        status: [pendingA, pendingB],
      };
      const [aValue, bValue] = values[sortBy] || values.name;
      return sortDir === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });
  }, [curriculums, selectedItem?.students, sortBy, sortDir]);

  // Filter students based on search term
  const filteredSelectedStudents = useMemo(() => {
    if (!selectedItem?.students || !searchTerm) return sortedSelectedStudents;
    
    return sortedSelectedStudents.filter(student => 
      (student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       student.studentNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (curriculums[student.curriculumId]?.toLowerCase().includes(searchTerm.toLowerCase())) ||
       student.curriculumId?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [sortedSelectedStudents, searchTerm, curriculums, selectedItem?.students]);

  const openUnarchiveModal = (student) => {
    setUnarchiveTarget(student);
    setUnarchiveYear(Number(student.yearLevel) || 1);
    setUnarchiveBlock((student.block || 'A').toString().trim().toUpperCase() || 'A');
  };

  // Toggle a single student's selection
  const toggleSelectId = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      return [...prev, id];
    });
  };

  // Handle selection toggle (single ID or array)
  const handleToggleSelect = (idOrArray) => {
    if (Array.isArray(idOrArray)) {
      setSelectedIds(idOrArray);
    } else {
      toggleSelectId(idOrArray);
    }
  };

  const openDeleteArchiveModal = (item) => {
    setDeleteTarget({ type: 'archive', item });
  };

  const openDeleteStudentModal = (student) => {
    setDeleteTarget({ type: 'students', archive: selectedItem, students: [student] });
  };

  const openDeleteSelectedModal = () => {
    const students = (selectedItem?.students || []).filter((student) => selectedIds.includes(student.id));
    if (students.length === 0) return;
    setDeleteTarget({ type: 'students', archive: selectedItem, students });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      if (deleteTarget.type === 'archive') {
        const archive = deleteTarget.item;
        const studentIds = (archive.students || []).map((student) => student.id).filter(Boolean);

        await deleteArchivedPaymentsForStudents(studentIds);
        await deleteDoc(doc(db, 'archivedPayables', archive.id)).catch(() => {});
        await deleteDoc(doc(db, 'archives', archive.id));

        await logSystemAction({
          action: 'Deleted archived class folder',
          module: 'Reports',
          entityType: 'archive',
          entityId: '',
          description: `Deleted archived ${archive.type === 'batch' ? 'batch' : 'folder'}: ${archive.name || formatBatchLabel(archive.id)}`,
          details: {
            name: archive.name || formatBatchLabel(archive.id),
            recordCount: studentIds.length,
          },
        });

        setArchives((prev) => prev.filter((archiveItem) => archiveItem.id !== archive.id));
        if (selectedItem?.id === archive.id) setSelectedItem(null);
        setSuccess('Archived folder deleted permanently.');
      } else {
        const archive = deleteTarget.archive;
        const studentIds = (deleteTarget.students || []).map((student) => student.id).filter(Boolean);
        const nextStudents = (archive.students || []).filter((student) => !studentIds.includes(student.id));

        await setDoc(
          doc(db, 'archives', archive.id),
          {
            students: nextStudents,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        await removeStudentsFromArchivedPayables(archive.id, studentIds);
        await deleteArchivedPaymentsForStudents(studentIds);

        await logSystemAction({
          action: 'Deleted archived class records',
          module: 'Reports',
          entityType: 'archive',
          entityId: '',
          description: `Deleted ${studentIds.length} archived class record${studentIds.length === 1 ? '' : 's'} from ${archive.name || formatBatchLabel(archive.id)}`,
          details: {
            archiveName: archive.name || formatBatchLabel(archive.id),
            recordCount: studentIds.length,
          },
        });

        setArchives((prev) =>
          prev.map((archiveItem) =>
            archiveItem.id === archive.id ? { ...archiveItem, students: nextStudents } : archiveItem
          )
        );
        setSelectedItem((prev) => (prev ? { ...prev, students: nextStudents } : prev));
        setSelectedIds([]);
        setSuccess(`${studentIds.length} archived record${studentIds.length === 1 ? '' : 's'} deleted permanently.`);
      }

      setDeleteTarget(null);
    } catch (err) {
      alert(`Failed to delete archived data: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // Handle bulk unarchive for selected students
  const handleBulkUnarchive = async () => {
    if (selectedIds.length === 0) return;
    
    setUnarchiving(true);
    try {
      const selectedStudents = (selectedItem?.students || []).filter(student => 
        selectedIds.includes(student.id)
      );
      
      // Restore all selected students to default year/block
      const restorePromises = selectedStudents.map(async (student) => {
        const restoredStudent = {
          ...student,
          yearLevel: Number(student.yearLevel) || 1,
          block: (student.block || 'A').toString().trim().toUpperCase() || 'A',
          active: true,
          inactiveAt: null,
          inactiveYear: null,
          updatedAt: new Date().toISOString(),
        };

        // Update student in main collection
        await setDoc(doc(db, 'students', student.id), restoredStudent, { merge: true });
        
        return student.id;
      });

      const restoredIds = await Promise.all(restorePromises);
      
      // Remove restored students from archive
      const remainingStudents = (selectedItem.students || []).filter(student => 
        !restoredIds.includes(student.id)
      );
      
      await setDoc(
        doc(db, 'archives', selectedItem.id),
        {
          students: remainingStudents,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Log bulk action
      await logSystemAction({
        action: 'Archived classes',
        module: 'Reports',
        entityType: 'studentBatch',
        entityId: '',
        description: `Bulk unarchived ${selectedIds.length} students from ${selectedItem.name || selectedItem.id}`,
        details: {
          archiveId: selectedItem.id,
          studentIds: selectedIds,
          count: selectedIds.length
        }
      });

      // Update local state
      setArchives(prev =>
        prev.map(archive =>
          archive.id === selectedItem.id
            ? { ...archive, students: remainingStudents }
            : archive
        )
      );
      setSelectedItem(prev => prev ? { ...prev, students: remainingStudents } : prev);
      setSelectedIds([]);
      setSuccess(`${selectedIds.length} students successfully unarchived!`);
    } catch (err) {
      alert(`Failed to unarchive students: ${err.message}`);
    } finally {
      setUnarchiving(false);
    }
  };

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
    await logSystemAction({
      action: 'Created archive folder',
      module: 'Reports',
      entityType: 'archive',
      entityId: name,
      description: `Created archive folder: ${name}`,
      details: { name }
    });

    const snap = await getDocs(collection(db, 'archives'));
    setArchives(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

    setNewFolder('');
    setIsModalOpen(false);
    setCreating(false);
  };

  const handleUnarchive = async () => {
    if (!selectedItem || !unarchiveTarget?.id) return;

    setUnarchiving(true);
    try {
      const restoredStudent = {
        ...unarchiveTarget,
        yearLevel: Number(unarchiveYear) || 1,
        block: unarchiveBlock,
        active: true,
        inactiveAt: null,
        inactiveYear: null,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'students', unarchiveTarget.id), restoredStudent, { merge: true });

      const nextStudents = (selectedItem.students || []).filter((student) => student.id !== unarchiveTarget.id);
      await setDoc(
        doc(db, 'archives', selectedItem.id),
        {
          students: nextStudents,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await logSystemAction({
        action: 'Archived classes',
        module: 'Reports',
        entityType: 'student',
        entityId: unarchiveTarget.id,
        description: `Unarchived ${unarchiveTarget.name || unarchiveTarget.id}`,
        details: {
          archiveId: selectedItem.id,
          studentId: unarchiveTarget.id,
          yearLevel: restoredStudent.yearLevel,
          block: restoredStudent.block,
        }
      });

      setArchives((prev) =>
        prev.map((archive) =>
          archive.id === selectedItem.id
            ? { ...archive, students: nextStudents }
            : archive
        )
      );
      setSelectedItem((prev) => prev ? { ...prev, students: nextStudents } : prev);
      setUnarchiveTarget(null);
    } catch (err) {
      alert(`Failed to unarchive student: ${err.message}`);
    } finally {
      setUnarchiving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto ">
      <Breadcrumbs
        items={[
          { label: 'Archived Classes', onClick: selectedItem ? () => setSelectedItem(null) : null },
          ...(selectedItem ? [{ label: selectedItem.type === 'batch' ? `Batch ${selectedItem.name}` : selectedItem.name || selectedItem.id }] : [])
        ]}
      />

      <div className='flex items-center justify-between mb-6'>
           <div>
            <h5 className="text-2xl font-medium text-gray-900">Archived Classes</h5>
            <p className="text-gray-500 text-sm">
             View and manage archived classes, organized by folders or batches, to keep track of past academic records.
            </p>
            {success && (
              <div className="mt-2 p-2 bg-green-100 border border-green-300 text-green-700 rounded-lg text-sm">
                {success}
              </div>
            )}
          </div>
            {!selectedItem && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-green-500 cursor-pointer hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm"
              >
                <BadgePlus className="w-4 h-4" />
                Create Batch / Folder
              </button>
            )}
          
      </div>

      <div>
            {selectedItem && (
              <>

                <div className='flex items-center gap-2 justify-between'>
                 <div className='flex items-center gap-2'>
                   <button
                  type="button"
                  onClick={() => {
                    const next = !selectMode;
                    setSelectMode(next);
                    if (!next) setSelectedIds([]);
                  }}
                  title={selectMode ? 'Turn off selection' : 'Select students'}
                 className={`inline-flex items-center gap-2 text-sm p-2 border border-gray-300 cursor-pointer rounded-lg transition 
${selectMode 
? 'bg-gray-100 text-gray-400 '
: 'hover:bg-gray-100 text-gray-700 bg-gray-50 '
}`}
                >
                  <Square className="w-4 h-4" />
                  <span className="text-xs">Select</span>
                </button>

                {selectMode && selectedIds.length > 0 && (
                  <>
                    <button
                      onClick={handleBulkUnarchive}
                      disabled={unarchiving}
                      className="rounded-lg bg-gray-100 p-1.5 cursor-pointer hover:bg-gray-200 text-gray-500"
                      title={`Unarchive ${selectedIds.length} selected student${selectedIds.length > 1 ? 's' : ''}`}
                    >
                      <ArchiveRestore className="w-4 h-4" />
                    </button>
                    <button
                      onClick={openDeleteSelectedModal}
                      disabled={deleting}
                      className="rounded-lg bg-gray-100 p-1.5 cursor-pointer hover:bg-red-50 text-gray-500 hover:text-red-600"
                      title={`Delete ${selectedIds.length} selected archived record${selectedIds.length > 1 ? 's' : ''}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                
                 </div>
                <div className='flex items-center gap-2'>
                    <button
                  onClick={handleRefresh}
                  disabled={refreshing}
className="p-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"

                  title="Refresh data"
                >
                  <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
className="w-full border text-sm border-slate-200 bg-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  />
                </div>
                
                </div>
            
                </div>
                
              
                      
              </>
            )}
            
          </div>

       {/* GRID */}
      {!selectedItem && (
        loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {allItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                type={item.type}
                isSelected={false}
                onDelete={openDeleteArchiveModal}
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
        )
      )}

      {/* STUDENTS */}
      {selectedItem && (
        <div >
          <StudentList
            students={filteredSelectedStudents}
            curriculums={curriculums}
            isBatch={selectedItem.type === 'batch'}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
            onViewStudent={openStudentModal}
            onUnarchiveStudent={openUnarchiveModal}
            onDeleteStudent={openDeleteStudentModal}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            loading={refreshing}
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

      <UnarchiveModal
        student={unarchiveTarget}
        year={unarchiveYear}
        block={unarchiveBlock}
        setYear={setUnarchiveYear}
        setBlock={setUnarchiveBlock}
        onClose={() => setUnarchiveTarget(null)}
        onConfirm={handleUnarchive}
        saving={unarchiving}
      />
      <DeleteArchiveModal
        target={deleteTarget}
        saving={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default ArchivedClasses;
