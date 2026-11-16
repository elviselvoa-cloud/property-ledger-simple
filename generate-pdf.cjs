const pdfMake = require('pdfmake');

const docDefinition = {
  content: [
    // Header section
    {
      text: 'PROPERTY LEDGER',
      style: 'header',
      margin: [0, 0, 0, 4]
    },
    {
      text: 'Project Naming Options & Analysis',
      style: 'subtitle'
    },
    {
      text: 'Generated: November 2026',
      style: 'date',
      margin: [0, 0, 30, 25]
    },

    // Project Overview
    {
      text: 'PROJECT OVERVIEW',
      style: 'sectionHeader'
    },
    {
      text: 'Current Name: Property Ledger\n\nPurpose: A property and tenancy management platform for landlords, property managers, and property agencies.\n\nKey Features:\n• Property & unit management\n• Tenant onboarding & lease management\n• M-Pesa payment tracking & WhatsApp receipts (Kenya-focused)\n• Expense tracking & cash flow management\n• Caretaker delegation with restricted access\n• Arrears aging reports & invoicing\n• Communications module & dashboard analytics\n\nTarget Users: Independent landlords, property agencies, estate managers, and international landlords.',
      style: 'body'
    },

    // Top Recommendations
    {
      text: 'TOP 5 RECOMMENDATIONS',
      style: 'sectionHeader',
      margin: [0, 20, 0, 10]
    },

    // Recommendation cards
    {
      text: '🥇 1. PropertyHub\n⭐⭐⭐⭐⭐\n\nPros: Instant understanding, domain available, works globally, no localization issues\nCons: Somewhat generic (but that\'s a strength for memorability)\nBest for: International expansion, broad appeal',
      style: 'card'
    },
    {
      text: '🥈 2. RentFlow\n⭐⭐⭐⭐½\n\nPros: Short, memorable, conveys cash flow benefit, brandable\nCons: Less specific to caretaker management features\nBest for: Kenya market, M-Pesa integration focus',
      style: 'card'
    },
    {
      text: '🥉 3. LeaseLink\n⭐⭐⭐⭐½\n\nPros: Perfect for lease management, network effect implied, professional\nCons: Doesn\'t emphasize financial features enough\nBest for: Agencies managing tenant relationships',
      style: 'card'
    },
    {
      text: '4. PropertyPilot\n⭐⭐⭐⭐\n\nPros: Evokes guidance and control, professional, scalable\nCons: Longer name, less punchy than short options\nBest for: Professional landlords, property managers',
      style: 'card'
    },
    {
      text: '5. Proply\n⭐⭐⭐⭐\n\nPros: Modern, short, unique, easy to trademark\nCons: Made-up word (might need explanation)\nBest for: Brand building, modern approach',
      style: 'card'
    },

    // Category 1: Modern & Simple
    {
      text: 'CATEGORY 1: MODERN & SIMPLE (Recommended)',
      style: 'categoryHeader'
    },
    {
      columns: [
        { text: 'PropertyHub: Central hub for all property management needs', fontSize: 11, width: 'auto' },
        { text: '\n\nRentFlow: Suggests smooth rent collection and cash flow', fontSize: 11, width: 'auto' },
        { text: '\n\nLeaseLink: Perfect for lease management and connecting tenants/landlords', fontSize: 11, width: 'auto' }
      ],
      columnGap: 20,
      margin: [0, 0, 15, 0]
    },

    // Category 2: Domain-Specific
    {
      text: 'CATEGORY 2: DOMAIN-SPECIFIC (Property-Focused)',
      style: 'categoryHeader'
    },
    {
      columns: [
        { text: 'PropertyPilot: Guides landlords through property management', fontSize: 11, width: 'auto' },
        { text: '\n\nUnitTrack: Focuses on tracking property units', fontSize: 11, width: 'auto' },
        { text: '\n\nLandlordly: Playful yet professional, directly referencing the target user', fontSize: 11, width: 'auto' },
        { text: '\n\nEstately: Combines "estate" with a professional suffix', fontSize: 11, width: 'auto' }
      ],
      columnGap: 20,
      margin: [0, 0, 15, 0]
    },

    // Category 3: Kenya/East Africa Market
    {
      text: 'CATEGORY 3: KENYA/EAST AFRICA MARKET',
      style: 'categoryHeader'
    },
    {
      columns: [
        { text: 'Mtaani Properties: Swahili for "properties" - local and friendly', fontSize: 11, width: 'auto' },
        { text: '\n\nSafiri Rentals: Swahili for "plan/travel" - smooth property journeys', fontSize: 11, width: 'auto' },
        { text: '\n\nPesaLedger: Combines money (Pesa) with ledger for payment tracking', fontSize: 11, width: 'auto' }
      ],
      columnGap: 20,
      margin: [0, 0, 15, 0]
    },

    // Category 4: Business & Professional
    {
      text: 'CATEGORY 4: BUSINESS & PROFESSIONAL',
      style: 'categoryHeader'
    },
    {
      columns: [
        { text: 'TenantFlow: Focuses on tenant relationship management', fontSize: 11, width: 'auto' },
        { text: '\n\nPortfolioPro: For landlords managing multiple properties', fontSize: 11, width: 'auto' },
        { text: '\n\nAssetLedger: Professional financial term for property assets', fontSize: 11, width: 'auto' },
        { text: '\n\nRealm Properties: Suggests comprehensive property domain management', fontSize: 11, width: 'auto' }
      ],
      columnGap: 20,
      margin: [0, 0, 15, 0]
    },

    // Final Verdict
    {
      text: 'FINAL VERDICT',
      style: 'sectionHeader',
      margin: [0, 20, 0, 10]
    },
    {
      text: '\nFOR MAXIMUM GLOBAL APPEAL: "PropertyHub"\n\nFOR KENYA MARKET: "RentFlow" or "PesaLedger"\n\nFOR PROFESSIONAL LANDLORDS: "PortfolioPro" or "PropertyPilot"\n\n──────────────────────────────────\nCheck domain availability (.com, .co.ke) before finalizing!',
      style: 'verdict'
    }
  ],

  styles: {
    header: {
      fontSize: 24,
      bold: true,
      color: '#1a1a2e',
      margin: [0, 0, 0, 0]
    },
    subtitle: {
      fontSize: 14,
      color: '#1a1a2e',
      margin: [0, 0, 0, 20]
    },
    date: {
      fontSize: 10,
      color: '#888',
      italics: true
    },
    sectionHeader: {
      fontSize: 12,
      bold: true,
      color: '#ffffff',
      background: '#1a1a2e',
      margin: [0, 20, 0, 10],
      padding: [8, 12]
    },
    categoryHeader: {
      fontSize: 11,
      bold: true,
      color: '#2d3748',
      border: [1, 0, 0, 0],
      borderColor: '#e2e8f0',
      margin: [0, 15, 0, 5],
      padding: [5, 0]
    },
    body: {
      fontSize: 10,
      color: '#4a5568',
      lineSpacing: 1.4
    },
    card: {
      fontSize: 10,
      color: '#2d3748',
      border: [1, 1, 1, 1],
      borderColor: '#e2e8f0',
      borderRadius: 6,
      padding: 12,
      margin: [0, 0, 10, 0],
      lineHeight: 1.5
    },
    verdict: {
      fontSize: 11,
      color: '#2d3748',
      border: [1, 1, 1, 1],
      borderColor: '#1a1a2e',
      borderRadius: 6,
      padding: 15,
      background: '#f7fafc',
      margin: [0, 0, 0, 0],
      lineHeight: 1.6
    }
  },

  defaultStyle: {
    font: 'Helvetica'
  },

  pageMargins: [40, 60, 40, 60]
};

const pdfDoc = new pdfMake.createPdf(docDefinition);
pdfDoc.save('property-ledger-name-options.pdf');
console.log('PDF generated successfully!');