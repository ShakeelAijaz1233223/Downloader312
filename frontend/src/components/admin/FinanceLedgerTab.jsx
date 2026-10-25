import React, { useMemo, useState } from 'react';
import { Download, PlusCircle, Trash2 } from 'lucide-react';
import { UltraApi } from '../../services/apiClient';

export function FinanceLedgerTab({ entries = [], onUpdateEntries, showToast }) {
  const [type, setType] = useState('income');
  const [category, setCategory] = useState('Direct Link Ad Payout');
  const [website, setWebsite] = useState('UltraDownloader Clean Hub');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const totals = useMemo(() => {
    const income = entries
      .filter((e) => (e.type || e.entry_type) === 'income')
      .reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const expense = entries
      .filter((e) => (e.type || e.entry_type) === 'expense')
      .reduce((acc, e) => acc + Number(e.amount || 0), 0);
    return { income, expense, net: income - expense };
  }, [entries]);

  const handleAddEntry = async (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) return;
    try {
      const updated = await UltraApi.addFinanceEntry({
        type,
        category,
        website,
        amount: num,
        notes,
      });
      await onUpdateEntries(updated);
      setAmount('');
      setNotes('');
      showToast('Transaction saved in SQL finance_ledger & Dashboard Profit updated.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save transaction.', 'error');
    }
  };

  const handleDeleteEntry = async (id) => {
    try {
      const updated = await UltraApi.deleteFinanceEntry(id);
      await onUpdateEntries(updated);
      showToast('Transaction deleted from SQL finance_ledger.', 'info');
    } catch (err) {
      showToast(err.message || 'Delete failed.', 'error');
    }
  };

  const handleExportCsv = () => {
    const header = 'ID,Date,Type,Category,Website,Amount,Status,Notes\n';
    const body = entries
      .map(
        (r) =>
          `"${r.id}","${r.date || r.entry_date}","${r.type || r.entry_type}","${r.category}","${r.website || r.website_label}",${r.amount},"${r.status}","${r.notes || ''}"`
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ultradownloader-sql-finance-ledger.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
          <p className="text-xs font-bold text-slate-400">Total SQL Income</p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-2">
            +${totals.income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
          <p className="text-xs font-bold text-slate-400">Total SQL Expenses</p>
          <p className="text-2xl font-extrabold text-rose-400 mt-2">
            -${totals.expense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5">
          <p className="text-xs font-bold text-slate-400">Net Cash Balance</p>
          <p className="text-2xl font-extrabold text-sky-400 mt-2">
            ${totals.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5 space-y-3">
        <h3 className="text-sm font-extrabold text-white">Record Real SQL Income / Expense Entry</h3>
        <form onSubmit={handleAddEntry} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-xl bg-[#080C15] border border-slate-800 px-3 py-2 text-xs text-white"
          >
            <option value="income">Income (+)</option>
            <option value="expense">Expense (-)</option>
          </select>
          <input
            type="text"
            required
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl bg-[#080C15] border border-slate-800 px-3 py-2 text-xs text-white"
          />
          <input
            type="text"
            required
            placeholder="Website / Domain"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="rounded-xl bg-[#080C15] border border-slate-800 px-3 py-2 text-xs text-white"
          />
          <input
            type="number"
            step="0.01"
            required
            placeholder="Amount ($)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-xl bg-[#080C15] border border-slate-800 px-3 py-2 text-xs text-white"
          />
          <input
            type="text"
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-xl bg-[#080C15] border border-slate-800 px-3 py-2 text-xs text-white"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-extrabold text-white"
          >
            <PlusCircle size={14} /> Save Entry
          </button>
        </form>
      </div>

      <div className="rounded-2xl bg-[#0D1320] border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-white">
            SQL Financial Ledger ({entries.length} Recorded Transactions)
          </h3>
          <button
            type="button"
            disabled={entries.length === 0}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-3 py-1.5 text-xs font-bold text-white"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-xs text-slate-400">
            0 dummy transactions in SQL. Record real payouts or server expenses above to track live net profit.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Website</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3">Notes</th>
                  <th className="py-2 pl-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {entries.map((row) => {
                  const rowType = row.type || row.entry_type;
                  return (
                    <tr key={row.id}>
                      <td className="py-2.5 pr-3 text-slate-300">{row.date || row.entry_date}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            rowType === 'income'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {String(rowType).toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">{row.category}</td>
                      <td className="py-2.5 px-3 text-slate-300">{row.website || row.website_label}</td>
                      <td
                        className={`py-2.5 px-3 font-extrabold ${
                          rowType === 'income' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {rowType === 'income' ? '+' : '-'}${Number(row.amount).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{row.notes || '—'}</td>
                      <td className="py-2.5 pl-3">
                        <button
                          type="button"
                          onClick={() => handleDeleteEntry(row.id)}
                          className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
