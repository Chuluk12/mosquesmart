import React, { useEffect, useRef, useState } from 'react';
import './calculation-method-select.css';

const METHODS = [
  { value: 'KEMENAG', label: 'Kemenag RI' },
  { value: 'MWL', label: 'Muslim World League' },
  { value: 'EGYPT', label: 'Egyptian General Authority' },
  { value: 'KARACHI', label: 'University of Karachi' },
  { value: 'UMM_AL_QURA', label: 'Umm al-Qura' },
  { value: 'ISNA', label: 'ISNA' },
];

export function CalculationMethodSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = METHODS.findIndex(method => method.value === value);
  const show = () => { setActive(Math.max(0, selected)); setOpen(true); };
  const choose = (index: number) => { onChange(METHODS[index].value); setOpen(false); trigger.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);
  useEffect(() => {
    if (open) root.current?.querySelector(`#method-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const handleKey = (event: React.KeyboardEvent) => {
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { show(); return; }
      setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? METHODS.length - 1 :
        (index + (event.key === 'ArrowDown' ? 1 : -1) + METHODS.length) % METHODS.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(active); else show();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const index = METHODS.findIndex(method => method.label.toLowerCase().startsWith(event.key.toLowerCase()));
      if (index >= 0) { event.preventDefault(); setActive(index); setOpen(true); }
    }
  };

  return <div className="method-select" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <label id="calculation-method-label" htmlFor="calculation-method">Metode Perhitungan</label>
    <button id="calculation-method" ref={trigger} type="button" className="method-select-trigger"
      role="combobox" aria-labelledby="calculation-method-label" aria-haspopup="listbox"
      aria-expanded={open} aria-controls={open ? 'calculation-method-options' : undefined}
      aria-activedescendant={open ? `method-option-${active}` : undefined}
      onKeyDown={handleKey} onClick={() => open ? setOpen(false) : show()}>
      <span>{METHODS[selected]?.label || value}</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={open ? 'is-open' : ''}>
        <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
    {open && <ul id="calculation-method-options" role="listbox" aria-labelledby="calculation-method-label" className="method-select-options">
      {METHODS.map((method, index) => <li key={method.value} id={`method-option-${index}`} role="option"
        aria-selected={method.value === value} className={index === active ? 'is-active' : ''}
        onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
        <span>{method.label}</span><span aria-hidden="true">{method.value === value ? '✓' : ''}</span>
      </li>)}
    </ul>}
  </div>;
}
