# Marketing Landing Page: Architecture, SEO, Animations, OG Previews, and Hreflang

## Task Summary

Build a marketing landing page with:
- Strong SEO foundations
- Smooth animations
- Proper OG image previews for Twitter and LinkedIn
- Hreflang tags for 3-language international launch

---

## 1. Recommended File Structure

```
landing-page/
├── public/
│   ├── favicon.ico
│   ├── og/
│   │   ├── og-default-en.png        # 1200x630 for Facebook/LinkedIn
│   │   ├── og-default-es.png
│   │   ├── og-default-fr.png
│   │   ├── og-twitter-en.png        # 1200x675 (1.91:1) for Twitter
│   │   ├── og-twitter-es.png
│   │   └── og-twitter-fr.png
│   ├── robots.txt
│   └── sitemap.xml
├── src/
│   ├── app/
│   │   ├── [lang]/                   # Dynamic locale route
│   │   │   ├── layout.tsx            # Per-locale layout with hreflang + OG
│   │   │   ├── page.tsx              # Landing page content
│   │   │   └── opengraph-image.tsx   # Dynamic OG image generation (optional)
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Redirect to default locale
│   ├── components/
│   │   ├── Hero.tsx
│   │   ├── Features.tsx
│   │   ├── Testimonials.tsx
│   │   ├── CTA.tsx
│   │   ├── Footer.tsx
│   │   └── AnimatedSection.tsx       # Reusable scroll-triggered animation wrapper
│   ├── i18n/
│   │   ├── config.ts                 # Locale definitions
│   │   ├── dictionaries/
│   │   │   ├── en.json
│   │   │   ├── es.json
│   │   │   └── fr.json
│   │   └── getDictionary.ts          # Dictionary loader
│   └── styles/
│       └── globals.css
├── next.config.js
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

**Framework choice:** Next.js 14+ with App Router. It gives us server-side rendering (critical for SEO), built-in metadata API, dynamic OG image generation, and clean locale routing.

---

## 2. Multi-Language (i18n) Architecture

### Locale Configuration

```typescript
// src/i18n/config.ts
export const i18n = {
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr'],
} as const;

export type Locale = (typeof i18n)['locales'][number];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Espanol',
  fr: 'Francais',
};

// Full BCP-47 tags for hreflang
export const hreflangMap: Record<Locale, string> = {
  en: 'en',
  es: 'es',
  fr: 'fr',
};
```

### Dictionary Loader

```typescript
// src/i18n/getDictionary.ts
import type { Locale } from './config';

const dictionaries = {
  en: () => import('./dictionaries/en.json').then((m) => m.default),
  es: () => import('./dictionaries/es.json').then((m) => m.default),
  fr: () => import('./dictionaries/fr.json').then((m) => m.default),
};

export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]();
};
```

### Example Dictionary

```json
// src/i18n/dictionaries/en.json
{
  "meta": {
    "title": "SuperX - The Future of Project Management",
    "description": "SuperX helps teams ship faster with AI-powered project management. Join 10,000+ teams already using SuperX.",
    "ogTitle": "SuperX - Ship 10x Faster",
    "ogDescription": "AI-powered project management for modern teams."
  },
  "hero": {
    "headline": "Ship projects 10x faster",
    "subheadline": "AI-powered project management that learns how your team works.",
    "cta": "Start Free Trial",
    "secondaryCta": "Watch Demo"
  },
  "features": {
    "title": "Everything your team needs",
    "items": [
      {
        "title": "AI Task Prioritization",
        "description": "Automatically prioritize your backlog based on impact and effort."
      },
      {
        "title": "Smart Scheduling",
        "description": "AI suggests optimal sprint plans based on team velocity."
      },
      {
        "title": "Real-time Collaboration",
        "description": "Work together seamlessly with live cursors and instant sync."
      }
    ]
  }
}
```

---

## 3. SEO Meta Tags and Hreflang Implementation

This is the most critical section. The `layout.tsx` for each locale handles all SEO metadata.

### Per-Locale Layout with Full SEO

```typescript
// src/app/[lang]/layout.tsx
import { Metadata } from 'next';
import { i18n, hreflangMap, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/getDictionary';

const BASE_URL = 'https://www.superx.com';

type Props = {
  params: { lang: Locale };
  children: React.ReactNode;
};

export async function generateStaticParams() {
  return i18n.locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params: { lang },
}: {
  params: { lang: Locale };
}): Promise<Metadata> {
  const dict = await getDictionary(lang);

  // Build hreflang alternates for ALL locales + x-default
  const languages: Record<string, string> = {};
  for (const locale of i18n.locales) {
    languages[hreflangMap[locale]] = `${BASE_URL}/${locale}`;
  }
  languages['x-default'] = `${BASE_URL}/${i18n.defaultLocale}`;

  return {
    title: {
      default: dict.meta.title,
      template: `%s | SuperX`,
    },
    description: dict.meta.description,
    metadataBase: new URL(BASE_URL),

    // ---- Hreflang via Next.js alternates API ----
    alternates: {
      canonical: `${BASE_URL}/${lang}`,
      languages,
    },

    // ---- Open Graph (Facebook, LinkedIn) ----
    openGraph: {
      title: dict.meta.ogTitle,
      description: dict.meta.ogDescription,
      url: `${BASE_URL}/${lang}`,
      siteName: 'SuperX',
      locale: lang,
      type: 'website',
      images: [
        {
          url: `${BASE_URL}/og/og-default-${lang}.png`,
          width: 1200,
          height: 630,
          alt: dict.meta.ogTitle,
          type: 'image/png',
        },
      ],
    },

    // ---- Twitter Card ----
    twitter: {
      card: 'summary_large_image',
      title: dict.meta.ogTitle,
      description: dict.meta.ogDescription,
      site: '@superx',
      creator: '@superx',
      images: {
        url: `${BASE_URL}/og/og-twitter-${lang}.png`,
        alt: dict.meta.ogTitle,
        width: 1200,
        height: 675,
      },
    },

    // ---- Additional SEO ----
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      google: 'your-google-verification-code',
    },
  };
}

