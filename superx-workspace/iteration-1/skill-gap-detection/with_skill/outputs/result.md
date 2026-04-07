# superx Orchestration Result

**Prompt:** "Build me a marketing landing page with great SEO, nice animations, and make sure the OG image previews look good on Twitter and LinkedIn. Oh and I need hreflang tags because we're launching in 3 languages."

**Date:** 2026-04-06
**Autonomy Level:** 2 (Checkpoint)
**Phase:** Planning

---

## 1. Prompt Analysis & Domain Identification

superx analyzes the user's prompt and identifies the following required domains:

| # | Domain | Signal from Prompt | Priority |
|---|--------|--------------------|----------|
| 1 | **frontend** | "marketing landing page", "nice animations" | Critical |
| 2 | **design** | "marketing landing page" (visual design, layout, hierarchy, branding) | Critical |
| 3 | **seo-core** | "great SEO" | Critical |
| 4 | **seo-technical** | SEO implies crawlability, indexability, Core Web Vitals, structured data | High |
| 5 | **seo-hreflang / i18n** | "hreflang tags", "launching in 3 languages" | Critical |
| 6 | **social-preview** | "OG image previews look good on Twitter and LinkedIn" | Critical |
| 7 | **animations** | "nice animations" (motion design, interaction states, transitions) | High |
| 8 | **seo-schema** | Structured data (Organization, WebPage, Product, FAQ) for rich results | High |
| 9 | **seo-images** | OG images need optimization (alt text, sizing, format) | Medium |
| 10 | **content** | Landing page copy, headings, CTAs (SEO-aligned) | High |
| 11 | **performance** | Landing pages must be fast (Core Web Vitals, LCP, CLS, INP) | High |
| 12 | **testing** | Cross-browser, responsive, OG preview validation | Medium |
| 13 | **accessibility** | WCAG AA compliance on all UI elements | Medium |

---

## 2. Skill Detection (`detect-skills` Output)

superx scans all installed skills/plugins. Here is the full inventory matched against each identified domain:

### 2a. Installed Skills Inventory (Relevant Subset)

```
SKILL DETECTION RESULTS
=======================
Total installed skills: 50+
Domains requiring coverage: 13

Scanning installed skills against domain requirements...
```

| Domain | Installed Skill(s) Found | Match Quality |
|--------|--------------------------|---------------|
| **frontend** | `superpowers:executing-plans`, `superpowers:subagent-driven-development` | Partial -- general coding skills, no frontend-specific skill |
| **design** | `design-for-ai:design`, `design-for-ai:color`, `design-for-ai:fonts`, `design-for-ai:flow`, `design-for-ai:exam`, `design-for-ai:hone`, `design-for-ai:brand` | FULL MATCH -- complete design system suite |
| **seo-core** | `seo`, `seo-plan`, `seo-audit` | FULL MATCH |
| **seo-technical** | `seo-technical` | FULL MATCH |
| **seo-hreflang / i18n** | `seo-hreflang` | FULL MATCH |
| **social-preview** | `seo-image-gen` (OG image generation), `seo-page` (meta tag analysis) | FULL MATCH |
| **animations** | `design-for-ai:flow` (motion, interaction states, responsive behavior) | FULL MATCH |
| **seo-schema** | `seo-schema` | FULL MATCH |
| **seo-images** | `seo-images` | FULL MATCH |
| **content** | `seo-content` (E-E-A-T, readability), `seo-page` (on-page analysis) | FULL MATCH |
| **performance** | `seo-technical` (Core Web Vitals, INP) | Partial -- technical SEO covers CWV but no dedicated perf skill |
| **testing** | `superpowers:test-driven-development`, `superpowers:verification-before-completion` | Partial -- no OG preview testing or cross-browser visual testing |
| **accessibility** | `design-for-ai:exam` (design audit includes a11y) | Partial -- design-focused, not a dedicated a11y audit |

### 2b. Skills That superx Always Loads (Core Skills)

These are loaded regardless of prompt content:

| Skill | Role in This Project |
|-------|---------------------|
| `claude-md-management:claude-md-improver` | Maintain CLAUDE.md with project context at each milestone |
| `pr-review-toolkit:review-pr` | Mandatory code review before any push |
| `superpowers:writing-plans` | Create detailed implementation plan |
| `superpowers:dispatching-parallel-agents` | Coordinate parallel agent execution |
| `superpowers:test-driven-development` | Test-first approach for components |
| `superpowers:verification-before-completion` | Verify all outputs before declaring done |
| `superpowers:finishing-a-development-branch` | Clean branch completion workflow |

