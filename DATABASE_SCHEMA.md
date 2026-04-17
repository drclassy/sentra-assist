# Sentra Assist - Database Schema Visualization

## Overview
Dokumen ini menampilkan struktur database dan data yang digunakan dalam Sentra Assist.

## 1. Drug-Drug Interaction (DDI) Database

```mermaid
erDiagram
    DRUG ||--o{ INTERACTION : has
    INTERACTION ||--|| SEVERITY : has
    INTERACTION ||--o{ MECHANISM : has

    DRUG {
        string id PK
        string name
        string generic_name
        string category
        string strength
    }

    INTERACTION {
        string id PK
        string drug_id FK
        string interacting_drug_id FK
        string severity_id FK
        string description
        string recommendation
        string evidence_level
    }

    SEVERITY {
        string id PK
        string level "MAJOR/MODERATE/MINOR"
        string color_code
        string action_required
    }

    MECHANISM {
        string id PK
        string interaction_id FK
        string mechanism_type
        string description
    }
```

## 2. Epidemiology Weights Database

```mermaid
erDiagram
    DISEASE ||--o{ EPIDEMIOLOGY_WEIGHT : has
    EPIDEMIOLOGY_WEIGHT ||--|| AGE_GROUP : belongs_to
    EPIDEMIOLOGY_WEIGHT ||--|| REGION : belongs_to

    DISEASE {
        string icd10_code PK
        string name
        string category
        string symptoms[]
        string red_flags[]
    }

    EPIDEMIOLOGY_WEIGHT {
        string id PK
        string disease_id FK
        string age_group_id FK
        string region_id FK
        float prior_probability
        int case_count
        date last_updated
    }

    AGE_GROUP {
        string id PK
        string name
        int min_age
        int max_age
    }

    REGION {
        string id PK
        string name
        string province
        string district
    }
```

## 3. ICD-10 Database Structure

```mermaid
erDiagram
    ICD10_CHAPTER ||--o{ ICD10_CATEGORY : contains
    ICD10_CATEGORY ||--o{ ICD10_CODE : contains
    ICD10_CODE ||--o{ SYMPTOM : associated_with
    ICD10_CODE ||--o{ TREATMENT : has_recommended

    ICD10_CHAPTER {
        string chapter_code PK "A-Z"
        string title
        string description
        int range_start
        int range_end
    }

    ICD10_CATEGORY {
        string category_code PK "e.g., J00-J99"
        string chapter_code FK
        string title
        string description
    }

    ICD10_CODE {
        string code PK "e.g., J06.9"
        string category_code FK
        string name
        string english_name
        string description
        string severity
        string[] red_flags
        string[] recommended_tests
    }

    SYMPTOM {
        string id PK
        string icd10_code FK
        string symptom_name
        float relevance_score
    }

    TREATMENT {
        string id PK
        string icd10_code FK
        string treatment_name
        string type
        string recommendation_level
    }
```

## 4. Patient Encounter Storage

```mermaid
erDiagram
    PATIENT ||--o{ ENCOUNTER : has
    ENCOUNTER ||--|| VITAL_SIGNS : has
    ENCOUNTER ||--o{ ANAMNESA : has
    ENCOUNTER ||--o{ DIAGNOSIS : has
    ENCOUNTER ||--o{ PRESCRIPTION : has

    PATIENT {
        string id PK
        string masked_name
        date birth_date
        string gender
        string[] allergies
        string[] chronic_conditions
        string facility_id
    }

    ENCOUNTER {
        string id PK
        string patient_id FK
        datetime timestamp
        string encounter_type
        string provider_role
        string status
    }

    VITAL_SIGNS {
        string encounter_id PK
        float systolic_bp
        float diastolic_bp
        float heart_rate
        float respiratory_rate
        float temperature
        float weight
        float height
        string glucose_level
        string glucose_type
    }

    ANAMNESA {
        string encounter_id PK
        string chief_complaint
        string additional_complaints
        string duration
        string history
        string[] symptoms
        string physical_exam
        int pain_scale
    }

    DIAGNOSIS {
        string id PK
        string encounter_id FK
        string icd10_code
        string diagnosis_name
        string diagnosis_type
        float confidence_score
        string[] red_flags
        string[] recommended_actions
    }

    PRESCRIPTION {
        string id PK
        string encounter_id FK
        string drug_name
        string dosage
        string frequency
        string duration
        string instructions
        string safety_status
        string[] interactions
    }
```

