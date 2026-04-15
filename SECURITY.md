# Security Policy

This document outlines the security practices, policies, and procedures for Sentra Assist. Given that this project handles healthcare data, security is a top priority.

---

## Table of Contents

1. [Supported Versions](#supported-versions)
2. [Security Best Practices](#security-best-practices)
3. [Healthcare Data Handling](#healthcare-data-handling)
4. [Reporting Vulnerabilities](#reporting-vulnerabilities)
5. [Incident Response](#incident-response)
6. [Compliance](#compliance)

---

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | ✅ Yes    |
| < 1.0   | ❌ No     |

Only the latest minor version within the current major release receives security updates.

---

## Security Best Practices

### Code Security

- **Input Validation:** All external inputs (API responses, user input, DOM scraping results) are validated using Zod schemas before processing.
- **No Dynamic Execution:** We do not use `eval()`, `new Function()`, or inline script injection.
- **Content Security Policy (CSP):** The extension enforces a strict CSP via `wxt.config.ts`:
  ```
  script-src 'self'; object-src 'self'; font-src 'self' data:;
  ```
- **Dependency Management:** Dependencies are regularly audited with `pnpm audit`. Unused or vulnerable dependencies are removed promptly.
- **Least Privilege:** The extension requests only the minimum permissions required (`activeTab`, `storage`, `sidePanel`, `identity`, `scripting`, `alarms`).

### Authentication & Authorization

- The extension does not store user passwords. Authentication is delegated to the Dashboard server, which acts as the source of truth.
- Auth tokens are handled securely and never logged or exposed to content scripts.
- All sensitive API calls require a valid Bearer token.

### Network Security

- All production API communication uses HTTPS.
- Host permissions in the manifest are restricted to known, approved domains.
- Local development endpoints (`http://localhost:*`) are only permitted in development builds.

---

## Healthcare Data Handling

### Protected Health Information (PHI/PII)

Sentra Assist operates in a healthcare environment. We enforce strict rules for handling sensitive data:

| Rule                      | Requirement                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **No Logging of PHI**     | Patient names, NIK, MR numbers, diagnoses, medications, and addresses must never appear in logs, console output, or error trackers. |
| **No Committing PHI**     | No patient data may be committed to the repository, even in test fixtures or mock data.                                             |
| **Minimal Local Storage** | Sensitive clinical data is not persisted in `chrome.storage` or `localStorage` longer than necessary for the active session.        |
| **Encrypted in Transit**  | All API communication must use TLS/HTTPS in production.                                                                             |

### Safe Logging Examples

```typescript
// ✅ Good — logs IDs only, never patient names
logger.info('Patient data fetched', { patientRm: '123456' });

// ❌ Bad — logs PII
logger.info('Patient data fetched', { name: 'Ahmad Fauzi', diagnosis: 'Diabetes' });
```

---

## Reporting Vulnerabilities

If you discover a security vulnerability in Sentra Assist, please report it responsibly:

1. **Do NOT open a public issue.**
2. Email the details to: **Chief / Claudesy** (Primary Contact)
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a timeline for resolution.

---

## Incident Response

In the event of a confirmed security incident (data breach, unauthorized access, or exposure of PHI):

1. **Stop all changes** immediately. Do not commit or deploy.
2. **Document the incident** in `.agent/HANDOFF.md` with:
   - What happened
   - When it was discovered
   - Scope of impact
   - Steps taken so far
3. **Notify the Primary Contact:** Chief / Claudesy
4. **Escalation Path:**
   - Level 1: Chief / Claudesy
   - Level 2: Sentra (Principal Infrastructure Engineer)
   - Level 3: Healthcare compliance officer
5. **Preserve evidence** — do not delete logs or modify systems until instructed.

---

## Compliance

Sentra Assist is designed with the following frameworks in mind:

- **HIPAA Security Rule (45 CFR §164.312)** — Technical safeguards for electronic PHI
- **PDPA (Indonesia)** — Personal data protection requirements
- **OWASP ASVS v5.0** — Application security verification
- **NIST Cybersecurity Framework 2.0** — Risk management and incident response

All contributors are expected to follow these standards. For coding-specific security requirements, see [`CODING_STANDARD.md`](CODING_STANDARD.md#4-security-best-practices).

---

_Last updated: 2026-04-16 | Owner: Chief_
