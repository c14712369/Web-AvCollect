'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface FilterBarProps {
  label: string;
  options: string[];
  selected: string;
  onChange: (value: string) => void;
}

const translateOption = (opt: string) => {
  const map: Record<string, string> = {
    'ActressMatched': '追蹤女優',
    'Recommended': '為你推薦',
    'MaybeLike': '可能喜歡',
    'TagMatched': '追蹤標籤',
    'DailyHot': '日熱門',
    'WeeklyHot': '週熱門',
    'MonthlyHot': '月熱門',
    'HotOffTaste': '熱門(非口味)',
    'UncensoredHot': '無碼流出',
    'New': '最新',
    '使用者新增': '使用者新增',
    'User Added': '使用者新增'
  };
  return map[opt] || opt;
};

export const FilterBar: React.FC<FilterBarProps> = ({ label, options, selected, onChange }) => {
  return (
    <div className="flex flex-col space-y-3 w-full min-w-0">
      <div className="flex items-center space-x-2 px-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 shrink-0">
          {label}
        </span>
        <div className="h-[1px] flex-1 bg-white/5" />
      </div>
      
      <div className="flex w-full space-x-2 overflow-x-auto px-3 py-3 scroll-smooth">
        {options.map((option) => {
          const isActive = selected === option;
          return (
            <button
              key={option}
              onClick={() => onChange(option)}
              className="relative shrink-0 cursor-pointer"
            >
              <div
                className={`
                  relative z-10 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-300
                  ${isActive 
                    ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' 
                    : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10 hover:text-white/80'}
                `}
              >
                {translateOption(option)}
              </div>
              {isActive && (
                <motion.div
                  layoutId={`${label}-active`}
                  className="absolute inset-0 z-0 rounded-full bg-indigo-500 blur-sm opacity-50"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FilterBar;
