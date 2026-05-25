import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

const numberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatExportDate = (rawValue) => {
  if (!rawValue) return 'None';

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return 'None';

  return parsed.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const sanitizeExportText = (value) => String(value || '').replace(/[\\/?*[\]:]/g, '-').trim() || 'payables';

const getTermLabel = (term) => {
  if (!term?.semester || !term?.schoolYear) return 'Current Term';
  const semesterLabel = Number(term.semester) === 1 ? '1st Semester' : Number(term.semester) === 2 ? '2nd Semester' : 'Summer';
  return `${semesterLabel} S.Y. ${term.schoolYear}`;
};

const isPayableRelevantToStudent = (payable, student) => {
  if (!payable || !student) return false;
  if (payable.studentId) {
    return payable.studentId === student.id;
  }

  const targetCourse = String(payable.targetCourse || '').trim().toLowerCase();
  const targetYearLevel = String(payable.targetYearLevel || '').trim();
  const targetBlock = String(payable.targetBlock || '').trim().toUpperCase();

  if (targetCourse && String(student.course || '').trim().toLowerCase() !== targetCourse) {
    return false;
  }

  if (targetYearLevel && String(student.yearLevel || '').trim() !== targetYearLevel) {
    return false;
  }

  if (targetBlock) {
    const studentBlock = String(student.block || '').trim().toUpperCase();
    return targetBlock === studentBlock;
  }

  return true;
};

export const buildOtherDepartmentPayablesExportRows = ({
  students,
  payables,
  payments,
  paymentTotalsByStudentPayable
}) => {
  const summary = students.reduce((accumulator, student) => {
    const studentPayables = payables.filter((payable) => isPayableRelevantToStudent(payable, student));
    const previousBalance = studentPayables.reduce((sum, payable) => sum + numberOrZero(payable.amount), 0);
    const moduleFees = studentPayables
      .filter((payable) => String(payable.category || '').toLowerCase() === 'module')
      .reduce((sum, payable) => sum + numberOrZero(payable.amount), 0);
    const paidAmount = studentPayables.reduce((sum, payable) => {
      return sum + (paymentTotalsByStudentPayable[`${student.id}::${payable.id}`] || 0);
    }, 0);
    const remainingBalance = Math.max(previousBalance - paidAmount, 0);
    const studentPayments = payments
      .filter((payment) => payment.studentId === student.id)
      .sort((left, right) => new Date(right.createdAt || right.date || 0).getTime() - new Date(left.createdAt || left.date || 0).getTime());

    accumulator.previousBalance += previousBalance;
    accumulator.paidAmount += paidAmount;
    accumulator.remainingBalance += remainingBalance;
    accumulator.moduleFees += moduleFees;
    accumulator.paymentCount += studentPayments.length;

    return accumulator;
  }, {
    previousBalance: 0,
    paidAmount: 0,
    remainingBalance: 0,
    moduleFees: 0,
    paymentCount: 0
  });

  const rows = students.map((student, index) => {
    const studentPayables = payables.filter((payable) => isPayableRelevantToStudent(payable, student));
    const previousBalance = studentPayables.reduce((sum, payable) => sum + numberOrZero(payable.amount), 0);
    const moduleFees = studentPayables
      .filter((payable) => String(payable.category || '').toLowerCase() === 'module')
      .reduce((sum, payable) => sum + numberOrZero(payable.amount), 0);
    const paidAmount = studentPayables.reduce((sum, payable) => {
      return sum + (paymentTotalsByStudentPayable[`${student.id}::${payable.id}`] || 0);
    }, 0);
    const remainingBalance = Math.max(previousBalance - paidAmount, 0);
    const studentPayments = payments
      .filter((payment) => payment.studentId === student.id)
      .sort((left, right) => new Date(right.createdAt || right.date || 0).getTime() - new Date(left.createdAt || left.date || 0).getTime());
    const latestPayment = studentPayments[0];

    return [
      index + 1,
      student.gender || student.sex || 'N/A',
      student.name || 'Unknown Student',
      previousBalance,
      paidAmount,
      remainingBalance,
      formatExportDate(latestPayment?.createdAt || latestPayment?.date),
      moduleFees,
      studentPayments.length ? `${studentPayments.length} payment${studentPayments.length === 1 ? '' : 's'}` : 'No payment yet',
      remainingBalance
    ];
  });

  return { rows, summary };
};

const buildStudentPayableSummary = (student, payables, payments, paymentTotalsByStudentPayable) => {
  const studentPayables = payables.filter((payable) => isPayableRelevantToStudent(payable, student));
  const previousBalance = studentPayables.reduce((sum, payable) => sum + numberOrZero(payable.amount), 0);
  const moduleFees = studentPayables
    .filter((payable) => String(payable.category || '').toLowerCase() === 'module')
    .reduce((sum, payable) => sum + numberOrZero(payable.amount), 0);
  const paidAmount = studentPayables.reduce((sum, payable) => {
    return sum + (paymentTotalsByStudentPayable[`${student.id}::${payable.id}`] || 0);
  }, 0);
  const remainingBalance = Math.max(previousBalance - paidAmount, 0);
  const studentPayments = payments
    .filter((payment) => payment.studentId === student.id)
    .sort((left, right) => new Date(right.createdAt || right.date || 0).getTime() - new Date(left.createdAt || left.date || 0).getTime());
  const latestPayment = studentPayments[0];

  return {
    previousBalance,
    paidAmount,
    remainingBalance,
    moduleFees,
    paymentCount: studentPayments.length,
    latestPaymentDate: formatExportDate(latestPayment?.createdAt || latestPayment?.date)
  };
};

const getCourseLabel = (student) => String(student?.course || 'Unspecified Course').trim() || 'Unspecified Course';

const getYearLevelLabel = (yearLevel) => {
  const year = Number(yearLevel);
  if (!Number.isFinite(year)) return 'Year Level Not Set';
  if (year === 1) return '1st Year';
  if (year === 2) return '2nd Year';
  if (year === 3) return '3rd Year';
  if (year === 4) return '4th Year';
  return `${year}th Year`;
};

const buildCourseYearBlockGroups = (students) => {
  const grouped = new Map();

  (students || []).forEach((student) => {
    const normalizedCourse = getCourseLabel(student);
    const normalizedYear = String(student?.yearLevel || '').trim() || '0';
    const normalizedBlock = String(student?.block || '').trim().toUpperCase() || 'A';
    const key = `${normalizedCourse.toLowerCase()}::${normalizedYear}::${normalizedBlock}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        course: normalizedCourse,
        yearLevel: normalizedYear,
        block: normalizedBlock,
        students: []
      });
    }

    grouped.get(key).students.push(student);
  });

  return Array.from(grouped.values())
    .sort((left, right) => {
      const courseDiff = String(left.course || '').localeCompare(String(right.course || ''), undefined, { sensitivity: 'base', numeric: true });
      if (courseDiff !== 0) return courseDiff;
      const yearDiff = Number(left.yearLevel || 0) - Number(right.yearLevel || 0);
      if (yearDiff !== 0) return yearDiff;
      return String(left.block || '').localeCompare(String(right.block || ''), undefined, { sensitivity: 'base', numeric: true });
    })
    .map((group) => ({
      ...group,
      students: group.students.sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base', numeric: true }))
    }));
};

const buildAllBlocksWorksheet = ({
  students,
  payables,
  payments,
  paymentTotalsByStudentPayable,
  selectedDepartment,
  activeTerm
}) => {
  const groups = buildCourseYearBlockGroups(students);
  const departmentCode = String(selectedDepartment?.code || selectedDepartment?.name || 'DEPARTMENT').trim().toUpperCase();
  const termLabel = getTermLabel(activeTerm);

  const rows = [];
  const merges = [];
  const styles = {};
  const tableWidth = 4;
  const gapWidth = 1;
  const tablesPerRow = 3;
  const bandWidth = tablesPerRow * (tableWidth + gapWidth) - gapWidth;

  const ensureRow = (rowIndex) => {
    while (rows.length <= rowIndex) {
      rows.push([]);
    }
  };

  const setCell = (rowIndex, colIndex, value, style) => {
    ensureRow(rowIndex);
    rows[rowIndex][colIndex] = value;

    if (!style) return;

    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
    styles[cellAddress] = {
      ...(styles[cellAddress] || {}),
      ...style
    };
  };

  const mergeRow = (rowIndex, startCol, endCol) => {
    merges.push({ s: { r: rowIndex, c: startCol }, e: { r: rowIndex, c: endCol } });
  };

  const border = {
    top: { style: 'thin' },
    bottom: { style: 'thin' },
    left: { style: 'thin' },
    right: { style: 'thin' }
  };
  const titleStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
    fill: { patternType: 'solid', fgColor: { rgb: '1F2937' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border
  };
  const headerStyle = {
    font: { bold: true, color: { rgb: '111827' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'E5E7EB' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border
  };
  const cellStyle = {
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
  const dateStyle = {
    alignment: { horizontal: 'center', vertical: 'center' },
    border
  };
  const footerLabelStyle = {
    font: { bold: true, color: { rgb: '1E3A8A' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border
  };
  const footerValueStyle = {
    font: { bold: true },
    fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border,
    numFmt: '₱#,##0.00'
  };

  setCell(0, 0, `${departmentCode} OTHER DEPARTMENT PAYABLES`, titleStyle);
  mergeRow(0, 0, bandWidth - 1);
  setCell(1, 0, `Department: ${selectedDepartment?.name || 'Other Department'}`, cellStyle);
  mergeRow(1, 0, bandWidth - 1);
  setCell(2, 0, 'Export Scope: All Blocks', cellStyle);
  mergeRow(2, 0, bandWidth - 1);
  setCell(3, 0, `Semester / School Year: ${termLabel}`, cellStyle);
  mergeRow(3, 0, bandWidth - 1);

  let rowOffset = 5;

  for (let start = 0; start < groups.length; start += tablesPerRow) {
    const bandGroups = groups.slice(start, start + tablesPerRow);
    let bandHeight = 0;

    bandGroups.forEach((group, index) => {
      const colOffset = index * (tableWidth + gapWidth);
      const blockTitle = `${group.course} ${getYearLevelLabel(group.yearLevel)} ${group.block}`.toUpperCase();
      const blockRows = [
        [blockTitle, '', '', ''],
        [`Students: ${group.students.length}`, '', '', ''],
        ['NO.', 'NAME', 'PAID', 'DATE']
      ];

      let blockTotalPaid = 0;

      group.students.forEach((student, studentIndex) => {
        const summary = buildStudentPayableSummary(student, payables, payments, paymentTotalsByStudentPayable);
        blockTotalPaid += summary.paidAmount;
        blockRows.push([
          studentIndex + 1,
          student.name || 'Unknown Student',
          summary.paidAmount,
          summary.latestPaymentDate
        ]);
      });

      blockRows.push(['TOTAL PAID', '', '', blockTotalPaid]);

      const blockHeight = blockRows.length;
      bandHeight = Math.max(bandHeight, blockHeight);

      blockRows.forEach((blockRow, rowIndex) => {
        const absoluteRow = rowOffset + rowIndex;
        const isTitleRow = rowIndex === 0;
        const isHeaderRow = rowIndex === 1;
        const isFooterRow = rowIndex === blockRows.length - 1;

        blockRow.forEach((value, colIndex) => {
          const absoluteCol = colOffset + colIndex;
          let style = cellStyle;

          if (isTitleRow) {
            style = titleStyle;
          } else if (isHeaderRow) {
            style = headerStyle;
          } else if (isFooterRow) {
            style = colIndex === 0 ? footerLabelStyle : footerValueStyle;
          } else if (colIndex === 0) {
            style = indexStyle;
          } else if (colIndex === 2) {
            style = amountStyle;
          } else if (colIndex === 3) {
            style = dateStyle;
          }

          setCell(absoluteRow, absoluteCol, value, style);
        });
      });

      mergeRow(rowOffset, colOffset, colOffset + tableWidth - 1);
      mergeRow(rowOffset + 1, colOffset, colOffset + tableWidth - 1);
      mergeRow(rowOffset + blockRows.length - 1, colOffset, colOffset + tableWidth - 2);
    });

    rowOffset += bandHeight + 2;
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!merges'] = merges;
  worksheet['!cols'] = [];

  for (let colIndex = 0; colIndex < Math.max(bandWidth, tableWidth); colIndex += 1) {
    const withinBlock = colIndex % (tableWidth + gapWidth);
    if (withinBlock === 0) {
      worksheet['!cols'][colIndex] = { wch: 6 };
    } else if (withinBlock === 1) {
      worksheet['!cols'][colIndex] = { wch: 24 };
    } else if (withinBlock === 2) {
      worksheet['!cols'][colIndex] = { wch: 14 };
    } else if (withinBlock === 3) {
      worksheet['!cols'][colIndex] = { wch: 16 };
    } else {
      worksheet['!cols'][colIndex] = { wch: 3 };
    }
  }

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

    for (let rowIndex = mergeRange.s.r; rowIndex <= mergeRange.e.r; rowIndex += 1) {
      for (let colIndex = mergeRange.s.c; colIndex <= mergeRange.e.c; colIndex += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
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

  worksheet['!pageSetup'] = {
    orientation: 'landscape',
    fitToWidth: 1,
    fitToHeight: 0
  };

  return worksheet;
};

const getPayableLabel = (payable) =>
  String(payable?.moduleCode || payable?.type || payable?.title || payable?.category || 'Payable').trim() || 'Payable';

const getLatestPaymentDateForPayable = (studentId, payableId, payments) => {
  const latestPayment = (payments || [])
    .filter((payment) => payment.studentId === studentId && payment.payableId === payableId)
    .sort((left, right) => new Date(right.createdAt || right.date || 0).getTime() - new Date(left.createdAt || left.date || 0).getTime())[0];

  return formatExportDate(latestPayment?.createdAt || latestPayment?.date);
};

const getRelevantPayablesForGroup = (students, payables) => {
  const relevant = new Map();

  (students || []).forEach((student) => {
    (payables || []).forEach((payable) => {
      if (isPayableRelevantToStudent(payable, student)) {
        relevant.set(payable.id, payable);
      }
    });
  });

  return Array.from(relevant.values())
    .sort((left, right) => getPayableLabel(left).localeCompare(getPayableLabel(right), undefined, { sensitivity: 'base', numeric: true }));
};

const buildAllBlocksWorksheetFormatted = ({
  students,
  payables,
  payments,
  paymentTotalsByStudentPayable,
  selectedDepartment,
  activeTerm
}) => {
  const groups = buildCourseYearBlockGroups(students);
  const rows = [[]];
  const merges = [];
  const styles = {};

  const ensureRow = (rowIndex) => {
    while (rows.length <= rowIndex) rows.push([]);
  };

  const setCell = (rowIndex, colIndex, value, style) => {
    ensureRow(rowIndex);
    rows[rowIndex][colIndex] = value;
    if (!style) return;
    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
    styles[cellAddress] = { ...(styles[cellAddress] || {}), ...style };
  };

  const merge = (startRow, startCol, endRow, endCol) => {
    if (startRow === endRow && startCol === endCol) return;
    merges.push({ s: { r: startRow, c: startCol }, e: { r: endRow, c: endCol } });
  };

  const border = {
    top: { style: 'thin' },
    bottom: { style: 'thin' },
    left: { style: 'thin' },
    right: { style: 'thin' }
  };
  const titleStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 13 },
    fill: { patternType: 'solid', fgColor: { rgb: '1F2937' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border
  };
  const metaStyle = {
    alignment: { horizontal: 'left', vertical: 'center' },
    border
  };
  const summaryHeaderStyle = {
    font: { bold: true, color: { rgb: '111827' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'E5E7EB' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border
  };
  const payableHeaderStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '2563EB' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border
  };
  const subHeaderStyle = {
    font: { bold: true, color: { rgb: '374151' }, sz: 10 },
    fill: { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } },
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
    numFmt: 'â‚±#,##0.00',
    alignment: { horizontal: 'right', vertical: 'center' },
    border
  };
  const dateStyle = {
    alignment: { horizontal: 'center', vertical: 'center' },
    border
  };
  const footerLabelStyle = {
    font: { bold: true, color: { rgb: '1E3A8A' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border
  };
  const footerAmountStyle = {
    ...amountStyle,
    font: { bold: true },
    fill: { patternType: 'solid', fgColor: { rgb: 'EFF6FF' } }
  };

  let rowIndex = 1;
  let maxColumnCount = 10;
  const columnWidths = [];

  const setColumnWidths = (colOffset, groupPayablesCount) => {
    columnWidths[colOffset] = { wch: 6 };
    columnWidths[colOffset + 1] = { wch: 28 };

    for (let index = 0; index < groupPayablesCount; index += 1) {
      columnWidths[colOffset + 2 + (index * 2)] = { wch: 14 };
      columnWidths[colOffset + 3 + (index * 2)] = { wch: 16 };
    }

    columnWidths[colOffset + 2 + (groupPayablesCount * 2)] = { wch: 16 };
  };

  const tableStartRow = rowIndex;
  let nextTableCol = 0;
  let maxTableHeight = 0;

  groups.forEach((group) => {
    const groupPayables = getRelevantPayablesForGroup(group.students, payables);
    const baseColumns = 2;
    const totalColumn = baseColumns + (groupPayables.length * 2);
    const columnCount = totalColumn + 1;
    const colOffset = nextTableCol;
    const col = (columnIndex) => colOffset + columnIndex;
    maxColumnCount = Math.max(maxColumnCount, colOffset + columnCount);
    setColumnWidths(colOffset, groupPayables.length);

    setCell(tableStartRow, col(0), `${group.course} ${getYearLevelLabel(group.yearLevel)} ${group.block}`.toUpperCase(), titleStyle);
    merge(tableStartRow, col(0), tableStartRow, col(totalColumn));

    const headerTopRow = tableStartRow + 1;
    setCell(headerTopRow, col(0), 'No.', summaryHeaderStyle);
    setCell(headerTopRow, col(1), 'Student Name', summaryHeaderStyle);
    [0, 1].forEach((columnIndex) => merge(headerTopRow, col(columnIndex), headerTopRow + 1, col(columnIndex)));

    groupPayables.forEach((payable, payableIndex) => {
      const amountCol = baseColumns + (payableIndex * 2);
      const dateCol = amountCol + 1;
      setCell(headerTopRow, col(amountCol), getPayableLabel(payable).toUpperCase(), payableHeaderStyle);
      setCell(headerTopRow, col(dateCol), '', payableHeaderStyle);
      merge(headerTopRow, col(amountCol), headerTopRow, col(dateCol));
      setCell(headerTopRow + 1, col(amountCol), 'Amount', subHeaderStyle);
      setCell(headerTopRow + 1, col(dateCol), 'Date', subHeaderStyle);
    });

    setCell(headerTopRow, col(totalColumn), 'TOTAL BALANCE', summaryHeaderStyle);
    merge(headerTopRow, col(totalColumn), headerTopRow + 1, col(totalColumn));

    const totals = {
      payableAmounts: Array.from({ length: groupPayables.length }, () => 0),
      totalBalance: 0
    };

    let dataRowIndex = headerTopRow + 2;

    group.students.forEach((student, studentIndex) => {
      const summary = buildStudentPayableSummary(student, payables, payments, paymentTotalsByStudentPayable);
      totals.totalBalance += summary.remainingBalance;

      setCell(dataRowIndex, col(0), studentIndex + 1, indexStyle);
      setCell(dataRowIndex, col(1), student.name || 'Unknown Student', textStyle);

      groupPayables.forEach((payable, payableIndex) => {
        const amountCol = baseColumns + (payableIndex * 2);
        const dateCol = amountCol + 1;
        const hasPayable = isPayableRelevantToStudent(payable, student);
        const amount = hasPayable ? numberOrZero(payable.amount) : '';
        if (hasPayable) totals.payableAmounts[payableIndex] += numberOrZero(payable.amount);

        setCell(dataRowIndex, col(amountCol), amount, amountStyle);
        setCell(dataRowIndex, col(dateCol), hasPayable ? getLatestPaymentDateForPayable(student.id, payable.id, payments) : 'None', dateStyle);
      });

      setCell(dataRowIndex, col(totalColumn), summary.remainingBalance, footerAmountStyle);
      dataRowIndex += 1;
    });

    const footerRow = dataRowIndex + 1;
    setCell(footerRow, col(0), 'TOTAL PAID', footerLabelStyle);
    merge(footerRow, col(0), footerRow, col(1));

    groupPayables.forEach((payable, payableIndex) => {
      const amountCol = baseColumns + (payableIndex * 2);
      const dateCol = amountCol + 1;
      setCell(footerRow, col(amountCol), totals.payableAmounts[payableIndex], footerAmountStyle);
      setCell(footerRow, col(dateCol), 'None', footerLabelStyle);
    });

    setCell(footerRow, col(totalColumn), totals.totalBalance, footerAmountStyle);

    maxTableHeight = Math.max(maxTableHeight, footerRow - tableStartRow + 1);
    nextTableCol += columnCount + 1;
  });

  rowIndex = tableStartRow + maxTableHeight + 1;

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!merges'] = merges;
  worksheet['!cols'] = Array.from({ length: maxColumnCount }, (_, colIndex) => columnWidths[colIndex] || { wch: 3 });
  worksheet['!pageSetup'] = {
    orientation: 'landscape',
    fitToWidth: 1,
    fitToHeight: 0
  };

  Object.keys(styles).forEach((cellAddress) => {
    if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: '' };
    worksheet[cellAddress].s = { ...(worksheet[cellAddress].s || {}), ...styles[cellAddress] };
  });

  merges.forEach((mergeRange) => {
    const topLeft = XLSX.utils.encode_cell({ r: mergeRange.s.r, c: mergeRange.s.c });
    const topLeftStyle = styles[topLeft] || {};

    for (let row = mergeRange.s.r; row <= mergeRange.e.r; row += 1) {
      for (let col = mergeRange.s.c; col <= mergeRange.e.c; col += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: '' };
        worksheet[cellAddress].s = { ...(worksheet[cellAddress].s || {}), ...topLeftStyle };
      }
    }
  });

  return worksheet;
};

const getSafeSheetName = (department, fallbackIndex) => {
  const rawName = String(department?.code || department?.name || `DEPT ${fallbackIndex + 1}`)
    .replace(/[\\/?*[\]:]/g, '-')
    .trim() || `DEPT ${fallbackIndex + 1}`;
  return rawName.toUpperCase().slice(0, 31);
};

export const exportOtherDepartmentPayablesToExcel = ({
  students,
  payables,
  payments,
  paymentTotalsByStudentPayable,
  selectedDepartment,
  selectedFolder,
  scope,
  activeTerm,
  filename,
  departmentGroups
}) => {
  const exportData = buildOtherDepartmentPayablesExportRows({
    students,
    payables,
    payments,
    paymentTotalsByStudentPayable
  });

  const scopeLabel = scope === 'all-blocks' ? 'All Blocks' : 'Current Folder Only';
  const normalizedFolderYear = Number(selectedFolder?.year);
  const currentYearLabel = Number.isFinite(normalizedFolderYear)
    ? `${normalizedFolderYear}${normalizedFolderYear === 1 ? 'st' : normalizedFolderYear === 2 ? 'nd' : normalizedFolderYear === 3 ? 'rd' : 'th'} Year`
    : 'All Year Levels';
  const currentBlockLabel = selectedFolder?.block ? String(selectedFolder.block).toUpperCase() : 'All Blocks';
  const termLabel = getTermLabel(activeTerm);

  const defaultFilename = `${sanitizeExportText(selectedDepartment?.name || 'other-department')}-${sanitizeExportText(scopeLabel).toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
  const rawFilename = sanitizeExportText(filename || defaultFilename);
  const normalizedFilename = rawFilename.replace(/\.(xlsx|csv)$/i, '');
  const finalFilename = normalizedFilename;

  if (scope === 'all-blocks') {
    const workbook = XLSX.utils.book_new();
    const groups = Array.isArray(departmentGroups) && departmentGroups.length
      ? departmentGroups
      : [{
          department: selectedDepartment,
          students,
          payables,
          payments,
          paymentTotalsByStudentPayable
        }];

    groups.forEach((group, index) => {
      const worksheet = buildAllBlocksWorksheetFormatted({
        students: group.students || [],
        payables: group.payables || [],
        payments: group.payments || [],
        paymentTotalsByStudentPayable: group.paymentTotalsByStudentPayable || {},
        selectedDepartment: group.department || selectedDepartment,
        activeTerm
      });

      XLSX.utils.book_append_sheet(workbook, worksheet, getSafeSheetName(group.department || selectedDepartment, index));
    });

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
    saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `${finalFilename}.xlsx`);
    return;
  }

  const workbookRows = [
    ['CS PAYABLES EXPORT'],
    [`Department: ${selectedDepartment?.name || 'Other Department'}`],
    [`Export Scope: ${scopeLabel}`],
    [`Current Folder: ${selectedFolder?.label || 'All Blocks'}`],
    [`Year Level: ${currentYearLabel}`],
    [`Block: ${currentBlockLabel}`],
    [`Semester / School Year: ${termLabel}`],
    [],
    ['No.', 'Gender', 'Student Name', 'Previous Balance', 'Paid Amount', 'Remaining Balance', 'Payment Date', 'Module Fees', 'Monthly Payment Tracking', 'Total Balance']
  ];

  exportData.rows.forEach((row) => workbookRows.push(row));

  workbookRows.push([
    'Grand Total',
    '',
    '',
    exportData.summary.previousBalance,
    exportData.summary.paidAmount,
    exportData.summary.remainingBalance,
    '',
    exportData.summary.moduleFees,
    `${exportData.summary.paymentCount} payment${exportData.summary.paymentCount === 1 ? '' : 's'}`,
    exportData.summary.remainingBalance
  ]);

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(workbookRows);
  const border = {
    top: { style: 'thin' },
    bottom: { style: 'thin' },
    left: { style: 'thin' },
    right: { style: 'thin' }
  };
  const titleStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 16 },
    fill: { patternType: 'solid', fgColor: { rgb: '1D4ED8' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border
  };
  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: '2563EB' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border
  };
  const summaryStyle = {
    font: { bold: true },
    fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border
  };
  const amountStyle = {
    numFmt: '₱#,##0.00',
    alignment: { horizontal: 'right', vertical: 'center' },
    border
  };
  const dateStyle = {
    alignment: { horizontal: 'center', vertical: 'center' },
    border
  };
  const textStyle = {
    alignment: { horizontal: 'left', vertical: 'center' },
    border
  };

  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 10 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 22 },
    { wch: 16 }
  ];

  const setCellStyle = (row, col, style) => {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
    if (!worksheet[cellAddress]) {
      worksheet[cellAddress] = { t: 's', v: '' };
    }
    worksheet[cellAddress].s = {
      ...(worksheet[cellAddress].s || {}),
      ...style
    };
  };

  for (let col = 0; col < 10; col += 1) {
    setCellStyle(0, col, titleStyle);
    setCellStyle(6, col, headerStyle);
    setCellStyle(workbookRows.length - 1, col, summaryStyle);
  }

  for (let row = 7; row < workbookRows.length - 1; row += 1) {
    setCellStyle(row, 0, textStyle);
    setCellStyle(row, 1, textStyle);
    setCellStyle(row, 2, textStyle);
    setCellStyle(row, 3, amountStyle);
    setCellStyle(row, 4, amountStyle);
    setCellStyle(row, 5, amountStyle);
    setCellStyle(row, 6, dateStyle);
    setCellStyle(row, 7, amountStyle);
    setCellStyle(row, 8, textStyle);
    setCellStyle(row, 9, amountStyle);
  }

  const summaryCells = [3, 4, 5, 7, 9];
  summaryCells.forEach((col) => {
    setCellStyle(workbookRows.length - 1, col, {
      ...summaryStyle,
      ...amountStyle
    });
  });

  if (filename?.toLowerCase().endsWith('.csv')) {
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${finalFilename}.csv`);
    return;
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, 'CS Payables');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
  saveAs(new Blob([buffer], { type: 'application/octet-stream' }), `${finalFilename}.xlsx`);
};

