// Name box and formula bar: the selected cell's address and its raw content.

import { Check, X } from 'lucide-react';

import { toAddress } from '@/sheet/address';
import { rawText } from '@/sheet/workbook';

import { FormulaInput } from './FormulaInput';
import type { Sheet } from './use-sheet';

export function FormulaBar({ sheet }: { sheet: Sheet }) {
  const { workbook, cursor, editing } = sheet.state;
  const raw = rawText(workbook, cursor.col, cursor.row);

  return (
    <div className="xl-formula-bar">
      <output className="xl-name-box" aria-label="Name Box">
        {toAddress(cursor.col, cursor.row)}
      </output>
      <span className="xl-fx" aria-hidden="true">
        <X size={14} className={editing ? 'xl-fx-live' : undefined} />
        <Check size={14} className={editing ? 'xl-fx-live' : undefined} />
        <i>fx</i>
      </span>
      <FormulaInput
        className="xl-formula-input"
        ariaLabel="Formula Bar"
        value={editing ? editing.text : raw}
        caret={editing?.origin === 'formula-bar' ? editing.caret : undefined}
        onFocus={() => {
          if (!editing) sheet.startEdit(raw, 'formula-bar');
        }}
        onChange={(event) =>
          editing ? sheet.changeEdit(event.target.value) : sheet.startEdit(event.target.value, 'formula-bar')
        }
        onBlur={() => {
          // Leaving the formula bar commits, so the grid's keyboard never sits behind an open edit.
          if (editing?.origin === 'formula-bar') sheet.commitEdit();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            sheet.commitEdit();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            sheet.cancelEdit();
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}
