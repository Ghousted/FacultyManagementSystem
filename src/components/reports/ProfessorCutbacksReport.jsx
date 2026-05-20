import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { ArrowBigLeft, Download, UserRound, Search, RefreshCw, Settings2, ChevronUp, ChevronDown, ChevronsUpDown, X, CalendarClock } from 'lucide-react';
import {
  getProfessors,
  getActiveTerm,
  getStudentsForCourse
} from '../../models/facultyModels';
import { getStudents } from '../../models/curriculumModels';
import {
  getCutbackRate,
  saveCutbackRate,
  getCutbackDeadline,
  saveCutbackDeadline,
  getAllModulePayables,
  getPaymentsByPayableId
} from '../../models/payablesModels';
import { getOfferedModules } from '../../models/payablesModels';
import {
  exportSingleProfessorCutbacksToExcel,
  exportAllProfessorCutbacksToExcel
} from '../../utils/excelExport';
import Breadcrumbs from '../common/Breadcrumbs';

const FilenameModal = ({ isOpen, onClose, onConfirm, defaultName }) => {
  const [name, setName] = useState(defaultName);

  useEffect(() => setName(defaultName), [defaultName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-3xl shadow-2xl w-96 max-w-full">
        <h3 className="text-lg font-bold text-blue-700">Export to Excel</h3>
        <p className="text-sm text-gray-600 mb-4">Enter a filename for the export.</p>
        <div className="flex items-center">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 border border-gray-300 rounded-l-lg px-3 py-1.5 text-sm focus:outline-none"
          />
          <span className="px-3 py-1.5 text-sm bg-gray-100 border border-gray-300 border-l-0 rounded-r-lg">.xlsx</span>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm((name || defaultName).trim())}
            className="px-6 py-1.5 rounded-full cursor-pointer text-sm bg-blue-600 text-white hover:bg-blue-700"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
};

const SettingsModal = ({ isOpen, onClose, currentRate, currentDeadline, onSave, isSaving }) => {
  const [rateValue, setRateValue] = useState(currentRate);
  const [deadlineValue, setDeadlineValue] = useState(currentDeadline);

  useEffect(() => {
    setRateValue(currentRate);
    setDeadlineValue(currentDeadline);
  }, [currentRate, currentDeadline, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-3xl shadow-2xl w-[26rem] max-w-full">
        <h3 className="text-xl font-bold text-blue-700 mb-2">Configure Cutback</h3>
        <p className="text-sm text-gray-600 mb-4">
          Cutback is added per student who fully pays for the professor's module on or before the deadline.
        </p>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Rate per paid student</label>
        <div className="flex items-center mb-4">
          <span className="px-3 py-1.5 text-sm bg-gray-100 border border-gray-300 border-r-0 rounded-l-lg">PHP</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={rateValue}
            onChange={e => setRateValue(e.target.value)}
            className="flex-1 border border-gray-300 rounded-r-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Payment deadline</label>
        <div className="flex items-center gap-2 mb-1">
          <input
            type="date"
            value={deadlineValue || ''}
            onChange={e => setDeadlineValue(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          {deadlineValue && (
            <button
              type="button"
              onClick={() => setDeadlineValue('')}
              className="px-3 py-1.5 rounded-lg text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Leave empty to count every fully-paid student. Otherwise, students whose last module payment lands after this date are excluded.
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-xl text-sm bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ rate: rateValue, deadline: deadlineValue })}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-xl text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Build a map of (payableId|studentId) -> latest payment ISO date by scanning the
// studentPayments collection. Used to back-fill `lastPaymentDate` for payments that
// were recorded before the field was introduced.
const buildLatestPaymentDateMap = async () => {
  const map = new Map();
  try {
    const snap = await getDocs(collection(db, 'studentPayments'));
    snap.docs.forEach(d => {
      const p = d.data() || {};
      const key = `${p.payableId}|${p.studentId}`;
      const ts = p.date || p.createdAt || p.updatedAt;
      if (!ts) return;
      const existing = map.get(key);
      if (!existing || new Date(ts).getTime() > new Date(existing).getTime()) {
        map.set(key, ts);
      }
    });
  } catch (err) {
    console.warn('Failed to load studentPayments for date back-fill:', err);
  }
  return map;
};

const normalizeCode = (code) => (code || '').toString().trim().toUpperCase();
const isIrregularStudent = (student) => {
  const value = student?.isIrregular;
  if (value === true) return true;
  if (typeof value === 'string') {
    return ['true', 'yes', '1'].includes(value.trim().toLowerCase());
  }
  return false;
};

const findOfferedModule = (course, offeredModules) => {
  const courseCode = normalizeCode(course.courseCode);
  return (offeredModules || []).find((m) => {
    if (m.id && course.subjectId && m.id === course.subjectId) return true;
    if (m.id && course.courseId && m.id === course.courseId) return true;
    if (normalizeCode(m.courseCode) !== courseCode) return false;
    if (course.semester && m.semester && Number(m.semester) !== Number(course.semester)) return false;
    if (course.yearLevel && m.yearLevel && Number(m.yearLevel) !== Number(course.yearLevel)) return false;
    return true;
  }) || null;
};

const findModulePayable = (course, modulePayables, term) => {
  return findModulePayables(course, modulePayables, term)[0] || null;
};

const findModulePayables = (course, modulePayables, term) => {
  const isOtherDepartment = course?.source === 'other-department';
  const sem = Number(term?.semester) || 0;
  const sy = (term?.schoolYear || '').toString();
  const courseCode = normalizeCode(course.courseCode);
  const candidates = modulePayables.filter(p => {
    if (isOtherDepartment && p.source !== 'other-department') return false;
    if (!isOtherDepartment && p.source === 'other-department') return false;
    if (sem && p.semester && Number(p.semester) !== sem) return false;
    if (sy && p.schoolYear && (p.schoolYear || '') !== sy) return false;
    return true;
  });

  if (isOtherDepartment) {
    return candidates.filter(p => {
      if (p.departmentId && course.departmentId && p.departmentId !== course.departmentId) return false;
      if (p.moduleId && course.subjectId && p.moduleId !== course.subjectId) return false;
      if (normalizeCode(p.moduleCode) !== courseCode) return false;
      const targetCourse = (p.targetCourse || '').toString().trim().toLowerCase();
      const classCourse = (course.classCourse || '').toString().trim().toLowerCase();
      if (targetCourse && classCourse && targetCourse !== classCourse) return false;
      const targetYear = (p.targetYearLevel || '').toString().trim();
      if (targetYear && Number(targetYear) !== Number(course.yearLevel)) return false;
      const targetBlocks = Array.isArray(p.targetBlocks)
        ? p.targetBlocks
        : (p.targetBlock ? [p.targetBlock] : []);
      const normalizedTargets = targetBlocks.map(b => b.toString().trim().toUpperCase()).filter(Boolean);
      const handledBlocks = Array.isArray(course.blocks)
        ? course.blocks.map(b => b.toString().trim().toUpperCase()).filter(Boolean)
        : [];
      if (normalizedTargets.length > 0 && handledBlocks.length > 0) {
        return normalizedTargets.some(block => handledBlocks.includes(block));
      }
      return true;
    });
  }

  const byId = candidates.filter(p => p.moduleId && p.moduleId === course.courseId);
  if (byId.length > 0) return byId;
  return candidates.filter(p => {
      if (normalizeCode(p.moduleCode) !== courseCode) return false;
      return true;
    });
};

const getOtherDeptPaymentsByPayableId = async (payableId) => {
  try {
    if (!payableId) return { success: true, data: {} };
    const q = query(collection(db, 'otherDept-payment'), where('payableId', '==', payableId));
    const snap = await getDocs(q);
    const grouped = {};
    snap.docs.forEach((d) => {
      const p = { id: d.id, ...(d.data() || {}) };
      const sid = p.studentId || '';
      if (!sid) return;
      const current = grouped[sid] || {
        studentId: sid,
        paidAmount: 0,
        voucherAmount: 0,
        lastPaymentDate: null,
        status: 'unpaid'
      };
      const paidAmount = Number(p.amount || p.paidAmount || 0);
      const voucherAmount = Number(p.voucherAmount || 0);
      const paymentDate = p.lastPaymentDate || p.date || p.createdAt || p.updatedAt || null;
      grouped[sid] = {
        ...current,
        ...p,
        studentId: sid,
        paidAmount: Number(current.paidAmount || 0) + paidAmount,
        voucherAmount: Number(current.voucherAmount || 0) + voucherAmount,
        lastPaymentDate: !current.lastPaymentDate || (paymentDate && new Date(paymentDate).getTime() > new Date(current.lastPaymentDate).getTime())
          ? paymentDate
          : current.lastPaymentDate
      };
    });
    return { success: true, data: grouped };
  } catch (error) {
    console.error('Error getting other department payments by payableId:', error);
    return { success: false, error: error.message };
  }
};

const getPaymentsForPayable = (payable) => (
  payable?.source === 'other-department'
    ? getOtherDeptPaymentsByPayableId(payable.id)
    : getPaymentsByPayableId(payable.id)
);

const mergeStudentPayments = (payable, collectionPayments = {}) => {
  const merged = { ...(payable?.studentPayments || {}) };
  Object.entries(collectionPayments || {}).forEach(([studentId, entry]) => {
    const existing = merged[studentId] || {};
    const collectionPaid = Number(entry?.totalPaidAfter ?? entry?.paidAmount ?? entry?.amount ?? 0);
    const existingPaid = Number(existing?.paidAmount || 0);
    merged[studentId] = {
      ...existing,
      ...entry,
      paidAmount: Math.max(existingPaid, collectionPaid),
      voucherAmount: Math.max(Number(existing?.voucherAmount || 0), Number(entry?.voucherAmount || 0)),
      lastPaymentDate: entry?.lastPaymentDate || existing?.lastPaymentDate || null,
      status: entry?.status || existing?.status || 'unpaid'
    };
  });
  return merged;
};

const findStudentPaymentEntry = (studentPayments, student) => {
  if (!studentPayments || !student) return null;
  if (studentPayments[student.id]) return studentPayments[student.id];
  const studentNumber = (student.studentNumber || student.studentNo || '').toString().trim();
  const found = Object.values(studentPayments).find(entry => {
    const entryNumber = (entry.studentNumber || entry.studentNo || entry.studentId || '').toString().trim();
    return entryNumber && studentNumber && entryNumber === studentNumber;
  });
  return found || null;
};

const isStudentFullyPaid = (payable, studentPaymentEntry) => {
  if (!studentPaymentEntry) return false;
  const amount = Number(payable?.amount) || 0;
  const paid = Number(studentPaymentEntry?.paidAmount) || 0;
  const voucher = Number(studentPaymentEntry?.voucherAmount) || 0;
  if (amount > 0) return (paid + voucher) >= amount;
  return studentPaymentEntry.status === 'fully_paid';
};

const resolvePaymentDate = (entry, payableId, studentId, dateMap) => {
  const direct = entry?.lastPaymentDate;
  if (direct) return direct;
  return dateMap.get(`${payableId}|${studentId}`) || null;
};

const isWithinDeadline = (entry, payableId, studentId, dateMap, deadlineCutoff) => {
  if (deadlineCutoff === null) return true;
  const paidAt = resolvePaymentDate(entry, payableId, studentId, dateMap);
  const paidTs = paidAt ? new Date(paidAt).getTime() : NaN;
  return Number.isFinite(paidTs) && paidTs <= deadlineCutoff;
};

const buildStudentLookups = (students = []) => {
  const byId = new Map();
  const byNumber = new Map();
  students.forEach((student) => {
    if (student.id) byId.set(student.id, student);
    const number = (student.studentNumber || student.studentNo || '').toString().trim();
    if (number) byNumber.set(number, student);
  });
  return { byId, byNumber };
};

const getStudentForPayment = (studentId, entry, studentLookups) => {
  const byId = studentLookups?.byId || new Map();
  const byNumber = studentLookups?.byNumber || new Map();
  if (byId.has(studentId)) return byId.get(studentId);
  const number = (entry?.studentNumber || entry?.studentNo || '').toString().trim();
  if (number && byNumber.has(number)) return byNumber.get(number);
  return null;
};

const getPaymentBlock = (student, entry) => (
  student?.block ||
  entry?.block ||
  entry?.studentBlock ||
  ''
).toString().trim().toUpperCase();

const isPaymentInHandledBlocks = (course, student, entry) => {
  if (isIrregularStudent(student) || isIrregularStudent(entry)) return true;
  const allowedBlocks = Array.isArray(course?.blocks)
    ? course.blocks.map((block) => block.toString().trim().toUpperCase()).filter(Boolean)
    : [];
  if (allowedBlocks.length === 0) return true;
  const block = getPaymentBlock(student, entry);
  return !block || allowedBlocks.includes(block);
};

const buildPaidStudentRows = ({ course, payable, studentPayments, studentLookups, dateMap, deadlineCutoff }) => {
  const amountRequired = Number(payable?.amount || 0);
  return Object.entries(studentPayments || {})
    .map(([studentId, entry]) => {
      const student = getStudentForPayment(studentId, entry, studentLookups);
      if (!isPaymentInHandledBlocks(course, student, entry)) return null;
      if (!isStudentFullyPaid(payable, entry)) return null;
      if (!isWithinDeadline(entry, payable?.id, student?.id || studentId, dateMap, deadlineCutoff)) return null;

      const paidAmount = Number(entry?.paidAmount || 0) + Number(entry?.voucherAmount || 0);
      const paymentDate = resolvePaymentDate(entry, payable?.id, student?.id || studentId, dateMap);
      return {
        id: student?.id || studentId,
        name: student?.name || entry?.studentName || entry?.name || '(student record not found)',
        studentNumber: student?.studentNumber || student?.studentNo || entry?.studentNumber || entry?.studentNo || studentId,
        block: getPaymentBlock(student, entry) || 'N/A',
        isIrregular: isIrregularStudent(student),
        status: 'PAID',
        paidAmount,
        amountRequired,
        paymentDate,
        withinDeadline: true,
        entry
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

const ProfessorCutbacksReport = ({ embedded = false }) => {
  const [loading, setLoading] = useState(true);
  const [professors, setProfessors] = useState([]);
  const [activeTerm, setActiveTerm] = useState({ semester: 1, schoolYear: '' });
  const [rate, setRate] = useState(50);
  const [deadline, setDeadline] = useState('');
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [selectedProfessor, setSelectedProfessor] = useState(null);
  const [selectedProfessorDetail, setSelectedProfessorDetail] = useState(null);
  const [selectedProfessorLoading, setSelectedProfessorLoading] = useState(false);
  const [selectedProfessorError, setSelectedProfessorError] = useState('');
  const [modulePayables, setModulePayables] = useState([]);
  const [offeredModules, setOfferedModules] = useState([]);
  const [studentLookups, setStudentLookups] = useState(buildStudentLookups());
  const [paymentDateMap, setPaymentDateMap] = useState(new Map());
  const [error, setError] = useState('');
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [filenameModal, setFilenameModal] = useState({ open: false, mode: 'all', target: null });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profsRes, termRes, rateRes, deadlineRes] = await Promise.all([
        getProfessors(),
        getActiveTerm(),
        getCutbackRate(),
        getCutbackDeadline()
      ]);
      if (!profsRes.success) throw new Error(profsRes.error || 'Failed to load professors.');
      const term = termRes.success ? termRes.data : { semester: 1, schoolYear: '' };
      const ratePerStudent = rateRes.success ? rateRes.data : 50;
      const dl = deadlineRes.success ? deadlineRes.data : '';
      setActiveTerm(term);
      setRate(ratePerStudent);
      setDeadline(dl);

      const [offeredRes, modulePayablesRes, otherPayablesSnap, studentsRes, otherStudentsSnap, dateMap] = await Promise.all([
        getOfferedModules(term),
        getAllModulePayables(term),
        getDocs(collection(db, 'otherDept-payables')),
        getStudents(),
        getDocs(collection(db, 'otherDept-Students')),
        buildLatestPaymentDateMap()
      ]);
      const ccsModulePayables = modulePayablesRes.success ? modulePayablesRes.data : [];
      const otherModulePayables = otherPayablesSnap.docs
        .map(d => ({ id: d.id, ...d.data(), source: 'other-department' }))
        .filter(p => p.category === 'module' && !p.deleted);
      const modulePayables = [...ccsModulePayables, ...otherModulePayables];
      const offered = offeredRes.success ? offeredRes.data : [];
      const otherStudents = otherStudentsSnap.docs.map(d => ({ id: d.id, ...d.data(), source: 'other-department' }));
      const lookups = buildStudentLookups([
        ...(studentsRes.success ? studentsRes.data : []),
        ...otherStudents
      ]);
      setModulePayables(modulePayables);
      setOfferedModules(offered);
      setStudentLookups(lookups);
      setPaymentDateMap(dateMap);

      // Deadline boundary: end of the deadline day in local time.
      const deadlineCutoff = dl ? new Date(`${dl}T23:59:59.999`).getTime() : null;

      const enriched = await Promise.all(
        profsRes.data.map(async (p) => {
          const assignments = p.assignedCourses || [];
          const classes = await Promise.all(
            assignments.map(async (c) => {
              const res = await getStudentsForCourse(c, term);
              const students = res.success ? res.data : [];
              const studentCount = students.length;

              const matchingPayables = findModulePayables(c, modulePayables, term);
              const payable = matchingPayables[0] || null;
              const offeredModule = findOfferedModule(c, offered);
              const hasPayable = matchingPayables.length > 0 && !!offeredModule;
              let paidCount = 0;
              let lateCount = 0;
              let unpaidCount = 0;

              if (hasPayable) {
                const paidRowsByStudent = new Map();
                await Promise.all(matchingPayables.map(async (matchedPayable) => {
                  const paymentsRes = await getPaymentsForPayable(matchedPayable);
                  const studentPayments = mergeStudentPayments(matchedPayable, paymentsRes.success ? paymentsRes.data : {});
                  const paidRows = buildPaidStudentRows({
                    course: c,
                    payable: matchedPayable,
                    studentPayments,
                    studentLookups: lookups,
                    dateMap,
                    deadlineCutoff
                  });
                  paidRows.forEach((row) => {
                    if (!paidRowsByStudent.has(row.id)) paidRowsByStudent.set(row.id, row);
                  });
                }));
                paidCount = paidRowsByStudent.size;
                unpaidCount = Math.max(0, studentCount - paidCount);
              } else {
                unpaidCount = studentCount;
              }

              return {
                ...c,
                courseId: c.courseId,
                courseCode: c.courseCode,
                courseTitle: c.courseTitle,
                yearLevel: c.yearLevel,
                blocks: c.blocks || [],
                source: c.source || 'ccs',
                studentCount,
                paidCount,
                lateCount,
                unpaidCount,
                hasPayable,
                offeredModuleId: offeredModule?.id || '',
                payableId: payable?.id || '',
                payableAmount: payable ? Number(payable.amount) || 0 : 0
              };
            })
          );
          return { ...p, classes };
        })
      );
      setProfessors(enriched);
    } catch (e) {
      setError(e.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const fetchProfessorDetail = useCallback(async (prof) => {
    if (!prof) return;
    setSelectedProfessorDetail(null);
    setSelectedProfessorLoading(true);
    setSelectedProfessorError('');
    try {
      const deadlineCutoff = deadline ? new Date(`${deadline}T23:59:59.999`).getTime() : null;
      const payableClasses = (prof.classes || []).filter((course) => course.hasPayable);
      const classDetails = await Promise.all(payableClasses.map(async (course) => {
        const matchingPayables = findModulePayables(course, modulePayables, activeTerm);
        const payable = matchingPayables[0] || null;
        const offeredModule = findOfferedModule(course, offeredModules);
        const rowsByStudent = new Map();
        if (matchingPayables.length > 0 && offeredModule) {
          await Promise.all(matchingPayables.map(async (matchedPayable) => {
            const paymentsRes = await getPaymentsForPayable(matchedPayable);
            const studentPayments = mergeStudentPayments(matchedPayable, paymentsRes.success ? paymentsRes.data : {});
            const rows = buildPaidStudentRows({
              course,
              payable: matchedPayable,
              studentPayments,
              studentLookups,
              dateMap: paymentDateMap,
              deadlineCutoff
            });
            rows.forEach((row) => {
              if (!rowsByStudent.has(row.id)) rowsByStudent.set(row.id, row);
            });
          }));
        }

        const groupedStudents = Array.from(rowsByStudent.values())
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        const totalPaid = groupedStudents.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
        const totalBalance = groupedStudents.reduce((sum, s) => sum + Math.max(0, Number(s.amountRequired || 0) - Number(s.paidAmount || 0)), 0);
        const paidCount = groupedStudents.filter(s => s.status === 'PAID').length;
        const partialCount = groupedStudents.filter(s => s.status === 'PARTIAL').length;
        const unpaidCount = groupedStudents.filter(s => s.status === 'UNPAID').length;

        return {
          ...course,
          students: groupedStudents,
          totalPaid,
          totalBalance,
          paidCount,
          partialCount,
          unpaidCount,
          hasPayable: matchingPayables.length > 0 && !!offeredModule,
          payable,
          amountRequired: Number(payable?.amount || 0)
        };
      }));
      setSelectedProfessorDetail({ ...prof, classes: classDetails });
    } catch (err) {
      setSelectedProfessorError(err.message || 'Failed to load professor details.');
    } finally {
      setSelectedProfessorLoading(false);
    }
  }, [activeTerm, deadline, modulePayables, offeredModules, paymentDateMap, studentLookups]);

  // Only count paid students for classes that have an associated payable (offered modules)
  const getPaidStudents = (prof) => (prof.classes || []).reduce((sum, c) => sum + ((c.hasPayable ? (c.paidCount || 0) : 0)), 0);
  const getHandledClassCount = (prof) => (prof.classes || []).length;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? professors.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.employeeId || '').toLowerCase().includes(q)
    ) : professors;

    return [...list].sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      if (sortConfig.key === 'classCount') return (getHandledClassCount(a) - getHandledClassCount(b)) * dir;
      if (sortConfig.key === 'paidStudents') return (getPaidStudents(a) - getPaidStudents(b)) * dir;
      if (sortConfig.key === 'totalCutback') return ((getPaidStudents(a) * rate) - (getPaidStudents(b) * rate)) * dir;
      return (a[sortConfig.key] || '').toString().localeCompare((b[sortConfig.key] || '').toString()) * dir;
    });
  }, [professors, search, sortConfig, rate]);

  const grandTotals = useMemo(() => {
    let paidStudents = 0;
    rows.forEach(p => {
      (p.classes || []).forEach(c => { if (c.hasPayable) paidStudents += c.paidCount || 0; });
    });
    return {
      paidStudents,
      totalCutback: paidStudents * rate
    };
  }, [rows, rate]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <ChevronsUpDown className="h-3.5 w-3.5 opacity-70" />;
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5" />
      : <ChevronDown className="h-3.5 w-3.5" />;
  };

  const handleSaveSettings = async ({ rate: nextRate, deadline: nextDeadline }) => {
    setSavingSettings(true);
    try {
      const rateRes = await saveCutbackRate(nextRate);
      if (!rateRes.success) throw new Error(rateRes.error || 'Failed to save rate.');
      const deadlineRes = await saveCutbackDeadline(nextDeadline || '');
      if (!deadlineRes.success) throw new Error(deadlineRes.error || 'Failed to save deadline.');
      setRate(rateRes.data);
      setDeadline(deadlineRes.data);
      setSettingsModalOpen(false);
      await loadAll();
    } catch (e) {
      setError(e.message || 'Failed to save cutback settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const openExportAll = () => setFilenameModal({ open: true, mode: 'all', target: null });
  const openExportSingle = (prof) => setFilenameModal({ open: true, mode: 'single', target: prof });

  const handleExportConfirm = (filename) => {
    const safeName = filename || 'professor_cutbacks';
    if (filenameModal.mode === 'all') {
      exportAllProfessorCutbacksToExcel(rows, rate, `${safeName}.xlsx`, { deadline });
    } else if (filenameModal.target) {
      exportSingleProfessorCutbacksToExcel(filenameModal.target, rate, `${safeName}.xlsx`, { deadline });
    }
    setFilenameModal({ open: false, mode: 'all', target: null });
  };

  return (
    <div>
      {!embedded && (
        <Breadcrumbs items={[{ label: 'Professor Cutbacks' }]} />
      )}

   

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

      {!selectedProfessor && !loading && rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Professors</p>
            <p className="text-2xl font-semibold text-gray-800">{rows.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Paid Students (on time)</p>
            <p className="text-2xl font-semibold text-gray-800">{grandTotals.paidStudents}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Total Cutbacks</p>
            <p className="text-2xl font-semibold text-emerald-700">PHP {grandTotals.totalCutback.toFixed(2)}</p>
          </div>
        </div>
      )}

      

      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-stretch sm:items-center justify-between">
  <div className="flex gap-2 items-center flex-1">
    <button
      onClick={loadAll}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 p-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 cursor-pointer"
      title="Reload"
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
        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
    </div>
  </div>

  <div className="flex gap-2 flex-wrap">
    <button
      onClick={() => setSettingsModalOpen(true)}
      className="rounded-lg text-sm px-4 py-2 cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-semibold shadow flex items-center gap-2"
    >
      <Settings2 className="h-4 w-4" /> Rate: PHP {rate.toFixed(2)}
      {deadline && (
        <span className="inline-flex items-center gap-1 ml-1 pl-2 border-l border-blue-400 text-xs">
          <CalendarClock className="h-3.5 w-3.5" /> {deadline}
        </span>
      )}
    </button>

    <button
      onClick={openExportAll}
      disabled={loading || rows.length === 0}
      className="rounded-lg text-sm px-4 py-2 cursor-pointer bg-green-500 hover:bg-green-600 text-white font-semibold shadow flex items-center gap-2 disabled:opacity-50"
    >
      <Download className="h-4 w-4" /> Export All
    </button>
  </div>
</div>

      {!selectedProfessor && loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {!selectedProfessor && !loading && rows.length === 0 && (
        <div className="py-16 text-center bg-white border border-gray-200 rounded-xl">
          <UserRound className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            {professors.length === 0 ? 'No professors registered.' : 'No professors match your search.'}
          </p>
        </div>
      )}

      {!selectedProfessor && !loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-500 text-white">
              <tr>
                {[
                  ['employeeId', 'Employee ID'],
                  ['name', 'Professor'],
                  ['classCount', 'Classes'],
                  ['paidStudents', 'Paid Students'],
                  ['totalCutback', 'Cutback']
                ].map(([key, label]) => (
                  <th key={key} className="px-4 py-2 text-left font-semibold">
                    <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1">
                      {label}
                      <SortIcon column={key} />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(prof => {
                const paidStudents = getPaidStudents(prof);
                const totalCutback = paidStudents * rate;
                return (
                  <tr
                    key={prof.id}
                    onClick={() => { setSelectedProfessor(prof); fetchProfessorDetail(prof); }}
                    className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-700">{prof.employeeId || '-'}</td>

                    <td className="px-4 py-3 font-semibold text-gray-800">{prof.name}</td>
                    <td className="px-4 py-3 text-gray-700">{getHandledClassCount(prof)}</td>
                    <td className="px-4 py-3 text-gray-700">{paidStudents}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">PHP {totalCutback.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openExportSingle(prof); }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
                      >
                        <Download className="h-3.5 w-3.5" /> Export
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedProfessor && (
        <div className="min-h-screen bg-slate-50 pb-10">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => { setSelectedProfessor(null); setSelectedProfessorDetail(null); setSelectedProfessorError(''); }}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <ArrowBigLeft className="h-4 w-4" /> Back
                </button>
              </div>
              <div className="space-y-1 text-sm">
                <h2 className="text-2xl font-semibold text-slate-900">{selectedProfessor.name}</h2>
                <p className="text-sm text-slate-600">Employee ID: {selectedProfessor.employeeId || '—'}</p>
                <p className="text-sm text-slate-500">
                  {getHandledClassCount(selectedProfessor)} handled class{getHandledClassCount(selectedProfessor) === 1 ? '' : 'es'}
                  {' '}· {(selectedProfessor.classes || []).filter(c => c.hasPayable).length} offered module{(selectedProfessor.classes || []).filter(c => c.hasPayable).length === 1 ? '' : 's'} with payments
                </p>
              </div>
            </div>

            {selectedProfessorLoading ? (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="space-y-4">
                  <div className="h-4 w-1/3 rounded-full bg-gray-200 animate-pulse" />
                  <div className="h-72 rounded-2xl bg-gray-100 animate-pulse" />
                </div>
              </div>
            ) : selectedProfessorError ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">{selectedProfessorError}</div>
            ) : selectedProfessorDetail ? (
              <div className="space-y-8">
                {(selectedProfessorDetail.classes || []).length === 0 && (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                    No offered module payment records found for this professor's handled classes.
                  </div>
                )}
                {(selectedProfessorDetail.classes || []).map((course) => {
                  const regularGroups = course.students.reduce((acc, student) => {
                    if (isIrregularStudent(student)) return acc;
                    const block = (student.block || 'A').toString().toUpperCase() || 'A';
                    if (!acc[block]) acc[block] = [];
                    acc[block].push(student);
                    return acc;
                  }, {});
                  const irregularStudents = course.students.filter(student => isIrregularStudent(student));
                  const classTotal = course.students.length;
                  return (
                    <section key={course.courseId} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-900">{course.courseCode} • {course.courseTitle}</h3>
                          <p className="text-sm text-slate-500">
                            {course.source === 'other-department'
                              ? `${course.departmentName || 'Other Department'} - ${course.classCourse || 'Other'}`
                              : (course.curriculumName || 'CCS Department')}
                            {' '} - Year {course.yearLevel || '-'} - Blocks: {(course.blocks || []).join(', ') || '-'} - {course.amountRequired ? `Amount: PHP ${course.amountRequired.toFixed(2)}` : 'No payable set'}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm text-slate-700 sm:grid-cols-4">
                          <div className="rounded-2xl bg-slate-50 p-3 text-center">
                            <div className="text-xs uppercase text-slate-500">Students</div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">{classTotal}</div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3 text-center">
                            <div className="text-xs uppercase text-slate-500">Paid</div>
                            <div className="mt-1 text-lg font-semibold text-emerald-700">{course.paidCount || 0}</div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3 text-center">
                            <div className="text-xs uppercase text-slate-500">Partial</div>
                            <div className="mt-1 text-lg font-semibold text-amber-700">{course.partialCount || 0}</div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3 text-center">
                            <div className="text-xs uppercase text-slate-500">Unpaid</div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">{course.unpaidCount || 0}</div>
                          </div>
                        </div>
                      </div>

                      {Object.keys(regularGroups).length === 0 && irregularStudents.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-500">No paid students found for this offered module.</div>
                      ) : (
                        <div className="space-y-6">
                          {Object.keys(regularGroups).sort().map((block) => {
                            const students = regularGroups[block];
                            return (
                              <div key={block} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">Block {block}</p>
                                    <p className="text-xs text-slate-500">{students.length} student{students.length === 1 ? '' : 's'}</p>
                                  </div>
                                  <div className="text-right text-xs text-slate-600">Total Paid: PHP {students.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0).toFixed(2)} · Balance: PHP {students.reduce((sum, s) => sum + Math.max(0, Number(s.amountRequired || 0) - Number(s.paidAmount || 0)), 0).toFixed(2)}</div>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-sm text-left">
                                    <thead className="border-b border-slate-200 bg-white text-slate-700">
                                      <tr>
                                        <th className="px-3 py-2">Name</th>
                                        <th className="px-3 py-2">Student No.</th>
                                        <th className="px-3 py-2">Status</th>
                                        <th className="px-3 py-2">Paid</th>
                                        <th className="px-3 py-2">Required</th>
                                        <th className="px-3 py-2">Balance</th>
                                        <th className="px-3 py-2">Paid On</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {students.map((student) => (
                                        <tr key={student.id} className="border-b border-slate-200 last:border-b-0">
                                          <td className="px-3 py-2 text-slate-800">{student.name}</td>
                                          <td className="px-3 py-2 text-slate-600">{student.studentNumber || student.studentNo || student.id}</td>
                                          <td className="px-3 py-2 text-slate-700">{student.status}</td>
                                          <td className="px-3 py-2 text-slate-800">PHP {Number(student.paidAmount || 0).toFixed(2)}</td>
                                          <td className="px-3 py-2 text-slate-800">PHP {Number(student.amountRequired || 0).toFixed(2)}</td>
                                          <td className="px-3 py-2 text-slate-800">PHP {Math.max(0, Number(student.amountRequired || 0) - Number(student.paidAmount || 0)).toFixed(2)}</td>
                                          <td className="px-3 py-2 text-slate-600">{student.paymentDate ? new Date(student.paymentDate).toLocaleDateString() : '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}

                          {irregularStudents.length > 0 && (
                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">Irregular Students</p>
                                  <p className="text-xs text-slate-500">{irregularStudents.length} student{irregularStudents.length === 1 ? '' : 's'}</p>
                                </div>
                                <div className="text-right text-xs text-slate-600">Total Paid: PHP {irregularStudents.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0).toFixed(2)} · Balance: PHP {irregularStudents.reduce((sum, s) => sum + Math.max(0, Number(s.amountRequired || 0) - Number(s.paidAmount || 0)), 0).toFixed(2)}</div>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-sm text-left">
                                  <thead className="border-b border-slate-200 bg-white text-slate-700">
                                    <tr>
                                      <th className="px-3 py-2">Name</th>
                                      <th className="px-3 py-2">Student No.</th>
                                      <th className="px-3 py-2">Status</th>
                                      <th className="px-3 py-2">Paid</th>
                                      <th className="px-3 py-2">Required</th>
                                      <th className="px-3 py-2">Balance</th>
                                      <th className="px-3 py-2">Paid On</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {irregularStudents.map((student) => (
                                      <tr key={student.id} className="border-b border-slate-200 last:border-b-0">
                                        <td className="px-3 py-2 text-slate-800">{student.name}</td>
                                        <td className="px-3 py-2 text-slate-600">{student.studentNumber || student.studentNo || student.id}</td>
                                        <td className="px-3 py-2 text-slate-700">{student.status}</td>
                                        <td className="px-3 py-2 text-slate-800">PHP {Number(student.paidAmount || 0).toFixed(2)}</td>
                                        <td className="px-3 py-2 text-slate-800">PHP {Number(student.amountRequired || 0).toFixed(2)}</td>
                                        <td className="px-3 py-2 text-slate-800">PHP {Math.max(0, Number(student.amountRequired || 0) - Number(student.paidAmount || 0)).toFixed(2)}</td>
                                        <td className="px-3 py-2 text-slate-600">{student.paymentDate ? new Date(student.paymentDate).toLocaleDateString() : '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-700">
                        <div className="rounded-2xl bg-slate-100 px-4 py-3">Total Paid: PHP {course.totalPaid.toFixed(2)}</div>
                        <div className="rounded-2xl bg-slate-100 px-4 py-3">Total Balance: PHP {course.totalBalance.toFixed(2)}</div>
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Select a professor to view handled subjects and payment details.</div>
            )}
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        currentRate={rate}
        currentDeadline={deadline}
        onSave={handleSaveSettings}
        isSaving={savingSettings}
      />

      <FilenameModal
        isOpen={filenameModal.open}
        onClose={() => setFilenameModal({ open: false, mode: 'all', target: null })}
        onConfirm={handleExportConfirm}
        defaultName={
          filenameModal.mode === 'single' && filenameModal.target
            ? `cutbacks_${(filenameModal.target.name || 'professor').replace(/\s+/g, '_')}`
            : 'all_professor_cutbacks'
        }
      />
    </div>
  );
};

export default ProfessorCutbacksReport;

