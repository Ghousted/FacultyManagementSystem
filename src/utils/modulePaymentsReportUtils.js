import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const normalizeCode = (value) => (value || '').toString().trim().toUpperCase();
const normalizeBlock = (value) => (value || '').toString().trim().toUpperCase() || 'A';

const isStudentEnrolledForTerm = (student, activeTerm) => {
  if (!student || student.enrolled === false) return false;
  if (!activeTerm?.semester || !activeTerm?.schoolYear) return student.enrolled !== false;

  const term = student.enrolledTerm || student.createdTerm || null;
  if (!term || (!term.semester && !term.schoolYear)) return student.enrolled === true;

  return (
    Number(term.semester) === Number(activeTerm.semester) &&
    String(term.schoolYear || '').trim() === String(activeTerm.schoolYear || '').trim()
  );
};

const buildOtherDeptReportKey = ({ departmentId, courseId, courseCode, classCourse }) =>
  `other::${departmentId || ''}::${courseId || normalizeCode(courseCode)}::${(classCourse || '').toString().trim().toLowerCase()}`;

const isFullyPaid = (payableAmount, paidAmount, voucherAmount = 0, paymentStatus = '') => {
  const amount = Number(payableAmount) || 0;
  const paid = Number(paidAmount) || 0;
  const voucher = Number(voucherAmount) || 0;
  if (amount > 0) return paid + voucher >= amount;
  return paymentStatus === 'fully_paid' || paid > 0;
};

const findMatchingPayables = (courseKey, modulePayables) => {
  const {
    moduleId,
    courseCode,
    source,
    departmentId,
    classCourse,
    yearLevel
  } = courseKey;

  const code = normalizeCode(courseCode);
  const isOther = source === 'other-department';

  return modulePayables.filter((payable) => {
    if (isOther) {
      if (payable.source !== 'other-department') return false;
      if (payable.departmentId && departmentId && payable.departmentId !== departmentId) return false;
      if (normalizeCode(payable.moduleCode) !== code) return false;
      const targetCourse = (payable.targetCourse || '').toString().trim().toLowerCase();
      const classCourseNorm = (classCourse || '').toString().trim().toLowerCase();
      if (targetCourse && classCourseNorm && targetCourse !== classCourseNorm) return false;
      if (payable.targetYearLevel && Number(payable.targetYearLevel) !== Number(yearLevel)) return false;
      return true;
    }

    if (payable.source === 'other-department') return false;
    if (payable.moduleId && moduleId && payable.moduleId === moduleId) return true;
    return normalizeCode(payable.moduleCode) === code;
  });
};

const getIrregularJoinedBlock = (student, courseKey, activeTerm) => {
  if (!student?.isIrregular) return '';
  const sem = Number(activeTerm?.semester) || 1;
  const semKey = `sem${sem}`;
  const targetCode = normalizeCode(courseKey?.courseCode);
  const termSchoolYear = (activeTerm?.schoolYear || '').toString().trim();
  const entries = (student.irregularSubjects || {})[semKey] || [];
  const match = entries.find((item) => {
    const itemCode = normalizeCode(item?.courseCode || item?.code);
    if (!itemCode || itemCode !== targetCode) return false;
    const itemSchoolYear = (item?.enrolledSchoolYear || item?.schoolYear || '').toString().trim();
    if (itemSchoolYear && termSchoolYear && itemSchoolYear !== termSchoolYear) return false;
    return true;
  });
  return normalizeBlock(match?.joinedBlock || student.block || '');
};

const getStudentBlockForCourse = (student, courseKey, activeTerm, fallback = 'A') => (
  student?.isIrregular
    ? getIrregularJoinedBlock(student, courseKey, activeTerm) || normalizeBlock(fallback)
    : normalizeBlock(student?.block || fallback)
);

const getStudentNumber = (student, payment) => (
  student?.studentNumber ||
  student?.studentNo ||
  payment?.studentNumber ||
  payment?.studentNo ||
  ''
);

