import { useState } from 'react';
import ProfessorCutbacksReport from './ProfessorCutbacksReport';
import CCSCutbackReports from './CCSCutbackReports';
import Breadcrumbs from '../common/Breadcrumbs';

const TABS = [
  { key: 'professor', label: 'Professor Cutback' },
  { key: 'ccs', label: 'CCS Department Cutback' }
];

const CutBackReports = () => {
  const [activeTab, setActiveTab] = useState('professor');

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Cutback Reports' }]} />

      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-gray-900">Cutback Reports</h2>
        <p className="mt-1 text-sm text-gray-500 max-w-3xl">
          Overview and manage cutback reports for professors across CCS and other departments, plus the CCS department module cutback.
        </p>
      </div>

      <div className="flex gap-2 mb-4 w-fit items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-1 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
                : 'text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'professor' ? <ProfessorCutbacksReport embedded /> : <CCSCutbackReports embedded />}
    </div>
  );
};

export default CutBackReports;
