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
  <tr className="border-t border-slate-100 animate-pulse">
    <td className="px-4 py-2">
      {selectMode ? (
        <div className="h-4 w-4 bg-slate-200 rounded" />
      ) : (
        <div className="h-4 w-6 bg-slate-200 rounded" />
      )}
    </td>
    <td className="px-4 py-2">
      <div className="h-4 w-24 bg-slate-200 rounded" />
    </td>
    <td className="px-4 py-2">
      <div className="h-4 w-32 bg-slate-200 rounded" />
    </td>
    <td className="px-4 py-2">
      <div className="h-4 w-28 bg-slate-200 rounded" />
    </td>
    <td className="px-4 py-2">
      <div className="h-4 w-32 bg-slate-200 rounded" />
    </td>
    <td className="px-4 py-2">
      <div className="flex gap-2">
        <div className="h-7 w-20 bg-slate-200 rounded-lg" />
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
  const studentCount = (item.students || []).length;

  return (
 <div
  role="button"
  tabIndex={0}
  onClick={onClick}
  onKeyDown={(event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') onClick();
  }}
  className={`group relative cursor-pointer rounded-lg border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 ${
    isSelected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'
  }`}

>
  <div className="flex items-start gap-3 pr-9">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
<Folder className="h-5 w-5" />
</div>


    <div className="min-w-0 flex-1">
      <p
        className={`truncate text-sm font-semibold ${
          isSelected ? 'text-blue-800' : 'text-gray-900'
        }`}
      >
         {isBatch ? formatBatchLabel(item.id) : item.name || item.id}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {isBatch ? 'Batch' : 'Folder'}
        </span>
        <span className="text-xs text-slate-500">
          {studentCount} student{studentCount === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  </div>
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      onDelete(item);
    }}
    className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
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
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-blue-500 text-white">
            <tr className="text-left text-xs uppercase tracking-wide">
              {selectMode ? <th className="px-4 py-3 w-12"></th> : <th className="px-4 py-3 w-12">#</th>}
              <th className="px-4 py-3">Student No.</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Curriculum</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, index) => (
              <StudentRowSkeleton key={index} selectMode={selectMode} />
            ))}
          </tbody>
        </table>
        </div>
      </div>
    );
  }

  if (!students || students.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-slate-700">No students found</p>
        <p className="mt-1 text-sm text-slate-500">This {isBatch ? 'batch' : 'folder'} has no matching archived records.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-blue-500 text-white">
          <tr className="text-left text-xs uppercase tracking-wide">
            {selectMode ? (
              <th className="px-4 py-3 w-12">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/60 text-blue-600 focus:ring-blue-300"
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
              <th className="px-4 py-3 w-12">No.</th>
            )}
            {[
              ['studentNumber', 'STUDENT NO.'],
              ['name', 'NAME'],
              ['curriculum', 'CURRICULUM'],
            ].map(([key, label]) => (
              <th key={key} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onSort(key)}
                  className="inline-flex items-center gap-1 transition hover:text-blue-100"
                >
                  {label}
                  <SortIcon active={sortBy === key} direction={sortDir} />
                </button>
              </th>
            ))}
            <th className="px-4 py-3 text-right">Actions</th>
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
                className="cursor-pointer border-b border-slate-100 transition last:border-b-0 hover:bg-blue-50/60"
                onClick={() => onViewStudent(student)}
              >
                {selectMode ? (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-300"
                      checked={selectedIds.includes(student.id)}
                      onChange={() => onToggleSelect(student.id)}
                    />
                  </td>
                ) : (
                  <td className="px-4 py-3 text-center text-slate-500">{index + 1}</td>
                )}
                <td className="px-4 py-3 font-medium text-slate-700">{student.studentNumber || '-'}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{student.name}</td>

                <td className="px-4 py-3 text-slate-600">
                  {curriculums[student.curriculumId] || student.curriculumId || ''}
                </td>
               

                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnarchiveStudent(student);
                    }}
                              className="p-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                    title="Unarchive student"
                  >
                    <ArchiveRestore className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteStudent(student);
                    }}
                    className="ml-2 rounded-full bg-gray-100 p-1.5 text-gray-600 transition hover:bg-red-50 hover:text-red-600"
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
                          <thead className="bg-blue-500 text-xs uppercase text-white tracking-wide">
                            <tr className="text-xs  uppercase">
                              <th className="px-4 py-2 text-left">Code</th>
                              <th className="px-4 py-2 text-left">Description</th>
                              <th className="px-4 py-2 text-left">Units</th>
                              <th className="px-4 py-2 text-left">Prerequisites</th>
                              <th className="px-4 py-2 text-center">Status</th>
                              <th className="px-4 py-2 text-right">Grade</th>
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
                                  <td className="px-4 py-2 text-gray-700">{code}</td>
                                  <td className="px-4 py-2 text-gray-700">{course.courseTitle || ''}</td>
                                  <td className="px-4 py-2 text-gray-700">{units}</td>
                                  <td className="px-4 py-2 text-gray-700">{prereqs || ''}</td>
                                  <td className="px-4 py-2 text-center text-xs">
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
   <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
  <div className="flex max-h-[86vh] min-h-[70vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-9 py-4 rounded-t-2xl bg-slate-100">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Archived student record</p>
        <div className="mt-1 text-xl font-semibold text-slate-900">{student.name}</div>
        <div className="mt-1 text-sm text-slate-500">
          {student.studentNumber} · {curriculums?.[student.curriculumId] || student.curriculumId}
        </div>
      </div>
      <div>
        <button
          onClick={onClose}
          className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
          aria-label="Close student details"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>

      <div className="flex-1 overflow-hidden px-6 py-5">
  <div className="mb-4 flex flex-wrap gap-1.5">
      {[1, 2, 3, 4].map((year) => (
        <button
          key={year}
          onClick={() => setTab(String(year))}
              className={`rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
              tab === String(year) 
              ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'
              }`}
        >
          {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year
        </button>
      ))}
     
    </div>

    <div className="max-h-[58vh] overflow-y-auto pr-2">
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
    <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Create New Folder</h3>
          <p className="mt-1 text-sm text-slate-500">Organize archived classes into a named folder.</p>
        </div>

        <div className="px-6 py-5">
        <input
          value={newFolder}
          onChange={(e) => setNewFolder(e.target.value)}
          placeholder="Folder name (e.g., Batch 2026)"
          className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-600 bg-white hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={onCreate}
            disabled={!newFolder.trim() || creating}
            className="px-4 py-1.5 w-24 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
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
    <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Unarchive Student</h3>
          <p className="mt-1 text-sm text-slate-500">
            Choose where {student.name || 'this student'} should appear in Student Management.
          </p>
        </div>

        <div className="space-y-4 px-8 py-4 flex items-start gap-2">
          <div className="flex-2">
            <label className="block text-sm font-medium text-slate-600 mb-1">Year Level</label>
            <select
              value={year || 1}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
            >
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  {value === 1 ? '1st' : value === 2 ? '2nd' : value === 3 ? '3rd' : '4th'} Year
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-600 mb-1">Block</label>
            <input
  type="text"
  value={block || ""}
  onChange={(e) => {
    // Letters only + automatic uppercase + single character only
    const value = e.target.value
      .replace(/[^A-Za-z]/g, "") // remove non-letters
      .toUpperCase() // auto uppercase
      .slice(0, 1); // only 1 letter

    setBlock(value);
  }}
  placeholder="Enter Block"
  className="w-full border text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
/>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-600 bg-white hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={saving}
            className="px-4 py-1.5 w-28 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Restoring...' : 'Unarchive'}
          </button>
        </div>
      </div>
    </div>
  );
};

const BulkUnarchiveConfirmModal = ({
  count,
  year,
  block,
  setYear,
  setBlock,
  saving,
  onClose,
  onConfirm,
}) => {
  if (!count) return null;

  return (
    <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Unarchive {count} student{count === 1 ? '' : 's'}?
            </h3>
           
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close confirmation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-4">
           <p className="mb-4 text-sm text-slate-500">
              Choose where the selected students should appear in Student Management.
            </p>

          <div className="mb-4 flex items-start gap-2">
            <div className="flex-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Year Level</label>
              <select
                value={year || 1}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
              >
                {[1, 2, 3, 4].map((value) => (
                  <option key={value} value={value}>
                    {value === 1 ? '1st' : value === 2 ? '2nd' : value === 3 ? '3rd' : '4th'} Year
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-600 mb-1">Block</label>
              <input
                type="text"
                value={block || ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 1);
                  setBlock(value);
                }}
                placeholder="Enter Block"
                className="w-full border text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
              />
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            This keeps the student records and removes them from this archive after restoration.
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-600 bg-white hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || !block}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-500 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
          >
            <ArchiveRestore className="h-4 w-4" />
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
    <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          </div>
       
        </div>

        <div className="px-8 py-4">
          <p className="text- text-slate-600">
           Please confirm before permanently deleting archived data. This will permanently remove <span className="font-medium text-slate-900">{name}</span> from archived classes. This action cannot be undone.
          </p>
         
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-600 bg-white hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
                className="px-4 py-1.5 w-24 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Deleting...' : 'Delete'}
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
  const [search, setSearch] = useState('');
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
  const [bulkUnarchiveOpen, setBulkUnarchiveOpen] = useState(false);
  const [bulkUnarchiveYear, setBulkUnarchiveYear] = useState(1);
  const [bulkUnarchiveBlock, setBulkUnarchiveBlock] = useState('A');
  
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

  const totalArchivedStudents = useMemo(
    () => archives.reduce((sum, archive) => sum + (archive.students || []).length, 0),
    [archives]
  );

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

  const openBulkUnarchiveModal = () => {
    if (selectedIds.length === 0) return;
    const firstSelected = (selectedItem?.students || []).find((student) => selectedIds.includes(student.id));
    setBulkUnarchiveYear(Number(firstSelected?.yearLevel) || 1);
    setBulkUnarchiveBlock((firstSelected?.block || 'A').toString().trim().toUpperCase().slice(0, 1) || 'A');
    setBulkUnarchiveOpen(true);
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
    const targetBlock = (bulkUnarchiveBlock || '').toString().trim().toUpperCase().slice(0, 1);
    if (!targetBlock) return;
    
    setUnarchiving(true);
    try {
      const selectedStudents = (selectedItem?.students || []).filter(student => 
        selectedIds.includes(student.id)
      );
      
      // Restore all selected students to default year/block
      const restorePromises = selectedStudents.map(async (student) => {
        const restoredStudent = {
          ...student,
          yearLevel: Number(bulkUnarchiveYear) || 1,
          block: targetBlock,
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
          count: selectedIds.length,
          yearLevel: Number(bulkUnarchiveYear) || 1,
          block: targetBlock
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
      setBulkUnarchiveOpen(false);
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
      setSuccess(`${unarchiveTarget.name || 'Student'} successfully unarchived.`);
    } catch (err) {
      alert(`Failed to unarchive student: ${err.message}`);
    } finally {
      setUnarchiving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Archived Classes', onClick: selectedItem ? () => setSelectedItem(null) : null },
          ...(selectedItem ? [{ label: selectedItem.type === 'batch' ? `Batch ${selectedItem.name}` : selectedItem.name || selectedItem.id }] : [])
        ]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {selectedItem ? selectedItem.name || selectedItem.id : 'Archived Classes'}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            {selectedItem
              ? `${filteredSelectedStudents.length} archived record${filteredSelectedStudents.length === 1 ? '' : 's'} in this archive.`
              : 'Browse archived class folders and batches, then restore or permanently remove past student records.'}
          </p>
          {success && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </div>
          )}
        </div>
        {!selectedItem && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600"
          >
            <BadgePlus className="w-4 h-4" />
            Create Batch / Folder
          </button>
        )}
      </div>

      {!selectedItem && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Folders</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{folders.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Batches</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{batches.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Archived Students</p>
            <p className="mt-1 text-2xl font-semibold text-blue-700">{totalArchivedStudents}</p>
          </div>
        </div>
      )}

      <div>
            {selectedItem && (
              <>

                <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
               
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
className="w-full min-w-64 border text-sm border-slate-200 bg-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                  />
                </div>
                
                </div>

                  <div className="flex flex-wrap items-center gap-2">
                 
                   <button
                  type="button"
                  onClick={() => {
                    const next = !selectMode;
                    setSelectMode(next);
                    if (!next) setSelectedIds([]);
                  }}
                  title={selectMode ? 'Turn off selection' : 'Select students'}
                 className={`inline-flex items-center gap-2 rounded-lg border p-2 text-sm transition cursor-pointer
${selectMode 
? 'bg-blue-50 text-blue-600 border-blue-300'
: 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
}`}
                >
                  <Square className="w-4 h-4" />
                  <span className="text-xs">Select</span>
                </button>

                {selectMode && selectedIds.length > 0 && (
                  <>
                    <button
                      onClick={openBulkUnarchiveModal}
                      disabled={unarchiving}
                      className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                      title={`Unarchive ${selectedIds.length} selected student${selectedIds.length > 1 ? 's' : ''}`}
                    >
                      <ArchiveRestore className="w-4 h-4" />
                    </button>
                    <button
                      onClick={openDeleteSelectedModal}
                      disabled={deleting}
                      className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title={`Delete ${selectedIds.length} selected archived record${selectedIds.length > 1 ? 's' : ''}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                
                 </div>

            
                </div>
                
              
                      
              </>
            )}
            
          </div>

       {/* GRID */}
      {!selectedItem && (
        loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="m-4 h-4 w-2/3 rounded bg-slate-200" />
                <div className="mx-4 mt-3 h-3 w-1/3 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : (
          <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search folders or batches..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full border text-sm border-slate-200 bg-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
              />
            </div>
            <p className="text-sm text-slate-500">{allItems.length} archive{allItems.length === 1 ? '' : 's'} shown</p>
          </div>
          {allItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">No archived classes found</p>
              <p className="mt-1 text-sm text-slate-500">Create a folder or adjust your search to continue.</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
          )}
          </>
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
      <BulkUnarchiveConfirmModal
        count={bulkUnarchiveOpen ? selectedIds.length : 0}
        year={bulkUnarchiveYear}
        block={bulkUnarchiveBlock}
        setYear={setBulkUnarchiveYear}
        setBlock={setBulkUnarchiveBlock}
        saving={unarchiving}
        onClose={() => setBulkUnarchiveOpen(false)}
        onConfirm={handleBulkUnarchive}
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
