---
trigger: always_on
---

# Sentra Engineering Corps — Coding Standards v2.0

These standards were established by Sentra (Principal Infrastructure Engineer) and are enforced by Claudesy (Chief). Follow them without exception.

**Authoritative References:**

- Google TypeScript Style Guide (ts.dev/style)
- TypeScript Style Guide by mkosir (mkosir.github.io/typescript-style-guide)
- AWS Prescriptive Guidance — TypeScript Best Practices
- OWASP Application Security Verification Standard (ASVS) v5.0
- OWASP Top 10:2025
- HIPAA Security Rule (45 CFR §164.312) — Technical Safeguards
- NIST Cybersecurity Framework (CSF) 2.0
- Chrome Extensions — Manifest V3 (developer.chrome.com)
- Vercel React Best Practices Framework
- ISO/IEC 27001:2022 — Information Security Management

---

## 1. TypeScript — Strict & Type-Safe

### 1.1 Compiler Configuration

Always enable the full strict suite. No exceptions.

```jsonc
// tsconfig.json — Sentra Baseline
{
  "compilerOptions": {
    "strict": true, // Master switch
    "noImplicitAny": true, // No implicit any
    "strictNullChecks": true, // Null safety
    "strictFunctionTypes": true, // Contravariant params
    "strictBindCallApply": true, // Typed bind/call/apply
    "strictPropertyInitialization": true, // Init all class props
    "noImplicitThis": true, // Explicit this
    "alwaysStrict": true, // Emit "use strict"
    "noUncheckedIndexedAccess": true, // Index returns T | undefined
    "noImplicitOverride": true, // Explicit override keyword
    "noImplicitReturns": true, // All paths must return
    "noFallthroughCasesInSwitch": true, // Exhaustive switches
    "exactOptionalPropertyTypes": true, // undefined ≠ optional
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true, // Safe for esbuild/swc
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
  },
}
```

### 1.2 Type System Rules

| Rule                   | Do                          | Don't                    |
| ---------------------- | --------------------------- | ------------------------ |
| Object shapes          | `interface`                 | `type` for objects       |
| Unions / intersections | `type`                      | `interface`              |
| Unknown inputs         | `unknown` + type guard      | `any`                    |
| Constants              | `as const satisfies`        | `enum`                   |
| Exports                | `export type { Props }`     | Mixed type/value exports |
| Return types           | Explicit on exported fns    | Implicit on internals OK |
| Generics               | Constrained (`T extends X`) | Unconstrained `<T>`      |
| Nullability            | Required props by default   | Excessive `?` optionals  |

**Rationale (Google TS Guide):** Be explicit on the outside, implicit on the inside. Public APIs must have explicit types to prevent accidental breaking changes. Internal logic can rely on TypeScript's inference.

### 1.3 `as const satisfies` Over Enums

```typescript
// ✅ Sentra pattern — tree-shakeable, type-safe, runtime-accessible
export const RISK_LEVEL = {
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const satisfies Record<string, string>;

export type RiskLevel = (typeof RISK_LEVEL)[keyof typeof RISK_LEVEL];

// ❌ Never use enums — they generate runtime code, break tree-shaking
// enum RiskLevel { LOW, MODERATE, HIGH, CRITICAL }
```

### 1.4 Discriminated Unions for State

```typescript
// ✅ Exhaustive, type-narrowing state machines
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

function renderState<T>(state: AsyncState<T>): string {
  switch (state.status) {
    case 'idle':
      return 'Ready';
    case 'loading':
      return 'Loading…';
    case 'success':
      return `Got ${JSON.stringify(state.data)}`;
    case 'error':
      return `Error: ${state.error.message}`;
    // No default — TS enforces exhaustive checking
  }
}
```

### 1.5 Result Pattern — No Thrown Exceptions in Business Logic

```typescript
// Sentra canonical Result type
type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };

async function fetchPatient(id: string): Promise<Result<Patient>> {
  try {
    const data = await api.get(`/patients/${id}`);
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

// Usage — caller handles both paths explicitly
const result = await fetchPatient(patientId);
if (!result.ok) {
  logger.warn('Patient fetch failed', { error: result.error.message });
  return;
}
const patient = result.data; // TypeScript narrows to Patient
```

