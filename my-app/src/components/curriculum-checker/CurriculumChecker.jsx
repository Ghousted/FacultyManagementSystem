import { useState } from 'react';
import CurriculumMaker from './CurriculumMaker';
import StudentManagement from './StudentManagement';
import CurriculumCheckerMain from './CurriculumCheckerMain';

const CurriculumChecker = ({ onBackToDashboard }) => {
  const [currentView, setCurrentView] = useState('main'); // 'main', 'curriculum-maker', 'student-management', 'curriculum-checker'
  const [tabValue, setTabValue] = useState(0);

  const handleFeatureSelect = (feature) => {
    setCurrentView(feature);
  };

  const handleBackToMain = () => {
    setCurrentView('main');
  };

  // Render specific feature
  if (currentView === 'curriculum-maker') {
    return (
      <div className="p-4 max-w-7xl mx-auto">
        <CurriculumMaker onBack={handleBackToMain} />
      </div>
    );
  }

  if (currentView === 'student-management') {
    return (
      <div className="p-4 max-w-7xl mx-auto">
        <StudentManagement onBack={handleBackToMain} />
      </div>
    );
  }

  if (currentView === 'curriculum-checker') {
    return (
      <div className="p-1 max-w-7xl mx-auto">
        <CurriculumCheckerMain onBack={handleBackToMain} />
      </div>
    );
  }

  // Render main menu
  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className=''>
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-300 mb-10">
          <div className="flex items-center gap-6">
            <button
              onClick={onBackToDashboard}
              className="group flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-white transition-transform"
              aria-label="Back to dashboard"
              title="Back to dashboard"
            >
              <span className="hidden sm:inline text-sm font-medium">Back</span>
            </button>
            <div className="flex flex-col gap-2">
              <h5 className="text-2xl font-bold text-blue-600">
                Curriculum Management System
              </h5>
              <p className="text-gray-600">
                Review and validate curriculum requirements, course mappings, and academic compliance for the institution
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className=" h-80 cursor-pointer transition-all duration-300 border border-gray-300 rounded-2xl bg-white hover:shadow-xl hover:border-blue-500 hover:-translate-y-2 focus-within:border-blue-500"
            onClick={() => handleFeatureSelect('curriculum-maker')}
          >
            <div className="text-center py-8 h-full flex flex-col justify-between">
              <div>
                <div className="mx-auto w-20 h-20 mb-6 rounded-full bg-blue-50 flex items-center justify-center">
                  <i className="bi bi-pencil-square text-blue-600 text-4xl"></i>
                </div>
                <h5 className="text-xl font-bold mb-4 text-blue-600">
                  Curriculum Maker
                </h5>
                <p className="text-gray-600 leading-relaxed">
                  Create and manage curriculum templates with courses, prerequisites, and academic requirements.
                </p>
              </div>
              <p className="text-blue-600 font-semibold mt-4 flex items-center justify-center gap-2">
                <span>Click to access</span>
                <i className="bi bi-chevron-right"></i>
              </p>
            </div>
          </div>

          <div
            className=" h-80 cursor-pointer transition-all duration-300 border border-gray-300 rounded-2xl bg-white hover:shadow-xl hover:border-green-500 hover:-translate-y-2 focus-within:border-green-500"
            onClick={() => handleFeatureSelect('student-management')}
          >
            <div className="text-center py-8 h-full flex flex-col justify-between">
              <div>
                <div className="mx-auto w-20 h-20 mb-6 rounded-full bg-green-50 flex items-center justify-center">
                  <i className="bi bi-people text-green-600 text-4xl"></i>
                </div>
                <h5 className="text-xl font-bold mb-4 text-green-600">
                  Student Management
                </h5>
                <p className="text-gray-600 leading-relaxed">
                  Add students, assign curriculums, and track their course completion progress.
                </p>
              </div>
              <p className="text-green-600 font-semibold mt-4 flex items-center justify-center gap-2">
                <span>Click to access</span>
                <i className="bi bi-chevron-right"></i>
              </p>
            </div>
          </div>

          <div
            className=" h-80 cursor-pointer transition-all duration-300 border border-gray-300 rounded-2xl bg-white hover:shadow-xl hover:border-orange-500 hover:-translate-y-2 focus-within:border-orange-500"
            onClick={() => handleFeatureSelect('curriculum-checker')}
          >
            <div className="text-center py-8 h-full flex flex-col justify-between">
              <div>
                <div className="mx-auto w-20 h-20 mb-6 rounded-full bg-orange-50 flex items-center justify-center">
                  <i className="bi bi-graph-up text-orange-600 text-4xl"></i>
                </div>
                <h5 className="text-xl font-bold mb-4 text-orange-600">
                  Curriculum Checker
                </h5>
                <p className="text-gray-600 leading-relaxed">
                  Search students and view their curriculum status with color-coded course eligibility.
                </p>
              </div>
              <p className="text-orange-600 font-semibold mt-4 flex items-center justify-center gap-2">
                <span>Click to access</span>
                <i className="bi bi-chevron-right"></i>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurriculumChecker;