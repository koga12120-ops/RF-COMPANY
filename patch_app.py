import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

old_logout = """  const handleLogout = async () => {
    await signOut(auth);
    setRoleState(null);
    setUser(null);
  };"""

new_logout = """  const handleLogout = async () => {
    setRoleState(null);
    setUser(null);
    setIsAuthenticated(false);
    setTimeout(async () => {
      await signOut(auth);
    }, 10);
  };"""

content = content.replace(old_logout, new_logout)

with open('src/App.tsx', 'w') as f:
    f.write(content)

print("done")
