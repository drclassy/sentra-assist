# Sentra Assist - Architecture Visualization

## High-Level Architecture

```mermaid
graph TB
    subgraph "Browser Extension"
        subgraph "UI Layer"
            SP[Side Panel UI]
            LG[Login Page]
        end

        subgraph "Logic Layer"
            BG[Background Script]
            CS[Content Script]
            IS[Inject Script]
        end

        subgraph "Data Layer"
            ST[Storage]
            DT[Data Files]
        end
    end

    subgraph "External Systems"
        EP[ePuskesmas EMR]
        SD[Sentra Dashboard API]
        AI[AI Services]
    end

    SP <--> BG
    LG <--> BG
    BG <--> SD
    BG <--> AI
    CS <--> EP
    CS <--> BG
    IS <--> EP

    BG <--> ST
    CS <--> DT
```

## Module Interaction Flow

```mermaid
sequenceDiagram
    participant User as Clinician
    participant SP as Side Panel
    participant BG as Background
    participant CS as Content Script
    participant EP as ePuskesmas
    participant AI as AI Engine

    User->>SP: View Patient Data
    SP->>BG: Request Patient Info
    BG->>CS: Scrape Patient Data
    CS->>EP: Extract Form Data
    EP-->>CS: Patient Information
    CS-->>BG: Clinical Data
    BG->>AI: Request Diagnosis
    AI-->>BG: AI Suggestions
    BG-->>SP: Display Results
    SP-->>User: Show Recommendations
```

## Component Hierarchy

```mermaid
graph TB
    Root[Sentra Assist]

    subgraph "Entry Points"
        BG[background.ts]
        CS[content.ts]
        IS[inject.content.ts]
        LG[login/]
        SP[sidepanel/]
    end

    subgraph "Components"
        CDSS[cdss/]
        CLIN[clinical/]
        SP_UI[sidepanel/]
        UI[ui/]
        PRV[providers/]
    end

    subgraph "Utilities"
        MSG[messaging.ts]
        LOG[logger.ts]
        STR[storage.ts]
        AUD[audio.ts]
        NM[name-masking.ts]
    end

    subgraph "Data"
        DDI[ddi-clinical.json]
        FM[field-mappings.ts]
    end

    subgraph "Types"
        API[api.ts]
    end

    Root --> BG
    Root --> CS
    Root --> IS
    Root --> LG
    Root --> SP

    SP --> CDSS
    SP --> CLIN
    SP --> SP_UI
    SP --> UI
    SP --> PRV

    BG --> MSG
    BG --> LOG
    BG --> STR
    CS --> AUD
    CS --> NM

    BG --> DDI
    CS --> FM

    BG --> API
    CS --> API
```

## Data Flow in Clinical Decision Support

```mermaid
flowchart LR
    A[Patient Data] --> B[Anonymizer]
    B --> C[Red Flag Checker]
    C --> D{Critical?}
    D -->|Yes| E[Immediate Alert]
    D -->|No| F[Symptom Matcher]
    F --> G[Epidemiology Weights]
    G --> H[LLM Reasoner]
    H --> I[Traffic Light Gate]
    I --> J[ICD-10 Validation]
    J --> K[Audit Logger]
    K --> L[Clinical Suggestions]

    style E fill:#ff6b6b
    style L fill:#51cf66
```

## Emergency Detection Gates

```mermaid
graph TB
    subgraph "Emergency Detection System"
        G1[Gate 1: TTV Inference]
        G2[Gate 2: HTN Crisis]
        G3[Gate 3: Glucose Crisis]
        G4[Gate 4: Occult Shock]
    end

    subgraph "Actions"
        A1[Vital Sign Pre-fill]
        A2[Captopril Protocol]
        A3[15-15 Timer]
        A4[Immediate Referral]
    end

    G1 --> A1
    G2 --> A2
    G3 --> A3
    G4 --> A4

    style G1 fill:#4dabf7
    style G2 fill:#ff922b
    style G3 fill:#ff6b6b
    style G4 fill:#c92a2a
```

## DAS (Data Ascension System) Workflow

```mermaid
sequenceDiagram
    participant Page as ePuskesmas Page
    participant Scanner as DAS Scanner
    participant Classifier as Field Classifier
    participant Vision as Gemini Vision
    participant Store as Learning Store
    participant Engine as Iskandar Engine

    Page->>Scanner: Page Load
    Scanner->>Classifier: Enumerate Inputs
    Classifier->>Classifier: Score Fields
    alt Confidence >= 0.85
        Classifier->>Store: Cache Mapping
    else Confidence < 0.85
        Classifier->>Vision: Analyze Fields
        Vision-->>Classifier: Field IDs
        Classifier->>Store: Save Mapping
    end
    Store->>Engine: Normalized Data
    Engine->>Page: Auto-fill Forms
```

