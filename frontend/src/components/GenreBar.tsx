import React from 'react';
import { Music, Radio, Disc, Mic2, Headphones, Activity } from 'lucide-react';
import { useEvents } from '../context/EventContext';

interface GenreOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  matchKeyword?: string;
}

const GENRE_LIST: GenreOption[] = [
  { id: 'all', label: 'Tất cả thể loại', icon: Activity },
  { id: 'vpop', label: 'V-pop & Band', icon: Mic2, matchKeyword: 'V-pop' },
  { id: 'kpop', label: 'K-pop Tour', icon: Disc, matchKeyword: 'K-pop' },
  { id: 'rock', label: 'Rock & Indie', icon: Radio, matchKeyword: 'Rock' },
  { id: 'edm', label: 'EDM & Electronic', icon: Headphones, matchKeyword: 'Electronic' },
  { id: 'symphony', label: 'Giao hưởng', icon: Music, matchKeyword: 'Classical' },
];

export const GenreBar: React.FC = () => {
  const { filterState, toggleGenre, clearGenres } = useEvents();

  const handleSelectGenre = (option: GenreOption) => {
    if (option.id === 'all' || !option.matchKeyword) {
      clearGenres();
    } else {
      toggleGenre(option.matchKeyword);
    }
  };

  const isAllActive = filterState.selectedGenres.length === 0;

  return (
    <div className="w-full mb-6">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {GENRE_LIST.map(option => {
          const Icon = option.icon;
          const isActive =
            option.id === 'all'
              ? isAllActive
              : option.matchKeyword
              ? filterState.selectedGenres.includes(option.matchKeyword)
              : false;

          return (
            <button
              key={option.id}
              onClick={() => handleSelectGenre(option)}
              className={`h-9 px-3.5 rounded-full text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all flex-shrink-0 ${
                isActive
                  ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950 shadow-sm shadow-emerald-600/30 font-semibold'
                  : 'bg-kumo-base ring-1 ring-emerald-500/20 text-kumo-default hover:bg-emerald-500/10 hover:ring-emerald-500/40 hover:text-emerald-700 dark:hover:text-emerald-300'
              }`}
            >
              <Icon className="size-3.5" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