const buildStudentRowsForPayables = (matchingPayables, studentMap, otherStudentMap, courseKey = {}, activeTerm = null) => {
  const blockMap = new Map();
  const studentRows = new Map();

  matchingPayables.forEach((payable) => {
    Object.entries(payable.studentPayments || {}).forEach(([studentId, payment]) => {
      const student = studentMap.get(studentId) || otherStudentMap.get(studentId);
      if (!student) return;
      if (!isStudentEnrolledForTerm(student, activeTerm)) return;

      const rawBlock = getStudentBlockForCourse(student, courseKey, activeTerm, payable.block || 'A');
      const block = rawBlock || '—';
      const paidAmount = Number(payment?.paidAmount) || 0;
      const voucherAmount = Number(payment?.voucherAmount) || 0;
      const paymentDate = payment?.lastPaymentDate || payment?.date || payment?.createdAt || '';

      const current = studentRows.get(studentId) || {
        id: studentId,
        name: student.name || '(unnamed)',
        studentNumber: getStudentNumber(student, payment),
        block,
        paidAmount: 0,
        voucherAmount: 0,
        paymentDate: '',
        paymentStatus: '',
        isIrregular: !!student.isIrregular,
        yearLevel: student.yearLevel,
        status: 'UNPAID'
      };

      current.paidAmount = Math.max(current.paidAmount, paidAmount);
      current.voucherAmount = Math.max(current.voucherAmount, voucherAmount);
      current.studentNumber = current.studentNumber || getStudentNumber(student, payment);
      current.paymentStatus = payment?.status || current.paymentStatus || '';
      if (paymentDate && (!current.paymentDate || new Date(paymentDate) > new Date(current.paymentDate))) {
        current.paymentDate = paymentDate;
      }
      current.block = current.block || block;
      studentRows.set(studentId, current);
    });
  });

  const payableAmount = matchingPayables[0] ? Number(matchingPayables[0].amount) || 0 : 0;

  studentRows.forEach((row) => {
    row.status = isFullyPaid(payableAmount, row.paidAmount, row.voucherAmount, row.paymentStatus)
      ? 'PAID'
      : row.paidAmount > 0
        ? 'PARTIAL'
        : 'UNPAID';

    if (!blockMap.has(row.block)) blockMap.set(row.block, []);
    blockMap.get(row.block).push(row);
  });

  const blocks = Array.from(blockMap.entries())
    .map(([block, students]) => ({
      block,
      yearLevel: students[0]?.yearLevel,
      students: students.sort((a, b) => a.name.localeCompare(b.name))
    }))
    .sort((a, b) => a.block.localeCompare(b.block, undefined, { numeric: true }));

  return { blocks, payableAmount, hasPayable: matchingPayables.length > 0 };
};

const addStudentsToBlocks = (built, studentsToAdd, courseKey, activeTerm) => {
  const blockMap = new Map();
  (built.blocks || []).forEach((blockGroup) => {
    blockMap.set(blockGroup.block, [...(blockGroup.students || [])]);
  });

  studentsToAdd.forEach((student) => {
    const block = getStudentBlockForCourse(student, courseKey, activeTerm, 'A');
    if (!blockMap.has(block)) blockMap.set(block, []);
    const list = blockMap.get(block);
    if (list.some((row) => row.id === student.id)) return;
    list.push({
      id: student.id,
      name: student.name || '(unnamed)',
      studentNumber: student.studentNumber || student.studentNo || '',
      block,
      paidAmount: 0,
      voucherAmount: 0,
      paymentDate: '',
      isIrregular: !!student.isIrregular,
      yearLevel: student.yearLevel,
      status: 'UNPAID'
    });
  });

  built.blocks = Array.from(blockMap.entries())
    .map(([block, list]) => ({
      block,
      yearLevel: list[0]?.yearLevel || courseKey.yearLevel,
      students: list.sort((a, b) => a.name.localeCompare(b.name))
    }))
    .sort((a, b) => a.block.localeCompare(b.block, undefined, { numeric: true }));

  built.totalStudents = built.blocks.reduce((sum, block) => sum + block.students.length, 0);
  return built;
};

