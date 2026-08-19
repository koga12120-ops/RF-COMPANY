import re

print_func = """
  const printTransaction = (transaction: Transaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const isCompany = transaction.type.includes('company');
    const roleTitle = isCompany ? 'کۆمپانیا' : 'مارکێت';
    
    let typeLabel = '';
    if (transaction.type.includes('debt')) typeLabel = 'قەرز';
    if (transaction.type.includes('paid')) typeLabel = 'واسڵکراو';
    if (transaction.type === 'cash' || transaction.type === 'company_cash') typeLabel = 'نەقد';

    const html = `
      <html dir="rtl">
        <head>
          <title>پسوڵەی پارە - ${transaction.relatedEntityId}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .subtitle { color: #666; font-size: 14px; }
            .details { margin-bottom: 30px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 5px 0; border-bottom: 1px dashed #eee; }
            .label { font-weight: bold; }
            .amount { font-size: 20px; font-weight: bold; text-align: center; margin: 30px 0; padding: 15px; border: 2px solid #333; border-radius: 8px; }
            .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #888; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">کۆمپانیای RF</div>
            <div class="subtitle">پسوڵەی وەرگرتن / پێدان</div>
          </div>
          
          <div class="details">
            <div class="row">
              <span class="label">جۆری مامەڵە:</span>
              <span>${typeLabel}</span>
            </div>
            <div class="row">
              <span class="label">ناوی ${roleTitle}:</span>
              <span>${transaction.relatedEntityId}</span>
            </div>
            <div class="row">
              <span class="label">بەروار:</span>
              <span dir="ltr">${format(transaction.date, 'yyyy-MM-dd HH:mm')}</span>
            </div>
            <div class="row">
              <span class="label">وردەکاری:</span>
              <span>${transaction.description || 'بێ وردەکاری'}</span>
            </div>
          </div>
          
          <div class="amount" dir="ltr">
            ${(transaction.amount || 0).toLocaleString()} د.ع
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-top: 50px;">
            <div style="text-align: center;">
              <div>واژووی پێدەر</div>
              <div style="margin-top: 30px; border-top: 1px solid #333; width: 150px;"></div>
            </div>
            <div style="text-align: center;">
              <div>واژووی وەرگر</div>
              <div style="margin-top: 30px; border-top: 1px solid #333; width: 150px;"></div>
            </div>
          </div>
          
          <div class="footer">
            کات و بەرواری چاپ: <span dir="ltr">${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</span>
          </div>
          <script>
            window.onload = () => window.print();
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };
"""

def add_print(file_path, list_name):
    with open(file_path, 'r') as f:
        content = f.read()

    # Add Printer to lucide-react if missing
    if 'Printer' not in content:
        content = re.sub(r'import { (.*?) } from \'lucide-react\';', r'import { \1, Printer } from \'lucide-react\';', content)

    # Insert print function before return
    if 'const printTransaction' not in content:
        content = re.sub(r'  return \(', print_func + '  return (', content)

    # Add Print button to rows
    # DebtsView uses: <button onClick={() => handleDelete(debt.id)} ... > <Trash2 /> </button>
    button_html = f"""<button
                          onClick={{() => printTransaction({list_name[:-1] if list_name.endswith('s') and list_name != 'cash' else list_name})}}
                          className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                          title="چاپکردن"
                        >
                          <Printer size={{16}} />
                        </button>
                        <button"""
    
    if list_name == 'debts':
        content = content.replace("<button\n                          onClick={() => handleDelete(debt.id)}", button_html.replace(list_name, "debt").replace("{debt.id}", "debt"))
    elif list_name == 'cash':
        # wait, cash uses item name 'c'
        content = content.replace("<button\n                          onClick={() => handleDelete(c.id)}", button_html.replace(list_name, "c").replace("{c.id}", "c"))

    with open(file_path, 'w') as f:
        f.write(content)

add_print('src/components/views/DebtsView.tsx', 'debts')
add_print('src/components/views/PaidDebtsView.tsx', 'debts')
add_print('src/components/views/CashView.tsx', 'cash')
print("Print added")
