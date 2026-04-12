# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Current App

- **Mobile artifact**: `artifacts/mobile` — Parinay Saree Bill Generator, an Expo mobile app for local invoice generation, PDF print/share, product catalog syncing, customer CRM, order history, bill archive, bill editing, and store settings.
- The mobile app stores customers, bills, settings, invoice number state, draft state, and product catalog data locally with AsyncStorage.
- Product catalog sync uses the existing remote JSON source: `https://raw.githubusercontent.com/Apoc-lengend/saree/main/data.json`, with an offline starter catalog fallback.
- Synced catalog products preserve per-product discount percentages. Bill totals subtract catalog item discounts first, then any bill-level discount, before GST and delivery.
- Saved bills are available in the Bills tab and in each customer profile for reprint/share, edit, or deletion.
- Invoice PDF HTML is generated in `artifacts/mobile/utils/invoicePdf.ts` and follows the Parinay Saree burgundy/gold branded invoice layout.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo Router, React Native, AsyncStorage, expo-print, expo-sharing

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/mobile run dev` — run the Expo mobile app locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
