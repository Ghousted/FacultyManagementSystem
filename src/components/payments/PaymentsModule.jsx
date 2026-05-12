import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, BookOpen, Search, RefreshCw, DollarSign, Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import { getOfferedModules, getAllModulePayables } from '../../models/payablesModels';
import { getStudents } from '../../models/curriculumModels';
import { getActiveTerm } from '../../models/facultyModels';

const SEMESTER_LABELS = { 1: '1st Sem', 2: '2nd Sem', 3: 'Summer' };
const YEAR_LABELS = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };

const PaymentsModule = ({ onBackToDashboard }) => {
  const [loading, setLoading] = useState(true);
  const [offeredModules, setOfferedModules] = useState([]);
  const [modulePayables, setModulePayables] = useState([]);
  const [students, setStudents] = useState([]);
  const [activeTerm, setActiveTerm] = useState({ semester: 1, schoolYear: '' });
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [selectedModule, setSelectedModule] = useState(null);

  // Load all data
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const termRes = await getActiveTerm();
      const currentTerm = termRes.success ? termRes.data : { semester: 1, schoolYear: '' };
      setActiveTerm(currentTerm);

      const [modulesRes, payablesRes, studentsRes] = await Promise.all([
        getOfferedModules(currentTerm),
        getAllModulePayables(currentTerm),
        getStudents()
      ]);

      if (!modulesRes.success) throw new Error(modulesRes.error || 'Failed to load offered modules.');
      if (!payablesRes.success) throw new Error(payablesRes.error || 'Failed to load module payables.');
      if (!studentsRes.success) throw new Error(studentsRes.error || 'Failed to load students.');

      setOfferedModules(modulesRes.data);
      setModulePayables(payablesRes.data);
      setStudents(studentsRes.data);
    } catch (e) {
      setError(e.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Create student map for quick lookup
  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach(s => map.set(s.id, s));
    return map;
  }, [students]);

  // Process modules with payment information
  const modulesWithPayments = useMemo(() => {
    return offeredModules.map(module => {
      const payable = modulePayables.find(p => p.moduleId === module.id) ||
                     modulePayables.find(p => (p.moduleCode || '').toLowerCase() === (module.courseCode || '').toLowerCase());

      const amount = payable ? Number(payable.amount) || 0 : null;
      const studentPayments = payable?.studentPayments || {};

      // Process student payment data
      const paymentStats = {
        totalStudents: 0,
        paidCount: 0,
        partialCount: 0,
        unpaidCount: 0,
        totalCollected: 0,
        blocks: new Set()
      };

      Object.entries(studentPayments).forEach(([studentId, payment]) => {
        const student = studentMap.get(studentId);
        if (!student) return;

        paymentStats.totalStudents++;
        paymentStats.blocks.add(student.block || 'Unassigned');

        const paidAmount = Number(payment?.paidAmount) || 0;
        paymentStats.totalCollected += paidAmount;

        if (amount !== null && amount > 0) {
          if (paidAmount >= amount) {
            paymentStats.paidCount++;
          } else if (paidAmount > 0) {
            paymentStats.partialCount++;
          } else {
            paymentStats.unpaidCount++;
          }
        }
      });

      return {
        ...module,
        amount,
        hasPayable: !!payable,
        payableId: payable?.id || null,
        professor: payable?.professor || module.professor || module.instructor || '',
        paymentStats,
        collectionRate: paymentStats.totalStudents > 0 
          ? (paymentStats.paidCount / paymentStats.totalStudents) * 100 
          : 0
      };
    });
  }, [offeredModules, modulePayables, studentMap]);

  // Filter modules based on search
  const filteredModules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return modulesWithPayments;

    return modulesWithModules.filter(module =>
      (module.courseCode || '').toLowerCase().includes(query) ||
      (module.courseTitle || '').toLowerCase().includes(query) ||
      (module.professor || '').toLowerCase().includes(query)
    );
  }, [modulesWithPayments, search]);

  // Status indicator component
  const StatusIndicator = ({ status }) => {
    const configs = {
      paid: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
      partial: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
      unpaid: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' }
    };

    const config = configs[status] || configs.unpaid;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Module Payments</h1>
          <p className="text-gray-600 mt-1">
            View and manage payments for offered modules
            {activeTerm.schoolYear && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                {SEMESTER_LABELS[activeTerm.semester]}, SY {activeTerm.schoolYear}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by code, title, or professor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Modules Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">
            {offeredModules.length === 0
              ? 'No offered modules found. Mark subjects as "offered" in the Payables module first.'
              : 'No modules match your search criteria.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModules.map(module => (
            <div
              key={module.id}
              onClick={() => setSelectedModule(module)}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow cursor-pointer"
            >
              {/* Module Header */}
              <div className="mb-4">
                <h3 className="font-semibold text-lg text-gray-900">{module.courseCode}</h3>
                <p className="text-sm text-gray-600 mt-1">{module.courseTitle}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <span className="px-2 py-1 bg-gray-100 rounded">
                    {YEAR_LABELS[module.yearLevel] || 'Irregular'}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 rounded">
                    {SEMESTER_LABELS[module.semester] || `Sem ${module.semester}`}
                  </span>
                </div>
              </div>

              {/* Professor */}
              {module.professor && (
                <div className="mb-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Professor:</span> {module.professor}
                  </p>
                </div>
              )}

              {/* Payment Info */}
              <div className="space-y-2">
                {module.amount !== null ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Amount:</span>
                    <span className="font-semibold text-green-600">PHP {module.amount.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Amount:</span>
                    <span className="text-xs text-gray-400 italic">No payable set</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Students:</span>
                  <span className="font-medium">{module.paymentStats.totalStudents}</span>
                </div>

                {module.paymentStats.totalStudents > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Collected:</span>
                      <span className="font-medium text-green-600">
                        PHP {module.paymentStats.totalCollected.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Collection Rate:</span>
                      <span className={`font-medium ${
                        module.collectionRate >= 80 ? 'text-green-600' :
                        module.collectionRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {module.collectionRate.toFixed(1)}%
                      </span>
                    </div>

                    {/* Payment Status Breakdown */}
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex justify-between text-xs">
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span>{module.paymentStats.paidCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-yellow-600" />
                          <span>{module.paymentStats.partialCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-red-600" />
                          <span>{module.paymentStats.unpaidCount}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Module Detail Modal */}
      {selectedModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setSelectedModule(null)}
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-auto bg-white rounded-2xl shadow-2xl">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedModule.courseCode} — {selectedModule.courseTitle}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {YEAR_LABELS[selectedModule.yearLevel]} • {SEMESTER_LABELS[selectedModule.semester]}
                    {selectedModule.professor && ` • ${selectedModule.professor}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedModule(null)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Payment Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Total Students</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-700 mt-1">
                    {selectedModule.paymentStats.totalStudents}
                  </p>
                </div>

                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Paid</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700 mt-1">
                    {selectedModule.paymentStats.paidCount}
                  </p>
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-600">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">Partial</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-700 mt-1">
                    {selectedModule.paymentStats.partialCount}
                  </p>
                </div>

                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Unpaid</span>
                  </div>
                  <p className="text-2xl font-bold text-red-700 mt-1">
                    {selectedModule.paymentStats.unpaidCount}
                  </p>
                </div>
              </div>

              {/* Financial Summary */}
              {selectedModule.amount !== null && (
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Financial Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Module Amount:</span>
                      <span className="font-medium">PHP {selectedModule.amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Expected:</span>
                      <span className="font-medium">
                        PHP {(selectedModule.amount * selectedModule.paymentStats.totalStudents).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-sm text-gray-900">Total Collected:</span>
                      <span className="text-green-600">
                        PHP {selectedModule.paymentStats.totalCollected.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Outstanding:</span>
                      <span className="font-medium text-red-600">
                        PHP {(
                          (selectedModule.amount * selectedModule.paymentStats.totalStudents) - 
                          selectedModule.paymentStats.totalCollected
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Blocks */}
              {selectedModule.paymentStats.blocks.size > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Blocks</h3>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(selectedModule.paymentStats.blocks).map(block => (
                      <span key={block} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        Block {block}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsModule;
