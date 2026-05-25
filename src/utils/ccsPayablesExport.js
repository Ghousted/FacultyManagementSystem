import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

const numberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeExportText = (value) => String(value || '').replace(/[\\/?*\[\]:]/g, '-').trim() || 'payables';

const formatDateLabel = (rawValue) => {
  if (!rawValue) return '';

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return '';

  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${month}/${day}/${year}`;
};

const getTermKey = (term) => `${term?.semester || 'na'}|${term?.schoolYear || ''}`;

const getTermLabel = (term) => {
  if (!term?.semester || !term?.schoolYear) return 'Current Term';
  const semesterLabel = term.semester === 1 ? '1st Semester' : term.semester === 2 ? '2nd Semester' : 'Summer';
  return `${semesterLabel} · S.Y. ${term.schoolYear}`;
};

const getYearLabel = (yearLevel) => {
  const numeric = Number(yearLevel);
  if (!Number.isFinite(numeric)) return 'All Year Levels';
  if (numeric === 1) return '1st Year';
  if (numeric === 2) return '2nd Year';
  if (numeric === 3) return '3rd Year';
  if (numeric === 4) return '4th Year';
  return `${numeric}th Year`;
};

const getStudentTerm = (student, activeTerm) => {
  const term = student?.enrolledTerm || student?.createdTerm || null;
  if (term && (term.semester || term.schoolYear)) {
    return {
      semester: Number(term.semester) || activeTerm?.semester || null,
      schoolYear: term.schoolYear || activeTerm?.schoolYear || ''
    };
  }

  return {
    semester: activeTerm?.semester || null,
    schoolYear: activeTerm?.schoolYear || ''
  };
};

const getStudentTermKey = (student, activeTerm) => getTermKey(getStudentTerm(student, activeTerm));

const getPayableTerm = (payable) => {
  const term = payable?.createdTerm || null;
  if (term && (term.semester || term.schoolYear)) {
    return {
      semester: Number(term.semester) || null,
      schoolYear: term.schoolYear || ''
    };
  }

  return {
    semester: Number(payable?.semester) || null,
    schoolYear: payable?.schoolYear || ''
  };
};

const isPayableInActiveTerm = (payable, activeTerm) => {
  if (!activeTerm?.semester || !activeTerm?.schoolYear) return false;

  const term = getPayableTerm(payable);
  if (!term.semester || !term.schoolYear) return false;

  return (
    Number(term.semester) === Number(activeTerm.semester) &&
    String(term.schoolYear || '').trim() === String(activeTerm.schoolYear || '').trim()
  );
};

const getStudentBlock = (student) => String(student?.block || '').trim().toUpperCase() || 'A';

const getSortYearValue = (student) => {
  if (student?.isIrregular) return Number.MAX_SAFE_INTEGER;
  const numeric = Number(student?.yearLevel || 0);
  return Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER - 1;
};

const isStudentInSelectedFolder = (student, selectedFolder, activeTerm) => {
  if (!student || !selectedFolder) return false;

  if (selectedFolder.termKey && getStudentTermKey(student, activeTerm) !== selectedFolder.termKey) {
    return false;
  }

  const block = getStudentBlock(student);

  if (selectedFolder.isInactiveFolder) {
    return student.active === false;
  }

  if (selectedFolder.isIrregular) {
    return Boolean(student.isIrregular) && block === String(selectedFolder.block || '').trim().toUpperCase();
  }

  return student.active !== false && !student.isIrregular && Number(student.yearLevel) === Number(selectedFolder.year) && block === String(selectedFolder.block || '').trim().toUpperCase();
};

const getRelevantPayablesForStudent = (student, payablesByYear) => {
  if (!student || !payablesByYear) return [];

  const studentBlock = getStudentBlock(student);
  let basePayables = [];

  if (student.isIrregular) {
    basePayables = (payablesByYear[student.yearLevel] || [])
      .concat(payablesByYear.irregular || [])
      .concat(payablesByYear.all || []);
  } else {
    basePayables = (payablesByYear[student.yearLevel] || [])
      .concat(payablesByYear.all || []);
  }

  const individualAcrossYears = Object.values(payablesByYear)
    .flat()
    .filter((payable) => payable?.isIndividual && payable.studentId === student.id);

  const merged = new Map();

  basePayables.forEach((payable) => {
    if (!payable) return;
    const payableBlock = String(payable.block || 'all').trim().toUpperCase() || 'ALL';
    if (payableBlock !== 'ALL' && payableBlock !== studentBlock) return;
    if (!payable.isIndividual || payable.studentId === student.id) {
      merged.set(payable.id, payable);
    }
  });

  individualAcrossYears.forEach((payable) => {
    if (!payable) return;
    const payableBlock = String(payable.block || 'all').trim().toUpperCase() || 'ALL';
    if (payableBlock !== 'ALL' && payableBlock !== studentBlock) return;
    merged.set(payable.id, payable);
  });

  return Array.from(merged.values());
};

const summarizeStudent = (student, payablesByYear, activeTerm) => {
  const studentPayables = getRelevantPayablesForStudent(student, payablesByYear);
  let previousBalance = 0;
  let paidAmount = 0;
  let remainingBalance = 0;
  let moduleFees = 0;
  let latestPaymentDate = '';
  let paymentCount = 0;

  studentPayables.forEach((payable) => {
    const payableAmount = Math.max(0, numberOrZero(payable.amount));
    const paymentEntry = payable.studentPayments?.[student.id] || {};
    const voucherAmount = Math.max(0, numberOrZero(paymentEntry.voucherAmount));
    const paid = Math.max(0, numberOrZero(paymentEntry.paidAmount));
    const effectiveAmount = Math.max(0, payableAmount - voucherAmount);
    const payableRemaining = Math.max(0, effectiveAmount - paid);
    const storedPreviousBalance = payable.previousBalance ?? paymentEntry.previousBalance;
    const payableIsCurrentTerm = isPayableInActiveTerm(payable, activeTerm);

    if (!payableIsCurrentTerm) {
      previousBalance += Math.max(0, numberOrZero(typeof storedPreviousBalance !== 'undefined' ? storedPreviousBalance : effectiveAmount));
    }
    paidAmount += paid;
    remainingBalance += payableRemaining;

    if (String(payable.category || '').toLowerCase() === 'module') {
      moduleFees += effectiveAmount;
    }

    if (paid > 0 || voucherAmount > 0) {
      paymentCount += 1;
    }

    const paymentDate = paymentEntry.lastPaymentDate || paymentEntry.paymentDate || paymentEntry.date || paymentEntry.createdAt || paymentEntry.updatedAt;
    if (paymentDate) {
      const currentDate = new Date(paymentDate);
      const latestDate = latestPaymentDate ? new Date(latestPaymentDate) : null;
      if (!Number.isNaN(currentDate.getTime()) && (!latestDate || currentDate.getTime() > latestDate.getTime())) {
        latestPaymentDate = paymentDate;
      }
    }
  });

  return {
    previousBalance,
    paidAmount,
    remainingBalance,
    moduleFees,
    latestPaymentDate: formatDateLabel(latestPaymentDate),
    paymentTracking: paymentCount > 0 ? `${paymentCount} payment${paymentCount === 1 ? '' : 's'}` : 'No payment yet'
  };
};

const sortExportStudents = (students, scope) => {
  const list = [...(students || [])];

  if (scope === 'all-blocks') {
    return list.sort((left, right) => {
      const yearDiff = getSortYearValue(left) - getSortYearValue(right);
      if (yearDiff !== 0) return yearDiff;

      const blockDiff = String(getStudentBlock(left)).localeCompare(String(getStudentBlock(right)), undefined, { sensitivity: 'base', numeric: true });
      if (blockDiff !== 0) return blockDiff;

      return String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base', numeric: true });
    });
  }

  return list.sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base', numeric: true }));
};

const getTermTitleLabel = (term) => {
  if (!term?.semester || !term?.schoolYear) return 'CURRENT TERM';
  const semesterLabel = term.semester === 1 ? 'FIRST SEMESTER' : term.semester === 2 ? 'SECOND SEMESTER' : 'SUMMER';
  return `${semesterLabel} ${term.schoolYear}`.toUpperCase();
};

const getSheetBaseName = (student) => {
  if (student?.active === false) return 'inactive';
  if (student?.isIrregular) return 'irregular';
  return `${Number(student?.yearLevel) || 0}-${getStudentBlock(student).toLowerCase()}`;
};

const autoFitColumns = (rows, payableColumnsCount) => {
  const maxColumns = rows.reduce((max, row) => Math.max(max, row?.length || 0), 0);
  const widths = Array.from({ length: maxColumns }, (_, columnIndex) => {
    if (columnIndex === 0) return 6;
    if (columnIndex === 1) return 28;
    if (columnIndex === 2 || columnIndex === 3 || columnIndex === 4) return 14;
    if (columnIndex === maxColumns - 1) return 14;
    return payableColumnsCount > 0 && columnIndex >= 5 ? 12 : 12;
  });

  rows.slice(1).forEach((row) => {
    row.forEach((value, columnIndex) => {
      if (value === null || typeof value === 'undefined' || value === '') return;
      const text = String(value);
      const baseWidth = Math.min(36, Math.max(8, text.length + 2));
      widths[columnIndex] = Math.max(widths[columnIndex] || 0, baseWidth);
    });
  });

  return widths.map((width, columnIndex) => {
    const minWidth = columnIndex === 0 ? 6 : columnIndex === 1 ? 28 : columnIndex === maxColumns - 1 ? 14 : 12;
    return { wch: Math.max(minWidth, Math.min(width || minWidth, 36)) };
  });
};

const buildPayableColumns = (students, payablesByYear, selectedFolder, activeTerm, scope) => {
  const ordered = [];
  const seen = new Set();
  const exportStudents = scope === 'all-blocks'
    ? (students || []).filter((student) => student.active !== false && getStudentTermKey(student, activeTerm) === (selectedFolder?.termKey || getTermKey(activeTerm)))
    : (students || []);

  exportStudents.forEach((student) => {
    getRelevantPayablesForStudent(student, payablesByYear).forEach((payable) => {
      if (!isPayableInActiveTerm(payable, activeTerm)) return;
      if (!payable || seen.has(payable.id)) return;
      seen.add(payable.id);
      ordered.push(payable);
    });
  });

  return ordered.sort((left, right) => {
    const categoryA = String(left.category || '').toLowerCase() === 'module' ? 1 : 0;
    const categoryB = String(right.category || '').toLowerCase() === 'module' ? 1 : 0;
    if (categoryA !== categoryB) return categoryA - categoryB;

    const codeA = String(left.moduleCode || left.type || left.moduleTitle || left.title || '').toLowerCase();
    const codeB = String(right.moduleCode || right.type || right.moduleTitle || right.title || '').toLowerCase();
    return codeA.localeCompare(codeB, undefined, { sensitivity: 'base', numeric: true });
  });
};

const buildWorksheet = ({ students, payablesByYear, selectedFolder, activeTerm, scope, sheetTitle }) => {
  const rows = [];
  const styles = {};
  const merges = [];
  const filteredStudents = sortExportStudents(students, scope);
  const payableColumns = buildPayableColumns(filteredStudents, payablesByYear, selectedFolder, activeTerm, scope);

  const summary = filteredStudents.reduce((accumulator, student) => {
    const studentSummary = summarizeStudent(student, payablesByYear, activeTerm);
    accumulator.previousBalance += studentSummary.previousBalance;
    accumulator.paidAmount += studentSummary.paidAmount;
    accumulator.remainingBalance += studentSummary.remainingBalance;
    accumulator.moduleFees += studentSummary.moduleFees;
    return accumulator;
  }, {
    previousBalance: 0,
    paidAmount: 0,
    remainingBalance: 0,
    moduleFees: 0
  });

  const border = {
    top: { style: 'thin' },
    bottom: { style: 'thin' },
    left: { style: 'thin' },
    right: { style: 'thin' }
  };

  const titleStyle = {
    font: { bold: true, color: { rgb: '1F2937' }, sz: 16 },
    fill: { patternType: 'solid', fgColor: { rgb: 'F3D46B' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border
  };

  const summaryHeaderStyle = {
    font: { bold: true, color: { rgb: '1F2937' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F8E8A4' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border
  };

  const payableHeaderStyle = {
    font: { bold: true, color: { rgb: '1F2937' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'F6DD87' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border
  };

  const subHeaderStyle = {
    font: { bold: true, color: { rgb: '374151' }, sz: 10 },
    fill: { patternType: 'solid', fgColor: { rgb: 'F9EFB5' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border
  };

  const textStyle = {
    alignment: { horizontal: 'left', vertical: 'center' },
    border
  };

  const indexStyle = {
    alignment: { horizontal: 'center', vertical: 'center' },
    border
  };

  const amountStyle = {
    numFmt: '₱#,##0.00',
    alignment: { horizontal: 'right', vertical: 'center' },
    border
  };

  const totalStyle = {
    numFmt: '₱#,##0.00',
    font: { bold: true, color: { rgb: '14532D' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border,
    fill: { patternType: 'solid', fgColor: { rgb: 'CDECCB' } }
  };

  const footerLabelStyle = {
    font: { bold: true, color: { rgb: '1F2937' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'E7F0D9' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border
  };

  const footerAmountStyle = {
    ...totalStyle,
    fill: { patternType: 'solid', fgColor: { rgb: 'CDECCB' } }
  };

  const setCell = (rowIndex, columnIndex, value, style) => {
    while (rows.length <= rowIndex) {
      rows.push([]);
    }

    rows[rowIndex][columnIndex] = value;

    if (!style) return;

    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
    styles[cellAddress] = {
      ...(styles[cellAddress] || {}),
      ...style
    };
  };

  const mergeRow = (rowIndex, startColumn, endColumn) => {
    merges.push({ s: { r: rowIndex, c: startColumn }, e: { r: rowIndex, c: endColumn } });
  };

  const baseColumnCount = 5;
  const totalColumnIndex = baseColumnCount + (payableColumns.length * 2);

  setCell(0, 0, sheetTitle, titleStyle);
  mergeRow(0, 0, totalColumnIndex);

  setCell(1, 0, 'No.', summaryHeaderStyle);
  mergeRow(1, 0, 1);
  setCell(1, 1, 'Student Name', summaryHeaderStyle);
  mergeRow(1, 1, 1);
  setCell(1, 2, 'Previous Balance', summaryHeaderStyle);
  mergeRow(1, 2, 2);
  setCell(1, 3, 'Paid Amount', summaryHeaderStyle);
  mergeRow(1, 3, 3);
  setCell(1, 4, 'Remaining Balance', summaryHeaderStyle);
  mergeRow(1, 4, 4);

  payableColumns.forEach((payable, index) => {
    const amountColumn = baseColumnCount + (index * 2);
    const dateColumn = amountColumn + 1;
    const payableLabel = String(payable.moduleCode || payable.moduleTitle || payable.type || payable.title || 'Payable').trim();
    setCell(1, amountColumn, payableLabel, payableHeaderStyle);
    mergeRow(1, amountColumn, dateColumn);
    setCell(2, amountColumn, 'Amount', subHeaderStyle);
    setCell(2, dateColumn, 'Payment Date', subHeaderStyle);
  });

  setCell(1, totalColumnIndex, 'Total Balance', summaryHeaderStyle);
  mergeRow(1, totalColumnIndex, totalColumnIndex);

  let currentRow = 3;

  filteredStudents.forEach((student, index) => {
    const studentSummary = summarizeStudent(student, payablesByYear, activeTerm);
    const studentPayables = getRelevantPayablesForStudent(student, payablesByYear);
    const studentPayableIds = new Set(studentPayables.map((payable) => payable.id));
    setCell(currentRow, 0, index + 1, indexStyle);
    setCell(currentRow, 1, student.name || 'Unknown Student', textStyle);
    setCell(currentRow, 2, studentSummary.previousBalance, amountStyle);
    setCell(currentRow, 3, studentSummary.paidAmount, amountStyle);
    setCell(currentRow, 4, studentSummary.remainingBalance, totalStyle);

    payableColumns.forEach((payable, payableIndex) => {
      const amountColumn = baseColumnCount + (payableIndex * 2);
      const dateColumn = amountColumn + 1;
      const paymentEntry = payable.studentPayments?.[student.id] || {};
      const hasPayable = studentPayableIds.has(payable.id);
      const payableAmount = hasPayable ? Math.max(0, numberOrZero(payable.amount)) : '';
      const paymentDate = formatDateLabel(paymentEntry.lastPaymentDate || paymentEntry.paymentDate || paymentEntry.date || paymentEntry.createdAt || paymentEntry.updatedAt);
      setCell(currentRow, amountColumn, payableAmount, amountStyle);
      setCell(currentRow, dateColumn, hasPayable ? paymentDate : '', textStyle);
    });

    setCell(currentRow, totalColumnIndex, studentSummary.remainingBalance, totalStyle);
    currentRow += 1;
  });

  const footerRowIndex = currentRow;
  setCell(footerRowIndex, 0, 'Grand Total', footerLabelStyle);
  mergeRow(footerRowIndex, 0, 1);
  setCell(footerRowIndex, 2, summary.previousBalance, footerAmountStyle);
  setCell(footerRowIndex, 3, summary.paidAmount, footerAmountStyle);
  setCell(footerRowIndex, 4, summary.remainingBalance, footerAmountStyle);

  payableColumns.forEach((payable, payableIndex) => {
    const amountColumn = baseColumnCount + (payableIndex * 2);
    const dateColumn = amountColumn + 1;
    const totalDueForPayable = filteredStudents.reduce((sum, student) => {
      const studentPayables = getRelevantPayablesForStudent(student, payablesByYear);
      const hasPayable = studentPayables.some((studentPayable) => studentPayable.id === payable.id);
      return sum + (hasPayable ? Math.max(0, numberOrZero(payable.amount)) : 0);
    }, 0);
    setCell(footerRowIndex, amountColumn, totalDueForPayable, footerAmountStyle);
    setCell(footerRowIndex, dateColumn, '', footerLabelStyle);
  });

  setCell(footerRowIndex, totalColumnIndex, summary.remainingBalance, footerAmountStyle);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!merges'] = merges;
  worksheet['!cols'] = autoFitColumns(rows, payableColumns.length);
  worksheet['!pageSetup'] = {
    orientation: 'landscape',
    fitToWidth: 1,
    fitToHeight: 0
  };

  Object.keys(styles).forEach((cellAddress) => {
    if (!worksheet[cellAddress]) {
      worksheet[cellAddress] = { t: 's', v: '' };
    }
    worksheet[cellAddress].s = {
      ...(worksheet[cellAddress].s || {}),
      ...styles[cellAddress]
    };
  });

  merges.forEach((mergeRange) => {
    const topLeft = XLSX.utils.encode_cell({ r: mergeRange.s.r, c: mergeRange.s.c });
    const topLeftStyle = styles[topLeft] || {};

    for (let row = mergeRange.s.r; row <= mergeRange.e.r; row += 1) {
      for (let column = mergeRange.s.c; column <= mergeRange.e.c; column += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: column });
        if (!worksheet[cellAddress]) {
          worksheet[cellAddress] = { t: 's', v: '' };
        }
        worksheet[cellAddress].s = {
          ...(worksheet[cellAddress].s || {}),
          ...topLeftStyle
        };
      }
    }
  });

  return { worksheet, filteredStudents, summary, payableColumns };
};

const buildAllBlockSheetGroups = (students, activeTerm) => {
  const grouped = new Map();

  (students || []).forEach((student) => {
    if (!student) return;

    if (student.active === false) {
      const inactiveKey = `inactive::${getStudentTermKey(student, activeTerm)}`;
      if (!grouped.has(inactiveKey)) {
        grouped.set(inactiveKey, {
          sortYear: Number.MAX_SAFE_INTEGER,
          block: '',
          title: `STUDENT PAYABLES INACTIVE ${getTermTitleLabel(activeTerm)}`,
          sheetName: 'inactive',
          students: []
        });
      }
      grouped.get(inactiveKey).students.push(student);
      return;
    }

    const block = getStudentBlock(student);
    const yearLabel = student.isIrregular ? 'IRREGULAR' : String(Number(student.yearLevel) || 0);
    const key = `${student.isIrregular ? 'IRREG' : Number(student.yearLevel) || 0}::${block}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        sortYear: student.isIrregular ? Number.MAX_SAFE_INTEGER : Number(student.yearLevel) || Number.MAX_SAFE_INTEGER - 1,
        block,
        title: student.isIrregular
          ? `STUDENT PAYABLES IRREGULAR ${getTermTitleLabel(activeTerm)}`
          : `STUDENT PAYABLES ${yearLabel}-${block} ${getTermTitleLabel(activeTerm)}`,
        sheetName: getSheetBaseName(student).slice(0, 31),
        students: []
      });
    }

    grouped.get(key).students.push(student);
  });

  return Array.from(grouped.values())
    .sort((left, right) => {
      const yearDiff = left.sortYear - right.sortYear;
      if (yearDiff !== 0) return yearDiff;
      return String(left.block || '').localeCompare(String(right.block || ''), undefined, { sensitivity: 'base', numeric: true });
    })
    .map((group) => ({
      ...group,
      students: group.students.sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base', numeric: true }))
    }));
};

