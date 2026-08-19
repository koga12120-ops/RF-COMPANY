import re

def fix_view(view_name, item_var):
    with open(f'src/components/views/{view_name}.tsx', 'r') as f:
        content = f.read()

    # Find the actions <td>
    # Usually it's `<td className="px-4 py-4">` or similar before the Trash button
    
    # We want to replace the content inside the <td> that contains the Trash2 or Printer buttons with our standard 3 buttons.
    # First, let's locate the row mapping.
    # {paidDebts.map(debt => (  or similar
    
    buttons_html = f"""<div className="flex items-center gap-2">
                        <button
                          onClick={{() => printTransaction({item_var})}}
                          className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                          title="چاپکردنی تەنها ئەمە"
                        >
                          <Printer size={{16}} />
                        </button>
                        <button
                          onClick={{() => printStatement({item_var}.relatedEntityId || {item_var}.description)}}
                          className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition"
                          title="کەشف حیساب"
                        >
                          <FileText size={{16}} />
                        </button>
                        <button
                          onClick={{() => handleDelete({item_var}.id)}}
                          className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                          title="سڕینەوە"
                        >
                          <Trash2 size={{16}} />
                        </button>
                      </div>"""
    
    # Let's replace the whole <td> content for actions.
    # For PaidDebtsView:
    if view_name == 'PaidDebtsView':
        content = re.sub(r'<td className="px-4 py-4">\s*<button\s*onClick=\{\(\) => handleDelete\(debt\.id\)\}.*?</button>\s*</td>', f'<td className="px-4 py-4">\n{buttons_html}\n</td>', content, flags=re.DOTALL)
    elif view_name == 'DebtsView':
        # DebtsView might use debt
        content = re.sub(r'<td className="px-4 py-4">\s*<div className="flex items-center gap-2">.*?</div>\s*</td>', f'<td className="px-4 py-4">\n{buttons_html}\n</td>', content, flags=re.DOTALL)
    elif view_name == 'CashView':
        content = re.sub(r'<td className="px-4 py-4 text-left">\s*<div className="flex items-center gap-2">.*?</div>\s*</td>', f'<td className="px-4 py-4 text-left">\n{buttons_html}\n</td>', content, flags=re.DOTALL)
        content = re.sub(r'<td className="px-4 py-4">\s*<div className="flex items-center gap-2">.*?</div>\s*</td>', f'<td className="px-4 py-4">\n{buttons_html}\n</td>', content, flags=re.DOTALL)
        # Handle cases where it might not be wrapped in div
        content = re.sub(r'<td className="px-4 py-4">\s*<button.*?<Trash2 size=\{16\}.*?</button>\s*</td>', f'<td className="px-4 py-4">\n{buttons_html}\n</td>', content, flags=re.DOTALL)

    with open(f'src/components/views/{view_name}.tsx', 'w') as f:
        f.write(content)

fix_view('PaidDebtsView', 'debt')
fix_view('DebtsView', 'debt')
fix_view('CashView', 'sale')

print("done")