export default async function LocaleLayout({ children, params: { lang } }: Props) {
  const dict = await getDictionary(lang);

  // JSON-LD structured data -- static content we fully control, safe to inline.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SuperX',
    url: `${BASE_URL}/${lang}`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free trial available',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '2847',
    },
  };

  return (
    <html lang={lang} dir="ltr">
      <head>
        {/*
          JSON-LD for rich results in search.
          Note: This uses a static, developer-controlled object -- not user input --
          so XSS risk does not apply here. This is the standard Next.js pattern for
          injecting structured data. See: https://nextjs.org/docs/app/building-your-application/optimizing/metadata#json-ld
        */}
        <script
          type="application/ld+json"
          // Safe: jsonLd is a static object we construct, never from user input
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### What the Rendered HTML Produces

The above generates these critical tags in the `<head>`:

```html
<!-- Hreflang tags (generated by Next.js alternates API) -->
<link rel="alternate" hreflang="en" href="https://www.superx.com/en" />
<link rel="alternate" hreflang="es" href="https://www.superx.com/es" />
<link rel="alternate" hreflang="fr" href="https://www.superx.com/fr" />
<link rel="alternate" hreflang="x-default" href="https://www.superx.com/en" />
<link rel="canonical" href="https://www.superx.com/en" />

<!-- Open Graph (LinkedIn reads these) -->
<meta property="og:title" content="SuperX - Ship 10x Faster" />
<meta property="og:description" content="AI-powered project management for modern teams." />
<meta property="og:url" content="https://www.superx.com/en" />
<meta property="og:site_name" content="SuperX" />
<meta property="og:locale" content="en" />
<meta property="og:type" content="website" />
<meta property="og:image" content="https://www.superx.com/og/og-default-en.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="SuperX - Ship 10x Faster" />
<meta property="og:image:type" content="image/png" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@superx" />
<meta name="twitter:creator" content="@superx" />
<meta name="twitter:title" content="SuperX - Ship 10x Faster" />
<meta name="twitter:description" content="AI-powered project management for modern teams." />
<meta name="twitter:image" content="https://www.superx.com/og/og-twitter-en.png" />
<meta name="twitter:image:alt" content="SuperX - Ship 10x Faster" />
```

---

## 4. OG Image Strategy (Twitter + LinkedIn)

### Why Two Separate Images

| Platform | Recommended Size | Aspect Ratio | Notes |
|----------|-----------------|--------------|-------|
| LinkedIn | 1200 x 630 | 1.91:1 | Uses `og:image`. Crops aggressively on mobile. |
| Twitter  | 1200 x 675 | 16:9 approx | Uses `twitter:image`. Falls back to `og:image` if missing. |
| Facebook | 1200 x 630 | 1.91:1 | Uses `og:image`. Same as LinkedIn. |

### Static OG Images (Recommended for Landing Pages)

For a marketing landing page, static pre-designed OG images are better than dynamic ones because you control every pixel. Design them in Figma:

**Design guidelines for OG images that look good everywhere:**
- Keep key content (logo, headline) in the center 800x400px "safe zone"
- Use bold, readable text (minimum 40px equivalent)
- High contrast -- dark text on light background or vice versa
- Include your logo prominently
- Add a subtle gradient or brand color background
- Avoid small text or detailed graphics that get lost at thumbnail size
- Export at exactly 1200x630 (LinkedIn/FB) and 1200x675 (Twitter)
- Keep file size under 300KB (PNG or high-quality JPEG)
- Each language gets its own set with localized headline text

### Dynamic OG Image Generation (Optional, for Scale)

Next.js has a built-in OG image generation API using `@vercel/og`:

```typescript
// src/app/[lang]/opengraph-image.tsx
import { ImageResponse } from 'next/og';
import { type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/getDictionary';

export const runtime = 'edge';
export const alt = 'SuperX';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { lang: Locale } }) {
  const dict = await getDictionary(params.lang);

  // Load brand font
  const interBold = fetch(
    new URL('../../assets/fonts/Inter-Bold.ttf', import.meta.url)
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
        }}
      >
        {/* Logo */}
        <div style={{ fontSize: 32, color: '#60a5fa', marginBottom: 20 }}>
          SUPERX
        </div>
        {/* Headline */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: '#ffffff',
            textAlign: 'center',
            lineHeight: 1.2,
            maxWidth: '900px',
          }}
        >
          {dict.hero.headline}
        </div>
        {/* Subheadline */}
        <div
          style={{
            fontSize: 28,
            color: '#94a3b8',
            marginTop: 24,
            textAlign: 'center',
            maxWidth: '700px',
          }}
        >
          {dict.hero.subheadline}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Inter',
          data: await interBold,
          style: 'normal',
          weight: 700,
        },
      ],
    }
  );
}
```

---

## 5. Animations Implementation

### Strategy: CSS-first with Intersection Observer

For a marketing landing page, keep animations performant and accessible. Use CSS animations triggered by Intersection Observer -- no heavy JS animation libraries needed.

### Reusable Animated Section Component

```typescript
// src/components/AnimatedSection.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

type AnimationType = 'fade-up' | 'fade-in' | 'slide-left' | 'slide-right' | 'scale-up' | 'blur-in';

interface AnimatedSectionProps {
  children: React.ReactNode;
  animation?: AnimationType;
  delay?: number;      // ms
  duration?: number;    // ms
  threshold?: number;   // 0-1, how much must be visible
  className?: string;
  once?: boolean;       // animate only once (default true)
}

export default function AnimatedSection({
  children,
  animation = 'fade-up',
  delay = 0,
  duration = 700,
  threshold = 0.15,
  className = '',
  once = true,
}: AnimatedSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once && ref.current) {
            observer.unobserve(ref.current);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, once]);

  const baseStyles: React.CSSProperties = {
    transitionProperty: 'opacity, transform, filter',
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)', // ease-out-expo
    transitionDelay: `${delay}ms`,
  };

  const animationMap: Record<AnimationType, {
    hidden: React.CSSProperties;
    visible: React.CSSProperties;
  }> = {
    'fade-up': {
      hidden: { opacity: 0, transform: 'translateY(40px)' },
      visible: { opacity: 1, transform: 'translateY(0)' },
    },
    'fade-in': {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    },
    'slide-left': {
      hidden: { opacity: 0, transform: 'translateX(-60px)' },
      visible: { opacity: 1, transform: 'translateX(0)' },
    },
    'slide-right': {
      hidden: { opacity: 0, transform: 'translateX(60px)' },
      visible: { opacity: 1, transform: 'translateX(0)' },
    },
    'scale-up': {
      hidden: { opacity: 0, transform: 'scale(0.9)' },
      visible: { opacity: 1, transform: 'scale(1)' },
    },
    'blur-in': {
      hidden: { opacity: 0, filter: 'blur(10px)' },
      visible: { opacity: 1, filter: 'blur(0)' },
    },
  };

  const currentAnimation = animationMap[animation];
  const stateStyles = isVisible ? currentAnimation.visible : currentAnimation.hidden;

  return (
    <div
      ref={ref}
      className={className}
      style={{ ...baseStyles, ...stateStyles }}
    >
      {children}
    </div>
  );
}
```

### Staggered Feature Cards Animation

```typescript
// Usage in Features.tsx
import AnimatedSection from './AnimatedSection';

export default function Features({ dict }: { dict: any }) {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <AnimatedSection animation="fade-up">
          <h2 className="text-4xl font-bold text-center mb-16">
            {dict.features.title}
          </h2>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8">
          {dict.features.items.map((feature: any, i: number) => (
            <AnimatedSection
              key={i}
              animation="fade-up"
              delay={i * 150}  /* Stagger: 0ms, 150ms, 300ms */
            >
              <div className="p-8 rounded-2xl border border-gray-100
                              hover:shadow-lg transition-shadow duration-300">
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### Hero Section with Entrance Animations

```typescript
// src/components/Hero.tsx
'use client';

import { useEffect, useState } from 'react';

export default function Hero({ dict }: { dict: any }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <section className="relative min-h-screen flex items-center justify-center
                        overflow-hidden bg-slate-950">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20
                      via-purple-600/10 to-transparent animate-gradient" />

      <div className="relative z-10 max-w-4xl mx-auto text-center px-6">
        <h1
          className="text-5xl md:text-7xl font-bold text-white leading-tight"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {dict.hero.headline}
        </h1>

        <p
          className="mt-6 text-xl text-slate-300 max-w-2xl mx-auto"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
          }}
        >
          {dict.hero.subheadline}
        </p>

        <div
          className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s',
          }}
        >
          <a
            href="#signup"
            className="px-8 py-4 bg-blue-600 text-white rounded-full font-semibold
                       hover:bg-blue-500 hover:scale-105 active:scale-95
                       transition-all duration-200"
          >
            {dict.hero.cta}
          </a>
          <a
            href="#demo"
            className="px-8 py-4 border border-slate-600 text-white rounded-full
                       font-semibold hover:border-slate-400 hover:scale-105
                       active:scale-95 transition-all duration-200"
          >
            {dict.hero.secondaryCta}
          </a>
        </div>
      </div>
    </section>
  );
}
```

### CSS Animations (globals.css)

```css
/* src/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Smooth scrolling with reduced-motion respect */
@media (prefers-reduced-motion: no-preference) {
  html {
    scroll-behavior: smooth;
  }
}

