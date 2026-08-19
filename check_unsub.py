import os
import re

for root, _, files in os.walk('src/components'):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r') as file:
                content = file.read()
                
                # Find all variable names assigned from onSnapshot
                matches = re.findall(r'(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*onSnapshot\(', content)
                
                # Check if each is called in a cleanup function
                for match in matches:
                    if not re.search(r'\b' + match + r'\(\)', content) and not re.search(r'if \(' + match + r'\) ' + match + r'\(\)', content):
                        print(f"File {filepath} misses calling {match}()")
