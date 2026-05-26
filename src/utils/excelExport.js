import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export function exportDeanListToExcel(data, defaultFilename = 'deans_list.xlsx', options = { useStyles: true, styleLevel: 'compact' }) {
  const wb = XLSX.utils.book_new();

  // Fast export path (no per-cell styles or merges) for improved speed
  if (!options.useStyles) {
    const studentsByYear = {
      '1st Year': [],
      '2nd Year': [],
      '3rd Year': [],
      '4th Year': [],
      'Irregulars': []
    };

    data.forEach(student => {
      if (student.yearLevel === 1) studentsByYear['1st Year'].push(student);
      else if (student.yearLevel === 2) studentsByYear['2nd Year'].push(student);
      else if (student.yearLevel === 3) studentsByYear['3rd Year'].push(student);
      else if (student.yearLevel === 4) studentsByYear['4th Year'].push(student);
      else studentsByYear['Irregulars'].push(student);
    });

    const yearOrder = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Irregulars'];
    yearOrder.forEach(year => {
      const rows = [];
      const students = studentsByYear[year] || [];
      if (students.length === 0) {
        const ws = XLSX.utils.aoa_to_sheet([['No students found']]);
        ws['!cols'] = [{ wch: 30 }];
        XLSX.utils.book_append_sheet(wb, ws, year);
        return;
      }

      // Header
      rows.push(['Name', 'GWA', 'Subject', 'Grade', 'Code', 'Units']);

      students.forEach(student => {
        const grades = student.grades || [];
        if (grades.length === 0) {
          rows.push([student.name, student.gwa || '', '', '', '', '']);
        } else {
          grades.forEach((g, idx) => {
            rows.push([
              idx === 0 ? student.name : '',
              idx === 0 ? (student.gwa || '') : '',
              g.subject || '',
              (g.grade !== undefined && g.grade !== null) ? parseFloat(g.grade).toFixed(2) : '',
              g.code || '',
              g.units || ''
            ]);
          });
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      // quick col width estimate
      ws['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 40 }, { wch: 8 }, { wch: 12 }, { wch: 6 }];
      XLSX.utils.book_append_sheet(wb, ws, year);
    });

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), defaultFilename);
    return;
  }

  // Fallback: styled export. We support two style levels:
  //  - 'compact' (faster): preserves merges, headers, fonts, column widths, but minimizes per-cell borders/styles
  //  - 'full' (slower): original per-cell styles and borders to closely match Excel visuals
  // Group students by year
  const studentsByYear = {
    '1st Year': [],
    '2nd Year': [],
    '3rd Year': [],
    '4th Year': [],
    'Irregulars': []
  };

  data.forEach(student => {
    if (student.yearLevel === 1) {
      studentsByYear['1st Year'].push(student);
    } else if (student.yearLevel === 2) {
      studentsByYear['2nd Year'].push(student);
    } else if (student.yearLevel === 3) {
      studentsByYear['3rd Year'].push(student);
    } else if (student.yearLevel === 4) {
      studentsByYear['4th Year'].push(student);
    } else {
      studentsByYear['Irregulars'].push(student);
    }
  });

  // Sort students alphabetically within each year
  Object.keys(studentsByYear).forEach(year => {
    studentsByYear[year].sort((a, b) => a.name.localeCompare(b.name));
  });

  // Create a worksheet for each year (always create sheets in a fixed order)
  const yearOrder = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Irregulars'];
  yearOrder.forEach(year => {
    const students = studentsByYear[year] || [];

    // If there are no students for this year, create a simple placeholder sheet
    if (students.length === 0) {
      const emptyWs = XLSX.utils.aoa_to_sheet([['No students found']]);
      emptyWs['!cols'] = [{ wch: 30 }];
      XLSX.utils.book_append_sheet(wb, emptyWs, year);
      return;
    }

    const wsData = [];
    const merges = [];
    // For compact mode we will only set styles for name/header/GWA rows and rely on default cell borders
    const wsStyles = {};

    const tablesPerRow = 3;
    const gapCol = 1; // 1 column gap between tables
    const gapRow = 1; // 1 row gap between table rows
    let rowOffset = 0;

    for (let i = 0; i < students.length; i += tablesPerRow) {
      const rowStudents = students.slice(i, i + tablesPerRow);
      let maxTableHeight = 0;

      rowStudents.forEach((student, colIndex) => {
        const startCol = colIndex * (4 + gapCol); // 4 columns per table + gap
        const studentRows = [];

        // Student Name
        studentRows.push([student.name]);
        merges.push({
          s: { r: rowOffset, c: startCol },
          e: { r: rowOffset, c: startCol + 3 }
        });

        // Header row
        studentRows.push(['Grade', 'Code', 'Course', 'Units']);

        // Grades
        student.grades.forEach(grade => {
          studentRows.push([
            parseFloat(grade.grade).toFixed(2),
            grade.code || '',
            grade.subject,
            grade.units || 3
          ]);
        });

        // GWA row
        studentRows.push([`GWA: ${parseFloat(student.gwa).toFixed(2)}`]);
        merges.push({
          s: { r: rowOffset + studentRows.length - 1, c: startCol },
          e: { r: rowOffset + studentRows.length - 1, c: startCol + 3 }
        });

        // Place studentRows into wsData and attach minimal styles for compact mode
        studentRows.forEach((r, rIndex) => {
          const targetRow = rowOffset + rIndex;
          if (!wsData[targetRow]) wsData[targetRow] = [];
          r.forEach((cell, cIndex) => {
            const col = startCol + cIndex;
            wsData[targetRow][col] = cell;

            const addr = XLSX.utils.encode_cell({ r: targetRow, c: col });
            // Only assign a small set of styles (name, header, GWA) to speed up generation
            if (options.styleLevel !== 'full') {
              if (rIndex === 0) {
                wsStyles[addr] = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
              } else if (rIndex === 1) {
                wsStyles[addr] = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'DDEBF7' } }, alignment: { horizontal: 'center', vertical: 'center' } };
              } else if (rIndex === studentRows.length - 1) {
                wsStyles[addr] = { font: { italic: true }, alignment: { horizontal: 'left', vertical: 'center' } };
              }
            } else {
              // full mode: preserve original behavior (per-cell alignment)
              if (rIndex === 0) {
                wsStyles[addr] = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
              } else if (rIndex === 1) {
                wsStyles[addr] = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'DDEBF7' } }, alignment: { horizontal: cIndex === 0 ? 'center' : 'center', vertical: 'center' } };
              } else if (rIndex === studentRows.length - 1) {
                wsStyles[addr] = { font: { italic: true }, alignment: { horizontal: 'left', vertical: 'center' } };
              } else {
                wsStyles[addr] = { alignment: { horizontal: cIndex === 2 ? 'left' : 'center', vertical: 'center', wrapText: cIndex === 2 } };
              }
            }
          });
        });

        maxTableHeight = Math.max(maxTableHeight, studentRows.length);
      });

      rowOffset += maxTableHeight + gapRow; // move row offset for next set of tables
    }

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!merges'] = merges;

    // Auto-fit column widths based on content (use character width)
    const maxCols = wsData.reduce((m, row) => Math.max(m, (row ? row.length : 0)), 0);
    const colMaxChars = new Array(maxCols).fill(0);
    for (let r = 0; r < wsData.length; r++) {
      const row = wsData[r] || [];
      for (let c = 0; c < maxCols; c++) {
        const v = row[c] !== undefined && row[c] !== null ? String(row[c]) : '';
        // count visible characters, cap to avoid extremely wide columns
        colMaxChars[c] = Math.max(colMaxChars[c], Math.min(50, Math.ceil(v.length)));
      }
    }
    ws['!cols'] = colMaxChars.map(n => ({ wch: Math.max(8, n + 2) }));

    // Explicitly set column widths for each student table block (Grade, Code, Course, Units)
    // Pattern repeats every (4 + gapCol) columns starting at 0
    const blockSize = 4 + gapCol;
    for (let start = 0; start < ws['!cols'].length; start += blockSize) {
      if (!ws['!cols'][start]) ws['!cols'][start] = {};
      if (!ws['!cols'][start + 1]) ws['!cols'][start + 1] = {};
      if (!ws['!cols'][start + 2]) ws['!cols'][start + 2] = {};
      if (!ws['!cols'][start + 3]) ws['!cols'][start + 3] = {};
      // Grade: narrow
      ws['!cols'][start] = { wch: 6 };
      // Code: medium
      ws['!cols'][start + 1] = { wch: 12 };
      // Course: wide
      ws['!cols'][start + 2] = { wch: 40 };
      // Units: narrow
      ws['!cols'][start + 3] = { wch: 6 };
      // Keep the gap column as a small spacer if it exists
      if (gapCol > 0 && ws['!cols'][start + 4]) ws['!cols'][start + 4] = { wch: 2 };
    }

    // Apply tracked styles to cells
    Object.keys(wsStyles).forEach(cell => {
      if (!ws[cell]) ws[cell] = { t: 's', v: '' };
      ws[cell].s = Object.assign({}, ws[cell].s || {}, wsStyles[cell]);
    });

    // If full styling is requested, add thin borders to all populated cells and ensure merged ranges are filled
    if (options.styleLevel === 'full') {
      const thinBorder = { top: { style: 'thin', color: { auto: 1 } }, bottom: { style: 'thin', color: { auto: 1 } }, left: { style: 'thin', color: { auto: 1 } }, right: { style: 'thin', color: { auto: 1 } } };
      Object.keys(ws).forEach(cellAddr => {
        if (cellAddr[0] === '!') return;
        if (!ws[cellAddr].s) ws[cellAddr].s = {};
        if (!ws[cellAddr].s.border) ws[cellAddr].s.border = thinBorder;
      });

      // Ensure merged ranges also have cell objects and at least the top-left style
      merges.forEach(mrg => {
        const topLeft = XLSX.utils.encode_cell({ r: mrg.s.r, c: mrg.s.c });
        const topLeftStyle = wsStyles[topLeft] || {};
        for (let rr = mrg.s.r; rr <= mrg.e.r; rr++) {
          for (let cc = mrg.s.c; cc <= mrg.e.c; cc++) {
            const cellAddr = XLSX.utils.encode_cell({ r: rr, c: cc });
            if (!ws[cellAddr]) ws[cellAddr] = { t: 's', v: '' };
            ws[cellAddr].s = Object.assign({}, topLeftStyle, ws[cellAddr].s || {});
            if (!ws[cellAddr].s.border) ws[cellAddr].s.border = thinBorder;
          }
        }
      });
    }

    // Append worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, year);
  });

  // Generate Excel file (styled)
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), defaultFilename);
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