### 2c. Conditional Skills Activated by This Prompt

| Skill | Triggered By |
|-------|-------------|
| `design-for-ai:design` | "marketing landing page" -- establish design foundations |
| `design-for-ai:color` | Landing page needs a color system |
| `design-for-ai:fonts` | Typography selection for marketing page |
| `design-for-ai:flow` | "nice animations" -- motion and interaction design |
| `design-for-ai:exam` | Design quality audit before shipping |
| `design-for-ai:hone` | Final design polish pass |
| `design-for-ai:brand` | Strip AI tells, add intentional character |
| `seo` | "great SEO" -- comprehensive SEO analysis |
| `seo-plan` | Strategic SEO planning for the landing page |
| `seo-technical` | Technical SEO (crawlability, CWV, indexability) |
| `seo-hreflang` | "hreflang tags" / "3 languages" -- international SEO |
| `seo-schema` | Structured data for rich results |
| `seo-images` | Image optimization including OG images |
| `seo-image-gen` | Generate OG/social preview images |
| `seo-content` | Content quality and E-E-A-T analysis |
| `seo-page` | Deep single-page SEO analysis |
| `seo-geo` | AI overview optimization (GEO) |

---

## 3. Skill Gap Analysis

### 3a. Gaps Identified

| # | Gap Domain | What's Missing | Severity |
|---|-----------|----------------|----------|
| 1 | **Frontend Framework** | No installed skill specifically for building landing pages (e.g., Next.js, Astro, or static-site skill). The general `superpowers` coding skills handle this but lack framework-specific patterns for marketing pages. | Low -- superx's coder agents can handle this with general knowledge + project context |
| 2 | **OG Preview Testing** | No installed skill for validating Open Graph previews across Twitter Cards and LinkedIn post previews. `seo-page` checks meta tags but doesn't render/simulate actual previews. | Medium -- can be covered by Playwright MCP for visual testing |
| 3 | **i18n Content / Translation** | `seo-hreflang` handles the hreflang tag implementation, but there is no skill for managing translated content, locale routing, or translation workflow. | Medium -- hreflang tags are covered, but the content translation pipeline is not |
| 4 | **Dedicated Accessibility Audit** | `design-for-ai:exam` covers design-level accessibility, but there is no dedicated WCAG auditing skill (axe-core, Lighthouse a11y). | Low -- can be handled via Playwright + Lighthouse in testing |
| 5 | **Performance Optimization** | `seo-technical` covers Core Web Vitals diagnostics but not performance optimization techniques (image compression, code splitting, preloading strategies). | Low -- standard knowledge covers this |

### 3b. Gap Resolution Strategy

**For each gap, superx would communicate to the user:**

```
I've analyzed your request and matched it against installed skills. Here's what I found:

COVERED (full match):
  - SEO: 9 specialized SEO skills covering strategy, technical, hreflang,
    schema, images, content, and OG image generation
  - Design: Full design-for-ai suite (7 skills) for visual design, color,
    typography, animations, auditing, and brand character
  - Code review, testing, planning: Core superpowers suite

GAPS DETECTED:
  1. OG Preview Testing -- I can validate meta tags and generate OG images,
     but to visually verify how they render on Twitter and LinkedIn, I'll use
     the Playwright MCP server to take screenshots of preview debugger tools.

  2. i18n Content Management -- seo-hreflang handles the tags, but you'll need
     to provide the translated content for the 3 languages, or I can scaffold
     the i18n file structure and you fill in translations. No dedicated
     translation skill is installed.

  3. No critical gaps. I can proceed with current skills. Want me to search
     for any additional skills before starting?
```

### 3c. Authenticity Check (Simulated)

If the user requested a search for additional skills to fill gaps, superx would run `authenticity-check` on any recommended packages:

```
AUTHENTICITY CHECK: i18n-content-skill (hypothetical)
======================================================
Publisher:          @verified-publisher
Verified:           YES
Downloads:          12,400/month
Last Updated:       2026-03-28 (9 days ago)
License:            MIT
GitHub Stars:       890
Open Issues:        4 (none critical)
Dependencies:       2 (both well-known)
Security Advisories: None
Trust Score:        92/100 -- RECOMMENDED

AUTHENTICITY CHECK: og-preview-validator (hypothetical)
=======================================================
Publisher:          @unknown-publisher
Verified:           NO
Downloads:          340/month
Last Updated:       2025-11-02 (5 months ago)
License:            MIT
GitHub Stars:       45
Open Issues:        12 (3 stale)
Dependencies:       8 (2 unmaintained)
Security Advisories: None
Trust Score:        38/100 -- NOT RECOMMENDED
  Reason: Unverified publisher, low download count, stale maintenance.
  Alternative: Use Playwright MCP to manually test OG previews via
  Twitter Card Validator and LinkedIn Post Inspector.
```

