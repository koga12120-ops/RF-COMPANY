import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

# Add state for payment type
content = content.replace(
    "const [sortDate, setSortDate] = useState<'desc' | 'asc'>('desc');",
    "const [sortDate, setSortDate] = useState<'desc' | 'asc'>('desc');\n  const [paymentType, setPaymentType] = useState<'cash' | 'debt'>('cash');"
)

# Update resetForm
content = content.replace(
    "setSupplier('');",
    "setSupplier('');\n    setPaymentType('cash');"
)

# Update handleSubmit
add_transaction_logic = """
        if (newQuantity > 0) {
          await addDoc(collection(db, 'stock_history'), {
            itemId: docRef.id,
            itemName: name,
            quantityAdded: newQuantity,
            date: Date.now()
          });
          
          if (supplier) {
            await addDoc(collection(db, 'transactions'), {
              type: paymentType === 'cash' ? 'company_cash' : 'company_debt',
              amount: Number(costPrice) * newQuantity,
              date: Date.now(),
              description: paymentType === 'cash' ? `نەقدی کڕینی کاڵای ${name}` : `قەرزی کڕینی کاڵای ${name}`,
              relatedEntityId: supplier
            });
          }
        }
"""

content = re.sub(
    r"if \(newQuantity > 0\) \{[\s\S]*?date: Date\.now\(\)\s*\}\);\s*\}",
    add_transaction_logic,
    content
)

# Add payment type radio inputs to the form
payment_inputs = """
          <div className="flex gap-4 items-center mb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={paymentType === 'cash'} onChange={() => setPaymentType('cash')} className="text-indigo-600" />
              <span className="text-sm font-medium text-slate-700">نەقد</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={paymentType === 'debt'} onChange={() => setPaymentType('debt')} className="text-indigo-600" />
              <span className="text-sm font-medium text-slate-700">قەرز</span>
            </label>
          </div>
"""

content = content.replace(
    '<div className="lg:col-span-3 flex items-end gap-3 mt-2">',
    '<div className="lg:col-span-3 flex flex-col gap-3 mt-2">' + payment_inputs + '<div className="flex items-end gap-3">'
)
content = content.replace(
    '</button>\n            )}\n          </div>\n        </form>',
    '</button>\n            )}\n          </div>\n          </div>\n        </form>'
)


with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)
