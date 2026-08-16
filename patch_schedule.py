import re

with open('src/components/views/AdminScheduleView.tsx', 'r') as f:
    content = f.read()

global_listener = """
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [schedule, selectedRep, saving]);

  const handleSave = async () => {"""

content = content.replace("  const handleSave = async () => {", global_listener)

with open('src/components/views/AdminScheduleView.tsx', 'w') as f:
    f.write(content)
