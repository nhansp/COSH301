import React from 'react';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme, type ThemePreference } from '../context/ThemeContext';

const OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
  { value: 'light', label: 'Sáng', icon: Sun },
  { value: 'dark', label: 'Tối', icon: Moon },
  { value: 'system', label: 'Theo hệ thống', icon: Monitor },
];

export const ThemeToggle: React.FC = () => {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Giao diện"
      className="flex items-center gap-0.5 rounded-full bg-kumo-recessed p-1"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={`grid size-11 place-items-center rounded-full transition-colors md:size-8 ${
              active
                ? 'bg-kumo-base text-kumo-strong shadow-xs'
                : 'text-kumo-subtle hover:text-kumo-default'
            }`}
          >
            <Icon className="size-4 md:size-3.5" strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
};