**CTO Decision:** Skip the low-trust OG preview skill. Use Playwright MCP (already available) to navigate to Twitter Card Validator and LinkedIn Post Inspector and take screenshots. This is more reliable than an unmaintained skill.

---

## 4. Task Decomposition & Dependency Graph

### 4a. Sub-Projects

```
DEPENDENCY GRAPH
================

  [1] design-foundations ----+
      (no deps)              |
                             v
  [2] seo-strategy -----> [5] frontend-build
      (no deps)              ^       |
                             |       v
  [3] i18n-structure ---+   [6] animations-polish
      (no deps)         |         |
                        |         v
  [4] og-image-gen -----|-> [7] seo-technical-pass
      (depends on: 1)   |         |
                        |         v
                        +-> [8] og-preview-testing
                                  |
                                  v
                            [9] quality-review
                                  |
                                  v
                            [10] final-audit
```

### 4b. Sub-Project Details

| ID | Sub-Project | Dependencies | Agent Type | Skills Used | Parallel Group |
|----|-------------|-------------|------------|-------------|----------------|
| 1 | **design-foundations** | none | `design` | `design-for-ai:design`, `design-for-ai:color`, `design-for-ai:fonts`, `design-for-ai:brand` | A |
| 2 | **seo-strategy** | none | `architect` | `seo-plan`, `seo-content`, `seo-geo` | A |
| 3 | **i18n-structure** | none | `coder` | `seo-hreflang` | A |
| 4 | **og-image-gen** | 1 (needs brand colors/fonts) | `coder` | `seo-image-gen` | B |
| 5 | **frontend-build** | 1, 2, 3 | `coder` | `superpowers:tdd`, `superpowers:executing-plans` | C |
| 6 | **animations-polish** | 5 | `design` | `design-for-ai:flow` | D |
| 7 | **seo-technical-pass** | 5 | `coder` | `seo-technical`, `seo-schema`, `seo-images`, `seo-page` | D |
| 8 | **og-preview-testing** | 4, 5 | `test-runner` | Playwright MCP | E |
| 9 | **quality-review** | 6, 7, 8 | `reviewer` + `lint-quality` | `pr-review-toolkit:review-pr`, `design-for-ai:exam`, `design-for-ai:hone` | F |
| 10 | **final-audit** | 9 | `architect` | `seo-audit`, `seo-technical`, `superpowers:verification-before-completion` | G |

**Parallel execution windows:**
- **Group A** (3 agents parallel): design-foundations + seo-strategy + i18n-structure
- **Group B** (1 agent): og-image-gen (waits for design-foundations)
- **Group C** (1 agent): frontend-build (waits for A to complete)
- **Group D** (2 agents parallel): animations-polish + seo-technical-pass
- **Group E** (1 agent): og-preview-testing
- **Group F** (2 agents parallel): quality review + lint
- **Group G** (1 agent): final audit

---

## 5. Agent Spawn Specifications

### Agent 1: Design Foundations (design agent)

```
Handle the design foundations for a marketing landing page.

Scope:
- Establish design purpose, target audience, and aesthetic direction
- Build a complete color system (primary, secondary, accent, neutral, semantic)
- Select and pair typography (headings, body, accent)
- Define spacing scale, border radii, shadow system
- Create a visual hierarchy plan for the landing page layout
- Define the brand character (strip AI tells, add intentional design decisions)

Design-for-ai skills to invoke (in order):
1. design-for-ai:design -- establish foundations
2. design-for-ai:color -- build color system from color science
3. design-for-ai:fonts -- select and pair typography
4. design-for-ai:brand -- add intentional character, strip AI tells

Output:
- Design tokens file (CSS custom properties or Tailwind config)
- Color palette with contrast ratios documented
- Typography scale with font selections
- Layout wireframe description (sections, hierarchy, flow)
- Design rationale document

Constraints:
- Do not write HTML/JSX -- that's the frontend-build agent's job
- Focus on design decisions and token definitions
- Ensure all color combinations meet WCAG AA contrast (4.5:1 for text)
- Design must work across 3 language variants (text may be longer in some languages)

After completion, run:
  superx-state set '.plan.sub_projects[0].status' '"complete"'
```

### Agent 2: SEO Strategy (architect agent)

