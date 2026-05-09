import { useEffect, useState } from 'react';
import { ArrowBigLeft, CalendarRange } from 'lucide-react';
import ProfessorList from './ProfessorList';
import ProfessorDetail from './ProfessorDetail';
import { getActiveTerm } from '../../models/facultyModels';

const SEMESTER_LABELS = { 1: '1st Semester', 2: '2nd Semester', 3: 'Summer' };

const FacultyMain = ({ onBackToDashboard }) => {
  const [activeTerm, setActiveTerm] = useState({ semester: 1, schoolYear: '' });
  const [loadingTerm, setLoadingTerm] = useState(true);
  const [selectedProfessor, setSelectedProfessor] = useState(null);

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
      <div className="mb-6 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={selectedProfessor ? () => setSelectedProfessor(null) : onBackToDashboard}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2"
              aria-label="Back"
              title="Back"
            >
              <ArrowBigLeft className="h-5 w-5" />
            </button>

            <div>
              <h5 className="text-2xl font-semibold text-gray-900">
                Faculty Management
              </h5>
              <p className="mt-1 text-sm leading-relaxed text-gray-500">
                Manage professors, subject assignments, and enrolled students per subject.
              </p>
            </div>
          </div>

          
        </div>
      </div>

      {selectedProfessor ? (
        <ProfessorDetail
          professorId={selectedProfessor.id}
          activeTerm={activeTerm}
          onBack={() => setSelectedProfessor(null)}
        />
      ) : (
        <ProfessorList
          activeTerm={activeTerm}
          onSelectProfessor={(p) => setSelectedProfessor(p)}
        />
      )}
    </div>
  );
};

export default FacultyMain;
