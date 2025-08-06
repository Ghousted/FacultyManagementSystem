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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PaymentIcon from '@mui/icons-material/Payment';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import UndoIcon from '@mui/icons-material/Undo';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getStudents } from '../../models/curriculumModels';
import { 
  createPayable, 
  getPayables, 
  updatePayable, 
  deletePayable
} from '../../models/payablesModels';
import { useAuth } from '../../contexts/AuthContext';

const PayablesSystem = ({ onBackToDashboard }) => {
  const { currentUser, signout } = useAuth(); // <-- add signout here
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  
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
  const [editingPayables, setEditingPayables] = useState({});
  const [editingMode, setEditingMode] = useState(false);
  const [addPayableDialogOpen, setAddPayableDialogOpen] = useState(false);
  const [newPayableForm, setNewPayableForm] = useState({
    type: '',
    amount: '',
    status: 'unpaid',
    paidAmount: '0'
  });

  // Add state for horizontal pagination
  const [payablePage, setPayablePage] = useState(0);
  const payablesPerPage = 2; // Number of payables to show at a time

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
            studentPayments: payable.studentPayments || {}
          };
          yearSpecificPayables[yearLevel].push(safePayable);
        });
        setPayables(yearSpecificPayables);
        setEditingPayables(yearSpecificPayables);
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

  const handleAddPayable = () => {
    setNewPayableForm({
      type: '',
      amount: '',
      status: 'unpaid',
      paidAmount: '0'
    });
    setAddPayableDialogOpen(true);
  };

  const handleStudentPaymentChange = (payableId, studentId, field, value) => {
    const currentYear = tabValue + 1;
    setPayables(prev => ({
      ...prev,
      [currentYear]: prev[currentYear].map(payable =>
        payable.id === payableId
          ? {
              ...payable,
              studentPayments: {
                ...payable.studentPayments,
                [studentId]: {
                  ...payable.studentPayments?.[studentId],
                  [field]: value
                }
              }
            }
          : payable
      )
    }));
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

  const handleSavePayment = async () => {
    if (!selectedStudent || !paymentForm.amount || !paymentForm.description) {
      setError('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      // TODO: Implement payment saving logic
      console.log('Saving payment for student:', selectedStudent.name, paymentForm);
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

  const handlePaidAmountChange = useCallback(async (payableId, studentId, studentYearLevel, newValue) => {
    const newPaidAmount = newValue === '' ? 0 : parseFloat(newValue) || 0;
    
    // Find the payable to get its amount
    const currentYear = tabValue + 1;
    const yearPayables = payables[currentYear] || [];
    const payable = yearPayables.find(p => p.id === payableId);
    if (!payable) return;
    
    const payableAmount = Number(payable.amount) || 0;
    
    // Determine new status
    let newStatus = 'unpaid';
    if (newPaidAmount >= payableAmount) {
      newStatus = 'fully_paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partially_paid';
    }

    // Update local state
    setPayables(prev => {
      const updated = { ...prev };
      const yearPayables = updated[studentYearLevel] || [];
      updated[studentYearLevel] = yearPayables.map(p => {
        if (p.id === payableId) {
          return {
            ...p,
            studentPayments: {
              ...p.studentPayments,
              [studentId]: {
                ...p.studentPayments?.[studentId],
                paidAmount: newPaidAmount,
                status: newStatus
              }
            }
          };
        }
        return p;
      });
      return updated;
    });

    // Update Firestore
    try {
      const result = await updatePayable(payableId, {
        [`studentPayments.${studentId}.paidAmount`]: newPaidAmount,
        [`studentPayments.${studentId}.status`]: newStatus
      });
      if (!result.success) {
        setError('Failed to update payment: ' + result.error);
      }
    } catch (error) {
      setError('Failed to update payment: ' + error.message);
    }
  }, [payables, tabValue]);

  const calculateTotalBalance = useCallback((studentId) => {
    if (!studentId || !payables) return 0;
    const currentYear = tabValue + 1;
    const yearPayables = payables[currentYear] || [];
    return yearPayables.reduce((total, payable) => {
      const studentPayment = payable.studentPayments?.[studentId];
      if (studentPayment && (studentPayment.status === 'unpaid' || studentPayment.status === 'partially_paid')) {
        const payableAmount = Number(payable.amount) || 0;
        const paidAmount = Number(studentPayment.paidAmount) || 0;
        return total + (payableAmount - paidAmount);
      }
      return total;
    }, 0);
  }, [payables, tabValue]);

  // 1. Remove all payment dialog/modal state and handlers (studentPaymentDialogOpen, selectedPayableForPayment, selectedStudentForPayment, studentPaymentForm, handleStudentPaymentClick, handleStudentPaymentFormChange, handleSaveStudentPayment, handleMarkAsFullyPaid, and their usages)
  // 2. In the payables table, always render the paid amount as a TextField (not just in edit mode)
  // 3. On change, update Firestore immediately
  // 4. Remove the Record Payment modal JSX
  // 5. Remove any references to the old modal-based payment workflow

  const renderStudentList = () => (
    <Box>
      <TextField
        fullWidth
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
        sx={{ mb: 3 }}
        size="small"
      />

      <Box sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          {[1, 2, 3, 4].map(year => (
            <Tab key={year} label={`${year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : '4th'} Year`} />
          ))}
        </Tabs>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Students in {tabValue === 0 ? '1st' : tabValue === 1 ? '2nd' : tabValue === 2 ? '3rd' : '4th'} Year
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddPayable}
            size="small"
          >
            Add Payables
          </Button>
        </Box>
      </Box>

      {/* Accordion List */}
      <Box>
        {(() => {
          let filteredStudents = students.filter(student => student.yearLevel === (tabValue + 1));
          if (searchTerm) {
            filteredStudents = filteredStudents.filter(student => 
              student.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
          }
          if (filteredStudents.length === 0) {
            return (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {searchTerm ? 'No students found' : `No students in Year ${tabValue + 1}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchTerm ? 'Try adjusting your search terms' : 'No students available for payment management'}
                </Typography>
              </Box>
            );
          }
          const yearPayables = payables[tabValue + 1] || [];
          return filteredStudents.map((student) => {
            const totalBalance = calculateTotalBalance(student.id);
            return (
              <Accordion
                key={student.id}
                expanded={selectedStudent?.id === student.id}
                onChange={() => setSelectedStudent(selectedStudent?.id === student.id ? null : student)}
                sx={{ mb: 1 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography fontWeight="bold">{student.name}</Typography>
                    <Typography 
                      variant="body2" 
                      fontWeight="bold" 
                      color={totalBalance > 0 ? "error" : "success"}
                    >
                      ₱{totalBalance.toLocaleString()}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {yearPayables.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No payables for this year level.
                    </Typography>
                  ) : (
                    yearPayables.map((payable, idx) => {
                      const studentPayment = payable.studentPayments?.[student.id] || { status: 'unpaid', paidAmount: 0 };
                      return (
                        <Box key={payable.id} sx={{ mb: idx < yearPayables.length - 1 ? 2 : 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                            {/* Left: Payable name and amount */}
                            <Box>
                              <Typography variant="body2" fontWeight="bold">{payable.type}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                Amount: ₱{payable.amount.toLocaleString()}
                              </Typography>
                            </Box>
                            {/* Right: Status, Paid Amount, Actions */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip 
                                label={getStatusLabel(studentPayment.status)}
                                size="small"
                                color={getStatusColor(studentPayment.status)}
                                variant="filled"
                              />
                              <TextField
                                size="small"
                                type="number"
                                label="Paid Amount"
                                value={studentPayment.paidAmount === 0 ? '' : studentPayment.paidAmount}
                                onChange={(e) => handlePaidAmountChange(payable.id, student.id, student.yearLevel, e.target.value)}
                                InputProps={{
                                  startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                                  inputMode: 'numeric',
                                  pattern: '[0-9]*',
                                }}
                                sx={{ width: 120 }}
                              />
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditPayables(payable.id);
                                }}
                                sx={{ p: 0.5, minWidth: 'auto' }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePayable(payable.id);
                                }}
                                sx={{ p: 0.5, minWidth: 'auto' }}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                          {idx < yearPayables.length - 1 && <Divider sx={{ mt: 2, mb: 1 }} />}
                        </Box>
                      );
                    })
                  )}
                </AccordionDetails>
              </Accordion>
            );
          });
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
      <AppBar position="static" sx={{ borderRadius: 2 }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="back"
            onClick={onBackToDashboard}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, margingLeft: 2 }}>
            Payables System
          </Typography>
          <Button color="error" variant="contained" onClick={handleSignOut}>
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
            
          
            mt: 2
          }}>
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
          {selectedStudent && (
            <Typography variant="body2" color="text.secondary">
              For: {selectedStudent.name}
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
              }}
              sx={{ mb: 2 }}
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
    </Box>
  );
};

export default PayablesSystem;