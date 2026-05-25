import { useState } from 'react';
import ProfessorCutbacksReport from './ProfessorCutbacksReport';
import CCSCutbackReports from './CCSCutbackReports';
import Breadcrumbs from '../common/Breadcrumbs';
import { Building2, GraduationCap } from 'lucide-react';

const TABS = [
  {
    key: 'professor',
    label: 'Professor Cutback',
    description: 'Review professor earnings from module payments across CCS and other departments.',
    icon: GraduationCap
  },
  {
    key: 'ccs',
    label: 'Department Cutback',
    description: 'Review department share totals with separate CCS and other-department views.',
    icon: Building2
  }
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

      <div className="mb-5 grid gap-3 md:grid-cols-2">
        {TABS.map((tab) => (
          (() => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-2xl border p-4 text-left transition ${
              active
                ? 'border-blue-200 bg-blue-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50'
            }`}
          >
            <span className="flex items-start gap-3">
              <span className={`mt-0.5 rounded-xl p-2 ${active ? 'bg-white/15 text-white' : 'bg-blue-50 text-blue-600'}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{tab.label}</span>
                <span className={`mt-1 block text-xs leading-relaxed ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                  {tab.description}
                </span>
              </span>
            </span>
          </button>
            );
          })()
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        {activeTab === 'professor' ? <ProfessorCutbacksReport embedded /> : <CCSCutbackReports embedded />}
      </div>
    </div>
  );
};

export default CutBackReports;
