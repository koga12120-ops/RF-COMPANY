import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Add theme initialization to App.tsx
theme_logic = """export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [role, setRoleState] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Initialize theme
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-sepia');
    root.classList.add(`theme-${savedTheme}`);
  }, []);"""

content = content.replace("export default function App() {\n  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);\n  const [role, setRoleState] = useState<Role>(null);\n  const [loading, setLoading] = useState(true);\n  const [user, setUser] = useState<User | null>(null);", theme_logic)

with open('src/App.tsx', 'w') as f:
    f.write(content)
