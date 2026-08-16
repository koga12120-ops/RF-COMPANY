import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Company, Item } from '../../types';
import { Building2, Plus, Edit2, Trash2, History, X } from 'lucide-react';
import { format } from 'date-fns';

export default function CompaniesView() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyItems, setCompanyItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!selectedCompany) return;
    const qItems = query(collection(db, 'items'));
    const unsub = onSnapshot(qItems, (snapshot) => {
      const data: Item[] = [];
      snapshot.forEach((doc) => {
        const item = { id: doc.id, ...doc.data() } as Item;
        if (item.supplier === selectedCompany.name) {
          data.push(item);
        }
      });
      // Sort by createdAt descending
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setCompanyItems(data);
    });
    return () => unsub();
  }, [selectedCompany]);

  useEffect(() => {
    const q = query(collection(db, 'companies'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data: Company[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Company);
      });
      setCompanies(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (isEditing && editingId) {
      await updateDoc(doc(db, 'companies', editingId), {
        name,
        location,
        phone,
      });
      setIsEditing(false);
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'companies'), {
        name,
        location,
        phone,
        createdAt: Date.now()
      });
    }
    setName('');
    setLocation('');
    setPhone('');
  };

  const handleEdit = (company: Company) => {
    setName(company.name);
    setLocation(company.location);
    setPhone(company.phone);
    setIsEditing(true);
    setEditingId(company.id);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'companies', id));
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setName('');
    setLocation('');
    setPhone('');
    setIsEditing(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-6" onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e); }}>
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold mb-4 text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
          {isEditing ? 'دەستکاریکردنی کۆمپانیا' : 'زیادکردنی کۆمپانیای نوێ'}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm text-slate-600 mb-1">ناوی کۆمپانیا / شوێن</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">ناونیشان / گەڕەک</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">ژمارەی تەلەفۆن</label>
            <input
              type="tel"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="flex gap-2">
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
          </div>
        </form>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h4 className="font-bold text-slate-700 flex items-center gap-2"><Building2 size={20} /> لیستی کۆمپانیاکان</h4>
        </div>
        {loading ? (
          <div className="text-center py-10 text-slate-500">خەریکی هێنانە...</div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">ناوی کۆمپانیا</th>
                  <th className="px-4 py-3 font-semibold">ناونیشان</th>
                  <th className="px-4 py-3 font-semibold">تەلەفۆن</th>
                  <th className="px-4 py-3 font-semibold">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {companies.map(company => (
                  <tr key={company.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-4 font-medium text-slate-900">{company.name}</td>
                    <td className="px-4 py-4 text-slate-600">{company.location}</td>
                    <td className="px-4 py-4 text-slate-500 font-mono text-xs" dir="ltr">{company.phone || '-'}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedCompany(company)}
                          className="text-blue-600 font-bold px-2 py-1 hover:bg-blue-50 rounded transition flex items-center gap-1"
                        >
                          <History size={16} /> مێژوو
                        </button>
                        <button
                          onClick={() => handleEdit(company)}
                          className="text-indigo-600 font-bold px-2 py-1 hover:bg-indigo-50 rounded transition flex items-center gap-1"
                        >
                          <Edit2 size={16} /> دەستکاری
                        </button>
                        <button
                          onClick={() => handleDelete(company.id)}
                          className="text-red-600 font-bold px-2 py-1 hover:bg-red-50 rounded transition flex items-center gap-1"
                        >
                          <Trash2 size={16} /> سڕینەوە
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-500">
                      هیچ کۆمپانیایەک نەدۆزرایەوە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedCompany && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <History size={20} className="text-indigo-600" /> مێژووی کاڵاکانی کۆمپانیای {selectedCompany.name}
              </h3>
              <button 
                onClick={() => setSelectedCompany(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition text-slate-500"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto bg-slate-50/50 flex-1">
              {companyItems.length === 0 ? (
                <div className="text-center py-10 text-slate-500">هیچ کاڵایەک نەدۆزرایەوە بۆ ئەم کۆمپانیایە</div>
              ) : (
                <div className="space-y-4">
                  {companyItems.map(item => (
                    <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                      <div>
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          بەروار: {item.createdAt ? format(item.createdAt, 'yyyy/MM/dd') : 'نەزانراو'}
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-indigo-600" dir="ltr">{item.sellingPrice.toLocaleString()} دینار</div>
                        <div className="text-xs text-slate-500 mt-1">
                          بڕ: <span dir="ltr">{item.quantity}</span> | تێچوو: <span dir="ltr">{item.costPrice.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
