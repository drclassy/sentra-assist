# API Documentation

This document describes the key API endpoints used by Sentra Assist for authentication, clinical data, and AI services.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Doctor Presence](#doctor-presence)
3. [Clinical Consult](#clinical-consult)
4. [Patient Data & Visit History](#patient-data--visit-history)
5. [Clinical Engine (Canonical)](#clinical-engine-canonical)
6. [Error Handling](#error-handling)

---

## Base URLs

| Environment | Base URL                                               |
| ----------- | ------------------------------------------------------ |
| Production  | `https://primary-healthcare-production.up.railway.app` |
| Local / Dev | Configured via `VITE_SENTRA_API_URL` in `.env.local`   |

---

## Authentication

Sentra Assist uses server-backed authentication via the Dashboard API. The extension does not manage credentials directly; instead, it delegates auth checks to the background script and the Dashboard backend.

### Check Auth Status

```http
GET /api/auth/me
```

**Headers:**

```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Response (200):**

```json
{
  "id": "user-uuid",
  "name": "Dr. Example",
  "role": "doctor",
  "facilityId": "PUSKESMAS_BALOWERTI"
}
```

**Response (401):**

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

---

## Doctor Presence

### List Online Doctors

Retrieves the list of available doctors for the "Forward to Doctor" feature.

```http
GET /api/doctors/online
```

**Headers:**

```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Response (200):**

```json
{
  "doctors": [
    {
      "id": "doc-001",
      "name": "Dr. Budi Santoso",
      "specialization": "Umum",
      "poli": "Poli Umum",
      "facility": "PUSKESMAS_BALOWERTI",
      "availability_status": "online",
      "last_heartbeat": "2026-04-16T10:00:00Z"
    }
  ]
}
```

The frontend ranks doctors by:

1. `availability_status` (`online` > `away` > `offline`)
2. Poli match with current patient context
3. Facility match
4. Alphabetically by name

---

## Clinical Consult

### Submit Consult

Sends a clinical consultation request from the assisting healthcare worker to a selected doctor.

```http
POST /api/consult
```

**Headers:**

```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "doctorId": "doc-001",
  "patientRm": "123456",
  "patientName": "Ahmad Fauzi",
  "keluhanUtama": "Sakit kepala berdenyut 3 hari",
  "diagnosis": ["G44.1", "R51"],
  "ttv": {
    "systolic": 130,
    "diastolic": 85,
    "heartRate": 78,
    "respiratoryRate": 18,
    "temperature": 36.7,
    "spo2": 98
  },
  "riwayatAlergi": ["Penisilin"],
  "penyakitKhusus": ["Diabetes Melitus"],
  "risikoKehamilan": null,
  "disabilitas": "Tidak",
  "obesitas": "Tidak Terkonfirmasi",
  "medication": ["Parasetamol 500mg"],
  "notes": "Pasien mengeluh pusing saat berdiri"
}
```

**Response (201):**

```json
{
  "consultId": "consult-uuid",
  "status": "submitted",
  "submittedAt": "2026-04-16T10:05:00Z"
}
```

**Response (400):**

```json
{
  "error": "Bad Request",
  "message": "doctorId is required",
  "field": "doctorId"
}
```

**Response (422):**

```json
{
  "error": "Unprocessable Entity",
  "message": "Selected doctor is no longer online"
}
```

---

## Patient Data & Visit History

### Get Patient Visit History

Retrieves historical visit data for a patient, used in trajectory analysis.

```http
GET /api/patients/:rm/visits
```

**Headers:**

```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Response (200):**

```json
{
  "patientRm": "123456",
  "visits": [
    {
      "visitId": "v-001",
      "date": "2026-03-10",
      "diagnosis": ["J06.9"],
      "ttv": {
        "systolic": 120,
        "diastolic": 80,
        "heartRate": 72,
        "temperature": 36.5
      }
    },
    {
      "visitId": "v-002",
      "date": "2026-02-15",
      "diagnosis": ["K30"],
      "ttv": {
        "systolic": 118,
        "diastolic": 78,
        "heartRate": 70,
        "temperature": 36.6
      }
    }
  ],
  "status": "ready"
}
```

**Note:** If fewer than 3 visits are available, `status` will be `insufficient` and trajectory analysis will display `Data not available`.

---

## Clinical Engine (Canonical)

These endpoints are part of the Dashboard canonical clinical engine. Sentra Assist acts as a client to this engine.

### Evaluate Clinical Trajectory

```http
POST /api/clinical/trajectory
```

**Request Body (TriageInput):**

```json
{
  "patient": {
    "rm": "123456",
    "age": 35,
    "gender": "L"
  },
  "currentVisit": {
    "ttv": {
      "systolic": 130,
      "diastolic": 85,
      "heartRate": 78,
      "respiratoryRate": 18,
      "temperature": 36.7,
      "spo2": 98
    },
    "symptoms": ["Sakit kepala", "Mual"],
    "diagnosisCodes": ["G44.1"]
  },
  "visitHistory": [{ "date": "2026-03-10", "diagnosisCodes": ["J06.9"] }]
}
```

**Response (200):**

```json
{
  "riskLevel": "LOW",
  "alerts": [
    {
      "type": "vital",
      "severity": "info",
      "message": "TTV dalam batas normal"
    }
  ],
  "trajectory": {
    "trend": "stable",
    "summary": "Kondisi pasien stabil dibandingkan kunjungan sebelumnya"
  }
}
```

### Evaluate Diagnosis Support

```http
POST /api/clinical/evaluate
```

**Request Body:**

```json
{
  "patient": {
    "age": 35,
    "gender": "L"
  },
  "symptoms": ["Sakit kepala berdenyut", "Mual"],
  "vitals": {
    "systolic": 130,
    "diastolic": 85,
    "heartRate": 78
  },
  "currentDiagnoses": ["G44.1"]
}
```

**Response (200):**

```json
{
  "suggestions": [
    {
      "icd10": "R51",
      "name": "Headache",
      "confidence": 0.72,
      "reasoning": "Sakit kepala berdenyut tanpa tanda neurologis defisit"
    }
  ],
  "redFlags": [],
  "recommendations": ["Pertimbangkan analgesik jika tidak ada kontraindikasi"]
}
```

---

## Error Handling

### Standard Error Response Format

All API errors follow this structure:

```json
{
  "error": "ErrorCode",
  "message": "Human-readable description",
  "details": {}
}
```

### Common HTTP Status Codes

| Status | Meaning               | Typical Cause                                  |
| ------ | --------------------- | ---------------------------------------------- |
| 200    | OK                    | Request succeeded                              |
| 201    | Created               | Resource created successfully                  |
| 400    | Bad Request           | Missing or invalid request fields              |
| 401    | Unauthorized          | Invalid or missing authentication token        |
| 403    | Forbidden             | User lacks permission for the requested action |
| 404    | Not Found             | Resource does not exist                        |
| 422    | Unprocessable Entity  | Business rule violation                        |
| 429    | Too Many Requests     | Rate limit exceeded                            |
| 500    | Internal Server Error | Server-side failure                            |
| 503    | Service Unavailable   | Temporary downtime or overload                 |

### Client-Side Retry Strategy

- **400, 401, 403, 404, 422:** Do not retry. Surface the error to the user.
- **429:** Retry after the delay specified in the `Retry-After` header (exponential backoff).
- **500, 503:** Retry up to 2 times with exponential backoff (1s, 2s).

---

_Last updated: 2026-04-16 | Owner: Chief_
