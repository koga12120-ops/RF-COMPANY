import re

with open('src/components/views/RepsView.tsx', 'r') as f:
    content = f.read()

old_handle_submit = """  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !isEditing) return;

    try {
      await updateDoc(doc(db, activeTab === 'reps' ? 'reps' : 'cashvans', editId), { name, phone });
      resetForm();
    } catch (error) {
      console.error(error);
    }
  };"""

new_handle_submit = """  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;

    try {
      if (isEditing) {
        await updateDoc(doc(db, activeTab === 'reps' ? 'reps' : 'cashvans', editId), { name, phone });
      } else {
        await addDoc(collection(db, activeTab === 'reps' ? 'reps' : 'cashvans'), { 
          name, 
          phone,
          totalSales: 0,
          totalProfit: 0,
          createdAt: Date.now()
        });
      }
      resetForm();
    } catch (error) {
      console.error(error);
    }
  };"""

content = content.replace(old_handle_submit, new_handle_submit)

old_form_render = """      {isEditing && (
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold mb-4 text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            {activeTab === 'reps' ? 'دەستکاریکردنی مەندووب' : 'دەستکاریکردنی کاشڤان'}
          </h3>
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">"""

new_form_render = """      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold mb-4 text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
          {isEditing 
            ? (activeTab === 'reps' ? 'دەستکاریکردنی مەندووب' : 'دەستکاریکردنی کاشڤان') 
            : (activeTab === 'reps' ? 'زیادکردنی مەندووب' : 'زیادکردنی کاشڤان')}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">"""
content = content.replace(old_form_render, new_form_render)

old_form_end = """            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-bold"
            >
              پاشەکەوتکردن
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition font-bold"
            >
              پاشگەزبوونەوە
            </button>
          </form>
        </section>
      )}"""

new_form_end = """            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-bold"
            >
              {isEditing ? 'پاشەکەوتکردن' : 'زیادکردن'}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition font-bold"
              >
                پاشگەزبوونەوە
              </button>
            )}
          </form>
        </section>"""
content = content.replace(old_form_end, new_form_end)

with open('src/components/views/RepsView.tsx', 'w') as f:
    f.write(content)
