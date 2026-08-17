import re

for filename in ['src/components/views/CashView.tsx', 'src/components/views/DebtsView.tsx']:
    with open(filename, 'r') as f:
        content = f.read()

    content = content.replace("...doc.data()  as Transaction);", "...doc.data() } as Transaction);")
    content = content.replace("...doc.data() ));", "...doc.data() }));")
    content = content.replace("    );\n", "    });\n")
    content = content.replace("    );", "    });")

    with open(filename, 'w') as f:
        f.write(content)