## Component Dependencies

```mermaid
graph TD
    subgraph "Core Dependencies"
        React[React 18.3]
        TS[TypeScript]
        WXT[WXT Framework]
    end

    subgraph "UI Dependencies"
        Tailwind[Tailwind CSS]
        Framer[Framer Motion]
        Apex[ApexCharts]
        Lucide[Lucide React]
    end

    subgraph "State & Storage"
        Zustand[Zustand]
        Storage[WXT Storage]
    end

    subgraph "Testing"
        Vitest[Vitest]
        Playwright[Playwright]
    end

    React --> TS
    WXT --> React
    Tailwind --> React
    Framer --> React
    Apex --> React
    Lucide --> React
    Zustand --> React
    Storage --> WXT
    Vitest --> TS
    Playwright --> TS
```

## Message Flow Between Extension Components

```mermaid
sequenceDiagram
    participant SP as Side Panel
    participant BG as Background Script
    participant CS as Content Script
    participant IS as Inject Script

    SP->>BG: Request Data
    BG->>CS: Execute Scrape
    CS->>IS: Access Page Context
    IS-->>CS: DOM Elements
    CS-->>BG: Scraped Data
    BG-->>SP: Response Data

    Note over SP,BG: Message Protocol
    Note over BG,CS: Content Script Bridge
    Note over CS,IS: Page Context Access
```

## Clinical Data Processing Pipeline

```mermaid
flowchart TB
    subgraph "Input"
        A1[Anamnesa Data]
        A2[Vital Signs]
        A3[Laboratory Results]
    end

    subgraph "Processing"
        B1[Data Validation]
        B2[Red Flag Check]
        B3[Diagnosis Engine]
        B4[Drug Interaction Check]
    end

    subgraph "Output"
        C1[Clinical Alerts]
        C2[Diagnosis Suggestions]
        C3[Medication Recommendations]
        C4[Auto-fill Data]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B1
    B1 --> B2
    B2 --> B3
    B3 --> B4
    B2 --> C1
    B3 --> C2
    B4 --> C3
    B4 --> C4
```

## File System Structure

```mermaid
graph TB
    Root[sentra-assist/]

    Root --> EP[entrypoints/]
    Root --> CMP[components/]
    Root --> UTIL[utils/]
    Root --> DATA[data/]
    Root --> TYPES[types/]
    Root --> DOCS[docs/]
    Root --> PUB[public/]

    EP --> BG[background.ts]
    EP --> CS[content.ts]
    EP --> IS[inject.content.ts]
    EP --> LG[login/]
    EP --> SP[sidepanel/]

    CMP --> CDSS[cdss/]
    CMP --> CLIN[clinical/]
    CMP --> SP_UI[sidepanel/]
    CMP --> UI[ui/]
    CMP --> PRV[providers/]

    UTIL --> MSG[messaging.ts]
    UTIL --> LOG[logger.ts]
    UTIL --> STR[storage.ts]

    DATA --> DDI[ddi-clinical.json]
    DATA --> FM[field-mappings.ts]

    TYPES --> API[api.ts]

    DOCS --> ADR[adr/]
    DOCS --> ARCH[architecture/]
    DOCS --> API_DOC[api/]

    PUB --> ASSETS[assets/]
    PUB --> FONTS[fonts/]
    PUB --> ICON[icon/]
```

## RME Transfer Orchestrator Flow

```mermaid
sequenceDiagram
    participant Doc as Doctor
    participant SP as Side Panel
    participant Orch as Orchestrator
    participant Bridge as Dashboard Bridge
    participant EP as ePuskesmas

    Doc->>SP: Confirm Referral
    SP->>Orch: Initiate Transfer
    Orch->>Bridge: Register Request
    Bridge-->>Orch: Transfer ID
    Orch->>EP: Fill Anamnesa
    Orch->>EP: Fill Diagnosa
    Orch->>EP: Fill Resep
    EP-->>Orch: Confirm Submit
    Orch->>Bridge: Complete Transfer
    Bridge-->>SP: Transfer Complete
    SP-->>Doc: Success Notification
```
