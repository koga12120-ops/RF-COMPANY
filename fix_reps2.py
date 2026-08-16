import re

with open('src/components/views/RepsView.tsx', 'r') as f:
    content = f.read()

content = content.replace("        )}\n        </section>", "        </section>")

with open('src/components/views/RepsView.tsx', 'w') as f:
    f.write(content)