/* Respect prefers-reduced-motion globally */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Animated gradient background for hero */
@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.animate-gradient {
  background-size: 200% 200%;
  animation: gradient-shift 8s ease infinite;
}

/* Floating animation for decorative elements */
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

/* Subtle pulse for CTA buttons */
@keyframes subtle-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
  50% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
}

.animate-cta-pulse {
  animation: subtle-pulse 3s ease-in-out infinite;
}
```

---

## 6. Hreflang Deep Dive

### Common Hreflang Mistakes to Avoid

1. **Missing x-default**: Always include it. It tells search engines which page to show when no locale matches.
2. **Non-reciprocal tags**: Every page must reference ALL other language versions, including itself. Our `generateMetadata` function handles this by looping through all locales.
3. **Wrong language codes**: Use ISO 639-1 (2-letter). For regional variants use `en-US`, `es-MX`, `fr-CA`.
4. **Missing self-referencing**: Each page must include a hreflang pointing to itself. Our loop includes the current locale.
5. **Canonical conflicts**: The canonical URL must match the hreflang for that locale. Our implementation ensures `canonical` matches `/${lang}`.

### Middleware for Locale Detection and Redirects

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { i18n } from '@/i18n/config';

function getLocale(request: NextRequest): string {
  // Check cookie first (returning user preference)
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && i18n.locales.includes(cookieLocale as any)) {
    return cookieLocale;
  }

  // Parse Accept-Language header
  const acceptLang = request.headers.get('Accept-Language') || '';
  const preferredLocales = acceptLang
    .split(',')
    .map((lang) => {
      const [code, q] = lang.trim().split(';q=');
      return {
        code: code.split('-')[0].toLowerCase(),
        q: q ? parseFloat(q) : 1,
      };
    })
    .sort((a, b) => b.q - a.q);

  for (const { code } of preferredLocales) {
    if (i18n.locales.includes(code as any)) {
      return code;
    }
  }

  return i18n.defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if pathname already has a locale
  const pathnameHasLocale = i18n.locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) return;

  // Redirect to locale-prefixed URL
  const locale = getLocale(request);
  const newUrl = new URL(`/${locale}${pathname}`, request.url);
  const response = NextResponse.redirect(newUrl);
  response.cookies.set('NEXT_LOCALE', locale, {
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const config = {
  matcher: [
    '/((?!_next|api|og|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
```

