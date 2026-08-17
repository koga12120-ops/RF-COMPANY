import re

for filename in ['src/components/views/CashView.tsx', 'src/components/views/DebtsView.tsx']:
    with open(filename, 'r') as f:
        content = f.read()

    content = content.replace("    ;\n  , [type]);", "    };\n  }, [type]);")
    content = content.replace("    ;\n  , [type]);", "    };\n  }, [type]);")
    
    with open(filename, 'w') as f:
        f.write(content)
