# Export Guide - Professor & CCS Department Cutback Reports

## Quick Reference for Export Features

---

## 📊 Professor Cutback Report Exports

### 1. Export All Professors
**Location:** Main Professor Cutbacks page → "Export All" button

**What's Included:**
- **Summary Sheet:**
  - List of all professors
  - Employee IDs
  - Number of subjects handled
  - Paid students count
  - Total cutback per professor
  - Grand totals at bottom

- **Individual Professor Sheets:**
  - One sheet per professor
  - All handled classes listed
  - Student counts per class
  - Paid students per class
  - Cutback calculation per class
  - Total cutback for professor

**Use Case:** Monthly/semester reports for administration

---

### 2. Export Single Professor (Summary)
**Location:** Professor list → "Export" button next to professor name

**What's Included:**
- Professor information (Name, Employee ID)
- Cutback rate and deadline settings
- Table of all handled classes:
  - Course Code
  - Course Title
  - Year Level
  - Block(s)
  - Total Students
  - Paid Students (counted for cutback)
  - Late Students (if deadline set)
  - Cutback amount per class
- Total cutback at bottom

**Use Case:** Individual professor payment processing

---

### 3. Export Single Professor (Detailed with All Classes)
**Location:** Professor detail view → "Export All Classes" button

**What's Included:**

#### Summary Sheet:
- Same as Export Single Professor (Summary)

#### Detailed Report Sheet:
For each handled class, a complete table with:

**Class Header:**
- Course Code - Course Title
- Year Level and Block(s)
- Department (CCS or Other Department)

**Student Table:**
| Student Name | Student Number | Amount Paid | Payment Date | Remaining Balance |
|--------------|----------------|-------------|--------------|-------------------|
| All students listed (paid, partial, unpaid) |

**Computations Section:**
```
COMPUTATIONS
Professor Rate per Student: PHP XX.XX
Number of Students × Professor Rate: N × XX.XX = PHP XXX.XX
Total Expected Earnings: PHP XXX.XX
Total Amount Already Claimed/Received: PHP XXX.XX
Remaining Claimable Amount: PHP XXX.XX
Total Module Amount × Number of Students: XX.XX × N = PHP XXX.XX
Total Collection for this Block: PHP XXX.XX
```

**Use Case:** Detailed payment verification and student-level tracking

---

## 🏢 CCS Department Cutback Report Exports

### Export Department Share Report
**Location:** CCS Cutback Reports page → "Export" button

**What's Included:**

**Summary Sheet:**
- Department share amount per paid student
- List of all offered modules:
  - Module Code
  - Module Title
  - Paid Students
  - Share Amount
- Total paid students
- Total department share

**Use Case:** Department revenue tracking and financial reporting

---

### Export Department Detailed Report (Future Enhancement)
**What Will Be Included:**

For each module, a separate sheet with:

**Module Header:**
- Module Code - Module Title
- Year Level and Block(s)

**Student Table:**
| Student Name | Student Number | Amount Paid | Payment Date | Remaining Balance |
|--------------|----------------|-------------|--------------|-------------------|
| All enrolled students |

**Department Computations:**
```
DEPARTMENT COMPUTATIONS
Department Share per Paid Student: PHP XX.XX
Total Department Earnings: PHP XXX.XX
Total Collected Payments: PHP XXX.XX
Remaining Department Revenue: PHP XXX.XX
```

---

## 📋 Export File Naming

### Default Filenames:
- **All Professors:** `all_professor_cutbacks.xlsx`
- **Single Professor:** `cutbacks_[ProfessorName].xlsx`
- **Detailed Professor:** `[ProfessorName]_detailed_cutbacks.xlsx`
- **Department Share:** `ccs_cutback_reports.xlsx`

### Custom Naming:
When exporting, you can enter a custom filename in the dialog box. The `.xlsx` extension is added automatically.

---

## 🎯 Export Scope Comparison

| Export Type | Professors | Classes | Students | Computations | Best For |
|-------------|-----------|---------|----------|--------------|----------|
| All Professors Summary | All | All | Counts only | Basic | Admin overview |
| Single Professor Summary | One | All | Counts only | Basic | Quick review |
| Single Professor Detailed | One | All | **Full list** | **Complete** | Payment processing |
| Department Share | N/A | All modules | Counts only | Department | Financial reports |

---

## 💡 Tips for Using Exports

### 1. **Choose the Right Export Type**
- Use **Summary** for quick overviews and totals
- Use **Detailed** when you need student-level information
- Use **All Professors** for comprehensive reports

### 2. **Verify Data Before Exporting**
- Check that payment deadline is set correctly
- Ensure cutback rate is up to date
- Verify all payments are recorded

### 3. **Excel Tips**
- Use filters on summary sheets to sort/filter data
- Freeze top row for easier scrolling
- Use Excel's sum functions to verify totals
- Print individual sheets for distribution

### 4. **File Management**
- Include date in filename: `cutbacks_2026-05-25.xlsx`
- Store exports in organized folders by semester
- Keep backup copies of important reports

---

## 📊 Understanding the Computations

### Professor Cutback Calculations

**Basic Formula:**
```
Cutback = Number of Paid Students × Rate per Student
```

**Example:**
- Rate per Student: PHP 50.00
- Class has 30 students enrolled
- 25 students have paid
- Cutback = 25 × 50.00 = PHP 1,250.00

**Detailed Breakdown:**
```
Total Expected Earnings = Total Students × Rate
                       = 30 × 50.00 = PHP 1,500.00

Amount Already Claimed = Paid Students × Rate
                       = 25 × 50.00 = PHP 1,250.00

Remaining Claimable = Expected - Claimed
                    = 1,500.00 - 1,250.00 = PHP 250.00
```

### Department Share Calculations

**Basic Formula:**
```
Department Share = Number of Paid Students × Share per Student
```

**Example:**
- Share per Student: PHP 100.00
- Module has 40 students enrolled
- 35 students have paid
- Department Share = 35 × 100.00 = PHP 3,500.00

---

## 🔍 Troubleshooting

### Export Not Working?
1. Check browser popup blocker settings
2. Ensure sufficient disk space
3. Close any open Excel files with same name
4. Try a different browser

### Missing Data in Export?
1. Verify data is visible in the UI first
2. Refresh the page and try again
3. Check that filters are not hiding data
4. Ensure all students are properly enrolled

### Incorrect Calculations?
1. Verify cutback rate setting
2. Check payment deadline configuration
3. Ensure payment records are complete
4. Verify student enrollment data

---

## 📞 Need Help?

If you encounter issues with exports:
1. Check this guide first
2. Verify your data in the UI
3. Try refreshing and re-exporting
4. Contact system administrator if problem persists

---

**Last Updated:** May 25, 2026
**Version:** 2.0
