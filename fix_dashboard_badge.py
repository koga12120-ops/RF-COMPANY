import re

with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

# Add imports for firestore
content = content.replace(
    "import { Building2 } from 'lucide-react';",
    "import { Building2 } from 'lucide-react';\nimport { collection, onSnapshot, query, where } from 'firebase/firestore';\nimport { db } from '../lib/firebase';"
)

content = content.replace(
    "import React, { useState } from 'react';",
    "import React, { useState, useEffect, useRef } from 'react';"
)

# Add state and effect in Dashboard component
hooks = """
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (role !== 'admin' && role !== 'warehouse') return;
    const q = query(collection(db, 'orders'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const count = snapshot.size;
      setPendingOrdersCount(count);
      
      if (count > prevCountRef.current) {
        // Play notification sound
        try {
          const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
          audio.play().catch(e => console.log('Audio play prevented by browser'));
        } catch(e) {}
      }
      prevCountRef.current = count;
    });
    return () => unsubscribe();
  }, [role]);
"""

content = content.replace(
    "const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);",
    "const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);" + hooks
)

# Render badge
menu_render = """
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`
                    w-full flex items-center justify-between p-3 rounded-lg transition-colors
                    ${isActive ? 'bg-slate-50 text-indigo-600 font-medium border border-slate-100' : 'text-slate-600 hover:bg-slate-50'}
                  `}
                >
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <Icon size={20} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </div>
                  {item.id === 'orders' && pendingOrdersCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {pendingOrdersCount}
                    </span>
                  )}
                </button>
"""

content = re.sub(
    r"<button\s+key=\{item\.id\}[\s\S]*?</button>",
    menu_render,
    content,
    count=1
)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(content)
