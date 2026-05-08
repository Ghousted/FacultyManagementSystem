import { useEffect, useState } from 'react';
import { ArrowBigLeft, GraduationCap, CalendarRange } from 'lucide-react';
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
    <div className="">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-300 mb-6">
        <div className="flex items-center gap-6">
          <button
            onClick={selectedProfessor ? () => setSelectedProfessor(null) : onBackToDashboard}
            className="group flex items-center gap-2 bg-blue-600 text-white p-2 cursor-pointer rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white transition-transform"
            aria-label="Back"
            title="Back"
          >
            <ArrowBigLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
              <GraduationCap className="text-blue-600 w-7 h-7" />
            </div>
            <div>
              <h5 className="text-2xl font-medium text-blue-600">Faculty Management</h5>
              <p className="text-gray-500 text-sm">
                Manage department professors, assign subjects from existing curriculums, and view enrolled students per subject.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-300 rounded-2xl shadow-sm p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <CalendarRange className="text-amber-600 w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Active Academic Term</p>
            {loadingTerm ? (
              <p className="text-gray-400 text-sm">Loading...</p>
            ) : (
              <p className="text-base font-semibold text-gray-800">
                {SEMESTER_LABELS[activeTerm.semester] || '1st Semester'}
                {activeTerm.schoolYear ? ` · S.Y. ${activeTerm.schoolYear}` : ''}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              Change the term and manage student enrollment in Student Management.
            </p>
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
