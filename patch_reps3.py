import re

with open('src/components/views/RepsView.tsx', 'r') as f:
    content = f.read()

old_buttons = """            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2 text-sm h-10"
              >
                <Edit2 size={18} />
                <span>پاشەکەوتکردن</span>
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 bg-slate-100 text-slate-600 font-medium rounded-lg hover:bg-slate-200 transition text-sm h-10"
              >
                پاشگەزبوونەوە
              </button>
            </div>"""

new_buttons = """            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2 text-sm h-10"
              >
                {isEditing ? <Edit2 size={18} /> : <Plus size={18} />}
                <span>{isEditing ? 'پاشەکەوتکردن' : 'زیادکردن'}</span>
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-slate-100 text-slate-600 font-medium rounded-lg hover:bg-slate-200 transition text-sm h-10"
                >
                  پاشگەزبوونەوە
                </button>
              )}
            </div>"""

content = content.replace(old_buttons, new_buttons)

with open('src/components/views/RepsView.tsx', 'w') as f:
    f.write(content)
