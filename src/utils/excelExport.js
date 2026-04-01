import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export function exportDeanListToExcel(data, filename = 'deans_list.xlsx') {
  // data: array of objects [{name, yearLevel, semester, gwa, grades: [{subject, grade, isMajor}], ...}]
  const wsData = [
    [
      'Name',
      'Year Level',
      'Semester',
      'GWA',
      'Subject',
      'Grade',
      'Major Subject'
    ]
  ];
  data.forEach((student) => {
    student.grades.forEach((grade, idx) => {
      wsData.push([
        idx === 0 ? student.name : '',
        idx === 0 ? student.yearLevel : '',
        idx === 0 ? student.semester : '',
        idx === 0 ? student.gwa : '',
        grade.subject,
        grade.grade,
        grade.isMajor ? 'Yes' : 'No'
      ]);
    });
  });
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DeanList');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);
}
