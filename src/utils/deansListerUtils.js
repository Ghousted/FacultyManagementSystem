const toNumber = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeCourseCode = (code) => (code || '').toString().trim().toUpperCase();

export const getSemesterLoadCodes = (student, semester) => {
  const semKey = `sem${semester}`;
  const loads = student?.semesterLoads || {};
  const raw = loads[semKey];
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeCourseCode).filter(Boolean);
};

export const resolveSemesterCoursesForStudent = ({
  student,
  semester,
  year,
  curriculumCourses = [],
  allCourses = []
}) => {
  const normalizedSemester = Number(semester);
  const normalizedYear = typeof year === 'number' ? Number(year) : null;

  if (student?.isIrregular) {
    const semKey = `sem${normalizedSemester}`;
    const manualSubjects = student?.irregularSubjects?.[semKey] || [];
    if (Array.isArray(manualSubjects) && manualSubjects.length > 0) {
      return manualSubjects.map((subject) => ({
        id: subject.id || `${semKey}-${normalizeCourseCode(subject.courseCode)}`,
        courseCode: subject.courseCode,
        courseTitle: subject.courseTitle,
        units: subject.units,
        semester: normalizedSemester,
        yearLevel: subject.yearLevel || normalizedYear || student.yearLevel || 1,
        isMajor: !!subject.isMajor,
        prerequisites: subject.prerequisites || []
      }));
    }
  }

  const allCoursePool = Array.isArray(allCourses) && allCourses.length > 0 ? allCourses : curriculumCourses;
  const courseByCode = new Map();

  allCoursePool.forEach((course) => {
    const code = normalizeCourseCode(course.courseCode);
    if (!code || courseByCode.has(code)) return;
    courseByCode.set(code, course);
  });

  const enrolledCodes = getSemesterLoadCodes(student, normalizedSemester);
  if (enrolledCodes.length > 0) {
    return enrolledCodes
      .map((code) => courseByCode.get(code))
      .filter(Boolean)
      .filter((course) => Number(course.semester) === normalizedSemester);
  }

  if (student?.isIrregular) {
    const grades = student?.grades || {};
    const gradedCodes = Object.entries(grades)
      .filter(([, value]) => Number.isFinite(parseFloat(value)))
      .map(([code]) => normalizeCourseCode(code));

    const gradedSet = new Set(gradedCodes);
    const fromGraded = allCoursePool.filter((course) => {
      const code = normalizeCourseCode(course.courseCode);
      return Number(course.semester) === normalizedSemester && gradedSet.has(code);
    });

    if (fromGraded.length > 0) {
      return fromGraded;
    }

    return allCoursePool.filter((course) => Number(course.semester) === normalizedSemester);
  }

  return curriculumCourses.filter((course) =>
    Number(course.yearLevel) === normalizedYear && Number(course.semester) === normalizedSemester
  );
};

export const evaluateDeansListerEligibility = ({
  student,
  courses = [],
  criteria
}) => {
  const effectiveCriteria = {
    minGrade: toNumber(criteria?.minGrade, 2.1),
    gwa: toNumber(criteria?.gwa, 2.0),
    minUnits: toNumber(criteria?.minUnits, 15)
  };

  const grades = student?.grades || {};
  let totalUnits = 0;
  let weightedSum = 0;
  let exceedsMinGrade = false;
  const gradeDetails = [];

  courses.forEach((course) => {
    const code = course.courseCode;
    const rawGrade = grades[code];
    const numericGrade = parseFloat(rawGrade);
    if (!Number.isFinite(numericGrade)) return;

    const units = toNumber(course.units, 0);
    totalUnits += units;
    weightedSum += numericGrade * (units || 1);

    if (numericGrade > effectiveCriteria.minGrade) {
      exceedsMinGrade = true;
    }

    gradeDetails.push({
      code,
      subject: course.courseTitle,
      grade: numericGrade,
      units,
      isMajor: !!course.isMajor
    });
  });

  const gwa = totalUnits > 0 ? weightedSum / totalUnits : null;
  const hasMinimumUnits = totalUnits >= effectiveCriteria.minUnits;
  const passesGwa = gwa !== null && gwa <= effectiveCriteria.gwa;
  const eligible = gradeDetails.length > 0 && hasMinimumUnits && !exceedsMinGrade && passesGwa;

  return {
    eligible,
    gwa,
    totalUnits,
    gradeDetails,
    reasons: {
      hasGrades: gradeDetails.length > 0,
      hasMinimumUnits,
      passesMinGrade: !exceedsMinGrade,
      passesGwa
    }
  };
};
