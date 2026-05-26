import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import {
  ArrowBigLeft,
  ChevronUp,
  Download,
  FolderOpen,
  RefreshCw,
  Search,
  X
} from 'lucide-react';
import { db } from '../../firebase';
import { getActiveTerm, getProfessors, getStudentsForCourse } from '../../models/facultyModels';
import { getAllModulePayablesIncludingOtherDept, getPaymentsByPayableId } from '../../models/payablesModels';
import Breadcrumbs from '../common/Breadcrumbs';

const normalizeText = (value) => (value || '').toString().trim();
const normalizeCode = (value) => normalizeText(value).toUpperCase().replace(/\s+/g, '');
const normalizeBlock = (value) => normalizeText(value).toUpperCase() || 'A';
const sanitizeFilename = (value) => normalizeText(value).replace(/[\\/?*\[\]:]/g, '-').replace(/\.xlsx$/i, '') || 'module_payments';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

const getOtherDeptPaymentsByPayableId = async (payableId) => {
  try {
    if (!payableId) return { success: true, data: {} };
    const q = query(collection(db, 'otherDept-payment'), where('payableId', '==', payableId));
    const snap = await getDocs(q);
    const grouped = {};

    snap.docs.forEach((docSnap) => {
      const payment = { id: docSnap.id, ...(docSnap.data() || {}) };
      const studentId = payment.studentId || '';
      if (!studentId) return;

      const current = grouped[studentId] || {
        studentId,
        paidAmount: 0,
        voucherAmount: 0,
        lastPaymentDate: null,
        status: 'unpaid'
      };

      const paidAmount = Number(payment.amount || payment.paidAmount || 0);
      const voucherAmount = Number(payment.voucherAmount || 0);
      const paymentDate = payment.lastPaymentDate || payment.date || payment.createdAt || payment.updatedAt || null;

      grouped[studentId] = {
        ...current,
        ...payment,
        studentId,
        paidAmount: Number(current.paidAmount || 0) + paidAmount,
        voucherAmount: Number(current.voucherAmount || 0) + voucherAmount,
        lastPaymentDate: !current.lastPaymentDate || (paymentDate && new Date(paymentDate).getTime() > new Date(current.lastPaymentDate).getTime())
          ? paymentDate
          : current.lastPaymentDate
      };
    });

    return { success: true, data: grouped };
  } catch (error) {
    console.error('Error getting other department payments:', error);
    return { success: false, error: error.message };
  }
};

const fetchStudentById = async (course, studentId) => {
  if (!studentId) return null;
  const collectionName = course?.source === 'other-department' ? 'otherDept-Students' : 'students';
  try {
    const snap = await getDoc(doc(db, collectionName, studentId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch {
    return null;
  }
};

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

const loadCourseStudentsFromPayables = async ({ course, baseStudents = [], payablePackets = [], activeTerm = null }) => {
  const studentsById = new Map();

  baseStudents.forEach((student) => {
    if (student?.id && isStudentEnrolledForTerm(student, activeTerm)) studentsById.set(student.id, student);
  });

  const payableStudentIds = new Set();
  payablePackets.forEach(({ payable, payments }) => {
    Object.keys(payable?.studentPayments || {}).forEach((studentId) => payableStudentIds.add(studentId));
    Object.keys(payments || {}).forEach((studentId) => payableStudentIds.add(studentId));
  });

  await Promise.all(Array.from(payableStudentIds).map(async (studentId) => {
    if (!studentId || studentsById.has(studentId)) return;
    const student = await fetchStudentById(course, studentId);
    if (student && isStudentEnrolledForTerm(student, activeTerm)) studentsById.set(student.id, student);
  }));

  return Array.from(studentsById.values()).sort((left, right) => (left.name || '').localeCompare(right.name || ''));
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

  const studentNumber = normalizeText(student.studentNumber || student.studentNo);
  const found = Object.values(studentPayments).find((entry) => {
    const entryNumber = normalizeText(entry?.studentNumber || entry?.studentNo || entry?.studentId);
    return studentNumber && entryNumber && studentNumber === entryNumber;
  });

  return found || null;
};

const resolvePaymentDate = (entry) => entry?.lastPaymentDate || entry?.date || entry?.createdAt || entry?.updatedAt || '';

const normalizeBlocks = (course) => {
  const rawBlocks = Array.isArray(course?.blocks)
    ? course.blocks
    : (course?.block ? [course.block] : []);
  return Array.from(new Set(rawBlocks.map((block) => normalizeBlock(block)).filter(Boolean)));
};

const normalizePayableBlocks = (payable) => {
  const rawBlocks = Array.isArray(payable?.targetBlocks)
    ? payable.targetBlocks
    : (payable?.targetBlock ? [payable.targetBlock] : (payable?.block ? [payable.block] : []));
  return Array.from(new Set(rawBlocks.map((block) => normalizeBlock(block)).filter(Boolean)));
};

const findModulePayables = (course, modulePayables, term) => {
  const isOtherDepartment = course?.source === 'other-department';
  const sem = Number(term?.semester) || 0;
  const schoolYear = normalizeText(term?.schoolYear);
  const courseCode = normalizeCode(course?.courseCode);

  const candidates = (modulePayables || []).filter((payable) => {
    if (isOtherDepartment && payable.source !== 'other-department') return false;
    if (!isOtherDepartment && payable.source === 'other-department') return false;
    if (sem && payable.semester && Number(payable.semester) !== sem) return false;
    if (schoolYear && payable.schoolYear && normalizeText(payable.schoolYear) !== schoolYear) return false;
    return true;
  });

  if (isOtherDepartment) {
    return candidates.filter((payable) => {
      if (payable.departmentId && course.departmentId && payable.departmentId !== course.departmentId) return false;
      if (payable.moduleId && course.subjectId && payable.moduleId !== course.subjectId) return false;
      if (normalizeCode(payable.moduleCode) !== courseCode) return false;
      const targetCourse = normalizeText(payable.targetCourse).toLowerCase();
      const classCourse = normalizeText(course.classCourse).toLowerCase();
      if (targetCourse && classCourse && targetCourse !== classCourse) return false;
      const targetYear = normalizeText(payable.targetYearLevel);
      if (targetYear && Number(targetYear) !== Number(course.yearLevel)) return false;

      const targetBlocks = normalizePayableBlocks(payable);
      const courseBlocks = normalizeBlocks(course);
      if (targetBlocks.length > 0 && courseBlocks.length > 0) {
        return targetBlocks.some((block) => courseBlocks.includes(block));
      }
      return true;
    });
  }

  const byId = candidates.filter((payable) => payable.moduleId && payable.moduleId === course.courseId);
  if (byId.length > 0) return byId;
  return candidates.filter((payable) => normalizeCode(payable.moduleCode) === courseCode);
};

const matchesBlock = (payable, block) => {
  const payableBlocks = normalizePayableBlocks(payable);
  if (payableBlocks.length === 0 || payableBlocks.includes('ALL')) return true;
  return payableBlocks.includes(normalizeBlock(block));
};

const YEAR_LEVELS = [1, 2, 3, 4];
const YEAR_LEVEL_LABELS = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
const DEPARTMENT_SCOPES = [
  { key: 'ccs', label: 'CCS Department' },
  { key: 'other', label: 'Other Departments' }
];

const formatCurrency = (value) => `₱${Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

const getYearLevelLabel = (yearLevel) => YEAR_LEVEL_LABELS[Number(yearLevel)] || 'Other';
const getDepartmentCode = (course) => normalizeText(course?.departmentCode || (course?.source === 'other-department' ? course?.departmentName : 'CCS')) || 'CCS';
const getDepartmentSheetName = (course) => {
  // Prefer department code; fallback to departmentName; do NOT use departmentId (UID)
  const code = normalizeText(course?.departmentCode);
  if (code) return code.toUpperCase();
  const name = normalizeText(course?.departmentName || 'Other Department');
  return name;
};

const getCourseDisplay = (course) => {
  if (!course) return '';
  const code = normalizeText(course.courseCode || course.departmentCode || '');
  const title = normalizeText(course.courseTitle || course.classCourse || course.course || '');
  if (code) return title ? `${code} - ${title}` : code;
  return title || '';
};
const matchesDepartmentScope = (course, scope) => (
  scope === 'other'
    ? course?.source === 'other-department'
    : course?.source !== 'other-department'
);

const getIrregularJoinedBlock = (student, course, activeTerm) => {
  if (!student || !course || !student.isIrregular) return '';
  const term = typeof activeTerm === 'object' && activeTerm !== null ? activeTerm : { semester: activeTerm, schoolYear: '' };
  const semKey = `sem${Number(term.semester) || 1}`;
  const entries = (student.irregularSubjects || {})[semKey] || [];
  const targetCode = normalizeCode(course.courseCode);
  const termSchoolYear = normalizeText(term.schoolYear);

  const match = entries.find((item) => {
    const itemCode = normalizeCode(item?.courseCode || item?.code);
    if (!itemCode || itemCode !== targetCode) return false;
    const itemSchoolYear = normalizeText(item?.enrolledSchoolYear || item?.schoolYear);
    if (itemSchoolYear && termSchoolYear && itemSchoolYear !== termSchoolYear) return false;
    return true;
  });

  return normalizeBlock(match?.joinedBlock || student.block || '');
};

const getStudentBlockForCourse = (student, course, activeTerm) => {
  if (!student) return 'A';
  if (student.isIrregular) {
    return getIrregularJoinedBlock(student, course, activeTerm) || normalizeBlock(student.block);
  }
  return normalizeBlock(student.block);
};

const sanitizeSheetName = (name) => {
  const cleaned = normalizeText(name || 'Sheet').replace(/[\\/?*[\]:]/g, '-');
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned || 'Sheet';
};

const dedupeSheetName = (wb, baseName) => {
  let candidate = sanitizeSheetName(baseName);
  if (!wb.SheetNames.includes(candidate)) return candidate;
  const root = candidate.length > 27 ? candidate.slice(0, 27) : candidate;
  let index = 2;
  while (wb.SheetNames.includes(`${root} (${index})`)) index += 1;
  return `${root} (${index})`;
};

const buildBlockGroups = ({ students, payablePackets, course, activeTerm, expectedBlocks = [] }) => {
  const grouped = new Map();

  students.forEach((student) => {
    const block = normalizeBlock(getStudentBlockForCourse(student, course, activeTerm));
    if (!grouped.has(block)) grouped.set(block, []);
    grouped.get(block).push(student);
  });

  expectedBlocks.forEach((block) => {
    const normalized = normalizeBlock(block);
    if (normalized && !grouped.has(normalized)) grouped.set(normalized, []);
  });

  const sortedBlocks = Array.from(grouped.keys()).sort((left, right) => left.localeCompare(right));
  let accumulatedTotal = 0;

  return sortedBlocks.map((block) => {
    const studentsInBlock = grouped.get(block) || [];
    const blockPackets = payablePackets.filter(({ payable }) => matchesBlock(payable, block));

    const rows = studentsInBlock.map((student) => {
      let amountRequired = 0;
      let paidAmount = 0;
      let lastPaymentDate = '';

      blockPackets.forEach(({ payable, payments }) => {
        const entry = findStudentPaymentEntry(payments, student);
        amountRequired += Number(payable?.amount || 0);
        if (!entry) return;

        const rowPaid = Number(entry?.paidAmount || 0) + Number(entry?.voucherAmount || 0);
        paidAmount += rowPaid;

        const paymentDate = resolvePaymentDate(entry);
        if (paymentDate && (!lastPaymentDate || new Date(paymentDate).getTime() > new Date(lastPaymentDate).getTime())) {
          lastPaymentDate = paymentDate;
        }
      });

      const remainingBalance = Math.max(0, amountRequired - paidAmount);
      const fullyPaid = amountRequired > 0 && paidAmount >= amountRequired;

      return {
        id: student.id,
        name: student.name || '—',
        yearLevel: student.yearLevel || '',
        block,
        paidAmount,
        lastPaymentDate,
        amountRequired,
        remainingBalance,
        fullyPaid,
        hasPayment: paidAmount > 0 || amountRequired > 0
      };
    }).sort((left, right) => (left.name || '').localeCompare(right.name || ''));

    const totalPaidAmount = rows.reduce((sum, row) => sum + Number(row.paidAmount || 0), 0);
    const totalRemainingBalance = rows.reduce((sum, row) => sum + Number(row.remainingBalance || 0), 0);
    const totalStudents = rows.length;
    const paidStudents = rows.filter((row) => row.paidAmount > 0).length;
    const fullyPaidStudents = rows.filter((row) => row.fullyPaid).length;

    accumulatedTotal += totalPaidAmount;

    return {
      block,
      totalStudents,
      rows,
      totalPaidAmount,
      totalRemainingBalance,
      accumulatedTotal,
      paidStudents,
      fullyPaidStudents
    };
  });
};

const flattenCourses = (professors = []) => professors.flatMap((professor) => (
  (professor.classes || []).map((course) => ({
    ...course,
    professorId: professor.id,
    professorName: professor.name || '—'
  }))
));

const buildModulePaymentsWorkbook = async (courses, { filename, scopeLabel, termLabel, includeSummarySheet = true }) => {
  const workbook = XLSX.utils.book_new();
  const ccsCourses = [];
  const otherDeptCourses = new Map();

  // load otherDepartments once to resolve department codes for other-department courses
  const otherDeptSnapshot = await getDocs(collection(db, 'otherDepartments'));
  const otherDeptMap = {};
  otherDeptSnapshot.docs.forEach((docSnap) => {
    otherDeptMap[docSnap.id] = docSnap.data() || {};
  });

  (courses || []).forEach((course) => {
    if (course?.source === 'other-department') {
      // prefer explicit departmentCode, then lookup by departmentId document, then fall back to departmentName
      const rawCode = normalizeText(course.departmentCode || (course.departmentId && otherDeptMap[course.departmentId]?.code) || otherDeptMap[course.departmentId]?.name || course.departmentName || 'OTHER');
      const sheetKey = rawCode.toUpperCase();
      // attach resolved departmentCode to course for downstream display in headers
      course.departmentCode = rawCode;
      if (!otherDeptCourses.has(sheetKey)) otherDeptCourses.set(sheetKey, []);
      otherDeptCourses.get(sheetKey).push(course);
      return;
    }
    ccsCourses.push(course);
  });

  const thinBorder = {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } }
  };

  const styleCell = (worksheet, cellAddress, style) => {
    if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: '' };
    worksheet[cellAddress].s = { ...(worksheet[cellAddress].s || {}), ...style };
  };

  const buildGroupedSheet = (sheetTitle, sheetCourses, emptyMessage, options = {}) => {
    const { includeDepartmentCode = false, horizontalGapColumns = 2 } = options;
    const yearCourses = (sheetCourses || []).slice().sort((left, right) => {
      const deptA = getDepartmentCode(left);
      const deptB = getDepartmentCode(right);
      if (deptA !== deptB) return deptA.localeCompare(deptB);
      const yearDiff = Number(left.yearLevel || 99) - Number(right.yearLevel || 99);
      if (yearDiff !== 0) return yearDiff;
      const codeA = normalizeCode(left.courseCode || left.courseTitle || '');
      const codeB = normalizeCode(right.courseCode || right.courseTitle || '');
      if (codeA !== codeB) return codeA.localeCompare(codeB);
      return normalizeText(left.courseTitle || '').localeCompare(normalizeText(right.courseTitle || ''));
    });

    const styles = {
      title: {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 16 },
        fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder
      },
      subtitle: {
        font: { bold: true, color: { rgb: '334155' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder
      },
      summary: {
        font: { bold: true, color: { rgb: '1F2937' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder
      },
      moduleHeader: {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
        fill: { patternType: 'solid', fgColor: { rgb: '0F172A' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder
      },
      moduleMeta: {
        font: { italic: true, color: { rgb: '334155' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'F8FAFC' } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: thinBorder
      },
      blockHeader: {
        font: { bold: true, color: { rgb: '1F2937' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'FEF3C7' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: thinBorder
      },
      tableHeader: {
        font: { bold: true, color: { rgb: '1F2937' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'BFDBFE' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder
      },
      data: {
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder
      },
      empty: {
        font: { italic: true, color: { rgb: '64748B' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder
      },
      spacer: {
        border: thinBorder
      }
    };

    const buildCourseSection = (course) => {
      const sectionRows = [];
      const rowTypes = [];
      const merges = [];

      const pushRow = (values, type = 'data', merge = false, mergeEndColumn = 5) => {
        sectionRows.push(values);
        rowTypes.push(type);
        if (merge) {
          const rowIndex = sectionRows.length - 1;
          merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: mergeEndColumn } });
        }
      };

      const blockGroups = course.blockGroups || [];
      const tableColumnCount = 6;
      const gapColumnCount = 1;
      const courseColumnCount = Math.max(6, blockGroups.length > 0
        ? (blockGroups.length * tableColumnCount) + ((blockGroups.length - 1) * gapColumnCount)
        : 6);
      const courseMergeEnd = courseColumnCount - 1;
      const courseTitleText = includeDepartmentCode
        ? `${normalizeText(course.courseTitle || course.classCourse || course.courseCode || 'Untitled Module')}`
        : `${normalizeText(course.courseTitle || course.courseCode || 'Untitled Module')}`;

      pushRow([courseTitleText], 'moduleHeader', true, courseMergeEnd);

      const blockListText = (blockGroups || []).map((g) => normalizeBlock(g.block)).filter(Boolean).join(', ') || '—';
      pushRow([
        `Module: ${getCourseDisplay(course) || courseTitleText}`,
        `Year Level: ${getYearLevelLabel(course.yearLevel)}`,
        `Blocks: ${blockListText}`,
        '',
        ''
      ], 'moduleMeta', true, courseMergeEnd);

      if (!blockGroups.length) {
        pushRow([emptyMessage], 'empty', true, courseMergeEnd);
      } else {
        const maxDataRows = Math.max(1, ...blockGroups.map((group) => (group.rows || []).length));
        const horizontalRows = [
          new Array(courseColumnCount).fill(''),
          new Array(courseColumnCount).fill(''),
          ...Array.from({ length: maxDataRows }, () => new Array(courseColumnCount).fill('')),
          new Array(courseColumnCount).fill('')
        ];

        const blockSectionRow = sectionRows.length;
        horizontalRows.forEach((row, index) => {
          sectionRows.push(row);
          rowTypes.push(index === 0 ? 'blockHeader' : index === 1 ? 'tableHeader' : index === horizontalRows.length - 1 ? 'spacer' : 'data');
        });

        blockGroups.forEach((group, groupIndex) => {
          const startColumn = groupIndex * (tableColumnCount + gapColumnCount);
          const blockHeaderRow = horizontalRows[0];
          const tableHeaderRow = horizontalRows[1];
          const blockYear = (group.rows && group.rows[0] && (group.rows[0].yearLevel || group.yearLevel)) || course.yearLevel || '';
          blockHeaderRow[startColumn] = `${getYearLevelLabel(blockYear).toUpperCase()} BLK ${group.block || '—'}`;
          merges.push({
            s: { r: blockSectionRow, c: startColumn },
            e: { r: blockSectionRow, c: startColumn + tableColumnCount - 1 }
          });

          ['No.', 'Student Name', 'Block', 'Amount Paid', 'Payment Date', 'Remaining Balance'].forEach((header, offset) => {
            tableHeaderRow[startColumn + offset] = header;
          });

          const groupRows = (group.rows && group.rows.length > 0)
            ? group.rows
            : [{ name: 'No students found', block: '', paidAmount: '', lastPaymentDate: '', amountRequired: 0, remainingBalance: '' }];

          groupRows.forEach((row, rowIndex) => {
            const dataRow = horizontalRows[rowIndex + 2];
            [
              row.name === 'No students found' ? '' : String(rowIndex + 1),
              row.name || '—',
              row.block || '—',
              row.name === 'No students found' ? '' : formatCurrency(row.paidAmount || 0),
              row.lastPaymentDate ? formatDate(row.lastPaymentDate) : '',
              row.amountRequired > 0 ? formatCurrency(row.remainingBalance || 0) : ''
            ].forEach((value, offset) => {
              dataRow[startColumn + offset] = value;
            });
          });
        });
      }

      const sectionWorksheet = XLSX.utils.aoa_to_sheet(sectionRows);
      sectionWorksheet['!merges'] = merges;

      const columnCount = Math.max(courseColumnCount, ...sectionRows.map((row) => row.length || 0));
      rowTypes.forEach((type, rowIndex) => {
        const rowStyle = styles[type] || styles.data;
        for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
          const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
          if (!sectionWorksheet[cellAddress]) continue;
          styleCell(sectionWorksheet, cellAddress, rowStyle);

          if (type === 'data') {
            const localColumn = columnIndex % 7;
            styleCell(sectionWorksheet, cellAddress, {
              alignment: {
                horizontal: localColumn === 1 ? 'left' : localColumn === 3 || localColumn === 5 ? 'right' : 'center',
                vertical: 'center',
                wrapText: localColumn === 1
              }
            });
          }
        }
      });

      const baseWidths = [6, 34, 12, 16, 16, 18, 3];
      const widths = Array.from({ length: columnCount }, (_, index) => baseWidths[index % 7] || 14);
      sectionRows.forEach((row, rowIndex) => {
        if (rowTypes[rowIndex] !== 'tableHeader' && rowTypes[rowIndex] !== 'data') return;
        row.forEach((cell, columnIndex) => {
          if (cell === null || typeof cell === 'undefined' || cell === '') return;
          widths[columnIndex] = Math.max(widths[columnIndex], Math.min(42, String(cell).length + 2));
        });
      });
      sectionWorksheet['!cols'] = widths.map((width) => ({ wch: width }));

      return { worksheet: sectionWorksheet, widths, rowCount: sectionRows.length };
    };

    if (yearCourses.length === 0) {
      const worksheet = XLSX.utils.aoa_to_sheet([[emptyMessage]]);
      worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
      worksheet['!cols'] = [
        { wch: 6 },
        { wch: 34 },
        { wch: 12 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 }
      ];
      styleCell(worksheet, 'A1', styles.empty);
      worksheet['!ref'] = 'A1:F1';
      return worksheet;
    }

    const sections = yearCourses.map((course) => buildCourseSection(course));
    const worksheet = {};
    const mergedRanges = [];
    const globalWidths = [];
    let currentColumn = 0;
    let maxRowIndex = 0;

    sections.forEach((section, sectionIndex) => {
      const startColumn = currentColumn;
      const sectionCells = Object.keys(section.worksheet).filter((cellAddress) => !cellAddress.startsWith('!'));

      sectionCells.forEach((cellAddress) => {
        const decoded = XLSX.utils.decode_cell(cellAddress);
        const targetAddress = XLSX.utils.encode_cell({ r: decoded.r, c: decoded.c + startColumn });
        worksheet[targetAddress] = { ...section.worksheet[cellAddress] };
      });

      (section.worksheet['!merges'] || []).forEach((merge) => {
        mergedRanges.push({
          s: { r: merge.s.r, c: merge.s.c + startColumn },
          e: { r: merge.e.r, c: merge.e.c + startColumn }
        });
      });

      section.widths.forEach((width, widthIndex) => {
        globalWidths[startColumn + widthIndex] = Math.max(globalWidths[startColumn + widthIndex] || 0, width);
      });

      if (sectionIndex < sections.length - 1) {
        for (let gapIndex = 0; gapIndex < horizontalGapColumns; gapIndex += 1) {
          globalWidths[startColumn + section.widths.length + gapIndex] = Math.max(
            globalWidths[startColumn + section.widths.length + gapIndex] || 0,
            2
          );
        }
      }

      currentColumn += section.widths.length;
      if (sectionIndex < sections.length - 1) currentColumn += horizontalGapColumns;
      maxRowIndex = Math.max(maxRowIndex, section.rowCount - 1);
    });

    worksheet['!merges'] = mergedRanges;
    worksheet['!cols'] = globalWidths.map((width) => ({ wch: width || 14 }));
    worksheet['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(0, maxRowIndex), c: Math.max(0, currentColumn - 1) }
    });

    return worksheet;
  };

  // Summary sheet removed per request — exports will include only per-department/per-year sheets

  YEAR_LEVELS.forEach((yearLevel) => {
    const yearCourses = ccsCourses.filter((course) => Number(course.yearLevel) === Number(yearLevel));
    const worksheet = buildGroupedSheet(
      `${getYearLevelLabel(yearLevel)} Module Payments`,
      yearCourses,
      'No modules found for this year level.'
    );
    XLSX.utils.book_append_sheet(workbook, worksheet, dedupeSheetName(workbook, getYearLevelLabel(yearLevel)));
  });

  Array.from(otherDeptCourses.entries()).forEach(([deptCodeKey, departmentCourses]) => {
    const sheetTitle = `${deptCodeKey} Module Payments`;
    const worksheet = buildGroupedSheet(
      sheetTitle,
      departmentCourses,
      'No modules found for this department.',
      { includeDepartmentCode: true }
    );
    XLSX.utils.book_append_sheet(workbook, worksheet, dedupeSheetName(workbook, deptCodeKey));
  });

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);
};

const exportSelectedCourses = async (courses, filename, options = {}) => {
  await buildModulePaymentsWorkbook(courses, {
    filename,
    scopeLabel: options.scopeLabel || 'Current View',
    termLabel: options.termLabel || 'Current Term',
    includeSummarySheet: options.includeSummarySheet !== false
  });
};

const CourseModal = ({ open, onClose, course, onExport, initialBlock = '' }) => {
  const [activeBlock, setActiveBlock] = useState('');

  useEffect(() => {
    const nextBlock = initialBlock || (course?.blockGroups || [])[0]?.block || '';
    setActiveBlock(nextBlock);
  }, [course, initialBlock]);

  if (!open || !course) return null;

  const blockGroups = course.blockGroups || [];
  const selectedBlock = blockGroups.find((group) => group.block === activeBlock) || blockGroups[0] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] min-h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-100 px-8 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Module Payments</p>
            <h3 className="text-xl font-semibold text-slate-900">{course.courseCode} - {course.courseTitle}</h3>
          </div>
          <div className="flex items-center gap-2">
        
            <button
              type="button"
              onClick={onClose}
                  className="rounded-full bg-white p-1 cursor-pointer text-slate-500 hover:text-red-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(90vh-88px)] overflow-y-auto px-8 py-4">
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Year Level</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{getYearLevelLabel(course.yearLevel)}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Collected</p>
              <p className="mt-1 text-lg font-semibold text-emerald-700">{formatCurrency(course.totalCollected || 0)}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Remaining</p>
              <p className="mt-1 text-lg font-semibold text-amber-700">{formatCurrency(course.totalRemainingBalance || 0)}</p>
            </div>
          </div>

          <div className="space-y-5">
            {(blockGroups.length === 0) ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No active-term students or payments found for this course.
              </div>
            ) : (
              <section className="mt-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                   <div className="flex flex-wrap gap-1.5">
                  {blockGroups.map((group) => (
                    <button
                      key={group.block}
                      type="button"
                      onClick={() => setActiveBlock(group.block)}
              className={`rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
                        activeBlock === group.block
                          ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
                      }`}
                    >
                      Block {group.block} 
                    </button>
                  ))}
                </div>
                  
                </div>

 

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-blue-500 text-xs uppercase tracking-wide text-white">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold w-[5%]">No.</th>
                        <th className="px-4 py-3 text-left font-semibold w-[35%]">Student Name</th>
                        <th className="px-4 py-3 text-left font-semibold w-[20%]">Amount Paid</th>
                        <th className="px-4 py-3 text-left font-semibold w-[20%]">Date of Payment</th>
                        <th className="px-4 py-3 text-left font-semibold w-[20%]">Remaining Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedBlock?.rows || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                            No students found in this block.
                          </td>
                        </tr>
                      ) : (selectedBlock.rows || []).map((row, index) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-4 py-3 text-slate-600">{index + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                          <td className="px-4 py-3 text-slate-700">{formatCurrency(row.paidAmount || 0)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(row.lastPaymentDate) || ''}</td>
                          <td className="px-4 py-3 text-slate-700">{row.amountRequired > 0 ? formatCurrency(row.remainingBalance || 0) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ModulePaymentsGroupedReport = ({ onBackToReportsMain }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [professors, setProfessors] = useState([]);
  const [activeTerm, setActiveTerm] = useState({ semester: 1, schoolYear: '' });
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [departmentScope, setDepartmentScope] = useState('ccs');
  const [exportFilenameModalOpen, setExportFilenameModalOpen] = useState(false);
  const [exportFilename, setExportFilename] = useState('');
  const [pendingExport, setPendingExport] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = useCallback(() => {
    const getCurrentScrollTop = () => Math.max(
      window.scrollY || 0,
      window.pageYOffset || 0,
      document.documentElement?.scrollTop || 0,
      document.body?.scrollTop || 0
    );

    setShowScrollTop(getCurrentScrollTop() > 180);
  }, []);

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement?.scrollTo?.({ top: 0, behavior: 'smooth' });
    document.body?.scrollTo?.({ top: 0, behavior: 'smooth' });
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profRes, termRes] = await Promise.all([
        getProfessors(),
        getActiveTerm()
      ]);

      if (!profRes.success) throw new Error(profRes.error || 'Failed to load professors.');

      const term = termRes.success ? termRes.data : { semester: 1, schoolYear: '' };
      setActiveTerm(term);

      const payablesRes = await getAllModulePayablesIncludingOtherDept(term);
      if (!payablesRes.success) throw new Error(payablesRes.error || 'Failed to load module payables.');
      const allModulePayables = payablesRes.data || [];

      const enriched = await Promise.all((profRes.data || []).map(async (professor) => {
        const courses = await Promise.all((professor.assignedCourses || []).map(async (course) => {
          const matchingPayables = findModulePayables(course, allModulePayables, term);

          const payablePackets = await Promise.all(matchingPayables.map(async (payable) => {
            const paymentsRes = await getPaymentsForPayable(payable);
            return {
              payable,
              payments: paymentsRes.success ? mergeStudentPayments(payable, paymentsRes.data) : mergeStudentPayments(payable, {})
            };
          }));

          const studentsRes = await getStudentsForCourse(course, term);
          const students = await loadCourseStudentsFromPayables({
            course,
            baseStudents: (studentsRes.success ? studentsRes.data : []).filter((student) => student.active !== false),
            payablePackets,
            activeTerm: term
          });

          const blockGroups = buildBlockGroups({
            students,
            payablePackets,
            course,
            activeTerm: term,
            expectedBlocks: normalizeBlocks(course)
          });

          const totalStudents = blockGroups.reduce((sum, group) => sum + group.totalStudents, 0);
          const totalCollected = blockGroups.reduce((sum, group) => sum + Number(group.totalPaidAmount || 0), 0);
          const totalRemainingBalance = blockGroups.reduce((sum, group) => sum + Number(group.totalRemainingBalance || 0), 0);
          const paidStudents = blockGroups.reduce((sum, group) => sum + Number(group.paidStudents || 0), 0);
          const fullyPaidStudents = blockGroups.reduce((sum, group) => sum + Number(group.fullyPaidStudents || 0), 0);

          return {
            ...course,
            id: course.courseId || `${professor.id}-${normalizeCode(course.courseCode)}`,
            professorId: professor.id,
            professorName: professor.name || '—',
            source: course.source || 'ccs',
            students,
            blockGroups,
            totalStudents,
            totalCollected,
            totalRemainingBalance,
            paidStudents,
            fullyPaidStudents,
            hasPayable: matchingPayables.length > 0,
            matchingPayablesCount: matchingPayables.length
          };
        }));

        const visibleCourses = courses;
        return {
          ...professor,
          classes: visibleCourses,
          handledCount: visibleCourses.length,
          studentCount: visibleCourses.reduce((sum, course) => sum + (course.totalStudents || 0), 0),
          totalCollected: visibleCourses.reduce((sum, course) => sum + (course.totalCollected || 0), 0),
          totalRemainingBalance: visibleCourses.reduce((sum, course) => sum + (course.totalRemainingBalance || 0), 0),
          paidStudents: visibleCourses.reduce((sum, course) => sum + (course.paidStudents || 0), 0),
          fullyPaidStudents: visibleCourses.reduce((sum, course) => sum + (course.fullyPaidStudents || 0), 0)
        };
      }));

      setProfessors(enriched);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load module payments report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  const scopedProfessors = useMemo(() => professors.map((professor) => ({
    ...professor,
    classes: (professor.classes || []).filter((course) => matchesDepartmentScope(course, departmentScope))
  })).filter((professor) => (professor.classes || []).length > 0), [professors, departmentScope]);

  const allModulePaymentCourses = useMemo(() => flattenCourses(professors), [professors]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return scopedProfessors.map((professor) => ({
      ...professor,
      classes: (professor.classes || []).filter((course) => {
        if (!term) return true;
        return [
          professor.name,
          professor.employeeId,
          course.courseCode,
          course.courseTitle,
          course.departmentName,
          course.classCourse
        ].some((value) => normalizeText(value).toLowerCase().includes(term));
      })
    })).filter((professor) => (professor.classes || []).length > 0);
  }, [scopedProfessors, search]);

  const allCourses = useMemo(() => flattenCourses(scopedProfessors), [scopedProfessors]);
  const visibleCourses = useMemo(() => flattenCourses(rows), [rows]);
  const moduleRows = useMemo(() => visibleCourses.slice().sort((left, right) => {
    const yearDiff = Number(left.yearLevel || 99) - Number(right.yearLevel || 99);
    if (yearDiff !== 0) return yearDiff;
    return normalizeCode(left.courseCode || '').localeCompare(normalizeCode(right.courseCode || ''));
  }), [visibleCourses]);

  const grandTotals = useMemo(() => rows.reduce((totals, professor) => {
    professor.classes.forEach((course) => {
      totals.handledCount += 1;
      totals.studentCount += course.totalStudents || 0;
      totals.totalCollected += course.totalCollected || 0;
      totals.totalRemainingBalance += course.totalRemainingBalance || 0;
    });
    return totals;
  }, { handledCount: 0, studentCount: 0, totalCollected: 0, totalRemainingBalance: 0 }), [rows]);

  const activeTermLabel = `Semester ${activeTerm.semester}${activeTerm.schoolYear ? `, SY ${activeTerm.schoolYear}` : ''}`;

  const handleExport = useCallback(async (courses, filename, includeSummarySheet = true, scopeLabel = 'Full Report') => {
    await exportSelectedCourses(courses, filename, {
      scopeLabel,
      termLabel: activeTermLabel,
      includeSummarySheet
    });
  }, [activeTermLabel]);

  const openExportFilenameModal = useCallback((courses, filename, includeSummarySheet = true, scopeLabel = 'Full Report') => {
    setPendingExport({ courses, includeSummarySheet, scopeLabel });
    setExportFilename(sanitizeFilename(filename));
    setExportFilenameModalOpen(true);
  }, []);

  const handleExportConfirm = useCallback(() => {
    if (!pendingExport) return;
    handleExport(
      pendingExport.courses,
      `${sanitizeFilename(exportFilename)}.xlsx`,
      pendingExport.includeSummarySheet,
      pendingExport.scopeLabel
    );
    setExportFilenameModalOpen(false);
    setPendingExport(null);
  }, [exportFilename, handleExport, pendingExport]);

  const exportCurrentCourse = useCallback((course) => {
    const safeName = normalizeCode(course?.courseCode || course?.courseTitle || 'module_payments') || 'module_payments';
    openExportFilenameModal([course], `${safeName}.xlsx`, false, 'Selected Module');
  }, [openExportFilenameModal]);

  const toolbar = (
    <div className="">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div className="flex items-center gap-2">
             <button
            type="button"
            onClick={loadReport}
            disabled={loading}
className="p-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
        <div className="relative w-80">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search professor, subject, code, or course..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full border text-sm border-slate-200 bg-white rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
          />
        </div>

        </div>

        <div className="flex items-center gap-3">
      
          <button
            type="button"
            onClick={() => openExportFilenameModal(allModulePaymentCourses, `module_payments_${normalizeCode(activeTermLabel || 'current_term') || 'current_term'}.xlsx`, true, 'Full Report')}
            className="inline-flex items-center gap-2 rounded-lg bg-green-500 text-white text-sm px-4 py-2 hover:bg-green-600 transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {showScrollTop && (
        <button
          type="button"
          onClick={handleScrollToTop}
          className="fixed bottom-6 right-6 z-40 rounded-full cursor-pointer bg-blue-600 p-3 text-white shadow-lg transition hover:bg-blue-700"
          aria-label="Scroll to top"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
      <Breadcrumbs items={[{ label: 'Module Payments' }]} />

      <div>
           <h2 className="text-2xl font-medium text-slate-900">Module Payments Report</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
                Review module payments by professor, then export the current view or a year-level workbook in the same style used across the payables system.
              </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

  <div className="flex flex-wrap gap-1.5">
          {DEPARTMENT_SCOPES.map((scope) => {
            const active = departmentScope === scope.key;
            return (
              <button
                key={scope.key}
                type="button"
                onClick={() => {
                  setDepartmentScope(scope.key);
                  setSelectedCourse(null);
                }}
              className={`rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
                  active
                    ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
                }`}
              >
                {scope.label}
                
              </button>
            );
          })}
        </div>

      {toolbar}

      {exportFilenameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] bg-opacity-50"
            onClick={() => {
              setExportFilenameModalOpen(false);
              setPendingExport(null);
            }}
          ></div>
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full relative z-10">
            <div className="px-8 py-4 border-b border-slate-200 bg-slate-100 rounded-t-2xl">
              <h2 className="text-lg font-medium">Export File Name</h2>
            </div>
            <div className="px-8 py-4">
              <p className="text-sm text-gray-600 mb-4">Enter the file name before exporting.</p>
              <div className="flex w-full items-center rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition">
                <input
                  type="text"
                  value={exportFilename}
                  onChange={(event) => setExportFilename(event.target.value)}
                  placeholder="module-payments-export"
                  autoFocus
                  className="flex-1 rounded-l-lg bg-transparent px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
                <span className="flex items-center rounded-r-lg border-l border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500">
                  .xlsx
                </span>
              </div>
              <div className="flex justify-end gap-2 mt-8">
                <button
                  type="button"
                  className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setExportFilenameModalOpen(false);
                    setPendingExport(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-1.5 text-sm w-24 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                  onClick={handleExportConfirm}
                  disabled={!exportFilename.trim()}
                >
                  Export
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 ">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Offered Modules</p>
          <p className="text-2xl font-semibold text-slate-900">{moduleRows.length}</p>
        </div>
    
        <div className="rounded-lg border border-slate-200 bg-white p-5 ">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collected</p>
          <p className="text-2xl font-semibold text-emerald-700">{formatCurrency(grandTotals.totalCollected)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 ">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remaining Balance</p>
          <p className="text-2xl font-semibold text-amber-700">{formatCurrency(grandTotals.totalRemainingBalance)}</p>
        </div>
      </div>

      {!loading && moduleRows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No offered modules found for the selected department and active term.
        </div>
      ) : loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-3xl bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {moduleRows.map((course) => (
            <section key={course.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white ">
              <button
                type="button"
                onClick={() => setSelectedCourse({ professor: null, course })}
                className="w-full text-left cursor-pointer "
              >
                <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Offered Module</p>
                    <h3 className="text-lg font-semibold text-slate-900">{course.courseCode || '—'} - {course.courseTitle || '—'}</h3>
                    <p className="text-sm text-slate-500">
                      {course.professorName || course.professor || '—'} · {getYearLevelLabel(course.yearLevel)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 sm:grid-cols-3">
               
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-center">
                      <div className="uppercase text-slate-400">Students</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{course.totalStudents || 0}</div>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-center">
                      <div className="uppercase text-slate-400">Collected</div>
                      <div className="mt-1 text-sm font-semibold text-emerald-700">{formatCurrency(course.totalCollected || 0)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-center">
                      <div className="uppercase text-slate-400">Remaining</div>
                      <div className="mt-1 text-sm font-semibold text-amber-700">{formatCurrency(course.totalRemainingBalance || 0)}</div>
                    </div>
                  </div>
                </div>
              </button>

              <div className="p-4">
                  <div className="overflow-x-auto rounded-lg border border-slate-200 ">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Block</th>
                      <th className="px-4 py-3 text-left font-semibold">Students</th>
                      <th className="px-4 py-3 text-left font-semibold">Paid</th>
                      <th className="px-4 py-3 text-left font-semibold">Collected</th>
                      <th className="px-4 py-3 text-left font-semibold">Remaining Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(course.blockGroups || []).map((group) => (
                      <tr
                        key={group.block}
                        className="border-t border-slate-200 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setSelectedCourse({ professor: null, course, block: group.block })}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">{group.block}</td>
                        <td className="px-4 py-3 text-slate-700">{group.totalStudents}</td>
                        <td className="px-4 py-3 text-blue-700 font-medium">{group.paidStudents || 0}</td>
                        <td className="px-4 py-3 text-emerald-700 font-medium">{formatCurrency(group.totalPaidAmount || 0)}</td>
                        <td className="px-4 py-3 text-amber-700 font-medium">{formatCurrency(group.totalRemainingBalance || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            </section>
          ))}
        </div>
      )}

      <CourseModal
        open={!!selectedCourse}
        onClose={() => setSelectedCourse(null)}
        course={selectedCourse?.course || null}
        initialBlock={selectedCourse?.block || ''}
        onExport={exportCurrentCourse}
      />
    </div>
  );
};

export default ModulePaymentsGroupedReport;
