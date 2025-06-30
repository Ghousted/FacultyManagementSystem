import { useState, useEffect } from 'react';
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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PaymentIcon from '@mui/icons-material/Payment';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { getStudents } from '../../models/curriculumModels';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  onSnapshot
} from 'firebase/firestore';

const PayablesSystem = ({ onBackToDashboard }) => {
  const { currentUser } = useAuth();
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
  const [studentPaymentDialogOpen, setStudentPaymentDialogOpen] = useState(false);
  const [selectedPayableForPayment, setSelectedPayableForPayment] = useState(null);
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState(null);
  const [studentPaymentForm, setStudentPaymentForm] = useState({
    paymentAmount: ''
  });

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

  useEffect(() => {
    if (currentUser) {
      loadStudents();
      loadPayables();
    }
  }, [currentUser]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadStudents = async () => {
    if (!currentUser) {
      setError('Please sign in to access student data');
      return;
    }
    
    setLoading(true);
    setError('');
    const result = await getStudents();
    if (result.success) {
      setStudents(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const loadPayables = async () => {
    if (!currentUser) {
      setError('Please sign in to access payables data');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const payablesRef = collection(db, 'payables');
      const q = query(payablesRef, where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      
      const yearSpecificPayables = {};
      
      querySnapshot.forEach((doc) => {
        const payable = { id: doc.id, ...doc.data() };
        const yearLevel = payable.yearLevel;
        
        if (!yearSpecificPayables[yearLevel]) {
          yearSpecificPayables[yearLevel] = [];
        }
        
        yearSpecificPayables[yearLevel].push(payable);
      });
      
      setPayables(yearSpecificPayables);
      setEditingPayables(yearSpecificPayables);
    } catch (error) {
      console.error('Error loading payables:', error);
      setError('Failed to load payables: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

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

  const handleCreatePayment = () => {
    if (!selectedStudent) return;
    
    setPaymentForm({
      amount: '',
      paymentType: 'tuition',
      description: '',
      dueDate: '',
      status: 'pending'
    });
    setPaymentDialogOpen(true);
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
        // Update existing payable in Firestore
        const payableRef = doc(db, 'payables', newPayableForm.id);
        await updateDoc(payableRef, {
          type: newPayableForm.type,
          amount: parseFloat(newPayableForm.amount),
          updatedAt: new Date()
        });
        
        // Update local state
        setPayables(prev => ({
          ...prev,
          [currentYear]: prev[currentYear].map(payable => {
            if (payable.id === newPayableForm.id) {
              return {
                ...payable,
                type: newPayableForm.type,
                amount: parseFloat(newPayableForm.amount)
              };
            }
            return payable;
          })
        }));
        setSuccess('Payable updated successfully!');
      } else {
        // Add new payable to Firestore
        // Get all students in the current year level
        const currentYearStudents = students.filter(student => student.yearLevel === currentYear);
        
        // Create student payments object for all students in the year level
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
          userId: currentUser.uid,
          studentPayments: studentPayments,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const docRef = await addDoc(collection(db, 'payables'), newPayableData);
        
        // Update local state with the new payable
        const newPayable = {
          id: docRef.id,
          ...newPayableData
        };
        
        setPayables(prev => ({
          ...prev,
          [currentYear]: [...(prev[currentYear] || []), newPayable]
        }));
        setSuccess(`Payable added successfully for ${currentYearStudents.length} students!`);
        setAddPayableDialogOpen(false);
      }
      
      setEditingMode(false);
      setNewPayableForm({
        type: '',
        amount: '',
        status: 'unpaid',
        paidAmount: '0'
      });
    } catch (error) {
      console.error('Error saving payable:', error);
      setError('Failed to save payable: ' + error.message);
    }
    setLoading(false);
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

  const handleCancelEditPayables = () => {
    setEditingMode(false);
    setNewPayableForm({
      type: '',
      amount: '',
      status: 'unpaid',
      paidAmount: '0'
    });
  };

  const handleSaveEditPayables = async (payableId) => {
    setLoading(true);
    try {
      // TODO: Save to Firestore
      const updatedPayables = payables.map(payable =>
        payable.id === payableId ? { ...newPayableForm, id: payableId } : payable
      );
      setPayables(updatedPayables);
      setEditingMode(false);
      setSuccess('Payable updated successfully!');
    } catch (error) {
      setError('Failed to update payable: ' + error.message);
    }
    setLoading(false);
  };

  const handlePayableChange = (payableId, field, value) => {
    setEditingPayables(prev =>
      prev.map(payable =>
        payable.id === payableId ? { ...payable, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : payable
      )
    );
  };

  const handleDeletePayable = async (payableId) => {
    setLoading(true);
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'payables', payableId));
      
      // Update local state
      const currentYear = tabValue + 1;
      setPayables(prev => ({
        ...prev,
        [currentYear]: prev[currentYear].filter(payable => payable.id !== payableId)
      }));
      setEditingPayables(prev => ({
        ...prev,
        [currentYear]: prev[currentYear].filter(payable => payable.id !== payableId)
      }));
      
      setSuccess('Payable deleted successfully!');
    } catch (error) {
      console.error('Error deleting payable:', error);
      setError('Failed to delete payable: ' + error.message);
    }
    setLoading(false);
  };

  const getPaymentTypeLabel = (type) => {
    // If type is empty or undefined, return a default
    if (!type) return 'Unknown Type';
    
    // For backward compatibility with existing dropdown values
    switch (type) {
      case 'tuition':
        return 'Tuition Fee';
      case 'miscellaneous':
        return 'Miscellaneous';
      case 'laboratory':
        return 'Laboratory Fee';
      case 'library':
        return 'Library Fee';
      default:
        // Return the custom text as is
        return type;
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

  const calculateTotalBalance = (studentId) => {
    const currentYear = tabValue + 1;
    const yearPayables = payables[currentYear] || [];
    return yearPayables.reduce((total, payable) => {
      const studentPayment = payable.studentPayments?.[studentId];
      if (studentPayment && (studentPayment.status === 'unpaid' || studentPayment.status === 'partially_paid')) {
        return total + (payable.amount - studentPayment.paidAmount);
      }
      return total;
    }, 0);
  };

  const handleStudentPaymentClick = (payable, student) => {
    setSelectedPayableForPayment(payable);
    setSelectedStudentForPayment(student);
    const currentPayment = payable.studentPayments?.[student.id] || { status: 'unpaid', paidAmount: 0 };
    const remainingAmount = payable.amount - currentPayment.paidAmount;
    
    setStudentPaymentForm({
      paymentAmount: remainingAmount > 0 ? remainingAmount.toString() : '0'
    });
    setStudentPaymentDialogOpen(true);
  };

  const handleStudentPaymentFormChange = (field, value) => {
    setStudentPaymentForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveStudentPayment = async () => {
    if (!selectedPayableForPayment || !selectedStudentForPayment || !studentPaymentForm.paymentAmount) {
      setError('Please fill in all required fields');
      return;
    }

    const paymentAmount = parseFloat(studentPaymentForm.paymentAmount);
    if (paymentAmount <= 0) {
      setError('Payment amount must be greater than 0');
      return;
    }

    setLoading(true);
    try {
      const currentYear = selectedStudentForPayment.yearLevel;
      const currentPayment = selectedPayableForPayment.studentPayments?.[selectedStudentForPayment.id] || { status: 'unpaid', paidAmount: 0 };
      const newPaidAmount = currentPayment.paidAmount + paymentAmount;
      const totalAmount = selectedPayableForPayment.amount;
      
      // Determine new status based on payment amount
      let newStatus = 'unpaid';
      if (newPaidAmount >= totalAmount) {
        newStatus = 'fully_paid';
      } else if (newPaidAmount > 0) {
        newStatus = 'partially_paid';
      }

      // Update the payable in Firestore
      const payableRef = doc(db, 'payables', selectedPayableForPayment.id);
      const updatedStudentPayments = {
        ...selectedPayableForPayment.studentPayments,
        [selectedStudentForPayment.id]: {
          status: newStatus,
          paidAmount: newPaidAmount
        }
      };
      
      await updateDoc(payableRef, {
        studentPayments: updatedStudentPayments,
        updatedAt: new Date()
      });

      // Update local state
      setPayables(prev => ({
        ...prev,
        [currentYear]: prev[currentYear].map(payable =>
          payable.id === selectedPayableForPayment.id
            ? {
                ...payable,
                studentPayments: updatedStudentPayments
              }
            : payable
        )
      }));

      setSuccess(`Payment of ₱${paymentAmount.toLocaleString()} recorded successfully!`);
      setStudentPaymentDialogOpen(false);
      setSelectedPayableForPayment(null);
      setSelectedStudentForPayment(null);
      setStudentPaymentForm({
        paymentAmount: ''
      });
    } catch (error) {
      console.error('Error saving student payment:', error);
      setError('Failed to save payment: ' + error.message);
    }
    setLoading(false);
  };

  const handleMarkAsFullyPaid = async () => {
    if (!selectedPayableForPayment || !selectedStudentForPayment) {
      return;
    }

    setLoading(true);
    try {
      const currentYear = selectedStudentForPayment.yearLevel;
      const totalAmount = selectedPayableForPayment.amount;

      // Update the payable in Firestore
      const payableRef = doc(db, 'payables', selectedPayableForPayment.id);
      const updatedStudentPayments = {
        ...selectedPayableForPayment.studentPayments,
        [selectedStudentForPayment.id]: {
          status: 'fully_paid',
          paidAmount: totalAmount
        }
      };
      
      await updateDoc(payableRef, {
        studentPayments: updatedStudentPayments,
        updatedAt: new Date()
      });

      // Update local state
      setPayables(prev => ({
        ...prev,
        [currentYear]: prev[currentYear].map(payable =>
          payable.id === selectedPayableForPayment.id
            ? {
                ...payable,
                studentPayments: updatedStudentPayments
              }
            : payable
        )
      }));

      setSuccess(`Marked as fully paid (₱${totalAmount.toLocaleString()})!`);
      setStudentPaymentDialogOpen(false);
      setSelectedPayableForPayment(null);
      setSelectedStudentForPayment(null);
      setStudentPaymentForm({
        paymentAmount: ''
      });
    } catch (error) {
      console.error('Error marking as fully paid:', error);
      setError('Failed to mark as fully paid: ' + error.message);
    }
    setLoading(false);
  };

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
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddPayable}
          size="small"
        >
          Add Payables
        </Button>
      </Box>
      
      <Box sx={{ overflowX: 'auto' }}>
        {(() => {
          let filteredStudents = students.filter(student => student.yearLevel === (tabValue + 1));
          
          // Filter by search term
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
          
          return (
            <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: 1, width: '100%', maxHeight: 'none', overflow: 'visible' }}>
              <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '200px', position: 'sticky', left: 0, bgcolor: '#f5f5f5', zIndex: 1 }}>
                      Student Name
                    </TableCell>
                    {(payables[tabValue + 1] || []).map((payable) => (
                      <TableCell 
                        key={payable.id} 
                        sx={{ 
                          width: '180px', 
                          minWidth: '180px',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: '#e3f2fd' }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight="bold" noWrap>
                              {payable.type}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              ₱{payable.amount.toLocaleString()}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
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
                      </TableCell>
                    ))}
                    <TableCell sx={{ width: '150px', position: 'sticky', right: 0, bgcolor: '#f5f5f5', zIndex: 1 }}>
                      Total Balance
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={(payables[tabValue + 1] || []).length + 1} sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No students found in this year level.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map((student) => {
                      const totalBalance = calculateTotalBalance(student.id);
                      const isEditing = editingMode && editingPayables[tabValue + 1]?.find(p => p.id === student.id);
                      
                      return (
                        <TableRow 
                          key={student.id}
                          sx={{ 
                            cursor: 'pointer',
                            '&:hover': { bgcolor: '#f5f5f5' },
                            bgcolor: selectedStudent?.id === student.id ? '#e3f2fd' : 'inherit'
                          }}
                          onClick={() => setSelectedStudent(student)}
                        >
                          <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'white', zIndex: 1 }}>
                            <Typography variant="body2" fontWeight="bold" noWrap>
                              {student.name}
                            </Typography>
                          </TableCell>
                          {(payables[tabValue + 1] || []).map((payable) => {
                            const studentPayment = payable.studentPayments?.[student.id] || { status: 'unpaid', paidAmount: 0 };
                            
                            return (
                              <TableCell 
                                key={payable.id}
                                sx={{ 
                                  width: '180px', 
                                  minWidth: '180px',
                                  cursor: 'pointer',
                                  '&:hover': { bgcolor: '#f5f5f5' }
                                }}
                                onClick={() => setSelectedStudent(student)}
                              >
                                {isEditing ? (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <FormControl size="small" fullWidth>
                                      <Select
                                        value={studentPayment.status}
                                        onChange={(e) => handleStudentPaymentChange(payable.id, student.id, 'status', e.target.value)}
                                      >
                                        <MenuItem value="unpaid">Unpaid</MenuItem>
                                        <MenuItem value="partially_paid">Partially Paid</MenuItem>
                                        <MenuItem value="fully_paid">Fully Paid</MenuItem>
                                      </Select>
                                    </FormControl>
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={studentPayment.paidAmount}
                                      onChange={(e) => handleStudentPaymentChange(payable.id, student.id, 'paidAmount', parseFloat(e.target.value) || 0)}
                                      InputProps={{
                                        startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                                      }}
                                      fullWidth
                                    />
                                  </Box>
                                ) : (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    <Chip 
                                      label={getStatusLabel(studentPayment.status)}
                                      size="small"
                                      color={getStatusColor(studentPayment.status)}
                                      variant="filled"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStudentPaymentClick(payable, student);
                                      }}
                                      sx={{ cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                                    />
                                    <Typography variant="caption" color="success.main">
                                      Paid: ₱{studentPayment.paidAmount.toLocaleString()}
                                    </Typography>
                                  </Box>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell sx={{ position: 'sticky', right: 0, bgcolor: 'white', zIndex: 1 }}>
                            <Typography 
                              variant="body2" 
                              fontWeight="bold" 
                              color={totalBalance > 0 ? "error" : "success"}
                            >
                              ₱{totalBalance.toLocaleString()}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          );
        })()}
      </Box>
    </Box>
  );

  const renderPayablesTable = () => {
    if (!selectedStudent) {
      return (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Select a student to view payables
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click on a student from the list to see their payable records
          </Typography>
        </Box>
      );
    }

    const studentYearPayables = payables[selectedStudent.yearLevel] || [];
    const studentPayables = studentYearPayables.filter(payable => payable.studentPayments && payable.studentPayments[selectedStudent.id]);
    const isEditing = editingMode && newPayableForm.id === selectedStudent.id;
    const displayPayables = isEditing ? (editingPayables[selectedStudent.yearLevel] || []) : studentPayables;

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Payables - {selectedStudent.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Student Number: {selectedStudent.studentNumber || 'N/A'}
        </Typography>
        
        <Box sx={{ mt: 3 }}>
          {displayPayables.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" py={4}>
              No payables found for this student
            </Typography>
          ) : (
            <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell>Status</TableCell>
                    {isEditing && <TableCell>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayPayables.map((payable) => (
                    <TableRow key={payable.id}>
                      <TableCell>
                        {isEditing ? (
                          <TextField
                            size="small"
                            value={payable.type}
                            onChange={(e) => handlePayableChange(payable.id, 'type', e.target.value)}
                            fullWidth
                          />
                        ) : (
                          getPaymentTypeLabel(payable.type)
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <TextField
                            size="small"
                            value={payable.description}
                            onChange={(e) => handlePayableChange(payable.id, 'description', e.target.value)}
                            fullWidth
                          />
                        ) : (
                          payable.description
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <TextField
                            size="small"
                            type="number"
                            value={payable.amount}
                            onChange={(e) => handlePayableChange(payable.id, 'amount', e.target.value)}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                            }}
                            fullWidth
                          />
                        ) : (
                          `₱${payable.amount.toLocaleString()}`
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <TextField
                            size="small"
                            type="date"
                            value={payable.dueDate}
                            onChange={(e) => handlePayableChange(payable.id, 'dueDate', e.target.value)}
                            InputLabelProps={{
                              shrink: true,
                            }}
                            fullWidth
                          />
                        ) : (
                          new Date(payable.dueDate).toLocaleDateString()
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <FormControl size="small" fullWidth>
                            <Select
                              value={payable.status}
                              onChange={(e) => handlePayableChange(payable.id, 'status', e.target.value)}
                            >
                              <MenuItem value="pending">Pending</MenuItem>
                              <MenuItem value="paid">Paid</MenuItem>
                              <MenuItem value="overdue">Overdue</MenuItem>
                            </Select>
                          </FormControl>
                        ) : (
                          <Chip 
                            label={getStatusLabel(payable.status)}
                            size="small"
                            color={getStatusColor(payable.status)}
                            variant="filled"
                          />
                        )}
                      </TableCell>
                      {isEditing && (
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeletePayable(payable.id)}
                          >
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="back"
            onClick={onBackToDashboard}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Payables System
          </Typography>
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
        <Box sx={{ flex: 1, p: 3, pt: 0 }}>
          <Box sx={{ 
            p: 3, 
            border: '1px solid #e0e0e0', 
            borderRadius: 1, 
            bgcolor: '#fafafa', 
            height: '100%',
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
      <Dialog 
        open={studentPaymentDialogOpen} 
        onClose={() => setStudentPaymentDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>
          Record Payment
          {selectedPayableForPayment && selectedStudentForPayment && (
            <Typography variant="body2" color="text.secondary">
              For: {selectedStudentForPayment.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {selectedPayableForPayment && selectedStudentForPayment && (
              <Box sx={{ mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {selectedPayableForPayment.type}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Amount: ₱{selectedPayableForPayment.amount.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Already Paid: ₱{(selectedPayableForPayment.studentPayments?.[selectedStudentForPayment.id]?.paidAmount || 0).toLocaleString()}
                </Typography>
                <Typography variant="body2" fontWeight="bold" color="primary">
                  Remaining: ₱{(selectedPayableForPayment.amount - (selectedPayableForPayment.studentPayments?.[selectedStudentForPayment.id]?.paidAmount || 0)).toLocaleString()}
                </Typography>
              </Box>
            )}
            
            <TextField
              fullWidth
              label="Payment Amount"
              type="number"
              value={studentPaymentForm.paymentAmount}
              onChange={(e) => handleStudentPaymentFormChange('paymentAmount', e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">₱</InputAdornment>,
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStudentPaymentDialogOpen(false)}>Cancel</Button>
          {selectedPayableForPayment && selectedStudentForPayment && (
            <Button 
              onClick={handleMarkAsFullyPaid}
              variant="outlined"
              color="success"
              disabled={loading}
            >
              Mark as Fully Paid
            </Button>
          )}
          <Button 
            onClick={handleSaveStudentPayment} 
            variant="contained"
            disabled={!studentPaymentForm.paymentAmount || loading}
          >
            {loading ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PayablesSystem; 