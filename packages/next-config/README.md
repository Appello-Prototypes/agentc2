# @repo/next-config

Shared Next.js configuration utilities for the Catalyst monorepo.

## Overview

This package provides reusable Next.js configuration utilities to eliminate duplication across multiple Next.js applications in the monorepo. It includes shared security headers, environment variable configuration, and dev indicators.

## Features

- **Security Headers**: Production-grade security headers including HSTS, CSP, X-Frame-Options, etc.
- **Environment-Aware CSP**: Automatically adjusts Content Security Policy based on NODE_ENV
- **Shared Environment Variables**: Common environment variable exports
- **Dev Indicators**: Consistent dev indicator positioning

## Usage

### Basic Setup

In your Next.js app's `next.config.ts`:

```typescript
import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";
import { createHeadersConfig, sharedEnv, devIndicators } from "@repo/next-config";

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
    env: sharedEnv,
    devIndicators,
    headers: createHeadersConfig()
    // Add your app-specific configuration here
};

export default nextConfig;
```

### Security Headers

The package includes the following security headers:

- **X-DNS-Prefetch-Control**: `on` - Enables DNS prefetching
- **Strict-Transport-Security**: Forces HTTPS for 1 year with subdomains and preload
- **X-Frame-Options**: `SAMEORIGIN` - Prevents clickjacking
- **X-Content-Type-Options**: `nosniff` - Prevents MIME sniffing
- **X-XSS-Protection**: `1; mode=block` - XSS protection
- **Referrer-Policy**: `strict-origin-when-cross-origin` - Controls referrer information
- **Permissions-Policy**: Disables camera, microphone, and geolocation
- **Content-Security-Policy**: Environment-aware CSP (see below)

### Environment-Aware CSP

The Content Security Policy automatically adjusts based on `NODE_ENV`:

**Development Mode:**

- Allows `'unsafe-eval'` and `'unsafe-inline'` for Next.js hot reloading and Turbopack
- `script-src 'self' 'unsafe-eval' 'unsafe-inline'`
- `style-src 'self' 'unsafe-inline'`

**Production Mode:**

- Strict policy with no unsafe directives
- `script-src 'self'`
- `style-src 'self'`

**Common Rules (Both Environments):**

- `default-src 'self'` - Only allow resources from same origin
- `img-src 'self' data: https:` - Allow images from same origin, data URIs, and HTTPS
- `font-src 'self' data:` - Allow fonts from same origin and data URIs
- `connect-src 'self'` - Only allow API calls to same origin
- `frame-ancestors 'none'` - Prevent embedding in iframes

## API Reference

### `createHeadersConfig()`

Creates the headers configuration for Next.js with all security headers.

**Returns:** `NextConfig["headers"]`

**Example:**

```typescript
const nextConfig: NextConfig = {
    headers: createHeadersConfig()
};
```

### `securityHeaders`

Array of security header objects. Can be used directly if you need to customize or filter headers.

**Type:** `Array<{ key: string; value: string }>`

**Example:**

```typescript
import { securityHeaders } from "@repo/next-config";

const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                source: "/:path*",
                headers: securityHeaders.filter((h) => h.key !== "X-Frame-Options")
            }
        ];
    }
};
```

### `sharedEnv`

Shared environment variables configuration that exposes common variables to both server and client.

**Type:** `{ DATABASE_URL?: string; NEXT_PUBLIC_APP_URL?: string }`

**Example:**

```typescript
const nextConfig: NextConfig = {
    env: sharedEnv
};
```

### `devIndicators`

Shared dev indicators configuration.

**Type:** `{ position: "bottom-right" }`

**Example:**

```typescript
const nextConfig: NextConfig = {
    devIndicators
};
```

## Extending Configuration

You can extend the shared configuration with app-specific settings:

```typescript
import { createHeadersConfig, sharedEnv, devIndicators } from "@repo/next-config";

const nextConfig: NextConfig = {
    // Shared configuration
    env: sharedEnv,
    devIndicators,
    headers: createHeadersConfig(),

    // App-specific configuration
    basePath: "/agent",
    async rewrites() {
        return [
            {
                source: "/api/:path*",
                destination: "http://localhost:4000/api/:path*"
            }
        ];
    }
};
```

## Testing Security Headers

After deployment, verify headers using:

- [Security Headers Scanner](https://securityheaders.com/)
- [SSL Labs SSL Test](https://www.ssllabs.com/ssltest/)
- Browser DevTools → Network tab → Response Headers

## Dependencies

- `next`: ^16.1.0
- `typescript`: ^5

## License

Private package for the Catalyst monorepo.