const sanitizeSheetName = (name) => {
  const cleaned = (name || 'Sheet').toString().replace(/[\\/?*[\]:]/g, '-').trim() || 'Sheet';
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
};

const dedupeSheetName = (wb, baseName) => {
  let candidate = sanitizeSheetName(baseName);
  if (!wb.SheetNames.includes(candidate)) return candidate;
  const root = candidate.length > 27 ? candidate.slice(0, 27) : candidate;
  let i = 2;
  while (wb.SheetNames.includes(`${root} (${i})`)) i += 1;
  return `${root} (${i})`;
};

// ─── Module payment helpers ────────────────────────────────────────────────────

const MOD_SEMESTER_LABELS = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };
const MOD_YEAR_LABELS     = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };

const phpAmount = (val) =>
  val !== null && val !== undefined ? `PHP ${Number(val).toFixed(2)}` : 'No payable';
const yearLabel = (y) => MOD_YEAR_LABELS[Number(y)] || 'Irregular';
const termLabel = (s) => MOD_SEMESTER_LABELS[s] || (s ? `Sem ${s}` : '—');
const blockList = (blocks = []) =>
  blocks.map(b => b.block).filter(b => b && b !== '-').join(', ') || '—';

// ─── Module detail sheet builder ──────────────────────────────────────────────
//
// Layout mirrors the UI table:
//   Info block  →  Subject Code / Title / Professor / Year Level / Block(s) / Term / Amount
//   Blank row
//   Student table  →  Name | Classification | Block | Status | Amount Paid (PHP)
//   Blank row
//   Totals footer  →  Total Students / Paid / Partial / Unpaid

const getDisplayBlock = (value, fallback = 'N/A') => {
  const raw = typeof value === 'object' && value !== null
    ? value.block || value.joinedBlock || value.section
    : value;
  return String(raw || fallback).trim().toUpperCase() || fallback;
};

const getStudentDisplayBlock = (student, fallback = 'N/A') => (
  getDisplayBlock(student?.joinedBlock || student?.block || student?.section || fallback, fallback)
);

