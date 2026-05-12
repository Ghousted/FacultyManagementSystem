import { useEffect, useState } from 'react';
import ProfessorList from './ProfessorList';
import ProfessorDetail from './ProfessorDetail';
import { getActiveTerm } from '../../models/facultyModels';

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
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-gray-500">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="text-left text-gray-600 hover:text-blue-600"
        >
          Dashboard
        </button>
        <span className="text-gray-300">&gt;</span>
        <button
          type="button"
          onClick={() => setSelectedProfessor(null)}
          className={`text-left ${
            selectedProfessor ? 'text-gray-600 hover:text-blue-600' : 'font-medium text-blue-600'
          }`}
        >
          Faculty Management
        </button>
        {selectedProfessor && (
          <>
            <span className="text-gray-300">&gt;</span>
            <button
              type="button"
              onClick={() => setDetailViewMode('detail')}
              className={`text-left ${
                detailViewMode === 'assign'
                  ? 'text-gray-600 hover:text-blue-600'
                  : 'font-medium text-blue-600'
              }`}
            >
              {selectedProfessor.name}
            </button>
          </>
        )}
        {selectedProfessor && detailViewMode === 'assign' && (
          <>
            <span className="text-gray-300">&gt;</span>
            <span className="font-medium text-blue-600">Assign Class</span>
          </>
        )}
      </div>

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
