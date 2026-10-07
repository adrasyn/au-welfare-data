# Welfare Data Australia design

## Surface and layout

A search-first public tool, read on phones in daylight and laptops at home. Pure white interface, quiet neutral data rows, and an amber action colour derived from the approved design's restrained accent approach. The user's requested receipt is the distinctive visual; interface controls remain conventional.

Desktop: search and figures on the left, receipt/invoice preview on the right. Below 900px: one column; search, figures, then exports. No map in this release or in the future mobile flow.

## Palette

Primary `oklch(0.48 0.11 74.6)`, background `oklch(1 0 0)`, surface `oklch(0.965 0.003 75)`, ink `oklch(0.24 0.006 75)`, muted `oklch(0.47 0.008 75)`, line `oklch(0.86 0.006 75)`. Focus uses a visible amber outline. White text on deep amber actions.

## Type

System sans for navigation, labels and data; fixed rem/pixel scale. Courier New for the receipt, conventional sans for the invoice. Headline 48px desktop/34px mobile, body 16px, data labels 12–14px. Amounts use tabular numerals. Receipts are compact spending-only images labelled “per person”: all receipt text uses one 24px size, with bold weight for emphasis. Each payment and per-resident amount shares a line, followed by the total, short accounting notes and a QR link to the full figures. Invoices retain recipient counts, rates and detailed source notes.

## Components and states

Labelled search with explicit choices; selected-area heading; payment rows with separate count components; receipt/invoice toggle; PNG/PDF actions; visible loading, missing-data and failed-download states. Shared 46px minimum primary action height and clear keyboard focus. Reduced motion turns off scrolling animation and transitions.