### 1.6 Runtime Validation with Zod

Complement compile-time types with runtime validation on all external boundaries (API responses, user input, message payloads).

```typescript
import { z } from 'zod';

const PatientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  birthDate: z.string().date(),
  riskScore: z.number().min(0).max(100).optional(),
});

type Patient = z.infer<typeof PatientSchema>;

// Validate at boundary
function parsePatientResponse(raw: unknown): Result<Patient> {
  const parsed = PatientSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: new Error(parsed.error.message) };
  }
  return { ok: true, data: parsed.data };
}
```

### 1.7 Type Guard Pattern

```typescript
// Named type guards for reuse
function isPatient(value: unknown): value is Patient {
  return typeof value === 'object' && value !== null && 'id' in value && 'name' in value;
}

// Assertion function for guaranteed narrowing
function assertPatient(value: unknown): asserts value is Patient {
  if (!isPatient(value)) {
    throw new Error('Invalid patient data');
  }
}
```

### 1.8 Utility Types — Use Standard Library

Prefer TypeScript's built-in utility types over hand-rolled types:

```typescript
// ✅ Use built-in utilities
type PartialPatient = Partial<Patient>;
type PatientName = Pick<Patient, 'name' | 'birthDate'>;
type PatientUpdate = Omit<Patient, 'id'> & { updatedAt: string };
type ReadonlyPatient = Readonly<Patient>;
type PatientRecord = Record<string, Patient>;

// ❌ Don't hand-roll what TypeScript provides
// type PartialPatient = { [K in keyof Patient]?: Patient[K] };
```

---

## 2. React — Component Architecture

### 2.1 Component Patterns

```typescript
// ✅ Sentra canonical component
interface PatientCardProps {
  patient: Patient;
  onSelect: (id: string) => void;
  className?: string;
}

export const PatientCard: React.FC<PatientCardProps> = ({
  patient,
  onSelect,
  className,
}) => {
  // Early return for edge cases
  if (!patient.name) return null;

  const handleClickCard = useCallback(() => {
    onSelect(patient.id);
  }, [patient.id, onSelect]);

  return (
    <button
      type="button"
      onClick={handleClickCard}
      className={cn('card-base', className)}
      aria-label={`Select patient ${patient.name}`}
    >
      <PatientAvatar name={patient.name} />
      <PatientDetails patient={patient} />
    </button>
  );
};
```

### 2.2 Component Rules

| Rule                      | Standard                                                    |
| ------------------------- | ----------------------------------------------------------- |
| Components                | Functional only — no class components                       |
| Props                     | Explicit `interface`, never inline                          |
| Hooks                     | Prefix with `use`, extract shared logic                     |
| Memoization               | `React.memo` only when profiler confirms re-render cost     |
| `useMemo` / `useCallback` | Only for referential equality or expensive computation      |
| Prop drilling             | Max 2 levels — then Context or Zustand                      |
| Event handlers            | `handleVerbNoun` (e.g., `handleClickSubmit`)                |
| Conditionals              | Early returns over nested ternaries                         |
| Side effects              | Never inside render logic — use `useEffect`                 |
| Keys                      | Stable IDs — never array index for dynamic lists            |
| State                     | `useState` for simple, `useReducer` for complex multi-field |
| State locality            | Keep state as close to consumer as possible                 |
| Immutability              | Never mutate state directly — use functional updater        |

### 2.3 Custom Hook Pattern

```typescript
// ✅ Encapsulate shared logic in custom hooks
interface UsePatientDataReturn {
  patient: Patient | null;
  status: AsyncState<Patient>['status'];
  refetch: () => void;
}

export function usePatientData(patientId: string): UsePatientDataReturn {
  const [state, setState] = useState<AsyncState<Patient>>({ status: 'idle' });

  const fetchData = useCallback(async () => {
    setState({ status: 'loading' });
    const result = await fetchPatient(patientId);
    if (result.ok) {
      setState({ status: 'success', data: result.data });
    } else {
      setState({ status: 'error', error: result.error });
    }
  }, [patientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    patient: state.status === 'success' ? state.data : null,
    status: state.status,
    refetch: fetchData,
  };
}
```

### 2.4 Performance Optimization Hierarchy (Vercel Framework)