```
Create an SEO strategy for a marketing landing page launching in 3 languages.

Scope:
- Define target keywords and search intent per language/market
- Plan content structure (headings hierarchy, semantic sections)
- Define meta tag strategy (title, description per language)
- Plan internal linking and URL structure for multi-language
- Define E-E-A-T signals appropriate for a marketing landing page
- Plan for AI overview optimization (GEO)

Skills to invoke:
1. seo-plan -- strategic SEO planning
2. seo-content -- content quality and E-E-A-T framework
3. seo-geo -- generative engine optimization

Output:
- Keyword targets per language
- Content brief (heading structure, word count targets, CTA placement)
- Meta tag templates for each language variant
- URL structure recommendation (subdirectory vs subdomain)
- Structured data plan (which schema types to implement)

Constraints:
- Read-only -- do not create any files, produce a strategy document
- Consider that this is a landing page, not a full site
- Account for hreflang implementation in URL strategy

After completion, run:
  superx-state set '.plan.sub_projects[1].status' '"complete"'
```

### Agent 3: i18n Structure (coder agent)

```
Scaffold the internationalization structure for a landing page in 3 languages.

Scope:
- Set up locale file structure (e.g., /en/, /es/, /fr/ or locale JSON files)
- Implement hreflang tag generation logic
- Create translation key structure for all landing page content
- Set up locale routing / URL patterns
- Implement language switcher component skeleton

Skills to invoke:
1. seo-hreflang -- hreflang implementation and validation

Output:
- Locale directory structure or i18n config file
- Hreflang tag implementation (HTML head or HTTP headers)
- Translation JSON/YAML scaffolds with keys for all page sections
- Language detection/routing logic
- x-default hreflang for default language

Constraints:
- Use standard hreflang format validated by seo-hreflang skill
- Support the 3 target languages (user to confirm which 3)
- Ensure hreflang tags are bidirectional (each page references all variants)
- Do not write actual translated content -- scaffold with English placeholders

After completion, run:
  superx-state set '.plan.sub_projects[2].status' '"complete"'
```

### Agent 4: OG Image Generation (coder agent)

```
Generate Open Graph and social preview images for the landing page.

Scope:
- Create OG images optimized for Twitter Cards (summary_large_image: 1200x628)
- Create OG images optimized for LinkedIn sharing (1200x627)
- Generate one OG image per language variant (3 total)
- Implement og:image, og:title, og:description, twitter:card meta tags
- Ensure images use brand colors and fonts from design-foundations output

Skills to invoke:
1. seo-image-gen -- AI image generation for OG/social preview images

Context:
- Read design tokens from Agent 1 output (colors, fonts, brand direction)
- Images should include: page title, brand mark, subtle background
- Text on images must be in the respective language

Output:
- 3 OG images (one per language, properly sized)
- Meta tag implementation for og:image, twitter:image, twitter:card
- LinkedIn-specific meta tags (linkedin:owner if applicable)

Constraints:
- OG images must be under 5MB (Twitter requirement)
- Use recommended dimensions: 1200x628px
- Include twitter:card = "summary_large_image" for large preview
- Ensure og:image uses absolute URLs

After completion, run:
  superx-state set '.plan.sub_projects[3].status' '"complete"'
```

### Agent 5: Frontend Build (coder agent)

```
Build the marketing landing page incorporating design, SEO, and i18n foundations.

Scope:
- Implement the full landing page HTML/JSX structure
- Apply design tokens (colors, typography, spacing) from Agent 1
- Implement SEO elements from Agent 2 strategy (meta tags, heading hierarchy,
  semantic HTML, structured data)
- Integrate i18n structure from Agent 3 (hreflang, locale routing)
- Integrate OG images from Agent 4
- Implement responsive layout (mobile-first)
- Add semantic HTML5 elements (header, nav, main, section, footer)
- Implement Core Web Vitals best practices (LCP, CLS, INP)

Context:
- Read outputs from Agents 1-4
- Follow design-for-ai principles for visual hierarchy
- Apply seo-schema skill for structured data implementation
- Apply seo-images skill for image optimization

Skills to invoke:
1. superpowers:test-driven-development -- write tests alongside components
2. seo-schema -- implement structured data
3. seo-images -- optimize all images

Output:
- Complete landing page with all sections
- Responsive layout across mobile/tablet/desktop breakpoints
- All meta tags (SEO + OG + hreflang) in place
- Structured data (JSON-LD) embedded
- Component tests for key interactive elements

Constraints:
- Only create files in the agreed project structure
- Do not deviate from the design system established by Agent 1
- Ensure all images have alt text
- Ensure proper heading hierarchy (single h1, logical h2-h6)
- No render-blocking resources above the fold

After completion, run:
  superx-state set '.plan.sub_projects[4].status' '"complete"'
```