## 5. Audit Trail Database

```mermaid
erDiagram
    AUDIT_ENTRY ||--|| EVENT_TYPE : has
    AUDIT_ENTRY ||--o{ AUDIT_DETAIL : has

    AUDIT_ENTRY {
        string id PK
        string event_type_id FK
        datetime timestamp
        string user_id
        string session_id
        string hash "SHA-256"
        string previous_hash
        string ip_address
        string facility_id
    }

    EVENT_TYPE {
        string id PK
        string name
        string category
        string severity
    }

    AUDIT_DETAIL {
        string id PK
        string audit_entry_id FK
        string key
        string value
        string data_type
    }
```

## 6. Field Mappings Storage

```mermaid
erDiagram
    FIELD_MAPPING ||--|| PAGE_TYPE : belongs_to
    FIELD_MAPPING ||--o{ MAPPING_VERSION : has_versions
    MAPPING_VERSION ||--o{ CONFIDENCE_SCORE : has

    FIELD_MAPPING {
        string id PK
        string page_type_id FK
        string field_name
        string field_type
        string selector
        string[] alternative_selectors
        float confidence_score
        string last_validated
        string status
    }

    PAGE_TYPE {
        string id PK
        string name "anamnesa/diagnosa/resep"
        string url_pattern
        string[] required_fields
    }

    MAPPING_VERSION {
        string id PK
        string field_mapping_id FK
        string selector
        float confidence_score
        datetime created_at
        string source "manual/vision/learning"
    }

    CONFIDENCE_SCORE {
        string id PK
        string version_id FK
        float score
        string method
        datetime calculated_at
    }
```

## 7. Drug Inventory Database

```mermaid
erDiagram
    DRUG_INVENTORY ||--|| FACILITY : belongs_to
    DRUG_INVENTORY ||--|| DRUG_CATEGORY : in_category

    DRUG_INVENTORY {
        string id PK
        string facility_id FK
        string drug_name
        string generic_name
        string category_id FK
        int quantity
        string unit
        string strength
        float price
        string expiry_date
        string supplier
        string status
    }

    FACILITY {
        string id PK
        string name
        string type
        string address
        string district
        string province
        string contact
    }

    DRUG_CATEGORY {
        string id PK
        string name
        string description
        string[] subcategories
    }
```

## 8. Clinical Rules Database

```mermaid
erDiagram
    CLINICAL_RULE ||--|| RULE_CATEGORY : belongs_to
    CLINICAL_RULE ||--o{ RULE_CONDITION : has
    CLINICAL_RULE ||--o{ RULE_ACTION : has

    CLINICAL_RULE {
        string id PK
        string category_id FK
        string name
        string description
        string priority
        string status
        string gate_number "1-4"
    }

    RULE_CATEGORY {
        string id PK
        string name "TTV/HTN/GLUCOSE/SHOCK"
        string description
    }

    RULE_CONDITION {
        string id PK
        string rule_id FK
        string parameter
        string operator
        string value
        string logical_operator
    }

    RULE_ACTION {
        string id PK
        string rule_id FK
        string action_type
        string message
        string[] steps
        string urgency
    }
```

## Data Flow Diagram

```mermaid
flowchart TB
    subgraph "Input Sources"
        EP[ePuskesmas Forms]
        AI[AI Engine]
        USER[Clinician Input]
    end

    subgraph "Processing"
        VAL[Data Validation]
        ANON[Anonymization]
        RULE[Rule Engine]
        DDI[DDI Checker]
    end

    subgraph "Storage"
        PAT[Patient Data]
        ENC[Encounter Records]
        AUDIT[Audit Trail]
        MAP[Field Mappings]
    end

    subgraph "Output"
        ALERTS[Clinical Alerts]
        DIAG[Diagnosis Suggestions]
        RX[Prescription Recommendations]
    end

    EP --> VAL
    AI --> VAL
    USER --> VAL
    VAL --> ANON
    ANON --> RULE
    RULE --> DDI
    RULE --> PAT
    RULE --> ENC
    DDI --> AUDIT
    RULE --> AUDIT
    VAL --> MAP
    RULE --> ALERTS
    RULE --> DIAG
    DDI --> RX
```
