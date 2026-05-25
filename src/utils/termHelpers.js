export const SEMESTER_LABELS = {
  1: '1st Semester',
  2: '2nd Semester',
  3: 'Summer'
};

export const getYearLevelLabel = (year) => {
  const normalizedYear = Number(year);
  if (normalizedYear === 1) return '1st Year';
  if (normalizedYear === 2) return '2nd Year';
  if (normalizedYear === 3) return '3rd Year';
  if (normalizedYear === 4) return '4th Year';
  return year ? `${year} Year` : '';
};

export const formatSchoolYear = (schoolYear) => {
  const normalized = (schoolYear || '').toString().trim();
  if (!normalized) return '';
  return normalized.replace(/-/g, '–');
};

export const getStudentTermKey = (student) => {
  const term = student?.createdTerm || {};
  if (!term.semester || !term.schoolYear) return 'legacy::';
  return `${Number(term.semester)}::${term.schoolYear}`;
};

export const getTermLabelFromKey = (termKey) => {
  if (!termKey || termKey.startsWith('legacy')) {
    return 'Earlier Records (No Term)';
  }
  const [semester, schoolYear] = termKey.split('::');
  return `${SEMESTER_LABELS[Number(semester)] || `Sem ${semester}`} · S.Y. ${formatSchoolYear(schoolYear)}`;
};

export const getActiveTermLabel = (term) => {
  if (!term?.semester || !term?.schoolYear) return '';
  return `${SEMESTER_LABELS[Number(term.semester)] || `Sem ${term.semester}`} · S.Y. ${formatSchoolYear(term.schoolYear)}`;
};

export const isActiveTermConfigured = (activeTerm) =>
  Boolean(activeTerm?.semester && activeTerm?.schoolYear);

export const getActiveTermKey = (activeTerm) => {
  if (!isActiveTermConfigured(activeTerm)) return '';
  return `${Number(activeTerm.semester)}::${String(activeTerm.schoolYear || '').trim()}`;
};

export const compareTermKeys = (termKeyA, termKeyB, activeTerm) => {
  const activeKey = getActiveTermKey(activeTerm);
  if (termKeyA === activeKey && termKeyB !== activeKey) return -1;
  if (termKeyB === activeKey && termKeyA !== activeKey) return 1;
  const sorted = sortTermKeys([termKeyA, termKeyB]);
  if (sorted[0] === termKeyA) return -1;
  if (sorted[0] === termKeyB) return 1;
  return 0;
};

export const isStudentInActiveTerm = (student, activeTerm) => {
  if (student?.enrolled === false) return false;
  if (!isActiveTermConfigured(activeTerm)) return false;

  const term = student?.enrolledTerm || student?.createdTerm || {};
  if (!term.semester || !term.schoolYear) return false;

  return (
    Number(term.semester) === Number(activeTerm.semester) &&
    String(term.schoolYear || '').trim() === String(activeTerm.schoolYear || '').trim()
  );
};

/** Students with term metadata from an earlier enrollment period. */
export const isStudentFromPreviousTerm = (student, activeTerm) => {
  if (!isActiveTermConfigured(activeTerm)) return false;

  const term = student?.createdTerm || {};
  if (!term.semester || !term.schoolYear) return false;

  return !isStudentInActiveTerm(student, activeTerm);
};

export const isRecordInActiveTerm = (record, activeTerm) => {
  if (!isActiveTermConfigured(activeTerm)) return false;

  const semester = record?.semester ?? record?.createdTerm?.semester;
  const schoolYear = record?.schoolYear ?? record?.createdTerm?.schoolYear;

  if (!semester || !schoolYear) return false;

  return (
    Number(semester) === Number(activeTerm.semester) &&
    String(schoolYear || '').trim() === String(activeTerm.schoolYear || '').trim()
  );
};

export const sortTermKeys = (termKeys) =>
  [...termKeys].sort((a, b) => {
    if (a.startsWith('legacy')) return 1;
    if (b.startsWith('legacy')) return -1;
    const [semA, syA] = a.split('::');
    const [semB, syB] = b.split('::');
    const yearCompare = String(syB).localeCompare(String(syA));
    if (yearCompare !== 0) return yearCompare;
    return Number(semB) - Number(semA);
  });

export const partitionStudentsByActiveTerm = (students, activeTerm) => {
  const activeTermStudents = [];
  const previousTermStudents = [];

  (students || []).forEach((student) => {
    if (isStudentFromPreviousTerm(student, activeTerm)) {
      previousTermStudents.push(student);
    } else {
      activeTermStudents.push(student);
    }
  });

  return { activeTermStudents, previousTermStudents };
};

export const sortStudentsActiveTermFirst = (students, activeTerm) => {
  const { activeTermStudents, previousTermStudents } = partitionStudentsByActiveTerm(
    students,
    activeTerm
  );
  return [...activeTermStudents, ...previousTermStudents];
};

export const compareStudentsActiveTermFirst = (studentA, studentB, activeTerm) => {
  const rankA = isStudentFromPreviousTerm(studentA, activeTerm) ? 1 : 0;
  const rankB = isStudentFromPreviousTerm(studentB, activeTerm) ? 1 : 0;
  if (rankA !== rankB) return rankA - rankB;
  return (studentA?.name || '').localeCompare(studentB?.name || '', undefined, {
    sensitivity: 'base',
    numeric: true
  });
};

export const folderHasActiveTermStudents = (folder, activeTerm) =>
  (folder?.students || []).some((student) => !isStudentFromPreviousTerm(student, activeTerm));
