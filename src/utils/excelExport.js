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

const buildModuleSheet = (mod) => {
  const rows = [];

  // Info block
  rows.push(['Subject Code',  mod.courseCode  || '']);
  rows.push(['Subject Title', mod.courseTitle || '']);
  rows.push(['Professor',     mod.professor   || '—']);
  rows.push(['Year Level',    yearLabel(mod.yearLevel)]);
  rows.push(['Block(s)',       blockList(mod.blocks)]);
  rows.push(['Term',          termLabel(mod.semester)]);
  rows.push(['Amount',        phpAmount(mod.amount)]);
  rows.push([]); // blank separator

  // Student table header
  rows.push(['Name', 'Classification', 'Block', 'Status', 'Amount Paid (PHP)']);

  const blockGroups = mod.blocks || [];
  if (blockGroups.length === 0) {
    rows.push(['No students enrolled', '', '', '', '']);
  } else {
    blockGroups.forEach(group => {
      const students = group.students || [];
      if (students.length === 0) {
        rows.push(['(no students)', '', group.block || '—', '', '']);
      } else {
        students.forEach(s => {
          rows.push([
            s.name        || '',
            s.isIrregular ? 'Irregular' : 'Regular',
            s.isIrregular ? '—' : (group.block || '—'),
            s.status      || 'UNPAID',
            s.paidAmount  != null ? Number(s.paidAmount).toFixed(2) : '0.00',
          ]);
        });
      }
    });
  }

  // Totals footer
  const allStudents  = blockGroups.flatMap(b => b.students || []);
  const paidCount    = allStudents.filter(s => s.status === 'PAID').length;
  const partialCount = allStudents.filter(s => s.status === 'PARTIAL').length;
  const unpaidCount  = allStudents.length - paidCount - partialCount;

  rows.push([]);
  rows.push(['Total Students', allStudents.length, '', '', '']);
  rows.push(['Paid',           paidCount,           '', '', '']);
  rows.push(['Partial',        partialCount,         '', '', '']);
  rows.push(['Unpaid',         unpaidCount,          '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 32 }, // Name / Label
    { wch: 16 }, // Classification / Value
    { wch: 10 }, // Block
    { wch: 10 }, // Status
    { wch: 18 }, // Amount Paid
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

// ─── Professor cutback exports (unchanged) ────────────────────────────────────

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
  header.push('Cutback (PHP)');
  rows.push(header);

  const classes = prof.classes || [];
  let total = 0;
  if (classes.length === 0) {
    const emptyRow = ['—', 'No assigned classes', '', '', 0, 0];
    if (deadline) emptyRow.push(0);
    emptyRow.push('0.00');
    rows.push(emptyRow);
  } else {
    classes.forEach(c => {
      const paid = c.paidCount || 0;
      const cutback = paid * ratePerStudent;
      total += cutback;
      const row = [
        c.courseCode  || '',
        c.courseTitle || '',
        c.yearLevel   || '',
        (c.blocks || []).join(', '),
        c.studentCount || 0,
        paid
      ];
      if (deadline) row.push(c.lateCount || 0);
      row.push(cutback.toFixed(2));
      rows.push(row);
    });
  }
  rows.push([]);
  const totalRow = ['', '', '', '', '', 'TOTAL'];
  if (deadline) totalRow.push('');
  totalRow.push(total.toFixed(2));
  rows.push(totalRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const cols = [{ wch: 14 }, { wch: 40 }, { wch: 6 }, { wch: 12 }, { wch: 10 }, { wch: 14 }];
  if (deadline) cols.push({ wch: 14 });
  cols.push({ wch: 14 });
  ws['!cols'] = cols;
  return ws;
};

export function exportSingleProfessorCutbacksToExcel(prof, ratePerStudent, filename = 'professor_cutbacks.xlsx', options = {}) {
  const wb = XLSX.utils.book_new();
  const ws = buildProfessorSheet(prof, ratePerStudent, options);
  const sheetName = dedupeSheetName(wb, prof.name || 'Professor');
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);
}

export function exportAllProfessorCutbacksToExcel(professors, ratePerStudent, filename = 'all_professor_cutbacks.xlsx', options = {}) {
  const { deadline = '' } = options;
  const wb = XLSX.utils.book_new();

  const summaryHeader = ['Professor', 'Employee ID', 'Subjects Handled', 'Paid Students'];
  if (deadline) summaryHeader.push('Late (excluded)');
  summaryHeader.push('Total Cutback (PHP)');
  const summaryRows = [summaryHeader];

  let grandPaidStudents = 0;
  let grandLateStudents = 0;
  let grandTotalCutback = 0;
  professors.forEach(prof => {
    const classes = prof.classes || [];
    const paidStudents = classes.reduce((sum, c) => sum + (c.paidCount || 0), 0);
    const lateStudents = classes.reduce((sum, c) => sum + (c.lateCount || 0), 0);
    const totalCutback = paidStudents * ratePerStudent;
    grandPaidStudents += paidStudents;
    grandLateStudents += lateStudents;
    grandTotalCutback += totalCutback;
    const row = [
      prof.name       || '',
      prof.employeeId || '',
      classes.length,
      paidStudents
    ];
    if (deadline) row.push(lateStudents);
    row.push(totalCutback.toFixed(2));
    summaryRows.push(row);
  });
  summaryRows.push([]);
  const totalRow = ['', '', 'GRAND TOTAL', grandPaidStudents];
  if (deadline) totalRow.push(grandLateStudents);
  totalRow.push(grandTotalCutback.toFixed(2));
  summaryRows.push(totalRow);
  summaryRows.push([]);
  summaryRows.push([`Rate per paid student: ${Number(ratePerStudent).toFixed(2)} PHP`]);
  summaryRows.push([`Payment deadline: ${deadline || 'None (no cutoff)'}`]);

  const summary = XLSX.utils.aoa_to_sheet(summaryRows);
  const summaryCols = [{ wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 16 }];
  if (deadline) summaryCols.push({ wch: 16 });
  summaryCols.push({ wch: 20 });
  summary['!cols'] = summaryCols;
  XLSX.utils.book_append_sheet(wb, summary, 'Summary');

  professors.forEach(prof => {
    const ws = buildProfessorSheet(prof, ratePerStudent, options);
    const sheetName = dedupeSheetName(wb, prof.name || 'Professor');
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
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
  rows.push(['Module Code', 'Module Title', 'Paid Students', 'Share Amount (PHP)']);

  (report.breakdown || []).forEach(r => {
    rows.push([
      r.courseCode || '',
      r.courseTitle || '',
      r.paidCount || 0,
      (Number(r.shareAmount) || 0).toFixed(2)
    ]);
  });

  rows.push([]);
  rows.push(['', '', 'Total Paid Students', report.totalPaidCount || 0]);
  rows.push(['', '', 'Total Department Share (PHP)', (Number(report.totalShare) || 0).toFixed(2)]);

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