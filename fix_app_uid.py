import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "await addDoc(collection(db, 'reps'), {",
    "await setDoc(doc(db, 'reps', user.uid), {"
)

content = content.replace(
    "await addDoc(collection(db, 'cashvans'), {",
    "await setDoc(doc(db, 'cashvans', user.uid), {"
)

with open('src/App.tsx', 'w') as f:
    f.write(content)
