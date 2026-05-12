import { useState } from 'react';
import CurriculumMaker from './CurriculumMaker';
import StudentManagement from './StudentManagement';
import CurriculumCheckerMain from './CurriculumCheckerMain';
import TermEnrollmentPanel from './TermEnrollmentPanel';
import { ArrowBigLeft, NotebookPen, Users, BookCheck, UserCheck } from 'lucide-react';

const CurriculumChecker = ({ onBackToDashboard, initialView, initialCurriculumId }) => {
  const [currentView, setCurrentView] = useState(initialView || 'main');

  const handleFeatureSelect = (feature) => {
    setCurrentView(feature);
  };

  const handleBackToMain = () => {
    setCurrentView('main');
  };

  const featureCards = [
    {
      key: 'curriculum-maker',
      title: 'Curriculum Maker',
      description: 'Create and manage curriculum templates, courses, prerequisites, and requirements.',
      icon: NotebookPen
    },
     {
      key: 'student-management',
      title: 'Student Management',
      description: 'Add students, assign curriculums, and track their course completion progress.',
      icon: Users
    },
     {
      key: 'enrollment-management',
      title: 'Enrollment Management',
      description: 'Manage student enrollment by semester, school year, year level, and block.',
      icon: UserCheck
    },
   
    {
      key: 'curriculum-checker',
      title: 'Curriculum Checker',
      description: 'Search students and view their curriculum status and course eligibility.',
      icon: BookCheck
    }
  ];

  if (currentView === 'curriculum-maker') {
    return <CurriculumMaker onBack={handleBackToMain} initialCurriculumId={initialCurriculumId} />;
  }

  if (currentView === 'student-management') {
    return <StudentManagement onBack={handleBackToMain} />;
  }

  if (currentView === 'curriculum-checker') {
    return <CurriculumCheckerMain onBack={handleBackToMain} />;
  }

  if (currentView === 'enrollment-management') {
    return <TermEnrollmentPanel onBack={handleBackToMain} />;
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="text-gray-600 hover:text-blue-600"
        >
          Dashboard
        </button>
        <span className="text-gray-300">&gt;</span>
        <span className="font-medium text-blue-600">Curriculum Management System</span>
      </div>
      <div className="mb-6 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            onClick={onBackToDashboard}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowBigLeft className="h-5 w-5" />
          </button>

          <div>
            <h5 className="text-2xl font-semibold text-gray-900">
              Curriculum Management System
            </h5>
            <p className="mt-1 text-sm leading-relaxed text-gray-500">
              Review curriculum requirements, student records, enrollment, and academic compliance.
            </p>
          </div>
        </div>
      </div>

    

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {featureCards.map((feature) => {
          const Icon = feature.icon;

          return (
            <button
              key={feature.key}
              type="button"
              onClick={() => handleFeatureSelect(feature.key)}
              className="group h-64 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <div className="flex h-full flex-col justify-between">
                <div>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
                    <Icon className="h-6 w-6" />
                  </div>

                  <h5 className="text-lg font-semibold text-gray-900">
                    {feature.title}
                  </h5>

                  <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    {feature.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center text-sm font-medium text-blue-600">
                  Open module
                  <i className="bi bi-chevron-right ml-2 text-xs transition group-hover:translate-x-0.5"></i>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CurriculumChecker;
