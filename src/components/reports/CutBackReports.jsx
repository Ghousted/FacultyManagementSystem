import { useCallback, useState } from 'react';
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
  const [breadcrumbTrail, setBreadcrumbTrail] = useState([]);
  const handleBreadcrumbChange = useCallback((items) => {
    setBreadcrumbTrail(items || []);
  }, []);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Cutback Reports' },
          ...breadcrumbTrail
        ]}
      />

      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-gray-900">Cutback Reports</h2>
        <p className="mt-1 text-sm text-gray-500 max-w-3xl">
          Overview and manage cutback reports for professors across CCS and other departments, plus the CCS department module cutback.
        </p>
      </div>

  <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          (() => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-3 py-2 text-sm w-fit font-medium transition ${
              active
                ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-200 cursor-pointer'
            }`}
          >
              
              
                {tab.label}
                
              
          </button>
            );
          })()
        ))}
      </div>

      <div className="mt-4">
        {activeTab === 'professor'
          ? <ProfessorCutbacksReport embedded onBreadcrumbChange={handleBreadcrumbChange} />
          : <CCSCutbackReports embedded onBreadcrumbChange={handleBreadcrumbChange} />}
      </div>
    </div>
  );
};

export default CutBackReports;
