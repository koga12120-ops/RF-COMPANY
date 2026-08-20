import re

with open('src/components/views/DebtsView.tsx', 'r') as f:
    content = f.read()

handle_pay_func = """
  const handlePay = async (debt: Transaction) => {
    const payAmount = window.prompt(`چەند لەم قەرزە دەدەیتەوە؟ (کۆی قەرز: ${debt.amount.toLocaleString()})`, debt.amount.toString());
    if (payAmount !== null && !isNaN(Number(payAmount)) && Number(payAmount) > 0) {
      try {
        await addDoc(collection(db, 'transactions'), {
          type: type === 'debt' ? 'paid_debt' : 'company_paid_debt',
          amount: Number(payAmount),
          date: Date.now(),
          description: `دانەوەی قەرزی: ${debt.description}`,
          relatedEntityId: debt.relatedEntityId || ''
        });
      } catch (error) {
        console.error(error);
        alert('هەڵەیەک ڕوویدا');
      }
    }
  };

  const handleDelete = async (id: string) => {"""

content = content.replace("  const handleDelete = async (id: string) => {", handle_pay_func)

button_html = """                        <button
                          onClick={() => handlePay(debt)}
                          className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition"
                          title="پاردانەوە"
                        >
                          <Check size={16} />
                        </button>
                        <button"""

content = content.replace("                        <button", button_html, 1) # Only replace the first occurrence of button in the loop maybe? Wait, need to be careful.

with open('src/components/views/DebtsView.tsx', 'w') as f:
    f.write(content)

print("done")