### Agent 6: Animations Polish (design agent)

```
Add animations and interaction design to the marketing landing page.

Scope:
- Implement scroll-triggered entrance animations for page sections
- Add hover/focus interaction states for CTAs and interactive elements
- Implement smooth page transitions (if multi-section SPA behavior)
- Add loading states and skeleton screens where appropriate
- Ensure animations respect prefers-reduced-motion

Design-for-ai skills to invoke:
1. design-for-ai:flow -- motion, interaction states, responsive behavior

Context:
- Read the built landing page from Agent 5
- Follow the design system tokens from Agent 1
- Animations should enhance, not distract -- marketing page needs to convert

Output:
- CSS animations / JS animation implementations
- Intersection Observer based scroll animations
- Hover/focus/active states for all interactive elements
- prefers-reduced-motion media query fallbacks
- Performance-optimized animations (transform/opacity only, no layout thrash)

Constraints:
- Do not change page structure or content -- only add motion/interaction
- Animations must not cause CLS (Cumulative Layout Shift)
- Keep total animation JS under 10KB gzipped
- Test at 60fps on mid-range devices
- Do not use heavy animation libraries unless justified

After completion, run:
  superx-state set '.plan.sub_projects[5].status' '"complete"'
```

### Agent 7: SEO Technical Pass (coder agent)

```
Run a comprehensive technical SEO pass on the completed landing page.

Scope:
- Validate all meta tags (title, description, canonical, robots)
- Validate structured data (JSON-LD) with schema.org compliance
- Check image optimization (alt text, sizes, formats, lazy loading)
- Validate hreflang implementation (bidirectional, valid codes, x-default)
- Check Core Web Vitals indicators (LCP, CLS, INP)
- Validate robots.txt and sitemap.xml
- Check for JavaScript rendering issues
- Validate mobile usability

Skills to invoke (in order):
1. seo-technical -- full technical audit
2. seo-schema -- structured data validation
3. seo-images -- image optimization audit
4. seo-hreflang -- hreflang validation
5. seo-page -- deep single-page analysis

Output:
- Technical SEO audit report with pass/fail per category
- List of issues with severity and fix instructions
- Fixes applied directly for any issues found
- Validated structured data output
- Hreflang validation report

Constraints:
- Fix issues found, do not just report them
- Do not change design or visual layout
- Preserve all animations and interaction behavior
- Re-validate after fixes to confirm resolution

After completion, run:
  superx-state set '.plan.sub_projects[6].status' '"complete"'
```

### Agent 8: OG Preview Testing (test-runner agent)

```
Validate Open Graph previews across Twitter and LinkedIn.

Scope:
- Test OG meta tags render correctly for all 3 language variants
- Verify Twitter Card preview (summary_large_image) displays properly
- Verify LinkedIn share preview displays properly
- Check image dimensions, text truncation, and fallback behavior
- Validate og:locale and og:locale:alternate tags

Tools:
- Use Playwright MCP to navigate to:
  - Twitter Card Validator (https://cards-dev.twitter.com/validator)
  - LinkedIn Post Inspector (https://www.linkedin.com/post-inspector/)
  - Facebook Sharing Debugger (https://developers.facebook.com/tools/debug/)
- Take screenshots of each preview for documentation
- Validate meta tags programmatically with HTML parsing

Protocol:
1. Start local dev server for the landing page
2. Use Playwright to navigate to each validator tool
3. Input each language variant URL
4. Screenshot the rendered preview
5. Compare against expected dimensions and content
6. Report any issues (truncated titles, wrong images, missing descriptions)

Output:
- Screenshot evidence of OG previews on Twitter, LinkedIn, Facebook
- Pass/fail report per language variant per platform
- List of any meta tag issues with fixes

After completion, run:
  superx-state set '.plan.sub_projects[7].status' '"complete"'
```

### Agent 9: Quality Review (reviewer + lint-quality agents)

```
REVIEWER AGENT:
Review all changes before push for the marketing landing page project.

Review scope:
- Run git diff to see all changes
- Verify design system consistency across all components
- Check SEO implementation against the strategy from Agent 2
- Verify hreflang implementation completeness
- Check OG meta tags for all language variants
- Verify accessibility (WCAG AA)
- Check animation performance implications
- Verify no hardcoded strings (all text through i18n)

Design review skills:
1. design-for-ai:exam -- theory-backed design audit
2. design-for-ai:hone -- final quality pass

Output:
- Verdict: APPROVE / REQUEST CHANGES / BLOCK
- Issues list with severity

---

LINT-QUALITY AGENT:
Run lint and formatting checks on the project.

Protocol:
1. Run configured linter (ESLint, Stylelint, etc.)
2. Run HTML validation
3. Run CSS validation
4. Check for console.log or debug statements
5. Verify consistent code style
```