Optimize in this order — highest impact first:

1. **CRITICAL — Eliminate waterfalls:** Parallelize data fetches, never chain sequential awaits for independent data.
2. **CRITICAL — Reduce bundle size:** Code-split routes with `React.lazy()`, tree-shake unused imports.
3. **HIGH — Server-side where possible:** Pre-render static content, stream dynamic content.
4. **HIGH — Avoid unnecessary re-renders:** Use `React.memo` only after profiling confirms waste.
5. **MEDIUM — Optimize expensive computations:** `useMemo` for heavy transforms, `useCallback` for stable refs.
6. **LOW — Virtualize long lists:** Use `@tanstack/react-virtual` for 100+ item lists.

```typescript
// ✅ Parallel data fetching — never sequential for independent data
const [patients, analytics] = await Promise.all([fetchPatients(), fetchAnalytics()]);

// ❌ Sequential waterfall
// const patients = await fetchPatients();
// const analytics = await fetchAnalytics();
```

### 2.5 Error Boundary Pattern

```typescript
interface ErrorBoundaryProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
  onError?: (error: Error) => void;
}

// Use react-error-boundary or implement class-based boundary
// Every route-level component must be wrapped in an error boundary
```

### 2.6 Accessibility (a11y) Baseline

All components must meet WCAG 2.1 Level AA:

- Semantic HTML elements (`<button>`, `<nav>`, `<main>`, `<article>`)
- All interactive elements keyboard-accessible (`tabIndex`, `onKeyDown`)
- `aria-label` on non-text interactive elements
- Color contrast ratio ≥ 4.5:1 (text), ≥ 3:1 (large text)
- Focus indicators visible and styled
- Screen reader announcements for dynamic content (`aria-live`)
- No `div` with `onClick` — use `<button>` or `<a>`

---

## 3. Tailwind CSS & Design Tokens

### 3.1 Token-First Approach

**NEVER hardcode colors, spacing, or typography.** All visual values flow from `src/styles/tokens.ts`.

```typescript
// src/styles/tokens.ts — single source of truth
export const tokens = {
  colors: {
    primary: {
      50: '#EFF6FF',
      500: '#3B82F6',
      700: '#1D4ED8',
      900: '#1E3A5F',
    },
    semantic: {
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#3B82F6',
    },
    risk: {
      low: '#10B981',
      moderate: '#F59E0B',
      high: '#EF4444',
      critical: '#7F1D1D',
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['Fira Code', 'monospace'],
    },
  },
};
```

### 3.2 Tailwind Utility Rules

- Use Tailwind utility classes for all styling.
- Avoid inline `style` props except for truly dynamic values (e.g., computed widths).
- Use `cn()` (from `class-variance-authority` or similar) for conditional class merging.
- Group related utilities with arbitrary values sparingly.

---

## 4. Security Best Practices

### 4.1 Healthcare Data Handling (PHI/PII)

- **Never log PII/PHI** — patient names, NIK, addresses, diagnoses, and medications must never appear in logs, console output, or error messages.
- **Encrypt data in transit** — all API calls must use HTTPS in production.
- **Minimize local storage** — avoid persisting sensitive clinical data in `chrome.storage` or `localStorage`.
- **Implement proper access controls** — auth tokens must be validated on every sensitive operation.
- **Regular security audits** — run dependency audits (`pnpm audit`) monthly.

### 4.2 Code Security

- **Validate all inputs** — use Zod schemas for all external data boundaries (API responses, user input, message payloads).
- **Avoid dynamic code execution** — never use `eval()`, `new Function()`, or `setTimeout` with string arguments.
- **Keep dependencies updated** — review and update packages regularly; remove unused dependencies.
- **Content Security Policy** — respect the CSP defined in `wxt.config.ts`; avoid inline scripts.
- **Sanitize DOM output** — when injecting HTML, use DOMPurify or equivalent.

---

## 5. Testing Standards

### 5.1 Coverage Requirements

| Test Type         | Target Coverage    | Scope                                                 |
| ----------------- | ------------------ | ----------------------------------------------------- |
| Unit tests        | 80%+               | All business logic, utilities, and hooks              |
| Integration tests | All critical paths | API clients, bridge interactions, store logic         |
| E2E tests         | Main user flows    | Authentication, diagnosis workflow, forward to doctor |

