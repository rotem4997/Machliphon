import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';

interface Kindergarten {
  id: string;
  name: string;
  neighborhood?: string;
}

interface Props {
  kindergartens: Kindergarten[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function KindergartenCombobox({
  kindergartens,
  value,
  onChange,
  placeholder = 'חיפוש גן ילדים...',
  required = false,
  disabled = false,
}: Props) {
  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Resolve the display name for the currently selected id
  const selectedKg = kindergartens.find(k => k.id === value) ?? null;

  // When a value is selected from outside, sync the input text
  useEffect(() => {
    if (!isOpen) {
      setInputText(selectedKg ? selectedKg.name : '');
    }
  }, [value, isOpen, selectedKg]);

  // Close on outside mousedown
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const filteredKgs = kindergartens.filter(k => {
    if (!inputText) return true;
    const q = inputText.toLowerCase();
    return (
      k.name.toLowerCase().includes(q) ||
      (k.neighborhood ? k.neighborhood.toLowerCase().includes(q) : false)
    );
  });

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    // Restore display text to the selected item's name (or empty)
    setInputText(selectedKg ? selectedKg.name : '');
  }, [selectedKg]);

  const openDropdown = () => {
    if (disabled) return;
    setIsOpen(true);
    setHighlightedIndex(-1);
    // Clear the text so the user can type a fresh search
    setInputText('');
  };

  const selectItem = (kg: Kindergarten) => {
    onChange(kg.id);
    setInputText(kg.name);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setInputText('');
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredKgs.length - 1 ? prev + 1 : prev,
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredKgs[highlightedIndex]) {
          selectItem(filteredKgs[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  return (
    <div ref={containerRef} className="relative">
      {/* Input row */}
      <div className="relative">
        <Search
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          autoComplete="off"
          required={required}
          disabled={disabled}
          value={inputText}
          placeholder={placeholder}
          onFocus={openDropdown}
          onChange={e => {
            setInputText(e.target.value);
            setHighlightedIndex(-1);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="input pr-9 pl-8 text-right"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={clearSelection}
            aria-label="נקה בחירה"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute right-0 left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto"
        >
          {filteredKgs.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-400 text-right">אין תוצאות</li>
          ) : (
            filteredKgs.slice(0, 8).map((kg, idx) => (
              <li
                key={kg.id}
                role="option"
                aria-selected={kg.id === value}
                onMouseDown={e => {
                  e.preventDefault(); // prevent input blur before click registers
                  selectItem(kg);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`px-4 py-2.5 cursor-pointer text-right text-sm transition-colors ${
                  idx === highlightedIndex
                    ? 'bg-mint-50 text-navy-900'
                    : kg.id === value
                    ? 'bg-slate-50 text-navy-900'
                    : 'text-navy-900 hover:bg-slate-50'
                }`}
              >
                <span className="font-medium">{kg.name}</span>
                {kg.neighborhood && (
                  <span className="text-slate-400 text-xs mr-2">{kg.neighborhood}</span>
                )}
              </li>
            ))
          )}
          {filteredKgs.length > 8 && (
            <li className="px-4 py-2 text-xs text-slate-400 text-center border-t border-slate-100">
              {filteredKgs.length - 8} תוצאות נוספות — הקלד לסינון
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
