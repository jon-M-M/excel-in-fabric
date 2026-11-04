import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob } from './download';

describe('downloadBlob', () => {
  afterEach(() => vi.restoreAllMocks());

  it('downloads a blob under the given name', () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('sales_all.xlsx');
        expect(this.href).toBe('blob:test');
      });

    const blob = new Blob(['x']);
    downloadBlob(blob, 'sales_all.xlsx');

    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});