### Agent 10: Final Audit (architect agent)

```
Run the final comprehensive audit before declaring the project complete.

Scope:
1. Run seo-audit skill for full site health score
2. Run seo-technical for final technical validation
3. Run superpowers:verification-before-completion
4. Verify all sub-projects are marked complete in superx-state.json
5. Verify all quality gates pass
6. Generate final project summary

Output:
- SEO health score
- Technical audit pass/fail
- Complete project summary with:
  - What was built
  - Design decisions and rationale
  - SEO implementation summary
  - i18n / hreflang coverage
  - OG preview validation results
  - Performance metrics
  - Known limitations or follow-up items
```

---

## 6. Quality Gate Enforcement

### Pre-Push Checklist

| Gate | Check | Tool/Skill |
|------|-------|-----------|
| Tests pass | Component tests, a11y tests, OG meta validation tests | `superpowers:test-driven-development` |
| Lint clean | ESLint, Stylelint, HTML validator, Prettier | `lint-quality` agent |
| Conflict reflection | Review all skill conflicts (design vs SEO, animation vs performance) | `conflict-log` review |
| PR review | Mandatory code review by reviewer agent | `pr-review-toolkit:review-pr` |
| Design audit | Visual quality and a11y check | `design-for-ai:exam` + `design-for-ai:hone` |
| SEO audit | Full technical SEO validation | `seo-audit` |
| OG preview verified | Screenshots from Twitter/LinkedIn validators | Playwright MCP |
| Hreflang validated | Bidirectional hreflang, valid codes, x-default present | `seo-hreflang` |
| CLAUDE.md updated | Project context persisted | `claude-md-management:claude-md-improver` |

### Anticipated Conflicts & Resolutions

| Conflict | Skills Involved | CTO Resolution |
|----------|----------------|----------------|
| Animation JS size vs SEO performance (CWV) | `design-for-ai:flow` vs `seo-technical` | Prefer CSS-only animations (transform/opacity). Only use JS for Intersection Observer triggers. Keep bundle under 10KB. Log: "Chose CSS animations over JS library to preserve Core Web Vitals scores." |
| Custom fonts vs page load speed | `design-for-ai:fonts` vs `seo-technical` | Use font-display: swap, preload critical fonts, limit to 2 font families max, subset for each language. Log: "Limited font families to 2 with subsetting to balance brand typography against LCP." |
| Rich structured data vs clean HTML | `seo-schema` vs frontend simplicity | Use JSON-LD (not microdata) to keep markup clean. Log: "JSON-LD chosen over microdata to keep HTML semantic and maintainable." |
| Image quality vs file size (OG images) | `seo-image-gen` vs `seo-images` | Generate at 1200x628, compress to WebP with JPEG fallback, target <200KB per image. Log: "OG images compressed to WebP with quality 85 for optimal size/quality ratio." |
| i18n text length vs design layout | `seo-hreflang` (longer text in some languages) vs `design-for-ai:design` | Design with flexible containers, test with longest language variant, use CSS clamp() for responsive text. Log: "Layout uses flexible containers tested against longest locale strings." |

Each conflict would be logged via:
```bash
conflict-log add "design-for-ai:flow" "seo-technical" \
  "Animation JS bundle may impact Core Web Vitals LCP/TBT scores" \
  "Chose CSS-only animations (transform/opacity) with Intersection Observer triggers. JS kept under 10KB gzipped."
```

---

## 7. State Tracking

### superx-state.json (Initial State After Decomposition)

