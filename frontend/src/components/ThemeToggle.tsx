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
      className="flex items-center gap-0.5 rounded-lg bg-kumo-recessed p-0.5 ring ring-kumo-line"
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
            className={`grid size-11 md:size-7 place-items-center rounded-md transition-colors ${
              active
                ? 'bg-kumo-base text-kumo-strong shadow-xs ring ring-kumo-line'
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
