import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`collapsible${open ? ' collapsible--open' : ''}`}>
      <button type="button" className="collapsible__trigger" onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <ChevronDown size={15} className="collapsible__icon" />
      </button>
      {open && <div className="collapsible__body">{children}</div>}
    </div>
  );
}
