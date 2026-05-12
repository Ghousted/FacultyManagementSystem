import React, { useEffect, useState, useRef } from 'react';
import { getCurriculums, getCoursesByCurriculum } from '../../models/curriculumModels';
import tccImg from '../../assets/TCC.jpg';
import logoImg from '../../assets/logo.png';

const CurriculumPreview = ({ curriculumId: propCurriculumId = null, onClose = null, student = null, summerCourses = [] }) => {
  const [curriculumId, setCurriculumId] = useState(propCurriculumId || null);
  const [curriculum, setCurriculum] = useState(null);
  const [courses, setCourses] = useState([]);
  const containerRef = useRef(null);

  const getInitials = (name) => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
  };

  const getCoursesByYearAndSem = (year, sem) => {
    return (courses || []).filter(c => Number(c.yearLevel) === Number(year) && Number(c.semester) === Number(sem));
  };

  const computeGWAForSemester = (studentObj, year, sem) => {
    if (!studentObj || !studentObj.grades) return null;
    const semesterCourses = (courses || []).filter(c => Number(c.yearLevel) === Number(year) && Number(c.semester) === Number(sem));
    let totalUnits = 0;
    let weightedSum = 0;
    for (const course of semesterCourses) {
      const gradeVal = studentObj.grades ? studentObj.grades[course.courseCode] : undefined;
      const grade = parseFloat(gradeVal);
      if (isNaN(grade)) continue;
      const units = parseFloat(course.units) || 0;
      totalUnits += units;
      weightedSum += grade * (units || 1);
    }
    return totalUnits > 0 ? weightedSum / totalUnits : null;
  };

  const calculateScholarshipEligibility = (studentObj, year) => {
    if (!studentObj || !studentObj.grades) return { eligible: false, percentage: 0 };
    const yearCourses = (courses || []).filter(c => Number(c.yearLevel) === Number(year)).map(c => c.courseCode) || [];
    const yearGrades = yearCourses
      .map(code => studentObj.grades[code])
      .filter(grade => grade !== undefined && grade !== null && grade !== '' && grade !== 'INC' && grade !== 'CRED');
    if (yearGrades.length === 0) return { eligible: false, percentage: 0 };
    const maxGrade = Math.max(...yearGrades.map(g => parseFloat(g)));
    if (maxGrade <= 1.5) return { eligible: true, percentage: 100 };
    if (maxGrade <= 1.7) return { eligible: true, percentage: 50 };
    return { eligible: false, percentage: 0 };
  };

  const calculateDeansListerEligibility = (studentObj, semester, year) => {
    if (!studentObj || !studentObj.grades) return false;
    const semesterCourses = (courses || [])
      .filter(c => Number(c.yearLevel) === Number(year) && Number(c.semester) === Number(semester))
      .map(c => c.courseCode) || [];
    const semesterGrades = semesterCourses
      .map(code => studentObj.grades[code])
      .filter(g => g !== undefined && g !== null && g !== '' && g !== 'INC' && g !== 'CRED');
    if (semesterGrades.length === 0) return false;
    return semesterGrades.every(grade => {
      const num = parseFloat(grade);
      return !isNaN(num) && num <= 2.1;
    });
  };

  useEffect(() => {
    if (propCurriculumId) {
      setCurriculumId(propCurriculumId);
      return;
    }
    if (!curriculumId) {
      const hash = window.location.hash || '';
      const path = window.location.pathname || '';
      let m = null;
      if (hash) {
        m = hash.match(/#\/curriculum-preview\/(.+)/) || hash.match(/curriculums\/(.+?)\/pdf/);
      }
      if (!m) {
        m = path.match(/curriculums\/(.+?)\/pdf/) || path.match(/curriculum-preview\/(.+)/);
      }
      if (m) setCurriculumId(m[1]);
    }
  }, [propCurriculumId, curriculumId]);

  useEffect(() => {
    if (propCurriculumId && propCurriculumId !== curriculumId) setCurriculumId(propCurriculumId);
  }, [propCurriculumId]);

  useEffect(() => {
    if (!curriculumId) return;
    (async () => {
      try {
        const res = await getCurriculums();
        if (res && res.success) {
          const found = res.data.find((c) => c.id === curriculumId);
          setCurriculum(found || null);
        }
        const cRes = await getCoursesByCurriculum(curriculumId, true);
        if (cRes && cRes.success) setCourses(cRes.data || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [curriculumId]);

  useEffect(() => {
    try {
      if (containerRef?.current && typeof containerRef.current.scrollIntoView === 'function') {
        containerRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
      window.scrollTo(0, 0);
    } catch (e) {
      // ignore
    }
  }, [curriculumId]);

  useEffect(() => {
    let prevTitle = document.title;
    const handleBeforePrint = () => {
      try {
        prevTitle = document.title;
        document.title = '';
      } catch (e) {
        // ignore
      }
    };
    const handleAfterPrint = () => {
      try {
        document.title = prevTitle;
      } catch (e) {
        // ignore
      }
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const renderYearSections = () => {
    return [1,2,3,4].map((yr) => {
      const gwa1 = computeGWAForSemester(student, yr, 1);
      const gwa2 = computeGWAForSemester(student, yr, 2);
      const gwaSummer = computeGWAForSemester(student, yr, 3);
      const scholarshipEligibility = calculateScholarshipEligibility(student, yr);
      return (
        <div key={yr} className="year-section mb-2">
          <div className="year-columns">
            <div>
              <div className="semester-box  text-sm">
                <div className="flex items-center justify-between ">
                  <div className="year-label font-bold">{yr === 1 ? '1st Year' : yr === 2 ? '2nd Year' : yr === 3 ? '3rd Year' : '4th Year'}</div>
                  <div className="sem-title text-xs">1st Semester</div>
                </div>
                <table className='border-collapse border border-gray-400 w-full'>
                  <colgroup>
                    <col style={{width: '10%'}} />
                    <col style={{width: '15%'}} />
                    <col style={{width: '65%'}} />
                    <col style={{width: '10%'}} />
                  </colgroup>
                  <thead className='bg-blue-100 text-gray-700'>
                    <tr className='border border-gray-400'>
                      <th className="small border border-gray-400 px-0.5">Grade</th>
                      <th className="small border border-gray-400 px-0.5">Code</th>
                      <th className="small border border-gray-400 px-0.5">Title</th>
                      <th className="small border border-gray-400 px-0.5">Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getCoursesByYearAndSem(yr, 1).map(c => (
                      <tr key={c.id}>
                        <td className="small border border-gray-400 px-0.5">{(student && student.grades && student.grades[c.courseCode]) ? student.grades[c.courseCode] : (c.grade || '')}</td>
                        <td className="small border border-gray-400 px-0.5">{c.courseCode}</td>
                        <td className="small border border-gray-400 px-0.5">{c.courseTitle}</td>
                        <td className="small border border-gray-400 px-0.5">{c.units}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex mt-0.5 gap-6 text-xs">
                <div>
                  <p>GWA: {gwa1 !== null ? gwa1.toFixed(2) : (student && student.gwa ? parseFloat(student.gwa).toFixed(2) : '')}</p>
                </div>

                <div className="recommended-section">
                  <span className='mr-1'>Recommended for:</span>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-0.5">
                      <input
                        type="checkbox"
                        id={`deansList-${yr}-1`}
                        checked={calculateDeansListerEligibility(student, 1, yr)}
                        readOnly
                        className="form-checkbox h-4 w-4 text-blue-600"
                      />
                      <label htmlFor={`deansList-${yr}-1`}>Dean's List</label>
                    </div>

                    <div className='flex'>
                      <span className='mr-1'>Scholarship:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          id={`scholar-50-${yr}-1`}
                          checked={scholarshipEligibility.percentage === 50}
                          readOnly
                          className="form-checkbox h-4 w-4 text-blue-600"
                        />
                        <label htmlFor={`scholar-50-${yr}-1`}>50%</label>
                      </div>

                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          id={`scholar-100-${yr}-1`}
                          checked={scholarshipEligibility.percentage === 100}
                          readOnly
                          className="form-checkbox h-4 w-4 text-blue-600"
                        />
                        <label htmlFor={`scholar-100-${yr}-1`}>100%</label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Print-specific recommendation text for Curriculum Checker */}
                {student && (calculateDeansListerEligibility(student, 1, yr) || scholarshipEligibility.eligible) && (
                  <div className="print-recommendation">
                    Recommended for Dean's Lister{scholarshipEligibility.eligible && scholarshipEligibility.percentage > 0 ? ` & ${scholarshipEligibility.percentage}% Scholarship.` : '.'}
                  </div>
                )}
              </div>

              <div className="flex items-end text-xs mt-5 gap-4">
                <span>Checked by:</span>
                <div className="flex-1 border-b border-gray-400"></div>
                <span>Noted by: <strong>Dean Myra Santos</strong></span>
              </div>

              {(() => {
                const summerFromProp = (summerCourses || []).filter(sc => Number(sc.yearLevel) === Number(yr) && Number(sc.semester) === 3);
                const summerList = summerFromProp.length > 0 ? summerFromProp : getCoursesByYearAndSem(yr, 3);
                if (!summerList || summerList.length === 0) return null;
                return (
                  <div>
                    <div className="semester-box mt-2 text-sm summer-box-screen">
                      <div className="sem-title text-end text-xs">Summer</div>
                      <table className='border-collapse border border-gray-400 w-full'>
                        <colgroup>
                          <col style={{width: '10%'}} />
                          <col style={{width: '15%'}} />
                          <col style={{width: '65%'}} />
                          <col style={{width: '10%'}} />
                        </colgroup>
                  <thead className='bg-blue-100 text-gray-700'>
                          <tr className='border border-gray-400'>
                            <th className="small border border-gray-400 px-0.5">Grade</th>
                            <th className="small border border-gray-400 px-0.5">Code</th>
                            <th className="small border border-gray-400 px-0.5">Title</th>
                            <th className="small border border-gray-400 px-0.5">Units</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summerList.map(c => (
                            <tr key={c.id}>
                              <td className="small border border-gray-400 px-0.5">{(student && student.grades && student.grades[c.courseCode]) ? student.grades[c.courseCode] : (c.grade || '')}</td>
                              <td className="small border border-gray-400 px-0.5">{c.courseCode}</td>
                              <td className="small border border-gray-400 px-0.5">{c.courseTitle}</td>
                              <td className="small border border-gray-400 px-0.5">{c.units}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex mt-0.5 gap-8 text-xs">
                      <div>
                        <p>GWA: {gwaSummer !== null ? gwaSummer.toFixed(2) : (student && student.gwa ? parseFloat(student.gwa).toFixed(2) : '')}</p>
                      </div>

                      <div className="recommended-section">
                        <span>Recommended for:</span>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-0.5">
                            <input
                              type="checkbox"
                              id={`deansList-${yr}-s`}
                              checked={calculateDeansListerEligibility(student, 3, yr)}
                              readOnly
                              className="form-checkbox h-4 w-4 text-blue-600"
                            />
                            <label htmlFor={`deansList-${yr}-s`}>Dean's List</label>
                          </div>

                          <div className='flex'>
                            <span className='mr-1'>Scholarship:</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                id={`scholar-50-${yr}-s`}
                                checked={scholarshipEligibility.percentage === 50}
                                readOnly
                                className="form-checkbox h-4 w-4 text-blue-600"
                              />
                              <label htmlFor={`scholar-50-${yr}-s`}>50%</label>
                            </div>

                            <div className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                id={`scholar-100-${yr}-s`}
                                checked={scholarshipEligibility.percentage === 100}
                                readOnly
                                className="form-checkbox h-4 w-4 text-blue-600"
                              />
                              <label htmlFor={`scholar-100-${yr}-s`}>100%</label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Print-specific recommendation text for Curriculum Checker */}
                      {student && (calculateDeansListerEligibility(student, 3, yr) || scholarshipEligibility.eligible) && (
                        <div className="print-recommendation">
                          Recommended for Dean's Lister{scholarshipEligibility.eligible && scholarshipEligibility.percentage > 0 ? ` & ${scholarshipEligibility.percentage}% Scholarship.` : '.'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>

            <div>
              <div className="semester-box">
                <div className="sem-title text-end text-xs">2nd Semester</div>
                <table className='border-collapse border border-gray-400 w-full text-sm'>
                  <colgroup>
                    <col style={{width: '10%'}} />
                    <col style={{width: '15%'}} />
                    <col style={{width: '65%'}} />
                    <col style={{width: '10%'}} />
                  </colgroup>
                  <thead className='bg-blue-100 text-gray-700'>
                    <tr className='border border-gray-400'>
                      <th className="small border border-gray-400 px-0.5">Grade</th>
                      <th className="small border border-gray-400 px-0.5">Code</th>
                      <th className="small border border-gray-400 px-0.5">Title</th>
                      <th className="small border border-gray-400 px-0.5">Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getCoursesByYearAndSem(yr, 2).map(c => (
                      <tr key={c.id}>
                        <td className="small border border-gray-400 px-0.5">{(student && student.grades && student.grades[c.courseCode]) ? student.grades[c.courseCode] : (c.grade || '')}</td>
                        <td className="small border border-gray-400 px-0.5">{c.courseCode}</td>
                        <td className="small border border-gray-400 px-0.5">{c.courseTitle}</td>
                        <td className="small border border-gray-400 px-0.5">{c.units}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex mt-0.5 gap-8 text-xs">
                  <div>
                    <p>GWA: {gwa2 !== null ? gwa2.toFixed(2) : (student && student.gwa ? parseFloat(student.gwa).toFixed(2) : '')}</p>
                  </div>

                  <div className="recommended-section">
                    <span>Recommended for:</span>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-0.5">
                        <input
                          type="checkbox"
                          id={`deansList-${yr}-2`}
                          checked={calculateDeansListerEligibility(student, 2, yr)}
                          readOnly
                          className="form-checkbox h-4 w-4 text-blue-600"
                        />
                        <label htmlFor={`deansList-${yr}-2`}>Dean's List</label>
                      </div>

                      <div className='flex'>
                        <span className='mr-1'>Scholarship:</span>

                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            id={`scholar-50-${yr}-2`}
                            checked={scholarshipEligibility.percentage === 50}
                            readOnly
                            className="form-checkbox h-4 w-4 text-blue-600"
                          />
                          <label htmlFor={`scholar-50-${yr}-2`}>50%</label>
                        </div>

                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            id={`scholar-100-${yr}-2`}
                            checked={scholarshipEligibility.percentage === 100}
                            readOnly
                            className="form-checkbox h-4 w-4 text-blue-600"
                          />
                          <label htmlFor={`scholar-100-${yr}-2`}>100%</label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Print-specific recommendation text for Curriculum Checker */}
                  {student && (calculateDeansListerEligibility(student, 2, yr) || scholarshipEligibility.eligible) && (
                    <div className="print-recommendation">
                      Recommended for Dean's Lister{scholarshipEligibility.eligible && scholarshipEligibility.percentage > 0 ? ` & ${scholarshipEligibility.percentage}% Scholarship.` : '.'}
                    </div>
                  )}
                </div>

                <div className="flex items-end text-xs mt-5 gap-4">
                  <span>Checked by:</span>
                  <div className="flex-1 border-b border-gray-400"></div>
                  <span>Noted by: <strong>Dean Myra Santos</strong></span>
                </div>

              </div>

            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="p-6 w-full mx-auto">

      <div ref={containerRef} className="print-area">
        {curriculum ? (
          <div>
            <div className="print-header mb-4 relative">
              <div className="header-row flex items-center justify-center">
                <div className="left-logo flex items-center ">
                  <img src={tccImg} alt="TCC" className="tcc-logo" />
                </div>
                <div className="header-center text-center">
                  <div className="institution text-xl">Tomas Claudio Colleges</div>
                  <div className="address">Taghangin, Morong, Rizal</div>
                  <div className="subtitle text-sm mt-1">{curriculum.name || ''}</div>
                </div>
                <div className="right-logo flex items-center ml-4">
                  <img src={logoImg} alt="Logo" className="org-logo" />
                </div>

                <div className="one-by-one absolute" aria-hidden>
                  <div className="one-box">1x1</div>
                </div>
              </div>
            </div>

            <div className="preview-meta">
              <div className="photo">
                {student?.photoUrl || student?.photoURL ? (
                  <img src={student.photoUrl || student.photoURL} alt="Photo" />
                ) : (
                  <div className="photo-initials">{getInitials(student?.name)}</div>
                )}
              </div>

            </div>

          <div className="mb-8 w-full">
            <div className="flex items-start gap-24 justify-between">
              <div className="student-info flex-1">
                <div className="flex items-end gap-6">
                  <div className="flex items-end gap-2 text-sm">
                    <span className="min-w-[90px] text-sm">Student no:</span>
                    <div className="w-36 border-b border-gray-400 ">{student?.studentNumber || ''}</div>
                  </div>

                  <div className="flex items-end flex-1 gap-3 text-sm">
                    <span className="pl-2 text-sm">Name:</span>
                    <div className="w-full max-w-[300px] border-b border-gray-400">{student?.name || ''}</div>
                  </div>
                </div>

                <div className="flex items-end gap-6 mt-1">
                  <div className="flex items-end gap-2 text-sm">
                    <span className="min-w-[90px] text-sm">Contact no:</span>
                    <div className="w-36 border-b border-gray-400">{student?.contact || ''}</div>
                  </div>

                  <div className="flex items-end flex-1 gap-3 text-sm">
                    <span className="pl-2 text-sm">Email:</span>
                    <div className="w-full max-w-[300px] border-b border-gray-400">{student?.email || ''}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

            <style>{`
              @page { size: 8.5in 13in; margin: 0mm; }
              @media print {
                html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
                body { -webkit-print-color-adjust: exact; }
                .no-print { display: none !important; }
                body * { visibility: hidden; }
                .print-area, .print-area * { visibility: visible; }
                .p-6 { padding: 0 !important; margin: 0 !important; }
                .print-area { position: fixed; left: 0; top: 0; width: 8.5in; height: 13in; padding: 8mm !important; box-sizing: border-box; }
                .year-section, table, tr, .semester-box { page-break-inside: avoid !important; }
                .print-area { page-break-after: avoid !important; page-break-before: avoid !important; }
                .year-label { font-weight: 700; text-transform: uppercase; margin-bottom: 6px; font-size: 11px; }
                .year-columns { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; align-items: start; }
                .semester-box {  display: flex; flex-direction: column; height: 100%; }
                table { border-collapse: collapse; width: 100%; font-size: 10.5px; table-layout: fixed; }
                th, td { border: 1px solid #000; font-size: 10px; padding: 1px 4px; vertical-align: middle; word-wrap: break-word; }
                thead th {   font-size: 10px; }
                .sem-title { font-size: 10px; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; }
                .small { font-size: 10px; }
                .institution { font-size: 18px; font-weight: 700; }
                .address { font-size: 11px; margin-top: 2px; }
                .curr-name { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; }
                tr { page-break-inside: avoid; }
                .print-header .header-row { align-items: center; }
                .left-logo, .right-logo { width: 56px; }
                .header-center { padding: 0 8px; }
                .one-by-one { position: absolute; right: 0mm; top: 0mm; }
                .one-box { width: 1in; height: 1in; border: 1px solid #000; display:flex; align-items:center; justify-content:center; font-size:14px; }
                .header-logos img { display: inline-block; }
                .tcc-logo { width: 48px; height: 48px; object-fit: contain; }
                .org-logo { width: 48px; height: 48px; object-fit: contain; margin-left: -6px; }
                .print-area .preview-meta { position: absolute; right: 24mm; top: 6mm; display:flex; flex-direction:column; gap:4px; align-items:flex-end; }
                .print-area .photo { width: 1in; height: 1in; }
                .print-area .photo img { width: 1in; height: 1in; object-fit: cover; }
                .print-area .photo-initials { display: none !important; }
                .semester-box th:nth-child(1), .semester-box td:nth-child(1) { width: 11%; text-align: center; font-size: 9px; }
                .semester-box th:nth-child(2), .semester-box td:nth-child(2) { width: 12%; text-align: left; font-size: 9px; }
                .semester-box th:nth-child(3), .semester-box td:nth-child(3) { width: 72%; text-align: left; font-size: 9px; }
                .semester-box th:nth-child(4), .semester-box td:nth-child(4) { width: 5%; text-align: center; font-size: 9px; }
                
                /* Hide Recommended for sections when printing */
                .recommended-section { display: none !important; }
                
                /* Show special print text for Dean's Lister and Scholarship */
                .print-recommendation { display: block !important; font-size: 9px; margin-top: 2px; color: #000; }
              }
              @media screen {
                  .preview-meta { position: absolute; right: 1rem; top: 1rem; display:flex; flex-direction:column; gap:6px; align-items:flex-end; }
                  .photo { width:1in; height:1in; }
                  .header-logos img { display:inline-block; }
                  .tcc-logo { width:48px; height:48px; object-fit:contain; }
                  .org-logo { width:48px; height:48px; object-fit:contain; }
                  .one-by-one { position: absolute; right: 1rem; top: -6px; }
                  .one-box { width: 1in; height: 1in; border: 1px solid #000; display:flex; align-items:center; justify-content:center; font-size:14px; }
                  .print-header .header-row { align-items:center; }
                  .left-logo, .right-logo { width:64px; }
                  .header-center { padding: 0 12px; }
                .semester-col { padding-right: 1rem; }
                .year-columns { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
                .semester-box { width: 100%; }
                
                /* Hide print-specific elements on screen */
                .print-recommendation { display: none !important; }
              }
            `}</style>

            <div>
              {renderYearSections()}
            </div>
          </div>
        ) : (
          <div className="text-gray-600">No curriculum selected for preview.</div>
        )}
      </div>
    </div>
  );
};

export default CurriculumPreview;