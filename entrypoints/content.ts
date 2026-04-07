// Designed and constructed by Claudesy.
/**
 * Precision-Architected. Future-Built by Docsynapse
 * Sentra Healthcare Artificial Intelligence
 */

/**
 * Sentra Assist - Main Content Script
 * Runs on ePuskesmas pages, handles DOM operations
 *
 * Message Protocol (aligned with utils/messaging.ts):
 * - execFill: Execute auto-fill on current page
 * - execScrape: Scrape data from current page
 * - pageReady: Notify background that page is ready
 */

// DAS - Data Ascension System
import type { MapperOptions, ScanOptions } from '@/lib/das/types'
import { fillAnamnesaForm, initAnamnesaPage } from '@/lib/handlers/page-anamnesa'
import { fillDiagnosaForm, initDiagnosaPage } from '@/lib/handlers/page-diagnosa'
import { fillResepForm, initResepPage, scrapeResepForm } from '@/lib/handlers/page-resep'
import { scrapeAnamnesa } from '@/lib/scraper/anamnesa'
import { createLogger } from '@/utils/logger'
import { sendMessage } from '@/utils/messaging'
import type {
  AnamnesaFillPayload,
  DiagnosaFillPayload,
  PageReadyInfo,
  ResepFillPayload,
} from '@/utils/types'

const contentLog = createLogger('SentraContent', 'content')

