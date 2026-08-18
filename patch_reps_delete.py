import re

with open('src/components/views/RepsView.tsx', 'r') as f:
    content = f.read()

find_str = """                        {deletingId === rep.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(rep.id)} className="text-white bg-red-600 px-2 py-1 rounded text-xs font-bold">دڵنیام</button>
                            <button onClick={() => setDeletingId(null)} className="text-slate-600 bg-slate-100 px-2 py-1 rounded text-xs font-bold">پاشگەز</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(rep.id)}
                            className="text-red-600 font-bold px-2 py-1 hover:bg-red-50 rounded transition"
                          >
                            سڕینەوە
                          </button>
                        )}"""

replace_str = """                        <button
                          onClick={() => handleDelete(rep.id)}
                          className="text-red-600 font-bold px-2 py-1 hover:bg-red-50 rounded transition"
                        >
                          سڕینەوە
                        </button>"""

if find_str in content:
    content = content.replace(find_str, replace_str)
    with open('src/components/views/RepsView.tsx', 'w') as f:
        f.write(content)
    print("done")
else:
    print("Not found")