const placeTablesInGrid = (rows, tables, options = {}) => {
  const tableWidth = options.tableWidth || 5;
  const gapWidth = options.gapWidth || 1;
  const tablesPerRow = options.tablesPerRow || 3;
  let rowOffset = options.startRow || rows.length;

  for (let start = 0; start < tables.length; start += tablesPerRow) {
    const rowTables = tables.slice(start, start + tablesPerRow);
    const bandHeight = rowTables.reduce((max, table) => Math.max(max, table.length), 0);

    rowTables.forEach((table, tableIndex) => {
      const colOffset = tableIndex * (tableWidth + gapWidth);
      table.forEach((tableRow, rowIndex) => {
        const targetRow = rowOffset + rowIndex;
        if (!rows[targetRow]) rows[targetRow] = [];
        for (let colIndex = 0; colIndex < tableWidth; colIndex += 1) {
          rows[targetRow][colOffset + colIndex] = tableRow[colIndex] ?? '';
        }
      });
    });

    rowOffset += bandHeight + (options.gapRows || 2);
  }

  return rowOffset;
};

const makeThinBorder = () => ({
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } }
});

const autoFitWorksheetColumns = (rows, maxWidth = 34) => {
  const maxColumns = rows.reduce((max, row) => Math.max(max, row?.length || 0), 0);
  const widths = Array.from({ length: maxColumns }, () => 8);

  rows.forEach((row) => {
    (row || []).forEach((value, columnIndex) => {
      if (value === null || typeof value === 'undefined') return;
      const length = String(value).length;
      widths[columnIndex] = Math.max(widths[columnIndex] || 8, Math.min(maxWidth, length + 2));
    });
  });

  return widths.map((width) => ({ wch: Math.max(5, width) }));
};

const applyWorksheetStyles = (worksheet, styles, merges = []) => {
  Object.entries(styles).forEach(([cellAddress, style]) => {
    if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: '' };
    worksheet[cellAddress].s = {
      ...(worksheet[cellAddress].s || {}),
      ...style
    };
  });

  merges.forEach((mergeRange) => {
    const topLeft = XLSX.utils.encode_cell({ r: mergeRange.s.r, c: mergeRange.s.c });
    const topLeftStyle = styles[topLeft] || {};
    for (let row = mergeRange.s.r; row <= mergeRange.e.r; row += 1) {
      for (let column = mergeRange.s.c; column <= mergeRange.e.c; column += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: column });
        if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: '' };
        worksheet[cellAddress].s = {
          ...(worksheet[cellAddress].s || {}),
          ...topLeftStyle
        };
      }
    }
  });
};

const alignProfessorBlockTables = (tables) => {
  const getFooterStartIndex = (table) => {
    const departmentShareIndex = table.findIndex((row) => row?.some((cell) => String(cell || '').startsWith('Department Share:')));
    if (departmentShareIndex >= 0) return Math.max(2, departmentShareIndex - 1);
    const totalPaidIndex = table.findIndex((row) => row?.some((cell) => String(cell || '').startsWith('Total Paid:')));
    return totalPaidIndex < 0 ? -1 : Math.max(2, totalPaidIndex - 1);
  };

  const maxBodyRows = tables.reduce((max, table) => {
    const footerStartIndex = getFooterStartIndex(table);
    return Math.max(max, Math.max(0, footerStartIndex - 2));
  }, 0);

  return tables.map((table) => {
    const footerStartIndex = getFooterStartIndex(table);
    if (footerStartIndex < 0) return table;
    const bodyRows = table.slice(2, footerStartIndex);
    const footerRows = table.slice(footerStartIndex);
    const paddingRows = Array.from({ length: Math.max(0, maxBodyRows - bodyRows.length) }, () => ['', '', '', '', '']);
    return [
      ...table.slice(0, 2),
      ...bodyRows,
      ...paddingRows,
      ...footerRows
    ];
  });
};

const getProfessorHandledBlockCount = (classes = []) => (
  classes.reduce((sum, course) => {
    const studentBlocks = new Set(
      (course.students || [])
        .map((student) => getStudentDisplayBlock(student, ''))
        .filter(Boolean)
    );
    if (studentBlocks.size > 0) return sum + studentBlocks.size;
    if (Array.isArray(course.blocks) && course.blocks.length > 0) return sum + course.blocks.length;
    return sum + 1;
  }, 0)
);

const getProfessorTotalStudentsHandled = (classes = []) => (
  classes.reduce((sum, course) => {
    if (Array.isArray(course.students)) return sum + course.students.length;
    return sum + Number(course.studentCount || 0);
  }, 0)
);

const getProfessorPaidStudentCount = (classes = []) => (
  classes.reduce((sum, course) => {
    if (Array.isArray(course.students)) {
      return sum + course.students.filter((student) => student.status === 'PAID').length;
    }
    return sum + Number(course.paidCount || 0);
  }, 0)
);