export default defineContentScript({
  matches: ['*://*.epuskesmas.id/*'],
  main() {
    // Page state
    let currentPage: string | null = null
    let isReady = false

    // Debug logging
    const debug = (msg: string, data?: unknown) => {
      contentLog.debug(`[SentraContent] ${msg}`, data ? data : '')
    }

    // Get current page type - Extended patterns for ePuskesmas
    const getCurrentPage = (): string | null => {
      const href = window.location.href.toLowerCase()

      // Anamnesa patterns (various ePuskesmas URL formats)
      if (
        href.includes('/anamnesa/') ||
        href.includes('/anamnesa') ||
        href.includes('anamnesis') ||
        href.includes('/anamnesis/') ||
        href.includes('/pelayanan/') ||
        href.includes('/rawat_jalan/') ||
        href.includes('/rawatjalan/') ||
        href.includes('/pemeriksaan/')
      ) {
        return 'anamnesa'
      }

      // SOAP patterns
      if (href.includes('/soap/') || href.includes('/soap') || href.includes('subjektif')) {
        return 'soap'
      }

      // Resep/Prescription patterns
      if (
        href.includes('/resep/') ||
        href.includes('/resep') ||
        href.includes('/terapi/') ||
        href.includes('/obat/') ||
        href.includes('prescription')
      ) {
        return 'resep'
      }

      // Diagnosa/Diagnosis patterns
      if (
        href.includes('/diagnosa/') ||
        href.includes('/diagnosa') ||
        href.includes('/diagnosis/') ||
        href.includes('/diagnosis') ||
        href.includes('/icd10/') ||
        href.includes('/icd-10/')
      ) {
        return 'diagnosa'
      }

      return null
    }

    const normalizeName = (value: string): string =>
      value.replace(/\s+/g, ' ').replace(/[|]/g, '').trim()

    const isPlausibleName = (value: string, role: 'dokter' | 'perawat'): boolean => {
      const normalized = normalizeName(value)
      if (!normalized || normalized.length < 3) return false

      const lower = normalized.toLowerCase()
      const blocked = [
        'dr. sentra ai',
        'perawat sentra',
        'unknown',
        'tidak diketahui',
        'n/a',
        'null',
        'undefined',
        '-',
      ]
      if (blocked.some(item => lower === item)) return false
      if (role === 'dokter' && lower.includes('perawat')) return false
      return true
    }

    const readSelectorValue = (selector: string): string => {
      const el = document.querySelector(selector)
      if (!el) return ''
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        return normalizeName(el.value || el.getAttribute('value') || '')
      }
      if (el instanceof HTMLSelectElement) {
        return normalizeName(el.value || el.options[el.selectedIndex]?.text || '')
      }
      return normalizeName(el.textContent || '')
    }

    const firstNonEmpty = (selectors: string[]): string => {
      for (const selector of selectors) {
        const value = readSelectorValue(selector)
        if (value) return value
      }
      return ''
    }

    const persistTenagaMedis = (dokterNama: string, perawatNama: string): void => {
      const snapshot = JSON.stringify({
        dokterNama,
        perawatNama,
        capturedAt: new Date().toISOString(),
      })
      try {
        localStorage.setItem('sentra_tenaga_medis', snapshot)
        if (dokterNama) {
          localStorage.setItem('epuskesmas_doctor_name', dokterNama)
          sessionStorage.setItem('epuskesmas_doctor_name', dokterNama)
        }
        if (perawatNama) {
          localStorage.setItem('epuskesmas_nurse_name', perawatNama)
          sessionStorage.setItem('epuskesmas_nurse_name', perawatNama)
        }
      } catch {
        // Storage may be blocked by browser policy; non-fatal.
      }
    }

    const readStoredTenagaMedis = (): { dokterNama: string; perawatNama: string } => {
      try {
        const raw = localStorage.getItem('sentra_tenaga_medis')
        if (raw) {
          const parsed = JSON.parse(raw) as { dokterNama?: string; perawatNama?: string }
          return {
            dokterNama: normalizeName(parsed.dokterNama || ''),
            perawatNama: normalizeName(parsed.perawatNama || ''),
          }
        }
      } catch {
        // ignore malformed storage
      }

      const dokterNama = normalizeName(
        localStorage.getItem('epuskesmas_doctor_name') ||
          sessionStorage.getItem('epuskesmas_doctor_name') ||
          ''
      )
      const perawatNama = normalizeName(
        localStorage.getItem('epuskesmas_nurse_name') ||
          sessionStorage.getItem('epuskesmas_nurse_name') ||
          ''
      )
      return { dokterNama, perawatNama }
    }

    const scrapeTenagaMedis = (): {
      dokterNama: string
      perawatNama: string
      source: string[]
    } => {
      const source: string[] = []
      const stored = readStoredTenagaMedis()

      const dokterSelectors = [
        'input[name="dokter_nama_bpjs"]',
        'input[name="dokter_nama"]',
        'input[name="dokter"]',
        'input[name*="dokter"]',
        'input[placeholder*="Dokter"]',
        'input[placeholder*="dokter"]',
        'input[id*="dokter"]',
      ]
      const perawatSelectors = [
        'input[name="perawat_nama"]',
        'input[name="perawat"]',
        'input[name*="perawat"]',
        'input[name*="bidan"]',
        'input[placeholder*="Perawat"]',
        'input[placeholder*="perawat"]',
        'input[placeholder*="Bidan"]',
        'input[placeholder*="bidan"]',
        'input[id*="perawat"]',
      ]

      let dokterNama = firstNonEmpty(dokterSelectors)
      if (dokterNama) source.push('dom-input:dokter')
      let perawatNama = firstNonEmpty(perawatSelectors)
      if (perawatNama) source.push('dom-input:perawat')

      const pageText = document.body?.innerText || ''
      if (!dokterNama) {
        const dokterMatch = pageText.match(
          /(?:Dokter|Dokter Pemeriksa|DPJP)\s*[:-]\s*([^\n\r|,]{3,120})/i
        )
        if (dokterMatch?.[1]) {
          dokterNama = normalizeName(dokterMatch[1])
          source.push('dom-text:dokter')
        }
      }
      if (!perawatNama) {
        const perawatMatch = pageText.match(/(?:Perawat|Bidan|Ners)\s*[:-]\s*([^\n\r|,]{3,120})/i)
        if (perawatMatch?.[1]) {
          perawatNama = normalizeName(perawatMatch[1])
          source.push('dom-text:perawat')
        }
      }

      if (!dokterNama || !perawatNama) {
        const userName = normalizeName(
          firstNonEmpty(['.username', '.user-name', '.logged-in-user', '.current-user'])
        )
        if (userName) {
          if (!dokterNama && /^dr\.?\s/i.test(userName)) {
            dokterNama = userName
            source.push('user-banner:dokter')
          }
          if (!perawatNama && !/^dr\.?\s/i.test(userName)) {
            perawatNama = userName
            source.push('user-banner:perawat')
          }
        }
      }

      if (!dokterNama && stored.dokterNama) {
        dokterNama = stored.dokterNama
        source.push('storage:dokter')
      }
      if (!perawatNama && stored.perawatNama) {
        perawatNama = stored.perawatNama
        source.push('storage:perawat')
      }

      if (!isPlausibleName(dokterNama, 'dokter')) dokterNama = ''
      if (!isPlausibleName(perawatNama, 'perawat')) perawatNama = ''

      if (dokterNama || perawatNama) {
        persistTenagaMedis(dokterNama, perawatNama)
      }

      return { dokterNama, perawatNama, source }
    }

    // Initialize content script
    const init = () => {
      contentLog.debug('Content script initialized on', window.location.href)
      debug('Initializing content script')

      // Check which page we're on
      currentPage = getCurrentPage()
      debug('Current page detected:', currentPage)

      // Initialize page-specific handlers
      if (currentPage === 'resep') {
        initResepPage()
      } else if (currentPage === 'anamnesa' || currentPage === 'soap') {
        initAnamnesaPage()
      } else if (currentPage === 'diagnosa') {
        initDiagnosaPage()
      }

      // Extract pelayananId from URL if present
      const getPelayananId = (): string | null => {
        const match = window.location.href.match(/\/(\d+)(?:\/|$)/)
        return match ? match[1] : null
      }

      // Notify background script that we're ready
      sendMessage('pageReady', {
        pageType: (currentPage || 'unknown') as PageReadyInfo['pageType'],
        pelayananId: getPelayananId(),
        url: window.location.href,
      })

      isReady = true
    }

    // Message handlers
    const messageHandlers: Record<string, (data: unknown) => unknown> = {
      execFill: async (data: unknown) => {
        const payload = data as { type: string; encounter: Record<string, unknown> }
        debug('Received execFill', payload)

        // Re-detect page type if null (handles SPA navigation or late init)
        if (!currentPage) {
          currentPage = getCurrentPage()
          debug('Re-detected page type:', currentPage)
        }

        try {
          // Route to page-specific handler based on PAYLOAD TYPE (not currentPage)
          // This allows explicit fill requests to proceed even if page detection fails
          if (payload.type === 'resep') {
            debug('Routing to fillResepForm')
            const result = await fillResepForm(payload.encounter as unknown as ResepFillPayload)
            return result
          }

          if (payload.type === 'anamnesa') {
            // Use direct handler for anamnesa/TTV - DO NOT require currentPage match
            contentLog.debug('Content script received anamnesa fill request')
            contentLog.debug('Current page =', currentPage)
            contentLog.debug(
              'Payload.encounter =',
              JSON.stringify(payload.encounter).substring(0, 200)
            )
            debug('Using direct Anamnesa handler with payload')
            const result = await fillAnamnesaForm(
              payload.encounter as unknown as AnamnesaFillPayload
            )
            contentLog.debug('fillAnamnesaForm result =', JSON.stringify(result).substring(0, 300))
            return result
          }

          if (payload.type === 'diagnosa') {
            // Use direct handler for diagnosa/ICD-10 - DO NOT require currentPage match
            console.warn('🚨 [SENTRA DIAGNOSA] Content script received execFill for diagnosa')
            console.warn('🚨 [SENTRA DIAGNOSA] Payload:', payload.encounter)
            contentLog.debug('[SentraContent] Routing to fillDiagnosaForm')
            debug('Using Diagnosa handler with DAS integration')
            const result = await fillDiagnosaForm(
              payload.encounter as unknown as DiagnosaFillPayload
            )
            console.warn('🚨 [SENTRA DIAGNOSA] Fill result:', result)
            contentLog.debug(
              '[SentraContent] fillDiagnosaForm result:',
              JSON.stringify(result).substring(0, 300)
            )
            return result
          }

          return {
            success: false,
            error: `Unsupported fill type for ALPHA v3 runtime: ${String(payload.type || 'unknown')}`,
          }
        } catch (error) {
          debug('Fill error:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      execScrape: async (data: unknown) => {
        const payload = data as { type: string }
        debug('Received execScrape', payload)

        if (!currentPage) {
          return { success: false, error: 'Unknown page type' }
        }

        try {
          let scrapedData = {}

          switch (currentPage) {
            case 'resep':
              scrapedData = await scrapeResepForm()
              break
            case 'anamnesa':
              scrapedData = await scrapeAnamnesa()
              break
            default:
              return { success: false, error: `Scraping not implemented for ${currentPage}` }
          }

          return { success: true, data: scrapedData }
        } catch (error) {
          debug('Scrape error:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      getPageInfo: (_data: unknown) => {
        return {
          page: currentPage,
          url: window.location.href,
          title: document.title,
          isReady,
        }
      },

      getCurrentPageType: (_data: unknown) => {
        const detected = getCurrentPage()
        currentPage = detected
        return {
          pageType: detected || 'unknown',
          url: window.location.href,
          isReady,
        }
      },

      resolveTenagaMedis: (_data: unknown) => {
        const tenagaMedis = scrapeTenagaMedis()
        if (!tenagaMedis.dokterNama && !tenagaMedis.perawatNama) {
          return {
            success: false,
            error: 'Nama dokter/perawat tidak ditemukan di halaman aktif.',
            tenagaMedis: {
              dokterNama: '',
              perawatNama: '',
              source: tenagaMedis.source,
              capturedAt: new Date().toISOString(),
            },
          }
        }
        return {
          success: true,
          tenagaMedis: {
            dokterNama: tenagaMedis.dokterNama,
            perawatNama: tenagaMedis.perawatNama,
            source: tenagaMedis.source,
            capturedAt: new Date().toISOString(),
          },
        }
      },

      // Diagnostic: Scan all input fields on the page
      scanFields: (_data: unknown) => {
        debug('Scanning all input fields on page...')

        const fields: Array<{
          tag: string
          type: string
          name: string
          id: string
          placeholder: string
          className: string
        }> = []

        // Scan all inputs
        document.querySelectorAll('input, textarea, select').forEach(el => {
          const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
          fields.push({
            tag: el.tagName.toLowerCase(),
            type: (input as HTMLInputElement).type || 'text',
            name: input.name || '',
            id: input.id || '',
            placeholder: (input as HTMLInputElement).placeholder || '',
            className: input.className || '',
          })
        })

        contentLog.debug('[SentraContent] Found fields:', fields)
        return { success: true, fields }
      },

      // Scan medical history from ePuskesmas page (riwayat penyakit table)
      scanMedicalHistory: (_data: unknown) => {
        debug('Scanning medical history from page...')

        const history: Array<{
          code: string
          description: string
          shortLabel: string
        }> = []

        // Track found codes to avoid duplicates
        const foundCodes = new Set<string>()
        const foundLabels = new Set<string>()

        // Known ICD-10 code mappings for 11 chronic diseases + common conditions
        const icdMappings: Record<string, string> = {
          // Hipertensi (I10.x, I11.x, I12.x, I13.x, I15.x)
          I10: 'HT', // Essential hypertension
          I11: 'HT', // Hypertensive heart disease
          I12: 'HT', // Hypertensive chronic kidney disease
          I13: 'HT', // Hypertensive heart and kidney disease
          I15: 'HT', // Secondary hypertension

          // Diabetes Mellitus (E10.x, E11.x, E13.x, E14.x)
          E10: 'DM', // Type 1 diabetes
          E11: 'DM', // Type 2 diabetes
          E13: 'DM', // Other specified diabetes
          E14: 'DM', // Unspecified diabetes

          // Gagal Jantung (I50.x)
          I50: 'HF', // Heart failure

          // Penyakit Jantung Koroner (I20.x, I25.x)
          I20: 'CHD', // Angina pectoris
          I25: 'CHD', // Chronic ischemic heart disease

          // Stroke (I60.x, I61.x, I63.x, I64.x)
          I60: 'STROKE', // Subarachnoid hemorrhage
          I61: 'STROKE', // Intracerebral hemorrhage
          I63: 'STROKE', // Cerebral infarction
          I64: 'STROKE', // Stroke, not specified

          // Gagal Ginjal Kronik (N18.x)
          N18: 'CKD', // Chronic kidney disease

          // Asma Kronis (J45.x)
          J45: 'ASTHMA', // Asthma

          // PPOK (J44.x)
          J44: 'PPOK', // Chronic obstructive pulmonary disease

          // GERD (K21.x)
          K21: 'GERD', // Gastro-esophageal reflux disease

          // Hipotiroidisme/Hipertiroidisme (E03.x, E05.x)
          E03: 'THYROID', // Hypothyroidism
          E05: 'THYROID', // Hyperthyroidism

          // Legacy/Other common conditions
          E78: 'Dyslipid', // Dyslipidemia
          K29: 'Gastritis', // Gastritis
        }

        const directChronicMappings = [
          {
            shortLabel: 'HT',
            code: 'DIRECT_HT',
            patterns: ['hipertensi', 'tekanan darah tinggi'],
          },
          {
            shortLabel: 'DM',
            code: 'DIRECT_DM',
            patterns: ['diabetes', 'diabetes mellitus', 'dm'],
          },
          {
            shortLabel: 'HF',
            code: 'DIRECT_HF',
            patterns: ['gagal jantung', 'heart failure'],
          },
          {
            shortLabel: 'CHD',
            code: 'DIRECT_CHD',
            patterns: ['penyakit jantung koroner', 'jantung koroner', 'penyakit jantung kronis'],
          },
          {
            shortLabel: 'STROKE',
            code: 'DIRECT_STROKE',
            patterns: ['stroke'],
          },
          {
            shortLabel: 'CKD',
            code: 'DIRECT_CKD',
            patterns: ['ginjal kronis', 'gagal ginjal kronis', 'penyakit ginjal kronis'],
          },
          {
            shortLabel: 'ASTHMA',
            code: 'DIRECT_ASTHMA',
            patterns: ['asma', 'asthma'],
          },
          {
            shortLabel: 'PPOK',
            code: 'DIRECT_PPOK',
            patterns: ['ppok', 'copd'],
          },
          {
            shortLabel: 'GERD',
            code: 'DIRECT_GERD',
            patterns: ['gerd'],
          },
          {
            shortLabel: 'THYROID',
            code: 'DIRECT_THYROID',
            patterns: ['tiroid', 'hipotiroid', 'hipertiroid'],
          },
          {
            shortLabel: 'Dyslipid',
            code: 'DIRECT_DYSLIPID',
            patterns: ['dislipidemia', 'dyslipidemia'],
          },
        ] as const

        const pushDirectHistory = (shortLabel: string, description: string, code: string) => {
          if (foundLabels.has(shortLabel)) {
            return
          }

          foundLabels.add(shortLabel)
          history.push({
            code,
            description,
            shortLabel,
          })
          debug(`✓ Direct chronic match: ${shortLabel} <- ${description}`)
        }

        // ICD-10 pattern: Letter followed by 2-3 digits, optionally with decimal
        const icdPattern = /\b([A-Z]\d{2,3}(?:\.\d{1,2})?)\b/g

        // ========================================
        // Method 0: PRIORITY - Read direct "Penyakit Kronis" field from RME
        // ========================================
        const allElements = Array.from(document.querySelectorAll<HTMLElement>('body *'))
        const chronicLabelElement = allElements.find(element => {
          const text = element.textContent?.trim().toLowerCase() || ''
          return text === 'penyakit kronis'
        })

        if (chronicLabelElement) {
          debug(`Found direct chronic label in ${chronicLabelElement.tagName}`)

          const candidateTexts = new Set<string>()
          const parent = chronicLabelElement.parentElement
          const sibling = chronicLabelElement.nextElementSibling
          const parentSibling = parent?.nextElementSibling

          if (sibling?.textContent?.trim()) {
            candidateTexts.add(sibling.textContent.trim())
          }

          if (parentSibling?.textContent?.trim()) {
            candidateTexts.add(parentSibling.textContent.trim())
          }

          parent
            ?.querySelectorAll<HTMLElement>('span, div, p, td, a, button')
            .forEach(node => {
              const text = node.textContent?.trim()
              if (text && text.toLowerCase() !== 'penyakit kronis') {
                candidateTexts.add(text)
              }
            })

          Array.from(candidateTexts).forEach(rawText => {
            const normalizedText = rawText.toLowerCase()
            directChronicMappings.forEach(mapping => {
              if (mapping.patterns.some(pattern => normalizedText.includes(pattern))) {
                pushDirectHistory(mapping.shortLabel, rawText, mapping.code)
              }
            })
          })
        }

        // ========================================
        // Method 1: PRIORITIZED - Scan specific ePuskesmas table
        // Try multiple selectors for the riwayat penyakit table
        // ========================================
        const tableSelectors = [
          '#tabel_detail_warna_penyakit',
          '#tabel_detail_warna_penyakit tbody',
          'table#tabel_detail_warna_penyakit',
          '[id*="warna_penyakit"]',
          '[id*="riwayat"]',
        ]

        let specificTable: Element | null = null
        for (const sel of tableSelectors) {
          specificTable = document.querySelector(sel)
          if (specificTable) {
            debug(`Found table with selector: ${sel}`)
            break
          }
        }

        if (specificTable) {
          const rows = specificTable.querySelectorAll('tr')
          debug(`Table has ${rows.length} rows`)

          rows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll('td')
            debug(`Row ${rowIndex}: ${cells.length} cells`)

            // Log all cell contents for debugging
            if (cells.length > 0) {
              const cellTexts = Array.from(cells).map(
                (c, i) => `[${i}]="${c.textContent?.trim().substring(0, 20)}"`
              )
              debug(`Row ${rowIndex} cells: ${cellTexts.join(', ')}`)
            }

            // Scan ALL cells for ICD codes (not just column 3)
            cells.forEach((cell, cellIndex) => {
              const cellText = cell.textContent?.trim() || ''
              const matches = cellText.match(icdPattern)

              if (matches) {
                matches.forEach(code => {
                  const baseCode = code.split('.')[0]
                  if (!foundCodes.has(baseCode)) {
                    foundCodes.add(baseCode)
                    // Get description from next cell or same row
                    const nextCell = cells[cellIndex + 1]?.textContent?.trim() || ''
                    const description = nextCell || 'From medical history'
                    const shortLabel = icdMappings[baseCode] || baseCode

                    if (foundLabels.has(shortLabel)) {
                      return
                    }
                    foundLabels.add(shortLabel)

                    history.push({ code, description, shortLabel })
                    debug(
                      `✓ Found ICD: ${code} (${shortLabel}) in row ${rowIndex}, cell ${cellIndex}`
                    )
                  }
                })
              }
            })
          })
        } else {
          debug('No specific table found, will try fallback methods')
        }

        // ========================================
        // Method 2: FALLBACK - Scan all tables for ICD codes
        // ========================================
        if (history.length === 0) {
          debug('Fallback: scanning all tables...')
          const tables = document.querySelectorAll('table')
          tables.forEach(table => {
            const rows = table.querySelectorAll('tr')
            rows.forEach(row => {
              const rowText = row.textContent || ''
              const cells = row.querySelectorAll('td')

              cells.forEach((cell, index) => {
                const cellText = cell.textContent?.trim() || ''
                const matches = cellText.match(icdPattern)

                if (matches) {
                  matches.forEach(code => {
                    const baseCode = code.split('.')[0]
                    if (!foundCodes.has(baseCode)) {
                      foundCodes.add(baseCode)
                      const nextCell = cells[index + 1]?.textContent?.trim() || ''
                      const description =
                        nextCell || rowText.replace(code, '').trim().substring(0, 100)
                      const shortLabel = icdMappings[baseCode] || baseCode

                      if (foundLabels.has(shortLabel)) {
                        return
                      }
                      foundLabels.add(shortLabel)

                      history.push({ code, description, shortLabel })
                      debug(`Found medical history in table: ${code} - ${description}`)
                    }
                  })
                }
              })
            })
          })
        }

        // ========================================
        // Method 3: Direct DOM search for I10 specifically
        // ========================================
        if (history.length === 0) {
          debug('Direct search: looking for I10 text in DOM...')

          // Search all elements containing "I10" text
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)

          let node
          while ((node = walker.nextNode())) {
            const text = node.textContent?.trim() || ''
            if (text === 'I10' || text.match(/^I10$/)) {
              if (!foundCodes.has('I10')) {
                foundCodes.add('I10')
                // Try to get description from next sibling or parent
                const parent = node.parentElement
                const nextSibling = parent?.nextElementSibling
                const description = nextSibling?.textContent?.trim() || 'Essential hypertension'

                if (foundLabels.has('HT')) {
                  continue
                }
                foundLabels.add('HT')

                history.push({
                  code: 'I10',
                  description,
                  shortLabel: 'HT',
                })
                debug(`✓ Direct DOM match: I10 found in element ${parent?.tagName}`)
              }
            }
          }
        }

        // ========================================
        // Method 4: LAST RESORT - Scan page text
        // ========================================
        if (history.length === 0) {
          debug('Last resort: scanning page text...')
          const pageText = document.body.innerText
          const matches = pageText.match(icdPattern)

          if (matches) {
            matches.forEach(code => {
              const baseCode = code.split('.')[0]
              if (!foundCodes.has(baseCode)) {
                foundCodes.add(baseCode)
                const shortLabel = icdMappings[baseCode] || baseCode

                if (foundLabels.has(shortLabel)) {
                  return
                }
                foundLabels.add(shortLabel)

                history.push({
                  code,
                  description: 'Detected from page',
                  shortLabel,
                })

                debug(`Found medical history in text: ${code}`)
              }
            })
          }
        }

        debug('Medical history scan complete:', `${history.length} items found`)
        return { success: true, history }
      },

      scanClinicalContext: (_data: unknown) => {
        debug('Scanning clinical context from page...')

        const cleanCandidateValue = (rawValue: string, labels: string[]): string => {
          const normalizedLabels = labels.map(label => label.toLowerCase())
          return rawValue
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\s*:\s*/g, ': ')
            .split('|')
            .map(item => item.trim())
            .find(item => {
              const normalized = item.toLowerCase()
              if (!normalized || normalized.length > 180) return false
              if (normalizedLabels.includes(normalized)) return false
              if (normalizedLabels.some(label => normalized === `${label}:`)) return false
              if (/^(warna|status|icdx|icd x|icd-?x)$/i.test(normalized)) return false
              return true
            }) || ''
        }

        const readLabeledValue = (labelInput: string | string[]): string => {
          const labels = Array.isArray(labelInput) ? labelInput : [labelInput]
          const allElements = Array.from(document.querySelectorAll<HTMLElement>('body *'))
          const candidates = new Set<string>()
          const normalizedLabels = labels.map(label => label.toLowerCase())
          const labelElements = allElements.filter(element => {
            const text = element.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() || ''
            return normalizedLabels.some(label => text === label || text === `${label}:`)
          })

          labelElements.forEach(labelElement => {
            const parent = labelElement.parentElement
            const sibling = labelElement.nextElementSibling as HTMLElement | null
            const parentSibling = parent?.nextElementSibling as HTMLElement | null
            const row = labelElement.closest('tr')
            const rowCells = row ? Array.from(row.querySelectorAll<HTMLElement>('td, th')) : []
            const labelIndex = rowCells.findIndex(cell => cell === labelElement || cell.contains(labelElement))

            if (sibling?.innerText?.trim()) {
              candidates.add(sibling.innerText.trim())
            }

            if (parentSibling?.innerText?.trim()) {
              candidates.add(parentSibling.innerText.trim())
            }

            if (row && labelIndex >= 0) {
              const nextCell = rowCells[labelIndex + 1]
              if (nextCell?.innerText?.trim()) {
                candidates.add(nextCell.innerText.trim())
              }
            }

            parent
              ?.querySelectorAll<HTMLElement>('span, div, p, td, a, button, strong, small')
              .forEach(node => {
                const text = node.innerText?.trim()
                if (text) {
                  candidates.add(text)
                }
              })
          })

          const pageText = document.body.innerText.replace(/\s+/g, ' ')
          normalizedLabels.forEach(label => {
            const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const regex = new RegExp(`${escaped}\\s*:?\\s*([^\\n\\r|]{1,80})`, 'i')
            const match = pageText.match(regex)
            if (match?.[1]) {
              candidates.add(match[1].trim())
            }
          })

          const cleaned = Array.from(candidates)
            .map(candidate => cleanCandidateValue(candidate, labels))
            .find(Boolean)

          return cleaned || ''
        }

        const parseList = (rawValue: string): string[] =>
          rawValue
            .split(/\n|,|;|\|/g)
            .map(item => item.trim())
            .filter(Boolean)
            .filter(item => !/^warna$/i.test(item) && !/^status$/i.test(item) && !/^icd/i.test(item))

        const normalizeAllergyList = (items: string[]): string[] => {
          const mapped = new Set<string>()

          items.forEach(item => {
            const normalized = item.toLowerCase()
            if (normalized.includes('makanan')) mapped.add('Makanan')
            if (normalized.includes('kulit')) mapped.add('Kulit')
            if (normalized.includes('debu')) mapped.add('Debu')
            if (normalized.includes('obat')) mapped.add('Obat')
          })

          return Array.from(mapped)
        }

        const parsePregnancyStatus = (rawValue: string): boolean | null => {
          const normalized = rawValue.toLowerCase()
          if (!normalized) return null
          if (
            normalized.includes('tidak hamil') ||
            normalized.includes('non hamil') ||
            normalized.includes('negatif')
          ) {
            return false
          }
          if (normalized.includes('hamil') || normalized.includes('gravid')) {
            return true
          }
          return null
        }

        const facilityName = readLabeledValue(['Nama Faskes', 'Faskes', 'Nama Puskesmas'])
        const payerLabel =
          readLabeledValue(['Penjamin', 'BPJS', 'Cara Bayar', 'Status BPJS']) ||
          readLabeledValue('Jaminan')
        const specialConditions = parseList(readLabeledValue('Penyakit Khusus'))
        const pregnancyRisk = readLabeledValue(['Risiko Kehamilan', 'Resiko Kehamilan'])
        const allergies = normalizeAllergyList([
          ...parseList(readLabeledValue('Riwayat Alergi')),
          ...parseList(readLabeledValue('Alergi')),
        ])
        const pregnancyStatus = parsePregnancyStatus(
          readLabeledValue(['Status Kehamilan', 'Kehamilan'])
        )

        debug('Clinical context scan result', {
          facilityName,
          payerLabel,
          specialConditions,
          pregnancyRisk,
          allergies,
          pregnancyStatus,
        })

        return {
          success: true,
          context: {
            facilityName,
            payerLabel,
            specialConditions,
            pregnancyRisk,
            allergies,
            pregnancyStatus,
          },
        }
      },

      /**
       * Scan Visit History from ePuskesmas "Kunjungan 25 Tahun Terakhir" sidebar.
       *
       * Real DOM structure (verified from live ePuskesmas):
       * 1. Riwayat links: <a class="riwayat btn btn-default" data-id="18556"
       *    onclick="showRiwayatPelayanan(this)">
       * 2. After click → data loads into #anamnesa_riwayat, #diagnosa_riwayat
       * 3. Vitals in: #print_area_anamnesa table rows
       *    (Sistole, Diastole, Detak Nadi, Nafas, Suhu, Gula Darah)
       * 4. Keluhan in: #print_area_anamnesa "Keluhan Utama" row
       * 5. Diagnosa in: #diagnosa_riwayat "ICD-X" + "Diagnosa" rows
       *
       * IMPORTANT: Content scripts run in isolated world.
       * showRiwayatPelayanan() lives in page main world.
       * Must use script injection to call it.
       */
      scanVisitHistory: async (_data: unknown) => {
        const diag: string[] = []
        const d = (msg: string) => {
          diag.push(msg)
          contentLog.debug('[SentraScrape]', msg)
        }
        d(`SCAN_START url=${window.location.href.slice(0, 80)}`)

        try {
          // === STEP 0: Check if sidebar container exists, wait if needed ===
          let sidebarContainer = document.querySelector('#data_riwayat')
          d(`SIDEBAR: #data_riwayat=${sidebarContainer ? 'FOUND' : 'NOT_FOUND'}`)

          if (!sidebarContainer) {
            // Also check alternative containers
            const altContainers = ['.tab-riwayat', '[class*="riwayat"]', '.col-sm-4 .box']
            for (const sel of altContainers) {
              const el = document.querySelector(sel)
              if (el) {
                d(`SIDEBAR_ALT: ${sel}=FOUND innerHTML=${el.innerHTML.length}chars`)
                sidebarContainer = el
                break
              }
            }
          }

          // Wait up to 2s for sidebar to load (lazy AJAX)
          if (!sidebarContainer || sidebarContainer.innerHTML.trim().length < 50) {
            d('SIDEBAR_WAIT: waiting 2s for lazy load...')
            await new Promise(r => setTimeout(r, 2000))
            sidebarContainer = document.querySelector('#data_riwayat, .tab-riwayat')
            d(
              `SIDEBAR_AFTER_WAIT: ${sidebarContainer ? `FOUND len=${sidebarContainer.innerHTML.length}` : 'STILL_NOT_FOUND'}`
            )
          }

          // === STEP 1: DOM PROBE — find ALL riwayat-related anchors ===
          const allAnchors = document.querySelectorAll('a')
          const riwayatAnchors = Array.from(allAnchors).filter(
            a =>
              a.className.includes('riwayat') ||
              a.getAttribute('onclick')?.toLowerCase().includes('riwayat') ||
              (a.getAttribute('data-id') && a.closest('.tab-riwayat, #data_riwayat'))
          )
          d(`DOM: ${allAnchors.length} total anchors, ${riwayatAnchors.length} riwayat-related`)
          riwayatAnchors.slice(0, 10).forEach((a, i) => {
            d(
              `  A[${i}] cls="${a.className.slice(0, 60)}" data-id="${a.getAttribute('data-id')}" ` +
                `onclick="${(a.getAttribute('onclick') || '').slice(0, 80)}" ` +
                `href="${(a.getAttribute('href') || '').slice(0, 60)}" ` +
                `text="${a.textContent?.trim().slice(0, 50)}"`
            )
          })

          // === STEP 2: Build candidate list with multiple ID extraction strategies ===
          // Broad selector: class, onclick, or links inside riwayat container
          const links = Array.from(
            document.querySelectorAll<HTMLAnchorElement>(
              'a.riwayat, a[onclick*="showRiwayatPelayanan"], a[onclick*="riwayat"], ' +
                'a[onclick*="Riwayat"], a[data-id][href*="printout"], ' +
                '#data_riwayat a, .tab-riwayat a[data-id]'
            )
          )
          // Deduplicate
          const uniqueLinks = [...new Set(links)]
          d(`Selector matched: ${links.length} raw, ${uniqueLinks.length} unique`)

          if (!uniqueLinks.length) {
            // Dump parent containers for debugging
            const boxes = document.querySelectorAll('.col-sm-4 .box')
            d(`EMPTY: 0 links. .col-sm-4 .box count=${boxes.length}`)
            boxes.forEach((b, i) => {
              const cls = b.className
              const aCount = b.querySelectorAll('a').length
              d(`  BOX[${i}] class="${cls}" anchors=${aCount} html=${b.innerHTML.slice(0, 100)}`)
            })
            return { success: true, visits: [], diagnostics: diag }
          }

          // === STEP 3: Parse each link — extract date + ID (data-id OR onclick OR href) ===
          const today = new Date().toISOString().slice(0, 10)
          d(`Today: ${today}`)

          const extractId = (a: HTMLAnchorElement): string => {
            // Priority 1: data-id attribute
            const dataId = a.getAttribute('data-id')
            if (dataId) return dataId
            // Priority 2: parse from onclick — showRiwayatPelayanan(this) → look for data-id on parent
            const onclick = a.getAttribute('onclick') || ''
            // Pattern: showRiwayatPelayanan('12345') or showRiwayatPelayanan(12345)
            const onclickMatch = onclick.match(/showRiwayatPelayanan\s*\(\s*['"]?(\d+)['"]?\s*\)/i)
            if (onclickMatch) return onclickMatch[1]
            // Pattern: any function with numeric ID
            const genericMatch = onclick.match(/\(\s*['"]?(\d{3,})['"]?\s*\)/)
            if (genericMatch) return genericMatch[1]
            // Priority 3: href contains ID
            const href = a.getAttribute('href') || ''
            const hrefMatch = href.match(/\/(\d{3,})(?:[/?#]|$)/)
            if (hrefMatch) return hrefMatch[1]
            return ''
          }

          const candidates = uniqueLinks.map(a => {
            const text = a.textContent?.trim() || ''
            const dateMatch = text.match(/(\d{2})-(\d{2})-(\d{4})/)
            const isoDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : ''
            const id = extractId(a)
            const href = a.getAttribute('href') || ''
            d(
              `  CAND: id=${id} date=${isoDate} href=${href.slice(0, 40)} text="${text.slice(0, 50)}"`
            )
            return { id, isoDate, linkText: text, href }
          })

          // Filter: must have date, exclude today
          const pastCandidates = candidates.filter(c => c.isoDate && c.isoDate !== today)
          d(`Past (excl today): ${pastCandidates.length}`)

          // Must have ID or href to fetch
          const fetchable = pastCandidates.filter(c => c.id || c.href)
          d(`Fetchable: ${fetchable.length}`)

          // Rollback to expected behavior: process up to 5 latest visits.
          const targets = fetchable.slice(0, 5)
          d(`Targets: ${targets.length}`)

          if (!targets.length) {
            d('NO_TARGETS: all filtered out')
            return { success: true, visits: [], diagnostics: diag }
          }

          // === STEP 4: Silent background fetch via main world bridge ===
          // Use main world's jQuery AJAX (with CSRF token) to fetch visit HTML
          // without triggering visual modal popup.
          const { extractVisitFromRoot } = await import('@/lib/scraper/extractors')
          const visits: NonNullable<ReturnType<typeof extractVisitFromRoot>>[] = []

          for (const c of targets) {
            try {
              d(`BRIDGE_FETCH: id=${c.id} date=${c.isoDate}`)

              // Send message to main world bridge
              const fetchPromise = new Promise<{
                success: boolean
                content?: string
                error?: string
              }>(resolve => {
                const listener = (event: MessageEvent) => {
                  if (event.source !== window) return
                  const msg = event.data
                  if (msg?.type === 'sentra-native-fetch-response' && msg.dataId === c.id) {
                    window.removeEventListener('message', listener)
                    resolve(msg)
                  }
                }
                window.addEventListener('message', listener)

                // Trigger fetch
                window.postMessage(
                  {
                    type: 'sentra-native-fetch-request',
                    dataId: c.id,
                  },
                  '*'
                )
              })

              // Wait for response (with 8s timeout)
              const result = await Promise.race([
                fetchPromise,
                new Promise<{ success: false; error: string }>(r =>
                  setTimeout(() => r({ success: false, error: 'Timeout 8s' }), 8000)
                ),
              ])

              if (!result.success || !result.content) {
                d(`BRIDGE_FAIL: id=${c.id} error=${result.error || 'no content'}`)
                continue
              }

              d(
                `BRIDGE_OK: id=${c.id} len=${result.content.length} first120="${result.content.slice(0, 120).replace(/\n/g, '\\n')}"`
              )

              // Parse HTML → extract vitals
              const doc = new DOMParser().parseFromString(result.content, 'text/html')
              const visit = extractVisitFromRoot(doc, c.id, c.isoDate)

              if (visit) {
                d(
                  `EXTRACT_OK: id=${c.id} date=${c.isoDate} sbp=${visit.vitals.sbp} dbp=${visit.vitals.dbp} hr=${visit.vitals.hr}`
                )
                visits.push(visit)
              } else {
                d(`EXTRACT_NULL: id=${c.id} — extractor returned null`)
                // Dump first table for debugging
                const firstTable = doc.querySelector('table')
                if (firstTable) {
                  d(`  TABLE_DUMP: ${firstTable.innerHTML.slice(0, 300).replace(/\n/g, '\\n')}`)
                }
              }
            } catch (err) {
              d(`VISIT_ERROR: id=${c.id} ${err}`)
            }
          }

          d(`DONE: ${visits.length} visits extracted from ${targets.length} targets`)
          return { success: true, visits, diagnostics: diag }
        } catch (error) {
          d(`FATAL: ${error instanceof Error ? error.stack : String(error)}`)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            visits: [],
            diagnostics: diag,
          }
        }
      },

      /**
       * Get Patient Info from ePuskesmas page header
       * Scrapes: name, gender, age, RM number, BPJS status, address
       */
      getPatientInfo: () => {
        debug('Scraping patient info from page...')

        interface PatientInfo {
          name: string
          gender: 'L' | 'P'
          age: number
          rm: string
          bpjsStatus: 'aktif' | 'nonaktif' | 'mandiri' | null
          kelurahan: string
          dob: string
        }

        const result: PatientInfo = {
          name: '',
          gender: 'L',
          age: 0,
          rm: '',
          bpjsStatus: null,
          kelurahan: '',
          dob: '',
        }

        try {
          // ========================================
          // Strategy 1: Look for patient header elements
          // Common selectors in ePuskesmas
          // ========================================

          // Try to find patient name
          const nameSelectors = [
            '[class*="nama"]',
            '[id*="nama"]',
            '.patient-name',
            '.nama-pasien',
            'td:contains("Nama") + td',
            'th:contains("Nama") + td',
            '[data-field="nama"]',
            '#nama_pasien',
          ]

          // Try to find RM number
          const rmSelectors = [
            '[class*="rm"]',
            '[id*="rm"]',
            '[class*="rekam"]',
            '.no-rm',
            '.rm-number',
            '#no_rm',
            'td:contains("RM") + td',
            'td:contains("No. RM") + td',
          ]

          // ========================================
          // Strategy 2: Parse page text patterns
          // ========================================
          const pageText = document.body.innerText

          // Pattern: "Nama : VALUE" or "Nama: VALUE"
          const namaMatch = pageText.match(/Nama\s*[-:]\s*([^\n\r|,]+)/i)
          if (namaMatch) {
            result.name = namaMatch[1].trim()
          }

          // Pattern: "No. RM : VALUE" or "RM: VALUE"
          const rmMatch = pageText.match(/(?:No\.?\s*)?RM\s*[-:]\s*([0-9/-]+)/i)
          if (rmMatch) {
            result.rm = rmMatch[1].trim()
          }

          // Pattern: "Umur : VALUE th" or "Usia: VALUE tahun"
          const umurMatch = pageText.match(/(?:Umur|Usia)\s*[-:]\s*(\d+)\s*(?:th|tahun)?/i)
          if (umurMatch) {
            result.age = Number.parseInt(umurMatch[1], 10)
          }

          // Pattern: "JK : L/P" or "Jenis Kelamin: Laki-laki/Perempuan"
          const jkMatch = pageText.match(
            /(?:JK|Jenis\s*Kelamin|J\.K\.?)\s*[-:]\s*(L|P|Laki|Perempuan)/i
          )
          if (jkMatch) {
            const jk = jkMatch[1].toUpperCase()
            result.gender = jk === 'L' || jk.startsWith('LAKI') ? 'L' : 'P'
          }

          // Pattern: "Alamat : VALUE" or "Kelurahan: VALUE"
          const alamatMatch = pageText.match(/(?:Alamat|Kelurahan)\s*[-:]\s*([^\n\r|]+)/i)
          if (alamatMatch) {
            result.kelurahan = alamatMatch[1].trim().substring(0, 100)
          }

          // Pattern: BPJS status
          const bpjsMatch = pageText.match(
            /BPJS\s*[-:]?\s*(Aktif|Non\s*Aktif|Mandiri|Tidak\s*Aktif)/i
          )
          if (bpjsMatch) {
            const status = bpjsMatch[1].toLowerCase()
            if (status.includes('aktif') && !status.includes('non') && !status.includes('tidak')) {
              result.bpjsStatus = 'aktif'
            } else if (status.includes('mandiri')) {
              result.bpjsStatus = 'mandiri'
            } else {
              result.bpjsStatus = 'nonaktif'
            }
          }

          // Pattern: "Tgl Lahir : DD-MM-YYYY"
          const dobMatch = pageText.match(
            /(?:Tgl\.?\s*Lahir|Tanggal\s*Lahir|TTL)\s*[-:]\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i
          )
          if (dobMatch) {
            result.dob = dobMatch[1].trim()
          }

          // ========================================
          // Strategy 3: DOM element search
          // ========================================
          // Try specific selectors if text parsing didn't work
          if (!result.name) {
            for (const sel of nameSelectors) {
              try {
                const el = document.querySelector(sel)
                if (el && el.textContent) {
                  const text = el.textContent.trim()
                  if (text.length > 2 && text.length < 100) {
                    result.name = text
                    break
                  }
                }
              } catch {
                /* selector might be invalid */
              }
            }
          }

          if (!result.rm) {
            for (const sel of rmSelectors) {
              try {
                const el = document.querySelector(sel)
                if (el && el.textContent) {
                  const text = el.textContent.trim()
                  if (/^\d/.test(text)) {
                    result.rm = text
                    break
                  }
                }
              } catch {
                /* selector might be invalid */
              }
            }
          }

          debug('Patient info scraped:', result)
          return { success: true, patient: result }
        } catch (error) {
          debug('Error scraping patient info:', error)
          return { success: false, error: String(error), patient: result }
        }
      },

      /**
       * DAS - Data Ascension System: Advanced field scanning
       * Scans page fields with AI-ready signatures for intelligent mapping
       */
      scanFieldsDAS: async (data: unknown) => {
        debug('DAS: Scanning page fields...')
        const options = (data as ScanOptions) || {}

        try {
          // Dynamic import to reduce initial bundle size
          const { scanPageFields } = await import('@/lib/das')
          const result = scanPageFields(options)

          debug(`DAS: Found ${result.fields.length} fields in ${result.scanDuration}ms`)
          return { success: true, ...result }
        } catch (error) {
          debug('DAS: Scan error:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : 'DAS scan failed',
          }
        }
      },

      /**
       * DAS Phase 2: AI-powered semantic field mapping
       * Maps payload data to form fields using Gemini Vision
       */
      mapFieldsDAS: async (data: unknown) => {
        debug('DAS: AI semantic mapping...')
        const request = data as { payload: Record<string, unknown>; options?: MapperOptions }

        if (!request?.payload) {
          return { success: false, error: 'Missing payload data' }
        }

        try {
          const { mapPayloadToFields } = await import('@/lib/das')
          const result = await mapPayloadToFields(request.payload, request.options)

          debug(`DAS: Mapped ${result.mappings.length} fields, ${result.unmapped.length} unmapped`)
          return { success: true, ...result }
        } catch (error) {
          debug('DAS: Mapping error:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : 'DAS mapping failed',
          }
        }
      },

      /**
       * DAS Phase 2: Preview mapping without executing
       */
      previewMappingDAS: async (data: unknown) => {
        debug('DAS: Previewing mapping...')
        const request = data as { payload: Record<string, unknown> }

        if (!request?.payload) {
          return { success: false, error: 'Missing payload data' }
        }

        try {
          const { previewMapping } = await import('@/lib/das')
          const result = await previewMapping(request.payload)

          return { success: true, ...result }
        } catch (error) {
          debug('DAS: Preview error:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : 'DAS preview failed',
          }
        }
      },
    }

    // NOTE:
    // Keep content-side inbound messaging on native browser.runtime.onMessage only.
    // Mixing @webext-core listener with native tab messages can throw
    // "Unknown message format" for raw tab payloads that don't include timestamp.

    // Native message listener for background → content communication
    // This handles direct messages from background script via browser.tabs.sendMessage
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const msg = message as { type?: string; data?: unknown }
      contentLog.debug('Native message received, type:', msg.type)
      debug('Native message received:', msg)

      if (msg.type === 'execFill' && msg.data) {
        contentLog.debug(
          'execFill handler triggered, data.type:',
          (msg.data as { type?: string })?.type
        )
        Promise.resolve(messageHandlers.execFill(msg.data))
          .then(result => {
            debug('Fill result:', result)
            sendResponse(result)
          })
          .catch(error => {
            debug('Fill error:', error)
            sendResponse({
              success: [],
              failed: [{ field: 'all', error: String(error) }],
              skipped: [],
            })
          })
        return true // Keep channel open for async response
      }

      if (msg.type === 'execScrape' && msg.data) {
        Promise.resolve(messageHandlers.execScrape(msg.data))
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: String(error) }))
        return true
      }

      if (msg.type === 'scanFields') {
        const result = messageHandlers.scanFields(msg.data)
        sendResponse(result)
        return true
      }

      if (msg.type === 'getCurrentPageType') {
        const result = messageHandlers.getCurrentPageType(msg.data)
        sendResponse(result)
        return true
      }

      if (msg.type === 'resolveTenagaMedis') {
        const result = messageHandlers.resolveTenagaMedis(msg.data)
        sendResponse(result)
        return true
      }

      if (msg.type === 'scanMedicalHistory') {
        const result = messageHandlers.scanMedicalHistory(msg.data)
        sendResponse(result)
        return true
      }

      if (msg.type === 'scanClinicalContext') {
        const result = messageHandlers.scanClinicalContext(msg.data)
        sendResponse(result)
        return true
      }

      if (msg.type === 'getPatientInfo') {
        const result = messageHandlers.getPatientInfo(msg.data)
        sendResponse(result)
        return true
      }

      if (msg.type === 'scanVisitHistory') {
        Promise.resolve(messageHandlers.scanVisitHistory(msg.data))
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: String(error), visits: [] }))
        return true
      }

      // DAS - Data Ascension System handlers
      if (msg.type === 'scanFieldsDAS') {
        Promise.resolve(messageHandlers.scanFieldsDAS(msg.data))
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: String(error) }))
        return true
      }

      if (msg.type === 'mapFieldsDAS') {
        Promise.resolve(messageHandlers.mapFieldsDAS(msg.data))
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: String(error) }))
        return true
      }

      if (msg.type === 'previewMappingDAS') {
        Promise.resolve(messageHandlers.previewMappingDAS(msg.data))
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: String(error) }))
        return true
      }

      return false
    })

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init)
    } else {
      init()
    }

    debug('Content script loaded and waiting for messages')
  },
})
