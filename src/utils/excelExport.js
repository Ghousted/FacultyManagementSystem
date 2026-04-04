import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export function exportDeanListToExcel(data, defaultFilename = 'deans_list.xlsx') {
  // Create a new workbook
  const wb = XLSX.utils.book_new();

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
    const wsBorders = {};
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

        // Place studentRows into wsData and attach styles
        studentRows.forEach((r, rIndex) => {
          const targetRow = rowOffset + rIndex;
          if (!wsData[targetRow]) wsData[targetRow] = [];
          r.forEach((cell, cIndex) => {
            const col = startCol + cIndex;
            wsData[targetRow][col] = cell;

            const addr = XLSX.utils.encode_cell({ r: targetRow, c: col });
            // Add thin border for every cell inside the student block
            wsBorders[addr] = {
              top: { style: 'thin', color: { auto: 1 } },
              bottom: { style: 'thin', color: { auto: 1 } },
              left: { style: 'thin', color: { auto: 1 } },
              right: { style: 'thin', color: { auto: 1 } }
            };

            // Style: name row (rIndex === 0)
            if (rIndex === 0) {
              wsStyles[addr] = {
                font: { bold: true },
                alignment: { horizontal: 'center', vertical: 'center' }
              };
            }

            // Style: header row (rIndex === 1)
            else if (rIndex === 1) {
              wsStyles[addr] = {
                font: { bold: true },
                fill: { patternType: 'solid', fgColor: { rgb: 'DDEBF7' } },
                alignment: { horizontal: cIndex === 0 ? 'center' : 'center', vertical: 'center' }
              };
            }

            // Style: GWA row (last row)
            else if (rIndex === studentRows.length - 1) {
              wsStyles[addr] = {
                font: { italic: true },
                alignment: { horizontal: 'left', vertical: 'center' }
              };
            } else {
              // Grades rows: center grade, code center, course left, units center
              wsStyles[addr] = {
                alignment: { horizontal: cIndex === 2 ? 'left' : 'center', vertical: 'center', wrapText: cIndex === 2 }
              };
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

    // Apply borders and styles to cells we've tracked
    Object.keys(wsBorders).forEach(cell => {
      if (!ws[cell]) ws[cell] = { t: 's', v: '' };
      const borderStyle = wsBorders[cell];
      const styleObj = Object.assign({}, wsStyles[cell] || {});
      styleObj.border = borderStyle;
      ws[cell].s = styleObj;
    });

    // Ensure merged ranges also have cell objects and thin borders so the table blocks are boxed
    merges.forEach(mrg => {
      const topLeft = XLSX.utils.encode_cell({ r: mrg.s.r, c: mrg.s.c });
      const topLeftStyle = wsStyles[topLeft] || {};
      for (let rr = mrg.s.r; rr <= mrg.e.r; rr++) {
        for (let cc = mrg.s.c; cc <= mrg.e.c; cc++) {
          const cellAddr = XLSX.utils.encode_cell({ r: rr, c: cc });
          if (!ws[cellAddr]) ws[cellAddr] = { t: 's', v: '' };
          ws[cellAddr].s = Object.assign({}, topLeftStyle, ws[cellAddr].s || {});
          ws[cellAddr].s.border = ws[cellAddr].s.border || {
            top: { style: 'thin', color: { auto: 1 } },
            bottom: { style: 'thin', color: { auto: 1 } },
            left: { style: 'thin', color: { auto: 1 } },
            right: { style: 'thin', color: { auto: 1 } }
          };
        }
      }
    });

    // Append worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, year);
  });

  // Generate Excel file
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });

  // Trigger file save
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), defaultFilename);
}