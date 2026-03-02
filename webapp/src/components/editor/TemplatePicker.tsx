import { useState } from 'react';
import { TEMPLATE_CATEGORIES } from './templateCategories';

export function TemplatePicker({ onInsert }: { onInsert: (expression: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const lowerSearch = search.toLowerCase();
  const filtered = TEMPLATE_CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        item.label.toLowerCase().includes(lowerSearch) ||
        item.description.toLowerCase().includes(lowerSearch) ||
        item.expression.toLowerCase().includes(lowerSearch)
    ),
  })).filter((cat) => cat.items.length > 0);

  const handleSelect = (expression: string) => {
    onInsert(expression);
    setOpen(false);
    setSearch('');
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-brand-500 hover:text-brand-700 flex items-center gap-1"
        title="Insert template expression"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
        </svg>
        Insert Template
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(false); setSearch(''); }}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        Close
      </button>
      <div className="absolute right-0 top-6 z-50 w-[520px] bg-white border border-gray-200 rounded-lg shadow-xl max-h-[420px] flex flex-col">
        {/* Search */}
        <div className="p-2 border-b border-gray-100">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates... (e.g. email, name, uuid)"
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-400"
            autoFocus
          />
        </div>
        <div className="flex flex-1 min-h-0">
          {/* Category sidebar */}
          <div className="w-28 border-r border-gray-100 overflow-y-auto py-1 shrink-0">
            {filtered.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
                className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                  activeCategory === cat.name
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="inline-block w-6 font-mono text-[10px] text-gray-400">{cat.icon}</span>
                {cat.name}
              </button>
            ))}
          </div>
          {/* Items */}
          <div className="flex-1 overflow-y-auto py-1">
            {(activeCategory ? filtered.filter((c) => c.name === activeCategory) : filtered).map((cat) => (
              <div key={cat.name}>
                {!activeCategory && (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {cat.name}
                  </div>
                )}
                {cat.items.map((item) => (
                  <button
                    key={item.expression}
                    onClick={() => handleSelect(item.expression)}
                    className="w-full text-left px-3 py-1.5 hover:bg-brand-50 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-800">{item.label}</span>
                      <span className="text-[10px] text-gray-400 group-hover:text-brand-500">{item.description}</span>
                    </div>
                    <code className="text-[11px] text-brand-600 font-mono">{item.expression}</code>
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-gray-400">
                No matching templates found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
