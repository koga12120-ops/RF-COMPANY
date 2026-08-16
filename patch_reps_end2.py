with open('src/components/views/RepsView.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.strip() == "</tbody>":
        new_lines.append("                )}\n")
    new_lines.append(line)

with open('src/components/views/RepsView.tsx', 'w') as f:
    f.writelines(new_lines)
