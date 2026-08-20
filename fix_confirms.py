import os
import re

view_dir = 'src/components/views'

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find functions named handleDelete, handleDeleteSale, handleDeleteOrder, handleDeleteDeal, etc.
    # Pattern to match: const handleDeleteXYZ = async (param: type) => {
    # If the next line is NOT if (window.confirm(..., we insert it.
    
    # We can match: const handleDelete\w*\s*=\s*(async\s*)?\([^)]*\)\s*=>\s*\{
    def replacer(match):
        full_match = match.group(0)
        # Check if already has confirm
        idx = content.find(full_match)
        block = content[idx:idx+200]
        if 'window.confirm' in block:
            return full_match
        
        # Determine if there is a try block right after or what.
        # Just insert the confirm right after the `{`
        return full_match + "\n    if (!window.confirm('دڵنیایت لە سڕینەوە؟')) return;\n"

    new_content = re.sub(r'const handleDelete\w*\s*=\s*(async\s*)?\([^)]*\)\s*=>\s*\{', replacer, content)

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for filename in os.listdir(view_dir):
    if filename.endswith('.tsx'):
        process_file(os.path.join(view_dir, filename))

print("done")
