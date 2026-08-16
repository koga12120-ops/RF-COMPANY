with open('src/components/views/RepsView.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.strip() == "</section>":
        if "flex gap-2 bg-white" not in "".join(new_lines[-20:]): # Avoid changing the first section end
            new_lines.append("        )}\n")
    new_lines.append(line)

with open('src/components/views/RepsView.tsx', 'w') as f:
    f.writelines(new_lines)
