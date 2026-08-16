import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

# Make printReceipt async
old_func = "const printReceipt = (sale: any, invoiceId: string) => {"
new_func = """const printReceipt = async (sale: any, invoiceId: string, providedWindow?: Window | null) => {
    const printWindow = providedWindow || window.open('', '', 'width=300,height=600');
    if (!printWindow) return;
    
    let oldDebt = 0;
    try {
      const q = query(collection(db, 'transactions'), where('type', '==', 'debt'), where('relatedEntityId', '==', sale.marketName));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        oldDebt += doc.data().amount || 0;
      });
    } catch (e) {
      console.error('Error fetching old debt', e);
    }"""

content = content.replace(old_func, new_func)

# Remove the inner window open
old_window = """  const printReceipt = async (sale: any, invoiceId: string, providedWindow?: Window | null) => {
    const printWindow = providedWindow || window.open('', '', 'width=300,height=600');
    if (!printWindow) return;
    
    let oldDebt = 0;
    try {
      const q = query(collection(db, 'transactions'), where('type', '==', 'debt'), where('relatedEntityId', '==', sale.marketName));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        oldDebt += doc.data().amount || 0;
      });
    } catch (e) {
      console.error('Error fetching old debt', e);
    }
    const printWindow_old = window.open('', '', 'width=300,height=600');
    if (!printWindow_old) return;"""
    
# Wait, let's just do a string replace of the old window.open inside printReceipt
old_inner = """  const printReceipt = async (sale: any, invoiceId: string, providedWindow?: Window | null) => {
    const printWindow = providedWindow || window.open('', '', 'width=300,height=600');
    if (!printWindow) return;
    
    let oldDebt = 0;
    try {
      const q = query(collection(db, 'transactions'), where('type', '==', 'debt'), where('relatedEntityId', '==', sale.marketName));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        oldDebt += doc.data().amount || 0;
      });
    } catch (e) {
      console.error('Error fetching old debt', e);
    }
    const printWindow = window.open('', '', 'width=300,height=600');
    if (!printWindow) return;"""

new_inner = """  const printReceipt = async (sale: any, invoiceId: string, providedWindow?: Window | null) => {
    const printWindow = providedWindow || window.open('', '', 'width=300,height=600');
    if (!printWindow) return;
    
    let oldDebt = 0;
    try {
      const q = query(collection(db, 'transactions'), where('type', '==', 'debt'), where('relatedEntityId', '==', sale.marketName));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        oldDebt += doc.data().amount || 0;
      });
    } catch (e) {
      console.error('Error fetching old debt', e);
    }"""
    
# Wait, replacing using python is easier with regex