```json
{
  "version": "1.0.0",
  "project": {
    "name": "marketing-landing-page-i18n",
    "phase": "planning",
    "autonomy_level": 2
  },
  "plan": {
    "sub_projects": [
      {
        "id": "design-foundations",
        "status": "pending",
        "agent_id": null,
        "depends_on": [],
        "skills_used": [
          "design-for-ai:design",
          "design-for-ai:color",
          "design-for-ai:fonts",
          "design-for-ai:brand"
        ],
        "agent_type": "design"
      },
      {
        "id": "seo-strategy",
        "status": "pending",
        "agent_id": null,
        "depends_on": [],
        "skills_used": ["seo-plan", "seo-content", "seo-geo"],
        "agent_type": "architect"
      },
      {
        "id": "i18n-structure",
        "status": "pending",
        "agent_id": null,
        "depends_on": [],
        "skills_used": ["seo-hreflang"],
        "agent_type": "coder"
      },
      {
        "id": "og-image-gen",
        "status": "pending",
        "agent_id": null,
        "depends_on": ["design-foundations"],
        "skills_used": ["seo-image-gen"],
        "agent_type": "coder"
      },
      {
        "id": "frontend-build",
        "status": "pending",
        "agent_id": null,
        "depends_on": [
          "design-foundations",
          "seo-strategy",
          "i18n-structure"
        ],
        "skills_used": [
          "superpowers:test-driven-development",
          "seo-schema",
          "seo-images"
        ],
        "agent_type": "coder"
      },
      {
        "id": "animations-polish",
        "status": "pending",
        "agent_id": null,
        "depends_on": ["frontend-build"],
        "skills_used": ["design-for-ai:flow"],
        "agent_type": "design"
      },
      {
        "id": "seo-technical-pass",
        "status": "pending",
        "agent_id": null,
        "depends_on": ["frontend-build"],
        "skills_used": [
          "seo-technical",
          "seo-schema",
          "seo-images",
          "seo-hreflang",
          "seo-page"
        ],
        "agent_type": "coder"
      },
      {
        "id": "og-preview-testing",
        "status": "pending",
        "agent_id": null,
        "depends_on": ["og-image-gen", "frontend-build"],
        "skills_used": [],
        "agent_type": "test-runner",
        "notes": "Uses Playwright MCP for visual preview validation"
      },
      {
        "id": "quality-review",
        "status": "pending",
        "agent_id": null,
        "depends_on": [
          "animations-polish",
          "seo-technical-pass",
          "og-preview-testing"
        ],
        "skills_used": [
          "pr-review-toolkit:review-pr",
          "design-for-ai:exam",
          "design-for-ai:hone"
        ],
        "agent_type": "reviewer"
      },
      {
        "id": "final-audit",
        "status": "pending",
        "agent_id": null,
        "depends_on": ["quality-review"],
        "skills_used": [
          "seo-audit",
          "seo-technical",
          "superpowers:verification-before-completion"
        ],
        "agent_type": "architect"
      }
    ],
    "dependency_graph": {
      "design-foundations": [],
      "seo-strategy": [],
      "i18n-structure": [],
      "og-image-gen": ["design-foundations"],
      "frontend-build": [
        "design-foundations",
        "seo-strategy",
        "i18n-structure"
      ],
      "animations-polish": ["frontend-build"],
      "seo-technical-pass": ["frontend-build"],
      "og-preview-testing": ["og-image-gen", "frontend-build"],
      "quality-review": [
        "animations-polish",
        "seo-technical-pass",
        "og-preview-testing"
      ],
      "final-audit": ["quality-review"]
    }
  },
  "conflict_log": [],
  "agent_history": [],
  "quality_gates": {
    "tests_passing": false,
    "lint_clean": false,
    "last_review": null,
    "conflict_reflection_done": false,
    "dirty": true
  },
  "maintainer": {
    "enabled": false,
    "issue_sources": [],
    "pending_fixes": [],
    "release_queue": []
  },
  "communication_log": [],
  "skill_detection": {
    "domains_identified": [
      "frontend",
      "design",
      "seo-core",
      "seo-technical",
      "seo-hreflang",
      "social-preview",
      "animations",
      "seo-schema",
      "seo-images",
      "content",
      "performance",
      "testing",
      "accessibility"
    ],
    "skills_matched": {
      "design": [
        "design-for-ai:design",
        "design-for-ai:color",
        "design-for-ai:fonts",
        "design-for-ai:flow",
        "design-for-ai:exam",
        "design-for-ai:hone",
        "design-for-ai:brand"
      ],
      "seo": [
        "seo",
        "seo-plan",
        "seo-technical",
        "seo-hreflang",
        "seo-schema",
        "seo-images",
        "seo-image-gen",
        "seo-content",
        "seo-page",
        "seo-geo",
        "seo-audit"
      ],
      "core": [
        "superpowers:test-driven-development",
        "superpowers:writing-plans",
        "superpowers:dispatching-parallel-agents",
        "superpowers:verification-before-completion",
        "superpowers:finishing-a-development-branch",
        "pr-review-toolkit:review-pr",
        "claude-md-management:claude-md-improver"
      ],
      "testing-tools": ["Playwright MCP (browser automation)"]
    },
    "gaps": [
      {
        "domain": "frontend-framework",
        "severity": "low",
        "resolution": "General coder agent knowledge sufficient"
      },
      {
        "domain": "og-preview-testing",
        "severity": "medium",
        "resolution": "Playwright MCP covers this via browser automation"
      },
      {
        "domain": "i18n-content-management",
        "severity": "medium",
        "resolution": "seo-hreflang covers tags; content translation requires user input"
      },
      {
        "domain": "dedicated-a11y-audit",
        "severity": "low",
        "resolution": "design-for-ai:exam + Lighthouse via Playwright"
      },
      {
        "domain": "performance-optimization",
        "severity": "low",
        "resolution": "seo-technical covers CWV; standard optimization knowledge sufficient"
      }
    ]
  }
}
```

