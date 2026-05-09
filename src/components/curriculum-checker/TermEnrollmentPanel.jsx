import { useEffect, useState } from 'react';
import { CalendarRange, Pencil, Check, X, ArrowBigLeft } from 'lucide-react';
import { getActiveTerm, saveActiveTerm } from '../../models/facultyModels';
import EnrollmentManager from './EnrollmentManager';

const SEMESTER_LABELS = { 1: '1st Semester', 2: '2nd Semester', 3: 'Summer' };

const TermEnrollmentPanel = ({ headerOnly = false, onBack }) => {
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
    setSavingTerm(false);

    if (res.success) {
      setActiveTerm({ semester: Number(draftTerm.semester), schoolYear: sy });
      setEditingTerm(false);
    } else {
      setTermError(res.error || 'Failed to save active term.');
    }
  };

  const termControl = (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100">
        <CalendarRange className="h-5 w-5 text-amber-700" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Active Academic Term
        </p>

        {loadingTerm ? (
          <div className="mt-2 h-6 w-48 animate-pulse rounded bg-gray-100" />
        ) : editingTerm ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(150px,auto)_minmax(140px,180px)]">
            <label className="sr-only" htmlFor="semester">
              Semester
            </label>
            <select
              id="semester"
              value={draftTerm.semester}
              onChange={e =>
                setDraftTerm({ ...draftTerm, semester: Number(e.target.value) })
              }
              disabled={savingTerm}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50"
            >
              <option value={1}>1st Semester</option>
              <option value={2}>2nd Semester</option>
              <option value={3}>Summer</option>
            </select>

            <label className="sr-only" htmlFor="schoolYear">
              School year
            </label>
            <input
              id="schoolYear"
              type="text"
              inputMode="numeric"
              placeholder="2025-2026"
              value={draftTerm.schoolYear}
              onChange={e =>
                setDraftTerm({ ...draftTerm, schoolYear: e.target.value })
              }
              disabled={savingTerm}
              className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50"
            />
          </div>
        ) : (
          <p className="mt-1 truncate text-lg font-semibold text-gray-900">
            {SEMESTER_LABELS[activeTerm.semester] || "1st Semester"}
            {activeTerm.schoolYear ? ` · S.Y. ${activeTerm.schoolYear}` : ""}
          </p>
        )}

        {termError && (
          <p className="mt-2 text-sm font-medium text-red-600">
            {termError}
          </p>
        )}
      </div>
    </div>

    <div className="flex shrink-0 items-center gap-2 sm:pt-1">
      {editingTerm ? (
        <>
          <button
            type="button"
            onClick={() => {
              setEditingTerm(false);
              setDraftTerm(activeTerm);
              setTermError("");
            }}
            disabled={savingTerm}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveTerm}
            disabled={savingTerm}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            {savingTerm ? "Saving..." : "Save"}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditingTerm(true);
            setDraftTerm(activeTerm);
          }}
          disabled={loadingTerm}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Pencil className="h-4 w-4" />
          Change Term
        </button>
      )}
    </div>
  </div>
</div>

  );

  if (headerOnly) {
    return <div>{termControl}</div>;
  }

  return (
    <div>
      <div className="bg-white text-black p-8 rounded-2xl mb-6 flex items-center justify-between border border-gray-300 shadow-lg">
        <div className="flex items-center gap-6">
          {onBack && (
            <button
              onClick={onBack}
              className="group cursor-pointer flex items-center gap-2 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700"
              aria-label="Back"
            >
              <ArrowBigLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="text-2xl font-medium text-blue-600">Enrollment Management</div>
            <div className="text-gray-500 text-sm">
              Manage enrollment by active term, year level, and block.
            </div>
          </div>
        </div>
      </div>

      <EnrollmentManager activeTerm={activeTerm} />
    </div>
  );
};

export default TermEnrollmentPanel;
