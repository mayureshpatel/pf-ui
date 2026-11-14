import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { vi } from 'vitest';

import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;
  let add: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    add = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: MessageService, useValue: { add } }],
    });
    service = TestBed.inject(ToastService);
  });

  const lastLife = (): number => add.mock.calls.at(-1)![0].life;

  it('PF-945: keeps a short success toast up for at least 4 seconds', () => {
    service.success('Rule saved');
    expect(lastLife()).toBe(4000);
  });

  it('PF-945: keeps an error up for at least 8 seconds so its cause can be read', () => {
    service.error('Could not save');
    expect(lastLife()).toBe(8000);
  });

  it('PF-945: stays longer for a long message, but never past 15 seconds', () => {
    service.info('No pending transactions match your current rules.', 'x'.repeat(40));
    expect(lastLife()).toBeGreaterThan(4000);
    service.info('y'.repeat(1000));
    expect(lastLife()).toBe(15000);
  });

  it('sends the severity, summary and detail through', () => {
    service.warn('Heads up', 'Detail');
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn', summary: 'Heads up', detail: 'Detail' }),
    );
  });
});
