# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Angular 21 frontend for a personal finance application. Uses standalone components architecture with PrimeNG 21 for UI components and Tailwind CSS 4 for utility styling.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:4200)
npm start

# Build for production
npm run build

# Run tests (Vitest)
npm test

# Watch mode build
npm run watch
```

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Angular | 21.1 | Framework |
| PrimeNG | 21.0 | UI components |
| Tailwind CSS | 4.1 | Utility styling |
| tailwindcss-primeui | 0.6 | PrimeNG + Tailwind integration |
| TypeScript | 5.9 | Language |
| Vitest | 4.0 | Testing |

## Architecture

### Standalone Components
All components are standalone (no NgModules). Import dependencies directly in the component:

```typescript
@Component({
  standalone: true,
  imports: [CommonModule, ButtonModule, TableModule],
  // ...
})
```

### Folder Structure
```
src/app/
├── core/           # Singleton services, guards, interceptors
├── shared/         # Reusable components, pipes, directives
├── features/       # Feature modules (lazy-loaded routes)
├── models/         # TypeScript interfaces
└── app.config.ts   # Application providers
```

### State Management
Use Angular Signals for reactive state:
- `signal()` for local component state
- Injectable store services for feature-wide state
- Singleton services for app-wide state (auth, theme)

## Styling Guidelines

### PrimeNG + Tailwind Integration
CSS layers are configured for proper specificity:
```css
@layer theme, base, primeng, components, utilities;
```

### Component Styling Pattern
```html
<!-- Tailwind for layout/spacing, PrimeNG for components -->
<div class="flex flex-col gap-4 p-4">
  <p-button label="Save" severity="primary" />
  <p-card class="shadow-lg">
    <p class="text-muted-color">Content</p>
  </p-card>
</div>
```

### Semantic Colors (from tailwindcss-primeui)
- `bg-primary`, `text-primary` - Primary actions
- `bg-surface-0` to `bg-surface-900` - Backgrounds
- `text-color`, `text-muted-color` - Text
- `text-green-500` - Income/positive
- `text-red-500` - Expenses/negative

### Dark Mode
Toggle via `.dark-mode` class on body. Use `ThemeService.toggleDarkMode()`.

## PrimeNG Component Imports

Import components individually for tree-shaking:
```typescript
// Correct
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

// Avoid (increases bundle size)
// import { PrimeNGModule } from 'primeng';
```

## API Integration

### Backend
The backend runs at `http://localhost:8080/api/v1/`. See `pf-data-service` for API documentation.

### HTTP Client Setup
Configured in `app.config.ts` with:
- `provideHttpClient()` - Base HTTP client
- Auth interceptor - Attaches JWT token
- Error interceptor - Global error handling

### API Service Pattern
```typescript
@Injectable({ providedIn: 'root' })
export class TransactionApiService extends ApiService {
  getTransactions(filter, pagination): Observable<Page<Transaction>> {
    return this.get('/transactions', params);
  }
}
```

## Key Configuration Files

| File | Purpose |
|------|---------|
| `app.config.ts` | Application providers (router, HTTP, PrimeNG) |
| `app.routes.ts` | Root routing configuration |
| `styles.css` | Global styles (Tailwind + PrimeNG imports) |
| `.postcssrc.json` | PostCSS configuration for Tailwind |
| `angular.json` | Angular CLI configuration |

## PrimeNG Theme Configuration

```typescript
// app.config.ts
providePrimeNG({
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark-mode',
      cssLayer: { name: 'primeng', order: 'theme, base, primeng' }
    }
  },
  ripple: true
})
```

## Common PrimeNG Components

| Component | Import | Use Case |
|-----------|--------|----------|
| `p-table` | `TableModule` | Data tables with pagination |
| `p-dialog` | `DialogModule` | Modal forms |
| `p-button` | `ButtonModule` | All buttons |
| `p-toast` | `ToastModule` | Notifications |
| `p-chart` | `ChartModule` | Dashboard charts |
| `p-fileupload` | `FileUploadModule` | CSV import |
| `p-stepper` | `StepperModule` | Multi-step wizards |

## Development Notes

### Signal-based Inputs (Angular 21)
```typescript
// Preferred
data = input.required<MyData>();
loading = input(false);

// Instead of @Input()
```

### Computed Signals
```typescript
readonly total = computed(() =>
  this.items().reduce((sum, i) => sum + i.amount, 0)
);
```

### Lazy Loading Routes
```typescript
// app.routes.ts
{
  path: 'transactions',
  loadChildren: () => import('./features/transactions/transactions.routes')
    .then(m => m.TRANSACTION_ROUTES)
}
```

## Troubleshooting

### Build Errors
If you see CSS layer errors, ensure `styles.css` has correct import order:
```css
@import "tailwindcss";
@import "tailwindcss-primeui";
@import "primeicons/primeicons.css";
@layer theme, base, primeng, components, utilities;
```

### PrimeNG Styles Not Applied
Check that `cssLayer` is configured in `providePrimeNG()` and layer order matches.

### Animations Not Working
Ensure `@angular/animations` is installed and `provideAnimationsAsync()` is in providers.
