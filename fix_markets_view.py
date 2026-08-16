import re

with open('src/components/views/MarketsView.tsx', 'r') as f:
    content = f.read()

bad_button = """                                    <button
                          onClick={() => setSelectedMarket(market)}
                          className="text-slate-600 font-bold px-2 py-1 hover:bg-slate-100 rounded transition flex items-center gap-1"
                        >
                          <History size={16} /> مێژوو
                        </button>
"""

content = content.replace(bad_button, "")

with open('src/components/views/MarketsView.tsx', 'w') as f:
    f.write(content)

