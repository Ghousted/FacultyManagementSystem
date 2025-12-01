import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  InputAdornment,
  AppBar,
  Toolbar,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import ListIcon from '@mui/icons-material/List';
import SortIcon from '@mui/icons-material/Sort';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import AddIcon from '@mui/icons-material/Add';
import PaymentIcon from '@mui/icons-material/Payment';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import UndoIcon from '@mui/icons-material/Undo';
import { getStudents } from '../../models/curriculumModels';
import { 
  createPayable, 
  getPayables, 
  updatePayable, 
  deletePayable
} from '../../models/payablesModels';
import { useAuth } from '../../contexts/AuthContext';
import Logo from '../../assets/logo.png'; // Adjust the path as necessary

const PayablesSystem = ({ onBackToDashboard }) => {
  const { currentUser, signout } = useAuth(); // <-- add signout here
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
    paidAmount: '0'
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
      paidAmount: '0'
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
      const currentYear = tabValue + 1;
      if (editingMode) {
        const result = await updatePayable(newPayableForm.id, {
          type: newPayableForm.type,
          amount: parseFloat(newPayableForm.amount)
        });
        if (result.success) {
          setSuccess('Payable updated successfully!');
          await loadPayables();
        } else {
          setError(result.error);
        }
      } else {
        const currentYearStudents = students.filter(student => student.yearLevel === currentYear);
        const studentPayments = {};
        currentYearStudents.forEach(student => {
          studentPayments[student.id] = {
            status: 'unpaid',
            paidAmount: 0
          };
        });
        const newPayableData = {
          type: newPayableForm.type,
          amount: parseFloat(newPayableForm.amount),
          yearLevel: currentYear,
          studentPayments: studentPayments
        };
        const result = await createPayable(newPayableData, currentUser.uid);
        if (result.success) {
          setSuccess(`Payable added successfully for ${currentYearStudents.length} students!`);
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
        paidAmount: '0'
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
    const payable = payables[currentYear]?.find(p => p.id === payableId);
    if (payable) {
      setNewPayableForm({
        id: payable.id,
        type: payable.type,
        amount: payable.amount.toString(),
        status: 'unpaid',
        paidAmount: '0'
      });
      setEditingMode(true);
      setAddPayableDialogOpen(true);
    }
  };

  const handleDeletePayable = async (payableId) => {
    if (!window.confirm('Are you sure you want to delete this payable?')) return;
    
    setLoading(true);
    try {
      const result = await deletePayable(payableId);
      if (result.success) {
        setSuccess('Payable deleted successfully!');
        await loadPayables();
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
    const currentYear = tabValue + 1;
    const yearPayables = payables[currentYear] || [];
    const changes = [];
    let totalCurrentBalance = 0;
    let totalNewBalance = 0;
    Object.entries(stagedPayments).forEach(([payableId, newPaidAmount]) => {
      const payable = yearPayables.find(p => p.id === payableId);
      if (payable) {
        const currentPaid = payable.studentPayments?.[studentId]?.paidAmount || 0;
        const amount = Number(payable.amount) || 0;
        totalCurrentBalance += Math.max(0, amount - currentPaid);
        totalNewBalance += Math.max(0, amount - newPaidAmount);
        changes.push({
          payableId,
          type: payable.type,
          amount,
          currentPaid,
          newPaid: newPaidAmount
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
        const { payableId, newPaid } = change;
        // Find payable to get total amount
        const currentYear = tabValue + 1;
        const yearPayables = payables[currentYear] || [];
        const payable = yearPayables.find(p => p.id === payableId);
        if (!payable) continue;
        const payableAmount = Number(payable.amount) || 0;
        const newStatus = newPaid >= payableAmount ? 'fully_paid' : (newPaid > 0 ? 'partially_paid' : 'unpaid');

        const updateObj = {
          [`studentPayments.${studentId}.paidAmount`]: newPaid,
          [`studentPayments.${studentId}.status`]: newStatus
        };
        const result = await updatePayable(payableId, updateObj);
        if (!result.success) {
          throw new Error(result.error || 'Failed to update payable ' + payableId);
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
    const newPaidAmount = newValue === '' ? 0 : parseFloat(newValue) || 0;
    setStagedPayments(prev => ({
      ...prev,
      [payableId]: newPaidAmount
    }));
  }, []);

  const calculateTotalBalance = useCallback((studentId) => {
    if (!studentId || !payables) return 0;
    // For irregular students, use their actual year level
    const student = students.find(s => s.id === studentId);
    const studentYearLevel = student?.isIrregular ? student.yearLevel : (tabValue + 1);
    const allYearPayables = payables[studentYearLevel] || [];
    
    // Filter payables to only include:
    // 1. Non-individual payables (apply to everyone)
    // 2. Individual payables specifically for this student
    const yearPayables = allYearPayables.filter(payable => 
      !payable.isIndividual || payable.studentId === studentId
    );
    
    return yearPayables.reduce((total, payable) => {
      const studentPayment = payable.studentPayments?.[studentId] || { status: 'unpaid', paidAmount: 0 };
      // If there's a staged payment for this payable (and the staged edits belong to the currently selected student), use it.
      const stagedPaid = stagedPayments?.[payable.id];
      const paidAmount = typeof stagedPaid !== 'undefined' ? Number(stagedPaid) : Number(studentPayment.paidAmount || 0);
      const status = typeof stagedPaid !== 'undefined'
        ? (paidAmount >= Number(payable.amount || 0) ? 'fully_paid' : (paidAmount > 0 ? 'partially_paid' : 'unpaid'))
        : studentPayment.status;

      if (status === 'unpaid' || status === 'partially_paid') {
        const payableAmount = Number(payable.amount) || 0;
        return total + (payableAmount - paidAmount);
      }
      return total;
    }, 0);
  }, [payables, tabValue, stagedPayments, students]);

  // 1. Remove all payment dialog/modal state and handlers (studentPaymentDialogOpen, selectedPayableForPayment, selectedStudentForPayment, studentPaymentForm, handleStudentPaymentClick, handleStudentPaymentFormChange, handleSaveStudentPayment, handleMarkAsFullyPaid, and their usages)
  // 2. In the payables table, always render the paid amount as a TextField (not just in edit mode)
  // 3. On change, update Firestore immediately
  // 4. Remove the Record Payment modal JSX
  // 5. Remove any references to the old modal-based payment workflow

  const renderStudentList = () => (
    <Box >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <TextField
          placeholder="Search students by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          size="small"
          sx={{ flex: 1 }}
        />
        <IconButton onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
          {viewMode === 'grid' ? <ListIcon /> : <GridViewIcon />}
        </IconButton>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddPayable}
          size="small"
        >
          Add Payables
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          {[1, 2, 3, 4].map(year => (
            <Tab key={year} label={`${year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year`} />
          ))}
          <Tab label="Irregular Students" />
        </Tabs>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          {tabValue === 4 ? 'Irregular Students' : `Students in ${tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year`}
        </Typography>
      </Box>

      {/* Student Display */}
      <Box>
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
          // Sort students
          filteredStudents.sort((a, b) => {
            const balanceA = calculateTotalBalance(a.id);
            const balanceB = calculateTotalBalance(b.id);
            switch (sortBy) {
              case 'name-asc':
                return a.name.localeCompare(b.name);
              case 'name-desc':
                return b.name.localeCompare(a.name);
              case 'balance-asc':
                return balanceA - balanceB;
              case 'balance-desc':
                return balanceB - balanceA;
              case 'id-asc':
                return a.studentNumber.localeCompare(b.studentNumber);
              case 'id-desc':
                return b.studentNumber.localeCompare(a.studentNumber);
              default:
                return 0;
            }
          });
          if (filteredStudents.length === 0) {
            return (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {searchTerm ? 'No students found' : tabValue === 4 ? 'No irregular students' : `No students in Year ${tabValue + 1}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchTerm ? 'Try adjusting your search terms' : 'No students available for payment management'}
                </Typography>
              </Box>
            );
          }
          // For displaying payable counts, we need to be careful:
          // For irregular tab (4), we can't determine a single "year payables" set
          // since irregular students can be from different years.
          // For now, we'll compute payables per student in the rendering logic.
          if (viewMode === 'grid') {
            return (
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                gap: 2,
                '@media (min-width: 900px)': {
                  gridTemplateColumns: 'repeat(3, 1fr)'
                }
              }}>
                {filteredStudents.map((student) => {
                  const totalBalance = calculateTotalBalance(student.id);
                  const allYearPayables = payables[student.yearLevel] || [];
                  const studentYearPayables = allYearPayables.filter(payable => 
                    !payable.isIndividual || payable.studentId === student.id
                  );
                  return (
                    <Card 
                      key={student.id}
                      sx={{ 
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: 4
                        },
                        border: totalBalance > 0 ? '2px solid #f44336' : '2px solid #4caf50'
                      }}
                      onClick={() => {
                        setSelectedStudentModal(student);
                        setStudentModalOpen(true);
                        // Clear any staged payments when opening a new student modal
                        setStagedPayments({});
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Typography variant="h6" fontWeight="bold" noWrap>
                            {student.name}
                          </Typography>
                          {student.isIrregular && (
                            <Chip 
                              label="Irregular"
                              size="small"
                              color="warning"
                              sx={{ mb: 1 }}
                            />
                          )}
                          <Typography 
                            variant="h5" 
                            fontWeight="bold" 
                            color={totalBalance > 0 ? "error" : "success"}
                            textAlign="center"
                          >
                            ₱{totalBalance.toLocaleString()}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            textAlign="center"
                          >
                            {totalBalance > 0 ? 'Outstanding Balance' : 'All Paid'}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                            <Chip 
                              size="small"
                              label={studentYearPayables.length + ' payable(s)'}
                              color="primary"
                              variant="outlined"
                            />
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            );
          } else {
            // List view
            return (
              <TableContainer component={Card}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell onClick={() => setSortBy(sortBy === 'id-asc' ? 'id-desc' : 'id-asc')} sx={{ cursor: 'pointer' }}>
                        Student ID {sortBy === 'id-asc' ? <ArrowUpwardIcon fontSize="small" /> : sortBy === 'id-desc' ? <ArrowDownwardIcon fontSize="small" /> : <SortIcon fontSize="small" />}
                      </TableCell>
                      <TableCell onClick={() => setSortBy(sortBy === 'name-asc' ? 'name-desc' : 'name-asc')} sx={{ cursor: 'pointer' }}>
                        Student Name {sortBy === 'name-asc' ? <ArrowUpwardIcon fontSize="small" /> : sortBy === 'name-desc' ? <ArrowDownwardIcon fontSize="small" /> : <SortIcon fontSize="small" />}
                      </TableCell>
                      <TableCell align="right" onClick={() => setSortBy(sortBy === 'balance-asc' ? 'balance-desc' : 'balance-asc')} sx={{ cursor: 'pointer' }}>
                        Total Balance {sortBy === 'balance-asc' ? <ArrowUpwardIcon fontSize="small" /> : sortBy === 'balance-desc' ? <ArrowDownwardIcon fontSize="small" /> : <SortIcon fontSize="small" />}
                      </TableCell>
                      <TableCell align="right">Payables Count</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredStudents.map((student) => {
                      const totalBalance = calculateTotalBalance(student.id);
                      const allYearPayables = payables[student.yearLevel] || [];
                      const studentYearPayables = allYearPayables.filter(payable => 
                        !payable.isIndividual || payable.studentId === student.id
                      );
                      return (
                        <TableRow 
                          key={student.id} 
                          hover 
                          sx={{ cursor: 'pointer' }}
                          onClick={() => {
                            setSelectedStudentModal(student);
                            setStudentModalOpen(true);
                            setStagedPayments({});
                          }}
                        >
                          <TableCell>{student.studentNumber}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {student.name}
                              {student.isIrregular && (
                                <Chip 
                                  label="Irregular"
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography 
                              variant="body1" 
                              fontWeight="bold" 
                              color={totalBalance > 0 ? "error" : "success"}
                            >
                              ₱{totalBalance.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{studentYearPayables.length}</TableCell>
                          <TableCell align="center">
                            <Chip 
                              size="small"
                              label={totalBalance > 0 ? 'Partially Paid' : 'Fully Paid'}
                              color={totalBalance > 0 ? 'error' : 'success'}
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell colSpan={2} align="right"><strong>Total</strong></TableCell>
                      <TableCell align="right">
                        <strong>₱{filteredStudents.reduce((sum, student) => sum + calculateTotalBalance(student.id), 0).toLocaleString()}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{filteredStudents.reduce((sum, student) => {
                          const allYearPayables = payables[student.yearLevel] || [];
                          const studentPayables = allYearPayables.filter(payable => 
                            !payable.isIndividual || payable.studentId === student.id
                          );
                          return sum + studentPayables.length;
                        }, 0)}</strong>
                      </TableCell>
                      <TableCell align="center">-</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            );
          }
        })()}
      </Box>
    </Box>
  );

  // Add sign out handler
  const handleSignOut = async () => {
    try {
      await signout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <Box sx={{ padding: 3}}>
      <AppBar position="absolute" sx={{ bgcolor: '#f5f6fa', }}>
                    <Toolbar>
                      <Box
                        component="img"
                        src={Logo}
                        alt="Logo"
                        sx={{ width: 50, height: 50, marginRight: 2, cursor: 'pointer' }}
                        onClick={onBackToDashboard}
                      />
                      <Typography 
                        variant="h5" 
                        sx={{ flexGrow: 1, fontWeight: 700, color:'royalblue', cursor: 'pointer' }}
                        onClick={onBackToDashboard}
                      >
                        College of Computer Studies
                      </Typography>
                      <Button color="error" sx={{ borderRadius: 5}} variant="contained" onClick={handleSignOut}>
                        Sign Out
                      </Button>
                    </Toolbar>
                  </AppBar>
            
      
      {!currentUser && (
        <Alert severity="info" sx={{ mx: 3, mb: 2 }}>
          Please sign in to access the Payables System
        </Alert>
      )}
      
      {error && <Alert severity="error" sx={{ mx: 3, mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mx: 3, mb: 2 }}>{success}</Alert>}
      
      {currentUser ? (
        <Box sx={{ flex: 1, pt: 0 }}>
          <Box sx={{ 
             mt: 7,
             backgroundColor: 'white',
              padding: 3,
              borderRadius: 2,
              boxShadow: 3,
              border: '1px solid #e0e0e0',
              mb: 3,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <IconButton
                onClick={onBackToDashboard}
                sx={{ 
                  color: 'white',
                  backgroundColor: 'royalblue',
                  '&:hover': { 
                    backgroundColor: 'rgba(65, 105, 225, 0.8)',
                    color: 'white'
                  }
                }}
              >
                <ArrowBackIcon />
              </IconButton>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap:1  }}>
                <Typography variant="h5" sx={{ color:' royalblue', fontWeight: 700}}>
                Payables Management System
              </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                    Manage invoices, track payments, and handle financial transactions for the institution
                  </Typography>
              </Box>
            </Box>
          </Box>
          <Box >
            {renderStudentList()}
          </Box>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ p: 4, textAlign: 'center', border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa' }}>
            <Typography variant="h6" color="text.secondary">
              Sign in to access payment management features
            </Typography>
          </Box>
        </Box>
      )}

      {/* Add Payable Dialog */}
      <Dialog 
        open={addPayableDialogOpen} 
        onClose={() => {
          setAddPayableDialogOpen(false);
          setEditingMode(false);
          setNewPayableForm({
            type: '',
            amount: '',
            status: 'unpaid',
            paidAmount: '0'
          });
        }} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>
          {editingMode ? 'Edit Payable' : 'Add New Payable'}
          <Typography variant="body2" color="text.secondary">
            {tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year Students
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Payable Type"
              value={newPayableForm.type}
              onChange={(e) => handleNewPayableInputChange('type', e.target.value)}
              placeholder="e.g., Tuition Fee, Laboratory Fee, etc."
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={newPayableForm.amount}
              onChange={(e) => handleNewPayableInputChange('amount', e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">₱</InputAdornment>,
              }}
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddPayableDialogOpen(false);
            setEditingMode(false);
            setNewPayableForm({
              type: '',
              amount: '',
              status: 'unpaid',
              paidAmount: '0'
            });
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveNewPayable} 
            variant="contained"
            disabled={!newPayableForm.type || !newPayableForm.amount || loading}
          >
            {loading ? (editingMode ? 'Updating...' : 'Adding...') : (editingMode ? 'Update Payable' : 'Add Payable')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Creation Dialog */}
      <Dialog 
        open={paymentDialogOpen} 
        onClose={() => setPaymentDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>
          Create Payment Record
          {selectedStudentModal && (
            <Typography variant="body2" color="text.secondary">
              For: {selectedStudentModal.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Payment Type</InputLabel>
              <Select
                value={paymentForm.paymentType}
                onChange={(e) => handlePaymentInputChange('paymentType', e.target.value)}
                label="Payment Type"
              >
                <MenuItem value="tuition">Tuition Fee</MenuItem>
                <MenuItem value="miscellaneous">Miscellaneous</MenuItem>
                <MenuItem value="laboratory">Laboratory Fee</MenuItem>
                <MenuItem value="library">Library Fee</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={paymentForm.amount}
              onChange={(e) => handlePaymentInputChange('amount', e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                inputMode: 'numeric',
                pattern: '[0-9]*',
                onWheel: (e) => e.preventDefault(),
              }}
              sx={{ 
                mb: 2,
                '& input[type=number]': {
                  '-moz-appearance': 'textfield',
                },
                '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                  '-webkit-appearance': 'none',
                  margin: 0,
                },
              }}
            />
            
            <TextField
              fullWidth
              label="Description"
              value={paymentForm.description}
              onChange={(e) => handlePaymentInputChange('description', e.target.value)}
              multiline
              rows={2}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Due Date"
              type="date"
              value={paymentForm.dueDate}
              onChange={(e) => handlePaymentInputChange('dueDate', e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSavePayment} 
            variant="contained"
            disabled={!paymentForm.amount || !paymentForm.description || loading}
          >
            {loading ? 'Creating...' : 'Create Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Student Payment Dialog */}
      {/* 4. Remove the Record Payment modal JSX */}
      {/* 5. Remove any references to the old modal-based payment workflow */}

      {/* Student Details Modal */}
        <Dialog 
        open={studentModalOpen} 
        onClose={() => {
          setStudentModalOpen(false);
          setSelectedStudentModal(null);
          setStagedPayments({});
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {selectedStudentModal?.name}
                {selectedStudentModal?.isIrregular && (
                  <Chip 
                    label="Irregular"
                    size="small"
                    color="warning"
                    sx={{ ml: 1 }}
                  />
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedStudentModal?.isIrregular 
                  ? `Irregular Student (${selectedStudentModal.yearLevel === 1 ? '1st' : selectedStudentModal.yearLevel === 2 ? '2nd' : selectedStudentModal.yearLevel === 3 ? '3rd' : '4th'} Year Level) - Payables Management`
                  : `${tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year Student - Payables Management`
                }
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="warning"
                startIcon={<AddIcon />}
                onClick={handleAddIndividualPayable}
                size="medium"
                sx={{ fontWeight: 'bold' }}
              >
                Add Previous Balance
              </Button>
              <Typography 
                variant="h6" 
                fontWeight="bold" 
                color={selectedStudentModal ? calculateTotalBalance(selectedStudentModal.id) > 0 ? "error" : "success" : "inherit"}
              >
                Total: ₱{selectedStudentModal ? calculateTotalBalance(selectedStudentModal.id).toLocaleString() : '0'}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {(() => {
              // For irregular students, show payables for their actual year level
              const studentYearLevel = selectedStudentModal?.isIrregular ? selectedStudentModal.yearLevel : (tabValue + 1);
              const allYearPayables = payables[studentYearLevel] || [];
              
              // Filter payables to only show:
              // 1. Non-individual payables (apply to everyone)
              // 2. Individual payables specifically for this student
              const yearPayables = allYearPayables.filter(payable => {
                const shouldShow = !payable.isIndividual || payable.studentId === selectedStudentModal?.id;
                console.log('Payable:', payable.type, 'isIndividual:', payable.isIndividual, 'studentId:', payable.studentId, 'selectedStudentId:', selectedStudentModal?.id, 'shouldShow:', shouldShow);
                return shouldShow;
              });
              
              console.log('Total payables for year level', studentYearLevel, ':', allYearPayables.length);
              console.log('Filtered payables for student', selectedStudentModal?.name, ':', yearPayables.length);
              
              if (yearPayables.length === 0) {
                return (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      No payables for this year level.
                    </Typography>
                  </Box>
                );
              }
              return yearPayables.map((payable) => {
                const studentPayment = payable.studentPayments?.[selectedStudentModal?.id] || { status: 'unpaid', paidAmount: 0 };
                return (
                  <Card key={payable.id} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="h6" fontWeight="bold">{payable.type}</Typography>
                            {payable.isIndividual && (
                              <Chip 
                                label="Individual Charge"
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            )}
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            Total Amount: ₱{payable.amount.toLocaleString()}
                          </Typography>
                        </Box>
                        <Chip 
                          label={getStatusLabel(studentPayment.status)}
                          size="medium"
                          color={getStatusColor(studentPayment.status)}
                          variant="filled"
                        />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <TextField
                          size="medium"
                          type="number"
                          label="Paid Amount"
                          value={typeof stagedPayments?.[payable.id] !== 'undefined' ? stagedPayments[payable.id] : (studentPayment.paidAmount === 0 ? '' : studentPayment.paidAmount)}
                          onChange={(e) => selectedStudentModal && handleStagedPaidAmountChange(payable.id, e.target.value)}
                          InputProps={{
                            startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                            inputMode: 'numeric',
                            pattern: '[0-9]*',
                            onWheel: (e) => e.preventDefault(),
                          }}
                          sx={{ 
                            flex: 1,
                            '& input[type=number]': {
                              '-moz-appearance': 'textfield',
                            },
                            '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                              '-webkit-appearance': 'none',
                              margin: 0,
                            },
                          }}
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton
                            color="primary"
                            onClick={() => handleStartEditPayables(payable.id)}
                            sx={{ p: 1 }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            color="error"
                            onClick={() => handleDeletePayable(payable.id)}
                            sx={{ p: 1 }}
                          >
                            <CancelIcon />
                          </IconButton>
                        </Box>
                      </Box>
                      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          Remaining: ₱{(payable.amount - (studentPayment.paidAmount || 0)).toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Last updated: {new Date().toLocaleDateString()}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                );
              });
            })()}
          </Box>
        </DialogContent>
        <DialogActions>
          <Box sx={{ display: 'flex', gap: 1, width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Button onClick={handleDiscardStagedPayments} disabled={Object.keys(stagedPayments).length === 0}>
                Discard Changes
              </Button>
            </Box>
            <Box>
              <Button 
                onClick={() => {
                  setStudentModalOpen(false);
                  setSelectedStudentModal(null);
                  setStagedPayments({});
                }}
                variant="outlined"
                sx={{ mr: 1 }}
              >
                Close
              </Button>
              <Button 
                onClick={handleShowSummary} 
                variant="contained"
                disabled={Object.keys(stagedPayments).length === 0 || confirmLoading}
              >
                {confirmLoading ? 'Confirming...' : 'Confirm Changes'}
              </Button>
            </Box>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Summary Modal */}
      <Dialog 
        open={summaryModalOpen} 
        onClose={() => setSummaryModalOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Confirm Payment Changes
          {selectedStudentModal && (
            <Typography variant="body2" color="text.secondary">
              For: {selectedStudentModal.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="h6" gutterBottom>
              Summary of Changes:
            </Typography>
            {summaryData.changes.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No changes to confirm.
              </Typography>
            ) : (
              <Box>
                {summaryData.changes.map((change) => (
                  <Card key={change.payableId} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                    <CardContent>
                      <Typography variant="h6" fontWeight="bold">{change.type}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Amount: ₱{change.amount.toLocaleString()}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Current Paid: ₱{change.currentPaid.toLocaleString()} (Balance: ₱{(change.amount - change.currentPaid).toLocaleString()})
                          </Typography>
                          <Typography variant="body2" color="primary">
                            New Paid: ₱{change.newPaid.toLocaleString()} (Balance: ₱{(change.amount - change.newPaid).toLocaleString()})
                          </Typography>
                        </Box>
                        <Typography variant="body2" color={change.newPaid > change.currentPaid ? "success.main" : change.newPaid < change.currentPaid ? "error.main" : "text.secondary"}>
                          {change.newPaid > change.currentPaid ? `+₱${(change.newPaid - change.currentPaid).toLocaleString()}` : change.newPaid < change.currentPaid ? `-₱${(change.currentPaid - change.newPaid).toLocaleString()}` : 'No change'}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
                <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    Balance Summary:
                  </Typography>
                  <Typography variant="body1">
                    Current Total Balance: ₱{summaryData.totalCurrentBalance.toLocaleString()}
                  </Typography>
                  <Typography variant="body1" color="primary">
                    New Total Balance: ₱{summaryData.totalNewBalance.toLocaleString()}
                  </Typography>
                  
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryModalOpen(false)} variant="outlined">
            Cancel
          </Button>
          <Button 
            onClick={handleFinalConfirm} 
            variant="contained"
            disabled={confirmLoading}
          >
            {confirmLoading ? 'Confirming...' : 'Confirm All Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Individual Student Payable Dialog */}
      <Dialog 
        open={individualPayableDialogOpen} 
        onClose={() => {
          setIndividualPayableDialogOpen(false);
          setIndividualPayableForm({
            type: '',
            amount: '',
            yearLevel: ''
          });
        }} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>
          Add Previous Balance / Custom Charge
          {selectedStudentModal && (
            <Typography variant="body2" color="text.secondary">
              For: {selectedStudentModal.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Payable Type"
              value={individualPayableForm.type}
              onChange={(e) => handleIndividualPayableInputChange('type', e.target.value)}
              placeholder="e.g., 2nd Year Balance, Laboratory Fee, etc."
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={individualPayableForm.amount}
              onChange={(e) => handleIndividualPayableInputChange('amount', e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                inputMode: 'numeric',
                pattern: '[0-9]*',
                onWheel: (e) => e.preventDefault(),
              }}
              sx={{ 
                mb: 2,
                '& input[type=number]': {
                  '-moz-appearance': 'textfield',
                },
                '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                  '-webkit-appearance': 'none',
                  margin: 0,
                },
              }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Year Level (when the charge was incurred)</InputLabel>
              <Select
                value={individualPayableForm.yearLevel}
                onChange={(e) => handleIndividualPayableInputChange('yearLevel', e.target.value)}
                label="Year Level (when the charge was incurred)"
              >
                <MenuItem value="1">1st Year</MenuItem>
                <MenuItem value="2">2nd Year</MenuItem>
                <MenuItem value="3">3rd Year</MenuItem>
                <MenuItem value="4">4th Year</MenuItem>
              </Select>
            </FormControl>

            <Alert severity="info" sx={{ mt: 2 }}>
              This will add a payable specifically for {selectedStudentModal?.name}. 
              Other students will not see this charge.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setIndividualPayableDialogOpen(false);
            setIndividualPayableForm({
              type: '',
              amount: '',
              yearLevel: ''
            });
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveIndividualPayable} 
            variant="contained"
            disabled={!individualPayableForm.type || !individualPayableForm.amount || !individualPayableForm.yearLevel || loading}
          >
            {loading ? 'Adding...' : 'Add Previous Balance'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PayablesSystem;