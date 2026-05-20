'use client';

import React from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({ 
  value, 
  onChange, 
  placeholder = "搜尋番號、標題或演員..." 
}) => {
  return (
    <div className="relative group w-full max-w-2xl">
      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-white/20 transition-colors group-focus-within:text-indigo-400" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4
          text-sm text-white placeholder:text-white/20
          backdrop-blur-xl transition-all duration-300
          focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50
          focus:bg-white/10 hover:bg-white/10
          shadow-lg shadow-black/20
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