const buildModuleSheet = (mod) => {
  const rows = [];

  rows.push(['Subject Code', mod.courseCode || '']);
  rows.push(['Subject Title', mod.courseTitle || '']);
  rows.push(['Professor', mod.professor || '-']);
  rows.push(['Year Level', yearLabel(mod.yearLevel)]);
  rows.push(['Block(s)', blockList(mod.blocks)]);
  rows.push(['Term', termLabel(mod.semester)]);
  rows.push(['Amount', phpAmount(mod.amount)]);
  rows.push([]);

  const blockGroups = mod.blocks || [];
  if (blockGroups.length === 0) {
    rows.push(['Name', 'Classification', 'Block', 'Status', 'Amount Paid (PHP)']);
    rows.push(['No students enrolled', '', '', '', '']);
  } else {
    const blockTables = blockGroups.map((group) => {
      const students = group.students || [];
      const block = getDisplayBlock(group.block);
      const table = [
        [`Block ${block}`, '', '', '', ''],
        [`Students: ${students.length}`, '', '', '', ''],
        ['Name', 'Classification', 'Block', 'Status', 'Amount Paid (PHP)']
      ];

      if (students.length === 0) {
        table.push(['(no students)', '', block, '', '']);
      } else {
        students.forEach((student) => {
          table.push([
            student.name || '',
            student.isIrregular ? 'Irregular' : 'Regular',
            getStudentDisplayBlock(student, block),
            student.status || 'UNPAID',
            student.paidAmount != null ? Number(student.paidAmount).toFixed(2) : '0.00'
          ]);
        });
      }

      return table;
    });

    placeTablesInGrid(rows, blockTables, { tableWidth: 5, tablesPerRow: 3 });
  }

  const allStudents = blockGroups.flatMap((block) => block.students || []);
  const paidCount = allStudents.filter((student) => student.status === 'PAID').length;
  const partialCount = allStudents.filter((student) => student.status === 'PARTIAL').length;
  const unpaidCount = allStudents.length - paidCount - partialCount;

  rows.push([]);
  rows.push(['Total Students:', allStudents.length, '', '', '']);
  rows.push(['Paid:', paidCount, '', '', '']);
  rows.push(['Partial:', partialCount, '', '', '']);
  rows.push(['Unpaid:', unpaidCount, '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 32 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 3 },
    { wch: 32 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 3 },
    { wch: 32 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 18 }
  ];
  return ws;
};

// ─── Summary sheet helpers ────────────────────────────────────────────────────
//
// Columns match the UI table header order:
//   Subject Code | Subject Title | Professor | Year Level | Block(s) | Term |
//   Amount (PHP) | Total Students | Paid | Partial | Unpaid

const SUMMARY_HEADER = [
  'Subject Code',
  'Subject Title',
  'Professor',
  'Year Level',
  'Block(s)',
  'Term',
  'Amount (PHP)',
  'Total Students',
  'Paid',
  'Partial',
  'Unpaid',
];

const SUMMARY_COL_WIDTHS = [
  { wch: 16 }, // Subject Code
  { wch: 36 }, // Subject Title
  { wch: 26 }, // Professor
  { wch: 12 }, // Year Level
  { wch: 12 }, // Block(s)
  { wch: 10 }, // Term
  { wch: 14 }, // Amount
  { wch: 15 }, // Total Students
  { wch:  8 }, // Paid
  { wch:  8 }, // Partial
  { wch:  8 }, // Unpaid
];

const buildSummaryRow = (mod) => {
  const allStudents  = (mod.blocks || []).flatMap(b => b.students || []);
  const paidCount    = allStudents.filter(s => s.status === 'PAID').length;
  const partialCount = allStudents.filter(s => s.status === 'PARTIAL').length;
  const unpaidCount  = allStudents.length - paidCount - partialCount;
  return [
    mod.courseCode  || '',
    mod.courseTitle || '',
    mod.professor   || '—',
    yearLabel(mod.yearLevel),
    blockList(mod.blocks),
    termLabel(mod.semester),
    mod.amount != null ? Number(mod.amount).toFixed(2) : 'No payable',
    allStudents.length,
    paidCount,
    partialCount,
    unpaidCount,
  ];
};

// ─── Public: single-module export ─────────────────────────────────────────────

export function exportSingleModulePaymentsToExcel(mod, filename = 'module_payments.xlsx') {
  const wb = XLSX.utils.book_new();
  const ws = buildModuleSheet(mod);
  const sheetName = dedupeSheetName(wb, mod.courseCode || mod.courseTitle || 'Module');
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);
}

// ─── Public: all-modules export ───────────────────────────────────────────────

export function exportAllModulePaymentsToExcel(modules, filename = 'all_module_payments.xlsx') {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary (one row per module, columns matching the UI table)
  const summaryAoa = [SUMMARY_HEADER, ...modules.map(buildSummaryRow)];
  const summary = XLSX.utils.aoa_to_sheet(summaryAoa);
  summary['!cols'] = SUMMARY_COL_WIDTHS;
  XLSX.utils.book_append_sheet(wb, summary, 'Summary');

  // Remaining sheets: one per module with student breakdown
  modules.forEach(mod => {
    const ws = buildModuleSheet(mod);
    const sheetName = dedupeSheetName(wb, mod.courseCode || mod.courseTitle || 'Module');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);
}

// ─── Professor cutback exports with detailed student tables ──────────────────

// eslint-disable-next-line no-unused-vars
const buildProfessorDetailedSheet = (prof, ratePerStudent, classDetails, options = {}) => {
  const { deadline = '' } = options;
  const rows = [];
  
  // Professor header
  rows.push([`Professor: ${prof.name || ''}`]);
  if (prof.employeeId) rows.push([`Employee ID: ${prof.employeeId}`]);
  rows.push([`Cutback Rate: ${Number(ratePerStudent).toFixed(2)} PHP per paid student`]);
  rows.push([`Payment Deadline: ${deadline || 'None (no cutoff)'}`]);
  rows.push([]);

  const classes = classDetails || prof.classes || [];
  
  if (classes.length === 0) {
    rows.push(['No assigned classes']);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 40 }];
    return ws;
  }

  // For each class, create a detailed table
  classes.forEach((course, idx) => {
    if (idx > 0) rows.push([]); // Separator between classes
    
    // Class header
    rows.push([`${course.courseCode || ''} - ${course.courseTitle || ''}`]);
    rows.push([`Year Level: ${course.yearLevel || '-'}`, `Block(s): ${(course.blocks || []).join(', ') || '-'}`]);
    rows.push([`Department: ${course.source === 'other-department' ? (course.departmentName || 'Other Department') : 'CCS Department'}`]);
    rows.push([]);

    // Student table header
    rows.push(['Student Name', 'Student Number', 'Amount Paid', 'Payment Date', 'Remaining Balance']);

    const students = course.students || [];
    const amountRequired = Number(course.amountRequired || course.payableAmount || 0);
    
    if (students.length === 0) {
      rows.push(['No payment records yet', '', '', '', '']);
    } else {
      students.forEach(student => {
        const paidAmount = Number(student.paidAmount || 0);
        const balance = Math.max(0, amountRequired - paidAmount);
        const paymentDate = student.paymentDate ? new Date(student.paymentDate).toLocaleDateString() : '-';
        
        rows.push([
          student.name || '',
          student.studentNumber || student.studentNo || '',
          paidAmount.toFixed(2),
          paymentDate,
          balance.toFixed(2)
        ]);
      });
    }

    rows.push([]);
    
    // Class computations
    const totalStudents = Number(course.studentCount || 0);
    const paidStudentsCount = (students || []).filter(s => s.status === 'PAID').length;
    const totalPaid = students.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
    const totalBalance = students.reduce((sum, s) => sum + Math.max(0, amountRequired - Number(s.paidAmount || 0)), 0);
    const professorRate = Number(ratePerStudent) || 0;
    const professorCutbackClaimable = totalStudents * professorRate; // claimable regardless of paid status
    const professorCutbackPaid = paidStudentsCount * professorRate; // actual/payout based on counted paid students
    const totalModuleAmount = amountRequired * totalStudents;
    const totalCollection = totalPaid;

    rows.push(['COMPUTATIONS']);
    rows.push(['Professor Rate per Student:', `PHP ${professorRate.toFixed(2)}`]);
    rows.push(['Number of Students × Professor Rate:', `${totalStudents} × ${professorRate.toFixed(2)} = PHP ${professorCutbackClaimable.toFixed(2)}`]);
    rows.push(['Counted Paid Students × Professor Rate:', `${paidStudentsCount} × ${professorRate.toFixed(2)} = PHP ${professorCutbackPaid.toFixed(2)}`]);
    rows.push(['Total Module Amount × Number of Students:', `${amountRequired.toFixed(2)} × ${totalStudents} = PHP ${totalModuleAmount.toFixed(2)}`]);
    rows.push(['Total Paid:', `PHP ${totalCollection.toFixed(2)}`]);
    rows.push([]);
    rows.push(['Cutback for Prof (Paid students):', `PHP ${professorCutbackPaid.toFixed(2)}`]);
    rows.push(['Cutback for Prof (Claimable/all students):', `PHP ${professorCutbackClaimable.toFixed(2)}`]);
    rows.push(['Total Remaining Balance:', `PHP ${totalBalance.toFixed(2)}`]);
    rows.push([]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 35 }, // Student Name / Label
    { wch: 18 }, // Student Number / Value
    { wch: 15 }, // Amount Paid
    { wch: 15 }, // Payment Date
    { wch: 18 }  // Remaining Balance
  ];
  return ws;
};

