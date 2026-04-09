import { doc, runTransaction, collection, addDoc } from 'firebase/firestore';

// Generates a receipt number with format MMYY-0000 using a Firestore transaction
export async function generateReceiptNumber(db, date = new Date()) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const key = `${mm}${yy}`; // MMYY
  const counterRef = doc(db, 'receiptCounters', key);

  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const last = snap.exists() && snap.data().last ? snap.data().last : 0;
    const nextVal = last + 1;
    tx.set(counterRef, { last: nextVal }, { merge: true });
    return nextVal;
  });

  return `${key}-${String(next).padStart(4, '0')}`;
}

export async function createReceiptRecord(db, receiptData) {
  const receiptsCol = collection(db, 'receipts');
  const docRef = await addDoc(receiptsCol, receiptData);
  return docRef.id;
}
