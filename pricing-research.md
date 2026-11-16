# Pricing Module Research for Property Ledger

## Executive Summary

After researching leading property management SaaS platforms, this document compares their pricing models and recommends the optimal approach for Property Ledger.

---

## Research Methodology

Research was conducted on the following platforms (November 2026):
- **AppFolio** - Enterprise property management software
- **Buildium** - Popular property management solution
- **Rent Manager** - Comprehensive property management
- **TenantCloud** - SMB-focused property management
- **Landlord Studio** - Independent landlord solutions
- **Rentberry** - Tenant payment platform

---

## Comparison Matrix

### Table 1: Pricing Tiers Structure

| Platform | Tiers | Pricing Model | Entry Price | Key Features |
|----------|-------|---------------|-------------|--------------|
| **AppFolio** | 3 (Core, Plus, Max) | $/Unit/Month | $1.49/unit | Accounting, leasing, maintenance |
| **Buildium** | 3 (Essential, Growth, Premium) | Fixed Monthly | $65/mo | Core accounting, tenant portal |
| **Rent Manager** | 3 (Basic, Plus, Premium) | Custom Quote | "Contact Sales" | Enterprise features, AI tools |
| **TenantCloud** | 3 (Free, Pro, Pro Plus) | Free + Usage | $0 | Free tier available |
| **Landlord Studio** | 3 (GO, Pro, Pro Plus) | Free + Paid | $0 | GO free plan, Pro upgrades |
| **Property Ledger (Current)** | 3 (Starter, Growth, Commercial) | KES/Annual | KES 0 | M-Pesa integration, WhatsApp |

### Table 2: Feature Comparison per Tier

| Feature | AppFolio Core | Buildium Essential | Property Ledger Starter |
|---------|---------------|-------------------|------------------------|
| **Properties** | Unlimited | Unlimited | 1 |
| **Units** | Pay per unit | Pay per unit | 10 |
| **Accounting** | ✓ | ✓ | ✓ |
| **Mobile App** | ✓ | ✓ | - |
| **Tenant Portal** | ✓ | ✓ | ✓ |
| **M-Pesa Integration** | - | - | ✓ |
| **WhatsApp Receipts** | - | - | ✓ |

| Feature | AppFolio Plus | Buildium Growth | Property Ledger Growth |
|---------|---------------|-----------------|------------------------|
| **AI Tools** | ✓ | ✓ | - |
| **WhatsApp** | ✓ | ✓ | ✓ |
| **Caretaker Assign** | ✓ | ✓ | ✓ |
| **Expense Tracking** | ✓ | ✓ | ✓ |
| **Unit Limit** | 50 | 50 | 50 |

| Feature | AppFolio Max | Buildium Premium | Property Ledger Commercial |
|---------|--------------|------------------|----------------------------|
| **API Access** | ✓ | ✓ | ✓ |
| **Unlimited Units** | ✓ | ✓ | ✓ |
| **AI Suite** | ✓ | ✓ | ✓ |
| **Dedicated Support** | ✓ | ✓ | ✓ |

---

## Pricing Model Analysis

### 1. Per-Unit Pricing (AppFolio)
```
Pros:
- Scales naturally with portfolio growth
- Clear correlation: more units = more value
Cons:
- Unpredictable costs for landlords
- Penalizes expansion
```

### 2. Fixed Monthly Pricing (Buildium, Property Ledger current)
```
Pros:
- Predictable costs
- Easy budgeting
- Tiered by unit limits works well
Cons:
- Less flexible scaling
- Can price out SMB landlords
```

### 3. Freemium Model (TenantCloud, Landlord Studio)
```
Pros:
- Low barrier to entry
- User acquisition through free tier
- Convert engaged users
Cons:
- Revenue delayed
- Support costs for free users
```

---

## Key Insights

### Pricing Position in Market

| Position | Monthly Range | Typical Users |
|----------|---------------|---------------|
| **Entry Level** | $0 - $65 | Individual landlords, small portfolios |
| **Mid-Market** | $65 - $200 | Growing portfolios, 10-50 units |
| **Enterprise** | $200+ | Agencies, 50+ units |
| **Property Ledger (Growth)** | KES 2,500 ≈ $22/mo | Mid-market positioning ✓ |

### Competitive Advantages for Property Ledger

1. **M-Pesa Integration** - Unique in East Africa market
2. **WhatsApp Receipts** - Native to Kenyan communication habits
3. **Kenya-Specific Currency (KES)** - Localized pricing
4. **Caretaker Management** - Specialized tenant delegation
5. **Arrears Aging Reports** - Compliance-focused

---

## Findings & Recommendations

### Current Pricing Module Strengths
- ✓ Competitive pricing for Kenyan market
- ✓ Clear tier progression (Free → Growth → Commercial)
- ✓ Good feature alignment with user needs
- ✓ Uses local currency (KES) effectively

### Areas for Enhancement

#### 1. **Add a Free Tier**
Current: Starter = Free (0 units)
Recommendation: Better define free tier with meaningful limits
Suggested: "Starter - Free forever" with 1 property, basic features

#### 2. **Clarify Unit Limits**
Current: "Up to 10 units" for Starter
Recommendation: Make limits clearer with visual indicators
Add: "You'll never be locked out" messaging

#### 3. **Add Usage-Based Components**
Consider hybrid pricing:
- Base monthly fee + small per-unit fee above threshold
- This matches AppFolio's model without the complexity

#### 4. **Improve Annual Savings Presentation**
Current: "~17% off" text badge
Recommendation: More prominent savings calculation
Example: "Save KES 2,500/year with annual billing"

#### 5. **Add Value Comparison Section**
Add a feature comparison table:
```
| Feature | Starter | Growth | Commercial |
|---------|---------|--------|------------|
| M-Pesa | ✓ | ✓ | ✓ |
| WhatsApp | - | ✓ | ✓ |
| Caretaker | - | ✓ | ✓ |
| Bulk Invoices | - | ✓ | ✓ |
```

#### 6. **Add Testimonials/Trust Signals**
- Number of active portfolios
- Properties managed
- Customer satisfaction rating

---

## Recommended Pricing Module Architecture

### Tier Structure
| Tier | Target | Price | Key Features |
|------|--------|-------|--------------|
| **Starter** | Individual landlords | Free | 1 Property, 10 Units, M-Pesa |
| **Growth** | Growing portfolios | KES 2,500/mo (KES 25,000/yr) | Up to 50 Units, WhatsApp, Caretakers |
| **Commercial** | Agencies | Custom | Unlimited, API, Dedicated Support |

### Implementation Recommendations

1. **Add Visual Tier Comparison**
   - Three-column card layout
   - Side-by-side feature checkmarks
   - Clear "Most Popular" badge

2. **Add Billing Toggle Enhancement**
   - Show exact annual savings amount
   - Auto-select popular annual billing

3. **Add Unit Calculator**
   - Dynamic pricing based on unit count
   - "You might need Growth at 50+ units"

4. **Add FAQ Specific to Pricing**
   - Will I be charged for extra units?
   - Can I change plans anytime?
   - What happens to my data if I cancel?

---

## Conclusion

Property Ledger's current pricing model is well-positioned for the Kenyan market with its M-Pesa integration and KES pricing. The three-tier structure (Starter free, Growth KES 2,500/month, Commercial custom) follows industry best practices.

**Recommended Next Steps:**
1. Add free tier with clearer value proposition
2. Implement visual tier comparison
3. Add billing savings calculator
4. Include usage-based alerts ("You're approaching limit")