---

## 7. Sitemap and Robots.txt

### Dynamic Sitemap with Locale URLs

```typescript
// src/app/sitemap.ts
import { MetadataRoute } from 'next';
import { i18n } from '@/i18n/config';

const BASE_URL = 'https://www.superx.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [''];  // Add more paths as needed: '/pricing', '/features'

  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    for (const locale of i18n.locales) {
      const alternates: Record<string, string> = {};
      for (const altLocale of i18n.locales) {
        alternates[altLocale] = `${BASE_URL}/${altLocale}${page}`;
      }

      entries.push({
        url: `${BASE_URL}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: page === '' ? 1.0 : 0.8,
        alternates: {
          languages: alternates,
        },
      });
    }
  }

  return entries;
}
```

### Robots.txt

```typescript
// src/app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/_next/'],
    },
    sitemap: 'https://www.superx.com/sitemap.xml',
  };
}
```

---

## 8. Landing Page Assembly

```typescript
// src/app/[lang]/page.tsx
import { type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/getDictionary';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import Testimonials from '@/components/Testimonials';
import CTA from '@/components/CTA';
import Footer from '@/components/Footer';

export default async function LandingPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return (
    <main>
      <Hero dict={dict} />
      <Features dict={dict} />
      <Testimonials dict={dict} />
      <CTA dict={dict} />
      <Footer dict={dict} lang={lang} />
    </main>
  );
}
```

---

## 9. Validation and Testing Checklist

### OG Image Preview Testing
- **Twitter**: Use https://cards-dev.twitter.com/validator (or post a tweet in draft)
- **LinkedIn**: Use https://www.linkedin.com/post-inspector/
- **Facebook**: Use https://developers.facebook.com/tools/debug/
- **General**: Use https://www.opengraph.xyz/ for a quick multi-platform preview

### Hreflang Validation
- Use Ahrefs hreflang audit or Screaming Frog to crawl all locale URLs
- Verify every page has reciprocal hreflang tags
- Confirm x-default is present on every page
- Check that canonical URLs match hreflang self-references

### SEO Checklist
- [ ] Title tags are unique per locale and under 60 characters
- [ ] Meta descriptions are unique per locale and under 155 characters
- [ ] H1 tags are present and unique per page
- [ ] JSON-LD structured data validates at https://validator.schema.org/
- [ ] Sitemap includes all locale URLs with hreflang alternates
- [ ] robots.txt allows crawling and points to sitemap
- [ ] Core Web Vitals pass (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- [ ] Images have alt text in the correct language
- [ ] No mixed content (HTTP resources on HTTPS pages)

### Animation Accessibility
- [ ] `prefers-reduced-motion` is respected (animations disabled)
- [ ] No content is hidden permanently behind animations
- [ ] Animations use `transform` and `opacity` only (GPU-accelerated, no layout thrashing)
- [ ] No flashing or strobing effects

---

## 10. Performance Considerations

| Technique | Implementation |
|-----------|---------------|
| **Font loading** | Use `next/font` with `display: 'swap'` to prevent FOIT |
| **Image optimization** | Use `next/image` with AVIF/WebP, proper `sizes` attribute |
| **Code splitting** | App Router auto-splits per route; client components are lazy-loaded |
| **Dictionary loading** | Dynamic imports per locale -- only the active language JSON is loaded |
| **CSS animations** | GPU-accelerated properties only (`transform`, `opacity`, `filter`) |
| **OG images** | Static files in `/public/og/` -- no server-side generation overhead |

---

## Summary

This architecture provides:

1. **SEO**: Server-rendered HTML with complete meta tags, JSON-LD structured data, dynamic sitemap with hreflang alternates, and proper canonical URLs.
2. **Animations**: Performant CSS-only animations triggered by Intersection Observer, with `prefers-reduced-motion` support and GPU-accelerated properties.
3. **OG Previews**: Separate optimized images for Twitter (1200x675) and LinkedIn/Facebook (1200x630), with per-language variants and proper meta tag differentiation.
4. **Hreflang**: Complete implementation via Next.js metadata API with x-default, self-referencing tags, reciprocal links across all 3 locales, and matching canonical URLs.
5. **Multi-language**: Clean `[lang]` route segments, lazy-loaded dictionaries, browser locale detection via middleware, and cookie-based preference persistence.
