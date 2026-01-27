# Production Security Requirements

This document outlines the security requirements and best practices for deploying the Catalyst application to production.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Database Security](#database-security)
- [Authentication & Session Management](#authentication--session-management)
- [HTTPS & TLS](#https--tls)
- [Proxy Configuration](#proxy-configuration)
- [Error Handling](#error-handling)
- [Content Security Policy](#content-security-policy)
- [Deployment Checklist](#deployment-checklist)
- [Security Headers](#security-headers)
- [Monitoring & Logging](#monitoring--logging)

---

## Environment Variables

### Required Environment Variables

All environment variables containing secrets MUST be set securely in production:

```bash
# Database (Application User - Limited Privileges)
DATABASE_URL="mysql://user:password@host:3306/database"

# Database (Migration User - Root/Admin Privileges)
# Only needed for migration operations, not runtime
DATABASE_URL_MIGRATE="mysql://root:password@host:3306/database"

# Authentication
BETTER_AUTH_SECRET="<generate-with: openssl rand -base64 32>"
BETTER_AUTH_URL="https://yourdomain.com"
NEXT_PUBLIC_APP_URL="https://yourdomain.com"

# MySQL (if self-hosting)
MYSQL_ROOT_PASSWORD="<strong-password>"
MYSQL_DATABASE="catalyst"
MYSQL_USER="catalyst_user"
MYSQL_PASSWORD="<strong-password>"
```

### Critical Security Rules

1. **Never commit secrets to version control**
    - `.env` files are gitignored
    - Use environment variable managers (AWS Secrets Manager, Vault, etc.)
    - Rotate secrets regularly

2. **Generate strong secrets**

    ```bash
    # Generate BETTER_AUTH_SECRET
    openssl rand -base64 32

    # Generate database passwords (32 characters, alphanumeric + symbols)
    openssl rand -base64 24
    ```

3. **Separate database users**
    - `DATABASE_URL`: Limited privileges (SELECT, INSERT, UPDATE, DELETE only)
    - `DATABASE_URL_MIGRATE`: Root/admin privileges (only for migrations, not runtime)
    - Never use root credentials in production application runtime

4. **Environment-specific values**
    - Use different secrets for development, staging, and production
    - Never reuse production secrets in other environments

---

## Database Security

### MySQL Configuration

1. **Network isolation**

    ```sql
    -- Bind to localhost only if app and DB are on same server
    bind-address = 127.0.0.1

    -- Or use private network IP for separate servers
    bind-address = 10.0.1.5
    ```

2. **User privileges**

    ```sql
    -- Create limited application user
    CREATE USER 'catalyst_user'@'%' IDENTIFIED BY 'strong_password';
    GRANT SELECT, INSERT, UPDATE, DELETE ON catalyst.* TO 'catalyst_user'@'%';
    FLUSH PRIVILEGES;

    -- Root user should only be used for migrations
    -- Restrict root access by host
    RENAME USER 'root'@'%' TO 'root'@'localhost';
    ```

3. **TLS/SSL for database connections**

    ```bash
    # In DATABASE_URL
    DATABASE_URL="mysql://user:pass@host:3306/db?ssl=true"
    ```

4. **Regular backups**
    - Automate daily backups
    - Store backups in separate secure location
    - Test restoration process regularly
    - Encrypt backup files

5. **Disable remote root login**
    ```sql
    DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1');
    FLUSH PRIVILEGES;
    ```

---

## Authentication & Session Management

### Better Auth Configuration

1. **Session security**
    - Sessions expire after 7 days (configurable in `packages/auth/src/auth.ts`)
    - Cookies are HTTP-only, secure, and SameSite=Lax
    - Session tokens are cryptographically signed

2. **Password requirements**

    ```typescript
    // In production, enforce strong password policy
    // packages/auth/src/auth.ts
    password: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
    }
    ```

3. **Rate limiting**
    - Implement rate limiting on authentication endpoints
    - Recommended: max 5 failed attempts per 15 minutes
    - Use tools like `express-rate-limit` or Cloudflare

4. **CSRF protection**
    - Better Auth includes built-in CSRF protection
    - Ensure `BETTER_AUTH_URL` matches production domain exactly

5. **Account security features**
    - Enable email verification (already configured)
    - Consider adding 2FA in future iterations
    - Implement account lockout after repeated failed logins
    - Log authentication events

### Cookie Security

Cookies are automatically configured securely by Better Auth:

```typescript
{
    httpOnly: true,      // Prevents JavaScript access
    secure: true,        // HTTPS only (enforced in production)
    sameSite: "lax",     // CSRF protection
    path: "/",
    maxAge: 7 * 24 * 60 * 60  // 7 days
}
```

**CRITICAL**: Cookies are shared across frontend and agent apps via same domain. Ensure both apps are on the same root domain (e.g., `app.yourdomain.com` and `app.yourdomain.com/agent`).

---

## HTTPS & TLS

### Requirements

1. **HTTPS is mandatory in production**
    - All traffic must be encrypted
    - HTTP should redirect to HTTPS
    - Use TLS 1.2 or higher (TLS 1.3 preferred)

2. **TLS certificate**
    - Use certificates from trusted CA (Let's Encrypt, DigiCert, etc.)
    - Automate certificate renewal
    - Monitor certificate expiration

3. **Reverse proxy configuration** (Caddy example)

    ```caddyfile
    yourdomain.com {
        # Automatic HTTPS with Let's Encrypt

        # Security headers
        header {
            # HSTS - Force HTTPS for 1 year
            Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

            # Prevent clickjacking
            X-Frame-Options "SAMEORIGIN"

            # XSS protection
            X-Content-Type-Options "nosniff"

            # Referrer policy
            Referrer-Policy "strict-origin-when-cross-origin"
        }

        # Frontend app
        reverse_proxy localhost:3000

        # Agent app
        handle_path /agent* {
            reverse_proxy localhost:3001
        }
    }
    ```

4. **Alternative: Nginx configuration**

    ```nginx
    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /path/to/cert.pem;
        ssl_certificate_key /path/to/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Security headers (see below)
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;

        location / {
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /agent {
            proxy_pass http://localhost:3001;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }
    ```

---

## Proxy Configuration

### Next.js 16 Proxy (proxy.ts)

Both apps use `proxy.ts` for authentication middleware. Ensure proper configuration:

**Frontend** (`apps/frontend/src/proxy.ts`):

- Public routes: `/`, `/signup`, `/api/auth/*`
- All other routes require authentication

**Agent** (`apps/agent/src/proxy.ts`):

- Entire app requires authentication
- Redirects to frontend if unauthenticated

### Security considerations

1. **Matcher patterns**
    - Exclude static assets (`_next/static`, `_next/image`, `favicon.ico`)
    - Be specific about protected routes
    - Test all route patterns thoroughly

2. **Redirect URLs**
    - Use absolute URLs for cross-origin redirects
    - Validate redirect targets to prevent open redirects
    - Never redirect to user-controlled URLs

3. **Error handling**
    - Return appropriate HTTP status codes (401, 403)
    - Don't leak sensitive information in error messages
    - Log authentication failures for monitoring

---

## Error Handling

### Error Boundaries

Error boundaries are implemented at multiple levels:

1. **Global errors** (`global-error.tsx`)
    - Catches errors in root layout
    - Only activates in production builds
    - Minimal, dependency-free UI

2. **Route segment errors** (`error.tsx`)
    - Catches errors within specific routes
    - Uses shared UI components
    - Logs errors for debugging

### Production error logging

**CRITICAL**: In production, errors should be logged to external service:

```typescript
// apps/frontend/src/app/error.tsx
useEffect(() => {
    // Replace console.error with error reporting service
    if (process.env.NODE_ENV === "production") {
        // Example: Sentry, DataDog, etc.
        errorReportingService.captureException(error);
    } else {
        console.error("Frontend app error:", error);
    }
}, [error]);
```

### Recommended error reporting services

- [Sentry](https://sentry.io/) - Open source, feature-rich
- [DataDog](https://www.datadoghq.com/) - Full observability platform
- [LogRocket](https://logrocket.com/) - Session replay + error tracking
- [Rollbar](https://rollbar.com/) - Error tracking and monitoring

### Error message sanitization

**NEVER expose sensitive information in production errors:**

```typescript
// ❌ BAD - Leaks database info
throw new Error(`Database connection failed: mysql://user:pass@host:3306/db`);

// ✅ GOOD - Generic message
throw new Error("Database connection failed");

// ✅ BETTER - Log details internally, show generic message
logger.error("Database connection failed", { url, error });
throw new Error("An error occurred. Please try again later.");
```

---

## Content Security Policy

### Next.js configuration

Add CSP headers in `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    {
                        key: "Content-Security-Policy",
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // 'unsafe-eval' needed for Next.js dev
                            "style-src 'self' 'unsafe-inline'",
                            "img-src 'self' data: https:",
                            "font-src 'self' data:",
                            "connect-src 'self'",
                            "frame-ancestors 'none'"
                        ].join("; ")
                    }
                ]
            }
        ];
    }
};
```

### Tighten for production

Remove `'unsafe-eval'` and `'unsafe-inline'` in production:

```typescript
const isDevelopment = process.env.NODE_ENV === "development";

const cspHeader = [
    "default-src 'self'",
    isDevelopment ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" : "script-src 'self'",
    isDevelopment ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'"
].join("; ");
```

---

## Security Headers

### Recommended headers for production

Configure in reverse proxy (Caddy, Nginx) or Next.js config:

```typescript
{
    // HSTS - Force HTTPS for 1 year
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",

    // Prevent clickjacking
    "X-Frame-Options": "SAMEORIGIN",

    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",

    // XSS protection (legacy, but still useful)
    "X-XSS-Protection": "1; mode=block",

    // Referrer policy
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Permissions policy
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
}
```

### Next.js headers configuration

```typescript
// apps/frontend/next.config.ts
const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    {
                        key: "Strict-Transport-Security",
                        value: "max-age=31536000; includeSubDomains; preload"
                    },
                    {
                        key: "X-Frame-Options",
                        value: "SAMEORIGIN"
                    },
                    {
                        key: "X-Content-Type-Options",
                        value: "nosniff"
                    },
                    {
                        key: "Referrer-Policy",
                        value: "strict-origin-when-cross-origin"
                    },
                    {
                        key: "Permissions-Policy",
                        value: "camera=(), microphone=(), geolocation=()"
                    }
                ]
            }
        ];
    }
};
```

---

## Deployment Checklist

### Pre-deployment

- [ ] All environment variables set securely (not in code)
- [ ] `BETTER_AUTH_SECRET` generated with strong random value
- [ ] Database passwords are strong and unique
- [ ] Database user has minimal required privileges
- [ ] `DATABASE_URL` uses limited-privilege user (not root)
- [ ] HTTPS/TLS configured with valid certificate
- [ ] Security headers configured (HSTS, X-Frame-Options, etc.)
- [ ] Content Security Policy configured
- [ ] Error reporting service integrated
- [ ] Rate limiting configured on auth endpoints
- [ ] CORS configured appropriately (if needed)

### Database

- [ ] Database migrations run successfully
- [ ] Database user privileges verified (limited for app, admin only for migrations)
- [ ] Database backups configured and tested
- [ ] Database connection uses TLS/SSL
- [ ] Remote root login disabled

### Application

- [ ] Build succeeds without errors (`bun run build`)
- [ ] Type checking passes (`bun run type-check`)
- [ ] Linting passes (`bun run lint`)
- [ ] Error boundaries tested
- [ ] Authentication flow tested (login, logout, session expiry)
- [ ] Cross-app navigation tested (frontend ↔ agent)
- [ ] Static assets served correctly
- [ ] Cookies shared correctly between apps

### Infrastructure

- [ ] Reverse proxy configured and tested
- [ ] HTTP → HTTPS redirect working
- [ ] SSL/TLS certificate valid and auto-renewing
- [ ] Server firewall configured (allow 80, 443; block 3000, 3001)
- [ ] Load balancer configured (if using)
- [ ] CDN configured for static assets (optional)

### Monitoring

- [ ] Error logging configured
- [ ] Application logs aggregated
- [ ] Uptime monitoring enabled
- [ ] Performance monitoring configured
- [ ] Database monitoring enabled
- [ ] Alert notifications configured

### Post-deployment

- [ ] Test all critical user flows
- [ ] Verify error reporting is working
- [ ] Check logs for unexpected errors
- [ ] Monitor performance metrics
- [ ] Review security headers (use [securityheaders.com](https://securityheaders.com/))
- [ ] Test SSL configuration (use [ssllabs.com](https://www.ssllabs.com/ssltest/))

---

## Monitoring & Logging

### Application logging

**What to log:**

- Authentication events (login, logout, failed attempts)
- Authorization failures (access denied)
- Database errors
- Application errors (caught by error boundaries)
- API rate limit hits
- Unusual user behavior

**What NOT to log:**

- Passwords or secrets
- Full database connection strings
- Personally identifiable information (PII) without consent
- Credit card numbers or payment details
- Session tokens or auth cookies

### Recommended logging services

- [Datadog](https://www.datadoghq.com/) - Full observability
- [New Relic](https://newrelic.com/) - Application performance monitoring
- [Papertrail](https://www.papertrail.com/) - Simple log aggregation
- [Loggly](https://www.loggly.com/) - Cloud-based log management

### Uptime monitoring

Configure uptime checks for:

- Frontend home page (`https://yourdomain.com/`)
- Agent home page (`https://yourdomain.com/agent`)
- Auth API health (`https://yourdomain.com/api/auth/health`)

Recommended services:

- [UptimeRobot](https://uptimerobot.com/) - Free, simple
- [Pingdom](https://www.pingdom.com/) - Advanced monitoring
- [StatusCake](https://www.statuscake.com/) - Comprehensive checks

---

## Security Incident Response

### If a security breach occurs

1. **Immediate actions**
    - Rotate all secrets immediately (`BETTER_AUTH_SECRET`, database passwords)
    - Invalidate all active sessions
    - Review access logs for unauthorized access
    - Block suspicious IP addresses

2. **Investigation**
    - Identify scope of breach (which data was accessed)
    - Review audit logs and error logs
    - Identify entry point and vulnerability

3. **Remediation**
    - Apply security patches
    - Fix identified vulnerabilities
    - Deploy updated code
    - Monitor for further suspicious activity

4. **Communication**
    - Notify affected users (if PII was compromised)
    - Document incident and response
    - Update security procedures

5. **Post-incident**
    - Conduct security audit
    - Implement additional safeguards
    - Update incident response plan

---

## Regular Security Maintenance

### Weekly

- [ ] Review error logs for anomalies
- [ ] Check uptime and performance metrics
- [ ] Review authentication failure logs

### Monthly

- [ ] Update dependencies (`bun update`)
- [ ] Review security advisories for dependencies
- [ ] Test backup restoration process
- [ ] Review and rotate database passwords

### Quarterly

- [ ] Security audit of codebase
- [ ] Penetration testing (if budget allows)
- [ ] Review and update security headers
- [ ] Review user access and permissions

### Annually

- [ ] Comprehensive security review
- [ ] Update incident response plan
- [ ] Review and update security documentation
- [ ] Compliance audit (if required)

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Most critical web application security risks
- [Next.js Security Documentation](https://nextjs.org/docs/app/building-your-application/security)
- [Better Auth Security Best Practices](https://www.better-auth.com/docs/security)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/) - Most dangerous software weaknesses
- [Security Headers Reference](https://securityheaders.com/)

---

## Contact

For security concerns or to report vulnerabilities, please contact:

- Email: security@yourdomain.com
- Security team: [Add contact information]

**DO NOT** disclose security vulnerabilities publicly until they have been addressed.
