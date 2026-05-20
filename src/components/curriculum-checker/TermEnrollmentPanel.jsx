import { useEffect, useState } from 'react';
import { CalendarRange, Pencil, Check, X } from 'lucide-react';
import { getActiveTerm, saveActiveTerm, bulkSetAllStudentsNotEnrolled, unassignAllProfessorClasses } from '../../models/facultyModels';
import { clearAllOfferedModules } from '../../models/payablesModels';
import EnrollmentManager from './EnrollmentManager';

const SEMESTER_LABELS = { 1: '1st Semester', 2: '2nd Semester', 3: 'Summer' };

const TermEnrollmentPanel = ({ headerOnly = false }) => {
  const [activeTerm, setActiveTerm] = useState({ semester: 1, schoolYear: '' });
  const [loadingTerm, setLoadingTerm] = useState(true);
  const [editingTerm, setEditingTerm] = useState(false);
  const [draftTerm, setDraftTerm] = useState({ semester: 1, schoolYear: '' });
  const [savingTerm, setSavingTerm] = useState(false);
  const [termError, setTermError] = useState('');

  useEffect(() => {
    const load = async () => {
      const res = await getActiveTerm();
      if (res.success) {
        setActiveTerm(res.data);
        setDraftTerm(res.data);
      }
      setLoadingTerm(false);
    };
    load();
  }, []);

  useEffect(() => {
    const openTermEditor = () => {
      if (!loadingTerm) {
        setDraftTerm(activeTerm);
        setTermError('');
        setEditingTerm(true);
      }
    };

    window.addEventListener('open-term-editor', openTermEditor);
    return () => window.removeEventListener('open-term-editor', openTermEditor);
  }, [activeTerm, loadingTerm]);

  const handleSaveTerm = async () => {
    setTermError('');
    const sy = (draftTerm.schoolYear || '').trim();

    if (!sy) {
      setTermError('School year is required (e.g. 2025-2026).');
      return;
    }

    setSavingTerm(true);
    const res = await saveActiveTerm({
      semester: Number(draftTerm.semester),
      schoolYear: sy
    });

    if (res.success) {
      const previousActiveTerm = activeTerm;
      const nextTerm = { semester: Number(draftTerm.semester), schoolYear: sy };
      setActiveTerm(nextTerm);
      setEditingTerm(false);
      setSavingTerm(false);

      const termChanged =
        Number(previousActiveTerm.semester) !== Number(nextTerm.semester) ||
        (previousActiveTerm.schoolYear || '') !== (nextTerm.schoolYear || '');

      if (termChanged) {
        // Clear all offered modules when term changes
        const clearRes = await clearAllOfferedModules();
        if (!clearRes.success) {
          setTermError(
            `Term saved, but failed to clear offered modules: ${clearRes.error || 'Unknown error'}`
          );
        }

        // Unassign all professor classes when term changes
        const unassignRes = await unassignAllProfessorClasses();
        if (!unassignRes.success) {
          setTermError(
            `Term saved, but failed to unassign professor classes: ${unassignRes.error || 'Unknown error'}`
          );
        }

        // Unenroll all students for fresh start
        const unenrollRes = await bulkSetAllStudentsNotEnrolled({ suppressLog: true });
        if (!unenrollRes.success) {
          setTermError(
            `Term saved, but failed to unenroll students: ${unenrollRes.error || 'Unknown error'}`
          );
        }
      }
    } else {
      setSavingTerm(false);
      setTermError(res.error || 'Failed to save active term.');
    }
  };

  const termControl = (
    <>
      <div className="rounded-xl border border-gray-200 bg-white px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-8">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <CalendarRange className="h-5 w-5 text-amber-700" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Active Academic Term
              </p>

              {loadingTerm ? (
                <div className="mt-2 h-6 w-48 animate-pulse rounded bg-gray-100" />
              ) : (
                <p className="mt-1 truncate text-lg font-medium text-gray-900">
                  {SEMESTER_LABELS[activeTerm.semester] || '1st Semester'}
                  {activeTerm.schoolYear ? ` · S.Y. ${activeTerm.schoolYear}` : ''}
                </p>
              )}

              {termError && (
                <p className="mt-2 text-sm font-medium text-red-600">
                  {termError}
                </p>
              )}
            </div>
          </div>

        
        </div>
      </div>

      {editingTerm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-slate-800">Update Academic Term</h2>
              </div>
           
            </div>

           <div className="px-6 py-5">
            <div className="flex flex-col gap-4">
              
              {/* Semester */}
              <div className="space-y-1">
                <label
                  htmlFor="semester"
                  className="text-sm  text-slate-700"
                >
                  Semester
                </label>

                <select
                  id="semester"
                  value={draftTerm.semester}
                  onChange={e =>
                    setDraftTerm({
                      ...draftTerm,
                      semester: Number(e.target.value),
                    })
                  }
                  disabled={savingTerm}
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                >
                  <option value={1}>1st Semester</option>
                  <option value={2}>2nd Semester</option>
                  <option value={3}>Summer</option>
                </select>
              </div>

              {/* School Year */}
              <div className="space-y-1">
                <label
                  htmlFor="schoolYear"
                  className="text-sm  text-slate-700"
                >
                  School Year
                </label>

                <input
                  id="schoolYear"
                  type="text"
                  inputMode="numeric"
                  placeholder="2025-2026"
                  value={draftTerm.schoolYear}
                  onChange={e =>
                    setDraftTerm({
                      ...draftTerm,
                      schoolYear: e.target.value,
                    })
                  }
                  disabled={savingTerm}
className="w-full border cursor-pointer text-sm border-slate-200 bg-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-shadow"
                />
              </div>
            </div>

            {termError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-sm font-medium text-red-600">{termError}</p>
              </div>
            )}

            
            <div className="mt-8 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingTerm(false);
                  setDraftTerm(activeTerm);
                  setTermError('');
                }}
                disabled={savingTerm}
                className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveTerm}
                disabled={savingTerm}
                className="px-4 py-1.5 w-28 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {savingTerm ? 'Saving...' : 'Save'}
              </button>
            </div>

          </div>

          </div>
        </div>
      )}
    </>
  );

  if (headerOnly) {
    return <div>{termControl}</div>;
  }

  return (
    <div>
      <EnrollmentManager activeTerm={activeTerm} />
    </div>
  );
};

export default TermEnrollmentPanel;