export const exportCcsPayablesSpreadsheet = ({
  students,
  payablesByYear,
  selectedFolder,
  activeTerm,
  scope = 'current-folder',
  format = 'xlsx',
  filename
}) => {
  const selectedTermKey = selectedFolder?.termKey || getTermKey(activeTerm);
  const exportStudents = scope === 'all-blocks'
    ? (students || []).filter((student) => getStudentTermKey(student, activeTerm) === selectedTermKey)
    : (students || []).filter((student) => isStudentInSelectedFolder(student, selectedFolder, activeTerm));

  const defaultBaseName = scope === 'all-blocks'
    ? 'ccs-payables-all-blocks'
    : sanitizeExportText(selectedFolder?.label || 'ccs-payables-current-folder');
  const normalizedFilename = sanitizeExportText(filename || `${defaultBaseName}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`);
  const finalFilename = normalizedFilename.replace(/\.(xlsx|csv)$/i, '');

  if (scope === 'all-blocks') {
    const workbook = XLSX.utils.book_new();
    const groups = buildAllBlockSheetGroups(exportStudents, activeTerm);

    if (groups.length === 0) {
      const emptyWorksheet = buildWorksheet({
        students: [],
        payablesByYear,
        selectedFolder,
        activeTerm,
        scope,
        sheetTitle: buildSheetTitle('ALL BLOCKS', activeTerm)
      }).worksheet;
      XLSX.utils.book_append_sheet(workbook, emptyWorksheet, 'CS Payables');
    } else {
      groups.forEach((group) => {
        const worksheet = buildWorksheet({
          students: group.students,
          payablesByYear,
          selectedFolder,
          activeTerm,
          scope,
          sheetTitle: group.title
        }).worksheet;
        XLSX.utils.book_append_sheet(workbook, worksheet, group.sheetName || 'CS Payables');
      });
    }

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
    saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `${finalFilename}.xlsx`);
    return;
  }

  const { worksheet } = buildWorksheet({
    students: exportStudents,
    payablesByYear,
    selectedFolder,
    activeTerm,
    scope,
    sheetTitle: buildSheetTitle(selectedFolder?.label || 'CURRENT FOLDER', activeTerm)
  });

  if (format === 'csv') {
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    saveAs(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `${finalFilename}.csv`);
    return;
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'CS Payables');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
  saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `${finalFilename}.xlsx`);
};
