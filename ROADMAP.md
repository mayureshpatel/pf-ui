# Frontend Development Roadmap: pf-ui

**Last Updated:** January 22, 2026
**Framework:** Angular 21 with Standalone Components
**UI Library:** PrimeNG 21
**Styling:** Tailwind CSS 4 + tailwindcss-primeui
**Target:** Single-user Personal Finance Application

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Folder Structure](#2-folder-structure)
3. [Design System & Theming](#3-design-system--theming)
4. [Core Infrastructure](#4-core-infrastructure)
5. [Feature Modules](#5-feature-modules)
6. [State Management](#6-state-management)
7. [API Integration](#7-api-integration)
8. [Implementation Phases](#8-implementation-phases)
9. [Component Guidelines](#9-component-guidelines)
10. [Performance Considerations](#10-performance-considerations)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        pf-ui (Angular 21)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Pages     │  │  Features   │  │   Shared/Core       │  │
│  │  (Routes)   │◄─┤ (Smart)     │◄─┤   (Services/Utils)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │               │                    │              │
│         ▼               ▼                    ▼              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PrimeNG Components + Tailwind           │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    HTTP Client + Interceptors               │
├─────────────────────────────────────────────────────────────┤
│                    pf-data-service (REST API)               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

1. **Standalone Components:** All components use Angular's standalone component architecture (no NgModules)
2. **Smart/Dumb Pattern:** Container (smart) components handle logic; presentational (dumb) components handle display
3. **Signal-based State:** Use Angular Signals for reactive state management
4. **Lazy Loading:** Feature routes are lazy-loaded for optimal bundle size
5. **Type Safety:** Strict TypeScript with shared interfaces matching backend DTOs

### 1.3 Technology Decisions

| Concern | Technology | Rationale |
|---------|------------|-----------|
| UI Components | PrimeNG 21 | Rich component library, Angular-native |
| Styling | Tailwind CSS 4 | Utility-first, fast development |
| Integration | tailwindcss-primeui | Seamless PrimeNG + Tailwind |
| State | Angular Signals | Built-in, reactive, simple |
| Forms | Reactive Forms | Type-safe, validation support |
| HTTP | HttpClient + Interceptors | Angular-native, interceptor pattern |
| Charts | PrimeNG Charts (Chart.js) | Integrated with PrimeNG |
| Icons | PrimeIcons | Matches PrimeNG design |

---

## 2. Folder Structure

```
src/
├── app/
│   ├── core/                          # Singleton services, guards, interceptors
│   │   ├── auth/
│   │   │   ├── auth.guard.ts
│   │   │   ├── auth.interceptor.ts
│   │   │   └── auth.service.ts
│   │   ├── api/
│   │   │   ├── api.service.ts         # Base HTTP service
│   │   │   ├── account.api.ts
│   │   │   ├── transaction.api.ts
│   │   │   ├── category.api.ts
│   │   │   ├── dashboard.api.ts
│   │   │   └── vendor-rule.api.ts
│   │   ├── services/
│   │   │   ├── toast.service.ts
│   │   │   ├── theme.service.ts
│   │   │   └── storage.service.ts
│   │   └── index.ts                   # Barrel export
│   │
│   ├── shared/                        # Shared components, directives, pipes
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── shell/             # Main app shell
│   │   │   │   ├── sidebar/
│   │   │   │   ├── topbar/
│   │   │   │   └── footer/
│   │   │   ├── data-display/
│   │   │   │   ├── currency/          # Currency formatting component
│   │   │   │   ├── transaction-badge/ # Transaction type badge
│   │   │   │   └── empty-state/
│   │   │   └── forms/
│   │   │       ├── date-picker/
│   │   │       └── amount-input/
│   │   ├── directives/
│   │   │   └── currency-format.directive.ts
│   │   ├── pipes/
│   │   │   ├── currency.pipe.ts
│   │   │   └── relative-date.pipe.ts
│   │   └── index.ts
│   │
│   ├── features/                      # Feature modules (lazy-loaded)
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   ├── login.component.ts
│   │   │   │   └── login.component.html
│   │   │   └── auth.routes.ts
│   │   │
│   │   ├── dashboard/
│   │   │   ├── dashboard.component.ts
│   │   │   ├── dashboard.component.html
│   │   │   ├── components/
│   │   │   │   ├── summary-cards/
│   │   │   │   ├── category-chart/
│   │   │   │   ├── net-worth-chart/
│   │   │   │   └── recent-transactions/
│   │   │   └── dashboard.routes.ts
│   │   │
│   │   ├── accounts/
│   │   │   ├── account-list/
│   │   │   ├── account-form/
│   │   │   ├── account-detail/
│   │   │   └── accounts.routes.ts
│   │   │
│   │   ├── transactions/
│   │   │   ├── transaction-list/
│   │   │   ├── transaction-form/
│   │   │   ├── transaction-import/
│   │   │   │   ├── upload-step/
│   │   │   │   ├── preview-step/
│   │   │   │   └── confirm-step/
│   │   │   ├── components/
│   │   │   │   ├── transaction-table/
│   │   │   │   ├── transaction-filters/
│   │   │   │   └── bulk-actions/
│   │   │   └── transactions.routes.ts
│   │   │
│   │   ├── categories/
│   │   │   ├── category-list/
│   │   │   ├── category-form/
│   │   │   └── categories.routes.ts
│   │   │
│   │   ├── settings/
│   │   │   ├── settings.component.ts
│   │   │   ├── vendor-rules/
│   │   │   ├── category-rules/
│   │   │   ├── theme-settings/
│   │   │   └── settings.routes.ts
│   │   │
│   │   └── reports/
│   │       ├── monthly-report/
│   │       ├── category-report/
│   │       └── reports.routes.ts
│   │
│   ├── models/                        # TypeScript interfaces
│   │   ├── account.model.ts
│   │   ├── transaction.model.ts
│   │   ├── category.model.ts
│   │   ├── user.model.ts
│   │   ├── dashboard.model.ts
│   │   └── api-response.model.ts
│   │
│   ├── app.ts                         # Root component
│   ├── app.html
│   ├── app.css
│   ├── app.config.ts                  # Application configuration
│   └── app.routes.ts                  # Root routes
│
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
│
├── styles.css                         # Global styles (Tailwind + PrimeNG)
├── index.html
└── main.ts
```

### 2.1 Folder Conventions

| Folder | Purpose | Singleton? |
|--------|---------|------------|
| `core/` | Services, guards, interceptors used app-wide | Yes |
| `shared/` | Reusable UI components, pipes, directives | No |
| `features/` | Feature-specific components (lazy-loaded) | No |
| `models/` | TypeScript interfaces/types | N/A |

---

## 3. Design System & Theming

### 3.1 Theme Configuration

The app uses PrimeNG's Aura theme with Tailwind integration. Theme is configured in `app.config.ts`:

```typescript
providePrimeNG({
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark-mode',
      cssLayer: {
        name: 'primeng',
        order: 'theme, base, primeng'
      }
    }
  },
  ripple: true
})
```

### 3.2 Color Palette (Semantic)

Use these Tailwind classes from tailwindcss-primeui:

| Purpose | Light Mode | Usage |
|---------|------------|-------|
| Primary | `bg-primary`, `text-primary` | Buttons, links, accents |
| Surface | `bg-surface-0` to `bg-surface-900` | Backgrounds, cards |
| Text | `text-color`, `text-muted-color` | Body text |
| Success | `bg-green-500`, `text-green-500` | Income, positive |
| Danger | `bg-red-500`, `text-red-500` | Expenses, errors |
| Warning | `bg-yellow-500` | Alerts |

### 3.3 Component Styling Pattern

```html
<!-- Use Tailwind for layout, spacing, custom styling -->
<div class="flex flex-col gap-4 p-4">

  <!-- Use PrimeNG components for interactive UI -->
  <p-button label="Save" severity="primary" />

  <!-- Combine both when needed -->
  <p-card class="shadow-lg hover:shadow-xl transition-shadow">
    <ng-template pTemplate="content">
      <p class="text-muted-color text-sm">Card content</p>
    </ng-template>
  </p-card>

</div>
```

### 3.4 Dark Mode Implementation

```typescript
// theme.service.ts
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private darkMode = signal(false);

  readonly isDarkMode = this.darkMode.asReadonly();

  toggleDarkMode(): void {
    this.darkMode.update(v => !v);
    document.body.classList.toggle('dark-mode', this.darkMode());
    localStorage.setItem('darkMode', String(this.darkMode()));
  }
}
```

---

## 4. Core Infrastructure

### 4.1 Authentication Flow

```
┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────┐
│  Login  │───►│ AuthService │───►│  Backend    │───►│  Token   │
│  Page   │    │ .login()    │    │  /auth/     │    │  Stored  │
└─────────┘    └─────────────┘    └─────────────┘    └──────────┘
                                                           │
     ┌─────────────────────────────────────────────────────┘
     ▼
┌──────────────────┐    ┌─────────────────┐    ┌────────────────┐
│ AuthInterceptor  │───►│ Attach Bearer   │───►│  API Request   │
│ (HTTP)           │    │ Token           │    │  Authorized    │
└──────────────────┘    └─────────────────┘    └────────────────┘
```

### 4.2 HTTP Interceptor Chain

```typescript
// app.config.ts
provideHttpClient(
  withInterceptors([
    authInterceptor,      // Attach JWT token
    errorInterceptor,     // Handle API errors globally
    loadingInterceptor    // Show/hide loading spinner
  ])
)
```

### 4.3 Auth Guard

```typescript
// auth.guard.ts
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};
```

### 4.4 Environment Configuration

```typescript
// environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api/v1',
  tokenKey: 'pf_auth_token'
};
```

---

## 5. Feature Modules

### 5.1 Dashboard

**Purpose:** Overview of financial health

**Components:**
| Component | PrimeNG Used | Data Source |
|-----------|--------------|-------------|
| SummaryCards | Card | `GET /dashboard?month=X&year=Y` |
| CategoryChart | Chart (Doughnut) | Dashboard.categoryBreakdown |
| NetWorthChart | Chart (Line) | `GET /dashboard/net-worth-history` |
| RecentTransactions | Table | `GET /transactions?limit=5` |

**Key Features:**
- Month/year selector
- Real-time balance display
- Category spending breakdown (donut chart)
- 90-day net worth trend (line chart)

### 5.2 Accounts

**Purpose:** Manage bank accounts

**Components:**
| Component | PrimeNG Used | Data Source |
|-----------|--------------|-------------|
| AccountList | DataView, Card | `GET /accounts` |
| AccountForm | Dialog, InputText, Dropdown | `POST/PUT /accounts` |
| AccountDetail | Card, Table | `GET /accounts/:id` |

**Key Features:**
- List accounts with balances
- Add/edit/delete accounts
- Account type icons (checking, savings, credit card)
- Per-account transaction view

### 5.3 Transactions

**Purpose:** View, filter, import, and manage transactions

**Components:**
| Component | PrimeNG Used | Data Source |
|-----------|--------------|-------------|
| TransactionList | Table, Paginator | `GET /transactions` |
| TransactionFilters | MultiSelect, DatePicker, InputText | Query params |
| TransactionForm | Dialog, forms | `POST/PUT /transactions` |
| TransactionImport | Stepper, FileUpload, Table | `POST /accounts/:id/upload`, `POST /accounts/:id/transactions` |
| BulkActions | Menu, Toolbar | `PATCH/DELETE /transactions/bulk` |

**Key Features:**
- Server-side pagination & filtering
- Bulk edit/delete
- CSV import wizard (upload → preview → confirm)
- Inline category/vendor editing
- Export to CSV

### 5.4 Categories

**Purpose:** Manage spending categories

**Components:**
| Component | PrimeNG Used | Data Source |
|-----------|--------------|-------------|
| CategoryList | DataView, Tag | `GET /categories` |
| CategoryForm | Dialog, ColorPicker | `POST/PUT /categories` |

**Key Features:**
- Color-coded categories
- Usage statistics
- Category rules management (future)

### 5.5 Settings

**Purpose:** App configuration

**Sections:**
| Section | Description |
|---------|-------------|
| VendorRules | Manage vendor name cleanup rules |
| CategoryRules | Auto-categorization rules |
| ThemeSettings | Dark/light mode toggle |
| Profile | User preferences |

### 5.6 Reports

**Purpose:** Financial analysis and insights

**Components:**
| Component | Description |
|-----------|-------------|
| MonthlyReport | Income vs expense by month |
| CategoryReport | Spending by category over time |
| TrendAnalysis | Year-over-year comparisons |

---

## 6. State Management

### 6.1 Signal-Based Approach

Use Angular Signals for local and shared state:

```typescript
// transaction.store.ts
@Injectable({ providedIn: 'root' })
export class TransactionStore {
  // State signals
  private _transactions = signal<Transaction[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);
  private _filters = signal<TransactionFilter>({});
  private _pagination = signal<Pagination>({ page: 0, size: 20, totalElements: 0 });

  // Public readonly signals
  readonly transactions = this._transactions.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly pagination = this._pagination.asReadonly();

  // Computed signals
  readonly totalExpenses = computed(() =>
    this._transactions()
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  constructor(private api: TransactionApiService) {}

  async loadTransactions(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.api.getTransactions(this._filters(), this._pagination())
      );
      this._transactions.set(response.content);
      this._pagination.update(p => ({ ...p, totalElements: response.totalElements }));
    } catch (e) {
      this._error.set('Failed to load transactions');
    } finally {
      this._loading.set(false);
    }
  }

  setFilters(filters: TransactionFilter): void {
    this._filters.set(filters);
    this.loadTransactions();
  }
}
```

### 6.2 State Patterns by Scope

| Scope | Pattern | Example |
|-------|---------|---------|
| Component-local | `signal()` in component | Form state, UI toggles |
| Feature-wide | Injectable store service | TransactionStore |
| App-wide | Singleton service with signals | AuthService, ThemeService |

### 6.3 When to Use What

```
Component State (signal in component)
├── Form inputs
├── Modal open/close
├── Local loading states
└── Temporary selections

Feature Store (injectable service)
├── List data (transactions, accounts)
├── Pagination state
├── Filter state
└── Feature-specific computed values

Global Service (providedIn: 'root')
├── Authentication state
├── User preferences
├── Theme settings
└── Toast notifications
```

---

## 7. API Integration

### 7.1 API Service Pattern

```typescript
// base: api.service.ts
@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  protected get<T>(path: string, params?: HttpParams): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, { params });
  }

  protected post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body);
  }

  protected put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body);
  }

  protected patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body);
  }

  protected delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`);
  }
}
```

```typescript
// transaction.api.ts
@Injectable({ providedIn: 'root' })
export class TransactionApiService extends ApiService {

  getTransactions(filter: TransactionFilter, pagination: Pagination): Observable<Page<Transaction>> {
    let params = new HttpParams()
      .set('page', pagination.page)
      .set('size', pagination.size);

    if (filter.accountId) params = params.set('accountId', filter.accountId);
    if (filter.type) params = params.set('type', filter.type);
    if (filter.startDate) params = params.set('startDate', filter.startDate);
    if (filter.endDate) params = params.set('endDate', filter.endDate);
    if (filter.categoryName) params = params.set('categoryName', filter.categoryName);
    if (filter.description) params = params.set('description', filter.description);

    return this.get<Page<Transaction>>('/transactions', params);
  }

  createTransaction(dto: TransactionDto): Observable<Transaction> {
    return this.post<Transaction>('/transactions', dto);
  }

  updateTransaction(id: number, dto: TransactionDto): Observable<Transaction> {
    return this.put<Transaction>(`/transactions/${id}`, dto);
  }

  deleteTransaction(id: number): Observable<void> {
    return this.delete<void>(`/transactions/${id}`);
  }

  bulkUpdate(dtos: TransactionDto[]): Observable<Transaction[]> {
    return this.patch<Transaction[]>('/transactions/bulk', dtos);
  }

  bulkDelete(ids: number[]): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/transactions/bulk`, { body: ids });
  }

  uploadCsv(accountId: number, file: File, bankName: string): Observable<TransactionPreview[]> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bankName', bankName);
    return this.http.post<TransactionPreview[]>(
      `${environment.apiUrl}/accounts/${accountId}/upload`,
      formData
    );
  }

  saveImportedTransactions(accountId: number, request: SaveTransactionRequest): Observable<string> {
    return this.post<string>(`/accounts/${accountId}/transactions`, request);
  }
}
```

### 7.2 API Endpoints Reference

| Feature | Method | Endpoint | Request | Response |
|---------|--------|----------|---------|----------|
| **Auth** |
| Login | POST | `/auth/authenticate` | `{ username, password }` | `{ token }` |
| **Accounts** |
| List | GET | `/accounts` | - | `Account[]` |
| Create | POST | `/accounts` | `AccountDto` | `Account` |
| Update | PUT | `/accounts/:id` | `AccountDto` | `Account` |
| Delete | DELETE | `/accounts/:id` | - | - |
| **Transactions** |
| List | GET | `/transactions` | Query params | `Page<Transaction>` |
| Create | POST | `/transactions` | `TransactionDto` | `Transaction` |
| Update | PUT | `/transactions/:id` | `TransactionDto` | `Transaction` |
| Delete | DELETE | `/transactions/:id` | - | - |
| Bulk Update | PATCH | `/transactions/bulk` | `TransactionDto[]` | `Transaction[]` |
| Bulk Delete | DELETE | `/transactions/bulk` | `number[]` | - |
| **Import** |
| Upload CSV | POST | `/accounts/:id/upload` | `FormData` | `TransactionPreview[]` |
| Save Import | POST | `/accounts/:id/transactions` | `SaveTransactionRequest` | `string` |
| **Dashboard** |
| Data | GET | `/dashboard?month=X&year=Y` | - | `DashboardData` |
| Net Worth | GET | `/dashboard/net-worth-history` | - | `DailyBalance[]` |
| **Categories** |
| List | GET | `/categories` | - | `Category[]` |
| Create | POST | `/categories` | `CategoryDto` | `Category` |
| Update | PUT | `/categories/:id` | `CategoryDto` | `Category` |
| **Vendor Rules** |
| List | GET | `/vendor-rules` | - | `VendorRule[]` |
| Create | POST | `/vendor-rules` | `VendorRuleDto` | `VendorRule` |
| Delete | DELETE | `/vendor-rules/:id` | - | - |

### 7.3 Error Handling

```typescript
// error.interceptor.ts
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        router.navigate(['/login']);
        toast.error('Session expired. Please login again.');
      } else if (error.status === 403) {
        toast.error('You do not have permission for this action.');
      } else if (error.status === 404) {
        toast.error('Resource not found.');
      } else if (error.status >= 500) {
        toast.error('Server error. Please try again later.');
      } else if (error.error?.detail) {
        toast.error(error.error.detail);
      }

      return throwError(() => error);
    })
  );
};
```

---

## 8. Implementation Phases

### Phase 1: Core Setup & Authentication

**Status:** ✅ Complete

- [x] Angular 21 project scaffolding
- [x] PrimeNG 21 installation and configuration
- [x] Tailwind CSS 4 integration
- [x] tailwindcss-primeui setup
- [x] Environment configuration (`src/environments/`)
- [x] Core folder structure with path aliases (`@core/*`, `@shared/*`, `@models/*`, `@features/*`, `@env`)
- [x] Authentication service (`AuthService` with Angular Signals)
- [x] Auth interceptor (JWT attachment, 401 handling)
- [x] Login page (PrimeNG Card, InputText, Password, Checkbox, Button)
- [x] Auth guards (`authGuard`, `noAuthGuard`)
- [x] App shell with Drawer (mobile) + fixed sidebar (desktop)
- [x] Storage service with remember-me support
- [x] Toast service wrapper for PrimeNG MessageService

**Files Created:**
```
src/
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
├── app/
│   ├── models/
│   │   └── auth.model.ts
│   ├── core/
│   │   ├── auth/
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.interceptor.ts
│   │   │   └── auth.guard.ts
│   │   ├── services/
│   │   │   ├── storage.service.ts
│   │   │   └── toast.service.ts
│   │   └── index.ts
│   ├── shared/
│   │   └── components/
│   │       └── layout/
│   │           └── shell/
│   │               ├── shell.component.ts
│   │               └── shell.component.html
│   └── features/
│       ├── auth/
│       │   ├── login/
│       │   │   ├── login.component.ts
│       │   │   └── login.component.html
│       │   └── auth.routes.ts
│       └── dashboard/
│           └── dashboard.component.ts (placeholder)
```

**Deliverables:**
- Working login flow with JWT authentication
- Protected routes with automatic redirect
- App shell with responsive sidebar navigation
- Toast notifications for user feedback

### Phase 2: Dashboard (Current)

- [ ] Dashboard page component
- [ ] Summary cards (income, expenses, net savings)
- [ ] Month/year selector
- [ ] Category breakdown chart (PrimeNG Chart - Doughnut)
- [ ] Net worth history chart (PrimeNG Chart - Line)
- [ ] Recent transactions widget
- [ ] Dashboard API integration

**Deliverables:**
- Fully functional dashboard
- Real-time financial overview

### Phase 3: Accounts Management

- [ ] Account list page
- [ ] Account card component
- [ ] Create account dialog
- [ ] Edit account functionality
- [ ] Delete account with confirmation
- [ ] Account type icons/badges
- [ ] Account balance display

**Deliverables:**
- Full CRUD for accounts

### Phase 4: Transaction Management

- [ ] Transaction list page
- [ ] PrimeNG DataTable with server-side pagination
- [ ] Filter panel (date range, type, category, account, search)
- [ ] Create transaction dialog
- [ ] Edit transaction (inline or dialog)
- [ ] Delete transaction
- [ ] Bulk selection UI
- [ ] Bulk edit dialog
- [ ] Bulk delete confirmation
- [ ] Transaction type badges (income/expense)

**Deliverables:**
- Full transaction CRUD
- Advanced filtering
- Bulk operations

### Phase 5: CSV Import

- [ ] Import wizard component (PrimeNG Stepper)
- [ ] Step 1: File upload (PrimeNG FileUpload)
- [ ] Bank selection dropdown
- [ ] Step 2: Preview table with editable fields
- [ ] Duplicate detection display
- [ ] Category assignment in preview
- [ ] Step 3: Confirmation summary
- [ ] Progress indicator during save
- [ ] Success/error feedback

**Deliverables:**
- Complete CSV import workflow
- Support for 4 bank formats

### Phase 6: Categories & Settings

- [ ] Category list page
- [ ] Create/edit category dialog
- [ ] Color picker for categories
- [ ] Vendor rules management
- [ ] Category rules management (future)
- [ ] Theme toggle (dark/light)
- [ ] Settings page shell

**Deliverables:**
- Category management
- Basic settings

### Phase 7: Reports & Polish

- [ ] Monthly income/expense report
- [ ] Category spending over time
- [ ] Export functionality
- [ ] Empty states for all lists
- [ ] Loading skeletons
- [ ] Error boundaries
- [ ] Responsive design refinements
- [ ] Accessibility audit (a11y)

**Deliverables:**
- Reporting features
- Production-ready polish

### Phase 8: Advanced Features (Post-MVP)

- [ ] Budgeting module
- [ ] Recurring transactions
- [ ] Advanced reporting
- [ ] Data export (PDF)
- [ ] Offline support (PWA)

---

## 9. Component Guidelines

### 9.1 Component File Structure

```
feature/
├── my-component/
│   ├── my-component.component.ts      # Component logic
│   ├── my-component.component.html    # Template
│   ├── my-component.component.css     # Scoped styles (minimal, use Tailwind)
│   └── my-component.component.spec.ts # Tests (deferred)
```

### 9.2 Component Template

```typescript
// my-component.component.ts
import { Component, input, output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-my-component',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './my-component.component.html',
  styleUrl: './my-component.component.css'
})
export class MyComponent {
  // Inputs (using signal-based inputs)
  data = input.required<MyData>();
  loading = input(false);

  // Outputs
  save = output<MyData>();
  cancel = output<void>();

  // Internal state
  protected editing = signal(false);

  // Computed
  protected isValid = computed(() => this.data().name.length > 0);

  // Methods
  protected onSave(): void {
    this.save.emit(this.data());
  }
}
```

### 9.3 Smart vs Dumb Components

**Smart (Container) Components:**
- Inject services
- Handle API calls
- Manage state
- Located in feature folders
- Examples: `DashboardComponent`, `TransactionListComponent`

**Dumb (Presentational) Components:**
- Receive data via inputs
- Emit events via outputs
- No service injection
- Located in `shared/` or feature `components/`
- Examples: `TransactionTableComponent`, `SummaryCardComponent`

### 9.4 PrimeNG Component Usage

```html
<!-- Table -->
<p-table
  [value]="transactions()"
  [paginator]="true"
  [rows]="20"
  [lazy]="true"
  (onLazyLoad)="loadTransactions($event)"
  [loading]="loading()">

  <ng-template pTemplate="header">
    <tr>
      <th pSortableColumn="date">Date <p-sortIcon field="date" /></th>
      <th>Description</th>
      <th pSortableColumn="amount">Amount <p-sortIcon field="amount" /></th>
    </tr>
  </ng-template>

  <ng-template pTemplate="body" let-txn>
    <tr>
      <td>{{ txn.date | date:'mediumDate' }}</td>
      <td>{{ txn.description }}</td>
      <td [class]="txn.type === 'INCOME' ? 'text-green-500' : 'text-red-500'">
        {{ txn.amount | currency }}
      </td>
    </tr>
  </ng-template>

</p-table>

<!-- Dialog -->
<p-dialog
  header="Edit Transaction"
  [(visible)]="dialogVisible"
  [modal]="true"
  [style]="{ width: '500px' }">

  <form [formGroup]="form">
    <!-- Form fields -->
  </form>

  <ng-template pTemplate="footer">
    <p-button label="Cancel" severity="secondary" (onClick)="dialogVisible = false" />
    <p-button label="Save" (onClick)="save()" [disabled]="form.invalid" />
  </ng-template>
</p-dialog>

<!-- Toast (global) -->
<p-toast />
```

---

## 10. Performance Considerations

### 10.1 Bundle Optimization

- **Lazy Loading:** All feature routes are lazy-loaded
- **Tree Shaking:** Import PrimeNG components individually
- **Production Build:** AOT compilation enabled by default

```typescript
// Correct: Individual imports
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

// Avoid: Full library import (increases bundle)
// import { PrimeNGModule } from 'primeng';
```

### 10.2 Virtual Scrolling

For large lists (1000+ items):

```html
<p-table [value]="items" [scrollable]="true" scrollHeight="400px" [virtualScroll]="true" [virtualScrollItemSize]="46">
  <!-- ... -->
</p-table>
```

### 10.3 Change Detection

Use OnPush change detection with signals:

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
export class MyComponent {
  data = input.required<Data>();
  // Signals automatically trigger change detection when updated
}
```

### 10.4 Image Optimization

- Use `ngOptimizedImage` for images
- Lazy load images below the fold

### 10.5 Bundle Budgets

Current budgets in `angular.json`:
- Initial: Warning at 500kB, Error at 1MB
- Component styles: Warning at 4kB, Error at 8kB

---

## Appendix A: TypeScript Models

```typescript
// models/account.model.ts
export interface Account {
  id: number;
  name: string;
  type: AccountType;
  currentBalance: number;
}

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'CASH' | 'OTHER';

// models/transaction.model.ts
export interface Transaction {
  id: number;
  date: string; // ISO date
  description: string;
  originalVendorName: string | null;
  vendorName: string | null;
  amount: number;
  type: TransactionType;
  categoryName: string | null;
  accountId: number;
}

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export interface TransactionFilter {
  accountId?: number;
  type?: TransactionType;
  description?: string;
  categoryName?: string;
  vendorName?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
}

// models/category.model.ts
export interface Category {
  id: number;
  name: string;
  color?: string;
}

// models/dashboard.model.ts
export interface DashboardData {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  categoryBreakdown: CategoryTotal[];
}

export interface CategoryTotal {
  categoryName: string;
  total: number;
}

export interface DailyBalance {
  date: string;
  balance: number;
}

// models/api-response.model.ts
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number; // current page (0-indexed)
}

export interface Pagination {
  page: number;
  size: number;
  totalElements?: number;
}
```

---

## Appendix B: Useful PrimeNG Components

| Component | Use Case |
|-----------|----------|
| `p-table` | Transaction list, account list |
| `p-card` | Dashboard cards, account cards |
| `p-dialog` | Forms, confirmations |
| `p-button` | All buttons |
| `p-inputtext` | Text inputs |
| `p-inputnumber` | Amount inputs |
| `p-dropdown` | Account type, bank selection |
| `p-multiselect` | Category filter |
| `p-calendar` | Date pickers |
| `p-chart` | Dashboard charts |
| `p-fileupload` | CSV import |
| `p-stepper` | Import wizard |
| `p-toast` | Notifications |
| `p-confirmdialog` | Delete confirmations |
| `p-skeleton` | Loading states |
| `p-tag` | Transaction type badges |
| `p-menu` | Context menus, bulk actions |
| `p-drawer` | Mobile navigation (renamed from `p-sidebar` in v21) |
| `p-toolbar` | Action bars |
| `p-paginator` | Pagination |

---

## Appendix C: Key Dependencies

```json
{
  "dependencies": {
    "@angular/animations": "^21.1.0",
    "@angular/common": "^21.1.0",
    "@angular/core": "^21.1.0",
    "@angular/forms": "^21.1.0",
    "@angular/platform-browser": "^21.1.0",
    "@angular/router": "^21.1.0",
    "@primeuix/themes": "^2.0.3",
    "primeng": "^21.0.4",
    "primeicons": "^7.0.0",
    "tailwindcss": "^4.1.18",
    "@tailwindcss/postcss": "^4.1.18",
    "tailwindcss-primeui": "^0.6.1"
  }
}
```
