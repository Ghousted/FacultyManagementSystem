import {
  compareTermKeys,
  folderHasActiveTermStudents,
  getActiveTermKey,
  getStudentTermKey,
  getTermLabelFromKey,
  getYearLevelLabel,
  isStudentFromPreviousTerm,
  isStudentInActiveTerm,
  sortStudentsActiveTermFirst
} from './termHelpers';

export const getYearLabel = (year) => {
  const normalizedYear = Number(year);
  if (normalizedYear === 1) return '1st';
  if (normalizedYear === 2) return '2nd';
  if (normalizedYear === 3) return '3rd';
  if (normalizedYear === 4) return '4th';
  return year ? `${year}th` : '';
};

export const getFolderLabel = (folder) => {
  if (!folder) return '';
  if (folder.isPreviousTermFolder) return folder.label || 'Inactive Students';
  if (folder.isInactiveFolder) return folder.label || 'Inactive Students';
  if (folder.isIrregular) return 'Irregular Students';
  const yearNum = Number(folder.year || 0);
  return `${getYearLabel(yearNum)} Year Block ${folder.block || 'A'}`;
};

export const buildStudentFolders = (students, options = {}) => {
  const {
    includeInactiveFolder = false,
    inactiveStudents = [],
    inactiveFolderLabel = 'Inactive Students',
    inactiveScope = 'deactivated',
    includePreviousTermFolder = false,
    previousTermStudents = [],
    previousTermFolderLabel = 'Inactive Students',
    activeTerm = null
  } = options;

  const folderStudents =
    includePreviousTermFolder && activeTerm
      ? (students || []).filter((student) => !isStudentFromPreviousTerm(student, activeTerm))
      : students || [];

  const map = new Map();

  folderStudents.forEach((student) => {
    const isIrregular = !!student.isIrregular;
    if (isIrregular) {
      const key = 'Irregular';
      if (!map.has(key)) {
        map.set(key, {
          key: 'irregular-all',
          year: null,
          block: null,
          isIrregular: true,
          label: 'Irregular Students',
          students: []
        });
      }
      map.get(key).students.push(student);
      return;
    }

    const block =
      student?.block && String(student.block).trim() !== ''
        ? String(student.block).trim().toUpperCase()
        : 'A';
    const yearForFolder = student.yearLevel;
    const folderKey = `${yearForFolder}||${block}`;

    if (!map.has(folderKey)) {
      map.set(folderKey, {
        key: folderKey,
        year: Number(yearForFolder),
        block,
        isIrregular: false,
        label: `${getYearLabel(Number(yearForFolder))} Year Block ${block}`,
        students: []
      });
    }
    map.get(folderKey).students.push(student);
  });

  if (includeInactiveFolder && (inactiveStudents || []).length > 0) {
    map.set('__inactive__', {
      key: '__inactive__',
      year: null,
      block: null,
      isIrregular: false,
      isInactiveFolder: true,
      inactiveScope,
      label: inactiveFolderLabel,
      students: inactiveStudents || []
    });
  }

  if (includePreviousTermFolder && (previousTermStudents || []).length > 0) {
    map.set('__previous_term__', {
      key: '__previous_term__',
      year: null,
      block: null,
      isIrregular: false,
      isPreviousTermFolder: true,
      label: previousTermFolderLabel,
      students: previousTermStudents || []
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const getRank = (folder) => {
      if (folder.isPreviousTermFolder) return 102;
      if (folder.isInactiveFolder) return 101;
      if (folder.isIrregular) return 100;
      return Number(folder.year || 0);
    };

    const rankDiff = getRank(a) - getRank(b);
    if (rankDiff !== 0) return rankDiff;

    if (!a.isIrregular && !b.isIrregular && !a.isInactiveFolder && !b.isInactiveFolder) {
      if ((a.year || 0) !== (b.year || 0)) return (a.year || 0) - (b.year || 0);
      return (a.block || '').localeCompare(b.block || '');
    }

    return 0;
  });
};

/** Normalize course / year / block; folder key also includes enrollment term. */
export const normalizeOtherDeptComboParts = (student) => {
  const course = (student?.course || '').toString().trim();
  const parsedYear = Number(student?.yearLevel);
  const year =
    Number.isFinite(parsedYear) && parsedYear > 0
      ? String(parsedYear)
      : String(student?.yearLevel ?? '').trim();
  const rawBlock = (student?.block || '').toString().trim();
  const block = rawBlock ? rawBlock.toUpperCase() : '—';
  const termKey = getStudentTermKey(student);

  return {
    course,
    year,
    block,
    termKey,
    key: `${termKey}::${course.toLowerCase()}::${year}::${block}`
  };
};

export const normalizeOtherDeptComboFromFolder = (combo) => {
  const course = (combo?.course || '').toString().trim();
  const parsedYear = Number(combo?.year);
  const year =
    Number.isFinite(parsedYear) && parsedYear > 0
      ? String(parsedYear)
      : String(combo?.year ?? '').trim();
  const rawBlock = (combo?.block || '').toString().trim();
  const block = rawBlock ? rawBlock.toUpperCase() : '—';
  const termKey = combo?.termKey ?? getStudentTermKey(combo) ?? 'legacy::';

  return {
    course,
    year,
    block,
    termKey,
    key: `${termKey}::${course.toLowerCase()}::${year}::${block}`
  };
};

export const buildOtherDeptComboLabel = (course, year, block) =>
  `${course || 'Course'} · ${getYearLevelLabel(year)} · Block ${block}`;

/** Group sorted combo folders under their enrollment term (one section per term). */
export const groupOtherDeptFoldersByTerm = (folders, activeTerm) => {
  const groups = [];
  let currentGroup = null;

  (folders || []).forEach((folder) => {
    const termKey = folder.termKey || 'legacy::';

    if (!currentGroup || currentGroup.termKey !== termKey) {
      currentGroup = {
        termKey,
        termLabel: folder.termLabel || getTermLabelFromKey(termKey),
        isActiveTermFolder:
          folder.isActiveTermFolder || termKey === getActiveTermKey(activeTerm),
        folders: []
      };
      groups.push(currentGroup);
    }

    currentGroup.folders.push(folder);
  });

  return groups.sort((a, b) => compareTermKeys(a.termKey, b.termKey, activeTerm));
};

export const studentMatchesOtherDeptCombo = (student, combo) => {
  const studentParts = normalizeOtherDeptComboParts(student);
  const comboParts = normalizeOtherDeptComboFromFolder(combo);
  return studentParts.key === comboParts.key;
};

export const getOtherDeptFolderStudentCounts = (folder, activeTerm) => {
  const students = folder?.students || [];
  let current = 0;
  let previous = 0;

  students.forEach((student) => {
    if (isStudentFromPreviousTerm(student, activeTerm)) {
      previous += 1;
    } else {
      current += 1;
    }
  });

  return { total: students.length, current, previous };
};

export const compareOtherDeptComboFolders = (left, right, activeTerm = null) => {
  const termCompare = compareTermKeys(left.termKey, right.termKey, activeTerm);
  if (termCompare !== 0) return termCompare;

  const leftHasCourseSortIndex = Number.isFinite(left.courseSortIndex);
  const rightHasCourseSortIndex = Number.isFinite(right.courseSortIndex);

  if (leftHasCourseSortIndex || rightHasCourseSortIndex) {
    if (!leftHasCourseSortIndex) return 1;
    if (!rightHasCourseSortIndex) return -1;
    if (left.courseSortIndex !== right.courseSortIndex) {
      return left.courseSortIndex - right.courseSortIndex;
    }
  }

  const courseCompare = String(left.course || '').localeCompare(String(right.course || ''), undefined, {
    sensitivity: 'base',
    numeric: true
  });
  if (courseCompare !== 0) return courseCompare;

  const yearCompare = Number(left.year || 0) - Number(right.year || 0);
  if (yearCompare !== 0) return yearCompare;

  const leftBlock = String(left.block || '').trim().toUpperCase();
  const rightBlock = String(right.block || '').trim().toUpperCase();
  if (leftBlock !== rightBlock) return leftBlock.localeCompare(rightBlock, undefined, { sensitivity: 'base' });

  return String(left.label || '').localeCompare(String(right.label || ''), undefined, {
    sensitivity: 'base',
    numeric: true
  });
};

export const buildOtherDeptComboFolders = (students, options = {}) => {
  const { activeTerm = null } = options;
  const comboMap = new Map();
  const courseOrder = new Map();
  let nextCourseOrder = 0;

  const activeTermKey = getActiveTermKey(activeTerm);

  (students || []).forEach((student) => {
    const { course, year, block, termKey, key } = normalizeOtherDeptComboParts(student);
    const normalizedCourseKey = String(course || 'Unspecified Course').trim().toLowerCase();

    if (!courseOrder.has(normalizedCourseKey)) {
      courseOrder.set(normalizedCourseKey, nextCourseOrder++);
    }

    if (!comboMap.has(key)) {
      comboMap.set(key, {
        key,
        course,
        year,
        block,
        courseSortIndex: courseOrder.get(normalizedCourseKey),
        termKey,
        termLabel: getTermLabelFromKey(termKey),
        isActiveTermFolder: Boolean(activeTermKey && termKey === activeTermKey),
        label: buildOtherDeptComboLabel(course, year, block),
        students: []
      });
    }
    comboMap.get(key).students.push(student);
  });

  return Array.from(comboMap.values())
    .map((folder) => ({
      ...folder,
      students: [...folder.students].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true })
      )
    }))
    .sort((a, b) => compareOtherDeptComboFolders(a, b, activeTerm));
};

export const filterStudentsForComboFolder = (students, selectedCombo) => {
  if (!selectedCombo) return students || [];

  return (students || []).filter((student) => studentMatchesOtherDeptCombo(student, selectedCombo));
};

export const filterStudentsForFolder = (students, selectedFolder, options = {}) => {
  if (!selectedFolder) return students || [];
  const { activeTerm = null } = options;

  return (students || []).filter((student) => {
    if (selectedFolder.isPreviousTermFolder) {
      return isStudentFromPreviousTerm(student, activeTerm);
    }
    if (selectedFolder.isInactiveFolder) {
      if (selectedFolder.inactiveScope === 'previous-term') {
        return isStudentFromPreviousTerm(student, activeTerm);
      }
      return student.active === false;
    }
    if (selectedFolder.isIrregular) {
      return !!student.isIrregular;
    }

    const block =
      student?.block && String(student.block).trim() !== ''
        ? String(student.block).trim().toUpperCase()
        : 'A';

    return (
      !student.isIrregular &&
      Number(student.yearLevel) === Number(selectedFolder.year) &&
      block === (selectedFolder.block || 'A')
    );
  });
};