---

## 8. Execution Summary

### What superx would communicate to the user:

```
I'll break this into 10 sub-projects across 7 execution phases.

First, 3 agents run in parallel:
  - Design agent establishes visual foundations (color, typography, layout)
  - Architect agent creates the SEO strategy
  - Coder agent scaffolds the i18n/hreflang structure

Then OG images get generated using the brand system, followed by the main
frontend build that integrates everything.

After the page is built, animations and SEO technical audit run in parallel.
Then OG previews get tested on actual Twitter/LinkedIn validators via Playwright.

Finally, a full quality review and SEO audit before shipping.

Skill coverage looks strong:
  - 11 SEO skills covering every angle (technical, hreflang, schema, images,
    content, OG generation, audit)
  - 7 design-for-ai skills for the full design pipeline
  - Core superpowers for planning, testing, and code review
  - Playwright MCP for OG preview validation

No critical skill gaps. Two medium gaps (OG preview testing, i18n content)
are handled by Playwright MCP and scaffolding respectively.

One question before I start: which 3 languages are you targeting?
(I need this for hreflang codes and OG image text.)

Ready to proceed at Autonomy Level 2 (Checkpoint). I'll pause at each
major milestone for your review.
```

### Agent Spawn Count: 12 total

| Agent Type | Count | Sub-Projects |
|-----------|-------|-------------|
| design | 2 | design-foundations, animations-polish |
| architect | 2 | seo-strategy, final-audit |
| coder | 4 | i18n-structure, og-image-gen, frontend-build, seo-technical-pass |
| test-runner | 1 | og-preview-testing |
| reviewer | 1 | quality-review (code review) |
| lint-quality | 1 | quality-review (lint pass) |
| docs-writer | 1 | CLAUDE.md updates (triggered at milestones) |

### Maximum Parallel Agents at Any Point: 3

(Group A: design-foundations + seo-strategy + i18n-structure)

This stays within reasonable resource limits while maximizing throughput.

---

## 9. Key Observations

### What Went Well (Skill Coverage)

1. **SEO is exceptionally well-covered.** With 11 specialized SEO skills installed (seo, seo-plan, seo-technical, seo-hreflang, seo-schema, seo-images, seo-image-gen, seo-content, seo-page, seo-geo, seo-audit), every SEO dimension the user requested has a dedicated skill. The hreflang skill directly addresses the multi-language requirement.

2. **Design pipeline is complete.** The design-for-ai suite provides a structured pipeline from foundations through color, typography, animation, auditing, and brand character. This maps perfectly to the "nice animations" and visual quality requirements.

3. **OG image generation is handled.** The seo-image-gen skill specifically covers "OG/social preview images" which is exactly what the user asked for with Twitter and LinkedIn previews.

4. **Cross-cutting quality skills are strong.** pr-review-toolkit, superpowers TDD, verification-before-completion, and finishing-a-development-branch provide a robust quality pipeline.

### What Required Gap-Filling

1. **OG preview validation** had no dedicated skill but is fully handled by Playwright MCP (already available as a tool). The authenticity check correctly rejected a hypothetical low-trust external skill in favor of the built-in MCP capability.

2. **i18n content management** is a real gap -- seo-hreflang handles the tags but there is no translation workflow skill. This is escalated to the user as a question ("which 3 languages?") and scaffolded with placeholder content.

3. **No gaps are blocking.** All identified gaps have viable workarounds using existing tools and general knowledge. superx correctly assessed that no additional skill installation is required to proceed.

### Multi-Domain Orchestration Quality

The decomposition correctly identifies:
- **True parallelism opportunities** (3 independent foundation tasks)
- **Hard dependencies** (OG images need brand colors before generation)
- **Soft dependencies** (animations come after frontend build to avoid rework)
- **Cross-cutting concerns** (SEO technical audit checks work from multiple agents)
- **Potential conflicts** (5 anticipated conflicts logged with preemptive resolutions)

The design agent is specifically spawned for visual work (not a generic coder), and it uses the full design-for-ai skill chain in the correct order (foundations before color before typography before brand).
