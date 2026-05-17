export interface BureaucracyTask {
  country: 'GH' | 'NG' | 'KE' | 'ZA'
  id: string
  title: string
  authority: string
  authorityUrl: string
  summary: string
  steps: string[]
  processingTime: string
  typicalCost: string
}

// Hand-curated corpus of common bureaucratic tasks for Baobab's first
// vertical AI agent. Sources are the official authority sites listed in
// `authorityUrl`; figures are best-effort snapshots and should be treated
// as guidance, not gospel — the agent's system prompt instructs it to
// remind users to verify with the official source.
export const BUREAUCRACY_CORPUS: BureaucracyTask[] = [
  // Ghana
  {
    country: 'GH',
    id: 'gh-business',
    title: 'Register a business in Ghana',
    authority: "Registrar General's Department (RGD)",
    authorityUrl: 'https://rgd.gov.gh',
    summary:
      'Sole proprietorship, partnership, or company — RGD is the registration authority. Tax ID (TIN) is issued by Ghana Revenue Authority alongside.',
    steps: [
      'Reserve a business name on the RGD online portal.',
      'Submit incorporation forms (Form A for sole proprietor; Forms 3 & 4 for companies).',
      'Pay registration fees (GHS 60 sole prop · GHS 230+ for limited liability).',
      'Receive Business Registration Certificate.',
      'Register for Tax Identification Number (TIN) via GRA.',
      'If hiring: register with SSNIT.',
    ],
    processingTime:
      '2-4 business days for sole proprietorship; 1-2 weeks for limited liability.',
    typicalCost: 'GHS 60-330 depending on entity type.',
  },
  {
    country: 'GH',
    id: 'gh-license',
    title: "Get a driver's license in Ghana",
    authority: 'Driver and Vehicle Licensing Authority (DVLA)',
    authorityUrl: 'https://www.dvla.gov.gh',
    summary:
      'DVLA issues all licenses. Provisional license required first, then theory + practical tests.',
    steps: [
      'Apply for Provisional License at DVLA office.',
      'Pass theory test on Highway Code.',
      'Complete 6-month learning period.',
      'Pass on-road practical test.',
      'Pick up substantive license.',
    ],
    processingTime: '6 months minimum (provisional period).',
    typicalCost: 'GHS 250-450 across stages.',
  },
  {
    country: 'GH',
    id: 'gh-passport',
    title: 'Get a passport in Ghana',
    authority: 'Ghana Immigration Service (GIS) — Passport Office',
    authorityUrl: 'https://passports.gov.gh',
    summary:
      'Online application via passports.gov.gh; appointment-based fingerprinting and biometrics.',
    steps: [
      'Complete online application.',
      'Pay fees online or via bank.',
      'Book appointment at chosen passport office.',
      'Attend appointment with original documents + biometrics.',
      'Collect passport after issuance SMS.',
    ],
    processingTime: '15 working days standard; 5 working days expedited.',
    typicalCost: 'GHS 100-500 depending on speed + booklet size.',
  },
  // Nigeria
  {
    country: 'NG',
    id: 'ng-business',
    title: 'Register a business in Nigeria',
    authority: 'Corporate Affairs Commission (CAC)',
    authorityUrl: 'https://www.cac.gov.ng',
    summary:
      'CAC handles all business registrations. Online portal handles 90% of the flow.',
    steps: [
      'Reserve company name on CAC portal.',
      'Complete incorporation forms (Form CAC 1.1 for limited liability).',
      'Upload required documents (Memo & Articles, ID of directors).',
      'Pay filing fees.',
      'Download Certificate of Incorporation.',
    ],
    processingTime:
      '24-72 hours for name reservation; 3-7 business days for full incorporation.',
    typicalCost: 'NGN 10,000-65,000 depending on share capital.',
  },
  {
    country: 'NG',
    id: 'ng-passport',
    title: 'Get a passport in Nigeria',
    authority: 'Nigeria Immigration Service (NIS)',
    authorityUrl: 'https://immigration.gov.ng',
    summary:
      'Online application via immigration.gov.ng then in-person biometrics.',
    steps: [
      'Pay fees online.',
      'Complete application form.',
      'Print acknowledgement slip.',
      'Attend biometric capture at chosen office.',
      'Pick up passport after notification.',
    ],
    processingTime: '6 weeks standard.',
    typicalCost: 'NGN 35,000-100,000 depending on validity + booklet size.',
  },
  {
    country: 'NG',
    id: 'ng-nin',
    title: 'Get a National Identification Number (NIN) in Nigeria',
    authority: 'National Identity Management Commission (NIMC)',
    authorityUrl: 'https://nimc.gov.ng',
    summary:
      'NIN is mandatory for SIM, banking, passport. Free issuance at NIMC enrolment centres.',
    steps: [
      'Visit nearest NIMC enrolment centre.',
      'Provide birth certificate / age declaration + utility bill.',
      'Capture biometrics (10 fingerprints, photo, signature).',
      'Receive paper slip with NIN.',
      'Use NIMC mobile app to download digital ID.',
    ],
    processingTime: 'Same day for paper slip; digital ID within 48 hours.',
    typicalCost: 'Free.',
  },
  // Kenya
  {
    country: 'KE',
    id: 'ke-business',
    title: 'Register a business in Kenya',
    authority: 'Business Registration Service (BRS)',
    authorityUrl: 'https://brs.go.ke',
    summary:
      'All registrations through eCitizen portal. Limited liability companies use the BRS service.',
    steps: [
      'Create eCitizen account.',
      'Apply for name search (KES 150).',
      'Submit incorporation documents (CR1, CR8 for limited liability).',
      'Pay incorporation fees (KES 10,650 for share capital up to KES 5M).',
      'Download Certificate of Incorporation.',
      'Apply for KRA PIN for the company.',
    ],
    processingTime: '2-3 working days end to end.',
    typicalCost: 'KES 10,750+ for limited liability.',
  },
  {
    country: 'KE',
    id: 'ke-passport',
    title: 'Get a passport in Kenya',
    authority: 'Directorate of Immigration Services (DIS)',
    authorityUrl: 'https://immigration.go.ke',
    summary:
      'All applications via eCitizen portal; biometrics taken in person.',
    steps: [
      'Apply through eCitizen.',
      'Pay fees online.',
      'Print application form.',
      'Attend biometrics appointment.',
      'Collect passport when notified.',
    ],
    processingTime: '10 working days standard.',
    typicalCost: 'KES 4,550 - 12,050 depending on type.',
  },
  {
    country: 'KE',
    id: 'ke-kra-pin',
    title: 'Get a KRA PIN in Kenya',
    authority: 'Kenya Revenue Authority (KRA)',
    authorityUrl: 'https://itax.kra.go.ke',
    summary:
      'Personal Identification Number for all tax matters. Free.',
    steps: [
      'Visit itax.kra.go.ke.',
      'Click New PIN Registration.',
      'Fill personal details + occupation.',
      'Submit and receive PIN by email.',
    ],
    processingTime: 'Same day (instant after submission).',
    typicalCost: 'Free.',
  },
  // South Africa
  {
    country: 'ZA',
    id: 'za-company',
    title: 'Register a company in South Africa',
    authority: 'Companies and Intellectual Property Commission (CIPC)',
    authorityUrl: 'https://www.cipc.co.za',
    summary:
      'CIPC handles all company registrations. eServices portal is the primary route.',
    steps: [
      'Customer code registration on CIPC eServices.',
      'Reserve company name (4 options accepted).',
      'Complete Memorandum of Incorporation (MOI).',
      'Pay registration fee.',
      'Receive Registration Certificate.',
      'Register with SARS for tax.',
    ],
    processingTime:
      '5-15 working days for standard MOI; faster for short standard form.',
    typicalCost: 'ZAR 175-475 depending on entity type.',
  },
  {
    country: 'ZA',
    id: 'za-id',
    title: 'Get a Smart ID card in South Africa',
    authority: 'Department of Home Affairs (DHA)',
    authorityUrl: 'https://www.dha.gov.za',
    summary:
      'First-time applicants must apply in person. Online booking via DHA eHomeAffairs (limited to participating banks for first-time applicants under 16 years; in person for everyone else).',
    steps: [
      'Book appointment online.',
      'Visit DHA office with birth certificate + parent/guardian ID (under 16).',
      'Capture biometrics.',
      'Pay fee (free for first issue; ZAR 140 for re-issue).',
      'Collect Smart ID Card within 14 days.',
    ],
    processingTime: '14 working days.',
    typicalCost: 'Free for first issue; ZAR 140 re-issue.',
  },
]
