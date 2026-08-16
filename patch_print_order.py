import re

with open('src/components/views/OrdersView.tsx', 'r') as f:
    content = f.read()

old_func_start = "const printOrder = (order: Order) => {"
new_func_start = """const printOrder = async (order: Order) => {
    let oldDebt = 0;
    try {
      const q = query(collection(db, 'transactions'), where('type', '==', 'debt'), where('relatedEntityId', '==', order.marketName));
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        oldDebt += doc.data().amount || 0;
      });
    } catch (e) {
      console.error('Error fetching old debt', e);
    }"""

if old_func_start in content:
    content = content.replace(old_func_start, new_func_start)
    
old_html = """              <th style="padding: 8px; border: 1px solid #ccc;">کۆی گشتی</th>
            </tr>
          </thead>
          <tbody>"""
new_html = old_html  # We don't change this part

old_html_body = """            <tr style="background-color: #f8fafc; font-weight: bold;">
              <td colspan="7" style="padding: 10px; border: 1px solid #ccc; text-align: left;">کۆی گشتی وەسڵ:</td>
              <td style="padding: 10px; border: 1px solid #ccc;">${order.totalAmount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>"""

new_html_body = """            <tr style="background-color: #f8fafc; font-weight: bold;">
              <td colspan="7" style="padding: 10px; border: 1px solid #ccc; text-align: left;">کۆی گشتی وەسڵ:</td>
              <td style="padding: 10px; border: 1px solid #ccc;">${order.totalAmount.toLocaleString()}</td>
            </tr>
            <tr style="background-color: #f8fafc; font-weight: bold;">
              <td colspan="7" style="padding: 10px; border: 1px solid #ccc; text-align: left;">قەرزی پێشوو:</td>
              <td style="padding: 10px; border: 1px solid #ccc; color: red;">${oldDebt.toLocaleString()}</td>
            </tr>
            <tr style="background-color: #f1f5f9; font-weight: bold; font-size: 16px;">
              <td colspan="7" style="padding: 10px; border: 1px solid #ccc; text-align: left;">کۆی گشتی قەرز:</td>
              <td style="padding: 10px; border: 1px solid #ccc; color: #b91c1c;">${(oldDebt + order.totalAmount).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>"""

if old_html_body in content:
    content = content.replace(old_html_body, new_html_body)

with open('src/components/views/OrdersView.tsx', 'w') as f:
    f.write(content)

