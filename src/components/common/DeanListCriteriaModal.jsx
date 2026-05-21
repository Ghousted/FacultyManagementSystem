import { useEffect, useState } from 'react';
import { normalizeDeanListCriteria } from '../../models/curriculumModels';

const computationOptions = [
  { label: 'Weighted (Grade/Units)', value: 'weighted' },
  { label: 'Simple Average (Subjects)', value: 'simple' }
];

const applyUnitsOptions = [
  { label: 'Regular students only', value: 'regular' },
  { label: 'Irregular students only', value: 'irregular' },
  { label: 'Both', value: 'both' }
];

export const DeanListCriteriaFields = ({ criteria, onChange }) => {
  const currentCriteria = normalizeDeanListCriteria(criteria);

  const updateCriteria = (patch) => {
    onChange({
      ...currentCriteria,
      ...patch
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs text-gray-700 mb-1">Major Grade Cutoff</label>
        <input
          type="number"
          step="0.01"
          value={currentCriteria.major}
          onChange={e => updateCriteria({ major: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-700 mb-1">Minor Grade Cutoff</label>
        <input
          type="number"
          step="0.01"
          value={currentCriteria.minor}
          onChange={e => updateCriteria({ minor: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-700 mb-1">GWA Cutoff</label>
        <input
          type="number"
          step="0.01"
          value={currentCriteria.gwa}
          onChange={e => updateCriteria({ gwa: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-700 mb-1">Minimum Units</label>
        <input
          type="number"
          min="1"
          step="1"
          value={currentCriteria.minUnits}
          onChange={e => updateCriteria({ minUnits: parseInt(e.target.value, 10) || 0 })}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition"
        />
        <p className="text-[11px] text-gray-500 mt-1">Minimum units required before a student can qualify for Dean's List.</p>
      </div>

      <div>
        <label className="block text-xs text-gray-700 mb-1">Apply Minimum Units For</label>
        <select
          value={currentCriteria.applyMinUnitsFor || 'both'}
          onChange={e => updateCriteria({ applyMinUnitsFor: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition"
        >
          {applyUnitsOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-700 mb-1">GWA Computation Method</label>
        <select
          value={currentCriteria.computation || 'weighted'}
          onChange={e => updateCriteria({ computation: e.target.value, gwaMethod: e.target.value })}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition"
        >
          {computationOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <p className="text-[11px] text-gray-500 mt-1">Weighted uses grade × units / total units. Simple uses the average grade across subjects.</p>
      </div>
    </div>
  );
};

const DeanListCriteriaModal = ({
  isOpen,
  criteria,
  onClose,
  onSave,
  isSaving = false,
  title = "Configure Dean's List Criteria"
}) => {
  const [localCriteria, setLocalCriteria] = useState(() => normalizeDeanListCriteria(criteria));

  useEffect(() => {
    setLocalCriteria(normalizeDeanListCriteria(criteria));
  }, [criteria, isOpen]);

  const handleSave = async () => {
    const result = await onSave(localCriteria);
    if (result?.success) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-96 max-w-full transform transition-transform duration-200 scale-100 sm:scale-105">
        <div className="px-8 py-4 border-b border-slate-300">
          <h3 className="text-xl font-medium text-slate-800">{title}</h3>
        </div>

        <div className="space-y-5 px-8 py-4">
          <DeanListCriteriaFields criteria={localCriteria} onChange={setLocalCriteria} />

          <div className="flex justify-end gap-2 mt-8">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg text-sm border text-blue-600 border-blue-500 bg-white hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 w-28 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeanListCriteriaModal;