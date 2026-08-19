import re

for view in ['DebtsView', 'PaidDebtsView', 'CashView']:
    with open(f'src/components/views/{view}.tsx', 'r') as f:
        content = f.read()

    # We need to extract printTransaction and move it outside of useEffect.
    # It was inserted at `return ()`. Let's find it.
    
    match = re.search(r'(  const printTransaction = \(transaction: Transaction\) => \{.*?\n  \};\n)', content, re.DOTALL)
    if match:
        func_content = match.group(1)
        # Remove from current position
        content = content.replace(func_content, '')
        # Insert before the actual JSX return
        # The JSX return usually looks like `  return (\n    <div`
        content = re.sub(r'(  return \(\n\s*<div)', func_content + r'\1', content)
        
        # In CashView, let's fix the iterator if it's different.
        # Wait, the state is called `transactions` maybe? Let's check CashView's state.
        
        with open(f'src/components/views/{view}.tsx', 'w') as f:
            f.write(content)

print("done")