export const loadOtherDeptStudents = async () => {
  const snap = await getDocs(collection(db, 'otherDept-Students'));
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const buildModulePaymentCourses = ({
  offeredModules = [],
  modulePayables = [],
  professors = [],
  students = [],
  otherDeptStudents = [],
  curriculums = [],
  activeTerm = null
}) => {
  const curriculumMap = new Map(curriculums.map((c) => [c.id, c]));
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const otherStudentMap = new Map(otherDeptStudents.map((s) => [s.id, s]));

  const courseMap = new Map();

  const upsertCourse = (courseDef) => {
    const key = courseDef.reportKey;
    if (!courseMap.has(key)) {
      courseMap.set(key, { ...courseDef });
      return;
    }
    const existing = courseMap.get(key);
    if (!existing.professor && courseDef.professor) existing.professor = courseDef.professor;
  };

  offeredModules.forEach((mod) => {
    const curriculum = curriculumMap.get(mod.curriculumId);
    const source = curriculum ? 'ccs' : 'other';
    const courseKey = {
        moduleId: mod.id,
        courseCode: mod.courseCode,
        source: source === 'ccs' ? 'ccs' : 'other-department',
        departmentId: mod.departmentId,
        classCourse: mod.classCourse || mod.course,
        yearLevel: mod.yearLevel
      };
    const matchingPayables = findMatchingPayables(courseKey, modulePayables);
    const built = buildStudentRowsForPayables(matchingPayables, studentMap, otherStudentMap, courseKey, activeTerm);
    const sem = Number(activeTerm?.semester) || Number(mod.semester) || 1;
    const semKey = `sem${sem}`;
    const allowedBlocks = Array.isArray(mod.blocks)
      ? mod.blocks.map(normalizeBlock).filter(Boolean)
      : [];
    const relevantStudents = curriculum
      ? students.filter((student) => {
          if (!isStudentEnrolledForTerm(student, activeTerm)) return false;
          const block = getStudentBlockForCourse(student, courseKey, activeTerm, student.block || 'A');
          if (allowedBlocks.length > 0 && !allowedBlocks.includes(block)) return false;
          if (student.isIrregular) {
            const entries = (student.irregularSubjects || {})[semKey] || [];
            return entries.some((item) => normalizeCode(item?.courseCode || item?.code) === normalizeCode(mod.courseCode));
          }
          if (student.curriculumId !== mod.curriculumId) return false;
          if (Number(student.yearLevel) !== Number(mod.yearLevel)) return false;
          if (mod.semester && Number(mod.semester) !== sem) return false;
          return true;
        })
      : otherDeptStudents.filter((student) => {
          if (!isStudentEnrolledForTerm(student, activeTerm)) return false;
          if (mod.departmentId && student.departmentId !== mod.departmentId) return false;
          if ((student.course || '').toString().trim() !== (mod.classCourse || mod.course || '').toString().trim()) return false;
          if (Number(student.yearLevel) !== Number(mod.yearLevel)) return false;
          const block = getStudentBlockForCourse(student, courseKey, activeTerm, student.block || 'A');
          if (allowedBlocks.length > 0 && !allowedBlocks.includes(block)) return false;
          return true;
        });
    addStudentsToBlocks(built, relevantStudents, courseKey, activeTerm);
    const professor = matchingPayables[0]?.professor || mod.professor || mod.instructor || '';

    upsertCourse({
      reportKey: source === 'other'
        ? buildOtherDeptReportKey({
            departmentId: mod.departmentId,
            courseId: mod.id,
            courseCode: mod.courseCode,
            classCourse: mod.classCourse || mod.course
          })
        : `ccs::${mod.id || mod.courseCode}`,
      id: mod.id,
      courseCode: mod.courseCode,
      courseTitle: mod.courseTitle,
      course: curriculum ? 'BSCS' : mod.classCourse || mod.course || mod.departmentName || 'Other Department',
      department: curriculum ? curriculum.name : mod.departmentName || 'Other Department',
      source,
      yearLevel: mod.yearLevel,
      semester: mod.semester,
      professor,
      amount: built.payableAmount || null,
      hasPayable: built.hasPayable,
      blocks: built.blocks,
      totalStudents: built.blocks.reduce((sum, b) => sum + b.students.length, 0),
      paidCount: built.blocks.reduce(
        (sum, b) => sum + b.students.filter((s) => s.status === 'PAID').length,
        0
      ),
      isCcs: !!curriculum
    });
  });

  professors.forEach((professor) => {
    (professor.assignedCourses || []).forEach((assignment) => {
      if (assignment.source !== 'other-department') return;

      const reportKey = buildOtherDeptReportKey({
        departmentId: assignment.departmentId,
        courseId: assignment.courseId || assignment.subjectId,
        courseCode: assignment.courseCode,
        classCourse: assignment.classCourse
      });
      if (courseMap.has(reportKey)) {
        const existing = courseMap.get(reportKey);
        if (!existing.professor) existing.professor = professor.name || '';
        return;
      }

      const courseKey = {
        moduleId: assignment.subjectId || assignment.courseId,
        courseCode: assignment.courseCode,
        source: 'other-department',
        departmentId: assignment.departmentId,
        classCourse: assignment.classCourse,
        yearLevel: assignment.yearLevel
      };
      const matchingPayables = findMatchingPayables(courseKey, modulePayables);
      const built = buildStudentRowsForPayables(matchingPayables, studentMap, otherStudentMap, courseKey, activeTerm);

      const relevantStudents = otherDeptStudents.filter((student) => {
        if (!isStudentEnrolledForTerm(student, activeTerm)) return false;
        if (student.departmentId !== assignment.departmentId) return false;
        if ((student.course || '').toString().trim() !== (assignment.classCourse || '').toString().trim()) {
          return false;
        }
        if (Number(student.yearLevel) !== Number(assignment.yearLevel)) return false;
        const block = (student.block || '—').toString().trim();
        const handledBlocks = (assignment.blocks || []).map((b) => b.toString().trim());
        if (handledBlocks.length > 0 && !handledBlocks.includes(block)) return false;
        return true;
      });

      if (built.blocks.length === 0 && relevantStudents.length > 0) {
        const blockMap = new Map();
        relevantStudents.forEach((student) => {
          const block = (student.block || '—').toString().trim() || '—';
          if (!blockMap.has(block)) blockMap.set(block, []);
          blockMap.get(block).push({
            id: student.id,
            name: student.name || '(unnamed)',
            studentNumber: student.studentNumber || student.studentNo || '',
            block,
            paidAmount: 0,
            voucherAmount: 0,
            paymentDate: '',
            isIrregular: false,
            yearLevel: student.yearLevel,
            status: 'UNPAID'
          });
        });
        built.blocks = Array.from(blockMap.entries()).map(([block, list]) => ({
          block,
          yearLevel: assignment.yearLevel,
          students: list.sort((a, b) => a.name.localeCompare(b.name))
        }));
        built.totalStudents = relevantStudents.length;
      }
      addStudentsToBlocks(built, relevantStudents, courseKey, activeTerm);

      upsertCourse({
        reportKey,
        id: assignment.courseId || assignment.courseCode,
        courseCode: assignment.courseCode,
        courseTitle: assignment.courseTitle,
        course: assignment.classCourse || assignment.departmentName || 'Other Department',
        department: assignment.departmentName || 'Other Department',
        source: 'other',
        yearLevel: assignment.yearLevel,
        semester: assignment.semester,
        professor: professor.name || '',
        amount: built.payableAmount,
        hasPayable: built.hasPayable,
        blocks: built.blocks,
        totalStudents: built.blocks.reduce((sum, b) => sum + b.students.length, 0),
        paidCount: built.blocks.reduce(
          (sum, b) => sum + b.students.filter((s) => s.status === 'PAID').length,
          0
        ),
        isCcs: false
      });
    });
  });

  return Array.from(courseMap.values()).sort((a, b) => {
    const profCompare = (a.professor || '').localeCompare(b.professor || '');
    if (profCompare !== 0) return profCompare;
    return (a.courseCode || '').localeCompare(b.courseCode || '');
  });
};

export const groupCoursesByProfessor = (courses = []) => {
  const map = new Map();
  courses.forEach((course) => {
    const key = course.professor || 'Unassigned';
    if (!map.has(key)) {
      map.set(key, { professor: key, courses: [] });
    }
    map.get(key).courses.push(course);
  });
  return Array.from(map.values()).sort((a, b) => a.professor.localeCompare(b.professor));
};

export const summarizeBlockFinancials = (block, ratePerStudent, deptSharePerStudent, isCcs) => {
  const students = block?.students || [];
  const paidStudents = students.filter((student) => student.status === 'PAID');
  const totalPaidAmount = students.reduce((sum, student) => sum + (Number(student.paidAmount) || 0), 0);

  return {
    totalStudents: students.length,
    paidCount: paidStudents.length,
    totalPaidAmount,
    accumulatedTotal: totalPaidAmount,
    professorCut: paidStudents.length * (Number(ratePerStudent) || 0),
    departmentShare: isCcs ? paidStudents.length * (Number(deptSharePerStudent) || 0) : 0
  };
};

export const formatPaymentDate = (rawValue) => {
  if (!rawValue) return '';
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
};
