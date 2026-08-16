import re

with open('src/components/views/InventoryView.tsx', 'r') as f:
    content = f.read()

# Change useState('') to useState('1') for ratio
content = content.replace("const [ratio, setRatio] = useState('');", "const [ratio, setRatio] = useState('1');")

# Remove the ratio input field
pattern = re.compile(r"<div>\s*<label className=\"block text-sm text-gray-600 mb-1\">نسبە \(\%\)</label>\s*<input\s*type=\"number\"\s*required\s*min=\"0\"\s*className=\"w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none\"\s*value=\{ratio\}\s*onChange=\{\(e\) => setRatio\(e.target.value\)\}\s*dir=\"ltr\"\s*/>\s*</div>", re.MULTILINE)
content = pattern.sub("", content)

# Let's also remove ratio from the table view if the user doesn't want it, or just leave it.
# User just said "نسبە لە کاتی داخڵکردن لابدە" -> "remove ratio during entry". So I only removed the input.

with open('src/components/views/InventoryView.tsx', 'w') as f:
    f.write(content)

