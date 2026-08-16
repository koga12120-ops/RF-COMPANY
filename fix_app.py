import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

content = content.replace("await setDoc(doc(db, 'users', user.uid), {", "await setDoc(doc(db, 'users', user.uid), {")

# add merge: true to the role sets
pattern_reps = r"await setDoc\(doc\(db, 'reps', user.uid\), \{\s*name: user.displayName \|\| user.email,\s*phone: '',\s*totalSales: 0,\s*totalProfit: 0,\s*uid: user.uid\s*\}\);"
replacement_reps = "await setDoc(doc(db, 'reps', user.uid), { name: user.displayName || user.email, phone: '', totalSales: 0, totalProfit: 0, uid: user.uid }, { merge: true });"

pattern_cashvans = r"await setDoc\(doc\(db, 'cashvans', user.uid\), \{\s*name: user.displayName \|\| user.email,\s*phone: '',\s*totalSales: 0,\s*totalProfit: 0,\s*uid: user.uid\s*\}\);"
replacement_cashvans = "await setDoc(doc(db, 'cashvans', user.uid), { name: user.displayName || user.email, phone: '', totalSales: 0, totalProfit: 0, uid: user.uid }, { merge: true });"

content = re.sub(pattern_reps, replacement_reps, content)
content = re.sub(pattern_cashvans, replacement_cashvans, content)

# same for users collection
pattern_users = r"await setDoc\(doc\(db, 'users', user.uid\), \{\s*role: newRole,\s*name: user.displayName \|\| user.email,\s*email: user.email,\s*createdAt: Date.now\(\)\s*\}\);"
replacement_users = "await setDoc(doc(db, 'users', user.uid), { role: newRole, name: user.displayName || user.email, email: user.email, createdAt: Date.now() }, { merge: true });"
content = re.sub(pattern_users, replacement_users, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)

