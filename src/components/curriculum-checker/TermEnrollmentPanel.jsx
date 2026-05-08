import { useEffect, useState } from 'react';
import { CalendarRange, Pencil, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { getActiveTerm, saveActiveTerm } from '../../models/facultyModels';
import EnrollmentManager from './EnrollmentManager';

const SEMESTER_LABELS = { 1: '1st Semester', 2: '2nd Semester', 3: 'Summer' };

const TermEnrollmentPanel = () => {
  const [activeTerm, setActiveTerm] = useState({ semester: 1, schoolYear: '' });
  const [loadingTerm, setLoadingTerm] = useState(true);

  const [editingTerm, setEditingTerm] = useState(false);
  const [draftTerm, setDraftTerm] = useState({ semester: 1, schoolYear: '' });
  const [savingTerm, setSavingTerm] = useState(false);
  const [termError, setTermError] = useState('');

  const [expanded, setExpanded] = useState(false);

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
      semester: draftTerm.semester,
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

  return (
    <div className="bg-white border border-gray-300 rounded-2xl shadow-sm mb-4">
      <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <CalendarRange className="text-amber-600 w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Active Academic Term</p>
            {loadingTerm ? (
              <p className="text-gray-400 text-sm">Loading...</p>
            ) : editingTerm ? (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <select
                  value={draftTerm.semester}
                  onChange={e => setDraftTerm({ ...draftTerm, semester: Number(e.target.value) })}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value={1}>1st Semester</option>
                  <option value={2}>2nd Semester</option>
                  <option value={3}>Summer</option>
                </select>
                <input
                  type="text"
                  placeholder="2025-2026"
                  value={draftTerm.schoolYear}
                  onChange={e => setDraftTerm({ ...draftTerm, schoolYear: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            ) : (
              <p className="text-lg font-semibold text-gray-800">
                {SEMESTER_LABELS[activeTerm.semester] || '1st Semester'}
                {activeTerm.schoolYear ? ` · S.Y. ${activeTerm.schoolYear}` : ''}
              </p>
            )}
            {termError && <p className="text-red-500 text-xs mt-1">{termError}</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {editingTerm ? (
            <>
              <button
                onClick={() => { setEditingTerm(false); setDraftTerm(activeTerm); setTermError(''); }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
                disabled={savingTerm}
              >
                <X className="w-4 h-4" /> Cancel
              </button>
              <button
                onClick={handleSaveTerm}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                disabled={savingTerm}
              >
                <Check className="w-4 h-4" /> {savingTerm ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setEditingTerm(true); setDraftTerm(activeTerm); }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 cursor-pointer"
                disabled={loadingTerm}
              >
                <Pencil className="w-4 h-4" /> Change Term
              </button>
              <button
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
              >
                {expanded
                  ? <><ChevronUp className="w-4 h-4" /> Hide Enrollment</>
                  : <><ChevronDown className="w-4 h-4" /> Manage Enrollment</>}
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 p-4">
          <EnrollmentManager activeTerm={activeTerm} />
        </div>
      )}
    </div>
  );
};

export default TermEnrollmentPanel;
