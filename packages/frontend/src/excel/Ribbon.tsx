// The ribbon: tabs, the File menu and the Home tab. Only AutoSum and Sort do anything.

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownAZ,
  ArrowDownZA,
  Baseline,
  Bold,
  ChartColumn,
  ClipboardPaste,
  Copy,
  Grid2x2,
  Italic,
  ListMinus,
  ListPlus,
  Merge,
  PaintBucket,
  Paintbrush,
  Palette,
  Percent,
  Scissors,
  Settings2,
  Sigma,
  Table,
  Underline,
  WrapText,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';

const PRO = 'Available in Excel in Fabric Pro';
// Ribbon buttons never take focus, so the keyboard stays on the sheet (as in Excel).
const keepFocus = (event: MouseEvent) => event.preventDefault();

const TABS = ['Home', 'Insert', 'Page Layout', 'Formulas', 'Data', 'Review', 'View'];

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="xl-ribbon-group" role="group" aria-label={label}>
      <div className="xl-ribbon-group-body">{children}</div>
      <div className="xl-ribbon-group-label">{label}</div>
    </div>
  );
}

function Big({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick?: () => void }) {
  return (
    <button type="button" className="xl-btn-big" onMouseDown={keepFocus} title={onClick ? label : PRO} onClick={onClick}>
      <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function Swatch({ icon: Icon, label, color }: { icon: LucideIcon; label: string; color: string }) {
  return (
    <button type="button" className="xl-btn-small xl-btn-swatch" onMouseDown={keepFocus} aria-label={label} title={PRO}>
      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
      <span className="xl-swatch-bar" style={{ background: color }} />
    </button>
  );
}

function Small({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      className="xl-btn-small"
      onMouseDown={keepFocus}
      aria-label={label}
      title={onClick ? label : PRO}
      onClick={onClick}
    >
      <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

export interface RibbonActions {
  openCsv: () => void;
  exportXlsx: () => void;
  autoSum: () => void;
  sortAscending: () => void;
  sortDescending: () => void;
}

export function Ribbon({ actions }: { actions: RibbonActions }) {
  const [fileOpen, setFileOpen] = useState(false);
  const fileArea = useRef<HTMLDivElement>(null);

  // Close the File menu on a click anywhere outside it.
  useEffect(() => {
    if (!fileOpen) return;
    const onDown = (event: globalThis.MouseEvent) => {
      if (!fileArea.current?.contains(event.target as Node)) setFileOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFileOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [fileOpen]);

  const choose = (action: () => void) => () => {
    setFileOpen(false);
    action();
  };

  return (
    <div className="xl-ribbon">
      <div ref={fileArea}>
      <div role="tablist" aria-label="Ribbon" className="xl-tabs">
        <button
          type="button"
          role="tab"
          aria-selected={false}
          aria-haspopup="menu"
          aria-expanded={fileOpen}
          className="xl-tab xl-tab-file"
          onMouseDown={keepFocus}
          onClick={() => setFileOpen((open) => !open)}
        >
          File
        </button>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={tab === 'Home'}
            className={`xl-tab${tab === 'Home' ? ' xl-tab-active' : ''}`}
            title={tab === 'Home' ? undefined : PRO}
          >
            {tab}
          </button>
        ))}
      </div>

      {fileOpen && (
        <div
          role="menu"
          aria-label="File"
          className="xl-file-menu"
        >
          <button type="button" role="menuitem" onMouseDown={keepFocus} onClick={choose(actions.openCsv)}>
            Open CSV…
          </button>
          <button type="button" role="menuitem" onMouseDown={keepFocus} onClick={choose(actions.exportXlsx)}>
            Export to Excel (.xlsx)
          </button>
        </div>
      )}
      </div>

      <div role="tabpanel" aria-label="Home" className="xl-ribbon-panel">
        <Group label="Clipboard">
          <Big icon={ClipboardPaste} label="Paste" />
          <div className="xl-stack">
            <Small icon={Scissors} label="Cut" />
            <Small icon={Copy} label="Copy" />
            <Small icon={Paintbrush} label="Format Painter" />
          </div>
        </Group>
        <Group label="Font">
          <div className="xl-font-row">
            <span className="xl-fake-select xl-font-name">Aptos Narrow</span>
            <span className="xl-fake-select xl-font-size">11</span>
          </div>
          <div className="xl-font-row">
            <Small icon={Bold} label="Bold" />
            <Small icon={Italic} label="Italic" />
            <Small icon={Underline} label="Underline" />
            <Small icon={Grid2x2} label="Borders" />
            <Swatch icon={PaintBucket} label="Fill Color" color="#ffff00" />
            <Swatch icon={Baseline} label="Font Color" color="#ff0000" />
          </div>
        </Group>
        <Group label="Alignment">
          <div className="xl-font-row">
            <Small icon={AlignLeft} label="Align Left" />
            <Small icon={AlignCenter} label="Center" />
            <Small icon={AlignRight} label="Align Right" />
          </div>
          <div className="xl-font-row">
            <Small icon={WrapText} label="Wrap Text" />
            <Small icon={Merge} label="Merge &amp; Center" />
          </div>
        </Group>
        <Group label="Number">
          <div className="xl-font-row">
            <span className="xl-fake-select xl-number-format">General</span>
          </div>
          <div className="xl-font-row">
            <Small icon={Percent} label="Percent Style" />
          </div>
        </Group>
        <Group label="Styles">
          <Big icon={ChartColumn} label="Conditional Formatting" />
          <Big icon={Table} label="Format as Table" />
          <Big icon={Palette} label="Cell Styles" />
        </Group>
        <Group label="Cells">
          <Big icon={ListPlus} label="Insert" />
          <Big icon={ListMinus} label="Delete" />
          <Big icon={Settings2} label="Format" />
        </Group>
        <Group label="Editing">
          <Big icon={Sigma} label="AutoSum" onClick={actions.autoSum} />
          <div className="xl-stack">
            <button type="button" className="xl-btn-wide" onMouseDown={keepFocus} onClick={actions.sortAscending}>
              <ArrowDownAZ size={15} aria-hidden="true" /> Sort A to Z
            </button>
            <button type="button" className="xl-btn-wide" onMouseDown={keepFocus} onClick={actions.sortDescending}>
              <ArrowDownZA size={15} aria-hidden="true" /> Sort Z to A
            </button>
          </div>
        </Group>
      </div>
    </div>
  );
}
