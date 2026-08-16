import re

with open('src/components/views/RepsView.tsx', 'r') as f:
    content = f.read()

old_end = """                  </tr>
                        </tbody>"""

new_end = """                  </tr>
                )}
              </tbody>"""

content = content.replace(old_end, new_end)

with open('src/components/views/RepsView.tsx', 'w') as f:
    f.write(content)
