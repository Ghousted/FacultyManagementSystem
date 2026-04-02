import { useState, useEffect, useCallback } from 'react';
import { getStudents } from '../../models/curriculumModels';
import { 
  createPayable, 
  getPayables, 
  updatePayable, 
  deletePayable,
  createStudentPayment,
  getStudentPayments,
  getAllStudentPayments
} from '../../models/payablesModels';
import { useAuth } from '../../contexts/AuthContext';
import { BadgePlus,  Search, ChevronUp, ChevronDown, ChevronsUpDown, Funnel, X, Printer, Pencil, Delete, History, Settings2, Download, Receipt, Trash } from 'lucide-react';

const PayablesSystem = ({ onBackToDashboard }) => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState('name-asc'); // 'name-asc', 'name-desc', 'balance-asc', 'balance-desc'
  
  // Payment dialog states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentType: 'tuition',
    description: '',
    dueDate: '',
    status: 'pending'
  });

  // Student payment dialog states
  // 1. Remove all payment dialog/modal state and handlers (studentPaymentDialogOpen, selectedPayableForPayment, selectedStudentForPayment, studentPaymentForm, handleStudentPaymentClick, handleStudentPaymentFormChange, handleSaveStudentPayment, handleMarkAsFullyPaid, and their usages)
  // 2. In the payables table, always render the paid amount as a TextField (not just in edit mode)
  // 3. On change, update Firestore immediately
  // 4. Remove the Record Payment modal JSX
  // 5. Remove any references to the old modal-based payment workflow

  // Payable management states
  const [payables, setPayables] = useState({}); // {yearLevel: [payables]} - year-specific payables
  const [editingMode, setEditingMode] = useState(false);
  const [addPayableDialogOpen, setAddPayableDialogOpen] = useState(false);
  const [newPayableForm, setNewPayableForm] = useState({
    type: '',
    amount: '',
    status: 'unpaid',
    paidAmount: '0',
    yearLevel: 'all'
  });

  // Student modal states
  const [selectedStudentModal, setSelectedStudentModal] = useState(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  // Staged payment edits (not yet saved to Firestore)
  const [stagedPayments, setStagedPayments] = useState({}); // { payableId: paidAmount }
  const [confirmLoading, setConfirmLoading] = useState(false);
  
  // Individual student payable states
  const [individualPayableDialogOpen, setIndividualPayableDialogOpen] = useState(false);
  const [individualPayableForm, setIndividualPayableForm] = useState({
    type: '',
    amount: '',
    yearLevel: ''
  });

  // Summary modal states
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryData, setSummaryData] = useState({ changes: [], totalCurrentBalance: 0, totalNewBalance: 0 });

  // Delete confirmation modal state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Transaction history modal state
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionPayable, setTransactionPayable] = useState(null);
  const [transactionPayments, setTransactionPayments] = useState([]);

  // Student transactions modal state
  const [studentTransactionsModalOpen, setStudentTransactionsModalOpen] = useState(false);
  const [selectedStudentForTransactions, setSelectedStudentForTransactions] = useState(null);
  const [studentTransactions, setStudentTransactions] = useState([]);

  // Payables view controls (inside Student modal)
  const [payablesFilter, setPayablesFilter] = useState('all'); // all | unpaid | partially_paid | fully_paid | individual
  const [payablesViewMode, setPayablesViewMode] = useState('list'); // list | grid
  const [payablesSearch, setPayablesSearch] = useState('');
  // Action menu state for per-payable dropdown in student modal
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  const loadStudents = useCallback(async () => {
    if (!currentUser) {
      setError('Please sign in to access student data');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await getStudents();
      if (result.success) {
        setStudents(result.data);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to load students: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const loadPayables = useCallback(async () => {
    if (!currentUser) {
      setError('Please sign in to access payables data');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await getPayables(currentUser.uid);
      if (result.success) {
        const yearSpecificPayables = {};
        (result.data || []).forEach((payable) => {
          const yearLevel = payable.yearLevel;
          if (!yearSpecificPayables[yearLevel]) {
            yearSpecificPayables[yearLevel] = [];
          }
          // Ensure payable has required properties with default values
          const safePayable = {
            ...payable,
            amount: Number(payable.amount) || 0,
            studentPayments: payable.studentPayments || {},
            isIndividual: payable.isIndividual || false,
            studentId: payable.studentId || null,
            studentName: payable.studentName || null
          };
          yearSpecificPayables[yearLevel].push(safePayable);
        });
        setPayables(yearSpecificPayables);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to load payables: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadStudents();
      loadPayables();
    }
  }, [currentUser, loadStudents, loadPayables]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handlePaymentInputChange = (field, value) => {
    setPaymentForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNewPayableInputChange = (field, value) => {
    setNewPayableForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleIndividualPayableInputChange = (field, value) => {
    setIndividualPayableForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddPayable = () => {
    setNewPayableForm({
      type: '',
      amount: '',
      status: 'unpaid',
      paidAmount: '0',
      yearLevel: tabValue === 4 ? 'irregular' : (tabValue + 1).toString()
    });
    setAddPayableDialogOpen(true);
  };

  const handleAddIndividualPayable = () => {
    if (!selectedStudentModal) return;
    setIndividualPayableForm({
      type: '',
      amount: '',
      yearLevel: selectedStudentModal.yearLevel.toString()
    });
    setIndividualPayableDialogOpen(true);
  };

  const handleSaveNewPayable = async () => {
    if (!newPayableForm.type || !newPayableForm.amount) {
      setError('Please fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      const targetYear = newPayableForm.yearLevel;
      if (editingMode) {
        const result = await updatePayable(newPayableForm.id, {
          type: newPayableForm.type,
          amount: parseFloat(newPayableForm.amount),
          yearLevel: targetYear === 'irregular' || targetYear === 'all' ? targetYear : parseInt(targetYear)
        });
        if (result.success) {
          setSuccess('Payable updated successfully!');
          await loadPayables();
        } else {
          setError(result.error);
        }
      } else {
        let targetStudents;
        if (targetYear === 'irregular') {
          targetStudents = students.filter(s => s.isIrregular);
        } else if (targetYear === 'all') {
          targetStudents = students;
        } else {
          targetStudents = students.filter(s => s.yearLevel === parseInt(targetYear) && !s.isIrregular);
        }
        const studentPayments = {};
        targetStudents.forEach(student => {
          studentPayments[student.id] = {
            status: 'unpaid',
            paidAmount: 0
          };
        });
        const newPayableData = {
          type: newPayableForm.type,
          amount: parseFloat(newPayableForm.amount),
          yearLevel: targetYear === 'irregular' || targetYear === 'all' ? targetYear : parseInt(targetYear),
          studentPayments: studentPayments
        };
        const result = await createPayable(newPayableData, currentUser.uid);
        if (result.success) {
          setSuccess(`Payable added successfully for ${targetStudents.length} students!`);
          await loadPayables();
          setAddPayableDialogOpen(false);
        } else {
          setError(result.error);
        }
      }
      setEditingMode(false);
      setNewPayableForm({
        type: '',
        amount: '',
        status: 'unpaid',
        paidAmount: '0',
        yearLevel: 'all'
      });
    } catch (error) {
      setError('Failed to save payable: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIndividualPayable = async () => {
    if (!individualPayableForm.type || !individualPayableForm.amount || !individualPayableForm.yearLevel) {
      setError('Please fill in all required fields');
      return;
    }
    if (!selectedStudentModal) {
      setError('No student selected');
      return;
    }
    setLoading(true);
    try {
      const studentPayments = {
        [selectedStudentModal.id]: {
          status: 'unpaid',
          paidAmount: 0
        }
      };
      const newPayableData = {
        type: individualPayableForm.type,
        amount: parseFloat(individualPayableForm.amount),
        yearLevel: parseInt(individualPayableForm.yearLevel),
        studentPayments: studentPayments,
        isIndividual: true,
        studentId: selectedStudentModal.id,
        studentName: selectedStudentModal.name
      };
      const result = await createPayable(newPayableData, currentUser.uid);
      if (result.success) {
        setSuccess(`Previous balance added successfully for ${selectedStudentModal.name}!`);
        await loadPayables();
        setIndividualPayableDialogOpen(false);
        setIndividualPayableForm({
          type: '',
          amount: '',
          yearLevel: ''
        });
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to add previous balance: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePayment = async () => {
    if (!selectedStudentModal || !paymentForm.amount || !paymentForm.description) {
      setError('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      // TODO: Implement payment saving logic
      console.log('Saving payment for student:', selectedStudentModal.name, paymentForm);
      setSuccess('Payment created successfully!');
      setPaymentDialogOpen(false);
    } catch (error) {
      setError('Failed to create payment: ' + error.message);
    }
    setLoading(false);
  };

  const handleStartEditPayables = (payableId) => {
    const currentYear = tabValue + 1;
    const payable = payables[currentYear]?.find(p => p.id === payableId) || Object.values(payables).flat().find(p => p.id === payableId);
    if (payable) {
      setNewPayableForm({
        id: payable.id,
        type: payable.type,
        amount: payable.amount.toString(),
        status: 'unpaid',
        paidAmount: '0',
        yearLevel: payable.yearLevel.toString() === 'irregular' ? 'irregular' : payable.yearLevel.toString()
      });
      setEditingMode(true);
      setAddPayableDialogOpen(true);
    }
  };

  const handleDeletePayable = async (payableId) => {
    setLoading(true);
    try {
      const result = await deletePayable(payableId);
      if (result.success) {
        setSuccess('Payable deleted successfully!');
        await loadPayables();
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Failed to delete payable: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Show summary of changes before confirming
  const handleShowSummary = () => {
    if (!selectedStudentModal) return;
    const studentId = selectedStudentModal.id;
    const changes = [];
    let totalCurrentBalance = 0;
    let totalNewBalance = 0;
    Object.entries(stagedPayments).forEach(([payableId, newPaymentAmount]) => {
      const payable = Object.values(payables).flat().find(p => p.id === payableId);
      if (payable) {
        const currentPaid = payable.studentPayments?.[studentId]?.paidAmount || 0;
        const amount = Number(payable.amount) || 0;
        totalCurrentBalance += Math.max(0, amount - currentPaid);
        totalNewBalance += Math.max(0, amount - (currentPaid + newPaymentAmount));
        changes.push({
          payableId,
          type: payable.type,
          amount,
          currentPaid,
          newPayment: newPaymentAmount,
          newTotalPaid: currentPaid + newPaymentAmount
        });
      }
    });
    setSummaryData({ changes, totalCurrentBalance, totalNewBalance });
    setSummaryModalOpen(true);
  };

  // Final confirmation: persist all stagedPayments for the selected student
  const handleFinalConfirm = async () => {
    if (!selectedStudentModal) return;
    const studentId = selectedStudentModal.id;
    setConfirmLoading(true);
    setError('');
    try {
      // For each change, compute status and send update
      for (const change of summaryData.changes) {
        const { payableId, newPayment } = change;
        // Find payable to get total amount
        const payable = Object.values(payables).flat().find(p => p.id === payableId);
        if (!payable) continue;
        const payableAmount = Number(payable.amount) || 0;
        const newTotalPaid = change.currentPaid + newPayment;
        const newStatus = newTotalPaid >= payableAmount ? 'fully_paid' : (newTotalPaid > 0 ? 'partially_paid' : 'unpaid');

        const updateObj = {
          [`studentPayments.${studentId}.paidAmount`]: newTotalPaid,
          [`studentPayments.${studentId}.status`]: newStatus
        };
        const result = await updatePayable(payableId, updateObj);
        if (!result.success) {
          throw new Error(result.error || 'Failed to update payable ' + payableId);
        }
        // Record the transaction
        if (newPayment > 0) {
          await createStudentPayment({
            studentId,
            payableId,
            amount: newPayment,
            description: `Payment for ${change.type}`,
            date: new Date().toISOString()
          });
        }
      }

      setSuccess('Payments confirmed successfully');
      // Close all modals
      setSummaryModalOpen(false);
      setStudentModalOpen(false);
      setSelectedStudentModal(null);
      setStagedPayments({});
      // reload payables to reflect persisted state
      await loadPayables();
    } catch (error) {
      setError('Failed to confirm payments: ' + error.message);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDiscardStagedPayments = () => {
    setStagedPayments({});
  };

  // Collect a student's payables: all current-year payables plus any individual
  // previous balances across all years that belong to the student.
  const getStudentPayables = useCallback((student) => {
    if (!student || !payables) return [];
    let basePayables = [];
    if (student.isIrregular) {
      basePayables = (payables[student.yearLevel] || []).concat(payables['irregular'] || []).concat(payables['all'] || []);
    } else {
      basePayables = (payables[student.yearLevel] || []).concat(payables['all'] || []);
    }
    const individualAcrossYears = Object.values(payables)
      .flat()
      .filter(p => p.isIndividual && p.studentId === student.id);
    const merged = {};
    basePayables.forEach(p => {
      if (!p.isIndividual) {
        merged[p.id] = p;
      } else if (p.studentId === student.id) {
        merged[p.id] = p;
      }
    });
    individualAcrossYears.forEach(p => { merged[p.id] = p; });
    return Object.values(merged);
  }, [payables]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'fully_paid':
        return 'success';
      case 'partially_paid':
        return 'warning';
      case 'unpaid':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'fully_paid':
        return 'Fully Paid';
      case 'partially_paid':
        return 'Partially Paid';
      case 'unpaid':
        return 'Unpaid';
      default:
        return 'Unknown';
    }
  };

  // Stage paid amount changes locally. Changes will not be saved until user clicks Confirm.
  const handleStagedPaidAmountChange = useCallback((payableId, newValue) => {
    const newPaymentAmount = newValue === '' ? 0 : parseFloat(newValue) || 0;
    // Find the payable
    const payable = Object.values(payables).flat().find(p => p.id === payableId);
    if (!payable || !selectedStudentModal) return;
    const studentPayment = payable.studentPayments?.[selectedStudentModal.id] || { paidAmount: 0 };
    const remaining = payable.amount - studentPayment.paidAmount;
    const limitedAmount = Math.min(newPaymentAmount, remaining);
    setStagedPayments(prev => ({
      ...prev,
      [payableId]: limitedAmount
    }));
  }, [payables, selectedStudentModal]);

  const calculateTotalBalance = useCallback((studentId) => {
    if (!studentId || !payables) return 0;
    const student = students.find(s => s.id === studentId);
    if (!student) return 0;
    const studentPayables = getStudentPayables(student);
    return studentPayables.reduce((total, payable) => {
      const studentPayment = payable.studentPayments?.[studentId] || { status: 'unpaid', paidAmount: 0 };
      const stagedPaid = stagedPayments?.[payable.id];
      const paidAmount = typeof stagedPaid !== 'undefined' ? Number(stagedPaid) : Number(studentPayment.paidAmount || 0);
      const payableAmount = Number(payable.amount) || 0;
      const status = typeof stagedPaid !== 'undefined'
        ? (paidAmount >= payableAmount ? 'fully_paid' : (paidAmount > 0 ? 'partially_paid' : 'unpaid'))
        : studentPayment.status;
      if (status === 'unpaid' || status === 'partially_paid') {
        return total + Math.max(0, payableAmount - paidAmount);
      }
      return total;
    }, 0);
  }, [payables, stagedPayments, students, getStudentPayables]);

  // 1. Remove all payment dialog/modal state and handlers (studentPaymentDialogOpen, selectedPayableForPayment, selectedStudentForPayment, studentPaymentForm, handleStudentPaymentClick, handleStudentPaymentFormChange, handleSaveStudentPayment, handleMarkAsFullyPaid, and their usages)
  // 2. In the payables table, always render the paid amount as a TextField (not just in edit mode)
  // 3. On change, update Firestore immediately
  // 4. Remove the Record Payment modal JSX
  // 5. Remove any references to the old modal-based payment workflow

  const renderStudentList = () => (
    <div>

       <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map(year => (
            <button
              key={year}
              className={`
                px-3 py-1.5 font-semibold rounded-full shadow-md border transition-all flex items-center gap-1 text-sm cursor-pointer
                ${tabValue === year - 1 
                  ? 'bg-blue-600 text-white border-blue-700 scale-105'
                  : 'bg-white text-blue-700 hover:bg-blue-100 border-gray-300'
                }
                hover:border-blue-600
              `}
              onClick={() => setTabValue(year - 1)}
            >
              {year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year
            </button>
          ))}

          <button
            className={`
              px-3 py-1.5 font-semibold rounded-full shadow-md border transition-all flex items-center gap-1 text-sm cursor-pointer
              ${tabValue === 4
                ? 'bg-blue-600 text-white border-blue-700 scale-105'
                : 'bg-white text-blue-700 hover:bg-blue-100 border-gray-300'
              }
              hover:border-blue-600
            `}
            onClick={() => setTabValue(4)}
          >
            Irregular Students
          </button>
        </div>

        {/* Search + Add */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search students by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
</div>
          <button
            className="px-3 py-1.5 bg-green-600  text-sm text-white rounded-full hover:bg-green-700 flex items-center gap-1"
            onClick={handleAddPayable}
          >
            <BadgePlus className='w-4 h-4' />
            Add Payables
          </button>
        </div>
      </div>

      {/* Student Display */}
      <div>
        {(() => {
          let filteredStudents;
          if (tabValue === 4) {
            // Show only irregular students
            filteredStudents = students.filter(student => student.isIrregular);
          } else {
            // Show students by year level, excluding irregular students
            filteredStudents = students.filter(student => student.yearLevel === (tabValue + 1) && !student.isIrregular);
          }
          if (searchTerm) {
            filteredStudents = filteredStudents.filter(student => 
              student.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
          }
          // Sort students (defensive for missing fields)
          filteredStudents.sort((a, b) => {
            const balanceA = calculateTotalBalance(a.id);
            const balanceB = calculateTotalBalance(b.id);
            const nameA = (a.name || '').toString();
            const nameB = (b.name || '').toString();
            const idA = (a.studentNumber || '').toString();
            const idB = (b.studentNumber || '').toString();
            switch (sortBy) {
              case 'name-asc':
                return nameA.localeCompare(nameB);
              case 'name-desc':
                return nameB.localeCompare(nameA);
              case 'balance-asc':
                return balanceA - balanceB;
              case 'balance-desc':
                return balanceB - balanceA;
              case 'id-asc':
                return idA.localeCompare(idB);
              case 'id-desc':
                return idB.localeCompare(idA);
              default:
                return 0;
            }
          });
          if (filteredStudents.length === 0) {
            return (
              <div className="text-center py-8">
                <h6 className="text-lg text-gray-600 mb-2">
                  {searchTerm ? 'No students found' : tabValue === 4 ? 'No irregular students' : `No students in Year ${tabValue + 1}`}
                </h6>
                <p className="text-sm text-gray-600">
                  {searchTerm ? 'Try adjusting your search terms' : 'No students available for payment management'}
                </p>
              </div>
            );
          }
          // For displaying payable counts, we need to be careful:
          // For irregular tab (4), we can't determine a single "year payables" set
          // since irregular students can be from different years.
          // For now, we'll compute payables per student in the rendering logic.
          if (viewMode === 'grid') {
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredStudents.map((student) => {
                  const totalBalance = calculateTotalBalance(student.id);
                  return (
                    <div 
                    key={student.id}
                    className={`p-4 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg border border-gray-300 bg-white rounded-lg`}
                    onClick={() => {
                      setSelectedStudentModal(student);
                      setStudentModalOpen(true);
                      // Clear any staged payments when opening a new student modal
                      setStagedPayments({});
                      setPayablesFilter('all');
                      setPayablesViewMode('list');
                      setPayablesSearch('');
                    }}
                  >
                    <div className="flex flex-col gap-1">
                      <h6 className="text-lg font-bold">{student.name}</h6>
                    
                      <h5 className={`text-2xl font-bold text-center ${totalBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ₱{totalBalance.toLocaleString()}
                      </h5>
                      <p className="text-xs text-gray-600 text-center">
                        {totalBalance > 0 ? 'Outstanding Balance' : 'All Paid'}
                      </p>
                      <button
                        className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 mt-2"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setSelectedStudentForTransactions(student);
                          setStudentTransactionsModalOpen(true);
                          // Load all transactions for the student
                          const result = await getAllStudentPayments(student.id);
                          if (result.success) {
                            setStudentTransactions(result.data);
                          } else {
                            setError(result.error);
                          }
                        }}
                      >
                        View Transactions
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            );
          } else {
            // List view
            return (
              <div className="bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden">
                <table className="w-full table-auto">
                 <thead className="bg-blue-600 text-white text-sm">
  <tr>
    {/* Student ID */}
    <th
      className="p-3 text-left cursor-pointer hover:bg-blue-700 transition-colors select-none w-[20%]"
      onClick={() => setSortBy(sortBy === 'id-asc' ? 'id-desc' : 'id-asc')}
    >
      <div className="flex items-center gap-2">
        <span>Student ID</span>
        {sortBy === 'id-asc' ? (
          <ChevronUp className="w-4 h-4" />
        ) : sortBy === 'id-desc' ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronsUpDown className="w-4 h-4 opacity-70" />
        )}
      </div>
    </th>

    {/* Student Name */}
    <th
      className="p-3 text-left cursor-pointer hover:bg-blue-700 transition-colors select-none w-[40%]"
      onClick={() => setSortBy(sortBy === 'name-asc' ? 'name-desc' : 'name-asc')}
    >
      <div className="flex items-center gap-2">
        <span>Student Name</span>
        {sortBy === 'name-asc' ? (
          <ChevronUp className="w-4 h-4" />
        ) : sortBy === 'name-desc' ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronsUpDown className="w-4 h-4 opacity-70" />
        )}
      </div>
    </th>

    {/* Total Balance */}
    <th
      className="p-3 text-left cursor-pointer hover:bg-blue-700 transition-colors select-none w-[20%]"
      onClick={() => setSortBy(sortBy === 'balance-asc' ? 'balance-desc' : 'balance-asc')}
    >
      <div className="flex items-center gap-2">
        <span>Total Balance</span>
        {sortBy === 'balance-asc' ? (
          <ChevronUp className="w-4 h-4" />
        ) : sortBy === 'balance-desc' ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronsUpDown className="w-4 h-4 opacity-70" />
        )}
      </div>
    </th>

    {/* Status */}
    <th className="p-3 text-center w-[20%]">Status</th>
  </tr>
</thead>
                  <tbody className='text-sm'>
                    {filteredStudents.map((student, index) => {
                      const totalBalance = calculateTotalBalance(student.id);
                      return (
                        <tr 
                          key={student.id} 
                          className={`cursor-pointer transition-all duration-200 hover:bg-blue-50 hover:shadow-sm border-b border-gray-200 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                          onClick={() => {
                            setSelectedStudentModal(student);
                            setStudentModalOpen(true);
                            setStagedPayments({});
                            setPayablesFilter('all');
                            setPayablesViewMode('list');
                            setPayablesSearch('');
                          }}
                        >
                          <td className="p-2">{student.studentNumber}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              {student.name}
                            
                            </div>
                          </td>
                          <td className="p-2">
                            <span className={`font-bold ${totalBalance > 0 ? 'text-red-700  ' : 'text-green-700'}`}>
                              ₱{totalBalance.toLocaleString()}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${totalBalance > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                              {totalBalance > 0 ? 'Outstanding' : 'Paid'}
                            </span>
                          </td>
                          
                        </tr>
                      );
                    })}
                    <tr className="bg-blue-50 font-semibold text-blue-900 border-t-2 border-blue-200">
                      <td colSpan={2} className="py-1.5 x-3 text-right w-[60%]">Total Outstanding Balance</td>
                      <td className="px-2 py-3 text-left font-bold ">
                        ₱{filteredStudents.reduce((sum, student) => sum + calculateTotalBalance(student.id), 0).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          }
        })()}
      </div>
    </div>
  );

  // Global header handles sign out now

  return (
    <div className="p-4">
      {!currentUser && (
        <div className="mx-3 mb-2 p-4 bg-blue-50 border border-blue-200 rounded text-blue-800">
          Please sign in to access the Payables System
        </div>
      )}
      
      {error && <div className="mx-3 mb-2 p-4 bg-red-50 border border-red-200 rounded text-red-800">{error}</div>}
      {success && <div className="mx-3 mb-2 p-4 bg-green-50 border border-green-200 rounded text-green-800">{success}</div>}
      
      {currentUser ? (
        <div className=" max-w-7xl mx-auto">
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-300 mb-10">
            <div className="flex items-center gap-6">
              <button
                onClick={onBackToDashboard}
                className="text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-full"
              >
                Back
              </button>
              <div className="flex flex-col gap-1">
              <h5 className="text-2xl font-bold text-blue-600">
                  Payables Management System
                </h5>
                <p className=" text-gray-600">
                  Manage invoices, track payments, and handle financial transactions for the institution
                </p>
              </div>
            </div>
          </div>
          <div>
            {renderStudentList()}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="p-4 text-center border border-gray-200 rounded bg-gray-50">
            <p className="text-lg text-gray-600">
              Sign in to access payment management features
            </p>
          </div>
        </div>
      )}

      {/* Add Payable Dialog */}
      {addPayableDialogOpen && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-xs bg-opacity-50" onClick={() => {
            setAddPayableDialogOpen(false);
            setEditingMode(false);
            setNewPayableForm({
              type: '',
              amount: '',
              status: 'unpaid',
              paidAmount: '0',
              yearLevel: 'all'
            });
          }}></div>
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto relative z-10">
            <h2 className="text-xl font-bold mb-4">
              {editingMode ? 'Edit Payable' : 'Add New Payable'}
             
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Target Year Level</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded"
                  value={newPayableForm.yearLevel}
                  onChange={(e) => handleNewPayableInputChange('yearLevel', e.target.value)}
                  disabled={editingMode} // Disable changing target when editing
                >
                  <option value="all">All Students</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                  <option value="irregular">Irregular Students</option>
                  
                </select>
              </div>

              <label className="block text-sm font-medium mb-1">Payable Type</label>
              <input
                type="text"
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="Type (e.g., Tuition Fee, Miscellaneous)"
                value={newPayableForm.type}
                onChange={(e) => handleNewPayableInputChange('type', e.target.value)}
              />
              
             <label className="block text-sm font-medium mb-1">Amount</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="w-full p-2 border border-gray-300 rounded show-spinner"
                placeholder="e.g., 1500.00"
                value={newPayableForm.amount}
                onChange={(e) => handleNewPayableInputChange('amount', e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => {
                setAddPayableDialogOpen(false);
                setEditingMode(false);
                setNewPayableForm({
                  type: '',
                  amount: '',
                  status: 'unpaid',
                  paidAmount: '0',
                  yearLevel: 'all'
                });
              }} className="px-4 py-1.5 text-white bg-gray-400 rounded hover:bg-gray-500">
                Cancel
              </button>
              <button 
                onClick={handleSaveNewPayable} 
                className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-200"
                disabled={!newPayableForm.type || !newPayableForm.amount || loading}
              >
                {loading ? (editingMode ? 'Updating...' : 'Adding...') : (editingMode ? 'Update Payable' : 'Add Payable')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Creation Dialog */}
      {paymentDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setPaymentDialogOpen(false)}></div>
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto relative z-10">
            <h2 className="text-xl font-bold mb-4">
              Create Payment Record
              {selectedStudentModal && (
                <p className="text-sm text-gray-600">
                  For: {selectedStudentModal.name}
                </p>
              )}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Payment Type</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded"
                  value={paymentForm.paymentType}
                  onChange={(e) => handlePaymentInputChange('paymentType', e.target.value)}
                >
                  <option value="tuition">Tuition Fee</option>
                  <option value="miscellaneous">Miscellaneous</option>
                  <option value="laboratory">Laboratory Fee</option>
                  <option value="library">Library Fee</option>
                </select>
              </div>
              
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="w-full p-2 border border-gray-300 rounded show-spinner"
                placeholder="Amount"
                value={paymentForm.amount}
                onChange={(e) => handlePaymentInputChange('amount', e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
              />
              
              <textarea
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="Description"
                value={paymentForm.description}
                onChange={(e) => handlePaymentInputChange('description', e.target.value)}
                rows={2}
              />
              
              <input
                type="date"
                className="w-full p-2 border border-gray-300 rounded"
                value={paymentForm.dueDate}
                onChange={(e) => handlePaymentInputChange('dueDate', e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPaymentDialogOpen(false)} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
                Cancel
              </button>
              <button 
                onClick={handleSavePayment} 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                disabled={!paymentForm.amount || !paymentForm.description || loading}
              >
                {loading ? 'Creating...' : 'Create Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Payment Dialog */}
      {/* 4. Remove the Record Payment modal JSX */}
      {/* 5. Remove any references to the old modal-based payment workflow */}

      {/* Student Details Modal */}
      {studentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-xs bg-opacity-50" onClick={() => {
            setStudentModalOpen(false);
            setSelectedStudentModal(null);
            setStagedPayments({});
          }}></div>
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-160 relative z-10 flex flex-col overflow-hidden">
            <div className="flex items-center px-6 py-4 justify-between shadow-b shadow-2xs  sticky top-0 z-20 bg-blue-100">
              <div>
                <h2 className="text-xl font-bold">
                  {selectedStudentModal?.name}
                  {selectedStudentModal?.isIrregular && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 ml-2">
                      Irregular
                    </span>
                  )}
                </h2>
                <p className="text-sm text-gray-600">
                  {selectedStudentModal?.isIrregular 
                    ? `Irregular Student (${selectedStudentModal.yearLevel === 1 ? '1st' : selectedStudentModal.yearLevel === 2 ? '2nd' : selectedStudentModal.yearLevel === 3 ? '3rd' : '4th'} Year Level) `
                    : `${tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year Student `
                  }
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  className="px-2 py-1.5 text-sm bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50"
                  onClick={handleAddIndividualPayable}
                >
                  <BadgePlus className='w-4 h-4 inline-flex mr-1' />
                  Add Previous Balance
                </button>
               
              </div>
            </div>
            <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
              {/* Payables controls: search, filter, view mode */}
              <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
                <div className="flex-1 flex items-center gap-2">
                  <div className="relative w-full md:max-w-sm">
                    <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input
                      type="text"
                      className="w-full pl-9 pr-3 py-1.5 border text-sm border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Search payables by type..."
                      value={payablesSearch}
                      onChange={(e) => setPayablesSearch(e.target.value)}
                    />
                  </div>
                 
                </div>
               <div className="flex items-center gap-2">
                    <Funnel className="w-4 h-4 text-gray-600" />
                    <select
                      className="px-2 py-1.5 border border-gray-300 rounded-full focus-outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={payablesFilter}
                      onChange={(e) => setPayablesFilter(e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="partially_paid">Partially Paid</option>
                      <option value="fully_paid">Fully Paid</option>
                      <option value="individual">Individual Only</option>
                    </select>
                  </div>
              </div>

              {(() => {
                // Base set: current-year payables + any individual previous balances across all years
                const base = selectedStudentModal ? getStudentPayables(selectedStudentModal) : [];
                // Apply search
                let list = base.filter(p => (p.type || '').toLowerCase().includes((payablesSearch || '').toLowerCase()))
                  // Apply filter
                  .filter(p => {
                    if (payablesFilter === 'all') return true;
                    if (payablesFilter === 'individual') return !!p.isIndividual;
                    const st = p.studentPayments?.[selectedStudentModal?.id]?.status || 'unpaid';
                    return st === payablesFilter;
                  });

                if (list.length === 0) {
                  return (
                    <div className="text-center py-6">
                      <p className="text-gray-600">No payables match your filters.</p>
                    </div>
                  );
                }

                const renderCard = (payable) => {
                  const studentPayment = payable.studentPayments?.[selectedStudentModal?.id] || { status: 'unpaid', paidAmount: 0 };
                  const stagedPayment = stagedPayments?.[payable.id] || 0;
                  const totalPaid = studentPayment.paidAmount + stagedPayment;
                  const remaining = payable.amount - totalPaid;
                  return (
                    <div key={payable.id} className="border border-gray-200 rounded-xl shadow p-4 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-1 mb-1">
                            <h4 className="text-lg font-bold">{payable.type}</h4>
                            {payable.isIndividual && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Individual Charge
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            Total Amount: ₱{Number(payable.amount || 0).toLocaleString()}
                          </p>
                        </div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium 
                                          ${getStatusColor(studentPayment.status) === 'success' 
                                            ? 'bg-green-100 text-green-800 border border-green-300' 
                                            : getStatusColor(studentPayment.status) === 'warning' 
                                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' 
                                            : 'bg-red-100 text-red-800 border border-red-300'}`}
                        >
                          {getStatusLabel(studentPayment.status)}
                        </span>
                        
                         <div className="flex items-center gap-0.5">
                        <button
                          className="p-1.5 cursor-pointer rounded-full text-gray-700 hover:bg-gray-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenuId(null);
                            handleStartEditPayables(payable.id);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 cursor-pointer rounded-full text-gray-700 hover:bg-gray-200"
                          onClick={async (e) => {
                            e.stopPropagation();
                            setOpenActionMenuId(null);
                            setTransactionPayable(payable);
                            setTransactionModalOpen(true);
                            const result = await getStudentPayments(selectedStudentModal.id, payable.id);
                            if (result.success) {
                              setTransactionPayments(result.data);
                            } else {
                              setError(result.error);
                            }
                          }}
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 cursor-pointer rounded-full text-gray-700 hover:bg-gray-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenuId(null);
                            setDeleteTarget(payable);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>

                      </div>
                      <div>
                       <div className="flex items-center text-xs gap-2 mb-1">
                        <span>Mode of Payment:</span>

                        <div className="flex items-center gap-1">
                          <input 
                            type="radio" 
                          
                            value="cash"
                          
                          />
                          <label 
                            htmlFor={`paymentMode-cash-${payable.id}`} 
                            className="text-xs cursor-pointer"
                          >
                            Cash
                          </label>
                          <input 
                            type="radio" 
                          
                            value="cash"
                          
                          />
                          <label 
                            htmlFor={`paymentMode-cash-${payable.id}`} 
                            className="text-xs cursor-pointer"
                          >
                            GCash
                          </label>
                          <input 
                            type="radio" 
                          
                            value="cash"
                          
                          />
                          <label 
                            htmlFor={`paymentMode-cash-${payable.id}`} 
                            className="text-xs cursor-pointer"
                          >
                            Bank Transfer
                          </label>
                        </div>
                      </div>
                                              <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          className="w-2/3 flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg show-spinner"
                          placeholder="New Payment Amount"
                          value={stagedPayments?.[payable.id] || ''}
                          onChange={(e) => selectedStudentModal && handleStagedPaidAmountChange(payable.id, e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                        />
                        <input 
                          type="text"
                          className="w-1/3 px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                          placeholder="Reference (e.g., receipt number)"
                          
                        />
                     
                      </div>
                      </div>
                     
                      <div className="flex items-center justify-between gap-1 mt-4">
                        <p className="text-xs text-gray-600">
                          Remaining: ₱{remaining.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          Last updated: {new Date().toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                };

                if (payablesViewMode === 'grid') {
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {list.map((p) => renderCard(p))}
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col gap-3">
                    {list.map((p) => renderCard(p))}
                  </div>
                );
              })()}
            </div>
            <div className='sticky bottom-0 z-20  flex justify-between gap-4 px-6 py-3 border-t border-gray-300'>
               <h3 className={`text-lg font-bold ${selectedStudentModal ? calculateTotalBalance(selectedStudentModal.id) > 0 ? 'text-red-600' : 'text-green-600' : ''}`}>
                  Total: ₱{selectedStudentModal ? calculateTotalBalance(selectedStudentModal.id).toLocaleString() : '0'}
                </h3>
            <div className="flex items-center justify-end gap-2  ">
            
              <button 
                onClick={() => {
                  setStudentModalOpen(false);
                  setSelectedStudentModal(null);
                  setStagedPayments({});
                }}
                className="px-6 py-1.5 text-sm rounded-lg bg-gray-400 text-white hover:bg-gray-500"
              >
                Close
              </button>
              <button 
                onClick={handleShowSummary} 
                className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700  disabled:opacity-50"
                disabled={Object.keys(stagedPayments).length === 0 || confirmLoading}
              >
                {confirmLoading ? 'Confirming...' : 'Confirm Changes'}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {summaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-xs bg-opacity-50" onClick={() => setSummaryModalOpen(false)}></div>
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-140 overflow-y-auto relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Confirm Payment Changes</h2>
              <button
                onClick={() => setSummaryModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            {selectedStudentModal && (
              <p className="text-sm text-gray-600 mb-4">
                For: {selectedStudentModal.name}
              </p>
            )}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Summary of Changes:</h3>
              {summaryData.changes.length === 0 ? (
                <p className="text-gray-600">
                  No changes to confirm.
                </p>
              ) : (
                <div>
                  {summaryData.changes.map((change) => (
                    <div key={change.payableId} className="border border-gray-200 rounded p-4 mb-4">
                      <h4 className="text-lg font-bold">{change.type}</h4>
                      <p className="text-sm text-gray-600">
                        Total Amount: ₱{change.amount.toLocaleString()}
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <div>
                          <p className="text-sm text-gray-600">
                            Current Paid: ₱{change.currentPaid.toLocaleString()} (Balance: ₱{(change.amount - change.currentPaid).toLocaleString()})
                          </p>
                          <p className="text-sm text-blue-600">
                            New Payment: ₱{change.newPayment.toLocaleString()} (New Total Paid: ₱{change.newTotalPaid.toLocaleString()})
                          </p>
                        </div>
                        <p className={`text-sm ${change.newPayment > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                          {change.newPayment > 0 ? `+₱${change.newPayment.toLocaleString()}` : 'No change'}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="mt-6 p-4 bg-gray-100 rounded">
                    <h3 className="text-lg font-semibold mb-2">
                      Balance Summary:
                    </h3>
                    <p className="text-base">
                      Current Total Balance: ₱{summaryData.totalCurrentBalance.toLocaleString()}
                    </p>
                    <p className="text-base text-blue-600">
                      New Total Balance: ₱{summaryData.totalNewBalance.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setSummaryModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalConfirm}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                disabled={confirmLoading}
              >
                {confirmLoading ? 'Confirming...' : 'Confirm All Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Student Payable Dialog */}
      {individualPayableDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-xs bg-opacity-50" onClick={() => {
            setIndividualPayableDialogOpen(false);
            setIndividualPayableForm({
              type: '',
              amount: '',
              yearLevel: ''
            });
          }}></div>
          <div className="bg-white rounded-lg p-6 max-w-md w-full  overflow-y-auto relative z-10">
            <h2 className="text-xl font-bold mb-4">
              Add Previous Balance / Custom Charge
            </h2>
            {selectedStudentModal && (
              <p className="text-sm text-gray-600 mb-4">
                For: {selectedStudentModal.name}
              </p>
            )}
            <div className="space-y-4">
              <input
                type="text"
                className="w-full p-2 border border-gray-300 rounded"
                placeholder="Payable Type (e.g., 2nd Year Balance, Laboratory Fee, etc.)"
                value={individualPayableForm.type}
                onChange={(e) => handleIndividualPayableInputChange('type', e.target.value)}
              />

              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="w-full p-2 border border-gray-300 rounded show-spinner"
                placeholder="Amount"
                value={individualPayableForm.amount}
                onChange={(e) => handleIndividualPayableInputChange('amount', e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                onKeyDown={(e) => { if (e.key === 'e' || e.key === 'E') e.preventDefault(); }}
              />

              <div>
                <label className="block text-sm font-medium mb-1">Year Level (when the charge was incurred)</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded"
                  value={individualPayableForm.yearLevel}
                  onChange={(e) => handleIndividualPayableInputChange('yearLevel', e.target.value)}
                >
                  <option value="">Select Year Level</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  This will add a payable specifically for {selectedStudentModal?.name}.
                  Other students will not see this charge.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => {
                setIndividualPayableDialogOpen(false);
                setIndividualPayableForm({
                  type: '',
                  amount: '',
                  yearLevel: ''
                });
              }} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
                Cancel
              </button>
              <button
                onClick={handleSaveIndividualPayable}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
                disabled={!individualPayableForm.type || !individualPayableForm.amount || !individualPayableForm.yearLevel || loading}
              >
                {loading ? 'Adding...' : 'Add Previous Balance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Payable Confirmation Modal */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-xs bg-opacity-50"
            onClick={() => { setDeleteDialogOpen(false); setDeleteTarget(null); }}
          ></div>
          <div className="bg-white rounded-lg p-6 max-w-md w-full relative z-10">
            <div className="flex items-start gap-3">
              <div className="mt-1 text-red-600">
                <i className="bi bi-exclamation-triangle-fill text-2xl"></i>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-1">Delete Payable</h2>
                <p className="text-sm text-gray-700 mb-2">
                  Are you sure you want to delete
                  {` "${deleteTarget?.type || ''}"`} payable?
                </p>
                {typeof deleteTarget?.amount !== 'undefined' && (
                  <p className="text-sm text-gray-600 mb-2">
                    Amount: ₱{Number(deleteTarget.amount || 0).toLocaleString()}
                  </p>
                )}
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  {deleteTarget?.isIndividual ? (
                    <span>
                      This will permanently remove this charge for {selectedStudentModal?.name}.
                    </span>
                  ) : (
                    <span>
                      This will remove this payable for all {deleteTarget?.yearLevel === 'irregular' ? 'irregular students' : deleteTarget?.yearLevel === 'all' ? 'students' : `students in Year ${deleteTarget?.yearLevel}`}.
                      This action cannot be undone.
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => { setDeleteDialogOpen(false); setDeleteTarget(null); }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                onClick={() => deleteTarget && handleDeletePayable(deleteTarget.id)}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {transactionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-xs bg-opacity-50" onClick={() => setTransactionModalOpen(false)}></div>
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-140 overflow-y-auto relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Transaction History</h2>
              <button onClick={() => setTransactionModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {transactionPayable && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold">{transactionPayable.type}</h3>
                <p className="text-sm text-gray-600">Total: ₱{Number(transactionPayable.amount || 0).toLocaleString()}</p>
              </div>
            )}

            <div className="space-y-2">
              {transactionPayments.length === 0 ? (
                <p className="text-gray-600">No transactions yet.</p>
              ) : (
                transactionPayments.map((payment, idx) => {
                  const paidSoFar = transactionPayments.slice(0, idx + 1).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                  const totalAmount = Number(transactionPayable?.amount || 0);
                  const remainingAfter = Math.max(0, totalAmount - paidSoFar);
                  return (
                    <div key={payment.id || idx} className="border border-gray-200 rounded p-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="font-bold text-lg">₱{Number(payment.amount || 0).toLocaleString()}</p>
                          {payment.description && <p className="text-sm text-gray-600">{payment.description}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">{payment.date ? new Date(payment.date).toLocaleDateString() : ''}</p>
                          <p className="text-sm mt-2">Remaining: <span className={`font-semibold ${remainingAfter > 0 ? 'text-red-600' : 'text-green-600'}`}>₱{remainingAfter.toLocaleString()}</span></p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Student Transactions Modal */}
      {studentTransactionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-xs bg-opacity-50" onClick={() => setStudentTransactionsModalOpen(false)}></div>
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-140 overflow-y-auto relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Transaction History</h2>
              <button onClick={() => setStudentTransactionsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {selectedStudentForTransactions && (
              <p className="text-sm text-gray-600 mb-4">For: {selectedStudentForTransactions.name}</p>
            )}
            <div className="space-y-2">
              {studentTransactions.length === 0 ? (
                <p className="text-gray-600">No transactions yet.</p>
              ) : (
                studentTransactions.map(payment => (
                  <div key={payment.id} className="border border-gray-200 rounded p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold">₱{payment.amount.toLocaleString()}</p>
                        <p className="text-sm text-gray-600">{payment.description}</p>
                      </div>
                      <p className="text-sm text-gray-500">{new Date(payment.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayablesSystem;