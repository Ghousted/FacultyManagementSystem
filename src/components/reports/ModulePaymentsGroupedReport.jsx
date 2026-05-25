import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import {
  ArrowBigLeft,
  ChevronDown,
  Download,
  FileSpreadsheet,
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

const loadCourseStudentsFromPayables = async ({ course, baseStudents = [], payablePackets = [] }) => {
  const studentsById = new Map();

  baseStudents.forEach((student) => {
    if (student?.id) studentsById.set(student.id, student);
  });

  const payableStudentIds = new Set();
  payablePackets.forEach(({ payable, payments }) => {
    Object.keys(payable?.studentPayments || {}).forEach((studentId) => payableStudentIds.add(studentId));
    Object.keys(payments || {}).forEach((studentId) => payableStudentIds.add(studentId));
  });

  await Promise.all(Array.from(payableStudentIds).map(async (studentId) => {
    if (!studentId || studentsById.has(studentId)) return;
    const student = await fetchStudentById(course, studentId);
    if (student) studentsById.set(student.id, student);
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

const formatCurrency = (value) => `₱${Number(value || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

const getYearLevelLabel = (yearLevel) => YEAR_LEVEL_LABELS[Number(yearLevel)] || 'Other';

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
  const cleaned = normalizeText(name || 'Sheet').replace(/[\\/?*\[\]:]/g, '-');
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

const buildModulePaymentsWorkbook = (courses, { filename, scopeLabel, termLabel, includeSummarySheet = true }) => {
  const workbook = XLSX.utils.book_new();
  const groupedCourses = new Map(YEAR_LEVELS.map((year) => [year, []]));

  (courses || []).forEach((course) => {
    const yearLevel = Number(course?.yearLevel);
    if (!groupedCourses.has(yearLevel)) return;
    groupedCourses.get(yearLevel).push(course);
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

  const buildYearSheet = (yearLevel) => {
    const yearCourses = (groupedCourses.get(yearLevel) || []).slice().sort((left, right) => {
      const codeA = normalizeCode(left.courseCode || left.courseTitle || '');
      const codeB = normalizeCode(right.courseCode || right.courseTitle || '');
      if (codeA !== codeB) return codeA.localeCompare(codeB);
      return normalizeText(left.courseTitle || '').localeCompare(normalizeText(right.courseTitle || ''));
    });

    const rows = [];
    const rowTypes = [];
    const merges = [];

    const pushRow = (values, type = 'data', merge = false) => {
      rows.push(values);
      rowTypes.push(type);
      if (merge) {
        const rowIndex = rows.length - 1;
        merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 5 } });
      }
    };

    if (yearCourses.length === 0) {
      pushRow([`${getYearLevelLabel(yearLevel)} Module Payments`], 'title', true);
      pushRow([termLabel || 'Current Term'], 'subtitle', true);
      pushRow(['No modules found for this year level.'], 'empty', true);
    } else {
      const yearStats = yearCourses.reduce((accumulator, course) => {
        accumulator.modules += 1;
        accumulator.students += Number(course.totalStudents || 0);
        accumulator.collected += Number(course.totalCollected || 0);
        accumulator.remaining += Number(course.totalRemainingBalance || 0);
        return accumulator;
      }, { modules: 0, students: 0, collected: 0, remaining: 0 });

      pushRow([`${getYearLevelLabel(yearLevel)} Module Payments`], 'title', true);
      pushRow([`${termLabel || 'Current Term'} · ${scopeLabel || 'Full Report'}`], 'subtitle', true);
      pushRow([
        `Modules: ${yearStats.modules}`,
        `Students: ${yearStats.students}`,
        `Collected: ${formatCurrency(yearStats.collected)}`,
        `Remaining: ${formatCurrency(yearStats.remaining)}`,
        '',
        ''
      ], 'summary');
      pushRow(['', '', '', '', '', ''], 'spacer');

      yearCourses.forEach((course) => {
        const blockLabels = (course.blockGroups || []).map((group) => group.block).filter(Boolean).join(', ') || '—';
        pushRow([`${normalizeText(course.courseCode || '—')} - ${normalizeText(course.courseTitle || 'Untitled Module')}`], 'moduleHeader', true);
        pushRow([
          `Professor: ${normalizeText(course.professorName || course.professor || '—')} · Year Level: ${getYearLevelLabel(course.yearLevel)} · Blocks: ${blockLabels} · Collected: ${formatCurrency(course.totalCollected || 0)} · Remaining: ${formatCurrency(course.totalRemainingBalance || 0)}`
        ], 'moduleMeta', true);

        if (!course.blockGroups || course.blockGroups.length === 0) {
          pushRow(['No active-term students found for this module.'], 'empty', true);
          pushRow(['', '', '', '', '', ''], 'spacer');
          return;
        }

        course.blockGroups.forEach((group) => {
          pushRow([`Block ${group.block || '—'}`], 'blockHeader', true);
          pushRow(['No.', 'Student Name', 'Block', 'Amount Paid', 'Payment Date', 'Remaining Balance'], 'tableHeader');

          if (!group.rows || group.rows.length === 0) {
            pushRow(['', 'No students found', '', '', '', ''], 'data');
          } else {
            group.rows.forEach((row, index) => {
              pushRow([
                String(index + 1),
                row.name || '—',
                row.block || '—',
                formatCurrency(row.paidAmount || 0),
                row.lastPaymentDate ? formatDate(row.lastPaymentDate) : '',
                row.amountRequired > 0 ? formatCurrency(row.remainingBalance || 0) : ''
              ], 'data');
            });
          }

          pushRow(['', '', '', '', '', ''], 'spacer');
        });
      });
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!merges'] = merges;

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

    rowTypes.forEach((type, rowIndex) => {
      const rowStyle = styles[type] || styles.data;
      for (let columnIndex = 0; columnIndex < 6; columnIndex += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        if (!worksheet[cellAddress]) continue;
        styleCell(worksheet, cellAddress, rowStyle);

        if (type === 'data') {
          styleCell(worksheet, cellAddress, {
            alignment: {
              horizontal: columnIndex === 1 ? 'left' : columnIndex === 3 || columnIndex === 5 ? 'right' : columnIndex === 4 ? 'center' : 'center',
              vertical: 'center',
              wrapText: columnIndex === 1
            }
          });
        }
      }
    });

    const widths = [6, 34, 12, 16, 16, 18];
    rows.forEach((row, rowIndex) => {
      if (rowTypes[rowIndex] !== 'tableHeader' && rowTypes[rowIndex] !== 'data') return;
      row.forEach((cell, columnIndex) => {
        if (cell === null || typeof cell === 'undefined' || cell === '') return;
        widths[columnIndex] = Math.max(widths[columnIndex], Math.min(42, String(cell).length + 2));
      });
    });
    worksheet['!cols'] = widths.map((width) => ({ wch: width }));

    return worksheet;
  };

  if (includeSummarySheet) {
    const summaryRows = [
      ['Module Payments Report'],
      [termLabel || 'Current Term'],
      [],
      ['Year Level', 'Modules', 'Students', 'Collected', 'Remaining']
    ];

    let grandModules = 0;
    let grandStudents = 0;
    let grandCollected = 0;
    let grandRemaining = 0;

    YEAR_LEVELS.forEach((yearLevel) => {
      const yearCourses = groupedCourses.get(yearLevel) || [];
      const modules = yearCourses.length;
      const students = yearCourses.reduce((sum, course) => sum + Number(course.totalStudents || 0), 0);
      const collected = yearCourses.reduce((sum, course) => sum + Number(course.totalCollected || 0), 0);
      const remaining = yearCourses.reduce((sum, course) => sum + Number(course.totalRemainingBalance || 0), 0);
      grandModules += modules;
      grandStudents += students;
      grandCollected += collected;
      grandRemaining += remaining;
      summaryRows.push([
        getYearLevelLabel(yearLevel),
        modules,
        students,
        formatCurrency(collected),
        formatCurrency(remaining)
      ]);
    });

    summaryRows.push([]);
    summaryRows.push(['Grand Total', grandModules, grandStudents, formatCurrency(grandCollected), formatCurrency(grandRemaining)]);

    const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summaryWorksheet['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
    summaryWorksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }];

    styleCell(summaryWorksheet, 'A1', {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 16 },
      fill: { patternType: 'solid', fgColor: { rgb: '1E3A8A' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder
    });
    styleCell(summaryWorksheet, 'A2', {
      font: { bold: true, color: { rgb: '334155' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder
    });
    for (let columnIndex = 0; columnIndex < 5; columnIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: 3, c: columnIndex });
      styleCell(summaryWorksheet, cellAddress, {
        font: { bold: true, color: { rgb: '1F2937' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'BFDBFE' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder
      });
    }
    for (let rowIndex = 4; rowIndex < summaryRows.length; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < 5; columnIndex += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        if (!summaryWorksheet[cellAddress]) continue;
        styleCell(summaryWorksheet, cellAddress, {
          border: thinBorder,
          alignment: { horizontal: columnIndex === 0 ? 'left' : 'center', vertical: 'center' }
        });
      }
    }

    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
  }

  YEAR_LEVELS.forEach((yearLevel) => {
    const worksheet = buildYearSheet(yearLevel);
    XLSX.utils.book_append_sheet(workbook, worksheet, dedupeSheetName(workbook, getYearLevelLabel(yearLevel)));
  });

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);
};

const exportSelectedCourses = (courses, filename, options = {}) => {
  buildModulePaymentsWorkbook(courses, {
    filename,
    scopeLabel: options.scopeLabel || 'Current View',
    termLabel: options.termLabel || 'Current Term',
    includeSummarySheet: options.includeSummarySheet !== false
  });
};

const CourseModal = ({ open, onClose, course, onExport }) => {
  const [activeBlock, setActiveBlock] = useState('');

  useEffect(() => {
    const nextBlock = (course?.blockGroups || [])[0]?.block || '';
    setActiveBlock(nextBlock);
  }, [course]);

  if (!open || !course) return null;

  const blockGroups = course.blockGroups || [];
  const selectedBlock = blockGroups.find((group) => group.block === activeBlock) || blockGroups[0] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Module Payments</p>
            <h3 className="text-2xl font-semibold text-slate-900">{course.courseCode} - {course.courseTitle}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {course.professorName || course.professor || '—'} · {course.source === 'other-department'
                ? `${course.departmentName || 'Other Department'} - ${course.classCourse || 'Class'}`
                : (course.curriculumName || 'CCS Department')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onExport(course)}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" /> Export
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(90vh-88px)] overflow-y-auto px-6 py-5">
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Year Level</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{course.yearLevel || '—'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Blocks</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{(course.blockGroups || []).map((group) => group.block).join(', ') || '—'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Collected</p>
              <p className="mt-1 text-lg font-semibold text-emerald-700">{formatCurrency(course.totalCollected || 0)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
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
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900">Year Level {course.yearLevel || '—'} · Block {selectedBlock?.block || '—'}</h4>
                    <p className="text-sm text-slate-500">{selectedBlock?.totalStudents || 0} student{(selectedBlock?.totalStudents || 0) === 1 ? '' : 's'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center">
                      <div className="uppercase text-slate-400">Collected</div>
                      <div className="mt-1 text-sm font-semibold text-emerald-700">{formatCurrency(selectedBlock?.totalPaidAmount || 0)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center">
                      <div className="uppercase text-slate-400">Remaining</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(selectedBlock?.totalRemainingBalance || 0)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center">
                      <div className="uppercase text-slate-400">Paid</div>
                      <div className="mt-1 text-sm font-semibold text-blue-700">{selectedBlock?.paidStudents || 0}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center">
                      <div className="uppercase text-slate-400">Fully Paid</div>
                      <div className="mt-1 text-sm font-semibold text-amber-700">{selectedBlock?.fullyPaidStudents || 0}</div>
                    </div>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  {blockGroups.map((group) => (
                    <button
                      key={group.block}
                      type="button"
                      onClick={() => setActiveBlock(group.block)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        activeBlock === group.block
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Block {group.block} · {group.totalStudents}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">No.</th>
                        <th className="px-4 py-3 text-left font-semibold">Year Level</th>
                        <th className="px-4 py-3 text-left font-semibold">Block</th>
                        <th className="px-4 py-3 text-left font-semibold">Student Name</th>
                        <th className="px-4 py-3 text-left font-semibold">Amount Paid</th>
                        <th className="px-4 py-3 text-left font-semibold">Date of Payment</th>
                        <th className="px-4 py-3 text-left font-semibold">Remaining Balance</th>
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
                          <td className="px-4 py-3 text-slate-700">{row.yearLevel || '—'}</td>
                          <td className="px-4 py-3 text-slate-700">{row.block || '—'}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                          <td className="px-4 py-3 text-slate-700">{formatCurrency(row.paidAmount || 0)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(row.lastPaymentDate) || '—'}</td>
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
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const toolbarRef = useRef(null);

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
            payablePackets
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
    const handlePointerDown = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return professors.map((professor) => ({
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
  }, [professors, search]);

  const allCourses = useMemo(() => flattenCourses(professors), [professors]);
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

  const handleExport = useCallback((courses, filename, includeSummarySheet = true, scopeLabel = 'Full Report') => {
    exportSelectedCourses(courses, filename, {
      scopeLabel,
      termLabel: activeTermLabel,
      includeSummarySheet
    });
    setExportMenuOpen(false);
  }, [activeTermLabel]);

  const exportCurrentCourse = useCallback((course) => {
    const safeName = normalizeCode(course?.courseCode || course?.courseTitle || 'module_payments') || 'module_payments';
    exportSelectedCourses([course], `${safeName}.xlsx`, {
      scopeLabel: 'Selected Module',
      termLabel: activeTermLabel,
      includeSummarySheet: false
    });
  }, [activeTermLabel]);

  const exportItems = [
    {
      key: 'excel',
      label: 'Export Excel',
      description: 'Full workbook with a summary sheet and year-level tabs.',
      action: () => handleExport(allCourses, `module_payments_${normalizeCode(activeTermLabel || 'current_term') || 'current_term'}.xlsx`, true, 'Full Report')
    },
    {
      key: 'per-year',
      label: 'Export Per Year Level',
      description: 'Workbook with only the year-level sheets.',
      action: () => handleExport(allCourses, `module_payments_by_year_${normalizeCode(activeTermLabel || 'current_term') || 'current_term'}.xlsx`, false, 'Per Year Level')
    },
    {
      key: 'current',
      label: 'Export Current View',
      description: 'Export the modules currently visible after search filtering.',
      action: () => handleExport(visibleCourses, `module_payments_current_view_${normalizeCode(activeTermLabel || 'current_term') || 'current_term'}.xlsx`, true, 'Current View')
    }
  ];

  const toolbar = (
    <div ref={toolbarRef} className="sticky top-4 z-30 mb-5 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search professor, subject, code, or course..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs text-slate-500">
            <div className="font-medium text-slate-700">Active term</div>
            <div>{activeTermLabel}</div>
          </div>

          <button
            type="button"
            onClick={loadReport}
            disabled={loading}
            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen((open) => !open)}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-4 w-4" />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                {exportItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.action}
                    className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                  >
                    <FileSpreadsheet className="mt-0.5 h-4 w-4 text-blue-600" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-500">{item.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Module Payments' }]} />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            {onBackToReportsMain && (
              <button
                type="button"
                onClick={onBackToReportsMain}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700"
                aria-label="Back to reports"
              >
                <ArrowBigLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Reports</p>
              <h2 className="text-3xl font-semibold text-slate-900">Module Payments Report</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
                Review module payments by professor, then export the current view or a year-level workbook in the same style used across the payables system.
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {toolbar}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Offered Modules</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{moduleRows.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Year Groups</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{grandTotals.handledCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collected</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{formatCurrency(grandTotals.totalCollected)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remaining Balance</p>
          <p className="mt-2 text-3xl font-semibold text-amber-700">{formatCurrency(grandTotals.totalRemainingBalance)}</p>
        </div>
      </div>

      {!loading && moduleRows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No offered modules found for the active term.
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
            <section key={course.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setSelectedCourse({ professor: null, course })}
                className="w-full text-left"
              >
                <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Offered Module</p>
                    <h3 className="text-lg font-semibold text-slate-900">{course.courseCode || '—'} - {course.courseTitle || '—'}</h3>
                    <p className="text-sm text-slate-500">
                      {course.professorName || course.professor || '—'} · Year {course.yearLevel || '—'} · {course.source === 'other-department' ? course.departmentName || 'Other Department' : 'CCS Department'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 sm:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
                      <div className="uppercase text-slate-400">Blocks</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{(course.blockGroups || []).map((group) => group.block).join(', ') || '—'}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
                      <div className="uppercase text-slate-400">Students</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{course.totalStudents || 0}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
                      <div className="uppercase text-slate-400">Collected</div>
                      <div className="mt-1 text-sm font-semibold text-emerald-700">{formatCurrency(course.totalCollected || 0)}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
                      <div className="uppercase text-slate-400">Remaining</div>
                      <div className="mt-1 text-sm font-semibold text-amber-700">{formatCurrency(course.totalRemainingBalance || 0)}</div>
                    </div>
                  </div>
                </div>
              </button>

              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
                {(course.blockGroups || []).map((group) => (
                  <div key={group.block} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Block</p>
                        <h4 className="text-base font-semibold text-slate-900">{group.block}</h4>
                      </div>
                      <div className="rounded-full bg-white p-2 text-blue-600 shadow-sm">
                        <FolderOpen className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
                        <span>Students</span>
                        <span className="font-semibold text-slate-900">{group.totalStudents}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
                        <span>Paid</span>
                        <span className="font-semibold text-blue-700">{group.paidStudents || 0}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
                        <span>Collected</span>
                        <span className="font-semibold text-emerald-700">{formatCurrency(group.totalPaidAmount || 0)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
                        <span>Remaining</span>
                        <span className="font-semibold text-amber-700">{formatCurrency(group.totalRemainingBalance || 0)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <CourseModal
        open={!!selectedCourse}
        onClose={() => setSelectedCourse(null)}
        course={selectedCourse?.course || null}
        onExport={exportCurrentCourse}
      />
    </div>
  );
};

export default ModulePaymentsGroupedReport;
