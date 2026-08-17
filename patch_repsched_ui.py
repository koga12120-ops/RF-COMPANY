import re

with open('src/components/views/RepScheduleView.tsx', 'r') as f:
    content = f.read()

new_ui = """  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-6">
          <Calendar className="text-indigo-600" size={24} />
          <h2 className="text-lg font-bold text-slate-800">خشتەی سەردانەکانی هەفتە</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {WEEK_DAYS.map(day => {
            const dayMarkets = schedule[day] || [];
            const isToday = day === currentDayStr;
            
            return (
              <div key={day} className={`border rounded-xl overflow-hidden flex flex-col ${isToday ? 'border-indigo-300 ring-1 ring-indigo-300 shadow-md' : 'border-slate-200 shadow-sm'}`}>
                <div className={`${isToday ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-50 text-slate-700'} px-4 py-3 border-b ${isToday ? 'border-indigo-200' : 'border-slate-200'} font-bold flex justify-between items-center`}>
                  <span>{DAY_NAMES[day]} {isToday && '(ئەمڕۆ)'}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${isToday ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-200 text-slate-600'}`}>
                    {dayMarkets.length} سەردان
                  </span>
                </div>
                
                <div className={`p-4 flex-1 ${isToday ? 'bg-white' : 'bg-slate-50/50'}`}>
                  {dayMarkets.length === 0 ? (
                    <div className="text-center text-slate-400 text-sm py-4">هیچ سەردانێک نییە</div>
                  ) : (
                    <div className="space-y-3">
                      {dayMarkets.map(mId => {
                        const market = markets[mId];
                        const isVisited = visits[mId];
                        if (!market) return null;
                        
                        return (
                          <div key={mId} className={`p-3 rounded-lg border ${isVisited ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'} shadow-sm`}>
                            <div className="flex justify-between items-start mb-2">
                              <h3 className={`font-bold text-sm truncate pr-2 ${isVisited ? 'text-emerald-800 line-through' : 'text-slate-800'}`}>{market.name}</h3>
                              {isVisited && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
                            </div>
                            <div className="flex justify-between items-center mt-2">
                              <div className="text-xs text-slate-500 truncate max-w-[60%]">{market.location || '-'}</div>
                              {!isVisited && (
                                <button 
                                  onClick={() => handleVisit(mId)} 
                                  className="px-2.5 py-1.5 bg-indigo-50 text-indigo-600 rounded-md text-xs font-bold hover:bg-indigo-100 transition"
                                >
                                  سەردانم کرد
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}"""

content = re.sub(r'  return \(\n    <div className="space-y-6">[\s\S]*?  \);\n\}', new_ui, content)

with open('src/components/views/RepScheduleView.tsx', 'w') as f:
    f.write(content)
