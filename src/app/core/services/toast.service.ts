import { inject, Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

/** Shortest a toast stays up, in ms. */
const MIN_LIFE_MS = 4000;
/** Extra time per character of text beyond a short summary (about 200 words a minute). */
const MS_PER_CHARACTER = 60;
/** Errors carry a cause the owner may need to read, so they stay longer. */
const MIN_ERROR_LIFE_MS = 8000;
const MAX_LIFE_MS = 15000;

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly messageService: MessageService = inject(MessageService);

  success(summary: string, detail?: string): void {
    this.add('success', summary, detail, MIN_LIFE_MS);
  }

  error(summary: string, detail?: string): void {
    this.add('error', summary, detail, MIN_ERROR_LIFE_MS);
  }

  warn(summary: string, detail?: string): void {
    this.add('warn', summary, detail, MIN_LIFE_MS);
  }

  info(summary: string, detail?: string): void {
    this.add('info', summary, detail, MIN_LIFE_MS);
  }

  /**
   * PF-945: a fixed 3s was too short for a sentence ("No pending transactions match your current
   * rules."). Life now grows with the text, between the severity's minimum and 15s.
   */
  private add(
    severity: 'success' | 'info' | 'warn' | 'error',
    summary: string,
    detail: string | undefined,
    minLife: number,
  ): void {
    const length: number = summary.length + (detail?.length ?? 0);
    const life: number = Math.min(MAX_LIFE_MS, Math.max(minLife, length * MS_PER_CHARACTER));
    this.messageService.add({ severity, summary, detail, life });
  }
}
