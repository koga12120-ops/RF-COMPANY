import re

with open('src/components/views/RepScheduleView.tsx', 'r') as f:
    content = f.read()

# Replace init function to just use uid
init_func = """  useEffect(() => {
    const init = async () => {
      if (!auth.currentUser) return;
      setRepId(auth.currentUser.uid);
    };
    init();
  }, []);"""

content = re.sub(r'  useEffect\(\(\) => \{[\s\S]*?  \}, \[\]\);', init_func, content, count=1)

with open('src/components/views/RepScheduleView.tsx', 'w') as f:
    f.write(content)
