---
name: Elite Athletic Management
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3e4a41'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6e7a70'
  outline-variant: '#bdcabe'
  surface-tint: '#006d40'
  primary: '#006c40'
  on-primary: '#ffffff'
  primary-container: '#0b8852'
  on-primary-container: '#ffffff'
  inverse-primary: '#72db9d'
  secondary: '#575e70'
  on-secondary: '#ffffff'
  secondary-container: '#d9dff5'
  on-secondary-container: '#5c6274'
  tertiary: '#006c3e'
  on-tertiary: '#ffffff'
  tertiary-container: '#00884f'
  on-tertiary-container: '#ffffff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#8ef8b7'
  primary-fixed-dim: '#72db9d'
  on-primary-fixed: '#002110'
  on-primary-fixed-variant: '#00522f'
  secondary-fixed: '#dce2f7'
  secondary-fixed-dim: '#c0c6db'
  on-secondary-fixed: '#141b2b'
  on-secondary-fixed-variant: '#404758'
  tertiary-fixed: '#72fcab'
  tertiary-fixed-dim: '#52df91'
  on-tertiary-fixed: '#00210f'
  on-tertiary-fixed-variant: '#00522e'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  background-surface: '#FFFFFF'
  border-subtle: '#E2E8F0'
  text-primary: '#111827'
  text-secondary: '#4B5563'
  accent-cyan: '#00D4FF'
  deep-navy: '#081C3A'
typography:
  display-lg:
    fontFamily: Poppins
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Poppins
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Poppins
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  title-lg:
    fontFamily: Poppins
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Poppins
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Poppins
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Poppins
    fontSize: 13px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  caption:
    fontFamily: Poppins
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 48px
  section-gap: 80px
---

## Brand & Style

This design system is engineered for a premium enterprise sports management platform. It balances the high-energy nature of competitive sports with the disciplined, sophisticated aesthetic of top-tier SaaS platforms like Stripe and Linear.

The design style is **Modern Corporate**, utilizing a refined "Glassmorphism" approach for overlays and a "Tactile" depth for interactive cards. The objective is to evoke a sense of professional authority, technical precision, and athletic excellence. Every interface element is designed to feel high-end, utilizing generous whitespace and a "less is more" philosophy.

Photography is the primary visual storytelling tool, focusing on high-definition, professional action shots of Indian athletes to ground the digital experience in real-world sports excellence. Illustrations are strictly avoided to maintain the enterprise-grade seriousness of the platform.

## Colors

The color strategy centers on a "Victory Green" (`#0B8852`) that represents both the field of play and professional growth. This is supported by a "Championship Navy" (`#111827`) which provides the necessary weight for enterprise navigation and text hierarchies.

- **Primary:** Used for primary actions, success states, and key branding moments.
- **Secondary:** Used for global navigation backgrounds, headings, and high-contrast UI elements.
- **Accent:** A brighter green (`#15B66D`) is reserved for highlights, interactive hover states, and "live" indicators.
- **Neutral/Background:** The environment is predominantly white and light gray to ensure the data and photography remain the focal points.
- **Gradients:** Subtle linear gradients (135°) from Primary to Accent Green are used sparingly on featured cards or "Start" buttons to add a premium polish.

## Typography

The typography uses **Poppins** across all levels to maintain a clean, geometric, and modern feel. The hierarchy is established through significant weight variance and deliberate line heights.

- **Display & Headlines:** Use tighter letter spacing and heavier weights to create an impactful, editorial look for tournament titles and key metrics.
- **Body Text:** Standardized at 16px for readability in data-heavy views.
- **Labels:** Small, uppercase, and slightly tracked-out labels are used for category headers and table columns to provide a clear structural distinction.
- **Enterprise Scale:** For the 1440px desktop target, ensure headers are never crowded; use margins to let large typography "breathe."

## Layout & Spacing

The layout follows a **Fixed-Fluid hybrid grid**. The main content container is capped at 1440px to ensure optimal line lengths and professional composition on ultra-wide monitors.

- **Grid:** A 12-column grid with 24px gutters.
- **Rhythm:** An 8px linear scale is used for all internal component spacing and padding (e.g., 8, 16, 24, 32, 48, 64).
- **Whitespace:** Emphasize vertical whitespace between sections (80px+) to distinguish between different tournament phases or administrative modules.
- **Sidebars:** Persistent left-hand navigation is fixed at 280px, utilizing the Dark Navy color for high-contrast separation from the content area.

## Elevation & Depth

Hierarchy is conveyed through **Tonal Layers** and **Ambient Shadows**, inspired by the Apple/Stripe aesthetic.

- **Surface 0 (Background):** White (#FFFFFF) or very light tint (#F8FAFC).
- **Surface 1 (Cards):** White with a 1px subtle border (#E2E8F0) and a very soft, diffused shadow (0px 4px 20px rgba(0, 0, 0, 0.03)).
- **Surface 2 (Interactive/Floating):** Higher elevation with a more pronounced shadow (0px 10px 30px rgba(0, 0, 0, 0.08)) and a subtle glassmorphism effect (Backdrop blur: 12px) when overlaying photography.
- **Transitions:** All elevation changes (e.g., card hover) must use a 200ms ease-out transition.

## Shapes

The design system utilizes a generous **18px border radius** for all primary containers and cards to create a modern, friendly, yet professional feel.

- **Large Components:** Tournament cards, dashboard widgets, and modal containers use the 18px (`rounded-xl`) radius.
- **Small Components:** Buttons and input fields use an 8px (`rounded-md`) radius to maintain a precise, "clickable" look.
- **Tags/Chips:** Fully rounded (pill-shaped) to distinguish them from interactive buttons.
- **Images:** Sports photography should always be masked with the 18px radius when used within cards.

## Components

### Buttons
- **Primary:** Solid Primary Green (#0B8852) with white text. Subtle 2px inner glow for a tactile look.
- **Secondary:** Transparent background with a 1px border of Navy (#111827) or Gray (#E2E8F0).
- **Tertiary:** Ghost style, using Primary Green text with no background until hover.

### Cards
- **Tournament Card:** Features a top-aligned photo of athletes, an 18px radius, and a subtle bottom-heavy shadow. Content is padded by 24px.
- **Metric Card:** Minimalist, focusing on a single large number (e.g., "Registered Teams") with a small trending icon in Accent Green.

### Input Fields
- **Search & Forms:** Light Gray (#F8FAFC) backgrounds with 1px border. Focus state uses a 2px Primary Green ring with 20% opacity.
- **Labels:** Positioned strictly above the field using `label-md` typography.

### Chips & Badges
- **Status Badges:** Use a soft background tint of the status color (e.g., Light Green for "Live") with high-saturation text.
- **Category Chips:** Pill-shaped, Navy background for high contrast.

### Lists & Tables
- **Enterprise Tables:** Zebra-striping is avoided; instead, use 1px horizontal dividers. Header rows use a Light Gray background with bolded labels. Interactive rows highlight with a subtle #F8FAFC background on hover.
