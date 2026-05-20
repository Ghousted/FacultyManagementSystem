import { useEffect, useState } from 'react';
import ProfessorList from './ProfessorList';
import ProfessorDetail from './ProfessorDetail';
import { getActiveTerm } from '../../models/facultyModels';
import Breadcrumbs from '../common/Breadcrumbs';

const FacultyMain = ({ onBackToDashboard }) => {
  const [activeTerm, setActiveTerm] = useState({ semester: 1, schoolYear: '' });
  const [loadingTerm, setLoadingTerm] = useState(true);
  const [selectedProfessor, setSelectedProfessor] = useState(null);
  const [detailViewMode, setDetailViewMode] = useState('detail');

  useEffect(() => {
    const load = async () => {
      const res = await getActiveTerm();
      if (res.success) setActiveTerm(res.data);
      setLoadingTerm(false);
    };
    load();
  }, []);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Faculty Management', onClick: selectedProfessor ? () => setSelectedProfessor(null) : null },
          ...(selectedProfessor ? [{ label: selectedProfessor.name, onClick: detailViewMode === 'assign' ? () => setDetailViewMode('detail') : null }] : []),
          ...(selectedProfessor && detailViewMode === 'assign' ? [{ label: 'Assign Class' }] : [])
        ]}
      />

      <div className='mb-4'>
        <h2 className="text-2xl font-semibold text-gray-900">
          Faculty Management
        </h2>
        <p className="mt-1 text-sm text-gray-500 max-w-3xl">
          Manage Professors in your faculty, assign subjects from CCS department and other departments, and view their assigned subjects and students for the active term.
        </p>
      </div>

      {selectedProfessor ? (
        <ProfessorDetail
          professorId={selectedProfessor.id}
          activeTerm={activeTerm}
          onBack={() => setSelectedProfessor(null)}
          onViewModeChange={setDetailViewMode}
          viewMode={detailViewMode}
        />
      ) : (
        <ProfessorList
          activeTerm={activeTerm}
          onSelectProfessor={(p) => {
            setSelectedProfessor(p);
            setDetailViewMode('detail');
          }}
        />
      )}
    </div>
  );
};

export default FacultyMain;
