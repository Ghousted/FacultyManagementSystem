import React, { useEffect, useState, useRef } from 'react';
import { getCurriculums, getCoursesByCurriculum } from '../../models/curriculumModels';

const CurriculumPreview = ({ curriculumId: propCurriculumId = null, onClose = null, student = null }) => {
  const [curriculumId, setCurriculumId] = useState(propCurriculumId || null);
  const [curriculum, setCurriculum] = useState(null);
  const [courses, setCourses] = useState([]);
  const containerRef = useRef(null);

  const getCoursesByYearAndSem = (year, sem) => {
    return (courses || []).filter(c => Number(c.yearLevel) === Number(year) && Number(c.semester) === Number(sem));
  };

  useEffect(() => {
    // update when prop changes; if no prop, fallback to parsing pathname/hash
    if (propCurriculumId) {
      setCurriculumId(propCurriculumId);
      return;
    }
    if (!curriculumId) {
      const hash = window.location.hash || '';
      const path = window.location.pathname || '';
      // Try to extract id from hash first (app uses hash routing), then fallback to pathname
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

  // keep in sync if parent changes id
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

  // When preview opens or curriculum changes, ensure view is at top so print starts from top
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

  return (
    <div className="p-6 w-full mx-auto">

 
      <div ref={containerRef} className="print-area">
        {curriculum ? (
          <div>
            <div className="print-header text-center mb-6">
              <div className="institution text-xl">Tomas Claudio Colleges</div>
              <div className="address">Taghangin, Morong, Rizal</div>
              <div className="curr-name mt-3">{curriculum.name}</div>
            </div>

          <div className="mb-8 w-full">
            <div className="flex items-end gap-6">
              <div className="flex items-center gap-3">
                <span className="min-w-[90px]">Student no:</span>
                <div className="w-36 border-b border-gray-400 pb-1">{student?.studentNumber || ''}</div>
              </div>

            
              <div className="flex items-center flex-1 gap-3">
                <span className="pl-2">Name:</span>
                <div className="flex-1 border-b border-gray-400 pb-1">{student?.name || ''}</div>
              </div>
            </div>
          </div>

            <style>{`
              @page { size: legal; margin: 4mm; }
              @media print {
                /* hide everything except the printable area to avoid extra headers/sidebars */
                body { -webkit-print-color-adjust: exact; }
                .no-print { display: none !important; }
                /* Make only .print-area visible when printing */
                body * { visibility: hidden; }
                .print-area, .print-area * { visibility: visible; }
                .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 6mm !important;  }

                /* layout and typography for print */
                .year-section { page-break-inside: avoid; break-inside: avoid; margin-bottom: 10px; }
                .year-label { font-weight: 700; text-transform: uppercase; margin-bottom: 6px; font-size: 11px; }
                .year-columns { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; align-items: start; }
                .semester-box {  display: flex; flex-direction: column; height: 100%; }
                table { border-collapse: collapse; width: 100%; font-size: 10.5px; table-layout: fixed; }
                th, td { border: 1px solid #000; padding: 2px 4px; vertical-align: middle; word-wrap: break-word; }
                thead th { background: #efefef; font-weight: 700; font-size: 10px; }
                .sem-title { font-size: 10px; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; }
                .small { font-size: 10px; }
                .institution { font-size: 18px; font-weight: 700; }
                .address { font-size: 11px; margin-top: 2px; }
                .curr-name { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; }
                tr { page-break-inside: avoid; }

                /* column width and alignment: Grade | Code | Title | Units */
                .semester-box th:nth-child(1), .semester-box td:nth-child(1) { width: 10%; text-align: center; }
                .semester-box th:nth-child(2), .semester-box td:nth-child(2) { width: 15%; text-align: left; }
                .semester-box th:nth-child(3), .semester-box td:nth-child(3) { width: 65%; text-align: left; }
                .semester-box th:nth-child(4), .semester-box td:nth-child(4) { width: 10%; text-align: center; }
              }
              @media screen {
                .semester-col { padding-right: 1rem; }
                .year-columns { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
                .semester-box { width: 100%; }
              }
            `}</style>

            <div>

              {[1,2,3,4].map((yr) => (
                <div key={yr} className="year-section mb-6">
                  <div className="year-label font-bold">{yr === 1 ? '1st Year' : yr === 2 ? '2nd Year' : yr === 3 ? '3rd Year' : '4th Year'}</div>
                  <div className="year-columns">
                    <div>
                      <div className="semester-box mb-3 text-sm">
                        <div className="sem-title">1st Semester</div>
                        <table className='border-collapse border border-gray-400 w-full'>
                          <colgroup>
                            <col style={{width: '10%'}} />
                            <col style={{width: '15%'}} />
                            <col style={{width: '65%'}} />
                            <col style={{width: '10%'}} />
                          </colgroup>
                          <thead className=''>
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
                    </div>

                    <div>
                      <div className="semester-box">
                        <div className="sem-title text-sm">2nd Semester</div>
                        <table className='border-collapse border border-gray-400 w-full text-sm'>
                          <colgroup>
                            <col style={{width: '10%'}} />
                            <col style={{width: '15%'}} />
                            <col style={{width: '65%'}} />
                            <col style={{width: '10%'}} />
                          </colgroup>
                          <thead>
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
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
