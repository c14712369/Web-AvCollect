'use client';

import React from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = '搜尋番號、標題或演員...',
  inputRef,
}) => {
  return (
    <div className="relative group w-full min-w-0 sm:max-w-md">
      <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-white/40 transition-colors group-focus-within:text-indigo-400" />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        aria-label="搜尋影片"
        className="
          h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4
          text-base text-white placeholder:text-white/40 sm:pr-14 sm:text-sm
          transition-[background-color,border-color,box-shadow] duration-200
          focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50
          focus:bg-white/10 hover:bg-white/10
        "
      />
      <div className="absolute right-4 inset-y-0 flex items-center pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity">
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-sans text-[10px] font-medium text-white/40">
          ESC
        </kbd>
      </div>
    </div>
  );
};

export default SearchInput;
