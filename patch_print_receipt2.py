import re

with open('src/components/views/CashvanSalesView.tsx', 'r') as f:
    content = f.read()

# Make printReceipt async
old_func = """  const printReceipt = (sale: any, invoiceId: string) => {
    const printWindow = window.open('', '', 'width=300,height=600');
    if (!printWindow) return;"""

new_func = """  const printReceipt = async (sale: any, invoiceId: string, providedWindow?: Window | null) => {
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

old_submit = """  const submitSale = async () => {
    if (cart.length === 0 || !selectedMarket) return;
    
    try {"""
    
new_submit = """  const submitSale = async () => {
    if (cart.length === 0 || !selectedMarket) return;
    const printWin = window.open('', '', 'width=300,height=600');
    try {"""

content = content.replace(old_submit, new_submit)

old_print_call = """      printReceipt(saleData, docRef.id);"""
new_print_call = """      printReceipt(saleData, docRef.id, printWin);"""
content = content.replace(old_print_call, new_print_call)

# Now update the HTML to include the debt
old_html = """              <tr>
                <td colspan="3" style="text-align:left" class="bold">کۆی گشتی:</td>
                <td class="bold">${sale.totalAmount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          <div class="center" style="margin-top:20px;">سوپاس بۆ مامەڵەکردنتان لەگەڵمان</div>
        </body>
      </html>"""
      
new_html = """              <tr>
                <td colspan="3" style="text-align:left" class="bold">کۆی گشتی وەسڵ:</td>
                <td class="bold">${sale.totalAmount.toLocaleString()}</td>
              </tr>
              <tr>
                <td colspan="3" style="text-align:left" class="bold">قەرزی پێشوو:</td>
                <td class="bold" style="color: red;">${oldDebt.toLocaleString()}</td>
              </tr>
              <tr style="font-size: 14px; border-top: 1px solid #000;">
                <td colspan="3" style="text-align:left" class="bold">کۆی گشتی قەرز:</td>
                <td class="bold">${(oldDebt + sale.totalAmount).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          <div class="center" style="margin-top:20px;">سوپاس بۆ مامەڵەکردنتان لەگەڵمان</div>
        </body>
      </html>"""

content = content.replace(old_html, new_html)

with open('src/components/views/CashvanSalesView.tsx', 'w') as f:
    f.write(content)