const buildProfessorBlockTablesSheet = (prof, ratePerStudent, classDetails) => {
  const rows = [];
  const merges = [];
  const styles = {};
  const border = makeThinBorder();
  const tableWidth = 5;
  const gapWidth = 1;
  const tablesPerRow = 3;
  const maxColumns = (tableWidth * tablesPerRow) + (gapWidth * (tablesPerRow - 1));

  const subjectStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
    fill: { patternType: 'solid', fgColor: { rgb: '2563EB' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border
  };
  const blockStyle = {
    font: { bold: true, color: { rgb: '0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border
  };
  const headerStyle = {
    font: { bold: true, color: { rgb: '0F172A' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border
  };
  const textStyle = {
    alignment: { horizontal: 'left', vertical: 'center' },
    border
  };
  const centerStyle = {
    alignment: { horizontal: 'center', vertical: 'center' },
    border
  };
  const amountStyle = {
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: 'PHP #,##0.00',
    border
  };
  const setCell = (rowIndex, columnIndex, value, style) => {
    while (rows.length <= rowIndex) rows.push([]);
    rows[rowIndex][columnIndex] = value;
    if (style) styles[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })] = style;
  };

  const mergeCells = (startRow, startColumn, endRow, endColumn) => {
    merges.push({ s: { r: startRow, c: startColumn }, e: { r: endRow, c: endColumn } });
  };

  const classes = classDetails || prof.classes || [];
  if (classes.length === 0) {
    setCell(0, 0, 'No assigned classes', textStyle);
    const emptySheet = XLSX.utils.aoa_to_sheet(rows);
    emptySheet['!cols'] = autoFitWorksheetColumns(rows);
    applyWorksheetStyles(emptySheet, styles, merges);
    return emptySheet;
  }

  const tableGroups = [];
  classes.forEach((course) => {
    const students = course.students || [];
    const amountRequired = Number(course.amountRequired || course.payableAmount || 0);
    const grouped = new Map();

    students.forEach((student) => {
      const block = getStudentDisplayBlock(student, (course.blocks || [])[0] || 'N/A');
      if (!grouped.has(block)) grouped.set(block, []);
      grouped.get(block).push(student);
    });

    if (grouped.size === 0) grouped.set(getDisplayBlock((course.blocks || [])[0], 'N/A'), []);

    const blockTables = Array.from(grouped.entries()).map(([block, blockStudents]) => {
      const totalPaid = blockStudents.reduce((sum, student) => sum + Number(student.paidAmount || 0), 0);
      const paidStudents = blockStudents.filter((student) => student.status === 'PAID').length;
      const totalStudents = blockStudents.length;
      const professorRate = Number(ratePerStudent) || 0;
      const professorCutbackPaid = paidStudents * professorRate;
      const professorCutbackClaimable = totalStudents * professorRate;
      const table = [
        [`Block ${block}`, '', '', '', ''],
        ['No.', 'Student Name', 'Amount Paid', 'Payment Date', 'Remaining Balance']
      ];

      if (blockStudents.length === 0) {
        table.push(['', 'No students enrolled', '', '', '']);
      } else {
        blockStudents.forEach((student, index) => {
          const paidAmount = Number(student.paidAmount || 0);
          const balance = Math.max(0, amountRequired - paidAmount);
          const paymentDate = student.paymentDate ? new Date(student.paymentDate).toLocaleDateString('en-PH') : '';
          table.push([
            index + 1,
            student.name || '',
            paidAmount > 0 ? paidAmount : '',
            paymentDate,
            balance
          ]);
        });
      }

      table.push(['', '', '', '', '']);
      table.push(['', '', '', '', `Total Paid: PHP ${Number(totalPaid).toFixed(2)}`]);
      table.push(['', '', '', '', '']);
      table.push(['', '', '', '', '']);
      table.push(['', '', '', '', `Cutback (Paid students): PHP ${Number(professorCutbackPaid).toFixed(2)}`]);
      table.push(['', '', '', '', `Claimable Cutback (All students): PHP ${Number(professorCutbackClaimable).toFixed(2)}`]);
      return table;
    });

    for (let start = 0; start < blockTables.length; start += tablesPerRow) {
      const subject = course.source === 'other-department'
        ? `Course: ${course.classCourse || course.course || course.departmentName || 'Other Department'} | Module: ${course.courseCode || ''}${course.courseTitle ? ` - ${course.courseTitle}` : ''}`
        : `${course.courseCode || ''}${course.courseTitle ? ` - ${course.courseTitle}` : ''}`;
      tableGroups.push({
        subject: subject.trim() || 'Module / Subject',
        tables: alignProfessorBlockTables(blockTables.slice(start, start + tablesPerRow))
      });
    }
  });

  let currentRow = 0;
  let currentColumn = 0;
  let rowBandHeight = 0;

  tableGroups.forEach((group) => {
    const groupWidth = (group.tables.length * tableWidth) + ((group.tables.length - 1) * gapWidth);
    const groupHeight = 1 + Math.max(...group.tables.map((table) => table.length));

    if (currentColumn > 0 && currentColumn + groupWidth > maxColumns) {
      currentRow += rowBandHeight + 2;
      currentColumn = 0;
      rowBandHeight = 0;
    }

    const subjectEndColumn = currentColumn + groupWidth - 1;
    setCell(currentRow, currentColumn, group.subject, subjectStyle);
    mergeCells(currentRow, currentColumn, currentRow, subjectEndColumn);

    group.tables.forEach((table, tableIndex) => {
      const tableColumn = currentColumn + (tableIndex * (tableWidth + gapWidth));
      table.forEach((tableRow, rowIndex) => {
        const absoluteRow = currentRow + 1 + rowIndex;
        tableRow.forEach((value, columnIndex) => {
          const absoluteColumn = tableColumn + columnIndex;
          let style = textStyle;
          if (rowIndex === 0) style = blockStyle;
          else if (rowIndex === 1) style = headerStyle;
          else if (columnIndex === 0) style = centerStyle;
          else if (columnIndex === 2 || columnIndex === 4) style = amountStyle;
          setCell(absoluteRow, absoluteColumn, value, style);
        });
      });
      mergeCells(currentRow + 1, tableColumn, currentRow + 1, tableColumn + tableWidth - 1);
    });

    currentColumn += groupWidth + gapWidth;
    rowBandHeight = Math.max(rowBandHeight, groupHeight);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!merges'] = merges;
  ws['!cols'] = autoFitWorksheetColumns(rows, 38);
  ws['!pageSetup'] = {
    orientation: 'landscape',
    fitToWidth: 1,
    fitToHeight: 0
  };
  applyWorksheetStyles(ws, styles, merges);
  return ws;
};

const buildProfessorSheet = (prof, ratePerStudent, options = {}) => {
  const { deadline = '' } = options;
  const rows = [];
  rows.push([`Professor: ${prof.name || ''}`]);
  if (prof.employeeId) rows.push([`Employee ID: ${prof.employeeId}`]);
  rows.push([`Cutback Rate: ${Number(ratePerStudent).toFixed(2)} PHP per paid student`]);
  rows.push([`Payment Deadline: ${deadline || 'None (no cutoff)'}`]);
  rows.push([]);
  const header = ['Course Code', 'Course Title', 'Year', 'Block(s)', 'Students', 'Paid (counted)'];
  if (deadline) header.push('Late (excluded)');
  header.push('Claimable Cutback (PHP)');
  header.push('Cutback (PHP)');
  rows.push(header);

  const classes = prof.classes || [];
  let total = 0;
  let totalClaimable = 0;
  if (classes.length === 0) {
    const emptyRow = ['—', 'No assigned classes', '', '', 0, 0];
    if (deadline) emptyRow.push(0);
    emptyRow.push('0.00');
    rows.push(emptyRow);
  } else {
    classes.forEach(c => {
      const paid = c.paidCount || 0;
      const claimable = (c.studentCount || 0) * ratePerStudent;
      const cutback = paid * ratePerStudent;
      total += cutback;
      totalClaimable += claimable;
      const row = [
        c.courseCode  || '',
        c.courseTitle || '',
        c.yearLevel   || '',
        (c.blocks || []).join(', '),
        c.studentCount || 0,
        paid
      ];
      if (deadline) row.push(c.lateCount || 0);
      row.push(claimable.toFixed(2));
      row.push(cutback.toFixed(2));
      rows.push(row);
    });
  }
  rows.push([]);
    const totalRow = ['', '', '', '', '', 'TOTAL'];
    if (deadline) totalRow.push('');
    totalRow.push(totalClaimable.toFixed(2));
    totalRow.push(total.toFixed(2));
  rows.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const cols = [{ wch: 14 }, { wch: 40 }, { wch: 6 }, { wch: 12 }, { wch: 10 }, { wch: 14 }];
  if (deadline) cols.push({ wch: 14 });
  cols.push({ wch: 18 }); // Claimable Cutback
  cols.push({ wch: 14 });
  ws['!cols'] = cols;
  return ws;
};

export function exportSingleProfessorCutbacksToExcel(prof, ratePerStudent, filename = 'professor_cutbacks.xlsx', options = {}) {
  const wb = XLSX.utils.book_new();
  
  if (options.classDetails && options.classDetails.length > 0) {
    const detailWs = buildProfessorBlockTablesSheet(prof, ratePerStudent, options.classDetails, options);
    XLSX.utils.book_append_sheet(wb, detailWs, 'Professor Cutback');
  } else {
    const ws = buildProfessorSheet(prof, ratePerStudent, options);
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  }
  
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);
}

export function exportAllProfessorCutbacksToExcel(professors, ratePerStudent, filename = 'all_professor_cutbacks.xlsx', options = {}) {
  const { deadline = '' } = options;
  const wb = XLSX.utils.book_new();

  const summaryHeader = ['No.', 'Professor', 'Classes Handled', 'Total Students Handled', 'Paid Students'];
  if (deadline) summaryHeader.push('Late (excluded)');
  summaryHeader.push('Total Cutback (PHP)');
  summaryHeader.push('Total Claimable Cutback (PHP)');
  const summaryRows = [summaryHeader];

  let grandTotalStudents = 0;
  let grandPaidStudents = 0;
  let grandLateStudents = 0;
  let grandTotalCutback = 0;
  let grandTotalClaimableCutback = 0;
  professors.forEach((prof, index) => {
    const classes = prof.classes || [];
    const handledClasses = getProfessorHandledBlockCount(classes);
    const totalStudentsHandled = getProfessorTotalStudentsHandled(classes);
    const paidStudents = getProfessorPaidStudentCount(classes);
    const lateStudents = classes.reduce((sum, c) => sum + (c.lateCount || 0), 0);
    const totalCutback = paidStudents * ratePerStudent;
    const totalClaimableCutback = totalStudentsHandled * ratePerStudent;
    grandTotalStudents += totalStudentsHandled;
    grandPaidStudents += paidStudents;
    grandLateStudents += lateStudents;
    grandTotalCutback += totalCutback;
    grandTotalClaimableCutback += totalClaimableCutback;
    const row = [
      index + 1,
      prof.name || '',
      handledClasses,
      totalStudentsHandled,
      paidStudents
    ];
    if (deadline) row.push(lateStudents);
    row.push(totalCutback.toFixed(2));
    row.push(totalClaimableCutback.toFixed(2));
    summaryRows.push(row);
  });
  summaryRows.push([]);
  const totalRow = ['', 'GRAND TOTAL', '', grandTotalStudents, grandPaidStudents];
  if (deadline) totalRow.push(grandLateStudents);
  totalRow.push(grandTotalCutback.toFixed(2));
  totalRow.push(grandTotalClaimableCutback.toFixed(2));
  summaryRows.push(totalRow);
  summaryRows.push([]);
  summaryRows.push([`Rate per paid student: ${Number(ratePerStudent).toFixed(2)} PHP`]);
  summaryRows.push([`Payment deadline: ${deadline || 'None (no cutoff)'}`]);

  const summary = XLSX.utils.aoa_to_sheet(summaryRows);
  const summaryCols = [{ wch: 8 }, { wch: 30 }, { wch: 18 }, { wch: 24 }, { wch: 16 }];
  if (deadline) summaryCols.push({ wch: 16 });
  summaryCols.push({ wch: 20 });
  summaryCols.push({ wch: 30 });
  summary['!cols'] = summaryCols;
  XLSX.utils.book_append_sheet(wb, summary, 'Summary');

  professors.forEach(prof => {
    const ws = options.detailed
      ? buildProfessorBlockTablesSheet(prof, ratePerStudent, prof.classes || [], options)
      : buildProfessorSheet(prof, ratePerStudent, options);
    const sheetName = dedupeSheetName(wb, prof.name || 'Professor');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);
}

// ─── Export professor with detailed class breakdown ───────────────────────────
export function exportProfessorDetailedCutbacksToExcel(prof, ratePerStudent, classDetails, filename = 'professor_detailed_cutbacks.xlsx') {
  const wb = XLSX.utils.book_new();

  (classDetails || []).forEach((course) => {
    const ws = buildProfessorBlockTablesSheet(prof, ratePerStudent, [course]);
    const sheetName = dedupeSheetName(wb, `${course.courseCode || 'Class'} ${(course.blocks || []).join(',')}`);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);
}
// Department share export helpers
export function buildDepartmentShareSheet(report) {
  // report: { amountPerPaidStudent, totalPaidCount, totalShare, breakdown: [{courseCode, courseTitle, paidCount, shareAmount}] }
  const rows = [];
  rows.push(['CCS Module Payments - Department Share']);
  rows.push([]);
  rows.push(['Amount per paid student (PHP):', Number(report.amountPerPaidStudent || 0).toFixed(2)]);
  rows.push([]);
  rows.push(['Module Code', 'Module Title', 'Paid Students', 'Claimable Students', 'Share Amount (PHP)', 'Claimable Share (PHP)']);

  (report.breakdown || []).forEach(r => {
    rows.push([
      r.courseCode || '',
      r.courseTitle || '',
      r.paidCount || 0,
      r.claimableCount || 0,
      (Number(r.shareAmount) || 0).toFixed(2),
      (Number(r.claimableShare) || 0).toFixed(2)
    ]);
  });

  rows.push([]);
  rows.push(['', '', 'Total Paid Students', report.totalPaidCount || 0, 'Total Claimable Students', report.totalClaimableCount || 0]);
  rows.push(['', '', 'Total Department Share (PHP)', (Number(report.totalShare) || 0).toFixed(2), 'Total Claimable Share (PHP)', (Number(report.totalClaimableShare) || 0).toFixed(2)]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 16 }, { wch: 20 }];
  return ws;
}

export function exportDepartmentShareToExcel(report, filename = 'department_share_ccs.xlsx') {
  const wb = XLSX.utils.book_new();
  const ws = buildDepartmentShareSheet(report);
  XLSX.utils.book_append_sheet(wb, ws, 'Department Share');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);
}

// ─── CCS Department Cutback with detailed student tables ──────────────────────
export function exportDepartmentDetailedCutbacksToExcel(moduleDetails, departmentShareAmount, filename = 'ccs_department_detailed_cutbacks.xlsx', options = {}) {
  const wb = XLSX.utils.book_new();
  const tableWidth = 5;
  const gapWidth = 2;
  const tablesPerRow = 3;

  const getBlocks = (module) => (
    Array.isArray(module.blocks) && module.blocks.length
      ? module.blocks.filter((block) => (block.students || []).length > 0)
      : [{ block: 'N/A', yearLevel: module.yearLevel, students: module.students || [] }]
  );
  const getDepartmentCode = (module) => (
    String(module.departmentCode || module.departmentName || module.department || 'OTHER').trim().toUpperCase() || 'OTHER'
  );
  const getCourseLabel = (module) => (
    module.course || module.classCourse || module.departmentName || module.department || 'Other Department'
  );
  const sortModules = (modules) => modules.slice().sort((left, right) => {
    const yearDiff = Number(left.yearLevel || 99) - Number(right.yearLevel || 99);
    if (yearDiff !== 0) return yearDiff;
    const codeDiff = String(left.courseCode || '').localeCompare(String(right.courseCode || ''), undefined, { sensitivity: 'base', numeric: true });
    if (codeDiff !== 0) return codeDiff;
    const courseDiff = String(getCourseLabel(left)).localeCompare(String(getCourseLabel(right)), undefined, { sensitivity: 'base', numeric: true });
    if (courseDiff !== 0) return courseDiff;
    return String(left.courseTitle || '').localeCompare(String(right.courseTitle || ''), undefined, { sensitivity: 'base', numeric: true });
  });

  const buildSheet = (sheetTitle, modules, mode) => {
    const rows = [];
    const merges = [];
    const styles = {};
    const border = makeThinBorder();
    const departmentShare = Number(departmentShareAmount) || 0;

    const subjectStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
      fill: { patternType: 'solid', fgColor: { rgb: '2563EB' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border
    };
    const blockStyle = {
      font: { bold: true, color: { rgb: '0F172A' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border
    };
    const headerStyle = {
      font: { bold: true, color: { rgb: '0F172A' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border
    };
    const textStyle = {
      alignment: { horizontal: 'left', vertical: 'center' },
      border
    };
    const centerStyle = {
      alignment: { horizontal: 'center', vertical: 'center' },
      border
    };
    const amountStyle = {
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: 'PHP #,##0.00',
      border
    };

    const setCell = (rowIndex, columnIndex, value, style) => {
      while (rows.length <= rowIndex) rows.push([]);
      rows[rowIndex][columnIndex] = value;
      if (style) styles[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })] = style;
    };

    const mergeCells = (startRow, startColumn, endRow, endColumn) => {
      merges.push({ s: { r: startRow, c: startColumn }, e: { r: endRow, c: endColumn } });
    };

    let currentRow = 0;

    setCell(currentRow, 0, sheetTitle, subjectStyle);
    mergeCells(currentRow, 0, currentRow, tableWidth - 1);
    currentRow += 2;
    if (options.deadline) {
      setCell(currentRow, 0, `Payment Deadline: ${options.deadline}`, textStyle);
      mergeCells(currentRow, 0, currentRow, tableWidth - 1);
      currentRow += 2;
    }

    sortModules(modules).forEach((module) => {
      const blocks = getBlocks(module);
      if (blocks.length === 0) return;
      const amountRequired = Number(module.amount || module.amountRequired || 0);
      const moduleSubject = `${module.courseCode || ''}${module.courseTitle ? ` - ${module.courseTitle}` : ''}`.trim() || 'Module';
      const subject = mode === 'other'
        ? `Module: ${moduleSubject}`
        : moduleSubject;
      const blockTables = blocks.map((blockGroup) => {
        const blockStudents = blockGroup.students || [];
        const block = getDisplayBlock(blockGroup.block);
        const totalStudents = blockStudents.length;
        const totalPaid = blockStudents.reduce((sum, student) => sum + Number(student.paidAmount || 0), 0);
        const blockDepartmentShare = totalStudents * departmentShare;
        const label = mode === 'other'
          ? `${getCourseLabel(module)} ${yearLabel(blockGroup.yearLevel || module.yearLevel)} - Block ${block}`
          : `Block ${block}`;
        const table = [
          [label.trim(), '', '', '', ''],
          ['No.', 'Student Name', 'Amount Paid', 'Payment Date', 'Remaining Balance']
        ];

        if (blockStudents.length === 0) {
          table.push(['', 'No students enrolled', '', '', '']);
        } else {
          blockStudents.forEach((student, index) => {
            const paidAmount = Number(student.paidAmount || 0);
            const balance = Math.max(0, amountRequired - paidAmount);
            const paymentDate = student.paymentDate ? new Date(student.paymentDate).toLocaleDateString('en-PH') : '';
            table.push([
              index + 1,
              student.name || '',
              paidAmount > 0 ? paidAmount : '',
              paymentDate,
              balance
            ]);
          });
        }

        table.push(['', '', '', '', '']);
        table.push(['', '', '', '', `Department Share: PHP ${Number(blockDepartmentShare).toFixed(2)}`]);
        table.push(['', '', '', '', `Total Paid: PHP ${Number(totalPaid).toFixed(2)}`]);
        return table;
      });

      const alignedTables = alignProfessorBlockTables(blockTables);
      for (let start = 0; start < alignedTables.length; start += tablesPerRow) {
        const rowTables = alignedTables.slice(start, start + tablesPerRow);
        const groupWidth = (rowTables.length * tableWidth) + ((rowTables.length - 1) * gapWidth);
        const subjectEndColumn = groupWidth - 1;
        const maxTableHeight = Math.max(...rowTables.map((table) => table.length));

        setCell(currentRow, 0, subject, subjectStyle);
        mergeCells(currentRow, 0, currentRow, subjectEndColumn);

        rowTables.forEach((table, tableIndex) => {
          const tableColumn = tableIndex * (tableWidth + gapWidth);
          table.forEach((tableRow, rowIndex) => {
            const absoluteRow = currentRow + 1 + rowIndex;
            tableRow.forEach((value, columnIndex) => {
              const absoluteColumn = tableColumn + columnIndex;
              let style = textStyle;
              if (rowIndex === 0) style = blockStyle;
              else if (rowIndex === 1) style = headerStyle;
              else if (columnIndex === 0) style = centerStyle;
              else if (columnIndex === 2 || columnIndex === 4) style = amountStyle;
              setCell(absoluteRow, absoluteColumn, value, style);
            });
          });
          mergeCells(currentRow + 1, tableColumn, currentRow + 1, tableColumn + tableWidth - 1);
        });

        currentRow += maxTableHeight + 3;
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = merges;
    ws['!cols'] = autoFitWorksheetColumns(rows, 38);
    applyWorksheetStyles(ws, styles, merges);
    return ws;
  };

  const ccsModulesByYear = new Map();
  const otherModulesByDepartment = new Map();

  (moduleDetails || []).forEach((module) => {
    if (getBlocks(module).length === 0) return;
    if (module.isCcs) {
      const year = Number(module.yearLevel || getBlocks(module)[0]?.yearLevel || 0);
      const key = [1, 2, 3, 4].includes(year) ? year : 'other';
      if (!ccsModulesByYear.has(key)) ccsModulesByYear.set(key, []);
      ccsModulesByYear.get(key).push(module);
      return;
    }
    const departmentCode = getDepartmentCode(module);
    if (!otherModulesByDepartment.has(departmentCode)) otherModulesByDepartment.set(departmentCode, []);
    otherModulesByDepartment.get(departmentCode).push(module);
  });

  [1, 2, 3, 4].forEach((year) => {
    const modules = ccsModulesByYear.get(year) || [];
    if (modules.length === 0) return;
    const sheetTitle = `CCS Department Cutback - ${yearLabel(year)}`;
    XLSX.utils.book_append_sheet(wb, buildSheet(sheetTitle, modules, 'ccs'), dedupeSheetName(wb, yearLabel(year)));
  });

  const otherYearModules = ccsModulesByYear.get('other') || [];
  if (otherYearModules.length > 0) {
    XLSX.utils.book_append_sheet(wb, buildSheet('CCS Department Cutback - Other Year Levels', otherYearModules, 'ccs'), dedupeSheetName(wb, 'Other Year Levels'));
  }

  Array.from(otherModulesByDepartment.entries())
    .sort(([left], [right]) => left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true }))
    .forEach(([departmentCode, modules]) => {
      XLSX.utils.book_append_sheet(
        wb,
        buildSheet(`${departmentCode} Department Cutback`, modules, 'other'),
        dedupeSheetName(wb, departmentCode)
      );
    });

  if (wb.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No department cutback records found.']]), 'Summary');
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);
}

