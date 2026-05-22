import { Download, Upload } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection.jsx';
import { StatCard } from './StatCard.jsx';

export function BoardBottomPanels({
  activeNotes,
  archivedNotes,
  importInputId,
  text,
  topTag,
  onExport,
  onImport,
}) {
  return (
    <div className="bottom-panels">
      <CollapsibleSection title={text.statsTitle} defaultOpen={false}>
        <div className="stats-grid">
          <StatCard label={text.stats.activeLabel} value={activeNotes.length} hint={text.stats.activeHint} />
          <StatCard label={text.stats.archivedLabel} value={archivedNotes.length} hint={text.stats.archivedHint} />
          <StatCard label={text.stats.topVotesLabel} value={activeNotes.reduce((max, note) => Math.max(max, note.votes), 0)} hint={text.stats.topVotesHint} />
          <StatCard label={text.stats.topTagLabel} value={topTag} hint={text.stats.topTagHint} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={text.opsPanel.title} defaultOpen={false}>
        <div className="stack">
          <button className="button button--secondary" type="button" onClick={onExport}>
            <Download size={15} /> {text.opsPanel.export}
          </button>
          <label className="button button--ghost upload-button" htmlFor={importInputId}>
            <Upload size={15} /> {text.opsPanel.import}
          </label>
          <input id={importInputId} className="sr-only" type="file" accept="application/json" onChange={onImport} />
        </div>
      </CollapsibleSection>
    </div>
  );
}