### 5.2 Test Naming Convention

Follow the pattern: `should[ExpectedBehavior]When[StateUnderTest]`

```typescript
// ✅ Good
it('shouldReturnDiagnosisListWhenPatientDataIsValid', () => { ... });

// ❌ Bad
it('works', () => { ... });
```

### 5.3 Test File Placement

- Co-locate tests with source: `*.test.ts` or `*.test.tsx` next to the file under test.
- E2E tests live in `tests/e2e/`.
- Contract tests are mandatory for all bridge interactions in `lib/api/bridge-client.test.ts`.

### 5.4 Mocking Rules

- Mock external APIs, not internal business logic.
- Keep mocks close to the test or in a `mocks/` folder adjacent to the test.
- Reset mocks in `beforeEach` to prevent test leakage.

---

## 6. Error Handling Patterns

### 6.1 No Silent Catch Blocks

Every `catch` must either log, re-throw, or return a structured error. Never swallow exceptions.

```typescript
// ✅ Good
try {
  await api.submit(data);
} catch (error) {
  logger.error('Submit failed', { error: error instanceof Error ? error.message : String(error) });
  throw error;
}

// ❌ Bad
try {
  await api.submit(data);
} catch (e) {
  // silently swallowed
}
```

### 6.2 Prefer Result Pattern in Business Logic

Use the `Result<T, E>` pattern for functions where the caller is expected to handle both success and failure paths.

```typescript
type Result<T, E = Error> = { ok: true; data: T } | { ok: false; error: E };
```

### 6.3 Error Boundaries in React

Every route-level or major feature component must be wrapped in an error boundary. Use `react-error-boundary` or a class-based implementation.

---

## 7. Logging Standards

### 7.1 Use the Logger Utility

ESLint `no-console` is active (exceptions: `warn`, `error`). Use `createLogger()` from `~/utils/logger` for all application logging.

```typescript
import { createLogger } from '~/utils/logger';

const logger = createLogger('AuthClient');

logger.info('User authenticated', { userId });
logger.warn('Token expiring soon', { expiresAt });
logger.error('API request failed', { endpoint, statusCode });
```

### 7.2 What to Log

| Level   | When to Use                        | Example                            |
| ------- | ---------------------------------- | ---------------------------------- |
| `debug` | Verbose tracing during development | State transitions, loop iterations |
| `info`  | Significant successful events      | User login, data sync completed    |
| `warn`  | Recoverable issues or deprecations | Retry attempt, fallback used       |
| `error` | Failures requiring attention       | API error, unhandled exception     |

### 7.3 What NOT to Log

- **Never log PII/PHI** — no patient names, NIK, medical record numbers, diagnoses, or medication details.
- **Never log secrets** — API keys, tokens, passwords, or OAuth credentials.
- **Keep log objects serializable** — avoid logging Error instances directly; extract `message` and `stack`.

---

## 8. Documentation Standards

### 8.1 Public API Documentation

Every exported function, class, and React component must have a JSDoc comment explaining:

- What it does
- Parameter descriptions
- Return value description
- Example usage (for complex utilities)

```typescript
/**
 * Normalizes an ICD-10 code to a standard format.
 *
 * @param value - The raw ICD code string to normalize.
 * @returns Normalized ICD code in uppercase without spaces, or an empty string if invalid.
 *
 * @example
 * normalizeIcdCode('a10.1') // returns 'A10.1'
 * normalizeIcdCode('  A10.1  ') // returns 'A10.1'
 * normalizeIcdCode('invalid') // returns ''
 */
export function normalizeIcdCode(value: string | undefined): string {
  // implementation
}
```

### 8.2 Component Documentation

For large or complex components, include a file-level JSDoc explaining:

- The component's responsibility
- Key props and their purposes
- Any side effects or external dependencies
- Usage example

### 8.3 Inline Comments

- Explain **why**, not **what**.
- Avoid obvious comments (`// increment i`).
- Use `TODO:` and `FIXME:` sparingly, and always include an issue reference or owner.

---

_Last updated: 2026-04-16 | Owner: Chief | Enforced by: Claudesy_
